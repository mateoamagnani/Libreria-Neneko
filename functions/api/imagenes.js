// ============================================================
// /api/imagenes — subida de fotos de productos
//
// POST multipart con un campo "archivo". Exige Access.
// Devuelve { url: "/img/xxxx.jpg" }, que es lo que se guarda en la
// columna imagen del producto.
//
// El límite de 500 KB y el formato preferido ya estaban escritos en
// CLAUDE.md, pero hasta acá eran una recomendación que nadie hacía
// cumplir: la dueña subía al Sheet lo que quisiera. Ahora el pedido se
// rechaza con un mensaje que explica qué hacer.
// ============================================================
import { json, error } from '../_lib/http.js';
import { verificarAcceso } from '../_lib/acceso.js';

// CLAUDE.md: "Tamaño máximo por imagen: 500 KB."
const MAX_BYTES = 500 * 1024;

// JPEG es el preferido para fotos; PNG anda pero pesa más; WebP es
// ideal y hoy lo soportan todos los navegadores que nos importan.
const TIPOS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const kb = (n) => Math.round(n / 1024);

export async function onRequestPost({ request, env }) {
  const permiso = await verificarAcceso(request, env);
  if (!permiso.ok) return error(permiso.motivo, { status: 403 });

  let form;
  try {
    form = await request.formData();
  } catch {
    return error('El pedido no trae un formulario válido.');
  }

  const archivo = form.get('archivo');
  if (!archivo || typeof archivo === 'string') {
    return error('Falta el archivo de la imagen.');
  }

  const tipo = (archivo.type || '').toLowerCase();
  const ext = TIPOS[tipo];
  if (!ext) {
    return error(
      `Ese formato no se puede usar (${tipo || 'desconocido'}). ` +
      'La foto tiene que ser JPG, PNG o WebP.',
    );
  }

  if (archivo.size > MAX_BYTES) {
    return error(
      `La foto pesa ${kb(archivo.size)} KB y el máximo es ${kb(MAX_BYTES)} KB. ` +
      'Achicala o bajale la calidad antes de subirla: una foto muy pesada ' +
      'hace que la página tarde en cargar en el celular.',
    );
  }

  if (archivo.size === 0) {
    return error('El archivo está vacío.');
  }

  const clave = `${crypto.randomUUID()}.${ext}`;

  await env.IMAGENES.put(clave, archivo.stream(), {
    httpMetadata: {
      contentType: tipo,
      // Las fotos nunca se pisan: cada subida genera una clave nueva.
      // Por eso se pueden cachear para siempre sin miedo a servir una
      // versión vieja.
      cacheControl: 'public, max-age=31536000, immutable',
    },
  });

  // Relativa, no absoluta: el dominio va a cambiar y una URL absoluta
  // guardada hoy quedaría rota en cada mudanza.
  return json({ url: `/img/${clave}` }, { status: 201 });
}
