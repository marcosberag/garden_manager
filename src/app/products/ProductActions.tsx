'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { deleteProduct } from '@/app/actions';

export default function ProductActions({ id }: { id: string }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteProduct(id);
    } catch (err) {
      alert('Error al eliminar el producto.');
      setIsDeleting(false);
      setShowConfirm(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
      <Link href={`/products/${id}/edit`} style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-eucalyptus)', textDecoration: 'none' }}>
        Editar
      </Link>
      
      {showConfirm ? (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--color-graphite)' }}>¿Seguro?</span>
          <button onClick={handleDelete} disabled={isDeleting} style={{ background: 'none', border: 'none', padding: 0, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: '#ff4d4f', cursor: isDeleting ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
            {isDeleting ? '...' : 'Sí, eliminar'}
          </button>
          <button onClick={() => setShowConfirm(false)} disabled={isDeleting} style={{ background: 'none', border: 'none', padding: 0, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)', cursor: 'pointer' }}>
            Cancelar
          </button>
        </div>
      ) : (
        <button onClick={() => setShowConfirm(true)} style={{ background: 'none', border: 'none', padding: 0, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)', cursor: 'pointer' }}>
          Eliminar
        </button>
      )}
    </div>
  );
}
