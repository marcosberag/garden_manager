import { createGoogleGenerativeAI } from '@ai-sdk/google';

// Un único cliente y un único modelo para toda la app. Antes cada ruta creaba el
// suyo y apuntaba a un modelo distinto (1.5, 2.5 y 3.5 conviviendo), y la
// identificación de plantas por foto llevaba tiempo rota porque gemini-1.5-flash
// ya no está disponible en la cuenta.
export const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY,
});

export const MODELO = 'gemini-3.5-flash';

export const modelo = () => google(MODELO);
