# Apple Design Guidelines Audit — Librería Neneko

**Audit Date:** August 27, 2026 · **Actualizado:** September 22, 2026  
**Platform Focus:** iOS / Mobile-first web  
**Overall Assessment:** Todos los hallazgos críticos y de alta prioridad de este audit ya
están resueltos. Se deja el documento como registro histórico — no es una lista de trabajo
pendiente.

---

## Critical Issues (Must Fix) — resueltos

### 1. Dark Mode Support Missing
**Status:** ✅ Implementado. `@media (prefers-color-scheme: dark)` cubre toda la paleta de
tokens, con tests de contraste (`test/horarios.test.mjs`) que verifican que todo color de
`:root` tiene su par oscuro.

### 2. Text Scaling Not Supported
**Status:** ✅ Implementado. No queda ningún `font-size` en `px`: todo el tipográfico usa
`rem` (o `clamp()` con `rem`), así que escala con el tamaño de texto del sistema.

### 3. Reduce Motion Not Respected
**Status:** ✅ Implementado. `prefers-reduced-motion` está cubierto de forma global, no solo
en la demo del chat.

---

## High-Priority Issues — resueltos

### 4. Touch Target Sizing
**Status:** ✅ Verificado. 44×44 px es el mínimo exigido en CLAUDE.md y se aplica en toda la
UI interactiva.

### 5. Color Contrast Unverified
**Status:** ✅ Verificado. AA en los dos modos, verificado por test (no una revisión manual
puntual, sino una que corre en cada push).

### 6. Screen Reader Labels Incomplete
**Status:** ✅ Cubierto. Los elementos interactivos sin texto visible llevan `aria-label`.

---

## Medium-Priority Improvements

### 7. Typography Hierarchy
Secondary headings could use semibold weight for better visual hierarchy.

### 8. Safe Area Padding
Not all content sections account for notches/Dynamic Island edge insets.

### 9. Icon Scaling
SVG icons use fixed pixels instead of `em`/`rem`, so they don't scale with text size changes.

---

## Positive Notes ✅

- **Excellent iOS integration**: `viewport-fit=cover`, dynamic theme-color, safe-area env vars
- **Semantic color palette**: Navy, mustard, terra, sage are culturally appropriate
- **Mobile-first layout**: Touch-friendly, well-spaced
- **Icon system**: Custom SVG system is lightweight and meaningful
- **Partial accessibility**: Many elements already have aria-label

---

## Testing Checklist

Cubierta por `npm test` en cada push (`test/horarios.test.mjs` verifica contraste y pares de
modo oscuro), más lo que ya confirma este documento arriba. Falta verificación manual real
en un dispositivo iOS, que ningún test automatizado reemplaza:
- [ ] Safari en iPhone real, tamaños chico/grande → sin overflow ni recortes
- [ ] Screen reader (VoiceOver) real, no solo revisión de `aria-label` en el código

---

## Implementation Status

Todos los ítems de este audit están resueltos en `main`. No quedó nada "en progreso" en una
rama — el modelo de trabajo de este repo es pushear directo a `main`.

---

**Próximo audit de diseño:** correr `web-quality-audit` o `apple-design` de nuevo cuando se
agreguen las fotos reales del local (el cambio de contenido más grande pendiente), no antes.
