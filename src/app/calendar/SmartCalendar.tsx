import React from 'react';
import { createClient } from '@/utils/supabase/server';
import CalendarViewToggle from './CalendarViewToggle';

const CAMPOS = '*, plants(name, species), products(name)';

export default async function SmartCalendar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Dos consultas, y no una: pidiendo «los 50 de fecha más alta» los avisos
  // futuros llenaban la ventana y un tratamiento atrasado se quedaba fuera —
  // no aparecía ni como atrasado ni en el historial. Los pendientes se traen
  // aparte para que ninguno pueda perderse, por viejo que sea.
  const [{ data: pendientes }, { data: recientes }] = await Promise.all([
    supabase.from('events').select(CAMPOS)
      .ilike('notes', '%[PROGRAMADO]%')
      .not('notes', 'ilike', '%[HECHO]%')
      .order('date', { ascending: true })
      .limit(120),
    supabase.from('events').select(CAMPOS)
      .order('date', { ascending: false })
      .limit(60),
  ]);

  type Fila = NonNullable<typeof recientes>[number];
  const porId = new Map<string, Fila>();
  for (const e of [...(pendientes || []), ...(recientes || [])]) {
    porId.set(e.id, e);
  }

  return <CalendarViewToggle events={[...porId.values()]} />;
}
