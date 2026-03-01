// src/components/AuthPage.js
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AuthPage() {
  const { login, register, resetPassword, updateName } = useAuth();
  const [mode, setMode] = useState('login'); // login | register | reset
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');

    if (mode === 'register' && password !== confirm) {
      return setError('Las contraseñas no coinciden.');
    }
    if (mode === 'register' && password.length < 6) {
      return setError('La contraseña debe tener al menos 6 caracteres.');
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else if (mode === 'register') {
        const cred = await register(email, password);
        if (name) await updateName(name);
      } else if (mode === 'reset') {
        await resetPassword(email);
        setSuccess('Te enviamos un correo para restablecer tu contraseña.');
        setMode('login');
      }
    } catch (err) {
      const msgs = {
        'auth/user-not-found': 'No existe una cuenta con ese correo.',
        'auth/wrong-password': 'Contraseña incorrecta.',
        'auth/email-already-in-use': 'Ya existe una cuenta con ese correo.',
        'auth/invalid-email': 'Correo inválido.',
        'auth/too-many-requests': 'Demasiados intentos. Intentá más tarde.',
        'auth/invalid-credential': 'Credenciales incorrectas.',
      };
      setError(msgs[err.code] || 'Ocurrió un error. Intentá nuevamente.');
    }
    setLoading(false);
  };

  return (
    <div className="auth-screen">
      <div className="auth-left">
        <div className="auth-brand">
          <span className="auth-logo-icon">🏠</span>
          <span className="auth-logo-text">CasaFinanzas</span>
        </div>
        <div className="auth-hero">
          <h1>Controlá tus finanzas del hogar</h1>
          <p>Registrá ingresos, gastos e impuestos. Visualizá alertas, gráficos y resúmenes mensuales en un solo lugar.</p>
          <div className="auth-features">
            {['📊 Dashboard con gráficos', '🔔 Alertas de presupuesto', '💳 Gestión de categorías', '☁️ Sincronizado en la nube'].map(f => (
              <div key={f} className="auth-feature">{f}</div>
            ))}
          </div>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-card">
          <h2>
            {mode === 'login' ? 'Iniciar sesión' : mode === 'register' ? 'Crear cuenta' : 'Restablecer contraseña'}
          </h2>
          <p className="auth-sub">
            {mode === 'login' ? 'Ingresá con tu cuenta' : mode === 'register' ? 'Creá tu cuenta gratis' : 'Te enviaremos un correo'}
          </p>

          <form onSubmit={handleSubmit} className="auth-form">
            {mode === 'register' && (
              <div className="auth-field">
                <label>Nombre</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="Tu nombre" />
              </div>
            )}
            <div className="auth-field">
              <label>Correo electrónico</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="nombre@correo.com" required />
            </div>
            {mode !== 'reset' && (
              <div className="auth-field">
                <label>Contraseña</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required minLength={6} />
              </div>
            )}
            {mode === 'register' && (
              <div className="auth-field">
                <label>Confirmar contraseña</label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••" required />
              </div>
            )}

            {mode === 'login' && (
              <button type="button" className="auth-link-btn forgot"
                onClick={() => { setMode('reset'); setError(''); }}>
                ¿Olvidaste tu contraseña?
              </button>
            )}

            {error && <div className="auth-error">⚠ {error}</div>}
            {success && <div className="auth-success">✓ {success}</div>}

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? 'Procesando...' : mode === 'login' ? 'Ingresar' : mode === 'register' ? 'Crear cuenta' : 'Enviar correo'}
            </button>
          </form>

          <div className="auth-switch">
            {mode === 'login' ? (
              <span>¿No tenés cuenta? <button className="auth-link-btn" onClick={() => { setMode('register'); setError(''); }}>Registrate</button></span>
            ) : (
              <span><button className="auth-link-btn" onClick={() => { setMode('login'); setError(''); }}>← Volver al login</button></span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
