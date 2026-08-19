'use client';

import React, { useRef, useState } from 'react';

export default function ImageScanner({ onIdentified }: { onIdentified: (species: string) => void }) {
  // Dos inputs porque `capture` fuerza la cámara en el móvil: uno la dispara
  // y el otro abre la galería. En escritorio ambos abren el selector normal.
  const camaraRef = useRef<HTMLInputElement>(null);
  const galeriaRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
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
        alert("Error al escanear la imagen. Inténtalo de nuevo.");
      }
    } catch (error) {
      console.error(error);
      alert("Error al conectar con la IA visual.");
    } finally {
      setIsScanning(false);
      if (camaraRef.current) camaraRef.current.value = '';
      if (galeriaRef.current) galeriaRef.current.value = '';
    }
  };

  const estiloBoton: React.CSSProperties = {
    flex: 1,
    padding: '15px',
    backgroundColor: isScanning ? 'var(--color-mist)' : 'var(--color-eucalyptus)',
    color: isScanning ? 'var(--color-graphite)' : '#fff',
    border: 'none',
    cursor: isScanning ? 'not-allowed' : 'pointer',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    fontSize: '12px',
    fontWeight: 'bold',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '10px',
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
        <button type="button" onClick={() => camaraRef.current?.click()} disabled={isScanning} style={estiloBoton}>
          {isScanning ? 'Analizando imagen...' : '📸 IDENTIFICAR CON CÁMARA'}
        </button>
        <button type="button" onClick={() => galeriaRef.current?.click()} disabled={isScanning} style={estiloBoton}>
          {isScanning ? '...' : '🖼️ DESDE LA GALERÍA'}
        </button>
      </div>
    </div>
  );
}
