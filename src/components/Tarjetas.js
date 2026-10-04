// src/components/Tarjetas.js
// Credito: monto pendiente + pagado (modelo existente)
// Debito:  saldoInicial + historial de saldos [{ts, fecha, monto, nota}]
import React from 'react';
import { pagadoTarjeta } from '../tarjetas';
import useEsMovil from '../useEsMovil';
import TarjetasMovil from './TarjetasMovil';

const fmtFecha = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
};

// ── Componente principal ────────────────────────────────────────
export default function Tarjetas({
  data = [], gastos = {}, onChange,
  financiaciones = [], onChangeFinanciaciones,
  cuotasPendientes = [], onAplicarCuotas,
  tarjetasPreviasLabel, onImportarTarjetasPrevias,
  anio, mes,
}) {
  const esMovil = useEsMovil();


  const actualizarCredito = (tarjeta) => {
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

  return (
      <TarjetasMovil
        web={!esMovil}
        data={data}
        gastos={gastos}
        financiaciones={financiaciones}
        anio={anio}
        mes={mes}
        cuotasPendientes={cuotasPendientes}
        onAplicarCuotas={onAplicarCuotas}
        tarjetasPreviasLabel={tarjetasPreviasLabel}
        onImportarTarjetasPrevias={onImportarTarjetasPrevias}
        onAgregar={(nombre, tipo, moneda) => {
          const base = { id: `tj_${Date.now().toString(36)}`, nombre, moneda, tipo };
          onChange([...data, tipo === 'debito' ? { ...base, saldoInicial: 0, saldos: [] } : { ...base, monto: 0, pagado: false }]);
        }}
        onActualizar={actualizarCredito}
        onEliminar={eliminar}
        onPagarCredito={pagarCredito}
        onDeshacerPagos={deshacerPagosCredito}
        onChangeFinanciaciones={onChangeFinanciaciones}
      />
    );
}
