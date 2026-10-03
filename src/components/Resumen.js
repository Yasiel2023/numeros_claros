// src/components/Resumen.js
import React from 'react';
import { money, moneyDe, esSecundaria, simbolo } from '../moneda';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { pagadoTarjeta, idsCredito, cuentaComoGastoReal, previstoPropioTarjeta } from '../tarjetas';
import { IconoCategoria } from '../iconos';


export default function Resumen({ mesData, onChange, grupos = [] }) {
  if (!mesData) return null;

  const {
    ingresos = [],
    gastos = {},
    tarjetas = [],
    objetivoAhorro = 0,
  } = mesData;

  // ── Ingresos ──────────────────────────────────────────────────
  const totalIngPrev = ingresos.reduce((s, i) => s + (i.previsto || 0), 0);
  const totalIngReal = ingresos.reduce((s, i) => s + (i.real || 0), 0);

  // ── Grupos dinámicos ─────────────────────────────────────────
  // Lo cargado a una tarjeta de credito no cuenta como gasto real hasta pagar la tarjeta
  const idsCred = idsCredito(tarjetas);

  const gruposData = grupos.map(g => {
    const periodos = gastos[g.id] || [];
    const items = periodos.flatMap(p => p.items || []);
    const prev = items.reduce((s, i) => s + (i.previsto || 0), 0);
    const real = items.filter(i => cuentaComoGastoReal(i, idsCred)).reduce((s, i) => s + (i.real || 0), 0);
    return { id: g.id, nombre: g.nombre, icono: g.icono || '', prev, real };
  });

  // ── Tarjetas (una fila por tarjeta de credito) ────────────────
  const credito = tarjetas.filter(t => t.tipo !== 'debito' && (t.monto || 0) > 0);
  const totalTarjetasPrevUYU = credito.filter(t => !esSecundaria(t.moneda))
    .reduce((s, t) => s + previstoPropioTarjeta(t, gastos), 0);
  const totalTarjetasRealUYU = credito.filter(t => !esSecundaria(t.moneda)).reduce((s, t) => s + pagadoTarjeta(t), 0);

  // ── Totales ───────────────────────────────────────────────────
  const totalGastosPrev = gruposData.reduce((s, g) => s + g.prev, 0) + totalTarjetasPrevUYU + objetivoAhorro;
  const totalGastosReal = gruposData.reduce((s, g) => s + g.real, 0) + totalTarjetasRealUYU + objetivoAhorro;
  const saldoLibrePrev  = totalIngPrev - totalGastosPrev;
  const saldoLibreReal  = totalIngReal - totalGastosReal;
  const saldoPct = totalIngPrev > 0 ? Math.round((totalGastosPrev / totalIngPrev) * 100) : 0;

  // ── Chart ───────────────────────────────────────────
  const chartData = [
    { name: 'Ingresos', prev: totalIngPrev, real: totalIngReal },
    ...gruposData.map(g => ({
      name: g.nombre,
      prev: g.prev,
      real: g.real,
    })),
    ...credito.filter(t => !esSecundaria(t.moneda)).map(t => ({
      name: t.nombre,
      prev: previstoPropioTarjeta(t, gastos),
      real: pagadoTarjeta(t),
    })),
    ...(objetivoAhorro > 0
      ? [{ name: 'Ahorro', prev: objetivoAhorro, real: objetivoAhorro }]
      : []),
  ];

  return (
    <div className="section-block">
      <h2 className="section-title">Resumen del mes</h2>

      <div className="resumen-grid">
        <div className="resumen-table-wrap">
          <table className="data-table resumen-table">
            <thead>
              <tr><th>Concepto</th><th>Presupuestado {simbolo()}</th><th>Real pagado {simbolo()}</th><th>%</th></tr>
            </thead>
            <tbody>
              <tr className="row-ingreso">
                <td><span className="res-nombre"><IconoCategoria grupo={{ icono: 'ingresos' }} size={24} /> Ingresos</span></td>
                <td className="total-val pos">{money(totalIngPrev)}</td>
                <td className="total-val pos">{money(totalIngReal)}</td>
                <td>—</td>
              </tr>
              {gruposData.map(g => (
                <tr key={g.id}>
                  <td><span className="res-nombre"><IconoCategoria grupo={g} size={24} /> {g.nombre}</span></td>
                  <td>{money(g.prev)}</td>
                  <td className={g.real > 0 ? 'neg' : ''}>{money(g.real)}</td>
                  <td>{totalIngPrev > 0 ? Math.round(g.prev / totalIngPrev * 100) : 0}%</td>
                </tr>
              ))}
              {credito.map(t => {
                const esUSD  = esSecundaria(t.moneda);   // tarjeta en la moneda secundaria
                const montoT = (v) => moneyDe(v, esUSD ? t.moneda : undefined);
                const pag    = pagadoTarjeta(t);
                const propio = previstoPropioTarjeta(t, gastos);
                return (
                  <tr key={t.id || t.nombre}>
                    <td>
                      <span className="res-nombre"><IconoCategoria grupo={{ icono: 'tarjeta' }} size={24} /> {t.nombre}</span>{esUSD && <span className="badge-fijo">{t.moneda}</span>}
                      {propio < (t.monto || 0) && (
                        <span className="resumen-nota-tarjeta">
                          deuda {montoT(t.monto || 0)} — el resto ya está en sus grupos
                        </span>
                      )}
                    </td>
                    <td>{montoT(propio)}</td>
                    <td className={pag > 0 ? 'neg' : ''}>{montoT(pag)}</td>
                    <td>{!esUSD && totalIngPrev > 0 ? Math.round(propio / totalIngPrev * 100) : '—'}</td>
                  </tr>
                );
              })}
              {objetivoAhorro > 0 && (
                <tr className="row-ahorro">
                  <td>
                    <span className="res-nombre"><IconoCategoria grupo={{ icono: 'ahorro' }} size={24} /> Ahorro</span>{' '}
                    <input
                      type="number" className="cell-input obj-ahorro-input-inline"
                      value={objetivoAhorro || ''} min="0" placeholder="0"
                      onChange={e => onChange({ ...mesData, objetivoAhorro: parseFloat(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="neg">{money(objetivoAhorro)}</td>
                  <td className="neg">{money(objetivoAhorro)}</td>
                  <td>{totalIngPrev > 0 ? Math.round(objetivoAhorro / totalIngPrev * 100) : 0}%</td>
                </tr>
              )}
              <tr className="totals-row">
                <td>TOTAL GASTOS</td>
                <td className="neg">{money(totalGastosPrev)}</td>
                <td className={totalGastosReal > 0 ? 'neg' : 'pos'}>{money(totalGastosReal)}</td>
                <td>{saldoPct}%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Gráfico */}
        <div className="resumen-chart">
          <h3 className="chart-label">Presupuestado vs Real pagado</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 40, left: 0 }} barGap={2}>
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false}
                angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false}
                tickFormatter={n => Math.abs(n) >= 1000 ? `${(n/1000).toFixed(0)}K` : n} />
              <Tooltip formatter={(v) => `${money(v)}`}
                contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="prev" name="Presupuestado" fill="#94a3b8" radius={[3,3,0,0]} maxBarSize={20} />
              <Bar dataKey="real" name="Real pagado" radius={[3,3,0,0]} maxBarSize={20}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={i === 0 ? '#0d9488' : d.real > d.prev ? '#ef4444' : '#0d9488'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Saldo Presupuestado vs Real */}
      <div className="saldo-summary-block">
        <h3 className="sub-title">Saldo del mes</h3>
        <div className="saldo-summary-grid">
          {/* Presupuestado */}
          <div className="saldo-col">
            <div className="saldo-col-title">Presupuestado</div>
            <div className="saldo-row">
              <span>Ingresos</span>
              <span className="pos">{money(totalIngPrev)}</span>
            </div>
            <div className="saldo-row">
              <span>Gastos</span>
              <span className="neg">{money(totalGastosPrev)}</span>
            </div>
            <div className="saldo-row saldo-libre-row">
              <span>Saldo libre</span>
              <span className={saldoLibrePrev >= 0 ? 'pos' : 'neg'}>{money(saldoLibrePrev)}</span>
            </div>
          </div>

          {/* Real */}
          <div className="saldo-col">
            <div className="saldo-col-title">Real</div>
            <div className="saldo-row">
              <span>Ingresos</span>
              <span className="pos">{money(totalIngReal)}</span>
            </div>
            <div className="saldo-row">
              <span>Gastos pagados</span>
              <span className="neg">{money(totalGastosReal)}</span>
            </div>
            <div className="saldo-row saldo-libre-row">
              <span>Saldo libre</span>
              <span className={saldoLibreReal >= 0 ? 'pos' : 'neg'}>{money(saldoLibreReal)}</span>
            </div>
          </div>
        </div>

        {objetivoAhorro === 0 && (
          <div className="obj-ahorro-row">
            <label className="obj-ahorro-label">Objetivo de ahorro</label>
            <input type="number" className="cell-input obj-ahorro-input" value={objetivoAhorro || ''} min="0"
              onChange={e => onChange({ ...mesData, objetivoAhorro: parseFloat(e.target.value) || 0 })}
              placeholder="0" />
          </div>
        )}
      </div>
    </div>
  );
}
