import React from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import ProductActions from '../ProductActions';

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();

  if (!product) {
    return (
      <main className="container" style={{ paddingTop: '120px' }}>
        <h2>Producto no encontrado</h2>
        <Link href="/products">Volver</Link>
      </main>
    );
  }

  return (
    <main className="container" style={{ paddingTop: '120px', paddingBottom: '120px' }}>
      <section className="section">
        <div className="labeled-section">
          <div className="labeled-section-tag">
            <span className="field-label">
              inventario
            </span>
          </div>
          
          <div className="labeled-section-body" style={{ maxWidth: '600px' }}>
            <Link href="/products" style={{ display: 'inline-block', marginBottom: '20px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)', textDecoration: 'none' }}>
              &larr; Volver a Inventario
            </Link>

            <h1 className="heading-text suisse" style={{ color: 'var(--color-ink-black)', marginBottom: '10px' }}>
              {product.name}
            </h1>
            
            <span style={{ display: 'inline-block', backgroundColor: 'var(--color-mist)', padding: '5px 10px', borderRadius: '4px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)', marginBottom: '30px' }}>
              {product.type}
            </span>

            <div className="card" style={{ marginBottom: '30px' }}>
              <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)', margin: '0 0 10px 0' }}>Descripción y Notas</h3>
              <p className="body-text" style={{ fontSize: '16px', margin: 0 }}>
                {product.description || 'Sin descripción adicional.'}
              </p>
            </div>

            {product.barcode && (
              <div className="card" style={{ marginBottom: '30px' }}>
                <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)', margin: '0 0 10px 0' }}>Código de barras</h3>
                <p className="body-text" style={{ fontSize: '16px', margin: 0, fontFamily: 'monospace' }}>
                  {product.barcode}
                </p>
              </div>
            )}

            <div style={{ marginTop: '45px', borderTop: '1px solid var(--color-mist)', paddingTop: '30px' }}>
              <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)', margin: '0 0 20px 0' }}>Acciones</h3>
              <ProductActions id={product.id} />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
