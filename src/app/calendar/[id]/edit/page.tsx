import React from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { updateEvent, deleteEvent } from '@/app/actions';
import DeleteEventButton from './DeleteEventButton';

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch the event
  const { data: event } = await supabase.from('events').select('*').eq('id', id).eq('user_id', user.id).single();
  
  if (!event) {
    redirect('/');
  }

  // Fetch plants and products for the dropdowns
  const { data: plants } = await supabase.from('plants').select('id, name, species').eq('user_id', user.id);
  const { data: products } = await supabase.from('products').select('id, name, type').eq('user_id', user.id);

  const updateEventWithId = updateEvent.bind(null, id);
  const deleteEventWithId = deleteEvent.bind(null, id);

  return (
    <main className="container" style={{ paddingTop: '120px', paddingBottom: '120px' }}>
      <section className="section">
        <div className="labeled-section">
          <div className="labeled-section-tag">
            <span className="field-label">
              calendario
            </span>
          </div>

          <div className="labeled-section-body" style={{ maxWidth: '600px' }}>
            <Link href="/" style={{ display: 'inline-block', marginBottom: '20px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)', textDecoration: 'none' }}>
              &larr; Inicio
            </Link>

            <h1 className="heading-text suisse" style={{ color: 'var(--color-ink-black)', marginBottom: '30px' }}>
              editar<br/>
              tratamiento.
            </h1>

            <form action={updateEventWithId} style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              
              <div style={{ display: 'flex', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                  <label htmlFor="date" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)' }}>Fecha *</label>
                  <input 
                    type="date" 
                    id="date" 
                    name="date" 
                    required 
                    defaultValue={event.date}
                    style={{
                      padding: '15px', backgroundColor: 'var(--color-pure-canvas)', border: '1px solid var(--color-mist)',
                      borderRadius: '0', fontFamily: 'inherit', fontSize: '16px', outline: 'none'
                    }}
                  />
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                  <label htmlFor="type" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)' }}>Tipo de Tarea *</label>
                  <select 
                    id="type" 
                    name="type" 
                    required 
                    defaultValue={event.type}
                    style={{
                      padding: '15px', backgroundColor: 'var(--color-pure-canvas)', border: '1px solid var(--color-mist)',
                      borderRadius: '0', fontFamily: 'inherit', fontSize: '16px', outline: 'none', appearance: 'none'
                    }}
                  >
                    <option value="Fumigación">Fumigación</option>
                    <option value="Poda">Poda</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label htmlFor="plant_id" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)' }}>Planta Afectada (Opcional)</label>
                <select 
                  id="plant_id" 
                  name="plant_id"
                  defaultValue={event.plant_id || ''} 
                  style={{
                    padding: '15px', backgroundColor: 'var(--color-pure-canvas)', border: '1px solid var(--color-mist)',
                    borderRadius: '0', fontFamily: 'inherit', fontSize: '16px', outline: 'none'
                  }}
                >
                  <option value="">Todas / General</option>
                  {plants?.map(p => (
                    <option key={p.id} value={p.id}>{p.name || p.species}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label htmlFor="product_id" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)' }}>Producto Utilizado (Opcional)</label>
                <select 
                  id="product_id" 
                  name="product_id"
                  defaultValue={event.product_id || ''} 
                  style={{
                    padding: '15px', backgroundColor: 'var(--color-pure-canvas)', border: '1px solid var(--color-mist)',
                    borderRadius: '0', fontFamily: 'inherit', fontSize: '16px', outline: 'none'
                  }}
                >
                  <option value="">Ninguno / No aplica</option>
                  {products?.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label htmlFor="notes" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)' }}>Notas adicionales</label>
                <p style={{ margin: '-4px 0 0 0', fontSize: '11px', color: 'var(--color-slate-smoke)' }}>
                  Escribe solo tus notas: si es un aviso programado, sigue siéndolo aunque aquí no lo veas.
                </p>
                <textarea 
                  id="notes" 
                  name="notes" 
                  rows={3}
                  defaultValue={(event.notes || '').replace(/\[(PROGRAMADO|POSPUESTO|HECHO|FIN)\]/g, '').trim()}
                  placeholder="Ej: Apliqué aceite de neem en el envés de las hojas porque vi algo de mosca blanca..."
                  style={{
                    padding: '15px', backgroundColor: 'var(--color-pure-canvas)', border: '1px solid var(--color-mist)',
                    borderRadius: '0', fontFamily: 'inherit', fontSize: '16px', outline: 'none', resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ marginTop: '10px', display: 'flex', gap: '15px' }}>
                <button type="submit" className="btn-solid" style={{ flex: 1 }}>
                  GUARDAR CAMBIOS
                </button>
              </div>

            </form>
            
            <form action={deleteEventWithId} style={{ marginTop: '15px' }}>
              <DeleteEventButton />
            </form>

          </div>
        </div>
      </section>
    </main>
  );
}
