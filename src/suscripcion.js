// src/suscripcion.js
// Suscripción premium: prueba gratuita con todo habilitado y, al vencer, versión gratis
// (sin IA y con un solo presupuesto propio editable).
//
// Datos en Realtime Database:
//   sistema/suscripcion      { activa: boolean, dias_prueba: number, precio: number, moneda: string }   (solo admins escriben)
//       precio/moneda: precio MENSUAL que se muestra (en la app de Android se muestra el de Google Play)
//       activa !== true → el sistema de suscripción está apagado y todos tienen todo.
//   usuarios/{uid}/creadoEn  ISO de la primera vez que el usuario abrió la app (se escribe una sola vez)
//   suscripciones/{uid}      { premium: boolean, hasta?: ISO }          (solo admins escriben)
//
// El Worker de IA repite este cálculo (ia-worker/src/index.js): la IA se corta en el servidor.
import { useCallback, useEffect, useState } from 'react';
import { ref, get, set } from 'firebase/database';
import { db } from './firebase';

export const DIAS_PRUEBA_DEFAULT = 14;
const DIA_MS = 24 * 60 * 60 * 1000;

// Estado de la suscripción a partir de los datos crudos (función pura)
export function calcularEstado({ config, creadoEn, suscripcion, esAdmin = false, ahora = Date.now() }) {
  const activa = config?.activa === true;
  const diasPrueba = Number(config?.dias_prueba) >= 0 ? Number(config.dias_prueba) : DIAS_PRUEBA_DEFAULT;

  const hasta = suscripcion?.hasta ? Date.parse(suscripcion.hasta) : null;
  const premium = esAdmin || (suscripcion?.premium === true && (hasta === null || Number.isNaN(hasta) || hasta > ahora));

  const inicio = creadoEn ? Date.parse(creadoEn) : NaN;
  const finPrueba = Number.isNaN(inicio) ? null : inicio + diasPrueba * DIA_MS;
  const enPrueba = finPrueba !== null && finPrueba > ahora;
  const diasRestantes = enPrueba ? Math.max(1, Math.ceil((finPrueba - ahora) / DIA_MS)) : 0;

  // Sin el sistema activo, o sin saber cuándo empezó la prueba, no se restringe nada
  const restringido = activa && !premium && finPrueba !== null && !enPrueba;
  // Precio mensual que se muestra (se edita solo en la BD). El cobro real lo fija Google Play.
  const precio = Number(config?.precio) > 0 ? Number(config.precio) : null;
  return { activa, premium, enPrueba, diasRestantes, diasPrueba, restringido, precio, moneda: config?.moneda || '' };
}

const SIN_RESTRICCION = { activa: false, premium: false, enPrueba: false, diasRestantes: 0, diasPrueba: 0, restringido: false, precio: null, moneda: '' };

// Carga el estado del usuario. `cargando` es true hasta tener los datos.
export default function useSuscripcion(user, esAdmin) {
  const [datos, setDatos] = useState(null);
  const [version, setVersion] = useState(0);   // sube para volver a leer (ej. tras una compra)

  useEffect(() => {
    if (!user?.uid) return undefined;
    let cancelado = false;
    (async () => {
      try {
        const [cfgSnap, usrSnap, subSnap] = await Promise.all([
          get(ref(db, 'sistema/suscripcion')),
          get(ref(db, `usuarios/${user.uid}/creadoEn`)),
          get(ref(db, `suscripciones/${user.uid}`)),
        ]);
        let creadoEn = usrSnap.exists() ? usrSnap.val() : null;
        if (!creadoEn) {
          // Primera vez con esta versión: la prueba empieza hoy (la regla solo deja escribirlo una vez)
          creadoEn = new Date().toISOString();
          try { await set(ref(db, `usuarios/${user.uid}/creadoEn`), creadoEn); } catch (e) { /* ya existía */ }
        }
        if (!cancelado) {
          setDatos({
            config: cfgSnap.exists() ? cfgSnap.val() : null,
            creadoEn,
            suscripcion: subSnap.exists() ? subSnap.val() : null,
          });
        }
      } catch (e) {
        // Ante un error de red no se bloquea al usuario (la IA igual se corta en el servidor)
        console.error('Error leyendo la suscripción:', e);
        if (!cancelado) setDatos({ config: null, creadoEn: null, suscripcion: null });
      }
    })();
    return () => { cancelado = true; };
  }, [user?.uid, version]);

  const recargar = useCallback(() => setVersion(v => v + 1), []);

  if (!datos) return { ...SIN_RESTRICCION, cargando: true, recargar };
  return { ...calcularEstado({ ...datos, esAdmin }), suscripcion: datos.suscripcion, cargando: false, recargar };
}
