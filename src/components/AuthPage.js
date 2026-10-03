// src/components/AuthPage.js
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Icono from '../iconos';

export default function AuthPage() {
  const { login, register, resetPassword, updateName } = useAuth();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const errMsgs = {
    'auth/user-not-found': 'No existe cuenta con ese correo.',
    'auth/wrong-password': 'Contraseña incorrecta.',
    'auth/email-already-in-use': 'Ya existe una cuenta con ese correo.',
    'auth/invalid-email': 'Correo inválido.',
    'auth/too-many-requests': 'Demasiados intentos. Esperá unos minutos.',
    'auth/invalid-credential': 'Credenciales incorrectas.',
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (mode === 'register' && pass !== confirm) return setError('Las contraseñas no coinciden.');
    if (mode === 'register' && pass.length < 6) return setError('Mínimo 6 caracteres.');
    setLoading(true);
    try {
      if (mode === 'login') await login(email, pass);
      else if (mode === 'register') { await register(email, pass); if (name) await updateName(name); }
      else { await resetPassword(email); setSuccess('Revisá tu correo para restablecer la contraseña.'); setMode('login'); }
    } catch (err) { setError(errMsgs[err.code] || 'Ocurrió un error. Intentá nuevamente.'); }
    setLoading(false);
  };

  const sw = (m) => { setMode(m); setError(''); setSuccess(''); };

  return (
    <div className="auth-wrap">
      <div className="auth-panel-left">
        <div className="auth-brand"><span className="sb-icon">$</span> <span>Números Claros</span></div>
        <div className="auth-copy">
          <h1>Tu planilla familiar, ahora en la nube</h1>
          <p>Controlá ingresos, básicos, impuestos, compras semanales y ahorro — todo desde cualquier dispositivo.</p>
          <ul className="auth-features">
            <li><Icono nombre="resumen" size={18} /> Todos tus pagos pendientes a la vista</li>
            <li><Icono nombre="carrito" size={18} /> Compras del súper con modo carrito</li>
            <li><Icono nombre="efectivo" size={18} /> Tu moneda y una segunda, como dólares</li>
            <li><Icono nombre="casa" size={18} /> Compartido con tu familia</li>
          </ul>
        </div>
      </div>

      <div className="auth-panel-right">
        <div className="auth-form-card">
          <h2>{mode === 'login' ? 'Iniciar sesión' : mode === 'register' ? 'Crear cuenta' : 'Recuperar contraseña'}</h2>
          <p className="auth-subtitle">
            {mode === 'login' ? 'Ingresá a tu cuenta familiar' : mode === 'register' ? 'Creá tu espacio familiar' : 'Te enviamos un correo'}
          </p>

          <form onSubmit={submit}>
            {mode === 'register' && (
              <div className="af-field">
                <label>Nombre</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre" />
              </div>
            )}
            <div className="af-field">
              <label>Correo electrónico</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" required />
            </div>
            {mode !== 'reset' && (
              <div className="af-field">
                <label>Contraseña</label>
                <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" required />
              </div>
            )}
            {mode === 'register' && (
              <div className="af-field">
                <label>Confirmar contraseña</label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" required />
              </div>
            )}
            {mode === 'login' && (
              <button type="button" className="af-link forgot-link" onClick={() => sw('reset')}>
                ¿Olvidaste tu contraseña?
              </button>
            )}
            {error && <div className="af-error">{error}</div>}
            {success && <div className="af-success">{success}</div>}
            <button type="submit" className="af-submit" disabled={loading}>
              {loading ? 'Procesando...' : mode === 'login' ? 'Ingresar' : mode === 'register' ? 'Crear cuenta' : 'Enviar correo'}
            </button>
          </form>

          <div className="af-switch">
            {mode === 'login'
              ? <span>¿No tenés cuenta? <button className="af-link" onClick={() => sw('register')}>Registrate gratis</button></span>
              : <button className="af-link" onClick={() => sw('login')}>← Volver al login</button>
            }
          </div>
        </div>
      </div>
    </div>
  );
}
