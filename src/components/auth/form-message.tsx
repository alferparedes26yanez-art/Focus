import { CircleCheck, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";

export function FormMessage({ error, success }: { error?: string | null; success?: string | null }) {
  if (error) {
    return (
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  if (success) {
    return (
      <Alert>
        <CircleCheck className="text-success" />
        <AlertDescription className="text-foreground">{success}</AlertDescription>
      </Alert>
    );
  }
  return null;
}
