// src/useEsMovil.js
// true cuando la pantalla es de celular (≤ 900px): se usa el diseño de app.
// Mismo corte que las reglas @media de App.css.
import { useEffect, useState } from 'react';

const CONSULTA = '(max-width: 900px)';

export default function useEsMovil() {
  const [esMovil, setEsMovil] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(CONSULTA).matches : false);

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(CONSULTA);
    const cambio = () => setEsMovil(mq.matches);
    cambio();
    if (mq.addEventListener) mq.addEventListener('change', cambio);
    else mq.addListener(cambio);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', cambio);
      else mq.removeListener(cambio);
    };
  }, []);

  return esMovil;
}
