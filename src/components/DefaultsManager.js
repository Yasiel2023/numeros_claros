// src/components/DefaultsManager.js
import React, { useState, useEffect } from 'react';
import { ref, get, set, remove } from 'firebase/database';
import { db } from '../firebase';
import { Plus, Trash2, Save, Loader } from 'lucide-react';

const FRECUENCIAS = ['mensual', 'bimestral', 'trimestral', 'semestral', 'anual'];
const FRECUENCIAS_COMPRA = ['semanal', 'quincenal', 'mensual'];

function toArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return Object.keys(val)
    .sort((a, b) => Number(a) - Number(b))
    .map(k => val[k]);
}

// ── Sección editable genérica ─────────────────────────────────
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
              <tr><td colSpan={campos.length + 1} className="dm-empty-row">Sin ítems</td></tr>
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

// ── Componente principal ──────────────────────────────────────
export default function DefaultsManager() {
  const [templates, setTemplates] = useState([]);  // [{id, nombre, data}]
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(null); // id actual
  const [editing, setEditing]     = useState(null); // copia de trabajo
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [nuevaNombre, setNuevaNombre] = useState('');
  const [creando, setCreando]     = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  // ── Cargar todas las plantillas ───────────────────────────────
  useEffect(() => {
    const cargar = async () => {
      setLoading(true);
      try {
        const snap = await get(ref(db, 'defaults'));
        if (snap.exists()) {
          const data = snap.val();
          const lista = Object.keys(data).map(id => ({
            id,
            nombre: data[id]._meta?.nombre || id,
            data: data[id],
          }));
          setTemplates(lista);
          setSelected(lista[0].id);
          setEditing(JSON.parse(JSON.stringify(lista[0].data)));
        }
      } catch (e) {
        console.error('Error cargando plantillas:', e);
      }
      setLoading(false);
    };
    cargar();
  }, []);

  const seleccionar = id => {
    const t = templates.find(t => t.id === id);
    if (!t) return;
    setSelected(id);
    setEditing(JSON.parse(JSON.stringify(t.data)));
    setSaved(false);
    setConfirmDel(false);
  };

  // ── Guardar plantilla activa ──────────────────────────────────
  const guardar = async () => {
    if (!editing || !selected) return;
    setSaving(true);
    try {
      await set(ref(db, `defaults/${selected}`), editing);
      setTemplates(prev =>
        prev.map(t =>
          t.id === selected
            ? { ...t, data: editing, nombre: editing._meta?.nombre || t.nombre }
            : t
        )
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error('Error guardando:', e);
    }
    setSaving(false);
  };

  // ── Crear nueva plantilla ─────────────────────────────────────
  const crearPlantilla = async () => {
    const nombre = nuevaNombre.trim();
    if (!nombre) return;
    setCreando(true);
    try {
      const {
        BASICOS_DEFAULT, IMPUESTOS_DEFAULT, ASCEO_DEFAULT,
        COMPRAS_SEMANA_DEFAULT, INGRESOS_FIJOS,
      } = require('../constants');
      const slug = nombre.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20);
      const id = `${slug}_${Date.now().toString(36)}`;
      const data = {
        _meta: { nombre, creadoEn: new Date().toISOString() },
        ingresos: [
          ...INGRESOS_FIJOS.map(i => ({ ...i, previsto: 0 })),
          { nombre: 'Otro', esFijo: false, previsto: 0 },
        ],
        basicos:       BASICOS_DEFAULT,
        impuestos:     IMPUESTOS_DEFAULT,
        asceo:         ASCEO_DEFAULT,
        semanas_items: COMPRAS_SEMANA_DEFAULT,

      };
      await set(ref(db, `defaults/${id}`), data);
      const nuevo = { id, nombre, data };
      setTemplates(prev => [...prev, nuevo]);
      setSelected(id);
      setEditing(JSON.parse(JSON.stringify(data)));
      setNuevaNombre('');
      setSaved(false);
    } catch (e) {
      console.error('Error creando plantilla:', e);
    }
    setCreando(false);
  };

  // ── Eliminar plantilla activa ─────────────────────────────────
  const eliminarPlantilla = async () => {
    if (!selected) return;
    try {
      await remove(ref(db, `defaults/${selected}`));
      const resto = templates.filter(t => t.id !== selected);
      setTemplates(resto);
      if (resto.length > 0) {
        setSelected(resto[0].id);
        setEditing(JSON.parse(JSON.stringify(resto[0].data)));
      } else {
        setSelected(null);
        setEditing(null);
      }
      setConfirmDel(false);
    } catch (e) {
      console.error('Error eliminando:', e);
    }
  };

  // ── Helpers de edición ────────────────────────────────────────
  const setField = (key, val) => setEditing(prev => ({ ...prev, [key]: val }));
  const sec = key => toArray(editing?.[key] || []);

  if (loading) {
    return (
      <div className="loading-state">
        <Loader size={24} className="spin" /> Cargando plantillas...
      </div>
    );
  }

  return (
    <div className="dm-wrap">
      {/* ── Panel izquierdo: lista ── */}
      <aside className="dm-left">
        <div className="dm-left-header">Plantillas</div>

        <div className="dm-list">
          {templates.length === 0 && (
            <p className="dm-list-empty">Sin plantillas aún</p>
          )}
          {templates.map(t => (
            <button
              key={t.id}
              className={`dm-list-item ${selected === t.id ? 'active' : ''}`}
              onClick={() => seleccionar(t.id)}
            >
              {t.nombre}
            </button>
          ))}
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
          <button
            className="dm-new-btn"
            onClick={crearPlantilla}
            disabled={!nuevaNombre.trim() || creando}
            title="Crear plantilla"
          >
            {creando ? <Loader size={13} className="spin" /> : <Plus size={13} />}
          </button>
        </div>
      </aside>

      {/* ── Panel derecho: editor ── */}
      {editing ? (
        <div className="dm-right">
          {/* Header del editor */}
          <div className="dm-right-header">
            <input
              className="dm-title-input"
              value={editing._meta?.nombre || ''}
              onChange={e =>
                setField('_meta', { ...editing._meta, nombre: e.target.value })
              }
              placeholder="Nombre de la plantilla"
            />
            <div className="dm-right-actions">
              {saved && (
                <span className="save-status saved">
                  <Save size={13} /> Guardado
                </span>
              )}
              {!confirmDel ? (
                <button
                  className="dm-del-btn"
                  onClick={() => setConfirmDel(true)}
                  title="Eliminar plantilla"
                >
                  <Trash2 size={14} />
                </button>
              ) : (
                <div className="dm-confirm-del">
                  <span>¿Eliminar?</span>
                  <button className="dm-confirm-yes" onClick={eliminarPlantilla}>Sí</button>
                  <button className="dm-confirm-no" onClick={() => setConfirmDel(false)}>No</button>
                </div>
              )}
              <button className="dm-save-btn" onClick={guardar} disabled={saving}>
                {saving ? <Loader size={14} className="spin" /> : <Save size={14} />}
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>

          {/* Secciones */}
          <SeccionItems
            title="Ingresos"
            items={sec('ingresos')}
            onChange={v => setField('ingresos', v)}
            campos={[
              { key: 'nombre',  label: 'Nombre',   type: 'text' },
              { key: 'esFijo',  label: 'Fijo',     type: 'checkbox', default: false },
              { key: 'previsto',label: 'Previsto',  type: 'number',   default: 0 },
            ]}
          />
          <SeccionItems
            title="Básicos"
            items={sec('basicos')}
            onChange={v => setField('basicos', v)}
            campos={[
              { key: 'nombre',  label: 'Nombre',  type: 'text' },
              { key: 'previsto',label: 'Previsto', type: 'number', default: 0 },
            ]}
          />
          <SeccionItems
            title="Impuestos"
            items={sec('impuestos')}
            onChange={v => setField('impuestos', v)}
            campos={[
              { key: 'nombre',    label: 'Nombre',     type: 'text' },
              { key: 'previsto',  label: 'Previsto',   type: 'number',  default: 0 },
              { key: 'frecuencia',label: 'Frecuencia', type: 'select',
                options: FRECUENCIAS, default: 'mensual' },
            ]}
          />
          <SeccionItems
            title="Aseo"
            items={sec('asceo')}
            onChange={v => setField('asceo', v)}
            campos={[
              { key: 'nombre',  label: 'Nombre',  type: 'text' },
              { key: 'previsto',label: 'Previsto', type: 'number', default: 0 },
            ]}
          />
          <SeccionItems
            title="Compras semanales (ítems base)"
            items={sec('semanas_items')}
            onChange={v => setField('semanas_items', v)}
            campos={[
              { key: 'nombre',    label: 'Nombre',     type: 'text' },
              { key: 'previsto',  label: 'Previsto',   type: 'number', default: 0 },
              { key: 'frecuencia',label: 'Frecuencia', type: 'select',
                options: FRECUENCIAS_COMPRA, default: 'semanal' },
            ]}
          />
        </div>
      ) : (
        <div className="dm-right dm-right-empty">
          <p>Creá tu primera plantilla →</p>
        </div>
      )}
    </div>
  );
}
