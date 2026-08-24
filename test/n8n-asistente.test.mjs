// Tests de los nodos Code del asistente de WhatsApp.
//
// n8n no valida la lógica de un nodo Code hasta que le llega un mensaje real,
// y para entonces ya hay un cliente esperando respuesta. Estos tests corren esa
// misma lógica contra payloads con la forma exacta que manda Meta.
//
//   node --test test/
//
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.dirname(fileURLToPath(import.meta.url));
const wf = JSON.parse(
  fs.readFileSync(path.join(raiz, '..', 'n8n', 'asistente-whatsapp.json'), 'utf8'));

const codeDe = (nombre) => {
  const nodo = wf.nodes.find((n) => n.name === nombre);
  assert.ok(nodo, `no existe el nodo "${nombre}"`);
  return nodo.parameters.jsCode;
};

// n8n envuelve el jsCode en una función y le inyecta estos helpers.
const correr = (js, { $json = {}, $input = {}, staticData = {}, $env = {}, nodos = {} } = {}) => {
  const fn = new Function(
    '$json', '$input', '$getWorkflowStaticData', '$env', '$', 'require',
    js);
  return fn(
    $json,
    $input,
    () => staticData,
    $env,
    (nombre) => nodos[nombre],
    (m) => { if (m === 'crypto') return crypto; throw new Error('módulo no permitido: ' + m); },
  );
};

// Payload con la forma exacta que documenta Meta.
const payloadTexto = (texto, wamid = 'wamid.ABC123') => ({
  object: 'whatsapp_business_account',
  entry: [{
    id: '000',
    changes: [{
      field: 'messages',
      value: {
        messaging_product: 'whatsapp',
        metadata: { display_phone_number: '541161691209', phone_number_id: '111' },
        contacts: [{ profile: { name: 'Mateo' }, wa_id: '5491100000000' }],
        messages: [{
          from: '5491100000000',
          id: wamid,
          timestamp: '1700000000',
          text: { body: texto },
          type: 'text',
        }],
      },
    }],
  }],
});

// ---------------------------------------------------------------- firma

test('firma: acepta una firma calculada con el secreto correcto', () => {
  const body = { hola: 'mundo' };
  const crudo = Buffer.from(JSON.stringify(body), 'utf8');
  const firma = 'sha256=' + crypto.createHmac('sha256', 'secreto').update(crudo).digest('hex');

  const out = correr(codeDe('Verificar la firma'), {
    $env: { META_APP_SECRET: 'secreto' },
    $input: { first: () => ({
      json: { headers: { 'x-hub-signature-256': firma }, body },
      binary: { data: { data: crudo.toString('base64') } },
    }) },
  });
  assert.equal(out[0].json.firmaValida, true);
});

test('firma: rechaza una firma hecha con otro secreto', () => {
  const body = { hola: 'mundo' };
  const crudo = Buffer.from(JSON.stringify(body), 'utf8');
  const firma = 'sha256=' + crypto.createHmac('sha256', 'OTRO').update(crudo).digest('hex');

  const out = correr(codeDe('Verificar la firma'), {
    $env: { META_APP_SECRET: 'secreto' },
    $input: { first: () => ({
      json: { headers: { 'x-hub-signature-256': firma }, body },
      binary: { data: { data: crudo.toString('base64') } },
    }) },
  });
  assert.equal(out[0].json.firmaValida, false);
});

test('firma: rechaza si no viene el header, sin explotar', () => {
  const out = correr(codeDe('Verificar la firma'), {
    $env: { META_APP_SECRET: 'secreto' },
    $input: { first: () => ({ json: { headers: {}, body: {} } }) },
  });
  assert.equal(out[0].json.firmaValida, false);
});

test('firma: falla fuerte si falta el secreto, en vez de aceptar todo', () => {
  assert.throws(() => correr(codeDe('Verificar la firma'), {
    $env: {},
    $input: { first: () => ({ json: { headers: {}, body: {} } }) },
  }), /META_APP_SECRET/);
});

// ------------------------------------------------------- extraer/dedupe

test('extraer: saca el texto del lugar correcto del payload', () => {
  const out = correr(codeDe('Extraer mensaje y deduplicar'), {
    $json: { body: payloadTexto('¿Tienen anillado?') },
  });
  assert.equal(out[0].json.procesar, true);
  assert.equal(out[0].json.texto, '¿Tienen anillado?');
  assert.equal(out[0].json.de, '5491100000000');
  assert.equal(out[0].json.nombre, 'Mateo');
});

test('extraer: ignora los avisos de entregado/leído (statuses[])', () => {
  const statuses = {
    entry: [{ changes: [{ value: {
      messaging_product: 'whatsapp',
      statuses: [{ id: 'wamid.X', status: 'delivered' }],
    } }] }],
  };
  const out = correr(codeDe('Extraer mensaje y deduplicar'), { $json: { body: statuses } });
  assert.equal(out[0].json.procesar, false);
  assert.match(out[0].json.motivo, /estado/);
});

test('extraer: no procesa dos veces el mismo wamid', () => {
  const staticData = {};
  const js = codeDe('Extraer mensaje y deduplicar');
  const args = { $json: { body: payloadTexto('hola', 'wamid.REPETIDO') }, staticData };

  assert.equal(correr(js, args)[0].json.procesar, true, 'la primera vez sí');
  assert.equal(correr(js, args)[0].json.procesar, false, 'la segunda no');
});

test('extraer: un mensaje que no es texto no inventa un .text.body', () => {
  const conImagen = payloadTexto('x', 'wamid.IMG');
  conImagen.entry[0].changes[0].value.messages[0] = {
    from: '549110', id: 'wamid.IMG', type: 'image', image: { id: 'media-1' },
  };
  const out = correr(codeDe('Extraer mensaje y deduplicar'), { $json: { body: conImagen } });
  assert.equal(out[0].json.tipo, 'image');
  assert.equal(out[0].json.texto, '');
});

test('extraer: la lista de deduplicación no crece sin límite', () => {
  const staticData = { procesados: Array.from({ length: 500 }, (_, i) => 'viejo-' + i) };
  correr(codeDe('Extraer mensaje y deduplicar'), {
    $json: { body: payloadTexto('hola', 'wamid.NUEVO') }, staticData,
  });
  assert.equal(staticData.procesados.length, 500);
  assert.ok(staticData.procesados.includes('wamid.NUEVO'));
});

// ------------------------------------------------------------- decidir

const decidir = (consulta, catalogo = []) => correr(codeDe('Decidir la respuesta'), {
  $input: { all: () => catalogo.map((json) => ({ json })) },
  nodos: { 'Extraer mensaje y deduplicar': { first: () => ({ json: consulta }) } },
})[0].json;

const base = { procesar: true, tipo: 'text', de: '549110', nombre: 'Mateo' };

test('decidir: responde el horario', () => {
  const r = decidir({ ...base, texto: '¿qué horario tienen?' });
  assert.equal(r.respondio, true);
  assert.match(r.respuesta, /20:30/);
});

test('decidir: responde la dirección', () => {
  const r = decidir({ ...base, texto: '¿dónde quedan?' });
  assert.equal(r.respondio, true);
  assert.match(r.respuesta, /Peña 3102/);
});

test('decidir: encuentra el producto en el catálogo y dice el precio', () => {
  const r = decidir({ ...base, texto: 'tienen anillado?' },
    [{ Categoria: 'Impresiones', Producto: 'Anillado hasta 100 hj.', Precio: '$ 1.800' }]);
  assert.equal(r.respondio, true);
  assert.match(r.respuesta, /1\.800/);
});

test('decidir: matchea aunque el cliente escriba sin acentos', () => {
  const r = decidir({ ...base, texto: 'tenes impresion color?' },
    [{ Producto: 'Impresión color A4', Precio: '$ 400' }]);
  assert.equal(r.respondio, true, 'debe matchear "impresion" con "Impresión"');
});

test('decidir: usa el nombre del cliente si Meta lo manda', () => {
  const r = decidir({ ...base, texto: 'horario?' });
  assert.match(r.respuesta, /Mateo/);
});

test('decidir: deriva a la dueña si ninguna regla matchea', () => {
  const r = decidir({ ...base, texto: '¿hacen sellos de goma personalizados?' });
  assert.equal(r.respondio, false);
  assert.ok(r.motivo);
});

test('decidir: deriva un audio en vez de intentar leerlo', () => {
  const r = decidir({ ...base, tipo: 'audio', texto: '' });
  assert.equal(r.respondio, false);
  assert.match(r.motivo, /audio/);
});

test('decidir: si el Sheet falló, deriva en vez de romperse', () => {
  // onError:continueRegularOutput deja pasar un item con la forma del error.
  const r = decidir({ ...base, texto: 'tienen cuadernos?' }, [{ error: 'sheets caido' }]);
  assert.equal(r.respondio, false);
});

test('decidir: nunca inventa un precio que no está en el catálogo', () => {
  const r = decidir({ ...base, texto: 'cuanto sale el anillado?' }, []);
  assert.equal(r.respondio, false, 'sin catálogo no debe arriesgar un precio');
});
