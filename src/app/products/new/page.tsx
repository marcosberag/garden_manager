import React from 'react';
import Link from 'next/link';
import { addProduct } from '@/app/actions';
import ProductForm from '../ProductForm';

export default function NewProductPage() {
  return (
    <main className="container" style={{ paddingTop: '120px', paddingBottom: '120px' }}>

      <section className="section">
        <div className="labeled-section">
          <div className="labeled-section-tag">
            <span className="field-label">inventario</span>
          </div>

          <div className="labeled-section-body" style={{ maxWidth: '600px' }}>
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
