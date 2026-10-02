// src/components/CajaAhorro.js
import React, { useState } from 'react';
import { money, moneyDe, monedaPrincipal, monedaSecundaria } from '../moneda';
import { Plus, Trash2, PiggyBank, DollarSign, RefreshCw, ArrowRightLeft } from 'lucide-react';

const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// tipos de movimiento:
//   'transferencia'  — UYU → USD con tasa
//   'deposito_uyu'   — deposito directo UYU en caja UYU
//   'ajuste'         — ajuste manual saldo USD (legado)
//   'ajuste_usd'     — ajuste manual saldo USD
//   'ajuste_uyu'     — ajuste manual saldo UYU

export default function CajaAhorro({ cajaData, onChange, ahorroRealMes = 0, mesLabel = '' }) {
  // Campos *UYU = moneda principal del presupuesto; *USD = moneda secundaria
  const P = monedaPrincipal();
  const S = monedaSecundaria();   // '' si el presupuesto no tiene segunda moneda
  const fmtUSD = (n) => moneyDe(n, S || P);
  const data = cajaData || { movimientos: [] };
  const movs = Array.isArray(data.movimientos) ? data.movimientos : [];

  // ── Saldos calculados ──────────────────────────────────────────
  const saldoUSDFinal = (() => {
    let s = 0;
    for (const m of movs) {
      if (m.tipo === 'transferencia') s += m.montoUSD || 0;
      if (m.tipo === 'ajuste' || m.tipo === 'ajuste_usd') s = m.saldoUSD || 0;
    }
    return s;
  })();

  const saldoUYUFinal = (() => {
    let s = 0;
    for (const m of movs) {
      if (m.tipo === 'deposito_uyu') s += m.montoUYU || 0;
      if (m.tipo === 'ajuste_uyu') s = m.saldoUYU || 0;
    }
    return s;
  })();

  const totalUYUTransferido = movs
    .filter(m => m.tipo === 'transferencia')
    .reduce((s, m) => s + (m.montoUYU || 0), 0);

  // ── Estado formularios ───────────────────────────────────────
  const [activeForm, setActiveForm] = useState(null); // 'transf' | 'depuyu' | 'ajuste_usd' | 'ajuste_uyu'

  // Form transferencia USD
  const [transfUYU, setTransfUYU]   = useState('');
  const [transfTasa, setTransfTasa] = useState('');
  const [transfDesc, setTransfDesc] = useState('');
  const [transfFecha, setTransfFecha] = useState(() => new Date().toISOString().slice(0, 10));

  // Form depósito UYU
  const [depUYU, setDepUYU]   = useState('');
  const [depDesc, setDepDesc] = useState('');
  const [depFecha, setDepFecha] = useState(() => new Date().toISOString().slice(0, 10));

  // Form ajuste USD
  const [ajusteUSD, setAjusteUSD]   = useState('');
  const [ajusteUSDDesc, setAjusteUSDDesc] = useState('');

  // Form ajuste UYU
  const [ajusteUYU, setAjusteUYU]   = useState('');
  const [ajusteUYUDesc, setAjusteUYUDesc] = useState('');

  const openForm = (form, prefill = null) => {
    setActiveForm(f => f === form ? null : form);
    if (prefill && form === 'transf') { setTransfUYU(String(prefill)); }
    if (prefill && form === 'depuyu') { setDepUYU(String(prefill)); }
  };

  // ── Acciones ──────────────────────────────────────────────────
  const agregarTransferencia = () => {
    const uyu = parseFloat(transfUYU) || 0;
    const tasa = parseFloat(transfTasa) || 0;
    if (!uyu || !tasa) return;
    onChange({ ...data, movimientos: [...movs, {
      id: Date.now().toString(36), tipo: 'transferencia',
      fecha: transfFecha,
      descripcion: transfDesc || `Ahorro ${mesLabel}`,
      montoUYU: uyu, tasa, montoUSD: uyu / tasa,
    }]});
    setTransfUYU(''); setTransfTasa(''); setTransfDesc('');
    setTransfFecha(new Date().toISOString().slice(0, 10));
    setActiveForm(null);
  };

  const agregarDepUYU = () => {
    const uyu = parseFloat(depUYU) || 0;
    if (!uyu) return;
    onChange({ ...data, movimientos: [...movs, {
      id: Date.now().toString(36), tipo: 'deposito_uyu',
      fecha: depFecha,
      descripcion: depDesc || `Ahorro ${P} ${mesLabel}`,
      montoUYU: uyu,
    }]});
    setDepUYU(''); setDepDesc('');
    setDepFecha(new Date().toISOString().slice(0, 10));
    setActiveForm(null);
  };

  const agregarAjusteUSD = () => {
    const usd = parseFloat(ajusteUSD);
    if (isNaN(usd)) return;
    onChange({ ...data, movimientos: [...movs, {
      id: Date.now().toString(36), tipo: 'ajuste_usd',
      fecha: new Date().toISOString().slice(0, 10),
      descripcion: ajusteUSDDesc || `Ajuste manual saldo ${S}`,
      saldoUSD: usd,
    }]});
    setAjusteUSD(''); setAjusteUSDDesc('');
    setActiveForm(null);
  };

  const agregarAjusteUYU = () => {
    const uyu = parseFloat(ajusteUYU);
    if (isNaN(uyu)) return;
    onChange({ ...data, movimientos: [...movs, {
      id: Date.now().toString(36), tipo: 'ajuste_uyu',
      fecha: new Date().toISOString().slice(0, 10),
      descripcion: ajusteUYUDesc || `Ajuste manual saldo ${P}`,
      saldoUYU: uyu,
    }]});
    setAjusteUYU(''); setAjusteUYUDesc('');
    setActiveForm(null);
  };

  const eliminar = (id) => onChange({ ...data, movimientos: movs.filter(m => m.id !== id) });

  const transfUYUNum  = parseFloat(transfUYU) || 0;
  const transfTasaNum = parseFloat(transfTasa) || 0;
  const previewUSD    = transfTasaNum > 0 ? transfUYUNum / transfTasaNum : 0;

  return (
    <div className="section-block">

      {/* ── CARDS SALDO ── */}
      <div className="caja-cards">
        {S && (
          <div className="caja-card caja-card-usd">
            <div className="caja-card-icon"><DollarSign size={22} /></div>
            <div className="caja-card-body">
              <span className="caja-card-label">Saldo cuenta {S}</span>
              <span className="caja-card-val">{fmtUSD(saldoUSDFinal)}</span>
            </div>
          </div>
        )}
        <div className="caja-card caja-card-uyu">
          <div className="caja-card-icon"><PiggyBank size={22} /></div>
          <div className="caja-card-body">
            <span className="caja-card-label">Saldo cuenta {P}</span>
            <span className="caja-card-val">{money(saldoUYUFinal)}</span>
          </div>
        </div>
        {ahorroRealMes > 0 && (
          <div className="caja-card caja-card-mes">
            <div className="caja-card-icon"><RefreshCw size={22} /></div>
            <div className="caja-card-body">
              <span className="caja-card-label">Objetivo de ahorro</span>
              <span className="caja-card-val pos">{money(ahorroRealMes)}</span>
              <div className="caja-obj-btns">
                <button className="btn-obj-uyu" onClick={() => openForm('depuyu', ahorroRealMes)}>
                  → Ahorrar en {P}
                </button>
                {S && (
                  <button className="btn-obj-usd" onClick={() => openForm('transf', ahorroRealMes)}>
                    → Convertir a {S}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── ACCIONES ── */}
      <div className="caja-actions-row">
        <button className="btn-caja-action" onClick={() => openForm('depuyu')}>
          <Plus size={13} /> Depositar en {P}
        </button>
        {S && (
          <button className="btn-caja-action btn-caja-transf" onClick={() => openForm('transf')}>
            <ArrowRightLeft size={13} /> Convertir {P} → {S}
          </button>
        )}
        <button className="btn-caja-action btn-caja-ajuste" onClick={() => openForm('ajuste_uyu')}>
          <RefreshCw size={13} /> Ajustar saldo {P}
        </button>
        {S && (
          <button className="btn-caja-action btn-caja-ajuste" onClick={() => openForm('ajuste_usd')}>
            <RefreshCw size={13} /> Ajustar saldo {S}
          </button>
        )}
      </div>

      {/* ── FORM DEPÓSITO UYU ── */}
      {activeForm === 'depuyu' && (
        <div className="caja-form">
          <h3 className="caja-form-title">🐷 Depositar ahorro en {P}</h3>
          <div className="caja-form-grid">
            <div className="caja-form-field">
              <label>Monto {P}</label>
              <input type="number" className="cell-input" min="0" placeholder="0"
                value={depUYU} onChange={e => setDepUYU(e.target.value)} />
            </div>
            <div className="caja-form-field">
              <label>Fecha</label>
              <input type="date" className="cell-input" value={depFecha}
                onChange={e => setDepFecha(e.target.value)} />
            </div>
            <div className="caja-form-field">
              <label>Descripción</label>
              <input type="text" className="cell-input" placeholder={`Ahorro ${mesLabel}`}
                value={depDesc} onChange={e => setDepDesc(e.target.value)} />
            </div>
          </div>
          <div className="caja-form-btns">
            <button className="btn-confirm-caja" onClick={agregarDepUYU} disabled={!parseFloat(depUYU)}>
              Confirmar depósito
            </button>
            <button className="btn-cancel-caja" onClick={() => setActiveForm(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* ── FORM TRANSFERENCIA USD ── */}
      {activeForm === 'transf' && (
        <div className="caja-form">
          <h3 className="caja-form-title">💸 Convertir {P} → {S}</h3>
          <div className="caja-form-grid">
            <div className="caja-form-field">
              <label>Monto {P}</label>
              <input type="number" className="cell-input" min="0"
                placeholder={ahorroRealMes > 0 ? String(Math.round(ahorroRealMes)) : '0'}
                value={transfUYU} onChange={e => setTransfUYU(e.target.value)} />
              {ahorroRealMes > 0 && !transfUYU && (
                <button className="btn-usar-ahorro" onClick={() => setTransfUYU(String(ahorroRealMes))}>
                  Usar objetivo ({money(ahorroRealMes)})
                </button>
              )}
            </div>
            <div className="caja-form-field">
              <label>Tasa {P} / {S}</label>
              <input type="number" className="cell-input" min="0" step="0.01" placeholder="Ej: 42.50"
                value={transfTasa} onChange={e => setTransfTasa(e.target.value)} />
            </div>
            <div className="caja-form-field">
              <label>Fecha</label>
              <input type="date" className="cell-input" value={transfFecha}
                onChange={e => setTransfFecha(e.target.value)} />
            </div>
            <div className="caja-form-field">
              <label>Descripción</label>
              <input type="text" className="cell-input" placeholder={`Ahorro ${mesLabel}`}
                value={transfDesc} onChange={e => setTransfDesc(e.target.value)} />
            </div>
          </div>
          {transfUYUNum > 0 && transfTasaNum > 0 && (
            <div className="caja-preview">
              {money(transfUYUNum)} ÷ {transfTasaNum} = <strong>{fmtUSD(previewUSD)}</strong>
            </div>
          )}
          <div className="caja-form-btns">
            <button className="btn-confirm-caja" onClick={agregarTransferencia}
              disabled={!transfUYUNum || !transfTasaNum}>
              Confirmar conversión
            </button>
            <button className="btn-cancel-caja" onClick={() => setActiveForm(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* ── FORM AJUSTE UYU ── */}
      {activeForm === 'ajuste_uyu' && (
        <div className="caja-form caja-form-ajuste">
          <h3 className="caja-form-title">✏️ Ajuste manual saldo {P}</h3>
          <p className="caja-form-hint">Saldo actual: <strong>{money(saldoUYUFinal)}</strong></p>
          <div className="caja-form-grid">
            <div className="caja-form-field">
              <label>Nuevo saldo {P}</label>
              <input type="number" className="cell-input" placeholder={String(saldoUYUFinal)}
                value={ajusteUYU} onChange={e => setAjusteUYU(e.target.value)} />
            </div>
            <div className="caja-form-field">
              <label>Motivo</label>
              <input type="text" className="cell-input" placeholder="Ej: Corrección, intereses..."
                value={ajusteUYUDesc} onChange={e => setAjusteUYUDesc(e.target.value)} />
            </div>
          </div>
          <div className="caja-form-btns">
            <button className="btn-confirm-caja" onClick={agregarAjusteUYU} disabled={ajusteUYU === ''}>
              Aplicar ajuste
            </button>
            <button className="btn-cancel-caja" onClick={() => setActiveForm(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* ── FORM AJUSTE USD ── */}
      {activeForm === 'ajuste_usd' && (
        <div className="caja-form caja-form-ajuste">
          <h3 className="caja-form-title">✏️ Ajuste manual saldo {S}</h3>
          <p className="caja-form-hint">Saldo actual: <strong>{fmtUSD(saldoUSDFinal)}</strong></p>
          <div className="caja-form-grid">
            <div className="caja-form-field">
              <label>Nuevo saldo {S}</label>
              <input type="number" className="cell-input" step="0.01" placeholder={saldoUSDFinal.toFixed(2)}
                value={ajusteUSD} onChange={e => setAjusteUSD(e.target.value)} />
            </div>
            <div className="caja-form-field">
              <label>Motivo</label>
              <input type="text" className="cell-input" placeholder="Ej: Corrección manual, intereses..."
                value={ajusteUSDDesc} onChange={e => setAjusteUSDDesc(e.target.value)} />
            </div>
          </div>
          <div className="caja-form-btns">
            <button className="btn-confirm-caja" onClick={agregarAjusteUSD} disabled={ajusteUSD === ''}>
              Aplicar ajuste
            </button>
            <button className="btn-cancel-caja" onClick={() => setActiveForm(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* ── HISTORIAL ── */}
      <h3 className="sub-title mt16">📋 Historial de movimientos</h3>
      {movs.length === 0 ? (
        <p className="empty-txt">Sin movimientos aún. Depositá tu primer ahorro.</p>
      ) : (
        <table className="data-table caja-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Descripción</th>
              <th>Tipo</th>
              <th>{P}</th>
              <th>Tasa</th>
              <th>{S || '—'}</th>
              <th style={{ width: 32 }}></th>
            </tr>
          </thead>
          <tbody>
            {movs.map((m) => (
              <tr key={m.id} className={m.tipo.startsWith('ajuste') ? 'caja-row-ajuste' : ''}>
                <td>{fmtDate(m.fecha)}</td>
                <td>{m.descripcion}</td>
                <td>
                  <span className={`pend-tipo ${m.tipo === 'transferencia' ? 'tipo-bas' : m.tipo === 'deposito_uyu' ? 'tipo-imp' : 'tipo-tarj'}`}>
                    {m.tipo === 'transferencia' ? `${P}→${S}`
                      : m.tipo === 'deposito_uyu' ? `depósito ${P}`
                      : m.tipo === 'ajuste_uyu' ? `ajuste ${P}`
                      : `ajuste ${S}`}
                  </span>
                </td>
                <td>{(m.tipo === 'transferencia' || m.tipo === 'deposito_uyu') ? `${money(m.montoUYU)}` : m.tipo === 'ajuste_uyu' ? `→ ${money(m.saldoUYU)}` : '—'}</td>
                <td>{m.tipo === 'transferencia' ? m.tasa : '—'}</td>
                <td className="pos">
                  {m.tipo === 'transferencia' ? fmtUSD(m.montoUSD)
                    : (m.tipo === 'ajuste' || m.tipo === 'ajuste_usd') ? `→ ${fmtUSD(m.saldoUSD)}`
                    : '—'}
                </td>
                <td>
                  <button className="icon-btn-sm danger" onClick={() => eliminar(m.id)}>
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
