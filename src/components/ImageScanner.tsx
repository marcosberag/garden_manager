'use client';

import React, { useRef, useState } from 'react';

export default function ImageScanner({ onIdentified }: { onIdentified: (species: string) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div style={{ marginBottom: '20px' }}>
      <input 
        type="file" 
        accept="image/*" 
        capture="environment"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }} 
      />
      
      <button 
        type="button" 
        onClick={() => fileInputRef.current?.click()}
        disabled={isScanning}
        style={{
          width: '100%',
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
          gap: '10px'
        }}
      >
        {isScanning ? 'Analizando imagen...' : '📸 IDENTIFICAR CON CÁMARA IA'}
      </button>
    </div>
  );
}
