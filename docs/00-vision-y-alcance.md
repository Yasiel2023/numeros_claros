# 00 — Visión y alcance

## 1. Resumen del producto

**Números Claros** es una app de **presupuesto familiar** pensada para Uruguay (moneda principal **UYU**, con tarjetas y ahorro en **USD**). Reemplaza la clásica planilla de Excel del hogar: se planifica cuánto se va a gastar en cada categoría, se registra lo que efectivamente se paga y se controla en todo momento cuánto falta pagar, cuánto queda libre y cuánto se está ahorrando.

Su diferencial frente a una planilla:

- **Categorías con frecuencia**: el súper se planifica por semana, la nafta cada 10 días, la luz por mes; la app arma los períodos del mes sola.
- **Tarjetas con modelo de flujo de caja**: lo que se paga con crédito no es gasto hasta que se paga la tarjeta; el débito descuenta saldo al instante; las compras en cuotas se cargan solas cada mes.
- **Tickets con IA**: se fotografía el ticket del súper, la IA lo lee, cada producto se asigna a una categoría y la IA sugiere con qué gasto coincide.
- **Modo carrito**: mientras se recorre el súper se van "montando" los productos de la lista; después el ticket los paga todos juntos.
- **Preguntas en lenguaje natural**: "¿cuánto gasté en lácteos en los últimos 3 meses?" — la IA consulta solo los datos necesarios y la app hace las cuentas.
- **Presupuestos compartidos**: la pareja/familia ve y edita el mismo presupuesto.

## 2. Usuarios

| Perfil | Necesidad principal |
|--------|---------------------|
| **Responsable de finanzas del hogar** (usuario principal) | Planificar el mes, registrar pagos, saber cuánto queda libre y cuánto se ahorra. |
| **Co-administrador** (pareja, familiar invitado) | Ver y cargar gastos en el mismo presupuesto, por ejemplo durante la compra. |
| **Usuario en el súper** (cualquiera de los anteriores, desde el celular) | Ir marcando la lista de compras y cargar el ticket al salir. |

Idioma de la interfaz: **español rioplatense** (voseo: "Elegí", "Cargá"). Formato de montos: sin separador de miles en la UI actual (`$1607`), USD con 2 decimales.

## 3. Objetivo de este proyecto

Construir la **app móvil nativa** (Android primero, iOS después) con **paridad funcional** con la app web y **la misma base de datos**, de modo que ambas convivan: una persona puede cargar el ticket en el celular y verlo al instante en la web.

### Objetivos medibles

| ID | Objetivo |
|----|----------|
| OBJ-1 | Paridad funcional con la web en los módulos del alcance v1 (sección 4). |
| OBJ-2 | Cargar un ticket (foto → aplicado) en menos de 60 segundos con una conexión 4G normal. |
| OBJ-3 | Marcar un gasto como pagado o montado al carrito en 1 toque desde la lista. |
| OBJ-4 | Cero diferencias de cálculo entre web y móvil para el mismo mes (mismas fórmulas, tests compartidos). |
| OBJ-5 | Publicable en Google Play (y luego App Store) sin exponer claves de IA en el binario. |

## 4. Alcance de la app móvil v1

### Incluido (paridad con la web)

- Autenticación: login, registro, recuperar contraseña.
- Presupuestos: listar propios y compartidos, cambiar de presupuesto, crear, onboarding de primer uso.
- Compartir: invitar por email, aceptar/rechazar invitaciones.
- Navegación por mes (anterior/siguiente) y creación de mes nuevo desde plantilla.
- Dashboard, Ingresos, Categorías de gastos (con períodos, pagar con tarjeta, modo carrito), Tarjetas (crédito, débito, cuotas, arrastre), Resumen, Caja de ahorro.
- Comprobantes con IA: foto/galería → lectura → asignación por categoría con sugerencia de IA → forma de pago → reparto de descuento → aplicar → registro consultable.
- Preguntas a la IA con contexto editable y herramientas de consulta.
- Configuración de IA.

### Excluido de v1 (posibles mejoras)

- Plantillas: **edición** de plantillas globales y personales (en v1 alcanza con **usar** plantillas existentes al crear presupuesto/mes y "guardar mes como plantilla"). La edición completa sigue disponible en la web.
- Modo offline completo (v1: lectura cacheada por el SDK, escritura requiere conexión).
- Notificaciones push (vencimientos, saldo bajo) — candidatas para v1.1.
- Guardar la foto del ticket (hoy no se guarda; requeriría Firebase Storage).
- Multimoneda en gastos (los gastos son siempre UYU).

## 5. Restricciones

- **Backend existente**: Firebase (proyecto `numeros-claros`) con Realtime Database + Authentication (email/contraseña) + Hosting. No hay servidor propio.
- **Datos existentes en producción** que no se pueden migrar libremente (ver formatos legados en [03](./03-modelo-de-datos.md)).
- **IA**: Groq (API compatible con OpenAI). Visión con `qwen/qwen3.8-27b`; chat con el modelo configurado por el usuario (por defecto `openai/gpt-oss-120b`).
- **Costos**: se prioriza el plan gratuito de Groq y de Firebase. Mover la IA a Cloud Functions requiere el plan Blaze de Firebase (pago por uso).

## 6. Supuestos

- El usuario tiene conexión a internet al usar la app (la lectura de tickets y el chat la requieren siempre).
- Los gastos de las categorías están en UYU; las tarjetas pueden estar en UYU o USD.
- Las personas que comparten un presupuesto confían entre sí (los miembros tienen permisos de edición completos sobre ese presupuesto).

## 7. Métricas de éxito (post-lanzamiento)

- % de meses con al menos un ticket cargado.
- Tiempo promedio desde "abrir cámara" hasta "aplicar ticket".
- % de sugerencias de la IA aceptadas sin cambios en la asignación de tickets.
- Diferencias reportadas entre totales web y móvil (objetivo: 0).
