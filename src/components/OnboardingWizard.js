// src/components/OnboardingWizard.js
// Wizard de primer uso (3 pasos):
//  1. Configurar grupos de gastos (icono, nombre, frecuencia)
//  2. Agregar items por grupo
//  3. Nombrar el presupuesto y confirmar
// Al confirmar guarda en Firebase:
//   - presupuestos/{uid}/{id}/_defaults
//   - defaults/general  (para futuros usuarios nuevos)
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Check, X, ChevronRight, ChevronLeft, Briefcase, Loader } from 'lucide-react';
import { ref, get } from 'firebase/database';
import { db } from '../firebase';
import { FRECUENCIAS_GRUPO } from '../constants';

const ICONOS_RAPIDOS = [
  // Hogar
  '🏠','🛋️','💡','🚿','🔥','🧹','🔒','🔨',
  // Transporte
  '🚗','🚌','⛽','🛣️','🚲','✈️',
  // Finanzas
  '💰','💳','💵','💸','💹','🏦','📈','📉','🧾','📋','💼','📦',
  // Alimentacion
  '🛒','🍔','🍴','🍽️','🥐','🍷','🍵',
  // Salud
  '💊','🏥','🧬','🦷','👁️','🏋️',
  // Educacion
  '📚','🎓','💻','📱','🖥️',
  // Ocio
  '🎮','🎭','🎧','📺','🎨','🤺','🚢',
  // Personal
  '👜','💄','🧴','✂️',
  // Familia
  '👶','🏫','🐾','🎁',
  // Servicios
  '📜','🛡️','📞','🌐','🚑',
];

const fmt = (n) =>
  new Intl.NumberFormat('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 0, useGrouping: false }).format(n || 0);

// --- Helpers --------------------------------------------------
function toArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return Object.keys(val).sort((a, b) => Number(a) - Number(b)).map(k => val[k]);
}

function genId(nombre) {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .slice(0, 20) + '_' + Date.now().toString(36).slice(-4);
}

// ---------------------------------------------------------------
// PASO 1: Grupos de gastos
// ---------------------------------------------------------------

function GrupoFila({ grupo, onUpdate, onDelete }) {
  const [editando, setEditando] = useState(false);
  const frecLabel = FRECUENCIAS_GRUPO.find(f => f.value === grupo.frecuencia)?.label || grupo.frecuencia;

  return (
    <div className="ob-grupo-row">
      <span className="ob-grupo-icono">{grupo.icono}</span>
      {editando ? (
        <>
          <input
            className="ob-grupo-nombre-input"
            value={grupo.nombre}
            onChange={e => onUpdate({ ...grupo, nombre: e.target.value })}
            autoFocus
            onBlur={() => setEditando(false)}
            onKeyDown={e => e.key === 'Enter' && setEditando(false)}
          />
          <select
            className="ob-grupo-tipo-sel"
            value={grupo.frecuencia}
            onChange={e => onUpdate({ ...grupo, frecuencia: e.target.value })}
          >
            {FRECUENCIAS_GRUPO.map(f => (
              <option key={f.value} value={f.value}>{f.label}  {f.desc}</option>
            ))}
          </select>
        </>
      ) : (
        <button className="ob-grupo-nombre-btn" onClick={() => setEditando(true)}>
          <span className="ob-grupo-nombre">{grupo.nombre}</span>
          <span className="ob-grupo-tipo-badge">{frecLabel}</span>
        </button>
      )}
      <button className="ob-grupo-del" onClick={onDelete} title="Quitar grupo">
        <X size={14} />
      </button>
    </div>
  );
}

function AgregarGrupoForm({ onAdd }) {
  const [show, setShow]           = useState(false);
  const [nombre, setNombre]       = useState('');
  const [icono, setIcono]         = useState('??');
  const [frecuencia, setFrecuencia] = useState('mensual');

  const add = () => {
    if (!nombre.trim()) return;
    onAdd({ id: genId(nombre), nombre: nombre.trim(), icono, frecuencia, items: [] });
    setNombre(''); setIcono('??'); setFrecuencia('mensual'); setShow(false);
  };

  if (!show) return (
    <button className="ob-add-grupo-btn" onClick={() => setShow(true)}>
      <Plus size={14} /> Agregar grupo de gastos
    </button>
  );

  return (
    <div className="ob-nuevo-grupo-form">
      <div className="ob-iconos-row">
        {ICONOS_RAPIDOS.map(ic => (
          <button
            key={ic}
            className={`ob-icono-opt${icono === ic ? ' selected' : ''}`}
            onClick={() => setIcono(ic)}
          >{ic}</button>
        ))}
      </div>
      <div className="ob-nuevo-grupo-inputs">
        <input
          className="ob-input"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="Nombre del grupo"
          autoFocus
        />
        <select
          className="ob-grupo-tipo-sel"
          value={frecuencia}
          onChange={e => setFrecuencia(e.target.value)}
        >
          {FRECUENCIAS_GRUPO.map(f => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <button className="ob-btn-confirm" onClick={add}><Check size={14} /></button>
        <button className="ob-btn-cancel"  onClick={() => setShow(false)}><X size={14} /></button>
      </div>
    </div>
  );
}

function Paso1({ grupos, onChange, onNext }) {
  return (
    <div className="ob-step">
      <div className="ob-step-icon">??</div>
      <h2 className="ob-step-title">Grupos de gastos</h2>
      <p className="ob-step-desc">
        Defini como se organiza tu presupuesto. Cada grupo tiene una
        <strong> frecuencia</strong> que divide el mes en periodos independientes.
        Podes cambiarlos en cualquier momento desde Plantillas.
      </p>

      <div className="ob-grupos-list">
        {grupos.length === 0 && (
          <p className="ob-empty-hint">Todavia no hay grupos. Agrega al menos uno para continuar.</p>
        )}
        {grupos.map((g, idx) => (
          <GrupoFila
            key={g.id || idx}
            grupo={g}
            onUpdate={updated => onChange(grupos.map((gg, i) => i === idx ? updated : gg))}
            onDelete={() => onChange(grupos.filter((_, i) => i !== idx))}
          />
        ))}
        <AgregarGrupoForm onAdd={g => onChange([...grupos, g])} />
      </div>

      <div className="ob-actions">
        <button
          className="ob-btn-primary"
          onClick={onNext}
          disabled={grupos.length === 0}
        >
          Siguiente <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// PASO 2: Items por grupo
// ---------------------------------------------------------------

function ItemsGrupo({ grupo, onChange }) {
  const [newNombre, setNewNombre] = useState('');
  const [newPrev, setNewPrev]     = useState('');
  const items = grupo.items || [];

  const add = () => {
    if (!newNombre.trim()) return;
    onChange([...items, { nombre: newNombre.trim(), previsto: parseFloat(newPrev) || 0 }]);
    setNewNombre(''); setNewPrev('');
  };

  const del = (idx)            => onChange(items.filter((_, i) => i !== idx));
  const upd = (idx, key, val)  => onChange(items.map((it, i) => i === idx ? { ...it, [key]: val } : it));

  return (
    <div className="ob-items-grupo">
      {items.length > 0 && (
        <table className="ob-items-table">
          <thead>
            <tr><th>Nombre</th><th>Previsto $</th><th></th></tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={idx}>
                <td>
                  <input
                    className="ob-input ob-input-sm"
                    value={it.nombre}
                    onChange={e => upd(idx, 'nombre', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    className="ob-input ob-input-sm ob-input-num"
                    value={it.previsto || ''}
                    placeholder="0"
                    onChange={e => upd(idx, 'previsto', parseFloat(e.target.value) || 0)}
                  />
                </td>
                <td>
                  <button className="ob-grupo-del" onClick={() => del(idx)}><X size={13} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="ob-add-item-row">
        <input
          className="ob-input ob-input-sm"
          value={newNombre}
          onChange={e => setNewNombre(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="Nuevo item..."
        />
        <input
          type="number"
          className="ob-input ob-input-sm ob-input-num"
          value={newPrev}
          onChange={e => setNewPrev(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="$ previsto"
        />
        <button className="ob-btn-confirm" onClick={add} disabled={!newNombre.trim()}>
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

function Paso2({ grupos, onChange, onBack, onNext }) {
  const [grupoActivo, setGrupoActivo] = useState(0);

  const updateItems = (idx, items) =>
    onChange(grupos.map((g, i) => i === idx ? { ...g, items } : g));

  return (
    <div className="ob-step">
      <div className="ob-step-icon">??</div>
      <h2 className="ob-step-title">Items por grupo</h2>
      <p className="ob-step-desc">
        Agrega los gastos habituales de cada grupo. Los montos previstos son opcionales 
        podes completarlos despues o cambiarlos cada mes.
      </p>

      {/* Tabs de grupos */}
      <div className="ob-group-tabs">
        {grupos.map((g, idx) => (
          <button
            key={g.id}
            className={`ob-group-tab${grupoActivo === idx ? ' active' : ''}`}
            onClick={() => setGrupoActivo(idx)}
          >
            {g.icono} {g.nombre}
            {(g.items || []).length > 0 && (
              <span className="ob-tab-count">{g.items.length}</span>
            )}
          </button>
        ))}
      </div>

      {grupos[grupoActivo] && (
        <ItemsGrupo
          key={grupos[grupoActivo].id}
          grupo={grupos[grupoActivo]}
          onChange={items => updateItems(grupoActivo, items)}
        />
      )}

      <div className="ob-actions">
        <button className="ob-btn-secondary" onClick={onBack}>
          <ChevronLeft size={16} /> Atras
        </button>
        <button className="ob-btn-primary" onClick={onNext}>
          Siguiente <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// PASO 3: Nombre del presupuesto + confirmar
// ---------------------------------------------------------------

function Paso3({ nombre, onChange, grupos, onBack, onConfirm, creando }) {
  const totalItems = grupos.reduce((s, g) => s + (g.items || []).length, 0);
  const totalPrev  = grupos.reduce((s, g) =>
    s + (g.items || []).reduce((ss, it) => ss + (it.previsto || 0), 0), 0);

  return (
    <div className="ob-step">
      <div className="ob-step-icon">??</div>
      <h2 className="ob-step-title">Nombre del presupuesto</h2>
      <p className="ob-step-desc">
        Pone un nombre para identificar este presupuesto.
        Podes tener varios (personal, del hogar, del negocio, etc.).
      </p>

      <div className="ob-field">
        <label className="ob-label">Nombre</label>
        <input
          className="ob-input"
          type="text"
          value={nombre}
          onChange={e => onChange(e.target.value)}
          placeholder="Ej: Casa Familiar, Mi Presupuesto..."
          onKeyDown={e => e.key === 'Enter' && nombre.trim() && onConfirm()}
          autoFocus
        />
      </div>

      {/* Resumen de lo que se va a crear */}
      <div className="ob-resumen">
        <div className="ob-resumen-title">Resumen de la plantilla</div>
        {grupos.map(g => (
          <div key={g.id} className="ob-resumen-grupo">
            <span className="ob-resumen-grupo-nombre">{g.icono} {g.nombre}</span>
            <span className="ob-grupo-tipo-badge">
              {FRECUENCIAS_GRUPO.find(f => f.value === g.frecuencia)?.label}
            </span>
            <span className="ob-resumen-items">{(g.items || []).length} items</span>
          </div>
        ))}
        {totalItems > 0 && (
          <div className="ob-resumen-total">
            {totalItems} items &middot; ${fmt(totalPrev)} previsto/mes estimado
          </div>
        )}
      </div>

      <div className="ob-actions">
        <button className="ob-btn-secondary" onClick={onBack}>
          <ChevronLeft size={16} /> Atras
        </button>
        <button
          className="ob-btn-primary"
          onClick={onConfirm}
          disabled={!nombre.trim() || grupos.length === 0 || creando}
        >
          {creando
            ? <><Loader size={15} className="spin" /> Creando...</>
            : <><Briefcase size={15} /> Crear mi presupuesto</>
          }
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Wizard principal
// ---------------------------------------------------------------

export default function OnboardingWizard({ onCreate }) {
  const [paso, setPaso]       = useState(1);
  const [nombre, setNombre]   = useState('Mi Presupuesto');
  const [grupos, setGrupos]   = useState([]);
  const [creando, setCreando] = useState(false);
  const [cargando, setCargando] = useState(true);

  // Intentar precargar desde defaults/general en Firebase
  useEffect(() => {
    const cargarGeneral = async () => {
      try {
        const snap = await get(ref(db, 'defaults/general'));
        if (snap.exists()) {
          const data = snap.val();
          const gs = toArray(data.grupos_gastos || []);
          if (gs.length > 0) {
            setGrupos(gs.map(g => ({ ...g, items: toArray(g.items || []) })));
          }
        }
      } catch (e) {
        console.warn('No se pudo cargar defaults/general:', e);
      }
      setCargando(false);
    };
    cargarGeneral();
  }, []);

  const confirmar = async () => {
    if (!nombre.trim() || grupos.length === 0) return;
    setCreando(true);
    try {
      await onCreate({ nombre: nombre.trim(), grupos });
    } catch (e) {
      console.error('Error en onboarding:', e);
    }
    setCreando(false);
  };

  if (cargando) {
    return (
      <div className="ob-overlay">
        <div className="ob-card" style={{ textAlign: 'center', padding: '48px 32px' }}>
          <Loader size={28} className="spin" />
          <p style={{ marginTop: 12, color: 'var(--text2)' }}>Preparando...</p>
        </div>
      </div>
    );
  }

  const PASOS = [1, 2, 3];

  return (
    <div className="ob-overlay">
      {/* Indicador de pasos */}
      <div className="ob-progress">
        {PASOS.map((n, i) => (
          <React.Fragment key={n}>
            {i > 0 && <div className="ob-progress-line" />}
            <div className={`ob-progress-step${paso >= n ? ' done' : ''}`}>{n}</div>
          </React.Fragment>
        ))}
      </div>

      <div className="ob-card">
        {paso === 1 && (
          <Paso1
            grupos={grupos}
            onChange={setGrupos}
            onNext={() => setPaso(2)}
          />
        )}
        {paso === 2 && (
          <Paso2
            grupos={grupos}
            onChange={setGrupos}
            onBack={() => setPaso(1)}
            onNext={() => setPaso(3)}
          />
        )}
        {paso === 3 && (
          <Paso3
            nombre={nombre}
            onChange={setNombre}
            grupos={grupos}
            onBack={() => setPaso(2)}
            onConfirm={confirmar}
            creando={creando}
          />
        )}
      </div>
    </div>
  );
}

