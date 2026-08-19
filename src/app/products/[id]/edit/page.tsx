import React from 'react';
import Link from 'next/link';
import { updateProduct } from '@/app/actions';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import ProductForm from '../../ProductForm';

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
            <span className="field-label">inventario</span>
          </div>

          <div style={{ flex: '1', maxWidth: '600px' }}>
            <Link href="/products" className="field-label" style={{ display: 'inline-block', marginBottom: '20px', textDecoration: 'none' }}>
              &larr; Volver a Inventario
            </Link>

            <h1 className="heading-text suisse" style={{ color: 'var(--color-ink-black)', marginBottom: '30px' }}>
              editar<br/>
              producto.
            </h1>
            <p className="body-text" style={{ marginBottom: '45px' }}>
              ¿Es un producto genérico? Fotografía el envase real y la IA completa la ficha.
            </p>

            <ProductForm
              action={updateProductWithId}
              defaults={product}
              textoBoton="Guardar cambios"
            />
          </div>
        </div>
      </section>

    </main>
  );
}
