// src/components/AplicarDesglose.js
import React, { useState, useMemo } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 0, useGrouping: false }).format(n || 0);

export default function AplicarDesglose({
  desglose,        // { tienda, items: [{nombre, cantidad, precio_unitario, total}], observaciones }
  foto,
  mesData,
  grupos,
  semanas,         // array de periodos del mes actual (para elegir a cuál aplicar)
  onAplicar,       // (aplicados: [{grupoId, periodoNumero, itemName, nuevoMonto}], nuevos: [{nombre, grupoId, previsto}])
  onCancelar,
}) {
  const [periodoSelec, setPeriodoSelec] = useState(semanas?.[0]?.numero || 1);
  const [matchings, setMatchings] = useState({}); // itemDesgloseIdx -> {tipo: 'matchear' | 'crear', targetItemName?, grupoId?, monto}

  // Items existentes en la semana seleccionada
  const itemsEnSemana = useMemo(() => {
    const res = {};
    grupos.forEach(g => {
      const periodos = mesData?.gastos[g.id] || [];
      const periodo = periodos.find(p => p.numero === periodoSelec);
      if (!periodo) return;

      (periodo.items || []).forEach(item => {
        if (!res[g.id]) res[g.id] = [];
        res[g.id].push(item.nombre);
      });
    });
    return res;
  }, [mesData, grupos, periodoSelec]);

  // Procesar cada item del desglose
  const handleMatchItem = (idx, tipo, grupoId = null, targetItemName = null) => {
    const monto = desglose.items[idx].total;
    setMatchings(prev => ({
      ...prev,
      [idx]: { tipo, grupoId, targetItemName, monto }
    }));
  };

  const confirmar = () => {
    const aplicarList = [];
    const crearList = [];

    desglose.items.forEach((item, idx) => {
      const matching = matchings[idx];
      if (!matching) return;

      if (matching.tipo === 'matchear' && matching.targetItemName && matching.grupoId) {
        // Actualizar item existente
        aplicarList.push({
          grupoId: matching.grupoId,
          periodoNumero: periodoSelec,
          itemName: matching.targetItemName,
          nuevoMonto: matching.monto,
        });
      } else if (matching.tipo === 'crear' && matching.grupoId) {
        // Crear nuevo item
        crearList.push({
          nombre: item.nombre,
          grupoId: matching.grupoId,
          previsto: matching.monto,
        });
      }
    });

    onAplicar(aplicarList, crearList, periodoSelec);
  };

  const itemsAprobados = Object.keys(matchings).length === desglose.items.length;

  return (
    <div className="modal-overlay">
      <div className="modal-content desglose-modal">
        <div className="modal-header">
          <h2>📝 Desglose de {desglose.tienda || 'comprobante'}</h2>
          <button className="modal-close" onClick={onCancelar}>
            <X size={20} />
          </button>
        </div>

        {desglose.observaciones && (
          <div className="alert alert-info">
            <AlertCircle size={16} /> {desglose.observaciones}
          </div>
        )}

        {/* 1. Selector de semana */}
        <div className="desglose-paso">
          <h3>1️⃣ Selecciona la semana</h3>
          <select
            className="cell-select"
            value={periodoSelec}
            onChange={(e) => setPeriodoSelec(parseInt(e.target.value))}
          >
            {semanas.map(s => (
              <option key={s.numero} value={s.numero}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* 2. Matchear items del comprobante con items de la semana */}
        <div className="desglose-paso">
          <h3>2️⃣ Asignar items del comprobante</h3>
          <p className="desglose-paso-desc">Para cada item, elegí si matchea con uno existente o si lo creás nuevo</p>

          <div className="desglose-items">
            {desglose.items.map((item, idx) => {
              const matching = matchings[idx];
              const isMatched = matching?.tipo === 'matchear';
              const isCreating = matching?.tipo === 'crear';

              return (
                <div key={idx} className="desglose-item-row">
                  <div className="desglose-item-header">
                    <div className="desglose-item-nombre">{item.nombre}</div>
                    <div className="desglose-item-precio">${fmt(item.total)}</div>
                  </div>

                  <div className="desglose-item-opciones">
                    {/* Opción 1: Matchear con existente */}
                    <div className="desglose-opcion">
                      <label className="desglose-radio-label">
                        <input
                          type="radio"
                          name={`item-${idx}`}
                          checked={isMatched}
                          onChange={() => handleMatchItem(idx, 'matchear')}
                        />
                        Matchea con...
                      </label>
                      {isMatched && (
                        <select
                          className="desglose-item-select"
                          value={matching.targetItemName || ''}
                          onChange={(e) => {
                            if (!e.target.value) return;
                            const grupoId = Object.keys(itemsEnSemana).find(gid =>
                              itemsEnSemana[gid].includes(e.target.value)
                            );
                            handleMatchItem(idx, 'matchear', grupoId, e.target.value);
                          }}
                        >
                          <option value="">Elige un item existente...</option>
                          {Object.keys(itemsEnSemana).map(grupoId =>
                            itemsEnSemana[grupoId].map(itemName => (
                              <option key={`${grupoId}-${itemName}`} value={itemName}>
                                {itemName} ({grupos.find(g => g.id === grupoId)?.nombre})
                              </option>
                            ))
                          )}
                        </select>
                      )}
                      {isMatched && matching.targetItemName && (
                        <div className="desglose-opcion-confirmacion">
                          ✓ Se sumará ${fmt(item.total)} a "{matching.targetItemName}"
                        </div>
                      )}
                    </div>

                    {/* Opción 2: Crear nuevo */}
                    <div className="desglose-opcion">
                      <label className="desglose-radio-label">
                        <input
                          type="radio"
                          name={`item-${idx}`}
                          checked={isCreating}
                          onChange={() => handleMatchItem(idx, 'crear')}
                        />
                        Crear como nuevo en...
                      </label>
                      {isCreating && (
                        <select
                          className="desglose-item-select"
                          value={matching.grupoId || ''}
                          onChange={(e) => {
                            if (!e.target.value) return;
                            handleMatchItem(idx, 'crear', e.target.value);
                          }}
                        >
                          <option value="">Elige grupo...</option>
                          {grupos.map(g => (
                            <option key={g.id} value={g.id}>{g.nombre}</option>
                          ))}
                        </select>
                      )}
                      {isCreating && matching.grupoId && (
                        <div className="desglose-opcion-confirmacion">
                          ✓ Se creará "{item.nombre}" con ${fmt(item.total)} en {grupos.find(g => g.id === matching.grupoId)?.nombre}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Resumen */}
        <div className="desglose-resumen">
          <h3>Resumen</h3>
          {Object.keys(matchings).map((idx) => {
            const matching = matchings[idx];
            const item = desglose.items[parseInt(idx)];
            if (matching.tipo === 'matchear') {
              return (
                <div key={idx} className="resumen-item">
                  <span>✓ {item.nombre} → +${fmt(item.total)} a "{matching.targetItemName}"</span>
                </div>
              );
            } else {
              return (
                <div key={idx} className="resumen-item">
                  <span>+ {item.nombre} → ${fmt(item.total)} (nuevo en {grupos.find(g => g.id === matching.grupoId)?.nombre})</span>
                </div>
              );
            }
          })}
        </div>

        {/* Acciones */}
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onCancelar}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            onClick={confirmar}
            disabled={!itemsAprobados}
            title={!itemsAprobados ? 'Asigná todos los items primero' : ''}
          >
            <CheckCircle2 size={16} /> Aplicar ({Object.keys(matchings).length}/{desglose.items.length})
          </button>
        </div>
      </div>
    </div>
  );
}
