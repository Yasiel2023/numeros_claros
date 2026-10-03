// src/components/Config.js
// Configuración del sistema (solo admins). La clave de Groq NO se guarda en la base:
// es un secreto del Worker de Cloudflare (ia-worker/, `npx wrangler secret put GROQ_API_KEY`).
// Acá se administran los datos públicos de sistema/ia: si la IA está activa, URL y modelo.
import React, { useState, useEffect } from 'react';
import { AlertCircle, Check, Power } from 'lucide-react';
import { db } from '../firebase';
import { ref, get, update } from 'firebase/database';
import Icono from '../iconos';

const URL_DEFAULT = 'https://api.groq.com/openai/v1';
const MODELO_DEFAULT = 'openai/gpt-oss-120b';

export default function Config({ onGuardado }) {
  const [groqUrl, setGroqUrl] = useState(URL_DEFAULT);
  const [groqModel, setGroqModel] = useState(MODELO_DEFAULT);
  const [activa, setActiva] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargarConfig = async () => {
      try {
        const snap = await get(ref(db, 'sistema/ia'));
        const cfg = snap.exists() ? snap.val() : {};
        setActiva(cfg.activa === true);
        if (cfg.groq_url) setGroqUrl(cfg.groq_url);
        if (cfg.groq_model) setGroqModel(cfg.groq_model);
      } catch (e) {
        setError(`Error cargando configuración: ${e.message}`);
      } finally {
        setLoading(false);
      }
    };
    cargarConfig();
  }, []);

  const guardar = async (cambios = {}) => {
    setError('');
    try {
      const datos = {
        groq_url: groqUrl.trim() || URL_DEFAULT,
        groq_model: groqModel.trim() || MODELO_DEFAULT,
        activa,
        ...cambios,
        actualizado: new Date().toISOString(),
      };
      await update(ref(db, 'sistema/ia'), datos);
      setActiva(datos.activa);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onGuardado?.();
    } catch (e) {
      setError(`Error guardando configuración: ${e.message}`);
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
          <h1 className="page-title"><Icono nombre="ajustes" size={22} className="page-title-ico" /> Configuración</h1>
          <p className="page-sub">Configuración del sistema · solo administradores</p>
        </div>
      </div>

      <div className="section-block">
        <h2 className="section-title">Inteligencia artificial</h2>
        <p className="section-desc">
          La IA la usan <strong>todos los usuarios</strong> (comprobantes, Preguntas IA y armar presupuestos).
          Las consultas pasan por un servidor propio (Cloudflare Worker) que verifica la sesión, limita el uso
          y guarda la clave de Groq: la clave no está en la base de datos ni en la app.
        </p>

        {error && (
          <div className="alert alert-error">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <div className={`alert alert-${activa ? 'info' : 'warning'}`}>
          {activa ? 'La IA está activa para todos los usuarios.' : 'La IA está desactivada: nadie puede usarla.'}
        </div>

        <div className="config-form">
          <div className="config-field">
            <label>Modelo para Preguntas IA</label>
            <input
              type="text"
              className="config-input"
              value={groqModel}
              placeholder={MODELO_DEFAULT}
              onChange={(e) => { setGroqModel(e.target.value); setError(''); }}
            />
            <p className="config-hint">
              Debe soportar herramientas (tool calling), por ejemplo openai/gpt-oss-120b. La lectura de
              comprobantes usa siempre un modelo con visión.
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
          </div>

          <div className="config-actions">
            <button className="btn-primary" onClick={() => guardar()}>
              {saved ? <><Check size={16} /> Guardado</> : 'Guardar'}
            </button>
            <button className="btn-secondary" onClick={() => guardar({ activa: !activa })}>
              <Power size={16} /> {activa ? 'Desactivar IA' : 'Activar IA'}
            </button>
          </div>
        </div>

        <p className="config-hint">
          Para cambiar la clave de Groq: en la carpeta <code>ia-worker</code> ejecutá
          {' '}<code>npx wrangler secret put GROQ_API_KEY</code> y pegá la clave nueva.
        </p>
      </div>
    </div>
  );
}
