// Errors from the AI layer. `userMessage` is safe to show in the interface.

export type AiErrorCode =
  | "budget_exceeded"
  | "busy"
  | "invalid_output"
  | "request_failed"
  | "not_configured";

export class AiError extends Error {
  constructor(
    readonly code: AiErrorCode,
    readonly userMessage: string,
    options?: { cause?: unknown },
  ) {
    super(userMessage, options);
    this.name = "AiError";
  }
}

const monthFormatter = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

export function budgetExceededError(budgetUsd: number, resetsAt: Date) {
  return new AiError(
    "budget_exceeded",
    `Se alcanzó el límite mensual de IA (${budgetUsd.toFixed(2)} USD). Las funciones de IA vuelven el ${monthFormatter.format(resetsAt)}.`,
  );
}

export function busyError(cause?: unknown) {
  return new AiError(
    "busy",
    "La IA está saturada en este momento. Espera un minuto e inténtalo de nuevo.",
    { cause },
  );
}

export function invalidOutputError(cause?: unknown) {
  return new AiError(
    "invalid_output",
    "La IA no devolvió un resultado válido. Inténtalo de nuevo.",
    { cause },
  );
}

export function requestFailedError(cause?: unknown) {
  return new AiError(
    "request_failed",
    "No se pudo procesar la solicitud con la IA. Inténtalo de nuevo.",
    { cause },
  );
}

export function notConfiguredError(cause?: unknown) {
  return new AiError(
    "not_configured",
    "La IA no está configurada todavía. Revisa las variables de entorno.",
    { cause },
  );
}
