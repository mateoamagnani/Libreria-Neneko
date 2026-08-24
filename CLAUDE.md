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

## Datos del negocio — consistencia NAP

Estos valores aparecen en varios lugares del HTML (navbar, hero, badges, sección ubicación,
footer, links de `wa.me` y de Maps). **Si cambia uno, hay que cambiarlos todos** — y también
en el Google Business Profile. Las inconsistencias bajan el posicionamiento local.

- Peña 3102, CABA
- 011 6169-1209 · `https://wa.me/5491161691209`
- Lunes a sábado, 9:00 – 20:30

## Al trabajar el bot de WhatsApp

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
