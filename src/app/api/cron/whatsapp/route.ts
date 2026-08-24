import { NextResponse, type NextRequest } from 'next/server';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { createClient as createStandardClient, type SupabaseClient } from '@supabase/supabase-js';
import { enviarWhatsApp } from '@/lib/callmebot';
import { parteNocturnoFumigacion, centroDeGeojson } from '@/lib/meteo';
import { hoyEnEspana } from '@/lib/estado-evento';

export const dynamic = 'force-dynamic';

type EventoCron = {
  id: string;
  user_id: string;
  type: string;
  date: string;
  notes: string | null;
  products: { name: string } | null;
  plants: { name: string } | null;
};

type ContactoCron = {
  user_id: string;
  phone_number: string | null;
  api_key: string | null;
};

/** Día siguiente de una fecha AAAA-MM-DD, sin tocar zonas horarias. */
function diaSiguiente(fecha: string): string {
  const [a, m, d] = fecha.split('-').map(Number);
  const obj = new Date(a, m - 1, d + 1);
  return `${obj.getFullYear()}-${String(obj.getMonth() + 1).padStart(2, '0')}-${String(obj.getDate()).padStart(2, '0')}`;
}

/**
 * El mensaje diario de un jardín: qué toca hoy (o va con retraso), qué toca
 * mañana, y el parte de la noche si hay algo que aplicar. Devuelve null si ese
 * jardín no tiene nada que contar.
 */
async function mensajeDelJardin(
  supabase: SupabaseClient,
  jardin: string,
  eventos: EventoCron[],
  hoy: string,
  manana: string,
): Promise<string | null> {
  const lineas: string[] = [];
  // Condición de parada que llevan los avisos en las notas ("Revisar hasta:
  // mientras haya síntomas."). Si aparece, el mensaje la enseña y pregunta.
  const revisarDe = (e: EventoCron) => e.notes?.match(/Revisar hasta: (.+?)\.(?:\s|$)/)?.[1] || null;
  let hayCondiciones = false;

  const cerrado = (e: EventoCron) => e.notes?.includes('[HECHO]') || e.notes?.includes('[FIN]');
  const pendientes = eventos.filter(e => !cerrado(e) && (e.notes?.includes('[PROGRAMADO]') || e.date >= hoy));

  const deHoy = pendientes.filter(e => e.date <= hoy);
  const deManana = pendientes.filter(e => e.date === manana);

  const seccion = (titulo: string, lista: EventoCron[]) => {
    if (lista.length === 0) return;
    lineas.push(titulo);
    for (const e of lista) {
      const producto = e.products?.name || e.type;
      const planta = e.plants?.name || 'General';
      const revisar = revisarDe(e);
      if (revisar) hayCondiciones = true;
      lineas.push(`- ${producto} en ${planta}${revisar ? ` (hasta: ${revisar})` : ''}`);
    }
    lineas.push('');
  };

  seccion('🚨 *Hoy hay que fumigar:*', deHoy.filter(e => !e.notes?.includes('[POSPUESTO]')));
  seccion('🚨 *Fumigación pospuesta - Hoy hay que fumigar:*', deHoy.filter(e => e.notes?.includes('[POSPUESTO]')));
  seccion('⚠️ *Mañana hay que fumigar:*', deManana.filter(e => !e.notes?.includes('[POSPUESTO]')));
  seccion('⚠️ *Fumigación pospuesta - Mañana hay que fumigar:*', deManana.filter(e => e.notes?.includes('[POSPUESTO]')));

  // El parte de la noche: aquí se fumiga de noche, así que lo que decide es
  // la lluvia y el viento de esta noche y la madrugada, no el sol de mediodía.
  if (deHoy.length > 0 || deManana.length > 0) {
    try {
      const { data: parcelas } = await supabase.from('parcels').select('geojson').eq('user_id', jardin).limit(1);
      let coords = centroDeGeojson(parcelas?.[0]?.geojson);
      if (!coords) {
        const { data: conPos } = await supabase.from('plants').select('lat, lng').eq('user_id', jardin).not('lat', 'is', null).limit(1);
        if (conPos?.[0]?.lat != null) coords = { lat: conPos[0].lat, lng: conPos[0].lng };
      }
      if (coords) {
        const parte = await parteNocturnoFumigacion(coords.lat, coords.lng);
        if (parte) {
          lineas.push(parte.resumen);
          lineas.push('');
        }
      }
    } catch (e) {
      console.error('[cron/whatsapp] Parte meteorológico no disponible:', e);
    }
  }

  if (hayCondiciones) {
    lineas.push('🔎 ¿Siguen los síntomas? Si alguna condición de arriba ya se cumplió, da por terminado ese tratamiento desde la app y dejará de avisar.');
  }

  if (lineas.length === 0) return null;
  return `🌿 *Brotes*\n\n${lineas.join('\n')}`.trim();
}

export async function GET(request: NextRequest) {
  try {
    const serverSupabase = await createServerClient();
    const { data: { user } } = await serverSupabase.auth.getUser();

    let supabase: SupabaseClient;
    if (user) {
      // Si el usuario lo ejecuta manualmente desde el navegador, usamos sus cookies
      supabase = serverSupabase;
    } else {
      // Si lo ejecuta un servidor externo (Cron), no hay cookies. Necesitamos la clave maestra.
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

    const { data, error } = await supabase.from('events').select(`
      id,
      user_id,
      type,
      date,
      notes,
      products ( name ),
      plants ( name )
    `);
    if (error) throw error;
    const eventos = (data || []) as unknown as EventoCron[];

    // La fecha del jardín, no la del servidor: Vercel vive en UTC y en una
    // ejecución manual de madrugada iría un día por detrás.
    const hoy = hoyEnEspana();
    const manana = diaSiguiente(hoy);

    // Cada jardín recibe SU mensaje, y solo el suyo. Con la clave maestra el
    // cron ve las filas de todos los usuarios: mezclarlas en un único mensaje
    // enviado a todos los contactos era correcto con un solo jardín y un fallo
    // de privacidad con dos.
    const { data: contactosData, error: contactsError } = await supabase
      .from('notification_contacts')
      .select('user_id, phone_number, api_key');
    if (contactsError) throw contactsError;
    const contactos = (contactosData || []) as ContactoCron[];

    const jardines = [...new Set(eventos.map(e => e.user_id))];
    const messagesSent: string[] = [];
    const sendErrors: string[] = [];
    let mensajesCompuestos = 0;

    for (const jardin of jardines) {
      const mensaje = await mensajeDelJardin(supabase, jardin, eventos.filter(e => e.user_id === jardin), hoy, manana);
      if (!mensaje) continue;
      mensajesCompuestos += 1;

      const susContactos = contactos.filter(c => c.user_id === jardin && c.phone_number && c.api_key);
      for (const contacto of susContactos) {
        try {
          const { ok, respuesta } = await enviarWhatsApp(contacto.phone_number!, contacto.api_key!, mensaje);
          if (ok) {
            messagesSent.push(contacto.phone_number!);
          } else {
            console.error(`Error CallMeBot para ${contacto.phone_number}:`, respuesta);
            sendErrors.push(`${contacto.phone_number}: ${respuesta}`);
          }
        } catch (e) {
          console.error(`Fetch error para ${contacto.phone_number}:`, e);
          sendErrors.push(`${contacto.phone_number}: ${e instanceof Error ? e.message : 'error de red'}`);
        }
      }
    }

    if (mensajesCompuestos === 0) {
      return NextResponse.json({
        message: 'No hay notificaciones para hoy o mañana.',
        debugInfo: { hoy, manana, totalEventos: eventos.length, jardines: jardines.length },
      });
    }

    if (contactos.length === 0) {
      return NextResponse.json({ message: 'No hay contactos de WhatsApp configurados en Ajustes.' });
    }

    // Si había que avisar y no salió ni un mensaje, el cron tiene que fallar de
    // forma visible en los logs en vez de responder 200 como si todo hubiera ido bien.
    if (messagesSent.length === 0) {
      return NextResponse.json({ error: 'No se pudo enviar ningún WhatsApp', sendErrors }, { status: 502 });
    }

    return NextResponse.json({ success: true, messagesSent, sendErrors });

  } catch (error) {
    console.error('Error al enviar WhatsApp:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error inesperado' }, { status: 500 });
  }
}
