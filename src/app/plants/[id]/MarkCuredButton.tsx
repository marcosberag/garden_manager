'use client';

import React, { useState } from 'react';
import { markAsCured } from '@/app/actions';

export default function MarkCuredButton({ plantId }: { plantId: string }) {
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleCured = async () => {
    setLoading(true);
    setShowConfirm(false);
    await markAsCured(plantId);
    setLoading(false);
  };

  return (
    <>
      <button 
        onClick={() => setShowConfirm(true)}
        disabled={loading}
        className="chip-btn chip-btn--primary"
      >
        {loading ? 'Marcando…' : '✓ Marcar planta curada'}
      </button>

      {showConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: 'white', padding: '30px', borderRadius: '12px',
            width: '90%', maxWidth: '400px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
          }}>
            <h3 className="suisse" style={{ margin: '0 0 15px 0', fontSize: '18px', color: 'var(--color-ink-black)' }}>
              ¿Marcar Planta Curada?
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: 'var(--color-graphite)', lineHeight: '1.5' }}>
              Estás a punto de dar el alta médica a esta planta. Se borrarán todos los tratamientos futuros que estaban programados.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button 
                type="button"
                onClick={() => setShowConfirm(false)}
                className="btn-outline"
                style={{ padding: '8px 16px', fontSize: '14px' }}
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleCured}
                className="btn-solid"
                style={{ padding: '8px 16px', fontSize: '14px' }}
              >
                Sí, Marcar Curada
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
