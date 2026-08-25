import { useMemo } from "react";
import { autonomyLabels, autonomyLabel } from "@/components/InitiativeCard";

type AutonomySliderProps = {
  value: number;
  onChange?: (next: number) => void;
  disabled?: boolean;
  label?: string;
};

export default function AutonomySlider({
  value,
  onChange,
  disabled,
  label = "Niveau d'autonomie global",
}: AutonomySliderProps) {
  const clamped = useMemo(
    () => Math.max(0, Math.min(5, Math.floor(value || 0))),
    [value],
  );

  const levelClass = (level: number): string => {
    if (clamped === level) {
      return "bg-sky-500/30 border-sky-500/60 text-sky-100 shadow-[0_0_0_1px_rgba(56,189,248,0.2)]";
    }
    return "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10";
  };

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label
          htmlFor="autonomy-range-slider"
          data-testid="autonomy-label"
          className="text-sm font-semibold text-slate-100"
        >
          {label}
        </label>
        <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-sky-100">
          {autonomyLabel(clamped)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {autonomyLabels.map((lvl) => (
          <button
            key={lvl.value}
            type="button"
            disabled={disabled}
            data-testid={`autonomy-chip-${lvl.value}`}
            onClick={() => onChange?.(lvl.value)}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] transition disabled:cursor-not-allowed disabled:opacity-50 ${levelClass(lvl.value)}`}
          >
            <span className="font-mono text-[10px] opacity-70">
              {lvl.value}.
            </span>{" "}
            {lvl.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
          0
        </span>
        <input
          id="autonomy-range-slider"
          data-testid="autonomy-range"
          type="range"
          min={0}
          max={5}
          step={1}
          disabled={disabled}
          value={clamped}
          onChange={(ev) => onChange?.(Number(ev.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
          5
        </span>
      </div>
    </div>
  );
}
