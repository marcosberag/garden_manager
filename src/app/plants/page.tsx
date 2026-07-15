import React from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import PlantActions from './PlantActions';

export default async function PlantsPage() {
  const supabase = await createClient();
  const { data: plants } = await supabase
    .from('plants')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <main className="container" style={{ paddingTop: '120px', paddingBottom: '120px' }}>
      
      <section className="section">
        <div style={{ display: 'flex', gap: '45px', alignItems: 'flex-start' }}>
          <div style={{ flex: '0 0 auto', paddingTop: '15px' }}>
            <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)' }}>
              colección
            </span>
          </div>
          
          <div style={{ flex: '1' }}>
            <h1 className="heading-text suisse" style={{ color: 'var(--color-ink-black)', marginBottom: '30px' }}>
              tus plantas.
            </h1>
            <p className="body-text">
              El listado completo de las plantas que has registrado en tu jardín. Aquí puedes gestionarlas rápidamente sin tener que buscarlas en el mapa.
            </p>
            
            <div style={{ marginTop: '75px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '30px' }}>
              {plants?.map(plant => (
                <div key={plant.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontSize: '24px', marginRight: '10px' }}>{plant.icon_emoji || '🌱'}</span>
                    <span style={{ fontSize: '12px', color: 'var(--color-eucalyptus)', textTransform: 'uppercase', letterSpacing: '1px' }}>{plant.species || 'Especie Desconocida'}</span>
                    <h3 className="suisse" style={{ fontSize: '24px', margin: '15px 0' }}>{plant.name || plant.species}</h3>
                    {plant.location && <p className="body-text" style={{ fontSize: '14px', marginBottom: '5px' }}><strong>📍 Ubicación:</strong> {plant.location}</p>}
                    {plant.description && <p className="body-text" style={{ fontSize: '14px' }}>{plant.description}</p>}
                  </div>
                  <hr className="hairline graphite" style={{ margin: '23px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Link href={`/plants/${plant.id}`} className="btn-ghost" style={{ padding: '8px 15px', fontSize: '12px', textDecoration: 'none' }}>
                      VER FICHA <span>&rarr;</span>
                    </Link>
                    <PlantActions id={plant.id} />
                  </div>
                </div>
              ))}

              {(!plants || plants.length === 0) && (
                <p className="body-text" style={{ gridColumn: '1 / -1' }}>Aún no tienes plantas registradas.</p>
              )}
            </div>
            
            <div style={{ marginTop: '75px' }}>
              <Link href="/plants/new" className="btn-ghost" style={{ borderColor: 'var(--color-ink-black)', display: 'inline-block', textDecoration: 'none' }}>
                AÑADIR PLANTA <span>&rarr;&rarr;</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

    </main>
  );
}
