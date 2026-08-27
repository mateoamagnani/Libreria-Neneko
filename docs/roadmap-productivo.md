# Roadmap — Librería Neneko Productiva

## ¿Qué es esto?

Un plan de acciones para que el sitio web sea **realmente productivo** — no solo bonito, sino que traiga gente, que se conviertan en clientes, que el negocio crezca.

Está dividido en **fases**. Hacé lo que se pueda en cada una, en orden.

---

## ✅ Fase 0: Ya está hecho

- [x] Sitio web en vivo (GitHub Pages)
- [x] Logo integrado
- [x] Catálogo dinámico desde Google Sheets
- [x] Iconos semánticos
- [x] Móvil optimizado
- [x] WhatsApp CTA principal
- [x] Horario y ubicación visibles

---

## 🔴 Fase 1: Presencia en Google (URGENTE — hacer ya)

**Objetivo:** Que cuando alguien busque "librería CABA" o "fotocopias Peña", ustedes aparezcan.

### 1.1 Google Business Profile
- [ ] Entra a [google.com/business](https://google.com/business)
- [ ] Reclama el negocio "Librería Neneko"
- [ ] Completa: dirección, teléfono, horario, categoría
- [ ] Sube 5-10 fotos del local
- [ ] Verifica el negocio (Google envía una postal o llama)
- [ ] **Tiempo estimado:** 20 min + 2-5 días

### 1.2 Google Search Console
- [ ] Entra a [search.google.com/search-console](https://search.google.com/search-console)
- [ ] Verifica la propiedad con etiqueta meta
- [ ] Envía el sitemap (`sitemap.xml`)
- [ ] Revisa cada mes si hay errores
- [ ] **Tiempo estimado:** 10 min

### 1.3 Google Analytics
- [ ] Crea una cuenta en [analytics.google.com](https://analytics.google.com)
- [ ] Integra el código en el sitio
- [ ] Mira cada mes: cuánta gente entra, de dónde viene
- [ ] **Tiempo estimado:** 15 min

**Impacto:** 🔥🔥🔥 Crítico. Es la diferencia entre "sitio invisible" y "que aparezca en Google Maps".

---

## 🟡 Fase 2: Optimización para conversión (1-2 meses)

**Objetivo:** Que más gente que entra al sitio, escriba por WhatsApp.

### 2.1 Testear y mejorar CTA
- [ ] ¿La gente hace clic en el botón de WhatsApp?
- [ ] Mira en Google Analytics: ¿en qué sección abandonan?
- [ ] Si no usan WhatsApp, el problema es que no es visible
- [ ] Considera agregar más de un botón (uno en hero, uno al final)

### 2.2 Agregar testimonios/reseñas
- [ ] Pedile a clientes satisfechos que dejen una reseña en Google
- [ ] Muestra en el sitio: "★★★★★ 4.8 de 5" (si tienes > 10 reseñas)
- [ ] Google premia a negocio con buenas reseñas

### 2.3 Mejorar contenido
- [ ] ¿El hero explica claramente qué son? ("Librería con fotocopias y anillados")
- [ ] ¿El catálogo está actualizado? (precios, productos)
- [ ] ¿Los horarios están siempre correctos?

**Impacto:** 🔥🔥 Alto. Pequeños cambios pueden duplicar conversión.

---

## 🟠 Fase 3: Tráfico y posicionamiento (3-6 meses)

**Objetivo:** Que Google te envíe más búsquedas locales.

### 3.1 SEO local
- [ ] Asegúrate de que el nombre, dirección y teléfono **son iguales** en:
  - Sitio web
  - Google Business Profile
  - Google Maps
  - (Cualquier directorio local donde aparezcan)
- [ ] Google verifica que todo coincida → mejor ranking

### 3.2 Palabras clave estratégicas
- [ ] Mira en Search Console: ¿qué buscan para llegar?
- [ ] Si buscas "fotocopias CABA" y no aparecés, es oportunidad
- [ ] Agrega esas palabras en títulos y descripciones

### 3.3 Backlinks locales
- [ ] ¿Hay directorios de negocios locales? (ej: Páginas Amarillas)
- [ ] Pide que te agreguen
- [ ] Los links de otros sitios ayudan a posicionamiento

**Impacto:** 🔥 Medio-largo plazo, pero compuesto.

---

## 🟢 Fase 4: Automatización y WhatsApp Bot (6+ meses)

**Objetivo:** Responder preguntas comunes automáticamente.

### 4.1 Preparación
- [ ] ¿Cuáles son las preguntas más frecuentes?
  - "¿Qué horario?", "¿Hacen impresión color?", "¿Cuál es el precio?"
- [ ] ¿Vale la pena un bot o está bien que contesten ustedes?
- [ ] Si el volumen es alto, entonces sí

### 4.2 Implementar bot de WhatsApp (n8n)
- [ ] Conectar WhatsApp Business API
- [ ] Cargar el workflow `asistente-whatsapp.json`
- [ ] Testear: el bot responde automáticamente
- [ ] Humanos pueden tomar el chat si es complicado
- [ ] **Requiere:** hosting (Vercel, Railway) + credenciales de Meta

**Impacto:** 🟡 Reduce carga manual, mejora velocidad de respuesta.

---

## 🔵 Fase 5: Monetización inteligente (opcional)

**Objetivo:** Si en el futuro consideran vender online.

### 5.1 Carrito de compras + checkout
- Esto **SÍ requiere** un servidor backend, base de datos, etc.
- Solo si entienden que vale la pena

### 5.2 Combo alternativo: Google Shopping
- Mostrar precios en Google Shopping (sin carrito)
- La gente ve precios → escribe por WhatsApp
- Más fácil que un carrito, menos complejidad

**Impacto:** 🟢 Largo plazo. Primero validá si se necesita.

---

## 📊 Cómo saber si funciona

Cada mes, revisá:

| Métrica | Herramienta | Qué significa |
|---------|-------------|---|
| Visitas/mes | Google Analytics | ¿Entra más gente? |
| Clics a WhatsApp | Google Analytics (eventos) | ¿Escriben? |
| Búsquedas que llevan tráfico | Search Console | ¿Por qué palabras? |
| Posición en Google | Search Console | ¿Subo en ranking? |
| Reseñas y calificación | Google Business | ¿Qué opinan los clientes? |

---

## 🎯 Checklist ahora mismo

**Esta semana:**
- [ ] Crear Google Business Profile
- [ ] Verificar Search Console
- [ ] Enviar sitemap

**Este mes:**
- [ ] Agregar Google Analytics
- [ ] Pedir 5 reseñas a clientes

**Este trimestre:**
- [ ] Revisar Search Console cada semana
- [ ] Si falta tráfico, mejorar SEO local

---

## Preguntas frecuentes

**P: ¿Cuánto tarda en ver resultados?**  
R: Google Business → 1-2 semanas. Search Console → 1-2 meses. Bot → depende si lo hacen.

**P: ¿Necesito contratar a alguien?**  
R: Para Fase 1 y 2, no. Vos lo hacés. Fase 4 (bot) podría necesitar ayuda técnica.

**P: ¿Cuesta dinero?**  
R: Google Tools = gratis. Hosting para bot (si lo hacen) = ~$5-20/mes. Dominio propio = ~$100/año (opcional).

**P: ¿Y si no ando con tiempo?**  
R: Prioridad: (1) Business Profile, (2) Search Console. El resto puede esperar.

---

**Última actualización:** 27 de agosto, 2026  
**Responsable:** Mateo Amagnani
