import React from 'react';
import Link from 'next/link';
import { addProduct } from '@/app/actions';
import ProductForm from '../ProductForm';

export default function NewProductPage() {
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
              añadir<br/>
              producto.
            </h1>
            <p className="body-text" style={{ marginBottom: '45px' }}>
              Hazle una foto a la etiqueta y la IA rellena la ficha, o escríbela tú.
            </p>

            <ProductForm action={addProduct} textoBoton="Añadir al inventario" />
          </div>
        </div>
      </section>

    </main>
  );
}
