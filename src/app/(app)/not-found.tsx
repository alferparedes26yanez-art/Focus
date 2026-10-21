import { SearchX } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="py-10">
      <EmptyState
        icon={SearchX}
        title="No encontramos esta página"
        description="Puede que la materia se haya borrado o que el enlace esté mal."
        action={
          <Button asChild>
            <Link href="/home">Ir al inicio</Link>
          </Button>
        }
      />
    </div>
  );
}
