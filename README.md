# Brotes — Garden Manager

El gemelo digital de un jardín doméstico: las plantas sobre la imagen real de
satélite de la parcela (extraída del Catastro), el inventario de productos, y
una agenda de tratamientos que avisa por WhatsApp cuando toca fumigar o abonar.
Un asistente en lenguaje natural hace de ventanilla única: «he visto pulgón en
el rosal, anótalo», «he comprado un abono», «¿qué me recomiendas para…?».

Next.js 16 (App Router) · Supabase (base de datos, auth y almacenamiento de
imágenes) · Gemini para todo lo que piensa (con respaldo automático de modelo
si se agota la cuota) · Leaflet para el mapa · Open-Meteo para el parte
nocturno · CallMeBot para los avisos de WhatsApp.

## Puesta en marcha

```bash
npm install
npm run dev
```

## Variables de entorno

En `.env.local` para desarrollo, y en **Vercel → Settings → Environment
Variables** para producción. Las dos últimas solo hacen falta en producción,
pero sin ellas **el aviso diario de WhatsApp no se envía**.

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Proyecto de Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública de Supabase |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini: asistente, diagnóstico, pautas, plan anual, identificación |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo el cron: lee la base de datos sin sesión de usuario |
| `CRON_SECRET` | Solo el cron: Vercel la envía como `Authorization: Bearer …` al invocarlo |

Al añadir o cambiar una variable en Vercel hay que **volver a desplegar**: las
variables nuevas no entran en un despliegue que ya está corriendo.

## Migraciones

Los archivos de `migrations/` se ejecutan **en orden** desde el editor SQL de
Supabase. Al desplegar una versión que añade columnas, aplica antes su
migración: el código nuevo cuenta con ellas (y degrada sin romperse si faltan,
pero esa pieza queda apagada).

| Nº | Qué añade |
|---|---|
| 001–006 | Esquema base: plantas, productos, eventos, contactos, parcelas, código de barras, iconos |
| 007 | Frecuencias por producto y por evento; categorías de icono |
| 008 | Historial fotográfico (`plant_photos`) y dosis apuntada en el producto |
| 009 | Tope de aplicaciones por producto (`max_aplicaciones`, `limite_periodo`) |
| 010 | Jardín compartido: tabla de miembros, roles y políticas RLS por jardín |

## El jardín compartido

Desde la migración 010 un jardín puede cuidarlo más de una persona. El dueño
de cada fila sigue siendo el creador del jardín (`user_id`); lo que cambia es
quién puede verlo, resuelto por la función `jardines_visibles()` en las
políticas RLS. En el código, **toda consulta de datos apunta a `jardin.id`**
(ver `src/lib/jardin.ts`), nunca al id del usuario que mira — es lo que hace
que dos cuentas vean las mismas plantas.

Roles: el **creador** manda sobre todo y nombra administradores; un **admin**
cuida el jardín e invita o quita colaboradores; un **colaborador** cuida el
jardín entero pero no gestiona a nadie. Se invita por correo desde Ajustes y la
invitación se activa sola cuando esa persona inicia sesión.

## Avisos de WhatsApp

`vercel.json` programa `/api/cron/whatsapp` todos los días a las 13:00 UTC (las
15:00 en horario peninsular de verano). El endpoint compone **un mensaje por
jardín** — tareas de hoy, atrasadas y de mañana, más el parte meteorológico de
la noche (aquí se fumiga de noche) — y lo envía solo a los contactos de ese
jardín.

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

## Cómo piensa la agenda

- El **estado** de un evento (hecho / atrasado / hoy / programado) se calcula
  en un único sitio, `src/lib/estado-evento.ts`, que comparten la lista, la
  vista de mes y el diagnóstico. Los avisos llevan `[PROGRAMADO]` en las notas;
  `[HECHO]`, `[POSPUESTO]` y `[FIN]` marcan el ciclo de vida.
- La **frecuencia** vive en el producto y se deduce con Gemini al darlo de alta
  (`src/lib/frecuencias.ts`), con una tabla por tipo de reserva. Al registrar
  un tratamiento, la IA ajusta la pauta al caso: planta, modo de aplicación,
  severidad, metros reales del seto medidos en el mapa, y la dosis con
  prioridad estricta de fuentes (la apuntada en el producto → la etiqueta →
  conocimiento general).
- El **tope de aplicaciones** de un producto (p. ej. «máximo 3») cuenta solo la
  tanda en curso (`src/lib/tandas.ts`): aplicaciones de hace dos años no gastan
  el cupo de este otoño. Al agotarse, el tratamiento se cierra con `[FIN]` y
  una nota que dice por qué.
- Cambiar la fecha de un aviso **recoloca los siguientes** a la misma pauta;
  marcar hecho reprograma desde hoy, que es cuando se aplicó de verdad.

## El asistente

`src/lib/asistente.ts` interpreta la petición con el jardín entero como
contexto y decide: anotar en la agenda, dar de alta plantas o productos,
guardar datos en la ficha de algo que ya existe (límites de uso, dosis del
vivero…), o simplemente contestar. Las escrituras las ejecuta el servidor en
`consultarAsistente` con los mismos campos que usan los formularios. Tiene una
salvaguarda de plausibilidad: no sigue la corriente si la enfermedad no encaja
con la especie (el oídio no afecta a las coníferas), pero tampoco duda de lo
que sí encaja.

## Iconos del mapa

`src/lib/plant-icons.ts` define un pin SVG por categoría de planta (árbol,
palmera, cítrico, flor…). La categoría se deduce de la especie con reglas de
texto y, solo si ninguna encaja, se le pregunta a Gemini eligiendo de una lista
cerrada. Los setos y las hileras se pintan como banda sobre su trazado. Si la
planta no tiene foto propia, el pin enseña una foto de su especie (Wikipedia);
la foto real, cuando llega del recorrido o de la ficha, manda.
