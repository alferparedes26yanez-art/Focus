# Focus

App web (mobile-first) para que estudiantes universitarios organicen y estudien sus materias con ayuda de IA.
Especificación: [SPEC.md](SPEC.md) · Reglas del proyecto: [CLAUDE.md](CLAUDE.md).

**Estado:** Fase 1 (base y sílabo) — registro, materias, sílabo con IA → revisión → unidades, temas y fechas; inicio con
próximos exámenes; ajustes con el consumo de IA.

Stack: Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind 4 + shadcn/ui · Supabase (Auth, Postgres,
Storage) · Gemini (`@google/genai`) · zod.

---

## Puesta en marcha

Necesitas Node.js 20.9 o superior (recomendado 22) y una cuenta en Supabase y en Google AI Studio.

### 1. Supabase

1. Crea un proyecto en <https://supabase.com/dashboard> (el plan gratis alcanza). Deja activada la **Data API**: la
   app la usa para leer y guardar datos.
2. Aplica las migraciones de `supabase/migrations` (crean tablas, políticas RLS, funciones y el bucket `syllabi`).
   Con la CLI (incluida en el proyecto):
   ```bash
   npx supabase login
   npx supabase link --project-ref TU_PROJECT_REF
   npx supabase db push
   ```
   Alternativa sin CLI: pega cada archivo de `supabase/migrations`, **en orden**, en *SQL Editor* y ejecútalo.
3. **Habilita tu correo para registrarte.** El registro está cerrado por defecto para proteger tu presupuesto de IA.
   En *SQL Editor*:
   ```sql
   insert into public.signup_allowlist (pattern) values ('tu-correo@gmail.com');
   ```
   Cuando la lances en tu universidad, puedes habilitar todo el dominio o abrir el registro:
   ```sql
   insert into public.signup_allowlist (pattern) values ('@tu-universidad.edu.ec');  -- un dominio
   insert into public.signup_allowlist (pattern) values ('*');                       -- cualquiera
   ```
4. *Authentication → URL Configuration*:
   - **Site URL:** `http://localhost:3000` (en producción, la URL de Vercel).
   - **Redirect URLs:** `http://localhost:3000/auth/confirm` y `https://TU-APP.vercel.app/auth/confirm`.
5. *Authentication → Emails → Templates*: copia el contenido de
   [`supabase/templates/confirmation.html`](supabase/templates/confirmation.html) en **Confirm signup** y
   [`supabase/templates/recovery.html`](supabase/templates/recovery.html) en **Reset password**. Así los enlaces
   funcionan aunque abras el correo en otro dispositivo.
6. *Project Settings → API Keys*: copia la URL, la clave publicable y la clave secreta.

> El servicio de correo incluido en Supabase envía pocos correos por hora. Para usar Focus con muchas personas,
> configura un SMTP propio en *Authentication → Emails → SMTP Settings*.

### 2. Gemini

Crea una clave en <https://aistudio.google.com/apikey> dentro de tu proyecto de Google Cloud con facturación activa.
Elige los modelos en `.env.local`; si usas uno que no esté en [`src/lib/ai/pricing.ts`](src/lib/ai/pricing.ts),
agrega su precio (si no, el gasto se estima con la tarifa más alta).

### 3. Variables de entorno

```bash
cp .env.example .env.local   # y completa los valores
```

### 4. Correr la app

```bash
npm install
npm run dev        # http://localhost:3000
```

### 5. Publicar en Vercel

Importa el repositorio en Vercel, carga las mismas variables (con `NEXT_PUBLIC_SITE_URL` = la URL de producción) y
actualiza *Site URL* y *Redirect URLs* en Supabase con esa URL.

---

## Cómo probar la Fase 1

1. Regístrate con el correo habilitado y abre el enlace del correo de confirmación.
2. El onboarding te pide crear una materia (nombre, color, ícono, docente).
3. Sube el sílabo (PDF, Word .docx o fotos de cada página) → la IA lo lee (10–40 s).
4. En la revisión corrige unidades, temas (clic para editar, arrastrar para ordenar), evaluaciones, fechas,
   ponderaciones, docente y bibliografía → **Confirmar y guardar**.
5. La materia queda con sus pestañas **Temas** y **Evaluaciones**; el inicio muestra las próximas fechas.
6. Para cargar otro sílabo: menú ⋯ de la materia → **Vaciar para subir otro sílabo**.
7. *Ajustes* muestra el gasto de IA del mes frente al presupuesto.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run lint` | ESLint |
| `npm run typecheck` | Tipos de rutas + TypeScript |
| `npm test` | Pruebas unitarias (Vitest) |
| `npm run build` | Build de producción |
| `npm run db:test` | Aplica las migraciones en un Postgres temporal y prueba las políticas RLS (requiere Postgres instalado) |
| `npm run db:types` | Regenera `src/types/database.ts` desde las migraciones |

## Estructura

```
supabase/migrations   esquema, RLS, funciones y bucket (única forma de cambiar la base de datos)
supabase/templates    plantillas de correo (confirmación y recuperación)
scripts/db            pruebas de RLS y generación de tipos sobre un Postgres local
src/proxy.ts          refresca la sesión y protege las rutas
src/app               (auth) acceso · (app) pantallas · api/syllabus lectura del sílabo
src/components        ui (shadcn) · structure (editor de temas) · syllabus · events · subjects · settings
src/lib/ai            cliente único de Gemini: presupuesto, reintentos 429, cola, registro en ai_usage, prompts
src/lib/syllabus      archivos aceptados, preparación para Gemini, normalización y esquemas zod
src/lib/actions       Server Actions · src/lib/data: lecturas para las páginas
```
