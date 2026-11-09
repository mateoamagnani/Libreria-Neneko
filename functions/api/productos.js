// ============================================================
// /api/productos
//
//   GET  → listado. Público por defecto (solo lo publicado);
//          con ?todo=1 devuelve también lo oculto y exige Access.
//   POST → alta. Exige Access.
//
// La lógica vive en ../_lib/productos.js. Acá solo se traduce entre
// HTTP y esa lógica, y se decide quién puede entrar.
// ============================================================
import { json, error, leerJson } from '../_lib/http.js';
import { verificarAcceso } from '../_lib/acceso.js';
import {
  validarProducto, consultaListado, consultaListadoAdmin, consultaAlta, SECCIONES,
} from '../_lib/productos.js';

const correr = (env, { sql, binds }) => env.DB.prepare(sql).bind(...binds);

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);

  // El panel necesita ver lo despublicado para poder reactivarlo, así
  // que ese listado va detrás de Access: si fuera público, cualquiera
  // vería los borradores con solo agregar ?todo=1.
  if (url.searchParams.get('todo') === '1') {
    const permiso = await verificarAcceso(request, env);
    if (!permiso.ok) return error(permiso.motivo, { status: 403 });

    const { results } = await correr(env, consultaListadoAdmin()).all();
    return json({ productos: results });
  }

  const seccion = url.searchParams.get('seccion') || 'novedades';
  if (!SECCIONES.includes(seccion)) {
    return error(`La sección "${seccion}" no existe.`);
  }

  const { results } = await correr(env, consultaListado(seccion)).all();

  // Este es el camino caliente: lo pide cada visitante en cada carga.
  // Un minuto de cache le saca a D1 la mayoría de los pedidos sin que
  // un cambio del panel tarde en verse.
  return json({ productos: results }, { cache: 'public, max-age=60' });
}

export async function onRequestPost({ request, env }) {
  const permiso = await verificarAcceso(request, env);
  if (!permiso.ok) return error(permiso.motivo, { status: 403 });

  const cuerpo = await leerJson(request);
  if (!cuerpo.ok) return error(cuerpo.error);

  const v = validarProducto(cuerpo.datos);
  if (!v.ok) return error('El producto tiene datos que corregir.', { detalles: v.errores });

  const id = crypto.randomUUID();
  await correr(env, consultaAlta(id, v.producto)).run();

  return json({ id, ...v.producto }, { status: 201 });
}
