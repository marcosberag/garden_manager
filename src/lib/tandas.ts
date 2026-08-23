/**
 * Una tanda es un ciclo de tratamiento: las aplicaciones seguidas de un mismo
 * producto sobre una misma planta. Importa porque los topes de la etiqueta
 * («máximo 3 aplicaciones») se refieren a la tanda, no al historial entero:
 * dos aplicaciones de hace dos años no deben gastar el cupo de este otoño.
 */

const diasEntre = (a: string, b: string) =>
  Math.round(Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400000);

/**
 * Cuánto tiempo sin tratar rompe una tanda y empieza otra. Tres pautas
 * seguidas en blanco es señal clara de que aquel tratamiento se acabó, con un
 * suelo de tres meses para las pautas cortas.
 */
export function cortePorInactividad(pauta: number) {
  return Math.max(90, (pauta || 30) * 3);
}

/**
 * Aplicaciones de la tanda que sigue viva, contando hacia atrás desde hoy.
 * `fechas` viene de más reciente a más antigua.
 */
export function aplicacionesDeLaTanda(fechas: string[], hoy: string, corte: number, periodo: string): number {
  if (fechas.length === 0) return 0;

  // Si hace más de un corte que no se trata, lo de antes fue otra tanda.
  if (diasEntre(fechas[0], hoy) > corte) return 0;

  const limiteAnual = periodo === 'anual' ? 365 : Infinity;

  let hechas = 0;
  let anterior: string | null = null;
  for (const fecha of fechas) {
    if (anterior && diasEntre(fecha, anterior) > corte) break;
    if (diasEntre(fecha, hoy) > limiteAnual) break;
    hechas += 1;
    anterior = fecha;
  }
  return hechas;
}
