// src/components/Config.js
import React, { useState, useEffect } from 'react';
import { AlertCircle, Eye, EyeOff, Check, Trash2 } from 'lucide-react';
import { db } from '../firebase';
import { ref, set, get } from 'firebase/database';

export default function Config({ uid, admins = {} }) {
  const [apiKey, setLocalApiKey] = useState('');
  const [groqUrl, setGroqUrl] = useState('https://api.groq.com/openai/v1');
  const [groqModel, setGroqModel] = useState('llama-3.1-70b-versatile');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const isAdmin = admins[uid] === true;

  useEffect(() => {
    const cargarConfig = async () => {
      try {
        const snapKey = await get(ref(db, `config/${uid}/groq_api_key`));
        if (snapKey.exists()) {
          setLocalApiKey(snapKey.val());
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
    if (!apiKey.trim()) {
      try {
        await set(ref(db, `config/${uid}/groq_api_key`), null);
        setLocalApiKey('');
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (e) {
        setError(`Error eliminando API key: ${e.message}`);
      }
      return;
    }

    if (!apiKey.startsWith('gsk_')) {
      setError('Parece no ser una API key de Groq válida (deben empezar con gsk_)');
      return;
    }

    try {
      // Guardar en Firebase
      await set(ref(db, `config/${uid}/groq_api_key`), apiKey);
      await set(ref(db, `config/${uid}/groq_url`), groqUrl);
      await set(ref(db, `config/${uid}/groq_model`), groqModel);

      // Registrarse como admin en Firebase (si no lo eres ya)
      if (!isAdmin) {
        await set(ref(db, `admins/${uid}`), true);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(`Error guardando configuración: ${e.message}`);
    }
  };

  const eliminar = async () => {
    setError('');
    try {
      await set(ref(db, `config/${uid}/groq_api_key`), null);
      setLocalApiKey('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(`Error eliminando API key: ${e.message}`);
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
                type={showKey ? 'text' : 'password'}
                className="config-input"
                value={apiKey}
                placeholder="gsk_..."
                onChange={(e) => { setLocalApiKey(e.target.value); setError(''); }}
              />
              <button
                className="config-toggle-btn"
                onClick={() => setShowKey(!showKey)}
                title={showKey ? 'Ocultar' : 'Mostrar'}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
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
              placeholder="llama-3.1-70b-versatile"
              onChange={(e) => { setGroqModel(e.target.value); setError(''); }}
            />
            <p className="config-hint">Modelos disponibles: llama-3.1-70b-versatile, llama-3.1-8b-instant, mixtral-8x7b-32768</p>
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
            {apiKey && (
              <button className="btn-secondary" onClick={eliminar}>
                <Trash2 size={16} /> Eliminar
              </button>
            )}
          </div>
        </div>

        {apiKey && (
          <div className="alert alert-info">
            ✓ Groq está configurado. Podrás hacer preguntas sobre tu presupuesto en el chat.
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
