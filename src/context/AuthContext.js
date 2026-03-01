// src/context/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged, sendPasswordResetEmail, updateProfile
} from 'firebase/auth';
import { ref, set } from 'firebase/database';
import { auth, db } from '../firebase';

// Codifica el email para usarlo como clave RTDB (los '.' no están permitidos en claves)
const encodeEmail = (email) => email.replace(/\./g, ',');

// Guarda el mapeo email→uid para que otros usuarios puedan buscar por email
const guardarEmailUid = async (user) => {
  try {
    await set(ref(db, `email_uid/${encodeEmail(user.email)}`), user.uid);
  } catch (e) {
    console.error('Error guardando email_uid:', e);
  }
};

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u);
      setLoading(false);
      if (u) guardarEmailUid(u);
    });
    return unsub;
  }, []);

  const loginConEmail = async (e, p) => {
    const cred = await signInWithEmailAndPassword(auth, e, p);
    await guardarEmailUid(cred.user);
    return cred;
  };

  const registrarConEmail = async (e, p) => {
    const cred = await createUserWithEmailAndPassword(auth, e, p);
    await guardarEmailUid(cred.user);
    return cred;
  };

  return (
    <AuthContext.Provider value={{
      user, loading,
      login: loginConEmail,
      register: registrarConEmail,
      logout: () => signOut(auth),
      resetPassword: (e) => sendPasswordResetEmail(auth, e),
      updateName: (n) => updateProfile(auth.currentUser, { displayName: n }),
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
