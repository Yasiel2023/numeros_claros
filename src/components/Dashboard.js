// src/components/Dashboard.js
import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle, Clock, TrendingUp, TrendingDown, DollarSign, Wallet } from 'lucide-react';
import { MESES_ES } from '../constants';

const fmt = (n) => new Intl.NumberFormat('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);
const fmtUSD = (n) => new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);

export default function Dashboard({ mesData, mes, año, onIrA }) {
  if (!mesData) return <div className="loading-state">Cargando...</div>;

  const {
    ingresos = [], basicos = [], impuestos = [], semanas = [],
    creditoUYU = 0, creditoUSD = 0, metaAhorro = 0, guardado = 0,
  } = mesData;

  // ── Totales ingresos ──
  const totalIngPrev = ingresos.reduce((s, i) => s + (i.previsto || 0), 0);
  const totalIngReal = ingresos.reduce((s, i) => s + (i.real || 0), 0);

  // ── Básicos pendientes ──
  const basicosPend = basicos.filter(b => (b.real || 0) > 0); // real > 0 = aún debe
  const totalBasPrev = basicos.reduce((s, b) => s + (b.previsto || 0), 0);
  const totalBasPend = basicosPend.reduce((s, b) => s + (b.real || 0), 0);

  // ── Impuestos pendientes ──
  const impPend = impuestos.filter(i => i.activo && (i.real || 0) > 0);
  const totalImpPrev = impuestos.filter(i => i.activo).reduce((s, i) => s + (i.previsto || 0), 0);
  const totalImpPend = impPend.reduce((s, i) => s + (i.real || 0), 0);

  // ── Compras semanas ──
  const totalCompras = semanas.reduce((s, sem) => s + sem.items.reduce((ss, it) => ss + (it.real || it.previsto || 0), 0), 0);
  const totalComprasPrev = semanas.reduce((s, sem) => s + sem.items.reduce((ss, it) => ss + (it.previsto || 0), 0), 0);

  // ── Totales generales ──
  const totalGastosPrev = totalBasPrev + totalImpPrev + totalComprasPrev;
  const totalPendiente = totalBasPend + totalImpPend;
  const saldo = totalIngReal - totalGastosPrev - creditoUYU;
  const ahorroPct = metaAhorro > 0 ? Math.min(100, Math.round((guardado / metaAhorro) * 100)) : 0;

  const pendItems = [
    ...basicosPend.map(b => ({ ...b, tipo: 'básico' })),
    ...impPend.map(i => ({ ...i, tipo: 'impuesto' })),
  ].sort((a, b) => (b.real || 0) - (a.real || 0));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard — {MESES_ES[mes]} {año}</h1>
          <p className="page-sub">Resumen general del mes</p>
        </div>
      </div>

      {/* ── CARDS RESUMEN ── */}
      <div className="dash-cards">
        <div className="dash-card green">
          <div className="dc-icon"><TrendingUp size={20}/></div>
          <div className="dc-body">
            <span className="dc-label">Ingresos reales</span>
            <span className="dc-val">${fmt(totalIngReal)}</span>
            <span className="dc-sub">Previsto: ${fmt(totalIngPrev)}</span>
          </div>
        </div>
        <div className="dash-card red">
          <div className="dc-icon"><TrendingDown size={20}/></div>
          <div className="dc-body">
            <span className="dc-label">Gastos previstos</span>
            <span className="dc-val">${fmt(totalGastosPrev)}</span>
            <span className="dc-sub">Básicos + Impuestos + Compras</span>
          </div>
        </div>
        <div className={`dash-card ${saldo >= 0 ? 'teal' : 'orange'}`}>
          <div className="dc-icon"><Wallet size={20}/></div>
          <div className="dc-body">
            <span className="dc-label">Saldo disponible</span>
            <span className="dc-val">${fmt(saldo)}</span>
            <span className="dc-sub">{saldo >= 0 ? 'Para disfrute/ahorro' : '⚠ Déficit'}</span>
          </div>
        </div>
        <div className="dash-card purple">
          <div className="dc-icon"><DollarSign size={20}/></div>
          <div className="dc-body">
            <span className="dc-label">Crédito pendiente</span>
            <span className="dc-val">${fmt(creditoUYU)}</span>
            <span className="dc-sub">USD: {fmtUSD(creditoUSD)}</span>
          </div>
        </div>
      </div>

      {/* ── PAGOS PENDIENTES (prioridad) ── */}
      <div className="section-grid">
        <div className="card pend-card">
          <div className="card-header-row">
            <h2 className="card-title">
              <AlertTriangle size={16} className="icon-warn"/> Pagos pendientes
            </h2>
            <span className="badge-red">${fmt(totalPendiente)}</span>
          </div>

          {pendItems.length === 0 ? (
            <div className="empty-pend">
              <CheckCircle size={32} color="#0d9488"/>
              <p>¡Todo al día! No hay pagos pendientes.</p>
            </div>
          ) : (
            <div className="pend-list">
              {pendItems.map((item, i) => (
                <div key={i} className="pend-item">
                  <div className="pend-info">
                    <span className="pend-name">{item.nombre}</span>
                    <span className={`pend-tipo ${item.tipo === 'básico' ? 'tipo-bas' : 'tipo-imp'}`}>{item.tipo}</span>
                  </div>
                  <div className="pend-montos">
                    <span className="pend-real">${fmt(item.real)}</span>
                    <span className="pend-prev">/ ${fmt(item.previsto)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pend-actions">
            <button className="btn-sm-outline" onClick={() => onIrA('basicos')}>Ver básicos</button>
            <button className="btn-sm-outline" onClick={() => onIrA('impuestos')}>Ver impuestos</button>
          </div>
        </div>

        {/* ── SEMANAS COMPRAS ── */}
        <div className="card">
          <div className="card-header-row">
            <h2 className="card-title">🛒 Compras del mes</h2>
            <span className="badge-teal">${fmt(totalCompras)}</span>
          </div>
          <div className="sem-resumen">
            {semanas.length === 0 ? (
              <p className="empty-txt">No hay semanas configuradas.</p>
            ) : semanas.map((sem, i) => {
              const tot = sem.items.reduce((s, it) => s + (it.real || it.previsto || 0), 0);
              const totPrev = sem.items.reduce((s, it) => s + (it.previsto || 0), 0);
              const pct = totPrev > 0 ? Math.min(100, Math.round((tot / totPrev) * 100)) : 0;
              return (
                <div key={i} className="sem-row">
                  <div className="sem-info">
                    <span className="sem-label">{sem.label}</span>
                    <span className="sem-monto">${fmt(tot)}</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: pct + '%', background: pct > 110 ? '#ef4444' : '#0d9488' }}/>
                  </div>
                  <span className="sem-pct">{pct}%</span>
                </div>
              );
            })}
          </div>
          <button className="btn-sm-outline mt8" onClick={() => onIrA('semanas')}>Ver detalle compras</button>
        </div>
      </div>

      {/* ── AHORRO ── */}
      <div className="card ahorro-card">
        <div className="card-header-row">
          <h2 className="card-title">💰 Meta de ahorro {año}</h2>
          <span className="badge-purple">{ahorroPct}%</span>
        </div>
        <div className="ahorro-body">
          <div className="ahorro-nums">
            <div>
              <span className="an-label">Guardado</span>
              <span className="an-val green">${fmt(guardado)}</span>
            </div>
            <div>
              <span className="an-label">Meta</span>
              <span className="an-val">${fmt(metaAhorro)}</span>
            </div>
            <div>
              <span className="an-label">Resta</span>
              <span className="an-val orange">${fmt(Math.max(0, metaAhorro - guardado))}</span>
            </div>
          </div>
          <div className="progress-bar big">
            <div className="progress-fill" style={{ width: ahorroPct + '%', background: '#6366f1' }}/>
          </div>
        </div>
      </div>
    </div>
  );
}
