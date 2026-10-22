import { describe, expect, it } from "vitest";

import { describeGeminiSetupError } from "./setup-errors";

describe("describeGeminiSetupError", () => {
  it("explains an unavailable model and which variable to change", () => {
    const message = describeGeminiSetupError(404, "models/gemini-2.5-flash is not found", "gemini-2.5-flash", "main");
    expect(message).toContain('"gemini-2.5-flash"');
    expect(message).toContain("AI_MODEL_MAIN");
    expect(message).toContain("gemini-3.8-flash");
  });

  it("explains a bad or rejected key", () => {
    expect(describeGeminiSetupError(400, "API key not valid. Please pass a valid API key.", "m", "main")).toContain(
      "no es válida",
    );
    expect(describeGeminiSetupError(403, "PERMISSION_DENIED", "m", "main")).toContain("rechazó la clave");
  });

  it("ignores errors that are not about configuration", () => {
    expect(describeGeminiSetupError(500, "Internal error", "m", "main")).toBeNull();
    expect(describeGeminiSetupError(400, "Request contains an invalid argument.", "m", "main")).toBeNull();
  });
});
