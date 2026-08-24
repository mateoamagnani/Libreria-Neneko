// Tests del catálogo del mercadito.
//
// Corren sin dependencias: extraen el <script> de src/index.html y lo evalúan
// con un DOM mínimo simulado. Cubren el parseo del CSV que baja de Google
// Sheets y el escapado del contenido, que es lo que puede romper la página en
// producción si alguien carga un producto con un carácter raro.
//
//   node --test test/
//
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(raiz, '..', 'src', 'index.html'), 'utf8');
const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];

// DOM mínimo: alcanza para que el script cargue sin tocar nada real.
const ctx = {
  console,
  document: {
    getElementById: () => null,
    querySelector: () => ({ style: {} }),
    querySelectorAll: () => [],
    addEventListener() {},
    hidden: false,
  },
  window: { matchMedia: () => ({ matches: false }), addEventListener() {} },
  requestAnimationFrame: (f) => f(),
  IntersectionObserver: class { observe() {} unobserve() {} },
  setTimeout, clearTimeout, AbortController,
  fetch: async () => { throw new Error('sin red en los tests'); },
};
vm.createContext(ctx);
vm.runInContext(js, ctx);

const { parseCsv, normalizarFilas, buildMercaditoHTML } = ctx;

// Los arrays vienen de otro realm (el vm), así que no comparten prototipo con
// los de acá: deepStrictEqual los rechazaría por eso aunque el contenido sea
// idéntico. Comparamos la forma serializada.
const igual = (a, b) => assert.equal(JSON.stringify(a), JSON.stringify(b));

test('parseCsv: respeta comas dentro de comillas', () => {
  igual(parseCsv('Utiles,"Lapicera azul, x3",900'),
    [['Utiles', 'Lapicera azul, x3', '900']]);
});

test('parseCsv: entiende comillas escapadas', () => {
  assert.equal(parseCsv('A,"Cuaderno ""Rivadavia"" A4",100')[0][1],
    'Cuaderno "Rivadavia" A4');
});

test('parseCsv: soporta saltos de línea de Windows', () => {
  assert.equal(parseCsv('A,B,1\r\nC,D,2').length, 2);
});

test('parseCsv: soporta un salto de línea dentro de una celda', () => {
  assert.equal(parseCsv('A,"linea1\nlinea2",5')[0][1], 'linea1\nlinea2');
});

test('parseCsv: ignora la fila vacía del final', () => {
  assert.equal(parseCsv('A,B,1\n').length, 1);
});

test('normalizarFilas: descarta el encabezado si la hoja lo tiene', () => {
  assert.equal(normalizarFilas(parseCsv('Categoria,Producto,Precio\nUtiles,Bic,900')).length, 1);
});

test('normalizarFilas: no descarta nada si no hay encabezado', () => {
  assert.equal(normalizarFilas(parseCsv('Utiles,Bic,900\nUtiles,Goma,300')).length, 2);
});

test('normalizarFilas: descarta filas sin categoría o sin producto', () => {
  assert.equal(normalizarFilas(parseCsv('Utiles,Bic,900\n,,\nUtiles,,')).length, 1);
});

test('buildMercaditoHTML: escapa el contenido que viene del Sheet', () => {
  const out = buildMercaditoHTML([['Utiles', '<img src=x onerror=alert(1)>', '$100']]);
  // El nombre tiene que terminar como texto visible, nunca como markup.
  assert.ok(out.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!/<img[\s>]/.test(out), 'no debe generar un elemento <img>');
});

test('buildMercaditoHTML: arma el link de WhatsApp con el texto pre-escrito', () => {
  const out = buildMercaditoHTML([['Utiles', 'Anillado 100 hj.', '$1.800']]);
  const href = out.match(/href="([^"]*wa\.me[^"]*)"/)[1];
  assert.ok(href.startsWith('https://wa.me/5491161691209?text='));
  assert.ok(!href.includes('%24%7B'), 'no debe filtrarse un ${} sin interpolar');
  assert.ok(decodeURIComponent(href.split('?text=')[1]).includes('Anillado 100 hj.'));
});

test('buildMercaditoHTML: agrupa por categoría y cuenta bien', () => {
  const out = buildMercaditoHTML([
    ['Impresiones', 'Copia', '$150'],
    ['Impresiones', 'Color', '$400'],
    ['Utiles', 'Bic', '$900'],
  ]);
  assert.equal((out.match(/shop-group"/g) || []).length, 2);
  assert.ok(out.includes('2 productos'));
  assert.ok(out.includes('1 producto<'));
});

test('buildMercaditoHTML: si no hay precio muestra "Consultar"', () => {
  const out = buildMercaditoHTML([['Utiles', 'Bic', '']]);
  assert.ok(out.includes('<div class="price">Consultar</div>'));
});
