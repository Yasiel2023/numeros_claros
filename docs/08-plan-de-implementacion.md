# 08 — Plan de implementación (app móvil)

Plan por fases, cada una entregable y verificable. Las tareas son *checklists* para que una sesión nueva pueda retomar exactamente donde quedó: marcar `[x]` al completar y commitear este archivo.

**Definición de terminado (para toda tarea):** compila sin warnings, tests en verde, probado en un dispositivo Android real o emulador, sin `undefined` escritos en la base, textos en español rioplatense.

---

## Fase 0 — Proyecto base

- [ ] Crear repo `numeros-claros-mobile` (o carpeta `mobile/` en este repo; ver nota) con Expo + TypeScript (`npx create-expo-app@latest`, plantilla con `expo-router`).
- [ ] ESLint + Prettier; `tsconfig` estricto.
- [ ] Estructura de carpetas de [04 §2.1](./04-arquitectura.md#21-decisión-de-plataforma): `app/`, `src/core`, `src/data`, `src/ai`, `src/state`, `src/features`, `src/ui`.
- [ ] Firebase: `firebaseConfig` del proyecto `numeros-claros` (ver [09](./09-operacion.md)); Auth con `getReactNativePersistence(AsyncStorage)`.
- [ ] Tokens de diseño ([06 §3](./06-pantallas-y-flujos.md#3-lineamientos-visuales)), ícono y splash con el "$" sobre `#0D9488`.
- [ ] EAS configurado (`eas.json`) con perfiles `development`, `preview` (APK interno) y `production`.

**Salida:** la app abre en Android mostrando una pantalla vacía con la marca.

> Nota: un repo separado simplifica el tooling de Expo; una carpeta `mobile/` en este repo facilita compartir `core/` con la web. Recomendado: carpeta `mobile/` + mover luego `core/` a un paquete compartido (ADR-006).

## Fase 1 — Dominio (`src/core`) con tests ⭐ prioritaria

Portar a TypeScript puro las reglas de [02](./02-dominio-y-reglas.md). Cada función con tests, incluyendo los ejemplos de la documentación.

- [ ] `meses.ts`: `MESES_ES`, clave de mes, `AAAA-MM` ↔ clave.
- [ ] `periodos.ts`: `calcularSemanasMes` (tests: mes con viernes 28 y 31 días; mes que empieza en sábado), `getPeriodosLabel`, `periodoPorDefecto`, período "actual".
- [ ] `normalizar.ts`: `toArray`, `toPeriodos`, `normalizeMesData` (tests con formatos legados: items planos, sin `gastos`, tarjetas sin id, arrays como objetos).
- [ ] `mes.ts`: `initMesData`.
- [ ] `gastos.ts`: pagar, deshacer, eliminar, montar/sacar/vaciar carrito.
- [ ] `tarjetas.ts`: `pagadoTarjeta`, `saldoTarjeta`, `cuentaComoGastoReal`, `montoCargado`, `previstoPropioTarjeta`, `aplicarPagoTarjeta`, `revertirPagoTarjeta`, pagos de crédito (con origen débito) y deshacer, cargos, sin detallar.
- [ ] `cuotas.ts`: `numeroCuota`, `estaActiva`, `cuotasPendientes`, `aplicarCuotas` (test de idempotencia).
- [ ] `arrastre.ts`: `tarjetasParaMesNuevo` (**sin** arrastrar `cargos`), búsqueda hacia atrás (función pura que recibe un lector).
- [ ] `totales.ts`: una función `calcularTotalesMes(mes, grupos)` con todo §10 de [02](./02-dominio-y-reglas.md#10-fórmulas-de-totales-del-mes-dashboard-resumen-y-herramientas-de-ia).
- [ ] `comprobantes.ts`: `calcularMontos` (prorrateo), `aplicarComprobante` (todos los casos de §8.4), `armarRegistro`.
- [ ] `caja.ts`: saldos UYU/USD.
- [ ] **Test de paridad**: exportar 2–3 meses reales de la web (JSON), calcular totales con `core` y compararlos con lo que muestra la web.

**Salida:** `npm test` en verde con cobertura ≥ 90% en `core`.

## Fase 2 — Sesión y presupuestos

- [ ] `data/auth.ts` + pantallas de login/registro/recuperar (RF-AUTH-1..6), incluido `email_uid`.
- [ ] `data/presupuestos.ts`: listar (desde `accesos/{uid}` + migración RF-PRES-2), crear (orden §2.1 de [07](./07-seguridad.md)), leer `_defaults`.
- [ ] Store de sesión: usuario, presupuesto activo (persistido), mes activo.
- [ ] Encabezado global: selector de presupuesto y de mes.
- [ ] Onboarding (RF-ONB).
- [ ] Invitaciones: banner/lista, aceptar/rechazar (RF-COMP-4/5); compartir (RF-COMP-1..3).

**Salida:** un usuario nuevo completa el onboarding; un invitado acepta y ve el presupuesto compartido.

## Fase 3 — Mes, ingresos y categorías

- [ ] `data/mes.ts`: leer + normalizar; suscripción en vivo opcional; guardar con debounce 1,2 s; estado Guardando/Guardado.
- [ ] Crear mes (RF-MES-2/3) con plantillas personales, arrastre de tarjetas y cuotas.
- [ ] Ingresos (RF-ING).
- [ ] Lista de categorías + pantalla de categoría (RF-CAT) con períodos plegables.
- [ ] Pagar con… (*sheet*), deshacer, eliminar con reversión.
- [ ] Modo carrito (RF-CARR) con preferencia local por categoría.
- [ ] Renombres de pantalla (RF-PRES-7).

**Salida:** se puede llevar un mes completo de gastos desde el celular; la web muestra los mismos datos.

## Fase 4 — Tarjetas y cuotas

- [ ] Débito: saldo, variación, saldo inicial, registrar saldo, historial (RF-TARJ-2).
- [ ] Crédito: detalle, cargos, sin detallar, pagar (con origen débito), deshacer (RF-TARJ-3..6).
- [ ] Traer tarjetas de meses anteriores (RF-TARJ-7).
- [ ] Compras en cuotas: alta, lista, aviso y aplicación (RF-CUOT).

## Fase 5 — Dashboard y Resumen

- [ ] Dashboard (RF-DASH) usando `calcularTotalesMes`.
- [ ] Resumen con gráfico (RF-RES-1..3) y guardar como plantilla (RF-RES-4).
- [ ] Caja de ahorro (RF-CAJA).

## Fase 6 — Comprobantes con IA

- [ ] Decidir modo de IA: clave por usuario (config) o Cloud Function (ADR-004). Si es función: crearla (`functions/`), secreto `GROQ_API_KEY`, verificación de token y límite diario.
- [ ] `ai/cliente.ts`: llamada común, reintentos, parseo tolerante ([05 §1](./05-ia.md#1-llamada-común)).
- [ ] Captura: `expo-image-picker` (cámara/galería), `expo-image-manipulator` (2000 px, JPEG 0,85, base64).
- [ ] `ai/tickets.ts`: lectura ([05 §2](./05-ia.md#2-lectura-de-tickets)) y sugerencias ([05 §3](./05-ia.md#3-sugerencia-de-coincidencias)).
- [ ] Pantalla de revisión (RF-TICK-3..10): categoría, período, destino, todo-a-una-categoría, forma de pago, descuento, descarte de respuestas tardías.
- [ ] Aplicar con `core/comprobantes.ts` en una sola escritura + registro (RF-REG-1).
- [ ] Pantalla Comprobantes (RF-REG-2/3).

**Salida:** ticket real de supermercado cargado de punta a punta en < 60 s (OBJ-2).

## Fase 7 — Preguntas IA

- [ ] Contexto automático + notas (`_ia_contexto`) con panel 🧠 (RF-CHAT-4).
- [ ] Herramientas ([05 §4.3](./05-ia.md#43-herramientas)) implementadas sobre `data` + `core`, con caché por pregunta y tope de 12 meses.
- [ ] Ciclo de *tool calling* (máx. 4 rondas) e historial de 3 preguntas.
- [ ] Render de respuestas (tabla, gráfico, "🔎 Consultó").
- [ ] Set de preguntas de prueba con resultados esperados calculados a mano (lácteos, comparación de meses, deuda de tarjetas, cuotas restantes).

## Fase 8 — Configuración, pulido y publicación

- [ ] Configuración de IA (RF-CONF) o pantalla informativa si se usa la función.
- [ ] Accesibilidad (RNF-7/8), estados vacíos y de error en todas las pantallas.
- [ ] Telemetría de errores sin datos sensibles (RNF-10).
- [ ] Tests de reglas con el emulador ([07 §2.3](./07-seguridad.md#23-cómo-verificar-las-reglas)).
- [ ] Política de privacidad (datos enviados a Groq) y ficha de Google Play.
- [ ] Build `production` con EAS y publicación en prueba interna → producción.

## Mejoras posteriores (backlog)

- Notificaciones: vencimiento de tarjeta, saldo de débito bajo, recordatorio de cargar ticket.
- Guardar la foto del ticket en Firebase Storage (con reglas por presupuesto).
- Revocar acceso de miembros; roles de solo lectura.
- Escrituras parciales con `update()` (ADR-005).
- Edición de plantillas en móvil.
- Restringir `defaults` a administradores (ver [07 §2.2](./07-seguridad.md#22-riesgos-aceptados-pendientes)).

## Cómo retomar en una sesión nueva

1. Leer [README](./README.md) y este archivo.
2. Buscar la primera tarea sin marcar.
3. Leer los requisitos (RF) y reglas (§ de [02](./02-dominio-y-reglas.md)) que referencia.
4. Implementar con tests; marcar la tarea; commitear código y este archivo juntos.
