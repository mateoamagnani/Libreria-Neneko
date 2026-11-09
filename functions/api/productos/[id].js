// ============================================================
// /api/productos/:id
//
//   PUT    → edición parcial. Exige Access.
//   DELETE → baja. Exige Access.
//
// No hay GET de un producto suelto: el panel ya trae la lista entera
// con ?todo=1 y no necesita volver a pedir de a uno.
// ============================================================
import { json, error, leerJson } from '../../_lib/http.js';
import { verificarAcceso } from '../../_lib/acceso.js';
import { validarProducto, consultaEdicion, consultaBaja } from '../../_lib/productos.js';

const correr = (env, { sql, binds }) => env.DB.prepare(sql).bind(...binds);

export async function onRequestPut({ request, env, params }) {
  const permiso = await verificarAcceso(request, env);
  if (!permiso.ok) return error(permiso.motivo, { status: 403 });

  const cuerpo = await leerJson(request);
  if (!cuerpo.ok) return error(cuerpo.error);

  // Parcial: el panel manda solo lo que cambió. Sin esto, despublicar
  // un producto le borraría el precio y el detalle.
  const v = validarProducto(cuerpo.datos, { parcial: true });
  if (!v.ok) return error('El producto tiene datos que corregir.', { detalles: v.errores });

  const consulta = consultaEdicion(params.id, v.producto);
  if (!consulta) return error('No vino ningún campo para cambiar.');

  const { meta } = await correr(env, consulta).run();

  // D1 informa cuántas filas tocó. Cero significa que ese id no existe,
  // y eso es un 404: si devolviéramos 200, el panel mostraría "guardado"
  // sobre un producto que alguien borró en otra pestaña.
  if (meta?.changes === 0) return error('Ese producto ya no existe.', { status: 404 });

  return json({ id: params.id, ...v.producto });
}

export async function onRequestDelete({ request, env, params }) {
  const permiso = await verificarAcceso(request, env);
  if (!permiso.ok) return error(permiso.motivo, { status: 403 });

  const { meta } = await correr(env, consultaBaja(params.id)).run();
  if (meta?.changes === 0) return error('Ese producto ya no existe.', { status: 404 });

  return json({ borrado: params.id });
}
