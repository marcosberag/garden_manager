import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { phone, apikey } = await request.json();

    if (!phone || !apikey) {
      return NextResponse.json({ error: 'Falta número de teléfono o API Key' }, { status: 400 });
    }

    const text = encodeURIComponent('🌱 ¡Hola! Soy Brotes. Tu sistema de gestión de jardín está conectado con CallMeBot y listo para avisarte de futuras fumigaciones. ¡Tu jardín está en buenas manos!');
    
    // Limpiamos el número para quedarnos con los números y el signo + 
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    const encodedPhone = encodeURIComponent(cleanPhone);
    const url = `https://api.callmebot.com/whatsapp.php?phone=${encodedPhone}&text=${text}&apikey=${apikey}`;

    const callMeBotRes = await fetch(url);
    const resultText = await callMeBotRes.text();

    if (callMeBotRes.ok && !resultText.toLowerCase().includes('error') && !resultText.toLowerCase().includes('invalid')) {
      return NextResponse.json({ success: true, messageSid: 'callmebot_success' });
    } else {
      console.error('Error CallMeBot:', resultText);
      // Extraemos el texto de error si es posible
      const errorMsgMatch = resultText.match(/<b>(.*?)<\/b>/) || resultText.match(/<p style="color:red">(.*?)<\/p>/);
      const errorMsg = errorMsgMatch ? errorMsgMatch[1] : 'Error en la API Key o configuración';
      
      return NextResponse.json({ error: `CallMeBot: ${errorMsg}` }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Error enviando WhatsApp:', error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}
