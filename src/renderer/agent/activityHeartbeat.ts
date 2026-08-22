export const ACTIVITY_HEARTBEAT_BUCKET_MS = 1000

/** Bucket de sello de vida: evita re-render del pane en cada assistant_delta. */
export function shouldBumpActivityHeartbeat(
  prevMs: number,
  nowMs: number,
  bucketMs = ACTIVITY_HEARTBEAT_BUCKET_MS,
): boolean {
  if (prevMs === 0) return true
  if (nowMs < prevMs) return true
  return nowMs - prevMs >= bucketMs
}
