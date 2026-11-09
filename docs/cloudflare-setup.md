# Puesta en marcha en Cloudflare

Cómo queda montado el sitio cuando el catálogo sale de una base y la dueña lo carga desde
el panel, en vez de editar una planilla.

> **Antes de seguir, leé [Lo que no pude verificar](#lo-que-no-pude-verificar) al final.**
> Esta guía se escribió sin acceso a la documentación de Cloudflare, así que los nombres
> exactos de los menús del panel pueden haber cambiado. Los conceptos y el orden son los
> correctos; si un menú no se llama igual, buscá el equivalente.

---

## Qué vamos a montar

```
Cloudflare Pages ── sirve el sitio (src/)
      └── Pages Functions ── la API (functions/)
            GET    /api/productos      público
            POST   /api/productos      protegido
            PUT    /api/productos/:id  protegido
            DELETE /api/productos/:id  protegido
            POST   /api/imagenes       protegido
            GET    /img/:clave         público
      ├── D1 ── la tabla productos
      └── R2 ── las fotos

Cloudflare Access ── corta /admin.html antes de que se sirva
```

Nada de esto tiene servidor que mantener. El costo esperado para una librería de barrio es
cero, salvo por lo que se aclara más abajo sobre R2.

---

## El orden importa

La migración tiene que hacerse en este orden para que el sitio nunca quede mostrando datos
que no son:

1. Montar Cloudflare (pasos 1 a 7).
2. Cargar los productos en D1.
3. Verificar que `/api/productos` devuelva el catálogo real.
4. Recién ahí, publicar la rama y apagar el deploy viejo (paso 8).

**No publiques el sitio nuevo antes del punto 3.** El código de `src/index.html` ya no sabe
leer la planilla: si la base está vacía o la API no responde, la página cae a los productos
de ejemplo que están escritos en el HTML, con precios que no son los reales.

---

## 1. La base (D1)

```bash
npx wrangler login
npx wrangler d1 create neneko
```

El comando imprime un `database_id`. Guardalo, hace falta en el paso 4.

Aplicá el esquema:

```bash
npx wrangler d1 execute neneko --remote --file=db/schema.sql
```

`--remote` es importante: sin eso escribe en una copia local y la base de producción queda
vacía.

Para confirmar que quedó bien:

```bash
npx wrangler d1 execute neneko --remote --command="select name from sqlite_master where type='table'"
```

Tiene que aparecer `productos`.

---

## 2. Las fotos (R2)

```bash
npx wrangler r2 bucket create neneko-imagenes
```

No hace falta hacerlo público: las fotos se sirven por `/img/...`, que las lee del bucket
desde el Worker. Eso las deja en el mismo dominio que el sitio, evita CORS, y hace que las
rutas guardadas en la base sobrevivan un cambio de dominio.

---

## 3. El proyecto en Pages

En el panel de Cloudflare: **Workers & Pages → Create → Pages → conectar a Git**, y elegí
el repositorio `mateoamagnani/Libreria-Neneko`.

Configuración de build:

| Campo | Valor |
|---|---|
| Framework preset | None |
| Build command | `npm test` |
| Build output directory | `src` |

**El build command no es un detalle.** El deploy actual no publica si los tests fallan, y
esa red ya salvó al sitio: hubo seis semanas en que `main` tenía cambios rotos y no se
publicaron. Pages, por defecto, buildea y publica igual. Poner `npm test` como build command
reproduce el portón: si los tests fallan, el build falla y no se publica nada.

Como no hay build step de verdad, `npm test` es todo el "build". El contenido que se publica
es `src/` tal cual.

---

## 4. Conectar la base y el bucket

En el proyecto de Pages: **Settings → Functions** (o **Bindings**, según la versión del
panel), y agregá dos bindings **para producción y también para preview**:

| Tipo | Nombre del binding | Apunta a |
|---|---|---|
| D1 database | `DB` | `neneko` |
| R2 bucket | `IMAGENES` | `neneko-imagenes` |

Los nombres `DB` e `IMAGENES` tienen que ser exactamente esos: son los que el código usa
(`env.DB`, `env.IMAGENES`).

---

## 5. Cloudflare Access para el panel

Esto es lo que decide quién entra a `/admin.html`.

En **Zero Trust → Access → Applications → Add an application → Self-hosted**:

- **Nombre:** Panel Neneko
- **Dominio:** el de tu sitio, con path `/admin.html`

Agregá una política:

- **Nombre:** La dueña
- **Acción:** Allow
- **Regla:** Emails → el mail de la dueña

Cuando guardes, la aplicación muestra un **Application Audience (AUD) Tag**. Es una cadena
larga de hexadecimal. Copiala.

También necesitás tu **team domain**, que tiene la forma `algo.cloudflareaccess.com`.

### ⚠️ No protejas `/api/*` con Access

Access filtra por ruta, no por método. Si protegés `/api/*` entero, también bloqueás el
`GET` público y **el sitio deja de mostrar productos a los visitantes**.

Protegé solo `/admin.html`. La API se defiende sola: el Worker verifica el token de Access
en el código, y eso ya está probado. Los pedidos del panel viajan con la cookie
`CF_Authorization`, que el Worker lee y valida.

---

## 6. Las variables de Access

En el proyecto de Pages: **Settings → Environment variables**, para producción y preview:

| Variable | Valor |
|---|---|
| `ACCESS_TEAM_DOMAIN` | `algo.cloudflareaccess.com` (sin `https://`) |
| `ACCESS_AUD` | el AUD Tag del paso 5 |

**Si estas dos faltan, el Worker rechaza toda escritura.** Es deliberado: falla cerrada. La
alternativa cómoda —"si no hay configuración, no verifico"— convertiría un olvido al
desplegar en un catálogo abierto a cualquiera.

O sea que si el panel te dice "Falta configurar ACCESS_TEAM_DOMAIN o ACCESS_AUD", no es un
bug: es que estas variables no llegaron al entorno.

---

## 7. Probar antes de migrar

Con el primer deploy hecho, verificá en este orden:

```bash
# 1. La API pública responde (va a devolver lista vacía hasta que migres)
curl https://TU-SITIO.pages.dev/api/productos

# 2. Las escrituras están cerradas sin credencial
curl -X POST https://TU-SITIO.pages.dev/api/productos \
     -H 'content-type: application/json' \
     -d '{"categoria":"X","nombre":"Y"}'
```

El segundo tiene que devolver **403**. Si devuelve 201, **parás todo**: las variables del
paso 6 no están llegando y cualquiera puede escribir el catálogo.

Después, en el navegador:

3. Entrá a `https://TU-SITIO.pages.dev/admin.html`. Tiene que pedirte identificarte con
   Access. Si entra directo, la política del paso 5 no está aplicando.
4. Probá desde una ventana privada con otro mail: tiene que rechazarte.

---

## 8. Migrar y apagar lo viejo

Una vez que los cuatro puntos del paso 7 dan bien:

1. Cargá los productos en D1 (el SQL de migración sale de los CSV de la planilla).
2. Verificá que `/api/productos` devuelva el catálogo real, no la lista vacía.
3. Entrá al sitio y confirmá que los precios son los correctos.
4. Recién ahora, apagá el workflow viejo de GitHub Pages
   (`.github/workflows/deploy.yml`), para que no haya dos sitios publicados diciendo cosas
   distintas.
5. La planilla se puede archivar. No la borres el mismo día: si algo sale mal, es el único
   lugar donde están los datos originales.

---

## Después, para la dueña

El panel vive en `https://TU-SITIO.pages.dev/admin.html`. Conviene que lo guarde en la
pantalla de inicio del teléfono.

La primera vez le va a pedir el mail y le va a llegar un código. Access recuerda la sesión un
tiempo, así que no se lo va a pedir todos los días.

---

## Lo que no pude verificar

Esta guía se escribió sin acceso a internet, así que no pude contrastarla con la
documentación de Cloudflare. Lo que sé con confianza es la arquitectura, el orden de los
pasos y los nombres que usa **nuestro** código (`DB`, `IMAGENES`, `ACCESS_TEAM_DOMAIN`,
`ACCESS_AUD`). Lo que puede haber cambiado:

- **Los nombres exactos de los menús del panel.** Cloudflare los reacomoda seguido. Si no
  encontrás "Settings → Functions", buscá "Bindings".
- **Si R2 pide tarjeta.** Tiene capa gratuita, pero no sé si hoy exige medio de pago para
  activarse. Si lo exige y no querés darlo, decímelo: las fotos son la única pieza que
  habría que replantear; todo lo demás queda igual.
- **Los límites del plan gratis** de D1, R2, Pages y Access. Para el volumen de una librería
  de barrio deberían sobrar por mucho, pero no te puedo dar los números actuales.
- **Si Pages sigue usando "Build command" y "Build output directory"** con esos nombres.

Cuando tenga acceso a la documentación puedo revisar esta guía y corregir lo que haga falta.
