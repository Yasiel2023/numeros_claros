// src/components/FotoComprobante.js
import React, { useRef, useState } from 'react';
import { Camera, Trash2, AlertCircle, Loader, Image as ImageIcon } from 'lucide-react';
import { desglosarComprobante } from '../ia';

const fmt = (n) => new Intl.NumberFormat('es-UY', { minimumFractionDigits: 0, maximumFractionDigits: 0, useGrouping: false }).format(n || 0);

export default function FotoComprobante({ ia, onDesglose, loading: externalLoading }) {
  const camaraInputRef  = useRef(null);
  const galeriaInputRef = useRef(null);
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Sacar foto / elegir de la galería ─────────────────────────
  // Se usa la cámara nativa del dispositivo (input con capture): en el celular
  // tiene enfoque automático, flash y resolución completa, mejor para tickets.
  const leerArchivo = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('El archivo elegido no es una imagen.');
      return;
    }
    setError('');
    const reader = new FileReader();
    reader.onload = (ev) => setPhoto(ev.target.result);
    reader.onerror = () => setError('No se pudo leer la imagen.');
    reader.readAsDataURL(file);
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
      const resultado = await desglosarComprobante(photo, ia);
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

  // ── UI ────────────────────────────────────────────────────────
  return (
    <div className="foto-container">
      {error && (
        <div className="alert alert-error">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <input
        ref={camaraInputRef} type="file" accept="image/*" capture="environment"
        onChange={leerArchivo} style={{ display: 'none' }}
      />
      <input
        ref={galeriaInputRef} type="file" accept="image/*"
        onChange={leerArchivo} style={{ display: 'none' }}
      />

      {!photo ? (
        <div className="foto-opciones">
          <button className="btn-foto-option" onClick={() => camaraInputRef.current?.click()}>
            <Camera size={24} />
            <span>Sacar foto</span>
          </button>
          <button className="btn-foto-option" onClick={() => galeriaInputRef.current?.click()}>
            <ImageIcon size={24} />
            <span>Elegir de la galería</span>
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
