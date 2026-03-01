// src/App.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ref, get, set } from 'firebase/database';
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
import { LayoutDashboard, TrendingUp, Home, Receipt, ShoppingCart, Droplets, BarChart2, LogOut, ChevronLeft, ChevronRight, Save, Loader, Briefcase } from 'lucide-react';
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
  };
}

// ── Inicializar un mes nuevo con los defaults ──────────────────
// defaults viene de Firebase: presupuestos/{uid}/{presupuestoId}/_defaults
function initMesData(año, mes, defaults) {
  if (!defaults) return null;
  const semanasCalc = calcularSemanasMes(año, mes);
  return {
    ingresos: toArray(defaults.ingresos).map(i => ({ ...i, real: 0 })),
    basicos:  toArray(defaults.basicos).map(b => ({ ...b, real: b.previsto })),
    impuestos: toArray(defaults.impuestos).map(i => ({ ...i, real: i.previsto, activo: true })),
    asceo:    toArray(defaults.asceo).map(a => ({ ...a, real: 0 })),
    semanas: semanasCalc.map(sem => ({
      ...sem,
      items: toArray(defaults.semanas_items).map(it => ({ ...it, real: 0 })),
    })),
    creditoUYU: 0,
    creditoUSD: 0,
    metaAhorro: defaults.metaAhorro ?? 38000,
    guardado: 0,
    guardadoMesAnterior: 0,
  };
}

const NAV = [
  { key: 'dashboard',    label: 'Dashboard',   icon: LayoutDashboard },
  { key: 'ingresos',     label: 'Ingresos',     icon: TrendingUp },
  { key: 'basicos',      label: 'Básicos',      icon: Home },
  { key: 'impuestos',    label: 'Impuestos',    icon: Receipt },
  { key: 'semanas',      label: 'Compras',      icon: ShoppingCart },
  { key: 'asceo',        label: 'Asceo',        icon: Droplets },
  { key: 'resumen',      label: 'Resumen',      icon: BarChart2 },
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
  const [presupuestos, setPresupuestos] = useState([]); // [{id, nombre}]
  const [presupuestoActual, setPresupuestoActual] = useState(null);
  const [defaults, setDefaults] = useState(null); // datos base del presupuesto en Firebase
  const [loadingPresup, setLoadingPresup] = useState(true);
  const saveTimer = useRef(null);

  // Clave del mes en RTDB: "2026_2" (año_mesIndex0basado)
  const mesKey = `${año}_${mes}`;

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
      metaAhorro:   38000,
    };
  };

  // ── Cargar lista de presupuestos del usuario ──────────────────
  useEffect(() => {
    if (!user) return;
    const cargarPresupuestos = async () => {
      setLoadingPresup(true);
      try {
        const snap = await get(ref(db, `presupuestos/${user.uid}`));
        if (snap.exists()) {
          const data = snap.val();
          const lista = Object.keys(data)
            .filter(k => k !== '_meta')
            .map(id => ({
              id,
              nombre: data[id]?._meta?.nombre || id,
            }));
          setPresupuestos(lista);
          setPresupuestoActual(lista[0]?.id || null);
        } else {
          // No hay presupuestos → crear uno por defecto
          const defaultMeta = { nombre: 'Mi Presupuesto', creadoEn: new Date().toISOString() };
          await set(ref(db, `presupuestos/${user.uid}/principal/_meta`), defaultMeta);
          setPresupuestos([{ id: 'principal', nombre: 'Mi Presupuesto' }]);
          setPresupuestoActual('principal');
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
    const cargarDefaults = async () => {
      try {
        const snap = await get(ref(db, `presupuestos/${user.uid}/${presupuestoActual}/_defaults`));
        if (snap.exists()) {
          setDefaults(snap.val());
        } else {
          // Primera vez: sembrar desde constants y guardar en Firebase
          const seed = buildSeedDefaults();
          await set(ref(db, `presupuestos/${user.uid}/${presupuestoActual}/_defaults`), seed);
          setDefaults(seed);
        }
      } catch (e) {
        console.error('Error cargando defaults:', e);
        setDefaults(buildSeedDefaults()); // fallback local
      }
    };
    cargarDefaults();
  }, [presupuestoActual, user.uid]); // eslint-disable-line

  // ── Cargar datos del mes ──────────────────────────────────────
  const cargar = useCallback(async () => {
    if (!presupuestoActual || !defaults) return;
    setLoading(true);
    try {
      console.log( new Date().getMonth());
      console.log('Cargando datos para', mesKey);
      const snap = await get(ref(db, `presupuestos/${user.uid}/${presupuestoActual}/${mesKey}`));
      if (snap.exists()) {
        setMesData(normalizeMesData(snap.val()));
      } else {
        setMesData(initMesData(año, mes, defaults));
      }
    } catch (e) {
      console.error('Error cargando:', e);
      setMesData(initMesData(año, mes, defaults));
    }
    setLoading(false);
  }, [presupuestoActual, mesKey, año, mes, user.uid, defaults]);

  useEffect(() => {
    if (presupuestoActual && defaults) cargar();
  }, [cargar, presupuestoActual, defaults]);

  // ── Auto-guardar con debounce ─────────────────────────────────
  const autoGuardar = useCallback(async (data) => {
    if (!data || !presupuestoActual) return;
    setSaving(true);
    try {
      await set(ref(db, `presupuestos/${user.uid}/${presupuestoActual}/${mesKey}`), data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { console.error('Error guardando:', e); }
    setSaving(false);
  }, [presupuestoActual, mesKey, user.uid]);

  const updateMesData = useCallback((newData) => {
    setMesData(newData);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => autoGuardar(newData), 1200);
  }, [autoGuardar]);

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
          {presupuestos.length > 1 ? (
            <select
              value={presupuestoActual || ''}
              onChange={e => setPresupuestoActual(e.target.value)}
              className="presup-select"
            >
              {presupuestos.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          ) : (
            <span className="presup-nombre">{presupuestos[0]?.nombre}</span>
          )}
        </div>
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
              {NAV.find(n => n.key === vista)?.label} — {MESES_ES[mes]} {año}
            </h2>
          </div>
          <div className="topbar-right">
            {saving && <span className="save-status saving"><Loader size={14} className="spin"/> Guardando...</span>}
            {saved && !saving && <span className="save-status saved"><Save size={14}/> Guardado</span>}
          </div>
        </header>

        {/* Contenido */}
        <main className="main-content">
          {loading ? (
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
