"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import {
  createTopic,
  createUnit,
  deleteTopic,
  deleteUnit,
  renameTopic,
  renameUnit,
  reorderTopics,
  reorderUnits,
} from "@/lib/actions/structure";

import { structureReducer, TEMP_ID_PREFIX, topicIdsAfterMove, type StructureAction, type TreeUnit } from "./structure-state";
import { StructureTree, type StructureHandlers } from "./structure-tree";

// Subject page editor: applies each change instantly (optimistic) and saves it
// with a Server Action. If saving fails the change is rolled back and a toast
// explains why.
export function SubjectStructure({ subjectId, units }: { subjectId: string; units: TreeUnit[] }) {
  const [optimisticUnits, applyOptimistic] = useOptimistic(units, structureReducer);
  const [, startTransition] = useTransition();

  const run = (action: StructureAction, save: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    startTransition(async () => {
      applyOptimistic(action);
      const result = await save();
      if (!result.ok) toast.error(result.error);
    });
  };

  const tempId = () => `${TEMP_ID_PREFIX}${crypto.randomUUID()}`;

  const handlers: StructureHandlers = {
    onAddUnit: (title) =>
      run({ type: "addUnit", unit: { id: tempId(), title, topics: [] } }, () => createUnit(subjectId, title)),
    onRenameUnit: (unitId, title) => run({ type: "renameUnit", unitId, title }, () => renameUnit(unitId, title)),
    onDeleteUnit: (unitId) => run({ type: "deleteUnit", unitId }, () => deleteUnit(unitId)),
    onReorderUnits: (unitIds) =>
      run({ type: "reorderUnits", unitIds }, () => reorderUnits(subjectId, unitIds)),
    onAddTopic: (unitId, title) =>
      run(
        { type: "addTopic", unitId, topic: { id: tempId(), title, description: null } },
        () => createTopic(unitId, title),
      ),
    onRenameTopic: (topicId, title) =>
      run({ type: "renameTopic", topicId, title }, () => renameTopic(topicId, title)),
    onDeleteTopic: (topicId) => run({ type: "deleteTopic", topicId }, () => deleteTopic(topicId)),
    onReorderTopics: (unitId, topicIds) =>
      run({ type: "reorderTopics", unitId, topicIds }, () => reorderTopics(unitId, topicIds)),
    onMoveTopic: (topicId, toUnitId) => {
      const topicIds = topicIdsAfterMove(optimisticUnits, topicId, toUnitId);
      run({ type: "moveTopic", topicId, toUnitId }, () => reorderTopics(toUnitId, topicIds));
    },
  };

  return <StructureTree units={optimisticUnits} handlers={handlers} />;
}
