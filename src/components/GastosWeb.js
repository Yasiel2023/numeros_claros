// src/components/GastosWeb.js
// Pantalla Gastos en la computadora (prototipo web): las categorías a la izquierda
// con su avance y el detalle de la elegida a la derecha.
import React from 'react';
import { money } from '../moneda';
import Icono, { IconoCategoria } from '../iconos';
import { resumenGrupos } from './Dashboard';

export default function GastosWeb({ mesData, grupos = [], seleccionado, onElegir, onNuevaCategoria, children }) {
  const resumen = resumenGrupos(mesData, grupos);
  const totalReal = resumen.reduce((s, g) => s + g.real, 0);
  const totalPrev = resumen.reduce((s, g) => s + g.previsto, 0);
  const sinPagar  = resumen.reduce((s, g) => s + g.pend.length, 0);

  const carritoDe = (grupoId) => {
    const periodos = mesData?.gastos?.[grupoId];
    if (!Array.isArray(periodos)) return 0;
    return periodos.flatMap(p => (p && p.items) || []).filter(i => i && i.pagado !== true && i.enCarrito === true).length;
  };

  return (
    <div className="gw">
      <div className="web-cab">
        <div>
          <span className="web-sub">Pagado {money(totalReal)} de {money(totalPrev)} · {sinPagar} sin pagar</span>
          <h1 className="web-h1">Gastos</h1>
        </div>
        {onNuevaCategoria && (
          <button className="ggw-btn" onClick={onNuevaCategoria}>
            <Icono nombre="mas" size={16} grosor={2.4} /> Nueva categoría
          </button>
        )}
      </div>

      <div className="gw-cuerpo">
        <nav className="gw-lista" aria-label="Categorías">
          {resumen.map(({ grupo, previsto, real, pend, pct }) => {
            const enCarrito = carritoDe(grupo.id);
            const pasado = previsto > 0 && real > previsto;
            return (
              <button key={grupo.id} className={`gw-item ${seleccionado === grupo.id ? 'sel' : ''}`}
                aria-current={seleccionado === grupo.id ? 'page' : undefined} onClick={() => onElegir(grupo.id)}>
                <IconoCategoria grupo={grupo} size={38} />
                <span className="gw-item-cuerpo">
                  <span className="gw-fila">
                    <strong>{grupo.nombre}</strong>
                    <span className={pasado ? 'rojo' : ''}>{money(real)} / {money(previsto)}</span>
                  </span>
                  <span className="gl-barra">
                    <span style={{
                      width: Math.min(100, pct) + '%',
                      background: pct > 100 ? 'var(--red)' : pct > 80 ? 'var(--orange)' : 'var(--teal)',
                    }} />
                  </span>
                  <small className={enCarrito ? 'violeta' : ''}>
                    {enCarrito > 0 ? `${enCarrito} en el carrito` : pend.length > 0 ? `${pend.length} pendiente${pend.length !== 1 ? 's' : ''}` : 'Todo pagado'}
                  </small>
                </span>
              </button>
            );
          })}
        </nav>
        <div className="gw-detalle">{children}</div>
      </div>
    </div>
  );
}
