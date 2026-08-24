'use client';

import React, { useState } from 'react';

export default function RunCronButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const runCron = async () => {
    setIsLoading(true);
    setResult(null);
    try {
      // Usamos no-store para evitar que el navegador guarde en caché la respuesta
      const res = await fetch('/api/cron/whatsapp', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) {
        if (data.messagesSent) {
          setResult(`✅ Éxito: Se han enviado ${data.messagesSent.length} mensajes.`);
        } else {
          setResult(`✅ Respuesta: ${data.message} ${data.debugInfo ? JSON.stringify(data.debugInfo) : ''}`);
        }
      } else {
        setResult(`❌ Error: ${data.error || data.message || 'Desconocido'}`);
      }
    } catch (err) {
      setResult(`❌ Error de red: ${err instanceof Error ? err.message : 'desconocido'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card" style={{ marginTop: '24px' }}>
      <p className="eyebrow" style={{ marginBottom: '8px' }}>Simulador de tareas diarias</p>
      <p style={{ margin: '0 0 15px 0', fontSize: '12px', color: 'var(--color-slate-smoke)' }}>
        Dado que estás ejecutando esto en tu ordenador, el servidor no puede enviar mensajes automáticamente por la noche. Usa este botón para simular el paso de un día y forzar el envío de WhatsApps a los contactos con tareas pendientes HOY.
      </p>
      <button
        onClick={runCron}
        disabled={isLoading}
        className="btn-outline"
        style={{ padding: '8px 15px', fontSize: '12px' }}
      >
        {isLoading ? 'Enviando…' : 'Forzar envío diario de avisos'}
      </button>
      {result && <p style={{ marginTop: '10px', fontSize: '12px', fontWeight: 500, color: result.includes('❌') ? 'var(--color-alert)' : 'var(--color-deep-fern)' }}>{result}</p>}
    </div>
  );
}
