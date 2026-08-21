// @ts-nocheck
'use client';

import React, { useState, useTransition } from 'react';
import { estadoDeEvento } from '@/lib/estado-evento';

interface Event {
  id: string;
  type: string;
  date: string;
  notes?: string;
  plant_id?: string;
  product_id?: string;
  plants?: { name: string, species: string };
  products?: { name: string };
}

interface CalendarViewToggleProps {
  events: Event[];
}

export default function CalendarViewToggle({ events }: CalendarViewToggleProps) {
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [mesOffset, setMesOffset] = useState(0);
  const [isPending, startTransition] = useTransition();

  // Fecha local del dispositivo: con toISOString (UTC) la agenda seguía
  // marcando "Hoy" el día anterior hasta las 2 de la madrugada.
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Funciones de utilidad para el Grid
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => {
    let day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Lunes = 0, Domingo = 6
  };

  // El mes que se está mirando, que ya no tiene por qué ser el actual: sin
  // navegación no había forma de ver los avisos del plan anual.
  const mesVisible = new Date(today.getFullYear(), today.getMonth() + mesOffset, 1);
  const currentYear = mesVisible.getFullYear();
  const currentMonth = mesVisible.getMonth();
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const dayNames = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  const estadoDe = (e: Event) => estadoDeEvento(e.notes, e.date, todayStr);

  const COLOR_ESTADO = {
    hecho: { fondo: 'var(--color-ash-gray)', texto: 'var(--color-slate-smoke)', marca: '✓' },
    atrasado: { fondo: 'var(--color-alert-wash)', texto: 'var(--color-alert)', marca: '!' },
    hoy: { fondo: 'var(--color-deep-fern)', texto: 'white', marca: '●' },
    futuro: { fondo: 'var(--color-forest-ink)', texto: 'white', marca: '' },
  } as const;

  const renderGrid = () => {
    const days = [];

    // Celdas vacías al principio
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} style={{ padding: '10px', backgroundColor: 'var(--color-ash-gray)', border: '1px solid var(--color-lichen)' }}></div>);
    }

    // Días del mes
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const isToday = dateStr === todayStr;
      const dayEvents = events.filter(e => e.date === dateStr);

      days.push(
        <div key={i} style={{
          padding: '5px',
          minHeight: '70px',
          backgroundColor: 'white',
          border: `1px solid ${isToday ? 'var(--color-deep-fern)' : 'var(--color-lichen)'}`,
          boxShadow: isToday ? 'inset 0 0 0 1px var(--color-deep-fern)' : 'none',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            fontWeight: isToday ? 500 : 400,
            color: isToday ? 'var(--color-deep-fern)' : 'var(--color-slate-smoke)',
            marginBottom: '4px'
          }}>
            {i}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto' }}>
            {dayEvents.map(e => {
              const c = COLOR_ESTADO[estadoDe(e)];
              const etiqueta = e.products?.name || e.type;
              return (
                <div
                  key={e.id}
                  style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', backgroundColor: c.fondo, color: c.texto, padding: '2px 4px', borderRadius: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  title={`${etiqueta}${e.plants?.name ? ` en ${e.plants.name}` : ''}`}
                >
                  {c.marca ? `${c.marca} ` : ''}{etiqueta}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    const leyenda = [
      { estado: 'atrasado', texto: 'Atrasado' },
      { estado: 'hoy', texto: 'Hoy' },
      { estado: 'futuro', texto: 'Programado' },
      { estado: 'hecho', texto: 'Hecho' },
    ] as const;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', paddingBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 12px 0' }}>
          <button onClick={() => setMesOffset(m => m - 1)} className="chip-btn" aria-label="Mes anterior">←</button>
          <h4 className="suisse" style={{ textAlign: 'center', margin: 0, fontSize: '15px' }}>
            {monthNames[currentMonth]} {currentYear}
          </h4>
          <div style={{ display: 'flex', gap: '5px' }}>
            {mesOffset !== 0 && (
              <button onClick={() => setMesOffset(0)} className="chip-btn" aria-label="Volver a este mes">Hoy</button>
            )}
            <button onClick={() => setMesOffset(m => m + 1)} className="chip-btn" aria-label="Mes siguiente">→</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0', borderBottom: '1px solid var(--color-lichen)', paddingBottom: '5px' }}>
          {dayNames.map(d => (
            <div key={d} style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 500, color: 'var(--color-slate-smoke)' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0', borderLeft: '1px solid var(--color-lichen)', borderTop: '1px solid var(--color-lichen)' }}>
          {days}
        </div>
        <div style={{ marginTop: '15px', display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', fontSize: '10px', color: 'var(--color-slate-smoke)' }}>
          {leyenda.map(l => (
            <div key={l.estado} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '10px', height: '10px', backgroundColor: COLOR_ESTADO[l.estado].fondo, border: '1px solid var(--color-lichen)', borderRadius: '2px' }}></div>
              <span>{l.texto}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const formatEuropeanDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  /**
   * Desmenuza las notas del evento. Las etiquetas de estado y la frase
   * repetitiva "Tarea programada cada N días (aplicación X). Revisar hasta: Y."
   * se convierten en datos; el texto que queda es lo que escribió el usuario.
   */
  const parseReason = (reason: string, frequencyDays?: number | null) => {
    let texto = reason;

    const pospuesto = texto.includes('[POSPUESTO]');
    const hecho = texto.includes('[HECHO]');
    const fin = texto.includes('[FIN]');
    texto = texto.replace(/\[(PROGRAMADO|POSPUESTO|HECHO|FIN)\]/g, '');

    // La frecuencia viene de la columna del evento; los antiguos la llevaban
    // escrita como "[FREQ:15]" y se lee de ahí como respaldo.
    const etiquetaAntigua = texto.match(/\[FREQ:(\d+)\]/);
    const dias = frequencyDays || (etiquetaAntigua ? parseInt(etiquetaAntigua[1], 10) : 0);

    const metodo = texto.match(/\(aplicación ([^)]+)\)/)?.[1] || null;
    const hasta = texto.match(/Revisar hasta: (.+?)\.(?:\s|$)/)?.[1] || null;

    texto = texto
      .replace(/\[FREQ:\d+\]/g, '')
      .replace(/Tarea programada cada \d+ días(\s*\(aplicación [^)]+\))?\./g, '')
      .replace(/\(aplicación [^)]+\)/g, '')
      .replace(/Revisar hasta: .+?\.(?=\s|$)/g, '')
      .replace(/\(Manual\)/g, '')
      .replace(/\(\)/g, '')
      .trim();

    return { texto, dias, metodo, hasta, pospuesto, hecho, fin };
  };

  const tituloDe = (item) => {
    const actionName = item.product_name ? item.product_name : item.type;
    if (item.plant_name && item.plant_name !== 'General') {
      return `${actionName} en ${item.plant_name}`;
    }
    return item.product_name ? `Aplicación de ${actionName}` : `Tratamiento de ${actionName}`;
  };

  const enlace = {
    fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'var(--color-deep-fern)', textDecoration: 'none',
    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
  } as const;

  const renderList = () => {
    const combinedList = [
      // El estado sale del mismo sitio que usa la rejilla, para que las dos
      // vistas no puedan contradecirse.
      ...events.map(e => {
        const estado = estadoDe(e);
        return {
          id: e.id,
          type: e.type,
          plant_id: e.plant_id,
          product_id: e.product_id,
          plant_name: e.plants?.name || e.plants?.species || 'General',
          product_name: e.products?.name || '',
          reason: e.notes || '',
          frequency_days: e.frequency_days,
          date: e.date,
          urgency: estado === 'atrasado' ? 'alta' : (estado === 'hoy' ? 'media' : 'baja'),
          isPast: estado === 'hecho',
          isSuggestion: e.notes?.includes('[PROGRAMADO]') && !e.notes?.includes('[HECHO]'),
        };
      })
    ];

    combinedList.sort((a, b) => {
      if (a.isPast !== b.isPast) {
        return a.isPast ? 1 : -1;
      }
      if (!a.isPast) {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    if (combinedList.length === 0) {
      return (
        <div className="card" style={{ textAlign: 'center' }}>
          <p className="body-text" style={{ margin: '0 auto', fontSize: '13px' }}>
            Nada en la agenda todavía. Registra un tratamiento con «+ Añadir» y aquí
            aparecerán los próximos avisos.
          </p>
        </div>
      );
    }

    const pendientes = combinedList.filter(i => !i.isPast);
    const historial = combinedList.filter(i => i.isPast);
    // Lo atrasado va primero y bajo su propio rótulo: es lo único que obliga a
    // decidir algo hoy, y antes se perdía entre los avisos futuros.
    const atrasados = pendientes.filter(i => i.urgency === 'alta');
    const proximos = pendientes.filter(i => i.urgency !== 'alta');

    const tarjeta = (item, idx) => {
          const isUrgent = item.urgency === 'alta';
          const isToday = item.urgency === 'media';
          const info = parseReason(item.reason, item.frequency_days);

          const borde = isUrgent ? 'var(--color-alert)' : (isToday ? 'var(--color-deep-fern)' : 'var(--color-muted-sage)');
          const meta = [
            info.dias > 0 ? `cada ${info.dias} días` : null,
            info.metodo ? `aplicación ${info.metodo}` : null,
            info.hasta ? `hasta: ${info.hasta}` : null,
          ].filter(Boolean).join(' · ');

          return (
            <div key={item.id || idx} className="card" style={{ borderLeft: `3px solid ${borde}`, padding: '13px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', marginBottom: '7px' }}>
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className="tag">{item.type}</span>
                  {isUrgent && <span className="tag tag--alert">Atrasado</span>}
                  {isToday && <span className="tag tag--fern">Hoy</span>}
                  {info.pospuesto && <span className="tag tag--muted">Pospuesto</span>}
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 500, whiteSpace: 'nowrap', color: isUrgent ? 'var(--color-alert)' : 'var(--color-forest-ink)' }}>
                  {formatEuropeanDate(item.date)}
                </span>
              </div>

              <h3 className="suisse" style={{ fontSize: '15px', margin: '0 0 3px 0' }}>{tituloDe(item)}</h3>
              {meta && (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', color: 'var(--color-slate-smoke)', margin: '0 0 4px 0', lineHeight: 1.5 }}>{meta}</p>
              )}
              {info.texto && (
                <p className="body-text" style={{ fontSize: '12px', margin: '0 0 4px 0', lineHeight: 1.45 }}>{info.texto}</p>
              )}

              {item.id && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginTop: '9px' }}>
                  <div style={{ display: 'flex', gap: '14px' }}>
                    <a href={`/calendar/${item.id}/edit`} style={enlace}>[ Editar ]</a>
                    {item.isSuggestion && (
                      <button
                        style={{ ...enlace, color: 'var(--color-slate-smoke)' }}
                        disabled={isPending}
                        onClick={() => {
                          if (!window.confirm('¿Dar por terminado este tratamiento? Se eliminan sus próximos avisos programados; el historial se conserva.')) return;
                          startTransition(async () => {
                            const { terminarTratamiento } = await import('@/app/actions');
                            await terminarTratamiento(item.id);
                          });
                        }}
                      >
                        [ Terminar ]
                      </button>
                    )}
                  </div>
                  {(item.isSuggestion || isUrgent || isToday) && (
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button
                        className="chip-btn"
                        disabled={isPending}
                        onClick={() => {
                          startTransition(async () => {
                            const { postponeEvent } = await import('@/app/actions');
                            await postponeEvent(item.id);
                          });
                        }}
                      >
                        +1 día
                      </button>
                      <button
                        className="chip-btn chip-btn--primary"
                        disabled={isPending}
                        onClick={() => {
                          startTransition(async () => {
                            const { completeEvent } = await import('@/app/actions');
                            await completeEvent(item.id);
                          });
                        }}
                      >
                        ✓ Hecho
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
      );
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {atrasados.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="field-label" style={{ fontSize: '10px', color: 'var(--color-alert)' }}>[ Atrasado ]</span>
              <div className="hairline" style={{ flex: 1, width: 'auto' }} />
            </div>
            {atrasados.map(tarjeta)}
          </>
        )}

        {proximos.map(tarjeta)}

        {historial.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '12px 0 0' }}>
              <span className="field-label" style={{ fontSize: '10px' }}>[ Historial ]</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9.5px', color: 'var(--color-slate-smoke)' }}>↩ no lo hice</span>
              <div className="hairline" style={{ flex: 1, width: 'auto' }} />
            </div>
            <div>
              {historial.map((item, idx) => {
                const info = parseReason(item.reason, item.frequency_days);
                return (
                  <div key={item.id || `h${idx}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 2px', borderBottom: '1px solid var(--color-ash-gray)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-slate-smoke)', flex: '0 0 auto' }}>
                      {formatEuropeanDate(item.date)}
                    </span>
                    <span style={{ fontSize: '13px', color: 'var(--color-slate-smoke)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={info.texto || undefined}>
                      {tituloDe(item)}
                    </span>
                    {info.fin && <span className="tag tag--muted">Fin</span>}
                    {item.id && !info.fin && (
                      <button
                        style={{ ...enlace, fontSize: '11px' }}
                        disabled={isPending}
                        title="No lo hice: devolver a pendientes"
                        aria-label="Devolver a pendientes"
                        onClick={() => {
                          startTransition(async () => {
                            const { reabrirEvento } = await import('@/app/actions');
                            await reabrirEvento(item.id);
                          });
                        }}
                      >
                        ↩
                      </button>
                    )}
                    {item.id && <a href={`/calendar/${item.id}/edit`} style={{ ...enlace, fontSize: '11px' }} aria-label="Editar registro">✎</a>}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
        <div style={{ display: 'flex', backgroundColor: 'var(--color-ash-gray)', borderRadius: '10px', padding: '2px', border: '1px solid var(--color-lichen)' }}>
          {(['list', 'grid'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: '4px 12px', borderRadius: '8px',
                fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 500,
                letterSpacing: '0.1em', textTransform: 'uppercase', border: 'none',
                backgroundColor: view === v ? 'white' : 'transparent',
                color: view === v ? 'var(--color-forest-ink)' : 'var(--color-slate-smoke)',
                boxShadow: view === v ? 'var(--shadow-subtle)' : 'none',
                cursor: 'pointer', transition: 'all 0.2s ease'
              }}
            >
              {v === 'list' ? 'Lista' : 'Mes'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '5px' }}>
        {view === 'list' ? renderList() : renderGrid()}
      </div>
    </div>
  );
}
