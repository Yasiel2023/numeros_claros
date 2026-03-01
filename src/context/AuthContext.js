// src/context/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged, sendPasswordResetEmail, updateProfile
} from 'firebase/auth';
import { auth } from '../firebase';

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => { setUser(u); setLoading(false); });
    return unsub;
  }, []);

  return (
    <AuthContext.Provider value={{
      user, loading,
      login: (e, p) => signInWithEmailAndPassword(auth, e, p),
      register: (e, p) => createUserWithEmailAndPassword(auth, e, p),
      logout: () => signOut(auth),
      resetPassword: (e) => sendPasswordResetEmail(auth, e),
      updateName: (n) => updateProfile(auth.currentUser, { displayName: n }),
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
