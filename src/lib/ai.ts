import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { APICallError } from 'ai';

// Un único cliente y un único modelo para toda la app. Antes cada ruta creaba el
// suyo y apuntaba a un modelo distinto (1.5, 2.5 y 3.5 conviviendo), y la
// identificación de plantas por foto llevaba tiempo rota porque gemini-1.5-flash
// ya no está disponible en la cuenta.
export const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY,
});

export const MODELO = 'gemini-3.5-flash';

// El plan gratuito de Google da 20 peticiones al día POR MODELO
// (GenerateRequestsPerDayPerProjectPerModel-FreeTier). Un solo recorrido con la
// cámara se las come, así que cuando el modelo bueno dice 429 se sigue con este,
// que tiene su propio cupo: pierde algo de finura, pero responde.
export const MODELO_RESPALDO = 'gemini-3.5-flash-lite';

type ModeloLenguaje = ReturnType<typeof google>;

// Tras un 429 se deja de molestar al principal un rato: si la cuota agotada es
// la diaria, reintentar en cada llamada solo añade espera. Pasado el plazo se
// vuelve a probar, por si era un tope por minuto o ya ha reiniciado el día.
const ESPERA_TRAS_AGOTARSE = 10 * 60 * 1000;
let principalAgotadoHasta = 0;

const sinCuota = (e: unknown) => APICallError.isInstance(e) && e.statusCode === 429;

/**
 * Envuelve dos modelos en uno: intenta con el principal y, si Google responde
 * que no queda cuota, repite la misma llamada con el de respaldo. Así ninguna
 * pantalla se queda con un «no he podido» por haber gastado el cupo diario.
 */
function conRespaldo(principal: ModeloLenguaje, respaldo: ModeloLenguaje): ModeloLenguaje {
  const intentar = async <T>(llamar: (m: ModeloLenguaje) => PromiseLike<T>): Promise<T> => {
    if (Date.now() < principalAgotadoHasta) {
      return llamar(respaldo);
    }
    try {
      return await llamar(principal);
    } catch (e) {
      if (!sinCuota(e)) throw e;
      principalAgotadoHasta = Date.now() + ESPERA_TRAS_AGOTARSE;
      console.warn(`[ai] ${principal.modelId} sin cuota, se responde con ${respaldo.modelId}.`);
      return llamar(respaldo);
    }
  };

  return {
    specificationVersion: principal.specificationVersion,
    provider: principal.provider,
    modelId: principal.modelId,
    supportedUrls: principal.supportedUrls,
    doGenerate: opciones => intentar(m => m.doGenerate(opciones)),
    doStream: opciones => intentar(m => m.doStream(opciones)),
  };
}

export const modelo = () => conRespaldo(google(MODELO), google(MODELO_RESPALDO));
