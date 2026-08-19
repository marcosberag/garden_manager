import React from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import NewEventForm from './NewEventForm';

export default async function NewEventPage({ searchParams }: {
  searchParams: Promise<{ plant_id?: string; product_id?: string; method?: string; notes?: string }>
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Valores iniciales por URL: la ficha de planta y el diagnóstico por foto
  // encadenan aquí con planta, producto, modo y notas ya puestos.
  const sp = await searchParams;
  const metodoValido = ['foliar', 'raiz', 'suelo'].includes(sp?.method || '') ? sp.method : undefined;

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

            <NewEventForm
              plants={plants || []}
              products={products || []}
              today={today}
              defaults={{
                plantId: sp?.plant_id,
                productId: sp?.product_id,
                metodo: metodoValido,
                notas: sp?.notes?.slice(0, 500),
              }}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
