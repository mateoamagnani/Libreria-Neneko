// ============================================================
// Librería Neneko — núcleo del catálogo
//
// Validación y consultas, sin nada de Cloudflare adentro. Las rutas
// (functions/api/…) traen el request y el binding de D1; acá vive la
// lógica, que por eso se puede probar con SQLite pelado y sin red.
//
// La regla: este archivo no sabe qué es un Request ni un Response.
// Si alguna vez necesita saberlo, la lógica se escapó al lugar
// equivocado.
// ============================================================

export const SECCIONES = ['novedades', 'menu'];

// Topes de largo. No son caprichos de prolijidad: el panel es el único
// que escribe, pero si algún día un bug manda un campo enorme, esto lo
// frena antes de que llegue a la base y rompa la grilla del sitio.
const LARGOS = {
  categoria: 80,
  subcategoria: 80,
  nombre: 120,
  precio: 40,
  detalle: 200,
  imagen: 600,
  keywords: 300,
};

const texto = (v) => (v === null || v === undefined ? '' : String(v)).trim();

/**
 * Las dos formas de imagen que el sitio sabe dibujar.
 *
 * El "//" descartado en la ruta relativa no es paranoia de más:
 * "//evil.com/x.jpg" es una URL protocol-relative, así que el navegador
 * la va a buscar a otro dominio aunque parezca una ruta local.
 */
export function esImagenValida(v) {
  if (/^https?:\/\//i.test(v)) return true;
  return v.startsWith('/img/') && !v.startsWith('//');
}

/**
 * Normaliza y valida lo que viene del panel.
 *
 * Devuelve { ok:true, producto } o { ok:false, errores:[...] }. Nunca
 * tira: los errores son datos, porque van de vuelta al panel para
 * mostrárselos a la dueña en castellano.
 */
export function validarProducto(entrada, { parcial = false } = {}) {
  const errores = [];
  const p = {};

  // --- sección ---
  if (!parcial || entrada.seccion !== undefined) {
    const s = texto(entrada.seccion) || 'novedades';
    if (!SECCIONES.includes(s)) {
      errores.push(`La sección "${s}" no existe. Tiene que ser una de: ${SECCIONES.join(', ')}.`);
    } else {
      p.seccion = s;
    }
  }

  // --- obligatorios ---
  for (const campo of ['categoria', 'nombre']) {
    if (parcial && entrada[campo] === undefined) continue;
    const v = texto(entrada[campo]);
    if (!v) {
      errores.push(campo === 'nombre'
        ? 'El producto necesita un nombre.'
        : 'El producto necesita una categoría.');
    } else if (v.length > LARGOS[campo]) {
      errores.push(`${campo === 'nombre' ? 'El nombre' : 'La categoría'} no puede pasar de ${LARGOS[campo]} caracteres.`);
    } else {
      p[campo] = v;
    }
  }

  // --- opcionales de texto ---
  for (const campo of ['subcategoria', 'precio', 'detalle', 'keywords']) {
    if (parcial && entrada[campo] === undefined) continue;
    const v = texto(entrada[campo]);
    if (v.length > LARGOS[campo]) {
      errores.push(`El campo ${campo} no puede pasar de ${LARGOS[campo]} caracteres.`);
    } else {
      p[campo] = v || null;
    }
  }

  // --- imagen ---
  // Se aceptan dos formas, a propósito:
  //
  //   /img/algo.jpg          → subida desde el panel, guardada en R2
  //   https://…/algo.jpg     → URL vieja de Drive, de la época del Sheet
  //
  // Las nuevas van relativas porque el dominio va a cambiar (GitHub
  // Pages → Cloudflare Pages → quizás uno propio) y una URL absoluta
  // guardada hoy quedaría rota en cada mudanza.
  //
  // Cualquier otra cosa se rechaza: el sitio solo dibuja la imagen si
  // reconoce la forma, y si no cae al ícono SVG en silencio. Validar
  // acá convierte ese silencio en un mensaje que la dueña entiende.
  if (!parcial || entrada.imagen !== undefined) {
    const v = texto(entrada.imagen);
    if (!v) {
      p.imagen = null;
    } else if (v.length > LARGOS.imagen) {
      errores.push(`La dirección de la imagen no puede pasar de ${LARGOS.imagen} caracteres.`);
    } else if (!esImagenValida(v)) {
      errores.push('La imagen tiene que ser una foto subida desde el panel, o una dirección que empiece con http:// o https://.');
    } else {
      p.imagen = v;
    }
  }

  // --- orden ---
  if (!parcial || entrada.orden !== undefined) {
    const n = Number(entrada.orden ?? 0);
    if (!Number.isInteger(n)) {
      errores.push('El orden tiene que ser un número entero.');
    } else {
      p.orden = n;
    }
  }

  // --- activo ---
  // Llega como booleano desde el panel y se guarda como 0/1, porque
  // SQLite no tiene boolean.
  if (!parcial || entrada.activo !== undefined) {
    const v = entrada.activo;
    p.activo = (v === false || v === 0 || v === '0' || v === 'false') ? 0 : 1;
  }

  return errores.length ? { ok: false, errores } : { ok: true, producto: p };
}

/**
 * Lo que el sitio público pide: lo publicado de una sección, agrupado
 * por categoría y en orden.
 *
 * Devuelve { sql, binds } en vez de ejecutar, para que las rutas lo
 * corran con D1 y los tests con SQLite sin duplicar la consulta.
 */
export function consultaListado(seccion) {
  return {
    sql: `select categoria, subcategoria, nombre, precio, detalle, imagen, keywords
            from productos
           where activo = 1 and seccion = ?
           order by categoria collate nocase, orden, nombre collate nocase`,
    binds: [seccion],
  };
}

/** Todo, publicado o no: el panel necesita ver lo oculto para reactivarlo. */
export function consultaListadoAdmin() {
  return {
    sql: `select * from productos
           order by seccion, categoria collate nocase, orden, nombre collate nocase`,
    binds: [],
  };
}

export function consultaAlta(id, p) {
  return {
    sql: `insert into productos
            (id, seccion, categoria, subcategoria, nombre, precio, detalle, imagen, keywords, orden, activo)
          values (?,?,?,?,?,?,?,?,?,?,?)`,
    binds: [id, p.seccion ?? 'novedades', p.categoria, p.subcategoria ?? null, p.nombre,
            p.precio ?? null, p.detalle ?? null, p.imagen ?? null, p.keywords ?? null,
            p.orden ?? 0, p.activo ?? 1],
  };
}

/**
 * Update parcial: arma el SET solo con los campos presentes, así el
 * panel puede mandar {activo:false} sin pisar el resto del producto
 * con nulls.
 */
export function consultaEdicion(id, p) {
  const campos = ['seccion','categoria','subcategoria','nombre','precio',
                  'detalle','imagen','keywords','orden','activo']
    .filter((c) => p[c] !== undefined);

  if (!campos.length) return null;

  return {
    sql: `update productos set ${campos.map((c) => `${c} = ?`).join(', ')} where id = ?`,
    binds: [...campos.map((c) => p[c]), id],
  };
}

export function consultaBaja(id) {
  return { sql: 'delete from productos where id = ?', binds: [id] };
}

/**
 * Agrupa las filas por categoría, que es como las dibuja el sitio.
 * Mantiene el orden en que vinieron: la consulta ya ordenó.
 */
export function agruparPorCategoria(filas) {
  const grupos = new Map();
  for (const f of filas) {
    if (!grupos.has(f.categoria)) grupos.set(f.categoria, []);
    grupos.get(f.categoria).push(f);
  }
  return grupos;
}
