# Arquitectura

## Stack

- **React 18** vía `react-scripts` 5 (Create React App, sin eject).
- **Firebase 10**: `firebase/database` (Realtime Database) para todos los datos, `firebase/auth` (email/contraseña) para autenticación. **No usa Firestore** aunque existan reglas de Firestore en el repo — ver [estado-proyecto.md](./estado-proyecto.md).
- **recharts** — gráfico de barras presupuestado vs. real en `Resumen.js`.
- **lucide-react** — set de íconos.
- Sin router (`react-router` no está instalado): la navegación entre pantallas es un `switch` sobre un estado local `vista` en `App.js`.
- Sin gestor de estado externo (Redux/Zustand/Context aparte de Auth): todo el estado de la app vive en `AppInterna` (`src/App.js`) y baja por props.

## Punto de entrada

`src/index.js` → `<App/>` → `<AuthProvider><Root/></AuthProvider>` → `Root` decide entre `<AuthPage/>` (sin sesión) o `<AppInterna/>` (con sesión), según `useAuth()`.

## `App.js` — contenedor central

`AppInterna` (src/App.js) concentra:

- **Selector de mes/año**: `mes`, `año` (estado local, no persistido en URL) → clave RTDB `mesKey = "${año}_${mes}"` (mes 0-indexado, ej. `2026_2` = marzo 2026).
- **Multi-presupuesto**: un usuario puede tener varios presupuestos propios y/o compartidos por otros (ver [modelo-datos.md](./modelo-datos.md#accesos)). `presupuestoActual` selecciona cuál está activo; `ownerUidActual`/`rolActual` se derivan de la lista `presupuestos`.
- **`defaults`**: la configuración base del presupuesto activo (`grupos_gastos` + `ingresos`), cargada de `presupuestos/{owner}/{id}/_defaults`. Define qué grupos de gastos existen y su frecuencia — el nav lateral se construye dinámicamente a partir de esto (`grupos.map(...)` en el array `NAV`).
- **`mesData`**: los datos reales de un mes concreto (`presupuestos/{owner}/{id}/{mesKey}`). Si no existe, se dispara el modal `NuevoMesModal` para elegir una plantilla o arrancar vacío.
- **Autoguardado con debounce** (`updateMesData` → `autoGuardar`, 1200ms) — no hay botón "Guardar" explícito para los datos del mes; cada cambio de estado se persiste solo.
- **Caja de ahorro** (`cajaData`): vive a nivel de *presupuesto* (no por mes) en `_caja_ahorro`, se carga/guarda aparte de `mesData`.
- **Plantillas**: dos colecciones separadas —
  - `defaultsTemplates` ← `defaults/*` (plantillas **globales**, compartidas entre todos los usuarios; `defaults/general` es la semilla que precarga el wizard de onboarding para usuarios nuevos).
  - `userTemplates` ← `user_templates/{uid}/*` (plantillas **personales** de mes, usadas por `NuevoMesModal` para inicializar un mes nuevo).
- **Onboarding**: si el usuario no tiene presupuestos propios ni compartidos, se muestra `OnboardingWizard` en vez de la UI normal.

## Árbol de componentes y responsabilidades

```
App
 └─ AuthProvider (src/context/AuthContext.js)
     └─ Root
         ├─ AuthPage                     — login / registro / recuperar contraseña
         └─ AppInterna
             ├─ OnboardingWizard         — wizard 3 pasos, solo primer uso (sin presupuestos)
             ├─ InvitacionesBanner       — banner de invitaciones pendientes a compartir
             ├─ CompartirModal           — invitar a otro usuario por email a un presupuesto
             ├─ NuevoMesModal            — elegir plantilla + objetivo al abrir un mes sin datos
             ├─ Dashboard                — resumen del mes: pendientes, avance por grupo, objetivo ahorro
             ├─ Ingresos                 — tabla de ingresos (fijos + variables)
             ├─ GrupoGastos              — tabla genérica de gastos de UN grupo, con períodos según frecuencia
             ├─ Tarjetas                 — tarjetas de crédito (deuda pendiente) y débito (saldo + historial)
             ├─ Resumen                  — tabla + gráfico previsto vs real, saldo libre, objetivo ahorro
             ├─ CajaAhorro               — depósitos UYU, conversión UYU→USD, ajustes manuales, historial
             └─ DefaultsManager          — editor de plantillas (tab "Mis Plantillas" y tab "Plantillas Globales")
```

### El patrón "grupos de gastos" (el corazón del modelo actual)

En vez de pantallas fijas por categoría (Básicos, Impuestos, Aseo...), la app define **grupos de gastos configurables** dentro de `defaults.grupos_gastos`:

```js
{ id, nombre, icono, frecuencia, items: [{ nombre, previsto }] }
```

`frecuencia` ∈ `mensual | quincenal | cada10dias | semanal` (ver `FRECUENCIAS_GRUPO` en `src/constants.js`) determina cuántos **períodos** tiene el grupo ese mes (`getPeriodosLabel()`):

- `mensual` → 1 período.
- `quincenal` → 2 (1-15 / 16-fin).
- `cada10dias` → 3 (1-10 / 11-20 / 21-fin).
- `semanal` → N períodos, calculados dinámicamente por `calcularSemanasMes()` (viernes de cada mes, con reglas de fusión de sábado pegado y de los últimos ≤3 días del mes — documentado también en el `README.md` raíz).

Cada grupo se renderiza con el **mismo** componente `GrupoGastos.js`, que recibe `data` como un array de períodos `[{numero, label, items:[]}]` y persiste los cambios de vuelta a `mesData.gastos[grupoId]`. El nav lateral (`NAV` en `App.js`) genera un ítem `grupo_{id}` por cada grupo definido en `defaults.grupos_gastos`, así que agregar/quitar grupos desde `DefaultsManager` cambia la navegación sin tocar código.

Esto **reemplazó** un modelo anterior con componentes fijos (`Basicos.js`, `Impuestos.js`, `Asceo.js`, `Ocio.js`, `Semanas.js`) que siguen en el repo pero ya no están conectados a `App.js` — ver [estado-proyecto.md](./estado-proyecto.md#componentes-huérfanos).

### Normalización de arrays desde RTDB

Realtime Database serializa arrays con huecos (o con push-keys) como objetos `{ "0": ..., "2": ... }` en vez de arrays JS. Por eso casi todos los módulos (`App.js`, `DefaultsManager.js`, `OnboardingWizard.js`) repiten una función `toArray()` que ordena las claves numéricamente y devuelve un array real. `App.js` además tiene `normalizeMesData()`, que además migra formatos viejos de `mesData` (gastos como items planos → como array de períodos) para mantener compatibilidad con meses guardados antes de introducir el modelo de "grupos + períodos".

### Formato "previsto / real / pagado"

Patrón repetido en ingresos, ítems de gasto y tarjetas de crédito:

- `previsto` — monto presupuestado.
- `real` — monto efectivamente pagado/recibido. Para gastos, si no se editó manualmente hereda el valor de `previsto`.
- `pagado: boolean` (solo gastos y tarjetas de crédito) — al marcar "Pagar", el ítem sale de "pendientes" y su `real` queda fijo (input se deshabilita).

## Estilos

Un solo archivo `src/App.css` con clases utilitarias/BEM-like por componente (`dash-card`, `periodo-section`, `utm-*` para `DefaultsManager`, `ob-*` para el onboarding, `caja-*` para la caja de ahorro, etc.). No hay CSS-in-JS ni módulos CSS.
