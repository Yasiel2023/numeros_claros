// src/components/CompartirModal.js
import React, { useState } from 'react';
import { ref, get, set } from 'firebase/database';
import { db } from '../firebase';
import { X, UserPlus, Loader, CheckCircle, AlertCircle } from 'lucide-react';

const encodeEmail = (email) => email.replace(/\./g, ',');

export default function CompartirModal({ presupuestoId, presupuestoNombre, ownerUid, ownerEmail, onClose }) {
  const [emailInvitado, setEmailInvitado] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null); // { ok: bool, msg: string }

  const enviarInvitacion = async () => {
    const email = emailInvitado.trim().toLowerCase();
    if (!email) return;

    if (email === ownerEmail.toLowerCase()) {
      setResultado({ ok: false, msg: 'No puedes invitarte a ti mismo.' });
      return;
    }

    setEnviando(true);
    setResultado(null);
    try {
      // 1. Buscar uid del invitado por email
      const snapUid = await get(ref(db, `email_uid/${encodeEmail(email)}`));
      if (!snapUid.exists()) {
        setResultado({ ok: false, msg: 'No se encontró ningún usuario con ese email. Asegúrate de que se haya registrado en la app.' });
        setEnviando(false);
        return;
      }
      const targetUid = snapUid.val();

      // 2. Verificar que no tenga ya acceso
      const snapAcceso = await get(ref(db, `accesos/${targetUid}/${presupuestoId}`));
      if (snapAcceso.exists()) {
        setResultado({ ok: false, msg: 'Este usuario ya tiene acceso al presupuesto.' });
        setEnviando(false);
        return;
      }

      // 3. Verificar que no tenga ya una invitación pendiente
      const snapInvExistente = await get(ref(db, `invitaciones/${targetUid}/${presupuestoId}`));
      if (snapInvExistente.exists() && snapInvExistente.val().estado === 'pendiente') {
        setResultado({ ok: false, msg: 'Ya hay una invitación pendiente para este usuario.' });
        setEnviando(false);
        return;
      }

      // 4. Escribir la invitación
      await set(ref(db, `invitaciones/${targetUid}/${presupuestoId}`), {
        presupuestoId,
        ownerUid,
        ownerEmail,
        presupuestoNombre,
        estado: 'pendiente',
        enviadaEn: new Date().toISOString(),
      });

      setResultado({ ok: true, msg: `Invitación enviada a ${email}. El usuario verá la notificación cuando ingrese.` });
      setEmailInvitado('');
    } catch (e) {
      console.error('Error enviando invitación:', e);
      setResultado({ ok: false, msg: 'Error al enviar la invitación. Inténtalo de nuevo.' });
    }
    setEnviando(false);
  };

  return (
    <div className="comp-overlay" onClick={onClose}>
      <div className="comp-modal" onClick={e => e.stopPropagation()}>
        <div className="comp-header">
          <div className="comp-title">
            <UserPlus size={16} />
            <span>Compartir presupuesto</span>
          </div>
          <button className="comp-close" onClick={onClose}><X size={14} /></button>
        </div>

        <div className="comp-body">
          <p className="comp-desc">
            Invita a otra persona a ver y editar <strong>{presupuestoNombre}</strong>.
            La invitación estará disponible cuando el usuario ingrese a la app.
          </p>

          <div className="comp-input-row">
            <input
              type="email"
              className="comp-input"
              placeholder="email@ejemplo.com"
              value={emailInvitado}
              onChange={e => setEmailInvitado(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && enviarInvitacion()}
              disabled={enviando}
              autoFocus
            />
            <button
              className="comp-send-btn"
              onClick={enviarInvitacion}
              disabled={!emailInvitado.trim() || enviando}
            >
              {enviando ? <Loader size={14} className="spin" /> : 'Invitar'}
            </button>
          </div>

          {resultado && (
            <div className={`comp-result ${resultado.ok ? 'ok' : 'err'}`}>
              {resultado.ok
                ? <CheckCircle size={14} />
                : <AlertCircle size={14} />
              }
              <span>{resultado.msg}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
