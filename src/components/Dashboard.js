// src/components/Dashboard.js
import React from 'react';
import { AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Wallet, DollarSign, Target } from 'lucide-react';
import { MESES_ES } from '../constants';

const fmt    = (n) => new Intl.NumberFormat('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 0, useGrouping: false }).format(n || 0);
const fmtUSD = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n || 0);

export default function Dashboard({ mesData, mes, año, onIrA, grupos = [] }) {
  if (!mesData) return <div className="loading-state">Cargando...</div>;

  const { ingresos = [], gastos = {}, tarjetas = [], objetivoAhorro = 0 } = mesData;

  // ── Ingresos ──────────────────────────────────────────────────
  const totalIngPrev = ingresos.reduce((s, i) => s + (i.previsto || 0), 0);
  const totalIngReal = ingresos.reduce((s, i) => s + (i.real    || 0), 0);

  // ── Helper: aplana periodos → items ──────────────────────────
  const flatItems = (periodos) => {
    if (!periodos || !Array.isArray(periodos) || periodos.length === 0) return [];
    if (typeof periodos[0] === 'object' && 'items' in periodos[0])
      return periodos.flatMap(p => p.items || []);
    return periodos;
  };

  // ── Grupos dinámicos ──────────────────────────────────────────
  const gruposResumen = grupos.map(g => {
    const items    = flatItems(gastos[g.id]);
    const previsto = items.reduce((s, i) => s + (i.previsto || 0), 0);
    const real     = items.filter(i => i.pagado === true).reduce((s, i) => s + (i.real || 0), 0);
    const pend     = items.filter(i => i.pagado !== true && (i.previsto || 0) > 0)
                          .map(i => ({ ...i, tipo: g.nombre, grupoId: g.id, emoji: g.icono || '' }));
    const pct      = previsto > 0 ? Math.min(105, Math.round((real / previsto) * 100)) : 0;
    return { grupo: g, previsto, real, pend, pct };
  });

  // ── Tarjetas ──────────────────────────────────────────────────
  const totalTarjetasPrevUYU = tarjetas.filter(t => t.moneda === 'UYU').reduce((s, t) => s + (t.monto || 0), 0);
  const totalTarjetasRealUYU = tarjetas.filter(t => t.moneda === 'UYU' && t.pagado === true).reduce((s, t) => s + (t.monto || 0), 0);
  const totalTarjetasPendUYU = tarjetas.filter(t => t.moneda === 'UYU' && !t.pagado).reduce((s, t) => s + (t.monto || 0), 0);
  const totalTarjetasPrevUSD = tarjetas.filter(t => t.moneda === 'USD').reduce((s, t) => s + (t.monto || 0), 0);
  const totalTarjetasPendUSD = tarjetas.filter(t => t.moneda === 'USD' && !t.pagado).reduce((s, t) => s + (t.monto || 0), 0);
  const tarjetasPend         = tarjetas.filter(t => !t.pagado && (t.monto || 0) > 0);

  // ── Totales (objetivo como gasto, igual que en Resumen) ──────
  const totalGastosPrev = gruposResumen.reduce((s, g) => s + g.previsto, 0) + totalTarjetasPrevUYU + objetivoAhorro;
  const totalGastosReal = gruposResumen.reduce((s, g) => s + g.real,     0) + totalTarjetasRealUYU + objetivoAhorro;
  const saldoLibrePrev  = totalIngPrev - totalGastosPrev;
  const saldoLibreReal  = totalIngReal - totalGastosReal;

  // ── Pendientes ────────────────────────────────────────────────
  const pendItems = [
    ...gruposResumen.flatMap(g => g.pend),
    ...tarjetasPend.map(t => ({
      nombre: t.nombre, previsto: t.monto, real: t.monto,
      moneda: t.moneda, tipo: 'Tarjeta', emoji: '💳',
    })),
  ].sort((a, b) => (b.previsto || 0) - (a.previsto || 0));

  const totalPendiente = pendItems.reduce((s, i) => s + (i.previsto || 0), 0);

  // ── Progreso objetivo ─────────────────────────────────────────
  const ahorroNeto = totalIngReal - gruposResumen.reduce((s, g) => s + g.real, 0) - totalTarjetasRealUYU;
  const ahorroPct  = objetivoAhorro > 0 ? Math.round((ahorroNeto / objetivoAhorro) * 100) : 0;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">📋 Dashboard — {MESES_ES[mes]} {año}</h1>
          <p className="page-sub">Resumen general del mes</p>
        </div>
      </div>

      {/* ── CARDS RESUMEN ── */}
      <div className="dash-cards">

        <div className="dash-card green">
          <div className="dc-icon"><TrendingUp size={20}/></div>
          <div className="dc-body">
            <span className="dc-label">Ingresos</span>
            <span className="dc-val">${fmt(totalIngReal)}</span>
            <span className="dc-sub">Previsto: ${fmt(totalIngPrev)}</span>
          </div>
        </div>

        <div className="dash-card red">
          <div className="dc-icon"><TrendingDown size={20}/></div>
          <div className="dc-body">
            <span className="dc-label">Gastos previstos</span>
            <span className="dc-val">${fmt(totalGastosPrev)}</span>
            <span className="dc-sub">Real pagado: ${fmt(totalGastosReal)}</span>
          </div>
        </div>

        <div className={`dash-card ${saldoLibreReal >= 0 ? 'teal' : 'orange'}`}>
          <div className="dc-icon"><Wallet size={20}/></div>
          <div className="dc-body">
            <span className="dc-label">Saldo libre</span>
            <span className="dc-val">${fmt(saldoLibreReal)}</span>
            <span className="dc-sub">Presupuestado: ${fmt(saldoLibrePrev)}</span>
          </div>
        </div>

        <div className="dash-card purple">
          <div className="dc-icon"><DollarSign size={20}/></div>
          <div className="dc-body">
            <span className="dc-label">Tarjetas pendientes</span>
            <span className="dc-val">${fmt(totalTarjetasPendUYU)}</span>
            {totalTarjetasPendUSD > 0
              ? <span className="dc-sub">+ {fmtUSD(totalTarjetasPendUSD)}</span>
              : <span className="dc-sub">{tarjetasPend.length} de {tarjetas.length} pendiente{tarjetasPend.length !== 1 ? 's' : ''}</span>
            }
          </div>
        </div>

      </div>

      {/* ── GRID: PENDIENTES + GRUPOS ── */}
      <div className="section-grid">

        {/* Pagos pendientes */}
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
              {pendItems.slice(0, 8).map((item, i) => (
                <div key={i} className="pend-item"
                  onClick={() => item.grupoId && onIrA(`grupo_${item.grupoId}`)}
                  style={{ cursor: item.grupoId ? 'pointer' : 'default' }}>
                  <div className="pend-info">
                    <span className="pend-name">{item.emoji ? `${item.emoji} ` : ''}{item.nombre}</span>
                    <span className="pend-tipo">{item.tipo}</span>
                  </div>
                  <div className="pend-montos">
                    <span className="pend-real">
                      {item.moneda === 'USD' ? fmtUSD(item.previsto) : `$${fmt(item.previsto)}`}
                    </span>
                  </div>
                </div>
              ))}
              {pendItems.length > 8 && (
                <p className="pend-more">+{pendItems.length - 8} más pendientes</p>
              )}
            </div>
          )}

          <div className="pend-actions">
            {grupos.slice(0, 3).map(g => (
              <button key={g.id} className="btn-sm-outline" onClick={() => onIrA(`grupo_${g.id}`)}>
                {g.icono || ''} {g.nombre}
              </button>
            ))}
            <button className="btn-sm-outline" onClick={() => onIrA('tarjetas')}>💳 Tarjetas</button>
          </div>
        </div>

        {/* Progreso por grupos */}
        <div className="card">
          <div className="card-header-row">
            <h2 className="card-title">📂 Avance por grupos</h2>
            <span className="badge-teal">${fmt(gruposResumen.reduce((s, g) => s + g.real, 0))}</span>
          </div>
          <div className="sem-resumen">
            {gruposResumen.length === 0 ? (
              <p className="empty-txt">No hay grupos configurados.</p>
            ) : gruposResumen.map(({ grupo, previsto, real, pct }) => (
              <div key={grupo.id} className="sem-row" style={{ cursor: 'pointer' }}
                onClick={() => onIrA(`grupo_${grupo.id}`)}>
                <div className="sem-info">
                  <span className="sem-label">{grupo.icono ? `${grupo.icono} ` : ''}{grupo.nombre}</span>
                  <span className="sem-monto">
                    ${fmt(real)} <small style={{ color: '#94a3b8' }}>/ ${fmt(previsto)}</small>
                  </span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{
                    width: pct + '%',
                    background: pct > 100 ? '#ef4444' : pct > 80 ? '#d97706' : '#0d9488',
                  }}/>
                </div>
                <span className="sem-pct">{pct}%</span>
              </div>
            ))}
            {totalTarjetasPrevUYU > 0 && (() => {
              const pct = totalTarjetasPrevUYU > 0
                ? Math.min(105, Math.round(totalTarjetasRealUYU / totalTarjetasPrevUYU * 100))
                : 0;
              return (
                <div className="sem-row" style={{ cursor: 'pointer' }} onClick={() => onIrA('tarjetas')}>
                  <div className="sem-info">
                    <span className="sem-label">💳 Tarjetas</span>
                    <span className="sem-monto">
                      ${fmt(totalTarjetasRealUYU)} <small style={{ color: '#94a3b8' }}>/ ${fmt(totalTarjetasPrevUYU)}</small>
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: pct + '%', background: '#6366f1' }}/>
                  </div>
                  <span className="sem-pct">{pct}%</span>
                </div>
              );
            })()}
          </div>
          <button className="btn-sm-outline mt8" onClick={() => onIrA('resumen')}>
            Ver resumen completo →
          </button>
        </div>

      </div>

      {/* ── OBJETIVO DE AHORRO ── */}
      <div className="card ahorro-card">
        <div className="card-header-row">
          <h2 className="card-title"><Target size={16}/> Objetivo de ahorro</h2>
          {objetivoAhorro > 0 && (
            <span className={`badge-${ahorroNeto >= objetivoAhorro ? 'teal' : 'purple'}`}>
              {ahorroPct}%
            </span>
          )}
        </div>
        <div className="ahorro-body">
          <div className="ahorro-nums">
            <div>
              <span className="an-label">Separado para ahorro</span>
              <span className={`an-val ${ahorroNeto >= 0 ? 'green' : 'orange'}`}>${fmt(ahorroNeto)}</span>
            </div>
            {objetivoAhorro > 0 ? (
              <>
                <div>
                  <span className="an-label">Objetivo del mes</span>
                  <span className="an-val">${fmt(objetivoAhorro)}</span>
                </div>
                <div>
                  <span className="an-label">{ahorroNeto >= objetivoAhorro ? '✓ Superado en' : 'Faltan'}</span>
                  <span className={`an-val ${ahorroNeto >= objetivoAhorro ? 'green' : 'orange'}`}>
                    ${fmt(Math.abs(objetivoAhorro - ahorroNeto))}
                  </span>
                </div>
                <div>
                  <span className="an-label">💵 Saldo libre</span>
                  <span className={`an-val ${saldoLibreReal >= 0 ? 'green' : 'orange'}`}>${fmt(saldoLibreReal)}</span>
                </div>
              </>
            ) : (
              <div>
                <span className="an-label" style={{ color: '#94a3b8' }}>Sin objetivo fijado este mes</span>
                <button className="btn-sm-outline" style={{ marginTop: 6 }} onClick={() => onIrA('resumen')}>
                  Fijar objetivo →
                </button>
              </div>
            )}
          </div>
          {objetivoAhorro > 0 && (
            <div className="progress-bar big">
              <div className="progress-fill" style={{
                width: Math.min(100, ahorroPct) + '%',
                background: ahorroNeto >= objetivoAhorro ? '#0d9488' : '#6366f1',
              }}/>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}