// ============================================================
// Tests del panel de carga (src/admin.html)
//
// Mismo criterio que horarios.test.mjs: se lee el archivo de
// producción, no una copia. Si alguien cambia el CSS del panel, estos
// tests se rompen, que es lo que tienen que hacer.
//
// Dos de los invariantes de acá salieron de bugs reales encontrados
// abriendo la página, no leyendo el código. Están anotados.
// ============================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(raiz, 'src/admin.html'), 'utf8');

// Sin comentarios: la primera versión de estos tests leía adentro de
// uno y daba por declarada una regla que en realidad solo estaba
// explicada en prosa. Un test que se cree un comentario es peor que no
// tener test, porque además da confianza.
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1].replace(/\/\*[\s\S]*?\*\//g, '');

const bloque = (re) => (css.match(re) || [])[0] || '';
const tokensDe = (texto) => {
  const t = {};
  for (const [, k, v] of texto.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) t[k] = v.trim();
  return t;
};

const rootClaro = tokensDe(bloque(/^:root\{[\s\S]*?\n\}/m));
const rootOscuro = tokensDe(bloque(/:root:not\(\[data-theme="light"\]\)\{[\s\S]*?\n  \}/));

const luminancia = (hex) => {
  const c = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(c.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a, b) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};


test('el panel no escribe ningún color literal fuera de :root', () => {
  // La regla que CLAUDE.md marca como innegociable. El modo oscuro del
  // sitio se rompió tres veces por parchear componente por componente.
  const sinRoot = css.replace(/:root[^{]*\{[^}]*\}/g, '');
  const literales = [...sinRoot.matchAll(/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/g)]
    .map((m) => m[0]);
  assert.deepEqual(literales, [],
    `colores literales fuera de :root: ${literales.join(', ')}`);
});

test('todo token del modo claro tiene su par en el oscuro', () => {
  const colores = Object.keys(rootClaro).filter((t) => /^#|rgb/.test(rootClaro[t]));
  assert.ok(colores.length > 10, 'esperaba encontrar la paleta en :root');
  const faltantes = colores.filter((t) => !(t in rootOscuro));
  assert.deepEqual(faltantes, [],
    `estos colores no están redefinidos para modo oscuro: ${faltantes.join(', ')}`);
});

test('los textos llegan a AA sobre las superficies del panel', () => {
  for (const [modo, t] of [['claro', rootClaro], ['oscuro', rootOscuro]]) {
    for (const token of ['--text', '--text-2', '--text-3']) {
      for (const sup of ['--bg', '--surface']) {
        const r = contraste(t[token], t[sup]);
        assert.ok(r >= 4.5,
          `${token} sobre ${sup} en modo ${modo}: ${r.toFixed(2)}:1, hace falta 4.5:1`);
      }
    }
  }
});

test('los colores de estado se leen sobre la superficie de las tarjetas', () => {
  // --closed marca lo despublicado y el botón de borrar; --ok, el
  // aviso de guardado. Si no contrastan, la dueña no distingue el
  // estado de un producto.
  for (const [modo, t] of [['claro', rootClaro], ['oscuro', rootOscuro]]) {
    for (const token of ['--ok', '--closed', '--brand']) {
      const r = contraste(t[token], t['--surface']);
      assert.ok(r >= 4.5,
        `${token} sobre --surface en modo ${modo}: ${r.toFixed(2)}:1`);
    }
  }
});

test('el texto de la barra superior se lee sobre el navy', () => {
  for (const [modo, t] of [['claro', rootClaro], ['oscuro', rootOscuro]]) {
    for (const token of ['--text-inv', '--text-inv-2']) {
      const r = contraste(t[token], t['--surface-inv']);
      assert.ok(r >= 4.5, `${token} sobre --surface-inv en modo ${modo}: ${r.toFixed(2)}:1`);
    }
  }
});

test('el botón primario mantiene el contraste del sitio', () => {
  for (const [modo, t] of [['claro', rootClaro], ['oscuro', rootOscuro]]) {
    const r = contraste(t['--btn-text'], t['--btn-bg']);
    assert.ok(r >= 4.5, `--btn-text sobre --btn-bg en modo ${modo}: ${r.toFixed(2)}:1`);
  }
});

test('[hidden] le gana a los display de los componentes', () => {
  // Bug real, encontrado abriendo la página y no leyendo el código:
  // .btn declara display:inline-flex y .foto-previa display:block, y
  // los dos le ganaban por especificidad al atributo hidden. Resultado:
  // "Quitar la foto" se veía sin haber foto, y la vista previa se
  // dibujaba rota. Sin esta regla vuelve a pasar.
  assert.match(css, /\[hidden\]\s*\{\s*display:\s*none\s*!important/,
    'falta la regla [hidden]{display:none !important}');
});

test('las áreas de tap llegan a 44px', () => {
  // CLAUDE.md: "Área de tap mínima 44×44 px." La dueña va a usar esto
  // desde el teléfono, y es la que menos margen tiene para errarle.
  const controles = ['.accion-principal', '.segmento', '.fila', '.volver',
                     '.texto-btn', '.btn-chico', '.interruptor', '.buscador input',
                     '.mas > summary'];
  for (const sel of controles) {
    const escapado = sel.replace(/[.>]/g, (c) => `\\${c}`).replace(/\s+/g, '\\s*');
    const regla = (css.match(new RegExp(`${escapado}\\{[^}]*\\}`)) || [''])[0];
    assert.ok(regla, `no encontré la regla de ${sel}`);
    assert.match(regla, /(min-height|height):\s*(4[4-9]|[5-9]\d|\d{3})px/,
      `${sel} no llega a 44px de alto`);
  }
});

test('el panel no se indexa', () => {
  // No tiene que aparecer en Google.
  assert.match(html, /<meta\s+name="robots"\s+content="noindex/);
});

test('el límite de peso de las fotos coincide con el del servidor', () => {
  // Si el panel dejara pasar más de lo que el Worker acepta, la dueña
  // subiría medio megabyte por red de celular para que recién el
  // servidor le diga que no.
  const servidor = readFileSync(join(raiz, 'functions/api/imagenes.js'), 'utf8');
  const delServidor = servidor.match(/MAX_BYTES\s*=\s*(\d+)\s*\*\s*1024/)[1];
  const delPanel = html.match(/MAX_BYTES\s*=\s*(\d+)\s*\*\s*1024/)[1];
  assert.equal(delPanel, delServidor,
    `el panel permite ${delPanel} KB y el servidor ${delServidor} KB`);
});

test('ningún botón queda sin nombre que pueda leer un lector de pantalla', () => {
  // Antes esto afirmaba que los tres botones de icono de cada fila
  // tuvieran aria-label. Ya no existen: las filas son botones con el
  // nombre del producto adentro, y las acciones peligrosas se mudaron
  // a la ficha. El invariante que queda es el de fondo, y es más
  // fuerte: ningún botón del HTML puede quedar sin nombre accesible,
  // sea por su texto o por un aria-label. Un botón que solo tiene un
  // SVG adentro se anuncia como "botón" y no se sabe cuál es.
  const sinNombre = [];
  for (const m of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
    const [, attrs, contenido] = m;
    const tieneAria = /aria-label\s*=\s*"[^"]+"/.test(attrs);
    const texto = contenido.replace(/<svg[\s\S]*?<\/svg>/g, '')
                           .replace(/<[^>]+>/g, '').trim();
    if (!tieneAria && !texto) {
      sinNombre.push(attrs.trim().slice(0, 70));
    }
  }
  assert.deepEqual(sinNombre, [],
    `botones sin nombre accesible:\n  ${sinNombre.join('\n  ')}`);
});

test('el buscador tiene nombre accesible', () => {
  const campo = html.match(/<input[^>]*id="buscar"[^>]*>/)[0];
  assert.match(campo, /aria-label\s*=\s*"[^"]+"/,
    'el buscador no tiene label visible, así que necesita aria-label');
});

test('borrar pide confirmación, nombra el producto y ofrece la alternativa', () => {
  // Borrar no se deshace. El confirm tiene que nombrar el producto para
  // que no se borre el de al lado por tocar mal, y tiene que recordar
  // que existe la salida no destructiva: ocultarlo.
  const fn = html.match(/async function borrar\(\)[\s\S]*?\n  \}/)[0];
  assert.match(fn, /confirm\(/, 'borra sin confirmar');
  assert.match(fn, /p\.nombre/, 'el confirm no nombra el producto');
  assert.match(fn, /Mostrar en la página|ocultar/i,
    'no ofrece la alternativa de ocultarlo en vez de borrarlo');
});

test('la ficha no ofrece borrar cuando el producto todavía no existe', () => {
  // Un botón de borrar en un producto nuevo no tiene sentido y asusta.
  assert.match(html, /id="zona-peligro"[^>]*\bhidden\b/,
    'la zona de borrado tiene que arrancar oculta');
  assert.match(html, /\$\('#zona-peligro'\)\.hidden\s*=\s*esNuevo/,
    'la zona de borrado no se muestra según si el producto ya existe');
});
