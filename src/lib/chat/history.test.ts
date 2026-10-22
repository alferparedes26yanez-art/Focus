import { describe, expect, it } from "vitest";

import { answeredTurns } from "./history";

const m = (role: "user" | "assistant", content: string) => ({ role, content });

describe("answeredTurns", () => {
  it("keeps a normal conversation", () => {
    const history = [m("user", "a"), m("assistant", "b"), m("user", "c"), m("assistant", "d")];
    expect(answeredTurns(history)).toEqual(history);
  });

  it("drops questions that were never answered", () => {
    expect(answeredTurns([m("user", "falló"), m("user", "otra vez"), m("assistant", "ok"), m("user", "sin respuesta")])).toEqual([
      m("user", "otra vez"),
      m("assistant", "ok"),
    ]);
  });

  it("drops an answer whose question was cut from the window", () => {
    expect(answeredTurns([m("assistant", "x"), m("user", "a"), m("assistant", "b")])).toEqual([
      m("user", "a"),
      m("assistant", "b"),
    ]);
  });
});
