// src/components/FlujoDesglose.js
import React, { useState } from 'react';
import { X, Loader } from 'lucide-react';
import FotoComprobante from './FotoComprobante';
import AplicarDesglose from './AplicarDesglose';
import { desglosarComprobante } from '../gemini';

export default function FlujoDesglose({
  apiKey,
  mesData,
  grupos,
  año,
  mes,
  onAplicar,  // (itemsAplicados, itemsNuevos) => void
  onClose,
}) {
  const [paso, setPaso] = useState('foto'); // 'foto' | 'desglose'
  const [desglose, setDesglose] = useState(null);
  const [foto, setFoto] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFotoDesglose = async (resultado, fotoBase64) => {
    setDesglose(resultado);
    setFoto(fotoBase64);
    setPaso('desglose');
  };

  const handleAplicar = (itemsAplicados, itemsNuevos, periodoNumero) => {
    // itemsAplicados: [{grupoId, periodoNumero, nombre, monto}]
    // itemsNuevos: [{grupoId, nombre, previsto}]
    onAplicar(itemsAplicados, itemsNuevos, periodoNumero);
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

        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        {paso === 'foto' && (
          <FotoComprobante
            apiKey={apiKey}
            onDesglose={handleFotoDesglose}
            loading={loading}
          />
        )}

        {paso === 'desglose' && desglose && (
          <>
            <AplicarDesglose
              desglose={desglose}
              foto={foto}
              mesData={mesData}
              grupos={grupos}
              semanas={obtenerSemanas(mesData, grupos, año, mes)}
              onAplicar={handleAplicar}
              onCancelar={() => setPaso('foto')}
            />
          </>
        )}
      </div>
    </div>
  );
}

// Helper para obtener las semanas/períodos del mes actual
function obtenerSemanas(mesData, grupos, año, mes) {
  if (!grupos || grupos.length === 0) return [];

  // Buscar un grupo semanal o con periodos
  const grupoConPeriodos = grupos.find(g => g.frecuencia === 'semanal' || g.frecuencia === 'quincenal' || g.frecuencia === 'cada10dias');
  if (!grupoConPeriodos) {
    // Si no hay, devolver un período por defecto
    return [{ numero: 1, label: `${año}-${mes + 1}` }];
  }

  const periodos = mesData?.gastos?.[grupoConPeriodos.id];
  if (!Array.isArray(periodos) || periodos.length === 0) {
    return [{ numero: 1, label: `${año}-${mes + 1}` }];
  }

  return periodos.map(p => ({ numero: p.numero, label: p.label }));
}
