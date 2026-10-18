// src/components/PlanPremium.js
// Pantalla "Plan premium": estado de la prueba/suscripción, qué incluye y cómo suscribirse,
// más el aviso que se muestra arriba en las demás pantallas.
import React, { useEffect, useState } from 'react';
import Icono from '../iconos';
import { pagosDisponibles, iniciarPagos, obtenerPlanes, comprar, restaurar } from '../pagos';

const fechaLarga = (iso) => (iso ? new Date(iso).toLocaleDateString('es-UY', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

// Aviso corto arriba del contenido: versión gratis, presupuesto de solo lectura o días de prueba
export function AvisoPlan({ suscripcion, soloLectura, onVer }) {
  if (!suscripcion || suscripcion.cargando || !suscripcion.activa || suscripcion.premium) return null;
  if (suscripcion.enPrueba) {
    // Solo se avisa cuando falta poco, para no molestar durante la prueba
    if (suscripcion.diasRestantes > 3) return null;
    return (
      <button className="plan-aviso prueba" onClick={onVer}>
        Te quedan {suscripcion.diasRestantes} día{suscripcion.diasRestantes !== 1 ? 's' : ''} de prueba con todo incluido. Ver plan →
      </button>
    );
  }
  return (
    <button className="plan-aviso gratis" onClick={onVer}>
      {soloLectura
        ? 'Este presupuesto está en solo lectura en la versión gratis. Activá premium para editarlo →'
        : 'Versión gratis: sin IA y con un solo presupuesto. Ver premium →'}
    </button>
  );
}

const INCLUYE = [
  ['chat', 'Inteligencia artificial', 'Leer tickets con la cámara, armar tu presupuesto y preguntarle a la IA por tus gastos.'],
  ['casa', 'Todos los presupuestos que quieras', 'Uno por familia, por viaje o por negocio.'],
  ['ahorro', 'Todo lo demás, sin límites', 'Tarjetas, cuotas, caja de ahorro y compartir con tu familia.'],
];

export default function PlanPremium({ suscripcion, user, soloLectura }) {
  const [planes, setPlanes] = useState(null);     // null = sin cargar
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const nativo = pagosDisponibles();

  // Planes a la venta (solo en la app de Android)
  useEffect(() => {
    if (!nativo || suscripcion?.premium) return undefined;
    let vivo = true;
    (async () => {
      try {
        await iniciarPagos(user?.uid);
        const lista = await obtenerPlanes();
        if (vivo) setPlanes(lista);
      } catch (e) {
        console.error('Error cargando planes:', e);
        if (vivo) { setPlanes([]); setMensaje('No se pudieron cargar los planes. Revisá tu conexión y volvé a intentar.'); }
      }
    })();
    return () => { vivo = false; };
  }, [nativo, user?.uid, suscripcion?.premium]);

  // El aviso de RevenueCat llega al servidor unos segundos después de pagar: se reintenta leer
  const esperarActivacion = () => {
    let intentos = 0;
    const t = setInterval(() => {
      intentos += 1;
      suscripcion.recargar();
      if (intentos >= 8) { clearInterval(t); setOcupado(false); setMensaje('El pago se está procesando. Si en unos minutos no se activa, tocá "Restaurar compra".'); }
    }, 3000);
  };

  const suscribirse = async (plan) => {
    setOcupado(true); setMensaje('');
    try {
      const ok = await comprar(plan);
      if (ok) { setMensaje('¡Gracias! Estamos activando tu plan…'); esperarActivacion(); } else setOcupado(false);
    } catch (e) {
      setMensaje(`No se pudo completar la compra: ${e?.message || 'error desconocido'}`);
      setOcupado(false);
    }
  };

  const restaurarCompra = async () => {
    setOcupado(true); setMensaje('');
    try {
      await restaurar();
      setMensaje('Buscando tu suscripción…');
      esperarActivacion();
    } catch (e) {
      setMensaje(`No se pudo restaurar: ${e?.message || 'error desconocido'}`);
      setOcupado(false);
    }
  };

  const { activa, premium, enPrueba, diasRestantes, restringido } = suscripcion || {};
  const hasta = suscripcion?.suscripcion?.hasta;
  const cancelada = suscripcion?.suscripcion?.cancelada === true;

  let estado;
  if (premium) estado = { clase: 'ok', titulo: 'Plan premium activo', detalle: hasta ? `${cancelada ? 'Termina' : 'Se renueva'} el ${fechaLarga(hasta)}${cancelada ? ' (no se va a renovar)' : ''}.` : 'Tenés acceso completo.' };
  else if (!activa) estado = { clase: 'ok', titulo: 'Acceso completo', detalle: 'Por ahora tenés todas las funciones.' };
  else if (enPrueba) estado = { clase: 'prueba', titulo: `Prueba gratis: ${diasRestantes} día${diasRestantes !== 1 ? 's' : ''}`, detalle: 'Tenés todo incluido. Después podés seguir con la versión gratis o pasarte a premium.' };
  else estado = { clase: 'gratis', titulo: 'Versión gratis', detalle: 'Seguís usando la app sin IA y con un solo presupuesto.' };

  return (
    <div className="page plan">
      <div className={`plan-estado ${estado.clase}`}>
        <strong>{estado.titulo}</strong>
        <span>{estado.detalle}</span>
        {restringido && soloLectura && <span>El presupuesto que estás viendo es de solo lectura.</span>}
      </div>

      <h3 className="plan-sub">Premium incluye</h3>
      <div className="plan-lista">
        {INCLUYE.map(([icono, titulo, texto]) => (
          <div key={titulo} className="plan-item">
            <span className="plan-ico"><Icono nombre={icono} size={20} /></span>
            <span><strong>{titulo}</strong><small>{texto}</small></span>
          </div>
        ))}
      </div>

      {!premium && activa && (
        <>
          <h3 className="plan-sub">Suscribite</h3>
          {nativo ? (
            <>
              {planes === null && <p className="plan-nota">Cargando planes…</p>}
              {planes && planes.length === 0 && !mensaje && <p className="plan-nota">Todavía no hay planes disponibles.</p>}
              <div className="plan-precios">
                {(planes || []).map(plan => (
                  <button key={plan.id} className="plan-precio" disabled={ocupado} onClick={() => suscribirse(plan)}>
                    <span>{plan.titulo}</span>
                    <strong>{plan.precio}</strong>
                  </button>
                ))}
              </div>
              <button className="plan-link" disabled={ocupado} onClick={restaurarCompra}>Restaurar compra</button>
              <p className="plan-nota">El cobro lo hace Google Play y se renueva solo. Podés cancelar cuando quieras desde Google Play.</p>
            </>
          ) : (
            <p className="plan-nota">La suscripción se contrata desde la app de Android de Números Claros. Después se activa también acá, con la misma cuenta.</p>
          )}
        </>
      )}

      {mensaje && <p className="plan-mensaje" role="status">{mensaje}</p>}
    </div>
  );
}
