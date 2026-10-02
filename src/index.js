import React from 'react';
import ReactDOM from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /></React.StrictMode>);

// PWA: el service worker hace la app instalable. Solo en producción (para no
// interferir con el servidor de desarrollo) y no dentro de la app Android de
// Capacitor, que ya trae los archivos empaquetados.
if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator && !Capacitor.isNativePlatform()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .catch(e => console.error('No se pudo registrar el service worker:', e));
  });
}
