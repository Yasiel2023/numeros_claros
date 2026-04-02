// src/components/GrupoGastos.js
// Componente generico para cualquier grupo de gastos basado en frecuencia.
// Frecuencias: mensual (1 periodo) | quincenal (2) | cada10dias (3) | semanal (N semanas)
// La data llega como array de periodos: [{numero, label, items:[]}]
// Compatibilidad atras: si llegan items planos se envuelven en un unico periodo.
import React, { useState } from 'react';
import { Plus, Trash2, Check, X, ChevronDown, ChevronUp } from 'lucide-react';

const fmt = (n) =>
  new Intl.NumberFormat('es-UY', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    useGrouping: false,
  }).format(n || 0);

// Función para determinar si un período semanal es el actual
const esPeriodoActual = (periodo, frecuencia, anio, mes) => {
  // Solo aplicar para gastos semanales
  if (frecuencia !== 'semanal') {
    return true; // Para no semanales, mantener comportamiento original (todos abiertos)
  }
  
  const hoy = new Date();
  const diaHoy = hoy.getDate();
  const mesHoy = hoy.getMonth();
  const anioHoy = hoy.getFullYear();
  
  // Solo verificar si estamos en el mismo año y mes
  if (anioHoy !== anio || mesHoy !== mes) {
    return false;
  }
  
  // Extraer el día de la semana del label (formato: "Semana X (DD/MM)")
  const match = periodo.label.match(/\((\d{1,2})\/\d{1,2}\)/);
  if (!match) return false;
  
  const diaSemana = parseInt(match[1], 10);
  if (!diaSemana) return false;
  
  // Calcular el rango de la semana (aproximadamente 7 días desde el día de compra)
  const inicioSemana = Math.max(1, diaSemana - 3);
  const finSemana = Math.min(new Date(anio, mes + 1, 0).getDate(), diaSemana + 3);
  
  return diaHoy >= inicioSemana && diaHoy <= finSemana;
};

// --- Detecta si el array es de periodos (nuevo) o de items directos (viejo) ---
function isPeriodoArray(arr) {
  return (
    arr.length > 0 &&
    arr[0] !== null &&
    typeof arr[0] === 'object' &&
    'items' in arr[0]
  );
}

// Normaliza data a array de periodos siempre
function toPeriodos(data) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return [{ numero: 1, label: 'Mes', items: [] }];
  }
  if (isPeriodoArray(data)) return data;
  // Formato viejo: items planos -> unico periodo
  return [{ numero: 1, label: 'Mes', items: data }];
}

// --- Fila de item individual ---
// Modelo: { nombre, previsto, real (= previsto por defecto), pagado: false }
// pagado:true  -> item ya pagado, real = monto pagado
// pagado:false -> pendiente de pago, real = monto esperado
function ItemRow({ item, onChange, onDelete }) {
  const previsto = item.previsto || 0;
  // real hereda previsto si no fue editado manualmente
  const real    = item.real !== undefined ? (item.real || 0) : previsto;
  const pagado  = item.pagado === true;
  const sinPrev = previsto === 0;

  return (
    <tr className={pagado ? 'row-pagado' : ''}>
      <td><span className="item-nombre">{item.nombre}</span></td>
      <td>
        <input
          type="number" className="cell-input" value={previsto || ''} min="0"
          onChange={e => onChange({ ...item, previsto: parseFloat(e.target.value) || 0 })}
          placeholder="0"
        />
      </td>
      <td>
        <input
          type="number" className="cell-input real-input" value={real || ''} min="0"
          onChange={e => onChange({ ...item, real: parseFloat(e.target.value) || 0 })}
          placeholder="0"
          disabled={pagado}
        />
      </td>
      <td>
        {!sinPrev && (
          pagado
            ? <button className="btn-unpagar" onClick={() => onChange({ ...item, pagado: false })}>
                Deshacer
              </button>
            : <button className="btn-pagar" onClick={() => onChange({ ...item, pagado: true })}>
                Pagar
              </button>
        )}
      </td>
      <td>
        <button className="icon-btn-sm danger" onClick={onDelete}>
          <Trash2 size={13} />
        </button>
      </td>
    </tr>
  );
}

// --- Seccion de un periodo con su propia tabla e inputs ---
function PeriodoSection({ periodo, showHeader, onChange, isCurrentPeriod = true }) {
  const [open, setOpen]       = useState(isCurrentPeriod);
  const [showAdd, setShowAdd] = useState(false);
  const [newNombre, setNewNombre] = useState('');
  const [newPrev, setNewPrev]     = useState('');

  const items      = periodo.items || [];
  const conPrev    = items.filter(i => (i.previsto || 0) > 0).length;
  const pagados    = items.filter(i => i.pagado === true).length;
  const totalPrev  = items.reduce((s, i) => s + (i.previsto || 0), 0);
  const totalPend  = items.filter(i => i.pagado !== true)
                          .reduce((s, i) => s + (i.real !== undefined ? (i.real || 0) : (i.previsto || 0)), 0);
  const totalPagado = items.filter(i => i.pagado === true)
                           .reduce((s, i) => s + (i.real || 0), 0);

  const updateItem = (idx, item) => {
    const n = [...items]; n[idx] = item;
    onChange({ ...periodo, items: n });
  };
  const deleteItem = (idx) => onChange({ ...periodo, items: items.filter((_, i) => i !== idx) });

  const addItem = () => {
    if (!newNombre.trim()) return;
    const prev = parseFloat(newPrev) || 0;
    const it = { nombre: newNombre.trim(), previsto: prev, real: prev, pagado: false };
    onChange({ ...periodo, items: [...items, it] });
    setNewNombre(''); setNewPrev(''); setShowAdd(false);
  };

  return (
    <div className="periodo-section">
      {showHeader && (
        <button className="periodo-header" onClick={() => setOpen(o => !o)}>
          <span className="periodo-header-dot" />
          <span className="periodo-label">{periodo.label}</span>
          <span className="periodo-stats">
            {pagados}/{conPrev} pagados &middot; prev ${fmt(totalPrev)} &middot; pend ${fmt(totalPend)} &middot; pagado ${fmt(totalPagado)}
          </span>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      )}

      {(open || !showHeader) && (
        <>
          {showAdd && (
            <div className="add-row-form">
              <input
                value={newNombre}
                onChange={e => setNewNombre(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addItem()}
                placeholder="Nombre del gasto"
                className="add-input"
                autoFocus
              />
              <input
                type="number" value={newPrev}
                onChange={e => setNewPrev(e.target.value)}
                placeholder="Previsto $"
                className="add-input short"
              />
              <button className="btn-confirm" onClick={addItem}><Check size={14} /></button>
              <button className="btn-cancel"  onClick={() => { setShowAdd(false); setNewNombre(''); setNewPrev(''); }}>
                <X size={14} />
              </button>
            </div>
          )}

          <table className="data-table">
            <colgroup>
              <col style={{width:'auto'}}/>
              <col style={{width:'130px'}}/>
              <col style={{width:'140px'}}/>
              <col style={{width:'90px'}}/>
              <col style={{width:'36px'}}/>
            </colgroup>
            <thead>
              <tr>
                <th>Concepto</th>
                <th>Previsto $</th>
                <th>Real $</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-row">
                    Sin items — usa "Agregar item" para empezar.
                  </td>
                </tr>
              )}
              {items.map((item, idx) => (
                <ItemRow
                  key={idx}
                  item={item}
                  onChange={updated => updateItem(idx, updated)}
                  onDelete={() => deleteItem(idx)}
                />
              ))}
            </tbody>
            <tfoot>
              <tr className="total-row">
                <td><strong>Total previsto</strong></td>
                <td><strong>${fmt(totalPrev)}</strong></td>
                <td /><td colSpan={2} />
              </tr>
              <tr className="total-row-pend">
                <td>Pendiente de pago</td>
                <td />
                <td className="pend-total-cell">${fmt(totalPend)}</td>
                <td colSpan={2} />
              </tr>
              <tr className="total-row-pago">
                <td>Pagado</td>
                <td />
                <td className="pagado-total-cell">${fmt(totalPagado)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>

          {!showAdd && (
            <button className="btn-add-row periodo-add-btn" onClick={() => setShowAdd(true)}>
              <Plus size={13} /> Agregar item
            </button>
          )}
        </>
      )}
    </div>
  );
}

// =============================================================================
// Componente principal
// Props:
//   grupo   � { id, nombre, icono, frecuencia }
//   data    � array de periodos [{numero, label, items:[]}]  o items planos (compat)
//   onChange � callback con el array de periodos actualizado
// =============================================================================
export default function GrupoGastos({ grupo, data, onChange, anio, mes }) {
  const periodos    = toPeriodos(data || []);
  const showHeaders = periodos.length > 1;

  const updatePeriodo = (idx, periodo) => {
    const n = [...periodos]; n[idx] = periodo;
    onChange(n);
  };

  // Totales globales (suma de todos los periodos)
  const totalPrev  = periodos.reduce((s, p) =>
    s + (p.items || []).reduce((ss, i) => ss + (i.previsto || 0), 0), 0);
  const totalPend  = periodos.reduce((s, p) =>
    s + (p.items || []).filter(i => i.pagado !== true)
                       .reduce((ss, i) => ss + (i.real !== undefined ? (i.real || 0) : (i.previsto || 0)), 0), 0);
  const totalPagado = periodos.reduce((s, p) =>
    s + (p.items || []).filter(i => i.pagado === true)
                       .reduce((ss, i) => ss + (i.real || 0), 0), 0);
  const conPrev    = periodos.reduce((s, p) =>
    s + (p.items || []).filter(i => (i.previsto || 0) > 0).length, 0);
  const pagados    = periodos.reduce((s, p) =>
    s + (p.items || []).filter(i => i.pagado === true).length, 0);

  return (
    <div className="section-block">
      {/* Cabecera del grupo */}
      <div className="section-header">
        <h2 className="section-title">
          {grupo?.icono} {grupo?.nombre}
          {grupo?.frecuencia && grupo.frecuencia !== 'mensual' && (
            <span className="grupo-freq-badge">{grupo.frecuencia}</span>
          )}
        </h2>
        <div className="section-header-right">
          <span className="progress-txt">{pagados}/{conPrev} pagados</span>
        </div>
      </div>

      {/* Resumen rapido */}
      <div className="pend-summary">
        <div className="ps-item">
          <span>Total previsto</span>
          <strong>${fmt(totalPrev)}</strong>
        </div>
        <div className="ps-item orange">
          <span>Pendiente de pago</span>
          <strong>${fmt(totalPend)}</strong>
        </div>
        <div className="ps-item green">
          <span>Pagado</span>
          <strong>${fmt(totalPagado)}</strong>
        </div>
      </div>

      {/* Periodos */}
      {periodos.map((periodo, idx) => {
        const isCurrentPeriod = esPeriodoActual(periodo, grupo?.frecuencia, anio, mes);
        return (
          <PeriodoSection
            key={idx}
            periodo={periodo}
            showHeader={showHeaders}
            onChange={updated => updatePeriodo(idx, updated)}
            isCurrentPeriod={isCurrentPeriod}
          />
        );
      })}
    </div>
  );
}
