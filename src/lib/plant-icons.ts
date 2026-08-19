// Iconos de planta para el mapa. Son SVG propios en vez de emoji porque el emoji
// se dibuja distinto en cada sistema operativo y dejaba el mapa con aire de
// prototipo. Se sirven como cadenas porque Leaflet los inyecta con divIcon.

export const CATEGORIAS = [
  'arbol',
  'palmera',
  'arbusto',
  'flor',
  'hortaliza',
  'citrico',
  'suculenta',
  'aromatica',
  'generica',
] as const;

export type CategoriaPlanta = (typeof CATEGORIAS)[number];

const VERDE = '#77aa83';
const VERDE_OSCURO = '#117025';
const TIERRA = '#8a6f4a';

// Cada dibujo ocupa un lienzo de 24x24 y se apoya en la línea de suelo (y=21).
const DIBUJOS: Record<CategoriaPlanta, string> = {
  arbol: `
    <path d="M11 14h2v7h-2z" fill="${TIERRA}"/>
    <circle cx="12" cy="8" r="6" fill="${VERDE}"/>
    <circle cx="8" cy="11" r="4" fill="${VERDE_OSCURO}"/>
    <circle cx="16" cy="11" r="4" fill="${VERDE_OSCURO}"/>`,
  palmera: `
    <path d="M11.4 9c.6 4 .6 8 .2 12h1.6c-.2-4-.2-8 .4-12z" fill="${TIERRA}"/>
    <path d="M12 7C9 4 5 4.5 3 7c3-1 5-.6 7 1z" fill="${VERDE}"/>
    <path d="M12 7c3-3 7-2.5 9 0-3-1-5-.6-7 1z" fill="${VERDE}"/>
    <path d="M12 7c-1-3.5 1-6 4-6.5-2 2-2.6 4-2.4 6z" fill="${VERDE_OSCURO}"/>
    <path d="M12 7c-2-2.6-5-3-7.6-1.6 2.6.2 4.4 1.2 6 3z" fill="${VERDE_OSCURO}"/>`,
  arbusto: `
    <path d="M11.4 15h1.2v6h-1.2z" fill="${TIERRA}"/>
    <circle cx="7.5" cy="13" r="4.5" fill="${VERDE_OSCURO}"/>
    <circle cx="16.5" cy="13" r="4.5" fill="${VERDE_OSCURO}"/>
    <circle cx="12" cy="10" r="5.5" fill="${VERDE}"/>`,
  flor: `
    <path d="M11.5 12h1v9h-1z" fill="${VERDE_OSCURO}"/>
    <path d="M12 16c-2 0-3.5-1.2-4-3 2-.4 3.4.4 4 3z" fill="${VERDE}"/>
    <circle cx="12" cy="5" r="2.6" fill="#d98cae"/>
    <circle cx="7.8" cy="8" r="2.6" fill="#d98cae"/>
    <circle cx="16.2" cy="8" r="2.6" fill="#d98cae"/>
    <circle cx="9.4" cy="12.4" r="2.6" fill="#c97a9c"/>
    <circle cx="14.6" cy="12.4" r="2.6" fill="#c97a9c"/>
    <circle cx="12" cy="9" r="2.4" fill="#f0c05a"/>`,
  hortaliza: `
    <path d="M12 21c-4 0-6.5-2.6-6.5-6S8 9 12 9s6.5 2.6 6.5 6-2.5 6-6.5 6z" fill="#c0392b"/>
    <path d="M12 9c-.6-2-2.2-3-4.4-3 .6 1.8 2 2.8 4.4 3z" fill="${VERDE}"/>
    <path d="M12 9c.6-2 2.2-3 4.4-3-.6 1.8-2 2.8-4.4 3z" fill="${VERDE}"/>
    <path d="M11.4 5h1.2v4h-1.2z" fill="${VERDE_OSCURO}"/>`,
  citrico: `
    <path d="M11 14h2v7h-2z" fill="${TIERRA}"/>
    <circle cx="12" cy="8" r="6" fill="${VERDE}"/>
    <circle cx="9" cy="7" r="1.9" fill="#f0a830"/>
    <circle cx="15" cy="9.5" r="1.9" fill="#f0a830"/>`,
  suculenta: `
    <path d="M9 21h6l-.7-5H9.7z" fill="${TIERRA}"/>
    <path d="M11.2 16V8a1 1 0 0 1 1.6 0v8z" fill="${VERDE}"/>
    <path d="M11.2 13 8 10.4a1 1 0 0 0-1.3 1.4L10 15z" fill="${VERDE_OSCURO}"/>
    <path d="M12.8 13 16 10.4a1 1 0 0 1 1.3 1.4L14 15z" fill="${VERDE_OSCURO}"/>`,
  aromatica: `
    <path d="M11.5 10h1v11h-1z" fill="${VERDE_OSCURO}"/>
    <path d="M12 13c-2.4 0-4-1.4-4.4-3.6 2.4-.4 4 .8 4.4 3.6z" fill="${VERDE}"/>
    <path d="M12 13c2.4 0 4-1.4 4.4-3.6-2.4-.4-4 .8-4.4 3.6z" fill="${VERDE}"/>
    <path d="M12 8.4c-1.8 0-3-1-3.4-2.8C10.4 5.2 11.6 6.2 12 8.4z" fill="${VERDE}"/>
    <path d="M12 8.4c1.8 0 3-1 3.4-2.8-1.8-.4-3 .6-3.4 2.8z" fill="${VERDE}"/>`,
  generica: `
    <path d="M11.5 11h1v10h-1z" fill="${VERDE_OSCURO}"/>
    <path d="M12 14c-2.8 0-4.8-1.8-5.2-4.6C9.6 9 11.6 10.6 12 14z" fill="${VERDE}"/>
    <path d="M12 12c.4-3.4 2.4-5 5.2-4.6C16.8 10.2 14.8 12 12 12z" fill="${VERDE}"/>`,
};

// Reglas de texto sobre la especie o el nombre. Resuelven la gran mayoría de
// casos sin coste ni espera; lo que no encaje se pregunta a la IA al guardar.
const REGLAS: [CategoriaPlanta, string[]][] = [
  ['palmera', ['palmera', 'palma', 'phoenix', 'washingtonia', 'chamaerops', 'yuca', 'yucca', 'dracaena', 'drácena', 'cica']],
  ['citrico', ['limon', 'limón', 'naranj', 'mandarin', 'pomelo', 'citrus', 'kumquat']],
  ['suculenta', ['cactus', 'suculenta', 'crasa', 'aloe', 'echeveria', 'sedum', 'agave', 'opuntia', 'chumbera', 'pita']],
  ['aromatica', ['romero', 'tomillo', 'lavanda', 'albahaca', 'menta', 'hierbabuena', 'salvia', 'oregano', 'orégano', 'perejil', 'cilantro', 'laurel', 'melisa']],
  ['hortaliza', ['tomat', 'lechuga', 'pimiento', 'calabac', 'pepino', 'berenjena', 'zanahoria', 'cebolla', 'ajo', 'fresa', 'judia', 'judía', 'guisante', 'acelga', 'espinaca', 'patata', 'huerto']],
  ['flor', ['rosa', 'rosal', 'geranio', 'petunia', 'orquidea', 'orquídea', 'margarita', 'clavel', 'tulipan', 'tulipán', 'girasol', 'hortensia', 'buganvilla', 'jazmin', 'jazmín', 'camelia', 'azalea', 'lirio', 'dalia', 'gardenia']],
  ['arbol', ['olivo', 'pino', 'encina', 'roble', 'chopo', 'almendro', 'nogal', 'higuera', 'manzano', 'peral', 'cerezo', 'ciruelo', 'sauce', 'abeto', 'ciprés', 'cipres', 'leyland', 'arce', 'magnolio', 'algarrobo', 'eucalipto', 'granado', 'membrillo', 'aguacate']],
  ['arbusto', ['seto', 'boj', 'aligustre', 'adelfa', 'hibisco', 'lantana', 'photinia', 'pitosporo', 'evonimo', 'evónimo', 'durillo', 'arbusto', 'arrayan', 'arrayán']],
];

/**
 * Categoría de icono a partir del texto libre que escribe el usuario. Devuelve
 * null cuando ninguna regla encaja, para poder preguntárselo a la IA.
 */
export function categoriaDeEspecie(especie?: string | null, nombre?: string | null): CategoriaPlanta | null {
  const texto = `${especie || ''} ${nombre || ''}`.toLowerCase();
  if (!texto.trim()) return null;

  for (const [categoria, palabras] of REGLAS) {
    if (palabras.some(palabra => texto.includes(palabra))) {
      return categoria;
    }
  }
  return null;
}

export function esCategoriaValida(valor?: string | null): valor is CategoriaPlanta {
  return !!valor && (CATEGORIAS as readonly string[]).includes(valor);
}

/** SVG suelto de la categoría, para listados y fichas. */
export function svgDePlanta(categoria?: string | null, tamano = 24): string {
  const elegida: CategoriaPlanta = esCategoriaValida(categoria) ? categoria : 'generica';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${tamano}" height="${tamano}">${DIBUJOS[elegida]}</svg>`;
}

/**
 * Marcador completo del mapa: un pin en forma de gota con el dibujo dentro. La
 * punta cae en la coordenada real de la planta (ver ANCLA_PIN).
 */
export function pinDePlanta(categoria?: string | null): string {
  const elegida: CategoriaPlanta = esCategoriaValida(categoria) ? categoria : 'generica';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 52" width="40" height="52">
    <defs>
      <filter id="sombra-pin" x="-40%" y="-20%" width="180%" height="160%">
        <feDropShadow dx="0" dy="2" stdDeviation="1.6" flood-color="#000" flood-opacity="0.35"/>
      </filter>
    </defs>
    <path d="M20 1C10.6 1 3 8.6 3 18c0 11.4 13.6 22.8 16.1 32.3.2.9 1.6.9 1.8 0C23.4 40.8 37 29.4 37 18 37 8.6 29.4 1 20 1z"
          fill="#ffffff" stroke="#09352e" stroke-width="2.5" filter="url(#sombra-pin)"/>
    <g transform="translate(8 6)">${DIBUJOS[elegida]}</g>
  </svg>`;
}

export const TAMANO_PIN: [number, number] = [40, 52];
// La punta de la gota está en el borde inferior, centrada.
export const ANCLA_PIN: [number, number] = [20, 51];
