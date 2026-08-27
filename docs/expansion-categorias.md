# Estrategia de Expansión de Categorías — Diseño Accesible

## Estado Actual

```
3 categorías × 4 productos = 12 productos totales
├─ Impresiones y anillados (4)
├─ Útiles escolares y de oficina (4)
└─ Arte y manualidades (4)
```

**Problema:** Si agregamos más categorías o productos, la página se vuelve larga y difícil de navegar, especialmente en mobile.

---

## Requisitos de Accesibilidad

**Del proyecto (CLAUDE.md):**
- Mobile-first, sin carruseles en hero
- CTA de WhatsApp a un tap de distancia
- Reseñas cerca del CTA

**De Apple Design Guidelines:**
- No usar scroll infinito o lazy loading sin alternativa
- Navegación clara y predecible
- Touch targets ≥44×44 pt
- No ocultar contenido crítico sin indicador visual
- Soporte para keyboard + screen reader

---

## Opciones de Expansión

### Opción 1: Mantener estructura actual (3 cat × 4 prod)
**Mejor para:** Negocio pequeño, catálogo estable

**Ventajas:**
- ✅ Página corta, carga rápido
- ✅ Todo visible sin scroll excesivo
- ✅ Accesible por defecto
- ✅ Diseño equilibrado

**Desventajas:**
- ❌ Límite artificial en productos
- ❌ Categorías fijas

**Uso:** Mantenemos como está. Cambiar productos sí, pero no agregar categorías nuevas.

---

### Opción 2: Collapsible Categories (Acordeones)
**Mejor para:** 5-10 categorías, 4-6 productos cada una

Cada categoría es un "acordeón" (expandible/colapsible):

```html
<details>
  <summary>Impresiones y anillados (4 productos)</summary>
  <div class="category-grid">
    <!-- 4 tarjetas -->
  </div>
</details>
```

**Ventajas:**
- ✅ Escalable: agregar categorías sin romper layout
- ✅ Accesible: `<details>/<summary>` nativo, funciona con keyboard
- ✅ Screen reader friendly: "button, expanded/collapsed"
- ✅ Móvil: todo cabe en un scroll corto
- ✅ Sin JavaScript extra

**Desventajas:**
- ❌ Menos visual en desktop
- ⚠️ Usuario ve "cerrados" y debe expandir (fricción)

**Criterio de accesibilidad:** ✅ EXCELENTE
- Semántica HTML nativa
- Keyboard: Tab + Space/Enter para expandir
- Screen reader: "Impresiones y anillados, button, not expanded, 4 productos"

**Implementación:**
```css
details { 
  border-bottom: 1px solid var(--line);
  padding: 20px 0;
}
summary {
  cursor: pointer;
  font-weight: 600;
  padding: 12px;
  user-select: none;
}
summary:hover { background: var(--paper-alt); }
summary:focus-visible { outline: 3px solid var(--navy); }
details[open] summary { color: var(--mustard); }
```

---

### Opción 3: Tab Navigation (Pestañas)
**Mejor para:** 4-6 categorías principales, diseño desktop-forward

Tabs en el top del mercadito:

```
┌─────────────────────────────────────┐
│ Impresiones │ Útiles │ Arte │ Otros │
└─────────────────────────────────────┘
    Mostrando: Impresiones (4 productos)
```

**Ventajas:**
- ✅ Acceso rápido a todas las categorías
- ✅ Muy visual
- ✅ Desktop-friendly
- ✅ Muestra todas las opciones

**Desventajas:**
- ❌ En mobile, los tabs se apilan o desbordan
- ⚠️ Screen reader: "4 of 8 tabs focused" (puede ser confuso)
- ❌ Más JavaScript para sincronizar estado

**Criterio de accesibilidad:** 🟡 BUENO (pero requiere trabajo)
- Necesita ARIA roles: `role="tablist"`, `role="tab"`, `aria-selected`
- Keyboard: Arrow keys para navegar, Enter para activar
- Screen reader: "Tab list, 4 tabs"

**Problema en mobile:** Tabs se cortan. Soluciones:
1. Scroll horizontal (menos ideal, difícil de descubrir)
2. Dropdown en mobile (accesible pero pierde visual)
3. Stack vertical en mobile (pierde el beneficio de tabs)

---

### Opción 4: Filter/Sort + Full List (Recomendado)
**Mejor para:** 10+ categorías, 5+ productos por categoría

Mostrar todos los productos con filtro por categoría:

```
┌──────────────────────┐
│ Filtrar por: ▼       │  ← Dropdown accesible
│ • Todas              │
│ • Impresiones        │
│ • Útiles             │
│ • Arte               │
└──────────────────────┘

12 productos encontrados:
[Tarjeta 1] [Tarjeta 2] [Tarjeta 3] [Tarjeta 4]
[Tarjeta 5] [Tarjeta 6] [Tarjeta 7] [Tarjeta 8]
...
```

**Ventajas:**
- ✅ Escalable a 20+ categorías
- ✅ Usuario ve el conteo ("12 productos encontrados")
- ✅ Filtro dropdown accesible nativo
- ✅ Fácil de agregar nuevas categorías

**Desventajas:**
- ❌ Muchos productos = scroll largo
- ❌ Requiere JavaScript para filtrado
- ⚠️ Si hay >50 productos, necesita paginación

**Criterio de accesibilidad:** ✅ EXCELENTE
- Dropdown HTML nativo: `<select>`
- Screen reader: "Filter, menu, Impresiones selected, 1 of 3"
- Keyboard: Tab, Arrow keys, Enter
- Anuncio de cambios: "Showing 4 products" con `aria-live="polite"`

**Implementación (sin frameworks):**
```html
<div class="filter-section">
  <label for="category-filter">Filtrar por:</label>
  <select id="category-filter">
    <option value="">Todas</option>
    <option value="impresiones">Impresiones y anillados</option>
    <option value="utiles">Útiles escolares</option>
    <option value="arte">Arte y manualidades</option>
  </select>
</div>

<div aria-live="polite" aria-atomic="true" class="results-count">
  Mostrando 12 productos
</div>

<div class="product-grid" id="productGrid">
  <!-- Tarjetas filtradas -->
</div>
```

```js
const filter = document.getElementById('category-filter');
const grid = document.getElementById('productGrid');
const count = document.querySelector('.results-count');

filter.addEventListener('change', (e) => {
  const selected = e.target.value;
  const cards = grid.querySelectorAll('.product-card');
  let shown = 0;

  cards.forEach(card => {
    if (!selected || card.dataset.category === selected) {
      card.style.display = '';
      shown++;
    } else {
      card.style.display = 'none';
    }
  });

  count.textContent = `Mostrando ${shown} producto${shown !== 1 ? 's' : ''}`;
});
```

---

## Recomendación por Caso

### Si es pequeño y estable (< 20 productos totales)
→ **Opción 1 (status quo)** — No cambiar nada. Funciona perfecto.

### Si van a crecer a 20-30 productos
→ **Opción 2 (Collapsible)** — Acordeones. Accesible, escalable, fácil de implementar.

### Si van a tener 30+ productos con muchas categorías
→ **Opción 4 (Filter dropdown)** — Lo más escalable y accesible.

### Evitar
❌ **Opción 3 (Tabs)** — Difícil de hacer accesible en mobile, y el cliente es mobile-first.
❌ Carruseles de categorías — Bajan conversión (CLAUDE.md: "nada de carruseles")
❌ Infinite scroll — Difícil de manejar en accesibilidad, nunca llegan al footer

---

## Plan de Implementación (Opción 2: Collapsible)

Si deciden expandir con acordeones:

### Paso 1: Cambiar estructura del HTML
```html
<!-- Hoy: <div class="shop-group"> con categoría hardcoded -->
<!-- Mañana: -->
<details class="shop-group" open>
  <summary>
    <h3>Impresiones y anillados</h3>
    <span class="product-count">4 productos</span>
  </summary>
  <div class="product-grid">
    <!-- Tarjetas aquí -->
  </div>
</details>
```

### Paso 2: CSS
```css
details {
  border-bottom: 1px solid var(--line);
  padding: 30px 0;
}

summary {
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  user-select: none;
  padding: 12px;
  border-radius: 8px;
}

summary:hover {
  background: var(--paper-alt);
}

summary:focus-visible {
  outline: 3px solid var(--navy);
  outline-offset: 4px;
}

summary > h3 {
  flex: 1;
}

.product-count {
  font-size: 0.9rem;
  color: var(--ink-soft);
  font-weight: 400;
}

/* Animación suave al expandir */
details[open] summary {
  color: var(--mustard);
}

/* Respetar prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  details {
    transition: none;
  }
}
```

### Paso 3: JavaScript (opcional, mejora UX)
```js
// Al hacer click en una categoría, scroll smooth a ella
document.querySelectorAll('details').forEach(detail => {
  detail.addEventListener('toggle', () => {
    if (detail.open) {
      detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});
```

### Paso 4: Testing accesibilidad
- ✅ Keyboard: Tab → Espacio → expande/colapsa
- ✅ Screen reader: "Impresiones y anillados, button, expanded, 4 productos"
- ✅ Mobile: todos los acordeones caben en pantalla
- ✅ Dark mode: colores visibles
- ✅ Tap targets: summary ≥44px de altura

---

## Timing

**Ahora:** Mantener Opción 1. Está perfecto.

**Si expanden a 20+ productos:** Migrar a Opción 2 (Collapsible) — es cambio mínimo, máxima accesibilidad.

**Si llegan a 40+ productos:** Considerar Opción 4 (Filter dropdown) — pero probablemente ya tengan un ecommerce proper.

---

## Preguntas para el cliente

1. **¿Cuántos productos piensan tener en 3 meses?**
2. **¿Las categorías son fijas o van a cambiar?**
3. **¿Hay productos que se venden más?** (podría justificar filtros por "bestsellers")
4. **¿Cada producto tiene variantes?** (color, tamaño, etc.) — esto cambiaría la estructura

---

**Resumen:** Hoy está bien como está. Cuando crezcan, acordeones + dropdown. Fácil, accesible, escalable.
