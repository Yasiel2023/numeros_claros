// src/components/NuevaCategoriaModal.js
// Agrega una categoría (grupo de gastos) al presupuesto en cualquier momento del mes.
import React, { useState } from 'react';
import { X, Loader } from 'lucide-react';
import { FRECUENCIAS_GRUPO } from '../constants';
import { ICONOS_RAPIDOS } from './OnboardingWizard';

export default function NuevaCategoriaModal({ nombresExistentes = [], onCrear, onClose }) {
  const [icono, setIcono] = useState('📦');
  const [nombre, setNombre] = useState('');
  const [frecuencia, setFrecuencia] = useState('mensual');
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState('');

  const crear = async () => {
    const n = nombre.trim();
    if (!n) return;
    if (nombresExistentes.some(e => (e || '').trim().toLowerCase() === n.toLowerCase())) {
      setError('Ya existe una categoría con ese nombre.');
      return;
    }
    setCreando(true);
    setError('');
    try {
      await onCrear({ icono, nombre: n, frecuencia });
    } catch (e) {
      setError(`No se pudo crear: ${e.message}`);
      setCreando(false);
    }
  };

  return (
    <div className="presup-modal-overlay" onClick={() => !creando && onClose()}>
      <div className="presup-modal nueva-cat-modal" onClick={e => e.stopPropagation()}>
        <div className="presup-modal-header">
          <span>➕ Nueva categoría de gastos</span>
          <button className="presup-modal-close" onClick={onClose} disabled={creando}><X size={14} /></button>
        </div>

        <p className="nueva-cat-desc">
          Para algo que surgió este mes (un viaje, un arreglo, un regalo…). Queda en el presupuesto
          y aparece también en los meses siguientes.
        </p>

        <div className="nueva-cat-iconos">
          {ICONOS_RAPIDOS.map(ic => (
            <button
              key={ic}
              className={`ob-icono-opt${icono === ic ? ' selected' : ''}`}
              onClick={() => setIcono(ic)}
              disabled={creando}
            >{ic}</button>
          ))}
        </div>

        <input
          className="presup-modal-input"
          value={nombre}
          onChange={e => { setNombre(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && crear()}
          placeholder="Ej: Viaje a Florianópolis"
          autoFocus
          disabled={creando}
        />

        <label className="nueva-cat-label">
          Frecuencia
          <select className="presup-modal-tpl-select" value={frecuencia} onChange={e => setFrecuencia(e.target.value)} disabled={creando}>
            {FRECUENCIAS_GRUPO.map(f => <option key={f.value} value={f.value}>{f.label} — {f.desc}</option>)}
          </select>
        </label>

        {error && <p className="nueva-cat-error">{error}</p>}

        <div className="presup-modal-actions">
          <button className="presup-modal-cancel" onClick={onClose} disabled={creando}>Cancelar</button>
          <button className="presup-modal-ok" onClick={crear} disabled={!nombre.trim() || creando}>
            {creando ? <Loader size={13} className="spin" /> : 'Crear'}
          </button>
        </div>
      </div>
    </div>
  );
}
