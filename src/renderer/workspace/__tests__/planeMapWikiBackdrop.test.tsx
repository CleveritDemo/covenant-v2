import { describe, expect, it } from 'vitest'
import { planeFloorAuroraActive } from '../PlaneMap'

describe('planeFloorAuroraActive', () => {
  // Main plane (stageHidden=false): floor aurora stays on whenever any agent is working.
  it('enables floor aurora when working and stage visible', () => {
    expect(planeFloorAuroraActive(true, false)).toBe(true)
  })

  it('disables floor aurora when wiki stage is hidden', () => {
    expect(planeFloorAuroraActive(true, true)).toBe(false)
  })

  it('disables floor aurora when not working', () => {
    expect(planeFloorAuroraActive(false, false)).toBe(false)
  })
})
