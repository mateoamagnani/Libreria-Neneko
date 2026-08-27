# Apple Design Guidelines Audit — Librería Neneko

**Audit Date:** August 27, 2026  
**Platform Focus:** iOS / Mobile-first web  
**Overall Assessment:** Good with critical accessibility gaps

---

## Critical Issues (Must Fix)

### 1. Dark Mode Support Missing
Users who enable Dark Mode in iOS settings will see the light theme forced on them. This violates iOS conventions and causes readability issues in low-light environments.

**Status:** ❌ Not implemented  
**Priority:** CRITICAL  
**Implementation:** Add `@media (prefers-color-scheme: dark)` with color variants

### 2. Text Scaling Not Supported
Fixed pixel sizes (`font-size: 17px`) don't scale when users increase system text size in Accessibility settings. Users who rely on larger text will see no improvement.

**Status:** ❌ Not implemented  
**Priority:** CRITICAL  
**Implementation:** Replace `px` with `rem` units for all text and icons

### 3. Reduce Motion Not Respected
Animations run even when `prefers-reduced-motion: reduce` is enabled. This can cause discomfort or disorientation for users sensitive to motion.

**Status:** ⚠️ Partially implemented (chat demo respects it, product reveal doesn't)  
**Priority:** CRITICAL  
**Implementation:** Add global CSS rule + extend to product card animations

---

## High-Priority Issues

### 4. Touch Target Sizing
Some interactive elements may not meet the 44×44 pt minimum. Product card links need verified sizing.

**Status:** 🟡 Needs verification  
**Priority:** HIGH  
**Fix:** Audit and ensure all buttons/links have min 44×44 px with padding

### 5. Color Contrast Unverified
No confirmation that secondary text colors meet WCAG AA 4.5:1 minimum on light backgrounds.

**Status:** 🟡 Needs verification  
**Priority:** HIGH  
**Fix:** Test with contrast checker; adjust if needed

### 6. Screen Reader Labels Incomplete
Some interactive elements lack `aria-label` attributes, leaving screen reader users without context.

**Status:** 🟡 Partially done  
**Priority:** HIGH  
**Fix:** Add labels to all product links and buttons

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

Before deploying to main:
- [ ] Dark mode enabled on iPhone → site readable in dark mode
- [ ] Text size at 200% in Accessibility → layout doesn't break
- [ ] Reduce Motion enabled → animations disable
- [ ] Screen reader on → all buttons announce correctly
- [ ] All tap targets measured → ≥44×44 px
- [ ] Contrast tested → body text ≥4.5:1, large text ≥3:1
- [ ] Safari on iPhone 14-16 all sizes → no overflow or cropping

---

## Implementation Status

| Item | Status | Branch |
|------|--------|--------|
| Dark mode | 🔄 In progress | `claude/hola-querido-stuzim` |
| Text scaling (rem) | 🔄 In progress | `claude/hola-querido-stuzim` |
| Reduce motion | 🔄 In progress | `claude/hola-querido-stuzim` |
| Touch targets | 🔄 In progress | `claude/hola-querido-stuzim` |
| Screen reader labels | 🔄 In progress | `claude/hola-querido-stuzim` |
| Contrast verification | ⏳ Pending | `claude/hola-querido-stuzim` |

---

**Next:** Apply code fixes, test on iOS, merge to main.
