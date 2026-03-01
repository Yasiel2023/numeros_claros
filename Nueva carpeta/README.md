# 🏠 CasaFinanzas

App de presupuesto del hogar con React + Firebase (Firestore + Auth).

---

## ⚡ Setup paso a paso

### 1. Crear proyecto en Firebase

1. Ve a [console.firebase.google.com](https://console.firebase.google.com)
2. **"Agregar proyecto"** → nombre (ej: `casa-finanzas`) → Crear
3. En el menú lateral → **"Build"**

### 2. Activar Authentication

1. **Build → Authentication → Comenzar**
2. En la pestaña **"Sign-in method"** → habilitar **"Correo electrónico/contraseña"** → Guardar

### 3. Activar Firestore

1. **Build → Firestore Database → Crear base de datos**
2. Elegí **modo de producción**, región `southamerica-east1`
3. En **Reglas**, pegá el contenido de `firestore.rules`

### 4. Obtener credenciales

1. **Configuración del proyecto (⚙)** → **"Tus apps"** → icono Web `</>`
2. Registrá la app (nombre cualquiera)
3. Copiá el objeto `firebaseConfig`

### 5. Configurar el proyecto

Abrí `src/firebase.js` y reemplazá los valores:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "mi-proyecto.firebaseapp.com",
  projectId: "mi-proyecto",
  storageBucket: "mi-proyecto.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123:web:abc"
};
```

### 6. Instalar y correr

```bash
npm install
npm start
```

### 7. Deploy a Firebase Hosting

```bash
npm install -g firebase-tools
npm run build
firebase login
firebase init hosting   # carpeta pública: "build", SPA: sí
firebase deploy
```

---

## 🔒 Reglas de Firestore

Las reglas en `firestore.rules` garantizan que cada usuario solo pueda leer/escribir sus propias transacciones:

```
allow read, write: if request.auth != null && request.auth.uid == resource.data.uid;
```

---

## 📱 Funcionalidades

- ✅ **Login / Registro / Recuperar contraseña** (Firebase Auth)
- ✅ **Dashboard** con cards de resumen (ingresos, gastos, ahorro)
- ✅ **Alertas automáticas** cuando se acerca o supera el límite de presupuesto
- ✅ **Gráfico de gastos por categoría** con indicador de límite
- ✅ **Tabla de transacciones recientes**
- ✅ **Vista Transacciones** con filtros y búsqueda
- ✅ **Informes anuales** con gráfico de barras mensual
- ✅ **CRUD completo** (agregar, editar, eliminar)
- ✅ **Datos aislados por usuario** (cada cuenta ve solo los suyos)
- ✅ **Deploy** en Firebase Hosting

## 🗂️ Estructura Firestore

```
transacciones/{docId}
  uid: string           ← ID del usuario (para seguridad)
  tipo: "ingreso" | "gasto" | "impuesto"
  descripcion: string
  monto: number
  categoria: string
  fecha: "YYYY-MM-DD"
  creadoEn: ISO string
```

## 📁 Estructura del proyecto

```
src/
  App.js                ← App principal + Dashboard + Transacciones + Informes
  App.css               ← Estilos
  firebase.js           ← Config Firebase ← EDITAR AQUÍ
  index.js              ← Entry point
  context/
    AuthContext.js      ← Provider de autenticación
  components/
    AuthPage.js         ← Login / Registro / Reset password
```
