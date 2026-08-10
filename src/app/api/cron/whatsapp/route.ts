import { NextResponse, type NextRequest } from 'next/server';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { createClient as createStandardClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const serverSupabase = await createServerClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    let supabase;
    if (user) {
      // Si el usuario lo ejecuta manualmente desde el navegador, usamos sus cookies
      supabase = serverSupabase;
    } else {
      // Si lo ejecuta un servidor externo (Cron) a las 8AM, no hay cookies. Necesitamos la clave maestra.
      // Como esa clave se salta las RLS, exigimos el CRON_SECRET que Vercel envía
      // automáticamente en la cabecera Authorization al invocar el cron.
      const cronSecret = process.env.CRON_SECRET;
      if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
      }

      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceKey) {
        return NextResponse.json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY en .env.local para ejecuciones automáticas' }, { status: 401 });
      }
      supabase = createStandardClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);
    }

    const { data: events, error } = await supabase.from('events').select(`
      id,
      type,
      date,
      notes,
      products ( name ),
      plants ( name )
    `);

    if (error) throw error;

    const getLocalDateString = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    
    const todayObj = new Date();
    todayObj.setHours(0,0,0,0);
    const todayStr = getLocalDateString(todayObj);
    
    const tomorrowObj = new Date(todayObj);
    tomorrowObj.setDate(tomorrowObj.getDate() + 1);
    const tomorrowStr = getLocalDateString(tomorrowObj);

    let msgLines: string[] = [];

    // Pending real events in the future (including today)
    const pendingEvents = events?.filter(e => (!e.notes || !e.notes.includes('[PROGRAMADO]')) && (!e.notes || !e.notes.includes('[HECHO]')) && e.date >= todayStr) || [];
    // Programmed events
    const programmedEvents = events?.filter(e => e.notes?.includes('[PROGRAMADO]') && (!e.notes || !e.notes.includes('[HECHO]'))) || [];

    const allPending = [...pendingEvents, ...programmedEvents];

    // Anything <= today is urgent or due today
    const todayEvents = allPending.filter(e => e.date <= todayStr);
    const tomorrowEvents = allPending.filter(e => e.date === tomorrowStr);

    if (todayEvents.length > 0) {
      const normalToday = todayEvents.filter(e => !e.notes?.includes('[POSPUESTO]'));
      const postponedToday = todayEvents.filter(e => e.notes?.includes('[POSPUESTO]'));
      
      if (normalToday.length > 0) {
        msgLines.push(`🚨 *Hoy hay que fumigar:*`);
        normalToday.forEach(e => {
          const product = (e.products as any)?.name || e.type;
          const plant = (e.plants as any)?.name || 'General';
          msgLines.push(`- ${product} en ${plant}`);
        });
        msgLines.push('');
      }
      
      if (postponedToday.length > 0) {
        msgLines.push(`🚨 *Fumigación pospuesta - Hoy hay que fumigar:*`);
        postponedToday.forEach(e => {
          const product = (e.products as any)?.name || e.type;
          const plant = (e.plants as any)?.name || 'General';
          msgLines.push(`- ${product} en ${plant}`);
        });
        msgLines.push('');
      }
    }

    if (tomorrowEvents.length > 0) {
      const normalTomorrow = tomorrowEvents.filter(e => !e.notes?.includes('[POSPUESTO]'));
      const postponedTomorrow = tomorrowEvents.filter(e => e.notes?.includes('[POSPUESTO]'));

      if (normalTomorrow.length > 0) {
        msgLines.push(`⚠️ *Mañana hay que fumigar:*`);
        normalTomorrow.forEach(e => {
          const product = (e.products as any)?.name || e.type;
          const plant = (e.plants as any)?.name || 'General';
          msgLines.push(`- ${product} en ${plant}`);
        });
        msgLines.push('');
      }
      
      if (postponedTomorrow.length > 0) {
        msgLines.push(`⚠️ *Fumigación pospuesta - Mañana hay que fumigar:*`);
        postponedTomorrow.forEach(e => {
          const product = (e.products as any)?.name || e.type;
          const plant = (e.plants as any)?.name || 'General';
          msgLines.push(`- ${product} en ${plant}`);
        });
        msgLines.push('');
      }
    }

    if (msgLines.length === 0) {
      return NextResponse.json({ 
        message: 'No hay notificaciones para hoy o mañana.',
        debugInfo: {
          todayStr,
          tomorrowStr,
          totalEvents: events?.length || 0,
          programmedEvents: programmedEvents.length,
          pendingEvents: pendingEvents.length,
          todayEvents: todayEvents.length,
          tomorrowEvents: tomorrowEvents.length,
          allPendingIds: allPending.map(e => e.id)
        }
      });
    }

    const finalMessage = `🌿 *Garden Manager*\n\n${msgLines.join('\n')}`.trim();

    // Obtener los contactos de notificación de la base de datos
    const { data: contacts, error: contactsError } = await supabase.from('notification_contacts').select('phone_number, api_key');
    if (contactsError) throw contactsError;

    if (!contacts || contacts.length === 0) {
      return NextResponse.json({ message: 'No hay contactos de WhatsApp configurados en Ajustes.' });
    }

    const messagesSent = [];
    for (const contact of contacts) {
      if (contact.phone_number && contact.api_key) {
        const text = encodeURIComponent(finalMessage);
        const cleanPhone = contact.phone_number.replace(/[^\d+]/g, '');
        const encodedPhone = encodeURIComponent(cleanPhone);
        const url = `https://api.callmebot.com/whatsapp.php?phone=${encodedPhone}&text=${text}&apikey=${contact.api_key}`;
        
        try {
          const callMeBotRes = await fetch(url);
          const resultText = await callMeBotRes.text();
          if (callMeBotRes.ok && !resultText.toLowerCase().includes('error') && !resultText.toLowerCase().includes('invalid')) {
            messagesSent.push(`callmebot_${cleanPhone}`);
          } else {
            console.error(`Error CallMeBot para ${cleanPhone}:`, resultText);
          }
        } catch (e) {
          console.error(`Fetch error para ${cleanPhone}:`, e);
        }
      }
    }

    return NextResponse.json({ success: true, messagesSent });

  } catch (error: any) {
    console.error('Error al enviar WhatsApp:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
