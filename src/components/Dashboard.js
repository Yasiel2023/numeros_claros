// src/components/Dashboard.js
import React, { useState } from 'react';
import { money, moneyDe, esSecundaria, monedaSecundaria } from '../moneda';
import Icono, { IconoCategoria } from '../iconos';
import { MESES_ES } from '../constants';
import { HojaPagar } from './GrupoGastosMovil';
import { pagadoTarjeta, saldoTarjeta, idsCredito, cuentaComoGastoReal, previstoPropioTarjeta } from '../tarjetas';

// ── Helper: aplana periodos → items ──────────────────────────
const esFormatoPeriodos = (periodos) =>
  Array.isArray(periodos) && periodos.length > 0 && typeof periodos[0] === 'object' && periodos[0] !== null && 'items' in periodos[0];
const flatItems = (periodos) => {
  if (!periodos || !Array.isArray(periodos) || periodos.length === 0) return [];
  if (esFormatoPeriodos(periodos))
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
    // pIdx/iIdx: dónde está cada pendiente, para pagarlo desde Inicio (items planos = un solo período)
    const periodos = esFormatoPeriodos(gastos[g.id]) ? gastos[g.id] : [{ items: items }];
    const pend     = periodos.flatMap((p, pIdx) => (p?.items || []).map((i, iIdx) => ({ ...i, pIdx, iIdx })))
                          .filter(i => i.pagado !== true && (i.previsto || 0) > 0)
                          .map(i => ({ ...i, tipo: g.nombre, grupoId: g.id }));
    const pct      = previsto > 0 ? Math.min(105, Math.round((real / previsto) * 100)) : 0;
    return { grupo: g, previsto, real, pend, pct };
  });
}

export default function Dashboard({ mesData, mes, año, onIrA, grupos = [], onTicket, onPagarItem, nombre = '' }) {
  const [pagando, setPagando] = useState(null); // pendiente que se está pagando desde Inicio
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

  // ── Datos del Inicio de la computadora ───────────────────────
  const usado = totalGastosPrev > 0 ? Math.min(100, Math.round(totalGastosReal / totalGastosPrev * 100)) : 0;
  const hoy = new Date();
  const diasRestantes = hoy.getFullYear() === año && hoy.getMonth() === mes
    ? new Date(año, mes + 1, 0).getDate() - hoy.getDate() : null;
  const tarjetaPrincipal = [...tarjetasPend].sort((x, y) => saldoTarjeta(y) - saldoTarjeta(x))[0] || null;
  const carritoTotal = Object.values(gastos).flatMap(ps => Array.isArray(ps) ? ps.flatMap(p => (p && p.items) || []) : [])
    .filter(i => i && i.pagado !== true && i.enCarrito === true)
    .reduce((acc, i) => ({ cantidad: acc.cantidad + 1, monto: acc.monto + (i.real !== undefined ? (i.real || 0) : (i.previsto || 0)) }), { cantidad: 0, monto: 0 });
  const ultimosTickets = [...(mesData.comprobantes || [])].sort((x, y) => String(y.fecha).localeCompare(String(x.fecha))).slice(0, 3);
  const fechaCorta = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; };


  return (
    <div className="page">
      {/* ── HERO (solo celular): lo que queda libre del mes ── */}
      {(() => {
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

      {/* ── COMPUTADORA (prototipo web) ── */}
      <div className="dw">
        <div className="web-cab">
          <div>
            <span className="web-sub">Hola, {nombre}{diasRestantes !== null && <> · {diasRestantes === 0 ? 'hoy termina el mes' : `faltan ${diasRestantes} día${diasRestantes !== 1 ? 's' : ''} para fin de mes`}</>}</span>
            <h1 className="web-h1">{MESES_ES[mes]} {año}</h1>
          </div>
          <div className="dw-cab-acciones">
            <button className="dw-preguntar" onClick={() => onIrA('chat')}>
              <Icono nombre="chat" size={18} /> Preguntale a la IA: “¿cuánto gasté en el súper?”
            </button>
            {onTicket && (
              <button className="dw-btn-oscuro" onClick={onTicket}><Icono nombre="camara" size={18} /> Cargar ticket</button>
            )}
          </div>
        </div>

        <div className="dw-kpis">
          <div className="dw-kpi hero">
            <span>Saldo libre del mes</span>
            <strong className={saldoLibreReal < 0 ? 'neg' : ''}>{money(saldoLibreReal)}</strong>
            <div className="dh-bar"><div style={{ width: usado + '%' }} /></div>
            <small>Gastaste el {usado}% de lo previsto · presupuestado {money(saldoLibrePrev)}</small>
          </div>
          <button className="dw-kpi" onClick={() => onIrA('ingresos')}>
            <span>Ingresos</span>
            <strong>{money(totalIngReal)}</strong>
            <small className={totalIngReal >= totalIngPrev && totalIngPrev > 0 ? 'verde' : ''}>
              {totalIngPrev > 0 && totalIngReal >= totalIngPrev ? 'Todo cobrado' : `de ${money(totalIngPrev)} previsto`}
            </small>
          </button>
          <button className="dw-kpi" onClick={() => onIrA('resumen')}>
            <span>Gastado</span>
            <strong>{money(totalGastosReal)}</strong>
            <small>de {money(totalGastosPrev)} previsto</small>
          </button>
          <button className="dw-kpi" onClick={() => onIrA('gastos')}>
            <span>Pendiente de pago</span>
            <strong className="rojo">{money(totalPendiente)}</strong>
            <small>{pendItems.length} gasto{pendItems.length !== 1 ? 's' : ''}{totalTarjetasPendUYU > 0 && <> · tarjetas {money(totalTarjetasPendUYU)}</>}{totalTarjetasPendUSD > 0 && <> + {moneyDe(totalTarjetasPendUSD, monedaSecundaria())}</>}</small>
          </button>
        </div>

        <div className="dw-grid">
          <section className="dw-panel">
            <div className="dw-panel-cab">
              <h2>Pendientes</h2>
              <button className="dw-link" onClick={() => onIrA('gastos')}>Ver los {pendItems.length}</button>
            </div>
            {pendItems.length === 0 ? (
              <p className="dw-vacio"><Icono nombre="pagar" size={20} color="var(--teal)" /> Todo al día, no hay pagos pendientes.</p>
            ) : (
              <div className="dw-pend">
                {pendItems.slice(0, 7).map((item, i) => (
                  <div key={i} className="dw-pend-item">
                    <IconoCategoria grupo={{ id: item.grupoId || 'tarjeta', nombre: item.tipo }} size={36} />
                    <button className="dw-pend-txt" onClick={() => onIrA(item.grupoId ? `grupo_${item.grupoId}` : 'tarjetas')}>
                      <strong>{item.nombre}</strong>
                      <small>{item.grupoId ? item.tipo : 'Tarjeta de crédito'}</small>
                    </button>
                    <span className="dw-pend-monto">{moneyDe(item.previsto, item.moneda)}</span>
                    <button className="ggw-estado-btn verde"
                      onClick={() => (item.grupoId && onPagarItem ? setPagando(item) : onIrA(item.grupoId ? `grupo_${item.grupoId}` : 'tarjetas'))}>
                      Pagar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="dw-panel">
            <div className="dw-panel-cab">
              <h2>Avance por categoría</h2>
              <button className="dw-link" onClick={() => onIrA('gastos')}>Gastos</button>
            </div>
            <div className="dw-avance">
              {gruposResumen.length === 0 && <p className="dw-vacio">No hay categorías configuradas.</p>}
              {gruposResumen.map(({ grupo, previsto, real, pct }) => (
                <button key={grupo.id} className="dw-avance-item" onClick={() => onIrA(`grupo_${grupo.id}`)}>
                  <span className="dw-avance-fila">
                    <span className="dw-avance-nombre"><IconoCategoria grupo={grupo} size={26} /> {grupo.nombre}</span>
                    <span className={previsto > 0 && real > previsto ? 'rojo' : ''}>{money(real)} / {money(previsto)}</span>
                  </span>
                  <span className="gl-barra grande">
                    <span style={{
                      width: Math.min(100, pct) + '%',
                      background: pct > 100 ? 'var(--red)' : pct > 80 ? 'var(--orange)' : 'var(--teal)',
                    }} />
                  </span>
                </button>
              ))}
            </div>
            {carritoTotal.cantidad > 0 && grupoCarrito && (
              <button className="dw-carrito" onClick={() => onIrA(`grupo_${grupoCarrito.id}`)}>
                <Icono nombre="carrito" size={18} />
                {carritoTotal.cantidad} producto{carritoTotal.cantidad !== 1 ? 's' : ''} en el carrito · {money(carritoTotal.monto)}
              </button>
            )}
          </section>

          <div className="dw-col">
            {tarjetaPrincipal ? (
              <button className="dw-tarjeta" onClick={() => onIrA('tarjetas')}>
                <span className="dw-tarjeta-cab"><strong>{tarjetaPrincipal.nombre}</strong><small>Crédito</small></span>
                <small>Saldo a pagar</small>
                <strong className="dw-tarjeta-monto">{moneyDe(saldoTarjeta(tarjetaPrincipal), tarjetaPrincipal.moneda)}</strong>
                <span className="dw-tarjeta-link">Ver tarjetas y cuotas</span>
              </button>
            ) : (
              <button className="dw-panel dw-tarjeta-vacia" onClick={() => onIrA('tarjetas')}>
                <Icono nombre="tarjeta" size={20} /> Sin deuda de tarjetas este mes
              </button>
            )}
            <section className="dw-panel dw-tickets">
              <h2>Últimos tickets</h2>
              {ultimosTickets.length === 0 && <p className="dw-vacio">Todavía no cargaste tickets este mes.</p>}
              {ultimosTickets.map((t, i) => (
                <button key={t.id || i} className="dw-ticket" onClick={() => onIrA('comprobantes')}>
                  <span><strong>{t.tienda || 'Comprobante'}</strong><small>{fechaCorta(t.fecha)} · {(t.items || []).length} productos</small></span>
                  <strong>{money(t.totalPagado || 0)}</strong>
                </button>
              ))}
              {onTicket && <button className="dw-cargar" onClick={onTicket}>Cargar un ticket</button>}
            </section>
          </div>
        </div>
      </div>

      {pagando && (
        <HojaPagar
          item={pagando}
          grupoNombre={pagando.tipo}
          tarjetas={tarjetas}
          onClose={() => setPagando(null)}
          onConfirmar={(tarjetaId, monto) => {
            onPagarItem(pagando.grupoId, pagando.pIdx, pagando.iIdx, tarjetaId, monto);
            setPagando(null);
          }}
        />
      )}
    </div>
  );
}