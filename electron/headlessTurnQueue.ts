import { MAX_CONCURRENT_HEADLESS_TURNS } from '../src/shared/headlessConcurrency'

let activeCount = 0
const waiters: Array<() => void> = []

export function acquireHeadlessTurnSlot(): Promise<void> {
  if (activeCount < MAX_CONCURRENT_HEADLESS_TURNS) {
    activeCount += 1
    return Promise.resolve()
  }
  return new Promise(resolve => {
    waiters.push(() => {
      activeCount += 1
      resolve()
    })
  })
}

export function releaseHeadlessTurnSlot(): void {
  activeCount = Math.max(0, activeCount - 1)
  const next = waiters.shift()
  if (next) next()
}

/** Solo tests: resetea contadores y cola. */
export function clearHeadlessTurnQueueForTests(): void {
  activeCount = 0
  waiters.length = 0
}
