// src/components/Dashboard.js
import React, { useState } from 'react';
import { money, moneyDe, esSecundaria, monedaPrincipal, monedaSecundaria } from '../moneda';
import Icono, { IconoCategoria } from '../iconos';
import { MESES_ES } from '../constants';
import { Hoja, HojaPagar } from './GrupoGastosMovil';
import { saldoActualDebito } from './GrupoGastos';
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

// "Cómo va el mes" con la plata real: lo que hay en las cuentas de débito, menos lo que
// falta pagar (gastos y tarjetas de crédito), menos el ahorro.
// Sin doble conteo: pagar con débito baja el saldo y saca el gasto de pendientes; pagar
// con crédito lo pasa a la deuda de la tarjeta; pagar la tarjeta desde el débito baja ambos.
// Las tarjetas de crédito en la moneda secundaria se restan convertidas con la tasa que
// tiene cada una (tarjeta.tasa = moneda principal por 1 unidad de la secundaria); las que
// no tienen tasa quedan en `sinTasa` y no se restan.
export function calcularComoVa(mesData, gruposResumen) {
  const { tarjetas = [], objetivoAhorro = 0 } = mesData || {};
  const montoDe = (i) => (i.real !== undefined ? (i.real || 0) : (i.previsto || 0));
  const debitos  = tarjetas.filter(t => t.tipo === 'debito' && !esSecundaria(t.moneda));
  const enDebito   = debitos.reduce((s, t) => s + saldoActualDebito(t), 0);
  const pendientes = gruposResumen.reduce((s, g) => s + g.pend.reduce((ss, i) => ss + montoDe(i), 0), 0);

  const credito = tarjetas.map((t, idx) => ({ t, idx })).filter(({ t }) => t.tipo !== 'debito');
  const deudaTarj = credito.filter(({ t }) => !esSecundaria(t.moneda)).reduce((s, { t }) => s + saldoTarjeta(t), 0);

  const enSecundaria = credito.filter(({ t }) => esSecundaria(t.moneda));
  const secundaria = {
    moneda: monedaSecundaria(),
    // Una fila por tarjeta (para el panel de tasas)
    tarjetas: enSecundaria.map(({ t, idx }) => {
      const saldo = saldoTarjeta(t);
      const tasa = Number(t.tasa) > 0 ? Number(t.tasa) : 0;
      return { idx, nombre: t.nombre, moneda: t.moneda, saldo, tasa, aprox: tasa ? saldo * tasa : null };
    }),
  };
  secundaria.saldo   = secundaria.tarjetas.reduce((s, x) => s + x.saldo, 0);
  secundaria.aprox   = secundaria.tarjetas.reduce((s, x) => s + (x.aprox || 0), 0);
  secundaria.sinTasa = secundaria.tarjetas.filter(x => !x.tasa && x.saldo !== 0);

  const despuesDePagar = enDebito - pendientes - deudaTarj - secundaria.aprox;
  return {
    hayDebito: debitos.length > 0,
    enDebito, pendientes, tarjetas: deudaTarj, secundaria,
    despuesDePagar,
    ahorro: objetivoAhorro || 0,
    libre: despuesDePagar - (objetivoAhorro || 0),
  };
}

// Panel para poner la tasa de cada tarjeta en la moneda secundaria
// onCambiarTasas recibe { índice de la tarjeta: tasa } con todos los cambios juntos
function HojaTasas({ secundaria, onCambiarTasas, onClose }) {
  const [tasas, setTasas] = useState(() => Object.fromEntries(secundaria.tarjetas.map(x => [x.idx, x.tasa ? String(x.tasa) : ''])));
  const P = monedaPrincipal();
  const guardar = () => {
    const cambios = {};
    secundaria.tarjetas.forEach(x => {
      const nueva = parseFloat(tasas[x.idx]) || 0;
      if (nueva !== x.tasa) cambios[x.idx] = nueva;
    });
    if (Object.keys(cambios).length > 0) onCambiarTasas(cambios);
    onClose();
  };
  return (
    <Hoja titulo="Tasa de las tarjetas" onClose={onClose}>
      <h3 className="hoja-titulo">Tarjetas en {secundaria.moneda}</h3>
      <p className="cvm-hoja-ayuda">
        Poné cuántos {P} vale 1 {secundaria.moneda} para cada tarjeta. Se usa para estimar cuánto vas a restar
        y queda guardada para los meses siguientes.
      </p>
      {secundaria.tarjetas.map(x => {
        const tasa = parseFloat(tasas[x.idx]) || 0;
        return (
          <div key={x.idx} className="cvm-tasa-fila">
            <span className="cvm-tasa-nombre">
              <strong>{x.nombre}</strong>
              <small>Saldo {moneyDe(x.saldo, x.moneda)}{tasa > 0 && <> · ≈ {money(x.saldo * tasa)}</>}</small>
            </span>
            <label className="hoja-campo cvm-tasa-campo">
              <span>Tasa ({P} por 1 {x.moneda})</span>
              <input type="number" inputMode="decimal" min="0" step="0.01" value={tasas[x.idx]} placeholder="Ej: 40,5"
                onChange={e => setTasas(prev => ({ ...prev, [x.idx]: e.target.value }))} />
            </label>
          </div>
        );
      })}
      <button className="hoja-btn" onClick={guardar}>Guardar</button>
    </Hoja>
  );
}

function ComoVaElMes({ datos, onIrA, onCambiarTasas }) {
  const { hayDebito, enDebito, pendientes, tarjetas, secundaria, despuesDePagar, ahorro, libre } = datos;
  const [editandoTasas, setEditandoTasas] = useState(false);
  const hayDos = secundaria.tarjetas.some(x => x.saldo !== 0);
  const Fila = ({ signo, texto, monto, ir, clase = '' }) => (
    <button className={`cvm-fila ${clase}`} onClick={() => onIrA(ir)}>
      <span>{signo ? `${signo} ` : ''}{texto}</span>
      <strong>{money(monto)}</strong>
    </button>
  );

  return (
    <section className="cvm" aria-label="Cómo va el mes">
      <h2>Cómo va el mes</h2>
      {!hayDebito ? (
        <div className="cvm-vacio">
          <p>Agregá tus cuentas de débito en Tarjetas para ver cómo va el mes con la plata que tenés.</p>
          <button className="dw-link" onClick={() => onIrA('tarjetas')}>Ir a Tarjetas</button>
        </div>
      ) : (
        <>
          <Fila texto="En débito" monto={enDebito} ir="tarjetas" />
          <Fila signo="−" texto="Gastos pendientes" monto={pendientes} ir="gastos" />
          <Fila signo="−" texto={hayDos ? `Tarjetas de crédito ${monedaPrincipal()}` : 'Tarjetas de crédito'} monto={tarjetas} ir="tarjetas" />
          {hayDos && (
            <button className="cvm-fila cvm-fila-sec" onClick={() => (onCambiarTasas ? setEditandoTasas(true) : onIrA('tarjetas'))}>
              <span>− Tarjetas de crédito {secundaria.moneda}</span>
              <span className="cvm-sec-montos">
                <strong>{moneyDe(secundaria.saldo, secundaria.moneda)}</strong>
                {secundaria.sinTasa.length > 0
                  ? <small className="cvm-sin-tasa">Poné la tasa para incluirla</small>
                  : <small>≈ {money(secundaria.aprox)}</small>}
              </span>
            </button>
          )}
          <div className={`cvm-total ${despuesDePagar < 0 ? 'neg' : ''}`}>
            <span>Después de pagar todo</span><strong>{money(despuesDePagar)}</strong>
          </div>
          <Fila signo="−" texto="Ahorro" monto={ahorro} ir="resumen" />
          <div className={`cvm-total cvm-final ${libre < 0 ? 'neg' : ''}`}>
            <span>Libre para gastar</span><strong>{money(libre)}</strong>
          </div>
          <p className="cvm-nota">
            Según el saldo registrado de tus cuentas de débito.
            {secundaria.sinTasa.length > 0 && <> No incluye {secundaria.sinTasa.map(x => x.nombre).join(', ')} (sin tasa).</>}
          </p>
        </>
      )}
      {editandoTasas && (
        <HojaTasas secundaria={secundaria} onCambiarTasas={onCambiarTasas} onClose={() => setEditandoTasas(false)} />
      )}
    </section>
  );
}

export default function Dashboard({ mesData, mes, año, onIrA, grupos = [], onTicket, onPagarItem, onCambiarTasas, nombre = '' }) {
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
  const comoVa = calcularComoVa(mesData, gruposResumen);
  // Mismo criterio que "Cómo va el mes": gastos + tarjetas (las de otra moneda, convertidas con su tasa)
  const totalPendiente = comoVa.pendientes + comoVa.tarjetas + comoVa.secundaria.aprox;
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

            <ComoVaElMes datos={comoVa} onIrA={onIrA} onCambiarTasas={onCambiarTasas} />

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
            <small>
              Gastos {money(comoVa.pendientes)}
              {comoVa.tarjetas !== 0 && <> · tarjetas {money(comoVa.tarjetas)}</>}
              {comoVa.secundaria.saldo !== 0 && <> · {moneyDe(comoVa.secundaria.saldo, comoVa.secundaria.moneda)}{' '}
                {comoVa.secundaria.sinTasa.length > 0 ? '(sin tasa)' : `≈ ${money(comoVa.secundaria.aprox)}`}</>}
            </small>
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
            <ComoVaElMes datos={comoVa} onIrA={onIrA} onCambiarTasas={onCambiarTasas} />
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