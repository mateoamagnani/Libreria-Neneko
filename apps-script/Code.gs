// Actualización de precios desde listas de proveedores.
// Google Apps Script vinculado a la planilla del catálogo.
// Puesta en marcha: ver apps-script/README.md

// La API Key NO va escrita acá. Se guarda en Propiedades del Script:
// Extensiones → Apps Script → ⚙️ Configuración del proyecto → Propiedades del script
// Clave: GEMINI_API_KEY
const GEMINI_MODELO = "gemini-2.5-flash";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_MODELO + ":generateContent";

const EMAIL_NOTIFICACIONES = ""; // Dejar vacío si no quiere emails, o poner email: "duena@email.com"
const LIMITE_ARCHIVO_MB = 20;
const TIMEOUT_GEMINI = 60000; // 60 segundos

// Validaciones
const LIMITE_CAMBIOS_PORCENTAJE = 30; // No permitir cambiar más del 30% de productos
const LIMITE_CAMBIOS_ANOMALO_BAJA = 50; // Alertar si baja >50%
const LIMITE_CAMBIOS_ANOMALO_SUBA = 100; // Alertar si sube >100%
const DIAS_EQUIVALENCIA_OBSOLETA = 30; // Equivalencias sin uso hace X días
const MAX_RESPALDOS = 5; // Cuántos respaldos se conservan

// Nombres de hojas
const HOJA_CATALOGO = "Todos los productos";
const HOJA_NOVEDADES = "Novedades y Ofertas";
const HOJA_MENU = "Menú";
const HOJA_HISTORICO = "Histórico de Cambios";
const HOJA_REVISION = "Productos para Revisar";
const HOJA_EQUIVALENCIAS = "Equivalencias Aprendidas";
const HOJA_SIN_PRECIO = "Productos sin Precio";
const HOJA_LOGS = "Logs de Errores";
const HOJA_ESTADISTICAS = "Estadísticas";
const HOJA_TENDENCIA = "Tendencia de Precios";
const HOJA_RESPALDOS = "Respaldos";
const HOJA_ERRORES_RECURRENTES = "Errores Recurrentes";
const HOJA_ESTADO = "Estado del Sistema";
const PREFIJO_RESPALDO = "_respaldo_";

const PROMPT_MAESTRO = `Eres un asistente especializado en análisis de catálogos de productos y matching inteligente. Tu tarea es:

1. ANALIZAR el archivo proporcionado (puede ser PDF, imagen, CSV, Excel, etc.) e EXTRAER TODOS los productos con su nombre y precio.
2. HACER MATCHING SEMÁNTICO con el catálogo actual proporcionado abajo.
3. CLASIFICAR cada producto en una de tres categorías:
   - AUTOMÁTICO: confianza > 85% (match exacto, coincidencia clara)
   - REVISIÓN: confianza 50-85% (posible match, necesita verificación humana)
   - NO_ENCONTRADO: confianza < 50% (no hay match claro)

CATÁLOGO ACTUAL (formato: [PRODUCTO] | PRECIO_ACTUAL):
[CATALOGO_AQUI]

EQUIVALENCIAS APRENDIDAS (matches aprobados anteriormente):
[EQUIVALENCIAS_AQUI]

INSTRUCCIONES DE MATCHING:
- Buscar PRIMERO en EQUIVALENCIAS (si está ahí, usa ese match con confianza >95%)
- Luego buscar por nombre COMPLETO (ignorar mayúsculas)
- Usar matching semántico: manejo de abreviaturas estándar (gr/g=gramo, ml/l=mililitro, paq/caja=paquete, etc.)
- CONTROLAR FALSOS POSITIVOS: verificar que coincidan gramaje, tamaño, cantidad, tipo de producto
- Si hay múltiples posibles matches, elegir el de mayor confianza

RESULTADO OBLIGATORIO (JSON válido, sin markdown):
{
  "productos": [
    {
      "nombre_proveedor": "nombre exacto del producto en el archivo",
      "precio_nuevo": 123.45,
      "categoria": "AUTOMÁTICO|REVISIÓN|NO_ENCONTRADO",
      "confianza": 95,
      "nombre_catalogo": "Nombre en el catálogo" o null,
      "precio_anterior": 100 o null,
      "variacion_porcentaje": 23.45 o null,
      "razon": "Descripción breve del matching o por qué no se encontró"
    }
  ],
  "resumen": {
    "total_procesados": 10,
    "automaticos": 7,
    "revision": 2,
    "no_encontrados": 1
  }
}`;

function obtenerApiKey() {
  return PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
}

// La key va en el header, no en ?key= de la URL. Las keys nuevas de Google (las que
// empiezan con "AQ.") fallan con API_KEY_INVALID si se mandan por query string: el
// backend las toma por un token OAuth. De paso, así la key no queda escrita en la URL.
function opcionesGemini(apiKey, payload) {
  return {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-goog-api-key': apiKey },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
}

// Cuenta filas con datos. getMaxRows() devuelve el tamaño de la grilla (1000 por
// defecto), no las filas cargadas: usar eso da "999 pendientes" con la hoja vacía.
function contarFilasDatos(sheet) {
  if (!sheet) return 0;
  return Math.max(0, sheet.getLastRow() - 1);
}

function limpiarFilasDatos(sheet) {
  const filas = contarFilasDatos(sheet);
  if (filas > 0) sheet.deleteRows(2, filas);
}

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🔄 Actualizar Precios')
    .addItem('Cargar archivo de proveedor', 'showSidebar')
    .addSeparator()
    .addItem('Probar conexión a Gemini', 'probarConexionGemini')
    .addItem('Ver modelos disponibles', 'listarModelosDisponibles')
    .addItem('Aprobar todos los cambios pendientes', 'aprobarTodos')
    .addItem('Ver productos para revisar', 'abrirProductosRevision')
    .addItem('Descargar cambios (CSV)', 'descargarCSV')
    .addItem('Detectar productos sin precio', 'detectarProductosSinPrecio')
    .addSeparator()
    .addItem('Deshacer últimos cambios', 'revertirUltimosCAmbios')
    .addItem('Verificar equivalencias obsoletas', 'verificarEquivalenciasObsoletas')
    .addItem('Validar consistencia entre hojas', 'validarConsistenciaHojas')
    .addSeparator()
    .addItem('Ver estadísticas', 'abrirEstadisticas')
    .addItem('Ver tendencia de precios', 'abrirTendencia')
    .addItem('Ver histórico de cambios', 'abrirHistorico')
    .addItem('Ver estado del sistema', 'abrirEstadoSistema')
    .addItem('Ver logs de errores', 'abrirLogs')
    .addToUi();
}

function showSidebar() {
  const htmlOutput = HtmlService.createHtmlOutputFromFile('Sidebar');
  htmlOutput.setWidth(400).setHeight(750);
  SpreadsheetApp.getUi().showModelessDialog(htmlOutput, 'Actualizar Precios');
}

function validarConfiguracionInicial() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!obtenerApiKey()) {
    return { error: '❌ API Key no configurada. Cargala en Extensiones → Apps Script → ⚙️ Configuración del proyecto → Propiedades del script, con la clave GEMINI_API_KEY.' };
  }

  const sheet = ss.getSheetByName(HOJA_CATALOGO);
  if (!sheet) {
    return { error: '❌ Hoja "Todos los productos" no encontrada. Créala primero y cópiale todos tus productos.' };
  }

  const data = sheet.getDataRange().getValues();
  if (data.length < 1) {
    return { error: '❌ La hoja "Todos los productos" está vacía. Agrega encabezados y productos.' };
  }

  const headers = data[0];
  if (headers[2] !== 'Producto' || headers[3] !== 'Precio') {
    return { error: '❌ Estructura incorrecta. Verifica que columna C sea "Producto" y D sea "Precio".' };
  }

  let productoCount = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i][2]) productoCount++;
  }
  if (productoCount === 0) {
    return { error: '❌ No hay productos en "Todos los productos". Copia tus productos primero.' };
  }

  let preciosValidos = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i][2] && data[i][3] && !isNaN(data[i][3])) {
      preciosValidos++;
    }
  }
  if (preciosValidos === 0) {
    return { error: '❌ No hay precios válidos (números) en "Todos los productos". Verifica columna D.' };
  }

  return { ok: true };
}

function probarConexionGemini() {
  try {
    const apiKey = obtenerApiKey();
    if (!apiKey) {
      SpreadsheetApp.getUi().alert('❌ Falta la API Key. Cargala en Propiedades del script con la clave GEMINI_API_KEY.');
      return;
    }

    const payload = {
      contents: [{
        parts: [
          { text: 'Responde solo con "OK"' }
        ]
      }]
    };

    const response = UrlFetchApp.fetch(GEMINI_API_URL, opcionesGemini(apiKey, payload));

    if (response.getResponseCode() === 200) {
      SpreadsheetApp.getUi().alert('✅ Conexión a Gemini OK - API Key válida y funcionando');
      registrarLog('INFO', 'Prueba de conexión a Gemini: OK');
    } else {
      SpreadsheetApp.getUi().alert('❌ Error de Gemini: ' + response.getResponseCode() + '\n\n' + response.getContentText());
      registrarLog('ERROR', 'Prueba de conexión falló: ' + response.getResponseCode());
    }
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Error: ' + error.message);
    registrarLog('ERROR', 'Error en prueba de conexión: ' + error.message);
  }
}

// Google renombra y jubila modelos seguido. Esto pregunta cuáles acepta la cuenta,
// para no tener que adivinar el valor de GEMINI_MODELO.
function listarModelosDisponibles() {
  const ui = SpreadsheetApp.getUi();
  const apiKey = obtenerApiKey();

  if (!apiKey) {
    ui.alert('❌ Falta la API Key. Cargala en Propiedades del script con la clave GEMINI_API_KEY.');
    return;
  }

  try {
    const response = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models', {
      method: 'get',
      headers: { 'x-goog-api-key': apiKey },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      ui.alert('❌ Error ' + response.getResponseCode() + '\n\n' + response.getContentText());
      registrarLog('ERROR', 'Listado de modelos falló: ' + response.getResponseCode());
      return;
    }

    const modelos = (JSON.parse(response.getContentText()).models || [])
      .filter(m => (m.supportedGenerationMethods || []).indexOf('generateContent') !== -1)
      .map(m => m.name.replace('models/', ''));

    const enUso = modelos.indexOf(GEMINI_MODELO) !== -1
      ? '✅ "' + GEMINI_MODELO + '" está disponible.'
      : '⚠️ "' + GEMINI_MODELO + '" NO figura. Cambiá GEMINI_MODELO por alguno de la lista.';

    ui.alert('Modelos disponibles (' + modelos.length + ')\n\n' + modelos.join('\n') + '\n\n' + enUso);
    registrarLog('INFO', 'Modelos disponibles consultados: ' + modelos.length);

  } catch (error) {
    ui.alert('❌ Error: ' + error.message);
    registrarLog('ERROR', 'Error al listar modelos: ' + error.message);
  }
}

function enviarArchivoAGemini(base64, mimeType, fileName, tamanioBytes) {
  try {
    const apiKey = obtenerApiKey();
    if (!apiKey) {
      return { error: 'API Key no configurada. Cargala en Propiedades del script con la clave GEMINI_API_KEY.' };
    }

    const tamanioMB = tamanioBytes / (1024 * 1024);
    if (tamanioMB > LIMITE_ARCHIVO_MB) {
      registrarLog('ERROR', 'Archivo ' + fileName + ' excede límite: ' + tamanioMB.toFixed(2) + 'MB');
      return { error: 'Archivo demasiado grande: ' + tamanioMB.toFixed(2) + 'MB (máximo: ' + LIMITE_ARCHIVO_MB + 'MB)' };
    }

    registrarLog('INFO', 'Iniciando procesamiento de: ' + fileName + ' (' + tamanioMB.toFixed(2) + 'MB)');

    const catalogo = obtenerCatalogo();
    if (catalogo.length === 0) {
      registrarLog('ERROR', 'Catálogo vacío');
      return { error: 'El catálogo está vacío. Agrega productos a "Todos los productos".' };
    }

    const equivalencias = obtenerEquivalencias();
    const equivalenciasTexto = equivalencias.length > 0
      ? equivalencias.map(e => '"' + e.nombre_proveedor + '" → "' + e.nombre_catalogo + '"').join(', ')
      : 'Ninguna aún';

    const catalogoTexto = catalogo.join('\n');
    const prompt = PROMPT_MAESTRO
      .replace('[CATALOGO_AQUI]', catalogoTexto)
      .replace('[EQUIVALENCIAS_AQUI]', equivalenciasTexto);

    const payload = {
      contents: [{
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64
            }
          }
        ]
      }]
    };

    const response = UrlFetchApp.fetch(GEMINI_API_URL, opcionesGemini(apiKey, payload));
    const result = JSON.parse(response.getContentText());

    if (response.getResponseCode() !== 200) {
      const errorMsg = result.error?.message || 'Error desconocido';
      registrarLog('ERROR', 'Gemini error en ' + fileName + ': ' + errorMsg);
      registrarErrorRecurrente(fileName, errorMsg);
      return { error: 'Error de IA: ' + errorMsg };
    }

    const responseText = result.candidates[0].content.parts[0].text;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      registrarLog('ERROR', 'JSON inválido en respuesta para ' + fileName);
      return { error: 'Error al procesar la respuesta de IA' };
    }

    const jsonData = JSON.parse(jsonMatch[0]);
    registrarLog('INFO', 'Procesamiento exitoso: ' + fileName + ' - ' + jsonData.productos.length + ' productos');

    return procesarYActualizarPrecios(jsonData, fileName);

  } catch (error) {
    registrarLog('ERROR', 'Excepción en ' + fileName + ': ' + error.message);
    registrarErrorRecurrente(fileName, error.message);
    return { error: 'Error: ' + error.message };
  }
}

function obtenerCatalogo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(HOJA_CATALOGO);

  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const catalogo = [];

  for (let i = 1; i < data.length; i++) {
    const producto = data[i][2];
    const precio = data[i][3];

    if (producto && precio && !isNaN(precio)) {
      catalogo.push(producto + ' | ' + precio);
    }
  }

  return catalogo;
}

function obtenerEquivalencias() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(HOJA_EQUIVALENCIAS);

  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const equivalencias = [];

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] && data[i][1]) {
      equivalencias.push({
        nombre_proveedor: data[i][0],
        nombre_catalogo: data[i][1]
      });
    }
  }

  return equivalencias;
}

function procesarYActualizarPrecios(jsonData, nombreArchivo) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetCatalogo = ss.getSheetByName(HOJA_CATALOGO);
  const sheetRevision = obtenerOCrearHoja(HOJA_REVISION);
  const sheetHistorico = obtenerOCrearHoja(HOJA_HISTORICO);
  const sheetTendencia = obtenerOCrearHoja(HOJA_TENDENCIA);

  crearRespaldo(sheetCatalogo, 'Pre-actualización');

  const fecha = new Date().toLocaleDateString('es-AR');
  const automaticos = [];
  const revision = [];
  const noEncontrados = [];
  let totalActualizado = 0;
  let cambiosImportantes = [];
  let cambiosAnómalos = [];

  const dataCatalogo = sheetCatalogo.getDataRange().getValues();
  const mapaProductos = {};

  for (let i = 1; i < dataCatalogo.length; i++) {
    const producto = dataCatalogo[i][2];
    if (producto) {
      mapaProductos[producto.toLowerCase()] = {
        fila: i + 1,
        precioAnterior: dataCatalogo[i][3]
      };
    }
  }

  let conteoProductosACambiar = 0;
  jsonData.productos.forEach(p => {
    if (p.categoria === 'AUTOMÁTICO' && mapaProductos[p.nombre_catalogo?.toLowerCase()]) {
      conteoProductosACambiar++;
    }
  });

  const porcentajeaCambiar = (conteoProductosACambiar / Object.keys(mapaProductos).length) * 100;
  if (porcentajeaCambiar > LIMITE_CAMBIOS_PORCENTAJE) {
    registrarLog('ERROR', 'Límite de cambios excedido: ' + porcentajeaCambiar.toFixed(1) + '% (máximo: ' + LIMITE_CAMBIOS_PORCENTAJE + '%)');
    return {
      error: '⚠️ ALERTA: Se intenta cambiar ' + porcentajeaCambiar.toFixed(1) + '% de los productos (límite: ' + LIMITE_CAMBIOS_PORCENTAJE + '%). Revisa el archivo de proveedor.'
    };
  }

  jsonData.productos.forEach(p => {
    const keyBusqueda = p.nombre_catalogo ? p.nombre_catalogo.toLowerCase() : '';
    const info = mapaProductos[keyBusqueda];

    if (p.categoria === 'AUTOMÁTICO') {
      automaticos.push(p);

      if (info) {
        const precioAnterior = info.precioAnterior;

        const validacion = validarCambioAnomaloso(precioAnterior, p.precio_nuevo, p.nombre_catalogo);
        if (!validacion.ok) {
          cambiosAnómalos.push(validacion);
          registrarLog('WARNING', 'Cambio anómalo: ' + validacion.mensaje);
          return;
        }

        sheetCatalogo.getRange(info.fila, 4).setValue(p.precio_nuevo);

        registrarCambio(sheetHistorico, {
          fecha: fecha,
          producto: p.nombre_catalogo,
          precioAnterior: precioAnterior,
          precioNuevo: p.precio_nuevo,
          variacion: p.variacion_porcentaje,
          estado: 'AUTOMÁTICO',
          archivo: nombreArchivo
        });

        registrarTendencia(sheetTendencia, {
          fecha: fecha,
          producto: p.nombre_catalogo,
          precioAnterior: precioAnterior,
          precioNuevo: p.precio_nuevo,
          variacion: p.variacion_porcentaje
        });

        if (Math.abs(p.variacion_porcentaje) > 10) {
          cambiosImportantes.push({
            producto: p.nombre_catalogo,
            variacion: p.variacion_porcentaje,
            precioNuevo: p.precio_nuevo
          });
        }

        totalActualizado++;
        agregarEquivalencia(p.nombre_proveedor, p.nombre_catalogo);
      }
    } else {
      const rowData = [
        new Date(),
        p.nombre_proveedor,
        p.precio_nuevo,
        p.nombre_catalogo || 'N/A',
        info ? info.precioAnterior : 'N/A',
        p.confianza,
        p.categoria,
        p.razon
      ];

      sheetRevision.appendRow(rowData);

      if (p.categoria === 'REVISIÓN') {
        revision.push(p);
      } else {
        noEncontrados.push(p);
      }
    }
  });

  sincronizarConOtrasHojas(sheetCatalogo);
  actualizarEstadisticas(totalActualizado, automaticos.length, revision.length, noEncontrados.length);
  actualizarEstadoSistema();

  if (cambiosImportantes.length > 0 && EMAIL_NOTIFICACIONES) {
    enviarEmailNotificacion(cambiosImportantes);
  }

  if (jsonData.productos.length === 0) {
    return {
      total: 0,
      automaticos: [],
      revision: [],
      no_encontrados: [],
      sinCambios: true,
      cambiosAnómalos: cambiosAnómalos
    };
  }

  return {
    total: jsonData.productos.length,
    automaticos: automaticos,
    revision: revision,
    no_encontrados: noEncontrados,
    sinCambios: false,
    cambiosAnómalos: cambiosAnómalos
  };
}

function validarCambioAnomaloso(precioAnterior, precioNuevo, nombreProducto) {
  if (precioAnterior <= 0 || precioNuevo <= 0) {
    return {
      ok: false,
      mensaje: nombreProducto + ': Precio inválido detectado'
    };
  }

  const variacion = Math.abs((precioNuevo - precioAnterior) / precioAnterior * 100);

  if (precioNuevo < precioAnterior && variacion > LIMITE_CAMBIOS_ANOMALO_BAJA) {
    return {
      ok: false,
      mensaje: nombreProducto + ': Baja anómala del ' + variacion.toFixed(1) + '% (máximo permitido: ' + LIMITE_CAMBIOS_ANOMALO_BAJA + '%)'
    };
  }

  if (precioNuevo > precioAnterior && variacion > LIMITE_CAMBIOS_ANOMALO_SUBA) {
    return {
      ok: false,
      mensaje: nombreProducto + ': Suba anómala del ' + variacion.toFixed(1) + '% (máximo permitido: ' + LIMITE_CAMBIOS_ANOMALO_SUBA + '%)'
    };
  }

  return { ok: true };
}

// El respaldo se guarda como una copia real de la hoja, no como JSON en una celda:
// una celda corta en 50.000 caracteres y el catálogo serializado los pasa, con lo
// que "Deshacer" restauraba datos truncados.
function crearRespaldo(sheet, motivo) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetRespaldos = obtenerOCrearHoja(HOJA_RESPALDOS);

  const ahora = new Date();
  const nombreCopia = PREFIJO_RESPALDO + ahora.getTime();
  const copia = sheet.copyTo(ss).setName(nombreCopia);
  copia.hideSheet();

  const totalProductos = contarFilasDatos(sheet);
  sheetRespaldos.appendRow([ahora.toLocaleString('es-AR'), motivo, totalProductos, nombreCopia]);

  purgarRespaldosViejos();
  registrarLog('INFO', 'Respaldo creado: ' + motivo + ' (' + totalProductos + ' productos)');
}

function purgarRespaldosViejos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetRespaldos = ss.getSheetByName(HOJA_RESPALDOS);
  if (!sheetRespaldos) return;

  const sobrantes = contarFilasDatos(sheetRespaldos) - MAX_RESPALDOS;
  if (sobrantes <= 0) return;

  const viejos = sheetRespaldos.getRange(2, 4, sobrantes, 1).getValues();
  viejos.forEach(fila => {
    const hoja = ss.getSheetByName(fila[0]);
    if (hoja) ss.deleteSheet(hoja);
  });

  sheetRespaldos.deleteRows(2, sobrantes);
}

function revertirUltimosCAmbios() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetRespaldos = ss.getSheetByName(HOJA_RESPALDOS);

  if (contarFilasDatos(sheetRespaldos) === 0) {
    SpreadsheetApp.getUi().alert('❌ No hay respaldos disponibles para deshacer');
    return;
  }

  const ultimaFila = sheetRespaldos.getLastRow();
  const motivo = sheetRespaldos.getRange(ultimaFila, 2).getValue();
  const nombreCopia = sheetRespaldos.getRange(ultimaFila, 4).getValue();

  const hojaRespaldo = ss.getSheetByName(nombreCopia);
  if (!hojaRespaldo) {
    SpreadsheetApp.getUi().alert('❌ El respaldo "' + nombreCopia + '" ya no existe');
    registrarLog('ERROR', 'Respaldo no encontrado: ' + nombreCopia);
    return;
  }

  const sheetCatalogo = ss.getSheetByName(HOJA_CATALOGO);
  if (!sheetCatalogo) {
    SpreadsheetApp.getUi().alert('❌ No se encontró la hoja de catálogo');
    return;
  }

  const datosRespaldo = hojaRespaldo.getDataRange().getValues();
  sheetCatalogo.clearContents();
  sheetCatalogo.getRange(1, 1, datosRespaldo.length, datosRespaldo[0].length).setValues(datosRespaldo);

  ss.deleteSheet(hojaRespaldo);
  sheetRespaldos.deleteRow(ultimaFila);

  sincronizarConOtrasHojas(sheetCatalogo);

  registrarLog('INFO', 'Se revirtieron cambios al respaldo de: ' + motivo);
  SpreadsheetApp.getUi().alert('✅ Cambios revertidos exitosamente');
}

function registrarErrorRecurrente(nombreArchivo, error) {
  const sheet = obtenerOCrearHoja(HOJA_ERRORES_RECURRENTES);
  const fecha = new Date().toLocaleDateString('es-AR');

  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === nombreArchivo && data[i][2] === error) {
      const contador = data[i][3] || 1;
      sheet.getRange(i + 1, 4).setValue(contador + 1);
      sheet.getRange(i + 1, 5).setValue(new Date());
      return;
    }
  }

  sheet.appendRow([fecha, nombreArchivo, error, 1, new Date()]);
}

function verificarEquivalenciasObsoletas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(HOJA_EQUIVALENCIAS);

  if (!sheet) {
    SpreadsheetApp.getUi().alert('No hay equivalencias aún');
    return;
  }

  const data = sheet.getDataRange().getValues();
  const ahora = new Date();
  let obsoletas = 0;

  for (let i = data.length - 1; i >= 1; i--) {
    const fechaEquivalencia = new Date(data[i][2]);
    const diasTranscurridos = Math.floor((ahora - fechaEquivalencia) / (1000 * 60 * 60 * 24));

    if (diasTranscurridos > DIAS_EQUIVALENCIA_OBSOLETA) {
      sheet.deleteRow(i + 1);
      obsoletas++;
    }
  }

  registrarLog('INFO', 'Se eliminaron ' + obsoletas + ' equivalencias obsoletas (>' + DIAS_EQUIVALENCIA_OBSOLETA + ' días sin usar)');
  SpreadsheetApp.getUi().alert('Se revisaron equivalencias: ' + obsoletas + ' fueron eliminadas');
}

function validarConsistenciaHojas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetCatalogo = ss.getSheetByName(HOJA_CATALOGO);
  const sheetNovedades = ss.getSheetByName(HOJA_NOVEDADES);
  const sheetMenu = ss.getSheetByName(HOJA_MENU);

  if (!sheetCatalogo || !sheetNovedades || !sheetMenu) {
    SpreadsheetApp.getUi().alert('Faltan hojas para validar consistencia');
    return;
  }

  const dataCatalogo = sheetCatalogo.getDataRange().getValues();
  const dataNovedades = sheetNovedades.getDataRange().getValues();

  let inconsistencias = 0;

  for (let i = 1; i < dataNovedades.length; i++) {
    const productoNov = dataNovedades[i][2];
    const precioNov = dataNovedades[i][3];

    for (let j = 1; j < dataCatalogo.length; j++) {
      if (dataCatalogo[j][2] === productoNov && dataCatalogo[j][3] !== precioNov) {
        inconsistencias++;
      }
    }
  }

  registrarLog('INFO', 'Validación de consistencia: ' + inconsistencias + ' inconsistencias encontradas');
  SpreadsheetApp.getUi().alert('Se encontraron ' + inconsistencias + ' inconsistencias de precios entre hojas');
}

function obtenerEstadoSistema() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sheetLogs = ss.getSheetByName(HOJA_LOGS);

  const totalProductos = contarFilasDatos(ss.getSheetByName(HOJA_CATALOGO));
  const pendientes = contarFilasDatos(ss.getSheetByName(HOJA_REVISION));
  const equivalencias = contarFilasDatos(ss.getSheetByName(HOJA_EQUIVALENCIAS));

  let ultimaActividad = 'Sin registros';
  if (contarFilasDatos(sheetLogs) > 0) {
    ultimaActividad = sheetLogs.getRange(sheetLogs.getLastRow(), 1).getValue();
  }

  return {
    totalProductos: totalProductos,
    pendientes: pendientes,
    equivalencias: equivalencias,
    ultimaActividad: ultimaActividad,
    estado: pendientes === 0 ? '✅ Sistema OK' : '⚠️ ' + pendientes + ' cambios pendientes'
  };
}

function abrirEstadoSistema() {
  const estado = obtenerEstadoSistema();
  const mensaje = '📊 ESTADO DEL SISTEMA\n\n' +
    '✓ Total de productos: ' + estado.totalProductos + '\n' +
    '⏳ Pendientes de revisión: ' + estado.pendientes + '\n' +
    '📚 Equivalencias aprendidas: ' + estado.equivalencias + '\n' +
    '⏰ Última actividad: ' + estado.ultimaActividad + '\n\n' +
    estado.estado;

  SpreadsheetApp.getUi().alert(mensaje);
}

function actualizarEstadoSistema() {
  const sheet = obtenerOCrearHoja(HOJA_ESTADO);
  const fecha = new Date().toLocaleString('es-AR');
  const estado = obtenerEstadoSistema();

  sheet.appendRow([
    fecha,
    estado.totalProductos,
    estado.pendientes,
    estado.equivalencias,
    estado.estado
  ]);
}

// La fecha marca el último uso, no el alta: si no se refrescara al reusar la
// equivalencia, verificarEquivalenciasObsoletas borraría a los 30 días incluso
// las que se usan todas las semanas.
function agregarEquivalencia(nombreProveedor, nombreCatalogo) {
  const sheet = obtenerOCrearHoja(HOJA_EQUIVALENCIAS);

  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === nombreProveedor && data[i][1] === nombreCatalogo) {
      sheet.getRange(i + 1, 3).setValue(new Date());
      return;
    }
  }

  sheet.appendRow([nombreProveedor, nombreCatalogo, new Date()]);
}

function sincronizarConOtrasHojas(sheetCatalogo) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetNovedades = ss.getSheetByName(HOJA_NOVEDADES);
  const sheetMenu = ss.getSheetByName(HOJA_MENU);

  const dataCatalogo = sheetCatalogo.getDataRange().getValues();

  [sheetNovedades, sheetMenu].forEach(sheet => {
    if (!sheet) return;

    const dataHoja = sheet.getDataRange().getValues();

    for (let i = 1; i < dataHoja.length; i++) {
      const productoHoja = dataHoja[i][2];

      for (let j = 1; j < dataCatalogo.length; j++) {
        if (dataCatalogo[j][2] === productoHoja) {
          sheet.getRange(i + 1, 4).setValue(dataCatalogo[j][3]);
          break;
        }
      }
    }
  });
}

function registrarCambio(sheet, cambio) {
  sheet.appendRow([
    cambio.fecha,
    cambio.producto,
    cambio.precioAnterior,
    cambio.precioNuevo,
    cambio.variacion,
    cambio.estado,
    cambio.archivo || 'N/A'
  ]);
}

function registrarTendencia(sheet, cambio) {
  sheet.appendRow([
    cambio.fecha,
    cambio.producto,
    cambio.precioAnterior,
    cambio.precioNuevo,
    cambio.variacion
  ]);
}

function registrarLog(nivel, mensaje) {
  const sheet = obtenerOCrearHoja(HOJA_LOGS);
  const fecha = new Date().toLocaleString('es-AR');
  sheet.appendRow([fecha, nivel, mensaje]);
}

function obtenerOCrearHoja(nombre) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(nombre);

  if (!sheet) {
    sheet = ss.insertSheet(nombre);

    if (nombre === HOJA_REVISION) {
      sheet.appendRow(['Fecha', 'Producto Proveedor', 'Precio Nuevo', 'Match Catálogo', 'Precio Anterior', 'Confianza %', 'Estado', 'Razón']);
    } else if (nombre === HOJA_HISTORICO) {
      sheet.appendRow(['Fecha', 'Producto', 'Precio Anterior', 'Precio Nuevo', 'Variación %', 'Estado', 'Archivo']);
    } else if (nombre === HOJA_EQUIVALENCIAS) {
      sheet.appendRow(['Nombre Proveedor', 'Nombre Catálogo', 'Último Uso']);
      sheet.hideSheet();
    } else if (nombre === HOJA_SIN_PRECIO) {
      sheet.appendRow(['Producto', 'Detalle', 'Imagen', 'Estado']);
    } else if (nombre === HOJA_LOGS) {
      sheet.appendRow(['Fecha', 'Nivel', 'Mensaje']);
      sheet.hideSheet();
    } else if (nombre === HOJA_ESTADISTICAS) {
      sheet.appendRow(['Fecha', 'Actualizados', 'Automáticos', 'Revisión', 'No Encontrados', 'Total Procesado']);
      sheet.hideSheet();
    } else if (nombre === HOJA_TENDENCIA) {
      sheet.appendRow(['Fecha', 'Producto', 'Precio Anterior', 'Precio Nuevo', 'Variación %']);
      sheet.hideSheet();
    } else if (nombre === HOJA_RESPALDOS) {
      sheet.appendRow(['Fecha', 'Motivo', 'Total Productos', 'Hoja de Respaldo']);
      sheet.hideSheet();
    } else if (nombre === HOJA_ERRORES_RECURRENTES) {
      sheet.appendRow(['Fecha', 'Archivo', 'Error', 'Contador', 'Última Vez']);
      sheet.hideSheet();
    } else if (nombre === HOJA_ESTADO) {
      sheet.appendRow(['Fecha', 'Total Productos', 'Pendientes', 'Equivalencias', 'Estado']);
      sheet.hideSheet();
    }
  }

  return sheet;
}

function actualizarEstadisticas(actualizados, automaticos, revision, noEncontrados) {
  const sheet = obtenerOCrearHoja(HOJA_ESTADISTICAS);
  const fecha = new Date().toLocaleDateString('es-AR');
  const total = automaticos + revision + noEncontrados;

  sheet.appendRow([fecha, actualizados, automaticos, revision, noEncontrados, total]);
}

function enviarEmailNotificacion(cambiosImportantes) {
  if (!EMAIL_NOTIFICACIONES) return;

  let mensaje = '📊 Cambios importantes en precios\n\n';

  cambiosImportantes.forEach(cambio => {
    const variacion = cambio.variacion > 0 ? '+' : '';
    mensaje += '• ' + cambio.producto + ': ' + variacion + cambio.variacion.toFixed(1) + '% ($' + cambio.precioNuevo.toFixed(2) + ')\n';
  });

  try {
    GmailApp.sendEmail(EMAIL_NOTIFICACIONES, '🔔 Notificación de cambios en Librería Neneko', mensaje);
    registrarLog('INFO', 'Email enviado con ' + cambiosImportantes.length + ' cambios importantes');
  } catch (error) {
    registrarLog('ERROR', 'Fallo al enviar email: ' + error.message);
  }
}

function aprobarTodos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetRevision = ss.getSheetByName(HOJA_REVISION);
  const sheetCatalogo = ss.getSheetByName(HOJA_CATALOGO);
  const sheetHistorico = obtenerOCrearHoja(HOJA_HISTORICO);

  if (!sheetRevision || !sheetCatalogo) return;

  const pendientes = contarFilasDatos(sheetRevision);
  if (pendientes === 0) {
    SpreadsheetApp.getUi().alert('✅ No hay cambios pendientes de aprobar');
    return;
  }

  const data = sheetRevision.getDataRange().getValues();
  const dataCatalogo = sheetCatalogo.getDataRange().getValues();

  const mapaProductos = {};
  for (let i = 1; i < dataCatalogo.length; i++) {
    const producto = dataCatalogo[i][2];
    if (producto) {
      mapaProductos[producto.toLowerCase()] = {
        fila: i + 1,
        precioAnterior: dataCatalogo[i][3]
      };
    }
  }

  const fecha = new Date().toLocaleDateString('es-AR');

  for (let i = data.length - 1; i >= 1; i--) {
    const productoMatch = data[i][3];
    const precioNuevo = data[i][2];
    if (!productoMatch) continue;

    const info = mapaProductos[String(productoMatch).toLowerCase()];

    if (info) {
      sheetCatalogo.getRange(info.fila, 4).setValue(precioNuevo);

      registrarCambio(sheetHistorico, {
        fecha: fecha,
        producto: productoMatch,
        precioAnterior: info.precioAnterior,
        precioNuevo: precioNuevo,
        variacion: ((precioNuevo - info.precioAnterior) / info.precioAnterior * 100).toFixed(2),
        estado: 'APROBADO',
        archivo: 'Aprobación Manual'
      });

      agregarEquivalencia(data[i][1], productoMatch);
    }
  }

  limpiarFilasDatos(sheetRevision);

  sincronizarConOtrasHojas(sheetCatalogo);
  registrarLog('INFO', 'Se aprobaron ' + pendientes + ' cambios pendientes');
  actualizarEstadoSistema();

  SpreadsheetApp.getUi().alert('✅ Todos los cambios han sido aprobados y sincronizados');
}

function descargarCSV() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetHistorico = ss.getSheetByName(HOJA_HISTORICO);

  if (!sheetHistorico) {
    SpreadsheetApp.getUi().alert('No hay histórico de cambios');
    return;
  }

  const data = sheetHistorico.getDataRange().getValues();
  let csv = data.map(row => row.map(cell => '"' + cell + '"').join(',')).join('\n');

  const htmlOutput = HtmlService.createHtmlOutput(
    '<a href="data:text/csv;charset=utf-8,' + encodeURIComponent(csv) + '" download="historico_cambios.csv">Descargar CSV</a>'
  );

  SpreadsheetApp.getUi().showModelessDialog(htmlOutput, 'Descargar');
}

function detectarProductosSinPrecio() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetCatalogo = ss.getSheetByName(HOJA_CATALOGO);
  const sheetSinPrecio = obtenerOCrearHoja(HOJA_SIN_PRECIO);

  if (!sheetCatalogo) return;

  const data = sheetCatalogo.getDataRange().getValues();

  limpiarFilasDatos(sheetSinPrecio);

  let sinPrecio = 0;
  for (let i = 1; i < data.length; i++) {
    const producto = data[i][2];
    const precio = data[i][3];

    if (producto && !precio) {
      sheetSinPrecio.appendRow([
        producto,
        data[i][4],
        data[i][5],
        'Falta asignar precio'
      ]);
      sinPrecio++;
    }
  }

  registrarLog('INFO', 'Detección de productos sin precio: ' + sinPrecio + ' encontrados');
  SpreadsheetApp.getUi().alert('Se detectaron ' + sinPrecio + ' productos sin precio');
}

function abrirProductosRevision() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(HOJA_REVISION);

  if (!sheet) {
    SpreadsheetApp.getUi().alert('No hay productos para revisar aún');
    return;
  }

  const count = contarFilasDatos(sheet);
  if (count === 0) {
    SpreadsheetApp.getUi().alert('✅ No hay productos pendientes de revisión');
    return;
  }

  ss.setActiveSheet(sheet);
  registrarLog('INFO', 'Abiertos productos para revisar: ' + count + ' pendientes');
}

function abrirHistorico() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(HOJA_HISTORICO);

  if (sheet) {
    ss.setActiveSheet(sheet);
  }
}

function abrirEstadisticas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(HOJA_ESTADISTICAS);

  if (!sheet) {
    SpreadsheetApp.getUi().alert('No hay estadísticas aún. Procesa archivos primero.');
    return;
  }

  sheet.showSheet();
  ss.setActiveSheet(sheet);
}

function abrirTendencia() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(HOJA_TENDENCIA);

  if (!sheet) {
    SpreadsheetApp.getUi().alert('No hay datos de tendencia aún. Procesa archivos primero.');
    return;
  }

  sheet.showSheet();
  ss.setActiveSheet(sheet);
}

function abrirLogs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(HOJA_LOGS);

  if (sheet) {
    sheet.showSheet();
    ss.setActiveSheet(sheet);
  }
}

function obtenerCambiosPendientes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return contarFilasDatos(ss.getSheetByName(HOJA_REVISION));
}
