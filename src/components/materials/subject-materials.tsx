import type { UnitView } from "@/lib/data/subjects";
import type { MaterialView } from "@/lib/materials/types";

import { MaterialLibrary } from "./material-library";
import { MaterialUploader } from "./material-uploader";

export function SubjectMaterials({
  subjectId,
  units,
  materials,
}: {
  subjectId: string;
  units: UnitView[];
  materials: MaterialView[];
}) {
  return (
    <div className="grid gap-6">
      <MaterialUploader subjectId={subjectId} units={units} />
      <MaterialLibrary subjectId={subjectId} units={units} materials={materials} />
    </div>
  );
}
