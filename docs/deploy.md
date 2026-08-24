# Publicar el sitio

El sitio es un archivo HTML estático sin build step, así que se puede publicar en cualquier
hosting de estáticos. El repo viene configurado para **GitHub Pages**, que es gratis y no
necesita cuenta en ningún otro lado.

---

## GitHub Pages (lo que está configurado)

### Activarlo, una sola vez

1. En GitHub: **Settings → Pages**
2. En *Source*, elegí **GitHub Actions** (no "Deploy from a branch")
3. Listo

A partir de ahí, cada push a `main` que toque `src/` publica el sitio solo.

La URL va a ser:

```
https://mateoamagnani.github.io/Libreria-Neneko/
```

Es la que ya está puesta en el `canonical`, los `og:*` y el JSON-LD de `src/index.html`.

### Qué hace el workflow

[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml):

1. Corre los tests
2. **Si fallan, no publica nada**
3. Sube el contenido de `src/` a Pages

Se puede disparar a mano desde la pestaña **Actions → Publicar el sitio → Run workflow**.

### Por qué solo `src/`

Se publica `src/`, no la raíz del repo. Así los docs internos, el workflow de n8n y las
skills no quedan colgando en una URL pública.

---

## Dominio propio

Cuando compres un dominio (algo tipo `librerianeneko.com.ar`):

1. En el registrador, apuntá el dominio a GitHub Pages:
   - Registros `A` de la raíz → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `CNAME` de `www` → `mateoamagnani.github.io`
2. En **Settings → Pages → Custom domain**, poné el dominio y esperá el certificado HTTPS
3. Creá `src/CNAME` con el dominio adentro (una línea, sin `https://`)
4. **Actualizá las URLs en el código**, o Google va a seguir indexando la vieja:
   - `<link rel="canonical">` en `src/index.html`
   - `og:url` en `src/index.html`
   - los tres campos de URL del JSON-LD en `src/index.html`
   - `src/robots.txt`
   - `src/sitemap.xml`

---

## Alternativa: Vercel

Si en algún momento hace falta algo que Pages no da (redirects, headers, funciones), Vercel
levanta este repo sin configuración:

```bash
npx vercel --prod
```

Cuando pregunte por el directorio del proyecto, respondé `src`. No hay build command.

El repo tiene instaladas las skills `deploy-to-vercel` y `vercel-cli-with-tokens` si se
quiere automatizar.

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
