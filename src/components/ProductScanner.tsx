'use client';

import React, { useRef, useState } from 'react';
import type { ProductoIdentificado } from '@/lib/identificar-producto';
import { IconoCamara, IconoGaleria } from '@/components/ScanIcons';

/**
 * Identificación de un producto por foto: con la cámara o eligiendo una imagen
 * de la galería. Manda la foto a /api/products/identify y entrega el resultado
 * al formulario; el mensaje de qué se hizo con él lo pone quien lo usa.
 */
export default function ProductScanner({ onIdentified }: { onIdentified: (producto: ProductoIdentificado) => Promise<void> | void }) {
  // Dos inputs porque `capture` fuerza la cámara en el móvil: uno la dispara
  // y el otro abre la galería. En escritorio ambos abren el selector normal.
  const camaraRef = useRef<HTMLInputElement>(null);
  const galeriaRef = useRef<HTMLInputElement>(null);
  const [analizando, setAnalizando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalizando(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('image', file);

      const res = await fetch('/api/products/identify', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'No se pudo analizar la imagen. Inténtalo de nuevo.');
      } else {
        await onIdentified(data as ProductoIdentificado);
      }
    } catch {
      setError('No se pudo conectar con la IA visual.');
    } finally {
      setAnalizando(false);
      if (camaraRef.current) camaraRef.current.value = '';
      if (galeriaRef.current) galeriaRef.current.value = '';
    }
  };

  return (
    <div>
      <input type="file" accept="image/*" capture="environment" ref={camaraRef} onChange={handleFileChange} style={{ display: 'none' }} />
      <input type="file" accept="image/*" ref={galeriaRef} onChange={handleFileChange} style={{ display: 'none' }} />

      <div style={{ display: 'flex', gap: '10px' }}>
        <button type="button" className="btn-scan" onClick={() => camaraRef.current?.click()} disabled={analizando}>
          <IconoCamara /> {analizando ? 'Leyendo la etiqueta…' : 'Identificar con la cámara'}
        </button>
        <button type="button" className="btn-scan" onClick={() => galeriaRef.current?.click()} disabled={analizando}>
          <IconoGaleria /> Elegir de la galería
        </button>
      </div>
      {error && (
        <p style={{ fontSize: '12px', color: 'var(--color-alert)', marginTop: '8px', marginBottom: 0 }}>{error}</p>
      )}
    </div>
  );
}
