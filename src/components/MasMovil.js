// src/components/MasMovil.js
// Pestaña "Más" del celular: perfil, el resto de las secciones y las opciones del presupuesto.
import React from 'react';
import Icono from '../iconos';

function Fila({ icono, color = 'teal', texto, detalle, onClick, disabled }) {
  return (
    <button className="mas-fila" onClick={onClick} disabled={disabled}>
      {icono && <span className={`mas-ico ${color}`}><Icono nombre={icono} size={17} /></span>}
      <span className="mas-txt">{texto}</span>
      {detalle && <span className="mas-detalle">{detalle}</span>}
      <Icono nombre="adelante" size={16} grosor={2.4} className="mas-flecha" />
    </button>
  );
}

export default function MasMovil({
  nombre, initiales, presupuestos, presupuestoActual, onCambiarPresupuesto, monedasTxt,
  esDueño, esAdmin, puedeNuevaCategoria, invitaciones,
  onIr, onNuevaCategoria, onCompartir, onMoneda, onNuevoPresupuesto, onLogout,
}) {
  const nombrePresup = presupuestos.find(p => p.id === presupuestoActual)?.nombre || '';
  return (
    <div className="page mas">
      <div className="mas-perfil">
        <span className="mas-ava">{initiales}</span>
        <span className="mas-perfil-txt">
          <strong>{nombre}</strong>
          <small>{nombrePresup} · {monedasTxt}</small>
        </span>
      </div>

      {invitaciones}

      {presupuestos.length > 1 && (
        <label className="mas-presup">
          <span>Presupuesto</span>
          <select value={presupuestoActual || ''} onChange={e => onCambiarPresupuesto(e.target.value)}>
            {presupuestos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </label>
      )}

      <div className="mas-grupo">
        <Fila icono="ingresos" texto="Ingresos" onClick={() => onIr('ingresos')} />
        <Fila icono="recibo" color="violeta" texto="Comprobantes" onClick={() => onIr('comprobantes')} />
        <Fila icono="resumen" color="azul" texto="Resumen del mes" onClick={() => onIr('resumen')} />
        <Fila icono="ahorro" color="rosa" texto="Caja de ahorro" onClick={() => onIr('caja')} />
        <Fila icono="chat" texto="Preguntas a la IA" onClick={() => onIr('chat')} />
      </div>

      <div className="mas-seccion">
        <span className="hoja-seccion">Presupuesto</span>
        <div className="mas-grupo">
          <Fila texto="Nueva categoría de gastos" onClick={onNuevaCategoria} disabled={!puedeNuevaCategoria} />
          {esDueño && <Fila texto="Compartir con la familia" onClick={onCompartir} />}
          {esDueño && <Fila texto="Moneda" detalle={monedasTxt} onClick={onMoneda} />}
          <Fila texto="Nuevo presupuesto" onClick={onNuevoPresupuesto} />
          <Fila texto="Plantillas" onClick={() => onIr('plantillas')} />
          {esAdmin && <Fila texto="Configuración" onClick={() => onIr('config')} />}
        </div>
      </div>

      <button className="mas-salir" onClick={onLogout}>Cerrar sesión</button>
    </div>
  );
}
