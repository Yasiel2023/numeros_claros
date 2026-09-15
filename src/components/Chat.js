// src/components/Chat.js
import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader, AlertCircle } from 'lucide-react';

// Importar Chart.js del CDN
if (typeof window !== 'undefined' && !window.Chart) {
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js';
  document.head.appendChild(script);
}

export default function Chat({ apiKey, groqUrl, groqModel, presupuestos, mesDataByMonth, defaults, año, mes }) {
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

  // Renderizar gráficos con Chart.js
  useEffect(() => {
    const renderCharts = () => {
      conversacion.forEach((msg, idx) => {
        if (msg.data?.grafico) {
          const canvas = document.getElementById(`chart-${idx}`);
          if (!canvas) return;

          // Verificar que Chart esté disponible
          if (typeof window === 'undefined' || !window.Chart) {
            console.log('Chart.js no disponible aún');
            return;
          }

          try {
            const ctx = canvas.getContext('2d');
            const g = msg.data.grafico;

            // Destruir gráfico anterior si existe
            if (canvas.chart) {
              canvas.chart.destroy();
            }

            canvas.chart = new window.Chart(ctx, {
              type: g.tipo || 'bar',
              data: {
                labels: g.labels || [],
                datasets: [{
                  label: g.titulo || 'Datos',
                  data: g.data || [],
                  backgroundColor: [
                    '#0D9488', '#3B82F6', '#FBBF24', '#10B981', '#A78BFA',
                    '#FB923C', '#F87171', '#64748B'
                  ].slice(0, (g.data || []).length),
                  borderColor: '#e5e7eb',
                  borderWidth: 1,
                }]
              },
              options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                  legend: { display: g.tipo !== 'bar' }
                }
              }
            });
          } catch (e) {
            console.error('Error renderizando gráfico:', e);
          }
        }
      });
    };

    // Esperar a que Chart.js esté disponible
    const waitForChart = setInterval(() => {
      if (typeof window !== 'undefined' && window.Chart) {
        clearInterval(waitForChart);
        setTimeout(renderCharts, 50);
      }
    }, 100);

    // Intentar renderizar inmediatamente también
    renderCharts();

    return () => clearInterval(waitForChart);
  }, [conversacion]);

  const hacerPregunta = async () => {
    if (!pregunta.trim() || !presupuestoSelec) return;

    setLoading(true);
    setError('');

    try {
      // Detectar si pide datos históricos
      const palabrasClave = ['pasado', 'anterior', 'mes anterior', 'vs', 'comparar', 'comparativa',
                             'últimos', 'última', 'tendencia', 'evolución', 'promedio', 'histórico',
                             'semana pasada', 'mes pasado', 'hace'];
      const esHistorico = palabrasClave.some(palabra =>
        pregunta.toLowerCase().includes(palabra)
      );

      const mesActualKey = `${año}_${mes}`;
      const mesActual = mesDataByMonth[mesActualKey];

      let contexto;

      if (esHistorico && Object.keys(mesDataByMonth).length > 1) {
        // Enviar JSON completo minificado para análisis histórico
        const datosCompletos = {};
        Object.keys(mesDataByMonth).forEach(mesKey => {
          const data = mesDataByMonth[mesKey];
          if (data) {
            datosCompletos[mesKey] = {
              ingresos: data.ingresos || [],
              gastos: data.gastos || {},
              tarjetas: data.tarjetas || [],
              objetivoAhorro: data.objetivoAhorro || 0
            };
          }
        });
        contexto = `Presupuesto: ${presupuestoSelec}
Datos históricos disponibles: ${Object.keys(mesDataByMonth).join(', ')}

CONTEXTO COMPLETO (JSON):
${JSON.stringify(datosCompletos)}`;
      } else {
        // Resumen solo del mes actual
        const resumenGastos = {};
        if (mesActual?.gastos) {
          Object.keys(mesActual.gastos).forEach(grupoId => {
            const grupo = defaults?.grupos_gastos?.find(g => g.id === grupoId);
            const periodos = mesActual.gastos[grupoId] || [];
            const totalReal = periodos.reduce((sum, p) => {
              const itemsReales = (p.items || []).reduce((s, it) => s + (it.real || 0), 0);
              return sum + itemsReales;
            }, 0);
            if (grupo) {
              resumenGastos[grupo.nombre] = totalReal;
            }
          });
        }

        contexto = `Presupuesto: ${presupuestoSelec}
Mes: ${año}-${String(mes + 1).padStart(2, '0')}

INGRESOS: $${(mesActual?.ingresos || []).reduce((s, i) => s + (i.real || 0), 0)}

GASTOS POR CATEGORÍA:
${Object.entries(resumenGastos).map(([cat, val]) => `- ${cat}: $${val}`).join('\n')}

OBJETIVO DE AHORRO: $${mesActual?.objetivoAhorro || 0}

Datos disponibles: Presupuesto de ${año}`;
      }

      // Hacer request a Groq (API compatible con OpenAI)
      const response = await fetch(
        `${groqUrl}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: groqModel,
            messages: [
              {
                role: 'system',
                content: `Eres un asistente financiero experto. Responde SIEMPRE en formato JSON con esta estructura:
{
  "titulo": "Título de la respuesta",
  "explicacion": "Explicación en texto claro",
  "tabla": [
    {"concepto": "...", "valor": "..."},
    ...
  ],
  "grafico": {
    "tipo": "bar|pie|line",
    "labels": ["etiqueta1", "etiqueta2"],
    "data": [valor1, valor2]
  },
  "conclusion": "Conclusión y recomendaciones"
}

Si no necesitas tabla o gráfico, omite esos campos. Siempre devuelve JSON válido.`
              },
              {
                role: 'user',
                content: `${contexto}

PREGUNTA DEL USUARIO:
${pregunta}`
              }
            ],
            temperature: 0.7,
            max_tokens: 1024
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(`Error de Groq: ${err.error?.message || response.statusText}`);
      }

      const result = await response.json();
      const respuestaRaw = result.choices?.[0]?.message?.content || '{}';

      // Parsear respuesta JSON
      let respuestaData;
      try {
        respuestaData = JSON.parse(respuestaRaw);
      } catch (e) {
        respuestaData = { explicacion: respuestaRaw };
      }

      setConversacion(prev => [
        ...prev,
        { rol: 'usuario', texto: pregunta },
        { rol: 'asistente', data: respuestaData }
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
            {msg.texto && <div className="chat-texto">{msg.texto}</div>}
            {msg.data && (
              <div className="chat-respuesta-estructurada">
                {msg.data.titulo && <h3>{msg.data.titulo}</h3>}
                {msg.data.explicacion && <p>{msg.data.explicacion}</p>}

                {msg.data.tabla && (
                  <table className="chat-tabla">
                    <tbody>
                      {msg.data.tabla.map((fila, i) => (
                        <tr key={i}>
                          <td><strong>{fila.concepto}</strong></td>
                          <td>{fila.valor}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {msg.data.grafico && (
                  <canvas id={`chart-${idx}`} style={{maxHeight: '300px', marginTop: '15px'}}></canvas>
                )}

                {msg.data.conclusion && <p className="chat-conclusion"><em>{msg.data.conclusion}</em></p>}
              </div>
            )}
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
          ⚙️ Necesitas configurar tu API key de Groq en Configuración para usar este chat.
        </div>
      )}
    </div>
  );
}
