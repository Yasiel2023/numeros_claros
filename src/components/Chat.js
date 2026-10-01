// src/components/Chat.js
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Loader, AlertCircle, Brain, Save } from 'lucide-react';
import {
  preguntar, contextoAutomatico, contextoCompleto,
  cargarNotasContexto, guardarNotasContexto,
} from '../iaChat';

// Importar Chart.js del CDN
if (typeof window !== 'undefined' && !window.Chart) {
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js';
  document.head.appendChild(script);
}

// Texto legible de una consulta: resumen_meses(2026-09, 2026-10)
const describirConsulta = ({ funcion, args }) => {
  const valores = Object.values(args || {})
    .map(v => (Array.isArray(v) ? v.join(', ') : v))
    .filter(v => v !== undefined && v !== '');
  return `${funcion}(${valores.join(' · ')})`;
};

export default function Chat({
  apiKey, groqUrl, groqModel,
  presupuestoNombre, ownerUid, presupuestoId,
  grupos = [], tarjetas = [], financiaciones = [],
  año, mes,
}) {
  const [pregunta, setPregunta] = useState('');
  const [conversacion, setConversacion] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);

  // ── Contexto: parte automática + notas del usuario (en Firebase) ──
  const [verContexto, setVerContexto] = useState(false);
  const [notas, setNotas] = useState('');
  const [notasGuardadas, setNotasGuardadas] = useState('');
  const [guardandoNotas, setGuardandoNotas] = useState(false);

  useEffect(() => {
    if (!ownerUid || !presupuestoId) return;
    let cancelado = false;
    cargarNotasContexto(ownerUid, presupuestoId)
      .then(n => { if (!cancelado) { setNotas(n); setNotasGuardadas(n); } })
      .catch(e => console.error('Error cargando el contexto de la IA:', e));
    return () => { cancelado = true; };
  }, [ownerUid, presupuestoId]);

  const auto = useMemo(
    () => contextoAutomatico({ presupuestoNombre, grupos, año, mes, tarjetas, financiaciones }),
    [presupuestoNombre, grupos, año, mes, tarjetas, financiaciones],
  );

  const guardarNotas = async () => {
    setGuardandoNotas(true);
    try {
      await guardarNotasContexto(ownerUid, presupuestoId, notas);
      setNotasGuardadas(notas);
    } catch (e) {
      setError(`No se pudieron guardar las notas: ${e.message}`);
    }
    setGuardandoNotas(false);
  };

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
          if (typeof window === 'undefined' || !window.Chart) return;

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
    const texto = pregunta.trim();
    if (!texto || !ownerUid || !presupuestoId) return;

    setLoading(true);
    setError('');
    setPregunta('');
    setConversacion(prev => [...prev, { rol: 'usuario', texto }]);

    try {
      // Las preguntas anteriores se mandan para entender preguntas de seguimiento
      const historial = conversacion
        .filter(m => m.rol === 'asistente' && m.pregunta)
        .map(m => ({ pregunta: m.pregunta, respuesta: m.data }));

      const { data, consultas } = await preguntar({
        pregunta: texto,
        contexto: contextoCompleto(auto, notasGuardadas),
        historial,
        groq: { apiKey, url: groqUrl, modelo: groqModel },
        ctxDatos: { ownerUid, presupuestoId, grupos, financiaciones, año, mes },
      });

      setConversacion(prev => [...prev, { rol: 'asistente', pregunta: texto, data, consultas }]);
    } catch (e) {
      setError(e.message);
      // Se devuelve la pregunta al input para poder reintentar
      setConversacion(prev => prev.slice(0, -1));
      setPregunta(texto);
    } finally {
      setLoading(false);
    }
  };

  const notasSinGuardar = notas !== notasGuardadas;

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h2>💬 Pregunta sobre tu presupuesto</h2>
        <button
          className={`btn-sm-outline chat-ctx-btn${verContexto ? ' activo' : ''}`}
          onClick={() => setVerContexto(v => !v)}
          title="Ver y editar lo que sabe la IA sobre tu presupuesto"
        >
          <Brain size={14} /> Contexto
        </button>
      </div>

      {verContexto && (
        <div className="chat-contexto">
          <div className="chat-ctx-seccion">
            <h3>Tus notas</h3>
            <p className="chat-ctx-ayuda">
              Explicale a la IA lo que no puede deducir de los datos. Ej: "IVA Yasiel e IVA Aylin son los impuestos
              de cada uno", "Fresh Market y Disco son supermercados", "el sueldo entra el día 5".
              Se guarda en el presupuesto, así que vale también para quienes lo comparten.
            </p>
            <textarea
              className="chat-ctx-notas"
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Escribí tus notas para la IA..."
              rows={5}
            />
            <div className="chat-ctx-acciones">
              {notasSinGuardar && <span className="chat-ctx-pend">Cambios sin guardar</span>}
              <button className="btn-primary" onClick={guardarNotas} disabled={!notasSinGuardar || guardandoNotas}>
                {guardandoNotas ? <Loader size={14} className="spin" /> : <Save size={14} />} Guardar notas
              </button>
            </div>
          </div>

          <div className="chat-ctx-seccion">
            <h3>Parte automática</h3>
            <p className="chat-ctx-ayuda">
              Esto lo arma la app con tus datos actuales y se manda en cada pregunta, junto con tus notas.
              Además, la IA puede pedir datos con estas consultas: resumen_meses, detalle_categoria, buscar_gastos,
              listar_gastos, sumar_gastos, comprobantes, tarjetas y compras_en_cuotas. La app las ejecuta y le devuelve solo lo pedido.
            </p>
            <pre className="chat-ctx-auto">{auto}</pre>
          </div>
        </div>
      )}

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
              Ej: "¿Cuánto gasté en supermercado este mes vs el anterior?" <br/>
              "¿Cuál fue mi categoría más cara en los últimos 3 meses?" <br/>
              "¿Cuánto gasté en lácteos en los últimos 3 meses?" <br/>
              "¿Cuánto me queda por pagar de la tarjeta?"
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

                {Array.isArray(msg.data.tabla) && msg.data.tabla.length > 0 && (
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

                {msg.consultas?.length > 0 && (
                  <div className="chat-consultas">
                    🔎 Consultó: {msg.consultas.map(describirConsulta).join(' · ')}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="chat-mensaje asistente">
            <div className="chat-rol">🤖 Asistente</div>
            <div className="chat-texto">
              <Loader size={16} className="spin" /> Pensando y consultando tus datos...
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
