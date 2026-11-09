-- ============================================================
-- Librería Neneko — esquema del catálogo (Cloudflare D1)
--
-- Se aplica con:
--   npx wrangler d1 execute neneko --remote --file=db/schema.sql
--
-- Es idempotente: volver a correrlo no rompe nada ni duplica datos.
--
-- Reemplaza a la planilla de Google Sheets como fuente de verdad de los
-- productos. El sitio público los lee a través del Worker; el panel de
-- la dueña los escribe por el mismo camino.
--
-- D1 es SQLite, no Postgres. Eso cambia tres cosas respecto de lo que
-- uno escribiría en un Supabase:
--
--   · No hay tipo uuid ni gen_random_uuid(). El id lo genera el Worker
--     con crypto.randomUUID() y acá es TEXT.
--   · No hay timestamptz. Las fechas van como TEXT en ISO-8601 UTC, que
--     ordena bien alfabéticamente y se parsea con new Date() sin ayuda.
--   · No hay RLS, y no hace falta: la base no la toca nunca el
--     navegador. El único que la consulta es el Worker, y la ruta de
--     administración la protege Cloudflare Access antes de llegar al
--     código. No hay clave pública que filtrar.
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
create table if not exists productos (
  id             text primary key,

  -- Las dos solapas que tenía el Sheet. El sitio arma el mercadito con
  -- 'novedades' y la carta de servicios con 'menu'.
  seccion        text not null default 'novedades',

  categoria      text not null,
  subcategoria   text,
  nombre         text not null,

  -- Texto, no número, a propósito. Los datos reales son "$ 100 c/u",
  -- "$ 1.000" y algunos vacíos: pasarlos a número obliga a inventar un
  -- campo "unidad" y a decidir qué significa un precio ausente. Como
  -- texto migra sin pérdida y la dueña escribe lo que quiere mostrar.
  -- Si algún día hace falta ordenar o validar por precio, se agrega una
  -- columna numérica al lado en vez de romper ésta.
  precio         text,

  detalle        text,

  -- URL completa de la imagen en R2. Durante la migración pueden quedar
  -- URLs viejas de Drive y el sitio las banca igual, porque solo mira
  -- que empiece con "http".
  imagen         text,

  keywords       text,

  -- Orden manual dentro de cada categoría. Con la planilla el orden era
  -- el de las filas y moverlo era cortar y pegar.
  orden          integer not null default 0,

  -- Despublicar sin borrar. En la planilla había que sacar la fila y
  -- guardarla en otro lado para no perderla.
  -- SQLite no tiene boolean: 0 = oculto, 1 = publicado.
  activo         integer not null default 1,

  creado_en      text not null default (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  actualizado_en text not null default (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),

  -- Que la sección sea una de las dos conocidas: si el panel manda
  -- cualquier otra cosa, el producto no se muestra en ningún lado y
  -- desaparece en silencio. Mejor que falle acá.
  constraint productos_seccion_valida
    check (seccion in ('novedades', 'menu')),

  constraint productos_activo_booleano
    check (activo in (0, 1)),

  -- Un nombre vacío deja una tarjeta fantasma en la grilla.
  constraint productos_nombre_no_vacio
    check (length(trim(nombre)) > 0),

  constraint productos_categoria_no_vacia
    check (length(trim(categoria)) > 0)
);


-- El sitio siempre pide lo mismo: los publicados de una sección,
-- agrupados por categoría y en orden. Este índice cubre esa consulta.
create index if not exists productos_listado_idx
  on productos (seccion, categoria, orden)
  where activo = 1;


-- ============================================================
-- TABLA imagenes — las fotos de los productos
--
-- Las fotos viven acá y no en R2 por una razón de costo, no técnica:
-- R2 exige pasar por un checkout y dejar datos de pago para activarse,
-- aunque después no cobre. D1 no pide nada de eso, y el requisito del
-- proyecto es que no quede ningún medio de pago cargado.
--
-- Entran holgadas: D1 admite hasta 2 MB por fila y el panel rechaza
-- cualquier foto de más de 500 KB. En los 500 MB que da el plan gratis
-- por base entran más de mil fotos, contra un catálogo que tiene
-- decenas de productos.
--
-- Tabla aparte y no una columna en productos: un "select *" del
-- catálogo se traería todas las fotos en cada carga de la página.
-- ============================================================
create table if not exists imagenes (
  clave      text primary key,
  tipo       text not null,
  bytes      blob not null,
  creado_en  text not null default (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),

  constraint imagenes_tipo_conocido
    check (tipo in ('image/jpeg', 'image/png', 'image/webp'))
);



-- ============================================================
-- actualizado_en se mantiene solo
--
-- Si dependiera de que el panel lo mande, cualquier edición hecha desde
-- otro lado (wrangler, un script de migración) dejaría la fecha
-- mintiendo.
--
-- El when evita el bucle infinito: sin él, el update del trigger
-- vuelve a dispararlo.
-- ============================================================
drop trigger if exists productos_actualizado_en;
create trigger productos_actualizado_en
  after update on productos
  for each row
  when old.actualizado_en = new.actualizado_en
begin
  update productos
     set actualizado_en = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
   where id = new.id;
end;
