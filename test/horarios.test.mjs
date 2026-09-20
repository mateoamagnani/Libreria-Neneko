// Tests de los horarios y del sistema de color.
//
// Existen por una razón concreta: el bloque de horarios y su visibilidad en
// modo oscuro se rompieron varias veces seguidas. Las dos causas eran
// estructurales, así que se pueden afirmar desde un test:
//
//   1. El horario estaba escrito a mano en tres lugares (tabla, cartel de
//      "abierto ahora", footer) y se desincronizaban entre sí.
//   2. Los colores del modo oscuro se definían salteados, así que algún
//      borde quedaba con el valor del modo claro y no se veía.
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

// Reemplaza Intl para poder pararnos en un día y una hora concretos. El
// script solo le pide weekday/hour/minute, así que con esto alcanza.
function IntlCongelado(weekday, hora, minuto){
  return {
    DateTimeFormat: class {
      formatToParts(){
        return [
          { type: 'weekday', value: weekday },
          { type: 'hour',    value: String(hora).padStart(2, '0') },
          { type: 'minute',  value: String(minuto).padStart(2, '0') },
        ];
      }
    },
  };
}

// Corre el script con el reloj congelado y devuelve sus funciones.
function enElMomento(weekday, hora, minuto){
  const filas = [];
  const ctx = {
    console,
    document: {
      getElementById: (id) => (id === 'horariosBody'
        ? { set innerHTML(v){ filas.push(v); }, get innerHTML(){ return filas.at(-1) ?? ''; } }
        : null),
      querySelector: () => ({ style: {}, getAttribute: () => null, setAttribute() {} }),
      querySelectorAll: () => [],
      elementFromPoint: () => null,
      addEventListener() {},
      documentElement: { getAttribute: () => null, setAttribute() {} },
      hidden: false,
    },
    window: { matchMedia: () => ({ matches: false, addEventListener() {} }), addEventListener() {} },
    requestAnimationFrame: (f) => f(),
    IntersectionObserver: class { observe() {} unobserve() {} },
    setTimeout, clearTimeout, AbortController,
    setInterval: () => 0, clearInterval: () => {},
    Intl: IntlCongelado(weekday, hora, minuto),
    fetch: async () => { throw new Error('sin red en los tests'); },
  };
  vm.createContext(ctx);
  vm.runInContext(js, ctx);
  return { ...ctx, tablaRenderizada: filas.at(-1) ?? '' };
}

// Lo que devuelve el script vive en el realm del vm, así que sus objetos y
// arrays tienen otro prototipo y deepEqual (que en assert/strict es estricto)
// los rechaza aunque el contenido sea idéntico. Esto los trae de vuelta.
const plano = (v) => JSON.parse(JSON.stringify(v));

// ---------------------------------------------------------------------------
// Agrupación de días
// ---------------------------------------------------------------------------

test('los días con el mismo horario se agrupan en una sola fila', () => {
  const { filasDeHorario } = enElMomento('Wed', 10, 0);
  const filas = filasDeHorario();
  assert.equal(filas.length, 3, 'esperaba lunes a viernes, sábado y domingo');
  assert.equal(filas[0].etiqueta, 'Lunes a viernes');
  assert.equal(filas[1].etiqueta, 'Sábado');
  assert.equal(filas[2].etiqueta, 'Domingo');
});

test('la semana arranca el lunes, no el domingo', () => {
  const { filasDeHorario } = enElMomento('Wed', 10, 0);
  assert.deepEqual(plano(filasDeHorario()[0].dias), [1, 2, 3, 4, 5]);
});

test('el domingo queda sin bloques, que es como se dibuja "Cerrado"', () => {
  const { filasDeHorario } = enElMomento('Wed', 10, 0);
  assert.deepEqual(plano(filasDeHorario().at(-1).bloques), []);
});

// ---------------------------------------------------------------------------
// Abierto / cerrado
// ---------------------------------------------------------------------------

test('martes 14:00 — abierto, y dice hasta cuándo', () => {
  const { estadoDelLocal } = enElMomento('Tue', 14, 0);
  assert.deepEqual(plano(estadoDelLocal()), { abierto: true, texto: 'Abierto ahora · hasta 20:30' });
});

test('martes 11:00 — todavía no abrió, avisa a qué hora abre', () => {
  const { estadoDelLocal } = enElMomento('Tue', 11, 0);
  assert.deepEqual(plano(estadoDelLocal()), { abierto: false, texto: 'Cerrado · abre 11:30' });
});

test('martes 11:30 — el minuto de apertura ya cuenta como abierto', () => {
  assert.equal(enElMomento('Tue', 11, 30).estadoDelLocal().abierto, true);
});

test('martes 20:29 — todavía abierto un minuto antes de cerrar', () => {
  assert.equal(enElMomento('Tue', 20, 29).estadoDelLocal().abierto, true);
});

test('martes 20:30 — la hora de cierre ya cuenta como cerrado', () => {
  assert.equal(enElMomento('Tue', 20, 30).estadoDelLocal().abierto, false);
});

test('martes 21:00 — cerrado por hoy, abre mañana', () => {
  const { estadoDelLocal } = enElMomento('Tue', 21, 0);
  assert.deepEqual(plano(estadoDelLocal()), { abierto: false, texto: 'Cerrado · abre mañana 11:30' });
});

// El sábado cierra más temprano que el resto: vale la pena afirmar su borde
// aparte del de los días de semana.
test('sábado 15:29 — todavía abierto un minuto antes de cerrar', () => {
  assert.equal(enElMomento('Sat', 15, 29).estadoDelLocal().abierto, true);
});

test('sábado 16:00 — ya cerró y el domingo no abre, así que salta al lunes', () => {
  const { estadoDelLocal } = enElMomento('Sat', 16, 0);
  assert.deepEqual(plano(estadoDelLocal()), { abierto: false, texto: 'Cerrado · abre lunes 11:30' });
});

test('domingo al mediodía — cerrado, abre mañana', () => {
  const { estadoDelLocal } = enElMomento('Sun', 12, 0);
  assert.deepEqual(plano(estadoDelLocal()), { abierto: false, texto: 'Cerrado · abre mañana 11:30' });
});

test('si el navegador no soporta la zona horaria, no explota', () => {
  const ctx = enElMomento('Wed', 10, 0);
  // Intl que tira error, como haría un navegador sin datos de zona horaria.
  ctx.Intl = { DateTimeFormat: class { formatToParts(){ throw new Error('sin ICU'); } } };
  assert.doesNotThrow(() => ctx.estadoDelLocal());
});

// ---------------------------------------------------------------------------
// La tabla que se dibuja
// ---------------------------------------------------------------------------

test('la fila de hoy queda marcada, y solo una', () => {
  const tabla = enElMomento('Sat', 10, 0).tablaRenderizada;
  assert.equal((tabla.match(/class="hoy"/g) || []).length, 1);
  // Sábado es su propia fila, así que el marcador tiene que caer ahí.
  assert.match(tabla, /<tr class="hoy"><th scope="row">Sábado/);
});

test('el día de hoy no se distingue solo por color: también dice "hoy"', () => {
  // Un borde de color no alcanza para daltonismo ni para impresión en gris.
  assert.match(enElMomento('Mon', 10, 0).tablaRenderizada, /class="tag-hoy">hoy</);
});

test('el domingo se dibuja como Cerrado, no como una celda vacía', () => {
  assert.match(enElMomento('Wed', 10, 0).tablaRenderizada, /<td class="cerrado">Cerrado<\/td>/);
});

test('los horarios salen con dos dígitos, para que la columna quede alineada', () => {
  const tabla = enElMomento('Wed', 10, 0).tablaRenderizada;
  assert.match(tabla, /<span>11:30 – 20:30<\/span>/);
  assert.match(tabla, /<span>11:30 – 15:30<\/span>/);
});

// El respaldo del HTML es lo que se ve si el JS no llega a correr. Si alguien
// cambia HORARIOS y se olvida de tocarlo, quedan contradiciéndose: esto lo
// detecta antes de que salga a producción.
test('el horario escrito a mano en el HTML coincide con el que calcula el script', () => {
  const { filasDeHorario } = enElMomento('Wed', 10, 0);
  const respaldo = html.slice(html.indexOf('id="horariosBody"'), html.indexOf('</tbody>'));

  filasDeHorario().forEach(({ etiqueta, bloques }) => {
    assert.ok(respaldo.includes(etiqueta),
      `al respaldo del HTML le falta la fila "${etiqueta}"`);
    if(!bloques.length){
      assert.ok(respaldo.includes('Cerrado'), 'falta el "Cerrado" del día sin horario');
    }
  });
});

// El JSON-LD es lo que lee Google, y vive en el <head>, fuera del JS: es el
// único lugar del horario que HORARIOS no puede mantener al día solo. Sin este
// test, cambiar el horario y olvidarse del JSON-LD deja al sitio diciendo una
// cosa y a Google otra, que es exactamente lo que rompe el SEO local.
test('el horario del JSON-LD coincide con HORARIOS', () => {
  const { filasDeHorario } = enElMomento('Wed', 12, 0);
  const ld = JSON.parse(
    html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);

  const DIAS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const aMinutos = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

  // Lo que declara el JSON-LD, aplanado a: día -> [[desde, hasta], ...]
  const declarado = {};
  ld.openingHoursSpecification.forEach((spec) => {
    spec.dayOfWeek.forEach((nombre) => {
      const d = DIAS.indexOf(nombre);
      assert.ok(d >= 0, `día desconocido en el JSON-LD: ${nombre}`);
      (declarado[d] ??= []).push([aMinutos(spec.opens), aMinutos(spec.closes)]);
    });
  });

  // Lo que dice la fuente de verdad, en la misma forma.
  const real = {};
  filasDeHorario().forEach(({ dias, bloques }) => {
    if(bloques.length) dias.forEach((d) => { real[d] = plano(bloques); });
  });

  const orden = (o) => JSON.stringify(
    Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k].slice().sort()])));

  assert.equal(orden(declarado), orden(real),
    'el openingHoursSpecification del <head> quedó desfasado de HORARIOS');
});

// Los dos tests de arriba cubren el <tbody> de respaldo y el JSON-LD, pero el
// horario también está escrito a mano en la prosa, en la respuesta del FAQ (en
// el JSON-LD y en el HTML visible) y en la maqueta de WhatsApp. Esos no los
// miraba nadie, y uno se desincronizó: el FAQ del JSON-LD llegó a declarar que
// el local abría 12:00 mientras HORARIOS decía 11:30, o sea dos horarios
// contradictorios en la misma página, los dos leídos por Google.
//
// En vez de enumerar cada lugar —lista que se desactualiza sola en cuanto
// alguien agrega un párrafo— este test da vuelta la pregunta: toma TODA hora
// escrita en el archivo y exige que sea un borde que HORARIOS produce. Si
// mañana aparece un horario nuevo en cualquier rincón, o alguien cambia uno y
// se olvida del resto, salta acá.
test('ninguna hora escrita en la página contradice a HORARIOS', () => {
  const { filasDeHorario } = enElMomento('Wed', 12, 0);

  const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
  const permitidas = new Set(
    filasDeHorario().flatMap(({ bloques }) => plano(bloques).flat().map(hhmm)));

  assert.ok(permitidas.size > 0, 'HORARIOS no produjo ningún horario');

  // La hora tiene que estar aislada. Sin esto pican dos cosas que no son
  // horarios: la escala de espaciado del CSS (--s3:12px se lee como "3:12") y
  // las fechas ISO con hora (2026-09-20T10:30:00). De ahí que se exija que no
  // venga pegada a una letra, un dígito, un guion ni otros dos puntos.
  const escritas = [...html.matchAll(/(?<![A-Za-z\d:-])(\d{1,2}:\d{2})(?![:\dA-Za-z])/g)]
    .map((m) => m[1]);
  assert.ok(escritas.length > 0, 'esperaba encontrar horarios escritos en el HTML');

  const intrusas = [...new Set(escritas)].filter((t) => !permitidas.has(t));
  assert.deepEqual(intrusas, [],
    `estas horas están escritas en la página pero no salen de HORARIOS (${[...permitidas].join(', ')}): ${intrusas.join(', ')}`);
});

// ---------------------------------------------------------------------------
// Sistema de color
// ---------------------------------------------------------------------------

// Los comentarios se sacan primero: adentro se mencionan tokens ("--border
// sobre --bg…") y sin esto el parser los lee como declaraciones y se come la
// que viene después.
const tokensDe = (bloque) =>
  Object.fromEntries([...bloque.replace(/\/\*[\s\S]*?\*\//g, '')
    .matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)]
    .map((m) => [m[1], m[2].trim()]));

const rootClaro = tokensDe(html.match(/:root\{([^}]*)\}/)[1]);

// La paleta oscura está escrita dos veces, porque CSS plano no permite reusar
// un bloque de declaraciones y el proyecto no tiene build step. Las llaves
// pegadas al selector son a propósito: así estos regex no matchean los
// bloques de componentes, que llevan un descendiente antes de la llave.
const rootOscuro = tokensDe(       // el que sigue al sistema operativo
  html.match(/:root:not\(\[data-theme="light"\]\)\{([^}]*)\}/)[1]);
const rootOscuroElegido = tokensDe( // el de la elección explícita del visitante
  html.match(/:root\[data-theme="dark"\]\{([^}]*)\}/)[1]);

test('las dos copias de la paleta oscura son idénticas', () => {
  // Si alguien retoca un color en una sola, el sitio se ve distinto según si
  // el visitante tocó el botón de tema o no. Es imposible de notar mirando.
  assert.deepEqual(rootOscuroElegido, rootOscuro,
    'la paleta de :root[data-theme="dark"] se despegó de la del sistema');
});

test('todo color del modo claro tiene su par en el modo oscuro', () => {
  // Este es el test que evita el bug que volvió tres veces: un borde definido
  // solo para el modo claro queda con el mismo valor de noche y desaparece
  // contra el fondo oscuro.
  const colores = Object.entries(rootClaro)
    .filter(([, v]) => v.startsWith('#'))
    .map(([k]) => k);

  assert.ok(colores.length > 10, 'esperaba encontrar la paleta en :root');
  const faltantes = colores.filter((t) => !(t in rootOscuro));
  assert.deepEqual(faltantes, [],
    `estos colores no están redefinidos para modo oscuro: ${faltantes.join(', ')}`);
});

test('los dos modos usan valores distintos para fondo, borde y texto', () => {
  // Si coinciden es que alguien copió el bloque sin cambiarlo.
  ['--bg', '--surface', '--border', '--text'].forEach((t) => {
    assert.notEqual(rootOscuro[t], rootClaro[t], `${t} quedó igual en los dos modos`);
  });
});

// Contraste mínimo del borde contra la superficie que divide. Por debajo de
// ~1.5:1 una línea de 1px deja de percibirse; el valor viejo (#3A3428 sobre
// #1A202C) daba 1.44:1 y era justamente el que no se veía.
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

test('en modo oscuro el borde se distingue de la superficie que divide', () => {
  const ratio = contraste(rootOscuro['--border'], rootOscuro['--surface']);
  assert.ok(ratio >= 1.5,
    `--border sobre --surface da ${ratio.toFixed(2)}:1 en oscuro, hace falta 1.5:1`);
});

test('en modo claro el borde también se distingue', () => {
  const ratio = contraste(rootClaro['--border'], rootClaro['--surface']);
  assert.ok(ratio >= 1.2,
    `--border sobre --surface da ${ratio.toFixed(2)}:1 en claro`);
});

test('el texto principal llega a AA sobre el fondo, en los dos modos', () => {
  [['claro', rootClaro], ['oscuro', rootOscuro]].forEach(([modo, t]) => {
    const ratio = contraste(t['--text'], t['--bg']);
    assert.ok(ratio >= 4.5, `--text sobre --bg en modo ${modo}: ${ratio.toFixed(2)}:1`);
  });
});

test('el texto secundario también llega a AA', () => {
  [['claro', rootClaro], ['oscuro', rootOscuro]].forEach(([modo, t]) => {
    ['--text-2', '--text-3'].forEach((token) => {
      const ratio = contraste(t[token], t['--bg']);
      assert.ok(ratio >= 4.5, `${token} sobre --bg en modo ${modo}: ${ratio.toFixed(2)}:1`);
    });
  });
});

// Las bandas oscuras no son una sola: hay dos superficies, --surface-inv (la
// barra, el pie) y --surface-inv-2, más clara, que es el fondo de Servicios,
// Reseñas, Ubicación y Blog. Los tests de acá abajo comparaban solo contra la
// primera, y por eso nadie vio que --text-inv-2 daba 3,88:1 sobre la segunda:
// 45 elementos por debajo de AA en modo claro, con el token documentado como
// "5,6:1" porque ese era el número contra la superficie equivocada.
//
// La lección es que el par que hay que afirmar no es el documentado sino el
// peor de los reales. Este test recorre el producto completo de textos por
// superficies, así que agregar una superficie oscura nueva obliga a que todos
// los textos sigan siendo legibles sobre ella.
const SUPERFICIES_OSCURAS = ['--surface-inv', '--surface-inv-2'];

test('los textos inversos llegan a AA sobre TODAS las bandas oscuras, no solo una', () => {
  [['claro', rootClaro], ['oscuro', rootOscuro]].forEach(([modo, t]) => {
    ['--text-inv', '--text-inv-2'].forEach((token) => {
      SUPERFICIES_OSCURAS.forEach((superficie) => {
        const ratio = contraste(t[token], t[superficie]);
        assert.ok(ratio >= 4.5,
          `${token} sobre ${superficie} en modo ${modo}: ${ratio.toFixed(2)}:1, hace falta 4.5:1`);
      });
    });
  });
});

// El acento carga el puntaje de Google, las estrellas y los hovers del pie.
// Sobre --surface-inv llega a AA en los dos modos y eso se exige. Sobre
// --surface-inv-2 en modo claro da 3,81:1 y no llega: se decidió no tocarlo
// para no mover el color de marca, sabiendo que las estrellas son aria-hidden
// y que el "4,4" también va en texto. El piso de 3:1 deja esa decisión por
// escrito y frena que empeore; si algún día se aclara el acento, subir esto
// a 4.5 y borrar el comentario.
test('el acento se lee sobre la banda oscura, en los dos modos', () => {
  [['claro', rootClaro], ['oscuro', rootOscuro]].forEach(([modo, t]) => {
    const ratio = contraste(t['--brand-bright'], t['--surface-inv']);
    assert.ok(ratio >= 4.5,
      `--brand-bright sobre --surface-inv en modo ${modo}: ${ratio.toFixed(2)}:1`);

    const sobreLaOtra = contraste(t['--brand-bright'], t['--surface-inv-2']);
    assert.ok(sobreLaOtra >= 3,
      `--brand-bright sobre --surface-inv-2 en modo ${modo}: ${sobreLaOtra.toFixed(2)}:1, el piso es 3:1`);
  });
});

// El navbar es la misma superficie oscura que la banda de reseñas y el footer,
// y el theme-color del teléfono lo copia con dos literales (BARRA en el
// script), porque el JS no puede leer un custom property sin un layout real.
// Este test es lo que impide que se despeguen si mañana cambia la paleta.
test('el theme-color del teléfono coincide con --surface-inv en los dos modos', () => {
  const barra = html.match(/const BARRA = \{ light: '([^']+)', dark: '([^']+)' \}/);
  assert.ok(barra, 'no se encontró la constante BARRA en el script');
  assert.equal(barra[1].toUpperCase(), rootClaro['--surface-inv'].toUpperCase());
  assert.equal(barra[2].toUpperCase(), rootOscuro['--surface-inv'].toUpperCase());
});

// El CTA de la barra no usa --btn-bg (es navy, igual que la barra): va en
// --brand-bright con el navy como texto. Que siga siendo legible es lo que
// sostiene la única conversión que le importa al negocio.
test('el CTA de la barra se lee sobre el navbar, en los dos modos', () => {
  [['claro', rootClaro], ['oscuro', rootOscuro]].forEach(([modo, t]) => {
    const texto = contraste(t['--surface-inv'], t['--brand-bright']);
    assert.ok(texto >= 4.5,
      `texto del CTA de la barra en modo ${modo}: ${texto.toFixed(2)}:1`);
    const contraLaBarra = contraste(t['--brand-bright'], t['--surface-inv']);
    assert.ok(contraLaBarra >= 3,
      `el CTA no se despega de la barra en modo ${modo}: ${contraLaBarra.toFixed(2)}:1`);
  });
});

test('el botón primario tiene contraste suficiente entre su fondo y su texto', () => {
  [['claro', rootClaro], ['oscuro', rootOscuro]].forEach(([modo, t]) => {
    const ratio = contraste(t['--btn-text'], t['--btn-bg']);
    assert.ok(ratio >= 4.5, `botón primario en modo ${modo}: ${ratio.toFixed(2)}:1`);
  });
});
