import { Metadata, Viewport } from "next";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { signout } from "@/app/login/actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "Brotes - Gestión de Jardín",
  description: "Tu jardín, con seguimiento inteligente de plantas y tratamientos.",
  appleWebApp: {
    capable: true,
    title: "Brotes",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#09352e",
};

function LogoBrote() {
  return (
    <svg width="20" height="20" viewBox="0 0 512 512" aria-hidden="true">
      <path d="M172 428 L340 428" stroke="#77aa83" strokeWidth="26" strokeLinecap="round" />
      <path d="M256 420 C258 380 252 330 256 272" stroke="#09352e" strokeWidth="30" strokeLinecap="round" fill="none" />
      <path d="M258 270 C330 278 396 226 388 132 C288 126 252 190 258 270 Z" fill="#09352e" />
      <path d="M252 310 C196 314 142 282 146 210 C222 206 250 248 252 310 Z" fill="#77aa83" />
    </svg>
  );
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <html lang="es">
      <body>
        <nav className="topbar">
          <Link href="/" className="topbar-brand">
            <LogoBrote />
            <span>brotes</span>
          </Link>
          <div className="topbar-links">
            <Link href="/" className="topbar-link">Inicio</Link>
            <Link href="/plants" className="topbar-link">Plantas</Link>
            <Link href="/products" className="topbar-link">Inventario</Link>
            <Link href="/settings" className="topbar-link">Ajustes</Link>
            {user ? (
              <form action={signout} style={{ display: 'inline' }}>
                <button type="submit" className="chip-btn">Salir</button>
              </form>
            ) : (
              <Link href="/login" className="chip-btn chip-btn--primary">Acceder</Link>
            )}
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
