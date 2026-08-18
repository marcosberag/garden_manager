import React from 'react';
import Link from 'next/link';
import { addProduct } from '@/app/actions';
import AutocompleteInput from '@/components/AutocompleteInput';

export default function NewProductPage() {
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
              añadir<br/>
              producto.
            </h1>
            <p className="body-text" style={{ marginBottom: '45px' }}>
              Registra fertilizantes, fungicidas o sustratos para que la IA los tenga en cuenta.
            </p>
            
            <form action={addProduct} style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label htmlFor="name" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)' }}>Nombre / Marca *</label>
                <AutocompleteInput 
                  id="name" 
                  name="name" 
                  required 
                  placeholder="Ej: Aceite de Neem, Jabón Potásico..." 
                  apiEndpoint="/api/products/suggest" 
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label htmlFor="type" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)' }}>Tipo de Producto *</label>
                <select 
                  id="type" 
                  name="type" 
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
                  <option value="" disabled selected>Selecciona un tipo...</option>
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
                  rows={3}
                  placeholder="Ej: Para usar cada 15 días en primavera..."
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
                <label htmlFor="frequency_days" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)' }}>Cada cuántos días se aplica</label>
                <input
                  type="number"
                  id="frequency_days"
                  name="frequency_days"
                  min="1"
                  max="365"
                  placeholder="Déjalo vacío y lo deduzco por ti"
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
                <p style={{ fontSize: '11px', color: 'var(--color-graphite)', margin: 0 }}>
                  Se usará para proponer la repetición al registrar un tratamiento con este producto. Si lo dejas vacío, se calcula a partir del nombre y el tipo.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label htmlFor="barcode" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)' }}>Código de Barras (Opcional)</label>
                <input 
                  type="text" 
                  id="barcode" 
                  name="barcode" 
                  placeholder="Ej: 8411000123456"
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
                  AÑADIR AL INVENTARIO <span>&rarr;</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      </section>

    </main>
  );
}
