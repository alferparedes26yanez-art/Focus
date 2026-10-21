# Focus — Especificación del producto

## Objetivo
El estudiante sube el material de cada materia y Focus lo convierte en un sistema de estudio completo: organizado según el sílabo, con resúmenes, tests, flashcards, explicaciones con fuentes, presentaciones y mapas conceptuales.

Principio de diseño: extremadamente fácil e intuitiva. Cualquier acción principal a máximo 2 clics.

---

## Funcionalidades

### 1. Materias y sílabo
- Crear una materia (nombre, color, ícono, docente) y subir su sílabo (PDF, Word o foto).
- La IA extrae: unidades y temas en orden, fechas de exámenes y entregas, ponderación de evaluaciones, bibliografía y datos del docente.
- Se muestra una pantalla de revisión donde el usuario confirma o corrige lo extraído antes de guardarlo.
- Resultado: estructura Materia → Unidades → Temas, editable (renombrar, reordenar arrastrando, agregar, borrar).

### 2. Biblioteca de material
- Subir: PDF, libros, Word, PowerPoint, links web, videos de YouTube (usar transcripción), fotos de apuntes o pizarra (extraer texto) y, en una fase posterior, audios de clase (transcripción).
- La IA sugiere a qué tema pertenece cada material; el usuario puede corregirlo.
- Todo el material se divide en fragmentos y se indexa para búsqueda semántica, guardando por fragmento: documento, página/minuto y sección.
- Estado visible de procesamiento por archivo (subiendo → procesando → listo / error).

### 3. Asistente IA por materia
- Chat dentro de cada materia que responde primero con el material subido (RAG).
- Cada respuesta incluye citas: nombre del documento, página o minuto, y un enlace que abre el documento en ese punto.
- Si usa conocimiento general, lo marca con la etiqueta "Conocimiento general".
- Si la información no está en el material, lo dice. Nunca inventa citas.
- Modos de explicación: Simple · Detallada · Nivel examen · Tutor (guía con preguntas en lugar de dar la respuesta).
- Historial de conversaciones por materia.

### 4. Herramientas de estudio por tema
- **Resumen**: corto, medio o completo, con conceptos clave resaltados y citas.
- **Test**: opción múltiple, verdadero/falso, respuesta corta y ejercicios. Dificultad ajustable. Al corregir: explicación de cada respuesta y cita de dónde está en el material.
- **Flashcards**: generadas automáticamente por tema, con repetición espaciada (FSRS). Sesión diaria de repaso.
- **Simulacro de examen**: mezcla los temas que entran en un examen del calendario, con cronómetro y resultado por tema.
- **Glosario** automático de términos de la materia.

### 5. Presentaciones y mapas conceptuales
- Presentación de un tema o unidad: elegir número de diapositivas y estilo; vista previa en la app, editable, exportable a PPTX y PDF.
- Mapa conceptual interactivo: nodos arrastrables, expandir/colapsar, editar texto, exportar a PNG/PDF.

### 6. Progreso y motivación
- Dominio por tema (0–100 %, rojo/amarillo/verde) calculado a partir de tests, simulacros y flashcards.
- Plan de estudio automático: reparte los temas pendientes en los días previos a cada examen.
- Recomendación diaria en el inicio: "Hoy estudia esto", según exámenes próximos y temas débiles.
- Modo Focus: temporizador Pomodoro, pantalla sin distracciones, racha de días y estadísticas de horas por materia.
- Calendario con exámenes y entregas. Recordatorios de exámenes y repasos pendientes.

---

## Diseño y UX
- Estilo limpio, minimalista y moderno. Modo claro y oscuro.
- **Inicio**: próximos exámenes, recomendación del día, tarjetas de materias (color + ícono + % de dominio) y racha.
- **Materia**: pestañas Temas · Material · Chat · Estudiar · Progreso.
- **Onboarding** de 3 pasos: crear materia → subir sílabo → ver la materia organizada.
- Estados vacíos que explican qué hacer y con un botón para hacerlo.
- Mientras la IA procesa, mostrar progreso; las respuestas del chat se muestran en streaming.

---

## Modelo de datos (orientativo, ajustar en cada fase)
- `profiles`: datos del usuario
- `subjects`: materias (nombre, color, ícono, docente)
- `units`, `topics`: estructura del sílabo, con orden
- `events`: exámenes y entregas (fecha, tipo, ponderación, temas incluidos)
- `materials`: archivos y links (tipo, estado de procesamiento, tema asignado, ruta en Storage)
- `chunks`: fragmentos de texto con embedding, página/minuto y material de origen
- `chat_threads`, `messages`: conversaciones y citas de cada respuesta
- `summaries`, `quizzes`, `quiz_questions`, `quiz_attempts`
- `flashcards`, `flashcard_reviews`: estado FSRS
- `presentations`, `concept_maps`: contenido en JSON
- `study_sessions`: sesiones Pomodoro
- `topic_mastery`: % de dominio por tema
- `ai_usage`: registro de cada llamada a la IA (modelo, tokens, costo estimado, función) para controlar el presupuesto mensual

---

## Fases y criterios de aceptación

### Fase 1 — Base y sílabo
- Registro e inicio de sesión.
- Crear, editar y borrar materias.
- Subir sílabo → extracción con IA → pantalla de revisión → estructura de unidades/temas y eventos guardada.
- Inicio con tarjetas de materias y próximos exámenes.
- ✅ Listo cuando: un usuario nuevo puede registrarse, crear una materia, subir un sílabo real y ver sus temas y fechas correctamente ordenados.

### Fase 2 — Material y chat con citas
- Biblioteca: subir PDF, Word, PPTX, links, YouTube y fotos; procesamiento e indexación.
- Asignación de material a temas.
- Chat por materia con RAG, citas clicables y modos de explicación.
- ✅ Listo cuando: al preguntar algo que está en un PDF subido, la respuesta cita el documento y la página correctos, y el enlace abre ese punto.

### Fase 3 — Estudio
- Resúmenes, tests con corrección explicada, flashcards con FSRS y glosario.
- ✅ Listo cuando: desde un tema se puede generar un resumen, hacer un test y repasar flashcards, y los resultados quedan guardados.

### Fase 4 — Presentaciones y mapas
- Generación, edición y exportación de presentaciones (PPTX/PDF) y mapas conceptuales (PNG/PDF).
- ✅ Listo cuando: el PPTX exportado abre bien en PowerPoint/Google Slides y el mapa se puede editar y exportar.

### Fase 5 — Progreso y Modo Focus
- Dominio por tema, plan de estudio, recomendación diaria, simulacros, calendario, Pomodoro, rachas, estadísticas y recordatorios.
- Transcripción de audios de clase con Gemini (audio multimodal), procesando archivos largos por partes y mostrando el costo estimado antes de transcribir.
- ✅ Listo cuando: el inicio muestra una recomendación coherente con los exámenes y los temas débiles del usuario.
