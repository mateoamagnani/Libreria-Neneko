# Asistente de WhatsApp — puesta en marcha

[`asistente-whatsapp.json`](./asistente-whatsapp.json) es un workflow importable en n8n que
responde consultas de clientes por WhatsApp usando la Cloud API oficial de Meta.

Implementa el checklist de [`docs/nucleo-whatsapp-n8n.md`](../docs/nucleo-whatsapp-n8n.md).
Antes de tocarlo, leé ese documento: explica *por qué* cada nodo hace lo que hace.

---

## Cómo está armado

```
Webhook de Meta (GET + POST)
  │
  ├─ GET  ¿hub.mode=subscribe? ──► Devolver el challenge          [alta del webhook]
  │
  └─ POST ─► Verificar la firma (HMAC SHA-256)
              │
              ├─ inválida ──► 403
              │
              └─ válida ──► Responder 200 YA MISMO ──┐
                                                      │  (Meta ya quedó conforme;
                                                      │   lo de abajo corre después)
                                                      ▼
                                        Extraer mensaje y deduplicar
                                                      │
                                          ¿es un mensaje nuevo?
                                              │           └─ no ─► fin
                                              sí
                                              ▼
                                        Leer el catálogo (Sheets)
                                              ▼
                                        Decidir la respuesta
                                              │
                                    ┌─────────┴─────────┐
                                  sí sé                no sé
                                    ▼                    ▼
                          Responder al cliente    Avisar a la dueña
```

### Las cuatro decisiones que importan

| Decisión | Por qué |
|---|---|
| **Responder 200 antes de procesar** | Meta corta a los 5 segundos. Leer el Sheet puede tardar más. El nodo `Responder 200 ya mismo` contesta y el flujo sigue ejecutándose. |
| **Deduplicar por `wamid`** | Meta reintenta hasta 7 días si no recibió un 200. Sin esto, el cliente recibe la misma respuesta varias veces. |
| **Verificar la firma** | Sin esto, cualquiera que descubra la URL del webhook le puede inyectar mensajes falsos al flujo. |
| **Rama de "no sé"** | Si ninguna regla matchea, le llega un aviso a la dueña. El bot nunca falla en silencio ni inventa una respuesta. |

### Por qué reglas y no IA

Las respuestas salen de reglas por palabra clave contra el catálogo real. Un modelo de
lenguaje podría inventar un precio, y un precio inventado en WhatsApp es un problema en el
mostrador. Si más adelante se quiere IA, conviene que sea para *entender* la consulta y que
el precio salga igual del Sheet.

---

## Requisitos previos

1. Cuenta de Meta Business **verificada**.
2. App de tipo *Business* en `developers.facebook.com` con el producto **WhatsApp** agregado.
3. Un **System User** con permisos `whatsapp_business_messaging` y
   `whatsapp_business_management`, y un token generado desde ahí.

> **No uses un token de usuario personal.** Expiran cada 60 días y rompen el bot sin aviso.
> El token del System User se puede configurar para que no expire.

4. Un número de teléfono **dedicado**, que no se use en paralelo desde la app normal de
   WhatsApp.

---

## Variables de entorno

El workflow no tiene ningún dato sensible adentro: todo sale de variables de entorno de n8n.

| Variable | Qué es | Dónde se saca |
|---|---|---|
| `META_APP_SECRET` | Secreto de la app, para verificar la firma | developers.facebook.com → tu app → Configuración → Básica → Clave secreta |
| `META_VERIFY_TOKEN` | Una frase que inventás vos | La elegís y la ponés igual en los dos lados |
| `WHATSAPP_PHONE_NUMBER_ID` | ID del número emisor | developers.facebook.com → WhatsApp → Configuración de la API |
| `SHEET_CATALOGO_ID` | ID de la hoja del catálogo | Está en la URL del Sheet, entre `/d/` y `/edit` |
| `TELEFONO_DUENA` | Adónde avisar lo que el bot no supo responder | Formato internacional sin `+`: `5491161691209` |

En n8n self-hosted van en el `docker-compose.yml` o en un archivo `.env`.

**Nunca las commitees.** El `.gitignore` del repo ya excluye `.env`.

---

## Credenciales de n8n

Dos, que se cargan a mano en la UI de n8n (Credentials → New):

| Credencial | Tipo | Qué poner |
|---|---|---|
| WhatsApp (System User) | *WhatsApp API* | El token del System User y el Business Account ID |
| Google Sheets | *Google Sheets OAuth2 API* | Autorizar con la cuenta dueña de la hoja |

Al importar, los nodos van a mostrar `REEMPLAZAR_CRED_WHATSAPP` y `REEMPLAZAR_CRED_SHEETS`
en rojo. Abrí cada uno y elegí la credencial de la lista.

---

## Paso a paso

### 1. Importar el workflow

En n8n: **Workflows → Import from File** y elegí `asistente-whatsapp.json`.

### 2. Asignar credenciales

Abrí los tres nodos marcados en rojo (`Leer el catálogo`, `Responder al cliente`,
`Avisar a la dueña`) y elegí las credenciales que cargaste.

### 3. Ajustar la hoja del catálogo

El nodo `Leer el catálogo` apunta a una pestaña llamada **`Catalogo`** con columnas
`Categoria | Producto | Precio`. Es la **misma hoja** que alimenta el mercadito de la web
([`docs/catalogo-google-sheets.md`](../docs/catalogo-google-sheets.md)), así el precio que
dice el bot y el que muestra la página no se despegan nunca.

### 4. Activar el workflow y copiar la URL

Activá el workflow (toggle arriba a la derecha) y copiá la **Production URL** del nodo
`Webhook de Meta`. Va a ser algo como:

```
https://tu-n8n.com/webhook/whatsapp-neneko
```

> Tiene que ser la Production URL, no la de Test. La de Test solo funciona mientras tenés el
> editor abierto escuchando.

### 5. Registrar el webhook en Meta

En developers.facebook.com → tu app → WhatsApp → Configuración:

- **URL de devolución de llamada:** la Production URL del paso anterior
- **Token de verificación:** el mismo valor que pusiste en `META_VERIFY_TOKEN`
- Clic en **Verificar y guardar** → Meta pega un GET y el flujo le devuelve el `hub.challenge`
- Suscribite al campo **`messages`**

### 6. Probar antes de soltarlo

Mandale un mensaje al número desde otro teléfono. Probá al menos:

- `¿qué horario tienen?` → responde el horario
- `¿tienen anillado?` → responde el precio del catálogo
- `¿hacen sellos de goma?` → **no** responde al cliente; le llega el aviso a la dueña
- Un audio o una foto → deriva a la dueña, no intenta leerlo

---

## Tests

La lógica de los tres nodos Code está cubierta con tests que corren contra payloads con la
forma exacta que manda Meta:

```bash
node --test test/n8n-asistente.test.mjs
```

Cubren la verificación de firma, el filtrado de eventos de estado, la deduplicación por
`wamid`, los mensajes que no son texto, y que el bot **no invente un precio** cuando el
catálogo no está disponible.

Si tocás un nodo Code, corré los tests antes de activar el workflow.

---

## Checklist antes de activar con clientes reales

- [ ] Token del System User (no uno personal de 60 días)
- [ ] `META_APP_SECRET` cargado y la firma verificándose
- [ ] Deduplicación por `wamid` funcionando
- [ ] El 200 sale en menos de 5 segundos
- [ ] Los mensajes que no son texto derivan en vez de romper
- [ ] La rama de "no sé" avisa a la dueña
- [ ] Número dedicado, no abierto en paralelo en la app normal
- [ ] `node --test test/` en verde
- [ ] Probado desde otro teléfono

---

## La ventana de 24 horas

Cuando un cliente escribe, se abre una ventana de 24 horas en la que se le puede contestar
con texto libre. Pasadas las 24 horas sin que vuelva a escribir, solo se puede iniciar
contacto con una **plantilla pre-aprobada** por Meta (la aprobación tarda hasta 24 h).

**Para este bot no es un problema:** solo responde consultas entrantes, nunca inicia
contacto. Las plantillas recién harían falta si en el futuro se quieren mandar promociones o
recordatorios.

---

## Costos

Hoy los mensajes dentro de la ventana de 24 horas son gratis. **A partir del 1 de octubre de
2026** Meta empieza a cobrar también los mensajes de servicio. Conviene confirmar la tarifa
de Argentina en la tabla oficial de Meta más cerca de la fecha.
