// ============================================================
// Respuestas HTTP
//
// Un solo lugar que arma los Response, para que todas las rutas
// contesten igual y el panel no tenga que adivinar la forma del error.
// ============================================================

const BASE = { 'content-type': 'application/json; charset=utf-8' };

export function json(datos, { status = 200, cache } = {}) {
  const headers = { ...BASE };
  // El listado público es el camino caliente: lo pide cada visitante en
  // cada carga. Sin cache, cada visita pega contra D1 para traer lo
  // mismo. Las escrituras nunca se cachean.
  if (cache) headers['cache-control'] = cache;
  return new Response(JSON.stringify(datos), { status, headers });
}

/**
 * Error con forma estable: { error: "...", detalles: [...] }.
 *
 * El panel muestra `detalles` tal cual cuando están, porque vienen del
 * validador y ya están escritos en castellano para la dueña.
 */
export function error(mensaje, { status = 400, detalles } = {}) {
  const cuerpo = { error: mensaje };
  if (detalles?.length) cuerpo.detalles = detalles;
  return new Response(JSON.stringify(cuerpo), { status, headers: BASE });
}

/**
 * Lee el body como JSON sin tirar.
 *
 * Un body roto o vacío tiene que dar 400 con un mensaje, no un 500 con
 * el stack de un SyntaxError.
 */
export async function leerJson(request) {
  try {
    const d = await request.json();
    if (!d || typeof d !== 'object' || Array.isArray(d)) {
      return { ok: false, error: 'El cuerpo del pedido tiene que ser un objeto JSON.' };
    }
    return { ok: true, datos: d };
  } catch {
    return { ok: false, error: 'El cuerpo del pedido no es JSON válido.' };
  }
}
