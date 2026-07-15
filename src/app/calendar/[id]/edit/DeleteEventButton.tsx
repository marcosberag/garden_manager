'use client';

import React from 'react';

export default function DeleteEventButton() {
  return (
    <button 
      type="submit" 
      className="btn-outline" 
      style={{ width: '100%', borderColor: 'var(--color-alert)', color: 'var(--color-alert)' }} 
      onClick={(e) => {
        if(!confirm('¿Estás seguro de querer eliminar este registro?')) e.preventDefault();
      }}
    >
      ELIMINAR REGISTRO
    </button>
  );
}
