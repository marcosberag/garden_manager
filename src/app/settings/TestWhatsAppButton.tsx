'use client';

import React, { useState } from 'react';

export default function TestWhatsAppButton({ phone, apikey }: { phone: string, apikey?: string }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleTest = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/test-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, apikey }),
      });
      const data = await res.json();
      
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000); // Reset after 3 seconds
      } else {
        alert('Error: ' + data.error);
      }
    } catch (err) {
      alert('Error de conexión al enviar el mensaje.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handleTest} 
      disabled={loading || success}
      className="btn-ghost" 
      style={{ 
        padding: '8px 15px', 
        fontSize: '12px', 
        borderColor: success ? 'var(--color-eucalyptus)' : 'var(--color-ink-black)', 
        color: success ? 'var(--color-pure-canvas)' : 'var(--color-ink-black)',
        backgroundColor: success ? 'var(--color-eucalyptus)' : 'transparent',
        opacity: loading ? 0.5 : 1 
      }}
    >
      {loading ? 'Enviando...' : success ? '¡Enviado!' : 'Probar WhatsApp'}
    </button>
  );
}
