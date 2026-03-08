import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import GroupPill from "@/components/activities/group-pill";

// --- HSL <-> Hex helpers ---
function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  const sl = s / 100,
    ll = l / 100;
  const a = sl * Math.min(ll, 1 - ll);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = ll - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

const DEFAULT_COLOR = "#3b82f6"; // blue-500

export interface GroupFormData {
  name: string;
  color: string;
}

interface GroupFormFieldsProps {
  initialData?: Partial<GroupFormData>;
  submitLabel: string;
  onSubmit: (data: GroupFormData) => Promise<void>;
  backPath?: string;
}

export default function GroupFormFields({
  initialData,
  submitLabel,
  onSubmit,
  backPath = "/",
}: GroupFormFieldsProps) {
  const navigate = useNavigate();
  const initialHex = initialData?.color ?? DEFAULT_COLOR;
  const [hsl, setHsl] = useState<[number, number, number]>(() =>
    hexToHsl(initialHex),
  );
  const [formData, setFormData] = useState<GroupFormData>({
    name: initialData?.name ?? "",
    color: initialHex,
  });

  const updateHsl = (h: number, s: number, l: number) => {
    const hex = hslToHex(h, s, l);
    setHsl([h, s, l]);
    setFormData((prev) => ({ ...prev, color: hex }));
  };
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.name.trim()) {
      setError("Group name is required");
      return;
    }
    try {
      setIsSubmitting(true);
      await onSubmit(formData);
    } catch {
      setError("Failed to save group. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <form
        id="group-form"
        onSubmit={handleSubmit}
        className="flex flex-col flex-1 px-4 pt-0 pb-28 gap-8"
      >
        {/* Preview — centered in available top space */}
        <div className="flex-1 flex flex-col justify-center gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground text-center">
            Preview
          </p>
          <GroupPill name={formData.name} color={formData.color} readOnly />
        </div>

        <hr className="border-border -mx-4 -mb-2" />

        {/* Name input */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground text-center">
            Name
          </p>
          <input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            placeholder="e.g. Health, Work, Personal…"
            className="w-full h-10 bg-muted/40 border border-border rounded-full px-4 text-base focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors placeholder:text-muted-foreground/50"
            required
          />
        </div>

        {/* Color */}
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground text-center">
            Color
          </p>
          <div className="space-y-3">
            {/* Hue */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Hue</span>
                <span>{hsl[0]}°</span>
              </div>
              <div className="relative h-4 flex items-center">
                <div
                  className="absolute inset-y-1 inset-x-0 rounded-full"
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
                  onChange={(e) => updateHsl(+e.target.value, hsl[1], hsl[2])}
                  className="relative w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-black/10 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-black/10 [&::-moz-range-thumb]:shadow"
                />
              </div>
            </div>
            {/* Saturation */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Saturation</span>
                <span>{hsl[1]}%</span>
              </div>
              <div className="relative h-4 flex items-center">
                <div
                  className="absolute inset-y-1 inset-x-0 rounded-full"
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
                  onChange={(e) => updateHsl(hsl[0], +e.target.value, hsl[2])}
                  className="relative w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-black/10 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-black/10 [&::-moz-range-thumb]:shadow"
                />
              </div>
            </div>
            {/* Lightness */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Lightness</span>
                <span>{hsl[2]}%</span>
              </div>
              <div className="relative h-4 flex items-center">
                <div
                  className="absolute inset-y-1 inset-x-0 rounded-full"
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
                  onChange={(e) => updateHsl(hsl[0], hsl[1], +e.target.value)}
                  className="relative w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-black/10 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-black/10 [&::-moz-range-thumb]:shadow"
                />
              </div>
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>

      {/* Fixed bottom — home button left, submit pill center */}
      <button
        type="button"
        onClick={() => navigate(backPath)}
        className="fixed bottom-6 left-6 z-50 h-10 w-10 border border-border flex items-center justify-center rounded-full bg-background shadow-md text-muted-foreground hover:text-foreground transition-colors"
        title="Back"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <button
          type="submit"
          form="group-form"
          disabled={isSubmitting || !formData.name.trim()}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-full shadow-lg px-5 py-2.5 font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Saving…" : submitLabel}
        </button>
      </div>
    </div>
  );
}
