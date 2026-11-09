// ============================================================
// Tests de la migración de la planilla a la base
//
// Corre una sola vez en la vida del proyecto, y si sale mal el daño es
// silencioso: productos que no entraron, precios cambiados, el orden
// barajado. Nadie lo va a notar hasta que la dueña abra el panel y no
// encuentre algo.
//
// Por eso el SQL que genera se aplica acá contra una base de verdad,
// creada con el mismo db/schema.sql, y se comprueba qué quedó adentro.
// ============================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parsearCsv, migrar } from '../tools/migrar-csv.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const esquema = readFileSync(join(raiz, 'db/schema.sql'), 'utf8');

/** Aplica el SQL generado y devuelve lo que quedó en la base. */
function aplicar(csv, seccion = 'novedades') {
  const r = migrar(csv, seccion);
  const db = new DatabaseSync(':memory:');
  db.exec(esquema);
  for (const i of r.inserts) db.exec(i);
  return {
    ...r,
    filas: db.prepare('select * from productos order by categoria, orden').all(),
  };
}


// ------------------------------------------------------------
// Parseo
// ------------------------------------------------------------

test('respeta las comas dentro de comillas', () => {
  // El catálogo real tiene detalles como "Apuntes, láminas y fotos".
  // Partir por comas los rompería en dos columnas.
  const filas = parsearCsv('Utiles,"Lapicera azul, x3",900');
  assert.deepEqual([...filas[0]], ['Utiles', 'Lapicera azul, x3', '900']);
});

test('entiende las comillas escapadas', () => {
  assert.equal(parsearCsv('A,"Cuaderno ""Rivadavia"" A4",100')[0][1],
    'Cuaderno "Rivadavia" A4');
});

test('soporta saltos de línea de Windows y dentro de una celda', () => {
  assert.equal(parsearCsv('A,B,1\r\nC,D,2').length, 2);
  assert.equal(parsearCsv('A,"linea1\nlinea2",5')[0][1], 'linea1\nlinea2');
});

test('se come el BOM que mete Google al exportar', () => {
  // Sin esto la primera categoría queda con un carácter invisible
  // adelante y se convierte en un grupo aparte en la grilla.
  const filas = parsearCsv('\uFEFFCategoria,Producto,Precio\nUtiles,Bic,900');
  assert.equal(filas[0][0], 'Categoria');
});


// ------------------------------------------------------------
// Migración
// ------------------------------------------------------------

test('migra un catálogo de 4 columnas y lo deja en la base', () => {
  const { ok, filas } = aplicar(
    'Categoria,Producto,Precio,Detalle\n' +
    'Impresiones,Fotocopiado B/N,$ 100 c/u,Desde una copia\n' +
    'Impresiones,Anillado hasta 100 hj.,$ 1.000,Lo anillamos en el momento');

  assert.equal(ok, 2);
  assert.equal(filas.length, 2);
  assert.equal(filas[0].nombre, 'Fotocopiado B/N');
  assert.equal(filas[0].precio, '$ 100 c/u');
  assert.equal(filas[0].detalle, 'Desde una copia');
  assert.equal(filas[0].activo, 1);
});

test('migra el formato de 7 columnas con subcategoría e imagen', () => {
  const { filas } = aplicar(
    'Categoria,Subcategoria,Producto,Precio,Detalle,Imagen,Keywords\n' +
    'Arte,Pinturas,Témperas Alba x12,,Los colores de siempre,https://x.dev/a.jpg,tempera arte');

  assert.equal(filas[0].subcategoria, 'Pinturas');
  assert.equal(filas[0].imagen, 'https://x.dev/a.jpg');
  assert.equal(filas[0].keywords, 'tempera arte');
  assert.equal(filas[0].precio, null, 'un precio vacío queda null, no cadena vacía');
});

test('descarta el encabezado y no lo importa como producto', () => {
  const { ok, filas } = aplicar('Categoria,Producto,Precio\nUtiles,Bic,900');
  assert.equal(ok, 1);
  assert.notEqual(filas[0].nombre, 'Producto');
});

test('una planilla sin encabezado también se migra entera', () => {
  const { ok } = aplicar('Utiles,Bic,900\nUtiles,Goma,300');
  assert.equal(ok, 2);
});

test('el orden respeta la posición dentro de cada categoría', () => {
  // Si se barajaran, la dueña abriría la página el primer día y se
  // encontraría el catálogo en otro orden sin saber por qué.
  const { filas } = aplicar(
    'Utiles,Primero,1\nArte,Pincel,2\nUtiles,Segundo,3\nUtiles,Tercero,4');

  const utiles = filas.filter((f) => f.categoria === 'Utiles');
  assert.deepEqual(utiles.map((f) => f.nombre), ['Primero', 'Segundo', 'Tercero']);
  assert.deepEqual(utiles.map((f) => f.orden), [0, 1, 2]);
  // Cada categoría arranca su propia numeración.
  assert.equal(filas.find((f) => f.categoria === 'Arte').orden, 0);
});

test('las comillas y los acentos llegan intactos a la base', () => {
  // Es donde falla una migración hecha a mano: el escapado de SQL.
  const { filas } = aplicar(
    'Categoria,Producto,Precio,Detalle\n' +
    'Arte y manualidades,"Témperas ""Alba"" x12",$ 1.500,"Apuntes, láminas y fotos"');

  assert.equal(filas[0].nombre, 'Témperas "Alba" x12');
  assert.equal(filas[0].detalle, 'Apuntes, láminas y fotos');
  assert.equal(filas[0].categoria, 'Arte y manualidades');
});

test("un apóstrofo no rompe el SQL ni se duplica", () => {
  const { filas, ok } = aplicar("Utiles,Block O'Hara,500");
  assert.equal(ok, 1);
  assert.equal(filas[0].nombre, "Block O'Hara");
});

test('las filas vacías se saltean sin contarlas como error', () => {
  // La planilla real tiene renglones en blanco de separación.
  const { ok, saltadas } = aplicar('Utiles,Bic,900\n,,\n\nUtiles,Goma,300');
  assert.equal(ok, 2);
  assert.deepEqual(saltadas, [], 'un renglón en blanco no es un error que reportar');
});

test('una fila sin nombre se saltea y se informa con su línea', () => {
  // No se importa a medias en silencio: se dice cuál faltó y por qué,
  // para poder arreglarla a mano.
  const { ok, saltadas } = aplicar('Categoria,Producto,Precio\nUtiles,,900\nUtiles,Goma,300');
  assert.equal(ok, 1);
  assert.equal(saltadas.length, 1);
  assert.equal(saltadas[0].linea, 2);
  assert.match(saltadas[0].motivos.join(' '), /nombre/i);
});

test('una imagen que no es URL se informa en vez de entrar rota', () => {
  const { ok, saltadas } = aplicar(
    'Categoria,Subcategoria,Producto,Precio,Detalle,Imagen\n' +
    'Utiles,,Cuaderno,900,,C:\\fotos\\cuaderno.jpg');
  assert.equal(ok, 0);
  assert.match(saltadas[0].motivos.join(' '), /http|panel/i);
});

test('la sección queda bien y las dos no se mezclan', () => {
  assert.equal(aplicar('Utiles,Bic,900', 'novedades').filas[0].seccion, 'novedades');
  assert.equal(aplicar('Servicios,Anillado,900', 'menu').filas[0].seccion, 'menu');
});

test('un catálogo vacío no genera nada ni explota', () => {
  const { ok, inserts } = aplicar('');
  assert.equal(ok, 0);
  assert.deepEqual(inserts, []);
});

test('cada producto recibe un id propio', () => {
  const { filas } = aplicar('Utiles,Bic,900\nUtiles,Goma,300\nUtiles,Regla,400');
  const ids = new Set(filas.map((f) => f.id));
  assert.equal(ids.size, 3, 'se repitió algún id');
});
