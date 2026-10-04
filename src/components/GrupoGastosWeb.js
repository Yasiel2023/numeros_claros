// src/components/GrupoGastosWeb.js
// Detalle de una categoría en la computadora (diseño del prototipo web): pestañas por
// período y una tabla con círculo para pagar / montar al carrito, previsto y real editables
// y el estado de cada gasto. La lógica (pagar, deshacer, borrar, tarjetas) vive en
// GrupoGastos y llega por props.
import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { money, simbolo } from '../moneda';
import Icono, { IconoCategoria } from '../iconos';
import { HojaPagar, HojaEditar } from './GrupoGastosMovil';

const FRECUENCIA_TXT = { mensual: 'Mensual', quincenal: 'Quincenal', cada10dias: 'Cada 10 días', semanal: 'Semanal' };
const montoDe = (i) => (i.real !== undefined ? (i.real || 0) : (i.previsto || 0));

export default function GrupoGastosWeb({
  grupo, periodos, periodoInicial = 0, tarjetas,
  modoCarrito, setModoCarrito, vaciarCarrito,
  onUpdatePeriodo, onPagar, onDespagar, onEliminar, onCargarComprobante,
}) {
  const [sel, setSel] = useState(Math.min(periodoInicial, periodos.length - 1));
  const [pagando, setPagando]   = useState(null);
  const [editando, setEditando] = useState(null);
  const [ocultarPagados, setOcultarPagados] = useState(false);

  const frecuencia = grupo?.frecuencia || (grupo?.tipo === 'semanas' ? 'semanal' : 'mensual');
  const periodo = periodos[sel] || periodos[0] || { items: [] };
  const items = periodo.items || [];

  const previsto = items.reduce((s, i) => s + (i.previsto || 0), 0);
  const pagado   = items.filter(i => i.pagado === true).reduce((s, i) => s + (i.real || 0), 0);
  const pendiente = items.filter(i => i.pagado !== true).reduce((s, i) => s + montoDe(i), 0);

  const pendTodos = periodos.flatMap(p => (p.items || []).filter(i => i.pagado !== true));
  const carrito = pendTodos.filter(i => i.enCarrito === true);
  const faltan  = pendTodos.filter(i => i.enCarrito !== true && (i.previsto || 0) > 0);
  const suma = (arr) => arr.reduce((s, i) => s + montoDe(i), 0);

  const setItem = (idx, item) => onUpdatePeriodo(sel, { ...periodo, items: items.map((it, j) => j === idx ? item : it) });
  const montar = (item, idx) => setItem(idx, { ...item, enCarrito: true });
  const sacar  = (item, idx) => { const { enCarrito: _ec, ...resto } = item; setItem(idx, resto); };

  const tocarCirculo = (item, idx) => {
    if (item.pagado === true) {
      if (window.confirm(`¿Marcar "${item.nombre}" como no pagado?`)) onDespagar(sel, idx);
    } else if (modoCarrito) {
      item.enCarrito ? sacar(item, idx) : montar(item, idx);
    } else {
      setPagando(idx);
    }
  };

  const nombreTarjeta = (id) => (tarjetas || []).find(t => t.id === id);

  return (
    <section className="ggw">
      <div className="ggw-cab">
        <div className="ggw-titulo">
          <IconoCategoria grupo={grupo} size={46} />
          <div>
            <span>{FRECUENCIA_TXT[frecuencia] || 'Mensual'} · previsto {money(previsto)} · pagado {money(pagado)} · pendiente {money(pendiente)}</span>
            <h2>{grupo?.nombre}</h2>
          </div>
        </div>
        <div className="ggw-acciones">
          <label className="ggw-check">
            <input type="checkbox" checked={ocultarPagados} onChange={e => setOcultarPagados(e.target.checked)} />
            Ocultar pagados
          </label>
          <button className={`ggm-carrito ${modoCarrito ? 'activo' : ''}`} aria-pressed={modoCarrito}
            onClick={() => setModoCarrito(!modoCarrito)}>
            <Icono nombre="carrito" size={17} grosor={2.2} /> Modo carrito
          </button>
          <button className="ggw-btn" onClick={() => setEditando('nuevo')}>
            <Icono nombre="mas" size={16} grosor={2.4} /> Agregar gasto
          </button>
        </div>
      </div>

      {periodos.length > 1 && (
        <div className="ggw-tabs" role="tablist" aria-label="Período">
          {periodos.map((p, i) => (
            <button key={i} role="tab" aria-selected={sel === i} className={sel === i ? 'sel' : ''} onClick={() => setSel(i)}>
              {(p.label || `Período ${i + 1}`).replace(/\s*\((\d+\/\d+)\)/, ' · $1')}
            </button>
          ))}
        </div>
      )}

      <div className="ggw-tabla" role="table" aria-label={`Gastos de ${grupo?.nombre}`}>
        <div className="ggw-fila ggw-encabezado" role="row">
          <span /><span>Concepto</span><span className="der">Previsto {simbolo()}</span>
          <span className="der">Real {simbolo()}</span><span className="der">Estado</span><span />
        </div>
        {items.length === 0 && <p className="ggw-vacio">Sin gastos en este período. Usá "Agregar gasto".</p>}
        {items.map((item, idx) => {
          const esPagado = item.pagado === true;
          if (esPagado && ocultarPagados) return null;
          const enCarrito = !esPagado && item.enCarrito === true;
          const tarjeta = esPagado && item.tarjetaId ? nombreTarjeta(item.tarjetaId) : null;
          return (
            <div key={idx} role="row" className={`ggw-fila ${esPagado ? 'pagado' : ''} ${enCarrito ? 'carrito' : ''}`}>
              <button
                className={`ggm-circulo ${esPagado ? 'ok' : enCarrito ? 'carrito' : modoCarrito ? 'vacio-carrito' : 'vacio'}`}
                onClick={() => tocarCirculo(item, idx)}
                aria-label={esPagado ? `Deshacer pago de ${item.nombre}` : modoCarrito
                  ? (enCarrito ? `Sacar ${item.nombre} del carrito` : `Montar ${item.nombre} al carrito`)
                  : `Pagar ${item.nombre}`}>
                {esPagado ? <Icono nombre="check" size={15} grosor={3} /> : enCarrito ? <Icono nombre="carrito" size={14} grosor={2.4} /> : null}
              </button>
              <button className="ggw-nombre" onClick={() => setEditando(idx)} title="Editar">{item.nombre}</button>
              <input type="number" min="0" className="ggw-input" aria-label={`Previsto de ${item.nombre}`}
                value={item.previsto || ''} placeholder="0"
                onChange={e => setItem(idx, { ...item, previsto: parseFloat(e.target.value) || 0 })} />
              <input type="number" min="0" className="ggw-input fuerte" aria-label={`Real de ${item.nombre}`}
                value={montoDe(item) || ''} placeholder="0" disabled={esPagado}
                onChange={e => setItem(idx, { ...item, real: parseFloat(e.target.value) || 0 })} />
              <span className="der">
                {esPagado ? (
                  <span className={`ggw-estado ${tarjeta ? (tarjeta.tipo === 'debito' ? 'azul' : 'violeta') : 'verde'}`}>
                    {tarjeta ? tarjeta.nombre : 'Pagado'}
                  </span>
                ) : enCarrito ? (
                  <button className="ggw-estado-btn violeta" onClick={() => sacar(item, idx)} title="Sacar del carrito">En el carrito</button>
                ) : modoCarrito ? (
                  <button className="ggw-estado-btn violeta borde" onClick={() => montar(item, idx)}>Montar</button>
                ) : (
                  <button className="ggw-estado-btn verde" onClick={() => setPagando(idx)}>Pagar</button>
                )}
              </span>
              <button className="ggw-borrar" aria-label={`Eliminar ${item.nombre}`}
                onClick={() => window.confirm(`¿Eliminar "${item.nombre}"?`) && onEliminar(sel, idx)}>
                <Trash2 size={15} />
              </button>
            </div>
          );
        })}
      </div>

      {modoCarrito && carrito.length > 0 && (
        <div className="ggw-pie">
          <span><strong>{carrito.length} en el carrito · {money(suma(carrito))}</strong>
            {faltan.length > 0 && <> · faltan montar {faltan.length} ({money(suma(faltan))})</>}</span>
          <span className="ggw-pie-acciones">
            <button className="ggw-link" onClick={vaciarCarrito}>Vaciar</button>
            {onCargarComprobante && (
              <button className="ggw-pie-btn" onClick={onCargarComprobante}>
                <Icono nombre="camara" size={18} /> Pagar el carrito con el ticket
              </button>
            )}
          </span>
        </div>
      )}

      {pagando !== null && items[pagando] && (
        <HojaPagar item={items[pagando]} grupoNombre={grupo?.nombre} tarjetas={tarjetas}
          onClose={() => setPagando(null)}
          onConfirmar={(tarjetaId, monto) => { onPagar(sel, pagando, tarjetaId, monto); setPagando(null); }} />
      )}
      {editando !== null && (
        <HojaEditar
          item={editando === 'nuevo' ? null : items[editando]}
          onClose={() => setEditando(null)}
          onGuardar={it => {
            if (editando === 'nuevo') onUpdatePeriodo(sel, { ...periodo, items: [...items, it] });
            else setItem(editando, it);
            setEditando(null);
          }}
          onEliminar={() => {
            if (window.confirm(`¿Eliminar "${items[editando]?.nombre}"?`)) { onEliminar(sel, editando); setEditando(null); }
          }}
        />
      )}
    </section>
  );
}
