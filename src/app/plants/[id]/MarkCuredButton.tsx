'use client';

import React from 'react';
import { markAsCured } from '@/app/actions';

export default function MarkCuredButton({ plantId }: { plantId: string }) {
  const [loading, setLoading] = React.useState(false);

  const handleCured = async () => {
    if (confirm('¿Estás seguro de que quieres dar por curada esta planta? Se borrarán todos los tratamientos futuros programados.')) {
      setLoading(true);
      await markAsCured(plantId);
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handleCured}
      disabled={loading}
      style={{ fontSize: '11px', padding: '8px 15px', color: '#117A65', backgroundColor: '#E8F6F3', border: '1px solid #117A65', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', opacity: loading ? 0.5 : 1 }}
    >
      {loading ? 'MARCANDO...' : '✓ MARCAR PLANTA CURADA'}
    </button>
  );
}
