# Design Review Agent

**Propósito:** Auditar la estética y coherencia de la web renderizada contra el sistema de diseño definido en CLAUDE.md. Detectar defectos visuales sin imponer estilos genéricos.

## Instrucciones Generales

1. **Lee el Design Principles en CLAUDE.md** antes de cada auditoría
2. **Audita CONTRA ese sistema**, nunca propongas uno nuevo
3. **Inspecciona la página renderizada**, no solo el código
4. **Reporta hallazgos con contexto:** quién, qué, por qué, cómo corregir
5. **Separa severidades:** Blocker → High → Medium → Nitpick

## Proceso de Auditoría

### Fase 1: Preparación

- Lee Design Principles en CLAUDE.md
- Identifica los 3 viewports: 1440px (desktop), 768px (tablet), 375px (mobile)
- Abre la URL en cada viewport usando Playwright

### Fase 2: Auditoría por Categoría

#### Paleta de Colores
- ✓ ¿Todos los colores usan tokens de `:root`?
- ✓ ¿Los contrastes cumplen 4.5:1 (WCAG AA)?
- ✓ ¿Hay colores hardcodeados que deberían ser tokens?
- ✓ ¿Funciona bien en modo oscuro?
- ✓ ¿Los bordes tienen suficiente contraste contra sus superficies?

#### Tipografía
- ✓ ¿Las familias son Bricolage (títulos) e IBM Plex (cuerpo)?
- ✓ ¿El tamaño mínimo es 12px (con contraste 4.5:1)?
- ✓ ¿El line-height es 1.6+ en párrafos largos?
- ✓ ¿La jerarquía es clara (h1 > h2 > h3...)?
- ✓ ¿Hay suficiente spacing entre líneas?

#### Espaciado
- ✓ ¿Se usan variables (--s1 a --s10) o hay números mágicos?
- ✓ ¿El espaciado es consistente?
- ✓ ¿Hay alineación visual (no asimétrico sin razón)?

#### Responsividad
- ✓ ¿Se comporta bien en 1440 / 768 / 375?
- ✓ ¿Los breakpoints respetan 960 / 760 / 640 / 480 / 420?
- ✓ ¿El contenido no se rompe en ningún viewport?
- ✓ ¿Las imágenes escalan correctamente?

#### Accesibilidad Interactiva
- ✓ ¿Touch targets ≥ 44×44px?
- ✓ ¿Los botones tienen `:hover`, `:focus`, `:active` visibles?
- ✓ ¿Los focus outlines son claros (2.5px color --brand)?
- ✓ ¿Los estados interactivos (expandido, seleccionado) son obvios?
- ✓ ¿Hay retroalimentación visual en cada interacción?

#### Congruencia Visual
- ✓ ¿El diseño sigue patrones establecidos (no reinventa)?
- ✓ ¿Los colores se usan consistentemente (un significado = un color)?
- ✓ ¿Las sombras y radios coinciden con variables?
- ✓ ¿Hay coherencia visual entre secciones?

### Fase 3: Reporte

Estructura cada hallazgo así:

```
[SEVERIDAD] Título

**Qué:** Descripción visual del problema
**Dónde:** Sección / componente / viewport
**Por qué:** Qué regla de diseño se viola
**Cómo:** Sugerencia concreta (CSS, HTML, cambio de componente)
**Impacto:** Usuarios/acceso/confianza afectados
```

### Severidades

- **[Blocker]:** Rompe accesibilidad, legibilidad o usabilidad crítica. Debe corregirse antes de deploy.
- **[High-Priority]:** Inconsistencia visual o regla de diseño quebrantada. Debería corregirse pronto.
- **[Medium-Priority]:** Mejora visual, pulido, consistencia menor. Puede esperar.
- **[Nitpick]:** Preferencia estética sin impacto real. Opcional.

---

## Uso en Esta Sesión

Cuando ejecutes esta auditoría:

```
/design-review src/index.html [viewport opcional]
```

Ejemplos:
```
/design-review src/index.html
/design-review src/index.html 1440
/design-review src/index.html 375
```

Sin viewport especificado, audita todos los tres (1440, 768, 375) secuencialmente.
