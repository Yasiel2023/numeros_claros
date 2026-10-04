// src/App.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ref, get, set, remove, update } from 'firebase/database';
// encodeEmail: '.' → ',' para claves RTDB
const encodeEmail = (email) => email.replace(/\./g, ',');
import { db } from './firebase';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthPage from './components/AuthPage';
import Dashboard from './components/Dashboard';
import Ingresos from './components/Ingresos';
import GrupoGastos, { aplicarPagoTarjeta, periodosDelMes, esPeriodo, pagarEnPeriodos } from './components/GrupoGastos';
import Semanas from './components/Semanas';
import CajaAhorro from './components/CajaAhorro';
import Resumen from './components/Resumen';
import { calcularSemanasMes, MESES_ES, getPeriodosLabel } from './constants';
import { aplicarCuotas, cuotasPendientes, tarjetasParaMesNuevo } from './financiaciones';
import { LogOut, ChevronLeft, ChevronRight, Save, Loader, Briefcase, Plus, X, UserPlus, Menu } from 'lucide-react';
import GastosLista from './components/GastosLista';
import MasMovil from './components/MasMovil';
import Icono, { IconoCategoria } from './iconos';
import useEsMovil from './useEsMovil';
import GastosWeb from './components/GastosWeb';
import DefaultsManager from './components/DefaultsManager';
import CompartirModal from './components/CompartirModal';
import InvitacionesBanner from './components/InvitacionesBanner';
import Tarjetas from './components/Tarjetas';
import NuevoMesModal from './components/NuevoMesModal';
import OnboardingWizard from './components/OnboardingWizard';
import Config from './components/Config';
import FlujoDesglose from './components/FlujoDesglose';
import Comprobantes from './components/Comprobantes';
import SelectorMonedas from './components/SelectorMonedas';
import NuevaCategoriaModal from './components/NuevaCategoriaModal';
import { genId } from './components/OnboardingWizard';
import { configurarMonedas, monedasDeMeta, MONEDA_DEFAULT, MONEDA2_DEFAULT, MONEDAS } from './moneda';
import Chat from './components/Chat';
import './App.css';
import './movil.css';
import './web.css';

// Dibuja los modales directamente en <body>. Si se renderizan dentro del sidebar,
// en el celular su transform los posiciona relativos al menú y no a la pantalla.
const Portal = ({ children }) => createPortal(children, document.body);

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
        // Formato nuevo: array de periodos (RTDB borra "items" si está vacío).
        // Se descartan "items" que en realidad son períodos: los dejaba un bug viejo
        // que confundía un período vacío con un gasto suelto.
        if (arr.length > 0 && esPeriodo(arr[0])) {
          return [k, arr.map(p => ({ ...p, items: toArray(p.items || []).filter(i => i && !esPeriodo(i)) }))];
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
    comprobantes: toArray(raw.comprobantes || []).map(c => ({ ...c, items: toArray(c.items || []) })),
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

// Renombres solo de pantalla: en la base el grupo sigue con su nombre original
const NOMBRES_VISIBLES = { compras: 'Supermercado' };
const nombreVisibleGrupo = (nombre) =>
  NOMBRES_VISIBLES[(nombre || '').trim().toLowerCase()] || nombre;

// Menú lateral (computadora). Las categorías de gastos están dentro de "Gastos".
const NAV_SECCIONES = [
  { key: 'dashboard', label: 'Inicio',    icono: 'casa' },
  { key: 'gastos',    label: 'Gastos',    icono: 'gastos' },
  { key: 'tarjetas',   label: 'Tarjetas',        icono: 'tarjeta' },
  { key: 'ingresos',  label: 'Ingresos',  icono: 'ingresos' },
  { key: 'comprobantes', label: 'Comprobantes',  icono: 'recibo' },
  { key: 'resumen',    label: 'Resumen',          icono: 'resumen' },
  { key: 'caja',       label: 'Caja de ahorro',  icono: 'ahorro' },
  { key: 'chat',       label: 'Preguntas IA',    icono: 'chat' },
  { key: 'plantillas', label: 'Plantillas',       icono: 'documento' },
  { key: 'config',     label: 'Configuración',    icono: 'ajustes' },
];

// En el celular estas secciones se abren desde la pestaña "Más"
const VISTAS_DE_MAS = ['ingresos', 'comprobantes', 'resumen', 'caja', 'chat', 'plantillas', 'config'];

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
  const [nuevasMonedas, setNuevasMonedas] = useState({ moneda: MONEDA_DEFAULT, moneda2: MONEDA2_DEFAULT });
  // Monedas del presupuesto activo. configurarMonedas() se llama en cada render para
  // que todos los componentes formateen con ellas (ver src/moneda.js).
  const [monedasActivas, setMonedasActivas] = useState({ principal: MONEDA_DEFAULT, secundaria: MONEDA2_DEFAULT });
  configurarMonedas(monedasActivas.principal, monedasActivas.secundaria);
  const [showNuevaCategoria, setShowNuevaCategoria] = useState(false);
  const [showMonedaModal, setShowMonedaModal] = useState(false);
  const [monedaEdit, setMonedaEdit] = useState(null);       // { moneda, moneda2 } en edición
  const [guardandoMoneda, setGuardandoMoneda] = useState(false);
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
  // ── Flujo de foto + desglose ──────────────────────────
  const [showFotoModal, setShowFotoModal] = useState(false);
  // ── Grupos de gastos del presupuesto activo ───────────────────
  // gruposDB conserva los nombres guardados (para escribir en Firebase);
  // grupos es la versión para mostrar, con los renombres de NOMBRES_VISIBLES.
  const gruposDB = toArray(defaults?.grupos_gastos || []);
  const grupos = gruposDB.map(g => ({ ...g, nombre: nombreVisibleGrupo(g.nombre) }));

  // Configuración (clave de IA del sistema) solo para admins
  const NAV = NAV_SECCIONES.filter(n => n.key !== 'config' || admins?.[user?.uid] === true);
  // Nombre de la vista actual (las categorías se abren como grupo_<id>)
  const tituloVista = vista.startsWith('grupo_')
    ? (grupos.find(g => `grupo_${g.id}` === vista)?.nombre || 'Gastos')
    : (NAV.find(n => n.key === vista)?.label || '');
  const esMovil = useEsMovil();

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

  // ── Disponibilidad de la IA ───────────────────────────────
  // La clave vive en el servidor (sistema_privado, solo la lee la Cloud Function "ia").
  // El cliente solo lee sistema/ia/activa para saber si mostrar las funciones de IA.
  // groqApiKey queda como "bandera": no vacío = IA disponible.
  const cargarGroqConfig = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const snap = await get(ref(db, 'sistema/ia'));
      const cfg = snap.exists() ? snap.val() : {};
      setGroqApiKey(cfg.activa === true ? 'servidor' : '');
      if (cfg.groq_url) setGroqUrl(cfg.groq_url);
      if (cfg.groq_model) setGroqModel(cfg.groq_model);
    } catch (e) {
      console.error('Error leyendo sistema/ia:', e);
      setGroqApiKey('');
    }
  }, [user?.uid]);

  useEffect(() => { cargarGroqConfig(); }, [cargarGroqConfig]);

  const esAdmin = admins?.[user?.uid] === true;

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
  const handleOnboardingCreate = async ({ nombre, grupos, moneda, moneda2 }) => {
    const slug = nombre.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20);
    const id   = `${slug}_${Date.now().toString(36)}`;
    const meta = { nombre, creadoEn: new Date().toISOString(), moneda: moneda || MONEDA_DEFAULT, moneda2: moneda2 ?? '' };
    const seed = {
      grupos_gastos: grupos,
      ingresos: [],
    };
    await set(ref(db, `presupuestos/${user.uid}/${id}/_meta`), meta);
    await set(ref(db, `presupuestos/${user.uid}/${id}/_defaults`), seed);
    await set(ref(db, `accesos/${user.uid}/${id}`), {
      ownerUid: user.uid, nombre, rol: 'owner', creadoEn: new Date().toISOString(),
    });
    // No se sobrescribe defaults/general: la elección (o la propuesta de la IA) de un
    // usuario no debe cambiar la plantilla sugerida para todos. Se edita desde Plantillas.
    const nuevo = { id, nombre, ownerUid: user.uid, rol: 'owner' };
    setPresupuestos([nuevo]);
    setPresupuestoActual(id);
    setShowOnboarding(false);
  };

  // ── Agregar una categoría de gastos en cualquier momento ─────────
  // Se suma a _defaults (aparece en el menú de todos los meses y en los meses nuevos)
  // y, si el mes actual existe, se le agregan sus períodos vacíos.
  const agregarCategoria = async ({ icono, nombre, frecuencia }) => {
    const nueva = { id: genId(nombre), nombre, icono, frecuencia, items: [] };
    const lista = [...gruposDB, nueva];
    await set(ref(db, `presupuestos/${ownerUidActual}/${presupuestoActual}/_defaults/grupos_gastos`), lista);
    setDefaults(prev => ({ ...(prev || {}), grupos_gastos: lista }));
    if (mesData) {
      updateMesData({
        ...mesData,
        gastos: { ...(mesData.gastos || {}), [nueva.id]: periodosDelMes(null, nueva, año, mes) },
      });
    }
    setShowNuevaCategoria(false);
    setVista(`grupo_${nueva.id}`);
  };

  // ── Cambiar las monedas del presupuesto activo (solo dueño) ─────
  // No convierte montos. Actualiza _meta y el código de moneda de tarjetas (todos los
  // meses) y cuotas para que sigan siendo "principal" o "secundaria".
  const cambiarMonedas = async () => {
    if (!monedaEdit || !presupuestoActual) return;
    const viejas = monedasActivas;
    const nuevas = monedasDeMeta({ moneda: monedaEdit.moneda, moneda2: monedaEdit.moneda2 });
    const mapear = (codigo) => (viejas.secundaria && codigo === viejas.secundaria)
      ? (nuevas.secundaria || nuevas.principal)
      : nuevas.principal;

    setGuardandoMoneda(true);
    try {
      const base = `presupuestos/${ownerUidActual}/${presupuestoActual}`;
      const updates = {
        [`${base}/_meta/moneda`]: nuevas.principal,
        [`${base}/_meta/moneda2`]: nuevas.secundaria,
      };
      const snap = await get(ref(db, base));
      const data = snap.exists() ? snap.val() : {};
      Object.keys(data).filter(k => /^\d{4}_\d{1,2}$/.test(k)).forEach(mesK => {
        const tarjetas = data[mesK]?.tarjetas || {};
        Object.keys(tarjetas).forEach(i => {
          const t = tarjetas[i];
          if (!t) return;
          const nuevo = mapear(t.moneda);
          if (t.moneda !== nuevo) updates[`${base}/${mesK}/tarjetas/${i}/moneda`] = nuevo;
        });
      });
      const fins = data._financiaciones || {};
      Object.keys(fins).forEach(i => {
        const f = fins[i];
        if (!f) return;
        const nuevo = mapear(f.moneda);
        if (f.moneda !== nuevo) updates[`${base}/_financiaciones/${i}/moneda`] = nuevo;
      });
      await update(ref(db), updates);

      // Estado local en sintonía (el mes se reescribe con los códigos nuevos)
      setMonedasActivas(nuevas);
      configurarMonedas(nuevas.principal, nuevas.secundaria);
      setFinanciaciones(prev => prev.map(f => ({ ...f, moneda: mapear(f.moneda) })));
      if (mesData) {
        updateMesData({ ...mesData, tarjetas: (mesData.tarjetas || []).map(t => ({ ...t, moneda: mapear(t.moneda) })) });
      }
      setShowMonedaModal(false);
    } catch (e) {
      console.error('Error cambiando la moneda:', e);
      alert(`No se pudo cambiar la moneda: ${e.message}`);
    }
    setGuardandoMoneda(false);
  };

  // ── Crear nuevo presupuesto ─────────────────────────────────────
  const crearPresupuesto = async () => {
    const nombre = nuevoNombre.trim();
    if (!nombre) return;
    setCreando(true);
    try {
      const slug = nombre.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20);
      const id = `${slug}_${Date.now().toString(36)}`;
      const meta = { nombre, creadoEn: new Date().toISOString(), moneda: nuevasMonedas.moneda, moneda2: nuevasMonedas.moneda2 };
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
      // Monedas del presupuesto (presupuestos viejos sin moneda: UYU + USD)
      try {
        const snapMeta = await get(ref(db, `presupuestos/${ownerUid}/${presupuestoActual}/_meta`));
        setMonedasActivas(monedasDeMeta(snapMeta.exists() ? snapMeta.val() : null));
      } catch (e) {
        console.error('Error cargando monedas del presupuesto:', e);
      }
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

  // ── Aplicar comprobante: cada item puede ir a una categoría distinta ─────────
  // asignaciones: [{tipo: 'matchear'|'crear', grupoId, periodoNumero, itemName, nombre, monto}]
  // tarjetaId: tarjeta con la que se pagó ('' = efectivo). Cada item queda vinculado
  // a la tarjeta igual que al pagar un gasto a mano, para poder revertirlo después.
  const aplicarComprobante = useCallback((asignaciones, tarjetaId = '', comprobante = null) => {
    if (!mesData || (!asignaciones.length && !comprobante)) return;
    const gastos = { ...(mesData.gastos || {}) };
    let tarjetas = mesData.tarjetas || [];
    const esDebito = tarjetas.find(t => t.id === tarjetaId)?.tipo === 'debito';
    const base36 = Date.now().toString(36);

    asignaciones.forEach((a, n) => {
      let datosTarjeta = {};
      if (tarjetaId) {
        const res = aplicarPagoTarjeta(tarjetas, tarjetaId, a.monto, a.nombre, `mov_${base36}_${n}`);
        tarjetas = res.tarjetas;
        datosTarjeta = { tarjetaId, tarjetaMonto: a.monto, ...(esDebito ? { tarjetaMovId: res.movId } : {}) };
      }

      const periodos = periodosDelMes(gastos[a.grupoId], grupos.find(g => g.id === a.grupoId), año, mes);
      gastos[a.grupoId] = periodos.map(p => {
        if (p.numero !== a.periodoNumero) return p;
        const items = [...(p.items || [])];
        const i = a.tipo === 'matchear' ? items.findIndex(it => it.nombre === a.itemName) : -1;
        const existente = i >= 0 ? items[i] : null;

        if (existente && existente.pagado !== true) {
          // Un gasto pendiente tiene real = monto esperado: se reemplaza por lo pagado.
          // Si estaba en el carrito, sale de él.
          const { enCarrito: _ec, ...pendiente } = existente;
          items[i] = { ...pendiente, real: a.monto, pagado: true, ...datosTarjeta };
        } else if (existente && !tarjetaId && !existente.tarjetaId) {
          // Ya pagado en efectivo y este también: se suma
          items[i] = { ...existente, real: (existente.real || 0) + a.monto };
        } else {
          // Nuevo, o un gasto ya pagado que no puede quedar vinculado a dos pagos
          // distintos: se agrega como item aparte con el nombre del gasto
          const nombre = existente ? existente.nombre : a.nombre;
          items.push({ nombre, previsto: existente ? 0 : a.monto, real: a.monto, pagado: true, ...datosTarjeta });
        }
        return { ...p, items };
      });
    });

    // Registro del ticket aplicado. JSON.parse/stringify quita los undefined (RTDB los rechaza).
    let comprobantes = mesData.comprobantes || [];
    if (comprobante) {
      const tarjeta = (mesData.tarjetas || []).find(t => t.id === tarjetaId);
      comprobantes = [...comprobantes, JSON.parse(JSON.stringify({
        ...comprobante,
        id: `cp_${base36}`,
        fecha: new Date().toISOString(),
        tarjetaId: tarjetaId || null,
        tarjetaNombre: tarjeta ? tarjeta.nombre : null,
        tarjetaTipo: tarjeta ? (tarjeta.tipo === 'debito' ? 'debito' : 'credito') : null,
      }))];
    }

    updateMesData({ ...mesData, gastos, tarjetas, comprobantes });
  }, [mesData, updateMesData, grupos, año, mes]);

  // ── Tarjetas del último mes anterior que tenga alguna (hasta 12 meses atrás) ──
  const buscarTarjetasPrevias = useCallback(async () => {
    try {
      let a = año, m = mes;
      for (let i = 0; i < 12; i++) {
        if (m === 0) { m = 11; a -= 1; } else { m -= 1; }
        const snap = await get(ref(db, `presupuestos/${ownerUidActual}/${presupuestoActual}/${a}_${m}`));
        if (!snap.exists()) continue;
        // normalizeMesData convierte los saldos de débito a array (RTDB puede devolver objetos)
        const tarjetas = normalizeMesData(snap.val()).tarjetas;
        if (tarjetas.length > 0) return { tarjetas, label: `${MESES_ES[m]} ${a}` };
      }
    } catch (e) { console.error('Error buscando tarjetas de meses anteriores:', e); }
    return null;
  }, [año, mes, ownerUidActual, presupuestoActual]);

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

    // Arrastrar las tarjetas del último mes que las tenga: el credito arranca
    // en cero y el debito conserva su ultimo saldo.
    const previas = await buscarTarjetasPrevias();
    if (previas) data.tarjetas = tarjetasParaMesNuevo(previas.tarjetas);

    // Cargar las cuotas que le tocan a este mes
    data = aplicarCuotas(data, financiaciones, año, mes);

    setNuevoMesPendiente(false);
    updateMesData(data);
  }, [año, mes, defaults, userTemplates, updateMesData, financiaciones, buscarTarjetasPrevias]); // eslint-disable-line

  // ── Mes con tarjetas vacío: ofrecer traerlas del último mes que las tenga ──
  const [tarjetasPrevias, setTarjetasPrevias] = useState(null); // { tarjetas, label } | null
  const sinTarjetas = !!mesData && (mesData.tarjetas || []).length === 0;
  useEffect(() => {
    setTarjetasPrevias(null);
    if (!sinTarjetas) return;
    let cancelado = false;
    buscarTarjetasPrevias().then(res => { if (!cancelado) setTarjetasPrevias(res); });
    return () => { cancelado = true; };
  }, [sinTarjetas, buscarTarjetasPrevias]);

  const importarTarjetasPrevias = () => {
    if (!tarjetasPrevias || !mesData) return;
    const data = { ...mesData, tarjetas: tarjetasParaMesNuevo(tarjetasPrevias.tarjetas) };
    updateMesData(aplicarCuotas(data, financiaciones, año, mes));
  };

  // ── Guardar mes actual como plantilla de usuario ─────────────
  const guardarMesComoPlantilla = useCallback(async () => {
    if (!mesData || !user || !nombreTplNueva.trim()) return;
    setGuardandoTpl(true);
    try {
      const slug = nombreTplNueva.trim().toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20);
      const tplId = `${slug}_${Date.now().toString(36)}`;
      const tplData = {
        _meta: { nombre: nombreTplNueva.trim(), creadoEn: new Date().toISOString() },
        grupos_gastos: gruposDB.map(g => ({
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
  }, [mesData, user, gruposDB, nombreTplNueva]); // eslint-disable-line

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
    return <OnboardingWizard onCreate={handleOnboardingCreate} ia={{ apiKey: groqApiKey, url: groqUrl }} />;
  }

  // Pagar un pendiente desde Inicio (computadora), con la misma lógica que en la categoría
  const pagarDesdeInicio = (grupoId, pIdx, iIdx, tarjetaId, monto) => {
    const grupo = grupos.find(g => g.id === grupoId);
    if (!grupo || !mesData) return;
    const periodos = periodosDelMes(mesData.gastos?.[grupoId], grupo, año, mes);
    const res = pagarEnPeriodos(periodos, pIdx, iIdx, mesData.tarjetas || [], tarjetaId, monto);
    if (!res) return;
    updateMesData({
      ...mesData,
      gastos: { ...(mesData.gastos || {}), [grupoId]: res.periodos },
      ...(res.tarjetas ? { tarjetas: res.tarjetas } : {}),
    });
  };

  // Detalle de una categoría. key: al cambiar de categoría arranca de cero (pestaña, paneles).
  const vistaGrupo = (grupo) => (
    <GrupoGastos
      key={grupo.id}
      grupo={grupo}
      data={periodosDelMes(mesData?.gastos?.[grupo.id], grupo, año, mes)}
      tarjetas={mesData?.tarjetas || []}
      onChange={(periodos, tarjetas) =>
        updateMesData({
          ...mesData,
          gastos: { ...(mesData?.gastos || {}), [grupo.id]: periodos },
          ...(tarjetas ? { tarjetas } : {}),
        })
      }
      anio={año}
      mes={mes}
      onVolver={() => setVista('gastos')}
      onCargarComprobante={groqApiKey ? () => setShowFotoModal(true) : null}
    />
  );

  // Se muestra en el menú lateral (computadora) y en la pestaña Más (celular)
  const invitacionesBanner = invitaciones.length > 0 && (
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
  );

  return (
    <div className="layout">
      {/* OVERLAY MOBILE */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={closeSidebar} />}

      {/* SIDEBAR */}
      <aside className={`sidebar${sidebarOpen ? ' sidebar--open' : ''}`}>
        <div className="sidebar-brand">
          <span className="sb-icon">$</span>
          <span className="sb-name">Números Claros</span>
          {/* En el celular el menú ocupa toda la pantalla: botón para cerrarlo */}
          <button className="sidebar-close-btn" onClick={closeSidebar} aria-label="Cerrar menú">
            <X size={20} />
          </button>
        </div>

        {/* Selector de presupuesto */}
        <div className="presup-selector">
          <Icono nombre="casa" size={16} className="presup-icon" />
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
          {rolActual === 'owner' && (
            <button
              className="presup-share-btn presup-moneda-btn"
              onClick={() => {
                setMonedaEdit({ moneda: monedasActivas.principal, moneda2: monedasActivas.secundaria });
                setShowMonedaModal(true);
              }}
              title={`Moneda del presupuesto: ${monedasActivas.principal}${monedasActivas.secundaria ? ' + ' + monedasActivas.secundaria : ''}`}
            >
              {MONEDAS[monedasActivas.principal]?.simbolo}
            </button>
          )}
        </div>

        {/* Modal nueva categoría */}
        {showNuevaCategoria && (
          <Portal>
            <NuevaCategoriaModal
              nombresExistentes={grupos.map(g => g.nombre).concat(gruposDB.map(g => g.nombre))}
              onCrear={agregarCategoria}
              onClose={() => setShowNuevaCategoria(false)}
            />
          </Portal>
        )}

        {/* Modal moneda del presupuesto (solo dueño) */}
        {showMonedaModal && monedaEdit && (
          <Portal>
          <div className="presup-modal-overlay" onClick={() => !guardandoMoneda && setShowMonedaModal(false)}>
            <div className="presup-modal" onClick={e => e.stopPropagation()}>
              <div className="presup-modal-header">
                <span>Moneda del presupuesto</span>
                <button className="presup-modal-close" onClick={() => setShowMonedaModal(false)} disabled={guardandoMoneda}>
                  <X size={14} />
                </button>
              </div>
              <SelectorMonedas
                moneda={monedaEdit.moneda}
                moneda2={monedaEdit.moneda2}
                onChange={setMonedaEdit}
                disabled={guardandoMoneda}
              />
              <p className="presup-moneda-aviso">
                Los montos <strong>no se convierten</strong>: solo cambia la moneda con la que se muestran.
                Las tarjetas y cuotas guardadas en la moneda anterior pasan a la nueva.
              </p>
              <div className="presup-modal-actions">
                <button className="presup-modal-cancel" onClick={() => setShowMonedaModal(false)} disabled={guardandoMoneda}>Cancelar</button>
                <button className="presup-modal-ok" onClick={cambiarMonedas} disabled={guardandoMoneda}>
                  {guardandoMoneda ? <Loader size={13} className="spin" /> : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
          </Portal>
        )}

        {/* Banner de invitaciones pendientes */}
        {invitacionesBanner}

        {/* Modal compartir presupuesto */}
        {showCompartirModal && presupuestoActual && (
          <Portal>
            <CompartirModal
              presupuestoId={presupuestoActual}
              presupuestoNombre={presupuestos.find(p => p.id === presupuestoActual)?.nombre || presupuestoActual}
              ownerUid={user.uid}
              ownerEmail={user.email}
              onClose={() => setShowCompartirModal(false)}
            />
          </Portal>
        )}

        {/* Modal nuevo presupuesto */}
        {showNuevoModal && (
          <Portal>
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
              <SelectorMonedas
                moneda={nuevasMonedas.moneda}
                moneda2={nuevasMonedas.moneda2}
                onChange={setNuevasMonedas}
                disabled={creando}
              />
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
          </Portal>
        )}
        <div className="mes-selector">
          <button className="mes-nav-btn" onClick={mesAnterior}><ChevronLeft size={16}/></button>
          <span className="mes-label">{MESES_ES[mes]} {año}</span>
          <button className="mes-nav-btn" onClick={mesSiguiente}><ChevronRight size={16}/></button>
        </div>

        {groqApiKey && (
          <button
            className="sidebar-foto-btn"
            onClick={() => { setShowFotoModal(true); closeSidebar(); }}
            disabled={!mesData || loading || nuevoMesPendiente}
            title="Cargar los gastos de un comprobante con IA"
          >
            <Icono nombre="camara" size={18}/> <span>Cargar comprobante</span>
          </button>
        )}

        <nav className="sidebar-nav">
          {NAV.map(({ key, label, icono }) => {
            const activo = vista === key || (key === 'gastos' && vista.startsWith('grupo_'));
            return (
              <button key={key} className={`nav-item ${activo ? 'active' : ''}`}
                aria-current={activo ? 'page' : undefined}
                onClick={() => { setVista(key); closeSidebar(); }}>
                <Icono nombre={icono} size={18} />
                <span>{label}</span>
                {key === 'gastos' && pendTotal > 0 && (
                  <span className="nav-badge">{pendTotal}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-ava">{initiales}</div>
            <span className="user-txt">
              <span className="user-nm">{nombre}</span>
              <span className="user-rol">
                {rolActual === 'owner' ? 'Dueño' : 'Miembro'} · {monedasActivas.principal}{monedasActivas.secundaria ? ` + ${MONEDAS[monedasActivas.secundaria]?.simbolo || monedasActivas.secundaria}` : ''}
              </span>
            </span>
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
                : `${tituloVista} — ${MESES_ES[mes]} ${año}`
              }
            </h2>
            {/* Celular: título corto, el mes va a la derecha */}
            {VISTAS_DE_MAS.includes(vista) && (
              <button className="topbar-volver" onClick={() => setVista('mas')} aria-label="Volver a Más">
                <ChevronLeft size={22}/>
              </button>
            )}
            <h2 className="topbar-title-movil">
              {vista === 'dashboard' ? `Hola, ${nombre}`
                : vista === 'gastos' ? 'Gastos'
                : vista === 'mas' ? 'Más'
                : vista === 'plantillas' ? 'Plantillas'
                : vista === 'caja' ? 'Caja de ahorro'
                : tituloVista}
            </h2>
          </div>
          <div className="topbar-right">
            {saving && <span className="save-status saving"><Loader size={14} className="spin"/> <span className="save-txt">Guardando...</span></span>}
            {saved && !saving && <span className="save-status saved"><Save size={14}/> <span className="save-txt">Guardado</span></span>}
            {vista !== 'plantillas' && vista !== 'caja' && vista !== 'mas' && (
              <div className="topbar-mes">
                <button onClick={mesAnterior} aria-label="Mes anterior"><ChevronLeft size={16}/></button>
                <span>{MESES_ES[mes].slice(0, 3)} {String(año).slice(2)}</span>
                <button onClick={mesSiguiente} aria-label="Mes siguiente"><ChevronRight size={16}/></button>
              </div>
            )}
          </div>
        </header>

        {/* Modal guardar mes como plantilla */}
        {showGuardarTplModal && (
          <div className="presup-modal-overlay" onClick={() => setShowGuardarTplModal(false)}>
            <div className="presup-modal" onClick={e => e.stopPropagation()}>
              <div className="presup-modal-header">
                <span>Guardar mes como plantilla</span>
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
                  {guardandoTpl ? <Loader size={13} className="spin" /> : tplGuardada ? 'Guardada' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal comprobante con IA */}
        {showFotoModal && mesData && (
          <FlujoDesglose
            ia={{ apiKey: groqApiKey, url: groqUrl }}
            mesData={mesData}
            grupos={grupos}
            año={año}
            mes={mes}
            onAplicar={aplicarComprobante}
            onClose={() => setShowFotoModal(false)}
          />
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
        <main className={`main-content vista-${vista.startsWith('grupo_') ? 'grupo' : vista}`}>
          {vista === 'mas' ? (
            <MasMovil
              nombre={nombre}
              initiales={initiales}
              presupuestos={presupuestos}
              presupuestoActual={presupuestoActual}
              onCambiarPresupuesto={setPresupuestoActual}
              monedasTxt={`${monedasActivas.principal}${monedasActivas.secundaria ? ' · ' + monedasActivas.secundaria : ''}`}
              esDueño={rolActual === 'owner'}
              esAdmin={esAdmin}
              puedeNuevaCategoria={!!defaults}
              invitaciones={invitacionesBanner}
              onIr={setVista}
              onNuevaCategoria={() => setShowNuevaCategoria(true)}
              onCompartir={() => setShowCompartirModal(true)}
              onMoneda={() => {
                setMonedaEdit({ moneda: monedasActivas.principal, moneda2: monedasActivas.secundaria });
                setShowMonedaModal(true);
              }}
              onNuevoPresupuesto={() => { setNuevoNombre(''); setShowNuevoModal(true); }}
              onLogout={logout}
            />
          ) : vista === 'plantillas' ? (
            <DefaultsManager esAdmin={esAdmin} />
          ) : vista === 'caja' ? (
            <div className="page">
              <div className="page-header page-header--escritorio"><h1 className="page-title"><Icono nombre="ahorro" size={22} className="page-title-ico" /> Caja de ahorro</h1></div>
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
                  onTicket={groqApiKey ? () => setShowFotoModal(true) : null}
                  nombre={nombre}
                  onPagarItem={pagarDesdeInicio}
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
                  <div className="page-header page-header--escritorio"><h1 className="page-title"><Icono nombre="ingresos" size={22} className="page-title-ico" /> Ingresos — {MESES_ES[mes]} {año}</h1></div>
                  <Ingresos
                    data={mesData?.ingresos}
                    onChange={ing => updateMesData({ ...mesData, ingresos: ing })}
                  />
                </div>
              )}

              {/* Celular: una categoría a pantalla completa (se abre desde la pestaña Gastos) */}
              {esMovil && vista.startsWith('grupo_') && (() => {
                const grupo = grupos.find(g => `grupo_${g.id}` === vista);
                return grupo ? <div className="page">{vistaGrupo(grupo)}</div> : null;
              })()}

              {/* Computadora: lista de categorías + detalle de la elegida */}
              {!esMovil && (vista === 'gastos' || vista.startsWith('grupo_')) && (() => {
                const grupo = grupos.find(g => `grupo_${g.id}` === vista) || grupos[0];
                return (
                  <GastosWeb
                    mesData={mesData}
                    grupos={grupos}
                    seleccionado={grupo?.id}
                    onElegir={id => setVista(`grupo_${id}`)}
                    onNuevaCategoria={defaults ? () => setShowNuevaCategoria(true) : null}
                  >
                    {grupo ? vistaGrupo(grupo) : <p className="ggw-vacio">Todavía no hay categorías.</p>}
                  </GastosWeb>
                );
              })()}

              {vista === 'tarjetas' && (
                <div className="page">
                  <Tarjetas
                    data={mesData?.tarjetas}
                    gastos={mesData?.gastos}
                    onChange={tarj => updateMesData({ ...mesData, tarjetas: tarj })}
                    financiaciones={financiaciones}
                    onChangeFinanciaciones={updateFinanciaciones}
                    cuotasPendientes={cuotasPendientes(financiaciones, mesData, año, mes)}
                    onAplicarCuotas={() => updateMesData(aplicarCuotas(mesData, financiaciones, año, mes))}
                    tarjetasPreviasLabel={tarjetasPrevias?.label}
                    onImportarTarjetasPrevias={importarTarjetasPrevias}
                    anio={año}
                    mes={mes}
                  />
                </div>
              )}
              {vista === 'comprobantes' && (
                <div className="page">
                  <div className="page-header page-header--escritorio"><h1 className="page-title"><Icono nombre="recibo" size={22} className="page-title-ico" /> Comprobantes — {MESES_ES[mes]} {año}</h1></div>
                  <Comprobantes
                    data={mesData?.comprobantes || []}
                    grupos={grupos}
                    onEliminar={id => updateMesData({
                      ...mesData,
                      comprobantes: (mesData?.comprobantes || []).filter(c => c.id !== id),
                    })}
                  />
                </div>
              )}
              {vista === 'resumen' && (
                <div className="page">
                  <div className="page-header page-header--escritorio">
                    <h1 className="page-title"><Icono nombre="resumen" size={22} className="page-title-ico" /> Resumen — {MESES_ES[mes]} {año}</h1>
                    {mesData && (
                      <button
                        className="btn-save-tpl"
                        onClick={() => { setNombreTplNueva(`${MESES_ES[mes]} ${año}`); setShowGuardarTplModal(true); }}
                        title="Guardar valores presupuestados de este mes como plantilla"
                      >
                        Guardar como plantilla
                      </button>
                    )}
                  </div>
                  <Resumen mesData={mesData} onChange={updateMesData} grupos={grupos} />
                </div>
              )}
              {vista === 'chat' && (
                <div className="page">
                  <div className="page-header page-header--escritorio"><h1 className="page-title"><Icono nombre="chat" size={22} className="page-title-ico" /> Preguntas sobre tu presupuesto</h1></div>
                  <div className="section-block">
                    <Chat
                      apiKey={groqApiKey}
                      groqUrl={groqUrl}
                      groqModel={groqModel}
                      presupuestoNombre={presupuestos.find(p => p.id === presupuestoActual)?.nombre || presupuestoActual}
                      ownerUid={ownerUidActual}
                      presupuestoId={presupuestoActual}
                      grupos={grupos}
                      tarjetas={mesData?.tarjetas || []}
                      financiaciones={financiaciones}
                      año={año}
                      mes={mes}
                    />
                  </div>
                </div>
              )}
              {vista === 'config' && esAdmin && (
                <Config onGuardado={cargarGroqConfig} />
              )}
              {esMovil && vista === 'gastos' && (
                <GastosLista
                  mesData={mesData}
                  grupos={grupos}
                  onAbrir={id => setVista(`grupo_${id}`)}
                  onNuevaCategoria={defaults ? () => setShowNuevaCategoria(true) : null}
                />
              )}
            </>
          )}
        </main>

        {/* Barra de pestañas (solo celular, ver App.css) */}
        <nav className="tabbar" aria-label="Secciones principales">
          <button className={`tab ${vista === 'dashboard' ? 'active' : ''}`} onClick={() => setVista('dashboard')}>
            <Icono nombre="casa" size={24}/><span>Inicio</span>
          </button>
          <button className={`tab ${vista === 'gastos' || vista.startsWith('grupo_') ? 'active' : ''}`} onClick={() => setVista('gastos')}>
            <Icono nombre="gastos" size={24}/><span>Gastos</span>
            {pendTotal > 0 && <span className="tab-badge">{pendTotal > 99 ? '99+' : pendTotal}</span>}
          </button>
          {groqApiKey ? (
            <button className="tab-fab" onClick={() => setShowFotoModal(true)}
              disabled={!mesData || loading || nuevoMesPendiente} aria-label="Cargar comprobante">
              <Icono nombre="camara" size={26} grosor={2.2}/>
            </button>
          ) : <span className="tab-fab-hueco" />}
          <button className={`tab ${vista === 'tarjetas' ? 'active' : ''}`} onClick={() => setVista('tarjetas')}>
            <Icono nombre="tarjeta" size={24}/><span>Tarjetas</span>
          </button>
          <button className={`tab ${vista === 'mas' || VISTAS_DE_MAS.includes(vista) ? 'active' : ''}`}
            onClick={() => setVista('mas')}>
            <Icono nombre="puntos" size={24}/><span>Más</span>
          </button>
        </nav>
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
