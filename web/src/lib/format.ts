export function formatLevelRange(
  minLevel?: number | null,
  maxLevel?: number | null,
): string | null {
  if (minLevel == null || maxLevel == null) return null
  return minLevel === maxLevel
    ? `Lv. ${minLevel}`
    : `Lv. ${minLevel}–${maxLevel}`
}

export function formatSlots(slots?: number[]): string | null {
  if (!slots?.length) return null

  const sorted = [...new Set(slots)].sort((left, right) => left - right)
  const ranges: string[] = []
  let start = sorted[0]
  let end = sorted[0]

  for (let index = 1; index <= sorted.length; index += 1) {
    const current = sorted[index]
    if (current === end + 1) {
      end = current
      continue
    }

    ranges.push(start === end ? `${start}` : `${start}–${end}`)
    start = current
    end = current
  }

  return ranges.join(", ")
}
