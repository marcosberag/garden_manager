'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { miembrosDelJardin, invitarAlJardin, cambiarRolDelMiembro, quitarDelJardin } from '@/app/actions';

type Miembro = { id: string; email: string; rol: string; aceptada: boolean; soyYo: boolean };
type Estado = { esDueno: boolean; esAdmin: boolean; rol: string; dueno: string };

/**
 * Quién cuida el jardín. Un jardín es de una casa, no de una persona: aquí se
 * invita a quien lo cuide contigo y se decide quién manda.
 */
export default function MiembrosJardin() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState('colaborador');
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  const cargar = async () => {
    const r = await miembrosDelJardin();
    if (r.error) { setError(r.error); return; }
    setError(null);
    setEstado(r.jardin ?? null);
    setMiembros(r.miembros ?? []);
  };

  // La carga inicial va dentro de una transición: así el estado no se toca
  // en el propio cuerpo del efecto, que es lo que React desaconseja.
  useEffect(() => {
    empezar(() => { cargar(); });
  }, []);

  const invitar = (e: React.FormEvent) => {
    e.preventDefault();
    empezar(async () => {
      const r = await invitarAlJardin(email, rol);
      setMensaje(r.ok || null);
      setError(r.error || null);
      if (r.ok) { setEmail(''); await cargar(); }
    });
  };

  const accion = (fn: () => Promise<{ ok?: string; error?: string }>) => {
    empezar(async () => {
      const r = await fn();
      setMensaje(r.ok || null);
      setError(r.error || null);
      await cargar();
    });
  };

  if (error && !estado) {
    return (
      <div className="card" style={{ marginTop: '24px' }}>
        <p className="eyebrow" style={{ marginBottom: '8px' }}>Quién cuida el jardín</p>
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-slate-smoke)' }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginTop: '24px' }}>
      <p className="eyebrow" style={{ marginBottom: '8px' }}>Quién cuida el jardín</p>

      {estado && !estado.esDueno && (
        <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: 'var(--color-slate-smoke)', lineHeight: 1.5 }}>
          Estás en el jardín de <strong>{estado.dueno}</strong> como {estado.rol}. Todo lo que
          registres se guarda en ese jardín, no en uno tuyo.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', borderBottom: '1px solid var(--color-ash-gray)' }}>
          <span style={{ flex: 1, fontSize: '13px', color: 'var(--color-forest-ink)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {estado?.dueno}
          </span>
          <span className="tag tag--fern">Creador</span>
        </div>

        {miembros.map(m => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', borderBottom: '1px solid var(--color-ash-gray)', flexWrap: 'wrap' }}>
            <span style={{ flex: 1, fontSize: '13px', color: 'var(--color-forest-ink)', minWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {m.email}{m.soyYo ? ' (tú)' : ''}
            </span>
            <span className={m.rol === 'admin' ? 'tag tag--ink' : 'tag tag--muted'}>
              {m.rol === 'admin' ? 'Admin' : 'Colaborador'}
            </span>
            {!m.aceptada && <span className="tag tag--muted">Sin entrar aún</span>}

            {estado?.esDueno && !m.soyYo && (
              <button
                className="chip-btn"
                disabled={pendiente}
                onClick={() => accion(() => cambiarRolDelMiembro(m.id, m.rol === 'admin' ? 'colaborador' : 'admin'))}
              >
                {m.rol === 'admin' ? 'Quitar admin' : 'Hacer admin'}
              </button>
            )}
            {estado?.esAdmin && !m.soyYo && (estado.esDueno || m.rol !== 'admin') && (
              <button
                className="chip-btn chip-btn--danger"
                disabled={pendiente}
                onClick={() => {
                  if (!window.confirm(`¿Quitar a ${m.email} del jardín? Lo que haya registrado se queda.`)) return;
                  accion(() => quitarDelJardin(m.id));
                }}
              >
                Quitar
              </button>
            )}
          </div>
        ))}
      </div>

      {estado?.esAdmin && (
        <>
          <form onSubmit={invitar} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="email"
              className="input-field"
              placeholder="correo de quien lo cuida contigo"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{ flex: 1, minWidth: '180px', padding: '9px 12px' }}
            />
            {estado.esDueno && (
              <select className="input-field" value={rol} onChange={e => setRol(e.target.value)} style={{ flex: '0 0 auto', padding: '9px 12px' }}>
                <option value="colaborador">Colaborador</option>
                <option value="admin">Administrador</option>
              </select>
            )}
            <button type="submit" className="chip-btn chip-btn--primary" disabled={pendiente || !email.trim()}>
              {pendiente ? 'Invitando…' : 'Invitar'}
            </button>
          </form>
          <p className="field-hint" style={{ marginTop: '8px' }}>
            Con el correo basta: la invitación espera y se activa sola cuando esa persona entra,
            se haya registrado antes o después. Un <strong>colaborador</strong> cuida el jardín entero;
            un <strong>administrador</strong> además puede invitar y quitar colaboradores. Nombrar
            administradores solo lo hace el creador.
          </p>
        </>
      )}

      {mensaje && <p style={{ marginTop: '10px', marginBottom: 0, fontSize: '12px', fontWeight: 500, color: 'var(--color-deep-fern)' }}>{mensaje}</p>}
      {error && estado && <p style={{ marginTop: '10px', marginBottom: 0, fontSize: '12px', color: 'var(--color-alert)' }}>{error}</p>}
    </div>
  );
}
