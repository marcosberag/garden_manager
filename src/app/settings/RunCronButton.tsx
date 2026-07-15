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
    } catch (err: any) {
      setResult(`❌ Error de red: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px' }}>
      <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#166534' }}>Simulador de Tareas Diarias</h4>
      <p style={{ margin: '0 0 15px 0', fontSize: '12px', color: '#15803d' }}>
        Dado que estás ejecutando esto en tu ordenador, el servidor no puede enviar mensajes automáticamente por la noche. Usa este botón para simular el paso de un día y forzar el envío de WhatsApps a los contactos con tareas pendientes HOY.
      </p>
      <button 
        onClick={runCron} 
        disabled={isLoading}
        className="btn-solid" 
        style={{ backgroundColor: '#16a34a', color: 'white', padding: '8px 15px', fontSize: '12px' }}
      >
        {isLoading ? 'ENVIANDO...' : 'FORZAR ENVÍO DIARIO DE AVISOS'}
      </button>
      {result && <p style={{ marginTop: '10px', fontSize: '12px', fontWeight: 'bold', color: result.includes('❌') ? '#dc2626' : '#16a34a' }}>{result}</p>}
    </div>
  );
}
