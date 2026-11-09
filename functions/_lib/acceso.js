// ============================================================
// Verificación de Cloudflare Access
//
// Access corta las rutas protegidas en el borde, antes de que el pedido
// llegue a este código. Entonces, ¿para qué verificar de nuevo acá?
//
// Porque esa protección vive en una política del panel de Cloudflare,
// fuera del repositorio, y nadie la revisa. Si alguien la edita, la
// borra o se equivoca en el patrón de rutas, las rutas de escritura
// quedan abiertas a internet y no se entera nadie: el sitio sigue
// andando igual. Este archivo convierte eso en un 403.
//
// Es la misma clase de falla que tuvo el deploy de este proyecto, roto
// en silencio durante seis semanas porque nada lo afirmaba.
//
// Cómo funciona: Access firma un JWT y lo manda en el header
// Cf-Access-Jwt-Assertion. Se verifica la firma contra las claves
// públicas del equipo, más emisor, audiencia y vencimiento.
// ============================================================

const CABECERA = 'Cf-Access-Jwt-Assertion';
const COOKIE = 'CF_Authorization';

// Las claves del equipo rotan, pero no seguido. Se cachean en el
// módulo: en Workers eso vive lo que vive el isolate, así que la
// mayoría de los pedidos no sale a buscarlas.
let cacheJwks = { url: null, claves: null, vence: 0 };
const TTL_JWKS_MS = 60 * 60 * 1000; // una hora

const bytesDeB64url = (s) => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
               .padEnd(s.length + (4 - s.length % 4) % 4, '=');
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

const textoDeB64url = (s) => new TextDecoder().decode(bytesDeB64url(s));

async function traerJwksPorRed(dominioEquipo) {
  const url = `https://${dominioEquipo}/cdn-cgi/access/certs`;
  const ahora = Date.now();
  if (cacheJwks.url === url && cacheJwks.claves && cacheJwks.vence > ahora) {
    return cacheJwks.claves;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`no se pudieron leer las claves de Access (${res.status})`);
  const jwks = await res.json();
  cacheJwks = { url, claves: jwks, vence: ahora + TTL_JWKS_MS };
  return jwks;
}

function tokenDelPedido(request) {
  const h = request.headers.get(CABECERA);
  if (h) return h;
  // El header es el camino normal. La cookie cubre el caso de un pedido
  // hecho desde la propia pantalla del panel, donde el navegador la
  // manda sola.
  const cookies = request.headers.get('cookie') || '';
  const m = cookies.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return m ? m[1] : null;
}

/**
 * ¿Este pedido viene de alguien que pasó por Access?
 *
 * Devuelve { ok:true, email } o { ok:false, motivo }. Nunca tira: un
 * fallo acá tiene que terminar en 403, no en 500, porque un 500 en
 * medio de una verificación de permisos se parece demasiado a un bug
 * que alguien podría aprender a provocar.
 *
 * `traerJwks` se puede inyectar para los tests; en producción sale por
 * red a las claves del equipo.
 */
export async function verificarAcceso(request, env, { traerJwks = traerJwksPorRed } = {}) {
  // --- Falla cerrada ---
  // Si falta la configuración, NO se deja pasar. Es la decisión más
  // importante del archivo: la alternativa cómoda sería "si no hay
  // config, no verifico", y eso convierte un olvido al desplegar en un
  // catálogo abierto a cualquiera.
  const dominioEquipo = env?.ACCESS_TEAM_DOMAIN;
  const audiencia = env?.ACCESS_AUD;
  if (!dominioEquipo || !audiencia) {
    return { ok: false, motivo: 'Falta configurar ACCESS_TEAM_DOMAIN o ACCESS_AUD.' };
  }

  const token = tokenDelPedido(request);
  if (!token) return { ok: false, motivo: 'El pedido no trae credencial de Access.' };

  const partes = token.split('.');
  if (partes.length !== 3) return { ok: false, motivo: 'La credencial está mal formada.' };

  let cabecera, cuerpo;
  try {
    cabecera = JSON.parse(textoDeB64url(partes[0]));
    cuerpo = JSON.parse(textoDeB64url(partes[1]));
  } catch {
    return { ok: false, motivo: 'La credencial no se puede leer.' };
  }

  // Solo RS256. Aceptar "none" o un HMAC acá es el agujero clásico de
  // los verificadores de JWT escritos a mano: el atacante elige el
  // algoritmo y se firma el token él mismo.
  if (cabecera.alg !== 'RS256') {
    return { ok: false, motivo: `Algoritmo no aceptado: ${cabecera.alg}.` };
  }

  let jwks;
  try {
    jwks = await traerJwks(dominioEquipo);
  } catch (e) {
    return { ok: false, motivo: `No se pudieron leer las claves de Access: ${e.message}` };
  }

  const clave = jwks?.keys?.find((k) => k.kid === cabecera.kid);
  if (!clave) return { ok: false, motivo: 'La credencial fue firmada con una clave desconocida.' };

  let firmaValida = false;
  try {
    const claveCripto = await crypto.subtle.importKey(
      'jwk',
      { kty: 'RSA', n: clave.n, e: clave.e, alg: 'RS256', ext: true },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    firmaValida = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      claveCripto,
      bytesDeB64url(partes[2]),
      new TextEncoder().encode(`${partes[0]}.${partes[1]}`),
    );
  } catch {
    firmaValida = false;
  }
  if (!firmaValida) return { ok: false, motivo: 'La firma de la credencial no verifica.' };

  // La audiencia ata el token a ESTA aplicación. Sin este control, un
  // token válido de cualquier otra aplicación del mismo equipo entraría
  // igual.
  const aud = Array.isArray(cuerpo.aud) ? cuerpo.aud : [cuerpo.aud];
  if (!aud.includes(audiencia)) {
    return { ok: false, motivo: 'La credencial es de otra aplicación.' };
  }

  if (cuerpo.iss !== `https://${dominioEquipo}`) {
    return { ok: false, motivo: 'La credencial es de otro equipo.' };
  }

  const ahora = Math.floor(Date.now() / 1000);
  if (typeof cuerpo.exp !== 'number' || cuerpo.exp <= ahora) {
    return { ok: false, motivo: 'La credencial venció. Volvé a entrar.' };
  }
  if (typeof cuerpo.nbf === 'number' && cuerpo.nbf > ahora + 60) {
    return { ok: false, motivo: 'La credencial todavía no es válida.' };
  }

  return { ok: true, email: cuerpo.email || null };
}
