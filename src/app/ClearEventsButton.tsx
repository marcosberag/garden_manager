'use client';

import React, { useState } from 'react';
import { deleteAllEvents } from '@/app/actions';

export default function ClearEventsButton() {
  const [loading, setLoading] = useState(false);

  const handleClear = async () => {
    if (confirm('¿Estás SEGURO de que quieres borrar absolutamente todos los eventos de tu agenda? Esta acción no se puede deshacer.')) {
      setLoading(true);
      try {
        await deleteAllEvents();
      } catch (e) {
        setLoading(false);
      }
    }
  };

  return (
    <button 
      onClick={handleClear} 
      disabled={loading}
      style={{ 
        color: '#E74C3C', backgroundColor: 'transparent', border: '1px solid #E74C3C', 
        textDecoration: 'none', fontSize: '11px', fontWeight: 'bold', padding: '4px 8px', 
        borderRadius: '4px', cursor: 'pointer', opacity: loading ? 0.5 : 1 
      }}
    >
      {loading ? 'BORRANDO...' : 'LIMPIAR'}
    </button>
  );
}
