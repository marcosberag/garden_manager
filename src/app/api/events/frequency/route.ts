import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { frecuenciaSegunCaso, type CasoTratamiento } from '@/lib/frecuencias';

// Pauta recomendada para un tratamiento concreto (producto + planta + modo de
// aplicación + notas). La consulta el formulario de nuevo tratamiento al vuelo.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const caso = (await request.json()) as CasoTratamiento;
    if (!caso?.producto?.nombre) {
      return NextResponse.json({ error: 'Falta el producto' }, { status: 400 });
    }
    const pauta = await frecuenciaSegunCaso(caso);
    // Sin pauta no hay error: el formulario se queda con la del producto.
    return NextResponse.json(pauta ?? {});
  } catch (error) {
    console.error('Error calculando la frecuencia del caso:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
