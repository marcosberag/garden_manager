import React from 'react';
import { createClient } from '@/utils/supabase/server';
import MapWrapper from '@/components/MapWrapper';
import Link from 'next/link';
import { Suspense } from 'react';
import SmartCalendar from '@/app/calendar/SmartCalendar';
import ChatWidget from '@/components/ChatWidget';
import ClearEventsButton from './ClearEventsButton';
import RecalcularPautasButton from './RecalcularPautasButton';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="container" style={{ paddingTop: '120px', textAlign: 'center' }}>
        <h2 className="suisse" style={{ marginBottom: '20px' }}>Bienvenido a Brotes</h2>
        <p className="body-text" style={{ marginBottom: '30px' }}>Debes iniciar sesión para acceder a tu jardín interactivo.</p>
        <Link href="/login" className="btn-solid" style={{ textDecoration: 'none' }}>Acceder o Registrarse</Link>
      </main>
    );
  }

  // Obtenemos todos los datos de las plantas para mostrarlos en el popup
  const { data: plants } = await supabase
    .from('plants')
    .select('*')
    .eq('user_id', user.id);

  const { data: parcel } = await supabase
    .from('parcels')
    .select('geojson')
    .eq('user_id', user.id)
    .single();

  return (
    <main style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, backgroundColor: 'var(--color-pure-canvas)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, paddingTop: '85px', display: 'flex', overflow: 'hidden' }}>
        
        {/* COLUMNA IZQUIERDA: Mapa */}
        <div style={{ flex: '1 1 65%', position: 'relative' }}>
          <MapWrapper plants={plants || []} initialParcel={parcel?.geojson ? JSON.parse(parcel.geojson) : null} />
        </div>

        {/* COLUMNA DERECHA: Panel de Control (Calendario y Chat) */}
        {user && (
          <div style={{ 
            flex: '0 0 400px', 
            backgroundColor: 'white', 
            borderLeft: '1px solid var(--color-mist)',
            display: 'flex', 
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '-4px 0 15px rgba(0,0,0,0.03)'
          }}>
            {/* Calendario (Ocupa todo el alto ahora) */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '15px 20px', backgroundColor: 'var(--color-ink-black)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>Agenda y Registro</h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <RecalcularPautasButton />
                  <ClearEventsButton />
                  <Link href="/calendar/new" style={{ color: 'var(--color-ink-black)', backgroundColor: 'white', textDecoration: 'none', fontSize: '11px', fontWeight: 'bold', padding: '5px 10px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}>+ AÑADIR</Link>
                </div>
              </div>
              <div style={{ padding: '15px', overflowY: 'auto', flex: 1 }}>
                <Suspense fallback={<p style={{ fontSize: '12px', color: '#666', textAlign: 'center' }}>Cargando calendario...</p>}>
                  <SmartCalendar />
                </Suspense>
              </div>
            </div>

          </div>
        )}
      </div>
    </main>
  );
}
