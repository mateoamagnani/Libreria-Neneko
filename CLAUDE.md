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
- Lunes a viernes 9:00–13:00 y 16:30–20:30 · Sábado 9:00–14:00 · Domingo cerrado

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

## Git

Rama de trabajo actual: `claude/hola-querido-stuzim`. No pushear a `main` sin permiso
explícito.
