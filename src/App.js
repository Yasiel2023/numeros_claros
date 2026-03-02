// src/App.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ref, get, set, remove } from 'firebase/database';
// encodeEmail: '.' → ',' para claves RTDB
const encodeEmail = (email) => email.replace(/\./g, ',');
import { db } from './firebase';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthPage from './components/AuthPage';
import Dashboard from './components/Dashboard';
import Ingresos from './components/Ingresos';
import Basicos from './components/Basicos';
import Impuestos from './components/Impuestos';
import Semanas from './components/Semanas';
import Asceo from './components/Asceo';
import Resumen from './components/Resumen';
import { calcularSemanasMes, MESES_ES } from './constants';
// BASICOS_DEFAULT etc. se cargan desde Firebase (_defaults) — ver cargarPresupuestos
import { LayoutDashboard, TrendingUp, Home, Receipt, ShoppingCart, Droplets, BarChart2, LogOut, ChevronLeft, ChevronRight, Save, Loader, Briefcase, Plus, X, Settings, UserPlus, Bell, CreditCard } from 'lucide-react';
import DefaultsManager from './components/DefaultsManager';
import CompartirModal from './components/CompartirModal';
import InvitacionesBanner from './components/InvitacionesBanner';
import Tarjetas from './components/Tarjetas';
import NuevoMesModal from './components/NuevoMesModal';
import './App.css';

// ── Helpers para normalizar arrays desde RTDB ─────────────────
// RTDB puede devolver arrays como objetos con claves numéricas
function toArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return Object.keys(val)
    .sort((a, b) => Number(a) - Number(b))
    .map(k => val[k]);
}

function normalizeMesData(raw) {
  if (!raw) return null;
  return {
    ...raw,
    ingresos:  toArray(raw.ingresos),
    basicos:   toArray(raw.basicos),
    impuestos: toArray(raw.impuestos),
    asceo:     toArray(raw.asceo),
    semanas:   toArray(raw.semanas).map(s => ({ ...s, items: toArray(s.items) })),
    tarjetas:  toArray(raw.tarjetas || []),
  };
}

// ── Inicializar un mes nuevo con los defaults ──────────────────
// defaults viene de Firebase: presupuestos/{uid}/{presupuestoId}/_defaults
function initMesData(año, mes, defaults) {
  if (!defaults) return null;
  const semanasCalc = calcularSemanasMes(año, mes);
  const semItems = toArray(defaults.semanas_items);
  return {
    ingresos: toArray(defaults.ingresos).map(i => ({ ...i, real: 0 })),
    basicos:  toArray(defaults.basicos).map(b => ({ ...b, real: b.previsto })),
    impuestos: toArray(defaults.impuestos).map(i => ({ ...i, real: i.previsto, activo: true })),
    asceo:    toArray(defaults.asceo).map(a => ({ ...a, real: 0 })),
    semanas: semanasCalc.map((sem, semIdx) => ({
      ...sem,
      items: semItems
        .filter(it => {
          const f = it.frecuencia || 'semanal';
          if (f === 'semanal')   return true;
          if (f === 'quincenal') return semIdx % 2 === 0; // semanas 1, 3, 5…
          if (f === 'mensual')   return semIdx === 0;     // solo semana 1
          return true;
        })
        .map(it => ({ ...it, real: 0 })),
    })),
    tarjetas: [],
    objetivoAhorro: 0,
  };
}

const NAV = [
  { key: 'dashboard',    label: 'Dashboard',   icon: LayoutDashboard },
  { key: 'ingresos',     label: 'Ingresos',     icon: TrendingUp },
  { key: 'basicos',      label: 'Básicos',      icon: Home },
  { key: 'impuestos',    label: 'Impuestos',    icon: Receipt },
  { key: 'semanas',      label: 'Compras',      icon: ShoppingCart },
  { key: 'asceo',        label: 'Asceo',        icon: Droplets },
  { key: 'tarjetas',     label: 'Tarjetas',     icon: CreditCard },
  { key: 'resumen',      label: 'Resumen',      icon: BarChart2 },
  { key: 'plantillas',   label: 'Plantillas',   icon: Settings },
];

// ── App interna (usuario autenticado) ─────────────────────────
function AppInterna() {
  const { user, logout } = useAuth();
  const [mes, setMes] = useState(new Date().getMonth());
  const [año, setAño] = useState(new Date().getFullYear());
  const [vista, setVista] = useState('dashboard');
  const [mesData, setMesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // ── Estado de presupuestos ────────────────────────────────────
  const [presupuestos, setPresupuestos] = useState([]); // [{id, nombre, ownerUid, rol}]
  const [presupuestoActual, setPresupuestoActual] = useState(null);
  const [showCompartirModal, setShowCompartirModal] = useState(false);
  const [invitaciones, setInvitaciones] = useState([]); // pendientes de responder
  const [defaults, setDefaults] = useState(null); // datos base del presupuesto en Firebase
  const [loadingPresup, setLoadingPresup] = useState(true);
  const [showNuevoModal, setShowNuevoModal] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [templateSeleccionado, setTemplateSeleccionado] = useState('');
  const [creando, setCreando] = useState(false);
  // ── Plantillas globales (colección /defaults en RTDB) ────────
  const [defaultsTemplates, setDefaultsTemplates] = useState([]); // [{id, nombre, data}]
  // ── Plantillas del usuario (/user_templates/{uid}/) ───────────
  const [userTemplates, setUserTemplates] = useState([]); // [{id, nombre, data}]
  // ── Estado modal nuevo mes ────────────────────────────────────
  const [nuevoMesPendiente, setNuevoMesPendiente] = useState(false);
  const saveTimer = useRef(null);

  // Clave del mes en RTDB: "2026_2" (año_mesIndex0basado)
  const mesKey = `${año}_${mes}`;

  // ownerUid del presupuesto activo (puede ser otro usuario en presupuestos compartidos)
  const ownerUidActual = presupuestos.find(p => p.id === presupuestoActual)?.ownerUid || user.uid;
  const rolActual = presupuestos.find(p => p.id === presupuestoActual)?.rol || 'owner';

  // ── Cargar plantillas globales /defaults ─────────────────────
  useEffect(() => {
    const cargarTemplates = async () => {
      try {
        const snap = await get(ref(db, 'defaults'));
        if (snap.exists()) {
          const data = snap.val();
          const lista = Object.keys(data).map(id => ({
            id,
            nombre: data[id]._meta?.nombre || id,
            data: data[id],
          }));
          setDefaultsTemplates(lista);
        }
      } catch (e) {
        console.error('Error cargando plantillas globales:', e);
      }
    };
    cargarTemplates();
  }, []);

  // ── Cargar plantillas del usuario /user_templates/{uid} ────────
  useEffect(() => {
    if (!user) return;
    const cargarUserTemplates = async () => {
      try {
        const snap = await get(ref(db, `user_templates/${user.uid}`));
        if (snap.exists()) {
          const data = snap.val();
          const lista = Object.keys(data).map(id => ({
            id,
            nombre: data[id]._meta?.nombre || id,
            data: data[id],
          }));
          setUserTemplates(lista);
        }
      } catch (e) {
        console.error('Error cargando plantillas de usuario:', e);
      }
    };
    cargarUserTemplates();
  }, [user]);

  // ── Seed de defaults locales para primera inicialización ──────
  // Solo se usa si Firebase no tiene _defaults todavía
  const buildSeedDefaults = () => {
    // Importamos dinámicamente solo para sembrar la primera vez
    const { BASICOS_DEFAULT, IMPUESTOS_DEFAULT, ASCEO_DEFAULT,
            COMPRAS_SEMANA_DEFAULT, INGRESOS_FIJOS } = require('./constants');
    return {
      ingresos: [
        ...INGRESOS_FIJOS.map(i => ({ ...i, previsto: 0 })),
        { nombre: 'Melia', esFijo: false, previsto: 0 },
      ],
      basicos:      BASICOS_DEFAULT,
      impuestos:    IMPUESTOS_DEFAULT,
      asceo:        ASCEO_DEFAULT,
      semanas_items: COMPRAS_SEMANA_DEFAULT,
    };
  };

  // ── Crear nuevo presupuesto ─────────────────────────────────────
  const crearPresupuesto = async () => {
    const nombre = nuevoNombre.trim();
    if (!nombre) return;
    setCreando(true);
    try {
      const slug = nombre.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20);
      const id = `${slug}_${Date.now().toString(36)}`;
      const meta = { nombre, creadoEn: new Date().toISOString() };
      await set(ref(db, `presupuestos/${user.uid}/${id}/_meta`), meta);
      // Usar plantilla seleccionada o seed local como _defaults
      let seed;
      if (templateSeleccionado) {
        const tpl = defaultsTemplates.find(t => t.id === templateSeleccionado);
        if (tpl) {
          // Copiar data de la plantilla (sin _meta propio de la plantilla)
          const { _meta: _ignored, ...tplData } = tpl.data;
          seed = tplData;
        }
      }
      if (!seed) seed = buildSeedDefaults();
      await set(ref(db, `presupuestos/${user.uid}/${id}/_defaults`), seed);
      // Registrar en /accesos para poder cargar compartidos con la misma lógica
      await set(ref(db, `accesos/${user.uid}/${id}`), { ownerUid: user.uid, nombre, rol: 'owner', creadoEn: new Date().toISOString() });
      setPresupuestos(prev => [...prev, { id, nombre, ownerUid: user.uid, rol: 'owner' }]);
      setPresupuestoActual(id);
      setNuevoNombre('');
      setTemplateSeleccionado('');
      setShowNuevoModal(false);
    } catch (e) {
      console.error('Error creando presupuesto:', e);
    }
    setCreando(false);
  };

  // ── Cargar lista de presupuestos del usuario ──────────────────
  useEffect(() => {
    if (!user) return;
    const cargarPresupuestos = async () => {
      setLoadingPresup(true);
      try {
        // 1. Presupuestos propios
        const snapPropios = await get(ref(db, `presupuestos/${user.uid}`));
        let listaPropios = [];
        if (snapPropios.exists()) {
          const data = snapPropios.val();
          listaPropios = Object.keys(data)
            .filter(k => k !== '_meta')
            .map(id => ({
              id,
              nombre: data[id]?._meta?.nombre || id,
              ownerUid: user.uid,
              rol: 'owner',
            }));
        } else {
          // No hay presupuestos propios → crear uno por defecto
          const defaultMeta = { nombre: 'Mi Presupuesto', creadoEn: new Date().toISOString() };
          await set(ref(db, `presupuestos/${user.uid}/principal/_meta`), defaultMeta);
          await set(ref(db, `accesos/${user.uid}/principal`), { ownerUid: user.uid, nombre: 'Mi Presupuesto', rol: 'owner', creadoEn: new Date().toISOString() });
          listaPropios = [{ id: 'principal', nombre: 'Mi Presupuesto', ownerUid: user.uid, rol: 'owner' }];
        }

        // Migrar presupuestos propios que aún no tienen entrada en /accesos
        for (const p of listaPropios) {
          const snapAcc = await get(ref(db, `accesos/${user.uid}/${p.id}`));
          if (!snapAcc.exists()) {
            await set(ref(db, `accesos/${user.uid}/${p.id}`), { ownerUid: user.uid, nombre: p.nombre, rol: 'owner', creadoEn: new Date().toISOString() });
          }
        }

        // 2. Presupuestos compartidos (accesos de otros)
        const snapAccesos = await get(ref(db, `accesos/${user.uid}`));
        let listaCompartidos = [];
        if (snapAccesos.exists()) {
          const accesos = snapAccesos.val();
          listaCompartidos = Object.keys(accesos)
            .map(id => ({ id, ...accesos[id] }))
            .filter(a => a.ownerUid !== user.uid); // solo los que NO son propios
        }

        const lista = [...listaPropios, ...listaCompartidos];
        setPresupuestos(lista);
        setPresupuestoActual(lista[0]?.id || null);

        // 3. Cargar invitaciones pendientes
        const snapInv = await get(ref(db, `invitaciones/${user.uid}`));
        if (snapInv.exists()) {
          const invData = snapInv.val();
          const pendientes = Object.keys(invData)
            .map(id => ({ id, ...invData[id] }))
            .filter(inv => inv.estado === 'pendiente');
          setInvitaciones(pendientes);
        }
      } catch (e) {
        console.error('Error cargando presupuestos:', e);
      }
      setLoadingPresup(false);
    };
    cargarPresupuestos();
  }, [user]);

  // ── Cargar _defaults del presupuesto activo desde Firebase ────
  useEffect(() => {
    if (!presupuestoActual || !user) return;
    const ownerUid = presupuestos.find(p => p.id === presupuestoActual)?.ownerUid || user.uid;
    const cargarDefaults = async () => {
      try {
        const snap = await get(ref(db, `presupuestos/${ownerUid}/${presupuestoActual}/_defaults`));
        if (snap.exists()) {
          setDefaults(snap.val());
        } else {
          // Primera vez (presupuesto propio): sembrar desde constants y guardar en Firebase
          const seed = buildSeedDefaults();
          await set(ref(db, `presupuestos/${ownerUid}/${presupuestoActual}/_defaults`), seed);
          setDefaults(seed);
        }
      } catch (e) {
        console.error('Error cargando defaults:', e);
        setDefaults(buildSeedDefaults()); // fallback local
      }
    };
    cargarDefaults();
  }, [presupuestoActual, user.uid, presupuestos]); // eslint-disable-line

  // ── Cargar datos del mes ──────────────────────────────────────
  const cargar = useCallback(async () => {
    if (!presupuestoActual || !defaults) return;
    setLoading(true);
    try {
      const snap = await get(ref(db, `presupuestos/${ownerUidActual}/${presupuestoActual}/${mesKey}`));
      if (snap.exists()) {
        setNuevoMesPendiente(false);
        setMesData(normalizeMesData(snap.val()));
      } else {
        // Mes sin datos: mostrar modal para seleccionar plantilla
        setMesData(null);
        setNuevoMesPendiente(true);
        setLoading(false);
        return;
      }
    } catch (e) {
      console.error('Error cargando:', e);
      setMesData(initMesData(año, mes, defaults));
    }
    setLoading(false);
  }, [presupuestoActual, mesKey, año, mes, ownerUidActual, defaults]);

  useEffect(() => {
    if (presupuestoActual && defaults) cargar();
  }, [cargar, presupuestoActual, defaults]);

  // ── Auto-guardar con debounce ─────────────────────────────────
  const autoGuardar = useCallback(async (data) => {
    if (!data || !presupuestoActual) return;
    setSaving(true);
    try {
      await set(ref(db, `presupuestos/${ownerUidActual}/${presupuestoActual}/${mesKey}`), data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { console.error('Error guardando:', e); }
    setSaving(false);
  }, [presupuestoActual, mesKey, ownerUidActual]);

  const updateMesData = useCallback((newData) => {
    setMesData(newData);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => autoGuardar(newData), 1200);
  }, [autoGuardar]);

  // ── Confirmar nuevo mes desde modal ─────────────────────────────────────────
  const confirmarNuevoMes = useCallback((templateId, objetivo) => {
    let defaultsParaMes = defaults;
    if (templateId) {
      const tpl = userTemplates.find(t => t.id === templateId);
      if (tpl) {
        // Excluir _meta y objetivoAhorro de la plantilla al usar como defaults
        const { _meta: _ignored, objetivoAhorro: _obj, ...tplData } = tpl.data;
        defaultsParaMes = tplData;
      }
    }
    const data = { ...initMesData(año, mes, defaultsParaMes), objetivoAhorro: objetivo || 0 };
    setNuevoMesPendiente(false);
    updateMesData(data);
  }, [año, mes, defaults, userTemplates, updateMesData]); // eslint-disable-line

  // ── Navegar meses ─────────────────────────────────────────────
  const mesAnterior = () => {
    if (mes === 0) { setMes(11); setAño(a => a - 1); }
    else setMes(m => m - 1);
  };
  const mesSiguiente = () => {
    if (mes === 11) { setMes(0); setAño(a => a + 1); }
    else setMes(m => m + 1);
  };

  const nombre = user.displayName || user.email.split('@')[0];
  const initiales = nombre.slice(0, 2).toUpperCase();

  // ── Pendientes para badge ─────────────────────────────────────
  const pendTotal = mesData
    ? (mesData.basicos || []).filter(b => (b.real || 0) > 0).length
    + (mesData.impuestos || []).filter(i => i.activo && (i.real || 0) > 0).length
    : 0;

  // ── Pantalla de carga inicial de presupuestos ─────────────────
  if (loadingPresup) {
    return (
      <div className="loading-full">
        <Loader size={28} className="spin" />
        <span>Cargando presupuestos...</span>
      </div>
    );
  }

  return (
    <div className="layout">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="sb-icon">🏠</span>
          <span className="sb-name">CasaFinanzas</span>
        </div>

        {/* Selector de presupuesto */}
        <div className="presup-selector">
          <Briefcase size={13} className="presup-icon" />
          <select
            value={presupuestoActual || ''}
            onChange={e => setPresupuestoActual(e.target.value)}
            className="presup-select"
          >
            {presupuestos.map(p => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
          <button
            className="presup-add-btn"
            onClick={() => { setNuevoNombre(''); setShowNuevoModal(true); }}
            title="Nuevo presupuesto"
          >
            <Plus size={13} />
          </button>
          {rolActual === 'owner' && (
            <button
              className="presup-share-btn"
              onClick={() => setShowCompartirModal(true)}
              title="Compartir presupuesto"
            >
              <UserPlus size={13} />
            </button>
          )}
        </div>

        {/* Banner de invitaciones pendientes */}
        {invitaciones.length > 0 && (
          <InvitacionesBanner
            invitaciones={invitaciones}
            onAceptar={async (inv) => {
              await set(ref(db, `accesos/${user.uid}/${inv.id}`), {
                ownerUid: inv.ownerUid,
                nombre: inv.presupuestoNombre,
                rol: 'miembro',
                invitadoPor: inv.ownerEmail,
              });
              await set(ref(db, `invitaciones/${user.uid}/${inv.id}/estado`), 'aceptada');
              setInvitaciones(prev => prev.filter(i => i.id !== inv.id));
              setPresupuestos(prev => [...prev, {
                id: inv.id,
                nombre: inv.presupuestoNombre,
                ownerUid: inv.ownerUid,
                rol: 'miembro',
              }]);
            }}
            onRechazar={async (inv) => {
              await set(ref(db, `invitaciones/${user.uid}/${inv.id}/estado`), 'rechazada');
              setInvitaciones(prev => prev.filter(i => i.id !== inv.id));
            }}
          />
        )}

        {/* Modal compartir presupuesto */}
        {showCompartirModal && presupuestoActual && (
          <CompartirModal
            presupuestoId={presupuestoActual}
            presupuestoNombre={presupuestos.find(p => p.id === presupuestoActual)?.nombre || presupuestoActual}
            ownerUid={user.uid}
            ownerEmail={user.email}
            onClose={() => setShowCompartirModal(false)}
          />
        )}

        {/* Modal nuevo presupuesto */}
        {showNuevoModal && (
          <div className="presup-modal-overlay" onClick={() => setShowNuevoModal(false)}>
            <div className="presup-modal" onClick={e => e.stopPropagation()}>
              <div className="presup-modal-header">
                <span>Nuevo presupuesto</span>
                <button className="presup-modal-close" onClick={() => setShowNuevoModal(false)}>
                  <X size={14} />
                </button>
              </div>
              <input
                className="presup-modal-input"
                type="text"
                placeholder="Ej: Casa Familiar"
                value={nuevoNombre}
                onChange={e => setNuevoNombre(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && crearPresupuesto()}
                autoFocus
              />
              {defaultsTemplates.length > 0 && (
                <div className="presup-modal-tpl">
                  <label className="presup-modal-tpl-label">Plantilla de datos</label>
                  <select
                    className="presup-modal-tpl-select"
                    value={templateSeleccionado}
                    onChange={e => setTemplateSeleccionado(e.target.value)}
                  >
                    <option value="">Sin plantilla (valores vacíos)</option>
                    {defaultsTemplates.map(t => (
                      <option key={t.id} value={t.id}>{t.nombre}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="presup-modal-actions">
                <button className="presup-modal-cancel" onClick={() => setShowNuevoModal(false)}>Cancelar</button>
                <button
                  className="presup-modal-ok"
                  onClick={crearPresupuesto}
                  disabled={!nuevoNombre.trim() || creando}
                >
                  {creando ? <Loader size={13} className="spin" /> : 'Crear'}
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="mes-selector">
          <button className="mes-nav-btn" onClick={mesAnterior}><ChevronLeft size={16}/></button>
          <span className="mes-label">{MESES_ES[mes].slice(0, 3)} {año}</span>
          <button className="mes-nav-btn" onClick={mesSiguiente}><ChevronRight size={16}/></button>
        </div>

        <nav className="sidebar-nav">
          {NAV.map(({ key, label, icon: Icon }) => (
            <button key={key} className={`nav-item ${vista === key ? 'active' : ''}`}
              onClick={() => setVista(key)}>
              <Icon size={16}/>
              <span>{label}</span>
              {key === 'dashboard' && pendTotal > 0 && (
                <span className="nav-badge">{pendTotal}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-ava">{initiales}</div>
            <span className="user-nm">{nombre}</span>
          </div>
          <button className="logout-btn" onClick={logout} title="Cerrar sesión">
            <LogOut size={15}/>
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="main-wrap">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-left">
            <h2 className="topbar-title">
              {vista === 'plantillas'
                ? 'Plantillas de datos'
                : `${NAV.find(n => n.key === vista)?.label} — ${MESES_ES[mes]} ${año}`
              }
            </h2>
          </div>
          <div className="topbar-right">
            {saving && <span className="save-status saving"><Loader size={14} className="spin"/> Guardando...</span>}
            {saved && !saving && <span className="save-status saved"><Save size={14}/> Guardado</span>}
          </div>
        </header>

        {/* Modal nuevo mes */}
        {nuevoMesPendiente && (
          <NuevoMesModal
            mesLabel={`${MESES_ES[mes]} ${año}`}
            userTemplates={userTemplates}
            onConfirm={confirmarNuevoMes}
            onCancel={() => { setNuevoMesPendiente(false); setLoading(false); }}
          />
        )}

        {/* Contenido */}
        <main className="main-content">
          {vista === 'plantillas' ? (
            <DefaultsManager />
          ) : loading || nuevoMesPendiente ? (
            <div className="loading-state"><Loader size={28} className="spin"/> Cargando {MESES_ES[mes]}...</div>
          ) : (
            <>
              {vista === 'dashboard' && (
                <Dashboard mesData={mesData} mes={mes} año={año} onIrA={setVista} />
              )}
              {vista === 'ingresos' && (
                <div className="page">
                  <div className="page-header"><h1 className="page-title">💼 Ingresos — {MESES_ES[mes]} {año}</h1></div>
                  <Ingresos
                    data={mesData?.ingresos}
                    onChange={ing => updateMesData({ ...mesData, ingresos: ing })}
                  />
                </div>
              )}
              {vista === 'basicos' && (
                <div className="page">
                  <div className="page-header"><h1 className="page-title">🏠 Gastos Básicos — {MESES_ES[mes]} {año}</h1></div>
                  <Basicos
                    data={mesData?.basicos}
                    onChange={bas => updateMesData({ ...mesData, basicos: bas })}
                  />
                </div>
              )}
              {vista === 'impuestos' && (
                <div className="page">
                  <div className="page-header"><h1 className="page-title">🧾 Impuestos — {MESES_ES[mes]} {año}</h1></div>
                  <Impuestos
                    data={mesData?.impuestos}
                    onChange={imp => updateMesData({ ...mesData, impuestos: imp })}
                  />
                </div>
              )}
              {vista === 'semanas' && (
                <div className="page">
                  <div className="page-header"><h1 className="page-title">🛒 Compras Semanales — {MESES_ES[mes]} {año}</h1></div>
                  <Semanas
                    data={mesData?.semanas}
                    semanasCalc={calcularSemanasMes(año, mes)}
                    onChange={sem => updateMesData({ ...mesData, semanas: sem })}
                  />
                </div>
              )}
              {vista === 'asceo' && (
                <div className="page">
                  <div className="page-header"><h1 className="page-title">🧴 Asceo Mensual — {MESES_ES[mes]} {año}</h1></div>
                  <Asceo
                    data={mesData?.asceo}
                    onChange={asc => updateMesData({ ...mesData, asceo: asc })}
                  />
                </div>
              )}
              {vista === 'tarjetas' && (
                <div className="page">
                  <div className="page-header"><h1 className="page-title">💳 Tarjetas de Crédito — {MESES_ES[mes]} {año}</h1></div>
                  <Tarjetas
                    data={mesData?.tarjetas}
                    onChange={tarj => updateMesData({ ...mesData, tarjetas: tarj })}
                  />
                </div>
              )}
              {vista === 'resumen' && (
                <div className="page">
                  <div className="page-header"><h1 className="page-title">📊 Resumen — {MESES_ES[mes]} {año}</h1></div>
                  <Resumen mesData={mesData} onChange={updateMesData} />
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function Root() {
  const { user } = useAuth();
  return user ? <AppInterna /> : <AuthPage />;
}

export default function App() {
  return <AuthProvider><Root /></AuthProvider>;
}
