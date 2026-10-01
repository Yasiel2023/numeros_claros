// src/components/FlujoDesglose.js
import React, { useState } from 'react';
import { X } from 'lucide-react';
import FotoComprobante from './FotoComprobante';
import AplicarDesglose from './AplicarDesglose';

export default function FlujoDesglose({
  ia,         // { apiKey, url } de Groq
  mesData,
  grupos,
  año,
  mes,
  onAplicar,  // (asignaciones, tarjetaId) => void
  onClose,
}) {
  const [paso, setPaso] = useState('foto'); // 'foto' | 'desglose'
  const [desglose, setDesglose] = useState(null);

  const handleFotoDesglose = (resultado) => {
    setDesglose(resultado);
    setPaso('desglose');
  };

  const handleAplicar = (asignaciones, tarjetaId) => {
    onAplicar(asignaciones, tarjetaId);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content flujo-desglose-modal">
        <div className="modal-header">
          <h2>
            {paso === 'foto' ? '📸 Capturar comprobante' : '✓ Revisar desglose'}
          </h2>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {paso === 'foto' && (
          <FotoComprobante ia={ia} onDesglose={handleFotoDesglose} />
        )}

        {paso === 'desglose' && desglose && (
          <AplicarDesglose
            desglose={desglose}
            mesData={mesData}
            grupos={grupos}
            año={año}
            mes={mes}
            ia={ia}
            onAplicar={handleAplicar}
            onCancelar={() => setPaso('foto')}
          />
        )}
      </div>
    </div>
  );
}
