import type { SupabaseClient, User } from '@supabase/supabase-js';

export type Jardin = {
  /** Quién está mirando. */
  usuario: User;
  /** De quién es el jardín que se está viendo: el dueño. Todas las filas cuelgan de aquí. */
  id: string;
  /** Si quien mira es el creador del jardín. */
  esDueno: boolean;
  /** Si puede gestionar personas: el dueño y los admins invitados. */
  esAdmin: boolean;
  rol: 'dueño' | 'admin' | 'colaborador';
};

/**
 * Resuelve qué jardín está viendo el usuario. Casi siempre el suyo; si alguien
 * le ha invitado, el de esa persona. Todo el código de datos debe apuntar a
 * `jardin.id` y no al id del usuario: es lo que hace que dos personas de la
 * misma casa vean y cuiden las mismas plantas.
 *
 * De paso reclama la invitación pendiente: al invitar solo se conoce el correo,
 * porque puede que quien recibe la invitación aún no se haya registrado.
 */
// Un cliente de Supabase vive lo que dura una petición, así que memorizar por
// cliente resuelve el jardín una sola vez por visita, no una por consulta.
const memoria = new WeakMap<SupabaseClient, Promise<Jardin>>();

export function jardinDe(supabase: SupabaseClient, usuario: User): Promise<Jardin> {
  const guardado = memoria.get(supabase);
  if (guardado) return guardado;
  const resuelto = resolverJardin(supabase, usuario);
  memoria.set(supabase, resuelto);
  return resuelto;
}

async function resolverJardin(supabase: SupabaseClient, usuario: User): Promise<Jardin> {
  const propio: Jardin = { usuario, id: usuario.id, esDueno: true, esAdmin: true, rol: 'dueño' };

  try {
    const { data: pertenencias } = await supabase
      .from('garden_members')
      .select('owner_id, member_id, email, rol')
      .order('created_at', { ascending: true });

    if (!pertenencias || pertenencias.length === 0) return propio;

    const correo = (usuario.email || '').toLowerCase();

    // Invitación aún sin reclamar: se acepta al entrar, sin más pasos.
    const pendiente = pertenencias.find(
      p => !p.member_id && p.email?.toLowerCase() === correo && p.owner_id !== usuario.id,
    );
    if (pendiente) {
      // Por función, no por UPDATE directo: así el invitado no puede colarse
      // un rol de administrador al aceptar. Ver migración 010.
      await supabase.rpc('reclamar_invitacion');
      return {
        usuario,
        id: pendiente.owner_id,
        esDueno: false,
        esAdmin: pendiente.rol === 'admin',
        rol: pendiente.rol === 'admin' ? 'admin' : 'colaborador',
      };
    }

    const mia = pertenencias.find(p => p.member_id === usuario.id && p.owner_id !== usuario.id);
    if (mia) {
      return {
        usuario,
        id: mia.owner_id,
        esDueno: false,
        esAdmin: mia.rol === 'admin',
        rol: mia.rol === 'admin' ? 'admin' : 'colaborador',
      };
    }

    return propio;
  } catch {
    // Sin la migración 010 aplicada, cada uno con su jardín, como antes.
    return propio;
  }
}

/**
 * Atajo para el caso corriente: usuario autenticado y jardín resuelto, o null
 * si no hay sesión.
 */
export async function jardinActual(supabase: SupabaseClient): Promise<Jardin | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return jardinDe(supabase, user);
}
