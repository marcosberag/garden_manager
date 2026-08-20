import React from 'react';
import { createClient } from '@/utils/supabase/server';
import MapWrapper from '@/components/MapWrapper';
import Link from 'next/link';
import { Suspense } from 'react';
import SmartCalendar from '@/app/calendar/SmartCalendar';
import Asistente from '@/components/Asistente';
import { resolverCategoria } from '@/lib/plant-icons-ai';
import { categoriaDeEspecie } from '@/lib/plant-icons';
import { fotoDeEspecie } from '@/lib/foto-especie';

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

  // Relleno perezoso de categorías: las plantas de antes del sistema de iconos
  // no tienen categoría (y alguna quedó guardada como "generica" por un fallo
  // puntual de la IA). Se cura aquí y queda guardado: las vacías con reglas +
  // IA; las "generica" solo con las reglas de texto, que son gratis.
  const porArreglar = (plants || []).filter(p => !p.icon_category || p.icon_category === 'generica').slice(0, 30);
  if (porArreglar.length > 0) {
    await Promise.all(porArreglar.map(async p => {
      const nueva = p.icon_category === 'generica'
        ? categoriaDeEspecie(p.species, p.name)
        : await resolverCategoria(p.species, p.name);
      if (nueva && nueva !== p.icon_category) {
        p.icon_category = nueva;
        await supabase.from('plants').update({ icon_category: nueva }).match({ id: p.id, user_id: user.id });
      }
    }));
  }

  // Pin con cara: si la planta aún no tiene foto real, el pin enseña una foto
  // de su especie (Wikipedia, cacheada un mes). La foto real, cuando llegue
  // del recorrido o de la ficha, manda sobre esta.
  await Promise.all((plants || []).filter(p => !p.image_url).map(async p => {
    p.species_image_url = await fotoDeEspecie(p.species, p.name);
  }));

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
          style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 1000, boxShadow: '0 2px 8px rgba(9,53,46,0.25)' }}
        >
          ◉ Recorrido
        </Link>
      </div>

      {/* Panel lateral: asistente + agenda */}
      {user && (
        <div className="home-panel">
          <Asistente />
          <div className="home-panel-head">
            <h3 className="home-panel-title">[ Agenda ]</h3>
            <Link href="/calendar/new" className="chip-btn chip-btn--primary">+ Añadir</Link>
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
