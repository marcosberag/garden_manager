// @ts-nocheck
'use client';

import React, { useState, useTransition } from 'react';
import { markAsCured } from '@/app/actions';

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
      days.push(<div key={`empty-${i}`} style={{ padding: '10px', backgroundColor: '#f9f9f9', border: '1px solid #eee' }}></div>);
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
          backgroundColor: isToday ? '#F5FDF7' : 'white',
          border: `1px solid ${isToday ? 'var(--color-eucalyptus)' : '#eee'}`,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <span style={{ 
            fontSize: '11px', 
            fontWeight: isToday ? 'bold' : 'normal',
            color: isToday ? 'var(--color-eucalyptus)' : 'var(--color-graphite)',
            marginBottom: '4px'
          }}>
            {i}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto' }}>
            {dayEvents.map(e => (
              <div key={e.id} style={{ fontSize: '9px', backgroundColor: '#E8F6F3', color: '#117A65', padding: '2px 4px', borderRadius: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={`${e.type} (Hecho)`}>
                ✓ {e.type}
              </div>
            ))}
            {dayRecs.map((r, idx) => (
              <div key={`rec-${idx}`} style={{ fontSize: '9px', backgroundColor: r.urgency === 'alta' ? '#FDEDEC' : 'var(--color-ink-black)', color: r.urgency === 'alta' ? '#E74C3C' : 'white', padding: '2px 4px', borderRadius: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.type}>
                {r.type}
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', paddingBottom: '20px' }}>
        <h4 className="suisse" style={{ textAlign: 'center', margin: '0 0 15px 0', fontSize: '16px', color: 'var(--color-ink-black)' }}>
          {monthNames[currentMonth]} {currentYear}
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>
          {dayNames.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 'bold', color: 'var(--color-graphite)' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0', borderLeft: '1px solid #eee', borderTop: '1px solid #eee' }}>
          {days}
        </div>
        <div style={{ marginTop: '15px', display: 'flex', gap: '15px', justifyContent: 'center', fontSize: '10px', color: 'var(--color-graphite)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '10px', height: '10px', backgroundColor: '#E8F6F3', borderRadius: '2px' }}></div>
            <span>Hecho</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '10px', height: '10px', backgroundColor: 'var(--color-ink-black)', borderRadius: '2px' }}></div>
            <span>Pendiente</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '10px', height: '10px', backgroundColor: '#FDEDEC', borderRadius: '2px' }}></div>
            <span>Urgente</span>
          </div>
        </div>
      </div>
    );
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
        <div style={{ padding: '30px', backgroundColor: 'var(--color-mist)', borderRadius: '8px', textAlign: 'center' }}>
          <p className="body-text" style={{ margin: 0, fontSize: '14px' }}>No hay tareas pendientes ni historial. ¡Añade tu primer tratamiento!</p>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {combinedList.map((item, idx: number) => {
          const isUrgent = item.urgency === 'alta' && !item.isPast;
          const isToday = item.urgency === 'media' && !item.isPast;
          const isFumigacion = item.type.toLowerCase().includes('fumig');
          
          let borderColor = isFumigacion ? 'var(--color-eucalyptus)' : '#F39C12';
          let bgColor = 'white';
          if (item.isPast) {
            borderColor = '#A6ACAF';
            bgColor = '#F8F9F9';
          } else if (isUrgent) {
            borderColor = '#E74C3C'; // Red
          } else if (isToday) {
            borderColor = '#3498DB'; // Blue for today
          }

          return (
            <div key={idx} className="card" style={{ 
              borderLeft: `4px solid ${borderColor}`,
              backgroundColor: bgColor,
              opacity: item.isPast ? 0.8 : 1,
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              padding: '15px', borderRadius: '8px'
            }}>
              <div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ 
                    fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', 
                    backgroundColor: item.isPast ? '#E5E7E9' : (isUrgent ? '#FDEDEC' : (isToday ? '#EBF5FB' : 'var(--color-mist)')),
                    color: item.isPast ? '#7F8C8D' : (isUrgent ? '#E74C3C' : (isToday ? '#2874A6' : 'var(--color-graphite)')),
                    padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold'
                  }}>
                    {item.isPast ? `✓ ${item.type}` : item.type}
                  </span>
                  {isUrgent && <span style={{ fontSize: '10px', color: '#E74C3C', fontWeight: 'bold' }}>ATRASADO</span>}
                  {isToday && <span style={{ fontSize: '10px', color: '#2874A6', fontWeight: 'bold' }}>PARA HOY</span>}
                  {item.isPast && <span style={{ fontSize: '10px', color: '#7F8C8D', fontWeight: 'bold' }}>HISTORIAL</span>}
                </div>
                
                <h3 className="suisse" style={{ fontSize: '16px', margin: '0 0 6px 0', color: item.isPast ? '#5D6D7E' : 'var(--color-ink-black)', textDecoration: item.isPast ? 'line-through' : 'none' }}>
                  {(() => {
                    const actionName = item.product_name ? item.product_name : item.type;
                    if (item.plant_name && item.plant_name !== 'General') {
                      return `${actionName} en ${item.plant_name}`;
                    } else {
                      return item.product_name ? `Aplicación de ${actionName}` : `Tratamiento de ${actionName}`;
                    }
                  })()}
                </h3>
                
                <p className="body-text" style={{ fontSize: '13px', marginBottom: '8px', lineHeight: '1.4', color: item.isPast ? '#7F8C8D' : 'inherit' }}>{item.reason}</p>
                
                {!item.isPast && item.product_name && (
                  <div style={{ fontSize: '12px', color: 'var(--color-graphite)' }}>
                    <strong>Usar:</strong> {item.product_name}
                  </div>
                )}
              </div>
              
              <div style={{ textAlign: 'right', minWidth: '85px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px', height: '100%' }}>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--color-graphite)', display: 'block', marginBottom: '2px', textTransform: 'uppercase' }}>{item.isPast ? 'Realizado' : 'Fecha'}</span>
                  <span style={{ fontSize: '14px', color: item.isPast ? '#7F8C8D' : (isUrgent ? '#E74C3C' : (isToday ? '#2874A6' : 'var(--color-ink-black)')), fontWeight: 'bold' }}>{item.date}</span>
                </div>
                
                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {!item.isPast && item.id && (item.isSuggestion || item.urgency === 'alta' || item.urgency === 'media') && (
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button 
                        onClick={() => {
                          startTransition(async () => {
                            const { postponeEvent } = await import('@/app/actions');
                            await postponeEvent(item.id);
                          });
                        }}
                        style={{ fontSize: '9px', color: '#E67E22', backgroundColor: '#FEF5E7', border: '1px solid #F39C12', textDecoration: 'none', fontWeight: 'bold', padding: '4px 6px', borderRadius: '4px', cursor: 'pointer', opacity: isPending ? 0.5 : 1 }}
                        disabled={isPending}
                      >
                        +1 POSPONER
                      </button>
                      <button 
                        onClick={() => {
                          startTransition(async () => {
                            const { completeEvent } = await import('@/app/actions');
                            await completeEvent(item.id);
                          });
                        }}
                        style={{ fontSize: '9px', color: '#27AE60', backgroundColor: '#EAFAF1', border: '1px solid #2ECC71', textDecoration: 'none', fontWeight: 'bold', padding: '4px 6px', borderRadius: '4px', cursor: 'pointer', opacity: isPending ? 0.5 : 1 }}
                        disabled={isPending}
                      >
                        ✓ HECHO
                      </button>
                    </div>
                  )}
                  {item.id && (
                    <a href={`/calendar/${item.id}/edit`} style={{ fontSize: '10px', color: '#3498DB', textDecoration: 'none', fontWeight: 'bold', padding: '4px 8px', border: '1px solid #3498DB', borderRadius: '4px', textAlign: 'center' }}>
                      EDITAR
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
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', backgroundColor: 'var(--color-mist)', borderRadius: '20px', padding: '4px' }}>
          <button 
            onClick={() => setView('list')}
            style={{ 
              padding: '6px 15px', borderRadius: '16px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', border: 'none',
              backgroundColor: view === 'list' ? 'white' : 'transparent',
              color: view === 'list' ? 'var(--color-ink-black)' : 'var(--color-graphite)',
              boxShadow: view === 'list' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
              cursor: 'pointer', transition: 'all 0.2s ease'
            }}
          >
            Lista
          </button>
          <button 
            onClick={() => setView('grid')}
            style={{ 
              padding: '6px 15px', borderRadius: '16px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', border: 'none',
              backgroundColor: view === 'grid' ? 'white' : 'transparent',
              color: view === 'grid' ? 'var(--color-ink-black)' : 'var(--color-graphite)',
              boxShadow: view === 'grid' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
              cursor: 'pointer', transition: 'all 0.2s ease'
            }}
          >
            Mes
          </button>
        </div>
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '5px' }}>
        {view === 'list' ? renderList() : renderGrid()}
      </div>
    </div>
  );
}
