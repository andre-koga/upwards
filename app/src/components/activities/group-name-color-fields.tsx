/**
 * SRP: Renders shared group name and HSL color controls for group forms.
 */
import { useEffect, useState } from "react";
import GroupPill from "@/components/activities/group-pill";
import { getContrastColor, hexToHsl, hslToHex } from "@/lib/color-utils";

interface GroupNameColorFieldsProps {
  name: string;
  color: string;
  onNameChange: (name: string) => void;
  onColorChange: (color: string) => void;
  sectionLabelClassName: string;
  nameInputClassName: string;
  showPreview?: boolean;
  nameInputAutoFocus?: boolean;
  nameInputMaxLength?: number;
}

export function GroupNameColorFields({
  name,
  color,
  onNameChange,
  onColorChange,
  sectionLabelClassName,
  nameInputClassName,
  showPreview = true,
  nameInputAutoFocus = false,
  nameInputMaxLength,
}: GroupNameColorFieldsProps) {
  const [hsl, setHsl] = useState<[number, number, number]>(() =>
    hexToHsl(color)
  );

  useEffect(() => {
    setHsl(hexToHsl(color));
  }, [color]);

  const updateHsl = (h: number, s: number, l: number) => {
    setHsl([h, s, l]);
    onColorChange(hslToHex(h, s, l));
  };

  return (
    <>
      {showPreview ? (
        <div className="flex flex-1 flex-col justify-center gap-3">
          <p className={sectionLabelClassName}>Preview</p>
          <GroupPill name={name} color={color} readOnly />
        </div>
      ) : null}

      <div className="space-y-3">
        <p className={sectionLabelClassName}>Name</p>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
          placeholder="e.g. Health, Work, Personal..."
          className={nameInputClassName}
          autoFocus={nameInputAutoFocus}
          maxLength={nameInputMaxLength}
          required
        />
      </div>

      <div className="space-y-4">
        <div
          className="flex items-center justify-between"
          style={{
            background: `linear-gradient(to left, transparent 9%, ${color} 10%, transparent 40%)`,
          }}
        >
          <p className={sectionLabelClassName}>Color</p>
          <span className="inline-flex items-center gap-2">
            <span
              className="inline-block h-5 w-16 rounded-full pt-px text-center text-xs font-medium"
              style={{ backgroundColor: color, color: getContrastColor(color) }}
              aria-label="Selected color preview"
            >
              Aa
            </span>
          </span>
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Hue</span>
              <span>{hsl[0]}°</span>
            </div>
            <div className="relative flex h-4 items-center">
              <div
                className="absolute inset-x-0 inset-y-1 rounded-full"
                style={{
                  background:
                    "linear-gradient(to right,hsl(0,80%,55%),hsl(30,80%,55%),hsl(60,80%,55%),hsl(90,80%,55%),hsl(120,80%,55%),hsl(150,80%,55%),hsl(180,80%,55%),hsl(210,80%,55%),hsl(240,80%,55%),hsl(270,80%,55%),hsl(300,80%,55%),hsl(330,80%,55%),hsl(360,80%,55%))",
                }}
              />
              <input
                type="range"
                min={0}
                max={360}
                step={5}
                value={hsl[0]}
                onChange={(event) =>
                  updateHsl(+event.target.value, hsl[1], hsl[2])
                }
                className="relative w-full cursor-pointer appearance-none bg-transparent [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-black/10 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-black/10 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Saturation</span>
              <span>{hsl[1]}%</span>
            </div>
            <div className="relative flex h-4 items-center">
              <div
                className="absolute inset-x-0 inset-y-1 rounded-full"
                style={{
                  background: `linear-gradient(to right, hsl(${hsl[0]},0%,${hsl[2]}%), hsl(${hsl[0]},100%,${hsl[2]}%))`,
                }}
              />
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={hsl[1]}
                onChange={(event) =>
                  updateHsl(hsl[0], +event.target.value, hsl[2])
                }
                className="relative w-full cursor-pointer appearance-none bg-transparent [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-black/10 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-black/10 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Lightness</span>
              <span>{hsl[2]}%</span>
            </div>
            <div className="relative flex h-4 items-center">
              <div
                className="absolute inset-x-0 inset-y-1 rounded-full"
                style={{
                  background: `linear-gradient(to right, hsl(${hsl[0]},${hsl[1]}%,0%), hsl(${hsl[0]},${hsl[1]}%,50%), hsl(${hsl[0]},${hsl[1]}%,100%))`,
                }}
              />
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={hsl[2]}
                onChange={(event) =>
                  updateHsl(hsl[0], hsl[1], +event.target.value)
                }
                className="relative w-full cursor-pointer appearance-none bg-transparent [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-black/10 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-black/10 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
