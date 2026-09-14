# Setup y despliegue

> El `README.md` de la raíz y `src/README.md` describen un setup basado en **Firestore**. Eso está desactualizado: la app actual usa **Realtime Database** exclusivamente (ver [estado-proyecto.md](./estado-proyecto.md)). Esta guía refleja lo que el código realmente hace hoy.

## Requisitos

- Node.js (compatible con `react-scripts` 5 / React 18).
- Una cuenta de Firebase con acceso al proyecto `numeros-claros`, o uno propio si se quiere levantar un entorno separado.

## Correr en local

```bash
npm install
npm start
```

La configuración de Firebase ya está embebida en [src/firebase.js](../src/firebase.js) apuntando al proyecto `numeros-claros` (Realtime Database + Auth). Para usar un proyecto Firebase distinto, reemplazar el objeto `firebaseConfig` ahí.

Firebase a configurar en la consola (si se arma un proyecto nuevo):

1. **Authentication → Sign-in method → Email/contraseña** → activar.
2. **Realtime Database → Crear base de datos** → pegar el contenido de [`database.rules.json`](../database.rules.json) en la pestaña Reglas (ver advertencia de seguridad en [estado-proyecto.md](./estado-proyecto.md)).
3. Copiar el `firebaseConfig` desde Configuración del proyecto → Tus apps → Web, y pegarlo en `src/firebase.js`.

No hace falta tocar Firestore — las reglas `firestore.rules` presentes en el repo no se despliegan (`firebase.json` no las referencia).

## Build y despliegue

```bash
npm run build
firebase login          # si no hay sesión activa
firebase deploy         # despliega hosting (carpeta build/) + database.rules.json
```

`firebase.json` define:
- `hosting.public = "build"`, con rewrite catch-all a `/index.html` (SPA).
- `database.rules = "database.rules.json"`.

`.firebaserc` fija el proyecto por defecto a `numeros-claros`. Para desplegar a otro proyecto: `firebase use --add`.

## Scripts disponibles (`package.json`)

- `npm start` — servidor de desarrollo (react-scripts).
- `npm run build` — build de producción a `build/`.

No hay script de test configurado.
