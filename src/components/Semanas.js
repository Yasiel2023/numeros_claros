// src/components/Semanas.js
import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2, Check, X, ShoppingCart } from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 0, useGrouping: false }).format(n || 0);

const FREQ_LABEL = { semanal: 'sem', quincenal: 'quin', mensual: 'mens' };
const FREQ_CLASS = { semanal: 'freq-semanal', quincenal: 'freq-quincenal', mensual: 'freq-mensual' };

// Función para determinar si una semana es la actual
const esSemanaActual = (semana, anio, mes) => {
  const hoy = new Date();
  const diaHoy = hoy.getDate();
  const mesHoy = hoy.getMonth();
  const anioHoy = hoy.getFullYear();
  
  // Solo verificar si estamos en el mismo año y mes
  if (anioHoy !== anio || mesHoy !== mes) {
    return false;
  }
  
  // Obtener el día de la semana (del objeto semana)
  const diaSemana = semana.dia;
  if (!diaSemana) return false;
  
  // Calcular el rango de la semana (aproximadamente 7 días desde el día de compra)
  const inicioSemana = Math.max(1, diaSemana - 3);
  const finSemana = Math.min(new Date(anio, mes + 1, 0).getDate(), diaSemana + 3);
  
  return diaHoy >= inicioSemana && diaHoy <= finSemana;
};

function ItemRow({ item, onChange, onDelete }) {
  const freq = item.frecuencia || 'semanal';
  return (
    <tr>
      <td>
        <span className="item-nombre">{item.nombre}</span>
        <span className={`freq-badge ${FREQ_CLASS[freq] || ''}`}>{FREQ_LABEL[freq] || freq}</span>
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
      <td>
        <button className="icon-btn-sm danger" onClick={onDelete}><Trash2 size={13}/></button>
      </td>
    </tr>
  );
}

function SemanaBlock({ semana, idx, onChangeSemana, onDelete, anio, mes }) {
  // Determinar si esta semana es la actual para el estado inicial del acordeón
  const esActual = esSemanaActual(semana, anio, mes);
  const [open, setOpen] = useState(esActual);
  const [showAdd, setShowAdd] = useState(false);
  const [newNombre, setNewNombre] = useState('');
  const [newPrev, setNewPrev] = useState('');
  const [newFrec, setNewFrec] = useState('semanal');

  const items = semana.items || [];
  const totalPrev = items.reduce((s, it) => s + (it.previsto || 0), 0);
  const totalReal = items.reduce((s, it) => s + (it.real || it.previsto || 0), 0);

  const updateItem = (iIdx, upd) => {
    const next = [...items]; next[iIdx] = upd;
    onChangeSemana({ ...semana, items: next });
  };
  const deleteItem = (iIdx) => onChangeSemana({ ...semana, items: items.filter((_, i) => i !== iIdx) });

  const addItem = () => {
    if (!newNombre) return;
    onChangeSemana({ ...semana, items: [...items, { nombre: newNombre, previsto: parseFloat(newPrev) || 0, real: 0, frecuencia: newFrec }] });
    setNewNombre(''); setNewPrev(''); setNewFrec('semanal'); setShowAdd(false);
  };

  return (
    <div className="semana-block">
      <div className="semana-header" onClick={() => setOpen(!open)}>
        <div className="sh-left">
          {open ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
          <ShoppingCart size={15}/>
          <span className="sh-label">{semana.label}</span>
        </div>
        <div className="sh-right">
          <span className="sh-real">${fmt(totalReal)}</span>
          <span className="sh-prev">/ ${fmt(totalPrev)}</span>
          <button className="icon-btn-sm danger ml8" title="Eliminar semana"
            onClick={e => { e.stopPropagation(); onDelete(); }}><Trash2 size={13}/></button>
        </div>
      </div>

      {open && (
        <div className="semana-body">
          {showAdd && (
            <div className="add-row-form">
              <input value={newNombre} onChange={e => setNewNombre(e.target.value)} placeholder="Producto" className="add-input"
                onKeyDown={e => e.key === 'Enter' && addItem()} />
              <input type="number" value={newPrev} onChange={e => setNewPrev(e.target.value)} placeholder="$ previsto" className="add-input short" />
              <select value={newFrec} onChange={e => setNewFrec(e.target.value)} className="add-select">
                <option value="semanal">Semanal</option>
                <option value="quincenal">Quincenal</option>
                <option value="mensual">Mensual</option>
              </select>
              <button className="btn-confirm" onClick={addItem}><Check size={14}/></button>
              <button className="btn-cancel" onClick={() => setShowAdd(false)}><X size={14}/></button>
            </div>
          )}
          <table className="data-table compact">
            <thead>
              <tr><th>Producto</th><th>Previsto $</th><th>Real $</th><th></th></tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <ItemRow key={i} item={it}
                  onChange={upd => updateItem(i, upd)}
                  onDelete={() => deleteItem(i)} />
              ))}
            </tbody>
            <tfoot>
              <tr className="totals-row">
                <td>TOTAL</td>
                <td className="total-val">${fmt(totalPrev)}</td>
                <td className="total-val real-val">${fmt(totalReal)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
          <button className="btn-add-row mt4" onClick={() => setShowAdd(!showAdd)}>
            <Plus size={13}/> Agregar producto
          </button>
        </div>
      )}
    </div>
  );
}

export default function Semanas({ data, onChange, semanasCalc, anio, mes }) {
  // data: array de semanas [ { label, dia, items: [...] } ]
  // semanasCalc: semanas calculadas del mes (para referencia de labels/días)
  // anio, mes: año y mes actual para determinar la semana actual

  const semanas = data || [];

  const updateSemana = (idx, upd) => {
    const next = [...semanas]; next[idx] = upd; onChange(next);
  };
  const deleteSemana = (idx) => onChange(semanas.filter((_, i) => i !== idx));

  // Total general
  const totalPrev = semanas.reduce((s, sem) => s + sem.items.reduce((ss, it) => ss + (it.previsto || 0), 0), 0);
  const totalReal = semanas.reduce((s, sem) => s + sem.items.reduce((ss, it) => ss + (it.real || it.previsto || 0), 0), 0);

  return (
    <div className="section-block">
      <div className="section-header">
        <h2 className="section-title">🛒 Compras Semanales</h2>
        <div className="section-header-right">
          <span className="progress-txt">{semanas.length} semanas · ${fmt(totalReal)}</span>
        </div>
      </div>

      <div className="semanas-nota">
        <span>📅</span>
        <span>Las semanas se calculan automáticamente según los <strong>viernes y sábados</strong> del mes. 
        Si quedan ≤3 días después del último viernes/sábado, esos gastos se suman a la semana anterior.</span>
      </div>

      <div className="semanas-totales">
        <div className="ps-item"><span>Total previsto</span><strong>${fmt(totalPrev)}</strong></div>
        <div className="ps-item teal"><span>Total real</span><strong>${fmt(totalReal)}</strong></div>
      </div>

      <div className="semanas-list">
        {semanas.length === 0 ? (
          <div className="empty-txt">No hay semanas de compra para este mes.</div>
        ) : semanas.map((sem, i) => (
          <SemanaBlock key={i} semana={sem} idx={i}
            onChangeSemana={upd => updateSemana(i, upd)}
            onDelete={() => deleteSemana(i)}
            anio={anio}
            mes={mes} />
        ))}
      </div>
    </div>
  );
}
