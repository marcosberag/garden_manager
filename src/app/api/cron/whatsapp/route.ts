import { NextResponse, type NextRequest } from 'next/server';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { createClient as createStandardClient } from '@supabase/supabase-js';
import { enviarWhatsApp } from '@/lib/callmebot';

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
      const esCronDeVercel = request.headers.get('user-agent')?.includes('vercel-cron') ?? false;

      // Falta de configuración, no de credenciales: si respondiéramos 401 el cron
      // fallaría en silencio y sería indistinguible de una petición no autorizada.
      if (!cronSecret) {
        console.error('[cron/whatsapp] CRON_SECRET no está definido en este despliegue, imposible autenticar el cron.', { esCronDeVercel });
        return NextResponse.json(
          { error: 'Falta CRON_SECRET en las variables de entorno del proyecto. Añádela en Vercel (Settings → Environment Variables) y vuelve a desplegar.' },
          { status: 500 }
        );
      }

      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${cronSecret}`) {
        console.error('[cron/whatsapp] Petición sin sesión con Authorization inválido.', { esCronDeVercel, traeCabecera: Boolean(authHeader) });
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
      }

      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceKey) {
        console.error('[cron/whatsapp] Falta SUPABASE_SERVICE_ROLE_KEY en este despliegue.');
        return NextResponse.json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno para ejecuciones automáticas' }, { status: 500 });
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
    const sendErrors = [];
    for (const contact of contacts) {
      if (contact.phone_number && contact.api_key) {
        try {
          const { ok, respuesta } = await enviarWhatsApp(contact.phone_number, contact.api_key, finalMessage);
          if (ok) {
            messagesSent.push(contact.phone_number);
          } else {
            console.error(`Error CallMeBot para ${contact.phone_number}:`, respuesta);
            sendErrors.push(`${contact.phone_number}: ${respuesta}`);
          }
        } catch (e: any) {
          console.error(`Fetch error para ${contact.phone_number}:`, e);
          sendErrors.push(`${contact.phone_number}: ${e.message}`);
        }
      }
    }

    // Si había que avisar y no salió ni un mensaje, el cron tiene que fallar de
    // forma visible en los logs en vez de responder 200 como si todo hubiera ido bien.
    if (messagesSent.length === 0) {
      return NextResponse.json({ error: 'No se pudo enviar ningún WhatsApp', sendErrors }, { status: 502 });
    }

    return NextResponse.json({ success: true, messagesSent, sendErrors });

  } catch (error: any) {
    console.error('Error al enviar WhatsApp:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
