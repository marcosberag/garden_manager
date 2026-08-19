import { Metadata, Viewport } from "next";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { signout } from "@/app/login/actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "Brotes - Gestión de Jardín",
  description: "Un paseo tranquilo por un vivero al amanecer.",
  appleWebApp: {
    capable: true,
    title: "Brotes",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#09352e",
};

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
        <div className="page-wash" />
        <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000, padding: '20px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(249, 248, 246, 0.85)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(0,0,0,0.05)' }} className="container">
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-eucalyptus)', textDecoration: 'none' }}>
            <span style={{ fontSize: '18px' }}>🌱</span>
            <span style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>brotes</span>
          </Link>
          <div style={{ display: 'flex', gap: '23px', alignItems: 'center' }}>
            <Link href="/" style={{ fontSize: '12px', textTransform: 'uppercase', textDecoration: 'none', color: 'inherit' }}>Inicio</Link>
            <Link href="/plants" style={{ fontSize: '12px', textTransform: 'uppercase', textDecoration: 'none', color: 'inherit' }}>Mis Plantas</Link>
            <Link href="/products" style={{ fontSize: '12px', textTransform: 'uppercase', textDecoration: 'none', color: 'inherit' }}>Inventario</Link>
            <Link href="/settings" style={{ fontSize: '12px', textTransform: 'uppercase', textDecoration: 'none', color: 'inherit' }}>Ajustes</Link>
            {user ? (
              <form action={signout} style={{ display: 'inline' }}>
                <button type="submit" className="btn-ghost" style={{ borderRadius: '22.5px', padding: '11px 23px', fontSize: '12px', textTransform: 'uppercase' }}>Salir</button>
              </form>
            ) : (
              <Link href="/login" className="btn-filled" style={{ borderRadius: '22.5px', padding: '11px 23px', fontSize: '12px', textTransform: 'uppercase', textDecoration: 'none' }}>Acceder</Link>
            )}
          </div>
        </nav>
        {children}
        
        <div className="scroll-indicator">
          Deslizar
        </div>
      </body>
    </html>
  );
}
