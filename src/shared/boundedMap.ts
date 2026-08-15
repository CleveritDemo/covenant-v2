/** Concurrencia acotada para round-trips Covenant (mismo techo que el gate del main). */

export const COVENANT_REQUEST_LIMIT = 4

/**
 * Mapea `items` con como mucho `limit` promesas en vuelo.
 * Preserva el orden del array de salida; propaga el primer reject (Promise.all).
 * `limit <= 0` se trata como 1.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const n = items.length
  if (n === 0) return []
  const concurrency = Math.max(1, Math.floor(limit) || 1)
  const results = new Array<R>(n)
  let next = 0

  async function worker(): Promise<void> {
    while (true) {
      const i = next
      next += 1
      if (i >= n) return
      results[i] = await fn(items[i]!, i)
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, n) },
    () => worker(),
  )
  await Promise.all(workers)
  return results
}
