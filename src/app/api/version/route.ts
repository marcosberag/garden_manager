import { NextResponse } from 'next/server';

// Qué commit está sirviendo este despliegue. Vercel expone la variable sola;
// en desarrollo responde "dev". Sirve para saber si un deploy ya terminó.
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    commit: (process.env.VERCEL_GIT_COMMIT_SHA || 'dev').slice(0, 7),
    mensaje: process.env.VERCEL_GIT_COMMIT_MESSAGE?.split('\n')[0] || null,
  });
}
