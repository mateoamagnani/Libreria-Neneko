#!/usr/bin/env node
// ============================================================
// Migrar el catálogo de la planilla a la base
//
//   node tools/migrar-csv.mjs novedades=Novedades.csv menu=Menu.csv > migracion.sql
//   npx wrangler d1 execute neneko --remote --file=migracion.sql
//
// Corre una sola vez, en la mudanza. No es parte del sitio.
//
// Usa el MISMO validador que la API (functions/_lib/productos.js), así
// la migración no puede meter en la base nada que el panel después
// rechazaría. Si una fila no pasa, se informa y se saltea: es mejor
// importar 47 de 50 y saber cuáles tres faltan, que importar 50 y
// descubrir meses después que tres están rotas.
//
// Escribe el SQL a stdout y el informe a stderr, así se puede redirigir
// uno sin perder el otro.
// ============================================================
import { readFileSync } from 'node:fs';
import { validarProducto, SECCIONES } from '../functions/_lib/productos.js';

// ------------------------------------------------------------
// Parseo de CSV
//
// Soporta comas dentro de comillas, comillas escapadas ("") y saltos de
// línea dentro de una celda. El catálogo real tiene detalles como
// "Apuntes, láminas y fotos", así que partir por comas no alcanza.
// ------------------------------------------------------------
function parsearCsv(texto) {
  const s = texto.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const filas = [];
  let fila = [], celda = '', enComillas = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (enComillas) {
      if (c === '"') {
        if (s[i + 1] === '"') { celda += '"'; i++; }
        else enComillas = false;
      } else celda += c;
    } else if (c === '"') enComillas = true;
    else if (c === ',') { fila.push(celda); celda = ''; }
    else if (c === '\n') { fila.push(celda); filas.push(fila); fila = []; celda = ''; }
    else celda += c;
  }
  fila.push(celda);
  if (fila.some((c) => c !== '')) filas.push(fila);

  return filas.map((f) => f.map((c) => c.trim()));
}

/**
 * Las columnas cambiaron con los años y la planilla puede tener
 * cualquiera de las tres formas. Se detecta por la fila más ancha, no
 * por la primera: si la primera fila tiene celdas vacías al final,
 * Google las recorta y el formato se leería mal.
 */
function aProducto(fila, ancho) {
  if (ancho >= 7) {
    const [categoria, subcategoria, nombre, precio, detalle, imagen, keywords] = fila;
    return { categoria, subcategoria, nombre, precio, detalle, imagen, keywords };
  }
  if (ancho === 6) {
    const [categoria, subcategoria, nombre, precio, detalle, imagen] = fila;
    return { categoria, subcategoria, nombre, precio, detalle, imagen };
  }
  const [categoria, nombre, precio, detalle, imagen] = fila;
  return { categoria, nombre, precio, detalle, imagen };
}

const pareceEncabezado = (fila) =>
  /^(categor|sub|nombre|producto|menu|ubicacion|home)/i.test(fila[0] || '');

const sql = (v) => (v === null || v === undefined || v === ''
  ? 'null'
  : `'${String(v).replace(/'/g, "''")}'`);

/**
 * Convierte un CSV en sentencias INSERT.
 *
 * El orden sale de la posición dentro de cada categoría, que es como se
 * veían en la planilla: así el catálogo queda igual que antes y la
 * dueña no se encuentra los productos barajados el primer día.
 */
function migrar(texto, seccion) {
  const filas = parsearCsv(texto);
  if (!filas.length) return { inserts: [], ok: 0, saltadas: [] };

  const ancho = Math.max(...filas.map((f) => f.length));
  const utiles = pareceEncabezado(filas[0]) ? filas.slice(1) : filas;

  const inserts = [];
  const saltadas = [];
  const ordenPorCategoria = new Map();

  utiles.forEach((fila, i) => {
    const linea = i + (pareceEncabezado(filas[0]) ? 2 : 1);
    const crudo = aProducto(fila, ancho);

    // Las filas totalmente vacías son separadores de la planilla, no
    // errores: se saltean sin ruido.
    if (!Object.values(crudo).some((v) => (v || '').trim())) return;

    const orden = ordenPorCategoria.get(crudo.categoria) ?? 0;
    const v = validarProducto({ ...crudo, seccion, orden, activo: true });

    if (!v.ok) {
      saltadas.push({ linea, nombre: crudo.nombre || '(sin nombre)', motivos: v.errores });
      return;
    }

    ordenPorCategoria.set(crudo.categoria, orden + 1);
    const p = v.producto;
    inserts.push(
      'insert into productos (id, seccion, categoria, subcategoria, nombre, ' +
      'precio, detalle, imagen, keywords, orden, activo) values (' +
      [sql(crypto.randomUUID()), sql(p.seccion), sql(p.categoria), sql(p.subcategoria),
       sql(p.nombre), sql(p.precio), sql(p.detalle), sql(p.imagen), sql(p.keywords),
       p.orden, p.activo].join(', ') + ');',
    );
  });

  return { inserts, ok: inserts.length, saltadas };
}

// ------------------------------------------------------------
// Línea de comandos
// ------------------------------------------------------------
function principal(args) {
  const entradas = args.map((a) => {
    const i = a.indexOf('=');
    if (i < 0) throw new Error(`Argumento mal formado: "${a}". Se espera seccion=archivo.csv`);
    const seccion = a.slice(0, i);
    if (!SECCIONES.includes(seccion)) {
      throw new Error(`Sección desconocida: "${seccion}". Tiene que ser ${SECCIONES.join(' o ')}.`);
    }
    return { seccion, archivo: a.slice(i + 1) };
  });

  if (!entradas.length) {
    throw new Error('Uso: node tools/migrar-csv.mjs novedades=A.csv menu=B.csv > migracion.sql');
  }

  const partes = ['-- Migración del catálogo. Generado por tools/migrar-csv.mjs.',
                  '-- Se aplica una sola vez, después de db/schema.sql.', ''];
  let total = 0;
  const informe = [];

  for (const { seccion, archivo } of entradas) {
    const r = migrar(readFileSync(archivo, 'utf8'), seccion);
    total += r.ok;
    partes.push(`-- ${seccion}: ${r.ok} productos`, ...r.inserts, '');
    informe.push(`${seccion}: ${r.ok} productos listos` +
      (r.saltadas.length ? `, ${r.saltadas.length} saltados` : ''));
    for (const s of r.saltadas) {
      informe.push(`  linea ${s.linea} — ${s.nombre}: ${s.motivos.join(' / ')}`);
    }
  }

  process.stderr.write(informe.join('\n') + `\nTotal: ${total} productos\n`);
  return partes.join('\n');
}

// Solo al correrlo directo, para que los tests puedan importar las
// funciones sin que se ejecute nada.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  try {
    process.stdout.write(principal(process.argv.slice(2)));
  } catch (e) {
    process.stderr.write(`\n${e.message}\n`);
    process.exit(1);
  }
}

export { parsearCsv, migrar, aProducto };
