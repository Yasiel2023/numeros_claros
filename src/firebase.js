// src/firebase.js — Reemplazá con tu configuración de Firebase Console
import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
 apiKey: "AIzaSyDk_p-F7lKMFYzH4Nv51SZPpvcET76Daq4",
  authDomain: "numerosclaros-4bd68.firebaseapp.com",
  databaseURL: "https://numerosclaros-4bd68-default-rtdb.firebaseio.com",
  projectId: "numerosclaros-4bd68",
  storageBucket: "numerosclaros-4bd68.firebasestorage.app",
  messagingSenderId: "856646095933",
  appId: "1:856646095933:web:7623cf66e52c903c174654"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
export default app;
