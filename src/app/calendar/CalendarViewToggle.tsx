// @ts-nocheck
'use client';

import React, { useState, useTransition } from 'react';

interface Recommendation {
  type: string;
  plant_name: string;
  product_name: string;
  reason: string;
  date: string;
  urgency: string;
}

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
  recommendations: Recommendation[];
  events: Event[];
}

export default function CalendarViewToggle({ recommendations, events }: CalendarViewToggleProps) {
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [isPending, startTransition] = useTransition();

  const todayStr = new Date().toISOString().split('T')[0];

  // Funciones de utilidad para el Grid
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => {
    let day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Lunes = 0, Domingo = 6
  };

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const dayNames = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  const renderGrid = () => {
    const days = [];

    // Celdas vacías al principio
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} style={{ padding: '10px', backgroundColor: 'var(--color-ash-gray)', border: '1px solid var(--color-lichen)' }}></div>);
    }

    // Días del mes
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const isToday = i === today.getDate();

      const dayRecs = recommendations.filter(r => r.date === dateStr);
      const dayEvents = events.filter(e => e.date === dateStr);

      days.push(
        <div key={i} style={{
          padding: '5px',
          minHeight: '70px',
          backgroundColor: 'white',
          border: `1px solid ${isToday ? 'var(--color-deep-fern)' : 'var(--color-lichen)'}`,
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
            {dayEvents.map(e => (
              <div key={e.id} style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', backgroundColor: 'var(--color-ash-gray)', color: 'var(--color-deep-fern)', padding: '2px 4px', borderRadius: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={`${e.type} (Hecho)`}>
                ✓ {e.type}
              </div>
            ))}
            {dayRecs.map((r, idx) => (
              <div key={`rec-${idx}`} style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', backgroundColor: r.urgency === 'alta' ? 'var(--color-alert-wash)' : 'var(--color-forest-ink)', color: r.urgency === 'alta' ? 'var(--color-alert)' : 'white', padding: '2px 4px', borderRadius: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.type}>
                {r.type}
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', paddingBottom: '20px' }}>
        <h4 className="suisse" style={{ textAlign: 'center', margin: '0 0 15px 0', fontSize: '15px' }}>
          {monthNames[currentMonth]} {currentYear}
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0', borderBottom: '1px solid var(--color-lichen)', paddingBottom: '5px' }}>
          {dayNames.map(d => (
            <div key={d} style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 500, color: 'var(--color-slate-smoke)' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0', borderLeft: '1px solid var(--color-lichen)', borderTop: '1px solid var(--color-lichen)' }}>
          {days}
        </div>
        <div style={{ marginTop: '15px', display: 'flex', gap: '15px', justifyContent: 'center', fontSize: '10px', color: 'var(--color-slate-smoke)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '10px', height: '10px', backgroundColor: 'var(--color-ash-gray)', border: '1px solid var(--color-lichen)', borderRadius: '2px' }}></div>
            <span>Registro</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '10px', height: '10px', backgroundColor: 'var(--color-forest-ink)', borderRadius: '2px' }}></div>
            <span>Tarea Pendiente</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '10px', height: '10px', backgroundColor: 'var(--color-alert-wash)', border: '1px solid var(--color-alert)', borderRadius: '2px' }}></div>
            <span>Urgente</span>
          </div>
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

  const parseReason = (reason: string, frequencyDays?: number | null) => {
    const tags: { text: string, className: string }[] = [];
    let cleanText = reason;

    if (cleanText.includes('[PROGRAMADO]')) {
      tags.push({ text: 'PROGRAMADO', className: 'tag' });
      cleanText = cleanText.replace(/\[PROGRAMADO\]/g, '');
    }
    if (cleanText.includes('[POSPUESTO]')) {
      tags.push({ text: 'POSPUESTO', className: 'tag tag--muted' });
      cleanText = cleanText.replace(/\[POSPUESTO\]/g, '');
    }
    if (cleanText.includes('[HECHO]')) {
      tags.push({ text: 'HECHO', className: 'tag tag--fern' });
      cleanText = cleanText.replace(/\[HECHO\]/g, '');
    }
    if (cleanText.includes('[FIN]')) {
      tags.push({ text: 'TERMINADO', className: 'tag tag--muted' });
      cleanText = cleanText.replace(/\[FIN\]/g, '');
    }

    // La frecuencia viene de la columna del evento. Los eventos antiguos la
    // llevan escrita en el propio texto como "[FREQ:15] (Manual)": se lee de ahí
    // como respaldo y se limpia para que no salga en pantalla.
    const etiquetaAntigua = cleanText.match(/\[FREQ:(\d+)\]/);
    const dias = frequencyDays || (etiquetaAntigua ? parseInt(etiquetaAntigua[1], 10) : 0);
    if (dias > 0) {
      tags.push({ text: `CADA ${dias} DÍAS`, className: 'tag tag--fern' });
    }
    cleanText = cleanText
      .replace(/\[FREQ:\d+\]/g, '')
      .replace(/\(Manual\)/g, '')
      .replace(/\(\)/g, '')
      .trim();

    return { cleanText, tags };
  };

  const renderList = () => {
    const combinedList = [
      ...recommendations.map(r => ({ ...r, isPast: false })),
      ...events.map(e => ({
        id: e.id,
        type: e.type,
        plant_id: e.plant_id,
        product_id: e.product_id,
        plant_name: e.plants?.name || e.plants?.species || 'General',
        product_name: e.products?.name || '',
        reason: e.notes || (e.date <= todayStr ? 'Tratamiento completado y registrado.' : 'Tarea pendiente de realizar.'),
        frequency_days: e.frequency_days,
        date: e.date,
        urgency: e.date <= todayStr ? (e.date < todayStr ? 'alta' : 'media') : 'baja',
        isPast: e.notes?.includes('[HECHO]') || (e.date < todayStr && !e.notes?.includes('[PROGRAMADO]')),
        isScheduled: e.date > todayStr && !e.notes?.includes('[PROGRAMADO]') && !e.notes?.includes('[HECHO]'),
        isSuggestion: e.notes?.includes('[PROGRAMADO]') && !e.notes?.includes('[HECHO]')
      }))
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
          <p className="body-text" style={{ margin: '0 auto', fontSize: '13px' }}>No hay tareas pendientes ni historial. ¡Añade tu primer tratamiento!</p>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {combinedList.map((item, idx: number) => {
          const isUrgent = item.urgency === 'alta' && !item.isPast;
          const isToday = item.urgency === 'media' && !item.isPast;

          // Un solo acento cromático: terracota para lo atrasado. El resto de
          // estados se dice en la familia verde-salvia.
          let borderColor = 'var(--color-muted-sage)';
          if (item.isPast) {
            borderColor = 'var(--color-lichen)';
          } else if (isUrgent) {
            borderColor = 'var(--color-alert)';
          } else if (isToday) {
            borderColor = 'var(--color-deep-fern)';
          }

          const typeTagClass = item.isPast
            ? 'tag tag--muted'
            : (isUrgent ? 'tag tag--alert' : (isToday ? 'tag tag--ink' : 'tag'));

          const { cleanText, tags } = parseReason(item.reason, (item as { frequency_days?: number | null }).frequency_days);

          return (
            <div key={idx} className="card" style={{
              borderLeft: `3px solid ${borderColor}`,
              opacity: item.isPast ? 0.75 : 1,
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              gap: '10px',
              padding: '14px 16px'
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <span className={typeTagClass}>
                    {item.isPast ? `✓ ${item.type}` : item.type}
                  </span>
                  {isUrgent && <span className="tag tag--alert">Atrasado</span>}
                  {isToday && <span className="tag tag--fern">Hoy</span>}
                  {item.isPast && <span className="tag tag--muted">Registro</span>}
                </div>

                <h3 className="suisse" style={{ fontSize: '15px', margin: '0 0 6px 0', color: item.isPast ? 'var(--color-slate-smoke)' : 'var(--color-forest-ink)', textDecoration: item.isPast ? 'line-through' : 'none' }}>
                  {(() => {
                    const actionName = item.product_name ? item.product_name : item.type;
                    if (item.plant_name && item.plant_name !== 'General') {
                      return `${actionName} en ${item.plant_name}`;
                    } else {
                      return item.product_name ? `Aplicación de ${actionName}` : `Tratamiento de ${actionName}`;
                    }
                  })()}
                </h3>

                {cleanText && (
                  <p className="body-text" style={{ fontSize: '12px', marginBottom: '8px', lineHeight: '1.45' }}>{cleanText}</p>
                )}

                {tags.length > 0 && (
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    {tags.map((tag, i) => (
                      <span key={i} className={tag.className}>{tag.text}</span>
                    ))}
                  </div>
                )}

                {!item.isPast && item.product_name && (
                  <div style={{ fontSize: '12px', color: 'var(--color-slate-smoke)' }}>
                    <strong style={{ color: 'var(--color-forest-ink)', fontWeight: 500 }}>Usar:</strong> {item.product_name}
                  </div>
                )}
              </div>

              <div style={{ textAlign: 'right', flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                <div>
                  <span className="field-label" style={{ display: 'block', fontSize: '9px', marginBottom: '2px' }}>{item.isPast ? 'Registro' : 'Fecha'}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: item.isPast ? 'var(--color-slate-smoke)' : (isUrgent ? 'var(--color-alert)' : 'var(--color-forest-ink)'), fontWeight: 500 }}>{formatEuropeanDate(item.date)}</span>
                </div>

                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px' }}>
                  {!item.isPast && item.id && (item.isSuggestion || item.urgency === 'alta' || item.urgency === 'media') && (
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button
                        onClick={() => {
                          startTransition(async () => {
                            const { postponeEvent } = await import('@/app/actions');
                            await postponeEvent(item.id);
                          });
                        }}
                        className="chip-btn"
                        disabled={isPending}
                      >
                        +1 Posponer
                      </button>
                      <button
                        onClick={() => {
                          startTransition(async () => {
                            const { completeEvent } = await import('@/app/actions');
                            await completeEvent(item.id);
                          });
                        }}
                        className="chip-btn chip-btn--primary"
                        disabled={isPending}
                      >
                        ✓ Hecho
                      </button>
                    </div>
                  )}
                  {!item.isPast && item.id && item.isSuggestion && (
                    <button
                      onClick={() => {
                        if (!window.confirm('¿Dar por terminado este tratamiento? Se eliminan sus próximos avisos programados; el historial se conserva.')) return;
                        startTransition(async () => {
                          const { terminarTratamiento } = await import('@/app/actions');
                          await terminarTratamiento(item.id);
                        });
                      }}
                      className="chip-btn"
                      disabled={isPending}
                    >
                      Terminar tratamiento
                    </button>
                  )}
                  {item.id && (
                    <a href={`/calendar/${item.id}/edit`} style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-deep-fern)', textDecoration: 'none' }}>
                      [ Editar ]
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', backgroundColor: 'var(--color-ash-gray)', borderRadius: '10px', padding: '3px', border: '1px solid var(--color-lichen)' }}>
          {(['list', 'grid'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: '5px 14px', borderRadius: '8px',
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
