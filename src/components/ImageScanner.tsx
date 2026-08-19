'use client';

import React, { useRef, useState } from 'react';
import { IconoCamara, IconoGaleria } from '@/components/ScanIcons';

export default function ImageScanner({ onIdentified }: { onIdentified: (species: string) => void }) {
  // Dos inputs porque `capture` fuerza la cámara en el móvil: uno la dispara
  // y el otro abre la galería. En escritorio ambos abren el selector normal.
  const camaraRef = useRef<HTMLInputElement>(null);
  const galeriaRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('image', file);

      const res = await fetch('/api/plants/identify', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.species) {
          onIdentified(data.species);
        }
      } else {
        setError('No se pudo identificar la planta. Prueba con otra foto.');
      }
    } catch {
      setError('No se pudo conectar con la IA visual.');
    } finally {
      setIsScanning(false);
      if (camaraRef.current) camaraRef.current.value = '';
      if (galeriaRef.current) galeriaRef.current.value = '';
    }
  };

  return (
    <div style={{ marginBottom: '20px' }}>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={camaraRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <input
        type="file"
        accept="image/*"
        ref={galeriaRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      <div style={{ display: 'flex', gap: '10px' }}>
        <button type="button" className="btn-scan" onClick={() => camaraRef.current?.click()} disabled={isScanning}>
          <IconoCamara /> {isScanning ? 'Analizando la foto…' : 'Identificar con la cámara'}
        </button>
        <button type="button" className="btn-scan" onClick={() => galeriaRef.current?.click()} disabled={isScanning}>
          <IconoGaleria /> Elegir de la galería
        </button>
      </div>
      {error && (
        <p style={{ fontSize: '12px', color: 'var(--color-alert)', marginTop: '8px', marginBottom: 0 }}>{error}</p>
      )}
    </div>
  );
}
