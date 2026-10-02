q# 06 — Pantallas y flujos

## 1. Navegación

### 1.1 Web actual (referencia)
Sidebar con: marca, selector de presupuesto (+ crear, + compartir si es dueño), banner de invitaciones, selector de mes (◀ Mes Año ▶), botón **📸 Cargar comprobante**, menú (Dashboard, Ingresos, una entrada por categoría, Tarjetas, Comprobantes, Resumen, Caja de Ahorro, Preguntas IA, Plantillas, Configuración) y usuario/cerrar sesión. Barra superior con título "{Pantalla} — {Mes Año}" y estado de guardado.

### 1.2 Móvil propuesta

```
Tabs inferiores:  [ Inicio ]  [ Gastos ]  [ (📸) ]  [ Tarjetas ]  [ Más ]
                                  │          │                       │
                                  │   botón central: Cargar ticket   ├─ Ingresos
                                  │                                   ├─ Resumen
                                  └─ lista de categorías → categoría  ├─ Comprobantes
                                                                      ├─ Caja de ahorro
Encabezado de todas las pantallas:                                    ├─ Preguntas IA
  [Presupuesto ▾]   ◀ Octubre 2026 ▶   (Guardando…/Guardado)          ├─ Compartir / Invitaciones
                                                                      ├─ Configuración
                                                                      └─ Cerrar sesión
```

- El **mes y el presupuesto activos** son globales (store) y se ven en el encabezado.
- Gestos: deslizar a la izquierda en un item para "Pagar"/"Montar"; a la derecha para "Eliminar" (con deshacer).
- Formularios en *bottom sheets* (agregar item, pagar con…, registrar saldo, pagar tarjeta, alta de cuota).

## 2. Pantallas

Para cada pantalla: **Contenido**, **Acciones**, **Estados**. Requisitos en [01](./01-requisitos.md).

### 2.1 Autenticación (RF-AUTH)
- Contenido: marca, propuesta de valor, formulario según modo (Iniciar sesión / Crear cuenta / Recuperar contraseña).
- Acciones: enviar, cambiar de modo.
- Estados: cargando, error traducido, éxito ("Revisá tu correo…").

### 2.2 Onboarding (RF-ONB)
- Paso 1 "Grupos de gastos": lista editable (ícono de una grilla de emojis rápidos, nombre, frecuencia), agregar/quitar.
- Paso 2 "Items por grupo": por grupo, items con nombre y previsto.
- Paso 3 "Nombre del presupuesto": nombre y confirmar.
- Indicador de progreso 1-2-3; volver/siguiente.

### 2.3 Crear mes (RF-MES-2)
- *Bottom sheet* "Nuevo mes — {Mes Año}": texto explicativo, selector de plantilla personal (o aviso si no hay), objetivo de ahorro, Cancelar / Iniciar mes.

### 2.4 Inicio / Dashboard (RF-DASH)
- 4 tarjetas KPI (Ingresos, Gastos previstos, Saldo libre, Tarjetas pendientes).
- "Pagos pendientes" (badge con total; máximo 8; tocar → categoría; atajos a categorías y Tarjetas).
- "Avance por grupos" con barras; "Ver resumen completo →".
- "Objetivo de ahorro".
- Estados: cargando el mes, mes inexistente (abre 2.3), sin categorías.

### 2.5 Ingresos (RF-ING)
- Lista: nombre (+ "fijo"), previsto, real, diferencia (verde/rojo). Totales. Agregar ingreso.

### 2.6 Categoría de gastos (RF-CAT, RF-CARR)
- Encabezado: ícono + nombre (visible) + badge de frecuencia si no es mensual; interruptores **🛒 Carrito** y **Mostrar pagados**; contador "x/y pagados".
- Resumen: Total previsto · Pendiente de pago · Pagado.
- En modo carrito: resumen violeta "🛒 En el carrito (n · $)" · "Falta montar (n · $)" · Vaciar carrito.
- Períodos (plegables si hay más de uno) con lista de items y "Agregar item".
- Item: nombre (+ etiqueta 🛒 en carrito, + etiqueta de tarjeta usada), previsto, real, acción:
  - pagado → **Deshacer**;
  - modo carrito y pendiente → **Montar** / **Sacar**;
  - normal y pendiente con previsto > 0 → **Pagar** → *sheet* "¿Con qué pagaste $X?" (💵 Efectivo/Transferencia, 🏧 débito con saldo, 💳 crédito).
- Colores: pagado atenuado; en carrito fondo violeta claro.

### 2.7 Tarjetas (RF-TARJ, RF-CUOT)
- Avisos: "Este mes no tiene tarjetas → Traer tarjetas" y "Hay N cuotas sin cargar → Cargar a las tarjetas".
- Sección **Débito**: tarjeta por cuenta (nombre, moneda, saldo, variación, saldo inicial editable, Registrar saldo, historial).
- Sección **Crédito**: tarjeta por cuenta (nombre editable, saldo a pagar o "Saldada", pagado parcial, Pagar / Deshacer pago, detalle de la deuda) + totales por moneda.
- Sección **Compras en cuotas**: alta y lista con estado.
- Agregar tarjeta (nombre, tipo, moneda).

### 2.8 Cargar comprobante (RF-TICK) — flujo de 2 pasos en modal a pantalla completa

**Paso 1 — Foto**
- Opciones: 📷 Sacar foto (cámara nativa) · 🖼️ Elegir de la galería · 📋 Pegar.
- Vista previa + **✨ Desglosar con IA** / Cambiar foto. Estado "Analizando…" (puede incluir reintentos).

**Paso 2 — Revisar desglose** (cabecera y pie fijos)
1. Encabezado: "{TIENDA} · N items · $suma · pagado $X".
2. Casilla de **reparto de descuento** (si aplica).
3. Observaciones de la IA (si hay).
4. **Forma de pago** + texto de cuánto se descuenta/carga.
5. **Categoría para todo el comprobante** (opcional).
6. Lista de items: nombre (× cantidad), monto (original tachado si cambió), selector de categoría, selector de período (si hay varios), selector de destino (o "Buscando coincidencia…"), confirmación en texto ("Se cargará $X en 'Leche' (Supermercado) · sugerido por IA").
7. Pie: **📷 Otra foto** · **✓ Aplicar (listos/total)**.

```
[Cámara/Galería] → reducir imagen → IA lectura → [Revisar]
   → por item: categoría → (período) → IA sugerencia → destino
   → forma de pago → (descuento) → Aplicar → una escritura del mes → cerrar
```

### 2.9 Comprobantes (RF-REG)
- KPIs: cantidad y total pagado. Lista de tickets (tienda, fecha, n items, 🏧/💳/💵, total) → detalle desplegable (tabla producto/cantidad/monto/"registrado en") → "Eliminar registro" con confirmación en línea.
- Vacío: "Todavía no cargaste comprobantes este mes. Usá 📸 Cargar comprobante".

### 2.10 Resumen (RF-RES)
- Tabla presupuestado vs real con % sobre ingresos, gráfico de barras, bloque "Saldo del mes" (presupuestado/real), objetivo de ahorro editable, "💾 Guardar como plantilla".

### 2.11 Caja de ahorro (RF-CAJA)
- Saldos UYU y USD, botones de los 4 tipos de movimiento con formularios, historial.

### 2.12 Preguntas IA (RF-CHAT)
- Encabezado con botón **🧠 Contexto** (panel: "Tus notas" editable + Guardar; "Parte automática" en solo lectura con la lista de herramientas).
- Conversación: burbujas del usuario; respuestas estructuradas (título, explicación, tabla, gráfico, conclusión, "🔎 Consultó: …").
- Ejemplos en estado vacío: "¿Cuánto gasté en supermercado este mes vs el anterior?", "¿Cuál fue mi categoría más cara en los últimos 3 meses?", "¿Cuánto gasté en lácteos en los últimos 3 meses?", "¿Cuánto me queda por pagar de la tarjeta?".
- Estados: "Pensando y consultando tus datos…", error con reintento, sin clave configurada.

### 2.13 Compartir e invitaciones (RF-COMP)
- Compartir (solo dueño): email del invitado → Enviar → resultado.
- Invitaciones pendientes: tarjeta por invitación (presupuesto, de quién) con Aceptar / Rechazar.

### 2.14 Configuración (RF-CONF)
- Clave de Groq (oculta/mostrar), URL, modelo, Guardar, Eliminar. Mensaje de estado.

## 3. Lineamientos visuales

| Token | Valor actual (web) | Uso |
|-------|-------------------|-----|
| Primario | `#0D9488` (verde azulado), claro `--teal-l` | Acciones principales, ícono de la app, barra de estado |
| Pagar / positivo | verde (`--green`) | Botón Pagar, montos a favor |
| Deshacer / advertencia | ámbar `#fef3c7` / `#92400e` | Deshacer, avance > 80% |
| Negativo | rojo (`--red`) | Deudas, exceso de gasto |
| Carrito | violeta `#ede9fe` / `#6d28d9` | Montar, etiquetas de carrito, sugerencia de IA |
| Montos | fuente monoespaciada | Columnas de montos y KPIs |

- Ícono de la app: cuadrado `#0D9488` con "$" blanco (archivos en `public/icon-*.png`).
- Íconos de interfaz: Lucide (`lucide-react-native` en móvil).
- Emojis como íconos de categoría (elegidos por el usuario).
