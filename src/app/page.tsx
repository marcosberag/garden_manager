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
    <main className="home-shell">
      {/* Mapa: el gemelo de la parcela */}
      <div className="home-map">
        <MapWrapper plants={plants || []} initialParcel={parcel?.geojson ? JSON.parse(parcel.geojson) : null} />
        <Link
          href="/recorrido"
          className="chip-btn chip-btn--primary"
          style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 1000, boxShadow: '0 2px 8px rgba(9,53,46,0.25)' }}
        >
          ◉ Recorrido
        </Link>
      </div>

      {/* Panel de agenda */}
      {user && (
        <div className="home-panel">
          <div className="home-panel-head">
            <h3 className="home-panel-title">[ Agenda y registro ]</h3>
            <div style={{ display: 'flex', gap: '6px' }}>
              <RecalcularPautasButton />
              <ClearEventsButton />
              <Link href="/calendar/new" className="chip-btn chip-btn--primary">+ Añadir</Link>
            </div>
          </div>
          <div className="home-panel-body">
            <Suspense fallback={<p style={{ fontSize: '12px', color: 'var(--color-slate-smoke)', textAlign: 'center' }}>Cargando calendario...</p>}>
              <SmartCalendar />
            </Suspense>
          </div>
        </div>
      )}
    </main>
  );
}
