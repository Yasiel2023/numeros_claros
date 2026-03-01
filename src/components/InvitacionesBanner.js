// src/components/InvitacionesBanner.js
import React from 'react';
import { Bell, Check, X } from 'lucide-react';

export default function InvitacionesBanner({ invitaciones, onAceptar, onRechazar }) {
  if (!invitaciones || invitaciones.length === 0) return null;

  return (
    <div className="inv-banner">
      <div className="inv-banner-title">
        <Bell size={13} />
        <span>Invitaciones pendientes</span>
      </div>
      {invitaciones.map(inv => (
        <div key={inv.id} className="inv-item">
          <div className="inv-info">
            <span className="inv-nombre">{inv.presupuestoNombre}</span>
            <span className="inv-de">de {inv.ownerEmail}</span>
          </div>
          <div className="inv-actions">
            <button
              className="inv-accept-btn"
              onClick={() => onAceptar(inv)}
              title="Aceptar"
            >
              <Check size={12} />
            </button>
            <button
              className="inv-reject-btn"
              onClick={() => onRechazar(inv)}
              title="Rechazar"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
