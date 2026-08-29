# Librería Neneko

Sitio web y asistente de WhatsApp para **Librería Neneko** — fotocopias, anillados y útiles
escolares y de oficina en Peña 3102, CABA.

El objetivo del proyecto es simple: que un vecino que busca "librería cerca de mí" llegue a
la página, entienda en tres segundos qué hacemos, y termine escribiendo por WhatsApp. Todo
lo demás está al servicio de eso.

---

## Estructura del repo

```
.
├── src/                            # Lo que se publica
│   ├── index.html                  #   La landing, un solo archivo autocontenido
│   ├── robots.txt
│   └── sitemap.xml
├── n8n/
│   ├── asistente-whatsapp.json     # Workflow importable del bot de WhatsApp
│   └── README.md                   #   Puesta en marcha paso a paso
├── test/                           # Tests (node --test, sin dependencias)
├── docs/
│   ├── concepto-landing.md         # Qué es el sitio, datos del negocio, pendientes
│   ├── catalogo-google-sheets.md   # Cómo conectar el catálogo a una hoja
│   ├── plantilla-catalogo.csv      #   Plantilla lista para copiar
│   ├── deploy.md                   # Cómo se publica y qué hacer después
│   ├── nucleo-whatsapp-n8n.md      # Base técnica del bot de WhatsApp con n8n
│   ├── fundamentos-marketing-web.md# Principios de conversión que sigue el sitio
│   └── fuentes/                    # PDFs originales de los que salen los docs
├── .github/workflows/              # Tests en cada push, deploy a Pages desde main
└── .claude/
    └── skills/                     # 38 skills que Claude Code carga en este repo
        └── README.md               # Inventario, fuentes y licencias
```

---

## Los tres documentos base

| Documento | Qué responde |
|---|---|
| [`docs/concepto-landing.md`](docs/concepto-landing.md) | Qué hay hoy en el sitio, con qué datos, qué sistema de diseño usa y qué falta. |
| [`docs/fundamentos-marketing-web.md`](docs/fundamentos-marketing-web.md) | Por qué el sitio está armado así: jerarquía visual, copywriting, fricción, SEO local, accesibilidad. |
| [`docs/nucleo-whatsapp-n8n.md`](docs/nucleo-whatsapp-n8n.md) | Cómo construir el bot de WhatsApp sin pisar los errores típicos (tokens que expiran, ventana de 24 h, webhooks duplicados). |

Los PDFs originales quedaron en `docs/fuentes/` como respaldo; las versiones en Markdown
son las que hay que leer y mantener.

---

## Datos del negocio

| Campo | Valor |
|---|---|
| Dirección | Peña 3102, CABA |
| Teléfono | +54 9 11 6169-1209 (solo WhatsApp) |
| WhatsApp | [wa.me/5491161691209](https://wa.me/5491161691209) |
| Horario | Lunes a sábado, 9:00 – 20:30 |
| Google | 4,4 ★ · 97 reseñas |

> Estos datos tienen que ser **idénticos** en el sitio, en Google Maps y en cualquier
> directorio. Es un requisito de SEO local (consistencia NAP), no un detalle cosmético.

---

## Ver el sitio localmente

`src/index.html` es un archivo estático sin build step. Se puede abrir directo en el
navegador, o servirlo:

```bash
npm run dev      # → http://localhost:8000
```

## Correr los tests

Sin dependencias que instalar: usan el runner que ya trae Node.

```bash
npm test
```

Cubren el parser del catálogo, el escapado del contenido que baja de Google Sheets, y la
lógica de los nodos Code del bot de WhatsApp contra payloads con la forma exacta que manda
Meta.

---

## Catálogo de productos

El mercadito puede alimentarse desde una hoja de Google Sheets publicada como CSV, con
columnas `Categoria | Producto | Precio`. Está sin configurar todavía: la constante
`SHEET_CSV_URL` en `src/index.html` tiene un placeholder, y mientras tanto la página muestra
productos de ejemplo sin romperse.

Paso a paso en [`docs/catalogo-google-sheets.md`](docs/catalogo-google-sheets.md).

Es la **misma hoja** que usa el bot de WhatsApp, así el precio que dice el bot y el que
muestra la web no se despegan.

---

## Estado actual

Lo que está hecho:

- ✅ Landing responsive, con SEO local (JSON-LD, Open Graph, sitemap) y accesibilidad revisada
- ✅ Catálogo dinámico desde Google Sheets, con tests
- ✅ Workflow de n8n del asistente de WhatsApp, listo para importar
- ✅ Deploy automático a GitHub Pages, con los tests como condición
- ✅ Los tres documentos base pasados a Markdown
- ✅ 38 skills instaladas para trabajar el proyecto con Claude Code

Lo que sigue:

- ⬜ **Activar GitHub Pages** (Settings → Pages → Source: GitHub Actions) — ver [`docs/deploy.md`](docs/deploy.md)
- ⬜ **Conectar el Google Sheet** del catálogo y actualizar precios — ver [`docs/catalogo-google-sheets.md`](docs/catalogo-google-sheets.md)
- ⬜ **Poner en marcha el bot**: credenciales de Meta y variables de entorno — ver [`n8n/README.md`](n8n/README.md)
- ⬜ Fotos reales del local y los productos (y con eso, el `og:image`)
- ⬜ Dominio propio
- ⬜ Alta en Google Search Console y sincronizar el Google Business Profile

Detalle de pendientes en [`docs/concepto-landing.md`](docs/concepto-landing.md#estado-actual-y-pendientes-conocidos).

---

## Trabajar en este repo con Claude Code

El repo trae 38 skills en `.claude/skills/` que se activan solas según la tarea: auditorías
de performance y accesibilidad, guías de diseño, construcción de workflows de n8n y revisión
de código. El inventario completo, con la fuente y licencia de cada una, está en
[`.claude/skills/README.md`](.claude/skills/README.md).

Las convenciones del proyecto están en [`CLAUDE.md`](CLAUDE.md).
