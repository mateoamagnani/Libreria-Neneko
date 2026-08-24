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
├── src/
│   └── index.html                  # La landing, un solo archivo autocontenido
├── docs/
│   ├── concepto-landing.md         # Qué es el sitio, datos del negocio, pendientes
│   ├── nucleo-whatsapp-n8n.md      # Base técnica del bot de WhatsApp con n8n
│   ├── fundamentos-marketing-web.md# Principios de conversión que sigue el sitio
│   └── fuentes/                    # PDFs originales de los que salen los docs
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
| Teléfono | 011 6169-1209 |
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
python3 -m http.server 8000 --directory src
# → http://localhost:8000
```

---

## Catálogo de productos

El mercadito puede alimentarse desde una hoja de Google Sheets publicada como CSV, con
columnas `Categoria | Producto | Precio`. Está sin configurar todavía: la constante
`SHEET_CSV_URL` en `src/index.html` tiene un placeholder, y mientras tanto la página muestra
productos de ejemplo sin romperse.

El paso a paso está en [`docs/concepto-landing.md`](docs/concepto-landing.md#catálogo-dinámico-desde-google-sheets).

---

## Estado actual

Lo que está hecho:

- ✅ Landing completa y responsive, con demo animada del chat de WhatsApp
- ✅ Documentación técnica del bot de WhatsApp con n8n
- ✅ Marco de referencia de marketing y conversión
- ✅ 38 skills instaladas para trabajar el proyecto con Claude Code

Lo que sigue (detalle en [`docs/concepto-landing.md`](docs/concepto-landing.md#estado-actual-y-pendientes-conocidos)):

- ⬜ Conectar el Google Sheet del catálogo y actualizar precios
- ⬜ Meta tags Open Graph + JSON-LD `LocalBusiness` para SEO local
- ⬜ Fotos reales del local y los productos
- ⬜ Deploy con dominio propio
- ⬜ Armar el flujo de n8n del asistente de WhatsApp

---

## Trabajar en este repo con Claude Code

El repo trae 38 skills en `.claude/skills/` que se activan solas según la tarea: auditorías
de performance y accesibilidad, guías de diseño, construcción de workflows de n8n y revisión
de código. El inventario completo, con la fuente y licencia de cada una, está en
[`.claude/skills/README.md`](.claude/skills/README.md).

Las convenciones del proyecto están en [`CLAUDE.md`](CLAUDE.md).
