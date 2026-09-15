// src/components/Config.js
import React, { useState, useEffect } from 'react';
import { AlertCircle, Eye, EyeOff, Check, Trash2 } from 'lucide-react';
import { db } from '../firebase';
import { ref, set, get } from 'firebase/database';

export default function Config({ uid, admins = {} }) {
  const [groqApiKey, setGroqApiKey] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [groqUrl, setGroqUrl] = useState('https://api.groq.com/openai/v1');
  const [groqModel, setGroqModel] = useState('openai/gpt-oss-120b');
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const isAdmin = admins[uid] === true;

  useEffect(() => {
    const cargarConfig = async () => {
      try {
        const snapGroqKey = await get(ref(db, `config/${uid}/groq_api_key`));
        if (snapGroqKey.exists()) {
          setGroqApiKey(snapGroqKey.val());
        }
        const snapGeminiKey = await get(ref(db, `config/${uid}/gemini_api_key`));
        if (snapGeminiKey.exists()) {
          setGeminiApiKey(snapGeminiKey.val());
        }
        const snapUrl = await get(ref(db, `config/${uid}/groq_url`));
        if (snapUrl.exists()) {
          setGroqUrl(snapUrl.val());
        }
        const snapModel = await get(ref(db, `config/${uid}/groq_model`));
        if (snapModel.exists()) {
          setGroqModel(snapModel.val());
        }
      } catch (e) {
        console.error('Error cargando configuración:', e);
      } finally {
        setLoading(false);
      }
    };
    cargarConfig();
  }, [uid]);

  const guardar = async () => {
    setError('');

    // Validar API keys si están presentes
    if (groqApiKey.trim() && !groqApiKey.startsWith('gsk_')) {
      setError('API key de Groq debe empezar con gsk_');
      return;
    }
    if (geminiApiKey.trim() && !geminiApiKey.startsWith('AIza') && !geminiApiKey.startsWith('AQ.')) {
      setError('API key de Gemini debe empezar con AIza o AQ.');
      return;
    }

    try {
      // Guardar en Firebase
      if (groqApiKey.trim()) {
        await set(ref(db, `config/${uid}/groq_api_key`), groqApiKey);
        await set(ref(db, `config/${uid}/groq_url`), groqUrl);
        await set(ref(db, `config/${uid}/groq_model`), groqModel);
      }
      if (geminiApiKey.trim()) {
        await set(ref(db, `config/${uid}/gemini_api_key`), geminiApiKey);
      }

      // Registrarse como admin si guardó alguna key
      if ((groqApiKey.trim() || geminiApiKey.trim()) && !isAdmin) {
        await set(ref(db, `admins/${uid}`), true);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(`Error guardando configuración: ${e.message}`);
    }
  };

  const eliminarGroq = async () => {
    setError('');
    try {
      await set(ref(db, `config/${uid}/groq_api_key`), null);
      setGroqApiKey('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(`Error eliminando API key de Groq: ${e.message}`);
    }
  };

  const eliminarGemini = async () => {
    setError('');
    try {
      await set(ref(db, `config/${uid}/gemini_api_key`), null);
      setGeminiApiKey('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(`Error eliminando API key de Gemini: ${e.message}`);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="section-block">
          <p>Cargando configuración...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">⚙️ Configuración</h1>
          <p className="page-sub">Integraciones y API keys</p>
        </div>
      </div>

      <div className="section-block">
        <h2 className="section-title">🤖 Groq API</h2>
        <p className="section-desc">
          Para hacer preguntas rápidas sobre tu presupuesto. También usamos Gemini Vision para analizar fotos de comprobantes.
        </p>

        {error && (
          <div className="alert alert-error">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <div className="config-form">
          <div className="config-field">
            <label>API Key de Groq</label>
            <div className="config-input-group">
              <input
                type={showGroqKey ? 'text' : 'password'}
                className="config-input"
                value={groqApiKey}
                placeholder="gsk_..."
                onChange={(e) => { setGroqApiKey(e.target.value); setError(''); }}
              />
              <button
                className="config-toggle-btn"
                onClick={() => setShowGroqKey(!showGroqKey)}
                title={showGroqKey ? 'Ocultar' : 'Mostrar'}
              >
                {showGroqKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="config-hint">
              Obtén una key gratis en{' '}
              <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer">
                Groq Console
              </a>
            </p>
          </div>

          <div className="config-field">
            <label>URL de Groq</label>
            <input
              type="text"
              className="config-input"
              value={groqUrl}
              placeholder="https://api.groq.com/openai/v1"
              onChange={(e) => { setGroqUrl(e.target.value); setError(''); }}
            />
            <p className="config-hint">Endpoint de la API (por defecto: https://api.groq.com/openai/v1)</p>
          </div>

          <div className="config-field">
            <label>Modelo de Groq</label>
            <input
              type="text"
              className="config-input"
              value={groqModel}
              placeholder="openai/gpt-oss-120b"
              onChange={(e) => { setGroqModel(e.target.value); setError(''); }}
            />
            <p className="config-hint">Modelos disponibles: openai/gpt-oss-120b, openai/gpt-oss-20b, groq/compound</p>
          </div>

          <div className="config-actions">
            <button className="btn-primary" onClick={guardar}>
              {saved ? (
                <>
                  <Check size={16} /> Guardado
                </>
              ) : (
                '💾 Guardar'
              )}
            </button>
            {groqApiKey && (
              <button className="btn-secondary" onClick={eliminarGroq}>
                <Trash2 size={16} /> Eliminar Groq
              </button>
            )}
          </div>
        </div>

        {groqApiKey && (
          <div className="alert alert-info">
            ✓ Groq está configurado. Podrás hacer preguntas sobre tu presupuesto en el chat.
          </div>
        )}
      </div>

      <div className="section-block">
        <h2 className="section-title">📷 Google Gemini Vision API</h2>
        <p className="section-desc">
          Para analizar fotos de comprobantes y desglosar automáticamente las compras.
        </p>

        <div className="config-form">
          <div className="config-field">
            <label>API Key de Gemini</label>
            <div className="config-input-group">
              <input
                type={showGeminiKey ? 'text' : 'password'}
                className="config-input"
                value={geminiApiKey}
                placeholder="AIza... o AQ..."
                onChange={(e) => { setGeminiApiKey(e.target.value); setError(''); }}
              />
              <button
                className="config-toggle-btn"
                onClick={() => setShowGeminiKey(!showGeminiKey)}
                title={showGeminiKey ? 'Ocultar' : 'Mostrar'}
              >
                {showGeminiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="config-hint">
              Obtén una key gratis en{' '}
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">
                Google AI Studio
              </a>
            </p>
          </div>

          <div className="config-actions">
            <button className="btn-primary" onClick={guardar}>
              {saved ? (
                <>
                  <Check size={16} /> Guardado
                </>
              ) : (
                '💾 Guardar'
              )}
            </button>
            {geminiApiKey && (
              <button className="btn-secondary" onClick={eliminarGemini}>
                <Trash2 size={16} /> Eliminar Gemini
              </button>
            )}
          </div>
        </div>

        {geminiApiKey && (
          <div className="alert alert-info">
            ✓ Gemini está configurado. Podrás analizar comprobantes en la pantalla principal.
          </div>
        )}

        <div className={`alert alert-${isAdmin ? 'info' : 'warning'}`}>
          {isAdmin ? (
            <>✓ Sos admin de esta app. Tenés acceso a todas las configuraciones.</>
          ) : (
            <>Guardando una API key de Gemini te hace admin automáticamente.</>
          )}
        </div>
      </div>

      <div className="section-block">
        <h2 className="section-title">📝 Sobre esta pantalla</h2>
        <p className="section-desc">
          La API key se guarda en Firebase en <code>config/{'{uid}'}/groq_api_key</code>.
          <br />
          <strong>⚠️ Importante:</strong> Con las reglas de Firebase actuales (abiertas), cualquiera que conozca tu URL
          de base puede leerla. Después de guardar, vamos a bajar las reglas para proteger esta sección.
        </p>
      </div>

      <div className="section-block">
        <h2 className="section-title">👤 Admin</h2>
        <p className="section-desc">
          Los admins se registran en Firebase en <code>admins/{'{uid}'}</code>.
          <br />
          {isAdmin ? (
            <>✓ <strong>Sos admin.</strong> Tu UID está guardado en la base.</>
          ) : (
            <>No sos admin todavía. Guardar la API key te hace admin automáticamente.</>
          )}
        </p>
      </div>
    </div>
  );
}
