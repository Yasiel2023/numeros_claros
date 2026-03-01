// src/components/Ingresos.js
import React, { useState } from 'react';
import { Plus, Trash2, Check, X } from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 0, useGrouping: false }).format(n || 0);

function IngresoRow({ item, onChange, onDelete, esFijo }) {
  return (
    <tr className={esFijo ? 'row-fijo' : ''}>
      <td>
        <span className="item-nombre">{item.nombre}</span>
        {esFijo && <span className="badge-fijo">fijo</span>}
      </td>
      <td>
        <input type="number" className="cell-input" value={item.previsto || ''} min="0"
          onChange={e => onChange({ ...item, previsto: parseFloat(e.target.value) || 0 })}
          placeholder="0" />
      </td>
      <td>
        <input type="number" className="cell-input real-input" value={item.real || ''} min="0"
          onChange={e => onChange({ ...item, real: parseFloat(e.target.value) || 0 })}
          placeholder="0" />
      </td>
      <td className={`diff-cell ${(item.real || 0) >= (item.previsto || 0) ? 'pos' : 'neg'}`}>
        ${fmt((item.real || 0) - (item.previsto || 0))}
      </td>
      {!esFijo && (
        <td>
          <button className="icon-btn-sm danger" onClick={onDelete}><Trash2 size={13}/></button>
        </td>
      )}
    </tr>
  );
}

export default function Ingresos({ data, onChange }) {
  const [newNombre, setNewNombre] = useState('');
  const [newPrev, setNewPrev] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const items = data || [];

  const update = (idx, item) => {
    const next = [...items];
    next[idx] = item;
    onChange(next);
  };

  const deleteItem = (idx) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  const addItem = () => {
    if (!newNombre) return;
    onChange([...items, { nombre: newNombre, previsto: parseFloat(newPrev) || 0, real: 0, esFijo: false }]);
    setNewNombre(''); setNewPrev(''); setShowAdd(false);
  };

  const totalPrev = items.reduce((s, i) => s + (i.previsto || 0), 0);
  const totalReal = items.reduce((s, i) => s + (i.real || 0), 0);

  return (
    <div className="section-block">
      <div className="section-header">
        <h2 className="section-title">💼 Ingresos</h2>
        <button className="btn-add-row" onClick={() => setShowAdd(!showAdd)}>
          <Plus size={14}/> Agregar ingreso
        </button>
      </div>

      {showAdd && (
        <div className="add-row-form">
          <input value={newNombre} onChange={e => setNewNombre(e.target.value)} placeholder="Nombre ingreso" className="add-input" />
          <input type="number" value={newPrev} onChange={e => setNewPrev(e.target.value)} placeholder="Previsto $" className="add-input short" />
          <button className="btn-confirm" onClick={addItem}><Check size={14}/></button>
          <button className="btn-cancel" onClick={() => setShowAdd(false)}><X size={14}/></button>
        </div>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>Concepto</th>
            <th>Previsto $</th>
            <th>Real $</th>
            <th>Diferencia</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <IngresoRow key={i} item={item} esFijo={item.esFijo}
              onChange={upd => update(i, upd)}
              onDelete={() => deleteItem(i)} />
          ))}
        </tbody>
        <tfoot>
          <tr className="totals-row">
            <td>TOTAL</td>
            <td className="total-val">${fmt(totalPrev)}</td>
            <td className="total-val real-val">${fmt(totalReal)}</td>
            <td className={`diff-cell ${totalReal >= totalPrev ? 'pos' : 'neg'}`}>${fmt(totalReal - totalPrev)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
