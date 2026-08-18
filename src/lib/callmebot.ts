// CallMeBot contesta siempre con un 2xx y una página HTML suelta, también cuando
// falla (una API Key caducada devuelve 203). Ni el código de estado ni buscar las
// palabras "error"/"invalid" sirven para saber si el mensaje ha salido: cualquier
// otro fallo se colaba como envío correcto. Solo lo damos por bueno si CallMeBot
// lo confirma, y devolvemos su respuesta tal cual para verla en la UI y en los logs.
const CONFIRMACION = 'message queued';

export type EnvioWhatsApp = {
  ok: boolean;
  respuesta: string;
};

export async function enviarWhatsApp(phone: string, apikey: string, mensaje: string): Promise<EnvioWhatsApp> {
  const cleanPhone = phone.replace(/[^\d+]/g, '');
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(cleanPhone)}&text=${encodeURIComponent(mensaje)}&apikey=${encodeURIComponent(apikey)}`;

  const res = await fetch(url, { cache: 'no-store' });
  const html = await res.text();

  // El veredicto se decide sobre la respuesta entera; el recorte es solo para mostrarla.
  return {
    ok: limpiarHtml(html).toLowerCase().includes(CONFIRMACION),
    respuesta: ultimoParrafo(html),
  };
}

// La respuesta repite el destinatario y el texto enviado antes del veredicto,
// que siempre va en el último párrafo.
function ultimoParrafo(html: string) {
  const parrafos = html.split(/<p[^>]*>/i);
  return limpiarHtml(parrafos[parrafos.length - 1] || html);
}

function limpiarHtml(html: string) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}
