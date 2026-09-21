# Actualización de precios desde listas de proveedores

Script de Google Apps Script que vive **pegado a la planilla del catálogo** (la misma que
alimenta la web y el bot de WhatsApp). La dueña sube la lista que le mandó el proveedor
—PDF, foto, Excel o CSV—, el script se la pasa a Gemini, que extrae los productos y los
cruza contra el catálogo, y los precios se actualizan solos.

Lo que no tiene match claro **no se toca**: cae en la hoja "Productos para Revisar" para
que ella apruebe a mano.

## Por qué Gemini y no otro modelo

Porque el archivo del proveedor se le manda **crudo al modelo** (`inlineData`), y Gemini
lee PDFs e imágenes. Los modelos de solo texto —DeepSeek entre ellos— no sirven acá: el
día que la lista llegue escaneada o como foto de papel, dejan de funcionar.

El costo a este volumen es despreciable y la capa gratuita de Gemini probablemente lo
cubra entero. Si algún día hiciera falta bajarlo, el lugar donde mirar es
`PROMPT_MAESTRO`: hoy manda el catálogo completo en cada llamada.

## Puesta en marcha

### 1. Abrir el editor

En la planilla: **Extensiones → Apps Script**. Pegá `Code.gs` y el archivo `Sidebar.html`.

### 2. Cargar la API Key

**La key no va escrita en el código.** Va en las propiedades del proyecto:

**⚙️ Configuración del proyecto → Propiedades del script → Agregar propiedad**

| Propiedad | Valor |
|---|---|
| `GEMINI_API_KEY` | la key que sacás de [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |

Si alguna vez la key se filtra (la pegaste en un chat, la subiste a un repo, la mandaste
por mail), borrala desde ese mismo panel de Google y generá una nueva. No alcanza con
sacarla del archivo.

### 3. Estructura de la planilla

La hoja **"Todos los productos"** tiene que tener, sí o sí:

- Columna **C** con encabezado `Producto`
- Columna **D** con encabezado `Precio`

El resto de las hojas (histórico, revisión, logs, respaldos) las crea el script solo la
primera vez.

### 4. Probar

Recargá la planilla. Aparece el menú **🔄 Actualizar Precios**. Empezá por
**"Probar conexión a Gemini"**: si responde OK, ya está.

## Red de seguridad

El script no confía en el modelo. Antes de escribir nada:

- **Respalda el catálogo** en una hoja oculta. Se guardan los últimos 5; "Deshacer últimos
  cambios" restaura el más reciente.
- **Frena si el archivo quiere cambiar más del 30%** de los productos. Suele significar que
  la lista es de otro proveedor o que el matching salió mal.
- **Descarta bajas mayores al 50% y subas mayores al 100%** producto por producto, y las
  reporta como cambios anómalos.
- **Todo cambio queda en el histórico**, con precio viejo, precio nuevo y de qué archivo salió.

## Equivalencias aprendidas

Cuando un match se aprueba, el par "nombre del proveedor → nombre del catálogo" se guarda.
La próxima vez que aparezca ese nombre raro, el modelo ya sabe a qué producto corresponde.

La fecha de la hoja es la de **último uso**, no la de alta: se refresca cada vez que la
equivalencia se vuelve a usar. Por eso "Verificar equivalencias obsoletas" borra solo las
que de verdad quedaron sin usar 30 días, y no las que funcionan todas las semanas.
