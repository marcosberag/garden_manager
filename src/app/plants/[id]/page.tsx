import React from 'react';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import PlantFormClient from '../PlantFormClient';
import MarkCuredButton from './MarkCuredButton';
import DiagnosticoPlanta from './DiagnosticoPlanta';

export default async function PlantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: plant } = await supabase
    .from('plants')
    .select('*')
    .eq('id', id)
    .single();

  if (!plant) {
    return (
      <main className="container" style={{ paddingTop: '120px' }}>
        <h2>Planta no encontrada</h2>
      </main>
    );
  }

  // Cargar historial y futuras sugerencias
  const { data: events } = await supabase
    .from('events')
    .select('*, products(name)')
    .eq('plant_id', id)
    .order('date', { ascending: false });

  const todayStr = new Date().toISOString().split('T')[0];
  
  const pastEvents = events?.filter(e => e.date <= todayStr && !e.notes?.includes('[PROGRAMADO]')) || [];
  const futureEvents = events?.filter(e => e.date > todayStr || e.notes?.includes('[PROGRAMADO]')).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) || [];

  return (
    <main className="container" style={{ paddingTop: '120px', paddingBottom: '120px' }}>
      <Link href="/" style={{ display: 'inline-block', marginBottom: '20px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)', textDecoration: 'none' }}>
        &larr; Inicio
      </Link>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '40px', alignItems: 'flex-start' }}>

        {/* COLUMNA IZQUIERDA: Ficha y Edición */}
        <div>
          <PlantFormClient initialData={plant} isEdit={true} />
        </div>

        {/* COLUMNA DERECHA: Diagnóstico y Calendario Específico */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '24px' }}>
            <h2 className="suisse" style={{ fontSize: '20px', margin: 0 }}>Tratamientos</h2>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <MarkCuredButton plantId={id} />
              <Link href={`/calendar/new?plant_id=${plant.id}`} className="chip-btn" style={{ textDecoration: 'none' }}>
                + Registrar hoy
              </Link>
            </div>
          </div>

          <DiagnosticoPlanta plantId={id} />

          {/* Próximas Tareas de esta planta */}
          <div style={{ marginBottom: '40px' }}>
            <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)', marginBottom: '15px' }}>
              Recomendado próximamente
            </h3>
            
            {futureEvents.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {futureEvents.map((rec: any, idx: number) => {
                  const isUrgent = rec.date <= todayStr;
                  return (
                    <div key={idx} style={{
                      backgroundColor: 'white', padding: '15px', border: '1px solid var(--color-lichen)', borderRadius: '12px',
                      borderLeft: `3px solid ${isUrgent ? 'var(--color-alert)' : 'var(--color-muted-sage)'}`
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{rec.products?.name ? rec.products.name : rec.type}</span>
                        <span style={{ fontSize: '14px', color: isUrgent ? 'var(--color-alert)' : 'var(--color-ink-black)', fontWeight: 'bold' }}>{rec.date}</span>
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--color-graphite)', margin: 0 }}>{rec.notes}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="body-text" style={{ fontSize: '14px' }}>Todo al día. No hay tratamientos urgentes.</p>
            )}
          </div>

          {/* Historial de esta planta */}
          <div>
            <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)', marginBottom: '15px' }}>
              Historial Realizado
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {pastEvents?.map(event => (
                <div key={event.id} style={{ backgroundColor: 'white', padding: '15px', border: '1px solid var(--color-lichen)', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{event.products?.name ? event.products.name : event.type}</span>
                    <span style={{ fontSize: '13px', color: 'var(--color-graphite)' }}>{event.date}</span>
                  </div>
                  {event.notes && (
                    <p style={{ fontSize: '12px', margin: 0, color: 'var(--color-graphite)' }}>"{event.notes}"</p>
                  )}
                </div>
              ))}

              {(!pastEvents || pastEvents.length === 0) && (
                <p className="body-text" style={{ fontSize: '14px' }}>No hay tratamientos registrados aún.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
