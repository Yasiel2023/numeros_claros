// src/iaCliente.js
// Todas las llamadas a la IA pasan por el Worker de Cloudflare (ia-worker/): la clave
// de Groq nunca llega al cliente. Se manda el ID token de Firebase para que el Worker
// verifique la sesión, y el cuerpo listo para Groq sin "model" (lo elige el Worker).
import { auth } from './firebase';

// Se puede cambiar con REACT_APP_IA_URL (ej. para un Worker de pruebas)
const IA_URL = process.env.REACT_APP_IA_URL || 'https://numeros-claros-ia.numeros-claros-ia-worker.workers.dev';

// tipo: 'vision' (tickets, armar presupuesto) | 'chat' (Preguntas IA con herramientas)
// Devuelve el primer "choice" de la respuesta: { finish_reason, message }
export async function llamarIA({ tipo, ...pedido }) {
  if (!IA_URL) throw new Error('La IA no está configurada en esta versión de la app.');
  const usuario = auth.currentUser;
  if (!usuario) throw new Error('Tenés que iniciar sesión para usar la IA.');
  const token = await usuario.getIdToken();

  let respuesta;
  try {
    respuesta = await fetch(IA_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-IA-Tipo': tipo,
      },
      body: JSON.stringify(pedido),   // JSON.stringify descarta los campos undefined
    });
  } catch (e) {
    throw new Error('No se pudo conectar con la IA. Revisá tu conexión.');
  }

  const data = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw new Error(data?.error?.message || `Error de la IA (${respuesta.status})`);
  const choice = data?.choices?.[0];
  if (!choice) throw new Error('Sin respuesta de la IA');
  return choice;
}
