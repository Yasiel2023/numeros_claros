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
import GrupoGastos from './components/GrupoGastos';
import Semanas from './components/Semanas';
import CajaAhorro from './components/CajaAhorro';
import Resumen from './components/Resumen';
import { calcularSemanasMes, MESES_ES, getPeriodosLabel } from './constants';
import { aplicarCuotas, cuotasPendientes, tarjetasParaMesNuevo } from './financiaciones';
import { LayoutDashboard, TrendingUp, Home, Receipt, ShoppingCart, Droplets, BarChart2, LogOut, ChevronLeft, ChevronRight, Save, Loader, Briefcase, Plus, X, Settings, UserPlus, Bell, CreditCard, Smile, PiggyBank, Menu } from 'lucide-react';
import DefaultsManager from './components/DefaultsManager';
import CompartirModal from './components/CompartirModal';
import InvitacionesBanner from './components/InvitacionesBanner';
import Tarjetas from './components/Tarjetas';
import NuevoMesModal from './components/NuevoMesModal';
import OnboardingWizard from './components/OnboardingWizard';
import Config from './components/Config';
import FotoComprobante from './components/FotoComprobante';
import AplicarDesglose from './components/AplicarDesglose';
import Chat from './components/Chat';
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
  // Compatibilidad con datos anteriores (claves planas → nuevo mapa gastos)
  let gastos;
  if (raw.gastos) {
    gastos = Object.fromEntries(
      Object.keys(raw.gastos).map(k => {
        const arr = toArray(raw.gastos[k]);
        // Formato nuevo: array de periodos, cada uno con .items
        if (arr.length > 0 && arr[0] !== null && typeof arr[0] === 'object' && 'items' in arr[0]) {
          return [k, arr.map(p => ({ ...p, items: toArray(p.items || []) }))];
        }
        // Formato viejo: items planos — GrupoGastos.toPeriodos() los envuelve
        return [k, arr];
      })
    );
  } else {
    // Formato muy antiguo (claves planas sin 'gastos')
    gastos = {
      basicos:   toArray(raw.basicos   || []),
      impuestos: toArray(raw.impuestos || []),
      asceo:     toArray(raw.asceo     || []),
      ocio:      toArray(raw.ocio      || []),
    };
  }
  return {
    ...raw,
    ingresos: toArray(raw.ingresos || []),
    gastos,
    semanas:  toArray(raw.semanas  || []).map(s => ({ ...s, items: toArray(s.items || []) })),
    // Las tarjetas necesitan id para poder vincularles pagos de gastos.
    // Las creadas antes de esa funcionalidad no lo tienen: se les asigna aca.
    tarjetas: toArray(raw.tarjetas || []).map((t, i) => ({
      ...t,
      id: t?.id || `tj_${i}_${(t?.nombre || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10)}`,
      ...(t?.tipo === 'debito' ? { saldos: toArray(t.saldos || []) } : {}),
    })),
  };
}

// ── Inicializar un mes nuevo con los defaults ──────────────────
// defaults viene de Firebase: presupuestos/{uid}/{presupuestoId}/_defaults
function initMesData(año, mes, defaults) {
  if (!defaults) return null;
  const grupos = toArray(defaults.grupos_gastos || []);
  const gastos = {};

  for (const grupo of grupos) {
    // Compatibilidad: usar frecuencia si existe, sino inferir del tipo legacy
    const efectiva = grupo.frecuencia
      || (grupo.tipo === 'semanas'  ? 'semanal'
        : grupo.tipo === 'impuesto' ? 'mensual'
        : 'mensual');
    const templateItems = toArray(grupo.items || []).map(i => ({
      nombre: i.nombre, previsto: i.previsto || 0, real: i.previsto || 0, pagado: false,
    }));
    const periodos = getPeriodosLabel(efectiva, año, mes);
    gastos[grupo.id] = periodos.map(p => ({
      numero: p.numero,
      label:  p.label,
      items:  templateItems.map(i => ({ ...i })),
    }));
  }

  return {
    ingresos: toArray(defaults.ingresos || []).map(i => ({ ...i, real: 0 })),
    gastos,
    semanas:  [], // legado mantenido para compatibilidad
    tarjetas: [],
    objetivoAhorro: 0,
  };
}

// Iconos para el NAV dinámico de grupos
const GRUPO_ID_ICON        = { basicos: Home, impuestos: Receipt, compras: ShoppingCart, supermercado: ShoppingCart, asceo: Droplets, ocio: Smile };
const GRUPO_FRECUENCIA_ICON = { mensual: Home, quincenal: Receipt, cada10dias: BarChart2, semanal: ShoppingCart };

const NAV_FIJOS_INICIO = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, emoji: '📋' },
  { key: 'ingresos',  label: 'Ingresos',  icon: TrendingUp,      emoji: '💼' },
];
const NAV_FIJOS_FIN = [
  { key: 'tarjetas',   label: 'Tarjetas',        icon: CreditCard, emoji: '💳' },
  { key: 'resumen',    label: 'Resumen',          icon: BarChart2,  emoji: '📊' },
  { key: 'caja',       label: 'Caja de Ahorro',  icon: PiggyBank,  emoji: '🐷' },
  { key: 'chat',       label: 'Preguntas IA',    icon: BarChart2,  emoji: '💬' },
  { key: 'plantillas', label: 'Plantillas',       icon: Settings,   emoji: '⚙️' },
  { key: 'config',     label: 'Configuración',    icon: Settings,   emoji: '⚙️' },
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
  // ── Estado modal guardar plantilla desde mes ─────────────────
  const [showGuardarTplModal, setShowGuardarTplModal] = useState(false);
  const [nombreTplNueva, setNombreTplNueva] = useState('');
  const [guardandoTpl, setGuardandoTpl] = useState(false);
  const [tplGuardada, setTplGuardada] = useState(false);
  // ── Estado modal nuevo mes ────────────────────────────────────
  const [nuevoMesPendiente, setNuevoMesPendiente] = useState(false);
  const saveTimer = useRef(null);
  const [cajaData, setCajaData] = useState(null);
  // ── Compras en cuotas (nivel presupuesto) ─────────────────────
  const [financiaciones, setFinanciaciones] = useState([]);
  // ── Onboarding primer uso ─────────────────────────────────────
  const [showOnboarding, setShowOnboarding] = useState(false);
  // ── Sidebar mobile ─────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = () => setSidebarOpen(false);
  // ── Admins ────────────────────────────────────────────
  const [admins, setAdmins] = useState({});
  // ── API Keys ──────────────────────────────────────────
  const [groqApiKey, setGroqApiKey] = useState('');
  const [groqUrl, setGroqUrl] = useState('https://api.groq.com/openai/v1');
  const [groqModel, setGroqModel] = useState('openai/gpt-oss-120b');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  // ── Flujo de foto + desglose ──────────────────────────
  const [showFotoModal, setShowFotoModal] = useState(false);
  const [desglosing, setDesglosing] = useState(false);
  const [desglozeResult, setDesglozeResult] = useState(null);
  const [fotoOriginal, setFotoOriginal] = useState(null);
  // ── Grupos de gastos del presupuesto activo ───────────────────
  const grupos = toArray(defaults?.grupos_gastos || []);

  // NAV dinámico (Ingresos fijos + un ítem por cada grupo + secciones finales)
  const NAV = [
    ...NAV_FIJOS_INICIO,
    ...grupos.map(g => ({
      key:     `grupo_${g.id}`,
      label:   g.nombre,
      icon:    GRUPO_ID_ICON[g.id] || GRUPO_FRECUENCIA_ICON[g.frecuencia || (g.tipo === 'semanas' ? 'semanal' : 'mensual')] || Home,
      emoji:   g.icono || null,
      grupoId: g.id,
    })),
    ...NAV_FIJOS_FIN,
  ];

  // Clave del mes en RTDB: "2026_2" (año_mesIndex0basado)
  const mesKey = `${año}_${mes}`;

  // ownerUid del presupuesto activo (puede ser otro usuario en presupuestos compartidos)
  const ownerUidActual = presupuestos.find(p => p.id === presupuestoActual)?.ownerUid || user.uid;
  const rolActual = presupuestos.find(p => p.id === presupuestoActual)?.rol || 'owner';

  // ── Cargar admins ────────────────────────────────────────────
  useEffect(() => {
    const cargarAdmins = async () => {
      try {
        const snap = await get(ref(db, 'admins'));
        setAdmins(snap.exists() ? snap.val() : {});
      } catch (e) {
        console.error('Error cargando admins:', e);
      }
    };
    cargarAdmins();
  }, []);

  // ── Cargar configuración de Groq ──────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    const cargarGroqConfig = async () => {
      try {
        const snapKey = await get(ref(db, `config/${user.uid}/groq_api_key`));
        setGroqApiKey(snapKey.exists() ? snapKey.val() : '');
        const snapUrl = await get(ref(db, `config/${user.uid}/groq_url`));
        if (snapUrl.exists()) setGroqUrl(snapUrl.val());
        const snapModel = await get(ref(db, `config/${user.uid}/groq_model`));
        if (snapModel.exists()) setGroqModel(snapModel.val());
      } catch (e) {
        console.error('Error cargando configuración de Groq:', e);
      }
    };
    cargarGroqConfig();
  }, [user?.uid]);

  // ── Cargar API key de Gemini ──────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    const cargarGeminiKey = async () => {
      try {
        const snap = await get(ref(db, `config/${user.uid}/gemini_api_key`));
        setGeminiApiKey(snap.exists() ? snap.val() : '');
      } catch (e) {
        console.error('Error cargando Gemini API key:', e);
      }
    };
    cargarGeminiKey();
  }, [user?.uid]);

  // ── Cargar y guardar Caja de Ahorro (nivel presupuesto) ──────
  useEffect(() => {
    if (!presupuestoActual || !ownerUidActual) return;
    const cargarCaja = async () => {
      try {
        const snap = await get(ref(db, `presupuestos/${ownerUidActual}/${presupuestoActual}/_caja_ahorro`));
        if (snap.exists()) {
          const raw = snap.val();
          const movs = raw.movimientos
            ? (Array.isArray(raw.movimientos)
                ? raw.movimientos
                : Object.keys(raw.movimientos).sort().map(k => raw.movimientos[k]))
            : [];
          setCajaData({ ...raw, movimientos: movs });
        } else {
          setCajaData({ movimientos: [] });
        }
      } catch (e) {
        console.error('Error cargando caja:', e);
        setCajaData({ movimientos: [] });
      }
    };
    cargarCaja();
  }, [presupuestoActual, ownerUidActual]); // eslint-disable-line

  const guardarCaja = useCallback(async (data) => {
    if (!presupuestoActual) return;
    try {
      await set(ref(db, `presupuestos/${ownerUidActual}/${presupuestoActual}/_caja_ahorro`), data);
    } catch (e) { console.error('Error guardando caja:', e); }
  }, [presupuestoActual, ownerUidActual]);

  const updateCajaData = useCallback((data) => {
    setCajaData(data);
    guardarCaja(data);
  }, [guardarCaja]);

  // ── Cargar y guardar financiaciones (nivel presupuesto) ──────
  useEffect(() => {
    if (!presupuestoActual || !ownerUidActual) return;
    const cargarFin = async () => {
      try {
        const snap = await get(ref(db, `presupuestos/${ownerUidActual}/${presupuestoActual}/_financiaciones`));
        setFinanciaciones(snap.exists() ? toArray(snap.val()) : []);
      } catch (e) {
        console.error('Error cargando financiaciones:', e);
        setFinanciaciones([]);
      }
    };
    cargarFin();
  }, [presupuestoActual, ownerUidActual]);

  const updateFinanciaciones = useCallback(async (lista) => {
    setFinanciaciones(lista);
    if (!presupuestoActual) return;
    try {
      await set(ref(db, `presupuestos/${ownerUidActual}/${presupuestoActual}/_financiaciones`), lista);
    } catch (e) { console.error('Error guardando financiaciones:', e); }
  }, [presupuestoActual, ownerUidActual]);

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

  // ── Seed de defaults vacio para presupuestos nuevos ──────────
  const buildSeedDefaults = () => ({ grupos_gastos: [], ingresos: [] });

  // ── Crear presupuesto desde el wizard de onboarding ─────────
  const handleOnboardingCreate = async ({ nombre, grupos }) => {
    const slug = nombre.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20);
    const id   = `${slug}_${Date.now().toString(36)}`;
    const meta = { nombre, creadoEn: new Date().toISOString() };
    const seed = {
      grupos_gastos: grupos,
      ingresos: [],
    };
    await set(ref(db, `presupuestos/${user.uid}/${id}/_meta`), meta);
    await set(ref(db, `presupuestos/${user.uid}/${id}/_defaults`), seed);
    await set(ref(db, `accesos/${user.uid}/${id}`), {
      ownerUid: user.uid, nombre, rol: 'owner', creadoEn: new Date().toISOString(),
    });
    // Guardar como Default General para futuros usuarios nuevos
    await set(ref(db, 'defaults/general'), {
      _meta: { nombre: 'General', creadoEn: new Date().toISOString() },
      grupos_gastos: grupos,
      ingresos: [],
    });
    const nuevo = { id, nombre, ownerUid: user.uid, rol: 'owner' };
    setPresupuestos([nuevo]);
    setPresupuestoActual(id);
    setShowOnboarding(false);
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
        }
        // (Si no hay propios, no auto-creamos — el wizard de onboarding lo hará)

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

        // Primer uso: sin presupuestos propios ni compartidos → mostrar onboarding
        if (lista.length === 0) {
          setShowOnboarding(true);
          setLoadingPresup(false);
          return;
        }

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
  const confirmarNuevoMes = useCallback(async (templateId, objetivo) => {
    let defaultsParaMes = defaults;
    if (templateId) {
      const tpl = userTemplates.find(t => t.id === templateId);
      if (tpl) {
        // Excluir _meta y objetivoAhorro de la plantilla al usar como defaults
        const { _meta: _ignored, objetivoAhorro: _obj, ...tplData } = tpl.data;
        defaultsParaMes = tplData;
      }
    }
    let data = { ...initMesData(año, mes, defaultsParaMes), objetivoAhorro: objetivo || 0 };

    // Arrastrar las tarjetas del mes anterior: el credito arranca en cero y
    // el debito conserva su ultimo saldo.
    try {
      const mesPrev = mes === 0 ? 11 : mes - 1;
      const añoPrev = mes === 0 ? año - 1 : año;
      const snapPrev = await get(ref(db, `presupuestos/${ownerUidActual}/${presupuestoActual}/${añoPrev}_${mesPrev}`));
      if (snapPrev.exists()) {
        data.tarjetas = tarjetasParaMesNuevo(toArray(snapPrev.val().tarjetas || []));
      }
    } catch (e) { console.error('Error arrastrando tarjetas:', e); }

    // Cargar las cuotas que le tocan a este mes
    data = aplicarCuotas(data, financiaciones, año, mes);

    setNuevoMesPendiente(false);
    updateMesData(data);
  }, [año, mes, defaults, userTemplates, updateMesData, financiaciones, ownerUidActual, presupuestoActual]); // eslint-disable-line

  // ── Guardar mes actual como plantilla de usuario ─────────────
  const guardarMesComoPlantilla = useCallback(async () => {
    if (!mesData || !user || !nombreTplNueva.trim()) return;
    setGuardandoTpl(true);
    try {
      const slug = nombreTplNueva.trim().toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20);
      const tplId = `${slug}_${Date.now().toString(36)}`;
      const tplData = {
        _meta: { nombre: nombreTplNueva.trim(), creadoEn: new Date().toISOString() },
        grupos_gastos: grupos.map(g => ({
          ...g,
          items: ((mesData.gastos[g.id] || [])[0]?.items || g.items || [])
            .map(i => ({ nombre: i.nombre, previsto: i.previsto || 0 })),
        })),
        ingresos: (mesData.ingresos || []).map(i => ({ nombre: i.nombre, previsto: i.previsto || 0 })),
        objetivoAhorro: mesData.objetivoAhorro || 0,
      };
      await set(ref(db, `user_templates/${user.uid}/${tplId}`), tplData);
      setUserTemplates(prev => [...prev, { id: tplId, nombre: nombreTplNueva.trim(), data: tplData }]);
      setTplGuardada(true);
      setTimeout(() => {
        setTplGuardada(false);
        setShowGuardarTplModal(false);
        setNombreTplNueva('');
      }, 1500);
    } catch (e) {
      console.error('Error guardando plantilla:', e);
    }
    setGuardandoTpl(false);
  }, [mesData, user, grupos, nombreTplNueva]); // eslint-disable-line

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
    ? Object.entries(mesData.gastos || {}).reduce((total, [, grupoData]) => {
        const arr = Array.isArray(grupoData) ? grupoData : [];
        if (arr.length === 0) return total;
        // Formato nuevo: periodos con items
        if (arr[0] !== null && typeof arr[0] === 'object' && 'items' in arr[0]) {
          return total + arr.reduce((s, p) =>
            s + (p.items || []).filter(i => i.pagado !== true && (i.previsto || 0) > 0).length, 0);
        }
        // Formato viejo: items planos
        return total + arr.filter(i => i.pagado !== true && (i.previsto || 0) > 0).length;
      }, 0)
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

  // ── Onboarding: primer uso ──────────────────────────────────────
  if (showOnboarding) {
    return <OnboardingWizard onCreate={handleOnboardingCreate} />;
  }

  return (
    <div className="layout">
      {/* OVERLAY MOBILE */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={closeSidebar} />}

      {/* SIDEBAR */}
      <aside className={`sidebar${sidebarOpen ? ' sidebar--open' : ''}`}>
        <div className="sidebar-brand">
          <span className="sb-icon">🏠</span>
          <span className="sb-name">Números Claros</span>
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
          {NAV.map(({ key, label, icon: Icon, emoji }) => (
            <button key={key} className={`nav-item ${vista === key ? 'active' : ''}`}
              onClick={() => { setVista(key); closeSidebar(); }}>
              {emoji
                ? <span className="nav-emoji">{emoji}</span>
                : <Icon size={16}/>}
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
            <button className="topbar-menu-btn" onClick={() => setSidebarOpen(o => !o)} aria-label="Menú">
              <Menu size={20}/>
            </button>
            <h2 className="topbar-title">
              {vista === 'plantillas'
                ? 'Plantillas de datos'
                : vista === 'caja'
                ? 'Caja de Ahorro'
                : `${NAV.find(n => n.key === vista)?.label} — ${MESES_ES[mes]} ${año}`
              }
            </h2>
          </div>
          <div className="topbar-right">
            {saving && <span className="save-status saving"><Loader size={14} className="spin"/> Guardando...</span>}
            {saved && !saving && <span className="save-status saved"><Save size={14}/> Guardado</span>}
          </div>
        </header>

        {/* Modal guardar mes como plantilla */}
        {showGuardarTplModal && (
          <div className="presup-modal-overlay" onClick={() => setShowGuardarTplModal(false)}>
            <div className="presup-modal" onClick={e => e.stopPropagation()}>
              <div className="presup-modal-header">
                <span>💾 Guardar mes como plantilla</span>
                <button className="presup-modal-close" onClick={() => setShowGuardarTplModal(false)}><X size={14} /></button>
              </div>
              <p className="gtpl-desc">
                Se guardarán los valores <strong>previstos</strong> de {MESES_ES[mes]} {año}.<br/>
                Los valores reales no se copian.
              </p>
              <input
                className="presup-modal-input"
                type="text"
                placeholder="Ej: Mes típico, Verano 2026..."
                value={nombreTplNueva}
                onChange={e => setNombreTplNueva(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && guardarMesComoPlantilla()}
                autoFocus
              />
              <div className="presup-modal-actions">
                <button className="presup-modal-cancel" onClick={() => setShowGuardarTplModal(false)}>Cancelar</button>
                <button
                  className="presup-modal-ok"
                  onClick={guardarMesComoPlantilla}
                  disabled={!nombreTplNueva.trim() || guardandoTpl || tplGuardada}
                >
                  {guardandoTpl ? <Loader size={13} className="spin" /> : tplGuardada ? '✓ Guardada' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        )}

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
          ) : vista === 'caja' ? (
            <div className="page">
              <div className="page-header"><h1 className="page-title">🐷 Caja de Ahorro</h1></div>
              <CajaAhorro
                cajaData={cajaData}
                onChange={updateCajaData}
                ahorroRealMes={mesData?.objetivoAhorro || 0}
                mesLabel={`${MESES_ES[mes]} ${año}`}
              />
            </div>
          ) : loading || nuevoMesPendiente ? (
            <div className="loading-state"><Loader size={28} className="spin"/> Cargando {MESES_ES[mes]}...</div>
          ) : (
            <>
              {vista === 'dashboard' && (
                <Dashboard
                  mesData={mesData} mes={mes} año={año} grupos={grupos}
                  onIrA={key =>
                    // Compatibilidad con claves legacy
                    setVista(['basicos','impuestos','asceo','ocio','semanas'].includes(key)
                      ? `grupo_${key}`
                      : key)
                  }
                />
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

              {/* ── Grupos de gastos dinamicos (todos via GrupoGastos con periodos) ── */}
              {vista.startsWith('grupo_') && (() => {
                const grupoId = vista.replace('grupo_', '');
                const grupo   = grupos.find(g => g.id === grupoId);
                if (!grupo) return null;
                return (
                  <div className="page">
                    <div className="page-header">
                      <h1 className="page-title">{grupo.icono} {grupo.nombre} — {MESES_ES[mes]} {año}</h1>
                    </div>
                    <GrupoGastos
                      grupo={grupo}
                      data={mesData?.gastos?.[grupoId]}
                      tarjetas={mesData?.tarjetas || []}
                      onChange={(periodos, tarjetas) =>
                        updateMesData({
                          ...mesData,
                          gastos: { ...(mesData?.gastos || {}), [grupoId]: periodos },
                          ...(tarjetas ? { tarjetas } : {}),
                        })
                      }
                      anio={año}
                      mes={mes}
                      apiKey={geminiApiKey}
                      mesData={mesData}
                      grupos={grupos}
                    />
                  </div>
                );
              })()}

              {vista === 'tarjetas' && (
                <div className="page">
                  <div className="page-header"><h1 className="page-title">💳 Tarjetas — {MESES_ES[mes]} {año}</h1></div>
                  <Tarjetas
                    data={mesData?.tarjetas}
                    gastos={mesData?.gastos}
                    onChange={tarj => updateMesData({ ...mesData, tarjetas: tarj })}
                    financiaciones={financiaciones}
                    onChangeFinanciaciones={updateFinanciaciones}
                    cuotasPendientes={cuotasPendientes(financiaciones, mesData, año, mes)}
                    onAplicarCuotas={() => updateMesData(aplicarCuotas(mesData, financiaciones, año, mes))}
                    anio={año}
                    mes={mes}
                  />
                </div>
              )}
              {vista === 'resumen' && (
                <div className="page">
                  <div className="page-header">
                    <h1 className="page-title">📊 Resumen — {MESES_ES[mes]} {año}</h1>
                    {mesData && (
                      <button
                        className="btn-save-tpl"
                        onClick={() => { setNombreTplNueva(`${MESES_ES[mes]} ${año}`); setShowGuardarTplModal(true); }}
                        title="Guardar valores presupuestados de este mes como plantilla"
                      >
                        💾 Guardar como plantilla
                      </button>
                    )}
                  </div>
                  <Resumen mesData={mesData} onChange={updateMesData} grupos={grupos} />
                </div>
              )}
              {vista === 'chat' && (
                <div className="page">
                  <div className="page-header"><h1 className="page-title">💬 Preguntas sobre tu presupuesto</h1></div>
                  <div className="section-block">
                    <Chat
                      apiKey={groqApiKey}
                      groqUrl={groqUrl}
                      groqModel={groqModel}
                      presupuestos={presupuestos}
                      mesDataByMonth={{ [`${año}_${mes}`]: mesData }}
                      defaults={defaults}
                      año={año}
                      mes={mes}
                    />
                  </div>
                </div>
              )}
              {vista === 'config' && (
                <Config uid={user.uid} admins={admins} />
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
