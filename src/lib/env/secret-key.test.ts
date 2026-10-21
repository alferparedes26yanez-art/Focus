import { describe, expect, it } from "vitest";

import { describeSecretKeyProblem } from "./secret-key";

function jwt(role: string) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256" })}.${encode({ role, iss: "supabase" })}.signature`;
}

describe("describeSecretKeyProblem", () => {
  it("accepts secret and legacy service_role keys", () => {
    expect(describeSecretKeyProblem("sb_secret_abc123")).toBeNull();
    expect(describeSecretKeyProblem(jwt("service_role"))).toBeNull();
  });

  it("explains when a public key was pasted instead", () => {
    expect(describeSecretKeyProblem("sb_publishable_abc123")).toContain("publicable");
    expect(describeSecretKeyProblem(jwt("anon"))).toContain('"anon"');
    expect(describeSecretKeyProblem("hola")).toContain("no es una clave");
  });
});
