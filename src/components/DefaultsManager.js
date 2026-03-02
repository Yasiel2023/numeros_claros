// src/components/DefaultsManager.js
import React, { useState, useEffect } from 'react';
import { ref, get, set, remove } from 'firebase/database';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Plus, Trash2, Save, Loader, Copy, Target, ChevronRight, FileText, AlertCircle } from 'lucide-react';

const fmt = (n) =>
  new Intl.NumberFormat('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 0, useGrouping: false }).format(n || 0);

const FRECUENCIAS = ['mensual', 'bimestral', 'trimestral', 'semestral', 'anual'];
const FRECUENCIAS_COMPRA = ['semanal', 'quincenal', 'mensual'];

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
      const { BASICOS_DEFAULT, IMPUESTOS_DEFAULT, ASCEO_DEFAULT, COMPRAS_SEMANA_DEFAULT, INGRESOS_FIJOS } = require('../constants');
      const slug = nombre.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20);
      const id = `${slug}_${Date.now().toString(36)}`;
      const data = {
        _meta: { nombre, creadoEn: new Date().toISOString() },
        ingresos: [...INGRESOS_FIJOS.map(i => ({ ...i, previsto: 0 })), { nombre: 'Otro', esFijo: false, previsto: 0 }],
        basicos: BASICOS_DEFAULT, impuestos: IMPUESTOS_DEFAULT,
        asceo: ASCEO_DEFAULT, semanas_items: COMPRAS_SEMANA_DEFAULT,
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
          <SeccionItems title="Básicos" items={sec('basicos')} onChange={v => setField('basicos', v)}
            campos={[{ key: 'nombre', label: 'Nombre', type: 'text' }, { key: 'previsto', label: 'Previsto', type: 'number', default: 0 }]} />
          <SeccionItems title="Impuestos" items={sec('impuestos')} onChange={v => setField('impuestos', v)}
            campos={[{ key: 'nombre', label: 'Nombre', type: 'text' }, { key: 'previsto', label: 'Previsto', type: 'number', default: 0 }, { key: 'frecuencia', label: 'Frecuencia', type: 'select', options: FRECUENCIAS, default: 'mensual' }]} />
          <SeccionItems title="Aseo" items={sec('asceo')} onChange={v => setField('asceo', v)}
            campos={[{ key: 'nombre', label: 'Nombre', type: 'text' }, { key: 'previsto', label: 'Previsto', type: 'number', default: 0 }]} />
          <SeccionItems title="Compras semanales (Ã­tems base)" items={sec('semanas_items')} onChange={v => setField('semanas_items', v)}
            campos={[{ key: 'nombre', label: 'Nombre', type: 'text' }, { key: 'previsto', label: 'Previsto', type: 'number', default: 0 }, { key: 'frecuencia', label: 'Frecuencia', type: 'select', options: FRECUENCIAS_COMPRA, default: 'semanal' }]} />
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
      const { BASICOS_DEFAULT, IMPUESTOS_DEFAULT, ASCEO_DEFAULT, COMPRAS_SEMANA_DEFAULT, INGRESOS_FIJOS } = require('../constants');
      const slug = nombre.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20);
      const id = `${slug}_${Date.now().toString(36)}`;
      const data = {
        _meta: { nombre, creadoEn: new Date().toISOString() },
        objetivoAhorro: 0,
        ingresos: [...INGRESOS_FIJOS.map(i => ({ ...i, previsto: 0 })), { nombre: 'Otro', esFijo: false, previsto: 0 }],
        basicos: BASICOS_DEFAULT, impuestos: IMPUESTOS_DEFAULT,
        asceo: ASCEO_DEFAULT, semanas_items: COMPRAS_SEMANA_DEFAULT,
      };
      await set(ref(db, `${dbPath}/${id}`), data);
      const nuevo = { id, nombre, data };
      setTemplates(prev => [...prev, nuevo]);
      setSelected(id); setEditing(JSON.parse(JSON.stringify(data)));
      setNuevaNombre(''); setSaved(false); setDirty(false);
    } catch (e) { console.error('Error creando plantilla:', e); }
    setCreando(false);
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
    const ing = toArray(ed.ingresos).reduce((s, i) => s + (i.previsto || 0), 0);
    const bas = toArray(ed.basicos).reduce((s, b) => s + (b.previsto || 0), 0);
    const imp = toArray(ed.impuestos).filter(i => !i.frecuencia || i.frecuencia === 'mensual')
                  .reduce((s, i) => s + (i.previsto || 0), 0);
    const asc = toArray(ed.asceo).reduce((s, a) => s + (a.previsto || 0), 0);
    const sem = toArray(ed.semanas_items).reduce((s, it) => {
      const f = it.frecuencia || 'semanal';
      const mult = f === 'semanal' ? 4 : f === 'quincenal' ? 2 : 1;
      return s + (it.previsto || 0) * mult;
    }, 0);
    return { ing, gas: bas + imp + asc + sem };
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
                  <span className="utm-stat-ing">${fmt(tot.ing)}</span>
                  <span className="utm-stat-gas">${fmt(tot.gas)}</span>
                </div>
                {obj > 0 && (
                  <div className="utm-card-obj">
                    <Target size={10} /> Obj: ${fmt(obj)}
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
                <span className="utm-pill-val">${fmt(totales.ing)}</span>
              </div>
              <div className="utm-pill utm-pill-gas">
                <span className="utm-pill-lbl">Gastos est.</span>
                <span className="utm-pill-val">${fmt(totales.gas)}</span>
              </div>
              <div className={`utm-pill ${ahorroEst >= 0 ? 'utm-pill-ok' : 'utm-pill-neg'}`}>
                <span className="utm-pill-lbl">Ahorro est.</span>
                <span className="utm-pill-val">{ahorroEst < 0 ? '-' : ''}${fmt(Math.abs(ahorroEst))}</span>
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
            {[
              { key: 'ingresos', label: 'Ingresos', campos: [
                { key: 'nombre', label: 'Nombre', type: 'text' },
                { key: 'esFijo', label: 'Fijo', type: 'checkbox', default: false },
                { key: 'previsto', label: 'Previsto', type: 'number', default: 0 },
              ]},
              { key: 'basicos', label: 'Gastos Básicos', campos: [
                { key: 'nombre', label: 'Nombre', type: 'text' },
                { key: 'previsto', label: 'Previsto', type: 'number', default: 0 },
              ]},
              { key: 'impuestos', label: 'Impuestos', campos: [
                { key: 'nombre', label: 'Nombre', type: 'text' },
                { key: 'previsto', label: 'Previsto', type: 'number', default: 0 },
                { key: 'frecuencia', label: 'Frecuencia', type: 'select', options: FRECUENCIAS, default: 'mensual' },
              ]},
              { key: 'asceo', label: 'Aseo', campos: [
                { key: 'nombre', label: 'Nombre', type: 'text' },
                { key: 'previsto', label: 'Previsto', type: 'number', default: 0 },
              ]},
              { key: 'semanas_items', label: 'Compras semanales', campos: [
                { key: 'nombre', label: 'Nombre', type: 'text' },
                { key: 'previsto', label: 'Previsto $', type: 'number', default: 0 },
                { key: 'frecuencia', label: 'Frecuencia', type: 'select', options: FRECUENCIAS_COMPRA, default: 'semanal' },
              ]},
            ].map(({ key, label, campos }) => {
              const items = sec(key);
              const isOpen = seccionAbierta === key;
              const total = items.reduce((s, it) => {
                if (key === 'semanas_items') {
                  const f = it.frecuencia || 'semanal';
                  const m = f === 'semanal' ? 4 : f === 'quincenal' ? 2 : 1;
                  return s + (it.previsto || 0) * m;
                }
                return s + (it.previsto || 0);
              }, 0);
              return (
                <div key={key} className="utm-acc-section">
                  <button
                    className={`utm-acc-header ${isOpen ? 'open' : ''}`}
                    onClick={() => setSeccionAbierta(isOpen ? null : key)}
                  >
                    <div className="utm-acc-left">
                      <ChevronRight size={14} className={`utm-acc-chevron ${isOpen ? 'rotated' : ''}`} />
                      <span className="utm-acc-label">{label}</span>
                      <span className="utm-acc-count">{items.length} I­tems</span>
                    </div>
                    <span className="utm-acc-total">${fmt(total)}{key === 'semanas_items' ? '/mes' : ''}</span>
                  </button>
                  {isOpen && (
                    <div className="utm-acc-body">
                      <SeccionItems
                        title=""
                        items={items}
                        onChange={v => setField(key, v)}
                        campos={campos}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="dm-right dm-right-empty"><p>SeleccionÃ¡ o creÃ¡ una plantilla â†’</p></div>
      )}
    </div>
  );
}

// â”€â”€ Componente principal con pestaÃ±as â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function DefaultsManager() {
  const { user } = useAuth();
  const [tab, setTab] = useState('mias'); // 'mias' | 'globales'

  const userDbPath = user ? `user_templates/${user.uid}` : null;

  return (
    <div className="dm-container">
      <div className="dm-tabs">
        <button className={`dm-tab ${tab === 'mias' ? 'active' : ''}`} onClick={() => setTab('mias')}>
          Mis Plantillas
        </button>
        <button className={`dm-tab ${tab === 'globales' ? 'active' : ''}`} onClick={() => setTab('globales')}>
          Plantillas Globales
        </button>
      </div>

      {tab === 'mias' && userDbPath && (
        <UserTemplatesManager key={userDbPath} dbPath={userDbPath} />
      )}
      {tab === 'globales' && (
        <PlantillaPanel key="globales" dbPath="defaults" />
      )}
    </div>
  );
}

