import React from 'react';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import RecorridoClient from './RecorridoClient';

// El recorrido con cámara: paseas por el jardín enfocando las plantas y la app
// las va identificando y colocando en la parcela.
export default async function RecorridoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: plants } = await supabase
    .from('plants')
    .select('id, name, species, lat, lng, path, image_url')
    .eq('user_id', user.id)
    .order('name');

  const { data: parcel } = await supabase
    .from('parcels')
    .select('geojson')
    .eq('user_id', user.id)
    .single();

  return (
    <RecorridoClient
      plantas={(plants || []).map(p => ({
        id: p.id,
        name: p.name,
        species: p.species,
        tienePosicion: p.lat != null || !!p.path,
        tieneFoto: !!p.image_url,
      }))}
      parcel={parcel?.geojson ? JSON.parse(parcel.geojson) : null}
    />
  );
}
