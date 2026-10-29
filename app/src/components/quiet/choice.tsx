import { RadioGroup as RadioGroupPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

import { quietFocus } from "./focus";

type QuietChoiceProps = {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
};

/** A short choice as words. The selected word is ink. The others recede. */
export function QuietChoice({
  label,
  value,
  onValueChange,
  options,
}: QuietChoiceProps) {
  return (
    <RadioGroupPrimitive.Root
      aria-label={label}
      value={value}
      onValueChange={onValueChange}
      className="flex flex-wrap gap-x-8"
    >
      {options.map((option) => (
        <RadioGroupPrimitive.Item
          key={option.value}
          value={option.value}
          className={cn(
            "min-h-11 text-sm text-ink-faint",
            "data-[state=checked]:text-ink",
            quietFocus,
          )}
        >
          {option.label}
        </RadioGroupPrimitive.Item>
      ))}
    </RadioGroupPrimitive.Root>
  );
}
