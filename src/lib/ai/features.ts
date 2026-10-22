// Every place that calls the AI, as recorded in ai_usage.feature.
export const AI_FEATURES = {
  syllabus_extraction: "Extracción de sílabos",
  material_reading: "Lectura de material (fotos, escaneos, videos)",
  material_indexing: "Indexación de material",
  topic_suggestion: "Clasificación por tema",
  chat: "Asistente (chat)",
} as const;

export type AiFeature = keyof typeof AI_FEATURES;

export function getFeatureLabel(feature: string): string {
  return AI_FEATURES[feature as AiFeature] ?? feature;
}
