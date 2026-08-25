# Cargar el catálogo desde Google Sheets

El mercadito de la página puede leer los productos de una hoja de cálculo. La idea es que
para cambiar un precio no haya que tocar código: se edita la hoja y el sitio se actualiza
solo la próxima vez que alguien entra.

---

## Una planilla, dos conexiones

Es **la misma hoja** para el sitio y para el bot de WhatsApp — por eso el precio que dice el
bot y el que muestra la web no se despegan nunca. Pero cada uno la lee de una manera
distinta, y confundirlas es lo que hace que después no ande ninguna de las dos:

| | La web | El bot (n8n) |
|---|---|---|
| Cómo entra | URL pública de CSV | ID de la planilla + credencial de Google |
| Hay que publicarla | Sí, obligatorio | No hace falta |
| Quién la lee | El navegador del visitante | El servidor de n8n |
| Fila de encabezado | Opcional | **Obligatoria** |
| Si falla | Muestra los productos de ejemplo | Deriva la consulta a la dueña |

Este documento cubre la conexión de **la web**. La del bot está en
[`n8n/README.md`](../n8n/README.md).

---

## Cómo funciona

```
Google Sheets (publicada como CSV)
  → el navegador del visitante la descarga al cargar la página
  → se agrupan los productos por categoría
  → se reemplaza el contenido del mercadito
```

No hay servidor ni base de datos en el medio. El costo es cero y no hay nada que mantener.

**La contra:** los precios son públicos (cualquiera con la URL del CSV los ve) y la hoja
tarda un momento en reflejar los cambios por el caché de Google. Para una librería de barrio
que igual muestra los precios en el local, es un intercambio razonable.

---

## Paso a paso

### 1. Armar la hoja

Tres columnas, en este orden:

| Categoria | Producto | Precio |
|---|---|---|
| Impresiones y anillados | Fotocopia B/N | $ 150 c/u |
| Impresiones y anillados | Impresión color A4 | $ 400 c/u |
| Impresiones y anillados | Anillado hasta 100 hj. | $ 1.800 |
| Útiles escolares y de oficina | Cuaderno A4 rayado | $ 3.200 |
| Útiles escolares y de oficina | Repuesto x100 hojas | $ 2.100 |
| Útiles escolares y de oficina | Lapicera Bic azul | $ 900 |

Hay una plantilla lista para copiar y pegar en
[`docs/plantilla-catalogo.csv`](./plantilla-catalogo.csv).

La pestaña tiene que llamarse **`Catalogo`** (sin acento, con C mayúscula): el nodo de n8n
la busca por ese nombre exacto.

**Detalles que importan:**

- **Poné siempre la fila de encabezado.** La web la detecta y la descarta sola, así que para
  el sitio es opcional — pero el bot usa esos títulos para saber cuál columna es el precio,
  así que para n8n es obligatoria. Con encabezado funcionan las dos.
- Las categorías aparecen en la página **en el orden en que salen en la hoja**. Poné arriba
  lo que más se vende.
- Se pueden usar comas dentro de un nombre; Google las exporta entre comillas y el parser las
  respeta.
- El precio es texto libre: `$ 150`, `$150 c/u`, `desde $2.000`, lo que quieras.
- Si dejás el precio vacío, la tarjeta muestra "Consultar".
- Filas sin categoría o sin nombre de producto se ignoran.

### 2. Publicarla como CSV

En Google Sheets:

1. **Archivo → Compartir → Publicar en la Web**
2. En el primer desplegable elegí **la hoja puntual** (no "Todo el documento")
3. En el segundo elegí **Valores separados por comas (.csv)**
4. Clic en **Publicar** y confirmá

Vas a obtener una URL parecida a:

```
https://docs.google.com/spreadsheets/d/e/2PACX-1vQ.../pub?gid=0&single=true&output=csv
```

> **Ojo:** "Publicar en la Web" no es lo mismo que "Compartir con un link". Tiene que ser
> Publicar, si no el navegador no la puede leer y el catálogo queda con los productos de
> ejemplo.

### 3. Pegarla en el código

En [`src/index.html`](../src/index.html), buscá esta línea y reemplazá el placeholder:

```js
const SHEET_CSV_URL = "PEGAR_ACA_LA_URL_CSV_DE_GOOGLE_SHEETS";
```

### 4. Probar

Abrí la página y mirá la consola del navegador (F12). Si algo falla vas a ver un aviso
explicando qué pasó, y la página se queda con los productos de ejemplo en vez de romperse.

---

## Si no funciona

| Síntoma | Causa probable |
|---|---|
| Siguen los productos de ejemplo, sin ningún aviso en consola | La URL quedó sin reemplazar (todavía dice `PEGAR_ACA...`). |
| Aviso `HTTP 404` o `HTTP 403` | La hoja no está publicada, o se publicó como HTML en vez de CSV. |
| Aviso `la hoja no tiene filas usables` | Faltan columnas, o están en otro orden. Tienen que ser exactamente `Categoria, Producto, Precio`. |
| Error de CORS en consola | La URL no es la de "Publicar en la Web". Un link de "Compartir" no sirve. |
| Los cambios de la hoja no se ven | Caché de Google: puede tardar unos minutos. Probá recargar con Ctrl+Shift+R. |
| La página tarda y después muestra los de ejemplo | El fetch cortó a los 8 segundos. Es a propósito: la página nunca queda colgada esperando al Sheet. |

---

## Sobre la seguridad

El contenido de la hoja lo escribe una persona a mano, y termina insertado en el HTML de la
página. Todo lo que baja del Sheet pasa por una función de escapado antes de entrar al DOM,
así que un nombre de producto con `<` o `&` se muestra como texto y no puede ejecutar nada.

Hay tests que lo verifican:

```bash
node --test test/mercadito.test.mjs
```

Si en algún momento se cambia cómo se arman las tarjetas, correr esos tests antes de
publicar.
