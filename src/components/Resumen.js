// src/components/Resumen.js
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const fmt = (n) => new Intl.NumberFormat('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);
const fmtUSD = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n || 0);

export default function Resumen({ mesData, onChange }) {
  if (!mesData) return null;

  const {
    ingresos = [], basicos = [], impuestos = [], semanas = [], asceo = [],
    creditoUYU = 0, creditoUSD = 0,
    metaAhorro = 0, guardado = 0,
    guardadoMesAnterior = 0,
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

  const totalGastosPrev = totalBasPrev + totalImpPrev + totalAscPrev + totalComprasPrev;
  const totalGastosReal = totalBasPend + totalImpPend + totalAscReal + totalComprasReal;

  const saldo = totalIngReal - totalGastosPrev - creditoUYU;
  const saldoPct = totalIngReal > 0 ? Math.round((totalGastosPrev / totalIngReal) * 100) : 0;

  const chartData = [
    { name: 'Ingresos', prev: totalIngPrev, real: totalIngReal },
    { name: 'Básicos',  prev: totalBasPrev, real: totalBasPend },
    { name: 'Impuestos',prev: totalImpPrev, real: totalImpPend },
    { name: 'Asceo',    prev: totalAscPrev, real: totalAscReal },
    { name: 'Compras',  prev: totalComprasPrev, real: totalComprasReal },
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
              <tr className="totals-row">
                <td>TOTAL GASTOS</td>
                <td className="neg">${fmt(totalGastosPrev)}</td>
                <td className={totalGastosReal > 0 ? 'neg' : 'pos'}>${fmt(totalGastosReal)}</td>
                <td>{saldoPct}%</td>
              </tr>
              <tr className="row-saldo">
                <td><strong>SALDO LIBRE</strong></td>
                <td className={saldo >= 0 ? 'pos' : 'neg'} colSpan={2}><strong>${fmt(saldo)}</strong></td>
                <td>{totalIngReal > 0 ? Math.round(saldo / totalIngReal * 100) : 0}%</td>
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

      {/* Crédito */}
      <div className="credito-block">
        <h3 className="sub-title">💳 Crédito pendiente</h3>
        <div className="credito-row">
          <div className="credito-item">
            <label>Deuda tarjeta UYU $</label>
            <input type="number" className="cell-input" value={creditoUYU || ''} min="0"
              onChange={e => onChange({ ...mesData, creditoUYU: parseFloat(e.target.value) || 0 })}
              placeholder="0" />
          </div>
          <div className="credito-item">
            <label>Deuda tarjeta USD $</label>
            <input type="number" className="cell-input" value={creditoUSD || ''} min="0" step="0.01"
              onChange={e => onChange({ ...mesData, creditoUSD: parseFloat(e.target.value) || 0 })}
              placeholder="0.00" />
            <span className="usd-label">{fmtUSD(creditoUSD)}</span>
          </div>
        </div>
      </div>

      {/* Guardado / Ahorro */}
      <div className="ahorro-block">
        <h3 className="sub-title">💰 Ahorro y Meta</h3>
        <div className="ahorro-inputs">
          <div className="credito-item">
            <label>Meta ahorro anual $</label>
            <input type="number" className="cell-input" value={metaAhorro || ''} min="0"
              onChange={e => onChange({ ...mesData, metaAhorro: parseFloat(e.target.value) || 0 })}
              placeholder="0" />
          </div>
          <div className="credito-item">
            <label>Guardado mes anterior $</label>
            <input type="number" className="cell-input" value={guardadoMesAnterior || ''} min="0"
              onChange={e => onChange({ ...mesData, guardadoMesAnterior: parseFloat(e.target.value) || 0 })}
              placeholder="0" />
          </div>
          <div className="credito-item">
            <label>Guardado este mes $</label>
            <input type="number" className="cell-input" value={guardado || ''} min="0"
              onChange={e => onChange({ ...mesData, guardado: parseFloat(e.target.value) || 0 })}
              placeholder="0" />
          </div>
        </div>

        <div className="ahorro-total">
          <span>Total acumulado: <strong className="pos">${fmt(guardadoMesAnterior + guardado)}</strong></span>
          {metaAhorro > 0 && (
            <>
              <span>Meta: <strong>${fmt(metaAhorro)}</strong></span>
              <span>Progreso: <strong className={guardadoMesAnterior + guardado >= metaAhorro ? 'pos' : ''}>{Math.min(100, Math.round((guardadoMesAnterior + guardado) / metaAhorro * 100))}%</strong></span>
            </>
          )}
        </div>
        {metaAhorro > 0 && (
          <div className="progress-bar big mt8">
            <div className="progress-fill" style={{ width: Math.min(100, Math.round((guardadoMesAnterior + guardado) / metaAhorro * 100)) + '%', background: '#6366f1' }} />
          </div>
        )}
      </div>
    </div>
  );
}
