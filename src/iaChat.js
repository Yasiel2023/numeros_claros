// src/iaChat.js
// Chat de preguntas con "tool calling": el LLM recibe un contexto que explica
// cómo funcionan los datos y una lista de herramientas (funciones de esta app).
// El LLM decide qué herramienta necesita, la app la ejecuta leyendo de Firebase
// SOLO los meses pedidos, hace las cuentas en JS y le devuelve el resultado.
import { ref, get, set } from 'firebase/database';
import { db } from './firebase';
import { MESES_ES } from './constants';
import { toPeriodos } from './components/GrupoGastos';
import { idsCredito, cuentaComoGastoReal, pagadoTarjeta, saldoTarjeta, previstoPropioTarjeta } from './tarjetas';
import { numeroCuota, estaActiva } from './financiaciones';

const MAX_RONDAS = 4;      // máximo de idas y vueltas con herramientas por pregunta
const MAX_MESES  = 12;     // máximo de meses por llamada a una herramienta

// ── Utilidades ────────────────────────────────────────────────────────────────
const r2 = (n) => Math.round((n || 0) * 100) / 100;
const normalizar = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// RTDB puede devolver arrays como objetos con claves numéricas
function toArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(v => v != null);
  return Object.keys(val).sort((a, b) => Number(a) - Number(b)).map(k => val[k]).filter(v => v != null);
}

// "2026-09" -> { clave: "2026_8", label: "Septiembre 2026" }
function parsearMes(txt) {
  const m = String(txt || '').trim().match(/^(\d{4})-(\d{1,2})$/);
  if (!m) return null;
  const año = parseInt(m[1], 10);
  const mes = parseInt(m[2], 10) - 1;
  if (mes < 0 || mes > 11) return null;
  return { año, mes, clave: `${año}_${mes}`, label: `${MESES_ES[mes]} ${año}`, iso: `${año}-${String(mes + 1).padStart(2, '0')}` };
}

const mesIso = (año, mes) => `${año}-${String(mes + 1).padStart(2, '0')}`;

// ── Contexto ──────────────────────────────────────────────────────────────────
const RUTA_CONTEXTO = (ownerUid, presupuestoId) => `presupuestos/${ownerUid}/${presupuestoId}/_ia_contexto`;

export async function cargarNotasContexto(ownerUid, presupuestoId) {
  const snap = await get(ref(db, `${RUTA_CONTEXTO(ownerUid, presupuestoId)}/notas`));
  return snap.exists() ? snap.val() : '';
}

export async function guardarNotasContexto(ownerUid, presupuestoId, notas) {
  await set(ref(db, RUTA_CONTEXTO(ownerUid, presupuestoId)), {
    notas: notas || '',
    actualizado: new Date().toISOString(),
  });
}

// Parte automática: reglas fijas de la app + datos actuales del presupuesto
export function contextoAutomatico({ presupuestoNombre, grupos = [], año, mes, tarjetas = [], financiaciones = [] }) {
  const hoy = new Date();
  const freq = (g) => g.frecuencia || (g.tipo === 'semanas' ? 'semanal' : 'mensual');

  return `Sos el asistente financiero de "Números Claros", una app de presupuesto familiar en Uruguay (moneda principal UYU, algunas tarjetas en USD).
Presupuesto: ${presupuestoNombre || 'sin nombre'}
Fecha de hoy: ${hoy.toISOString().slice(0, 10)}
Mes que el usuario está viendo: ${MESES_ES[mes]} ${año} (${mesIso(año, mes)})

CÓMO ESTÁN ORGANIZADOS LOS DATOS
- Cada mes guarda: ingresos, gastos por categoría, tarjetas, comprobantes (tickets cargados) y un objetivo de ahorro.
- Los meses se piden en formato AAAA-MM (ej: 2026-09 es septiembre de 2026).
- Cada categoría de gastos se divide en períodos según su frecuencia: mensual (1), quincenal (2), cada 10 días (3) o semanal (una por semana de compra).
- Cada gasto (item) tiene: previsto (lo planeado), real (lo pagado o el monto esperado si está pendiente) y pagado (sí/no).
- Un item pendiente puede estar "en carrito": se fue montando en el súper pero todavía no se pagó.
- Los comprobantes son tickets de compra leídos con IA: tienda, fecha, total pagado, tarjeta usada y a qué gasto fue cada producto.
- Hay compras en cuotas (financiaciones) que se suman cada mes a una tarjeta de crédito.

REGLAS DE CÁLCULO (las herramientas ya devuelven los totales calculados con estas reglas)
- Gasto real del mes = items pagados en efectivo o débito + pagos hechos a tarjetas de crédito en ese mes.
- Un gasto pagado con tarjeta de CRÉDITO no cuenta como gasto real hasta que se paga la tarjeta; mientras tanto es deuda de la tarjeta.
- Un gasto pagado con DÉBITO cuenta en el momento y descuenta saldo de la cuenta.
- Pendiente = items no pagados (por su monto esperado) + saldo impago de las tarjetas de crédito.
- El objetivo de ahorro se trata como un gasto fijo del mes. Saldo libre = ingresos reales − gastos reales − objetivo de ahorro.

CATEGORÍAS DE GASTOS ACTUALES
${grupos.map(g => `- ${g.nombre} (id: ${g.id}, ${freq(g)})`).join('\n') || '- (sin categorías)'}

TARJETAS DEL MES QUE SE ESTÁ VIENDO
${tarjetas.map(t => `- ${t.nombre}: ${t.tipo === 'debito' ? 'débito' : 'crédito'} en ${t.moneda || 'UYU'}`).join('\n') || '- (sin tarjetas)'}

COMPRAS EN CUOTAS
${financiaciones.map(f => `- ${f.concepto}: ${f.cuotasTotales} cuotas de ${f.montoCuota} ${f.moneda || 'UYU'} en ${f.tarjetaNombre}`).join('\n') || '- (ninguna)'}

CÓMO TRABAJAR
- No inventes datos: usá las herramientas para obtener lo que necesites y pedí solo los meses necesarios.
- Si una herramienta dice que un mes no tiene datos, decíselo al usuario.
- Respondé en español rioplatense, claro y breve.`;
}

const FORMATO_RESPUESTA = `FORMATO DE LA RESPUESTA FINAL
Cuando ya tengas los datos, respondé SOLO con un JSON válido (sin texto alrededor) con esta estructura:
{
  "titulo": "Título corto",
  "explicacion": "Explicación clara",
  "tabla": [ { "concepto": "...", "valor": "..." } ],
  "grafico": { "tipo": "bar|pie|line", "titulo": "...", "labels": ["..."], "data": [números] },
  "conclusion": "Conclusión o recomendación"
}
Omití "tabla" o "grafico" si no aportan. Los montos van con signo $ y sin decimales salvo que importen.`;

export function contextoCompleto(auto, notas) {
  return `${auto}

NOTAS DEL USUARIO (tenelas en cuenta, tienen prioridad)
${(notas || '').trim() || '- (sin notas)'}

${FORMATO_RESPUESTA}`;
}

// ── Herramientas: definición que ve el LLM ───────────────────────────────────
const paramMeses = {
  type: 'array',
  items: { type: 'string', description: 'Mes en formato AAAA-MM' },
  description: `Meses a consultar en formato AAAA-MM (máximo ${MAX_MESES})`,
};

export const HERRAMIENTAS = [
  {
    type: 'function',
    function: {
      name: 'resumen_meses',
      description: 'Resumen de uno o varios meses: ingresos, gasto previsto/real/pendiente por categoría, tarjetas de crédito, objetivo de ahorro, saldo libre. Sirve para comparar meses.',
      parameters: { type: 'object', properties: { meses: paramMeses }, required: ['meses'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'detalle_categoria',
      description: 'Lista los gastos (items) de una categoría en los meses pedidos, con previsto, real, si está pagado, en carrito, tarjeta usada y período.',
      parameters: {
        type: 'object',
        properties: {
          categoria: { type: 'string', description: 'Nombre o id de la categoría' },
          meses: paramMeses,
        },
        required: ['categoria', 'meses'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_gastos',
      description: 'Busca por texto en los nombres de los gastos de todas las categorías y en los productos de los comprobantes (ej: "carne", "nafta", "leche").',
      parameters: {
        type: 'object',
        properties: {
          texto: { type: 'string', description: 'Texto a buscar (no distingue mayúsculas ni tildes)' },
          meses: paramMeses,
        },
        required: ['texto', 'meses'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'comprobantes',
      description: 'Tickets de compra cargados en los meses pedidos: tienda, fecha, total pagado, tarjeta y productos. Opcionalmente filtra por tienda.',
      parameters: {
        type: 'object',
        properties: {
          meses: paramMeses,
          tienda: { type: 'string', description: 'Filtrar por nombre de tienda (opcional)' },
        },
        required: ['meses'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'tarjetas',
      description: 'Detalle de tarjetas en los meses pedidos: crédito (deuda, pagado, pendiente, cuotas, gastos cargados) y débito (saldo inicial, saldo actual, movimientos).',
      parameters: { type: 'object', properties: { meses: paramMeses }, required: ['meses'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'compras_en_cuotas',
      description: 'Compras en cuotas del presupuesto con la cuota que corresponde a un mes y cuántas faltan.',
      parameters: {
        type: 'object',
        properties: { mes: { type: 'string', description: 'Mes de referencia AAAA-MM (opcional, por defecto el mes que se está viendo)' } },
      },
    },
  },
];

// ── Herramientas: implementación ─────────────────────────────────────────────
// ctx: { ownerUid, presupuestoId, grupos, financiaciones, año, mes, cache: Map }
async function cargarMes(ctx, info) {
  if (ctx.cache.has(info.clave)) return ctx.cache.get(info.clave);
  const snap = await get(ref(db, `presupuestos/${ctx.ownerUid}/${ctx.presupuestoId}/${info.clave}`));
  let data = null;
  if (snap.exists()) {
    const raw = snap.val();
    const gastos = {};
    Object.keys(raw.gastos || {}).forEach(k => {
      gastos[k] = toPeriodos(toArray(raw.gastos[k])).map(p => ({ ...p, items: toArray(p.items) }));
    });
    data = {
      ingresos: toArray(raw.ingresos),
      gastos,
      tarjetas: toArray(raw.tarjetas).map(t => ({
        ...t, saldos: toArray(t.saldos), pagos: toArray(t.pagos), cuotas: toArray(t.cuotas),
      })),
      comprobantes: toArray(raw.comprobantes).map(c => ({ ...c, items: toArray(c.items) })),
      objetivoAhorro: raw.objetivoAhorro || 0,
    };
  }
  ctx.cache.set(info.clave, data);
  return data;
}

// Valida la lista de meses y carga cada uno
async function mesesPedidos(ctx, meses) {
  const lista = (Array.isArray(meses) ? meses : [meses]).slice(0, MAX_MESES);
  const res = [];
  for (const txt of lista) {
    const info = parsearMes(txt);
    if (!info) { res.push({ mes: txt, error: 'Formato inválido, usar AAAA-MM' }); continue; }
    res.push({ info, data: await cargarMes(ctx, info) });
  }
  return res;
}

const nombreGrupo = (ctx, id) => ctx.grupos.find(g => g.id === id)?.nombre || id;
const montoPendiente = (i) => (i.real !== undefined ? (i.real || 0) : (i.previsto || 0));

function resumenDeMes(ctx, data) {
  const idsCred = idsCredito(data.tarjetas);
  const credito = data.tarjetas.filter(t => t.tipo !== 'debito');

  const categorias = Object.keys(data.gastos).map(gid => {
    const items = data.gastos[gid].flatMap(p => p.items);
    return {
      categoria: nombreGrupo(ctx, gid),
      previsto: r2(items.reduce((s, i) => s + (i.previsto || 0), 0)),
      real: r2(items.filter(i => cuentaComoGastoReal(i, idsCred)).reduce((s, i) => s + (i.real || 0), 0)),
      cargado_a_credito: r2(items.filter(i => i.pagado === true && i.tarjetaId && idsCred.has(i.tarjetaId))
        .reduce((s, i) => s + (i.real || 0), 0)),
      pendiente: r2(items.filter(i => i.pagado !== true).reduce((s, i) => s + montoPendiente(i), 0)),
      items_pagados: items.filter(i => i.pagado === true).length,
      items_totales: items.length,
    };
  });

  const porMoneda = (moneda) => credito.filter(t => (t.moneda || 'UYU') === moneda);
  const tarjetasUYU = porMoneda('UYU');
  const ingPrev = data.ingresos.reduce((s, i) => s + (i.previsto || 0), 0);
  const ingReal = data.ingresos.reduce((s, i) => s + (i.real || 0), 0);
  const gastoRealCategorias = categorias.reduce((s, c) => s + c.real, 0);
  const pagosTarjetasUYU = tarjetasUYU.reduce((s, t) => s + pagadoTarjeta(t), 0);
  const gastoReal = gastoRealCategorias + pagosTarjetasUYU;
  const gastoPrevisto = categorias.reduce((s, c) => s + c.previsto, 0)
    + tarjetasUYU.reduce((s, t) => s + previstoPropioTarjeta(t, data.gastos), 0);

  return {
    ingresos: {
      previsto: r2(ingPrev),
      real: r2(ingReal),
      detalle: data.ingresos.map(i => ({ nombre: i.nombre, previsto: r2(i.previsto), real: r2(i.real) })),
    },
    gastos_por_categoria: categorias,
    tarjetas_credito: {
      UYU: { deuda: r2(tarjetasUYU.reduce((s, t) => s + (t.monto || 0), 0)), pagado: r2(pagosTarjetasUYU), pendiente: r2(tarjetasUYU.reduce((s, t) => s + saldoTarjeta(t), 0)) },
      USD: { deuda: r2(porMoneda('USD').reduce((s, t) => s + (t.monto || 0), 0)), pagado: r2(porMoneda('USD').reduce((s, t) => s + pagadoTarjeta(t), 0)), pendiente: r2(porMoneda('USD').reduce((s, t) => s + saldoTarjeta(t), 0)) },
    },
    objetivo_ahorro: r2(data.objetivoAhorro),
    totales_UYU: {
      gasto_previsto: r2(gastoPrevisto),
      gasto_real: r2(gastoReal),
      pendiente: r2(categorias.reduce((s, c) => s + c.pendiente, 0) + tarjetasUYU.reduce((s, t) => s + saldoTarjeta(t), 0)),
      saldo_libre: r2(ingReal - gastoReal - (data.objetivoAhorro || 0)),
      ahorro_neto: r2(ingReal - gastoReal),
    },
    comprobantes_cargados: data.comprobantes.length,
  };
}

const EJECUTORES = {
  async resumen_meses(ctx, { meses }) {
    const res = {};
    for (const m of await mesesPedidos(ctx, meses)) {
      if (m.error) { res[m.mes] = m.error; continue; }
      res[m.info.iso] = m.data ? resumenDeMes(ctx, m.data) : 'Sin datos para este mes';
    }
    return res;
  },

  async detalle_categoria(ctx, { categoria, meses }) {
    const buscada = normalizar(categoria);
    const grupo = ctx.grupos.find(g => normalizar(g.id) === buscada || normalizar(g.nombre) === buscada)
      || ctx.grupos.find(g => normalizar(g.nombre).includes(buscada));
    if (!grupo) return { error: `No existe la categoría "${categoria}". Categorías: ${ctx.grupos.map(g => g.nombre).join(', ')}` };

    const res = { categoria: grupo.nombre, meses: {} };
    for (const m of await mesesPedidos(ctx, meses)) {
      if (m.error) { res.meses[m.mes] = m.error; continue; }
      if (!m.data) { res.meses[m.info.iso] = 'Sin datos para este mes'; continue; }
      const tarjetas = m.data.tarjetas;
      res.meses[m.info.iso] = (m.data.gastos[grupo.id] || []).flatMap(p => p.items.map(i => ({
        periodo: p.label,
        nombre: i.nombre,
        previsto: r2(i.previsto),
        real: r2(montoPendiente(i)),
        pagado: i.pagado === true,
        ...(i.enCarrito ? { en_carrito: true } : {}),
        ...(i.tarjetaId ? { tarjeta: tarjetas.find(t => t.id === i.tarjetaId)?.nombre || 'tarjeta eliminada' } : {}),
      })));
    }
    return res;
  },

  async buscar_gastos(ctx, { texto, meses }) {
    const q = normalizar(texto);
    if (!q) return { error: 'Texto vacío' };
    const res = { texto, gastos: [], productos_en_comprobantes: [] };
    for (const m of await mesesPedidos(ctx, meses)) {
      if (m.error || !m.data) continue;
      Object.keys(m.data.gastos).forEach(gid => {
        m.data.gastos[gid].forEach(p => p.items.forEach(i => {
          if (!normalizar(i.nombre).includes(q)) return;
          res.gastos.push({
            mes: m.info.iso, categoria: nombreGrupo(ctx, gid), periodo: p.label, nombre: i.nombre,
            previsto: r2(i.previsto), real: r2(montoPendiente(i)), pagado: i.pagado === true,
          });
        }));
      });
      m.data.comprobantes.forEach(c => c.items.forEach(it => {
        if (!normalizar(it.nombre).includes(q) && !normalizar(it.gasto).includes(q)) return;
        res.productos_en_comprobantes.push({
          mes: m.info.iso, tienda: c.tienda, fecha: (c.fecha || '').slice(0, 10),
          producto: it.nombre, cantidad: it.cantidad, monto: r2(it.monto), registrado_en: it.gasto,
        });
      }));
    }
    res.total_gastos_pagados = r2(res.gastos.filter(g => g.pagado).reduce((s, g) => s + g.real, 0));
    res.total_en_comprobantes = r2(res.productos_en_comprobantes.reduce((s, p) => s + p.monto, 0));
    return res;
  },

  async comprobantes(ctx, { meses, tienda }) {
    const filtro = normalizar(tienda);
    const res = {};
    for (const m of await mesesPedidos(ctx, meses)) {
      if (m.error) { res[m.mes] = m.error; continue; }
      if (!m.data) { res[m.info.iso] = 'Sin datos para este mes'; continue; }
      const lista = m.data.comprobantes.filter(c => !filtro || normalizar(c.tienda).includes(filtro));
      res[m.info.iso] = {
        cantidad: lista.length,
        total_pagado: r2(lista.reduce((s, c) => s + (c.totalPagado || 0), 0)),
        tickets: lista.map(c => ({
          tienda: c.tienda, fecha: (c.fecha || '').slice(0, 10), total_pagado: r2(c.totalPagado),
          tarjeta: c.tarjetaNombre || 'efectivo',
          productos: c.items.filter(it => it.destino !== 'ignorado')
            .map(it => ({ nombre: it.nombre, monto: r2(it.monto), registrado_en: it.gasto })),
        })),
      };
    }
    return res;
  },

  async tarjetas(ctx, { meses }) {
    const res = {};
    for (const m of await mesesPedidos(ctx, meses)) {
      if (m.error) { res[m.mes] = m.error; continue; }
      if (!m.data) { res[m.info.iso] = 'Sin datos para este mes'; continue; }
      const items = Object.values(m.data.gastos).flatMap(ps => ps.flatMap(p => p.items));
      res[m.info.iso] = m.data.tarjetas.map(t => {
        if (t.tipo === 'debito') {
          const actual = t.saldos.length ? t.saldos[t.saldos.length - 1].monto : (t.saldoInicial || 0);
          return {
            nombre: t.nombre, tipo: 'débito', moneda: t.moneda || 'UYU',
            saldo_inicial: r2(t.saldoInicial), saldo_actual: r2(actual),
            movimientos: t.saldos.map(s => ({ fecha: s.fecha, saldo_despues: r2(s.monto), nota: s.nota || '' })),
          };
        }
        return {
          nombre: t.nombre, tipo: 'crédito', moneda: t.moneda || 'UYU',
          deuda_del_mes: r2(t.monto), pagado: r2(pagadoTarjeta(t)), pendiente: r2(saldoTarjeta(t)),
          cuotas: t.cuotas.map(c => ({ concepto: c.concepto, cuota: `${c.numero}/${c.total}`, monto: r2(c.monto) })),
          gastos_cargados: items.filter(i => i.pagado === true && i.tarjetaId === t.id)
            .map(i => ({ nombre: i.nombre, monto: r2(i.tarjetaMonto ?? i.real) })),
        };
      });
    }
    return res;
  },

  async compras_en_cuotas(ctx, { mes } = {}) {
    const info = parsearMes(mes) || { año: ctx.año, mes: ctx.mes, iso: mesIso(ctx.año, ctx.mes) };
    return {
      mes_referencia: info.iso,
      compras: ctx.financiaciones.map(f => {
        const n = numeroCuota(f, info.año, info.mes);
        return {
          concepto: f.concepto, tarjeta: f.tarjetaNombre, moneda: f.moneda || 'UYU',
          monto_cuota: r2(f.montoCuota), cuotas_totales: f.cuotasTotales,
          inicio: mesIso(f.anioInicio, f.mesInicio),
          activa_este_mes: estaActiva(f, info.año, info.mes),
          cuota_de_este_mes: estaActiva(f, info.año, info.mes) ? n : null,
          cuotas_restantes_despues: Math.max(0, (f.cuotasTotales || 0) - Math.max(n, 0)),
        };
      }),
    };
  },
};

// ── Llamada a Groq y ciclo de herramientas ───────────────────────────────────
async function llamarGroq({ apiKey, url, modelo }, mensajes, conHerramientas) {
  const response = await fetch(`${url}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: modelo,
      messages: mensajes,
      ...(conHerramientas ? { tools: HERRAMIENTAS, tool_choice: 'auto' } : {}),
      temperature: 0.2,
      max_completion_tokens: 4096,
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    if (response.status === 429) throw new Error('Se alcanzó el límite de uso de Groq. Esperá un minuto y probá de nuevo.');
    throw new Error(`Error de Groq: ${err.error?.message || response.statusText}`);
  }
  const result = await response.json();
  return result.choices?.[0]?.message || {};
}

function parsearRespuesta(texto) {
  const limpio = (texto || '').replace(/```(json)?/g, '').trim();
  try { return JSON.parse(limpio); } catch (e) { /* sigue */ }
  const i = limpio.indexOf('{');
  const f = limpio.lastIndexOf('}');
  if (i >= 0 && f > i) {
    try { return JSON.parse(limpio.slice(i, f + 1)); } catch (e) { /* sigue */ }
  }
  return { explicacion: limpio || 'No pude generar una respuesta.' };
}

// historial: [{ pregunta, respuesta }] de la conversación (para preguntas de seguimiento)
// Devuelve { data, consultas: [{ funcion, args }] }
export async function preguntar({ pregunta, contexto, historial = [], groq, ctxDatos }) {
  const ctx = { ...ctxDatos, cache: new Map() };
  const mensajes = [{ role: 'system', content: contexto }];
  historial.slice(-3).forEach(h => {
    mensajes.push({ role: 'user', content: h.pregunta });
    mensajes.push({ role: 'assistant', content: JSON.stringify(h.respuesta) });
  });
  mensajes.push({ role: 'user', content: pregunta });

  const consultas = [];
  for (let ronda = 0; ronda <= MAX_RONDAS; ronda++) {
    // En la última ronda ya no se ofrecen herramientas: tiene que responder
    const msg = await llamarGroq(groq, mensajes, ronda < MAX_RONDAS);
    const llamadas = msg.tool_calls || [];
    if (llamadas.length === 0) {
      return { data: parsearRespuesta(msg.content), consultas };
    }

    mensajes.push({ role: 'assistant', content: msg.content || '', tool_calls: llamadas });
    for (const llamada of llamadas) {
      const nombre = llamada.function?.name;
      let args = {};
      try { args = JSON.parse(llamada.function?.arguments || '{}'); } catch (e) { /* args vacíos */ }
      consultas.push({ funcion: nombre, args });

      let resultado;
      try {
        resultado = EJECUTORES[nombre]
          ? await EJECUTORES[nombre](ctx, args)
          : { error: `La herramienta "${nombre}" no existe` };
      } catch (e) {
        resultado = { error: `Falló la consulta: ${e.message}` };
      }
      mensajes.push({ role: 'tool', tool_call_id: llamada.id, content: JSON.stringify(resultado) });
    }
  }
  throw new Error('La IA no llegó a una respuesta. Probá reformular la pregunta.');
}
