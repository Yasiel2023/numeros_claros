// ia-worker/src/index.js
// Proxy de IA en Cloudflare Workers. La app nunca ve la clave de Groq:
//   1. Verifica el ID token de Firebase del usuario (firma de Google, proyecto numeros-claros).
//   2. Aplica un límite por usuario (Rate Limiting de Cloudflare; los admins no tienen límite).
//   3. Elige el modelo según el tipo de pedido y reenvía a Groq con la clave (secreto GROQ_API_KEY).
//
// Para no gastar CPU (el plan gratuito da ~10 ms por pedido), el cuerpo NO se parsea:
// la app manda el JSON listo para Groq sin "model" y el Worker solo le antepone el modelo.
import { createRemoteJWKSet, jwtVerify } from 'jose';

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

export default {
  async fetch(request, env) {
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

    const [cfg, esAdmin] = await Promise.all([
      leerRTDB('sistema/ia', token),
      leerRTDB(`admins/${uid}`, token),
    ]);
    if (!cfg || cfg.activa !== true) return error(request, 503, 'La IA está desactivada por el administrador.');

    // 3. Límite por usuario (TODO suscripciones: acá se verificará que sea premium)
    if (esAdmin !== true && env.LIMITADOR) {
      const { success } = await env.LIMITADOR.limit({ key: uid });
      if (!success) return error(request, 429, 'Estás haciendo muchas consultas seguidas. Esperá un minuto.');
    }

    // 4. Cuerpo: JSON de Groq sin "model" → se antepone el modelo sin parsear
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
