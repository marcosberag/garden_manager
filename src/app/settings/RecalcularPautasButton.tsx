'use client';

import React, { useState } from 'react';
import { recalcularPautasProgramadas } from '@/app/actions';

type Resultado = {
  cambios?: { tarea: string; antes: number; ahora: number; motivo: string; hasta: string | null }[];
  reactivadas?: { tarea: string; dias: number; ultima: string; motivo: string; hasta: string | null }[];
  yaCorrectas?: string[];
  sinProducto?: number;
  sinPauta?: string[];
  sinRegistrar?: string[];
  error?: string;
};

const fechaCorta = (iso: string) => {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
};

/**
 * Repasa las tareas programadas y les pone la pauta que la IA considera
 * correcta para cada caso; además reactiva las tareas con pauta que se
 * quedaron sin avisos. Enseña un resumen de qué ha cambiado y por qué.
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

  const sinNovedades = (resultado?.cambios?.length ?? 0) === 0 && (resultado?.reactivadas?.length ?? 0) === 0;

  return (
    <>
      <button
        onClick={() => setFase('confirmar')}
        disabled={fase === 'trabajando'}
        className="chip-btn"
      >
        {fase === 'trabajando' ? 'Recalculando…' : 'Pautas IA'}
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
                  ¿Revisar las pautas con la IA?
                </h3>
                <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: 'var(--color-graphite)', lineHeight: '1.5' }}>
                  La IA repasa cada tarea programada — producto, planta y modo de aplicación — y
                  reprograma sus avisos con la frecuencia adecuada a ese caso, contando desde tu
                  última aplicación real. También reactiva los tratamientos con pauta que se
                  quedaron sin avisos pendientes. Las tareas sin producto no se tocan.
                </p>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={cerrar} className="btn-outline" style={{ padding: '10px 16px' }}>
                    Cancelar
                  </button>
                  <button type="button" onClick={handleRecalcular} className="btn-solid" style={{ padding: '10px 16px' }}>
                    Revisar
                  </button>
                </div>
              </>
            )}

            {fase === 'resultado' && (
              <>
                <h3 className="suisse" style={{ margin: '0 0 20px 0', fontSize: '18px' }}>
                  {resultado?.error ? 'No se pudo revisar' : 'Pautas revisadas'}
                </h3>

                {resultado?.error && (
                  <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: 'var(--color-alert)' }}>{resultado.error}</p>
                )}

                {!resultado?.error && (
                  <>
                    {sinNovedades && (
                      <p style={{ margin: '0 0 15px 0', fontSize: '14px', color: 'var(--color-graphite)' }}>
                        No había pautas que corregir ni tratamientos parados que retomar.
                      </p>
                    )}

                    {resultado?.cambios?.map((c, i) => (
                      <div key={`c${i}`} style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: '1px solid var(--color-mist)' }}>
                        <p className="eyebrow" style={{ marginBottom: '4px' }}>{c.tarea}</p>
                        <p style={{ margin: '0 0 4px 0', fontSize: '15px' }}>
                          cada {c.antes || '?'} días <span style={{ color: 'var(--color-eucalyptus)' }}>&rarr;</span> cada {c.ahora} días
                        </p>
                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-graphite)', lineHeight: '1.45' }}>{c.motivo}</p>
                        {c.hasta && (
                          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--color-graphite)' }}>
                            Hasta cuándo: {c.hasta}.
                          </p>
                        )}
                      </div>
                    ))}

                    {resultado?.reactivadas?.map((r, i) => (
                      <div key={`r${i}`} style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: '1px solid var(--color-mist)' }}>
                        <p className="eyebrow" style={{ marginBottom: '4px' }}>{r.tarea} — retomado</p>
                        <p style={{ margin: '0 0 4px 0', fontSize: '15px' }}>
                          cada {r.dias} días, desde la última aplicación ({fechaCorta(r.ultima)})
                        </p>
                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-graphite)', lineHeight: '1.45' }}>
                          Estaba sin avisos pendientes. {r.motivo}
                        </p>
                        {r.hasta && (
                          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--color-graphite)' }}>
                            Hasta cuándo: {r.hasta}.
                          </p>
                        )}
                      </div>
                    ))}

                    {(resultado?.yaCorrectas?.length ?? 0) > 0 && (
                      <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: 'var(--color-graphite)', lineHeight: '1.5' }}>
                        Ya estaban bien: {resultado?.yaCorrectas?.join(' · ')}.
                      </p>
                    )}
                    {(resultado?.sinProducto ?? 0) > 0 && (
                      <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: 'var(--color-graphite)' }}>
                        Tareas sin producto asignado, sin tocar: {resultado?.sinProducto}.
                      </p>
                    )}
                    {(resultado?.sinRegistrar?.length ?? 0) > 0 && (
                      <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: 'var(--color-graphite)', lineHeight: '1.5' }}>
                        Con pauta pero sin ningún tratamiento registrado: {resultado?.sinRegistrar?.join(' · ')}.
                        Regístralos una vez desde «Registrar tratamiento» (con la fecha de la última
                        aplicación real) y entrarán en seguimiento.
                      </p>
                    )}
                    {(resultado?.sinPauta?.length ?? 0) > 0 && (
                      <p style={{ margin: '0 0 20px 0', fontSize: '12px', color: 'var(--color-graphite)', lineHeight: '1.5' }}>
                        No se pudo calcular pauta para: {resultado?.sinPauta?.join(' · ')}.
                      </p>
                    )}
                  </>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <button type="button" onClick={cerrar} className="btn-solid" style={{ padding: '10px 16px' }}>
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
