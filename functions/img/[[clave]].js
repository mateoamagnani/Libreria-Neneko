// ============================================================
// /img/:clave — entrega las fotos guardadas en R2
//
// Público: las fotos se ven en el sitio, no hay nada que esconder.
//
// Van por acá y no por una URL pública de R2 a propósito. Así las
// imágenes viven en el mismo dominio que el sitio, lo que evita CORS,
// hace que las rutas guardadas sobrevivan una mudanza de dominio, y
// deja que Cloudflare las cachee en el borde como a cualquier otro
// archivo del sitio.
// ============================================================

export async function onRequestGet({ params, env, request }) {
  // [[clave]] captura el resto de la ruta: puede venir como array.
  const clave = Array.isArray(params.clave) ? params.clave.join('/') : params.clave;

  // Nada de subir de directorio ni de claves raras. R2 no tiene
  // directorios de verdad, pero una clave con ".." o con barra inicial
  // ensucia el cache y puede confundir a lo que esté adelante.
  if (!clave || clave.includes('..') || clave.startsWith('/')) {
    return new Response('No encontrado', { status: 404 });
  }

  const objeto = await env.IMAGENES.get(clave);
  if (!objeto) return new Response('No encontrado', { status: 404 });

  const headers = new Headers();
  objeto.writeHttpMetadata(headers);
  headers.set('etag', objeto.httpEtag);
  // Las claves son únicas por subida, así que el contenido de una clave
  // nunca cambia y se puede cachear para siempre.
  headers.set('cache-control', 'public, max-age=31536000, immutable');

  // Si el navegador ya la tiene, no se vuelve a mandar el cuerpo.
  if (request.headers.get('if-none-match') === objeto.httpEtag) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(objeto.body, { headers });
}
