// src/components/Config.js
// Configuración del sistema (solo admins). La clave de Groq es UNA para todos
// los usuarios: se guarda en sistema/ia, que lee cualquier usuario con sesión y
// solo los admins pueden escribir (ver database.rules.json).
import React, { useState, useEffect } from 'react';
import { AlertCircle, Eye, EyeOff, Check, Trash2 } from 'lucide-react';
import { db, auth } from '../firebase';
import { ref, set, get } from 'firebase/database';

const URL_DEFAULT = 'https://api.groq.com/openai/v1';
const MODELO_DEFAULT = 'openai/gpt-oss-120b';

export default function Config({ onGuardado }) {
  const [groqApiKey, setGroqApiKey] = useState('');
  const [groqUrl, setGroqUrl] = useState(URL_DEFAULT);
  const [groqModel, setGroqModel] = useState(MODELO_DEFAULT);
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [esGlobal, setEsGlobal] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargarConfig = async () => {
      try {
        const snapGlobal = await get(ref(db, 'sistema/ia'));
        let cfg = snapGlobal.exists() ? snapGlobal.val() : null;
        setEsGlobal(!!cfg?.groq_api_key);
        // Primera vez: se precarga la clave que el admin tenía en su configuración personal
        if (!cfg?.groq_api_key && auth.currentUser) {
          const snapPropia = await get(ref(db, `config/${auth.currentUser.uid}`));
          if (snapPropia.exists()) cfg = snapPropia.val();
        }
        if (cfg?.groq_api_key) setGroqApiKey(cfg.groq_api_key);
        if (cfg?.groq_url) setGroqUrl(cfg.groq_url);
        if (cfg?.groq_model) setGroqModel(cfg.groq_model);
      } catch (e) {
        setError(`Error cargando configuración: ${e.message}`);
      } finally {
        setLoading(false);
      }
    };
    cargarConfig();
  }, []);

  const confirmarGuardado = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onGuardado?.();
  };

  const guardar = async () => {
    setError('');
    if (!groqApiKey.trim().startsWith('gsk_')) {
      setError('La API key de Groq debe empezar con gsk_');
      return;
    }
    try {
      await set(ref(db, 'sistema/ia'), {
        groq_api_key: groqApiKey.trim(),
        groq_url: groqUrl.trim() || URL_DEFAULT,
        groq_model: groqModel.trim() || MODELO_DEFAULT,
        actualizado: new Date().toISOString(),
      });
      setEsGlobal(true);
      confirmarGuardado();
    } catch (e) {
      setError(`Error guardando configuración: ${e.message}`);
    }
  };

  const eliminar = async () => {
    setError('');
    try {
      await set(ref(db, 'sistema/ia'), null);
      setGroqApiKey('');
      setEsGlobal(false);
      confirmarGuardado();
    } catch (e) {
      setError(`Error eliminando la API key: ${e.message}`);
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
          <p className="page-sub">Configuración del sistema · solo administradores</p>
        </div>
      </div>

      <div className="section-block">
        <h2 className="section-title">🤖 Inteligencia artificial (Groq)</h2>
        <p className="section-desc">
          Esta clave la usan <strong>todos los usuarios</strong> de la app para leer comprobantes y para Preguntas IA.
          Los usuarios no ven esta pantalla.
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
              Obtené una key en{' '}
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
              placeholder={URL_DEFAULT}
              onChange={(e) => { setGroqUrl(e.target.value); setError(''); }}
            />
            <p className="config-hint">Endpoint de la API (por defecto: {URL_DEFAULT})</p>
          </div>

          <div className="config-field">
            <label>Modelo de Groq para Preguntas IA</label>
            <input
              type="text"
              className="config-input"
              value={groqModel}
              placeholder={MODELO_DEFAULT}
              onChange={(e) => { setGroqModel(e.target.value); setError(''); }}
            />
            <p className="config-hint">
              Debe soportar herramientas (tool calling), por ejemplo openai/gpt-oss-120b. La lectura de comprobantes usa
              siempre un modelo con visión.
            </p>
          </div>

          <div className="config-actions">
            <button className="btn-primary" onClick={guardar}>
              {saved ? <><Check size={16} /> Guardado</> : '💾 Guardar para todos'}
            </button>
            {esGlobal && (
              <button className="btn-secondary" onClick={eliminar}>
                <Trash2 size={16} /> Eliminar clave
              </button>
            )}
          </div>
        </div>

        {esGlobal ? (
          <div className="alert alert-info">
            ✓ La IA está activa para todos los usuarios.
          </div>
        ) : (
          <div className="alert alert-warning">
            Todavía no hay una clave del sistema. {groqApiKey && 'Se precargó tu clave personal: '}
            tocá <strong>Guardar para todos</strong> para activar la IA para todos los usuarios.
          </div>
        )}
      </div>
    </div>
  );
}
