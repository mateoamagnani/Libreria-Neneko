# Puesta en marcha en Cloudflare

Cómo queda montado el sitio cuando el catálogo sale de una base y la dueña lo carga desde
el panel, en vez de editar una planilla.

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
      └── D1 ── los productos y las fotos

Cloudflare Access ── corta /admin.html antes de que se sirva
```

Una sola base para todo. Las fotos también viven ahí: ver [Costos](#costos) para entender
por qué, que es la razón de la que cuelga medio diseño.

---

## Costos

**Todo entra en los planes gratuitos, por varios órdenes de magnitud.** Los números están
verificados contra la documentación de Cloudflare en noviembre de 2026:

| Pieza | Lo que da gratis | Lo que usa una librería de barrio |
|---|---|---|
| Pages (archivos del sitio) | Ilimitado | — |
| Pages Functions | 100.000 pedidos/día | Cientos |
| D1 lecturas | 5.000.000 filas/día | Cientos |
| D1 escrituras | 100.000 filas/día | Decenas |
| D1 almacenamiento | 500 MB por base | Unos pocos MB |
| Access | Plan Free | 1 usuaria |

**Si se pasara de los límites, D1 devuelve error; no factura.** Está dicho explícitamente en
la documentación. O sea que el peor caso de un pico de tráfico es que el catálogo no cargue
un rato, no una cuenta que pagar.

### Por qué las fotos van en la base y no en R2

R2 es el almacenamiento de archivos de Cloudflare y sería el lugar natural para las fotos.
**Se descartó porque obliga a pasar por un flujo de checkout y dejar datos de pago** para
activarse, aunque después no cobre nada dentro del tier gratuito.

Guardarlas en D1 evita eso del todo. Entran holgadas: D1 admite hasta 2 MB por fila, el
panel rechaza cualquier foto de más de 500 KB, y en los 500 MB de una base entran más de
mil fotos.

### La única pieza que pide datos de pago

**Cloudflare Access sí los pide**, incluso en el plan gratuito. La documentación lo dice así:

> "Completá tu onboarding seleccionando un plan de suscripción e ingresando tus datos de
> pago. Si elegiste el plan Zero Trust Free, este paso igual es necesario pero **no se te
> va a cobrar**."

Se decidió aceptarlo. La alternativa era programar el login a mano, y cambiar autenticación
seria y mantenida por código propio —justo en la pieza donde un error significa que
cualquiera te edita o borra el catálogo— para evitar un formulario es mal negocio.

---

## El orden importa

La migración tiene que hacerse en este orden para que el sitio nunca quede mostrando datos
que no son:

1. Montar Cloudflare (pasos 1 a 6).
2. Cargar los productos en D1.
3. Verificar que `/api/productos` devuelva el catálogo real.
4. Recién ahí, publicar la rama y apagar el deploy viejo (paso 7).

**No publiques el sitio nuevo antes del punto 3.** El código de `src/index.html` ya no sabe
leer la planilla: si la base está vacía o la API no responde, la página cae a los productos
de ejemplo que están escritos en el HTML, con precios que no son los reales.

---

## 1. La base (D1)

```bash
npx wrangler login
npx wrangler d1 create neneko
```

El comando imprime un `database_id`. Guardalo, hace falta en el paso 3.

Aplicá el esquema, que crea las dos tablas (`productos` e `imagenes`):

```bash
npx wrangler d1 execute neneko --remote --file=db/schema.sql
```

`--remote` es importante: sin eso escribe en una copia local y la base de producción queda
vacía.

Para confirmar que quedó bien:

```bash
npx wrangler d1 execute neneko --remote \
  --command="select name from sqlite_master where type='table'"
```

Tienen que aparecer `productos` e `imagenes`.

---

## 2. El proyecto en Pages

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

## 3. Conectar la base

En el proyecto de Pages: **Settings → Functions** (o **Bindings**, según la versión del
panel), y agregá el binding **para producción y también para preview**:

| Tipo | Nombre del binding | Apunta a |
|---|---|---|
| D1 database | `DB` | `neneko` |

El nombre `DB` tiene que ser exactamente ése: es el que el código usa (`env.DB`).

---

## 4. Cloudflare Access para el panel

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

Si es la primera vez que entrás a Zero Trust, te va a pedir elegir plan y cargar datos de
pago. Elegí **Free**: según la documentación, el paso es obligatorio pero no cobra.

### ⚠️ No protejas `/api/*` con Access

Access filtra por ruta, no por método. Si protegés `/api/*` entero, también bloqueás el
`GET` público y **el sitio deja de mostrar productos a los visitantes**.

Protegé solo `/admin.html`. La API se defiende sola: el Worker verifica el token de Access
en el código, y eso ya está probado. Los pedidos del panel viajan con la cookie
`CF_Authorization`, que el Worker lee y valida.

---

## 5. Las variables de Access

En el proyecto de Pages: **Settings → Environment variables**, para producción y preview:

| Variable | Valor |
|---|---|
| `ACCESS_TEAM_DOMAIN` | `algo.cloudflareaccess.com` (sin `https://`) |
| `ACCESS_AUD` | el AUD Tag del paso 4 |

**Si estas dos faltan, el Worker rechaza toda escritura.** Es deliberado: falla cerrada. La
alternativa cómoda —"si no hay configuración, no verifico"— convertiría un olvido al
desplegar en un catálogo abierto a cualquiera.

O sea que si el panel te dice "Falta configurar ACCESS_TEAM_DOMAIN o ACCESS_AUD", no es un
bug: es que estas variables no llegaron al entorno.

---

## 6. Probar antes de migrar

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
paso 5 no están llegando y cualquiera puede escribir el catálogo.

Después, en el navegador:

3. Entrá a `https://TU-SITIO.pages.dev/admin.html`. Tiene que pedirte identificarte con
   Access. Si entra directo, la política del paso 4 no está aplicando.
4. Probá desde una ventana privada con otro mail: tiene que rechazarte.

---

## 7. Migrar y apagar lo viejo

Una vez que los cuatro puntos del paso 6 dan bien:

1. Cargá los productos en D1 (el SQL de migración sale de los CSV exportados).
2. Verificá que `/api/productos` devuelva el catálogo real, no la lista vacía.
3. Entrá al sitio y confirmá que los precios son los correctos.
4. Recién ahora, apagá el workflow viejo de GitHub Pages
   (`.github/workflows/deploy.yml`), para que no haya dos sitios publicados diciendo cosas
   distintas.
5. El archivo de origen se puede archivar. No lo borres el mismo día: si algo sale mal, es
   el único lugar donde están los datos originales.

---

## Después, para la dueña

El panel vive en `https://TU-SITIO.pages.dev/admin.html`. Conviene que lo guarde en la
pantalla de inicio del teléfono.

La primera vez le va a pedir el mail y le va a llegar un código. Access recuerda la sesión un
tiempo, así que no se lo va a pedir todos los días.

---

## Lo que no está verificado

Los límites, los costos y el requisito de datos de pago se confirmaron contra la
documentación oficial en noviembre de 2026. Lo que no pude chequear:

- **Los nombres exactos de los menús del panel.** Cloudflare los reacomoda seguido. Si no
  encontrás "Settings → Functions", buscá "Bindings"; si no encontrás "Build command",
  buscá la sección de build del proyecto. Los conceptos no cambian.
- **Si Access en el plan Free alcanza para más usuarias** de la que vamos a dar de alta. Con
  una sola no es un problema; si algún día entra un empleado más, conviene mirarlo.
