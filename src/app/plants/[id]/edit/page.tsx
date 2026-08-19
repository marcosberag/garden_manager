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
        <div className="labeled-section">
          <div className="labeled-section-tag">
            <span className="field-label">
              mi jardín
            </span>
          </div>
          <PlantFormClient initialData={plant} isEdit={true} />
        </div>
      </section>
    </main>
  );
}
