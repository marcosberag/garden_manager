import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { leerFrecuencia } from '@/lib/frecuencias';
import { jardinDe } from '@/lib/jardin';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return NextResponse.json({ error: 'Debes iniciar sesión para arreglar los eventos' });

  const jardin = await jardinDe(supabase, user);

  // 1. Get all events for the user
  const { data: events, error: fetchError } = await supabase.from('events').select('*').eq('user_id', jardin.id);
  if (fetchError) return NextResponse.json({ error: fetchError.message });
  
  const programmed = events.filter(e => e.notes && e.notes.includes('[PROGRAMADO]'));
  const roots = events.filter(e => !e.notes || !e.notes.includes('[PROGRAMADO]'));

  // Extract frequencies from the old programmed events before deleting them
  const frequencies: Record<string, { freq: number, notes: string }> = {}; 
  programmed.forEach(p => {
    const freq = leerFrecuencia(p);
    if (freq > 0) {
      const key = `${p.type}-${p.plant_id || 'null'}-${p.product_id || 'null'}`;
      frequencies[key] = {
        freq,
        notes: `[PROGRAMADO] Tarea programada cada ${freq} días.`
      };
    }
  });

  // Delete all old programmed events
  if (programmed.length > 0) {
    const { error: deleteError } = await supabase.from('events').delete().in('id', programmed.map(p => p.id));
    if (deleteError) return NextResponse.json({ error: deleteError.message });
  }

  const today = new Date();
  today.setHours(0,0,0,0);

  // Agrupar los roots por key y quedarnos solo con el más reciente
  const latestRoots: Record<string, any> = {};
  for (const root of roots) {
    const key = `${root.type}-${root.plant_id || 'null'}-${root.product_id || 'null'}`;
    if (!latestRoots[key] || new Date(root.date) > new Date(latestRoots[key].date)) {
      latestRoots[key] = root;
    }
  }

  let insertedCount = 0;

  // Re-generate them correctly solo para los roots más recientes
  for (const key of Object.keys(latestRoots)) {
    const root = latestRoots[key];
    const freqData = frequencies[key];
    
    if (freqData) {
      const frequency_days = freqData.freq;
      let nextDate = new Date(root.date);
      nextDate.setDate(nextDate.getDate() + frequency_days);
      
      if (nextDate < today) {
        nextDate = new Date(today);
      }
      
      const getLocalDateString = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      
      const futureEventsToInsert = [];
      for (let i = 0; i < 3; i++) {
        futureEventsToInsert.push({
          user_id: jardin.id,
          type: root.type,
          date: getLocalDateString(nextDate),
          notes: freqData.notes,
          frequency_days,
          plant_id: root.plant_id,
          product_id: root.product_id
        });
        nextDate.setDate(nextDate.getDate() + frequency_days);
      }
      
      if (futureEventsToInsert.length > 0) {
        const { error: insertError } = await supabase.from('events').insert(futureEventsToInsert);
        if (insertError) return NextResponse.json({ error: insertError.message });
        insertedCount += futureEventsToInsert.length;
      }
    }
  }

  return NextResponse.json({ 
    success: true, 
    message: 'Eventos arreglados exitosamente. Ya puedes volver a la app.',
    deleted: programmed.length,
    regenerated: insertedCount
  });
}
