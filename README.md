# Brotes — Garden Manager

Aplicación para llevar el jardín: qué plantas hay y dónde están sobre un mapa de
satélite, qué productos se usan, y un calendario de tratamientos que avisa por
WhatsApp cuando toca fumigar o abonar.

Next.js 16 (App Router) · Supabase (base de datos, auth y almacenamiento de
imágenes) · Gemini para las sugerencias e identificación · Leaflet para el mapa ·
CallMeBot para los avisos de WhatsApp.

## Puesta en marcha

```bash
npm install
npm run dev
```

## Variables de entorno

En `.env.local` para desarrollo, y en **Vercel → Settings → Environment
Variables** para producción. Las dos últimas solo hacen falta en producción, pero
sin ellas **el aviso diario de WhatsApp no se envía**.

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Proyecto de Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública de Supabase |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini: sugerencias, identificación por foto, frecuencias e iconos |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo el cron: lee la base de datos sin sesión de usuario |
| `CRON_SECRET` | Solo el cron: Vercel la envía como `Authorization: Bearer …` al invocarlo |

Al añadir o cambiar una variable en Vercel hay que **volver a desplegar**: las
variables nuevas no entran en un despliegue que ya está corriendo.

## Migraciones

Los archivos de `migrations/` se ejecutan **en orden** desde el editor SQL de
Supabase. Son idempotentes (`IF NOT EXISTS`), así que se pueden relanzar sin
romper nada. Al desplegar una versión que añade columnas, aplica antes su
migración: el código nuevo cuenta con ellas.

## Avisos de WhatsApp

`vercel.json` programa `/api/cron/whatsapp` todos los días a las 13:00 UTC (las
15:00 en horario peninsular de verano). El endpoint reúne las tareas de hoy y
mañana y las manda a cada contacto configurado en Ajustes.

Dos formas de entrar:

- **El cron de Vercel**, sin sesión: exige la cabecera `Authorization: Bearer
  $CRON_SECRET` y usa la clave de servicio, que se salta las políticas RLS. Sin
  `CRON_SECRET` el endpoint responde 500 explicando qué falta, en vez de un 401
  mudo.
- **El botón de Ajustes**, con la sesión del usuario y sus propios permisos.

CallMeBot contesta siempre con un 2xx y una página HTML, también cuando falla,
así que un envío solo se da por bueno si su respuesta contiene «Message queued»
(ver `src/lib/callmebot.ts`). Si ningún mensaje sale, el endpoint responde 502
para que el fallo se vea en los registros de Vercel.

En plan Hobby, Vercel reparte la carga y puede invocar el cron en cualquier
momento dentro de la hora indicada.

## Cómo se decide la frecuencia de un tratamiento

Cada producto guarda cada cuántos días se aplica. Al darlo de alta, si el campo
se deja vacío, la pauta la deduce Gemini a partir del nombre y el tipo
(`src/lib/frecuencias.ts`), con una tabla por tipo de reserva para cuando la IA
no está disponible. Al registrar un tratamiento con ese producto, la repetición
viene ya rellena y sigue siendo editable.

## Iconos del mapa

`src/lib/plant-icons.ts` define un pin SVG por categoría de planta (árbol,
palmera, cítrico, flor…). La categoría se deduce de la especie con reglas de
texto y, solo si ninguna encaja, se le pregunta a Gemini eligiendo de una lista
cerrada. Las plantas con foto usan la foto como marcador.
