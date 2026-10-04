// src/components/TarjetasMovil.js
// Tarjetas en el celular (diseño de app): crédito como tarjeta azul marino,
// débito como tarjeta blanca, compras en cuotas con barra de avance, y todas las
// acciones en paneles que suben desde abajo. La lógica (pagar, deshacer, cuotas)
// vive en Tarjetas.js y llega por props.
import React, { useState } from 'react';
import { Trash2, Undo2 } from 'lucide-react';
import Icono from '../iconos';
import { money, moneyTarjeta, monedaPrincipal, monedasDisponibles, esSecundaria, simbolo, MONEDAS } from '../moneda';
import { MESES_ES } from '../constants';
import { numeroCuota, estaActiva } from '../financiaciones';
import { pagadoTarjeta, saldoTarjeta, gastosDeTarjeta, montoCargado } from '../tarjetas';
import { Hoja } from './GrupoGastosMovil';

const saldoDebito = (d) => {
  const saldos = Array.isArray(d.saldos) ? d.saldos : [];
  return saldos.length > 0 ? saldos[saldos.length - 1].monto : (d.saldoInicial || 0);
};

const simboloDe = (moneda) => MONEDAS[moneda]?.simbolo || simbolo();

// ── Paneles ───────────────────────────────────────────────────

function HojaNuevaTarjeta({ onCrear, onClose }) {
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo]     = useState('credito');
  const [moneda, setMoneda] = useState(monedaPrincipal());
  const monedas = monedasDisponibles();

  return (
    <Hoja titulo="Agregar tarjeta" onClose={onClose}>
      <h3 className="hoja-titulo">Agregar tarjeta</h3>
      <label className="hoja-campo">
        <span>Nombre</span>
        <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Visa OCA" autoFocus />
      </label>
      <div className="hoja-campo">
        <span>Tipo</span>
        <div className="tm-segmento">
          <button className={tipo === 'credito' ? 'sel' : ''} onClick={() => setTipo('credito')}>Crédito</button>
          <button className={tipo === 'debito' ? 'sel' : ''} onClick={() => setTipo('debito')}>Débito</button>
        </div>
      </div>
      {monedas.length > 1 && (
        <div className="hoja-campo">
          <span>Moneda</span>
          <div className="tm-segmento">
            {monedas.map(c => (
              <button key={c} className={moneda === c ? 'sel' : ''} onClick={() => setMoneda(c)}>
                {c} {MONEDAS[c]?.simbolo}
              </button>
            ))}
          </div>
        </div>
      )}
      <button className="hoja-btn" disabled={!nombre.trim()} onClick={() => onCrear(nombre.trim(), tipo, moneda)}>
        Agregar tarjeta
      </button>
    </Hoja>
  );
}

function HojaPagarCredito({ tarjeta, debitos, onPagar, onClose }) {
  const saldo = saldoTarjeta(tarjeta);
  const [monto, setMonto]   = useState(String(saldo || ''));
  const [origen, setOrigen] = useState('');
  const origenes = debitos.filter(d => d.moneda === tarjeta.moneda);
  const m = parseFloat(monto) || 0;

  return (
    <Hoja titulo={`Pagar ${tarjeta.nombre}`} onClose={onClose}>
      <div className="hp-cabecera">
        <span>Pagar <strong>{tarjeta.nombre}</strong></span>
        <label className="sr-only" htmlFor="tm-monto">Monto a pagar</label>
        <div className="hp-monto">
          <span>{simboloDe(tarjeta.moneda)}</span>
          <input id="tm-monto" type="number" inputMode="decimal" min="0" value={monto} onChange={e => setMonto(e.target.value)} />
        </div>
        <small>
          Saldo a pagar {moneyTarjeta(saldo, tarjeta.moneda)}
          {m !== saldo && saldo > 0 && <> · <button className="tm-link" onClick={() => setMonto(String(saldo))}>pagar todo</button></>}
        </small>
      </div>

      <div className="hp-medios">
        <span className="hoja-seccion">¿Con qué la pagás?</span>
        <label className={`hp-medio ${origen === '' ? 'sel' : ''}`}>
          <input type="radio" name="origen" checked={origen === ''} onChange={() => setOrigen('')} />
          <span className="hp-medio-ico teal"><Icono nombre="efectivo" size={18} /></span>
          <span className="hp-medio-txt"><strong>Efectivo o transferencia</strong></span>
        </label>
        {origenes.map(d => (
          <label key={d.id} className={`hp-medio ${origen === d.id ? 'sel' : ''}`}>
            <input type="radio" name="origen" checked={origen === d.id} onChange={() => setOrigen(d.id)} />
            <span className="hp-medio-ico azul"><Icono nombre="debito" size={18} /></span>
            <span className="hp-medio-txt">
              <strong>{d.nombre}</strong>
              <small>Saldo {moneyTarjeta(saldoDebito(d), d.moneda)}</small>
            </span>
          </label>
        ))}
      </div>

      <button className="hoja-btn" disabled={m <= 0} onClick={() => onPagar(m, origen || null)}>Confirmar pago</button>
    </Hoja>
  );
}

function HojaDetalleCredito({ tarjeta, gastos, debitos, onUpdate, onDeshacerPago, onEliminar, onClose }) {
  const [concepto, setConcepto] = useState('');
  const [montoCargo, setMontoCargo] = useState('');
  const mt = (n) => moneyTarjeta(n, tarjeta.moneda);

  const cuotas     = tarjeta.cuotas || [];
  const cargos     = tarjeta.cargos || [];
  const itemsGasto = gastosDeTarjeta(gastos, tarjeta.id);
  const total      = tarjeta.monto || 0;
  const pagado     = pagadoTarjeta(tarjeta);
  const totalCuotas = cuotas.reduce((s, c) => s + (c.monto || 0), 0);
  const totalGastos = itemsGasto.reduce((s, i) => s + montoCargado(i), 0);
  const totalCargos = cargos.reduce((s, c) => s + (c.monto || 0), 0);
  const sinDetallar = total - totalCuotas - totalGastos - totalCargos;

  const agregarCargo = () => {
    const m = parseFloat(montoCargo);
    if (!concepto.trim() || isNaN(m) || m <= 0) return;
    const d = new Date();
    const fecha = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    onUpdate({ ...tarjeta, cargos: [...cargos, { id: `cg_${Date.now().toString(36)}`, concepto: concepto.trim(), monto: m, fecha }], monto: total + m });
    setConcepto(''); setMontoCargo('');
  };

  const eliminarCargo = (c) =>
    onUpdate({ ...tarjeta, cargos: cargos.filter(x => x.id !== c.id), monto: Math.max(0, total - (c.monto || 0)) });

  return (
    <Hoja titulo={tarjeta.nombre} onClose={onClose}>
      <label className="hoja-campo">
        <span>Nombre de la tarjeta</span>
        <input value={tarjeta.nombre} onChange={e => onUpdate({ ...tarjeta, nombre: e.target.value })} />
      </label>

      <div className="tm-detalle">
        <span className="hoja-seccion">Composición de la deuda</span>
        {cuotas.map((c, i) => (
          <div key={`${c.finId}_${i}`} className="tm-fila">
            <span>{c.concepto} <em className="tm-cuota">cuota {c.numero}/{c.total}</em></span>
            <strong>{mt(c.monto)}</strong>
          </div>
        ))}
        {itemsGasto.map((it, i) => (
          <div key={`g${i}`} className="tm-fila">
            <span>{it.nombre} <em>gasto</em></span>
            <strong>{mt(montoCargado(it))}</strong>
          </div>
        ))}
        {cargos.map(c => (
          <div key={c.id} className="tm-fila">
            <span>{c.concepto} <em>cargo · {c.fecha}</em></span>
            <strong>{mt(c.monto)}</strong>
            <button className="tm-borrar" onClick={() => eliminarCargo(c)} aria-label={`Eliminar ${c.concepto}`}><Trash2 size={15} /></button>
          </div>
        ))}
        {sinDetallar !== 0 && (
          <div className="tm-fila"><span>Sin detallar</span><strong>{mt(sinDetallar)}</strong></div>
        )}
        {(tarjeta.pagos || []).map(p => (
          <div key={p.id} className="tm-fila">
            <span>Pago <em>{p.fecha} · {p.debitoId ? (debitos.find(d => d.id === p.debitoId)?.nombre || 'cuenta eliminada') : 'efectivo'}</em></span>
            <strong className="verde">−{mt(p.monto)}</strong>
          </div>
        ))}
        <div className="tm-fila total"><span>Saldo a pagar</span><strong>{mt(saldoTarjeta(tarjeta))}</strong></div>
      </div>

      <div className="tm-cargo">
        <span className="hoja-seccion">Agregar un cargo</span>
        <div className="hoja-fila">
          <label className="hoja-campo"><span className="sr-only">Concepto</span>
            <input value={concepto} onChange={e => setConcepto(e.target.value)} placeholder="Ej: Nafta" /></label>
          <label className="hoja-campo tm-monto-corto"><span className="sr-only">Monto</span>
            <input type="number" inputMode="decimal" min="0" value={montoCargo} onChange={e => setMontoCargo(e.target.value)} placeholder="Monto" /></label>
          <button className="tm-mas" onClick={agregarCargo} aria-label="Agregar cargo" disabled={!concepto.trim() || !(parseFloat(montoCargo) > 0)}>
            <Icono nombre="mas" size={20} grosor={2.4} />
          </button>
        </div>
      </div>

      <div className="hoja-acciones">
        <button className="hoja-btn-peligro" aria-label="Eliminar tarjeta"
          onClick={() => window.confirm(`¿Eliminar la tarjeta "${tarjeta.nombre}"?`) && onEliminar()}>
          <Trash2 size={18} />
        </button>
        {pagado > 0 && (
          <button className="hoja-btn hoja-btn-sec" onClick={() => window.confirm('¿Deshacer los pagos de esta tarjeta?') && onDeshacerPago()}>
            <Undo2 size={16} /> Deshacer pagos
          </button>
        )}
        <button className="hoja-btn" onClick={onClose}>Listo</button>
      </div>
    </Hoja>
  );
}

function HojaDebito({ tarjeta, onUpdate, onEliminar, onClose }) {
  const [monto, setMonto] = useState('');
  const [nota, setNota]   = useState('');
  const saldos = tarjeta.saldos || [];
  const mt = (n) => moneyTarjeta(n, tarjeta.moneda);

  const registrar = () => {
    const m = parseFloat(monto);
    if (isNaN(m)) return;
    const d = new Date();
    const fecha = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    onUpdate({ ...tarjeta, saldos: [...saldos, { ts: Date.now(), fecha, monto: m, nota: nota.trim() }] });
    setMonto(''); setNota('');
  };

  return (
    <Hoja titulo={tarjeta.nombre} onClose={onClose}>
      <div className="hp-cabecera">
        <span><strong>{tarjeta.nombre}</strong> · saldo actual</span>
        <div className="hp-monto">{mt(saldoDebito(tarjeta))}</div>
      </div>

      <div className="tm-cargo">
        <span className="hoja-seccion">Registrar saldo</span>
        <div className="hoja-fila">
          <label className="hoja-campo tm-monto-corto"><span className="sr-only">Saldo actual</span>
            <input type="number" inputMode="decimal" value={monto} onChange={e => setMonto(e.target.value)} placeholder="Saldo" /></label>
          <label className="hoja-campo"><span className="sr-only">Nota</span>
            <input value={nota} onChange={e => setNota(e.target.value)} placeholder="Nota (opcional)" /></label>
          <button className="tm-mas" onClick={registrar} aria-label="Registrar saldo" disabled={monto === ''}><Icono nombre="mas" size={20} grosor={2.4} /></button>
        </div>
      </div>

      <label className="hoja-campo">
        <span>Saldo inicial del mes {simboloDe(tarjeta.moneda)}</span>
        <input type="number" inputMode="decimal" min="0" value={tarjeta.saldoInicial || ''} placeholder="0"
          onChange={e => onUpdate({ ...tarjeta, saldoInicial: parseFloat(e.target.value) || 0 })} />
      </label>

      <div className="tm-detalle">
        <span className="hoja-seccion">Movimientos</span>
        {saldos.length === 0 && <p className="tm-vacio">Sin registros todavía.</p>}
        {[...saldos].reverse().map((s, ri) => {
          const idx = saldos.length - 1 - ri;
          const prev = idx > 0 ? saldos[idx - 1].monto : (tarjeta.saldoInicial || 0);
          const d = s.monto - prev;
          return (
            <div key={s.id || s.ts || ri} className="tm-fila">
              <span>{s.nota || 'Saldo registrado'} <em>{s.auto ? 'auto · ' : ''}{s.fecha}</em></span>
              <strong className={d < 0 ? 'rojo' : d > 0 ? 'verde' : ''}>{d > 0 ? '+' : d < 0 ? '−' : ''}{mt(Math.abs(d))}</strong>
              <button className="tm-borrar" aria-label="Eliminar movimiento"
                onClick={() => onUpdate({ ...tarjeta, saldos: saldos.filter((_, i) => i !== idx) })}><Trash2 size={15} /></button>
            </div>
          );
        })}
        <div className="tm-fila"><span>Saldo inicial del mes</span><strong>{mt(tarjeta.saldoInicial || 0)}</strong></div>
      </div>

      <div className="hoja-acciones">
        <button className="hoja-btn-peligro" aria-label="Eliminar tarjeta"
          onClick={() => window.confirm(`¿Eliminar la tarjeta "${tarjeta.nombre}"?`) && onEliminar()}>
          <Trash2 size={18} />
        </button>
        <button className="hoja-btn" onClick={onClose}>Listo</button>
      </div>
    </Hoja>
  );
}

function HojaNuevaCompra({ tarjetas, anio, mes, onCrear, onClose }) {
  const nombresCredito = [...new Set((tarjetas || []).filter(t => t.tipo !== 'debito').map(t => t.nombre).filter(Boolean))];
  const [concepto, setConcepto] = useState('');
  const [tarjetaNombre, setTarjetaNombre] = useState(nombresCredito[0] || '');
  const [modo, setModo]     = useState('cuota');
  const [monto, setMonto]   = useState('');
  const [nCuotas, setNCuotas] = useState('');
  const [inicioMes, setInicioMes] = useState(mes);
  const [inicioAnio, setInicioAnio] = useState(anio);
  const moneda = (tarjetas || []).find(t => t.nombre === tarjetaNombre && t.tipo !== 'debito')?.moneda || monedaPrincipal();

  const n = parseInt(nCuotas, 10);
  const v = parseFloat(monto);
  const valido = concepto.trim() && tarjetaNombre.trim() && n > 0 && v > 0;

  return (
    <Hoja titulo="Compra en cuotas" onClose={onClose}>
      <h3 className="hoja-titulo">Compra en cuotas</h3>
      <label className="hoja-campo"><span>Qué compraste</span>
        <input value={concepto} onChange={e => setConcepto(e.target.value)} placeholder="Ej: Heladera" autoFocus /></label>
      <label className="hoja-campo"><span>Tarjeta de crédito</span>
        <input value={tarjetaNombre} list="tm-tarjetas" onChange={e => setTarjetaNombre(e.target.value)} placeholder="Ej: Visa OCA" />
        <datalist id="tm-tarjetas">{nombresCredito.map(x => <option key={x} value={x} />)}</datalist>
      </label>
      <div className="hoja-campo">
        <span>El monto es</span>
        <div className="tm-segmento">
          <button className={modo === 'cuota' ? 'sel' : ''} onClick={() => setModo('cuota')}>Por cuota</button>
          <button className={modo === 'total' ? 'sel' : ''} onClick={() => setModo('total')}>Total</button>
        </div>
      </div>
      <div className="hoja-fila">
        <label className="hoja-campo"><span>Monto {simboloDe(moneda)}</span>
          <input type="number" inputMode="decimal" min="0" value={monto} onChange={e => setMonto(e.target.value)} placeholder="0" /></label>
        <label className="hoja-campo"><span>Cuotas</span>
          <input type="number" inputMode="numeric" min="1" value={nCuotas} onChange={e => setNCuotas(e.target.value)} placeholder="6" /></label>
      </div>
      <div className="hoja-fila">
        <label className="hoja-campo"><span>Primera cuota</span>
          <select className="tm-select" value={inicioMes} onChange={e => setInicioMes(Number(e.target.value))}>
            {MESES_ES.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select></label>
        <label className="hoja-campo tm-monto-corto"><span>Año</span>
          <input type="number" inputMode="numeric" value={inicioAnio} onChange={e => setInicioAnio(e.target.value)} /></label>
      </div>
      {modo === 'total' && n > 0 && v > 0 && (
        <p className="tm-aviso">{n} cuotas de <strong>{moneyTarjeta(v / n, moneda)}</strong></p>
      )}
      <button className="hoja-btn" disabled={!valido} onClick={() => onCrear({
        id: `fin_${Date.now().toString(36)}`,
        concepto: concepto.trim(),
        tarjetaNombre: tarjetaNombre.trim(),
        moneda,
        montoCuota: modo === 'total' ? v / n : v,
        cuotasTotales: n,
        anioInicio: Number(inicioAnio),
        mesInicio: Number(inicioMes),
        creadoEn: new Date().toISOString(),
      })}>
        Agregar compra
      </button>
    </Hoja>
  );
}

// ── Pantalla ──────────────────────────────────────────────────

export default function TarjetasMovil({
  data, gastos, financiaciones, anio, mes,
  cuotasPendientes, onAplicarCuotas, tarjetasPreviasLabel, onImportarTarjetasPrevias,
  onAgregar, onActualizar, onEliminar, onPagarCredito, onDeshacerPagos, onChangeFinanciaciones,
  web = false, // computadora: encabezado grande y tarjetas a la izquierda, cuotas a la derecha
}) {
  const [hoja, setHoja] = useState(null); // { tipo, idx }

  const credito = data.filter(t => t.tipo !== 'debito');
  const debito  = data.filter(t => t.tipo === 'debito');

  const deudaPrincipal = credito.filter(t => !esSecundaria(t.moneda)).reduce((s, t) => s + saldoTarjeta(t), 0);
  const dispPrincipal  = debito.filter(t => !esSecundaria(t.moneda)).reduce((s, t) => s + saldoDebito(t), 0);

  // Por posición: hay tarjetas viejas guardadas sin id
  const tarjetaHoja = hoja?.idx !== undefined ? data[hoja.idx] : null;
  const cerrar = () => setHoja(null);

  return (
    <div className={`tm ${web ? 'tm--web' : ''}`}>
      {web ? (
        <div className="web-cab">
          <div>
            <span className="web-sub">Deuda de crédito {money(deudaPrincipal)}{debito.length > 0 && <> · débito disponible {money(dispPrincipal)}</>}</span>
            <h1 className="web-h1">Tarjetas</h1>
          </div>
          <button className="ggw-btn" onClick={() => setHoja({ tipo: 'nueva' })}>
            <Icono nombre="mas" size={16} grosor={2.4} /> Agregar tarjeta
          </button>
        </div>
      ) : (
        <div className="tm-cab">
          <span>Deuda {money(deudaPrincipal)}{debito.length > 0 && <> · disponible {money(dispPrincipal)}</>}</span>
          <button className="tm-agregar" onClick={() => setHoja({ tipo: 'nueva' })} aria-label="Agregar tarjeta"><Icono nombre="mas" size={22} grosor={2.4} /></button>
        </div>
      )}

      {data.length === 0 && tarjetasPreviasLabel && (
        <div className="tm-banner">
          <Icono nombre="tarjeta" size={18} />
          <span><strong>Este mes no tiene tarjetas.</strong> Traé las de {tarjetasPreviasLabel}.</span>
          <button onClick={onImportarTarjetasPrevias}>Traer</button>
        </div>
      )}

      {cuotasPendientes.length > 0 && (
        <div className="tm-banner">
          <Icono nombre="calendario" size={18} />
          <span>
            <strong>{cuotasPendientes.length === 1 ? '1 cuota' : `${cuotasPendientes.length} cuotas`} de {MESES_ES[mes].toLowerCase()} sin cargar:</strong>{' '}
            {cuotasPendientes.map(c => `${c.fin.concepto} (${c.numero}/${c.fin.cuotasTotales})`).join(', ')}
          </span>
          <button onClick={onAplicarCuotas}>Cargar</button>
        </div>
      )}

      {data.length === 0 && !tarjetasPreviasLabel && (
        <div className="tm-vacio-grande">
          <Icono nombre="tarjeta" size={32} />
          <p>Todavía no agregaste tarjetas.</p>
          <button className="hoja-btn" onClick={() => setHoja({ tipo: 'nueva' })}>Agregar tarjeta</button>
        </div>
      )}

      <div className="tm-cuerpo">
      <div className="tm-tarjetas">
      {credito.map(t => {
        const saldo = saldoTarjeta(t);
        const total = t.monto || 0;
        const saldada = total > 0 && saldo === 0;
        const cuotas = (t.cuotas || []).reduce((s, c) => s + (c.monto || 0), 0);
        const resto = total - cuotas;
        const pagado = pagadoTarjeta(t);
        return (
          <div key={t.id || data.indexOf(t)} className={`tm-credito ${saldada ? 'saldada' : ''}`}>
            <button className="tm-credito-cab" onClick={() => setHoja({ tipo: 'detalle', idx: data.indexOf(t) })}>
              <span className="tm-credito-nombre">{t.nombre}</span>
              <span className="tm-credito-tipo">Crédito · {t.moneda} <Icono nombre="adelante" size={14} grosor={2.4} /></span>
            </button>
            <div className="tm-credito-saldo">
              <span>{saldada ? 'Saldada' : 'Saldo a pagar'}</span>
              <strong>{moneyTarjeta(saldo, t.moneda)}</strong>
            </div>
            <div className="tm-credito-pie">
              <span>
                {pagado > 0 && !saldada
                  ? `Pagaste ${moneyTarjeta(pagado, t.moneda)} de ${moneyTarjeta(total, t.moneda)}`
                  : `Cuotas ${moneyTarjeta(cuotas, t.moneda)} · Gastos ${moneyTarjeta(resto, t.moneda)}`}
              </span>
              {!saldada && saldo > 0 && (
                <button onClick={() => setHoja({ tipo: 'pagar', idx: data.indexOf(t) })}>Pagar</button>
              )}
            </div>
          </div>
        );
      })}

      {debito.map(t => {
        const actual = saldoDebito(t);
        const dif = actual - (t.saldoInicial || 0);
        return (
          <button key={t.id || data.indexOf(t)} className="tm-debito" onClick={() => setHoja({ tipo: 'debito', idx: data.indexOf(t) })}>
            <span className="tm-debito-ico"><Icono nombre="debito" size={20} /></span>
            <span className="tm-debito-txt">
              <strong>{t.nombre}</strong>
              <small className={dif < 0 ? 'rojo' : dif > 0 ? 'verde' : ''}>
                {(t.saldoInicial || 0) > 0
                  ? `${dif > 0 ? '+' : dif < 0 ? '−' : ''}${moneyTarjeta(Math.abs(dif), t.moneda)} desde el inicio del mes`
                  : `Débito · ${t.moneda}`}
              </small>
            </span>
            <span className="tm-debito-saldo">
              <strong className={actual < 0 ? 'rojo' : ''}>{moneyTarjeta(actual, t.moneda)}</strong>
              <small>saldo</small>
            </span>
          </button>
        );
      })}

      </div>

      <div className="tm-cuotas">
        <div className="tm-cuotas-cab">
          <h2>Compras en cuotas</h2>
          <button onClick={() => setHoja({ tipo: 'compra' })}>Agregar</button>
        </div>
        {(financiaciones || []).length === 0 && (
          <p className="tm-vacio">Agregá una compra y sus cuotas se cargan solas cada mes.</p>
        )}
        {(financiaciones || []).map(f => {
          const n = numeroCuota(f, anio, mes);
          const activa = estaActiva(f, anio, mes);
          const faltan = Math.max(0, (f.cuotasTotales || 0) - Math.max(0, n));
          const pct = f.cuotasTotales > 0 ? Math.min(100, Math.max(0, n) / f.cuotasTotales * 100) : 0;
          return (
            <div key={f.id} className={`tm-compra ${activa ? '' : 'inactiva'}`}>
              <div className="tm-compra-fila">
                <strong>{f.concepto}</strong>
                <span>{moneyTarjeta(f.montoCuota, f.moneda)}<small>/mes</small></span>
              </div>
              <span className="tm-barra"><span style={{ width: pct + '%' }} /></span>
              <div className="tm-compra-fila">
                <small>
                  {n < 1 ? `Empieza en ${MESES_ES[f.mesInicio]} ${f.anioInicio}`
                    : activa ? `Cuota ${n} de ${f.cuotasTotales} · ${f.tarjetaNombre} · ${faltan === 1 ? 'falta 1' : `faltan ${faltan}`}`
                    : `Finalizada · ${f.tarjetaNombre}`}
                </small>
                <button className="tm-borrar" aria-label={`Eliminar ${f.concepto}`}
                  onClick={() => window.confirm(`¿Eliminar la compra "${f.concepto}"?`) &&
                    onChangeFinanciaciones((financiaciones || []).filter(x => x.id !== f.id))}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      </div>

      {hoja?.tipo === 'nueva' && (
        <HojaNuevaTarjeta onClose={cerrar} onCrear={(nombre, tipo, moneda) => { onAgregar(nombre, tipo, moneda); cerrar(); }} />
      )}
      {hoja?.tipo === 'pagar' && tarjetaHoja && (
        <HojaPagarCredito tarjeta={tarjetaHoja} debitos={debito} onClose={cerrar}
          onPagar={(m, origen) => { onPagarCredito(tarjetaHoja, m, origen); cerrar(); }} />
      )}
      {hoja?.tipo === 'detalle' && tarjetaHoja && (
        <HojaDetalleCredito tarjeta={tarjetaHoja} gastos={gastos} debitos={debito} onClose={cerrar}
          onUpdate={onActualizar}
          onDeshacerPago={() => onDeshacerPagos(tarjetaHoja)}
          onEliminar={() => { onEliminar(tarjetaHoja); cerrar(); }} />
      )}
      {hoja?.tipo === 'debito' && tarjetaHoja && (
        <HojaDebito tarjeta={tarjetaHoja} onClose={cerrar} onUpdate={onActualizar}
          onEliminar={() => { onEliminar(tarjetaHoja); cerrar(); }} />
      )}
      {hoja?.tipo === 'compra' && (
        <HojaNuevaCompra tarjetas={data} anio={anio} mes={mes} onClose={cerrar}
          onCrear={f => { onChangeFinanciaciones([...(financiaciones || []), f]); cerrar(); }} />
      )}
    </div>
  );
}
