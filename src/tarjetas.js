// src/tarjetas.js
// Helpers de tarjetas compartidos por Tarjetas, Dashboard y Resumen.
//
// Modelo contable (flujo de caja):
//   - Un gasto pagado con tarjeta de CREDITO no cuenta como gasto real del mes:
//     solo aumenta la deuda de la tarjeta.
//   - El gasto real se registra cuando se paga la tarjeta (montoPagado).
//   - Los gastos pagados en efectivo o con debito cuentan al momento de pagarlos.

export const esCredito = (t) => t && t.tipo !== 'debito';

// Compatibilidad: las tarjetas viejas solo tienen el booleano `pagado`
export const pagadoTarjeta = (t) =>
  t.montoPagado !== undefined ? (t.montoPagado || 0) : (t.pagado ? (t.monto || 0) : 0);

export const saldoTarjeta = (t) => Math.max(0, (t.monto || 0) - pagadoTarjeta(t));

export const montoCargado = (item) =>
  item.tarjetaMonto !== undefined ? item.tarjetaMonto : (item.real || 0);

// Recorre todos los grupos/periodos y devuelve los items pagados con esa tarjeta
export function gastosDeTarjeta(gastos, tarjetaId) {
  const res = [];
  if (!tarjetaId) return res;
  Object.values(gastos || {}).forEach(grupo => {
    (Array.isArray(grupo) ? grupo : []).forEach(p => {
      const items = (p && typeof p === 'object' && 'items' in p) ? (p.items || []) : [p];
      items.forEach(i => {
        if (i && i.pagado === true && i.tarjetaId === tarjetaId) res.push(i);
      });
    });
  });
  return res;
}

export const montoGastosDeTarjeta = (gastos, tarjetaId) =>
  gastosDeTarjeta(gastos, tarjetaId).reduce((s, i) => s + montoCargado(i), 0);

// Ids de las tarjetas de credito del mes
export const idsCredito = (tarjetas) =>
  new Set((tarjetas || []).filter(esCredito).map(t => t.id).filter(Boolean));

// Un item pagado cuenta como gasto real solo si NO fue cargado a una tarjeta de credito
export const cuentaComoGastoReal = (item, idsCred) =>
  item.pagado === true && !(item.tarjetaId && idsCred.has(item.tarjetaId));

// Lo que la tarjeta aporta al presupuesto previsto: cuotas + cargos propios.
// Se descuentan los gastos cargados a la tarjeta porque ya estan previstos en su grupo.
export const previstoPropioTarjeta = (t, gastos) =>
  Math.max(0, (t.monto || 0) - montoGastosDeTarjeta(gastos, t.id));
