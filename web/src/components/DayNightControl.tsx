import type { TimeOfDay } from "../types/presentation"

interface DayNightControlProps {
  value: TimeOfDay
  onChange: (value: TimeOfDay) => void
  disabled?: boolean
}

export default function DayNightControl({
  value,
  onChange,
  disabled = false,
}: DayNightControlProps) {
  return (
    <div className="flex overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)]">
      <button
        className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold transition-colors ${
          value === "day"
            ? "bg-[var(--color-owned)] text-[var(--color-bg)]"
            : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        }`}
        type="button"
        onClick={() => onChange("day")}
        disabled={disabled}
        aria-pressed={value === "day"}
      >
        <span aria-hidden="true">☀</span> Day
      </button>
      <button
        className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold transition-colors ${
          value === "night"
            ? "bg-[var(--color-night)] text-white"
            : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        }`}
        type="button"
        onClick={() => onChange("night")}
        disabled={disabled}
        aria-pressed={value === "night"}
      >
        <span aria-hidden="true">☽</span> Night
      </button>
    </div>
  )
}
