// src/components/AplicarDesglose.js
import React, { useState, useMemo } from 'react';
import { Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 0, useGrouping: false }).format(n || 0);

export default function AplicarDesglose({
  desglose,        // { tienda, items: [{nombre, cantidad, precio_unitario, total}], observaciones }
  foto,
  mesData,
  grupos,
  semanas,         // array de periodos del mes actual (para elegir a cuál aplicar)
  onAplicar,       // (aplicados: [{grupoId, periodoNumero, item}], nuevos: [{nombre, grupoId, previsto}])
  onCancelar,
}) {
  const [periodoSelec, setPeriodoSelec] = useState(semanas?.[0]?.numero || 1);
  const [aplicados, setAplicados] = useState([]);
  const [nuevosItems, setNuevosItems] = useState(desglose.items || []);

  // Buscar qué items de la compra matchean con items del mes
  const matcheos = useMemo(() => {
    const existentes = {};
    grupos.forEach(g => {
      const periodos = mesData.gastos[g.id] || [];
      periodos.forEach(p => {
        (p.items || []).forEach(item => {
          const key = item.nombre.toLowerCase().trim();
          if (!existentes[key]) existentes[key] = [];
          existentes[key].push({ ...item, grupoId: g.id, periodoNumero: p.numero });
        });
      });
    });

    return desglose.items.map(item => {
      const clave = item.nombre.toLowerCase().trim();
      const matches = existentes[clave] || [];
      return {
        original: item,
        matches,
        seleccionado: matches.length > 0 ? matches[0] : null,
      };
    });
  }, [desglose, mesData, grupos]);

  // Items que van a crearse nuevos
  const itemsNuevos = useMemo(() => {
    return matcheos.filter(m => !m.seleccionado).map(m => ({
      itemDesglose: m.original,
      grupoId: null,
      seleccionado: false,
    }));
  }, [matcheos]);

  const toggleAplicado = (idx, match) => {
    const currentIndex = aplicados.findIndex(a => a.matchIdx === idx);
    if (currentIndex >= 0) {
      aplicados.splice(currentIndex, 1);
      setAplicados([...aplicados]);
    } else {
      setAplicados([...aplicados, { matchIdx: idx, match }]);
    }
  };

  const agregarNuevoItem = (grupoId) => {
    if (!grupoId) return;
    const nuevoIdx = nuevosItems.findIndex(n => !n.grupoId);
    if (nuevoIdx >= 0) {
      const updated = [...nuevosItems];
      updated[nuevoIdx].grupoId = grupoId;
      setNuevosItems(updated);
    }
  };

  const confirmar = () => {
    const aplicarList = aplicados.map(a => ({
      grupoId: a.match.seleccionado.grupoId,
      periodoNumero: a.match.seleccionado.periodoNumero,
      nombre: a.match.original.nombre,
      monto: a.match.original.total,
    }));

    const crearList = nuevosItems
      .filter(n => n.grupoId)
      .map(n => ({
        grupoId: n.grupoId,
        nombre: n.itemDesglose.nombre,
        previsto: n.itemDesglose.total,
      }));

    onAplicar(aplicarList, crearList, periodoSelec);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content desglose-modal">
        <div className="modal-header">
          <h2>📝 Revisar desglose</h2>
          <p className="text-sm text-gray-500">{desglose.tienda || 'Comprobante'}</p>
        </div>

        {desglose.observaciones && (
          <div className="alert alert-info">
            <AlertCircle size={16} /> {desglose.observaciones}
          </div>
        )}

        {/* Selector de semana/período */}
        <div className="desglose-periodo">
          <label>¿A qué semana/período lo aplicamos?</label>
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

        {/* Items a aplicar */}
        {matcheos.length > 0 && (
          <div className="desglose-section">
            <h3>✓ Items que matcheamos ({aplicados.length})</h3>
            <div className="desglose-items">
              {matcheos.map((m, idx) => {
                const isAplicado = aplicados.some(a => a.matchIdx === idx);
                return (
                  <div key={idx} className={`desglose-item ${isAplicado ? 'selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={isAplicado}
                      onChange={() => toggleAplicado(idx, m)}
                    />
                    <div className="desglose-item-info">
                      <div className="desglose-item-name">{m.original.nombre}</div>
                      {m.seleccionado && (
                        <div className="desglose-item-match">
                          ↳ Matchea con "{m.seleccionado.nombre}" en {grupos.find(g => g.id === m.seleccionado.grupoId)?.nombre}
                        </div>
                      )}
                    </div>
                    <div className="desglose-item-monto">${fmt(m.original.total)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Items a crear */}
        {itemsNuevos.length > 0 && (
          <div className="desglose-section">
            <h3>+ Crear nuevos items ({itemsNuevos.filter(n => n.grupoId).length})</h3>
            <p className="text-sm text-gray-500">Items que no encontramos en el mes — elige a qué grupo agregarlos</p>
            <div className="desglose-items">
              {itemsNuevos.map((n, idx) => (
                <div key={idx} className={`desglose-item ${n.grupoId ? 'selected' : ''}`}>
                  <div className="desglose-item-info">
                    <div className="desglose-item-name">{n.itemDesglose.nombre}</div>
                    {!n.grupoId && (
                      <select
                        className="desglose-item-select"
                        onChange={(e) => agregarNuevoItem(e.target.value)}
                      >
                        <option value="">Elige grupo...</option>
                        {grupos.map(g => (
                          <option key={g.id} value={g.id}>{g.nombre}</option>
                        ))}
                      </select>
                    )}
                    {n.grupoId && (
                      <div className="desglose-item-match">
                        → Se agregará a {grupos.find(g => g.id === n.grupoId)?.nombre}
                      </div>
                    )}
                  </div>
                  <div className="desglose-item-monto">${fmt(n.itemDesglose.total)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Acciones */}
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onCancelar}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            onClick={confirmar}
            disabled={aplicados.length === 0 && itemsNuevos.filter(n => n.grupoId).length === 0}
          >
            <CheckCircle2 size={16} /> Aplicar cambios
          </button>
        </div>
      </div>
    </div>
  );
}
