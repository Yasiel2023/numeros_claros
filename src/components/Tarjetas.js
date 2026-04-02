// src/components/Tarjetas.js
// Credito: monto pendiente + pagado (modelo existente)
// Debito:  saldoInicial + historial de saldos [{ts, fecha, monto, nota}]
import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const fmt = (n) => new Intl.NumberFormat('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 0, useGrouping: false }).format(n || 0);
const fmtUSD = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2, useGrouping: false }).format(n || 0);
const fmtFecha = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
};

// ── Tarjeta de Debito ─────────────────────────────────────────
function TarjetaDebito({ tarjeta, onUpdate, onDelete }) {
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newMonto, setNewMonto] = useState('');
  const [newNota, setNewNota] = useState('');

  const saldos = tarjeta.saldos || [];
  const saldoActual = saldos.length > 0 ? saldos[saldos.length - 1].monto : (tarjeta.saldoInicial || 0);
  const saldoAnterior = saldos.length > 1 ? saldos[saldos.length - 2].monto
    : saldos.length === 1 ? (tarjeta.saldoInicial || 0) : null;
  const diff = saldoAnterior !== null ? saldoActual - saldoAnterior : null;
  const diffInicial = (tarjeta.saldoInicial || 0) > 0 ? saldoActual - (tarjeta.saldoInicial || 0) : null;

  const registrar = () => {
    const monto = parseFloat(newMonto);
    if (isNaN(monto)) return;
    const entrada = { ts: Date.now(), fecha: fmtFecha(), monto, nota: newNota.trim() };
    onUpdate({ ...tarjeta, saldos: [...saldos, entrada] });
    setNewMonto(''); setNewNota(''); setShowForm(false);
  };

  const eliminarSaldo = (idx) => {
    onUpdate({ ...tarjeta, saldos: saldos.filter((_, i) => i !== idx) });
  };

  const DiffIcon = diff === null ? null : diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
  const diffColor = diff === null ? '' : diff > 0 ? 'green' : diff < 0 ? 'red' : 'neutral';

  return (
    <div className="tarj-debito-card">
      <div className="tarj-debito-header">
        <div className="tarj-debito-info">
          <span className="tarj-debito-nombre">{tarjeta.nombre}</span>
          <span className="tarj-debito-badge">{tarjeta.moneda}</span>
          <span className="tarj-tipo-badge debito">Débito</span>
        </div>
        <div className="tarj-debito-saldo">
          <span className="tarj-saldo-val">
            {tarjeta.moneda === 'USD' ? fmtUSD(saldoActual) : `$${fmt(saldoActual)}`}
          </span>
          {diff !== null && (
            <span className={`tarj-saldo-diff ${diffColor}`}>
              {DiffIcon && <DiffIcon size={12}/>}
              {diff > 0 ? '+' : ''}{tarjeta.moneda === 'USD' ? fmtUSD(diff) : `$${fmt(diff)}`}
            </span>
          )}
        </div>
        <div className="tarj-debito-actions">
          <button className="btn-registrar-saldo" onClick={() => { setShowForm(s => !s); setOpen(true); }}>
            <Plus size={13}/> Registrar saldo
          </button>
          <button className="tarj-hist-toggle" onClick={() => setOpen(o => !o)} title="Ver historial">
            {open ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
          </button>
          <button className="icon-btn-sm danger" onClick={onDelete}><Trash2 size={13}/></button>
        </div>
      </div>

      {/* Fila de saldo inicial */}
      <div className="tarj-debito-inicial">
        <span>Saldo inicial del mes</span>
        <div className="tarj-inicial-input-row">
          <input
            type="number" className="cell-input" min="0"
            value={tarjeta.saldoInicial || ''}
            onChange={e => onUpdate({ ...tarjeta, saldoInicial: parseFloat(e.target.value) || 0 })}
            placeholder="0"
          />
          {diffInicial !== null && (
            <span className={`tarj-saldo-diff ${diffInicial >= 0 ? 'green' : 'red'}`}>
              {diffInicial >= 0 ? '+' : ''}{tarjeta.moneda === 'USD' ? fmtUSD(diffInicial) : `$${fmt(diffInicial)}`} vs inicio
            </span>
          )}
        </div>
      </div>

      {/* Formulario agregar saldo */}
      {showForm && (
        <div className="tarj-saldo-form">
          <input
            type="number" className="cell-input" placeholder="Saldo actual $" min="0"
            value={newMonto} onChange={e => setNewMonto(e.target.value)}
            autoFocus
            onKeyDown={e => e.key === 'Enter' && registrar()}
          />
          <input
            type="text" className="cell-input tarj-nota-input" placeholder="Nota (opcional)"
            value={newNota} onChange={e => setNewNota(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && registrar()}
          />
          <button className="btn-confirm" onClick={registrar} disabled={newMonto === ''}>✓</button>
          <button className="btn-cancel" onClick={() => { setShowForm(false); setNewMonto(''); setNewNota(''); }}>✕</button>
        </div>
      )}

      {/* Historial de saldos */}
      {open && (
        <div className="tarj-historial">
          <div className="tarj-hist-title">Historial de saldos</div>
          {saldos.length === 0 ? (
            <p className="tarj-hist-empty">Sin registros aún. Usá "Registrar saldo" para agregar.</p>
          ) : (
            <div className="tarj-hist-list">
              {[...saldos].reverse().map((s, ri) => {
                const idx = saldos.length - 1 - ri;
                const prev = idx > 0 ? saldos[idx - 1].monto : (tarjeta.saldoInicial || 0);
                const d = s.monto - prev;
                return (
                  <div key={s.ts || ri} className="tarj-hist-row">
                    <span className="tarj-hist-fecha">{s.fecha}</span>
                    <span className="tarj-hist-monto">
                      {tarjeta.moneda === 'USD' ? fmtUSD(s.monto) : `$${fmt(s.monto)}`}
                    </span>
                    <span className={`tarj-hist-diff ${d > 0 ? 'green' : d < 0 ? 'red' : ''}`}>
                      {d > 0 ? '+' : ''}{tarjeta.moneda === 'USD' ? fmtUSD(d) : `$${fmt(d)}`}
                    </span>
                    {s.nota && <span className="tarj-hist-nota">{s.nota}</span>}
                    <button className="tarj-hist-del" onClick={() => eliminarSaldo(idx)} title="Eliminar">
                      <Trash2 size={11}/>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Componente principal ────────────────────────────────────────
export default function Tarjetas({ data = [], onChange }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newNombre, setNewNombre] = useState('');
  const [newMoneda, setNewMoneda] = useState('UYU');
  const [newTipo, setNewTipo] = useState('credito');

  const credito = data.filter(t => t.tipo !== 'debito');
  const debito  = data.filter(t => t.tipo === 'debito');

  const agregar = () => {
    if (!newNombre.trim()) return;
    const base = { nombre: newNombre.trim(), moneda: newMoneda, tipo: newTipo };
    const nueva = newTipo === 'debito'
      ? { ...base, saldoInicial: 0, saldos: [] }
      : { ...base, monto: 0, pagado: false };
    onChange([...data, nueva]);
    setNewNombre(''); setNewMoneda('UYU'); setNewTipo('credito'); setShowAdd(false);
  };

  const actualizarCredito = (idx, campo, val) => {
    const realIdx = data.indexOf(credito[idx]);
    onChange(data.map((t, i) => i === realIdx ? { ...t, [campo]: val } : t));
  };

  const actualizarDebito = (tarjeta) => {
    onChange(data.map(t => t === tarjeta || (t.nombre === tarjeta.nombre && t.tipo === 'debito') ? tarjeta : t));
  };

  const eliminar = (tarjeta) => onChange(data.filter(t => t !== tarjeta));

  const eliminarCredito = (idx) => { const t = credito[idx]; onChange(data.filter(d => d !== t)); };

  const totalUYUPend = credito.filter(t => t.moneda === 'UYU' && !t.pagado).reduce((s, t) => s + (t.monto || 0), 0);
  const totalUSDPend = credito.filter(t => t.moneda === 'USD' && !t.pagado).reduce((s, t) => s + (t.monto || 0), 0);
  const totalUYUPag  = credito.filter(t => t.moneda === 'UYU' && t.pagado).reduce((s, t) => s + (t.monto || 0), 0);
  const totalUSDPag  = credito.filter(t => t.moneda === 'USD' && t.pagado).reduce((s, t) => s + (t.monto || 0), 0);

  return (
    <div className="section-block">
      <div className="section-header-row">
        <h2 className="section-title">💳 Tarjetas</h2>
        <button className="add-row-btn" onClick={() => setShowAdd(s => !s)}>
          <Plus size={14}/> Agregar tarjeta
        </button>
      </div>

      {/* Formulario nueva tarjeta */}
      {showAdd && (
        <div className="tarj-add-form">
          <input
            className="cell-input" type="text" placeholder="Ej: Visa OCA"
            value={newNombre} autoFocus
            onChange={e => setNewNombre(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && agregar()}
          />
          <select className="cell-select" value={newTipo} onChange={e => setNewTipo(e.target.value)}>
            <option value="credito">Crédito</option>
            <option value="debito">Débito</option>
          </select>
          <select className="cell-select" value={newMoneda} onChange={e => setNewMoneda(e.target.value)}>
            <option value="UYU">UYU $</option>
            <option value="USD">USD $</option>
          </select>
          <button className="btn-confirm" onClick={agregar} disabled={!newNombre.trim()}>✓</button>
          <button className="btn-cancel" onClick={() => { setShowAdd(false); setNewNombre(''); }}>✕</button>
        </div>
      )}

      {/* ── TARJETAS DEBITO ── */}
      {debito.length > 0 && (
        <div className="tarj-seccion">
          <div className="tarj-seccion-title">🏧 Débito — saldo disponible</div>
          {debito.map((t, i) => (
            <TarjetaDebito
              key={i}
              tarjeta={t}
              onUpdate={actualizarDebito}
              onDelete={() => eliminar(t)}
            />
          ))}
        </div>
      )}

      {/* ── TARJETAS CREDITO ── */}
      {credito.length > 0 && (
        <div className="tarj-seccion">
          <div className="tarj-seccion-title">💳 Crédito — deuda pendiente</div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Tarjeta</th>
                <th>Moneda</th>
                <th>Monto pendiente</th>
                <th>Estado</th>
                <th style={{ width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {credito.length === 0 && (
                <tr><td colSpan={5} className="empty-row">Sin tarjetas de crédito.</td></tr>
              )}
              {credito.map((t, i) => (
                <tr key={i} className={t.pagado ? 'tarj-row-pagada' : ''}>
                  <td>
                    <input className="cell-input" type="text" value={t.nombre}
                      onChange={e => actualizarCredito(i, 'nombre', e.target.value)} />
                  </td>
                  <td>
                    <select className="cell-select" value={t.moneda}
                      onChange={e => actualizarCredito(i, 'moneda', e.target.value)}>
                      <option value="UYU">UYU $</option>
                      <option value="USD">USD $</option>
                    </select>
                  </td>
                  <td>
                    <input className="cell-input real-input" type="number" value={t.monto || ''}
                      min="0" step={t.moneda === 'USD' ? '0.01' : '1'} placeholder="0"
                      onChange={e => actualizarCredito(i, 'monto', parseFloat(e.target.value) || 0)} />
                  </td>
                  <td className="tarj-pagado-cell">
                    <button
                      className={`tarj-pagado-btn ${t.pagado ? 'pagado' : 'pendiente'}`}
                      onClick={() => actualizarCredito(i, 'pagado', !t.pagado)}>
                      {t.pagado ? '✓ Pagado' : 'Pendiente'}
                    </button>
                  </td>
                  <td>
                    <button className="del-btn" onClick={() => eliminarCredito(i)}><Trash2 size={13}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="totals-row">
                <td colSpan={2}><strong>TOTAL PENDIENTE</strong></td>
                <td className="neg"><strong>
                  {totalUYUPend === 0 && totalUSDPend === 0 && '—'}
                  {totalUYUPend > 0 && `$${fmt(totalUYUPend)}`}
                  {totalUYUPend > 0 && totalUSDPend > 0 && ' + '}
                  {totalUSDPend > 0 && fmtUSD(totalUSDPend)}
                </strong></td>
                <td></td><td></td>
              </tr>
              {(totalUYUPag > 0 || totalUSDPag > 0) && (
                <tr className="totals-row tarj-pagado-total">
                  <td colSpan={2}><strong>TOTAL PAGADO</strong></td>
                  <td className="pos"><strong>
                    {totalUYUPag > 0 && `$${fmt(totalUYUPag)}`}
                    {totalUYUPag > 0 && totalUSDPag > 0 && ' + '}
                    {totalUSDPag > 0 && fmtUSD(totalUSDPag)}
                  </strong></td>
                  <td></td><td></td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      )}

      {data.length === 0 && !showAdd && (
        <p className="empty-row" style={{padding:'16px'}}>Sin tarjetas. Usá el botón para agregar.</p>
      )}

      {(totalUYUPend > 0 || totalUSDPend > 0) && (
        <div className="tarj-note">
          💡 Las tarjetas de crédito marcadas como <strong>✓ Pagado</strong> se descuentan del ahorro real del mes.
          {totalUSDPend > 0 && <> La deuda en USD se muestra informativa.</>}
        </div>
      )}
    </div>
  );
}
