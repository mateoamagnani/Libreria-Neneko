// ============================================================
// Tests del núcleo del catálogo
//
// Corren las consultas de functions/_lib/productos.js contra una base
// SQLite de verdad, creada con el mismo db/schema.sql que se aplica en
// D1. No hay mocks de la base: si una consulta no compila contra el
// esquema real, acá se cae.
//
// D1 es SQLite, así que node:sqlite es un sustituto fiel para la capa
// de datos. Lo que no cubre es el binding de Cloudflare (env.DB), que
// vive en las rutas y se prueba aparte.
// ============================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  validarProducto, consultaListado, consultaListadoAdmin,
  consultaAlta, consultaEdicion, consultaBaja,
  agruparPorCategoria, SECCIONES,
} from '../functions/_lib/productos.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const esquema = readFileSync(join(raiz, 'db/schema.sql'), 'utf8');

function baseNueva() {
  const db = new DatabaseSync(':memory:');
  db.exec(esquema);
  return db;
}

const correr = (db, { sql, binds }) => db.prepare(sql).run(...binds);
const traer  = (db, { sql, binds }) => db.prepare(sql).all(...binds);

// Alta válida mínima, para no repetirla en cada test.
const alta = (db, id, extra = {}) => {
  const v = validarProducto({ categoria: 'Impresiones', nombre: 'Fotocopia', ...extra });
  assert.ok(v.ok, `esperaba un alta válida: ${v.errores?.join(' / ')}`);
  correr(db, consultaAlta(id, v.producto));
  return v.producto;
};


// ------------------------------------------------------------
// Validación
// ------------------------------------------------------------

test('un producto mínimo válido pasa y se normaliza', () => {
  const r = validarProducto({ categoria: '  Impresiones  ', nombre: '  Fotocopia B/N  ' });
  assert.ok(r.ok);
  // Los espacios de los bordes se comen: si no, "Impresiones" y
  // "Impresiones " serían dos categorías distintas en la grilla.
  assert.equal(r.producto.categoria, 'Impresiones');
  assert.equal(r.producto.nombre, 'Fotocopia B/N');
  assert.equal(r.producto.seccion, 'novedades');
  assert.equal(r.producto.activo, 1);
  assert.equal(r.producto.orden, 0);
});

test('sin nombre o sin categoría no pasa, y lo dice en castellano', () => {
  const sinNombre = validarProducto({ categoria: 'C', nombre: '   ' });
  assert.equal(sinNombre.ok, false);
  assert.match(sinNombre.errores.join(' '), /nombre/i);

  const sinCat = validarProducto({ categoria: '', nombre: 'N' });
  assert.equal(sinCat.ok, false);
  assert.match(sinCat.errores.join(' '), /categor/i);
});

test('la sección tiene que ser una de las conocidas', () => {
  for (const s of SECCIONES) {
    assert.ok(validarProducto({ categoria: 'C', nombre: 'N', seccion: s }).ok, s);
  }
  const r = validarProducto({ categoria: 'C', nombre: 'N', seccion: 'blog' });
  assert.equal(r.ok, false);
  assert.match(r.errores.join(' '), /blog/);
});

test('la imagen tiene que ser una foto del panel o una URL http', () => {
  // Este es el bug que el validador existe para frenar: el sitio solo
  // dibuja la imagen si reconoce la forma y si no cae al ícono SVG sin
  // avisar. Sin esto, la dueña pega la ruta de un archivo de su compu,
  // ve el ícono genérico y no entiende por qué.
  const malo = validarProducto({ categoria: 'C', nombre: 'N', imagen: 'C:\\fotos\\lapiz.jpg' });
  assert.equal(malo.ok, false);
  assert.match(malo.errores.join(' '), /panel|http/i);

  // URL absoluta: las que quedan de la época del Sheet (Drive).
  const drive = validarProducto({ categoria: 'C', nombre: 'N', imagen: 'https://x.dev/a.jpg' });
  assert.ok(drive.ok);

  // Ruta relativa: las que sube el panel a R2. Van relativas porque el
  // dominio va a cambiar y una absoluta quedaría rota.
  const subida = validarProducto({ categoria: 'C', nombre: 'N', imagen: '/img/abc.jpg' });
  assert.ok(subida.ok);
  assert.equal(subida.producto.imagen, '/img/abc.jpg');

  // Vacía es válida: significa "sin foto", y el sitio usa el ícono.
  assert.equal(validarProducto({ categoria: 'C', nombre: 'N', imagen: '' }).producto.imagen, null);
});

test('una URL sin protocolo disfrazada de ruta local se rechaza', () => {
  // "//evil.com/x.jpg" parece una ruta del sitio pero el navegador la
  // va a buscar a otro dominio. Si pasara, el panel serviría para
  // meter una imagen ajena en la página.
  for (const trampa of ['//evil.com/x.jpg', '///evil.com/x.jpg']) {
    const r = validarProducto({ categoria: 'C', nombre: 'N', imagen: trampa });
    assert.equal(r.ok, false, `dejó pasar: ${trampa}`);
  }
});

test('activo acepta las formas en que puede llegar desde el panel', () => {
  const v = (a) => validarProducto({ categoria: 'C', nombre: 'N', activo: a }).producto.activo;
  assert.equal(v(true), 1);
  assert.equal(v(false), 0);
  assert.equal(v(0), 0);
  assert.equal(v('false'), 0);
  assert.equal(v(undefined), 1, 'por defecto se publica');
});

test('el orden tiene que ser entero', () => {
  assert.equal(validarProducto({ categoria: 'C', nombre: 'N', orden: 1.5 }).ok, false);
  assert.ok(validarProducto({ categoria: 'C', nombre: 'N', orden: 3 }).ok);
});

test('un campo demasiado largo se rechaza en vez de romper la grilla', () => {
  const r = validarProducto({ categoria: 'C', nombre: 'x'.repeat(500) });
  assert.equal(r.ok, false);
});

test('en modo parcial solo se valida lo que vino', () => {
  // El panel manda {activo:false} para despublicar. Sin modo parcial
  // eso fallaría por "falta el nombre" y pisaría el resto con nulls.
  const r = validarProducto({ activo: false }, { parcial: true });
  assert.ok(r.ok);
  assert.deepEqual(Object.keys(r.producto), ['activo']);
  assert.equal(r.producto.activo, 0);
});


// ------------------------------------------------------------
// Consultas contra SQLite real
// ------------------------------------------------------------

test('el alta escribe y el listado público la devuelve', () => {
  const db = baseNueva();
  alta(db, 'p1', { precio: '$ 100 c/u' });

  const filas = traer(db, consultaListado('novedades'));
  assert.equal(filas.length, 1);
  assert.equal(filas[0].nombre, 'Fotocopia');
  assert.equal(filas[0].precio, '$ 100 c/u');
});

test('el listado público NO muestra lo despublicado', () => {
  const db = baseNueva();
  alta(db, 'p1');
  alta(db, 'p2', { nombre: 'Oculto', activo: false });

  const publico = traer(db, consultaListado('novedades'));
  assert.deepEqual(publico.map((f) => f.nombre), ['Fotocopia']);

  // Pero el panel sí lo ve: si no, no habría forma de reactivarlo.
  const admin = traer(db, consultaListadoAdmin());
  assert.equal(admin.length, 2);
});

test('el listado público no cruza secciones', () => {
  const db = baseNueva();
  alta(db, 'p1', { seccion: 'novedades', nombre: 'Del mercadito' });
  alta(db, 'p2', { seccion: 'menu', nombre: 'Del menú' });

  assert.deepEqual(traer(db, consultaListado('novedades')).map((f) => f.nombre), ['Del mercadito']);
  assert.deepEqual(traer(db, consultaListado('menu')).map((f) => f.nombre), ['Del menú']);
});

test('el listado ordena por categoría y después por orden', () => {
  const db = baseNueva();
  alta(db, 'p1', { categoria: 'Zapatería', nombre: 'Z', orden: 0 });
  alta(db, 'p2', { categoria: 'Arte', nombre: 'Segundo', orden: 5 });
  alta(db, 'p3', { categoria: 'Arte', nombre: 'Primero', orden: 1 });

  const filas = traer(db, consultaListado('novedades'));
  assert.deepEqual(filas.map((f) => f.nombre), ['Primero', 'Segundo', 'Z']);
});

test('la edición parcial no pisa los campos que no vinieron', () => {
  const db = baseNueva();
  alta(db, 'p1', { precio: '$ 100', detalle: 'Desde una copia' });

  const cambio = validarProducto({ activo: false }, { parcial: true });
  correr(db, consultaEdicion('p1', cambio.producto));

  const fila = db.prepare('select * from productos where id=?').get('p1');
  assert.equal(fila.activo, 0, 'se despublicó');
  assert.equal(fila.precio, '$ 100', 'el precio sobrevivió');
  assert.equal(fila.detalle, 'Desde una copia', 'el detalle sobrevivió');
});

test('una edición sin campos no arma consulta', () => {
  assert.equal(consultaEdicion('p1', {}), null);
});

test('la baja borra', () => {
  const db = baseNueva();
  alta(db, 'p1');
  correr(db, consultaBaja('p1'));
  assert.equal(traer(db, consultaListado('novedades')).length, 0);
});

test('la base rechaza lo que el validador dejaría pasar por un bug', () => {
  // Cinturón y tiradores: el validador es la primera defensa, pero si
  // alguna vez se lo saltea (una migración, un script), los CHECK del
  // esquema tienen que seguir parando la basura.
  const db = baseNueva();
  assert.throws(() => correr(db, consultaAlta('x', {
    seccion: 'blog', categoria: 'C', nombre: 'N',
  })), /constraint/i);
});

test('el agrupado por categoría respeta el orden de la consulta', () => {
  const db = baseNueva();
  alta(db, 'p1', { categoria: 'Arte', nombre: 'A1', orden: 1 });
  alta(db, 'p2', { categoria: 'Arte', nombre: 'A2', orden: 2 });
  alta(db, 'p3', { categoria: 'Impresiones', nombre: 'I1' });

  const grupos = agruparPorCategoria(traer(db, consultaListado('novedades')));
  assert.deepEqual([...grupos.keys()], ['Arte', 'Impresiones']);
  assert.deepEqual(grupos.get('Arte').map((p) => p.nombre), ['A1', 'A2']);
});

test('las comillas y los acentos sobreviven el viaje', () => {
  // El catálogo real tiene cosas como: Témperas Alba x12, Anillado 100 hj.,
  // y detalles con comas. Si algo se escapa mal, se ve en la tarjeta.
  const db = baseNueva();
  alta(db, 'p1', {
    nombre: 'Témperas Alba x12 "pack"',
    detalle: 'Apuntes, láminas y fotos',
    categoria: 'Arte y manualidades',
  });

  const f = traer(db, consultaListado('novedades'))[0];
  assert.equal(f.nombre, 'Témperas Alba x12 "pack"');
  assert.equal(f.detalle, 'Apuntes, láminas y fotos');
  assert.equal(f.categoria, 'Arte y manualidades');
});
