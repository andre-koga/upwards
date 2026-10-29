import { cn } from "@/lib/utils";

import { quietFocus } from "./focus";

type QuietNavProps = {
  label: string;
  value: string;
  onValueChange: (id: string) => void;
  items: readonly { id: string; label: string }[];
};

/** Three words. The current one is ink. No icons, no bar. */
export function QuietNav({
  label,
  value,
  onValueChange,
  items,
}: QuietNavProps) {
  return (
    <nav
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-10 bg-canvas px-8 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2"
    >
      <div className="flex items-stretch justify-between">
        {items.map((item) => {
          const current = item.id === value;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={current ? "page" : undefined}
              onClick={() => onValueChange(item.id)}
              className={cn(
                "min-h-11 px-1 text-sm",
                quietFocus,
                current ? "font-medium text-ink" : "text-ink-faint",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
