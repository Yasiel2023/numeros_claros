// src/components/Tarjetas.js
import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 0, useGrouping: false }).format(n || 0);
const fmtUSD = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2, useGrouping: false }).format(n || 0);

export default function Tarjetas({ data = [], onChange }) {
  const [newNombre, setNewNombre] = useState('');
  const [newMoneda, setNewMoneda] = useState('UYU');
  const [showAdd, setShowAdd] = useState(false);

  const agregar = () => {
    if (!newNombre.trim()) return;
    onChange([...data, { nombre: newNombre.trim(), moneda: newMoneda, monto: 0, pagado: false }]);
    setNewNombre('');
    setNewMoneda('UYU');
    setShowAdd(false);
  };

  const actualizar = (idx, campo, val) => {
    onChange(data.map((t, i) => i === idx ? { ...t, [campo]: val } : t));
  };

  const eliminar = (idx) => onChange(data.filter((_, i) => i !== idx));

  const totalUYU = data.filter(t => t.moneda === 'UYU' && !t.pagado).reduce((s, t) => s + (t.monto || 0), 0);
  const totalUSD = data.filter(t => t.moneda === 'USD' && !t.pagado).reduce((s, t) => s + (t.monto || 0), 0);
  const totalUYUPagado = data.filter(t => t.moneda === 'UYU' && t.pagado).reduce((s, t) => s + (t.monto || 0), 0);
  const totalUSDPagado = data.filter(t => t.moneda === 'USD' && t.pagado).reduce((s, t) => s + (t.monto || 0), 0);

  return (
    <div className="section-block">
      <div className="section-header-row">
        <h2 className="section-title">💳 Tarjetas de crédito pendientes</h2>
        <button className="add-row-btn" onClick={() => setShowAdd(s => !s)}>
          <Plus size={14} /> Agregar tarjeta
        </button>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Tarjeta</th>
            <th>Moneda</th>
            <th>Monto pendiente</th>
            <th>Pagado</th>
            <th style={{ width: 36 }}></th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 && !showAdd && (
            <tr><td colSpan={5} className="empty-row">Sin tarjetas. Usá el botón para agregar.</td></tr>
          )}
          {data.map((t, i) => (
            <tr key={i} className={t.pagado ? 'tarj-row-pagada' : ''}>
              <td>
                <input
                  className="cell-input"
                  type="text"
                  value={t.nombre}
                  onChange={e => actualizar(i, 'nombre', e.target.value)}
                />
              </td>
              <td>
                <select
                  className="cell-select"
                  value={t.moneda}
                  onChange={e => actualizar(i, 'moneda', e.target.value)}
                >
                  <option value="UYU">UYU $</option>
                  <option value="USD">USD $</option>
                </select>
              </td>
              <td>
                <input
                  className="cell-input real-input"
                  type="number"
                  value={t.monto || ''}
                  min="0"
                  step={t.moneda === 'USD' ? '0.01' : '1'}
                  onChange={e => actualizar(i, 'monto', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                />
              </td>
              <td className="tarj-pagado-cell">
                <button
                  className={`tarj-pagado-btn ${t.pagado ? 'pagado' : 'pendiente'}`}
                  onClick={() => actualizar(i, 'pagado', !t.pagado)}
                  title={t.pagado ? 'Marcar como pendiente' : 'Marcar como pagado'}
                >
                  {t.pagado ? '✓ Pagado' : 'Pendiente'}
                </button>
              </td>
              <td>
                <button className="del-btn" onClick={() => eliminar(i)} title="Eliminar">
                  <Trash2 size={13} />
                </button>
              </td>
            </tr>
          ))}
          {showAdd && (
            <tr className="add-row">
              <td>
                <input
                  className="cell-input"
                  type="text"
                  placeholder="Ej: Visa OCA"
                  value={newNombre}
                  autoFocus
                  onChange={e => setNewNombre(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && agregar()}
                />
              </td>
              <td>
                <select className="cell-select" value={newMoneda} onChange={e => setNewMoneda(e.target.value)}>
                  <option value="UYU">UYU $</option>
                  <option value="USD">USD $</option>
                </select>
              </td>
              <td>—</td>
              <td>—</td>
              <td>
                <button className="add-confirm-btn" onClick={agregar} disabled={!newNombre.trim()}>
                  ✓
                </button>
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="totals-row">
            <td colSpan={2}><strong>TOTAL PENDIENTE</strong></td>
            <td className="neg"><strong>
              {totalUYU === 0 && totalUSD === 0 && '—'}
              {totalUYU > 0 && `$${fmt(totalUYU)}`}
              {totalUYU > 0 && totalUSD > 0 && ' + '}
              {totalUSD > 0 && fmtUSD(totalUSD)}
            </strong></td>
            <td></td><td></td>
          </tr>
          {(totalUYUPagado > 0 || totalUSDPagado > 0) && (
            <tr className="totals-row tarj-pagado-total">
              <td colSpan={2}><strong>TOTAL PAGADO</strong></td>
              <td className="pos"><strong>
                {totalUYUPagado > 0 && `$${fmt(totalUYUPagado)}`}
                {totalUYUPagado > 0 && totalUSDPagado > 0 && ' + '}
                {totalUSDPagado > 0 && fmtUSD(totalUSDPagado)}
              </strong></td>
              <td></td><td></td>
            </tr>
          )}
        </tfoot>
      </table>

      {(totalUYU > 0 || totalUSD > 0) && (
        <div className="tarj-note">
          💡 Las tarjetas marcadas como <strong>✓ Pagado</strong> se descuentan del ahorro real del mes. Las pendientes no afectan el cálculo.
          {totalUSD > 0 && <> La deuda en USD ({fmtUSD(totalUSD)}) se muestra de forma informativa.</>}
        </div>
      )}
    </div>
  );
}
