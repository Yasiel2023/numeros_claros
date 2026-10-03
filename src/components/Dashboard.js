// src/components/Dashboard.js
import React from 'react';
import { money, moneyDe, esSecundaria, monedaSecundaria } from '../moneda';
import Icono, { IconoCategoria, estiloCategoria } from '../iconos';
import { MESES_ES } from '../constants';
import { pagadoTarjeta, saldoTarjeta, idsCredito, cuentaComoGastoReal, previstoPropioTarjeta } from '../tarjetas';

// ── Helper: aplana periodos → items ──────────────────────────
const flatItems = (periodos) => {
  if (!periodos || !Array.isArray(periodos) || periodos.length === 0) return [];
  if (typeof periodos[0] === 'object' && 'items' in periodos[0])
    return periodos.flatMap(p => p.items || []);
  return periodos;
};

// Previsto, real y pendientes de cada grupo. También lo usa la lista de Gastos del celular.
// Lo cargado a una tarjeta de credito no cuenta como gasto real hasta pagar la tarjeta.
export function resumenGrupos(mesData, grupos = []) {
  const { gastos = {}, tarjetas = [] } = mesData || {};
  const idsCred = idsCredito(tarjetas);
  return grupos.map(g => {
    const items    = flatItems(gastos[g.id]);
    const previsto = items.reduce((s, i) => s + (i.previsto || 0), 0);
    const real     = items.filter(i => cuentaComoGastoReal(i, idsCred)).reduce((s, i) => s + (i.real || 0), 0);
    const pend     = items.filter(i => i.pagado !== true && (i.previsto || 0) > 0)
                          .map(i => ({ ...i, tipo: g.nombre, grupoId: g.id }));
    const pct      = previsto > 0 ? Math.min(105, Math.round((real / previsto) * 100)) : 0;
    return { grupo: g, previsto, real, pend, pct };
  });
}

export default function Dashboard({ mesData, mes, año, onIrA, grupos = [], onTicket }) {
  if (!mesData) return <div className="loading-state">Cargando...</div>;

  // Acceso rápido "Carrito": la primera categoría semanal (normalmente Supermercado)
  const grupoCarrito = grupos.find(g => g.frecuencia === 'semanal' || g.tipo === 'semanas');

  const { ingresos = [], gastos = {}, tarjetas = [], objetivoAhorro = 0 } = mesData;

  // ── Ingresos ──────────────────────────────────────────────────
  const totalIngPrev = ingresos.reduce((s, i) => s + (i.previsto || 0), 0);
  const totalIngReal = ingresos.reduce((s, i) => s + (i.real    || 0), 0);

  // ── Grupos dinámicos ──────────────────────────────────────────
  const gruposResumen = resumenGrupos(mesData, grupos);

  // ── Tarjetas ──────────────────────────────────────────────────
  const soloCredito = tarjetas.filter(t => t.tipo !== 'debito');
  // Previsto propio: cuotas + cargos. Los gastos cargados ya estan previstos en su grupo.
  const totalTarjetasPrevUYU = soloCredito.filter(t => !esSecundaria(t.moneda))
    .reduce((s, t) => s + previstoPropioTarjeta(t, gastos), 0);
  const totalTarjetasRealUYU = soloCredito.filter(t => !esSecundaria(t.moneda)).reduce((s, t) => s + pagadoTarjeta(t), 0);
  const totalTarjetasPendUYU = soloCredito.filter(t => !esSecundaria(t.moneda)).reduce((s, t) => s + saldoTarjeta(t), 0);
  const totalTarjetasPendUSD = soloCredito.filter(t => esSecundaria(t.moneda)).reduce((s, t) => s + saldoTarjeta(t), 0);
  const tarjetasPend         = soloCredito.filter(t => saldoTarjeta(t) > 0);

  // ── Totales (objetivo como gasto, igual que en Resumen) ──────
  const totalGastosPrev = gruposResumen.reduce((s, g) => s + g.previsto, 0) + totalTarjetasPrevUYU + objetivoAhorro;
  const totalGastosReal = gruposResumen.reduce((s, g) => s + g.real,     0) + totalTarjetasRealUYU + objetivoAhorro;
  const saldoLibrePrev  = totalIngPrev - totalGastosPrev;
  const saldoLibreReal  = totalIngReal - totalGastosReal;

  // ── Pendientes ────────────────────────────────────────────────
  const pendItems = [
    ...gruposResumen.flatMap(g => g.pend),
    ...tarjetasPend.map(t => ({
      nombre: t.nombre, previsto: saldoTarjeta(t), real: saldoTarjeta(t),
      moneda: t.moneda, tipo: 'Tarjeta',
    })),
  ].sort((a, b) => (b.previsto || 0) - (a.previsto || 0));

  const totalPendiente = pendItems.reduce((s, i) => s + (i.previsto || 0), 0);

  // ── Progreso objetivo ─────────────────────────────────────────
  const ahorroNeto = totalIngReal - gruposResumen.reduce((s, g) => s + g.real, 0) - totalTarjetasRealUYU;
  const ahorroPct  = objetivoAhorro > 0 ? Math.round((ahorroNeto / objetivoAhorro) * 100) : 0;

  return (
    <div className="page">
      <div className="page-header page-header--escritorio">
        <div>
          <h1 className="page-title">Inicio — {MESES_ES[mes]} {año}</h1>
          <p className="page-sub">Resumen general del mes</p>
        </div>
      </div>

      {/* ── HERO (solo celular): lo que queda libre del mes ── */}
      {(() => {
        const usado = totalGastosPrev > 0 ? Math.min(100, Math.round(totalGastosReal / totalGastosPrev * 100)) : 0;
        return (
          <div className="movil-inicio">
            <div className="dash-hero">
              <span className="dh-label">Saldo libre del mes</span>
              <span className={`dh-val ${saldoLibreReal < 0 ? 'neg' : ''}`}>{money(saldoLibreReal)}</span>
              <div className="dh-bar"><div style={{ width: usado + '%' }} /></div>
              <span className="dh-sub">Gastaste el {usado}% de lo previsto</span>
              <div className="dh-nums">
                <button onClick={() => onIrA('ingresos')}><span>Ingresos</span><strong>{money(totalIngReal)}</strong></button>
                <button onClick={() => onIrA('gastos')}><span>Gastado</span><strong>{money(totalGastosReal)}</strong></button>
                <button onClick={() => onIrA('resumen')}><span>Ahorro</span><strong>{money(objetivoAhorro)}</strong></button>
              </div>
            </div>

            <div className="dh-accesos">
              {onTicket && (
                <button onClick={onTicket}><span><Icono nombre="camara" size={22} /></span>Ticket</button>
              )}
              <button onClick={() => onIrA('gastos')}><span><Icono nombre="pagar" size={22} /></span>Pagar</button>
              {grupoCarrito && (
                <button onClick={() => onIrA(`grupo_${grupoCarrito.id}`)}>
                  <span className="violeta"><Icono nombre="carrito" size={22} /></span>Carrito
                </button>
              )}
              <button onClick={() => onIrA('chat')}><span><Icono nombre="chat" size={22} /></span>Preguntar</button>
            </div>

            <div className="dh-pend">
              <div className="dh-pend-cab">
                <h2>Pendientes</h2>
                <button onClick={() => onIrA('gastos')}>Ver todo · {pendItems.length}</button>
              </div>
              {pendItems.length === 0 ? (
                <div className="dh-pend-lista"><p className="dh-pend-vacio">Todo al día, no hay pagos pendientes.</p></div>
              ) : (
                <div className="dh-pend-lista">
                  {pendItems.slice(0, 5).map((item, i) => (
                    <button key={i} className="dh-pend-item"
                      onClick={() => onIrA(item.grupoId ? `grupo_${item.grupoId}` : 'tarjetas')}>
                      <IconoCategoria grupo={{ id: item.grupoId || 'tarjeta', nombre: item.tipo }} size={38} />
                      <span className="dh-pend-txt">
                        <strong>{item.nombre}</strong>
                        <small>{item.tipo}</small>
                      </span>
                      <span className="dh-pend-monto">{moneyDe(item.previsto, item.moneda)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── CARDS RESUMEN ── */}
      <div className="dash-cards">

        <div className="dash-card green">
          <div className="dc-icon"><Icono nombre="ingresos" size={20}/></div>
          <div className="dc-body">
            <span className="dc-label">Ingresos</span>
            <span className="dc-val">{money(totalIngReal)}</span>
            <span className="dc-sub">Previsto: {money(totalIngPrev)}</span>
          </div>
        </div>

        <div className="dash-card red">
          <div className="dc-icon"><Icono nombre="gastos" size={20}/></div>
          <div className="dc-body">
            <span className="dc-label">Gastos previstos</span>
            <span className="dc-val">{money(totalGastosPrev)}</span>
            <span className="dc-sub">Real pagado: {money(totalGastosReal)}</span>
          </div>
        </div>

        <div className={`dash-card ${saldoLibreReal >= 0 ? 'teal' : 'orange'}`}>
          <div className="dc-icon"><Icono nombre="efectivo" size={20}/></div>
          <div className="dc-body">
            <span className="dc-label">Saldo libre</span>
            <span className="dc-val">{money(saldoLibreReal)}</span>
            <span className="dc-sub">Presupuestado: {money(saldoLibrePrev)}</span>
          </div>
        </div>

        <div className="dash-card purple">
          <div className="dc-icon"><Icono nombre="tarjeta" size={20}/></div>
          <div className="dc-body">
            <span className="dc-label">Tarjetas pendientes</span>
            <span className="dc-val">{money(totalTarjetasPendUYU)}</span>
            {totalTarjetasPendUSD > 0
              ? <span className="dc-sub">+ {moneyDe(totalTarjetasPendUSD, monedaSecundaria())}</span>
              : <span className="dc-sub">{tarjetasPend.length} de {soloCredito.length} pendiente{tarjetasPend.length !== 1 ? 's' : ''}</span>
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
              <Icono nombre="calendario" size={17} className="icon-warn"/> Pagos pendientes
            </h2>
            <span className="badge-red">{money(totalPendiente)}</span>
          </div>

          {pendItems.length === 0 ? (
            <div className="empty-pend">
              <Icono nombre="pagar" size={32} color="#0d9488"/>
              <p>¡Todo al día! No hay pagos pendientes.</p>
            </div>
          ) : (
            <div className="pend-list">
              {pendItems.slice(0, 8).map((item, i) => (
                <div key={i} className="pend-item"
                  onClick={() => item.grupoId && onIrA(`grupo_${item.grupoId}`)}
                  style={{ cursor: item.grupoId ? 'pointer' : 'default' }}>
                  <IconoCategoria grupo={{ id: item.grupoId || 'tarjeta', nombre: item.tipo }} size={32} />
                  <div className="pend-info">
                    <span className="pend-name">{item.nombre}</span>
                    <span className="pend-tipo">{item.tipo}</span>
                  </div>
                  <div className="pend-montos">
                    <span className="pend-real">
                      {moneyDe(item.previsto, item.moneda)}
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
                <Icono nombre={estiloCategoria(g).icono} size={15} /> {g.nombre}
              </button>
            ))}
            <button className="btn-sm-outline" onClick={() => onIrA('tarjetas')}><Icono nombre="tarjeta" size={15} /> Tarjetas</button>
          </div>
        </div>

        {/* Progreso por grupos */}
        <div className="card">
          <div className="card-header-row">
            <h2 className="card-title"><Icono nombre="resumen" size={17} /> Avance por grupos</h2>
            <span className="badge-teal">{money(gruposResumen.reduce((s, g) => s + g.real, 0))}</span>
          </div>
          <div className="sem-resumen">
            {gruposResumen.length === 0 ? (
              <p className="empty-txt">No hay grupos configurados.</p>
            ) : gruposResumen.map(({ grupo, previsto, real, pct }) => (
              <div key={grupo.id} className="sem-row" style={{ cursor: 'pointer' }}
                onClick={() => onIrA(`grupo_${grupo.id}`)}>
                <div className="sem-info">
                  <span className="sem-label"><IconoCategoria grupo={grupo} size={26} /> {grupo.nombre}</span>
                  <span className="sem-monto">
                    {money(real)} <small style={{ color: '#94a3b8' }}>/ {money(previsto)}</small>
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
                    <span className="sem-label"><IconoCategoria grupo={{ id: 'tarjeta', nombre: 'Tarjetas' }} size={26} /> Tarjetas</span>
                    <span className="sem-monto">
                      {money(totalTarjetasRealUYU)} <small style={{ color: '#94a3b8' }}>/ {money(totalTarjetasPrevUYU)}</small>
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
          <h2 className="card-title"><Icono nombre="ahorro" size={17}/> Objetivo de ahorro</h2>
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
              <span className={`an-val ${ahorroNeto >= 0 ? 'green' : 'orange'}`}>{money(ahorroNeto)}</span>
            </div>
            {objetivoAhorro > 0 ? (
              <>
                <div>
                  <span className="an-label">Objetivo del mes</span>
                  <span className="an-val">{money(objetivoAhorro)}</span>
                </div>
                <div>
                  <span className="an-label">{ahorroNeto >= objetivoAhorro ? 'Superado en' : 'Faltan'}</span>
                  <span className={`an-val ${ahorroNeto >= objetivoAhorro ? 'green' : 'orange'}`}>
                    {money(Math.abs(objetivoAhorro - ahorroNeto))}
                  </span>
                </div>
                <div>
                  <span className="an-label">Saldo libre</span>
                  <span className={`an-val ${saldoLibreReal >= 0 ? 'green' : 'orange'}`}>{money(saldoLibreReal)}</span>
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