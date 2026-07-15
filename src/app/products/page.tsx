import React from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import ProductActions from './ProductActions';

export default async function ProductsPage() {
  const supabase = await createClient();
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <main className="container" style={{ paddingTop: '120px', paddingBottom: '120px' }}>
      
      <section className="section">
        <div style={{ display: 'flex', gap: '45px', alignItems: 'flex-start' }}>
          <div style={{ flex: '0 0 auto', paddingTop: '15px' }}>
            <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)' }}>
              inventario
            </span>
          </div>
          
          <div style={{ flex: '1' }}>
            <h1 className="heading-text suisse" style={{ color: 'var(--color-ink-black)', marginBottom: '30px' }}>
              el armario de<br/>
              suministros.
            </h1>
            <p className="body-text">
              Mantén una lista precisa de tus productos de jardinería. La Inteligencia Artificial la usa para recomendar tratamientos en base a lo que ya tienes.
            </p>
            
            <div style={{ marginTop: '75px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '30px' }}>
              {products?.map(product => (
                <div key={product.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--color-eucalyptus)', textTransform: 'uppercase', letterSpacing: '1px' }}>{product.type}</span>
                    <h3 className="suisse" style={{ fontSize: '24px', margin: '15px 0' }}>{product.name}</h3>
                    <p className="body-text" style={{ fontSize: '14px' }}>{product.description}</p>
                  </div>
                  <hr className="hairline graphite" style={{ margin: '23px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Link href={`/products/${product.id}`} className="btn-ghost" style={{ padding: '8px 15px', fontSize: '12px', textDecoration: 'none' }}>
                      VER DETALLES <span>&rarr;</span>
                    </Link>
                    <ProductActions id={product.id} />
                  </div>
                </div>
              ))}

              {(!products || products.length === 0) && (
                <p className="body-text" style={{ gridColumn: '1 / -1' }}>Aún no tienes productos en tu inventario.</p>
              )}
            </div>
            
            <div style={{ marginTop: '75px' }}>
              <Link href="/products/new" className="btn-ghost" style={{ borderColor: 'var(--color-ink-black)', display: 'inline-block', textDecoration: 'none' }}>
                AÑADIR PRODUCTO <span>&rarr;&rarr;</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

    </main>
  );
}
