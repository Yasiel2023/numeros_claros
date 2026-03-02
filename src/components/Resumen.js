// src/components/Resumen.js
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const fmt = (n) => new Intl.NumberFormat('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 0, useGrouping: false }).format(n || 0);
const fmtUSD = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2, useGrouping: false }).format(n || 0);

export default function Resumen({ mesData, onChange }) {
  if (!mesData) return null;

  const {
    ingresos = [], basicos = [], impuestos = [], semanas = [], asceo = [],
    tarjetas = [],
    objetivoAhorro = 0,
  } = mesData;

  // ── Calcular totales ──
  const totalIngPrev = ingresos.reduce((s, i) => s + (i.previsto || 0), 0);
  const totalIngReal = ingresos.reduce((s, i) => s + (i.real || 0), 0);

  const totalBasPrev = basicos.reduce((s, b) => s + (b.previsto || 0), 0);
  const totalBasPend = basicos.reduce((s, b) => s + (b.real || 0), 0);

  const totalImpPrev = impuestos.filter(i => i.activo).reduce((s, i) => s + (i.previsto || 0), 0);
  const totalImpPend = impuestos.filter(i => i.activo).reduce((s, i) => s + (i.real || 0), 0);

  const totalAscPrev = asceo.reduce((s, a) => s + (a.previsto || 0), 0);
  const totalAscReal = asceo.reduce((s, a) => s + (a.real || 0), 0);

  const totalComprasPrev = semanas.reduce((s, sem) => s + sem.items.reduce((ss, it) => ss + (it.previsto || 0), 0), 0);
  const totalComprasReal = semanas.reduce((s, sem) => s + sem.items.reduce((ss, it) => ss + (it.real || it.previsto || 0), 0), 0);

  const totalTarjetasPrevUYU = tarjetas.filter(t => t.moneda === 'UYU').reduce((s, t) => s + (t.monto || 0), 0);
  const totalTarjetasPendUYU = tarjetas.filter(t => t.moneda === 'UYU' && !t.pagado).reduce((s, t) => s + (t.monto || 0), 0);
  const totalTarjetasPrevUSD = tarjetas.filter(t => t.moneda === 'USD').reduce((s, t) => s + (t.monto || 0), 0);
  const totalTarjetasPendUSD = tarjetas.filter(t => t.moneda === 'USD' && !t.pagado).reduce((s, t) => s + (t.monto || 0), 0);

  const totalGastosPrev = totalBasPrev + totalImpPrev + totalAscPrev + totalComprasPrev + totalTarjetasPrevUYU;
  const totalGastosReal = totalBasPend + totalImpPend + totalAscReal + totalComprasReal + totalTarjetasPrevUYU;

  // Ahorro real = ingresos reales − todos los gastos reales
  const ahorroReal = totalIngReal - totalGastosReal;
  const saldoPct = totalIngReal > 0 ? Math.round((totalGastosPrev / totalIngReal) * 100) : 0;
  const ahorroPct = objetivoAhorro > 0 ? Math.round((ahorroReal / objetivoAhorro) * 100) : 0;

  const chartData = [
    { name: 'Ingresos', prev: totalIngPrev, real: totalIngReal },
    { name: 'Básicos',  prev: totalBasPrev, real: totalBasPend },
    { name: 'Impuestos',prev: totalImpPrev, real: totalImpPend },
    { name: 'Asceo',    prev: totalAscPrev, real: totalAscReal },
    { name: 'Compras',  prev: totalComprasPrev, real: totalComprasReal },
    { name: 'Tarjetas', prev: totalTarjetasPrevUYU, real: totalTarjetasPendUYU },
  ];

  return (
    <div className="section-block">
      <h2 className="section-title">📊 Resumen del Mes</h2>

      {/* Tabla resumen */}
      <div className="resumen-grid">
        <div className="resumen-table-wrap">
          <table className="data-table resumen-table">
            <thead>
              <tr><th>Concepto</th><th>Previsto $</th><th>Real / Pendiente $</th><th>%</th></tr>
            </thead>
            <tbody>
              <tr className="row-ingreso">
                <td>💼 Ingresos</td>
                <td className="total-val pos">${fmt(totalIngPrev)}</td>
                <td className="total-val pos">${fmt(totalIngReal)}</td>
                <td>—</td>
              </tr>
              <tr>
                <td>🏠 Básicos</td>
                <td>${fmt(totalBasPrev)}</td>
                <td className={totalBasPend > 0 ? 'neg' : 'pos'}>${fmt(totalBasPend)}</td>
                <td>{totalIngPrev > 0 ? Math.round(totalBasPrev / totalIngPrev * 100) : 0}%</td>
              </tr>
              <tr>
                <td>🧾 Impuestos</td>
                <td>${fmt(totalImpPrev)}</td>
                <td className={totalImpPend > 0 ? 'neg' : 'pos'}>${fmt(totalImpPend)}</td>
                <td>{totalIngPrev > 0 ? Math.round(totalImpPrev / totalIngPrev * 100) : 0}%</td>
              </tr>
              <tr>
                <td>🧴 Asceo</td>
                <td>${fmt(totalAscPrev)}</td>
                <td>${fmt(totalAscReal)}</td>
                <td>{totalIngPrev > 0 ? Math.round(totalAscPrev / totalIngPrev * 100) : 0}%</td>
              </tr>
              <tr>
                <td>🛒 Compras</td>
                <td>${fmt(totalComprasPrev)}</td>
                <td>${fmt(totalComprasReal)}</td>
                <td>{totalIngPrev > 0 ? Math.round(totalComprasPrev / totalIngPrev * 100) : 0}%</td>
              </tr>
              <tr>
                <td>💳 Tarjetas</td>
                <td>${fmt(totalTarjetasPrevUYU)}{totalTarjetasPrevUSD > 0 && ` + ${fmtUSD(totalTarjetasPrevUSD)}`}</td>
                <td className={totalTarjetasPendUYU > 0 ? 'neg' : 'pos'}>
                  ${fmt(totalTarjetasPendUYU)}{totalTarjetasPendUSD > 0 && ` + ${fmtUSD(totalTarjetasPendUSD)}`}
                </td>
                <td>{totalIngPrev > 0 ? Math.round(totalTarjetasPrevUYU / totalIngPrev * 100) : 0}%</td>
              </tr>
              <tr className="totals-row">
                <td>TOTAL GASTOS</td>
                <td className="neg">${fmt(totalGastosPrev)}</td>
                <td className={totalGastosReal > 0 ? 'neg' : 'pos'}>${fmt(totalGastosReal)}</td>
                <td>{saldoPct}%</td>
              </tr>
              <tr className="row-saldo">
                <td><strong>💰 AHORRO REAL</strong></td>
                <td className={ahorroReal >= 0 ? 'pos' : 'neg'}><strong>${fmt(ahorroReal)}</strong></td>
                <td className={ahorroReal >= 0 ? 'pos' : 'neg'}><strong>${fmt(ahorroReal)}</strong></td>
                <td>{totalIngReal > 0 ? Math.round(ahorroReal / totalIngReal * 100) : 0}%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Gráfico */}
        <div className="resumen-chart">
          <h3 className="chart-label">Previsto vs Real</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 20, left: 0 }} barGap={2}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false}
                tickFormatter={n => Math.abs(n) >= 1000 ? `${(n/1000).toFixed(0)}K` : n} />
              <Tooltip formatter={(v) => `$${fmt(v)}`} contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="prev" name="Previsto" fill="#94a3b8" radius={[3,3,0,0]} maxBarSize={22} />
              <Bar dataKey="real" name="Real/Pendiente" radius={[3,3,0,0]} maxBarSize={22}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={i === 0 ? '#0d9488' : d.real > d.prev ? '#ef4444' : '#0d9488'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Ahorro del mes */}
      <div className="ahorro-block">
        <h3 className="sub-title">💰 Ahorro del mes</h3>
        <div className="ahorro-inputs">
          <div className="credito-item">
            <label>Objetivo de ahorro del mes $</label>
            <input type="number" className="cell-input" value={objetivoAhorro || ''} min="0"
              onChange={e => onChange({ ...mesData, objetivoAhorro: parseFloat(e.target.value) || 0 })}
              placeholder="0" />
          </div>
          <div className="credito-item">
            <label>Ahorro real (calculado)</label>
            <div className={`cell-readonly ${ahorroReal >= 0 ? 'pos' : 'neg'}`}>${fmt(ahorroReal)}</div>
          </div>
        </div>

        <div className="ahorro-total">
          <span>Ingresos reales: <strong className="pos">${fmt(totalIngReal)}</strong></span>
          <span>Gastos reales: <strong className="neg">${fmt(totalGastosReal)}</strong></span>
          <span>Ahorro real: <strong className={ahorroReal >= 0 ? 'pos' : 'neg'}>${fmt(ahorroReal)}</strong></span>
          {objetivoAhorro > 0 && (
            <span>Objetivo: <strong>${fmt(objetivoAhorro)}</strong> — <strong className={ahorroPct >= 100 ? 'pos' : ''}>{ahorroPct}%</strong></span>
          )}
        </div>
        {objetivoAhorro > 0 && (
          <div className="progress-bar big mt8">
            <div className="progress-fill" style={{ width: Math.min(100, ahorroPct) + '%', background: ahorroReal >= objetivoAhorro ? '#0d9488' : '#6366f1' }} />
          </div>
        )}
      </div>
    </div>
  );
}
