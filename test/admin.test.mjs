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
  // desde el teléfono.
  for (const sel of ['.btn', '.icono-btn', '.solapa', '.interruptor']) {
    const regla = (css.match(new RegExp(`\\${sel}\\{[^}]*\\}`)) || [''])[0];
    assert.match(regla, /(min-height|height):\s*44px/,
      `${sel} no declara 44px de alto`);
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

test('las acciones de cada producto tienen nombre accesible', () => {
  // Son botones de ícono: sin aria-label, un lector de pantalla dice
  // "botón" tres veces y no se sabe cuál borra.
  for (const accion of ['editar', 'visibilidad', 'borrar']) {
    const re = new RegExp(`data-accion="${accion}"[^>]*aria-label=`, 's');
    assert.match(html, re, `el botón de ${accion} no tiene aria-label`);
  }
});

test('borrar pide confirmación y nombra el producto', () => {
  // Borrar no se deshace. El confirm tiene que nombrar el producto
  // para que no se borre el de al lado por tocar mal.
  const fn = html.match(/async function borrar\([\s\S]*?\n  \}/)[0];
  assert.match(fn, /confirm\(/, 'borra sin confirmar');
  assert.match(fn, /p\.nombre/, 'el confirm no nombra el producto');
  assert.match(fn, /ocultarlo|ojo/i, 'no ofrece la alternativa de ocultar');
});
