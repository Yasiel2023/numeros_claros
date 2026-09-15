// src/gemini.js
// Integración con Google Gemini Vision API
// La API key se pasa en cada request; se guarda en localStorage del navegador.

const GEMINI_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

export async function desglosarComprobante(imageBase64, apiKey) {
  if (!apiKey) throw new Error('API key de Gemini no configurada');
  if (!imageBase64) throw new Error('Imagen no proporcionada');

  const mediaType = imageBase64.startsWith('data:')
    ? imageBase64.split(';')[0].replace('data:', '')
    : 'image/jpeg';

  // Remover el data URI prefix si existe
  const data = imageBase64.includes(',')
    ? imageBase64.split(',')[1]
    : imageBase64;

  const payload = {
    contents: [{
      parts: [
        {
          text: `Eres un experto en análisis de comprobantes. Analiza esta foto de comprobante/factura y extrae TODOS los items con sus detalles.

Devuelve un JSON válido con esta estructura exacta:
{
  "tienda": "nombre de la tienda o comercio",
  "items": [
    {
      "nombre": "descripción del producto",
      "cantidad": número,
      "precio_unitario": número (sin moneda),
      "total": número (sin moneda)
    }
  ],
  "observaciones": "notas si hay descuentos, impuestos, o datos incompletos"
}

IMPORTANTE:
- Extrae TODOS los items que veas, incluso si son pequeños
- Los precios deben ser solo números, sin símbolo de moneda
- Si no ves cantidad, asume 1
- Si hay subtotal/total/impuestos, no los incluyas como items — solo los productos reales
- Si la imagen está borrosa o no es un comprobante válido, devuelve JSON con items vacío y una observación clara`
        },
        {
          inlineData: {
            mimeType: mediaType,
            data: data
          }
        }
      ]
    }],
    generationConfig: {
      temperature: 0.2,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 1024,
      responseMimeType: "application/json"
    }
  };

  const response = await fetch(`${GEMINI_API_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Gemini API error: ${error.error?.message || response.statusText}`);
  }

  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Sin respuesta de Gemini');

  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`No se pudo parsear la respuesta: ${text}`);
  }
}

// Las API keys ahora se cargan desde Firebase en App.js
// y se pasan directamente a los componentes que las necesitan
