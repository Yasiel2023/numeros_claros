// ia-worker/src/index.js
// Proxy de IA en Cloudflare Workers. La app nunca ve la clave de Groq:
//   1. Verifica el ID token de Firebase del usuario (firma de Google, proyecto numeros-claros).
//   2. Con la suscripción activa (sistema/suscripcion), corta la IA a quien no es premium y ya terminó la prueba.
//   3. Aplica un límite por usuario (Rate Limiting de Cloudflare; los admins no tienen límite).
//   4. Elige el modelo según el tipo de pedido y reenvía a Groq con la clave (secreto GROQ_API_KEY).
//
// Para no gastar CPU (el plan gratuito da ~10 ms por pedido), el cuerpo NO se parsea:
// la app manda el JSON listo para Groq sin "model" y el Worker solo le antepone el modelo.
import { createRemoteJWKSet, jwtVerify, importPKCS8, SignJWT } from 'jose';

const PROYECTO = 'numeros-claros';
const RTDB = 'https://numeros-claros-default-rtdb.firebaseio.com';
const JWKS = createRemoteJWKSet(new URL(
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));

const GROQ_URL_DEFAULT = 'https://api.groq.com/openai/v1';
const MODELO_CHAT_DEFAULT = 'openai/gpt-oss-120b';
const MODELO_VISION = 'qwen/qwen3.8-27b';     // tickets y armar presupuesto desde foto
const TAMANO_MAXIMO = 6_000_000;              // bytes (una foto achicada pesa ~1-2 MB)
const ESPERAS_MS = [1500, 4000, 8000];        // reintentos ante saturación de Groq

const ORIGENES = [
  'https://numeros-claros.web.app',
  'https://numeros-claros.firebaseapp.com',
  'https://localhost',        // app Android (Capacitor)
  'http://localhost:3000',    // desarrollo
];

function cors(request) {
  const origen = request.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': ORIGENES.includes(origen) ? origen : ORIGENES[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-IA-Tipo',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const json = (request, status, cuerpo) => new Response(JSON.stringify(cuerpo), {
  status, headers: { 'Content-Type': 'application/json', ...cors(request) },
});
const error = (request, status, mensaje) => json(request, status, { error: { message: mensaje } });

// Lee un nodo de Realtime Database con el token del usuario (respeta las reglas)
async function leerRTDB(ruta, token) {
  const r = await fetch(`${RTDB}/${ruta}.json?auth=${encodeURIComponent(token)}`);
  return r.ok ? r.json() : null;
}

const DIA_MS = 24 * 60 * 60 * 1000;
const DIAS_PRUEBA_DEFAULT = 14;

function tienePremium(sub) {
  if (sub?.premium !== true) return false;
  const hasta = sub.hasta ? Date.parse(sub.hasta) : null;
  return hasta === null || Number.isNaN(hasta) || hasta > Date.now();
}

// true solo si se sabe cuándo empezó la prueba y ya pasaron los días configurados
function pruebaVencida(cfgSub, creadoEn) {
  const inicio = creadoEn ? Date.parse(creadoEn) : NaN;
  if (Number.isNaN(inicio)) return false;
  const dias = Number(cfgSub?.dias_prueba) >= 0 ? Number(cfgSub.dias_prueba) : DIAS_PRUEBA_DEFAULT;
  return inicio + dias * DIA_MS <= Date.now();
}

// ── Webhook de RevenueCat (pagos de Google Play) ─────────────────────────────
// RevenueCat avisa cada compra, renovación, cancelación o vencimiento. Acá se traduce a
// suscripciones/{uid} = { premium, hasta, ... } en la base, con una cuenta de servicio
// (las reglas no dejan a los usuarios escribir ese nodo).
//   Secretos: REVENUECAT_WEBHOOK_SECRET (el mismo valor va en el encabezado Authorization
//   del webhook de RevenueCat) y FIREBASE_SERVICE_ACCOUNT (JSON de la cuenta de servicio).
const ACTIVAN = ['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION', 'NON_RENEWING_PURCHASE'];
const MANTIENEN = ['CANCELLATION', 'BILLING_ISSUE', 'SUBSCRIPTION_PAUSED'];   // sigue premium hasta que venza
let tokenServicio = { valor: '', vence: 0 };

async function tokenDeServicio(env) {
  if (tokenServicio.valor && tokenServicio.vence > Date.now() + 60_000) return tokenServicio.valor;
  const cuenta = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  const clave = await importPKCS8(cuenta.private_key, 'RS256');
  const ahora = Math.floor(Date.now() / 1000);
  const jwt = await new SignJWT({ scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(cuenta.client_email).setSubject(cuenta.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(ahora).setExpirationTime(ahora + 3600)
    .sign(clave);
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!r.ok) throw new Error(`Token de servicio: ${r.status}`);
  const { access_token, expires_in } = await r.json();
  tokenServicio = { valor: access_token, vence: Date.now() + expires_in * 1000 };
  return access_token;
}

async function webhookRevenueCat(request, env) {
  if (request.method !== 'POST') return new Response('Método no permitido', { status: 405 });
  if (!env.REVENUECAT_WEBHOOK_SECRET || !env.FIREBASE_SERVICE_ACCOUNT) return new Response('No configurado', { status: 503 });
  if (request.headers.get('Authorization') !== `Bearer ${env.REVENUECAT_WEBHOOK_SECRET}`) return new Response('No autorizado', { status: 401 });

  const { event } = await request.json().catch(() => ({}));
  const uid = event?.app_user_id;
  // Solo usuarios de Firebase: los anónimos de RevenueCat y los eventos de prueba se ignoran
  if (!event || !uid || uid.startsWith('$RCAnonymousID') || event.type === 'TEST') return new Response('ok');

  let premium;
  if (ACTIVAN.includes(event.type)) premium = true;
  else if (event.type === 'EXPIRATION') premium = false;
  else if (MANTIENEN.includes(event.type)) premium = undefined;
  else return new Response('ok');

  const token = await tokenDeServicio(env);
  const ruta = `${RTDB}/suscripciones/${encodeURIComponent(uid)}.json`;
  // Los avisos pueden llegar desordenados: se descarta el que sea más viejo que el guardado
  const actual = await (await fetch(`${ruta}?access_token=${token}`)).json().catch(() => null);
  if (actual?.evento_ms && event.event_timestamp_ms && actual.evento_ms > event.event_timestamp_ms) return new Response('ok');

  const cambios = {
    ...(premium !== undefined ? { premium } : {}),
    ...(event.expiration_at_ms ? { hasta: new Date(event.expiration_at_ms).toISOString() } : {}),
    ...(event.type === 'CANCELLATION' ? { cancelada: true } : premium === true ? { cancelada: false } : {}),
    producto: event.product_id || null,
    tienda: event.store || null,
    evento: event.type,
    evento_ms: event.event_timestamp_ms || Date.now(),
    actualizado: new Date().toISOString(),
  };
  const r = await fetch(`${ruta}?access_token=${token}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cambios),
  });
  return new Response(r.ok ? 'ok' : 'Error al guardar', { status: r.ok ? 200 : 502 });
}

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === '/webhook/revenuecat') return webhookRevenueCat(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request) });
    if (request.method !== 'POST') return error(request, 405, 'Método no permitido');

    // 1. Sesión de Firebase
    const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return error(request, 401, 'Tenés que iniciar sesión para usar la IA.');
    let uid;
    try {
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: `https://securetoken.google.com/${PROYECTO}`,
        audience: PROYECTO,
      });
      uid = payload.sub;
    } catch (e) {
      return error(request, 401, 'Tu sesión venció. Volvé a iniciar sesión.');
    }
    if (!uid) return error(request, 401, 'Sesión inválida.');

    // 2. Pedido
    const tipo = request.headers.get('X-IA-Tipo');
    if (!['vision', 'chat'].includes(tipo)) return error(request, 400, 'Pedido de IA inválido.');
    const largo = Number(request.headers.get('Content-Length') || 0);
    if (largo > TAMANO_MAXIMO) return error(request, 413, 'El pedido es demasiado grande. Probá con una foto más chica.');
    if (!env.GROQ_API_KEY) return error(request, 503, 'La IA todavía no está configurada. Avisale al administrador.');

    const [cfg, esAdmin, cfgSub, creadoEn, suscripcion] = await Promise.all([
      leerRTDB('sistema/ia', token),
      leerRTDB(`admins/${uid}`, token),
      leerRTDB('sistema/suscripcion', token),
      leerRTDB(`usuarios/${uid}/creadoEn`, token),
      leerRTDB(`suscripciones/${uid}`, token),
    ]);
    if (!cfg || cfg.activa !== true) return error(request, 503, 'La IA está desactivada por el administrador.');

    // 3. Suscripción: con el sistema activo, la IA es solo para premium o durante la prueba
    //    (mismo cálculo que src/suscripcion.js; los admins siempre pasan)
    if (esAdmin !== true && cfgSub?.activa === true && !tienePremium(suscripcion) && pruebaVencida(cfgSub, creadoEn)) {
      return error(request, 403, 'La IA es parte del plan premium. Tu prueba gratuita terminó.');
    }

    // 4. Límite por usuario
    if (esAdmin !== true && env.LIMITADOR) {
      const { success } = await env.LIMITADOR.limit({ key: uid });
      if (!success) return error(request, 429, 'Estás haciendo muchas consultas seguidas. Esperá un minuto.');
    }

    // 5. Cuerpo: JSON de Groq sin "model" → se antepone el modelo sin parsear
    const cuerpo = (await request.text()).trim();
    if (!cuerpo.startsWith('{') || cuerpo.length > TAMANO_MAXIMO) return error(request, 400, 'Pedido de IA inválido.');
    const modelo = tipo === 'vision' ? MODELO_VISION : (cfg.groq_model || MODELO_CHAT_DEFAULT);
    const body = `{"model":${JSON.stringify(modelo)},${cuerpo.slice(1)}`;

    let respuesta;
    for (let intento = 0; ; intento++) {
      respuesta = await fetch(`${cfg.groq_url || GROQ_URL_DEFAULT}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.GROQ_API_KEY}` },
        body,
      });
      const reintentable = [429, 500, 503].includes(respuesta.status);
      if (respuesta.ok || !reintentable || intento >= ESPERAS_MS.length) break;
      await new Promise(r => setTimeout(r, ESPERAS_MS[intento]));
    }

    if (respuesta.status === 429 || respuesta.status === 503) {
      return error(request, 503, 'El servicio de IA está saturado. Esperá un minuto y probá de nuevo.');
    }
    // La respuesta de Groq (o su error) se devuelve tal cual
    return new Response(respuesta.body, {
      status: respuesta.status,
      headers: { 'Content-Type': 'application/json', ...cors(request) },
    });
  },
};
