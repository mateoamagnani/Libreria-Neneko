-- ============================================================
-- Librería Neneko — esquema del catálogo
--
-- Se corre una sola vez, desde el SQL Editor de Supabase.
-- Es idempotente: volver a correrlo no rompe nada ni duplica datos.
--
-- Reemplaza a la planilla de Google Sheets como fuente de verdad de
-- los productos. El sitio público lee de acá; el panel de la dueña
-- (src/admin.html) escribe acá.
-- ============================================================


-- ============================================================
-- TABLA productos
--
-- Las columnas calcan el formato de 7 columnas que tenía la planilla
-- (Categoria | Subcategoria | Producto | Precio | Detalle | Imagen |
-- Keywords), así la migración es fiel y sin pérdida. Lo que se agrega
-- es lo que la planilla no podía dar: orden manual, despublicar sin
-- borrar, y saber cuándo se tocó cada cosa.
-- ============================================================
create table if not exists public.productos (
  id             uuid primary key default gen_random_uuid(),

  -- Las dos solapas que tenía el Sheet. El sitio arma el mercadito con
  -- 'novedades' y la carta de servicios con 'menu'.
  seccion        text not null default 'novedades',

  categoria      text not null,
  subcategoria   text,
  nombre         text not null,

  -- Texto, no número, a propósito. Los datos reales son "$ 100 c/u",
  -- "$ 1.000" y algunos vacíos: pasarlos a numeric obliga a inventar un
  -- campo "unidad" y a decidir qué significa un precio ausente. Como
  -- texto migra sin pérdida y la dueña escribe lo que quiere mostrar.
  -- Si algún día hace falta ordenar o validar por precio, se agrega una
  -- columna numérica al lado en vez de romper ésta.
  precio         text,

  detalle        text,

  -- URL completa. Hoy apunta a Supabase Storage; durante la migración
  -- pueden quedar URLs viejas de Drive, y el sitio las banca igual
  -- porque solo mira que empiece con "http".
  imagen         text,

  keywords       text,

  -- Orden manual dentro de cada categoría. Con la planilla el orden era
  -- el de las filas y moverlo era cortar y pegar.
  orden          integer not null default 0,

  -- Despublicar sin borrar. En la planilla había que sacar la fila y
  -- guardarla en otro lado para no perderla.
  activo         boolean not null default true,

  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  -- Que la sección sea una de las dos conocidas: si el panel manda
  -- cualquier otra cosa, el sitio no la muestra en ningún lado y el
  -- producto desaparece en silencio. Mejor que falle acá.
  constraint productos_seccion_valida
    check (seccion in ('novedades', 'menu')),

  -- Un nombre vacío deja una tarjeta fantasma en la grilla.
  constraint productos_nombre_no_vacio
    check (length(trim(nombre)) > 0),

  constraint productos_categoria_no_vacia
    check (length(trim(categoria)) > 0)
);


-- El sitio siempre pide lo mismo: los activos de una sección, agrupados
-- por categoría y en orden. Este índice cubre esa consulta entera.
create index if not exists productos_listado_idx
  on public.productos (seccion, categoria, orden)
  where activo = true;


-- ============================================================
-- actualizado_en se mantiene solo
--
-- Si dependiera de que el panel lo mande, cualquier edición hecha desde
-- otro lado (el SQL Editor, un script de migración) dejaría la fecha
-- mintiendo.
-- ============================================================
create or replace function public.tocar_actualizado_en()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

drop trigger if exists productos_actualizado_en on public.productos;
create trigger productos_actualizado_en
  before update on public.productos
  for each row execute function public.tocar_actualizado_en();


-- ============================================================
-- RLS — la parte que de verdad protege
--
-- La clave anon viaja en el HTML del sitio y es pública a propósito:
-- cualquiera puede leerla con ver-código-fuente. Lo único que impide
-- que un desconocido borre el catálogo son estas políticas, así que
-- RLS prendido no es opcional.
--
-- Sin esto, la anon key sería una llave maestra.
-- ============================================================
alter table public.productos enable row level security;

-- Los visitantes ven solo lo publicado. Un producto en borrador no
-- tiene que poder leerse ni sabiendo la URL de la API.
drop policy if exists productos_lectura_publica on public.productos;
create policy productos_lectura_publica
  on public.productos
  for select
  to anon
  using (activo = true);

-- La dueña, ya logueada, ve todo: también lo despublicado, que si no
-- no podría volver a activarlo desde el panel.
drop policy if exists productos_lectura_duena on public.productos;
create policy productos_lectura_duena
  on public.productos
  for select
  to authenticated
  using (true);

drop policy if exists productos_alta on public.productos;
create policy productos_alta
  on public.productos
  for insert
  to authenticated
  with check (true);

drop policy if exists productos_edicion on public.productos;
create policy productos_edicion
  on public.productos
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists productos_baja on public.productos;
create policy productos_baja
  on public.productos
  for delete
  to authenticated
  using (true);


-- ============================================================
-- STORAGE — las fotos de los productos
--
-- Bucket público de lectura: las imágenes se muestran en el sitio, así
-- que no hay nada que esconder. Subir, pisar y borrar, solo logueado.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('productos', 'productos', true)
on conflict (id) do nothing;

drop policy if exists productos_img_lectura on storage.objects;
create policy productos_img_lectura
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'productos');

drop policy if exists productos_img_subida on storage.objects;
create policy productos_img_subida
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'productos');

drop policy if exists productos_img_reemplazo on storage.objects;
create policy productos_img_reemplazo
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'productos');

drop policy if exists productos_img_borrado on storage.objects;
create policy productos_img_borrado
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'productos');


-- ============================================================
-- DESPUÉS DE CORRER ESTO, FALTA UN PASO QUE NO ES SQL
--
-- En el panel de Supabase: Authentication → Sign In / Providers → Email,
-- y APAGAR "Allow new users to sign up".
--
-- Si queda prendido, cualquiera puede registrarse solo y, ya como
-- usuario autenticado, las políticas de arriba lo dejan editar y borrar
-- todo el catálogo. Es el agujero clásico de Supabase: las políticas
-- están bien escritas y aun así entra cualquiera, porque el problema no
-- está en el SQL.
--
-- La cuenta de la dueña se crea a mano en Authentication → Users →
-- Add user, una sola vez.
-- ============================================================
