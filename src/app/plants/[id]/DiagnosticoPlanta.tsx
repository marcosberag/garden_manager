'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { IconoCamara, IconoGaleria } from '@/components/ScanIcons';
import type { Diagnostico } from '@/lib/diagnosticar-planta';

type Resultado = Diagnostico & {
  producto_id: string | null;
  evolucion?: 'mejora' | 'igual' | 'empeora' | null;
  veredicto_evolucion?: string | null;
};

const ETIQUETA_EVOLUCION: Record<string, { texto: string; clase: string }> = {
  mejora: { texto: 'Mejorando', clase: 'tag tag--fern' },
  igual: { texto: 'Sin cambios', clase: 'tag tag--muted' },
  empeora: { texto: 'Empeorando', clase: 'tag tag--alert' },
};

const ETIQUETA_METODO: Record<string, string> = {
  foliar: 'foliar, pulverizando las hojas',
  raiz: 'en la raíz, con el riego',
  suelo: 'al suelo, incorporado',
};

/**
 * Diagnóstico por foto: retrata la zona afectada y la IA dice qué tiene la
 * planta y con qué tratarla, encadenando con el registro de tratamiento
 * (producto, modo y notas pre-rellenados; la pauta la afina el formulario).
 */
export default function DiagnosticoPlanta({ plantId }: { plantId: string }) {
  const camaraRef = useRef<HTMLInputElement>(null);
  const galeriaRef = useRef<HTMLInputElement>(null);
  const [analizando, setAnalizando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalizando(true);
    setError(null);
    setResultado(null);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('plant_id', plantId);

      const res = await fetch('/api/plants/diagnose', { method: 'POST', body: formData });
      if (res.ok) {
        setResultado(await res.json());
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'No se pudo diagnosticar. Prueba con otra foto.');
      }
    } catch {
      setError('No se pudo conectar con la IA visual.');
    } finally {
      setAnalizando(false);
      if (camaraRef.current) camaraRef.current.value = '';
      if (galeriaRef.current) galeriaRef.current.value = '';
    }
  };

  // Con diagnóstico en mano, el registro sale pre-rellenado: planta, producto
  // (si el inventario tiene uno que sirva), modo y unas notas con el contexto,
  // que el formulario usa para afinar la pauta del caso.
  const enlaceRegistro = resultado ? (() => {
    const params = new URLSearchParams();
    params.set('plant_id', plantId);
    if (resultado.producto_id) params.set('product_id', resultado.producto_id);
    if (resultado.metodo) params.set('method', resultado.metodo);
    params.set('notes', `Diagnóstico IA: ${resultado.diagnostico}${resultado.gravedad ? ` (${resultado.gravedad})` : ''}. ${resultado.descripcion}`.slice(0, 400));
    return `/calendar/new?${params.toString()}`;
  })() : '#';

  return (
    <div style={{ marginBottom: '32px' }}>
      <h3 className="field-label" style={{ display: 'block', marginBottom: '12px' }}>
        Diagnóstico por foto
      </h3>

      <input type="file" accept="image/*" capture="environment" ref={camaraRef} onChange={handleFile} style={{ display: 'none' }} />
      <input type="file" accept="image/*" ref={galeriaRef} onChange={handleFile} style={{ display: 'none' }} />

      <div style={{ display: 'flex', gap: '8px' }}>
        <button type="button" className="btn-scan" onClick={() => camaraRef.current?.click()} disabled={analizando}>
          <IconoCamara /> {analizando ? 'Analizando…' : 'Fotografiar síntomas'}
        </button>
        <button type="button" className="btn-scan" onClick={() => galeriaRef.current?.click()} disabled={analizando}>
          <IconoGaleria /> De la galería
        </button>
      </div>

      {error && (
        <p style={{ fontSize: '12px', color: 'var(--color-alert)', marginTop: '8px', marginBottom: 0 }}>{error}</p>
      )}

      {resultado && (
        <div className="card" style={{ marginTop: '12px', borderLeft: `3px solid ${resultado.enferma ? 'var(--color-alert)' : 'var(--color-moss)'}` }}>
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '10px' }}>
            {resultado.enferma
              ? <span className="tag tag--alert">{resultado.gravedad || 'enferma'}</span>
              : <span className="tag tag--fern">Sana</span>}
            <span className="tag">Confianza {resultado.confianza}</span>
          </div>

          <h4 className="suisse" style={{ fontSize: '17px', margin: '0 0 6px 0' }}>{resultado.diagnostico}</h4>
          <p style={{ fontSize: '13px', color: 'var(--color-slate-smoke)', margin: '0 0 12px 0', lineHeight: 1.5 }}>
            {resultado.descripcion}
          </p>

          {resultado.veredicto_evolucion && (
            <div style={{ backgroundColor: 'var(--color-ash-gray)', borderRadius: '8px', padding: '12px 14px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                <p className="eyebrow" style={{ margin: 0 }}>Evolución desde la última foto</p>
                {resultado.evolucion && ETIQUETA_EVOLUCION[resultado.evolucion] && (
                  <span className={ETIQUETA_EVOLUCION[resultado.evolucion].clase}>
                    {ETIQUETA_EVOLUCION[resultado.evolucion].texto}
                  </span>
                )}
              </div>
              <p style={{ fontSize: '13px', margin: 0, lineHeight: 1.5, color: 'var(--color-forest-ink)' }}>
                {resultado.veredicto_evolucion}
              </p>
            </div>
          )}

          <div style={{ backgroundColor: 'var(--color-ash-gray)', borderRadius: '8px', padding: '12px 14px' }}>
            <p className="eyebrow" style={{ marginBottom: '6px' }}>Tratamiento recomendado</p>
            <p style={{ fontSize: '13px', margin: 0, lineHeight: 1.55, color: 'var(--color-forest-ink)' }}>
              {resultado.tratamiento}
            </p>
            <ul style={{ margin: '8px 0 0 0', paddingLeft: '18px', fontSize: '12px', color: 'var(--color-slate-smoke)', lineHeight: 1.7 }}>
              {resultado.producto_del_inventario && (
                <li>Producto: <strong style={{ color: 'var(--color-forest-ink)', fontWeight: 500 }}>{resultado.producto_del_inventario}</strong> (de tu inventario)</li>
              )}
              {!resultado.producto_del_inventario && resultado.tipo_de_producto_sugerido && (
                <li>Necesitarías: {resultado.tipo_de_producto_sugerido} (no hay nada que encaje en tu inventario)</li>
              )}
              {resultado.metodo && <li>Aplicación {ETIQUETA_METODO[resultado.metodo] || resultado.metodo}</li>}
              {resultado.frequency_days && <li>Repetir cada ~{resultado.frequency_days} días (el formulario afinará la pauta)</li>}
              {resultado.duracion && <li>Mantener {resultado.duracion}</li>}
            </ul>
          </div>

          {resultado.enferma && (
            <Link href={enlaceRegistro} className="btn-solid" style={{ width: '100%', marginTop: '12px', textDecoration: 'none' }}>
              Registrar este tratamiento &rarr;
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
