import React from 'react';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import PlantFormClient from '../../PlantFormClient';

export default async function EditPlantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

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

  return (
    <main className="container" style={{ paddingTop: '120px', paddingBottom: '120px' }}>
      <section className="section">
        <div style={{ display: 'flex', gap: '45px', alignItems: 'flex-start' }}>
          <div style={{ flex: '0 0 auto', paddingTop: '15px' }}>
            <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-eucalyptus)' }}>
              mi jardín
            </span>
          </div>
          <PlantFormClient initialData={plant} isEdit={true} />
        </div>
      </section>
    </main>
  );
}
