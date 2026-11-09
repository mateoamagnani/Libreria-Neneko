// ============================================================
// Tests de las rutas de la API
//
// Lo que se verifica acá y en ningún otro lado es el cableado: que las
// rutas de escritura EXIJAN Access de verdad. Que el verificador de
// tokens sea correcto (test/acceso.test.mjs) no sirve de nada si
// después una ruta se olvida de llamarlo, y ése es justo el error que
// no se ve mirando el código por encima: el panel funciona igual.
//
// D1 se reemplaza por node:sqlite con un adaptador mínimo, y R2 por un
// Map. No son mocks de la lógica: las consultas que corren son las
// mismas, contra el mismo db/schema.sql.
// ============================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import * as listado from '../functions/api/productos.js';
import * as unitario from '../functions/api/productos/[id].js';
import * as imagenes from '../functions/api/imagenes.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const esquema = readFileSync(join(raiz, 'db/schema.sql'), 'utf8');

// ------------------------------------------------------------
// Dobles de D1 y R2
// ------------------------------------------------------------

/** Adaptador de node:sqlite a la forma que expone D1. */
function d1Falso() {
  const db = new DatabaseSync(':memory:');
  db.exec(esquema);
  return {
    prepare(sql) {
      let binds = [];
      const api = {
        bind(...b) { binds = b; return api; },
        async all() { return { results: db.prepare(sql).all(...binds) }; },
        async run() {
          const r = db.prepare(sql).run(...binds);
          return { meta: { changes: Number(r.changes ?? 0) } };
        },
      };
      return api;
    },
    _db: db,
  };
}

function r2Falso() {
  const guardado = new Map();
  return {
    async put(clave, _cuerpo, opciones) { guardado.set(clave, opciones); return {}; },
    async get(clave) { return guardado.has(clave) ? { body: 'x' } : null; },
    _guardado: guardado,
  };
}

// Access siempre dice que sí / que no, según el test. Las rutas lo
// llaman por el módulo real, así que se controla con la configuración:
// sin ACCESS_* el verificador falla cerrado, que es lo que se quiere
// afirmar en los tests de rechazo.
const ENV_SIN_ACCESS = {};

const pedido = (url, { metodo = 'GET', cuerpo, form } = {}) => new Request(`https://x${url}`, {
  method: metodo,
  headers: cuerpo ? { 'content-type': 'application/json' } : undefined,
  body: form ?? (cuerpo ? JSON.stringify(cuerpo) : undefined),
});

const leer = async (res) => ({ status: res.status, datos: await res.json() });

// Para el camino feliz se arma un env con Access configurado y se
// inyecta un token válido generado con un par de claves propio, igual
// que en acceso.test.mjs pero reducido a lo mínimo.
const EQUIPO = 'neneko.cloudflareaccess.com';
const AUD = 'app-panel';

const b64url = (b) => Buffer.from(b).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlTexto = (s) => b64url(new TextEncoder().encode(s));

const par = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
  true, ['sign', 'verify'],
);
const jwkPub = await crypto.subtle.exportKey('jwk', par.publicKey);

async function tokenValido() {
  const ahora = Math.floor(Date.now() / 1000);
  const h = b64urlTexto(JSON.stringify({ alg: 'RS256', kid: 'k1', typ: 'JWT' }));
  const p = b64urlTexto(JSON.stringify({
    aud: AUD, iss: `https://${EQUIPO}`, exp: ahora + 3600, email: 'duena@neneko.com.ar',
  }));
  const f = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', par.privateKey,
    new TextEncoder().encode(`${h}.${p}`));
  return `${h}.${p}.${b64url(f)}`;
}

// El verificador sale a buscar las claves por red salvo que se le
// inyecten. Las rutas no exponen esa inyección, así que se intercepta
// el fetch global, que es exactamente lo que haría en producción.
const fetchOriginal = globalThis.fetch;
globalThis.fetch = async (url) => {
  if (String(url).includes('cdn-cgi/access/certs')) {
    return new Response(JSON.stringify({
      keys: [{ kty: 'RSA', n: jwkPub.n, e: jwkPub.e, alg: 'RS256', kid: 'k1' }],
    }), { headers: { 'content-type': 'application/json' } });
  }
  return fetchOriginal(url);
};

const envConAccess = (extra) => ({
  ACCESS_TEAM_DOMAIN: EQUIPO, ACCESS_AUD: AUD, ...extra,
});

const autenticado = async (url, opciones = {}) => {
  const r = pedido(url, opciones);
  r.headers.set('Cf-Access-Jwt-Assertion', await tokenValido());
  return r;
};

const alta = (env, o) => env.DB._db.prepare(
  `insert into productos (id,seccion,categoria,nombre,precio,activo,orden)
   values (?,?,?,?,?,?,?)`,
).run(o.id, o.seccion ?? 'novedades', o.categoria ?? 'Impresiones',
      o.nombre ?? 'Fotocopia', o.precio ?? null, o.activo ?? 1, o.orden ?? 0);


// ------------------------------------------------------------
// GET público
// ------------------------------------------------------------

test('GET /api/productos es público y devuelve solo lo publicado', async () => {
  const env = { DB: d1Falso() };
  alta(env, { id: 'a', nombre: 'Visible' });
  alta(env, { id: 'b', nombre: 'Oculto', activo: 0 });

  const { status, datos } = await leer(
    await listado.onRequestGet({ request: pedido('/api/productos'), env }));

  assert.equal(status, 200);
  assert.deepEqual(datos.productos.map((p) => p.nombre), ['Visible']);
});

test('GET con una sección que no existe da 400, no una lista vacía', async () => {
  const env = { DB: d1Falso() };
  const { status } = await leer(
    await listado.onRequestGet({ request: pedido('/api/productos?seccion=blog'), env }));
  assert.equal(status, 400);
});

test('el listado público se cachea, pero por poco tiempo', async () => {
  // Es el camino caliente: sin cache, cada visita pega contra D1 para traer
  // exactamente lo mismo. Pero el sitio dejó de mandar cache-buster cuando
  // salió del Sheet, así que este max-age es ahora lo único que decide
  // cuánto tarda en verse un cambio del panel. Si alguien lo sube a una
  // hora, la dueña cambia un precio y no entiende por qué no pasa nada.
  const env = { DB: d1Falso() };
  const res = await listado.onRequestGet({ request: pedido('/api/productos'), env });
  const cc = res.headers.get('cache-control') || '';
  const maxAge = Number((cc.match(/max-age=(\d+)/) || [])[1]);
  assert.ok(Number.isInteger(maxAge), `no declara max-age: "${cc}"`);
  assert.ok(maxAge > 0 && maxAge <= 300,
    `max-age=${maxAge}: tiene que cachear algo pero no más de 5 minutos`);
});


// ------------------------------------------------------------
// Lo importante: las rutas de escritura exigen Access
// ------------------------------------------------------------

test('GET ?todo=1 SIN Access da 403', async () => {
  // Si no, cualquiera ve los borradores agregando un parámetro.
  const env = { DB: d1Falso(), ...ENV_SIN_ACCESS };
  alta(env, { id: 'b', nombre: 'Oculto', activo: 0 });

  const { status } = await leer(
    await listado.onRequestGet({ request: pedido('/api/productos?todo=1'), env }));
  assert.equal(status, 403);
});

test('POST SIN Access da 403 y no escribe nada', async () => {
  const env = { DB: d1Falso() };
  const { status } = await leer(await listado.onRequestPost({
    request: pedido('/api/productos', { metodo: 'POST', cuerpo: { categoria: 'C', nombre: 'N' } }),
    env,
  }));
  assert.equal(status, 403);
  assert.equal(env.DB._db.prepare('select count(*) c from productos').get().c, 0,
    'rechazó el pedido pero igual escribió');
});

test('PUT SIN Access da 403 y no modifica', async () => {
  const env = { DB: d1Falso() };
  alta(env, { id: 'a', nombre: 'Original' });

  const { status } = await leer(await unitario.onRequestPut({
    request: pedido('/api/productos/a', { metodo: 'PUT', cuerpo: { nombre: 'Hackeado' } }),
    env, params: { id: 'a' },
  }));
  assert.equal(status, 403);
  assert.equal(env.DB._db.prepare('select nombre from productos where id=?').get('a').nombre,
    'Original');
});

test('DELETE SIN Access da 403 y no borra', async () => {
  const env = { DB: d1Falso() };
  alta(env, { id: 'a' });

  const { status } = await leer(await unitario.onRequestDelete({
    request: pedido('/api/productos/a', { metodo: 'DELETE' }), env, params: { id: 'a' },
  }));
  assert.equal(status, 403);
  assert.equal(env.DB._db.prepare('select count(*) c from productos').get().c, 1);
});

test('POST a /api/imagenes SIN Access da 403', async () => {
  const env = { IMAGENES: r2Falso() };
  const { status } = await leer(await imagenes.onRequestPost({
    request: pedido('/api/imagenes', { metodo: 'POST' }), env,
  }));
  assert.equal(status, 403);
  assert.equal(env.IMAGENES._guardado.size, 0);
});


// ------------------------------------------------------------
// Con Access, el camino feliz
// ------------------------------------------------------------

test('POST con Access crea el producto', async () => {
  const env = envConAccess({ DB: d1Falso() });
  const { status, datos } = await leer(await listado.onRequestPost({
    request: await autenticado('/api/productos', {
      metodo: 'POST', cuerpo: { categoria: 'Arte', nombre: 'Témperas', precio: '$ 1.000' },
    }),
    env,
  }));

  assert.equal(status, 201);
  assert.ok(datos.id, 'devuelve el id generado');
  const fila = env.DB._db.prepare('select * from productos where id=?').get(datos.id);
  assert.equal(fila.nombre, 'Témperas');
  assert.equal(fila.precio, '$ 1.000');
});

test('POST con Access pero datos inválidos da 400 con el detalle en castellano', async () => {
  const env = envConAccess({ DB: d1Falso() });
  const { status, datos } = await leer(await listado.onRequestPost({
    request: await autenticado('/api/productos', {
      metodo: 'POST', cuerpo: { categoria: 'Arte', nombre: '' },
    }),
    env,
  }));

  assert.equal(status, 400);
  assert.ok(datos.detalles?.length, 'el panel necesita el detalle para mostrárselo a la dueña');
  assert.match(datos.detalles.join(' '), /nombre/i);
});

test('PUT con Access cambia solo lo que vino', async () => {
  const env = envConAccess({ DB: d1Falso() });
  alta(env, { id: 'a', nombre: 'Fotocopia', precio: '$ 100' });

  const { status } = await leer(await unitario.onRequestPut({
    request: await autenticado('/api/productos/a', { metodo: 'PUT', cuerpo: { activo: false } }),
    env, params: { id: 'a' },
  }));

  assert.equal(status, 200);
  const fila = env.DB._db.prepare('select * from productos where id=?').get('a');
  assert.equal(fila.activo, 0);
  assert.equal(fila.precio, '$ 100', 'el precio sobrevivió a despublicar');
});

test('PUT sobre un producto que ya no existe da 404, no 200', async () => {
  // Si devolviera 200, el panel mostraría "guardado" sobre algo que
  // alguien borró en otra pestaña.
  const env = envConAccess({ DB: d1Falso() });
  const { status } = await leer(await unitario.onRequestPut({
    request: await autenticado('/api/productos/fantasma', {
      metodo: 'PUT', cuerpo: { nombre: 'X' } }),
    env, params: { id: 'fantasma' },
  }));
  assert.equal(status, 404);
});

test('DELETE con Access borra, y repetirlo da 404', async () => {
  const env = envConAccess({ DB: d1Falso() });
  alta(env, { id: 'a' });

  const uno = await leer(await unitario.onRequestDelete({
    request: await autenticado('/api/productos/a', { metodo: 'DELETE' }),
    env, params: { id: 'a' },
  }));
  assert.equal(uno.status, 200);

  const dos = await leer(await unitario.onRequestDelete({
    request: await autenticado('/api/productos/a', { metodo: 'DELETE' }),
    env, params: { id: 'a' },
  }));
  assert.equal(dos.status, 404);
});

test('GET ?todo=1 con Access sí muestra lo despublicado', async () => {
  const env = envConAccess({ DB: d1Falso() });
  alta(env, { id: 'a', nombre: 'Visible' });
  alta(env, { id: 'b', nombre: 'Oculto', activo: 0 });

  const { status, datos } = await leer(await listado.onRequestGet({
    request: await autenticado('/api/productos?todo=1'), env,
  }));
  assert.equal(status, 200);
  assert.equal(datos.productos.length, 2);
});


// ------------------------------------------------------------
// Imágenes: los límites de CLAUDE.md, ahora exigidos
// ------------------------------------------------------------

const subir = async (env, { bytes, tipo, nombre = 'foto.jpg' }) => {
  const form = new FormData();
  form.set('archivo', new File([new Uint8Array(bytes)], nombre, { type: tipo }));
  const r = new Request('https://x/api/imagenes', { method: 'POST', body: form });
  r.headers.set('Cf-Access-Jwt-Assertion', await tokenValido());
  return leer(await imagenes.onRequestPost({ request: r, env }));
};

test('una foto dentro del límite se guarda y devuelve ruta relativa', async () => {
  const env = envConAccess({ IMAGENES: r2Falso() });
  const { status, datos } = await subir(env, { bytes: 100 * 1024, tipo: 'image/jpeg' });

  assert.equal(status, 201);
  assert.match(datos.url, /^\/img\/[0-9a-f-]+\.jpg$/,
    'relativa, porque el dominio va a cambiar');
  assert.equal(env.IMAGENES._guardado.size, 1);
});

test('una foto de más de 500 KB se rechaza y explica qué hacer', async () => {
  // CLAUDE.md lo documentaba desde siempre, pero nada lo hacía cumplir:
  // la dueña subía al Sheet lo que quisiera.
  const env = envConAccess({ IMAGENES: r2Falso() });
  const { status, datos } = await subir(env, { bytes: 600 * 1024, tipo: 'image/jpeg' });

  assert.equal(status, 400);
  assert.match(datos.error, /500 KB/);
  assert.match(datos.error, /celular|achic/i, 'tiene que decirle qué hacer, no solo que no');
  assert.equal(env.IMAGENES._guardado.size, 0);
});

test('un formato que no es imagen se rechaza', async () => {
  const env = envConAccess({ IMAGENES: r2Falso() });
  const { status } = await subir(env, { bytes: 10, tipo: 'application/pdf', nombre: 'a.pdf' });
  assert.equal(status, 400);
  assert.equal(env.IMAGENES._guardado.size, 0);
});

test('un archivo vacío se rechaza', async () => {
  const env = envConAccess({ IMAGENES: r2Falso() });
  const { status } = await subir(env, { bytes: 0, tipo: 'image/jpeg' });
  assert.equal(status, 400);
});
