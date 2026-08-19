'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { guardarRecorrido } from '@/app/actions';
import { categoriaDeEspecie } from '@/lib/plant-icons';

const MapaRevision = dynamic(() => import('./MapaRevision'), { ssr: false });

export type PlantaRegistrada = {
  id: string;
  name: string;
  species: string | null;
  tienePosicion: boolean;
  tieneFoto: boolean;
};

export type Deteccion = {
  key: string;
  foto: string; // dataURL JPEG
  nombre: string;
  especie: string;
  confianza: 'alta' | 'media' | 'baja';
  sintomas: string | null;
  motivo: string;
  lat: number | null;
  lng: number | null;
  plantaExistenteId: string; // '' = planta nueva
  actualizarFoto: boolean; // en las ya registradas: usar esta captura como su foto
  incluir: boolean;
};

type Fase = 'inicio' | 'camara' | 'revision' | 'guardado';

const LADO_MAXIMO = 768; // px del lado mayor del fotograma que se manda a la IA

/** Reduce una imagen (vídeo o foto) a JPEG comprimido para el análisis. */
function aJpegReducido(fuente: HTMLVideoElement | HTMLImageElement, ancho: number, alto: number): string {
  const escala = Math.min(1, LADO_MAXIMO / Math.max(ancho, alto));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(ancho * escala);
  canvas.height = Math.round(alto * escala);
  canvas.getContext('2d')!.drawImage(fuente, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.78);
}

export default function RecorridoClient({ plantas, parcel }: { plantas: PlantaRegistrada[]; parcel: object | null }) {
  const [fase, setFase] = useState<Fase>('inicio');
  const [detecciones, setDetecciones] = useState<Deteccion[]>([]);
  const [analizando, setAnalizando] = useState(false);
  const [auto, setAuto] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);
  const [errorCamara, setErrorCamara] = useState<string | null>(null);
  const [colocando, setColocando] = useState<string | null>(null); // key de la detección que se está colocando en el mapa
  const [guardando, setGuardando] = useState(false);
  const [resumen, setResumen] = useState<{ creadas: string[]; actualizadas: string[]; errores: string[] } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const posRef = useRef<{ lat: number; lng: number } | null>(null);
  const watchRef = useRef<number | null>(null);
  const analizandoRef = useRef(false);
  const deteccionesRef = useRef<Deteccion[]>([]);
  const contadorRef = useRef(0);
  const refotoRef = useRef<HTMLInputElement>(null);
  const refotoKeyRef = useRef<string | null>(null);

  // La cola de análisis necesita la lista al día sin re-crear callbacks.
  useEffect(() => {
    deteccionesRef.current = detecciones;
  }, [detecciones]);

  // Limpieza al desmontar: apagar cámara y GPS.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (watchRef.current != null) navigator.geolocation?.clearWatch(watchRef.current);
    };
  }, []);

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
    try {
      const res = await fetch('/api/walkthrough/frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imagen: dataUrl.split(',')[1],
          detectadas: deteccionesRef.current.map(d => d.especie),
        }),
      });
      if (!res.ok) {
        setAviso('El análisis falló; sigue, se reintenta en la próxima captura.');
        return;
      }
      const r = await res.json();
      if (!r.hay_planta) {
        setAviso('Sin planta clara en el encuadre.');
        return;
      }
      if (r.ya_vista_en_recorrido) {
        setAviso(`${r.nombre_comun || r.especie}: ya la tenía de este recorrido.`);
        return;
      }
      const existente = r.coincide_con_registrada
        ? plantas.find(p => p.name.toLowerCase() === r.coincide_con_registrada.toLowerCase())
        : null;
      const nueva: Deteccion = {
        key: `d${++contadorRef.current}`,
        foto: dataUrl,
        nombre: r.nombre_comun || r.especie,
        especie: r.especie,
        confianza: r.confianza,
        sintomas: r.sintomas,
        motivo: r.motivo,
        lat: posRef.current?.lat ?? null,
        lng: posRef.current?.lng ?? null,
        plantaExistenteId: existente?.id || '',
        actualizarFoto: existente ? !existente.tieneFoto : true,
        incluir: true,
      };
      setDetecciones(prev => [...prev, nueva]);
      setAviso(existente
        ? `${nueva.nombre} — ya registrada como «${existente.name}».`
        : `+ ${nueva.nombre} (confianza ${r.confianza})`);
    } catch {
      setAviso('Error de red analizando; se reintenta en la próxima captura.');
    } finally {
      analizandoRef.current = false;
      setAnalizando(false);
    }
  };

  // --- Captura inteligente ---------------------------------------------------
  // Nada de disparar por reloj: cada 1,2 s se toma una miniatura barata del
  // encuadre y se compara con la anterior (¿está quieta la cámara?) y con la
  // última analizada (¿es una escena nueva?). Solo cuando te paras delante de
  // algo nuevo se manda el fotograma a la IA; caminar no gasta análisis.
  const LADO_MINIATURA = 48;
  const miniPrevRef = useRef<Uint8ClampedArray | null>(null);
  const miniAnalizadaRef = useRef<Uint8ClampedArray | null>(null);
  const ultimoAnalisisRef = useRef(0);

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

      const estable = diferencia(ahora, antes) < 0.04;
      const escenaNueva = !miniAnalizadaRef.current || diferencia(ahora, miniAnalizadaRef.current) > 0.12;
      const conMargen = Date.now() - ultimoAnalisisRef.current > 4000;
      if (estable && escenaNueva && conMargen) capturar();
    }, 1200);
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
        // Re-foto de una detección dudosa: sustituye la imagen y se re-identifica.
        setDetecciones(prev => prev.map(d => d.key === keyExistente ? { ...d, foto: dataUrl } : d));
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
        body: JSON.stringify({ imagen: dataUrl.split(',')[1], detectadas: [] }),
      });
      if (res.ok) {
        const r = await res.json();
        if (r.hay_planta) {
          setDetecciones(prev => prev.map(d => d.key === key
            ? { ...d, nombre: r.nombre_comun || r.especie, especie: r.especie, confianza: r.confianza, sintomas: r.sintomas, motivo: r.motivo }
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

  const guardar = async () => {
    setGuardando(true);
    try {
      const r = await guardarRecorrido(
        detecciones.filter(d => d.incluir).map(d => ({
          nombre: d.nombre,
          especie: d.especie,
          descripcion: [d.motivo, d.sintomas ? `Síntomas vistos en el recorrido: ${d.sintomas}` : null].filter(Boolean).join(' '),
          foto: d.foto,
          lat: d.lat,
          lng: d.lng,
          plantaExistenteId: d.plantaExistenteId || null,
          actualizarFoto: d.actualizarFoto,
        })),
      );
      setResumen(r);
      setFase('guardado');
    } catch {
      setResumen({ creadas: [], actualizadas: [], errores: ['No se pudo guardar el recorrido. Inténtalo de nuevo.'] });
      setFase('guardado');
    }
    setGuardando(false);
  };

  const etiquetaConfianza = (c: Deteccion['confianza']) =>
    c === 'alta' ? 'tag tag--fern' : c === 'media' ? 'tag' : 'tag tag--alert';

  /* ------------------------------------------------------------------ fases */

  if (fase === 'inicio') {
    return (
      <main className="container" style={{ paddingTop: '110px', paddingBottom: '80px', maxWidth: '640px' }}>
        <p className="eyebrow" style={{ marginBottom: '10px' }}>Gemelo digital</p>
        <h1 className="heading-text suisse" style={{ marginBottom: '16px' }}>recorrido por<br />el jardín.</h1>
        <p className="body-text" style={{ marginBottom: '24px' }}>
          Pasea por el jardín con la cámara abierta enfocando cada planta. La app las identifica
          sobre la marcha, detecta las que ya tienes registradas y al terminar te enseña la lista
          para revisarla y colocarlas en la parcela.
        </p>
        <div className="card" style={{ marginBottom: '24px' }}>
          <p className="field-label" style={{ marginBottom: '10px', display: 'block' }}>Cómo funciona</p>
          <ol style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: 'var(--color-slate-smoke)', lineHeight: 1.7 }}>
            <li>Acepta los permisos de <strong>cámara</strong> y <strong>ubicación</strong> (la posición GPS es el borrador para colocar cada planta).</li>
            <li>Párate 2–3 segundos delante de cada planta: la cámara dispara sola cuando ve una escena nueva y estable. Caminar no gasta análisis.</li>
            <li>Al terminar, revisa la lista: corrige nombres, repite la foto de las dudosas y ajusta los pins en el mapa.</li>
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

        {/* Cabecera: estado y contador */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'linear-gradient(rgba(9,53,46,0.65), transparent)' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'white' }}>
            [ Recorrido ]
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'white' }}>
            {analizando ? 'analizando…' : `${detecciones.length} detectadas`}
          </span>
        </div>

        {/* Último aviso */}
        {aviso && (
          <div style={{ position: 'absolute', top: '56px', left: '16px', right: '16px', zIndex: 1, textAlign: 'center' }}>
            <span style={{ display: 'inline-block', backgroundColor: 'rgba(9,53,46,0.85)', color: 'white', fontFamily: 'var(--font-mono)', fontSize: '11px', padding: '6px 12px', borderRadius: '9999px' }}>
              {aviso}
            </span>
          </div>
        )}

        {/* Lista viva de detecciones */}
        <div style={{ position: 'absolute', bottom: '120px', left: 0, right: 0, zIndex: 1, display: 'flex', gap: '6px', overflowX: 'auto', padding: '0 16px' }}>
          {detecciones.map(d => (
            <span key={d.key} style={{ flex: '0 0 auto', backgroundColor: 'rgba(255,255,255,0.92)', color: 'var(--color-forest-ink)', fontFamily: 'var(--font-mono)', fontSize: '10px', padding: '5px 10px', borderRadius: '9999px', whiteSpace: 'nowrap' }}>
              {d.nombre}{d.plantaExistenteId ? ' ·ya registrada' : ''}
            </span>
          ))}
        </div>

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
            Terminar
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
    return (
      <main className="container" style={{ paddingTop: '110px', paddingBottom: '80px', maxWidth: '640px' }}>
        <p className="eyebrow" style={{ marginBottom: '10px' }}>Gemelo digital</p>
        <h1 className="heading-text suisse" style={{ marginBottom: '20px' }}>recorrido<br />guardado.</h1>
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
              {resumen?.actualizadas.join(' · ')} — ya estaban registradas; se les añadió lo que les faltaba.
            </p>
          )}
          {(resumen?.errores.length ?? 0) > 0 && (
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-alert)' }}>{resumen?.errores.join(' ')}</p>
          )}
          {resumen && resumen.creadas.length === 0 && resumen.actualizadas.length === 0 && resumen.errores.length === 0 && (
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-slate-smoke)' }}>No había nada que guardar.</p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
          <Link href="/" className="btn-solid" style={{ textDecoration: 'none', flex: 1 }}>Ver la parcela</Link>
          <Link href="/plants" className="btn-outline" style={{ textDecoration: 'none', flex: 1 }}>Mis plantas</Link>
        </div>
      </main>
    );
  }

  /* ---------------------------------------------------------------- revisión */

  const incluidas = detecciones.filter(d => d.incluir);

  return (
    <main className="container" style={{ paddingTop: '90px', paddingBottom: '110px', maxWidth: '760px' }}>
      <p className="eyebrow" style={{ marginBottom: '10px' }}>Gemelo digital · revisión</p>
      <h1 className="heading-text suisse" style={{ marginBottom: '12px' }}>lo que ha visto<br />el recorrido.</h1>
      <p className="body-text" style={{ marginBottom: '24px', fontSize: '13px' }}>
        Corrige lo que haga falta antes de guardar: nombre y especie son editables, las dudosas
        piden mejor foto, y los pins del mapa se pueden arrastrar a su sitio exacto.
      </p>

      {detecciones.length === 0 && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-slate-smoke)' }}>
            El recorrido no detectó ninguna planta. Puedes volver a intentarlo caminando más
            despacio y acercándote más a cada planta.
          </p>
        </div>
      )}

      {detecciones.map(d => (
        <div key={d.key} className="card" style={{ marginBottom: '14px', opacity: d.incluir ? 1 : 0.55 }}>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={d.foto} alt={d.nombre} style={{ width: '76px', height: '76px', objectFit: 'cover', borderRadius: '8px', flex: '0 0 auto', border: '1px solid var(--color-lichen)' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '8px' }}>
                <span className={etiquetaConfianza(d.confianza)}>Confianza {d.confianza}</span>
                {d.sintomas && <span className="tag tag--alert">Síntomas</span>}
                {d.plantaExistenteId && <span className="tag">Ya registrada</span>}
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
              <p className="field-hint" style={{ marginTop: '6px' }}>{d.motivo}{d.sintomas ? ` — ${d.sintomas}` : ''}</p>

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
                {d.confianza === 'baja' && (
                  <button
                    className="chip-btn"
                    onClick={() => { refotoKeyRef.current = d.key; refotoRef.current?.click(); }}
                  >
                    Repetir foto
                  </button>
                )}
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--color-slate-smoke)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={d.incluir} onChange={e => editar(d.key, { incluir: e.target.checked })} />
                  Guardar
                </label>
              </div>
              {d.plantaExistenteId && (
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--color-slate-smoke)', cursor: 'pointer', marginTop: '8px' }}>
                  <input type="checkbox" checked={d.actualizarFoto} onChange={e => editar(d.key, { actualizarFoto: e.target.checked })} />
                  Usar esta captura como foto de la planta
                </label>
              )}
            </div>
          </div>
        </div>
      ))}

      {detecciones.length > 0 && (
        <>
          <div className="card" style={{ marginBottom: '20px', padding: '12px' }}>
            <p className="field-label" style={{ display: 'block', marginBottom: '8px' }}>Posición en la parcela</p>
            <p className="field-hint" style={{ marginBottom: '10px' }}>
              Los pins salen del GPS del recorrido: arrástralos a su sitio exacto. Si a alguna le
              falta pin, toca «Colocar» y después el punto del mapa donde está.
            </p>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {incluidas.map(d => (
                <button
                  key={d.key}
                  className="chip-btn"
                  style={colocando === d.key ? { borderColor: 'var(--color-deep-fern)', color: 'var(--color-deep-fern)' } : undefined}
                  onClick={() => setColocando(c => c === d.key ? null : d.key)}
                >
                  {d.lat == null ? '⌖ ' : ''}{d.nombre}
                </button>
              ))}
            </div>
            <MapaRevision
              parcel={parcel}
              marcadores={incluidas.map(d => ({
                key: d.key,
                nombre: d.nombre,
                lat: d.lat,
                lng: d.lng,
                categoria: categoriaDeEspecie(d.especie, d.nombre),
              }))}
              colocando={colocando}
              onMover={(key, lat, lng) => { editar(key, { lat, lng }); setColocando(null); }}
            />
          </div>

          <button onClick={guardar} disabled={guardando || incluidas.length === 0} className="btn-solid" style={{ width: '100%' }}>
            {guardando ? 'Guardando…' : `Guardar ${incluidas.length} ${incluidas.length === 1 ? 'planta' : 'plantas'}`}
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
