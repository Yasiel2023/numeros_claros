// src/components/GastosLista.js
// Pestaña "Gastos" del celular: todas las categorías con su avance.
// En la computadora las categorías están directamente en el menú lateral.
import React from 'react';
import Icono, { IconoCategoria } from '../iconos';
import { money } from '../moneda';
import { resumenGrupos } from './Dashboard';

export default function GastosLista({ mesData, grupos = [], onAbrir, onNuevaCategoria }) {
  const resumen = resumenGrupos(mesData, grupos);
  const totalReal = resumen.reduce((s, g) => s + g.real, 0);
  const totalPrev = resumen.reduce((s, g) => s + g.previsto, 0);

  return (
    <div className="page gl-page">
      <div className="gl-total">
        <span>Gastado en el mes</span>
        <strong>{money(totalReal)}</strong>
        <small>de {money(totalPrev)} previstos</small>
      </div>

      <div className="gl-lista">
        {resumen.map(({ grupo, previsto, real, pend, pct }) => (
          <button key={grupo.id} className="gl-item" onClick={() => onAbrir(grupo.id)}>
            <IconoCategoria grupo={grupo} size={44} />
            <span className="gl-cuerpo">
              <span className="gl-fila">
                <span className="gl-nombre">{grupo.nombre}</span>
                <span className="gl-monto">{money(real)}</span>
              </span>
              <span className="gl-barra">
                <span style={{
                  width: Math.min(100, pct) + '%',
                  background: pct > 100 ? 'var(--red)' : pct > 80 ? 'var(--orange)' : 'var(--teal)',
                }} />
              </span>
              <span className="gl-fila gl-sub">
                <span>{pend.length > 0 ? `${pend.length} pendiente${pend.length !== 1 ? 's' : ''}` : 'Todo pagado'}</span>
                <span>de {money(previsto)}</span>
              </span>
            </span>
            <Icono nombre="adelante" size={18} className="gl-flecha" />
          </button>
        ))}
      </div>

      {onNuevaCategoria && (
        <button className="gl-nueva" onClick={onNuevaCategoria}>
          <Icono nombre="mas" size={16} grosor={2.4} /> Nueva categoría
        </button>
      )}
    </div>
  );
}
