interface SOSControlProps {
  active: boolean
  onChange: (active: boolean) => void
  disabled?: boolean
}

export default function SOSControl({
  active,
  onChange,
  disabled = false,
}: SOSControlProps) {
  return (
    <button
      className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors ${
        active
          ? "border-[var(--color-sos)] bg-[var(--color-sos)] text-white"
          : "border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
      }`}
      type="button"
      onClick={() => onChange(!active)}
      disabled={disabled}
      aria-pressed={active}
    >
      SOS
    </button>
  )
}
