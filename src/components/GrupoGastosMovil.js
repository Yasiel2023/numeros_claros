// src/components/GrupoGastosMovil.js
// Vista de una categoría en el celular (diseño de app): pestañas por período,
// lista con círculo para pagar / montar al carrito, y paneles que suben desde abajo.
// La lógica (pagar, deshacer, borrar, tarjetas) vive en GrupoGastos y llega por props.
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Trash2 } from 'lucide-react';
import Icono from '../iconos';
import { money, simbolo } from '../moneda';
import { MESES_ES } from '../constants';
import { tarjetasDisponibles, saldoActualDebito } from './GrupoGastos';

const FRECUENCIA_TXT = { mensual: 'Mensual', quincenal: 'Quincenal', cada10dias: 'Cada 10 días', semanal: 'Semanal' };
const PREFIJO_TAB    = { semanal: 'Sem', quincenal: 'Quinc.', cada10dias: 'Per.' };

const montoDe = (i) => (i.real !== undefined ? (i.real || 0) : (i.previsto || 0));

// Panel que sube desde abajo
export function Hoja({ titulo, onClose, children }) {
  return createPortal(
    <div className="hoja-overlay" onClick={onClose}>
      <div className="hoja" role="dialog" aria-label={titulo} onClick={e => e.stopPropagation()}>
        <span className="hoja-agarre" />
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function HojaPagar({ item, grupoNombre, tarjetas, onConfirmar, onClose }) {
  const [monto, setMonto] = useState(String(montoDe(item) || ''));
  const [medio, setMedio] = useState('');
  const opciones = tarjetasDisponibles(tarjetas);

  return (
    <Hoja titulo={`Pagar ${item.nombre}`} onClose={onClose}>
      <div className="hp-cabecera">
        <span>Pagar <strong>{item.nombre}</strong> · {grupoNombre}</span>
        <label className="sr-only" htmlFor="hp-monto">Monto pagado</label>
        <div className="hp-monto">
          <span>{simbolo()}</span>
          <input id="hp-monto" type="number" inputMode="decimal" min="0" value={monto}
            onChange={e => setMonto(e.target.value)} />
        </div>
        <small>Previsto {money(item.previsto || 0)} · tocá el monto para cambiarlo</small>
      </div>

      <div className="hp-medios">
        <span className="hoja-seccion">¿Con qué pagaste?</span>
        <label className={`hp-medio ${medio === '' ? 'sel' : ''}`}>
          <input type="radio" name="medio" checked={medio === ''} onChange={() => setMedio('')} />
          <span className="hp-medio-ico teal"><Icono nombre="efectivo" size={18} /></span>
          <span className="hp-medio-txt"><strong>Efectivo o transferencia</strong></span>
        </label>
        {opciones.map(t => (
          <label key={t.id} className={`hp-medio ${medio === t.id ? 'sel' : ''}`}>
            <input type="radio" name="medio" checked={medio === t.id} onChange={() => setMedio(t.id)} />
            <span className={`hp-medio-ico ${t.tipo === 'debito' ? 'azul' : 'violeta'}`}><Icono nombre={t.tipo === 'debito' ? 'debito' : 'tarjeta'} size={18} /></span>
            <span className="hp-medio-txt">
              <strong>{t.nombre}</strong>
              <small>{t.tipo === 'debito' ? `Saldo ${money(saldoActualDebito(t))}` : `Crédito · deuda ${money(t.monto || 0)}`}</small>
            </span>
          </label>
        ))}
      </div>

      <button className="hoja-btn" onClick={() => onConfirmar(medio || null, parseFloat(monto) || 0)}>
        Confirmar pago
      </button>
    </Hoja>
  );
}

export function HojaEditar({ item, onGuardar, onEliminar, onClose }) {
  const nuevo = !item;
  const [nombre, setNombre]     = useState(item?.nombre || '');
  const [previsto, setPrevisto] = useState(item ? String(item.previsto || '') : '');
  const [real, setReal]         = useState(item ? String(montoDe(item) || '') : '');
  const pagado = item?.pagado === true;

  const guardar = () => {
    if (!nombre.trim()) return;
    const prev = parseFloat(previsto) || 0;
    if (nuevo) onGuardar({ nombre: nombre.trim(), previsto: prev, real: prev, pagado: false });
    else onGuardar({ ...item, nombre: nombre.trim(), previsto: prev, ...(pagado ? {} : { real: parseFloat(real) || 0 }) });
  };

  return (
    <Hoja titulo={nuevo ? 'Agregar gasto' : 'Editar gasto'} onClose={onClose}>
      <h3 className="hoja-titulo">{nuevo ? 'Agregar gasto' : 'Editar gasto'}</h3>
      <label className="hoja-campo">
        <span>Nombre</span>
        <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Carne" autoFocus={nuevo} />
      </label>
      <div className="hoja-fila">
        <label className="hoja-campo">
          <span>Previsto {simbolo()}</span>
          <input type="number" inputMode="decimal" min="0" value={previsto} onChange={e => setPrevisto(e.target.value)} placeholder="0" />
        </label>
        {!nuevo && (
          <label className="hoja-campo">
            <span>{pagado ? 'Pagado' : 'A pagar'} {simbolo()}</span>
            <input type="number" inputMode="decimal" min="0" value={real} onChange={e => setReal(e.target.value)} disabled={pagado} />
          </label>
        )}
      </div>
      <div className="hoja-acciones">
        {!nuevo && (
          <button className="hoja-btn-peligro" onClick={onEliminar} aria-label="Eliminar gasto">
            <Trash2 size={18} />
          </button>
        )}
        <button className="hoja-btn" onClick={guardar} disabled={!nombre.trim()}>
          {nuevo ? 'Agregar' : 'Guardar'}
        </button>
      </div>
    </Hoja>
  );
}

export default function GrupoGastosMovil({
  grupo, periodos, periodoInicial = 0, anio, mes, tarjetas,
  modoCarrito, setModoCarrito, vaciarCarrito,
  onUpdatePeriodo, onPagar, onDespagar, onEliminar, onVolver, onCargarComprobante,
}) {
  const [sel, setSel] = useState(Math.min(periodoInicial, periodos.length - 1));
  const [pagando, setPagando]   = useState(null);  // índice del item
  const [editando, setEditando] = useState(null);  // índice del item o 'nuevo'

  const frecuencia = grupo?.frecuencia || (grupo?.tipo === 'semanas' ? 'semanal' : 'mensual');
  const periodo = periodos[sel] || { items: [] };
  const items = periodo.items || [];

  const previsto  = items.reduce((s, i) => s + (i.previsto || 0), 0);
  const pagado    = items.filter(i => i.pagado === true).reduce((s, i) => s + (i.real || 0), 0);
  const pendiente = items.filter(i => i.pagado !== true).reduce((s, i) => s + montoDe(i), 0);

  // El carrito se paga junto (con el ticket), así que se cuenta en todos los períodos
  const carrito = periodos.flatMap(p => (p.items || []).filter(i => i.pagado !== true && i.enCarrito === true));
  const totalCarrito = carrito.reduce((s, i) => s + montoDe(i), 0);

  const setItem = (idx, item) => onUpdatePeriodo(sel, { ...periodo, items: items.map((it, j) => j === idx ? item : it) });

  const tocarCirculo = (item, idx) => {
    if (item.pagado === true) {
      if (window.confirm(`¿Marcar "${item.nombre}" como no pagado?`)) onDespagar(sel, idx);
    } else if (modoCarrito) {
      if (item.enCarrito) {
        const { enCarrito: _ec, ...resto } = item;
        setItem(idx, resto);
      } else {
        setItem(idx, { ...item, enCarrito: true });
      }
    } else {
      setPagando(idx);
    }
  };

  const subtitulo = (item) => {
    if (item.pagado === true) {
      const t = item.tarjetaId ? (tarjetas || []).find(x => x.id === item.tarjetaId) : null;
      return t ? `Pagado con ${t.nombre}` : 'Pagado';
    }
    if (item.enCarrito) return 'En el carrito';
    if (modoCarrito) return 'Falta montar';
    return (item.previsto || 0) > 0 ? 'Pendiente' : 'Sin previsto';
  };

  return (
    <div className={`ggm ${modoCarrito && carrito.length > 0 ? 'ggm--con-pie' : ''}`}>
      <div className="ggm-barra">
        <button className="ggm-volver" onClick={onVolver} aria-label="Volver a Gastos"><Icono nombre="atras" size={22} grosor={2.4} /></button>
        <button className={`ggm-carrito ${modoCarrito ? 'activo' : ''}`} aria-pressed={modoCarrito}
          onClick={() => setModoCarrito(!modoCarrito)}>
          <Icono nombre="carrito" size={18} grosor={2.2} /> Carrito
        </button>
      </div>

      <div className="ggm-titulo">
        <span>{FRECUENCIA_TXT[frecuencia] || 'Mensual'} · {MESES_ES[mes]}</span>
        <h1>{grupo?.nombre}</h1>
      </div>

      {periodos.length > 1 && (
        <div className="ggm-tabs" role="tablist" aria-label="Período">
          {periodos.map((p, i) => (
            <button key={i} role="tab" aria-selected={sel === i} className={sel === i ? 'sel' : ''} onClick={() => setSel(i)}>
              {PREFIJO_TAB[frecuencia] ? `${PREFIJO_TAB[frecuencia]} ${p.numero || i + 1}` : p.label}
            </button>
          ))}
        </div>
      )}

      <div className="ggm-stats">
        <div><span>Previsto</span><strong>{money(previsto)}</strong></div>
        <div><span>Pagado</span><strong className="verde">{money(pagado)}</strong></div>
        {modoCarrito
          ? <div className="violeta"><span>En carrito</span><strong>{carrito.length} · {money(totalCarrito)}</strong></div>
          : <div><span>Pendiente</span><strong className="rojo">{money(pendiente)}</strong></div>}
      </div>

      <div className="ggm-lista">
        {items.length === 0 && <p className="ggm-vacio">Sin gastos en este período.</p>}
        {items.map((item, idx) => {
          const esPagado = item.pagado === true;
          const enCarrito = !esPagado && item.enCarrito === true;
          return (
            <div key={idx} className={`ggm-item ${esPagado ? 'pagado' : ''} ${enCarrito ? 'carrito' : ''}`}>
              <button
                className={`ggm-circulo ${esPagado ? 'ok' : enCarrito ? 'carrito' : modoCarrito ? 'vacio-carrito' : 'vacio'}`}
                onClick={() => tocarCirculo(item, idx)}
                aria-label={esPagado ? `Deshacer pago de ${item.nombre}` : modoCarrito
                  ? (enCarrito ? `Sacar ${item.nombre} del carrito` : `Montar ${item.nombre} al carrito`)
                  : `Pagar ${item.nombre}`}>
                {esPagado ? <Icono nombre="check" size={16} grosor={3} /> : enCarrito ? <Icono nombre="carrito" size={15} grosor={2.4} /> : null}
              </button>
              <button className="ggm-item-cuerpo" onClick={() => setEditando(idx)}>
                <span className="ggm-item-txt">
                  <span className="ggm-item-nombre">{item.nombre}</span>
                  <span className="ggm-item-sub">{subtitulo(item)}</span>
                </span>
                <span className="ggm-item-monto">{money(montoDe(item))}</span>
              </button>
            </div>
          );
        })}
        <button className="ggm-agregar" onClick={() => setEditando('nuevo')}>
          <Icono nombre="mas" size={16} grosor={2.4} /> Agregar gasto
        </button>
      </div>

      {modoCarrito && carrito.length > 0 && (
        <div className="ggm-pie">
          {onCargarComprobante && (
            <button className="ggm-pie-btn" onClick={onCargarComprobante}>
              Pagar el carrito con el ticket · {money(totalCarrito)}
            </button>
          )}
          <button className="ggm-pie-vaciar" onClick={vaciarCarrito}>Vaciar carrito</button>
        </div>
      )}

      {pagando !== null && items[pagando] && (
        <HojaPagar
          item={items[pagando]}
          grupoNombre={grupo?.nombre}
          tarjetas={tarjetas}
          onClose={() => setPagando(null)}
          onConfirmar={(tarjetaId, monto) => { onPagar(sel, pagando, tarjetaId, monto); setPagando(null); }}
        />
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
    </div>
  );
}
