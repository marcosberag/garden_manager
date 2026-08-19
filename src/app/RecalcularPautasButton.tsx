'use client';

import React, { useState } from 'react';
import { recalcularPautasProgramadas } from '@/app/actions';

type Resultado = {
  cambios?: { tarea: string; antes: number; ahora: number; motivo: string }[];
  yaCorrectas?: number;
  sinProducto?: number;
  error?: string;
};

/**
 * Repasa las tareas programadas y les pone la pauta que la IA considera
 * correcta para cada caso. Enseña un resumen de qué ha cambiado y por qué.
 */
export default function RecalcularPautasButton() {
  const [fase, setFase] = useState<'reposo' | 'confirmar' | 'trabajando' | 'resultado'>('reposo');
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const handleRecalcular = async () => {
    setFase('trabajando');
    try {
      const r = await recalcularPautasProgramadas();
      setResultado(r);
    } catch {
      setResultado({ error: 'No se pudo completar el recálculo. Inténtalo de nuevo.' });
    }
    setFase('resultado');
  };

  const cerrar = () => {
    setFase('reposo');
    setResultado(null);
  };

  return (
    <>
      <button
        onClick={() => setFase('confirmar')}
        disabled={fase === 'trabajando'}
        style={{
          color: 'white', backgroundColor: 'transparent', border: '1px solid var(--color-eucalyptus)',
          fontSize: '11px', fontWeight: 'bold', padding: '4px 8px',
          borderRadius: '4px', cursor: 'pointer', opacity: fase === 'trabajando' ? 0.5 : 1,
        }}
      >
        {fase === 'trabajando' ? 'RECALCULANDO...' : 'PAUTAS IA'}
      </button>

      {(fase === 'confirmar' || fase === 'resultado') && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            backgroundColor: 'white', padding: '30px', borderRadius: '12px',
            width: '90%', maxWidth: '460px', maxHeight: '80vh', overflowY: 'auto',
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)', color: 'var(--color-ink-black)',
          }}>
            {fase === 'confirmar' && (
              <>
                <h3 className="suisse" style={{ margin: '0 0 15px 0', fontSize: '18px' }}>
                  ¿Recalcular las pautas programadas?
                </h3>
                <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: 'var(--color-graphite)', lineHeight: '1.5' }}>
                  La IA repasará cada tarea programada (producto, planta y modo de aplicación)
                  y reprogramará sus avisos con la frecuencia adecuada a cada caso, contando
                  desde tu última aplicación real. Las tareas sin producto no se tocan.
                </p>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={cerrar} className="btn-outline" style={{ padding: '8px 16px', fontSize: '14px' }}>
                    Cancelar
                  </button>
                  <button type="button" onClick={handleRecalcular} className="btn-solid" style={{ padding: '8px 16px', fontSize: '14px' }}>
                    Recalcular
                  </button>
                </div>
              </>
            )}

            {fase === 'resultado' && (
              <>
                <h3 className="suisse" style={{ margin: '0 0 15px 0', fontSize: '18px' }}>
                  {resultado?.error ? 'No se pudo recalcular' : 'Pautas revisadas'}
                </h3>

                {resultado?.error && (
                  <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#E74C3C' }}>{resultado.error}</p>
                )}

                {!resultado?.error && (
                  <>
                    {(resultado?.cambios?.length ?? 0) === 0 && (
                      <p style={{ margin: '0 0 15px 0', fontSize: '14px', color: 'var(--color-graphite)' }}>
                        No había ninguna pauta que corregir.
                      </p>
                    )}
                    {resultado?.cambios?.map((c, i) => (
                      <div key={i} style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: '1px solid var(--color-mist)' }}>
                        <p style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 'bold' }}>
                          {c.tarea}: cada {c.antes || '?'} → cada {c.ahora} días
                        </p>
                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-graphite)', lineHeight: '1.4' }}>{c.motivo}</p>
                      </div>
                    ))}
                    <p style={{ margin: '0 0 20px 0', fontSize: '12px', color: 'var(--color-graphite)' }}>
                      {(resultado?.yaCorrectas ?? 0) > 0 && <>Ya estaban bien: {resultado?.yaCorrectas}. </>}
                      {(resultado?.sinProducto ?? 0) > 0 && <>Sin producto asignado (no se tocan): {resultado?.sinProducto}.</>}
                    </p>
                  </>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={cerrar} className="btn-solid" style={{ padding: '8px 16px', fontSize: '14px' }}>
                    Entendido
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
