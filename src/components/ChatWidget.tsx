'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useChat } from '@ai-sdk/react';

export default function ChatWidget() {
  const { messages, sendMessage, append, status } = useChat({
    api: '/api/chat',
    maxSteps: 10,
  }) as any; // Cast to any to safely destructure append if it exists in older versions

  const [localInput, setLocalInput] = useState('');
  const isLoading = status === 'submitted' || status === 'streaming';
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const send = sendMessage || append;
    if (!localInput.trim() || !send) return;
    
    // Llamar a la función de envío de mensajes con la interfaz UIMessage básica
    send({ id: Date.now().toString(), role: 'user', content: localInput });
    setLocalInput('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', backgroundColor: 'var(--color-pure-canvas)' }}>
      {/* Mensajes */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '15px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: '20px', color: 'var(--color-graphite)' }}>
            <p className="body-text" style={{ fontSize: '14px' }}>
              ¡Hola! Soy tu asistente botánico. Puedes decirme:<br/><br/>
              <em>"He echado Jabón Potásico a la palmera hoy"</em><br/>
              <em>"Añade un nuevo rosal"</em><br/>
              O envíame una foto de un producto.
            </p>
          </div>
        )}
        
        {messages.map(m => (
          <div key={m.id} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '85%',
            backgroundColor: m.role === 'user' ? 'var(--color-ink-black)' : 'white',
            color: m.role === 'user' ? 'white' : 'var(--color-ink-black)',
            padding: '12px 16px',
            borderRadius: '12px',
            border: m.role === 'user' ? 'none' : '1px solid var(--color-mist)',
            borderBottomRightRadius: m.role === 'user' ? '4px' : '12px',
            borderBottomLeftRadius: m.role === 'user' ? '12px' : '4px',
            boxShadow: m.role === 'user' ? 'none' : '0 2px 5px rgba(0,0,0,0.02)',
            fontSize: '14px',
            lineHeight: '1.4'
          }}>
            {/* Si el mensaje contiene imágenes, renderizarlas */}
            {m.experimental_attachments?.map((attachment, index) => (
              attachment.contentType?.startsWith('image/') && (
                <img 
                  key={`${m.id}-${index}`} 
                  src={attachment.url} 
                  alt="Attachment" 
                  style={{ maxWidth: '100%', borderRadius: '8px', marginBottom: '8px' }} 
                />
              )
            ))}
            
            <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
          </div>
        ))}

        {isLoading && (
          <div style={{ alignSelf: 'flex-start', padding: '12px 16px', backgroundColor: 'white', border: '1px solid var(--color-mist)', borderRadius: '12px', fontSize: '14px', color: 'var(--color-graphite)' }}>
            Pensando...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={onFormSubmit} style={{ borderTop: '1px solid var(--color-mist)', padding: '15px', backgroundColor: 'white' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          
          <input
            value={localInput}
            onChange={(e) => setLocalInput(e.target.value)}
            placeholder="Escribe aquí..."
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '10px 15px',
              border: '1px solid var(--color-mist)',
              borderRadius: '8px',
              outline: 'none',
              fontFamily: 'inherit',
              fontSize: '14px'
            }}
          />
          <button 
            type="submit" 
            disabled={isLoading || !localInput.trim()}
            style={{
              backgroundColor: 'var(--color-ink-black)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '0 15px',
              cursor: (isLoading || !localInput.trim()) ? 'not-allowed' : 'pointer',
              opacity: (isLoading || !localInput.trim()) ? 0.5 : 1,
              fontWeight: 'bold'
            }}
          >
            &rarr;
          </button>
        </div>
      </form>
    </div>
  );
}
