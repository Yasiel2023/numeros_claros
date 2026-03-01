// src/components/Basicos.js
import React, { useState } from 'react';
import { Plus, Trash2, Check, X, CheckCircle2 } from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);

// real > 0 = aún debe esa cantidad; real = 0 = pagado
function BasicoRow({ item, onChange, onDelete, onPagar }) {
  const pagado = (item.real || 0) === 0;
  return (
    <tr className={pagado ? 'row-pagado' : ''}>
      <td>
        <span className="item-nombre">{item.nombre}</span>
      </td>
      <td>
        <input type="number" className="cell-input" value={item.previsto || ''} min="0"
          onChange={e => onChange({ ...item, previsto: parseFloat(e.target.value) || 0 })}
          placeholder="0" />
      </td>
      <td>
        <input type="number" className="cell-input real-input" value={item.real || ''} min="0"
          onChange={e => onChange({ ...item, real: parseFloat(e.target.value) || 0 })}
          placeholder="0 = pagado" />
      </td>
      <td>
        {pagado
          ? <span className="status-ok"><CheckCircle2 size={16}/> Pagado</span>
          : <span className="status-pend">Pendiente ${fmt(item.real)}</span>
        }
      </td>
      <td>
        {!pagado && (
          <button className="btn-pagar" onClick={() => onPagar(item)} title="Marcar como pagado">✓ Pagar</button>
        )}
      </td>
      <td>
        <button className="icon-btn-sm danger" onClick={onDelete}><Trash2 size={13}/></button>
      </td>
    </tr>
  );
}

export default function Basicos({ data, onChange }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newNombre, setNewNombre] = useState('');
  const [newPrev, setNewPrev] = useState('');

  const items = data || [];

  const update = (idx, item) => { const n = [...items]; n[idx] = item; onChange(n); };
  const deleteItem = (idx) => onChange(items.filter((_, i) => i !== idx));
  const pagar = (idx) => update(idx, { ...items[idx], real: 0 });

  const addItem = () => {
    if (!newNombre) return;
    onChange([...items, { nombre: newNombre, previsto: parseFloat(newPrev) || 0, real: parseFloat(newPrev) || 0 }]);
    setNewNombre(''); setNewPrev(''); setShowAdd(false);
  };

  const totalPrev = items.reduce((s, i) => s + (i.previsto || 0), 0);
  const totalPend = items.reduce((s, i) => s + (i.real || 0), 0);
  const pagados = items.filter(i => (i.real || 0) === 0).length;

  return (
    <div className="section-block">
      <div className="section-header">
        <h2 className="section-title">🏠 Gastos Básicos</h2>
        <div className="section-header-right">
          <span className="progress-txt">{pagados}/{items.length} pagados</span>
          <button className="btn-add-row" onClick={() => setShowAdd(!showAdd)}>
            <Plus size={14}/> Agregar
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="add-row-form">
          <input value={newNombre} onChange={e => setNewNombre(e.target.value)} placeholder="Nombre del gasto" className="add-input" />
          <input type="number" value={newPrev} onChange={e => setNewPrev(e.target.value)} placeholder="Previsto $" className="add-input short" />
          <button className="btn-confirm" onClick={addItem}><Check size={14}/></button>
          <button className="btn-cancel" onClick={() => setShowAdd(false)}><X size={14}/></button>
        </div>
      )}

      <div className="pend-summary">
        <div className="ps-item">
          <span>Total previsto</span>
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
            <th></th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <BasicoRow key={i} item={item}
              onChange={upd => update(i, upd)}
              onDelete={() => deleteItem(i)}
              onPagar={() => pagar(i)} />
          ))}
        </tbody>
        <tfoot>
          <tr className="totals-row">
            <td>TOTAL</td>
            <td className="total-val">${fmt(totalPrev)}</td>
            <td className={`total-val ${totalPend > 0 ? 'neg' : 'pos'}`}>${fmt(totalPend)}</td>
            <td colSpan={3}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
