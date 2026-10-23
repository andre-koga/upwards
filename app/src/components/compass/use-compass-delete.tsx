import { useState } from "react";
import { CompassDeleteDialog } from "./compass-delete-dialog";

/** Confirms, then tombstones. The Deleted list can bring it back. */
export function useCompassDelete() {
  const [target, setTarget] = useState<{
    name: string;
    run: () => Promise<void>;
  } | null>(null);

  const ask = (name: string, run: () => Promise<void>) => {
    setTarget({ name, run });
  };

  const dialog = (
    <CompassDeleteDialog
      name={target?.name ?? ""}
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) setTarget(null);
      }}
      onConfirm={async () => {
        await target?.run();
        setTarget(null);
      }}
    />
  );

  return { ask, dialog };
}
