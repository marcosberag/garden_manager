import React from 'react';

/**
 * Lo que se ve mientras el servidor arma la home. Sin esto, el navegador se
 * queda en la pantalla de arranque —el icono que Android guardó al instalar—
 * hasta que llega el primer byte: sesión, plantas, parcela y las fotos de
 * especie. Ahora la app aparece al momento, aunque sea en gris.
 */
export default function Loading() {
  return (
    <main
      style={{
        position: 'fixed',
        inset: 0,
        paddingTop: 'var(--topbar-height)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '14px',
        backgroundColor: 'var(--color-sage-paper)',
      }}
    >
      <svg width="34" height="34" viewBox="0 0 512 512" aria-hidden="true">
        <path d="M172 428 L340 428" stroke="#77aa83" strokeWidth="26" strokeLinecap="round" />
        <path d="M256 420 C258 380 252 330 256 272" stroke="#09352e" strokeWidth="30" strokeLinecap="round" fill="none" />
        <path d="M258 270 C330 278 396 226 388 132 C288 126 252 190 258 270 Z" fill="#09352e" />
        <path d="M252 310 C196 314 142 282 146 210 C222 206 250 248 252 310 Z" fill="#77aa83" />
      </svg>
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--color-slate-smoke)',
        }}
      >
        Abriendo el jardín…
      </p>
    </main>
  );
}
