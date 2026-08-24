# Skills instaladas en este proyecto

Estas son las skills que Claude Code carga automáticamente al trabajar en este repo.
Cada carpeta es una skill independiente con su propio `SKILL.md`; Claude las activa sola
cuando la tarea coincide con su descripción — no hace falta invocarlas a mano (aunque se
puede, con `/nombre-de-la-skill`).

**Total: 38 skills**, de 6 fuentes distintas. Todas fijadas al commit que se indica más
abajo.

---

## Origen de cada grupo

| # (foto) | Grupo | Fuente | Commit | Licencia |
|---|---|---|---|---|
| 1 | `web-artifacts-builder` | [anthropics/skills](https://github.com/anthropics/skills) | `3b3fad9` | Apache-2.0 |
| 2 | `apple-design` | [dickwu/apple-design-skill](https://github.com/dickwu/apple-design-skill) | `d0bac1e` | ⚠️ sin licencia declarada |
| 3 | `code-review` | **built-in de Claude Code** | — | — |
| 4 | `security-review` | **built-in de Claude Code** | — | — |
| 5 | `ponytail-*` (6) | [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) | `2ed6c52` | MIT |
| 6 | Lighthouse / web-quality (6) | [addyosmani/web-quality-skills](https://github.com/addyosmani/web-quality-skills) | `afa8da9` | MIT |
| 7 | `vercel-*` + guidelines (9) | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | `dd089a8` | ⚠️ sin licencia declarada |
| 8 | `n8n-*` (15) | [czlonkowski/n8n-skills](https://github.com/czlonkowski/n8n-skills) | `0296522` | MIT |

> **Sobre los ítems 3 y 4:** `code-review` y `security-review` ya vienen incluidas en Claude
> Code. No se copió nada al repo porque duplicarlas las rompería (dos skills con el mismo
> nombre). Se usan igual: `/code-review` y `/security-review`.

> **Sobre las dos marcadas con ⚠️:** los repos de origen no publican un archivo de licencia.
> Se incluyen acá para uso interno del proyecto; si en algún momento este repo se hace
> público conviene revisar los términos con sus autores.

---

## Inventario completo

### Diseño y construcción de interfaces

| Skill | Para qué sirve |
|---|---|
| `web-artifacts-builder` | Armar artifacts HTML complejos multi-componente (React, Tailwind, shadcn/ui) y bundlearlos en un solo archivo. |
| `apple-design` | Auditar y mejorar UI/UX según los principios de las Human Interface Guidelines de Apple. |
| `web-design-guidelines` | Revisar código de UI contra las Web Interface Guidelines (accesibilidad, UX, diseño). |
| `vercel-composition-patterns` | Patrones de composición de React que escalan; evitar proliferación de props booleanas. |
| `vercel-react-best-practices` | Optimización de performance en React y Next.js, por el equipo de Vercel. |
| `vercel-react-native-skills` | Buenas prácticas de React Native y Expo. |
| `vercel-react-view-transitions` | Animaciones con la View Transition API de React. |

### Calidad web (Lighthouse / Core Web Vitals)

| Skill | Para qué sirve |
|---|---|
| `web-quality-audit` | Auditoría completa: performance, accesibilidad, SEO y best practices. Punto de entrada cuando no sabés por dónde empezar. |
| `performance` | Acelerar la carga del sitio, reducir tiempos, optimizar recursos. |
| `core-web-vitals` | Optimizar LCP, INP y CLS específicamente. |
| `accessibility` | Auditar y corregir accesibilidad según WCAG 2.2. |
| `seo` | Meta tags, datos estructurados, visibilidad en buscadores. |
| `best-practices` | Seguridad, compatibilidad y calidad de código en web. |

> Estas seis son directamente relevantes para los §6, §7 y §8 de
> [`docs/fundamentos-marketing-web.md`](../../docs/fundamentos-marketing-web.md).

### Automatización n8n / WhatsApp

| Skill | Para qué sirve |
|---|---|
| `using-n8n-mcp-skills` | Orquestadora: por dónde empezar al construir o debuggear un workflow de n8n. |
| `n8n-workflow-patterns` | Patrones de arquitectura probados en workflows reales. |
| `n8n-node-configuration` | Configurar nodos: propiedades, campos requeridos, dependencias. |
| `n8n-expression-syntax` | Sintaxis `{{ }}`, `$json`, `$node` y errores comunes. |
| `n8n-error-handling` | Que los fallos sean ruidosos, estructurados y recuperables. **Clave para el checklist del webhook.** |
| `n8n-validation-expert` | Interpretar y arreglar errores de validación. |
| `n8n-agents` | Diseñar agentes de IA en n8n (nodos langchain). |
| `n8n-code-javascript` | Escribir JS en nodos Code. |
| `n8n-code-python` | Escribir Python en nodos Code. |
| `n8n-code-tool` | Custom Code Tool invocable por un agente de IA. |
| `n8n-binary-and-data` | Archivos, imágenes, PDFs, base64, multimodal. |
| `n8n-subworkflows` | Sub-workflows reutilizables y componibles. |
| `n8n-self-hosting` | Deploy de n8n self-hosted con Docker Compose + Caddy. |
| `n8n-multi-instance` | Trabajar con más de una instancia de n8n. |
| `n8n-mcp-tools-expert` | Uso eficiente de las herramientas del MCP de n8n. |

> Directamente aplicables al plan de
> [`docs/nucleo-whatsapp-n8n.md`](../../docs/nucleo-whatsapp-n8n.md).

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
| `deploy-to-vercel` | Deployar el sitio a Vercel y devolver el link. |
| `vercel-cli-with-tokens` | Vercel CLI con autenticación por token (útil en CI y en sesiones remotas). |
| `vercel-optimize` | Optimización de costo y performance de proyectos ya deployados. |

### Escritura

| Skill | Para qué sirve |
|---|---|
| `writing-guidelines` | Revisar documentación y prosa: estilo, voz, tono. |

---

## Cómo actualizarlas

No hay un gestor de paquetes acá: las skills están copiadas al repo (vendored) para que la
sesión sea reproducible. Para actualizar un grupo, clonar el repo de origen y volver a
copiar la carpeta `skills/` correspondiente.

Al hacerlo, verificar que **el nombre de cada carpeta coincida con el campo `name` de su
frontmatter** — si no coinciden, la skill no carga. Las cuatro skills de Vercel
(`vercel-composition-patterns`, `vercel-react-best-practices`, `vercel-react-native-skills`,
`vercel-react-view-transitions`) vienen con la carpeta sin el prefijo `vercel-` y hubo que
renombrarlas.
