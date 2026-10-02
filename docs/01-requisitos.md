# 01 — Requisitos

Convenciones:
- **RF-XXX-n**: requisito funcional. **RNF-n**: requisito no funcional.
- Los criterios de aceptación usan la forma *Dado / Cuando / Entonces*.
- Prioridad: **M** (must, v1), **S** (should, v1 si da el tiempo), **C** (could, posterior).
- Las fórmulas y algoritmos citados están definidos en [02-dominio-y-reglas.md](./02-dominio-y-reglas.md); los formatos de datos en [03-modelo-de-datos.md](./03-modelo-de-datos.md).

---

## 1. Autenticación (AUTH)

| ID | Prioridad | Requisito |
|----|-----------|-----------|
| RF-AUTH-1 | M | El usuario puede iniciar sesión con email y contraseña (Firebase Auth). |
| RF-AUTH-2 | M | El usuario puede registrarse con nombre (opcional), email y contraseña (mínimo 6 caracteres, confirmación igual). El nombre se guarda como `displayName`. |
| RF-AUTH-3 | M | El usuario puede pedir un email de recuperación de contraseña. |
| RF-AUTH-4 | M | Al iniciar sesión o registrarse, el sistema guarda `email_uid/{emailCodificado} = uid` (ver [03](./03-modelo-de-datos.md)) para que otros puedan invitarlo. |
| RF-AUTH-5 | M | La sesión persiste entre aperturas de la app. Cerrar sesión la elimina. |
| RF-AUTH-6 | M | Los errores de Firebase se muestran traducidos: `user-not-found` "No existe cuenta con ese correo.", `wrong-password` "Contraseña incorrecta.", `email-already-in-use` "Ya existe una cuenta con ese correo.", `invalid-email` "Correo inválido.", `too-many-requests` "Demasiados intentos. Esperá unos minutos.", `invalid-credential` "Credenciales incorrectas.", otro: "Ocurrió un error. Intentá nuevamente." |

## 2. Presupuestos (PRES)

| ID | Prioridad | Requisito |
|----|-----------|-----------|
| RF-PRES-1 | M | Al entrar, el sistema lista los presupuestos **propios** (`presupuestos/{uid}/*`, nombre desde `_meta.nombre`) y los **compartidos** (`accesos/{uid}/*` con `ownerUid ≠ uid`). |
| RF-PRES-2 | M | Si un presupuesto propio no tiene entrada en `accesos/{uid}/{id}`, el sistema la crea (`rol: 'owner'`) — migración silenciosa. |
| RF-PRES-3 | M | El usuario puede cambiar el presupuesto activo; todas las pantallas pasan a mostrar ese presupuesto. |
| RF-PRES-4 | M | El usuario puede crear un presupuesto nuevo con nombre y, opcionalmente, una plantilla global como base (`_defaults`). Se escriben, en este orden: `_meta`, `_defaults`, `accesos`. |
| RF-PRES-5 | M | Si el usuario no tiene presupuestos propios ni compartidos, se muestra el **onboarding** (RF-ONB). |
| RF-PRES-6 | M | Las categorías visibles y su orden salen de `_defaults.grupos_gastos` del presupuesto activo. |
| RF-PRES-7 | S | Renombres solo de pantalla: una tabla `NOMBRES_VISIBLES` (comparación sin mayúsculas ni espacios) cambia el nombre mostrado de una categoría sin tocar la base. Hoy: `compras → Supermercado`. Lo que se **escribe** en la base (por ejemplo al guardar plantillas) usa siempre el nombre original. |

## 3. Onboarding (ONB)

| ID | Prioridad | Requisito |
|----|-----------|-----------|
| RF-ONB-1 | M | Wizard de 3 pasos: (1) grupos de gastos con ícono, nombre y frecuencia; (2) items con monto previsto por grupo; (3) nombre del presupuesto y confirmación. |
| RF-ONB-2 | M | Precarga los grupos desde `defaults/general` si existe. |
| RF-ONB-3 | M | Al confirmar crea el presupuesto (`_meta`, `_defaults`, `accesos` con `rol: 'owner'`) y lo deja activo. |
| RF-ONB-4 | S | Al confirmar también sobrescribe `defaults/general` con los grupos elegidos (comportamiento actual de la web; ver deuda en [09](./09-operacion.md)). |

## 4. Compartir presupuestos (COMP)

| ID | Prioridad | Requisito |
|----|-----------|-----------|
| RF-COMP-1 | M | Solo el dueño (`rol: 'owner'`) ve la acción "Compartir". |
| RF-COMP-2 | M | Invitar por email: se busca `email_uid/{email en minúsculas codificado}`. Errores: email propio ("No podés invitarte a vos mismo"), no registrado, ya tiene acceso (`accesos/{target}/{pid}` existe), invitación pendiente existente. |
| RF-COMP-3 | M | La invitación se escribe en `invitaciones/{targetUid}/{presupuestoId}` con `estado: 'pendiente'`. |
| RF-COMP-4 | M | El invitado ve un aviso con las invitaciones pendientes. **Aceptar**: escribe primero `accesos/{uid}/{pid}` (`rol: 'miembro'`, `ownerUid`, `nombre`, `invitadoPor`) y después `estado: 'aceptada'`; el presupuesto aparece en la lista. **Rechazar**: `estado: 'rechazada'`. |
| RF-COMP-5 | M | El orden de escritura de RF-COMP-4 es obligatorio: las reglas de seguridad exigen la invitación pendiente al crear el acceso ([07](./07-seguridad.md)). |

## 5. Meses (MES)

| ID | Prioridad | Requisito |
|----|-----------|-----------|
| RF-MES-1 | M | El usuario navega mes anterior / siguiente. Por defecto se abre el mes actual. |
| RF-MES-2 | M | Si el mes no existe en la base, se ofrece crearlo: elegir plantilla personal (`user_templates/{uid}`) o "sin plantilla (valores del presupuesto)", y fijar objetivo de ahorro (precargado desde la plantilla). Cancelar no crea nada. |
| RF-MES-3 | M | Crear el mes inicializa categorías, períodos e items según [02 §3](./02-dominio-y-reglas.md#3-creación-de-un-mes), arrastra tarjetas ([02 §6.5](./02-dominio-y-reglas.md#65-arrastre-de-tarjetas-entre-meses)) y aplica las cuotas del mes ([02 §7](./02-dominio-y-reglas.md#7-compras-en-cuotas-financiaciones)). |
| RF-MES-4 | M | Todo cambio en el mes se guarda automáticamente (debounce ~1,2 s) escribiendo el nodo completo del mes. Se muestra estado "Guardando…" / "Guardado". |
| RF-MES-5 | M | Al leer un mes se normaliza ([03 §5](./03-modelo-de-datos.md#5-normalización-al-leer)): arrays que vuelven como objetos, formatos legados, ids de tarjeta faltantes. |

## 6. Ingresos (ING)

| ID | Prioridad | Requisito |
|----|-----------|-----------|
| RF-ING-1 | M | Lista de ingresos del mes con previsto, real y diferencia (real − previsto). |
| RF-ING-2 | M | Editar previsto y real; agregar ingreso (nombre, previsto; `real: 0`, `esFijo: false`); eliminar los no fijos. Los fijos (`esFijo: true`) muestran etiqueta "fijo" y no se eliminan. |
| RF-ING-3 | M | Totales de previsto, real y diferencia. |

## 7. Categorías de gastos (CAT)

| ID | Prioridad | Requisito |
|----|-----------|-----------|
| RF-CAT-1 | M | Cada categoría muestra sus períodos del mes; con más de un período, cada uno es una sección plegable con estadísticas (pagados/total, previsto, pendiente, pagado). Para categorías semanales, solo la semana actual arranca abierta. |
| RF-CAT-2 | M | Cada item muestra nombre, previsto (editable), real (editable mientras no está pagado) y acción. |
| RF-CAT-3 | M | **Pagar**: si hay tarjetas en UYU, se pregunta "¿Con qué pagaste $X?" (Efectivo/Transferencia o una tarjeta, débito con su saldo). Al confirmar: `pagado: true`, `real` = monto, y efecto en tarjeta según [02 §6.3](./02-dominio-y-reglas.md#63-pagar-un-gasto-con-tarjeta). El botón no aparece si el previsto es 0 (fuera de modo carrito). |
| RF-CAT-4 | M | **Deshacer** un pago revierte el efecto en la tarjeta y deja el item pendiente sin datos de tarjeta. |
| RF-CAT-5 | M | **Eliminar** un item pagado con tarjeta revierte el cargo antes de borrarlo. |
| RF-CAT-6 | M | Agregar item a un período (nombre, previsto; `real = previsto`, `pagado: false`). |
| RF-CAT-7 | M | Filtro "Mostrar pagados". Resumen de la categoría: total previsto, pendiente de pago, pagado; contador pagados/con previsto. |

## 8. Modo carrito (CARR)

| ID | Prioridad | Requisito |
|----|-----------|-----------|
| RF-CARR-1 | M | Interruptor "🛒 Carrito" por categoría. La preferencia es local del dispositivo, recordada por categoría (no se guarda en la base). |
| RF-CARR-2 | M | En modo carrito, los items pendientes muestran **Montar** (marca `enCarrito: true`) o **Sacar** (quita la clave). No paga ni toca tarjetas. Se puede montar aunque el previsto sea 0. |
| RF-CARR-3 | M | Resumen: "En el carrito" (cantidad y $) y "Falta montar" (cantidad y $), sumando el monto pendiente de cada item. Encabezado de período: "🛒 montados/pendientes". |
| RF-CARR-4 | M | "Vaciar carrito" quita `enCarrito` de todos los items de la categoría. |
| RF-CARR-5 | M | Pagar un item (a mano o por ticket) le quita `enCarrito`. |
| RF-CARR-6 | M | La marca `enCarrito` se guarda en la base para que sobreviva a cierres de la app y la vean los demás miembros. |

## 9. Tarjetas (TARJ)

| ID | Prioridad | Requisito |
|----|-----------|-----------|
| RF-TARJ-1 | M | Alta de tarjeta: nombre, tipo (crédito/débito), moneda (UYU/USD). |
| RF-TARJ-2 | M | **Débito**: muestra saldo actual y variación contra el registro anterior; saldo inicial del mes editable; "Registrar saldo" (monto + nota) agrega al historial; historial con fecha, saldo, diferencia, etiqueta "auto" y borrar entrada. |
| RF-TARJ-3 | M | **Crédito**: nombre editable; saldo a pagar; "Pagado X de Y" si hay pago parcial; detalle de la deuda: cuotas, gastos pagados con la tarjeta, otros cargos (agregar/eliminar), "Sin detallar" editable si `monto` supera la suma de las partes, pagos realizados, totales. |
| RF-TARJ-4 | M | **Pagar tarjeta de crédito**: monto (por defecto el saldo; tope el saldo) y origen (efectivo/transferencia o una tarjeta de débito **de la misma moneda**, que recibe un movimiento automático). Acción rápida "Pagar todo". |
| RF-TARJ-5 | M | **Deshacer pago** de una tarjeta de crédito revierte todos sus pagos y elimina los movimientos de débito que generaron. |
| RF-TARJ-6 | M | Totales de crédito pendiente y pagado, separados por moneda. |
| RF-TARJ-7 | M | Si el mes no tiene tarjetas y algún mes anterior (hasta 12 atrás) sí, se ofrece "Traer tarjetas de {Mes Año}" ([02 §6.5](./02-dominio-y-reglas.md#65-arrastre-de-tarjetas-entre-meses)). |

## 10. Compras en cuotas (CUOT)

| ID | Prioridad | Requisito |
|----|-----------|-----------|
| RF-CUOT-1 | M | Alta: concepto, nombre de tarjeta de crédito (con sugerencias), moneda, cantidad de cuotas, monto por cuota **o** total (se divide), mes y año de la primera cuota. |
| RF-CUOT-2 | M | Lista con estado: "Empieza en {Mes Año}", "Cuota n de N · faltan k" o "Finalizada"; monto por mes; eliminar. |
| RF-CUOT-3 | M | Si en el mes hay cuotas activas sin aplicar, aviso "Hay N cuotas de este mes sin cargar" con acción "Cargar a las tarjetas". La aplicación es idempotente ([02 §7](./02-dominio-y-reglas.md#7-compras-en-cuotas-financiaciones)). |

## 11. Dashboard (DASH)

| ID | Prioridad | Requisito |
|----|-----------|-----------|
| RF-DASH-1 | M | Tarjetas resumen: Ingresos (real, previsto), Gastos previstos (y real pagado), Saldo libre (real y presupuestado), Tarjetas pendientes (UYU, + USD si hay). |
| RF-DASH-2 | M | Pagos pendientes: items no pagados con previsto > 0 y tarjetas de crédito con saldo > 0, ordenados por monto descendente; máximo 8 visibles con "+N más"; tocar uno lleva a su categoría. Estado vacío: "¡Todo al día!". |
| RF-DASH-3 | M | Avance por categoría: real / previsto con barra (color: >100% rojo, >80% ámbar, si no verde azulado) y fila de tarjetas. |
| RF-DASH-4 | M | Objetivo de ahorro: separado para ahorro, objetivo, faltan/superado, saldo libre; sin objetivo, acceso a fijarlo. |

## 12. Resumen (RES)

| ID | Prioridad | Requisito |
|----|-----------|-----------|
| RF-RES-1 | M | Tabla: ingresos; cada categoría (presupuestado, real pagado, % sobre ingresos previstos); cada tarjeta de crédito con deuda (previsto propio, pagado, nota "el resto ya está en sus grupos" si corresponde); ahorro; total gastos. |
| RF-RES-2 | M | Gráfico de barras presupuestado vs real (real en rojo si supera lo previsto). |
| RF-RES-3 | M | Saldo del mes presupuestado y real; edición del objetivo de ahorro. |
| RF-RES-4 | S | "Guardar como plantilla": guarda en `user_templates/{uid}` los grupos con los previstos del **primer período** de cada grupo, los ingresos previstos y el objetivo. |

## 13. Caja de ahorro (CAJA)

| ID | Prioridad | Requisito |
|----|-----------|-----------|
| RF-CAJA-1 | M | Saldos UYU y USD calculados recorriendo los movimientos ([02 §9](./02-dominio-y-reglas.md#9-caja-de-ahorro)). |
| RF-CAJA-2 | M | Movimientos: transferencia UYU→USD (monto UYU, tasa, fecha, descripción), depósito UYU, ajuste de saldo USD, ajuste de saldo UYU; historial con borrado. |
| RF-CAJA-3 | S | Acceso rápido para transferir/depositar el ahorro del mes (precarga el objetivo de ahorro del mes). |

## 14. Comprobantes con IA (TICK)

| ID | Prioridad | Requisito |
|----|-----------|-----------|
| RF-TICK-1 | M | Acción global "Cargar comprobante" (no atada a una categoría), visible si hay clave de IA configurada. |
| RF-TICK-2 | M | Origen de la imagen: cámara nativa, galería o portapapeles. Antes de enviarla se reduce (lado mayor ≤ 2000 px, JPEG 0,85). |
| RF-TICK-3 | M | La IA devuelve tienda, items (nombre, cantidad, precio unitario, total), `total_pagado` y observaciones ([05 §2](./05-ia.md#2-lectura-de-tickets)). Sin items: se muestra la observación y opción de volver. |
| RF-TICK-4 | M | Cada item se asigna eligiendo **categoría**; si la categoría tiene más de un período aparece el selector de período (por defecto el período de hoy, [02 §4](./02-dominio-y-reglas.md#4-período-por-defecto-de-hoy)). Al elegir categoría/período la IA sugiere el gasto existente que coincide ([05 §3](./05-ia.md#3-sugerencia-de-coincidencias)); sin coincidencia queda "Crear nuevo". |
| RF-TICK-5 | M | Destinos por item: un gasto existente (🤖 si es la sugerencia, 🛒 si está en el carrito), "➕ Crear nuevo", "🚫 No registrar". |
| RF-TICK-6 | M | "Categoría para todo el comprobante": asigna todos los items a una categoría con **una sola** consulta de sugerencias. |
| RF-TICK-7 | M | Forma de pago del ticket: efectivo o una tarjeta UYU (débito con saldo). Se muestra cuánto se descontará/cargará. |
| RF-TICK-8 | M | Si `total_pagado` es menor que la suma de items (y ≥ 50% de ella), opción marcada por defecto "Repartir el descuento de $X entre los items" ([02 §8.3](./02-dominio-y-reglas.md#83-reparto-proporcional-del-descuento)); cada item muestra el original tachado y el monto a registrar. |
| RF-TICK-9 | M | "Aplicar" se habilita cuando todos los items tienen destino. Aplica según [02 §8.4](./02-dominio-y-reglas.md#84-aplicar-un-ticket), en **una sola escritura** del mes (gastos + tarjetas + registro). |
| RF-TICK-10 | M | Se puede volver a "Otra foto" sin aplicar. Cabecera y pie del modal quedan fijos al hacer scroll. |

## 15. Registro de comprobantes (REG)

| ID | Prioridad | Requisito |
|----|-----------|-----------|
| RF-REG-1 | M | Cada ticket aplicado se guarda en `mesData.comprobantes` ([03](./03-modelo-de-datos.md)). |
| RF-REG-2 | M | Pantalla "Comprobantes": cantidad y total pagado del mes; lista (más recientes primero) con tienda, fecha, items, forma de pago y total; detalle desplegable por producto (cantidad, monto con original tachado, "Categoría → Gasto", etiquetas "nuevo" y 🤖). |
| RF-REG-3 | M | "Eliminar registro" con confirmación explícita: borra solo el registro; **no** revierte gastos ni tarjetas. |

## 16. Preguntas a la IA (CHAT)

| ID | Prioridad | Requisito |
|----|-----------|-----------|
| RF-CHAT-1 | M | El usuario escribe una pregunta sobre el presupuesto activo; la respuesta muestra título, explicación, tabla (concepto/valor), gráfico (barras/torta/línea) y conclusión, según lo que devuelva la IA. |
| RF-CHAT-2 | M | La IA obtiene datos **solo** mediante las herramientas de [05 §4](./05-ia.md#4-chat-con-herramientas); la app las ejecuta leyendo únicamente los meses pedidos del presupuesto activo y hace todas las sumas. |
| RF-CHAT-3 | M | Bajo cada respuesta se muestra "🔎 Consultó: herramienta(args) · …". |
| RF-CHAT-4 | M | Panel "🧠 Contexto": notas del usuario editables (se guardan en `_ia_contexto` del presupuesto, valen para todos los miembros) y la parte automática en solo lectura. |
| RF-CHAT-5 | M | Preguntas de seguimiento: se envían las últimas 3 preguntas con sus respuestas. |
| RF-CHAT-6 | M | Ante error, la pregunta vuelve al campo de texto para reintentar. |

## 17. Configuración (CONF)

| ID | Prioridad | Requisito |
|----|-----------|-----------|
| RF-CONF-1 | M | Clave de Groq (validación: empieza con `gsk_`), URL (por defecto `https://api.groq.com/openai/v1`) y modelo de chat (por defecto `openai/gpt-oss-120b`). Guardar y eliminar. |
| RF-CONF-2 | C | En la versión de tiendas, la clave no la carga el usuario: la IA pasa por un backend propio ([07 §3](./07-seguridad.md#3-claves-de-ia)). |

---

## 18. Requisitos no funcionales

| ID | Requisito |
|----|-----------|
| RNF-1 | **Compatibilidad de datos**: la app móvil lee datos escritos por la web (incluidos formatos legados) y escribe datos que la web entiende. |
| RNF-2 | **Exactitud**: las fórmulas de [02](./02-dominio-y-reglas.md) tienen tests unitarios; los resultados coinciden con la web al centavo (montos redondeados a 2 decimales donde se indica). |
| RNF-3 | **Seguridad**: un usuario solo accede a presupuestos propios o donde es miembro; garantizado por reglas de base ([07](./07-seguridad.md)). |
| RNF-4 | **Privacidad**: a la IA solo se envía el contexto del presupuesto activo y los resultados de las herramientas pedidas; la foto del ticket no se almacena. |
| RNF-5 | **Rendimiento**: abrir un mes < 2 s con buena conexión; marcar pagado/montado responde al instante (actualización optimista, guardado en segundo plano). |
| RNF-6 | **Resiliencia de IA**: reintentos automáticos ante 429/500/503 con esperas de 1,5 s, 4 s y 8 s; mensajes de error comprensibles en español. |
| RNF-7 | **Usabilidad móvil**: objetivos táctiles ≥ 44 px; respeta áreas seguras (notch); funciona con una mano en la lista de compras. |
| RNF-8 | **Accesibilidad**: contraste AA; etiquetas accesibles en botones de ícono. |
| RNF-9 | **Idioma**: textos en español rioplatense; montos en formato `es-UY` sin separador de miles (UYU) y `en-US` con 2 decimales (USD). |
| RNF-10 | **Observabilidad**: errores de red/IA registrados (por ejemplo con Sentry o Crashlytics) sin incluir datos financieros ni claves. |
