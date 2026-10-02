// src/components/NuevoMesModal.js
import React, { useState } from 'react';
import { money } from '../moneda';
import { CalendarPlus, X } from 'lucide-react';


export default function NuevoMesModal({ mesLabel, userTemplates = [], onConfirm, onCancel }) {
  const [templateId, setTemplateId] = useState(userTemplates[0]?.id || '');
  const [objetivo, setObjetivo] = useState(() => {
    const tpl = userTemplates[0];
    return tpl?.data?.objetivoAhorro || 0;
  });

  const handleTemplateChange = (id) => {
    setTemplateId(id);
    const tpl = userTemplates.find(t => t.id === id);
    if (tpl?.data?.objetivoAhorro) setObjetivo(tpl.data.objetivoAhorro);
    else setObjetivo(0);
  };

  return (
    <div className="nmes-overlay">
      <div className="nmes-modal">
        <div className="nmes-header">
          <div className="nmes-title">
            <CalendarPlus size={17} />
            <span>Nuevo mes — {mesLabel}</span>
          </div>
          <button className="nmes-close" onClick={onCancel}><X size={14} /></button>
        </div>

        <div className="nmes-body">
          <p className="nmes-desc">
            Este mes no tiene datos aún. Elegí una plantilla para cargar los valores base y definí el objetivo de ahorro.
          </p>

          <div className="nmes-field">
            <label className="nmes-label">Plantilla de mes</label>
            {userTemplates.length === 0 ? (
              <p className="nmes-no-tpl">
                No tenés plantillas de mes creadas. Podés crearlas en <strong>Plantillas → Mis Plantillas</strong>.
                Se iniciará el mes con los valores del presupuesto.
              </p>
            ) : (
              <select
                className="nmes-select"
                value={templateId}
                onChange={e => handleTemplateChange(e.target.value)}
              >
                <option value="">Sin plantilla (usar valores del presupuesto)</option>
                {userTemplates.map(t => (
                  <option key={t.id} value={t.id}>{t.nombre}</option>
                ))}
              </select>
            )}
          </div>

          <div className="nmes-field">
            <label className="nmes-label">Objetivo de ahorro del mes $</label>
            <input
              className="nmes-input"
              type="number"
              min="0"
              value={objetivo || ''}
              onChange={e => setObjetivo(parseFloat(e.target.value) || 0)}
              placeholder="0"
              autoFocus={userTemplates.length === 0}
            />
            {objetivo > 0 && <span className="nmes-hint">{money(objetivo)}</span>}
          </div>
        </div>

        <div className="nmes-footer">
          <button className="nmes-cancel" onClick={onCancel}>Cancelar</button>
          <button
            className="nmes-confirm"
            onClick={() => onConfirm(templateId || null, objetivo)}
          >
            Iniciar mes
          </button>
        </div>
      </div>
    </div>
  );
}
