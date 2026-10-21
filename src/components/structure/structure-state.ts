// State changes of a subject's units and topics. Shared by the review screen
// (local state) and the subject page (optimistic state + Server Actions).

export type TreeTopic = { id: string; title: string; description: string | null };
export type TreeUnit = { id: string; title: string; topics: TreeTopic[] };

export type StructureAction =
  | { type: "addUnit"; unit: TreeUnit }
  | { type: "renameUnit"; unitId: string; title: string }
  | { type: "deleteUnit"; unitId: string }
  | { type: "reorderUnits"; unitIds: string[] }
  | { type: "addTopic"; unitId: string; topic: TreeTopic }
  | { type: "renameTopic"; topicId: string; title: string }
  | { type: "deleteTopic"; topicId: string }
  | { type: "reorderTopics"; unitId: string; topicIds: string[] }
  | { type: "moveTopic"; topicId: string; toUnitId: string };

export const TEMP_ID_PREFIX = "temp-";

export function isTempId(id: string) {
  return id.startsWith(TEMP_ID_PREFIX);
}

function sortByIds<T extends { id: string }>(items: T[], ids: string[]): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered = ids.map((id) => byId.get(id)).filter((item): item is T => item !== undefined);
  // Anything not in the list keeps its place at the end.
  return [...ordered, ...items.filter((item) => !ids.includes(item.id))];
}

export function structureReducer(units: TreeUnit[], action: StructureAction): TreeUnit[] {
  switch (action.type) {
    case "addUnit":
      return [...units, action.unit];
    case "renameUnit":
      return units.map((unit) => (unit.id === action.unitId ? { ...unit, title: action.title } : unit));
    case "deleteUnit":
      return units.filter((unit) => unit.id !== action.unitId);
    case "reorderUnits":
      return sortByIds(units, action.unitIds);
    case "addTopic":
      return units.map((unit) =>
        unit.id === action.unitId ? { ...unit, topics: [...unit.topics, action.topic] } : unit,
      );
    case "renameTopic":
      return units.map((unit) => ({
        ...unit,
        topics: unit.topics.map((topic) =>
          topic.id === action.topicId ? { ...topic, title: action.title } : topic,
        ),
      }));
    case "deleteTopic":
      return units.map((unit) => ({
        ...unit,
        topics: unit.topics.filter((topic) => topic.id !== action.topicId),
      }));
    case "reorderTopics":
      return units.map((unit) =>
        unit.id === action.unitId ? { ...unit, topics: sortByIds(unit.topics, action.topicIds) } : unit,
      );
    case "moveTopic": {
      const topic = units.flatMap((unit) => unit.topics).find((item) => item.id === action.topicId);
      if (!topic) return units;
      return units.map((unit) => {
        const rest = unit.topics.filter((item) => item.id !== action.topicId);
        return unit.id === action.toUnitId ? { ...unit, topics: [...rest, topic] } : { ...unit, topics: rest };
      });
    }
  }
}

// Topic ids of the destination unit after a move (used by reorder_topics).
export function topicIdsAfterMove(units: TreeUnit[], topicId: string, toUnitId: string): string[] {
  const target = units.find((unit) => unit.id === toUnitId);
  return [...(target?.topics.map((topic) => topic.id).filter((id) => id !== topicId) ?? []), topicId];
}
