// ============================================================
// /img/:clave — entrega las fotos de los productos
//
// Público: las fotos se ven en el sitio, no hay nada que esconder.
//
// Salen de D1. Van por acá y no por una URL de almacenamiento externo
// a propósito: así las imágenes viven en el mismo dominio que el sitio,
// lo que evita CORS y hace que las rutas guardadas en la base
// sobrevivan un cambio de dominio.
//
// Cada clave es única por subida, así que el contenido de una clave no
// cambia nunca. Eso permite cachear para siempre, y es lo que mantiene
// barato este camino: el plan gratis da 100.000 pedidos por día a las
// Functions, y una foto cacheada no vuelve a pedirse.
// ============================================================

const UN_ANIO = 'public, max-age=31536000, immutable';

export async function onRequestGet({ params, env, request }) {
  // [[clave]] captura el resto de la ruta: puede venir como array.
  const clave = Array.isArray(params.clave) ? params.clave.join('/') : params.clave;

  // Nada de subir de directorio ni de claves raras. No cambia el
  // resultado de la consulta (va parametrizada), pero evita ensuciar
  // el cache con variantes de la misma clave.
  if (!clave || clave.includes('..') || clave.startsWith('/')) {
    return new Response('No encontrado', { status: 404 });
  }

  // El navegador ya la tiene: nos ahorramos leer la base y mandar el
  // cuerpo. La clave identifica el contenido, así que sirve de etag.
  const etag = `"${clave}"`;
  if (request.headers.get('if-none-match') === etag) {
    return new Response(null, {
      status: 304,
      headers: { etag, 'cache-control': UN_ANIO },
    });
  }

  const fila = await env.DB
    .prepare('select tipo, bytes from imagenes where clave = ?')
    .bind(clave)
    .first();

  if (!fila) return new Response('No encontrado', { status: 404 });

  return new Response(fila.bytes, {
    headers: {
      'content-type': fila.tipo,
      'cache-control': UN_ANIO,
      etag,
    },
  });
}
