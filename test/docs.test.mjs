// ============================================================
// Tests de la documentación del repo
//
// La documentación se pudre en silencio: nadie la ejecuta, así que un
// link roto o una guía que describe un sistema que ya no existe pueden
// quedar meses sin que nadie los note. Estos tests la tratan como
// código.
//
// Solo cubren lo que escribimos nosotros (README, CLAUDE.md y docs/).
// Los .md de .claude/skills/ vienen de afuera y no los mantenemos.
// ============================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

const nuestros = [
  join(raiz, 'README.md'),
  join(raiz, 'CLAUDE.md'),
  ...readdirSync(join(raiz, 'docs'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => join(raiz, 'docs', f)),
];

test('ningún link relativo de la documentación apunta a un archivo que no existe', () => {
  // Al sacar la guía del Sheet quedaron links colgando desde tres
  // documentos distintos. Un link roto no rompe nada, y por eso se
  // queda ahí para siempre.
  const rotos = [];
  for (const archivo of nuestros) {
    const txt = readFileSync(archivo, 'utf8');
    for (const m of txt.matchAll(/\]\((\.[^)#\s]*?)(#[^)]*)?\)/g)) {
      const destino = resolve(dirname(archivo), m[1]);
      if (!existsSync(destino)) {
        rotos.push(`${relative(raiz, archivo)} -> ${m[1]}`);
      }
    }
  }
  assert.deepEqual(rotos, [], `links rotos:\n  ${rotos.join('\n  ')}`);
});

test('la documentación no manda a configurar el catálogo por Google Sheets', () => {
  // El catálogo salió del Sheet en noviembre de 2026. Hablar de la planilla
  // está bien y es necesario: la guía de migración tiene que nombrarla para
  // explicar de dónde salen los datos y cuándo archivarla. Lo que no puede
  // quedar es la MAQUINARIA de la configuración vieja, porque quien la siga
  // va a armar algo que el sitio ya no lee.
  //
  // La primera versión de este test marcaba cualquier línea con la palabra
  // "planilla" y daba cinco falsos positivos, todos legítimos. Un test que
  // grita por cosas correctas enseña a ignorarlo, así que ahora busca solo
  // marcas inequívocas del sistema viejo.
  const marcas = [
    /SHEET_CSV_URL/,
    /SHEET_MENU_URL/,
    /output=csv/,
    /pub\?gid=/,
    /Publicar en la Web/i,
    /catalogo-google-sheets/,
    /plantilla-catalogo/,
  ];
  const sospechosas = [];
  for (const archivo of nuestros) {
    const txt = readFileSync(archivo, 'utf8');
    txt.split('\n').forEach((linea, i) => {
      if (marcas.some((re) => re.test(linea))) {
        sospechosas.push(`${relative(raiz, archivo)}:${i + 1}  ${linea.trim()}`);
      }
    });
  }
  assert.deepEqual(sospechosas, [],
    `quedó maquinaria de la configuración vieja:\n  ${sospechosas.join('\n  ')}`);
});

test('la guía de deploy dice cómo no perder el portón de los tests', () => {
  // El deploy estuvo seis semanas sin publicar porque los tests estaban
  // en rojo y nadie lo miraba. Al mudarse a Cloudflare ese portón hay
  // que reconstruirlo a mano, y es justo el tipo de detalle que se
  // pierde en una migración.
  const deploy = readFileSync(join(raiz, 'docs/deploy.md'), 'utf8');
  assert.match(deploy, /npm test.*build command|build command.*npm test/is,
    'no explica que el build command tiene que correr los tests');
  assert.match(deploy, /seis semanas/,
    'no cuenta el antecedente, que es lo que hace entender por qué importa');
});
