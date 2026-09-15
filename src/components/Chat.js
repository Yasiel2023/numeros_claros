// src/components/Chat.js
import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader, AlertCircle } from 'lucide-react';

export default function Chat({ apiKey, presupuestos, mesDataByMonth, defaults, año, mes }) {
  const [presupuestoSelec, setPresupuestoSelec] = useState(presupuestos?.[0]?.id || '');
  const [pregunta, setPregunta] = useState('');
  const [conversacion, setConversacion] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversacion]);

  const hacerPregunta = async () => {
    if (!pregunta.trim() || !presupuestoSelec) return;

    setLoading(true);
    setError('');

    try {
      // Construir contexto JSON completo del presupuesto
      const contexto = {
        presupuesto: presupuestoSelec,
        configuracion: {
          grupos_gastos: (defaults?.grupos_gastos || []).map(g => ({
            id: g.id,
            nombre: g.nombre,
            icono: g.icono,
            frecuencia: g.frecuencia,
            items_plantilla: g.items
          })),
          ingresos_plantilla: defaults?.ingresos || []
        },
        meses: {}
      };

      // Agregar todos los meses disponibles
      Object.keys(mesDataByMonth).forEach(mesKey => {
        const data = mesDataByMonth[mesKey];
        if (!data) return;

        contexto.meses[mesKey] = {
          ingresos: data.ingresos || [],
          gastos: data.gastos || {},
          tarjetas: data.tarjetas || [],
          objetivoAhorro: data.objetivoAhorro || 0
        };
      });

      // Hacer request a Gemini
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                {
                  text: `Eres un asistente financiero experto especializado en presupuestos personales.

CONTEXTO COMPLETO DEL PRESUPUESTO EN JSON:
${JSON.stringify(contexto, null, 2)}

Responde la pregunta de manera clara, concisa y útil. Analiza los datos, haz comparativas entre meses si es relevante, e incluye recomendaciones cuando sea apropiado.

PREGUNTA DEL USUARIO:
${pregunta}`
                }
              ]
            }],
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 1024,
            }
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(`Error de Gemini: ${err.error?.message || response.statusText}`);
      }

      const result = await response.json();
      const respuesta = result.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta';

      setConversacion(prev => [
        ...prev,
        { rol: 'usuario', texto: pregunta },
        { rol: 'asistente', texto: respuesta }
      ]);
      setPregunta('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h2>💬 Pregunta sobre tu presupuesto</h2>
        <select
          className="cell-select chat-selector"
          value={presupuestoSelec}
          onChange={(e) => setPresupuestoSelec(e.target.value)}
        >
          {presupuestos.map(p => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="chat-mensajes" ref={scrollRef}>
        {conversacion.length === 0 && (
          <div className="chat-vacio">
            <p>Hacé preguntas sobre gastos, comparativas, tendencias...</p>
            <p className="chat-ejemplos">
              Ej: "¿Cuánto gasté en comida este mes vs el anterior?" <br/>
              "¿Cuál fue mi categoría más cara?" <br/>
              "¿Cómo está mi presupuesto vs lo planeado?" <br/>
              "¿Dónde debería recortar gastos?"
            </p>
          </div>
        )}
        {conversacion.map((msg, idx) => (
          <div key={idx} className={`chat-mensaje ${msg.rol}`}>
            <div className="chat-rol">{msg.rol === 'usuario' ? 'Vos' : '🤖 Asistente'}</div>
            <div className="chat-texto">{msg.texto}</div>
          </div>
        ))}
        {loading && (
          <div className="chat-mensaje asistente">
            <div className="chat-rol">🤖 Asistente</div>
            <div className="chat-texto">
              <Loader size={16} className="spin" /> Pensando...
            </div>
          </div>
        )}
      </div>

      <div className="chat-input-group">
        <input
          type="text"
          className="chat-input"
          placeholder="Preguntá lo que quieras sobre tu presupuesto..."
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !loading && hacerPregunta()}
          disabled={loading || !apiKey}
        />
        <button
          className="chat-btn-enviar"
          onClick={hacerPregunta}
          disabled={loading || !pregunta.trim() || !apiKey}
          title={!apiKey ? 'Configura tu API key en ⚙️ Configuración primero' : ''}
        >
          <Send size={18} />
        </button>
      </div>

      {!apiKey && (
        <div className="chat-nota">
          ⚙️ Necesitas configurar tu API key de Gemini en Configuración para usar este chat.
        </div>
      )}
    </div>
  );
}
