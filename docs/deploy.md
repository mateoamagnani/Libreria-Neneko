# Publicar el sitio

> **En transición.** Hoy el sitio se publica en **GitHub Pages**, que es lo que describe la
> primera parte de este documento y sigue siendo cierto. Está en marcha la mudanza a
> **Cloudflare Pages**, necesaria porque el catálogo pasó a vivir en una base y el panel de
> la dueña necesita una API y autenticación — cosas que un hosting de estáticos puro no da.
> La puesta en marcha completa está en [`cloudflare-setup.md`](./cloudflare-setup.md).

---

## Hoy: GitHub Pages

### Activarlo, una sola vez

1. En GitHub: **Settings → Pages**
2. En *Source*, elegí **GitHub Actions** (no "Deploy from a branch")
3. Listo

A partir de ahí, cada push a `main` que toque `src/` publica el sitio solo.

La URL es:

```
https://mateoamagnani.github.io/Libreria-Neneko/
```

Es la que está puesta en el `canonical`, los `og:*` y el JSON-LD de `src/index.html`.

### Qué hace el workflow

[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml):

1. Corre los tests
2. **Si fallan, no publica nada**
3. Sube el contenido de `src/` a Pages

Se puede disparar a mano desde la pestaña **Actions → Publicar el sitio → Run workflow**.

Ese punto 2 no es decorativo. En septiembre de 2026 los tests quedaron en rojo y el deploy
dejó de publicar durante seis semanas sin que nadie lo notara: el sitio seguía en línea,
sirviendo una versión vieja. Si algún cambio no aparece publicado, **lo primero que hay que
mirar es si el último run falló**, no el caché del navegador.

### Por qué solo `src/`

Se publica `src/`, no la raíz del repo. Así los docs internos y las skills no quedan
colgando en una URL pública.

---

## Mañana: Cloudflare Pages

### Por qué se muda

El sitio dejó de ser solo estático. Ahora tiene:

- una base de productos (D1) que alguien tiene que consultar,
- un panel de carga que necesita autenticación de verdad,
- fotos que la dueña sube desde el teléfono.

GitHub Pages no puede correr código del lado del servidor, así que no hay forma de hacer
nada de eso ahí sin inventar un backend aparte.

### Qué cambia

| | GitHub Pages | Cloudflare Pages |
|---|---|---|
| Quién publica | el workflow de Actions | Pages, conectado al repo |
| El portón de los tests | `npm test` en el workflow | `npm test` como build command |
| La API | no existe | `functions/` |
| El panel | no existe | `/admin.html`, cortado por Access |

**El portón tiene que viajar con la mudanza.** Pages, por defecto, buildea y publica aunque
los tests fallen. Poniendo `npm test` como build command se reproduce el comportamiento
actual: si fallan, el build falla y no se publica nada.

### El orden

Está detallado en [`cloudflare-setup.md`](./cloudflare-setup.md), pero lo importante es
esto: **no publiques el sitio nuevo hasta que la base tenga los productos cargados**.
`src/index.html` ya no sabe leer la planilla; si la API no responde, la página cae a los
productos de ejemplo del HTML y muestra precios que no son los reales.

Una vez que Cloudflare esté sirviendo el sitio correcto, hay que **apagar
`.github/workflows/deploy.yml`**, para que no queden dos sitios publicados diciendo cosas
distintas.

---

## Dominio propio

Cuando compres un dominio (algo tipo `librerianeneko.com.ar`), los pasos dependen de dónde
esté el sitio en ese momento.

**En Cloudflare Pages** (lo que va a aplicar después de la mudanza): en el proyecto,
**Custom domains → Set up a domain**. Si el dominio ya está en Cloudflare, el DNS y el
certificado se resuelven solos.

**En GitHub Pages** (mientras siga ahí):

1. En el registrador, apuntá el dominio:
   - Registros `A` de la raíz → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `CNAME` de `www` → `mateoamagnani.github.io`
2. En **Settings → Pages → Custom domain**, poné el dominio y esperá el certificado HTTPS
3. Creá `src/CNAME` con el dominio adentro (una línea, sin `https://`)

**En los dos casos**, actualizá las URLs en el código o Google va a seguir indexando la
vieja:

- `<link rel="canonical">` en `src/index.html`
- `og:url` en `src/index.html`
- los tres campos de URL del JSON-LD en `src/index.html`
- `src/robots.txt`
- `src/sitemap.xml`

Las fotos de los productos **no** hay que tocarlas: se guardan como rutas relativas
(`/img/...`) justamente para que sobrevivan un cambio de dominio.

---

## Después de publicar

Estas son las cosas que sí o sí conviene hacer una vez que el sitio está en línea:

- [ ] **Google Search Console**: dar de alta la propiedad y mandar
      `https://.../sitemap.xml`. Es la única forma de ver si Google lo está indexando bien.
- [ ] **Google Business Profile**: verificar que la dirección, el teléfono y el horario sean
      *idénticos* a los del sitio (consistencia NAP), y agregar el link a la web.
- [ ] **Probar el link en WhatsApp**: mandárselo a alguien y ver que la vista previa se arme
      bien. Si sale sin imagen, falta el `og:image` (ver pendientes en
      [`concepto-landing.md`](./concepto-landing.md)).
- [ ] **Correr una auditoría**: con las skills instaladas,
      `web-quality-audit` cubre performance, accesibilidad y SEO sobre la página ya publicada.
- [ ] **Verificar que las escrituras de la API estén cerradas** (solo después de la mudanza):
      un `POST` a `/api/productos` sin credencial tiene que dar 403. El paso 7 de
      [`cloudflare-setup.md`](./cloudflare-setup.md) tiene el comando.
