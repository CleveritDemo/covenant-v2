export type WikiNodeModalEntry = {
  slug: string
  x: number
  y: number
  originX?: number
  originY?: number
}

export function mergeWikiNodeModalsOpen(
  previous: WikiNodeModalEntry[],
  incoming: WikiNodeModalEntry[],
  maxOpen = 3,
): WikiNodeModalEntry[] {
  const next = previous.map(item => ({ ...item }))
  for (const entry of incoming) {
    const idx = next.findIndex(item => item.slug === entry.slug)
    if (idx >= 0) next[idx] = entry
    else if (next.length < maxOpen) next.push(entry)
  }
  return next
}
