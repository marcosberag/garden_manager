import React from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import NewEventForm from './NewEventForm';

export default async function NewEventPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch plants and products for the dropdowns
  const { data: plants } = await supabase.from('plants').select('id, name, species').eq('user_id', user.id);
  const { data: products } = await supabase.from('products').select('id, name, type, frequency_days').eq('user_id', user.id);

  const today = new Date().toISOString().split('T')[0];

  return (
    <main className="container" style={{ paddingTop: '120px', paddingBottom: '120px' }}>
      <section className="section">
        <div style={{ display: 'flex', gap: '45px', alignItems: 'flex-start' }}>
          <div style={{ flex: '0 0 auto', paddingTop: '15px' }}>
            <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)' }}>
              calendario
            </span>
          </div>

          <div style={{ flex: '1', maxWidth: '600px' }}>
            <Link href="/" style={{ display: 'inline-block', marginBottom: '20px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--color-graphite)', textDecoration: 'none' }}>
              &larr; Inicio
            </Link>

            <h1 className="heading-text suisse" style={{ color: 'var(--color-ink-black)', marginBottom: '30px' }}>
              registrar<br/>
              tratamiento.
            </h1>

            <NewEventForm plants={plants || []} products={products || []} today={today} />
          </div>
        </div>
      </section>
    </main>
  );
}
