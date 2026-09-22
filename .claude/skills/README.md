# Skills instaladas en este proyecto

Estas son las skills que Claude Code carga automáticamente al trabajar en este repo.
Cada carpeta es una skill independiente con su propio `SKILL.md`; Claude las activa sola
cuando la tarea coincide con su descripción — no hace falta invocarlas a mano (aunque se
puede, con `/nombre-de-la-skill`).

**Total: 15 skills**, de 4 fuentes distintas. Todas fijadas al commit que se indica más
abajo.

> Hasta hace poco había 40. Primero se sacaron 10 que no tenían ninguna aplicación posible
> en este repo (React/Next.js/React Native sin que exista una sola línea de framework en el
> sitio, una guía de escritura en inglés para un proyecto en voseo rioplatense, dos skills
> de SEO redundantes entre sí, y una que ni cargaba porque le faltaba el `SKILL.md` en el
> lugar correcto). Después se dio de baja el plan del asistente de WhatsApp y con eso se
> fueron las 15 skills de `n8n-*`. El detalle de qué se sacó y por qué está en el historial
> de git de este archivo.

---

## Origen de cada grupo

| # (foto) | Grupo | Fuente | Commit | Licencia |
|---|---|---|---|---|
| 1 | `apple-design` | [dickwu/apple-design-skill](https://github.com/dickwu/apple-design-skill) | `d0bac1e` | ⚠️ sin licencia declarada |
| 2 | `code-review` | **built-in de Claude Code** | — | — |
| 3 | `security-review` | **built-in de Claude Code** | — | — |
| 4 | `ponytail-*` (6) | [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) | `2ed6c52` | MIT |
| 5 | Lighthouse / web-quality (5) | [addyosmani/web-quality-skills](https://github.com/addyosmani/web-quality-skills) | `afa8da9` | MIT |
| 6 | `deploy-to-vercel`, `vercel-cli-with-tokens` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | `dd089a8` | ⚠️ sin licencia declarada |
| 7 | `seo-mastery` | fuente sin registrar — pendiente de confirmar antes de hacer público el repo | — | ⚠️ sin licencia declarada |

> **Sobre los ítems 2 y 3:** `code-review` y `security-review` ya vienen incluidas en Claude
> Code. No se copió nada al repo porque duplicarlas las rompería (dos skills con el mismo
> nombre). Se usan igual: `/code-review` y `/security-review`.

> **Sobre las marcadas con ⚠️:** los repos de origen no publican un archivo de licencia.
> Se incluyen acá para uso interno del proyecto; si en algún momento este repo se hace
> público conviene revisar los términos con sus autores.

---

## Inventario completo

### Diseño y construcción de interfaces

| Skill | Para qué sirve |
|---|---|
| `apple-design` | Auditar y mejorar UI/UX según los principios de las Human Interface Guidelines de Apple. |
| `web-design-guidelines` | Revisar código de UI contra las Web Interface Guidelines (accesibilidad, UX, diseño). |

### Calidad web (Lighthouse / Core Web Vitals / SEO)

| Skill | Para qué sirve |
|---|---|
| `web-quality-audit` | Auditoría completa: performance, accesibilidad, SEO y best practices. Punto de entrada cuando no sabés por dónde empezar. |
| `performance` | Acelerar la carga del sitio, reducir tiempos, optimizar recursos. |
| `core-web-vitals` | Optimizar LCP, INP y CLS específicamente. |
| `accessibility` | Auditar y corregir accesibilidad según WCAG 2.2. |
| `seo-mastery` | SEO técnico y de contenido, datos estructurados, y visibilidad en búsqueda generativa (GEO/AEO): que la IA de Google, ChatGPT o Perplexity cite y recomiende la librería. |

> Directamente relevantes para los §6, §7 y §8 de
> [`docs/fundamentos-marketing-web.md`](../../docs/fundamentos-marketing-web.md).

### Simplicidad y revisión de código (ponytail)

| Skill | Para qué sirve |
|---|---|
| `ponytail` | Fuerza la solución más simple que funciona. "El mejor código es el que no escribiste." |
| `ponytail-review` | Review de un diff enfocado exclusivamente en over-engineering. |
| `ponytail-audit` | Lo mismo pero sobre todo el repo: ranking de qué borrar y simplificar. |
| `ponytail-debt` | Junta los comentarios `ponytail:` del código en un registro de deuda técnica. |
| `ponytail-gain` | Scoreboard del impacto medido de ponytail. |
| `ponytail-help` | Referencia rápida de los modos y comandos. |

### Deploy

| Skill | Para qué sirve |
|---|---|
| `deploy-to-vercel` | Deployar el sitio a Vercel y devolver el link. Plan B si GitHub Pages no alcanza — ver [`docs/deploy.md`](../../docs/deploy.md). |
| `vercel-cli-with-tokens` | Vercel CLI con autenticación por token (útil en CI y en sesiones remotas). |

---

## Cómo actualizarlas

No hay un gestor de paquetes acá: las skills están copiadas al repo (vendored) para que la
sesión sea reproducible. Para actualizar un grupo, clonar el repo de origen y volver a
copiar la carpeta `skills/` correspondiente.

Al hacerlo, verificar que **el nombre de cada carpeta coincida con el campo `name` de su
frontmatter** y que el `SKILL.md` quede en la raíz de la carpeta de la skill — si no,
Claude Code no la carga (fue justo el problema de la ex-skill `geo-seo`, que se sacó del
repo por esto).
