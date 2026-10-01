// src/ia.js
// Lectura de comprobantes y sugerencia de matches con Groq (API compatible con OpenAI).
// La API key y la URL son las mismas que usa el chat (config/{uid}/groq_*).

const GROQ_URL_DEFAULT = 'https://api.groq.com/openai/v1';
// Modelo con soporte de imágenes. Es independiente del modelo elegido para el chat.
const GROQ_MODELO_VISION = 'qwen/qwen3.8-27b';

// Achica la foto antes de enviarla: Groq acepta hasta 4MB en base64 y una foto
// de celular suele pasarse. Además la consulta responde más rápido.
function reducirImagen(dataUrl, ladoMax = 2000, calidad = 0.85) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, ladoMax / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', calidad));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function parsearJSON(text) {
  // Algunos modelos anteponen su razonamiento entre <think>...</think>
  const limpio = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  try {
    return JSON.parse(limpio);
  } catch (e) {
    // Último recurso: rescatar el objeto JSON si vino rodeado de texto
    const inicio = limpio.indexOf('{');
    const fin = limpio.lastIndexOf('}');
    if (inicio >= 0 && fin > inicio) {
      try { return JSON.parse(limpio.slice(inicio, fin + 1)); } catch (_) { /* sigue abajo */ }
    }
    console.error('Respuesta de la IA no parseable:', text);
    throw new Error('La IA devolvió una respuesta inválida. Probá de nuevo.');
  }
}

// Llama a Groq en modo JSON y devuelve el objeto parseado.
// ia: { apiKey, url }. imagen: data URL opcional.
async function llamarGroq(prompt, imagen, ia) {
  if (!ia?.apiKey) throw new Error('Configurá tu API key de Groq en Configuración');

  const content = imagen
    ? [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: imagen } }]
    : prompt;

  const body = JSON.stringify({
    model: GROQ_MODELO_VISION,
    messages: [{ role: 'user', content }],
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_completion_tokens: 8192,
  });

  // Ante saturación (503) o límite de uso (429) se reintenta con espera creciente
  const ESPERAS_MS = [1500, 4000, 8000];
  let response;
  for (let intento = 0; ; intento++) {
    response = await fetch(`${ia.url || GROQ_URL_DEFAULT}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ia.apiKey}` },
      body,
    });
    const reintentable = response.status === 503 || response.status === 429 || response.status === 500;
    if (response.ok || !reintentable || intento >= ESPERAS_MS.length) break;
    await new Promise(r => setTimeout(r, ESPERAS_MS[intento]));
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    if (response.status === 503 || response.status === 429) {
      throw new Error('El servicio de IA está saturado o se alcanzó el límite de uso. Esperá un minuto y probá de nuevo.');
    }
    throw new Error(`Error de Groq: ${error.error?.message || response.statusText}`);
  }

  const result = await response.json();
  const choice = result.choices?.[0];
  if (choice?.finish_reason === 'length') {
    throw new Error('La respuesta de la IA quedó cortada. Probá de nuevo o con una foto más recortada.');
  }
  const text = choice?.message?.content;
  if (!text) throw new Error('Sin respuesta de la IA');
  return parsearJSON(text);
}

export async function desglosarComprobante(imageBase64, ia) {
  if (!imageBase64) throw new Error('Imagen no proporcionada');
  const imagen = await reducirImagen(imageBase64);

  const resultado = await llamarGroq(`Eres un experto en análisis de comprobantes. Analiza esta foto de comprobante/factura y extrae TODOS los items con sus detalles.

Devuelve SOLO un JSON válido con esta estructura exacta:
{
  "tienda": "nombre de la tienda o comercio",
  "items": [
    { "nombre": "descripción del producto", "cantidad": número, "precio_unitario": número, "total": número }
  ],
  "total_pagado": número,
  "observaciones": "notas si hay descuentos, impuestos, o datos incompletos"
}

IMPORTANTE:
- Extrae TODOS los items que veas, incluso si son pequeños
- Los precios deben ser solo números, sin símbolo de moneda
- Si no ves cantidad, asume 1. Las cantidades pesadas (ej: "0.535 UN x 119.00") van con decimales
- Si hay subtotal/total/impuestos/descuentos/forma de pago, no los incluyas como items — solo los productos reales
- total_pagado es lo que efectivamente se pagó después de descuentos (ej: "Pago total", "Total a pagar", descontando devolución de IVA / Ley 19210). Si no hay descuentos, es el total del comprobante. Nunca incluyas el cambio/vuelto
- Si la imagen está borrosa o no es un comprobante válido, devuelve items vacío y una observación clara`,
    imagen, ia);

  return {
    tienda: resultado.tienda || '',
    observaciones: resultado.observaciones || '',
    total_pagado: Number(resultado.total_pagado) || 0,
    items: (Array.isArray(resultado.items) ? resultado.items : [])
      .filter(i => i && i.nombre)
      .map(i => ({ ...i, total: Number(i.total) || 0 })),
  };
}

// Sugiere, para cada item del comprobante, cuál de los gastos existentes de una
// categoría le corresponde. Devuelve { [idx]: nombreExistente | null }.
// enCarrito: gastos que el usuario fue montando al carrito; son los más probables.
export async function sugerirMatches(itemsComprobante, gastosExistentes, ia, enCarrito = []) {
  const res = Object.fromEntries(itemsComprobante.map(i => [i.idx, null]));
  if (!itemsComprobante.length || !gastosExistentes.length) return res;

  const parsed = await llamarGroq(`Tenés items de un comprobante de compra y una lista de gastos ya registrados en una categoría del presupuesto familiar.
Para cada item del comprobante, elegí el gasto registrado al que corresponde (por ejemplo "LECHE CONAPROLE 1L" corresponde a "Leche", "DETERG. NEVEX" a "Limpieza").
Si ninguno corresponde razonablemente, usá null.

Gastos registrados (usá el nombre EXACTO):
${JSON.stringify(gastosExistentes)}
${enCarrito.length ? `
De esos, el usuario montó estos al carrito durante la compra, así que son los más probables (preferilos ante la duda):
${JSON.stringify(enCarrito)}
` : ''}
Items del comprobante:
${JSON.stringify(itemsComprobante.map(i => ({ idx: i.idx, nombre: i.nombre })))}

Devolvé SOLO un JSON válido con esta estructura exacta:
{ "matches": [ { "idx": número, "gasto": "nombre exacto del gasto registrado" o null } ] }`,
    null, ia);

  // Solo se aceptan nombres que existan de verdad en la categoría
  (parsed.matches || []).forEach(m => {
    if (m && m.idx in res && gastosExistentes.includes(m.gasto)) res[m.idx] = m.gasto;
  });
  return res;
}
