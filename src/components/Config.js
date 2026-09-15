// src/components/Config.js
import React, { useState, useEffect } from 'react';
import { AlertCircle, Eye, EyeOff, Check } from 'lucide-react';
import { getApiKey, setApiKey, clearApiKey } from '../gemini';
import { db } from '../firebase';
import { ref, set } from 'firebase/database';

export default function Config({ uid, admins = {} }) {
  const [apiKey, setLocalApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const isAdmin = admins[uid] === true;

  useEffect(() => {
    if (isAdmin) {
      const stored = getApiKey();
      setLocalApiKey(stored);
    }
  }, [isAdmin]);

  const guardar = async () => {
    setError('');
    if (!apiKey.trim()) {
      clearApiKey();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      return;
    }

    if (!apiKey.startsWith('AIza')) {
      setError('Parece no ser una API key de Google válida (deben empezar con AIza)');
      return;
    }

    try {
      // Guardar localmente
      setApiKey(apiKey);

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


  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">⚙️ Configuración</h1>
          <p className="page-sub">Integraciones y API keys</p>
        </div>
      </div>

      <div className="section-block">
        <h2 className="section-title">🤖 Google Gemini Vision API</h2>
        <p className="section-desc">
          Para analizar fotos de comprobantes y desglosar automáticamente las compras.
        </p>

        {error && (
          <div className="alert alert-error">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <div className="config-form">
          <div className="config-field">
            <label>API Key de Gemini</label>
            <div className="config-input-group">
              <input
                type={showKey ? 'text' : 'password'}
                className="config-input"
                value={apiKey}
                placeholder="AIza..."
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
            {apiKey && (
              <button
                className="btn-secondary"
                onClick={() => {
                  setLocalApiKey('');
                  clearApiKey();
                  setSaved(true);
                  setTimeout(() => setSaved(false), 2000);
                }}
              >
                🗑️ Eliminar
              </button>
            )}
          </div>
        </div>

        {apiKey && (
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
          Solo los admins ven esta pantalla. La API key se guarda <strong>solo en tu navegador</strong>,
          nunca se sube a la base de datos. Cada vez que uses otra PC o navegador, tendrás que pegarla nuevamente.
        </p>
      </div>
    </div>
  );
}
