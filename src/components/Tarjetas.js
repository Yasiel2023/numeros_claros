// src/components/Tarjetas.js
// Credito: monto pendiente + pagado (modelo existente)
// Debito:  saldoInicial + historial de saldos [{ts, fecha, monto, nota}]
import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, CalendarClock, CreditCard } from 'lucide-react';
import { MESES_ES } from '../constants';
import { numeroCuota, estaActiva } from '../financiaciones';
import { pagadoTarjeta, saldoTarjeta, gastosDeTarjeta, montoCargado } from '../tarjetas';

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
                  <div key={s.id || s.ts || ri} className="tarj-hist-row">
                    <span className="tarj-hist-fecha">{s.fecha}</span>
                    <span className="tarj-hist-monto">
                      {tarjeta.moneda === 'USD' ? fmtUSD(s.monto) : `$${fmt(s.monto)}`}
                    </span>
                    <span className={`tarj-hist-diff ${d > 0 ? 'green' : d < 0 ? 'red' : ''}`}>
                      {d > 0 ? '+' : ''}{tarjeta.moneda === 'USD' ? fmtUSD(d) : `$${fmt(d)}`}
                    </span>
                    {s.auto && <span className="tarj-hist-auto">auto</span>}
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

// Alta de un cargo suelto contra una tarjeta de credito
function AgregarCargoForm({ onAdd }) {
  const [show, setShow]         = useState(false);
  const [concepto, setConcepto] = useState('');
  const [monto, setMonto]       = useState('');

  const confirmar = () => {
    const m = parseFloat(monto);
    if (!concepto.trim() || isNaN(m) || m <= 0) return;
    onAdd(concepto.trim(), m);
    setConcepto(''); setMonto(''); setShow(false);
  };

  if (!show) return (
    <button className="btn-add-row" onClick={() => setShow(true)}>
      <Plus size={13}/> Agregar cargo
    </button>
  );

  return (
    <div className="add-row-form">
      <input
        className="add-input" value={concepto} autoFocus
        placeholder="Ej: Nafta, Farmacia..."
        onChange={e => setConcepto(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && confirmar()}
      />
      <input
        type="number" className="add-input short" value={monto} placeholder="Monto $"
        onChange={e => setMonto(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && confirmar()}
      />
      <button className="btn-confirm" onClick={confirmar}>✓</button>
      <button className="btn-cancel" onClick={() => { setShow(false); setConcepto(''); setMonto(''); }}>✕</button>
    </div>
  );
}

// ── Tarjeta de Credito ────────────────────────────────────────
function TarjetaCredito({ tarjeta, gastos, debitos = [], onUpdate, onPagar, onDeshacerPago, onDelete }) {
  const [open, setOpen]         = useState(false);
  const [pagando, setPagando]   = useState(false);
  const [montoPago, setMontoPago] = useState('');
  const [origen, setOrigen]     = useState('');

  const esUSD = tarjeta.moneda === 'USD';
  const money = (n) => esUSD ? fmtUSD(n) : `$${fmt(n)}`;

  const cuotas      = tarjeta.cuotas || [];
  const cargos      = tarjeta.cargos || [];
  const itemsGasto  = gastosDeTarjeta(gastos, tarjeta.id);
  const totalCuotas = cuotas.reduce((s, c) => s + (c.monto || 0), 0);
  const totalGastos = itemsGasto.reduce((s, i) => s + montoCargado(i), 0);
  const totalCargos = cargos.reduce((s, c) => s + (c.monto || 0), 0);
  const total       = tarjeta.monto || 0;
  // Lo que quedo de un monto cargado a mano antes de que existieran los cargos detallados
  const sinDetallar = total - totalCuotas - totalGastos - totalCargos;

  const agregarCargo = (concepto, monto) => {
    const cargo = { id: `cg_${Date.now().toString(36)}`, concepto, monto, fecha: fmtFecha() };
    onUpdate({
      ...tarjeta,
      cargos: [...cargos, cargo],
      monto: total + monto,
    });
  };

  const eliminarCargo = (id) => {
    const cargo = cargos.find(c => c.id === id);
    if (!cargo) return;
    onUpdate({
      ...tarjeta,
      cargos: cargos.filter(c => c.id !== id),
      monto: Math.max(0, total - (cargo.monto || 0)),
    });
  };
  const pagado      = pagadoTarjeta(tarjeta);
  const saldo       = saldoTarjeta(tarjeta);
  const saldado     = total > 0 && saldo === 0;

  // Solo se puede pagar desde una cuenta en la misma moneda
  const origenes = debitos.filter(d => d.moneda === tarjeta.moneda);
  const saldoDebito = (d) => {
    const saldos = Array.isArray(d.saldos) ? d.saldos : [];
    return saldos.length > 0 ? saldos[saldos.length - 1].monto : (d.saldoInicial || 0);
  };

  const cerrarPago = () => { setPagando(false); setMontoPago(''); setOrigen(''); };

  const registrarPago = (monto) => {
    const m = monto !== undefined ? monto : parseFloat(montoPago);
    if (isNaN(m) || m <= 0) return;
    onPagar(m, origen || null);
    cerrarPago();
  };

  return (
    <div className={`tarj-credito-card${saldado ? ' saldada' : ''}`}>
      <div className="tarj-credito-header">
        <div className="tarj-credito-info">
          <input
            className="tarj-credito-nombre"
            value={tarjeta.nombre}
            onChange={e => onUpdate({ ...tarjeta, nombre: e.target.value })}
          />
          <span className="tarj-debito-badge">{tarjeta.moneda}</span>
          <span className="tarj-tipo-badge credito">Crédito</span>
        </div>
        <div className="tarj-credito-saldo">
          <span className="tarj-credito-saldo-lbl">{saldado ? 'Saldada' : 'Saldo a pagar'}</span>
          <span className={`tarj-saldo-val ${saldado ? 'ok' : 'deuda'}`}>{money(saldo)}</span>
          {pagado > 0 && !saldado && (
            <span className="tarj-credito-pagado-parcial">Pagado {money(pagado)} de {money(total)}</span>
          )}
        </div>
        <div className="tarj-debito-actions">
          {pagado > 0 && (
            <button className="btn-unpagar" onClick={onDeshacerPago}>Deshacer pago</button>
          )}
          {!saldado && (
            <button className="btn-pagar" onClick={() => { setPagando(p => !p); setMontoPago(String(saldo || '')); }}>
              Pagar
            </button>
          )}
          <button className="tarj-hist-toggle" onClick={() => setOpen(o => !o)} title="Ver detalle">
            {open ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
          </button>
          <button className="icon-btn-sm danger" onClick={onDelete}><Trash2 size={13}/></button>
        </div>
      </div>

      {pagando && (
        <div className="tarj-pago-form">
          <div className="tarj-pago-campos">
            <div className="fin-field">
              <label>Monto a pagar</label>
              <input
                type="number" className="cell-input" min="0" placeholder="0"
                value={montoPago} onChange={e => setMontoPago(e.target.value)}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && registrarPago()}
              />
            </div>
            <div className="fin-field">
              <label>¿Con qué la pagás?</label>
              <select className="cell-select" value={origen} onChange={e => setOrigen(e.target.value)}>
                <option value="">💵 Efectivo / Transferencia</option>
                {origenes.map(d => (
                  <option key={d.id} value={d.id}>
                    🏧 {d.nombre} — saldo {money(saldoDebito(d))}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="tarj-pago-btns">
            <button className="btn-confirm-caja" onClick={() => registrarPago()} disabled={!parseFloat(montoPago)}>
              Registrar pago
            </button>
            <button className="btn-sm-outline" onClick={() => registrarPago(saldo)}>
              Pagar todo ({money(saldo)})
            </button>
            <button className="btn-cancel-caja" onClick={cerrarPago}>Cancelar</button>
          </div>
        </div>
      )}

      {open && (
        <div className="tarj-desglose">
          <div className="tarj-desglose-title">Composición de la deuda</div>

          {cuotas.length > 0 && (
            <div className="tarj-desglose-grupo">
              <span className="tarj-desglose-lbl">Cuotas</span>
              {cuotas.map((c, i) => (
                <div key={`${c.finId}_${i}`} className="tarj-desglose-row">
                  <span>{c.concepto}</span>
                  <span className="tarj-desglose-cuota">cuota {c.numero}/{c.total}</span>
                  <span className="tarj-desglose-monto">{money(c.monto)}</span>
                </div>
              ))}
            </div>
          )}

          {itemsGasto.length > 0 && (
            <div className="tarj-desglose-grupo">
              <span className="tarj-desglose-lbl">Gastos pagados con esta tarjeta</span>
              {itemsGasto.map((i, idx) => (
                <div key={idx} className="tarj-desglose-row">
                  <span>{i.nombre}</span>
                  <span className="tarj-desglose-monto">{money(montoCargado(i))}</span>
                </div>
              ))}
            </div>
          )}

          <div className="tarj-desglose-grupo">
            <span className="tarj-desglose-lbl">Otros cargos</span>
            {cargos.map(c => (
              <div key={c.id} className="tarj-desglose-row">
                <span>{c.concepto}</span>
                <span className="tarj-desglose-origen">{c.fecha}</span>
                <span className="tarj-desglose-monto">{money(c.monto)}</span>
                <button className="icon-btn-sm danger" onClick={() => eliminarCargo(c.id)}>
                  <Trash2 size={12}/>
                </button>
              </div>
            ))}
            {sinDetallar !== 0 && (
              <div className="tarj-desglose-row">
                <span>Sin detallar</span>
                <input
                  type="number" className="cell-input tarj-sin-detallar" placeholder="0"
                  value={sinDetallar || ''}
                  step={esUSD ? '0.01' : '1'}
                  onChange={e => onUpdate({
                    ...tarjeta,
                    monto: totalCuotas + totalGastos + totalCargos + (parseFloat(e.target.value) || 0),
                  })}
                />
              </div>
            )}
            <AgregarCargoForm onAdd={agregarCargo} />
          </div>

          {(tarjeta.pagos || []).length > 0 && (
            <div className="tarj-desglose-grupo">
              <span className="tarj-desglose-lbl">Pagos realizados</span>
              {tarjeta.pagos.map(p => {
                const origenNombre = p.debitoId
                  ? (debitos.find(d => d.id === p.debitoId)?.nombre || 'cuenta eliminada')
                  : null;
                return (
                  <div key={p.id} className="tarj-desglose-row">
                    <span>{p.fecha}</span>
                    <span className="tarj-desglose-origen">
                      {origenNombre ? `🏧 ${origenNombre}` : '💵 Efectivo / Transferencia'}
                    </span>
                    <span className="tarj-desglose-monto pos">−{money(p.monto)}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="tarj-desglose-total">
            <div className="tarj-desglose-row"><span>Total del mes</span><span className="tarj-desglose-monto">{money(total)}</span></div>
            {pagado > 0 && (
              <div className="tarj-desglose-row"><span>Pagado</span><span className="tarj-desglose-monto pos">−{money(pagado)}</span></div>
            )}
            <div className="tarj-desglose-row strong"><span>Saldo a pagar</span><span className="tarj-desglose-monto">{money(saldo)}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Compras en cuotas (financiaciones del presupuesto) ────────
function FinanciacionesSection({ financiaciones, onChange, anio, mes, tarjetas }) {
  const [showForm, setShowForm]   = useState(false);
  const [concepto, setConcepto]   = useState('');
  const [tarjetaNombre, setTarjetaNombre] = useState('');
  const [moneda, setMoneda]       = useState('UYU');
  const [modo, setModo]           = useState('cuota');
  const [monto, setMonto]         = useState('');
  const [nCuotas, setNCuotas]     = useState('');
  const [inicioMes, setInicioMes] = useState(mes);
  const [inicioAnio, setInicioAnio] = useState(anio);

  const nombresCredito = [...new Set(
    (tarjetas || []).filter(t => t.tipo !== 'debito').map(t => t.nombre).filter(Boolean)
  )];

  const limpiar = () => {
    setConcepto(''); setTarjetaNombre(''); setMoneda('UYU'); setModo('cuota');
    setMonto(''); setNCuotas(''); setInicioMes(mes); setInicioAnio(anio);
    setShowForm(false);
  };

  const agregar = () => {
    const cuotasTotales = parseInt(nCuotas, 10);
    const valor = parseFloat(monto);
    if (!concepto.trim() || !tarjetaNombre.trim() || !cuotasTotales || !valor) return;
    const montoCuota = modo === 'total' ? valor / cuotasTotales : valor;
    onChange([...(financiaciones || []), {
      id: `fin_${Date.now().toString(36)}`,
      concepto: concepto.trim(),
      tarjetaNombre: tarjetaNombre.trim(),
      moneda,
      montoCuota,
      cuotasTotales,
      anioInicio: Number(inicioAnio),
      mesInicio: Number(inicioMes),
      creadoEn: new Date().toISOString(),
    }]);
    limpiar();
  };

  const eliminar = (id) => onChange((financiaciones || []).filter(f => f.id !== id));

  return (
    <div className="tarj-seccion">
      <div className="tarj-seccion-title-row">
        <span className="tarj-seccion-title">🧾 Compras en cuotas</span>
        <button className="add-row-btn" onClick={() => setShowForm(s => !s)}>
          <Plus size={14}/> Agregar compra
        </button>
      </div>

      {showForm && (
        <div className="fin-form">
          <div className="fin-form-grid">
            <div className="fin-field">
              <label>Concepto</label>
              <input className="cell-input" value={concepto} autoFocus
                placeholder="Ej: Heladera" onChange={e => setConcepto(e.target.value)} />
            </div>
            <div className="fin-field">
              <label>Tarjeta de crédito</label>
              <input className="cell-input" value={tarjetaNombre} list="fin-tarjetas"
                placeholder="Ej: Visa OCA" onChange={e => setTarjetaNombre(e.target.value)} />
              <datalist id="fin-tarjetas">
                {nombresCredito.map(n => <option key={n} value={n} />)}
              </datalist>
            </div>
            <div className="fin-field">
              <label>Moneda</label>
              <select className="cell-select" value={moneda} onChange={e => setMoneda(e.target.value)}>
                <option value="UYU">UYU $</option>
                <option value="USD">USD $</option>
              </select>
            </div>
            <div className="fin-field">
              <label>Cantidad de cuotas</label>
              <input type="number" min="1" className="cell-input" value={nCuotas}
                placeholder="6" onChange={e => setNCuotas(e.target.value)} />
            </div>
            <div className="fin-field">
              <label>
                <select className="fin-modo-select" value={modo} onChange={e => setModo(e.target.value)}>
                  <option value="cuota">Monto por cuota</option>
                  <option value="total">Monto total</option>
                </select>
              </label>
              <input type="number" min="0" className="cell-input" value={monto}
                placeholder="0" onChange={e => setMonto(e.target.value)} />
            </div>
            <div className="fin-field">
              <label>Primera cuota</label>
              <div className="fin-inicio-row">
                <select className="cell-select" value={inicioMes} onChange={e => setInicioMes(e.target.value)}>
                  {MESES_ES.map((m, i) => <option key={m} value={i}>{m}</option>)}
                </select>
                <input type="number" className="cell-input fin-anio" value={inicioAnio}
                  onChange={e => setInicioAnio(e.target.value)} />
              </div>
            </div>
          </div>
          {modo === 'total' && parseFloat(monto) > 0 && parseInt(nCuotas, 10) > 0 && (
            <div className="caja-preview">
              {parseInt(nCuotas, 10)} cuotas de <strong>${fmt(parseFloat(monto) / parseInt(nCuotas, 10))}</strong>
            </div>
          )}
          <div className="fin-form-btns">
            <button className="btn-confirm-caja" onClick={agregar}
              disabled={!concepto.trim() || !tarjetaNombre.trim() || !parseInt(nCuotas, 10) || !parseFloat(monto)}>
              Agregar compra
            </button>
            <button className="btn-cancel-caja" onClick={limpiar}>Cancelar</button>
          </div>
        </div>
      )}

      {(financiaciones || []).length === 0 ? (
        <p className="empty-row" style={{ padding: '12px 0' }}>
          Sin compras en cuotas. Agregá una y sus cuotas se van a cargar solas cada mes.
        </p>
      ) : (
        <div className="fin-list">
          {financiaciones.map(f => {
            const n = numeroCuota(f, anio, mes);
            const activa = estaActiva(f, anio, mes);
            const restantes = Math.max(0, (f.cuotasTotales || 0) - Math.max(0, n));
            const money = (v) => f.moneda === 'USD' ? fmtUSD(v) : `$${fmt(v)}`;
            return (
              <div key={f.id} className={`fin-row${activa ? '' : ' inactiva'}`}>
                <div className="fin-row-info">
                  <span className="fin-row-concepto">{f.concepto}</span>
                  <span className="fin-row-tarjeta">💳 {f.tarjetaNombre}</span>
                </div>
                <span className="fin-row-estado">
                  {n < 1
                    ? `Empieza en ${MESES_ES[f.mesInicio]} ${f.anioInicio}`
                    : activa
                    ? `Cuota ${n} de ${f.cuotasTotales} · faltan ${restantes}`
                    : 'Finalizada'}
                </span>
                <span className="fin-row-monto">{money(f.montoCuota)}<small>/mes</small></span>
                <button className="icon-btn-sm danger" onClick={() => eliminar(f.id)} title="Eliminar compra">
                  <Trash2 size={13}/>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Componente principal ────────────────────────────────────────
export default function Tarjetas({
  data = [], gastos = {}, onChange,
  financiaciones = [], onChangeFinanciaciones,
  cuotasPendientes = [], onAplicarCuotas,
  tarjetasPreviasLabel, onImportarTarjetasPrevias,
  anio, mes,
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [newNombre, setNewNombre] = useState('');
  const [newMoneda, setNewMoneda] = useState('UYU');
  const [newTipo, setNewTipo] = useState('credito');

  const credito = data.filter(t => t.tipo !== 'debito');
  const debito  = data.filter(t => t.tipo === 'debito');

  const agregar = () => {
    if (!newNombre.trim()) return;
    const base = { id: `tj_${Date.now().toString(36)}`, nombre: newNombre.trim(), moneda: newMoneda, tipo: newTipo };
    const nueva = newTipo === 'debito'
      ? { ...base, saldoInicial: 0, saldos: [] }
      : { ...base, monto: 0, pagado: false };
    onChange([...data, nueva]);
    setNewNombre(''); setNewMoneda('UYU'); setNewTipo('credito'); setShowAdd(false);
  };

  const actualizarCredito = (tarjeta) => {
    onChange(data.map(t => (tarjeta.id ? t.id === tarjeta.id : t === tarjeta) ? tarjeta : t));
  };

  const actualizarDebito = (tarjeta) => {
    onChange(data.map(t => (tarjeta.id ? t.id === tarjeta.id : t === tarjeta) ? tarjeta : t));
  };

  const eliminar = (tarjeta) => onChange(data.filter(t => t !== tarjeta));

  // Pagar una tarjeta de credito. Si se paga desde una cuenta de debito,
  // se le descuenta el saldo en el mismo movimiento.
  const pagarCredito = (tarjeta, monto, debitoId) => {
    const total     = tarjeta.monto || 0;
    const yaPagado  = pagadoTarjeta(tarjeta);
    const m = Math.min(monto, Math.max(0, total - yaPagado));
    if (m <= 0) return;

    const nuevas = [...data];
    const pago = { id: `pg_${Date.now().toString(36)}`, monto: m, fecha: fmtFecha() };

    if (debitoId) {
      const idx = nuevas.findIndex(t => t.id === debitoId);
      if (idx !== -1) {
        const d = nuevas[idx];
        const saldos = Array.isArray(d.saldos) ? d.saldos : [];
        const saldoActual = saldos.length > 0 ? saldos[saldos.length - 1].monto : (d.saldoInicial || 0);
        const movId = `mov_${Date.now().toString(36)}`;
        nuevas[idx] = { ...d, saldos: [...saldos, {
          id: movId, ts: Date.now(), fecha: fmtFecha(),
          monto: saldoActual - m, nota: `Pago ${tarjeta.nombre}`, auto: true,
        }]};
        pago.debitoId = debitoId;
        pago.movId    = movId;
      }
    }

    const nuevoPagado = yaPagado + m;
    const idxC = nuevas.findIndex(t => t.id === tarjeta.id);
    nuevas[idxC] = {
      ...tarjeta,
      pagos: [...(tarjeta.pagos || []), pago],
      montoPagado: nuevoPagado,
      pagado: nuevoPagado >= total && total > 0,
    };
    onChange(nuevas);
  };

  // Deshacer todos los pagos de una tarjeta y reponer los saldos de debito
  const deshacerPagosCredito = (tarjeta) => {
    const nuevas = [...data];
    (tarjeta.pagos || []).forEach(p => {
      if (!p.debitoId || !p.movId) return;
      const idx = nuevas.findIndex(t => t.id === p.debitoId);
      if (idx === -1) return;
      const d = nuevas[idx];
      nuevas[idx] = { ...d, saldos: (d.saldos || []).filter(s => s.id !== p.movId) };
    });
    const { montoPagado: _mp, pagos: _pg, ...resto } = tarjeta;
    const idxC = nuevas.findIndex(t => t.id === tarjeta.id);
    nuevas[idxC] = { ...resto, pagado: false };
    onChange(nuevas);
  };

  const totalUYUPend = credito.filter(t => t.moneda === 'UYU').reduce((s, t) => s + saldoTarjeta(t), 0);
  const totalUSDPend = credito.filter(t => t.moneda === 'USD').reduce((s, t) => s + saldoTarjeta(t), 0);
  const totalUYUPag  = credito.filter(t => t.moneda === 'UYU').reduce((s, t) => s + pagadoTarjeta(t), 0);
  const totalUSDPag  = credito.filter(t => t.moneda === 'USD').reduce((s, t) => s + pagadoTarjeta(t), 0);

  return (
    <div className="section-block">
      <div className="section-header-row">
        <h2 className="section-title">💳 Tarjetas</h2>
        <button className="add-row-btn" onClick={() => setShowAdd(s => !s)}>
          <Plus size={14}/> Agregar tarjeta
        </button>
      </div>

      {/* Mes sin tarjetas: traerlas del último mes que las tenga */}
      {data.length === 0 && tarjetasPreviasLabel && (
        <div className="cuotas-banner">
          <CreditCard size={16} className="cuotas-banner-icon" />
          <div className="cuotas-banner-txt">
            <strong>Este mes no tiene tarjetas</strong>
            <span>Podés traer las de {tarjetasPreviasLabel}: el débito conserva su saldo y el crédito arranca en cero.</span>
          </div>
          <button className="cuotas-banner-btn" onClick={onImportarTarjetasPrevias}>
            Traer tarjetas
          </button>
        </div>
      )}

      {/* Cuotas de este mes que todavia no se cargaron */}
      {cuotasPendientes.length > 0 && (
        <div className="cuotas-banner">
          <CalendarClock size={16} className="cuotas-banner-icon" />
          <div className="cuotas-banner-txt">
            <strong>
              {cuotasPendientes.length === 1
                ? 'Hay 1 cuota de este mes sin cargar'
                : `Hay ${cuotasPendientes.length} cuotas de este mes sin cargar`}
            </strong>
            <span>
              {cuotasPendientes.map(c => `${c.fin.concepto} (${c.numero}/${c.fin.cuotasTotales})`).join(' · ')}
            </span>
          </div>
          <button className="cuotas-banner-btn" onClick={onAplicarCuotas}>
            Cargar a las tarjetas
          </button>
        </div>
      )}

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
          <div className="tarj-seccion-title">💳 Crédito — deuda del mes</div>
          {credito.map((t, i) => (
            <TarjetaCredito
              key={t.id || i}
              tarjeta={t}
              gastos={gastos}
              debitos={debito}
              onUpdate={actualizarCredito}
              onPagar={(monto, debitoId) => pagarCredito(t, monto, debitoId)}
              onDeshacerPago={() => deshacerPagosCredito(t)}
              onDelete={() => eliminar(t)}
            />
          ))}
          <div className="tarj-credito-totales">
            <div className="tct-item">
              <span>Total pendiente</span>
              <strong className="neg">
                {totalUYUPend === 0 && totalUSDPend === 0 && '—'}
                {totalUYUPend > 0 && `$${fmt(totalUYUPend)}`}
                {totalUYUPend > 0 && totalUSDPend > 0 && ' + '}
                {totalUSDPend > 0 && fmtUSD(totalUSDPend)}
              </strong>
            </div>
            {(totalUYUPag > 0 || totalUSDPag > 0) && (
              <div className="tct-item">
                <span>Total pagado</span>
                <strong className="pos">
                  {totalUYUPag > 0 && `$${fmt(totalUYUPag)}`}
                  {totalUYUPag > 0 && totalUSDPag > 0 && ' + '}
                  {totalUSDPag > 0 && fmtUSD(totalUSDPag)}
                </strong>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── COMPRAS EN CUOTAS ── */}
      <FinanciacionesSection
        financiaciones={financiaciones}
        onChange={onChangeFinanciaciones}
        anio={anio}
        mes={mes}
        tarjetas={data}
      />

      {data.length === 0 && !showAdd && (
        <p className="empty-row" style={{padding:'16px'}}>Sin tarjetas. Usá el botón para agregar.</p>
      )}

      {(totalUYUPend > 0 || totalUSDPend > 0) && (
        <div className="tarj-note">
          💡 La deuda de cada tarjeta se arma con las cuotas del mes, los gastos que pagaste con ella y los cargos que agregues a mano. Usá <strong>Pagar</strong> para saldarla total o parcialmente.
          {totalUSDPend > 0 && <> La deuda en USD se muestra informativa.</>}
        </div>
      )}
    </div>
  );
}
