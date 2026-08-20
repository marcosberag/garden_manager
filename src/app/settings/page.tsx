// @ts-nocheck
import React from 'react';
import { createClient } from '@/utils/supabase/server';
import { addContact, deleteContact } from './actions';

import TestWhatsAppButton from './TestWhatsAppButton';
import RunCronButton from './RunCronButton';
import RecalcularPautasButton from './RecalcularPautasButton';
import ClearEventsButton from '@/app/ClearEventsButton';
import PlanAnual from './PlanAnual';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: contacts } = await supabase
    .from('notification_contacts')
    .select('*')
    .order('created_at', { ascending: true });

  return (
    <main className="container" style={{ paddingTop: '120px', paddingBottom: '120px' }}>
      
      <section className="section">
        <div className="labeled-section">
          <div className="labeled-section-tag">
            <span className="field-label">
              ajustes
            </span>
          </div>
          
          <div className="labeled-section-body">
            <h1 className="heading-text suisse" style={{ color: 'var(--color-ink-black)', marginBottom: '30px' }}>
              el altavoz<br/>
              del jardín.
            </h1>
            <p className="body-text">
              Añade los números de WhatsApp de las personas que quieras que reciban los avisos (por ejemplo, cuando toca fumigar o regar).
            </p>
            
            <div style={{ marginTop: '75px', display: 'flex', flexDirection: 'column', gap: '23px' }}>
              {contacts?.map((contact) => (
                <div key={contact.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 30px' }}>
                  <div>
                    <h3 className="suisse" style={{ fontSize: '20px', marginBottom: '4px' }}>{contact.name}</h3>
                    <p className="body-text" style={{ fontSize: '14px', fontFamily: 'var(--font-space-grotesk)' }}>{contact.phone_number}</p>
                    {contact.api_key && <p style={{ fontSize: '11px', color: 'var(--color-graphite)' }}>API Key configurada</p>}
                  </div>
                  <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <TestWhatsAppButton phone={contact.phone_number} apikey={contact.api_key} />
                    <form action={deleteContact.bind(null, contact.id)}>
                      <button className="chip-btn chip-btn--danger">
                        Eliminar
                      </button>
                    </form>
                  </div>
                </div>
              ))}

              {(!contacts || contacts.length === 0) && (
                <p className="body-text" style={{ fontSize: '14px', fontStyle: 'italic', color: 'var(--color-graphite)' }}>
                  Aún no has añadido ningún contacto de WhatsApp.
                </p>
              )}
            </div>
            
            <div className="card" style={{ marginTop: '45px', backgroundColor: 'var(--color-pure-canvas)' }}>
              <h3 className="suisse" style={{ fontSize: '24px', marginBottom: '23px' }}>Nuevo Contacto (CallMeBot)</h3>
              <form action={addContact} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: '1', minWidth: '200px' }}>
                  <label htmlFor="name" className="field-label" style={{ display: 'block', marginBottom: '8px' }}>Nombre</label>
                  <input id="name" name="name" type="text" placeholder="Ej: Mamá" required className="input-field" />
                </div>
                <div style={{ flex: '1', minWidth: '200px' }}>
                  <label htmlFor="phone" className="field-label" style={{ display: 'block', marginBottom: '8px' }}>Teléfono (con país, ej: +34...)</label>
                  <input id="phone" name="phone" type="text" placeholder="Ej: +34600123456" required className="input-field" />
                </div>
                <div style={{ flex: '1', minWidth: '200px' }}>
                  <label htmlFor="apikey" className="field-label" style={{ display: 'block', marginBottom: '8px' }}>API Key CallMeBot</label>
                  <input id="apikey" name="apikey" type="text" placeholder="Tu API Key" required className="input-field" />
                </div>
                <button type="submit" className="btn-filled">Guardar</button>
              </form>
            </div>
            
            <RunCronButton />

            <div className="card" style={{ marginTop: '24px' }}>
              <p className="eyebrow" style={{ marginBottom: '8px' }}>Pautas de la IA</p>
              <p style={{ margin: '0 0 15px 0', fontSize: '12px', color: 'var(--color-slate-smoke)' }}>
                Repasa las tareas programadas y ajusta la frecuencia de cada una a su caso
                (producto, planta y modo de aplicación). También reactiva los tratamientos
                con pauta que se quedaron sin avisos.
              </p>
              <RecalcularPautasButton />
            </div>

            <PlanAnual />

            <div className="card" style={{ marginTop: '24px', borderLeft: '3px solid var(--color-alert)' }}>
              <p className="eyebrow" style={{ color: 'var(--color-alert)', marginBottom: '8px' }}>Zona delicada</p>
              <p style={{ margin: '0 0 15px 0', fontSize: '12px', color: 'var(--color-slate-smoke)' }}>
                Borra todos los eventos de la agenda: registros, historial y avisos programados.
                No se puede deshacer.
              </p>
              <ClearEventsButton />
            </div>

          </div>
        </div>
      </section>

    </main>
  );
}
