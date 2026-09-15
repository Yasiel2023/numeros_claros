// src/components/FotoComprobante.js
import React, { useRef, useState } from 'react';
import { Camera, Trash2, AlertCircle, Loader } from 'lucide-react';
import { desglosarComprobante } from '../gemini';

const fmt = (n) => new Intl.NumberFormat('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 0, useGrouping: false }).format(n || 0);

export default function FotoComprobante({ apiKey, onDesglose, loading: externalLoading }) {
  const cameraRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const [photo, setPhoto] = useState(null);
  const [mode, setMode] = useState(null); // 'camara' | 'paste' | null
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Capturar foto con cámara ──────────────────────────────────
  const abrirCamara = async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      setMode('camara');
      cameraRef.current.srcObject = stream;
    } catch (e) {
      setError(`No se pudo acceder a la cámara: ${e.message}`);
    }
  };

  const tomarFoto = () => {
    const ctx = canvasRef.current.getContext('2d');
    const video = cameraRef.current;
    canvasRef.current.width = video.videoWidth;
    canvasRef.current.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.9);
    setPhoto(dataUrl);

    // Cerrar cámara
    if (video.srcObject) {
      video.srcObject.getTracks().forEach(t => t.stop());
    }
    setMode(null);
  };

  const cerrarCamara = () => {
    if (cameraRef.current?.srcObject) {
      cameraRef.current.srcObject.getTracks().forEach(t => t.stop());
    }
    setMode(null);
  };

  // ── Pegar desde portapapeles ──────────────────────────────────
  const pegarDesdePortapapeles = async () => {
    try {
      setError('');
      const items = await navigator.clipboard.read();
      const imageItem = items.find(item => item.types.includes('image/png') || item.types.includes('image/jpeg') || item.types.includes('image/webp'));

      if (!imageItem) {
        setError('No hay imagen en el portapapeles. Copia una foto primero.');
        return;
      }

      const blob = await imageItem.getType(imageItem.types.find(t => t.startsWith('image/')));
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhoto(e.target.result);
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      setError(`Error al pegar: ${e.message}`);
    }
  };

  // ── Procesar con Gemini ───────────────────────────────────────
  const procesarFoto = async () => {
    if (!photo) return;
    setLoading(true);
    setError('');

    try {
      const resultado = await desglosarComprobante(photo, apiKey);
      onDesglose(resultado, photo);
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

  const limpiar = () => {
    setPhoto(null);
    setError('');
  };

  // ── UI: Captura de cámara ─────────────────────────────────────
  if (mode === 'camara') {
    return (
      <div className="foto-camara-modal">
        <div className="foto-camara-container">
          <video ref={cameraRef} autoPlay playsInline className="foto-video" />
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          <div className="foto-camara-controls">
            <button className="btn-large" onClick={tomarFoto}>
              📷 Tomar foto
            </button>
            <button className="btn-cancel" onClick={cerrarCamara}>
              Cerrar cámara
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── UI: Principal ─────────────────────────────────────────────
  return (
    <div className="foto-container">
      {error && (
        <div className="alert alert-error">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {!photo ? (
        <div className="foto-opciones">
          <button className="btn-foto-option" onClick={abrirCamara}>
            <Camera size={24} />
            <span>Sacar foto</span>
          </button>
          <button className="btn-foto-option" onClick={pegarDesdePortapapeles}>
            <span className="text-2xl">📋</span>
            <span>Pegar desde portapapeles</span>
          </button>
        </div>
      ) : (
        <div className="foto-preview">
          <img src={photo} alt="Comprobante" className="foto-img" />

          <div className="foto-actions">
            <button
              className="btn-large"
              onClick={procesarFoto}
              disabled={loading || externalLoading}
            >
              {loading || externalLoading ? (
                <>
                  <Loader size={16} className="spin" /> Analizando...
                </>
              ) : (
                <>✨ Desglosar con IA</>
              )}
            </button>
            <button
              className="btn-cancel"
              onClick={limpiar}
              disabled={loading || externalLoading}
            >
              <Trash2 size={16} /> Cambiar foto
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
