# Guía del proyecto — Librería Neneko

## Qué es esto

Sitio web y (a futuro) asistente de WhatsApp para una librería de barrio en Peña 3102, CABA.
La única conversión que importa es **que el visitante escriba por WhatsApp**. No hay carrito,
no hay checkout, no hay cuentas de usuario.

## Idioma

Todo el contenido de cara al usuario va en **español rioplatense** (voseo: "pedí", "escribinos",
"consultá"). La documentación del repo también. Los nombres de archivos, variables y ramas van
en inglés o español sin acentos, indistinto, pero consistentes con lo que ya existe.

## Stack

`src/index.html` es un **único archivo HTML autocontenido**: CSS en un `<style>`, JS en un
`<script>`, iconos como SVG inline. No hay build step, no hay `node_modules`, no hay framework.

**Esto es deliberado.** Antes de introducir un bundler, un framework o una dependencia,
justificá por qué el archivo único ya no alcanza. Un sitio de una página para una librería de
barrio no necesita una toolchain.

Únicas dependencias externas: Google Fonts (Bricolage Grotesque, IBM Plex Sans/Mono) y el
iframe de Google Maps.

Lo que se publica es la carpeta `src/` entera, así que ahí también viven los archivos
sueltos: `robots.txt`, `sitemap.xml` y `logo.png`. Toda imagen que se agregue va acá y se
referencia con ruta relativa (`src="logo.png"`), nunca como data URI: engordan el HTML y
no se cachean aparte.

**Cualquier `<img>` tiene que degradar bien si el archivo no está.** Los del logo llevan
`onerror="this.remove()"`: si falta el archivo desaparecen en vez de dejar un icono roto.

El `package.json` existe solo para dar dos comandos (`npm test`, `npm run dev`); no tiene
dependencias y no debería tenerlas.

### Imágenes de productos — performance

Las imágenes de los productos vienen de Google Sheets (columna 6 en el formato de 7 columnas).
Para mantener la página rápida:

- **Tamaño máximo por imagen: 500 KB.** Las imágenes más grandes ralentizan la carga,
  especialmente en móvil con conexión 3G/4G. Si es necesario subir una imagen más grande,
  reducir resolución o comprimir en un editor antes de uploadear a Google Sheets.
- **Formato preferido: JPEG.** PNG funciona pero es más pesado para fotos; WebP es ideal pero
  no todos los navegadores lo soportan todavía.
- **Resolución mínima: 200×200 px.** Menos que eso se pixela; 400×400 es suficiente para casi
  todos los casos. No usar imágenes de 3000×3000 px: se reducen a 200×200 en la tarjeta y el
  peso extra es al pedo.
- **Lazy loading:** Ya está configurado automáticamente (`loading="lazy"` y `IntersectionObserver`).
  Cada tarjeta se carga solo cuando entra en pantalla.
- **Aspect ratio:** Las tarjetas son cuadradas (1:1) por diseño. Si la imagen es rectangular,
  se recorta con `object-fit:cover` — usar imágenes aproximadamente cuadradas para evitar
  sorpresas.

## Tests

```bash
npm test
```

Corren con el runner de Node, sin dependencias. `test/mercadito.test.mjs` extrae el
`<script>` de `index.html` y lo evalúa en un `vm` con un DOM mínimo;
`test/horarios.test.mjs` hace lo mismo congelando el reloj, y además parsea el CSS para
verificar la paleta; `test/n8n-asistente.test.mjs` hace lo mismo con los nodos Code del
workflow de n8n.

`horarios.test.mjs` existe por algo concreto: el bloque de horarios y su visibilidad en
modo oscuro se rompieron varias veces. Afirma dos invariantes que no se pueden romper en
silencio:

- **Todo color definido en `:root` tiene su par en el bloque de modo oscuro**, y los
  bordes llegan al contraste mínimo contra la superficie que dividen. Ese era el bug: un
  borde con el valor del modo claro es invisible de noche.
- **El horario de respaldo escrito en el HTML coincide con el que calcula el script.**

Es decir: **los tests leen el código de producción, no una copia.** Si movés esas funciones
de lugar, los tests se rompen — que es justamente lo que tienen que hacer.

Corrélos antes de pushear. El deploy no publica si fallan.

## Reglas de diseño y contenido

Salen de `docs/fundamentos-marketing-web.md`. Al tocar el sitio, respetá:

- **Mobile-first.** La mayoría del tráfico llega desde el celular.
- **El CTA de WhatsApp a un tap de distancia** desde cualquier punto de la página.
- **Un solo CTA principal por sección.** Nada de tres botones compitiendo.
- **Área de tap mínima 44×44 px.**
- **Reseñas cerca del CTA**, no escondidas al final.
- **Microcopy con beneficio**, no genérico: "Pedir por WhatsApp", no "Enviar".
- **Nada de carruseles en el hero, nada de popups de entrada.** Bajan la conversión.
- **Claridad antes que creatividad** cuando hay que elegir.

### Sistema de color — la regla que no se rompe

Todos los colores salen de tokens declarados en `:root`, con su par en el bloque
`@media (prefers-color-scheme: dark)`. **Ningún componente escribe un color literal.**

No es un capricho de prolijidad: el modo oscuro se rompió tres veces seguidas porque se
parcheaba componente por componente sobre una paleta pensada para el modo claro. Con
tokens, si el par tiene contraste, todo lo que lo usa lo tiene — y los tests lo verifican.

Las únicas excepciones son los colores de marca de terceros dentro de la maqueta de
WhatsApp (`#1F2C34`, `#005C4B`), que son de WhatsApp y no cambian con el tema.

Superficies, de atrás hacia adelante: `--bg` → `--surface` → `--surface-2`. Bordes:
`--border` (divisiones) y `--border-strong` (énfasis). Texto: `--text` / `--text-2` /
`--text-3`, los tres a contraste AA sobre `--bg` en los dos modos. Espaciado en escala
base 4 (`--s1`…`--s10`); nada de números mágicos.

## Datos del negocio — consistencia NAP

Estos valores aparecen en varios lugares del HTML (navbar, hero, badges, sección ubicación,
footer, links de `wa.me` y de Maps). **Si cambia uno, hay que cambiarlos todos** — y también
en el Google Business Profile. Las inconsistencias bajan el posicionamiento local.

- Peña 3102, CABA
- +54 9 11 6169-1209 · `https://wa.me/5491161691209`
  Es un número **solo de WhatsApp**: no se atienden llamadas, así que no va con `tel:`.
- Lunes a viernes 11:30–20:30 · Sábado 11:30–15:30 · Domingo cerrado

El horario **no se escribe a mano** en la página: sale de la constante `HORARIOS` del
`<script>`, y de ahí se arman la tabla de la sección Ubicación, el cartel de "abierto
ahora" y la línea del footer. Si cambia el horario del local hay que tocar tres lugares y
ninguno más: `HORARIOS`, el `openingHoursSpecification` del JSON-LD (vive en el `<head>`,
fuera del JS) y el Google Business Profile. El `<tbody>` de respaldo del HTML se valida
solo contra `HORARIOS` desde los tests.

## Al trabajar el bot de WhatsApp

El workflow está en `n8n/asistente-whatsapp.json` y la puesta en marcha en `n8n/README.md`.
Leé `docs/nucleo-whatsapp-n8n.md` antes de tocar nada. Los cuatro errores que ese documento
existe para evitar:

1. Token de usuario personal (expira a los 60 días) en vez de System User.
2. Buscar el texto del mensaje en la raíz del payload en vez de
   `entry[0].changes[0].value.messages[0].text.body`.
3. No deduplicar por `wamid` → responder dos veces lo mismo.
4. Tardar más de 5 segundos en devolver HTTP 200 → Meta lo toma como fallo y reintenta.

Nunca commitees tokens, `phone_number_id`, app secrets ni URLs de webhook. Van en variables
de entorno o en las credenciales de n8n.

## Skills

Hay 38 skills en `.claude/skills/`. Las más pertinentes acá:

- `web-quality-audit`, `performance`, `accessibility`, `seo` → antes de cada deploy.
- `web-design-guidelines`, `apple-design` → al tocar la UI.
- `n8n-*` → al armar el asistente de WhatsApp.
- `ponytail` → cuando una solución empieza a crecer de más.

El inventario completo está en `.claude/skills/README.md`.

## Design Principles — Sistema de Diseño Actual

**Este documento define el sistema de diseño real del proyecto.** Las auditorías de diseño se hacen CONTRA este sistema, nunca proponiendo uno nuevo. 

### Paleta de Colores

Todos los colores usan tokens CSS definidos en `:root` con pares en modo oscuro:

**Modo Claro:**
- `--bg: #F8F9FA` (fondo de página, muy claro)
- `--surface: #FFFFFF` (tarjetas, blanco puro)
- `--surface-2: #E9ECEF` (bloques hundidos, gris muy claro)
- `--brand: #3F7575` (turquesa oscuro, acentos, links)
- `--brand-bright: #6BC2C2` (turquesa brillante, botones, over navy)
- `--text: #333333` (texto principal, contraste 12:1)
- `--text-2: #5A6169` (texto secundario, contraste 6:1)
- `--text-3: #696F77` (texto terciario, contraste 4.8:1 — AA mínimo)
- `--border: #CBD3DA` (divisiones finas, 1.5:1)
- `--border-strong: #A6B1BA` (énfasis, 2.5:1)

**Modo Oscuro:**
- `--bg: #12161B` (fondo muy oscuro)
- `--surface: #1A1F26` (tarjetas oscuras)
- `--surface-2: #232932` (bloques hundidos)
- `--brand: #6BC2C2` (turquesa claro, acentos — 8.8:1)
- `--text: #E8ECEF` (texto claro, 15.3:1)
- `--text-2: #B0B7BE` (secundario, 9:1)
- `--text-3: #8A9199` (terciario, 5.7:1)

**Excepciones:** Colores de WhatsApp (`#1F2C34`, `#005C4B`) no cambian con tema.

### Tipografía

- **Títulos (h1-h4):** Bricolage Grotesque, 600+ weight, `letter-spacing: -0.02em`, `line-height: 1.1`
- **Cuerpo:** IBM Plex Sans, 400/500 weight, `line-height: 1.6` para párrafos largos
- **Código/Etiquetas:** IBM Plex Mono, 400/600 weight, `font-size: 0.8125rem`

**Escala de tamaños:** 17px base (mobile), 16px (desktop)  
**Mínimo para AA:** 12px con contraste 4.5:1

### Espaciado

Base 4px en escala: `--s1:4px` → `--s10:128px`

```
--s1:4px; --s2:8px; --s3:12px; --s4:16px; --s5:24px;
--s6:32px; --s7:48px; --s8:64px; --s9:96px; --s10:128px;
```

Nunca números mágicos. Siempre usar variables.

### Radios y Sombras

- `--r-sm: 8px` (botones, inputs)
- `--r-md: 12px` (tarjetas)
- `--r-lg: 18px` (paneles grandes)
- `--r-full: 999px` (pills)
- `--shadow-sm: 0 1px 2px rgba(...), 0 2px 8px rgba(...)`
- `--shadow-md: 0 4px 12px rgba(...), 0 12px 32px -12px rgba(...)`

### Breakpoints Responsivos

- **1440px:** Desktop wide
- **960px:** Desktop normal
- **760px:** Tablet horizontal / mobile wide
- **640px:** Tablet portrait
- **480px:** Mobile normal
- **420px:** Mobile small

Mobile-first: media queries siempre `max-width`.

### Patrones de Interacción

- **Touch targets:** Mínimo 44×44px (48dp en Material)
- **Transiciones:** `cubic-bezier(0.4, 0, 0.2, 1)` (ease-in-out estándar)
- **Estados:** `:hover`, `:focus-visible`, `:active` siempre definidos
- **Focus:** Outline 2.5px color `--brand`, offset 3px

### Accesibilidad No Negociable

- [ ] Contraste mínimo 4.5:1 para texto (WCAG AA)
- [ ] Contraste mínimo 3:1 para elementos UI grandes
- [ ] Todos los colores + patrones/iconos (no solo color)
- [ ] Touch targets ≥ 44×44px
- [ ] `lang="es-AR"` en `<html>`
- [ ] Heading hierarchy lógica (no saltear niveles)
- [ ] Links con `:focus-visible` siempre visibles

---

## Git

Rama de trabajo actual: `claude/hola-querido-stuzim`. No pushear a `main` sin permiso
explícito.
