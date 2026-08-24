# Concepto de la landing — Librería Neneko

Documento de referencia del sitio que vive en `src/index.html` (versión original subida por
el dueño del proyecto, conservada sin cambios funcionales al ordenar el repo).

---

## Datos del negocio (NAP — usar idénticos en toda la web, Google Maps y directorios)

| Campo | Valor |
|---|---|
| **Nombre** | Librería Neneko |
| **Dirección** | Peña 3102, CABA (a metros de Santa Fe) |
| **Teléfono** | 011 6169-1209 |
| **WhatsApp** | `https://wa.me/5491161691209` |
| **Horario** | Lunes a sábado, 9:00 a 20:30 |
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

1. **Navbar sticky** — logo + CTA de WhatsApp siempre visible.
2. **Hero** — headline, subtítulo, doble CTA (WhatsApp primario / ver productos secundario),
   badges de horario, dirección y retiro en local, y una **demo animada de un chat de
   WhatsApp** dentro de una maqueta de iPhone.
3. **Mercadito** (`#mercadito`) — grilla de productos agrupada por categoría.
4. **Confianza** (`#confianza`) — reseñas presentadas como tickets de papel.
5. **Ubicación** (`#ubicacion`) — datos de contacto + mapa embebido de Google Maps.
6. **Footer** — navegación, contacto y horario.

---

## Sistema de diseño

Definido como custom properties en `:root`:

| Token | Valor | Uso |
|---|---|---|
| `--paper` | `#F7F2E7` | Fondo principal |
| `--paper-alt` | `#EFE5D0` | Fondo del mercadito |
| `--ink` | `#2A251D` | Texto |
| `--ink-soft` | `#6B6152` | Texto secundario |
| `--mustard` | `#C79448` | CTA primario |
| `--navy` / `--navy-deep` | `#2C3B54` / `#1C2536` | Secciones oscuras, footer |
| `--stamp` | `#BF5A3E` | Acentos, flags de placeholder |

**Tipografías:** Bricolage Grotesque (títulos), IBM Plex Sans (texto), IBM Plex Mono
(detalles tipo "docket"). Se cargan desde Google Fonts.

**Estética:** papelería de barrio — grillas de cuadrícula, subrayados ondulados, tickets con
borde dentado y cinta adhesiva, sellos.

---

## Catálogo dinámico desde Google Sheets

El bloque `#mercaditoDynamic` se puede alimentar desde una hoja publicada como CSV. En
`src/index.html` está la constante:

```js
const SHEET_CSV_URL = "PEGAR_ACA_LA_URL_CSV_DE_GOOGLE_SHEETS";
```

**Cómo activarlo:**

1. Armar una hoja de Google Sheets con 3 columnas en este orden: `Categoria | Producto | Precio`.
2. Archivo → Compartir → Publicar en la Web → elegir la hoja puntual → formato
   *Valores separados por comas (.csv)* → Publicar.
3. Pegar esa URL reemplazando el texto de ejemplo.
4. Evitar comas dentro de los nombres de producto (el parser es simple).

Si la URL queda sin configurar, la página sigue mostrando los productos de ejemplo
cargados a mano, sin romperse (degradación elegante intencional).

---

## Estado actual y pendientes conocidos

- [ ] `SHEET_CSV_URL` sin configurar → el catálogo muestra datos de ejemplo.
- [ ] Precios del HTML hardcodeados y probablemente desactualizados.
- [ ] Tarjetas "Agregar producto" (`.is-placeholder`) visibles en producción — hay que
      completarlas o quitarlas antes de publicar.
- [ ] Sin fotos reales del local ni de los productos (los thumbs son SVG genéricos). El
      material de marketing indica que las fotos reales convierten mejor en negocios físicos.
- [ ] Falta `<meta property="og:*">` para que el link se vea bien al compartirlo por WhatsApp.
- [ ] Falta datos estructurados JSON-LD (`LocalBusiness`) para SEO local.
- [ ] El demo de chat corre en loop infinito y no respeta `prefers-reduced-motion` para
      detenerse (solo acelera las animaciones CSS).
- [ ] Sin medición: no hay analytics ni tracking de clicks al CTA de WhatsApp.

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
