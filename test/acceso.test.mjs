// ============================================================
// Tests de la verificación de Cloudflare Access
//
// Es el control que decide quién puede escribir el catálogo, así que
// se prueba contra criptografía de verdad: se genera un par de claves
// RSA con WebCrypto, se firman tokens reales y se verifica que los
// buenos pasen y los malos no.
//
// La mitad de los tests son ataques. Un verificador de JWT escrito a
// mano falla casi siempre por lo mismo: acepta el algoritmo que le
// propone el token, no mira la audiencia, o confía en el payload sin
// comprobar la firma. Cada uno de esos tiene su test acá.
// ============================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarAcceso } from '../functions/_lib/acceso.js';

const EQUIPO = 'neneko.cloudflareaccess.com';
const AUD = 'aud-de-la-app-del-panel';
const ENV = { ACCESS_TEAM_DOMAIN: EQUIPO, ACCESS_AUD: AUD };

const b64url = (buf) =>
  Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const b64urlTexto = (s) => b64url(new TextEncoder().encode(s));

async function parDeClaves(kid) {
  const par = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true, ['sign', 'verify'],
  );
  const jwk = await crypto.subtle.exportKey('jwk', par.publicKey);
  return { par, clavePublica: { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', kid } };
}

async function firmar(privada, { kid = 'k1', alg = 'RS256', ...cuerpo }) {
  const ahora = Math.floor(Date.now() / 1000);
  const payload = {
    aud: AUD, iss: `https://${EQUIPO}`, exp: ahora + 3600,
    email: 'duena@neneko.com.ar', ...cuerpo,
  };
  const h = b64urlTexto(JSON.stringify({ alg, kid, typ: 'JWT' }));
  const p = b64urlTexto(JSON.stringify(payload));
  const firma = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', privada, new TextEncoder().encode(`${h}.${p}`));
  return `${h}.${p}.${b64url(firma)}`;
}

const pedido = (token, { enCookie = false } = {}) => new Request('https://x/api/productos', {
  method: 'POST',
  headers: token
    ? (enCookie
        ? { cookie: `otra=1; CF_Authorization=${token}; mas=2` }
        : { 'Cf-Access-Jwt-Assertion': token })
    : {},
});

// Un JWKS fijo para los tests: nunca sale a la red.
const jwksDe = (...claves) => async () => ({ keys: claves });

const claves = await parDeClaves('k1');
const jwks = jwksDe(claves.clavePublica);


// ------------------------------------------------------------
// El camino feliz
// ------------------------------------------------------------

test('un token bien firmado pasa y devuelve el mail', async () => {
  const t = await firmar(claves.par.privateKey, {});
  const r = await verificarAcceso(pedido(t), ENV, { traerJwks: jwks });
  assert.equal(r.ok, true, r.motivo);
  assert.equal(r.email, 'duena@neneko.com.ar');
});

test('también lo toma de la cookie, no solo del header', async () => {
  // El panel hace fetch desde su propia pantalla: ahí el navegador
  // manda la cookie de Access y no el header.
  const t = await firmar(claves.par.privateKey, {});
  const r = await verificarAcceso(pedido(t, { enCookie: true }), ENV, { traerJwks: jwks });
  assert.equal(r.ok, true, r.motivo);
});


// ------------------------------------------------------------
// Falla cerrada: lo más importante del archivo
// ------------------------------------------------------------

test('sin configuración de Access NO deja pasar', async () => {
  // Si esto devolviera ok, un olvido al desplegar (no cargar las
  // variables) dejaría el catálogo abierto a cualquiera, y el sitio
  // andaría igual, así que nadie se enteraría.
  const t = await firmar(claves.par.privateKey, {});
  for (const env of [{}, { ACCESS_AUD: AUD }, { ACCESS_TEAM_DOMAIN: EQUIPO }, undefined]) {
    const r = await verificarAcceso(pedido(t), env, { traerJwks: jwks });
    assert.equal(r.ok, false, `dejó pasar con env = ${JSON.stringify(env)}`);
    assert.match(r.motivo, /ACCESS_/);
  }
});

test('si no se pueden leer las claves, tampoco deja pasar', async () => {
  const t = await firmar(claves.par.privateKey, {});
  const r = await verificarAcceso(pedido(t), ENV, {
    traerJwks: async () => { throw new Error('red caída'); },
  });
  assert.equal(r.ok, false);
});

test('un pedido sin credencial no pasa', async () => {
  const r = await verificarAcceso(pedido(null), ENV, { traerJwks: jwks });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /credencial/i);
});


// ------------------------------------------------------------
// Ataques
// ------------------------------------------------------------

test('alg:none se rechaza', async () => {
  // El clásico: el token dice "no tengo firma" y un verificador
  // ingenuo le cree.
  const h = b64urlTexto(JSON.stringify({ alg: 'none', kid: 'k1', typ: 'JWT' }));
  const p = b64urlTexto(JSON.stringify({
    aud: AUD, iss: `https://${EQUIPO}`, exp: Math.floor(Date.now() / 1000) + 3600,
    email: 'intruso@ejemplo.com',
  }));
  const r = await verificarAcceso(pedido(`${h}.${p}.`), ENV, { traerJwks: jwks });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /Algoritmo/i);
});

test('cambiar el algoritmo a HS256 se rechaza', async () => {
  // La otra variante: el atacante firma con HMAC usando como secreto la
  // clave pública, que es pública justamente.
  const t = await firmar(claves.par.privateKey, { alg: 'HS256' });
  const r = await verificarAcceso(pedido(t), ENV, { traerJwks: jwks });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /Algoritmo/i);
});

test('un token firmado con OTRA clave se rechaza', async () => {
  const intruso = await parDeClaves('k1'); // mismo kid, clave distinta
  const t = await firmar(intruso.par.privateKey, {});
  const r = await verificarAcceso(pedido(t), ENV, { traerJwks: jwks });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /firma/i);
});

test('manipular el payload invalida la firma', async () => {
  const t = await firmar(claves.par.privateKey, {});
  const [h, , s] = t.split('.');
  const falso = b64urlTexto(JSON.stringify({
    aud: AUD, iss: `https://${EQUIPO}`, exp: Math.floor(Date.now() / 1000) + 3600,
    email: 'intruso@ejemplo.com',
  }));
  const r = await verificarAcceso(pedido(`${h}.${falso}.${s}`), ENV, { traerJwks: jwks });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /firma/i);
});

test('un kid desconocido se rechaza', async () => {
  const otro = await parDeClaves('k99');
  const t = await firmar(otro.par.privateKey, { kid: 'k99' });
  const r = await verificarAcceso(pedido(t), ENV, { traerJwks: jwks });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /desconocida/i);
});

test('un token de otra aplicación del mismo equipo se rechaza', async () => {
  // Sin control de audiencia, cualquier app de Access del equipo
  // serviría de llave para el panel.
  const t = await firmar(claves.par.privateKey, { aud: 'otra-app-cualquiera' });
  const r = await verificarAcceso(pedido(t), ENV, { traerJwks: jwks });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /otra aplicación/i);
});

test('un token de otro equipo se rechaza', async () => {
  const t = await firmar(claves.par.privateKey, { iss: 'https://otro.cloudflareaccess.com' });
  const r = await verificarAcceso(pedido(t), ENV, { traerJwks: jwks });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /otro equipo/i);
});

test('un token vencido se rechaza', async () => {
  const t = await firmar(claves.par.privateKey, { exp: Math.floor(Date.now() / 1000) - 10 });
  const r = await verificarAcceso(pedido(t), ENV, { traerJwks: jwks });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /venció/i);
});

test('un token sin exp se rechaza', async () => {
  // Sin vencimiento, una credencial filtrada sirve para siempre.
  const t = await firmar(claves.par.privateKey, { exp: undefined });
  const r = await verificarAcceso(pedido(t), ENV, { traerJwks: jwks });
  assert.equal(r.ok, false);
});

test('basura en el header se rechaza sin romper', async () => {
  for (const basura of ['', 'no-es-un-jwt', 'a.b', 'a.b.c.d', '....', '%%%.%%%.%%%']) {
    const r = await verificarAcceso(pedido(basura), ENV, { traerJwks: jwks });
    assert.equal(r.ok, false, `dejó pasar: ${basura}`);
    assert.ok(typeof r.motivo === 'string' && r.motivo.length > 0);
  }
});
