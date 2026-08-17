export function shouldBridgeVisibleLaneEvent(input: {
  laneBusy: boolean
  laneHasOwnSubscription: boolean
}): 'bridge' | 'skip' | 'visible' {
  if (!input.laneBusy) return 'visible'
  if (input.laneHasOwnSubscription) return 'skip'
  return 'bridge'
}
