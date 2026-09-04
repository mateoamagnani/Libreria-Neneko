# Concepto de la landing — Librería Neneko

Documento de referencia del sitio que vive en `src/index.html`.

---

## Datos del negocio (NAP — usar idénticos en toda la web, Google Maps y directorios)

| Campo | Valor |
|---|---|
| **Nombre** | Librería Neneko |
| **Dirección** | Peña 3102, CABA (esquina Billinghurst, a metros de Coronel Díaz) |
| **Teléfono** | +54 9 11 6169-1209 (solo WhatsApp, no se atienden llamadas) |
| **WhatsApp** | `https://wa.me/5491161691209` |
| **Horario** | Lun a vie 11:30–20:30 · Sáb 11:30–15:30 · Dom cerrado |
| **Reseñas** | 4,4 ★ · 97 reseñas en Google |

> La consistencia NAP es un requisito de SEO local (ver
> [`fundamentos-marketing-web.md`](./fundamentos-marketing-web.md) §7). Cualquier cambio de
> horario o teléfono debe replicarse en el sitio **y** en el Google Business Profile.

---

## Rubro y propuesta de valor

Fotocopias, impresiones, anillados y útiles escolares y de oficina. La conversión objetivo
es **un mensaje de WhatsApp**, no una venta online: el cliente pide y retira en el local.

---

## Estructura de la página

1. **Navbar sticky** — logo + CTA de WhatsApp siempre visible. En pantallas chicas el CTA
   queda como icono solo, para que el nombre del negocio no parta en dos líneas.
2. **Hero** — dirección, headline, propuesta de valor, CTA primario de WhatsApp, CTA
   secundario al catálogo, y una fila de confianza con el rating de Google y el estado
   **"abierto ahora / cerrado"** calculado en vivo. A la derecha, una maqueta de iPhone con
   una demo del chat.
   En mobile el orden es headline → propuesta → CTA → confianza → maqueta: lo primero que
   se lee tiene que ser qué es el negocio, no una captura de chat.
3. **Franja de servicios** — las cuatro cosas que hace el local, en una línea.
4. **Catálogo** (`#productos`) — grilla agrupada por categoría, alimentada desde Google
   Sheets con respaldo en el HTML.
5. **Reseñas** (`#resenas`) — banda oscura con el puntaje de Google y tres reseñas.
6. **Ubicación** (`#ubicacion`) — dirección, teléfono, tabla de horarios y mapa embebido.
7. **Footer** — navegación, contacto y horario.
8. **Barra fija de WhatsApp** — solo en mobile, aparece al pasar el hero.

---

## Sistema de diseño

Definido como custom properties en `:root`, con el par completo en
`@media (prefers-color-scheme: dark)`. **Ningún componente usa un color literal**: es lo que
evita que un borde quede con el valor del modo claro y desaparezca de noche.

| Grupo | Tokens | Uso |
|---|---|---|
| Superficies | `--bg`, `--surface`, `--surface-2`, `--surface-inv` | Fondo, tarjetas, bloques hundidos, bandas oscuras |
| Bordes | `--border`, `--border-strong` | Divisiones finas y bordes de énfasis |
| Texto | `--text`, `--text-2`, `--text-3` | Los tres a contraste AA sobre `--bg` en ambos modos |
| Marca | `--brand`, `--brand-bright` | Acentos, rating, etiqueta de "hoy" |

**La paleta sale del logo**, muestreado del archivo: navy `#243C54` (el texto y los
contornos) y ámbar `#D8843C` (el gato y el libro), sobre el crema del círculo.
El navy va tal cual en `--surface-inv` y en el botón primario. El ámbar no puede ir tal
cual en texto: sobre el crema da 2,6:1. Por eso `--brand` es ese mismo ámbar oscurecido
(mismo tono y saturación) hasta llegar a AA, y `--brand-bright` es una versión aclarada
que solo se usa sobre las bandas oscuras. Los tests verifican los dos.
| Estado | `--ok`, `--closed` | Abierto / cerrado |
| Botón | `--btn-bg`, `--btn-bg-hover`, `--btn-text` | CTA primario |
| Espaciado | `--s1`…`--s10` | Escala base 4 |

**Tipografías:** Bricolage Grotesque (títulos), IBM Plex Sans (texto), IBM Plex Mono
(datos: horarios, precios, etiquetas). Se cargan desde Google Fonts.

**Estética:** editorial y contenida. Papel cálido, tipografía grande con jerarquía real,
espacio generoso, y superficies planas separadas por líneas. Nada de texturas, tickets
dentados, bordes punteados ni tarjetas rotadas: eran ruido y hacían ver el sitio amateur.

---

## Horarios: una sola fuente de verdad

La constante `HORARIOS` del `<script>` es de donde salen las tres cosas que antes se
escribían por separado y se desincronizaban:

- la tabla de la sección Ubicación (con la fila de hoy marcada),
- el cartel de "abierto ahora / cerrado · abre a las X",
- la línea de horario del footer.

Los bloques se guardan en minutos desde la medianoche, y la hora se lee en la zona horaria
de Buenos Aires — no la del visitante. El `<tbody>` que está escrito en el HTML es solo el
respaldo para cuando el JS no corre, y los tests verifican que coincida con `HORARIOS`.

Fuera del JS quedan dos lugares que hay que actualizar a mano si cambia el horario: el
`openingHoursSpecification` del JSON-LD y el Google Business Profile.

---

## Catálogo dinámico desde Google Sheets

El bloque `#mercaditoDynamic` se alimenta de una hoja publicada como CSV. Paso a paso en
[`catalogo-google-sheets.md`](./catalogo-google-sheets.md).

Columnas: `Categoria | Producto | Precio | Detalle` (la cuarta es opcional; la fila de
encabezado se detecta sola). El parser soporta comas y saltos de línea dentro de un campo
si va entre comillas. Todo lo que viene de la hoja se escapa antes de entrar al DOM.

Si el Sheet no responde o tarda más de 8 segundos, quedan las tarjetas de respaldo del
HTML. Esas tarjetas dicen "Consultar" en vez de un precio: un número desactualizado que
después nadie respeta en el mostrador es peor que no mostrarlo.

---

## Estado actual y pendientes conocidos

Hecho:

- [x] Sistema de tokens con modo oscuro real, verificado por tests de contraste.
- [x] Horarios con fuente única, estado "abierto ahora" y fila de hoy marcada.
- [x] Barra fija de WhatsApp en mobile.
- [x] Open Graph y Twitter Card para la vista previa al compartir por WhatsApp.
- [x] JSON-LD `StationeryStore` con dirección, horario partido, teléfono y rating.
- [x] `canonical`, `robots.txt` y `sitemap.xml`.
- [x] Accesibilidad: skip link, `<main>`, tabla de horarios con `<th scope>`, SVG
      decorativos ocultos a lectores de pantalla, foco visible, tap targets de 44 px,
      contraste AA en los dos modos, y el estado del local dicho con texto además de color.
- [x] `prefers-reduced-motion` respetado en la demo del chat y en las apariciones.

Pendiente:

- [ ] Sin fotos reales del local ni de los productos (los thumbs son SVG genéricos). El
      material de marketing indica que las fotos reales convierten mejor en negocios físicos.
- [ ] Falta `geo` (latitud y longitud) en el JSON-LD.
- [ ] Las URLs del `canonical`, los `og:*` y el JSON-LD apuntan a GitHub Pages. Si se compra
      un dominio propio hay que actualizarlas — ver [`deploy.md`](./deploy.md).
- [ ] Sin medición: no hay analytics ni tracking de clicks al CTA de WhatsApp.
      Ver [`google-setup-guia-paso-a-paso.md`](./google-setup-guia-paso-a-paso.md).
- [ ] `index.html` en la raíz del repo es una copia de `src/index.html`. El workflow publica
      `src/`, así que la copia no debería hacer falta: hay que confirmar desde qué fuente
      sirve GitHub Pages y borrar la que sobra, antes de que se desincronicen.

---

## Criterios a respetar al modificar el sitio

Derivados de [`fundamentos-marketing-web.md`](./fundamentos-marketing-web.md):

- El CTA de WhatsApp tiene que estar **a un tap de distancia desde cualquier punto** de la
  página.
- Mobile-first: la mayoría del tráfico llega desde el celular.
- Un solo CTA principal por sección.
- Área de tap mínima de 44×44 px.
- Reseñas cerca del CTA principal, no escondidas al final.
- Nada de carruseles en el hero ni popups de entrada.
