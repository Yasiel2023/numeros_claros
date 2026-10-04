// src/components/GrupoGastos.js
// Componente generico para cualquier grupo de gastos basado en frecuencia.
// Frecuencias: mensual (1 periodo) | quincenal (2) | cada10dias (3) | semanal (N semanas)
// La data llega como array de periodos: [{numero, label, items:[]}]
// Compatibilidad atras: si llegan items planos se envuelven en un unico periodo.
import React, { useState, useEffect } from 'react';
import { esSecundaria } from '../moneda';
import { getPeriodosLabel } from '../constants';
import useEsMovil from '../useEsMovil';
import GrupoGastosMovil from './GrupoGastosMovil';
import GrupoGastosWeb from './GrupoGastosWeb';

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

// Marca pagado un item de una categoría. Si se eligió tarjeta, el gasto y la tarjeta
// se actualizan juntos para que el guardado quede consistente.
// montoPagado: el monto confirmado en el panel de pago (si no, el del item).
// Devuelve { periodos, tarjetas } (tarjetas es null si no cambiaron) o null si no existe el item.
export function pagarEnPeriodos(periodos, periodoIdx, itemIdx, tarjetas, tarjetaId, montoPagado) {
  const item = (periodos[periodoIdx]?.items || [])[itemIdx];
  if (!item) return null;
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

  return {
    periodos: periodos.map((p, i) => i === periodoIdx
      ? { ...p, items: (p.items || []).map((it, j) => j === itemIdx ? pagado : it) }
      : p),
    tarjetas: nuevasTarjetas,
  };
}

// Revierte el efecto de un pago cargado previamente a una tarjeta.
function revertirPagoTarjeta(tarjetas, tarjetaId, monto, movId) {
  return (tarjetas || []).map(t => {
    if (t.id !== tarjetaId) return t;
    if (t.tipo === 'debito') {
      return { ...t, saldos: (t.saldos || []).filter(s => s.id !== movId) };
    }
    // Sin tope en 0: con ajustes a favor el total de la tarjeta puede ser negativo
    return { ...t, monto: (t.monto || 0) - monto };
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

// =============================================================================
// Componente principal
// Props:
//   grupo   � { id, nombre, icono, frecuencia }
//   data    � array de periodos [{numero, label, items:[]}]  o items planos (compat)
//   onChange � callback con el array de periodos actualizado
// =============================================================================
export default function GrupoGastos({ grupo, data, onChange, anio, mes, tarjetas = [], onVolver, onCargarComprobante, onEliminarCategoria }) {
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
    const res = pagarEnPeriodos(periodos, periodoIdx, itemIdx, tarjetas, tarjetaId, montoPagado);
    if (res) onChange(res.periodos, res.tarjetas);
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

  const vaciarCarrito = () =>
    onChange(periodos.map(p => ({
      ...p,
      items: (p.items || []).map(({ enCarrito: _ec, ...resto }) => resto),
    })));

  const actual = periodos.findIndex(p => grupo?.frecuencia === 'semanal' && esPeriodoActual(p, 'semanal', anio, mes));
  const Vista = esMovil ? GrupoGastosMovil : GrupoGastosWeb;
  return (
    <Vista
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
      onEliminarCategoria={onEliminarCategoria}
    />
  );
}
