# Configuración de Google Analytics 4

## Por qué necesitamos Analytics

Medir cuántos visitantes llegan a la página y cuántos cliquean "Pedir por WhatsApp" es crítico para:
- Entender si el sitio está trayendo clientes reales
- Saber cuál es tu mejor canal de marketing
- Ajustar el copy si la conversión baja

## Setup en 5 minutos

### 1. Crear propiedad en Google Analytics
- Ve a [analytics.google.com](https://analytics.google.com)
- Inicia sesión con tu cuenta de Google
- Haz clic en **"Crear"** (esquina inferior izquierda)
- Elige **"Propiedad"**
- Nombre: "Librería Neneko"
- Zona horaria: America/Argentina/Buenos_Aires
- Moneda: ARS

### 2. Crear stream web
- Haz clic en **"Crear stream"**
- Plataforma: **Web**
- URL del sitio: `https://mateoamagnani.github.io/Libreria-Neneko/`
- Nombre del stream: "Neneko Web"

### 3. Copiar el Measurement ID
- Se verá como `G-XXXXXXXXXX` (11 caracteres)
- Cópialo

### 4. Reemplazar en el código
En `src/index.html`, busca `G-XXXXXXXXXX` (aparece 2 veces) y reemplazá con tu ID:

```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-TUMEDIDAAQUI"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-TUMEDIDAAQUI');
</script>
```

### 5. Verificar que funciona
- Espera 5-10 minutos
- Abre Analytics en otra pestaña
- Ve a **Real-time → Overview**
- Visita tu sitio en el navegador
- Deberías ver "1 active user" en Analytics

## Qué se mide automáticamente

✅ **Visitantes:** Cantidad de personas, de dónde llegan (Google, WhatsApp, etc)  
✅ **Páginas:** Cuál se visita más, cuánto tiempo pasan  
✅ **Dispositivos:** Mobile vs desktop  
✅ **Geografía:** Barrio, ciudad (aproximado)  

## Agregar eventos personalizados (opcional)

Para medir cuántos cliquean en "Pedir por WhatsApp", agregá este código en el `<script>` principal de `index.html`:

```javascript
// Rastrear clics en WhatsApp
document.querySelectorAll('a[href*="wa.me"]').forEach(link => {
  link.addEventListener('click', () => {
    gtag('event', 'whatsapp_click', {
      'event_category': 'conversion',
      'event_label': 'Pedir por WhatsApp'
    });
  });
});
```

Luego en Analytics verás los eventos en **Events → <custom_event> → whatsapp_click**.

## Dashboards útiles

Una vez configurado, ve a:
- **Real-time → Overview** — Quién está visitando ahora
- **Acquisition → All traffic** — De dónde vienen
- **Engagement → Pages and screens** — Qué se visita más
- **Retention → Day active users** — Cuántos vuelven

## Privacidad

Google Analytics cumple GDPR/CCPA. Como **no recopilás datos sensibles** (no hay login, no hay checkout), no necesitás cookie banner. La política de privacidad ya explica que usamos Analytics.

---

**Tiempo total:** ~5 minutos de setup + 10 minutos de espera para que Google registre datos  
**Costo:** $0 (Google Analytics 4 es gratis)
