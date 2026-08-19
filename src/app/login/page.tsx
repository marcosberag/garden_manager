import React from 'react';
import { login } from './actions';
import Link from 'next/link';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ message: string }> }) {
  const resolvedParams = await searchParams;
  const message = resolvedParams?.message;

  return (
    <main className="container" style={{ paddingTop: '120px', paddingBottom: '120px', display: 'flex', justifyContent: 'center' }}>
      
      <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '45px' }}>
        <h1 className="heading-text suisse" style={{ marginBottom: '15px' }}>
          bienvenido<br/>
          de nuevo.
        </h1>
        <p className="body-text" style={{ fontSize: '14px', marginBottom: '30px' }}>
          Accede para guardar los registros y configuraciones de tu colección botánica.
        </p>

        {message && (
          <p style={{ color: 'var(--color-deep-fern)', fontSize: '12px', marginBottom: '15px', padding: '11px', border: '1px solid var(--color-lichen)', borderRadius: '8px', backgroundColor: 'var(--color-ash-gray)' }}>
            {message}
          </p>
        )}

        <form style={{ display: 'flex', flexDirection: 'column', gap: '23px' }}>
          <div>
            <label htmlFor="email" className="field-label" style={{ display: 'block', marginBottom: '8px' }}>Email</label>
            <input id="email" name="email" type="email" required className="input-field" />
          </div>
          
          <div>
            <label htmlFor="password" className="field-label" style={{ display: 'block', marginBottom: '8px' }}>Contraseña</label>
            <input id="password" name="password" type="password" required className="input-field" />
          </div>

          <div style={{ marginTop: '15px' }}>
            <button formAction={login} className="btn-filled" style={{ width: '100%', justifyContent: 'center' }}>
              Acceder
            </button>
          </div>
        </form>

        <div style={{ marginTop: '30px', textAlign: 'center' }}>
          <span style={{ fontSize: '14px', color: 'var(--color-graphite)' }}>¿No tienes cuenta? </span>
          <Link href="/register" style={{ fontSize: '14px', color: 'var(--color-deep-fern)', textDecoration: 'none' }}>[ Crear cuenta ]</Link>
        </div>
      </div>

    </main>
  );
}
