import React from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import NewEventForm from './NewEventForm';
import { jardinDe } from '@/lib/jardin';

export default async function NewEventPage({ searchParams }: {
  searchParams: Promise<{ plant_id?: string; product_id?: string; method?: string; notes?: string }>
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const jardin = await jardinDe(supabase, user);

  // Valores iniciales por URL: la ficha de planta y el diagnóstico por foto
  // encadenan aquí con planta, producto, modo y notas ya puestos.
  const sp = await searchParams;
  const metodoValido = ['foliar', 'raiz', 'suelo'].includes(sp?.method || '') ? sp.method : undefined;

  // Fetch plants and products for the dropdowns. El path y el tamaño de la
  // planta permiten calcular la dosis con los metros reales del mapa; la
  // descripción y la dosis del producto afinan pauta y caldo.
  const { data: plants } = await supabase.from('plants').select('id, name, species, path, size').eq('user_id', jardin.id);
  const { data: products } = await supabase.from('products').select('id, name, type, description, dosage, frequency_days').eq('user_id', jardin.id);

  const today = new Date().toISOString().split('T')[0];

  return (
    <main className="container" style={{ paddingTop: '120px', paddingBottom: '120px' }}>
      <section className="section">
        <div className="labeled-section">
          <div className="labeled-section-tag">
            <span className="field-label">
              calendario
            </span>
          </div>

          <div className="labeled-section-body" style={{ maxWidth: '600px' }}>
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
