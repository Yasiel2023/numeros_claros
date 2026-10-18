// src/components/Carrito.js
// Carrito general: junta lo que se montó de TODAS las categorías (ej. Supermercado y Aseo en
// la misma compra). Cada item sigue guardando su marca enCarrito en su categoría; esta
// pantalla solo los muestra juntos y permite montar, sacar o vaciar.
import React, { useState } from 'react';
import { money } from '../moneda';
import Icono, { IconoCategoria } from '../iconos';

const montoDe = (i) => (i.real !== undefined ? (i.real || 0) : (i.previsto || 0));
const esFormatoPeriodos = (ps) =>
  Array.isArray(ps) && ps.length > 0 && typeof ps[0] === 'object' && ps[0] !== null && 'items' in ps[0];

// Recorre los items de una categoría (con períodos o plana, formato legado) y deja
// pasar la posición de cada uno para poder modificarlo.
function itemsDe(datos) {
  if (esFormatoPeriodos(datos)) {
    return datos.flatMap((p, pIdx) => (p?.items || []).map((item, iIdx) => ({ item, pIdx, iIdx })));
  }
  return (Array.isArray(datos) ? datos : []).map((item, iIdx) => ({ item, pIdx: null, iIdx }));
}

function conItem(datos, pIdx, iIdx, nuevo) {
  if (pIdx === null) return datos.map((it, j) => (j === iIdx ? nuevo : it));
  return datos.map((p, i) => (i === pIdx
    ? { ...p, items: (p.items || []).map((it, j) => (j === iIdx ? nuevo : it)) }
    : p));
}

export default function Carrito({ gastos = {}, grupos = [], onChange, onTicket }) {
  const [abierto, setAbierto] = useState(null);   // categoría con la lista de pendientes desplegada

  // Qué hay en el carrito y qué falta montar, por categoría
  const filas = grupos.map(g => {
    const todos = itemsDe(gastos[g.id]).filter(x => x.item && x.item.pagado !== true);
    return {
      grupo: g,
      enCarrito: todos.filter(x => x.item.enCarrito === true),
      faltan: todos.filter(x => x.item.enCarrito !== true),
    };
  });
  const conCarrito = filas.filter(f => f.enCarrito.length > 0);
  const cantidad = conCarrito.reduce((s, f) => s + f.enCarrito.length, 0);
  const total = conCarrito.reduce((s, f) => s + f.enCarrito.reduce((ss, x) => ss + montoDe(x.item), 0), 0);

  const cambiar = (grupoId, pIdx, iIdx, montar) => {
    const datos = gastos[grupoId];
    const actual = itemsDe(datos).find(x => x.pIdx === pIdx && x.iIdx === iIdx)?.item;
    if (!actual) return;
    const { enCarrito: _ec, ...sin } = actual;
    onChange({ ...gastos, [grupoId]: conItem(datos, pIdx, iIdx, montar ? { ...sin, enCarrito: true } : sin) });
  };

  const vaciar = () => {
    if (!window.confirm('¿Vaciar el carrito? Los productos quedan pendientes en sus categorías.')) return;
    const nuevos = { ...gastos };
    conCarrito.forEach(({ grupo, enCarrito }) => {
      enCarrito.forEach(({ item, pIdx, iIdx }) => {
        const { enCarrito: _ec, ...sin } = item;
        nuevos[grupo.id] = conItem(nuevos[grupo.id], pIdx, iIdx, sin);
      });
    });
    onChange(nuevos);
  };

  return (
    <div className="page carr">
      <div className="carr-resumen">
        <span className="carr-ico"><Icono nombre="carrito" size={22} /></span>
        <span className="carr-resumen-txt">
          <strong>{cantidad} producto{cantidad !== 1 ? 's' : ''} en el carrito</strong>
          <small>{money(total)} · de {conCarrito.length} categoría{conCarrito.length !== 1 ? 's' : ''}</small>
        </span>
      </div>

      {cantidad > 0 && (
        <div className="carr-acciones">
          {onTicket && <button className="hoja-btn" onClick={onTicket}>Pagar el carrito con el ticket</button>}
          <button className="carr-vaciar" onClick={vaciar}>Vaciar</button>
        </div>
      )}

      {cantidad === 0 && (
        <p className="carr-vacio">
          El carrito está vacío. Montá abajo lo que vas a comprar, de la categoría que sea: Supermercado,
          Aseo, lo que necesites en la misma compra.
        </p>
      )}

      {conCarrito.map(({ grupo, enCarrito }) => (
        <section key={grupo.id} className="carr-grupo">
          <h3><IconoCategoria grupo={grupo} size={16} /> {grupo.nombre}</h3>
          {enCarrito.map(({ item, pIdx, iIdx }) => (
            <button key={`${pIdx}_${iIdx}`} className="carr-item" onClick={() => cambiar(grupo.id, pIdx, iIdx, false)}
              aria-label={`Sacar ${item.nombre} del carrito`}>
              <span className="carr-check"><Icono nombre="carrito" size={14} grosor={2.4} /></span>
              <span className="carr-nombre">{item.nombre}</span>
              <strong>{money(montoDe(item))}</strong>
              <Icono nombre="cerrar" size={14} className="carr-sacar" />
            </button>
          ))}
        </section>
      ))}

      <h3 className="carr-titulo-agregar">Agregar al carrito</h3>
      {filas.filter(f => f.faltan.length > 0).map(({ grupo, faltan }) => (
        <section key={grupo.id} className="carr-grupo">
          <button className="carr-cabecera" onClick={() => setAbierto(abierto === grupo.id ? null : grupo.id)}
            aria-expanded={abierto === grupo.id}>
            <IconoCategoria grupo={grupo} size={16} />
            <span>{grupo.nombre}</span>
            <small>{faltan.length} pendiente{faltan.length !== 1 ? 's' : ''}</small>
            <Icono nombre={abierto === grupo.id ? 'abajo' : 'adelante'} size={16} />
          </button>
          {abierto === grupo.id && faltan.map(({ item, pIdx, iIdx }) => (
            <button key={`${pIdx}_${iIdx}`} className="carr-item carr-item--falta" onClick={() => cambiar(grupo.id, pIdx, iIdx, true)}
              aria-label={`Montar ${item.nombre} al carrito`}>
              <span className="carr-check vacio" />
              <span className="carr-nombre">{item.nombre}</span>
              <strong>{(item.previsto || 0) > 0 || item.real ? money(montoDe(item)) : '—'}</strong>
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}
