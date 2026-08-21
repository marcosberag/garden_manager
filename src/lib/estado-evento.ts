export type EstadoEvento = 'hecho' | 'atrasado' | 'hoy' | 'futuro';

/**
 * En qué estado está un evento de la agenda. Vive aquí, y no dentro de la
 * vista, para que la lista, la rejilla del mes y el diagnóstico cuenten
 * exactamente lo mismo: cuando esta regla estaba duplicada, la rejilla pintaba
 * un ✓ en tareas que aún no se habían hecho.
 */
export function estadoDeEvento(notas: string | null | undefined, fecha: string, hoy: string): EstadoEvento {
  const n = notas || '';
  if (n.includes('[HECHO]') || n.includes('[FIN]')) return 'hecho';
  // Sin la etiqueta [PROGRAMADO] no es un aviso, es el registro de algo ya
  // aplicado; solo sigue "vivo" el mismo día en que se anotó.
  if (!n.includes('[PROGRAMADO]')) return fecha < hoy ? 'hecho' : 'hoy';
  if (fecha < hoy) return 'atrasado';
  if (fecha === hoy) return 'hoy';
  return 'futuro';
}

/** Fecha de hoy en España, en AAAA-MM-DD. */
export const hoyEnEspana = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' });
