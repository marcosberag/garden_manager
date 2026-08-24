'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { guardarDeteccionRecorrido } from '@/app/actions';
import { categoriaDeEspecie } from '@/lib/plant-icons';
import { grupoParaFoto, nombreParaNuevo, normalizaEspecie } from '@/lib/recorrido';

const MapaRevision = dynamic(() => import('./MapaRevision'), { ssr: false });

export type PlantaRegistrada = {
  id: string;
  name: string;
  species: string | null;
  tienePosicion: boolean;
  tieneFoto: boolean;
};

export type FotoRecorrido = {
  dataUrl: string; // JPEG comprimido
  sintomas: string | null;
  lat: number | null;
  lng: number | null;
  ts: number;
};

// Una detección es un EJEMPLAR, no una foto: un seto de 30 metros fotografiado
// cacho a cacho es una sola detección con muchas fotos, y todas van a su
// historial. Dos moreras separadas son dos detecciones aunque compartan
// especie (src/lib/recorrido.ts decide, y la revisión permite corregir).
export type Deteccion = {
  key: string;
  nombre: string;
  especie: string;
  alternativa: string | null;
  confianza: 'alta' | 'media' | 'baja';
  motivo: string;
  fotos: FotoRecorrido[];
  lat: number | null;
  lng: number | null;
  plantaExistenteId: string; // '' = planta nueva
  actualizarFoto: boolean; // en las ya registradas: usar la captura como su foto
  incluir: boolean;
  errorGuardado: string | null;
};

type Fase = 'inicio' | 'camara' | 'revision' | 'guardado';

const LADO_MAXIMO = 768; // px del lado mayor del fotograma que se manda a la IA

const RANGO_CONFIANZA = { baja: 0, media: 1, alta: 2 } as const;

/** Reduce una imagen (vídeo o foto) a JPEG comprimido para el análisis. */
function aJpegReducido(fuente: HTMLVideoElement | HTMLImageElement, ancho: number, alto: number): string {
  const escala = Math.min(1, LADO_MAXIMO / Math.max(ancho, alto));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(ancho * escala);
  canvas.height = Math.round(alto * escala);
  canvas.getContext('2d')!.drawImage(fuente, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.78);
}

export default function RecorridoClient({ plantas, parcel, deteccionesIniciales, faseInicial }: {
  plantas: PlantaRegistrada[];
  parcel: object | null;
  /** Estado de arranque opcional: pruebas y recuperación de recorridos a medias. */
  deteccionesIniciales?: Deteccion[];
  faseInicial?: Fase;
}) {
  const [fase, setFase] = useState<Fase>(faseInicial ?? 'inicio');
  const [detecciones, setDetecciones] = useState<Deteccion[]>(deteccionesIniciales ?? []);
  const [analizando, setAnalizando] = useState(false);
  const [auto, setAuto] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pista, setPista] = useState<string | null>(null);
  const [errorCamara, setErrorCamara] = useState<string | null>(null);
  const [colocando, setColocando] = useState<string | null>(null); // key de la detección que se está colocando en el mapa
  const [guardando, setGuardando] = useState(false);
  const [progreso, setProgreso] = useState<string | null>(null);
  const [resumen, setResumen] = useState<{ creadas: string[]; actualizadas: string[]; errores: string[] } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const posRef = useRef<{ lat: number; lng: number } | null>(null);
  const watchRef = useRef<number | null>(null);
  const analizandoRef = useRef(false);
  const deteccionesRef = useRef<Deteccion[]>([]);
  // Arranca por encima de cualquier key sembrada: si entran detecciones
  // iniciales (pruebas, recorridos recuperados), separar una foto no puede
  // fabricar una key repetida — dos tarjetas con la misma key rompen React.
  const contadorRef = useRef(
    (deteccionesIniciales ?? []).reduce((m, d) => Math.max(m, parseInt(d.key.replace(/\D/g, ''), 10) || 0), 0),
  );
  const refotoRef = useRef<HTMLInputElement>(null);
  const refotoKeyRef = useRef<string | null>(null);
  const avisoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapaRef = useRef<HTMLDivElement>(null);

  // La cola de análisis necesita la lista al día sin re-crear callbacks.
  useEffect(() => {
    deteccionesRef.current = detecciones;
  }, [detecciones]);

  // Limpieza al desmontar: apagar cámara, GPS y el temporizador del aviso.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (watchRef.current != null) navigator.geolocation?.clearWatch(watchRef.current);
      if (avisoTimerRef.current) clearTimeout(avisoTimerRef.current);
    };
  }, []);

  /** Aviso efímero: aparece, se lee, y desaparece solo. El historial es la revisión. */
  const avisar = (texto: string) => {
    setAviso(texto);
    if (avisoTimerRef.current) clearTimeout(avisoTimerRef.current);
    avisoTimerRef.current = setTimeout(() => setAviso(null), 4000);
  };

  const empezar = async () => {
    setErrorCamara(null);
    // GPS en segundo plano: cada captura se queda con la última posición conocida.
    if (navigator.geolocation) {
      watchRef.current = navigator.geolocation.watchPosition(
        pos => { posRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }; },
        () => {},
        { enableHighAccuracy: true, maximumAge: 3000 },
      );
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      setFase('camara');
      // El <video> se monta con el cambio de fase; conectar en el siguiente tick.
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 50);
    } catch {
      setErrorCamara('No se pudo abrir la cámara. Puedes hacer el recorrido foto a foto con el botón de abajo.');
      setFase('camara');
    }
  };

  const analizar = async (dataUrl: string) => {
    analizandoRef.current = true;
    setAnalizando(true);
    const pos = posRef.current ? { ...posRef.current } : null;
    const ts = Date.now();
    try {
      const res = await fetch('/api/walkthrough/frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagen: dataUrl.split(',')[1] }),
      });
      if (!res.ok) {
        avisar('El análisis falló; sigue, se reintenta en la próxima captura.');
        return;
      }
      const r = await res.json();
      if (!r.hay_planta) {
        avisar('Sin planta clara en el encuadre.');
        return;
      }

      const foto: FotoRecorrido = { dataUrl, sintomas: r.sintomas || null, lat: pos?.lat ?? null, lng: pos?.lng ?? null, ts };
      const lista = deteccionesRef.current;

      // ¿Es un cacho más del mismo ejemplar? Si coincide con una planta
      // registrada que ya tiene detección en este recorrido, es ella seguro
      // (un seto largo supera cualquier radio); si no, decide especie+GPS+tiempo.
      const existente = r.coincide_con_registrada
        ? plantas.find(p => p.name.toLowerCase() === r.coincide_con_registrada.toLowerCase())
        : null;
      const grupoPorRegistro = existente ? lista.find(d => d.plantaExistenteId === existente.id) : null;
      // Se compara contra la ÚLTIMA foto de cada grupo, no contra la primera:
      // así un seto largo se encadena cacho a cacho aunque el final quede a
      // 30 m del principio.
      const grupoKey = grupoPorRegistro?.key ?? grupoParaFoto(
        lista.map(d => {
          const ultima = d.fotos[d.fotos.length - 1];
          return { key: d.key, especie: d.especie, ultimaFotoTs: ultima?.ts ?? 0, lat: ultima?.lat ?? d.lat, lng: ultima?.lng ?? d.lng };
        }),
        r.especie,
        pos,
        ts,
      );

      if (grupoKey) {
        const grupo = lista.find(d => d.key === grupoKey);
        setDetecciones(prev => prev.map(d => d.key === grupoKey
          ? {
              ...d,
              fotos: [...d.fotos, foto],
              confianza: RANGO_CONFIANZA[r.confianza as Deteccion['confianza']] > RANGO_CONFIANZA[d.confianza] ? r.confianza : d.confianza,
            }
          : d));
        avisar(`«${grupo?.nombre}» · foto ${(grupo?.fotos.length ?? 0) + 1}${r.sintomas ? ' · síntomas anotados' : ''}`);
        return;
      }

      const nombre = nombreParaNuevo(r.nombre_comun || r.especie, r.especie, lista);
      const nueva: Deteccion = {
        key: `d${++contadorRef.current}`,
        nombre,
        especie: r.especie,
        alternativa: r.alternativa || null,
        confianza: r.confianza,
        motivo: r.motivo,
        fotos: [foto],
        lat: foto.lat,
        lng: foto.lng,
        plantaExistenteId: existente?.id || '',
        actualizarFoto: existente ? !existente.tieneFoto : true,
        incluir: true,
        errorGuardado: null,
      };
      setDetecciones(prev => [...prev, nueva]);
      avisar(existente
        ? `${nombre} — ya registrada como «${existente.name}»`
        : `+ ${nombre} (confianza ${r.confianza})${r.sintomas ? ' · síntomas' : ''}`);
    } catch {
      avisar('Error de red analizando; se reintenta en la próxima captura.');
    } finally {
      analizandoRef.current = false;
      setAnalizando(false);
    }
  };

  // --- Captura inteligente ---------------------------------------------------
  // Cada segundo se toma una miniatura barata del encuadre y se compara con la
  // anterior (¿está quieta la cámara?) y con la última analizada (¿es escena
  // nueva?). El pulso a mano tiembla más de lo que parecía: si la imagen se
  // queda clavada dispara al segundo, y si tiembla un poco basta con llevar
  // DOS segundos seguidos casi quieto delante de algo nuevo. Lo que cuenta es
  // el tiempo parado ante la planta, no el reloj desde la captura anterior.
  const LADO_MINIATURA = 48;
  const UMBRAL_QUIETO = 0.055;
  const UMBRAL_QUIETO_LAX = 0.09;
  const UMBRAL_ESCENA_NUEVA = 0.1;
  const MARGEN_MS = 3000;
  const TICKS_CASI_QUIETO = 2;
  const miniPrevRef = useRef<Uint8ClampedArray | null>(null);
  const miniAnalizadaRef = useRef<Uint8ClampedArray | null>(null);
  const ultimoAnalisisRef = useRef(0);
  const casiQuietoRef = useRef(0);

  const miniatura = (video: HTMLVideoElement): Uint8ClampedArray | null => {
    if (video.videoWidth === 0) return null;
    const canvas = document.createElement('canvas');
    canvas.width = LADO_MINIATURA;
    canvas.height = LADO_MINIATURA;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, LADO_MINIATURA, LADO_MINIATURA);
    const { data } = ctx.getImageData(0, 0, LADO_MINIATURA, LADO_MINIATURA);
    const gris = new Uint8ClampedArray(LADO_MINIATURA * LADO_MINIATURA);
    for (let i = 0; i < gris.length; i++) {
      gris[i] = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;
    }
    return gris;
  };

  /** Diferencia media entre dos miniaturas: 0 = idénticas, 1 = opuestas. */
  const diferencia = (a: Uint8ClampedArray, b: Uint8ClampedArray): number => {
    let suma = 0;
    for (let i = 0; i < a.length; i++) suma += Math.abs(a[i] - b[i]);
    return suma / a.length / 255;
  };

  const capturar = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || analizandoRef.current) return;
    miniAnalizadaRef.current = miniatura(video);
    ultimoAnalisisRef.current = Date.now();
    setPista(null);
    analizar(aJpegReducido(video, video.videoWidth, video.videoHeight));
  };

  useEffect(() => {
    if (fase !== 'camara' || !auto || errorCamara) return;
    const id = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;
      const ahora = miniatura(video);
      if (!ahora) return;
      const antes = miniPrevRef.current;
      miniPrevRef.current = ahora;
      if (!antes || analizandoRef.current) return;

      const movimiento = diferencia(ahora, antes);
      const quieto = movimiento < UMBRAL_QUIETO;
      const casiQuieto = movimiento < UMBRAL_QUIETO_LAX;
      const escenaNueva = !miniAnalizadaRef.current || diferencia(ahora, miniAnalizadaRef.current) > UMBRAL_ESCENA_NUEVA;
      const conMargen = Date.now() - ultimoAnalisisRef.current > MARGEN_MS;

      // Segundos seguidos casi quieto delante de una escena nueva.
      casiQuietoRef.current = casiQuieto && escenaNueva ? casiQuietoRef.current + 1 : 0;

      if (escenaNueva && conMargen && (quieto || casiQuietoRef.current >= TICKS_CASI_QUIETO)) {
        casiQuietoRef.current = 0;
        capturar();
        return;
      }
      setPista(escenaNueva && !casiQuieto ? 'párate 2 segundos delante de la planta' : null);
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, auto, errorCamara]);

  const terminar = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setFase('revision');
  };

  /** Analiza una foto elegida del carrete o hecha con el input (fallback y re-foto). */
  const procesarArchivo = (file: File, keyExistente: string | null) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const dataUrl = aJpegReducido(img, img.naturalWidth, img.naturalHeight);
      URL.revokeObjectURL(url);
      if (keyExistente) {
        // Re-foto de una detección dudosa: sustituye la imagen principal y se re-identifica.
        setDetecciones(prev => prev.map(d => d.key === keyExistente
          ? { ...d, fotos: [{ ...d.fotos[0], dataUrl }, ...d.fotos.slice(1)] }
          : d));
        reidentificar(keyExistente, dataUrl);
      } else {
        analizar(dataUrl);
      }
    };
    img.src = url;
  };

  const reidentificar = async (key: string, dataUrl: string) => {
    setAnalizando(true);
    try {
      const res = await fetch('/api/walkthrough/frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagen: dataUrl.split(',')[1] }),
      });
      if (res.ok) {
        const r = await res.json();
        if (r.hay_planta) {
          setDetecciones(prev => prev.map(d => d.key === key
            ? { ...d, nombre: r.nombre_comun || r.especie, especie: r.especie, alternativa: r.alternativa || null, confianza: r.confianza, motivo: r.motivo }
            : d));
        }
      }
    } finally {
      setAnalizando(false);
    }
  };

  const editar = (key: string, cambios: Partial<Deteccion>) => {
    setDetecciones(prev => prev.map(d => d.key === key ? { ...d, ...cambios } : d));
  };

  /** «No, era la otra»: intercambia la especie con la segunda opción del modelo. */
  const usarAlternativa = (key: string) => {
    setDetecciones(prev => prev.map(d => d.key === key
      ? { ...d, nombre: d.alternativa || d.nombre, especie: d.alternativa || d.especie, alternativa: d.nombre }
      : d));
  };

  /** Saca una foto de un grupo a su propia detección (era otro ejemplar). */
  const separarFoto = (key: string, idx: number) => {
    setDetecciones(prev => {
      const origen = prev.find(d => d.key === key);
      if (!origen || origen.fotos.length < 2 || !origen.fotos[idx]) return prev;
      const foto = origen.fotos[idx];
      const nueva: Deteccion = {
        ...origen,
        key: `d${++contadorRef.current}`,
        nombre: nombreParaNuevo(origen.nombre.replace(/ \d+$/, ''), origen.especie, prev),
        fotos: [foto],
        lat: foto.lat,
        lng: foto.lng,
        plantaExistenteId: '',
        actualizarFoto: true,
        errorGuardado: null,
      };
      return [
        ...prev.map(d => d.key === key ? { ...d, fotos: d.fotos.filter((_, i) => i !== idx) } : d),
        nueva,
      ];
    });
  };

  /** Funde esta detección con la anterior de su misma especie (era el mismo ejemplar). */
  const unirConAnterior = (key: string) => {
    setDetecciones(prev => {
      const origen = prev.find(d => d.key === key);
      if (!origen) return prev;
      const destino = prev.find(d => d.key !== key && normalizaEspecie(d.especie) === normalizaEspecie(origen.especie));
      if (!destino) return prev;
      return prev
        .filter(d => d.key !== key)
        .map(d => d.key === destino.key
          ? {
              ...d,
              fotos: [...d.fotos, ...origen.fotos],
              plantaExistenteId: d.plantaExistenteId || origen.plantaExistenteId,
              lat: d.lat ?? origen.lat,
              lng: d.lng ?? origen.lng,
            }
          : d);
    });
  };

  /**
   * Guarda de una en una, con progreso. Las que fallan se quedan en la lista
   * con su error a la vista para reintentar solo esas: nada de un «no ha sido
   * posible» global que no dice ni qué ni por qué.
   */
  const guardar = async () => {
    setGuardando(true);
    const objetivo = detecciones.filter(d => d.incluir);
    const creadas: string[] = [];
    const actualizadas: string[] = [];
    const errores: string[] = [];
    const guardadasKeys: string[] = [];

    for (let i = 0; i < objetivo.length; i++) {
      const d = objetivo[i];
      setProgreso(`Guardando ${i + 1} de ${objetivo.length} — ${d.nombre}…`);
      try {
        const r = await guardarDeteccionRecorrido({
          nombre: d.nombre,
          especie: d.especie,
          motivo: d.motivo || null,
          fotos: d.fotos.map(f => ({ dataUrl: f.dataUrl, sintomas: f.sintomas })),
          lat: d.lat,
          lng: d.lng,
          plantaExistenteId: d.plantaExistenteId || null,
          actualizarFoto: d.actualizarFoto,
        });
        if ('error' in r) {
          errores.push(r.error);
          editar(d.key, { errorGuardado: r.error });
        } else {
          guardadasKeys.push(d.key);
          if (r.tipo === 'creada') creadas.push(r.nombre);
          else actualizadas.push(r.nombre);
        }
      } catch (e) {
        const msg = `${d.nombre}: ${e instanceof Error ? e.message : 'fallo de red'}`;
        errores.push(msg);
        editar(d.key, { errorGuardado: msg });
      }
    }

    // Las guardadas salen de la lista; las fallidas se quedan para reintentar.
    setDetecciones(prev => prev.filter(d => !guardadasKeys.includes(d.key)));
    setProgreso(null);
    setResumen({ creadas, actualizadas, errores });
    setFase('guardado');
    setGuardando(false);
  };

  const etiquetaConfianza = (c: Deteccion['confianza']) =>
    c === 'alta' ? 'tag tag--fern' : c === 'media' ? 'tag' : 'tag tag--alert';

  const totalFotos = detecciones.reduce((n, d) => n + d.fotos.length, 0);

  /* ------------------------------------------------------------------ fases */

  if (fase === 'inicio') {
    return (
      <main className="container" style={{ paddingTop: '110px', paddingBottom: '80px', maxWidth: '640px' }}>
        <p className="eyebrow" style={{ marginBottom: '10px' }}>Gemelo digital</p>
        <h1 className="heading-text suisse" style={{ marginBottom: '16px' }}>recorrido por<br />el jardín.</h1>
        <p className="body-text" style={{ marginBottom: '24px' }}>
          Pasea por el jardín con la cámara abierta enfocando cada planta. La app las identifica
          sobre la marcha, junta en una sola las fotos del mismo ejemplar (un seto largo se hace
          cacho a cacho), apunta los síntomas que vea y al terminar te enseña todo para revisarlo.
        </p>
        <div className="card" style={{ marginBottom: '24px' }}>
          <p className="field-label" style={{ marginBottom: '10px', display: 'block' }}>Cómo funciona</p>
          <ol style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: 'var(--color-slate-smoke)', lineHeight: 1.7 }}>
            <li>Acepta los permisos de <strong>cámara</strong> y <strong>ubicación</strong> (la posición GPS es el borrador para colocar cada planta).</li>
            <li>Párate 2–3 segundos delante de cada planta y espera el aviso; el botón central dispara al momento si no quieres esperar.</li>
            <li>Un seto o una hilera: recórrelo haciendo fotos cada pocos metros — todas cuentan como la misma planta y alimentan su historial.</li>
            <li>Al terminar, revisa la lista: corrige nombres, separa o une ejemplares y coloca cada pin en su sitio del mapa.</li>
          </ol>
        </div>
        <button onClick={empezar} className="btn-solid" style={{ width: '100%' }}>
          Empezar el recorrido
        </button>
        <p className="field-hint" style={{ marginTop: '12px', textAlign: 'center' }}>
          {plantas.length > 0
            ? `Tu jardín tiene ${plantas.length} plantas registradas: las que reconozca no se duplicarán.`
            : 'Primera vez: todo lo que detecte se registrará como nuevo.'}
        </p>
      </main>
    );
  }

  if (fase === 'camara') {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 2000, backgroundColor: '#0b1512', display: 'flex', flexDirection: 'column' }}>
        {!errorCamara ? (
          <video ref={videoRef} playsInline muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
            <p style={{ color: 'white', fontSize: '14px', textAlign: 'center', maxWidth: '40ch' }}>{errorCamara}</p>
          </div>
        )}

        {/* Cabecera: estado y recuento */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'linear-gradient(rgba(9,53,46,0.65), transparent)' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'white' }}>
            [ Recorrido ]
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'white' }}>
            {analizando ? 'analizando…' : `${detecciones.length} ${detecciones.length === 1 ? 'planta' : 'plantas'} · ${totalFotos} fotos`}
          </span>
        </div>

        {/* Pista del modo auto (qué está esperando) */}
        {!analizando && pista && (
          <div style={{ position: 'absolute', top: '56px', left: '16px', right: '16px', zIndex: 1, textAlign: 'center' }}>
            <span style={{ display: 'inline-block', backgroundColor: 'rgba(11,21,18,0.6)', color: 'rgba(255,255,255,0.85)', fontFamily: 'var(--font-mono)', fontSize: '10.5px', padding: '5px 11px', borderRadius: '9999px' }}>
              {pista}
            </span>
          </div>
        )}

        {/* Resultado de la última captura: aparece y se va solo */}
        {aviso && (
          <div style={{ position: 'absolute', bottom: '124px', left: '16px', right: '16px', zIndex: 1, textAlign: 'center' }}>
            <span style={{ display: 'inline-block', backgroundColor: 'rgba(9,53,46,0.92)', color: 'white', fontFamily: 'var(--font-mono)', fontSize: '11.5px', padding: '8px 14px', borderRadius: '9999px', maxWidth: '92%' }}>
              {aviso}
            </span>
          </div>
        )}

        {/* Controles */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '18px 20px 28px', background: 'linear-gradient(transparent, rgba(9,53,46,0.75))' }}>
          <button
            onClick={() => setAuto(a => !a)}
            disabled={!!errorCamara}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'white', border: `1px solid ${auto ? 'var(--color-moss)' : 'rgba(255,255,255,0.5)'}`, backgroundColor: auto ? 'rgba(133,192,147,0.25)' : 'transparent', borderRadius: '9999px', padding: '8px 14px' }}
          >
            Auto {auto ? 'ON' : 'OFF'}
          </button>

          {!errorCamara ? (
            <button
              onClick={capturar}
              aria-label="Capturar"
              style={{ width: '68px', height: '68px', borderRadius: '50%', border: '4px solid white', backgroundColor: analizando ? 'rgba(255,255,255,0.4)' : 'var(--color-moss)', flex: '0 0 auto' }}
            />
          ) : (
            <button onClick={() => refotoRef.current?.click()} className="btn-solid" style={{ flex: '0 0 auto' }}>
              Hacer foto
            </button>
          )}

          <button
            onClick={terminar}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-forest-ink)', backgroundColor: 'white', borderRadius: '9999px', padding: '8px 14px' }}
          >
            Terminar{detecciones.length > 0 ? ` (${detecciones.length})` : ''}
          </button>
        </div>

        <input
          ref={refotoRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) procesarArchivo(f, refotoKeyRef.current);
            refotoKeyRef.current = null;
            e.target.value = '';
          }}
        />
      </div>
    );
  }

  if (fase === 'guardado') {
    const hayFallos = (resumen?.errores.length ?? 0) > 0;
    return (
      <main className="container" style={{ paddingTop: '110px', paddingBottom: '80px', maxWidth: '640px' }}>
        <p className="eyebrow" style={{ marginBottom: '10px' }}>Gemelo digital</p>
        <h1 className="heading-text suisse" style={{ marginBottom: '20px' }}>
          {hayFallos ? <>recorrido guardado<br />a medias.</> : <>recorrido<br />guardado.</>}
        </h1>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {(resumen?.creadas.length ?? 0) > 0 && (
            <p style={{ margin: 0, fontSize: '14px' }}>
              <span className="tag tag--fern" style={{ marginRight: '8px' }}>Nuevas</span>
              {resumen?.creadas.join(' · ')}
            </p>
          )}
          {(resumen?.actualizadas.length ?? 0) > 0 && (
            <p style={{ margin: 0, fontSize: '14px' }}>
              <span className="tag" style={{ marginRight: '8px' }}>Completadas</span>
              {resumen?.actualizadas.join(' · ')} — ya estaban registradas; sus capturas fueron al historial.
            </p>
          )}
          {hayFallos && (
            <div>
              <span className="tag tag--alert" style={{ marginBottom: '6px', display: 'inline-block' }}>Sin guardar</span>
              {resumen?.errores.map((e, i) => (
                <p key={i} style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--color-alert)' }}>{e}</p>
              ))}
            </div>
          )}
          {resumen && resumen.creadas.length === 0 && resumen.actualizadas.length === 0 && !hayFallos && (
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-slate-smoke)' }}>No había nada que guardar.</p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
          {hayFallos ? (
            <button onClick={() => setFase('revision')} className="btn-solid" style={{ flex: 1 }}>
              Reintentar las que fallaron
            </button>
          ) : (
            <Link href="/" className="btn-solid" style={{ textDecoration: 'none', flex: 1 }}>Ver la parcela</Link>
          )}
          <Link href="/plants" className="btn-outline" style={{ textDecoration: 'none', flex: 1 }}>Mis plantas</Link>
        </div>
      </main>
    );
  }

  /* ---------------------------------------------------------------- revisión */

  const incluidas = detecciones.filter(d => d.incluir);
  const numeroDe = (key: string) => incluidas.findIndex(d => d.key === key) + 1;
  const colocandoDeteccion = colocando ? detecciones.find(d => d.key === colocando) : null;

  return (
    <main className="container" style={{ paddingTop: '90px', paddingBottom: '110px', maxWidth: '760px' }}>
      <p className="eyebrow" style={{ marginBottom: '10px' }}>Gemelo digital · revisión</p>
      <h1 className="heading-text suisse" style={{ marginBottom: '12px' }}>lo que ha visto<br />el recorrido.</h1>
      <p className="body-text" style={{ marginBottom: '24px', fontSize: '13px' }}>
        Cada tarjeta es un ejemplar con todas sus fotos. El número de la tarjeta es el mismo del
        pin en el mapa. Corrige lo que haga falta y guarda.
      </p>

      {detecciones.length === 0 && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-slate-smoke)' }}>
            No hay nada pendiente de guardar. Puedes hacer otro recorrido cuando quieras.
          </p>
        </div>
      )}

      {detecciones.map(d => {
        const numero = d.incluir ? numeroDe(d.key) : null;
        const tieneGemela = detecciones.some(o => o.key !== d.key && normalizaEspecie(o.especie) === normalizaEspecie(d.especie));
        return (
          <div key={d.key} className="card" style={{ marginBottom: '14px', opacity: d.incluir ? 1 : 0.55, borderLeft: d.errorGuardado ? '3px solid var(--color-alert)' : undefined }}>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '10px', alignItems: 'center' }}>
              {numero != null && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, backgroundColor: 'var(--color-forest-ink)', color: 'white', borderRadius: '9999px', padding: '3px 9px' }}>
                  {numero}
                </span>
              )}
              <span className={etiquetaConfianza(d.confianza)}>Confianza {d.confianza}</span>
              {d.fotos.some(f => f.sintomas) && <span className="tag tag--alert">Síntomas</span>}
              {d.plantaExistenteId && <span className="tag">Ya registrada</span>}
              {d.fotos.length > 1 && <span className="tag tag--muted">{d.fotos.length} fotos</span>}
            </div>

            {/* Todas las fotos del ejemplar; las que vieron síntomas, marcadas */}
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', marginBottom: '10px', paddingBottom: '2px' }}>
              {d.fotos.map((f, i) => (
                <div key={i} style={{ position: 'relative', flex: '0 0 auto' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.dataUrl}
                    alt={`${d.nombre} — foto ${i + 1}`}
                    style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '8px', border: f.sintomas ? '2px solid var(--color-alert)' : '1px solid var(--color-lichen)' }}
                    title={f.sintomas || undefined}
                  />
                  {d.fotos.length > 1 && (
                    <button
                      onClick={() => separarFoto(d.key, i)}
                      title="Era otra planta: separar esta foto"
                      aria-label="Separar esta foto en otra planta"
                      style={{ position: 'absolute', top: '-6px', right: '-6px', width: '20px', height: '20px', borderRadius: '50%', border: '1px solid var(--color-lichen)', backgroundColor: 'white', color: 'var(--color-slate-smoke)', fontSize: '11px', lineHeight: 1, cursor: 'pointer' }}
                    >
                      ⤴
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input
                className="input-field"
                style={{ flex: '1 1 140px', padding: '8px 10px', fontSize: '14px' }}
                value={d.nombre}
                onChange={e => editar(d.key, { nombre: e.target.value })}
                placeholder="Nombre"
              />
              <input
                className="input-field"
                style={{ flex: '1 1 140px', padding: '8px 10px', fontSize: '14px' }}
                value={d.especie}
                onChange={e => editar(d.key, { especie: e.target.value })}
                placeholder="Especie"
              />
            </div>
            <p className="field-hint" style={{ marginTop: '6px' }}>
              {d.motivo}
              {d.fotos.some(f => f.sintomas) ? ` — ${[...new Set(d.fotos.map(f => f.sintomas).filter(Boolean))].join('; ')}` : ''}
            </p>
            {d.errorGuardado && (
              <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: 'var(--color-alert)' }}>
                No se guardó: {d.errorGuardado}
              </p>
            )}

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px', alignItems: 'center' }}>
              <select
                className="input-field"
                style={{ flex: '1 1 180px', padding: '8px 10px', fontSize: '13px' }}
                value={d.plantaExistenteId}
                onChange={e => {
                  const elegida = plantas.find(p => p.id === e.target.value);
                  editar(d.key, {
                    plantaExistenteId: e.target.value,
                    actualizarFoto: elegida ? !elegida.tieneFoto : true,
                  });
                }}
              >
                <option value="">Planta nueva</option>
                {plantas.map(p => (
                  <option key={p.id} value={p.id}>Es «{p.name}» (ya registrada)</option>
                ))}
              </select>
              {d.alternativa && (
                <button className="chip-btn" onClick={() => usarAlternativa(d.key)}>
                  ¿Era {d.alternativa}?
                </button>
              )}
              {tieneGemela && (
                <button className="chip-btn" onClick={() => unirConAnterior(d.key)} title="Sus fotos pasan a la otra detección de la misma especie">
                  Unir: es la misma
                </button>
              )}
              {d.confianza === 'baja' && (
                <button
                  className="chip-btn"
                  onClick={() => { refotoKeyRef.current = d.key; refotoRef.current?.click(); }}
                >
                  Repetir foto
                </button>
              )}
              <button
                className="chip-btn"
                style={colocando === d.key ? { borderColor: 'var(--color-deep-fern)', color: 'var(--color-deep-fern)' } : undefined}
                onClick={() => {
                  setColocando(c => c === d.key ? null : d.key);
                  setTimeout(() => mapaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
                }}
              >
                ⌖ {d.lat == null ? 'Ubicar' : 'Reubicar'}
              </button>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--color-slate-smoke)', cursor: 'pointer' }}>
                <input type="checkbox" checked={d.incluir} onChange={e => editar(d.key, { incluir: e.target.checked })} />
                Guardar
              </label>
            </div>
            {d.plantaExistenteId && (
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--color-slate-smoke)', cursor: 'pointer', marginTop: '8px' }}>
                <input type="checkbox" checked={d.actualizarFoto} onChange={e => editar(d.key, { actualizarFoto: e.target.checked })} />
                Usar la primera captura como foto de la planta
              </label>
            )}
          </div>
        );
      })}

      {detecciones.length > 0 && (
        <>
          <div ref={mapaRef} className="card" style={{ marginBottom: '20px', padding: '12px' }}>
            <p className="field-label" style={{ display: 'block', marginBottom: '8px' }}>Posición en la parcela</p>
            {colocandoDeteccion ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '10px', backgroundColor: 'var(--color-ash-gray)', borderRadius: '8px', padding: '8px 12px' }}>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: 'var(--color-forest-ink)' }}>
                  Toca el mapa donde está «{colocandoDeteccion.nombre}»
                </p>
                <button className="chip-btn" onClick={() => setColocando(null)}>Cancelar</button>
              </div>
            ) : (
              <p className="field-hint" style={{ marginBottom: '10px' }}>
                Cada pin lleva el número de su tarjeta. Arrástralos a su sitio exacto, o usa
                «⌖ Ubicar» en la tarjeta y toca el punto del mapa.
              </p>
            )}
            <MapaRevision
              parcel={parcel}
              marcadores={incluidas.map((d, i) => ({
                key: d.key,
                nombre: d.nombre,
                numero: i + 1,
                lat: d.lat,
                lng: d.lng,
                categoria: categoriaDeEspecie(d.especie, d.nombre),
              }))}
              colocando={colocando}
              onMover={(key, lat, lng) => { editar(key, { lat, lng }); setColocando(null); }}
            />
          </div>

          <button onClick={guardar} disabled={guardando || incluidas.length === 0} className="btn-solid" style={{ width: '100%' }}>
            {guardando
              ? (progreso || 'Guardando…')
              : `Guardar ${incluidas.length} ${incluidas.length === 1 ? 'planta' : 'plantas'} (${incluidas.reduce((n, d) => n + d.fotos.length, 0)} fotos)`}
          </button>
        </>
      )}

      <input
        ref={refotoRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) procesarArchivo(f, refotoKeyRef.current);
          refotoKeyRef.current = null;
          e.target.value = '';
        }}
      />
    </main>
  );
}
