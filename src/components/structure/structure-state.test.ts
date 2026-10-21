import { describe, expect, it } from "vitest";

import { structureReducer, topicIdsAfterMove, type TreeUnit } from "./structure-state";

const units: TreeUnit[] = [
  {
    id: "u1",
    title: "Unidad 1",
    topics: [
      { id: "t1", title: "A", description: null },
      { id: "t2", title: "B", description: null },
    ],
  },
  { id: "u2", title: "Unidad 2", topics: [{ id: "t3", title: "C", description: null }] },
];

describe("structureReducer", () => {
  it("reorders units and topics", () => {
    expect(structureReducer(units, { type: "reorderUnits", unitIds: ["u2", "u1"] }).map((u) => u.id)).toEqual([
      "u2",
      "u1",
    ]);
    const next = structureReducer(units, { type: "reorderTopics", unitId: "u1", topicIds: ["t2", "t1"] });
    expect(next[0].topics.map((t) => t.id)).toEqual(["t2", "t1"]);
  });

  it("moves a topic to the end of another unit", () => {
    const next = structureReducer(units, { type: "moveTopic", topicId: "t1", toUnitId: "u2" });
    expect(next[0].topics.map((t) => t.id)).toEqual(["t2"]);
    expect(next[1].topics.map((t) => t.id)).toEqual(["t3", "t1"]);
    expect(topicIdsAfterMove(units, "t1", "u2")).toEqual(["t3", "t1"]);
  });

  it("renames and deletes", () => {
    let next = structureReducer(units, { type: "renameTopic", topicId: "t3", title: "Nuevo" });
    expect(next[1].topics[0].title).toBe("Nuevo");
    next = structureReducer(next, { type: "deleteUnit", unitId: "u1" });
    expect(next.map((u) => u.id)).toEqual(["u2"]);
  });

  it("does not change the original state", () => {
    structureReducer(units, { type: "deleteTopic", topicId: "t1" });
    expect(units[0].topics).toHaveLength(2);
  });
});
