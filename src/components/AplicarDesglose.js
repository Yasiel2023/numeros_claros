// src/components/AplicarDesglose.js
import React, { useState, useMemo } from 'react';
import { money, money2 } from '../moneda';
import { AlertCircle, CheckCircle2, Loader, Camera } from 'lucide-react';
import { toPeriodos, tarjetasDisponibles, saldoActualDebito } from './GrupoGastos';
import { sugerirMatches } from '../ia';



const NUEVO    = '__nuevo__';
const IGNORAR  = '__ignorar__';

// Periodo que corresponde a "hoy" dentro del mes que se está viendo
function periodoPorDefecto(periodos, frecuencia, año, mes) {
  const hoy = new Date();
  if (hoy.getFullYear() !== año || hoy.getMonth() !== mes || periodos.length <= 1) {
    return periodos[0]?.numero || 1;
  }
  const dia = hoy.getDate();
  let numero;
  if (frecuencia === 'quincenal')       numero = dia <= 15 ? 1 : 2;
  else if (frecuencia === 'cada10dias') numero = dia <= 10 ? 1 : dia <= 20 ? 2 : 3;
  else {
    // Semanal: la última semana cuyo día de compra ya empezó (con 3 días de margen)
    const diaDe = p => parseInt((p.label.match(/\((\d{1,2})\/\d{1,2}\)/) || [])[1], 10);
    const empezadas = periodos.filter(p => diaDe(p) - 3 <= dia);
    numero = (empezadas[empezadas.length - 1] || periodos[0]).numero;
  }
  return periodos.some(p => p.numero === numero) ? numero : periodos[0].numero;
}

export default function AplicarDesglose({
  desglose,        // { tienda, items: [{nombre, cantidad, precio_unitario, total}], observaciones }
  mesData,
  grupos,
  año,
  mes,
  ia,              // { apiKey, url } de Groq
  onAplicar,       // (asignaciones: [{tipo: 'matchear'|'crear', grupoId, periodoNumero, itemName, nombre, monto}], tarjetaId | '')
  onCancelar,
}) {
  // idx -> { grupoId, periodoNumero, destino, sugerido, cargando }
  const [asign, setAsign] = useState({});
  const [error, setError] = useState('');
  const [tarjetaId, setTarjetaId] = useState(''); // '' = efectivo / sin tarjeta
  const tarjetas = tarjetasDisponibles(mesData?.tarjetas);

  // Descuento del comprobante (ej: devolución de IVA Ley 19210): se reparte
  // proporcionalmente para que los gastos y la tarjeta queden con lo pagado.
  const sumaItems = desglose.items.reduce((s, i) => s + (i.total || 0), 0);
  const totalPagado = desglose.total_pagado || 0;
  // Se descartan lecturas absurdas de la IA (más de 50% de descuento)
  const hayDescuento = totalPagado > 0 && totalPagado < sumaItems - 0.01 && totalPagado >= sumaItems * 0.5;
  const [repartirDescuento, setRepartirDescuento] = useState(true);
  const montos = useMemo(() => {
    const originales = desglose.items.map(i => i.total || 0);
    if (!hayDescuento || !repartirDescuento) return originales;
    const factor = totalPagado / sumaItems;
    const res = originales.map(m => Math.round(m * factor * 100) / 100);
    // El redondeo se ajusta en el item más caro para que la suma dé exacto lo pagado
    const diff = Math.round((totalPagado - res.reduce((s, m) => s + m, 0)) * 100) / 100;
    const iMax = originales.indexOf(Math.max(...originales));
    res[iMax] = Math.round((res[iMax] + diff) * 100) / 100;
    return res;
  }, [desglose.items, hayDescuento, repartirDescuento, totalPagado, sumaItems]);

  const periodosDe = (grupoId) => toPeriodos(mesData?.gastos?.[grupoId] || []);

  const itemsDe = (grupoId, periodoNumero) =>
    periodosDe(grupoId).find(p => p.numero === periodoNumero)?.items || [];

  const gastosDe = (grupoId, periodoNumero) =>
    [...new Set(itemsDe(grupoId, periodoNumero).map(i => i.nombre).filter(Boolean))];

  // Lo que se montó al carrito (pendiente) es lo más probable que esté en el ticket
  const enCarritoDe = (grupoId, periodoNumero) =>
    [...new Set(itemsDe(grupoId, periodoNumero)
      .filter(i => i.enCarrito === true && i.pagado !== true)
      .map(i => i.nombre).filter(Boolean))];

  const defaultPeriodo = (grupoId) => {
    const grupo = grupos.find(g => g.id === grupoId);
    const frecuencia = grupo?.frecuencia || (grupo?.tipo === 'semanas' ? 'semanal' : 'mensual');
    return periodoPorDefecto(periodosDe(grupoId), frecuencia, año, mes);
  };

  // Pide a la IA el match de varios items de la misma categoría/periodo en una sola llamada
  const pedirSugerencias = async (idxs, grupoId, periodoNumero) => {
    setError('');
    setAsign(prev => {
      const n = { ...prev };
      idxs.forEach(idx => { n[idx] = { grupoId, periodoNumero, destino: '', sugerido: null, cargando: true }; });
      return n;
    });

    let matches = {};
    try {
      matches = await sugerirMatches(
        idxs.map(idx => ({ idx, nombre: desglose.items[idx].nombre })),
        gastosDe(grupoId, periodoNumero),
        ia,
        enCarritoDe(grupoId, periodoNumero),
      );
    } catch (e) {
      setError(`No se pudo obtener la sugerencia de la IA: ${e.message}`);
    }

    setAsign(prev => {
      const n = { ...prev };
      idxs.forEach(idx => {
        const actual = n[idx];
        // Si el usuario cambió la categoría mientras se esperaba, se descarta la respuesta
        if (!actual || actual.grupoId !== grupoId || actual.periodoNumero !== periodoNumero) return;
        const sugerido = matches[idx] || null;
        n[idx] = { ...actual, cargando: false, sugerido, destino: sugerido || NUEVO };
      });
      return n;
    });
  };

  const elegirCategoria = (idx, grupoId) => {
    if (!grupoId) {
      setAsign(prev => { const n = { ...prev }; delete n[idx]; return n; });
      return;
    }
    pedirSugerencias([idx], grupoId, defaultPeriodo(grupoId));
  };

  const elegirPeriodo = (idx, periodoNumero) =>
    pedirSugerencias([idx], asign[idx].grupoId, periodoNumero);

  const elegirDestino = (idx, destino) =>
    setAsign(prev => ({ ...prev, [idx]: { ...prev[idx], destino } }));

  const categoriaParaTodos = (grupoId) => {
    if (!grupoId) return;
    pedirSugerencias(desglose.items.map((_, idx) => idx), grupoId, defaultPeriodo(grupoId));
  };

  const confirmar = () => {
    const lista = [];
    desglose.items.forEach((item, idx) => {
      const a = asign[idx];
      if (!a || a.destino === IGNORAR) return;
      lista.push({
        tipo: a.destino === NUEVO ? 'crear' : 'matchear',
        grupoId: a.grupoId,
        periodoNumero: a.periodoNumero,
        itemName: a.destino === NUEVO ? null : a.destino,
        nombre: item.nombre,
        monto: montos[idx],
      });
    });

    // Registro del ticket tal como se aplicó (se guarda en el mes)
    const comprobante = {
      tienda: desglose.tienda || '',
      observaciones: desglose.observaciones || '',
      totalItems: sumaItems,
      totalPagado: hayDescuento ? totalPagado : sumaItems,
      descuentoRepartido: hayDescuento && repartirDescuento,
      items: desglose.items.map((item, idx) => {
        const a = asign[idx] || {};
        return {
          nombre: item.nombre,
          cantidad: item.cantidad ?? 1,
          precioUnitario: item.precio_unitario ?? null,
          total: item.total || 0,
          monto: montos[idx],
          destino: a.destino === IGNORAR ? 'ignorado' : a.destino === NUEVO ? 'nuevo' : 'existente',
          grupoId: a.destino === IGNORAR ? null : (a.grupoId || null),
          periodoNumero: a.destino === IGNORAR ? null : (a.periodoNumero ?? null),
          gasto: a.destino === IGNORAR ? null : a.destino === NUEVO ? item.nombre : a.destino,
          sugeridoIA: !!a.sugerido && a.destino === a.sugerido,
        };
      }),
    };

    onAplicar(lista, tarjetaId, comprobante);
  };

  const listos = desglose.items.filter((_, idx) => asign[idx]?.destino && !asign[idx].cargando).length;
  const todoListo = listos === desglose.items.length;
  const nombreGrupo = (id) => grupos.find(g => g.id === id)?.nombre || '';

  if (!desglose.items?.length) {
    return (
      <div className="desglose-modal">
        <div className="alert alert-info">
          <AlertCircle size={16} /> {desglose.observaciones || 'No se encontraron items en el comprobante.'}
        </div>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onCancelar}>Volver</button>
        </div>
      </div>
    );
  }

  return (
    <div className="desglose-modal">
      <div className="desglose-tienda">
        {desglose.tienda || 'Comprobante'} · {desglose.items.length} items · {money(sumaItems)}
        {hayDescuento && ` · pagado ${money(totalPagado)}`}
      </div>

      {hayDescuento && (
        <label className="desglose-descuento">
          <input
            type="checkbox"
            checked={repartirDescuento}
            onChange={e => setRepartirDescuento(e.target.checked)}
          />
          <span>
            Repartir el descuento de <strong>{money2(sumaItems - totalPagado)}</strong> entre los items
            (se registra lo realmente pagado: {money2(totalPagado)})
          </span>
        </label>
      )}

      {desglose.observaciones && (
        <div className="alert alert-info">
          <AlertCircle size={16} /> {desglose.observaciones}
        </div>
      )}
      {error && (
        <div className="alert alert-error">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="desglose-paso">
        <h3>Forma de pago</h3>
        <select className="desglose-item-select" value={tarjetaId} onChange={e => setTarjetaId(e.target.value)}>
          <option value="">💵 Efectivo / sin tarjeta</option>
          {tarjetas.map(t => (
            <option key={t.id} value={t.id}>
              {t.tipo === 'debito'
                ? `🏧 ${t.nombre} (débito · saldo ${money(saldoActualDebito(t))})`
                : `💳 ${t.nombre} (crédito)`}
            </option>
          ))}
        </select>
        {tarjetaId && (() => {
          const t = tarjetas.find(x => x.id === tarjetaId);
          const totalAsignado = desglose.items.reduce((s, item, idx) =>
            s + (asign[idx]?.destino && asign[idx].destino !== IGNORAR ? montos[idx] : 0), 0);
          return (
            <p className="desglose-paso-desc">
              {t?.tipo === 'debito'
                ? `Se descontarán ${money(totalAsignado)} del saldo de ${t.nombre}.`
                : `Se cargarán ${money(totalAsignado)} a la deuda de ${t?.nombre}.`}
              {' '}Los items quedan vinculados a la tarjeta: si después despagás o borrás uno, se revierte.
            </p>
          );
        })()}
      </div>

      <div className="desglose-paso">
        <h3>Categoría para todo el comprobante</h3>
        <p className="desglose-paso-desc">Opcional: elegila una vez y después cambiá solo los items que vayan a otra.</p>
        <select className="desglose-item-select" value="" onChange={e => categoriaParaTodos(e.target.value)}>
          <option value="">Elegí una categoría...</option>
          {grupos.map(g => <option key={g.id} value={g.id}>{g.icono} {g.nombre}</option>)}
        </select>
      </div>

      <div className="desglose-paso">
        <h3>Items del comprobante</h3>
        <p className="desglose-paso-desc">Elegí la categoría de cada item y la IA busca con qué gasto coincide.</p>

        <div className="desglose-items">
          {desglose.items.map((item, idx) => {
            const a = asign[idx];
            const periodos = a ? periodosDe(a.grupoId) : [];
            const gastos = a ? gastosDe(a.grupoId, a.periodoNumero) : [];
            const carrito = a ? enCarritoDe(a.grupoId, a.periodoNumero) : [];

            return (
              <div key={idx} className={`desglose-item-row${a?.destino && !a.cargando ? ' asignado' : ''}`}>
                <div className="desglose-item-header">
                  <div className="desglose-item-nombre">
                    {item.nombre}
                    {item.cantidad > 1 && <span className="desglose-item-cant"> ×{item.cantidad}</span>}
                  </div>
                  <div className="desglose-item-precio">
                    {montos[idx] !== (item.total || 0) && (
                      <span className="desglose-item-original">{money(item.total)}</span>
                    )}
                    {money(montos[idx])}
                  </div>
                </div>

                <div className="desglose-item-campos">
                  <select
                    className="desglose-item-select"
                    value={a?.grupoId || ''}
                    onChange={e => elegirCategoria(idx, e.target.value)}
                  >
                    <option value="">Categoría...</option>
                    {grupos.map(g => <option key={g.id} value={g.id}>{g.icono} {g.nombre}</option>)}
                  </select>

                  {a && periodos.length > 1 && (
                    <select
                      className="desglose-item-select"
                      value={a.periodoNumero}
                      onChange={e => elegirPeriodo(idx, parseInt(e.target.value, 10))}
                    >
                      {periodos.map(p => <option key={p.numero} value={p.numero}>{p.label}</option>)}
                    </select>
                  )}

                  {a && (a.cargando ? (
                    <div className="desglose-buscando"><Loader size={14} className="spin" /> Buscando coincidencia...</div>
                  ) : (
                    <select
                      className="desglose-item-select"
                      value={a.destino}
                      onChange={e => elegirDestino(idx, e.target.value)}
                    >
                      {gastos.map(nombre => (
                        <option key={nombre} value={nombre}>
                          {nombre === a.sugerido ? '🤖 ' : ''}{nombre}{carrito.includes(nombre) ? ' 🛒' : ''}
                        </option>
                      ))}
                      <option value={NUEVO}>➕ Crear nuevo "{item.nombre}"</option>
                      <option value={IGNORAR}>🚫 No registrar</option>
                    </select>
                  ))}
                </div>

                {a && !a.cargando && a.destino && (
                  <div className="desglose-opcion-confirmacion">
                    {a.destino === IGNORAR
                      ? 'No se registrará'
                      : a.destino === NUEVO
                      ? `Se creará "${item.nombre}" con ${money(montos[idx])} en ${nombreGrupo(a.grupoId)}`
                      : `Se cargará ${money(montos[idx])} en "${a.destino}" (${nombreGrupo(a.grupoId)})${a.destino === a.sugerido ? ' · sugerido por IA' : ''}`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="modal-footer">
        <button className="btn-cancel" onClick={onCancelar}>
          <Camera size={16} /> Otra foto
        </button>
        <button
          className="btn-primary"
          onClick={confirmar}
          disabled={!todoListo}
          title={!todoListo ? 'Asigná todos los items primero' : ''}
        >
          <CheckCircle2 size={16} /> Aplicar ({listos}/{desglose.items.length})
        </button>
      </div>
    </div>
  );
}
