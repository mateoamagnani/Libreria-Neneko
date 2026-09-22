# Librería Neneko

Sitio web para **Librería Neneko** — fotocopias, anillados y útiles escolares y de oficina
en Peña 3102, CABA.

El objetivo del proyecto es simple: que un vecino que busca "librería cerca de mí" llegue a
la página, entienda en tres segundos qué hacemos, y termine escribiendo por WhatsApp. Todo
lo demás está al servicio de eso.

---

## Estructura del repo

```
.
├── src/                            # Lo que se publica
│   ├── index.html                  #   La landing, un solo archivo autocontenido
│   ├── 404.html, privacy.html      #   Página de error y política de privacidad
│   ├── logo.png, og-preview.png    #   Favicon/logo y la imagen de Open Graph
│   ├── robots.txt, sitemap.xml, llms.txt
├── test/                           # Tests (node --test, sin dependencias)
├── docs/
│   ├── concepto-landing.md         # Qué es el sitio, datos del negocio, pendientes
│   ├── fundamentos-marketing-web.md# Principios de conversión que sigue el sitio
│   ├── catalogo-google-sheets.md   # Cómo conectar el catálogo a una hoja
│   ├── plantilla-catalogo.csv      #   Plantilla lista para copiar
│   ├── deploy.md                   # Cómo se publica y qué hacer después
│   ├── google-setup-guia-paso-a-paso.md  # Guion para el setup con la dueña
│   ├── analytics-setup.md          # Puesta en marcha de Google Analytics 4
│   ├── legal-argentina.md          # Términos y condiciones, requisitos legales
│   ├── roadmap-productivo.md       # Plan de mejoras por fases
│   ├── apple-design-audit.md       # Auditoría de diseño contra las HIG de Apple
│   ├── expansion-categorias.md     # Estrategia para agregar categorías nuevas
│   └── fuentes/                    # PDFs originales de los que salen los docs
├── .github/workflows/              # Tests en cada push, deploy a Pages desde main
└── .claude/
    └── skills/                     # 15 skills que Claude Code carga en este repo
        └── README.md               # Inventario, fuentes y licencias
```

---

## Los documentos base

| Documento | Qué responde |
|---|---|
| [`docs/concepto-landing.md`](docs/concepto-landing.md) | Qué hay hoy en el sitio, con qué datos, qué sistema de diseño usa y qué falta. |
| [`docs/fundamentos-marketing-web.md`](docs/fundamentos-marketing-web.md) | Por qué el sitio está armado así: jerarquía visual, copywriting, fricción, SEO local, accesibilidad. |

Los PDFs originales quedaron en `docs/fuentes/` como respaldo; las versiones en Markdown
son las que hay que leer y mantener.

### Otros documentos de trabajo

| Documento | Qué responde |
|---|---|
| [`docs/google-setup-guia-paso-a-paso.md`](docs/google-setup-guia-paso-a-paso.md) | Guion para hacer el setup de Google Business/Search Console/Analytics con la dueña en vivo. |
| [`docs/analytics-setup.md`](docs/analytics-setup.md) | Cómo instalar Google Analytics 4 en el sitio. |
| [`docs/legal-argentina.md`](docs/legal-argentina.md) | Qué requisitos legales aplican (Términos y Condiciones, etc.) para un sitio así en Argentina. |
| [`docs/roadmap-productivo.md`](docs/roadmap-productivo.md) | Plan de mejoras por fases, de lo urgente a lo opcional. |
| [`docs/apple-design-audit.md`](docs/apple-design-audit.md) | Auditoría de diseño del sitio contra las Human Interface Guidelines de Apple. |
| [`docs/expansion-categorias.md`](docs/expansion-categorias.md) | Estrategia para agregar categorías de productos nuevas sin romper el diseño. |

---

## Datos del negocio

| Campo | Valor |
|---|---|
| Dirección | Peña 3102, CABA |
| Teléfono | +54 9 11 6169-1209 (solo WhatsApp) |
| WhatsApp | [wa.me/5491161691209](https://wa.me/5491161691209) |
| Horario | Lun a vie 11:30–20:30 · Sáb 11:30–15:30 · Dom cerrado |
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

Cubren el parser del catálogo y el escapado del contenido que baja de Google Sheets.

---

## Catálogo de productos

El mercadito se alimenta de una hoja de Google Sheets publicada como CSV, con columnas
`Categoria | Producto | Precio`. Ya está conectado: `SHEET_CSV_URL` en `src/index.html`
apunta a la hoja real. Si en algún momento el fetch falla, la página muestra productos de
ejemplo sin romperse.

Paso a paso en [`docs/catalogo-google-sheets.md`](docs/catalogo-google-sheets.md).

---

## Estado actual

Lo que está hecho:

- ✅ Landing responsive, con SEO local (JSON-LD, Open Graph, sitemap) y accesibilidad revisada
- ✅ Catálogo dinámico desde Google Sheets, con tests
- ✅ Deploy automático a GitHub Pages, con los tests como condición
- ✅ **GitHub Pages activo** — el sitio está publicado y se redeploya solo en cada push a `main`
- ✅ **Google Sheet del catálogo conectado**, con precios reales
- ✅ Los documentos base pasados a Markdown
- ✅ 15 skills instaladas para trabajar el proyecto con Claude Code

Lo que sigue:

- ⬜ Fotos reales del local y los productos (y con eso, el `og:image`) — hoy es un gráfico con el logo, no una foto
- ⬜ Dominio propio
- ⬜ Alta en Google Search Console y sincronizar el Google Business Profile

Detalle de pendientes en [`docs/concepto-landing.md`](docs/concepto-landing.md#estado-actual-y-pendientes-conocidos).

---

## Trabajar en este repo con Claude Code

El repo trae 15 skills en `.claude/skills/` que se activan solas según la tarea: auditorías
de performance y accesibilidad, guías de diseño y revisión de código. El inventario completo,
con la fuente y licencia de cada una, está en
[`.claude/skills/README.md`](.claude/skills/README.md).

Las convenciones del proyecto están en [`CLAUDE.md`](CLAUDE.md).
