import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { AnimalTypeId } from "@/lib/personality/animal-type";

interface AnimalPictureProps {
  id: AnimalTypeId;
  className?: string;
  /** Drawn in its place while there is no picture yet. Nothing by default. */
  fallback?: ReactNode;
}

/**
 * The picture of an animal, a PNG at `/animals/<id>.png` in the public folder.
 * It is decorative (the name always sits beside it), and when a picture is
 * missing it draws the fallback, or nothing, so the block still reads.
 */
export function AnimalPicture({ id, className, fallback }: AnimalPictureProps) {
  const [missing, setMissing] = useState<AnimalTypeId | null>(null);
  if (missing === id) return <>{fallback ?? null}</>;
  return (
    <img
      src={`/animals/${id}.png`}
      alt=""
      aria-hidden="true"
      draggable={false}
      onError={() => setMissing(id)}
      className={cn("object-contain", className)}
    />
  );
}
