'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { consultarAsistente } from '@/app/actions';

type Turno = {
  pregunta: string;
  respuesta: string;
  hechos: string[];
  enlaces: { href: string; etiqueta: string }[];
};

/**
 * La ventanilla del jardín: un solo campo donde contar lo que haga falta —
 * «he visto pulgón en el rosal, anótalo», «he comprado un abono», «tengo un
 * limonero nuevo», «¿qué me recomiendas para el oídio?» — y el asistente
 * anota, da de alta o contesta, dejando enlace a la pantalla que toque.
 */
export default function Asistente() {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [texto, setTexto] = useState('');
  const [cargando, setCargando] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (turnos.length > 0 || cargando) {
      finRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [turnos, cargando]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const pregunta = texto.trim();
    if (!pregunta || cargando) return;
    setTexto('');
    setCargando(true);
    try {
      const r = await consultarAsistente(
        pregunta,
        turnos.slice(-4).map(t => ({ pregunta: t.pregunta, respuesta: t.respuesta })),
      );
      setTurnos(prev => [...prev, {
        pregunta,
        respuesta: r.error || r.respuesta,
        hechos: r.hechos || [],
        enlaces: r.enlaces || [],
      }]);
    } catch {
      setTurnos(prev => [...prev, { pregunta, respuesta: 'No he podido responder. Inténtalo de nuevo.', hechos: [], enlaces: [] }]);
    }
    setCargando(false);
  };

  return (
    <div style={{ flex: '0 0 auto', padding: '12px 16px 14px', borderBottom: '1px solid var(--color-lichen)', backgroundColor: 'var(--color-bone-white)' }}>
      <p className="home-panel-title" style={{ marginBottom: '8px' }}>[ Asistente ]</p>

      {(turnos.length > 0 || cargando) && (
        <div style={{ maxHeight: '36vh', overflowY: 'auto', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {turnos.map((t, i) => (
            <div key={i}>
              <p style={{ margin: '0 0 4px 0', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-slate-smoke)', lineHeight: 1.5 }}>
                › {t.pregunta}
              </p>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-forest-ink)', lineHeight: 1.55 }}>
                {t.respuesta}
              </p>
              {t.hechos.map((h, j) => (
                <p key={j} style={{ margin: '4px 0 0 0', fontFamily: 'var(--font-mono)', fontSize: '10.5px', color: 'var(--color-deep-fern)', lineHeight: 1.5 }}>
                  ✓ {h}
                </p>
              ))}
              {t.enlaces.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                  {t.enlaces.map((en, j) => (
                    <Link key={j} href={en.href} className="chip-btn">{en.etiqueta} →</Link>
                  ))}
                </div>
              )}
            </div>
          ))}
          {cargando && (
            <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-slate-smoke)' }}>
              Pensando…
            </p>
          )}
          <div ref={finRef} />
        </div>
      )}

      <form onSubmit={enviar} style={{ display: 'flex', gap: '6px' }}>
        <input
          className="input-field"
          style={{ flex: 1, padding: '9px 12px' }}
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder="«He visto pulgón…», «he comprado…», «¿qué me recomiendas…?»"
          disabled={cargando}
          aria-label="Cuéntale al asistente"
        />
        <button
          type="submit"
          className="chip-btn chip-btn--primary"
          disabled={cargando || !texto.trim()}
          aria-label="Enviar"
          style={{ padding: '0 14px', fontSize: '14px' }}
        >
          →
        </button>
      </form>
    </div>
  );
}
