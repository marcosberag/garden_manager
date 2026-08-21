import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { estadoDeEvento, hoyEnEspana } from '@/lib/estado-evento';

/**
 * Radiografía de la agenda, pensada para poder pegarla en una conversación sin
 * regalar nada: los contactos salen contados, no listados. Antes esta ruta
 * devolvía los teléfonos y las API keys de CallMeBot en claro.
 */
export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No has iniciado sesión' }, { status: 401 });
  }

  const hoy = hoyEnEspana();

  const { data: events, error } = await supabase
    .from('events')
    .select('id, type, date, notes, frequency_days, plants(name), products(name)')
    .order('date', { ascending: true });

  if (error) return NextResponse.json({ error: error.message });

  const { count: contactos } = await supabase
    .from('notification_contacts')
    .select('id', { count: 'exact', head: true });

  type Fila = NonNullable<typeof events>[number];
  const linea = (e: Fila) => ({
    fecha: e.date,
    estado: estadoDeEvento(e.notes, e.date, hoy),
    que: (e.products as unknown as { name: string } | null)?.name || e.type,
    donde: (e.plants as unknown as { name: string } | null)?.name || null,
    cada: e.frequency_days || null,
    etiquetas: (e.notes || '').match(/\[[A-Z]+\]/g) || [],
  });

  const filas = (events || []).map(linea);
  const cuenta = (estado: string) => filas.filter(f => f.estado === estado).length;

  return NextResponse.json({
    hoy,
    total: filas.length,
    resumen: {
      atrasados: cuenta('atrasado'),
      hoy: cuenta('hoy'),
      futuros: cuenta('futuro'),
      hechos: cuenta('hecho'),
      contactos_whatsapp: contactos ?? 0,
    },
    // Lo que de verdad importa mirar: lo vivo y lo recién pasado.
    atrasados: filas.filter(f => f.estado === 'atrasado'),
    proximos: filas.filter(f => f.estado === 'hoy' || f.estado === 'futuro').slice(0, 15),
    ultimos_hechos: filas.filter(f => f.estado === 'hecho').slice(-8),
  });
}
