// src/components/DefaultsManager.js
import React, { useState, useEffect } from 'react';
import { money } from '../moneda';
import { ref, get, set, remove } from 'firebase/database';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { FRECUENCIAS_GRUPO } from '../constants';
import { IconoCategoria, SelectorIconoCategoria } from '../iconos';
import { Plus, Trash2, Save, Loader, Copy, Target, ChevronRight, FileText, AlertCircle, Check, X, Download } from 'lucide-react';


// Campos de item de un grupo (todos iguales, la frecuencia es del grupo, no del item)
const camposForFrecuencia = () => [
  { key: 'nombre',   label: 'Nombre',   type: 'text'   },
  { key: 'previsto', label: 'Previsto', type: 'number', default: 0 },
];

// Multiplicador mensual estimado
const multFrecuencia = (f) =>
  f === 'quincenal' ? 2 : f === 'cada10dias' ? 3 : f === 'semanal' ? 4 : 1;


// Formulario para agregar un nuevo grupo a una plantilla
function NuevoGrupoForm({ onAdd }) {
  const [show, setShow]           = useState(false);
  const [nombre, setNombre]       = useState('');
  const [icono, setIcono]         = useState('');
  const [frecuencia, setFrecuencia] = useState('mensual');

  const add = () => {
    if (!nombre.trim()) return;
    const id = nombre.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20) + '_' + Date.now().toString(36).slice(-4);
    onAdd({ id, nombre: nombre.trim(), icono, frecuencia, items: [] });
    setNombre(''); setIcono(''); setFrecuencia('mensual'); setShow(false);
  };

  if (!show) return (
    <button className="dm-add-grupo-btn" onClick={() => setShow(true)}>
      <Plus size={13} /> Agregar grupo de gastos
    </button>
  );

  return (
    <div className="dm-nuevo-grupo-form">
      <input value={nombre} onChange={e => setNombre(e.target.value)}
        placeholder="Nombre del grupo" className="dm-input" autoFocus />
      <SelectorIconoCategoria valor={icono} onChange={setIcono} />
      <select value={frecuencia} onChange={e => setFrecuencia(e.target.value)} className="dm-input dm-select">
        {FRECUENCIAS_GRUPO.map(f => (
          <option key={f.value} value={f.value}>{f.label} — {f.desc}</option>
        ))}
      </select>
      <button className="dm-add-row" onClick={add}><Check size={12} /> Crear</button>
      <button className="dm-del-row" onClick={() => setShow(false)}><X size={12} /></button>
    </div>
  );
}

function toArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return Object.keys(val)
    .sort((a, b) => Number(a) - Number(b))
    .map(k => val[k]);
}

// â”€â”€ SecciÃ³n editable genÃ©rica â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SeccionItems({ title, items, onChange, campos }) {
  const agregar = () =>
    onChange([...items, Object.fromEntries(campos.map(c => [c.key, c.default ?? '']))]);
  const eliminar = idx => onChange(items.filter((_, i) => i !== idx));
  const actualizar = (idx, key, val) =>
    onChange(items.map((it, i) => (i === idx ? { ...it, [key]: val } : it)));

  return (
    <div className="dm-section">
      <div className="dm-section-header">
        <span className="dm-section-title">{title}</span>
        <button className="dm-add-row" onClick={agregar}>
          <Plus size={12} /> Agregar
        </button>
      </div>
      <div className="dm-table-wrap">
        <table className="dm-table">
          <thead>
            <tr>
              {campos.map(c => <th key={c.key}>{c.label}</th>)}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={campos.length + 1} className="dm-empty-row">Sin Ã­tems</td></tr>
            )}
            {items.map((item, idx) => (
              <tr key={idx}>
                {campos.map(c => (
                  <td key={c.key}>
                    {c.type === 'checkbox' ? (
                      <input
                        type="checkbox"
                        checked={!!item[c.key]}
                        onChange={e => actualizar(idx, c.key, e.target.checked)}
                        className="dm-checkbox"
                      />
                    ) : c.type === 'select' ? (
                      <select
                        value={item[c.key] || c.default || ''}
                        onChange={e => actualizar(idx, c.key, e.target.value)}
                        className="dm-input dm-select"
                      >
                        {c.options.map(o => <option key={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        className={`dm-input${c.type === 'number' ? ' dm-num' : ''}`}
                        type={c.type || 'text'}
                        value={item[c.key] ?? ''}
                        onChange={e =>
                          actualizar(idx, c.key,
                            c.type === 'number' ? Number(e.target.value) : e.target.value)
                        }
                      />
                    )}
                  </td>
                ))}
                <td>
                  <button className="dm-del-row" onClick={() => eliminar(idx)}>
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// â”€â”€ Panel genÃ©rico (pestaÃ±a Globales) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function PlantillaPanel({ dbPath }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(null);
  const [editing, setEditing]     = useState(null);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [nuevaNombre, setNuevaNombre] = useState('');
  const [creando, setCreando]     = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    if (!dbPath) return;
    const cargar = async () => {
      setLoading(true);
      setTemplates([]); setSelected(null); setEditing(null);
      try {
        const snap = await get(ref(db, dbPath));
        if (snap.exists()) {
          const data = snap.val();
          const lista = Object.keys(data).map(id => ({
            id, nombre: data[id]._meta?.nombre || id, data: data[id],
          }));
          setTemplates(lista);
          setSelected(lista[0].id);
          setEditing(JSON.parse(JSON.stringify(lista[0].data)));
        }
      } catch (e) { console.error('Error cargando plantillas:', e); }
      setLoading(false);
    };
    cargar();
  }, [dbPath]);

  const seleccionar = id => {
    const t = templates.find(t => t.id === id);
    if (!t) return;
    setSelected(id); setEditing(JSON.parse(JSON.stringify(t.data)));
    setSaved(false); setConfirmDel(false);
  };

  const guardar = async () => {
    if (!editing || !selected) return;
    setSaving(true);
    try {
      await set(ref(db, `${dbPath}/${selected}`), editing);
      setTemplates(prev => prev.map(t =>
        t.id === selected ? { ...t, data: editing, nombre: editing._meta?.nombre || t.nombre } : t
      ));
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch (e) { console.error('Error guardando:', e); }
    setSaving(false);
  };

  const crearPlantilla = async () => {
    const nombre = nuevaNombre.trim();
    if (!nombre) return;
    setCreando(true);
    try {
      const slug = nombre.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20);
      const id = `${slug}_${Date.now().toString(36)}`;
      const data = {
        _meta: { nombre, creadoEn: new Date().toISOString() },
        ingresos: [],
        grupos_gastos: [],
      };
      await set(ref(db, `${dbPath}/${id}`), data);
      const nuevo = { id, nombre, data };
      setTemplates(prev => [...prev, nuevo]);
      setSelected(id); setEditing(JSON.parse(JSON.stringify(data)));
      setNuevaNombre(''); setSaved(false);
    } catch (e) { console.error('Error creando plantilla:', e); }
    setCreando(false);
  };

  const eliminarPlantilla = async () => {
    if (!selected) return;
    try {
      await remove(ref(db, `${dbPath}/${selected}`));
      const resto = templates.filter(t => t.id !== selected);
      setTemplates(resto);
      if (resto.length > 0) { setSelected(resto[0].id); setEditing(JSON.parse(JSON.stringify(resto[0].data))); }
      else { setSelected(null); setEditing(null); }
      setConfirmDel(false);
    } catch (e) { console.error('Error eliminando:', e); }
  };

  const setField = (key, val) => setEditing(prev => ({ ...prev, [key]: val }));
  const sec = key => toArray(editing?.[key] || []);

  if (loading) return <div className="loading-state"><Loader size={24} className="spin" /> Cargando plantillas...</div>;

  return (
    <div className="dm-wrap">
      <aside className="dm-left">
        <div className="dm-left-header">Plantillas globales</div>
        <div className="dm-list">
          {templates.length === 0 && <p className="dm-list-empty">Sin plantillas año</p>}
          {templates.map(t => (
            <button key={t.id} className={`dm-list-item ${selected === t.id ? 'active' : ''}`} onClick={() => seleccionar(t.id)}>
              {t.nombre}
            </button>
          ))}
        </div>
        <div className="dm-new-wrap">
          <input className="dm-new-input" placeholder="Nueva plantilla..." value={nuevaNombre}
            onChange={e => setNuevaNombre(e.target.value)} onKeyDown={e => e.key === 'Enter' && crearPlantilla()} />
          <button className="dm-new-btn" onClick={crearPlantilla} disabled={!nuevaNombre.trim() || creando} title="Crear plantilla">
            {creando ? <Loader size={13} className="spin" /> : <Plus size={13} />}
          </button>
        </div>
      </aside>

      {editing ? (
        <div className="dm-right">
          <div className="dm-right-header">
            <input className="dm-title-input" value={editing._meta?.nombre || ''}
              onChange={e => setField('_meta', { ...editing._meta, nombre: e.target.value })}
              placeholder="Nombre de la plantilla" />
            <div className="dm-right-actions">
              {saved && <span className="save-status saved"><Save size={13} /> Guardado</span>}
              {!confirmDel ? (
                <button className="dm-del-btn" onClick={() => setConfirmDel(true)} title="Eliminar"><Trash2 size={14} /></button>
              ) : (
                <div className="dm-confirm-del">
                  <span>Â¿Eliminar?</span>
                  <button className="dm-confirm-yes" onClick={eliminarPlantilla}>SÃ­</button>
                  <button className="dm-confirm-no" onClick={() => setConfirmDel(false)}>No</button>
                </div>
              )}
              <button className="dm-save-btn" onClick={guardar} disabled={saving}>
                {saving ? <Loader size={14} className="spin" /> : <Save size={14} />}
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
          <SeccionItems title="Ingresos" items={sec('ingresos')} onChange={v => setField('ingresos', v)}
            campos={[{ key: 'nombre', label: 'Nombre', type: 'text' }, { key: 'esFijo', label: 'Fijo', type: 'checkbox', default: false }, { key: 'previsto', label: 'Previsto', type: 'number', default: 0 }]} />
          {toArray(editing?.grupos_gastos || []).map((grupo, gIdx) => {
            const frecLabel = FRECUENCIAS_GRUPO.find(f => f.value === grupo.frecuencia)?.label || grupo.frecuencia || '';
            return (
              <div key={grupo.id || gIdx} className="dm-grupo-section">
                <div className="dm-grupo-header">
                  <span><IconoCategoria grupo={grupo} size={26} /> {grupo.nombre}</span>
                  <span className="dm-grupo-tipo">{frecLabel}</span>
                  <button className="dm-del-row" style={{ marginLeft: 'auto' }}
                    onClick={() => setField('grupos_gastos', toArray(editing.grupos_gastos).filter((_, i) => i !== gIdx))}
                  ><Trash2 size={11} /></button>
                </div>
                <SeccionItems title="" items={toArray(grupo.items || [])}
                  onChange={v => setField('grupos_gastos', toArray(editing.grupos_gastos).map((g, i) => i === gIdx ? { ...g, items: v } : g))}
                  campos={camposForFrecuencia()}
                />
              </div>
            );
          })}
          <NuevoGrupoForm onAdd={g => setField('grupos_gastos', [...toArray(editing?.grupos_gastos || []), g])} />
        </div>
      ) : (
        <div className="dm-right dm-right-empty"><p>CreÃ¡ tu primera plantilla â†’</p></div>
      )}
    </div>
  );
}

// â”€â”€ Gestor de plantillas de mes (Mis Plantillas) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function UserTemplatesManager({ dbPath }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(null);
  const [editing, setEditing]     = useState(null);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [dirty, setDirty]         = useState(false);
  const [nuevaNombre, setNuevaNombre] = useState('');
  const [creando, setCreando]     = useState(false);
  const [confirmDel, setConfirmDel]   = useState(false);
  const [duplicando, setDuplicando]   = useState(false);
  const [seccionAbierta, setSeccionAbierta] = useState('ingresos');
  const [migrandoGeneral, setMigrandoGeneral] = useState(false);

  useEffect(() => {
    if (!dbPath) return;
    const cargar = async () => {
      setLoading(true);
      setTemplates([]); setSelected(null); setEditing(null); setDirty(false);
      try {
        const snap = await get(ref(db, dbPath));
        if (snap.exists()) {
          const data = snap.val();
          const lista = Object.keys(data).map(id => ({
            id, nombre: data[id]._meta?.nombre || id, data: data[id],
          }));
          setTemplates(lista);
          setSelected(lista[0].id);
          setEditing(JSON.parse(JSON.stringify(lista[0].data)));
        }
      } catch (e) { console.error('Error cargando plantillas de mes:', e); }
      setLoading(false);
    };
    cargar();
  }, [dbPath]);

  const seleccionar = id => {
    const t = templates.find(t => t.id === id);
    if (!t) return;
    setSelected(id); setEditing(JSON.parse(JSON.stringify(t.data)));
    setSaved(false); setDirty(false); setConfirmDel(false);
  };

  const setField = (key, val) => {
    setEditing(prev => ({ ...prev, [key]: val }));
    setDirty(true);
  };
  const sec = key => toArray(editing?.[key] || []);

  const guardar = async () => {
    if (!editing || !selected) return;
    setSaving(true);
    try {
      await set(ref(db, `${dbPath}/${selected}`), editing);
      setTemplates(prev => prev.map(t =>
        t.id === selected ? { ...t, data: editing, nombre: editing._meta?.nombre || t.nombre } : t
      ));
      setSaved(true); setDirty(false);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) { console.error('Error guardando:', e); }
    setSaving(false);
  };

  const crearPlantilla = async () => {
    const nombre = nuevaNombre.trim();
    if (!nombre) return;
    setCreando(true);
    try {
      const slug = nombre.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20);
      const id = `${slug}_${Date.now().toString(36)}`;
      const data = {
        _meta: { nombre, creadoEn: new Date().toISOString() },
        objetivoAhorro: 0,
        ingresos: [],
        grupos_gastos: [],
      };
      await set(ref(db, `${dbPath}/${id}`), data);
      const nuevo = { id, nombre, data };
      setTemplates(prev => [...prev, nuevo]);
      setSelected(id); setEditing(JSON.parse(JSON.stringify(data)));
      setNuevaNombre(''); setSaved(false); setDirty(false);
    } catch (e) { console.error('Error creando plantilla:', e); }
    setCreando(false);
  };

  // Migrar plantilla General -> mis plantillas
  const migrarDesdeGeneral = async () => {
    setMigrandoGeneral(true);
    try {
      const snap = await get(ref(db, 'defaults/general'));
      if (!snap.exists()) { alert('No hay una plantilla General configurada todavía.'); return; }
      const genData = snap.val();
      const nombre = 'Plantilla General (migrada)';
      const slug = 'general_migrada';
      const id = `${slug}_${Date.now().toString(36)}`;
      const data = {
        ...JSON.parse(JSON.stringify(genData)),
        _meta: { nombre, creadoEn: new Date().toISOString() },
        objetivoAhorro: genData.objetivoAhorro || 0,
      };
      await set(ref(db, `${dbPath}/${id}`), data);
      const nuevo = { id, nombre, data };
      setTemplates(prev => [...prev, nuevo]);
      setSelected(id); setEditing(JSON.parse(JSON.stringify(data)));
      setSaved(false); setDirty(false);
    } catch (e) { console.error('Error migrando desde General:', e); }
    setMigrandoGeneral(false);
  };

  const duplicarPlantilla = async () => {
    if (!editing || !selected) return;
    setDuplicando(true);
    try {
      const nombreBase = editing._meta?.nombre || 'Plantilla';
      const nombre = `${nombreBase} (copia)`;
      const slug = nombre.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20);
      const id = `${slug}_${Date.now().toString(36)}`;
      const data = {
        ...JSON.parse(JSON.stringify(editing)),
        _meta: { nombre, creadoEn: new Date().toISOString() },
      };
      await set(ref(db, `${dbPath}/${id}`), data);
      const nuevo = { id, nombre, data };
      setTemplates(prev => [...prev, nuevo]);
      setSelected(id); setEditing(JSON.parse(JSON.stringify(data)));
      setSaved(false); setDirty(false);
    } catch (e) { console.error('Error duplicando:', e); }
    setDuplicando(false);
  };

  const eliminarPlantilla = async () => {
    if (!selected) return;
    try {
      await remove(ref(db, `${dbPath}/${selected}`));
      const resto = templates.filter(t => t.id !== selected);
      setTemplates(resto);
      if (resto.length > 0) { setSelected(resto[0].id); setEditing(JSON.parse(JSON.stringify(resto[0].data))); }
      else { setSelected(null); setEditing(null); }
      setConfirmDel(false); setDirty(false);
    } catch (e) { console.error('Error eliminando:', e); }
  };

  // Resumen de totales previstos de la plantilla
  const calcTotales = (ed) => {
    if (!ed) return { ing: 0, gas: 0 };
    const ing  = toArray(ed.ingresos).reduce((s, i) => s + (i.previsto || 0), 0);
    const gas  = toArray(ed.grupos_gastos || []).reduce((total, g) => {
      const m = multFrecuencia(g.frecuencia || 'mensual');
      return total + toArray(g.items || []).reduce((s, it) => s + (it.previsto || 0), 0) * m;
    }, 0);
    return { ing, gas };
  };

  if (loading) return <div className="loading-state"><Loader size={24} className="spin" /> Cargando mis plantillas...</div>;

  // â”€â”€ Estado vacÃ­o â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (templates.length === 0) {
    return (
      <div className="utm-empty-outer">
        <div className="utm-empty-card">
          <FileText size={40} className="utm-empty-icon" />
          <h3 className="utm-empty-title">Sin plantillas de mes</h3>
          <p className="utm-empty-desc">
            Las plantillas de mes te permiten inicializar cualquier mes con tus valores habituales
            â€” ingresos, gastos y objetivo de ahorro â€” en un clic.
          </p>
          <div className="utm-empty-input-row">
            <input
              className="utm-empty-input"
              placeholder="Nombre de la primera plantilla..."
              value={nuevaNombre}
              onChange={e => setNuevaNombre(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && crearPlantilla()}
              autoFocus
            />
            <button className="utm-empty-btn" onClick={crearPlantilla} disabled={!nuevaNombre.trim() || creando}>
              {creando ? <Loader size={14} className="spin" /> : <><Plus size={14} /> Crear</>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totales = calcTotales(editing);
  const objetivo = editing?.objetivoAhorro || 0;
  const ahorroEst = totales.ing - totales.gas;

  return (
    <div className="dm-wrap">
      {/* â”€â”€ Panel izquierdo â”€â”€ */}
      <aside className="dm-left">
        <div className="dm-left-header">Mis Plantillas</div>

        <div className="dm-list">
          {templates.map(t => {
            const tot = calcTotales(t.data);
            const obj = t.data?.objetivoAhorro || 0;
            return (
              <button
                key={t.id}
                className={`utm-card ${selected === t.id ? 'active' : ''}`}
                onClick={() => seleccionar(t.id)}
              >
                <div className="utm-card-name">
                  <FileText size={13} />
                  <span>{t.nombre}</span>
                </div>
                <div className="utm-card-stats">
                  <span className="utm-stat-ing">{money(tot.ing)}</span>
                  <span className="utm-stat-gas">{money(tot.gas)}</span>
                </div>
                {obj > 0 && (
                  <div className="utm-card-obj">
                    <Target size={10} /> Obj: {money(obj)}
                  </div>
                )}
                {selected === t.id && <ChevronRight size={12} className="utm-card-arrow" />}
              </button>
            );
          })}
        </div>

        {/* Nueva plantilla */}
        <div className="dm-new-wrap">
          <input
            className="dm-new-input"
            placeholder="Nueva plantilla..."
            value={nuevaNombre}
            onChange={e => setNuevaNombre(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && crearPlantilla()}
          />
          <button className="dm-new-btn" onClick={crearPlantilla} disabled={!nuevaNombre.trim() || creando} title="Crear plantilla">
            {creando ? <Loader size={13} className="spin" /> : <Plus size={13} />}
          </button>
        </div>

        {/* Migrar desde General */}
        <button
          className="dm-migrar-btn"
          onClick={migrarDesdeGeneral}
          disabled={migrandoGeneral}
          title="Importar la plantilla Global como plantilla personal"
        >
          {migrandoGeneral
            ? <><Loader size={12} className="spin" /> Importando...</>
            : <><Download size={12} /> Importar desde General</>}
        </button>
      </aside>

      {/* â”€â”€ Panel derecho: editor â”€â”€ */}
      {editing ? (
        <div className="dm-right">

          {/* â”€â”€ Header del editor â”€â”€ */}
          <div className="dm-right-header">
            <input
              className="dm-title-input"
              value={editing._meta?.nombre || ''}
              onChange={e => setField('_meta', { ...editing._meta, nombre: e.target.value })}
              placeholder="Nombre de la plantilla"
            />
            <div className="dm-right-actions">
              {dirty && !saving && (
                <span className="utm-dirty-badge">
                  <AlertCircle size={12} /> Sin guardar
                </span>
              )}
              {saved && <span className="save-status saved"><Save size={13} /> Guardado</span>}

              {/* Duplicar */}
              <button className="utm-dup-btn" onClick={duplicarPlantilla} disabled={duplicando} title="Duplicar plantilla">
                {duplicando ? <Loader size={13} className="spin" /> : <Copy size={14} />}
              </button>

              {/* Eliminar */}
              {!confirmDel ? (
                <button className="dm-del-btn" onClick={() => setConfirmDel(true)} title="Eliminar plantilla">
                  <Trash2 size={14} />
                </button>
              ) : (
                <div className="dm-confirm-del">
                  <span>Â¿Eliminar?</span>
                  <button className="dm-confirm-yes" onClick={eliminarPlantilla}>SÃ­</button>
                  <button className="dm-confirm-no" onClick={() => setConfirmDel(false)}>No</button>
                </div>
              )}

              <button className="dm-save-btn" onClick={guardar} disabled={saving || !dirty}>
                {saving ? <Loader size={14} className="spin" /> : <Save size={14} />}
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>

          {/* â”€â”€ Objetivo de ahorro + resumen estimado â”€â”€ */}
          <div className="utm-objetivo-bar">
            <div className="utm-objetivo-field">
              <Target size={15} className="utm-obj-icon" />
              <div className="utm-obj-content">
                <span className="utm-obj-label">Objetivo de ahorro mensual</span>
                <div className="utm-obj-input-wrap">
                  <span className="utm-obj-prefix">$</span>
                  <input
                    className="utm-obj-input"
                    type="number"
                    min="0"
                    value={objetivo || ''}
                    placeholder="0"
                    onChange={e => setField('objetivoAhorro', parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>
            <div className="utm-resumen-pills">
              <div className="utm-pill utm-pill-ing">
                <span className="utm-pill-lbl">Ingresos est.</span>
                <span className="utm-pill-val">{money(totales.ing)}</span>
              </div>
              <div className="utm-pill utm-pill-gas">
                <span className="utm-pill-lbl">Gastos est.</span>
                <span className="utm-pill-val">{money(totales.gas)}</span>
              </div>
              <div className={`utm-pill ${ahorroEst >= 0 ? 'utm-pill-ok' : 'utm-pill-neg'}`}>
                <span className="utm-pill-lbl">Ahorro est.</span>
                <span className="utm-pill-val">{ahorroEst < 0 ? '-' : ''}{money(Math.abs(ahorroEst))}</span>
              </div>
              {objetivo > 0 && (
                <div className={`utm-pill ${ahorroEst >= objetivo ? 'utm-pill-ok' : 'utm-pill-warn'}`}>
                  <span className="utm-pill-lbl">vs objetivo</span>
                  <span className="utm-pill-val">{Math.round((ahorroEst / objetivo) * 100)}%</span>
                </div>
              )}
            </div>
          </div>

          {/* â”€â”€ Secciones con acordeÃ³n â”€â”€ */}
          <div className="utm-accordion">
            {(() => {
              const items = sec('ingresos');
              const isOpen = seccionAbierta === 'ingresos';
              const total = items.reduce((s, it) => s + (it.previsto || 0), 0);
              return (
                <div key="ingresos" className="utm-acc-section">
                  <button className={`utm-acc-header ${isOpen ? 'open' : ''}`} onClick={() => setSeccionAbierta(isOpen ? null : 'ingresos')}>
                    <div className="utm-acc-left">
                      <ChevronRight size={14} className={`utm-acc-chevron ${isOpen ? 'rotated' : ''}`} />
                      <span className="utm-acc-label">Ingresos</span>
                      <span className="utm-acc-count">{items.length} ítems</span>
                    </div>
                    <span className="utm-acc-total">{money(total)}</span>
                  </button>
                  {isOpen && (
                    <div className="utm-acc-body">
                      <SeccionItems title="" items={items} onChange={v => setField('ingresos', v)}
                        campos={[
                          { key: 'nombre', label: 'Nombre', type: 'text' },
                          { key: 'esFijo', label: 'Fijo', type: 'checkbox', default: false },
                          { key: 'previsto', label: 'Previsto', type: 'number', default: 0 },
                        ]}
                      />
                    </div>
                  )}
                </div>
              );
            })()}
            {toArray(editing?.grupos_gastos || []).map((grupo, gIdx) => {
              const secKey   = `grupo_${grupo.id || gIdx}`;
              const isOpen   = seccionAbierta === secKey;
              const items    = toArray(grupo.items || []);
              const campos   = camposForFrecuencia();
              const m        = multFrecuencia(grupo.frecuencia || 'mensual');
              const total    = items.reduce((s, it) => s + (it.previsto || 0), 0) * m;
              const frecLabel = FRECUENCIAS_GRUPO.find(f => f.value === grupo.frecuencia)?.label || grupo.frecuencia || '';
              return (
                <div key={secKey} className="utm-acc-section">
                  <button className={`utm-acc-header ${isOpen ? 'open' : ''}`} onClick={() => setSeccionAbierta(isOpen ? null : secKey)}>
                    <div className="utm-acc-left">
                      <ChevronRight size={14} className={`utm-acc-chevron ${isOpen ? 'rotated' : ''}`} />
                      <span className="utm-acc-label"><IconoCategoria grupo={grupo} size={26} /> {grupo.nombre}</span>
                      <span className="utm-acc-count">{items.length} items</span>
                      <span className="dm-grupo-tipo">{frecLabel}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="utm-acc-total">{money(total)}/mes</span>
                      <button className="dm-del-row" title="Eliminar este grupo"
                        onClick={e => { e.stopPropagation(); setField('grupos_gastos', toArray(editing.grupos_gastos).filter((_, i) => i !== gIdx)); setDirty(true); }}
                      ><Trash2 size={11} /></button>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="utm-acc-body">
                      <SeccionItems title="" items={items}
                        onChange={v => setField('grupos_gastos', toArray(editing.grupos_gastos).map((g, i) => i === gIdx ? { ...g, items: v } : g))}
                        campos={campos}
                      />
                    </div>
                  )}
                </div>
              );
            })}
            <div className="utm-acc-section">
              <NuevoGrupoForm onAdd={grupo => { setField('grupos_gastos', [...toArray(editing?.grupos_gastos || []), grupo]); setDirty(true); }} />
            </div>
          </div>
        </div>
      ) : (
        <div className="dm-right dm-right-empty"><p>SeleccionÃ¡ o creÃ¡ una plantilla â†’</p></div>
      )}
    </div>
  );
}

// â”€â”€ Componente principal con pestaÃ±as â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Las plantillas globales (defaults/*) son las que se ofrecen a todos los usuarios
// al crear un presupuesto: solo un admin puede editarlas (también lo exigen las reglas).
export default function DefaultsManager({ esAdmin = false }) {
  const { user } = useAuth();
  const [tab, setTab] = useState('mias'); // 'mias' | 'globales'

  const userDbPath = user ? `user_templates/${user.uid}` : null;

  return (
    <div className="dm-container">
      <div className="dm-tabs">
        <button className={`dm-tab ${tab === 'mias' ? 'active' : ''}`} onClick={() => setTab('mias')}>
          Mis Plantillas
        </button>
        {esAdmin && (
          <button className={`dm-tab ${tab === 'globales' ? 'active' : ''}`} onClick={() => setTab('globales')}>
            Plantillas Globales
          </button>
        )}
      </div>

      {tab === 'mias' && userDbPath && (
        <UserTemplatesManager key={userDbPath} dbPath={userDbPath} />
      )}
      {tab === 'globales' && esAdmin && (
        <PlantillaPanel key="globales" dbPath="defaults" />
      )}
    </div>
  );
}

