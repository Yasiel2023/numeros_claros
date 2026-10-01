// src/financiaciones.js
// Compras en cuotas. Una financiacion vive a nivel presupuesto
// (presupuestos/{uid}/{id}/_financiaciones) y "aterriza" en cada mes que le toca,
// sumandose a la tarjeta de credito correspondiente.
//
// Forma: { id, concepto, tarjetaNombre, moneda, montoCuota, cuotasTotales, anioInicio, mesInicio }
// El vinculo con la tarjeta es por NOMBRE porque los ids de tarjeta son por mes.

export function numeroCuota(fin, anio, mes) {
  return (anio - fin.anioInicio) * 12 + (mes - fin.mesInicio) + 1;
}

export function estaActiva(fin, anio, mes) {
  const n = numeroCuota(fin, anio, mes);
  return n >= 1 && n <= (fin.cuotasTotales || 0);
}

export function cuotasDelMes(financiaciones, anio, mes) {
  return (financiaciones || [])
    .filter(f => estaActiva(f, anio, mes))
    .map(f => ({ fin: f, numero: numeroCuota(f, anio, mes) }));
}

export const marcaCuota = (finId, numero) => `${finId}_${numero}`;

// Cuotas de este mes que todavia no se cargaron a la tarjeta
export function cuotasPendientes(financiaciones, mesData, anio, mes) {
  const aplicadas = mesData?.cuotasAplicadas || [];
  return cuotasDelMes(financiaciones, anio, mes)
    .filter(c => !aplicadas.includes(marcaCuota(c.fin.id, c.numero)));
}

const mismoNombre = (a, b) =>
  (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

// Suma las cuotas pendientes del mes a su tarjeta de credito (la crea si no existe).
// Es idempotente: cada cuota aplicada queda registrada en mesData.cuotasAplicadas.
export function aplicarCuotas(mesData, financiaciones, anio, mes) {
  if (!mesData) return mesData;
  const pendientes = cuotasPendientes(financiaciones, mesData, anio, mes);
  if (pendientes.length === 0) return mesData;

  const tarjetas  = [...(mesData.tarjetas || [])];
  const aplicadas = [...(mesData.cuotasAplicadas || [])];

  pendientes.forEach(({ fin, numero }, i) => {
    let idx = tarjetas.findIndex(t =>
      t.tipo !== 'debito' &&
      mismoNombre(t.nombre, fin.tarjetaNombre) &&
      t.moneda === fin.moneda);

    if (idx === -1) {
      tarjetas.push({
        id: `tj_${Date.now().toString(36)}_${i}`,
        nombre: (fin.tarjetaNombre || '').trim() || 'Tarjeta',
        moneda: fin.moneda || 'UYU',
        tipo: 'credito',
        monto: 0,
        pagado: false,
      });
      idx = tarjetas.length - 1;
    }

    const t = tarjetas[idx];
    tarjetas[idx] = {
      ...t,
      monto: (t.monto || 0) + (fin.montoCuota || 0),
      cuotas: [...(t.cuotas || []), {
        finId:    fin.id,
        concepto: fin.concepto,
        numero,
        total:    fin.cuotasTotales,
        monto:    fin.montoCuota || 0,
      }],
    };
    aplicadas.push(marcaCuota(fin.id, numero));
  });

  return { ...mesData, tarjetas, cuotasAplicadas: aplicadas };
}

// Tarjetas del mes anterior listas para arrancar un mes nuevo:
// el credito vuelve a cero y el debito arrastra su ultimo saldo.
export function tarjetasParaMesNuevo(tarjetasPrev) {
  return (tarjetasPrev || []).map(t => {
    if (t.tipo === 'debito') {
      const saldos = Array.isArray(t.saldos) ? t.saldos : [];
      const ultimo = saldos.length > 0 ? saldos[saldos.length - 1].monto : (t.saldoInicial || 0);
      return { ...t, saldoInicial: ultimo, saldos: [] };
    }
    // Los pagos y cuotas son del mes anterior: el mes nuevo arranca sin deuda ni pagos
    const { cuotas: _cuotas, pagos: _pagos, montoPagado: _mp, ...resto } = t;
    return { ...resto, monto: 0, pagado: false };
  });
}
