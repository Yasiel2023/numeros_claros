// src/components/Impuestos.js
import React, { useState } from 'react';
import { Plus, Trash2, Check, X, CheckCircle2, ToggleLeft, ToggleRight } from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);

const FRECUENCIAS = [
  { value: 'mensual',    label: 'Mensual' },
  { value: 'bimestral', label: 'Mes sí/no' },
  { value: 'trimestral',label: 'Cada 3-4 meses' },
  { value: 'anual',     label: 'Anual' },
];

function ImpuestoRow({ item, onChange, onDelete }) {
  const pagado = (item.real || 0) === 0;
  const noAplica = !item.activo;

  return (
    <tr className={noAplica ? 'row-disabled' : pagado ? 'row-pagado' : ''}>
      <td>
        <span className="item-nombre">{item.nombre}</span>
        <span className={`freq-badge freq-${item.frecuencia}`}>{FRECUENCIAS.find(f => f.value === item.frecuencia)?.label || item.frecuencia}</span>
      </td>
      <td>
        <input type="number" className="cell-input" value={item.previsto || ''} min="0"
          onChange={e => onChange({ ...item, previsto: parseFloat(e.target.value) || 0 })}
          placeholder="0" disabled={noAplica} />
      </td>
      <td>
        <input type="number" className="cell-input real-input" value={item.real || ''} min="0"
          onChange={e => onChange({ ...item, real: parseFloat(e.target.value) || 0 })}
          placeholder="0 = pagado" disabled={noAplica} />
      </td>
      <td>
        {noAplica
          ? <span className="status-na">No aplica este mes</span>
          : pagado
            ? <span className="status-ok"><CheckCircle2 size={15}/> Pagado</span>
            : <span className="status-pend">Debe ${fmt(item.real)}</span>
        }
      </td>
      <td>
        {/* Toggle activo/inactivo para este mes */}
        <button className={`toggle-btn ${item.activo ? 'on' : 'off'}`}
          title={item.activo ? 'Desactivar este mes' : 'Activar este mes'}
          onClick={() => onChange({ ...item, activo: !item.activo, real: !item.activo ? (item.previsto || 0) : 0 })}>
          {item.activo ? <ToggleRight size={20}/> : <ToggleLeft size={20}/>}
        </button>
      </td>
      <td>
        {item.activo && !pagado && (
          <button className="btn-pagar" onClick={() => onChange({ ...item, real: 0 })}>✓ Pagar</button>
        )}
      </td>
      <td>
        <button className="icon-btn-sm danger" onClick={onDelete}><Trash2 size={13}/></button>
      </td>
    </tr>
  );
}

export default function Impuestos({ data, onChange }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newNombre, setNewNombre] = useState('');
  const [newPrev, setNewPrev] = useState('');
  const [newFrec, setNewFrec] = useState('mensual');

  const items = data || [];

  const update = (idx, item) => { const n = [...items]; n[idx] = item; onChange(n); };
  const deleteItem = (idx) => onChange(items.filter((_, i) => i !== idx));

  const addItem = () => {
    if (!newNombre) return;
    const prev = parseFloat(newPrev) || 0;
    onChange([...items, { nombre: newNombre, previsto: prev, real: prev, frecuencia: newFrec, activo: true }]);
    setNewNombre(''); setNewPrev(''); setNewFrec('mensual'); setShowAdd(false);
  };

  const activosItems = items.filter(i => i.activo);
  const totalPrev = activosItems.reduce((s, i) => s + (i.previsto || 0), 0);
  const totalPend = activosItems.reduce((s, i) => s + (i.real || 0), 0);
  const pagados = activosItems.filter(i => (i.real || 0) === 0).length;

  return (
    <div className="section-block">
      <div className="section-header">
        <h2 className="section-title">🧾 Impuestos & Tributos</h2>
        <div className="section-header-right">
          <span className="progress-txt">{pagados}/{activosItems.length} pagados este mes</span>
          <button className="btn-add-row" onClick={() => setShowAdd(!showAdd)}>
            <Plus size={14}/> Agregar
          </button>
        </div>
      </div>

      <div className="imp-nota">
        <span>💡</span>
        <span>Usá el toggle <strong>ON/OFF</strong> para indicar si un impuesto aplica este mes (bimestral, gas cada 3-4 meses, etc.)</span>
      </div>

      {showAdd && (
        <div className="add-row-form">
          <input value={newNombre} onChange={e => setNewNombre(e.target.value)} placeholder="Nombre impuesto" className="add-input" />
          <input type="number" value={newPrev} onChange={e => setNewPrev(e.target.value)} placeholder="Previsto $" className="add-input short" />
          <select value={newFrec} onChange={e => setNewFrec(e.target.value)} className="add-select">
            {FRECUENCIAS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          <button className="btn-confirm" onClick={addItem}><Check size={14}/></button>
          <button className="btn-cancel" onClick={() => setShowAdd(false)}><X size={14}/></button>
        </div>
      )}

      <div className="pend-summary">
        <div className="ps-item">
          <span>Total previsto (activos)</span>
          <strong>${fmt(totalPrev)}</strong>
        </div>
        <div className="ps-item orange">
          <span>Pendiente de pago</span>
          <strong>${fmt(totalPend)}</strong>
        </div>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Concepto</th>
            <th>Previsto $</th>
            <th>Resta pagar $</th>
            <th>Estado</th>
            <th>Este mes</th>
            <th></th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <ImpuestoRow key={i} item={item}
              onChange={upd => update(i, upd)}
              onDelete={() => deleteItem(i)} />
          ))}
        </tbody>
        <tfoot>
          <tr className="totals-row">
            <td>TOTAL (activos)</td>
            <td className="total-val">${fmt(totalPrev)}</td>
            <td className={`total-val ${totalPend > 0 ? 'neg' : 'pos'}`}>${fmt(totalPend)}</td>
            <td colSpan={4}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
