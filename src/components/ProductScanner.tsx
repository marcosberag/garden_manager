'use client';

import React, { useRef, useState } from 'react';
import type { ProductoIdentificado } from '@/lib/identificar-producto';

/**
 * Botón de "identificar producto por foto". Manda la imagen a
 * /api/products/identify y entrega el resultado al formulario; el mensaje de
 * qué se hizo con él (seleccionarlo, darlo de alta...) lo pone quien lo usa.
 */
export default function ProductScanner({ onIdentified }: { onIdentified: (producto: ProductoIdentificado) => Promise<void> | void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div>
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
        disabled={analizando}
        style={{
          width: '100%',
          padding: '12px',
          backgroundColor: 'transparent',
          color: analizando ? 'var(--color-graphite)' : 'var(--color-eucalyptus)',
          border: '1px solid var(--color-eucalyptus)',
          cursor: analizando ? 'not-allowed' : 'pointer',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          fontSize: '12px',
          fontWeight: 'bold',
        }}
      >
        {analizando ? 'Leyendo la etiqueta...' : '📸 Identificar producto por foto'}
      </button>
      {error && (
        <p style={{ fontSize: '12px', color: '#E74C3C', marginTop: '8px', marginBottom: 0 }}>{error}</p>
      )}
    </div>
  );
}
