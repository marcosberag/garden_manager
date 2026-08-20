'use client';

import React, { useState } from 'react';
import { prepararPlanAnual, aplicarPlanAnual } from '@/app/actions';
import type { PropuestaPlan } from '@/lib/plan-anual';

const fechaCorta = (iso: string) => {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
};

/**
 * Plan preventivo anual: la IA propone las intervenciones estacionales de los
 * próximos 12 meses a partir del jardín real (plantas, historial, inventario)
 * y de las plagas que declares. Eliges cuáles programar.
 */
export default function PlanAnual() {
  const [indicaciones, setIndicaciones] = useState('');
  const [generando, setGenerando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [propuestas, setPropuestas] = useState<PropuestaPlan[] | null>(null);
  const [marcadas, setMarcadas] = useState<Set<number>>(new Set());
  const [mensaje, setMensaje] = useState<string | null>(null);

  const generar = async () => {
    setGenerando(true);
    setMensaje(null);
    setPropuestas(null);
    try {
      const r = await prepararPlanAnual(indicaciones);
      if (r.propuestas) {
        setPropuestas(r.propuestas);
        setMarcadas(new Set(r.propuestas.map((_, i) => i)));
        if (r.propuestas.length === 0) {
          setMensaje('La IA no ve intervenciones que añadir: lo programado ya cubre el año.');
        }
      } else {
        setMensaje(r.error || 'No se pudo generar el plan.');
      }
    } catch {
      setMensaje('No se pudo generar el plan. Inténtalo de nuevo.');
    }
    setGenerando(false);
  };

  const aplicar = async () => {
    if (!propuestas) return;
    setAplicando(true);
    setMensaje(null);
    try {
      const seleccion = propuestas.filter((_, i) => marcadas.has(i));
      const r = await aplicarPlanAnual(seleccion);
      setMensaje(r.error || `${r.creadas} ${r.creadas === 1 ? 'intervención programada' : 'intervenciones programadas'}. Las verás en la agenda y avisarán por WhatsApp como cualquier otra.`);
      if (!r.error) setPropuestas(null);
    } catch {
      setMensaje('No se pudo programar el plan. Inténtalo de nuevo.');
    }
    setAplicando(false);
  };

  const alternar = (i: number) => {
    setMarcadas(prev => {
      const s = new Set(prev);
      if (s.has(i)) s.delete(i); else s.add(i);
      return s;
    });
  };

  return (
    <div className="card" style={{ marginTop: '24px' }}>
      <p className="eyebrow" style={{ marginBottom: '8px' }}>Plan anual del jardín</p>
      <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: 'var(--color-slate-smoke)', lineHeight: 1.5 }}>
        La IA propone las intervenciones preventivas de los próximos 12 meses a partir de tus
        plantas, tu historial y tu inventario. Solo planifica contra problemas con evidencia:
        cuéntale aquí las plagas reales de tu jardín para que no suponga ninguna.
      </p>
      <textarea
        className="input-field"
        rows={2}
        placeholder="Ej: la plaga de las palmeras es Paysandisia, no picudo; a los leylandis se les amarronan las ramas por dentro…"
        value={indicaciones}
        onChange={e => setIndicaciones(e.target.value)}
        style={{ marginBottom: '12px' }}
      />
      <button onClick={generar} disabled={generando || aplicando} className="btn-outline" style={{ padding: '8px 15px', fontSize: '12px' }}>
        {generando ? 'Pensando el año…' : 'Proponer plan anual'}
      </button>

      {propuestas && propuestas.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          {propuestas.map((p, i) => (
            <label key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid var(--color-ash-gray)', cursor: 'pointer' }}>
              <input type="checkbox" checked={marcadas.has(i)} onChange={() => alternar(i)} style={{ marginTop: '3px' }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '2px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 500, color: 'var(--color-deep-fern)' }}>{fechaCorta(p.fecha)}</span>
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-forest-ink)' }}>{p.titulo}</span>
                  {p.frequency_days && <span className="tag tag--fern">cada {p.frequency_days} días</span>}
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-slate-smoke)', lineHeight: 1.45 }}>
                  {[p.planta, p.producto].filter(Boolean).join(' · ')}{(p.planta || p.producto) ? ' — ' : ''}{p.motivo}
                </p>
              </div>
            </label>
          ))}
          <button onClick={aplicar} disabled={aplicando || marcadas.size === 0} className="btn-solid" style={{ marginTop: '14px', padding: '10px 16px' }}>
            {aplicando ? 'Programando…' : `Programar ${marcadas.size} ${marcadas.size === 1 ? 'seleccionada' : 'seleccionadas'}`}
          </button>
        </div>
      )}

      {mensaje && (
        <p style={{ marginTop: '12px', marginBottom: 0, fontSize: '12px', fontWeight: 500, color: 'var(--color-deep-fern)' }}>{mensaje}</p>
      )}
    </div>
  );
}
