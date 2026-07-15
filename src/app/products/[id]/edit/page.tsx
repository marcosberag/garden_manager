import React from 'react';
import Link from 'next/link';
import { updateProduct } from '@/app/actions';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
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

  // Pre-bind the id to the server action
  const updateProductWithId = updateProduct.bind(null, id);

  return (
    <main className="container" style={{ paddingTop: '120px', paddingBottom: '120px' }}>
      
      <section className="section">
        <div style={{ display: 'flex', gap: '45px', alignItems: 'flex-start' }}>
          <div style={{ flex: '0 0 auto', paddingTop: '15px' }}>
            <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)' }}>
              inventario
            </span>
          </div>
          
          <div style={{ flex: '1', maxWidth: '600px' }}>
            <Link href="/products" style={{ display: 'inline-block', marginBottom: '20px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)', textDecoration: 'none' }}>
              &larr; Volver a Inventario
            </Link>

            <h1 className="heading-text suisse" style={{ color: 'var(--color-ink-black)', marginBottom: '30px' }}>
              editar<br/>
              producto.
            </h1>
            
            <form action={updateProductWithId} style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label htmlFor="name" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)' }}>Nombre del Producto *</label>
                <input 
                  type="text" 
                  id="name" 
                  name="name" 
                  defaultValue={product.name}
                  required 
                  style={{
                    padding: '15px',
                    backgroundColor: 'var(--color-pure-canvas)',
                    border: '1px solid var(--color-mist)',
                    borderRadius: '0',
                    fontFamily: 'inherit',
                    fontSize: '16px',
                    color: 'var(--color-ink-black)',
                    outline: 'none',
                    borderBottom: '2px solid var(--color-eucalyptus)'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label htmlFor="type" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)' }}>Tipo de Producto *</label>
                <select 
                  id="type" 
                  name="type" 
                  defaultValue={product.type}
                  required
                  style={{
                    padding: '15px',
                    backgroundColor: 'var(--color-pure-canvas)',
                    border: '1px solid var(--color-mist)',
                    borderRadius: '0',
                    fontFamily: 'inherit',
                    fontSize: '16px',
                    color: 'var(--color-ink-black)',
                    outline: 'none',
                    WebkitAppearance: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="" disabled>Selecciona un tipo...</option>
                  <option value="Abono Universal">Abono Universal</option>
                  <option value="Abono Específico">Abono Específico</option>
                  <option value="Insecticida">Insecticida</option>
                  <option value="Fungicida">Fungicida</option>
                  <option value="Sustrato">Sustrato</option>
                  <option value="Herramienta">Herramienta</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label htmlFor="description" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)' }}>Notas / Uso</label>
                <textarea 
                  id="description" 
                  name="description" 
                  defaultValue={product.description || ''}
                  rows={3}
                  style={{
                    padding: '15px',
                    backgroundColor: 'var(--color-pure-canvas)',
                    border: '1px solid var(--color-mist)',
                    borderRadius: '0',
                    fontFamily: 'inherit',
                    fontSize: '16px',
                    color: 'var(--color-ink-black)',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label htmlFor="barcode" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)' }}>Código de Barras (Opcional)</label>
                <input 
                  type="text" 
                  id="barcode" 
                  name="barcode" 
                  defaultValue={product.barcode || ''}
                  style={{
                    padding: '15px',
                    backgroundColor: 'var(--color-pure-canvas)',
                    border: '1px solid var(--color-mist)',
                    borderRadius: '0',
                    fontFamily: 'inherit',
                    fontSize: '16px',
                    color: 'var(--color-ink-black)',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ marginTop: '20px' }}>
                <button type="submit" className="btn-solid" style={{ width: '100%' }}>
                  GUARDAR CAMBIOS <span>&rarr;</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      </section>

    </main>
  );
}
