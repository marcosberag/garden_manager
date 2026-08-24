import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { enviarWhatsApp } from '@/lib/callmebot';

export async function POST(request: Request) {
  try {
    // Solo con sesión: sin esta guarda la ruta era un relé abierto de CallMeBot.
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { phone, apikey } = await request.json();

    if (!phone || !apikey) {
      return NextResponse.json({ error: 'Falta número de teléfono o API Key' }, { status: 400 });
    }

    const texto = '🌱 ¡Hola! Soy Brotes. Tu sistema de gestión de jardín está conectado con CallMeBot y listo para avisarte de futuras fumigaciones. ¡Tu jardín está en buenas manos!';
    const { ok, respuesta } = await enviarWhatsApp(phone, apikey, texto);

    if (!ok) {
      console.error('Error CallMeBot:', respuesta);
      return NextResponse.json({ error: `CallMeBot: ${respuesta}` }, { status: 502 });
    }

    return NextResponse.json({ success: true, respuesta });

  } catch (error) {
    console.error('Error enviando WhatsApp:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error interno' }, { status: 500 });
  }
}
