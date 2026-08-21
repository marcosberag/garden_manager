import React from 'react';
import { createClient } from '@/utils/supabase/server';
import CalendarViewToggle from './CalendarViewToggle';

const CAMPOS = '*, plants(name, species), products(name)';

const haceDias = (dias: number) => {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default async function SmartCalendar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Tres consultas, y no una: pidiendo «los 50 de fecha más alta» los avisos
  // futuros llenaban la ventana y un tratamiento atrasado se quedaba fuera —
  // no aparecía ni como atrasado ni en el historial.
  const [{ data: pendientes }, { data: ventana }, { data: recientes }] = await Promise.all([
    // Avisos vivos, por viejos que sean.
    supabase.from('events').select(CAMPOS)
      .ilike('notes', '%[PROGRAMADO]%')
      .not('notes', 'ilike', '%[HECHO]%')
      .order('date', { ascending: true })
      .limit(150),
    // Red de seguridad: todo lo de los últimos meses, lleve etiqueta o no. Un
    // aviso que perdió su marca al editarlo sigue llegando por aquí.
    supabase.from('events').select(CAMPOS)
      .gte('date', haceDias(150))
      .order('date', { ascending: true })
      .limit(250),
    // Historial más antiguo, para la lista de abajo.
    supabase.from('events').select(CAMPOS)
      .order('date', { ascending: false })
      .limit(60),
  ]);

  type Fila = NonNullable<typeof recientes>[number];
  const porId = new Map<string, Fila>();
  for (const e of [...(pendientes || []), ...(ventana || []), ...(recientes || [])]) {
    porId.set(e.id, e);
  }

  return <CalendarViewToggle events={[...porId.values()]} />;
}
