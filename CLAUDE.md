# Focus

App web (responsive, mobile-first) para que estudiantes universitarios organicen y estudien sus materias con ayuda de IA.
La especificación completa está en `SPEC.md`. Léela antes de empezar o planificar cualquier fase.

## Stack
- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui + lucide-react
- Supabase: Auth, Postgres, Storage y pgvector
- IA: API de Google Gemini con el SDK oficial `@google/genai` (clave en `GEMINI_API_KEY`, creada en un proyecto de Google Cloud con facturación activa y cubierto por los créditos mensuales del plan Google AI Pro). El presupuesto objetivo es no pasar de ~$10 USD al mes, así que se prioriza el costo. Los modelos se configuran por variables de entorno, nunca hardcodeados:
  - `AI_MODEL_MAIN`: chat, explicaciones, resúmenes, presentaciones (modelo Flash)
  - `AI_MODEL_FAST`: tareas simples (clasificar material, extraer metadatos, generar flashcards) (modelo Flash-Lite)
  - `AI_MODEL_DEEP` (opcional): modelo Pro, solo para tareas que el usuario pida explícitamente como "explicación profunda"
  - `AI_MODEL_EMBEDDING`: modelo de embeddings de Gemini
- Embeddings: Gemini (mismo `GEMINI_API_KEY`)
- Lectura de archivos: PDF/Word/PPTX con librerías de parsing; imágenes, fotos de apuntes, audio y video se envían a Gemini (multimodal) para extraer o transcribir el texto
- Mapas conceptuales: React Flow (`@xyflow/react`)
- Presentaciones: `pptxgenjs`
- Repetición espaciada: `ts-fsrs`
- Validación: `zod`
- Deploy: Vercel

## Reglas
- Interfaz en español; código, nombres de archivos y variables en inglés.
- Las claves de API solo se usan en el servidor (route handlers / server actions), nunca en el cliente. Van en `.env.local` y se documentan en `.env.example`.
- Row Level Security activado en todas las tablas: cada usuario solo accede a sus propios datos.
- Cambios de base de datos solo mediante migraciones en `supabase/migrations`.
- Toda respuesta de IA basada en material del usuario debe incluir citas (documento + página o minuto). Nunca inventar citas. Si se usa conocimiento general, marcarlo como tal.
- Todos los prompts de IA centralizados en `src/lib/ai/prompts.ts`.
- Las salidas estructuradas de la IA (temas del sílabo, tests, flashcards, diapositivas, mapas) se piden en JSON y se validan con zod.
- Todas las llamadas a la IA pasan por un único cliente en `src/lib/ai/` que:
  - maneja errores 429 (RESOURCE_EXHAUSTED) con reintentos y backoff exponencial, y procesa material pesado en cola (no todo a la vez);
  - registra en la tabla `ai_usage` cada llamada (modelo, tokens de entrada y salida, costo estimado, función que la originó);
  - respeta un límite de gasto mensual configurable (`AI_MONTHLY_BUDGET_USD`, por defecto 9): al llegar al 80 % avisa en la app y al 100 % bloquea las funciones de IA con un mensaje claro hasta el mes siguiente.
- Página de Ajustes con el consumo del mes (gasto estimado vs presupuesto, desglose por función).
- Cachear en la base de datos los resultados generados (resúmenes, tests, flashcards, presentaciones, mapas) para no repetir llamadas a la IA.
- Componentes pequeños y reutilizables. Siempre manejar estados de carga, vacío y error.
- Antes de instalar una dependencia que no esté en este stack, preguntar.

## Forma de trabajo
- Se construye por fases (ver `SPEC.md`). Nunca adelantar funcionalidades de fases futuras.
- Al iniciar una fase: proponer el plan (archivos, tablas, pantallas) y esperar aprobación antes de programar.
- Al terminar una fase: correr lint, typecheck y build; verificar los criterios de aceptación de la fase; hacer commit; resumir qué se hizo, qué falta y cómo probarlo; actualizar "Estado actual" abajo.

## Comandos
- `npm run dev`
- `npm run lint`
- `npm run typecheck`
- `npm test` (Vitest)
- `npm run build`
- `npm run db:test` (migraciones + pruebas RLS en un Postgres local) · `npm run db:types` (regenera `src/types/database.ts`)

## Estado actual
- Fase actual: 2 (material y chat con citas) terminada en código. Fase 1 funciona en producción. Para la Fase 2 falta aplicar las migraciones 0700 y 0800 en Supabase, cargar `AI_MODEL_FAST` y `AI_MODEL_EMBEDDING` en Vercel y probar el criterio de aceptación con un PDF real.
- Notas:
  - Next.js 16 con Cache Components: todo lo que lee sesión, `params` o `searchParams` va dentro de `<Suspense>`. `AGENTS.md` apunta a la documentación de Next incluida en `node_modules/next/dist/docs/`: léela antes de usar una API de Next.
  - Las evaluaciones se vinculan a unidades (`event_units`), no a temas: un tema nuevo en una unidad entra solo en sus exámenes.
  - El registro está cerrado por defecto: `signup_allowlist` (correo, `@dominio` o `*`) se aplica también en la base de datos.
  - El presupuesto de IA es global (una sola clave de Gemini). Para lanzarlo en la universidad hará falta un límite por usuario.
  - Para cargar otro sílabo hay que vaciar la materia (botón "Vaciar"), no se reemplaza automáticamente.
  - El PDF y las fotos del sílabo van directo a Gemini (lee tablas y escaneos); Word se convierte a HTML con `mammoth`.
  - El material se lee por lotes que pide el navegador mientras la materia está abierta (`/api/materials/[id]/process`, un lote por request de 60 s; `locked_until` evita trabajo doble y `save_material_batch` guarda fragmentos y avance juntos). Si se cierra la página, sigue al volver.
  - Lectura: PDF por página con `unpdf` (páginas con menos de 80 caracteres se transcriben con Flash-Lite), PPTX por diapositiva (JSZip), Word por secciones, web con Readability y protección SSRF, YouTube en partes de 5 min con `videoMetadata` (máx. 1 h, costo estimado antes de aceptar).
  - Búsqueda exacta por materia con `match_chunks` (embeddings de 768 dimensiones, sin índice aproximado para no perder resultados).
  - El sílabo guardado entra solo a la biblioteca (trigger; `is_syllabus`, sus archivos siguen en el bucket `syllabi`). "Vaciar materia" lo quita y deja el resto del material "sin ordenar".
  - Chat: solo se guardan las citas `[n]` que estaban entre las fuentes dadas al modelo; el párrafo "**Conocimiento general:**" marca lo que no viene del material.
  - Si Gemini responde 503 (modelo saturado), el cliente pasa al modelo más liviano (Pro → main, main → fast) en el siguiente reintento. Los 429 se reintentan con el mismo modelo.
  - El sílabo se acepta si la IA encuentra unidades aunque dude; si lo rechaza, el mensaje dice qué parece ser el documento.
  - Precios de modelos en `src/lib/ai/pricing.ts`: verificarlos contra la página oficial al cambiar de modelo.
  - Modelos: los 2.5 ya no están disponibles para proyectos nuevos de Google (oct. 2026). Por defecto `gemini-3.8-flash` (main), `gemini-3.5-flash-lite` (fast) y `gemini-embedding-001` (embedding).
  - Producción: Vercel (proyecto `focuss`, https://focuss-alpha.vercel.app) publica `main` automáticamente.
