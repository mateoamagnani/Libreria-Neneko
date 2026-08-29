# Google Setup — Guía paso a paso para la dueña

Esta guía es para cuando hagas el setup con la dueña en vivo. Está pensada para parecer que ya lo hiciste varias veces.

---

## 1. Google Business Profile (15 min + 2-5 días de verificación)

**Qué es:** Tu perfil en Google Maps y Google Search. Es lo que ve la gente cuando busca "librería cerca de mí" o "Librería Neneko".

### Paso 1.1: Crear la cuenta
1. Abrí [google.com/business](https://google.com/business)
2. Clickeá **"Crear una cuenta"** (o si ya tiene Google, usá esa)
3. Poné el nombre del negocio: **"Librería Neneko"**

### Paso 1.2: Rellenar información básica
En el formulario, completá:
- **Nombre del negocio:** Librería Neneko
- **Categoría principal:** Papelería y escritorio (o "Librería")
- **Dirección completa:** Peña 3102, Ciudad Autónoma de Buenos Aires, CABA
- **Teléfono:** +54 9 11 6169-1209
- **Dirección:** Peña 3102, esquina Billinghurst (a metros de Coronel Díaz)
- **Sitio web:** https://mateoamagnani.github.io/Libreria-Neneko/

**⚠️ CRÍTICO:** Los datos tienen que coincidir exactamente con:
- El sitio web (src/index.html)
- Google Search Console
- Google Analytics
- Los datos del JSON-LD del sitio

Si hay inconsistencia, Google baja el ranking. Este es el "NAP" (Name, Address, Phone).

### Paso 1.3: Horarios
Clickeá **"Agregar horarios"** y poné:
- **Lunes a viernes:** 11:30 – 20:30
- **Sábado:** 11:30 – 15:30
- **Domingo:** Cerrado

(Si después cambia el horario, lo updatea acá. Google lo ve.)

### Paso 1.4: Subir fotos
Google pedirá fotos del local.
- Sacá 5-10 fotos del interior del negocio
- Una del frente con el cartel visible
- Una del mostrador
- Una de los productos/estantes
- Una de la gente (si hay clientes contentos, mejor)

**Importante:** Las fotos deben verse profesionales. Si están borrosas u oscuras, Google las rechaza.

### Paso 1.5: Verificación
Google enviará una postal por correo (2-5 días). La postal tiene un código.
- Cuando llegue, abrí el Business Profile
- Clickeá **"Verificar"**
- Poné el código de la postal

Hasta que no verifique, el perfil es "no verificado" y los datos no sirven para posicionamiento.

### Paso 1.6: Después de verificar
- Clickeá en **"Fotos"** y sube más imágenes (Google premia fotos recientes)
- Agregá **"Categorías secundarias":** si vende cosas específicas (ej. "Artículos de oficina", "Copias"), agregalas
- Agregá **"Atributos":** si acepta efectivo, tarjeta, retiro en el local, etc.

---

## 2. Google Search Console (5 min)

**Qué es:** Es donde le decís a Google "hey, mi sitio existe, indexalo" y ves si hay errores de posicionamiento.

### Paso 2.1: Entrar a Search Console
1. Abrí [search.google.com/search-console](https://search.google.com/search-console)
2. Clickeá **"Agregar propiedad"**
3. Pegá la URL del sitio: `https://mateoamagnani.github.io/Libreria-Neneko/`

### Paso 2.2: Verificar la propiedad
Google ofrece varias formas de verificar. La más fácil es:
1. Clickeá **"Meta etiqueta HTML"**
2. Copiá el código que te da (algo como `<meta name="google-site-verification" content="...">`)
3. Pasaselo a Claude para que lo agregue al sitio (en el `<head>`)
4. Guardá y esperá 1-2 días

(Google también puede verificar por DNS, pero es más complejo. Usá la meta etiqueta.)

### Paso 2.3: Después de verificar
Dos cosas importantes:

#### 2.3a: Enviar el sitemap
1. Entrá a Search Console
2. Clickeá **"Sitemaps"** (menú izquierdo)
3. Poné: `sitemap.xml`
4. Clickeá **"Enviar"**

El sitemap es un archivo que enumera todas las páginas del sitio para que Google las indexe rápido.

#### 2.3b: Revisar errores
Cada mes, abrí Search Console y mirá:
- **Cobertura:** ¿Google logró indexar la página? Si hay errores en rojo, hay que fijarlos.
- **Rendimiento:** ¿Por qué palabras la gente llega a tu sitio? Esto te dice qué términos buscan tus clientes.
- **Mobile usability:** ¿El sitio se ve bien en celular? (Debería, ya que es mobile-first.)

---

## 3. Google Analytics (10 min)

**Qué es:** Te muestra cuánta gente entra al sitio, de dónde viene, qué hace, y si hace clic en WhatsApp.

### Paso 3.1: Crear la cuenta
1. Abrí [analytics.google.com](https://analytics.google.com)
2. Clickeá **"Crear una cuenta"** (o usá Google existente)
3. Nombre de la cuenta: **"Librería Neneko"**
4. Nombre de la propiedad: **"Web"**

### Paso 3.2: Crear una vista
Se llama "Stream" en la versión nueva. Poné:
- **Nombre del stream:** "Sitio web"
- **URL:** `https://mateoamagnani.github.io/Libreria-Neneko/`
- **Industria:** Retail (o "Otros")

### Paso 3.3: Instalar el código
Google te da un código de seguimiento (tracking ID, algo como `G-XXXXXXXXXX`).

Opción A (si no querés tocar código):
- Copiá el código
- Pasaselo a Claude para que lo agregue al sitio
- Esperá 24 horas a que comience a registrar

Opción B (si querés hacerlo):
- El código va dentro del `<head>` del HTML
- Es un `<script>` que llama a un archivo de Google

### Paso 3.4: Verificar que funcione
1. Abrí el sitio en una pestaña
2. Abrí Google Analytics en otra pestaña
3. En Analytics, clickeá **"Realtime"** (tiempo real)
4. Si te ve, debería aparecer "1 usuario activo" en 10 segundos

### Paso 3.5: Qué revisar cada mes
Abrí Analytics todos los meses y mirá:

**Usuarios:**
- ¿Cuánta gente entra? (Esperamos que crezca con el tiempo)
- ¿De dónde vienen? (Google Search, Google Maps, WhatsApp, directo, etc.)

**Eventos (importante):**
- ¿Cuántos hacen clic en "Pedir por WhatsApp"? (Este es el KPI = Indicador Clave)
- Si baja, hay que revisar por qué

**Duración de la sesión:**
- ¿Cuánto tiempo pasa la gente en el sitio? (Si es muy corto, puede que el sitio no sea atractivo)

**Dispositivo:**
- ¿Cuántos vienen de móvil vs. desktop? (Esperamos >70% móvil)

---

## Checklist: Orden de implementación

### Semana 1 (Setup)
- [ ] Google Business Profile creado y datos completados
- [ ] Postal de verificación enviada por Google
- [ ] Google Search Console verificado
- [ ] Sitemap enviado a Search Console
- [ ] Google Analytics código agregado al sitio

### Semana 2-3 (Verificación)
- [ ] Postal de Google Business Profile llegó
- [ ] Google Business Profile verificado
- [ ] Analytics muestra usuarios en tiempo real
- [ ] Buscar "Librería Neneko" en Google Maps → aparezca el perfil

### Después (Mantenimiento)
- [ ] Revisar Analytics 1 vez por semana (al menos)
- [ ] Actualizar horarios en Google Business si cambian
- [ ] Subir fotos nuevas del local cada mes
- [ ] Responder reseñas en Google Business Profile

---

## Errores comunes (evitar)

❌ **Datos inconsistentes:** Si el teléfono en el sitio es diferente al de Google Business, Google se confunde.

❌ **No verificar Google Business:** El perfil sin verificar no sirve de nada.

❌ **No enviar el sitemap:** Google puede no indexar la página rápido.

❌ **Ignorar Analytics:** Si no miras los números, no sabés si funciona o no.

❌ **Cambiar datos sin avisar:** Si actualizás el horario en el sitio pero no en Google Business, hay inconsistencia.

---

## URLs de referencia (guardar)

- Google Business Profile: https://business.google.com
- Google Search Console: https://search.google.com/search-console
- Google Analytics: https://analytics.google.com
- Analytics en tiempo real: https://analytics.google.com/analytics/web/#/report/realtimeaudience

---

## Después del setup: Próximas fases

**Fase 2 (1-2 meses):** Pedir reseñas a clientes en Google Business. Las reseñas suben el ranking.

**Fase 3 (3-6 meses):** Si ves en Search Console que buscan "fotocopias CABA" pero no aparezco, hacer SEO local (optimizar palabras clave, agregar contenido, backlinks).

**Fase 4 (6+ meses):** Si el volumen de consultas sube mucho, considerar un bot de WhatsApp para responder automáticamente.

---

**Resumen en una frase:** Crea Google Business Profile (para Maps), verifica en Search Console (para indexación), y agrega Analytics (para medir). En ese orden.
