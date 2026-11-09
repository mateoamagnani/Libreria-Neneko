// Tests del catálogo del mercadito.
//
// Corren sin dependencias: extraen el <script> de src/index.html y lo evalúan
// con un DOM mínimo simulado. Cubren cómo se dibujan los productos que vienen
// de la base y el escapado del contenido, que es lo que puede romper la página
// en producción si alguien carga un producto con un carácter raro.
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
    // Sirve como navbar y como <meta>: el script les toca style y atributos.
    querySelector: () => ({ style: {}, getAttribute: () => null, setAttribute() {} }),
    querySelectorAll: () => [],
    elementFromPoint: () => null,
    addEventListener() {},
    // El script lee data-theme de acá para saber qué tema está activo.
    documentElement: { getAttribute: () => null, setAttribute() {} },
    hidden: false,
  },
  window: { matchMedia: () => ({ matches: false, addEventListener() {} }), addEventListener() {} },
  requestAnimationFrame: (f) => f(),
  IntersectionObserver: class { observe() {} unobserve() {} },
  setTimeout, clearTimeout, AbortController,
  // No-op a propósito: la página refresca el cartel de "abierto ahora" cada
  // minuto. Con el setInterval real el proceso de tests quedaría con un timer
  // vivo y no terminaría nunca.
  setInterval: () => 0, clearInterval: () => {},
  Intl,
  fetch: async () => { throw new Error('sin red en los tests'); },
};
vm.createContext(ctx);
vm.runInContext(js, ctx);

const { buildMercaditoHTML } = ctx;

// Corre el script otra vez con un DOM propio, para poder mirar qué termina
// dentro del mercadito cuando la respuesta de la API es la que le damos.
//
// `respuesta` puede ser un array de productos (el caso normal) o una función
// que recibe la URL y devuelve la respuesta cruda, para simular fallas.
function correrConApi(respuesta) {
  const pedidos = [];
  const wrap = { innerHTML: '', querySelectorAll: () => [] };
  const c = {
    ...ctx,
    document: { ...ctx.document, getElementById: (id) => (id === 'mercaditoDynamic' ? wrap : null) },
    fetch: async (url) => {
      pedidos.push(url);
      if (typeof respuesta === 'function') return respuesta(url);
      // Solo la sección pedida, como hace el Worker.
      const seccion = (String(url).match(/seccion=(\w+)/) || [])[1];
      return {
        ok: true,
        json: async () => ({
          productos: respuesta.filter((p) => (p.seccion || 'novedades') === seccion),
        }),
      };
    },
  };
  vm.createContext(c);
  vm.runInContext(js, c);
  // loadProductsFromAPI() se llama al final del script y es async
  return new Promise((r) => setImmediate(() => r({ pedidos, html: wrap.innerHTML })));
}

/** Atajo: un producto del mercadito con lo mínimo. */
const prod = (categoria, nombre, precio = '', extra = {}) =>
  ({ categoria, nombre, precio, subcategoria: '', detalle: '', imagen: '', keywords: '', ...extra });


test('buildMercaditoHTML: escapa el contenido que viene de la base', () => {
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

// ---------------------------------------------------------------------------
// Conexion con la base
// ---------------------------------------------------------------------------

test('el catalogo pide los productos a la API del sitio', () => {
  // Antes esto afirmaba que la URL del Sheet no hubiera quedado en el
  // placeholder. La intencion es la misma: que el origen del catalogo este
  // configurado de verdad y no a medio hacer.
  const ruta = js.match(/const API_PRODUCTOS = '([^']*)'/)[1];
  assert.equal(ruta, '/api/productos');
  assert.ok(ruta.startsWith('/'),
    'tiene que ser relativa: el dominio va a cambiar y una absoluta quedaria rota');
  assert.ok(!/docs\.google\.com/.test(js),
    'quedo una referencia al Sheet; los productos ahora salen de la base');
});

test('cada carga pide las dos secciones', async () => {
  // Dos pedidos: el mercadito y, siempre despues (en un finally, no importa
  // si el de arriba salio bien), el menu - asi el hamburguesa no se queda
  // sin categorias cuando el primero falla.
  const { pedidos } = await correrConApi([prod('Utiles', 'Bic', '$ 900')]);
  assert.equal(pedidos.length, 2);
  assert.match(pedidos[0], /seccion=novedades/);
  assert.match(pedidos[1], /seccion=menu/);
});

test('el sitio no le pone cache-buster a la API', async () => {
  // Con el Sheet se agregaba ?_=timestamp para esquivar el cache del
  // navegador. Ahora la frescura la controla el Worker con un max-age corto,
  // asi que un cache-buster solo tiraria abajo el cache del borde y haria
  // que cada visita pegue contra la base.
  const { pedidos } = await correrConApi([prod('Utiles', 'Bic', '$ 900')]);
  for (const url of pedidos) {
    assert.ok(!/[?&]_=\d+/.test(url), `quedo un cache-buster en ${url}`);
  }
});

test('los precios de la base reemplazan a los de ejemplo', async () => {
  const { html } = await correrConApi([
    prod('Impresiones', 'Fotocopia B/N', '$ 90 c/u'),
    prod('Utiles', 'Cuaderno', '$ 4.100'),
  ]);
  assert.match(html, /\$ 90 c\/u/);
  assert.match(html, /\$ 4\.100/);
  assert.ok(!html.includes('$ 150 c/u'), 'quedo un precio de ejemplo');
});

test('si la API no responde, no se toca el mercadito', async () => {
  const { html } = await correrConApi(() => ({ ok: false, status: 404 }));
  assert.equal(html, '', 'no debe vaciar ni pisar los productos de ejemplo');
});

test('si el pedido de productos falla, el del menu se hace igual', async () => {
  // Antes el menu se cargaba adentro del try, despues del de arriba: si ese
  // fetch fallaba, el catch cortaba la cadena y el hamburguesa se quedaba
  // sin categorias. Tiene que pedirse pase lo que pase.
  const { pedidos } = await correrConApi(() => ({ ok: false, status: 404 }));
  assert.ok(pedidos.some((url) => /seccion=menu/.test(url)),
    'no se pidio la seccion menu cuando la de productos fallo');
});

test('si la base viene vacia, tampoco se toca', async () => {
  const { html } = await correrConApi([]);
  assert.equal(html, '');
});

test('un producto sin nombre o sin categoria no entra a la grilla', async () => {
  // La base lo impide con sus CHECK, pero si alguna vez llegara igual no
  // tiene que dejar una tarjeta fantasma.
  const { html } = await correrConApi([
    prod('Utiles', 'Bic', '$ 900'),
    prod('', 'Sin categoria', '$ 1'),
    prod('Utiles', '', '$ 2'),
  ]);
  assert.ok(html.includes('Bic'));
  assert.ok(!html.includes('Sin categoria'));
});

// ---------------------------------------------------------------------------
// Iconos y detalle
// ---------------------------------------------------------------------------

const familiaIcono = (nombre) =>
  (buildMercaditoHTML([['X', nombre, '']]).match(/data-icono="(\w+)"/) || [])[1];

test('el icono sale del nombre del producto, no de la posición', () => {
  const casos = {
    'Fotocopiado B/N': 'impresion',
    'Impresión color A4': 'impresion',
    'Plastificado A4': 'impresion',
    'Anillado hasta 100 hj.': 'anillado',
    'Cuaderno A4 rayado': 'cuaderno',
    'Repuesto x100 hojas': 'hojas',
    'Cartulina color': 'hojas',
    'Lapicera Bic azul': 'escritura',
    'Carpeta N°3': 'carpeta',
    'Témperas Alba x12': 'pintura',
    'Set de pinceles x6': 'pincel',
    'Block de dibujo El Nene': 'dibujo',
  };
  for (const [producto, esperado] of Object.entries(casos)) {
    assert.equal(familiaIcono(producto), esperado, `${producto} debería usar "${esperado}"`);
  }
});

test('el icono matchea sin importar acentos ni mayúsculas', () => {
  assert.equal(familiaIcono('TEMPERAS ALBA'), 'pintura');
  assert.equal(familiaIcono('impresion color'), 'impresion');
});

test('un producto desconocido cae en el icono genérico', () => {
  assert.equal(familiaIcono('Mochila escolar'), 'generico');
});

test('una fila de 4 productos no repite tono de fondo', () => {
  const out = buildMercaditoHTML([
    ['X', 'Uno', ''], ['X', 'Dos', ''], ['X', 'Tres', ''], ['X', 'Cuatro', ''],
  ]);
  const tonos = [...out.matchAll(/product-thumb tone-(\w+)/g)].map((m) => m[1]);
  assert.equal(tonos.length, 4);
  assert.equal(new Set(tonos).size, 4, 'los 4 tonos deben ser distintos');
});

test('la columna Detalle es opcional y se muestra cuando está', () => {
  const con = buildMercaditoHTML([['X', 'Cuaderno', '$ 100', 'Tapa dura']]);
  assert.match(con, /<p class="product-detalle">Tapa dura<\/p>/);

  const sin = buildMercaditoHTML([['X', 'Cuaderno', '$ 100']]);
  assert.ok(!sin.includes('product-detalle'), 'sin detalle no debe quedar el <p> vacío');
});

test('el detalle también se escapa', () => {
  const out = buildMercaditoHTML([['X', 'Cuaderno', '$ 100', '<b>oferta</b>']]);
  assert.ok(out.includes('&lt;b&gt;oferta&lt;/b&gt;'));
  assert.ok(!/<b>/.test(out));
});

test('el HTML de respaldo no trae precios inventados', () => {
  // Si la API falla se ven estas tarjetas: mejor "Consultar" que un número
  // que nadie va a respetar en el mostrador.
  const cuerpo = html.slice(html.indexOf('id="productos"'), html.indexOf('</section>', html.indexOf('id="productos"')));
  const precios = [...cuerpo.matchAll(/<div class="price">([^<]*)<\/div>/g)].map((m) => m[1]);
  assert.ok(precios.length > 0, 'debería haber tarjetas de respaldo');
  precios.forEach((p) => assert.equal(p, 'Consultar', `precio inventado en el respaldo: ${p}`));
});

// ---------------------------------------------------------------------------
// Color de las barras del navegador en el teléfono
// ---------------------------------------------------------------------------

// Corre el script con un theme-color falso y control sobre el tema activo,
// para poder afirmar de qué color queda la barra del navegador.
//   elegido: 'light' | 'dark' | null (sin elección: manda el sistema)
function correrConTema(elegido, sistemaOscuro = false) {
  const meta = {
    valor: '',
    getAttribute: () => meta.valor,
    setAttribute: (_, v) => { meta.valor = v; },
  };
  const c = {
    ...ctx,
    document: {
      ...ctx.document,
      documentElement: { getAttribute: () => elegido, setAttribute() {} },
      querySelector: (sel) => (sel.includes('theme-color') ? meta : { style: {} }),
    },
    window: {
      matchMedia: () => ({ matches: sistemaOscuro, addEventListener() {} }),
      addEventListener() {},
    },
  };
  vm.createContext(c);
  vm.runInContext(js, c);
  return meta;
}

test('en modo claro la barra del navegador toma el navy del navbar', () => {
  assert.equal(correrConTema('light').valor, '#243C54');
});

test('en modo oscuro toma el navy oscuro', () => {
  assert.equal(correrConTema('dark').valor, '#16283A');
});

test('sin elección explícita, sigue al sistema', () => {
  assert.equal(correrConTema(null, true).valor, '#16283A');
  assert.equal(correrConTema(null, false).valor, '#243C54');
});

test('el theme-color del HTML arranca navy, como el navbar', () => {
  const inicial = html.match(/<meta name="theme-color" content="([^"]+)"/)[1];
  assert.equal(inicial, '#243C54');
});
