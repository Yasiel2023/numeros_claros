// src/components/Comprobantes.js
// Listado de los tickets aplicados en el mes (mesData.comprobantes).
// Cada registro guarda lo que leyó la IA y a dónde fue cada item.
import React, { useState } from 'react';
import { money, money2 } from '../moneda';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';


const fmtFecha = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const p = (x) => String(x).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

function ComprobanteCard({ c, grupos, onEliminar }) {
  const [abierto, setAbierto] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const items = c.items || [];
  const nombreGrupo = (id) => grupos.find(g => g.id === id)?.nombre || id || '';

  return (
    <div className="comp-card">
      <button className="comp-card-header" onClick={() => setAbierto(a => !a)}>
        <div className="comp-card-info">
          <span className="comp-tienda">{c.tienda || 'Comprobante'}</span>
          <span className="comp-meta">
            {fmtFecha(c.fecha)} · {items.length} items
            {c.tarjetaNombre && <> · {c.tarjetaNombre}</>}
            {!c.tarjetaNombre && <> · Efectivo</>}
          </span>
        </div>
        <strong className="comp-total">{money(c.totalPagado)}</strong>
        {abierto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {abierto && (
        <div className="comp-card-body">
          <div className="comp-table-wrap">
            <table className="comp-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="num">Cant.</th>
                  <th className="num">Monto</th>
                  <th>Registrado en</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className={it.destino === 'ignorado' ? 'comp-ignorado' : ''}>
                    <td>{it.nombre}</td>
                    <td className="num">{it.cantidad}</td>
                    <td className="num">
                      {it.monto !== it.total && <span className="comp-original">{money2(it.total)}</span>}
                      {money2(it.monto)}
                    </td>
                    <td>
                      {it.destino === 'ignorado' ? 'No registrado' : (
                        <>
                          {nombreGrupo(it.grupoId)} → {it.gasto}
                          {it.destino === 'nuevo' && <span className="comp-tag">nuevo</span>}
                          {it.sugeridoIA && <span className="comp-tag ia">IA</span>}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="comp-detalle">
            {c.descuentoRepartido && (
              <div>Descuento de {money2(c.totalItems - c.totalPagado)} repartido entre los items (suma del ticket {money2(c.totalItems)}).</div>
            )}
            {c.observaciones && <div className="comp-obs">{c.observaciones}</div>}
          </div>

          <div className="comp-acciones">
            {!confirmando ? (
              <button className="btn-sm-outline" onClick={() => setConfirmando(true)}>
                <Trash2 size={13} /> Eliminar registro
              </button>
            ) : (
              <div className="comp-confirmar">
                <span>Se borra solo este registro: los gastos y el cargo a la tarjeta no se revierten.</span>
                <button className="btn-sm-outline danger" onClick={() => onEliminar(c.id)}>Eliminar</button>
                <button className="btn-sm-outline" onClick={() => setConfirmando(false)}>Cancelar</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Comprobantes({ data = [], grupos = [], onEliminar }) {
  // Más recientes primero
  const lista = [...data].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  const total = lista.reduce((s, c) => s + (c.totalPagado || 0), 0);

  if (lista.length === 0) {
    return (
      <div className="section-block">
        <p className="comp-vacio">
          Todavía no cargaste comprobantes este mes. Usá <strong>Cargar comprobante</strong> (el botón de la cámara).
        </p>
      </div>
    );
  }

  return (
    <div className="section-block">
      <div className="pend-summary">
        <div className="ps-item">
          <span>Comprobantes</span>
          <strong>{lista.length}</strong>
        </div>
        <div className="ps-item teal">
          <span>Total pagado</span>
          <strong>{money(total)}</strong>
        </div>
      </div>
      {lista.map(c => (
        <ComprobanteCard key={c.id} c={c} grupos={grupos} onEliminar={onEliminar} />
      ))}
    </div>
  );
}
