// src/firebase.js — Reemplazá con tu configuración de Firebase Console
import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyC-upFjBq7FqxUfP1HKuBvmrnQznjOklZI",
  authDomain: "numeros-claros.firebaseapp.com",
  databaseURL: "https://numeros-claros-default-rtdb.firebaseio.com",
  projectId: "numeros-claros",
  storageBucket: "numeros-claros.firebasestorage.app",
  messagingSenderId: "796978157718",
  appId: "1:796978157718:web:bbea4f233606cc26c84ab7",
  measurementId: "G-V40X00MTMS"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
export default app;
