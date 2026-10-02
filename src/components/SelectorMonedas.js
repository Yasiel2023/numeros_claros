// src/components/SelectorMonedas.js
// Elige la moneda principal del presupuesto y una segunda moneda opcional
// (para tarjetas y caja de ahorro).
import React from 'react';
import { MONEDAS, CODIGOS_MONEDA } from '../moneda';

export default function SelectorMonedas({ moneda, moneda2, onChange, disabled = false }) {
  const cambiarPrincipal = (codigo) => {
    // La segunda moneda no puede ser igual a la principal
    onChange({ moneda: codigo, moneda2: moneda2 === codigo ? '' : moneda2 });
  };

  return (
    <div className="sel-monedas">
      <label className="sel-monedas-campo">
        <span>Moneda</span>
        <select value={moneda} onChange={e => cambiarPrincipal(e.target.value)} disabled={disabled}>
          {CODIGOS_MONEDA.map(c => (
            <option key={c} value={c}>{MONEDAS[c].simbolo} · {MONEDAS[c].nombre} ({c})</option>
          ))}
        </select>
      </label>
      <label className="sel-monedas-campo">
        <span>Segunda moneda <small>(tarjetas y ahorro)</small></span>
        <select value={moneda2} onChange={e => onChange({ moneda, moneda2: e.target.value })} disabled={disabled}>
          <option value="">Ninguna</option>
          {CODIGOS_MONEDA.filter(c => c !== moneda).map(c => (
            <option key={c} value={c}>{MONEDAS[c].simbolo} · {MONEDAS[c].nombre} ({c})</option>
          ))}
        </select>
      </label>
    </div>
  );
}
