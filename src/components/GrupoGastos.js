// src/components/GrupoGastos.js
// Componente generico para cualquier grupo de gastos basado en frecuencia.
// Frecuencias: mensual (1 periodo) | quincenal (2) | cada10dias (3) | semanal (N semanas)
// La data llega como array de periodos: [{numero, label, items:[]}]
// Compatibilidad atras: si llegan items planos se envuelven en un unico periodo.
import React, { useState, useEffect } from 'react';
import { money, esSecundaria, simbolo } from '../moneda';
import { Plus, Trash2, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { getPeriodosLabel } from '../constants';
import useEsMovil from '../useEsMovil';
import GrupoGastosMovil from './GrupoGastosMovil';
import Icono, { IconoCategoria } from '../iconos';

const fmtFechaHora = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// Los items de gasto están en la moneda principal del presupuesto, así que solo se
// pueden cargar pagos a tarjetas en esa moneda (no en la secundaria).
export const tarjetasDisponibles = (tarjetas) =>
  (tarjetas || []).filter(t => !esSecundaria(t.moneda) && t.id);

export const saldoActualDebito = (t) => {
  const saldos = t.saldos || [];
  return saldos.length > 0 ? saldos[saldos.length - 1].monto : (t.saldoInicial || 0);
};

// Carga un pago a una tarjeta: credito suma deuda, debito descuenta saldo.
// Devuelve las tarjetas actualizadas y el id del movimiento generado (debito).
// movId se puede pasar para generar varios movimientos en el mismo milisegundo.
export function aplicarPagoTarjeta(tarjetas, tarjetaId, monto, concepto, movId = `mov_${Date.now().toString(36)}`) {
  const nuevas = (tarjetas || []).map(t => {
    if (t.id !== tarjetaId) return t;
    if (t.tipo === 'debito') {
      const entrada = {
        id: movId,
        ts: Date.now(),
        fecha: fmtFechaHora(),
        monto: saldoActualDebito(t) - monto,
        nota: `Pago: ${concepto}`,
        auto: true,
      };
      return { ...t, saldos: [...(t.saldos || []), entrada] };
    }
    return { ...t, monto: (t.monto || 0) + monto };
  });
  return { tarjetas: nuevas, movId };
}

// Revierte el efecto de un pago cargado previamente a una tarjeta.
function revertirPagoTarjeta(tarjetas, tarjetaId, monto, movId) {
  return (tarjetas || []).map(t => {
    if (t.id !== tarjetaId) return t;
    if (t.tipo === 'debito') {
      return { ...t, saldos: (t.saldos || []).filter(s => s.id !== movId) };
    }
    return { ...t, monto: Math.max(0, (t.monto || 0) - monto) };
  });
}

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
// Un período tiene items, o al menos numero + label: RTDB borra los arrays vacíos,
// así que un período sin gastos vuelve de la base como { numero, label } sin items.
export const esPeriodo = (p) =>
  p !== null && typeof p === 'object' && ('items' in p || ('numero' in p && 'label' in p && !('nombre' in p)));

function isPeriodoArray(arr) {
  return arr.length > 0 && esPeriodo(arr[0]);
}

export const frecuenciaDe = (grupo) =>
  grupo?.frecuencia || (grupo?.tipo === 'semanas' ? 'semanal' : 'mensual');

// Períodos de una categoría en un mes. Si el mes todavía no tiene datos de la
// categoría (ej. una categoría agregada a mitad de mes, o vista en un mes viejo),
// se generan vacíos según su frecuencia en lugar de un único período "Mes".
export function periodosDelMes(data, grupo, anio, mes) {
  if (Array.isArray(data) && data.length > 0) return toPeriodos(data);
  return getPeriodosLabel(frecuenciaDe(grupo), anio, mes).map(p => ({ numero: p.numero, label: p.label, items: [] }));
}

// Normaliza data a array de periodos siempre
export function toPeriodos(data) {
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
// enCarrito:true -> modo carrito: el item ya está en el carrito del súper pero
// todavía no se pagó (se paga después, normalmente con el ticket).
function ItemRow({ item, tarjetas, modoCarrito, onChange, onDelete, onPagar, onDespagar }) {
  const [eligiendo, setEligiendo] = useState(false);
  const [seleccion, setSeleccion] = useState('');

  const previsto = item.previsto || 0;
  // real hereda previsto si no fue editado manualmente
  const real    = item.real !== undefined ? (item.real || 0) : previsto;
  const pagado  = item.pagado === true;
  const sinPrev = previsto === 0;
  const enCarrito = !pagado && item.enCarrito === true;

  const montar = () => onChange({ ...item, enCarrito: true });
  const sacar  = () => {
    // RTDB rechaza undefined: se quita la clave
    const { enCarrito: _ec, ...resto } = item;
    onChange(resto);
  };

  const opciones     = tarjetasDisponibles(tarjetas);
  const tarjetaUsada = item.tarjetaId
    ? (tarjetas || []).find(t => t.id === item.tarjetaId)
    : null;

  const iniciarPago = () => {
    if (opciones.length === 0) { onPagar(null); return; }
    setSeleccion('');
    setEligiendo(true);
  };

  const confirmarPago = () => {
    onPagar(seleccion || null);
    setEligiendo(false);
  };

  return (
    <>
      <tr className={pagado ? 'row-pagado' : enCarrito ? 'row-carrito' : ''}>
        <td>
          <span className="item-nombre">{item.nombre}</span>
          {enCarrito && <span className="item-carrito-tag"><Icono nombre="carrito" size={12} grosor={2.4} /> en carrito</span>}
          {pagado && tarjetaUsada && (
            <span className="item-tarjeta-tag">
              <Icono nombre={tarjetaUsada.tipo === 'debito' ? 'debito' : 'tarjeta'} size={12} grosor={2.4} /> {tarjetaUsada.nombre}
            </span>
          )}
        </td>
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
          {pagado ? (
            !sinPrev && <button className="btn-unpagar" onClick={onDespagar}>Deshacer</button>
          ) : modoCarrito ? (
            enCarrito
              ? <button className="btn-unpagar" onClick={sacar} title="Sacar del carrito">Sacar</button>
              : <button className="btn-montar" onClick={montar} title="Subir al carrito">Montar</button>
          ) : (
            !sinPrev && <button className="btn-pagar" onClick={iniciarPago}>Pagar</button>
          )}
        </td>
        <td>
          <button className="icon-btn-sm danger" onClick={onDelete}>
            <Trash2 size={13} />
          </button>
        </td>
      </tr>

      {eligiendo && (
        <tr className="pago-select-row">
          <td colSpan={5}>
            <div className="pago-select-wrap">
              <span className="pago-select-label">¿Con qué pagaste {money(real)}?</span>
              <select
                className="pago-select"
                value={seleccion}
                onChange={e => setSeleccion(e.target.value)}
                autoFocus
              >
                <option value="">Efectivo / Transferencia</option>
                {opciones.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.tipo === 'debito'
                      ? `${t.nombre} — saldo ${money(saldoActualDebito(t))}`
                      : `${t.nombre} — crédito`}
                  </option>
                ))}
              </select>
              <button className="btn-confirm" onClick={confirmarPago}><Check size={14} /></button>
              <button className="btn-cancel" onClick={() => setEligiendo(false)}><X size={14} /></button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// --- Seccion de un periodo con su propia tabla e inputs ---
function PeriodoSection({ periodo, showHeader, onChange, isCurrentPeriod = true, mostrarPagados = true, modoCarrito = false, tarjetas = [], onPagar, onDespagar, onEliminar }) {
  const [open, setOpen]       = useState(isCurrentPeriod);
  const [showAdd, setShowAdd] = useState(false);
  const [newNombre, setNewNombre] = useState('');
  const [newPrev, setNewPrev]     = useState('');

  const allItems   = periodo.items || [];
  const items      = mostrarPagados ? allItems : allItems.filter(i => i.pagado !== true);
  const conPrev    = allItems.filter(i => (i.previsto || 0) > 0).length;
  const pagados    = allItems.filter(i => i.pagado === true).length;
  const totalPrev  = allItems.reduce((s, i) => s + (i.previsto || 0), 0);
  const totalPend  = allItems.filter(i => i.pagado !== true)
                          .reduce((s, i) => s + (i.real !== undefined ? (i.real || 0) : (i.previsto || 0)), 0);
  const totalPagado = allItems.filter(i => i.pagado === true)
                           .reduce((s, i) => s + (i.real || 0), 0);
  const pendientes  = allItems.filter(i => i.pagado !== true);
  const enCarrito   = pendientes.filter(i => i.enCarrito === true).length;

  const updateItem = (idx, item) => {
    const allItemsIdx = allItems.findIndex((_, i) => {
      const filteredIndex = items.findIndex(filteredItem => filteredItem === allItems[i]);
      return filteredIndex === idx;
    });
    const n = [...allItems]; n[allItemsIdx] = item;
    onChange({ ...periodo, items: n });
  };

  const addItem = () => {
    if (!newNombre.trim()) return;
    const prev = parseFloat(newPrev) || 0;
    const it = { nombre: newNombre.trim(), previsto: prev, real: prev, pagado: false };
    onChange({ ...periodo, items: [...allItems, it] });
    setNewNombre(''); setNewPrev(''); setShowAdd(false);
  };

  return (
    <div className="periodo-section">
      {showHeader && (
        <button className="periodo-header" onClick={() => setOpen(o => !o)}>
          <span className="periodo-header-dot" />
          <span className="periodo-label">{periodo.label}</span>
          <span className="periodo-stats">
            {modoCarrito && pendientes.length > 0 && <>carrito {enCarrito}/{pendientes.length} &middot; </>}
            {pagados}/{conPrev} pagados &middot; prev {money(totalPrev)} &middot; pend {money(totalPend)} &middot; pagado {money(totalPagado)}
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
                placeholder={`Previsto ${simbolo()}`}
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
                <th>Previsto {simbolo()}</th>
                <th>Real {simbolo()}</th>
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
                  tarjetas={tarjetas}
                  modoCarrito={modoCarrito}
                  onChange={updated => updateItem(idx, updated)}
                  onDelete={() => onEliminar(allItems.indexOf(item))}
                  onPagar={tarjetaId => onPagar(allItems.indexOf(item), tarjetaId)}
                  onDespagar={() => onDespagar(allItems.indexOf(item))}
                />
              ))}
            </tbody>
            <tfoot>
              <tr className="total-row">
                <td><strong>Total previsto</strong></td>
                <td><strong>{money(totalPrev)}</strong></td>
                <td /><td colSpan={2} />
              </tr>
              <tr className="total-row-pend">
                <td>Pendiente de pago</td>
                <td />
                <td className="pend-total-cell">{money(totalPend)}</td>
                <td colSpan={2} />
              </tr>
              <tr className="total-row-pago">
                <td>Pagado</td>
                <td />
                <td className="pagado-total-cell">{money(totalPagado)}</td>
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
export default function GrupoGastos({ grupo, data, onChange, anio, mes, tarjetas = [], onVolver, onCargarComprobante }) {
  const [mostrarPagados, setMostrarPagados] = useState(true);
  const esMovil = useEsMovil();

  // Modo carrito: preferencia de este navegador, recordada por categoría
  const claveCarrito = `modoCarrito_${grupo?.id}`;
  const [modoCarrito, setModoCarritoState] = useState(() => {
    try { return localStorage.getItem(claveCarrito) === '1'; } catch (e) { return false; }
  });
  useEffect(() => {
    try { setModoCarritoState(localStorage.getItem(claveCarrito) === '1'); } catch (e) { /* sin storage */ }
  }, [claveCarrito]);
  const setModoCarrito = (v) => {
    setModoCarritoState(v);
    try { localStorage.setItem(claveCarrito, v ? '1' : '0'); } catch (e) { /* sin storage */ }
  };

  const periodos    = toPeriodos(data || []);
  const showHeaders = periodos.length > 1;

  const updatePeriodo = (idx, periodo) => {
    const n = [...periodos]; n[idx] = periodo;
    onChange(n);
  };

  const setItem = (periodoIdx, itemIdx, nuevoItem) =>
    periodos.map((p, i) => i === periodoIdx
      ? { ...p, items: (p.items || []).map((it, j) => j === itemIdx ? nuevoItem : it) }
      : p);

  // Marcar pagado. Si se eligio tarjeta, el gasto y la tarjeta se actualizan
  // juntos para que el guardado quede consistente.
  // montoPagado: el monto confirmado en el panel de pago del celular (si no, el del item)
  const pagarItem = (periodoIdx, itemIdx, tarjetaId, montoPagado) => {
    const item  = (periodos[periodoIdx]?.items || [])[itemIdx];
    if (!item) return;
    const monto = montoPagado !== undefined
      ? montoPagado
      : (item.real !== undefined ? (item.real || 0) : (item.previsto || 0));

    let nuevasTarjetas = null;
    // Al pagarse sale del carrito
    const { enCarrito: _ec, ...sinCarrito } = item;
    let pagado = { ...sinCarrito, pagado: true, real: monto };

    if (tarjetaId) {
      const res = aplicarPagoTarjeta(tarjetas, tarjetaId, monto, item.nombre);
      nuevasTarjetas = res.tarjetas;
      const esDebito = (tarjetas || []).find(t => t.id === tarjetaId)?.tipo === 'debito';
      pagado = {
        ...pagado,
        tarjetaId,
        tarjetaMonto: monto,
        ...(esDebito ? { tarjetaMovId: res.movId } : {}),
      };
    }

    onChange(setItem(periodoIdx, itemIdx, pagado), nuevasTarjetas);
  };

  const despagarItem = (periodoIdx, itemIdx) => {
    const item = (periodos[periodoIdx]?.items || [])[itemIdx];
    if (!item) return;

    let nuevasTarjetas = null;
    if (item.tarjetaId) {
      nuevasTarjetas = revertirPagoTarjeta(
        tarjetas,
        item.tarjetaId,
        item.tarjetaMonto !== undefined ? item.tarjetaMonto : (item.real || 0),
        item.tarjetaMovId,
      );
    }

    // Se quitan las claves de tarjeta (RTDB rechaza undefined)
    const { tarjetaId, tarjetaMonto, tarjetaMovId, ...limpio } = item;
    onChange(setItem(periodoIdx, itemIdx, { ...limpio, pagado: false }), nuevasTarjetas);
  };

  // Borrar un item pagado con tarjeta tiene que devolver el cargo a la tarjeta
  const eliminarItem = (periodoIdx, itemIdx) => {
    const item = (periodos[periodoIdx]?.items || [])[itemIdx];
    if (!item) return;

    let nuevasTarjetas = null;
    if (item.pagado === true && item.tarjetaId) {
      nuevasTarjetas = revertirPagoTarjeta(
        tarjetas,
        item.tarjetaId,
        item.tarjetaMonto !== undefined ? item.tarjetaMonto : (item.real || 0),
        item.tarjetaMovId,
      );
    }

    const nuevosPeriodos = periodos.map((p, i) => i === periodoIdx
      ? { ...p, items: (p.items || []).filter((_, j) => j !== itemIdx) }
      : p);
    onChange(nuevosPeriodos, nuevasTarjetas);
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

  // Carrito: pendientes ya montados vs. los que faltan montar
  const montoPend = (i) => (i.real !== undefined ? (i.real || 0) : (i.previsto || 0));
  const pendientesTodos = periodos.flatMap(p => (p.items || []).filter(i => i.pagado !== true));
  const enCarrito  = pendientesTodos.filter(i => i.enCarrito === true);
  const faltan     = pendientesTodos.filter(i => i.enCarrito !== true);

  const vaciarCarrito = () =>
    onChange(periodos.map(p => ({
      ...p,
      items: (p.items || []).map(({ enCarrito: _ec, ...resto }) => resto),
    })));

  if (esMovil) {
    const actual = periodos.findIndex(p => grupo?.frecuencia === 'semanal' && esPeriodoActual(p, 'semanal', anio, mes));
    return (
      <GrupoGastosMovil
        grupo={grupo}
        periodos={periodos}
        periodoInicial={actual >= 0 ? actual : 0}
        anio={anio}
        mes={mes}
        tarjetas={tarjetas}
        modoCarrito={modoCarrito}
        setModoCarrito={setModoCarrito}
        vaciarCarrito={vaciarCarrito}
        onUpdatePeriodo={updatePeriodo}
        onPagar={pagarItem}
        onDespagar={despagarItem}
        onEliminar={eliminarItem}
        onVolver={onVolver}
        onCargarComprobante={onCargarComprobante}
      />
    );
  }

  return (
    <div className="section-block">
      {/* Cabecera del grupo */}
      <div className="section-header">
        <h2 className="section-title">
          <IconoCategoria grupo={grupo} size={30} /> {grupo?.nombre}
          {grupo?.frecuencia && grupo.frecuencia !== 'mensual' && (
            <span className="grupo-freq-badge">{grupo.frecuencia}</span>
          )}
        </h2>
        <div className="section-header-right">
          <label
            className={`checkbox-filter carrito-toggle${modoCarrito ? ' activo' : ''}`}
            title="Modo carrito: ir montando productos y pagarlos después con el ticket"
            aria-label="Modo carrito"
          >
            <input
              type="checkbox"
              checked={modoCarrito}
              onChange={(e) => setModoCarrito(e.target.checked)}
            />
            <Icono nombre="carrito" size={16} />
          </label>
          <label className="checkbox-filter">
            <input
              type="checkbox"
              checked={mostrarPagados}
              onChange={(e) => setMostrarPagados(e.target.checked)}
            />
            <span>Mostrar pagados</span>
          </label>
          <span className="progress-txt">{pagados}/{conPrev} pagados</span>
        </div>
      </div>

      {/* Resumen rapido */}
      <div className="pend-summary">
        <div className="ps-item">
          <span>Total previsto</span>
          <strong>{money(totalPrev)}</strong>
        </div>
        <div className="ps-item orange">
          <span>Pendiente de pago</span>
          <strong>{money(totalPend)}</strong>
        </div>
        <div className="ps-item green">
          <span>Pagado</span>
          <strong>{money(totalPagado)}</strong>
        </div>
      </div>

      {/* Resumen del carrito */}
      {modoCarrito && (
        <div className="carrito-summary">
          <div className="carrito-summary-item">
            <span>En el carrito</span>
            <strong>{enCarrito.length} · {money(enCarrito.reduce((s, i) => s + montoPend(i), 0))}</strong>
          </div>
          <div className="carrito-summary-item falta">
            <span>Falta montar</span>
            <strong>{faltan.length} · {money(faltan.reduce((s, i) => s + montoPend(i), 0))}</strong>
          </div>
          {enCarrito.length > 0 && (
            <button className="btn-sm-outline" onClick={vaciarCarrito} title="Sacar todo del carrito sin pagar">
              Vaciar carrito
            </button>
          )}
        </div>
      )}

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
            mostrarPagados={mostrarPagados}
            modoCarrito={modoCarrito}
            tarjetas={tarjetas}
            onPagar={(itemIdx, tarjetaId) => pagarItem(idx, itemIdx, tarjetaId)}
            onDespagar={itemIdx => despagarItem(idx, itemIdx)}
            onEliminar={itemIdx => eliminarItem(idx, itemIdx)}
          />
        );
      })}
    </div>
  );
}
