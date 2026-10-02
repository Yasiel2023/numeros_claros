import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /></React.StrictMode>);

// PWA: el service worker hace la app instalable. Solo en producción, para no
// interferir con la recarga automática del servidor de desarrollo.
if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .catch(e => console.error('No se pudo registrar el service worker:', e));
  });
}
