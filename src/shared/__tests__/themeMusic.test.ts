import { describe, expect, it, vi } from 'vitest'

vi.mock('../../renderer/assets/music/avatar.mp3?url', () => ({ default: 'avatar.mp3' }))
vi.mock('../../renderer/assets/music/cyberpunk.mp3?url', () => ({ default: 'cyberpunk.mp3' }))
vi.mock('../../renderer/assets/music/dragonballz.mp3?url', () => ({ default: 'dragonballz.mp3' }))
vi.mock('../../renderer/assets/music/interstellar.mp3?url', () => ({ default: 'interstellar.mp3' }))
vi.mock('../../renderer/assets/music/matrix.mp3?url', () => ({ default: 'matrix.mp3' }))
vi.mock('../../renderer/assets/music/metroid.mp3?url', () => ({ default: 'metroid.mp3' }))
vi.mock('../../renderer/assets/music/pokemon.mp3?url', () => ({ default: 'pokemon.mp3' }))
vi.mock('../../renderer/assets/music/ragnarokonline.mp3?url', () => ({ default: 'ragnarokonline.mp3' }))
vi.mock('../../renderer/assets/music/saintseiya.mp3?url', () => ({ default: 'saintseiya.mp3' }))
vi.mock('../../renderer/assets/music/starwars.mp3?url', () => ({ default: 'starwars.mp3' }))
vi.mock('../../renderer/assets/music/strangerthings.mp3?url', () => ({ default: 'strangerthings.mp3' }))
vi.mock('../../renderer/assets/music/tokyo.mp3?url', () => ({ default: 'tokyo.mp3' }))
vi.mock('../../renderer/assets/music/tron.mp3?url', () => ({ default: 'tron.mp3' }))
vi.mock('../../renderer/assets/music/vikings.mp3?url', () => ({ default: 'vikings.mp3' }))
vi.mock('../../renderer/assets/music/zelda.mp3?url', () => ({ default: 'zelda.mp3' }))

import { resolveThemeMusic, THEME_MUSIC_BY_THEME_ID } from '../themeMusic'

const PAIRED_THEMES: Array<[string, string, string]> = [
  ['tokyoNight', 'tokyoNightDay', 'tokyo.mp3'],
  ['matrix', 'matrixLight', 'matrix.mp3'],
  ['interstellar', 'interstellarLight', 'interstellar.mp3'],
  ['cyberpunkNeon', 'cyberpunkNeonLight', 'cyberpunk.mp3'],
  ['tron', 'tronLight', 'tron.mp3'],
  ['strangerThings', 'strangerThingsLight', 'strangerthings.mp3'],
  ['starWars', 'starWarsLight', 'starwars.mp3'],
  ['avatar', 'avatarLight', 'avatar.mp3'],
  ['zeldaDeepWoods', 'zeldaDeepWoodsLight', 'zelda.mp3'],
  ['vikings', 'vikingsLight', 'vikings.mp3'],
  ['ragnarokOnline', 'ragnarokOnlineLight', 'ragnarokonline.mp3'],
  ['metroid', 'metroidLight', 'metroid.mp3'],
  ['pokemon', 'pokemonLight', 'pokemon.mp3'],
  ['dragonBallZ', 'dragonBallZLight', 'dragonballz.mp3'],
  ['saintSeiya', 'saintSeiyaLight', 'saintseiya.mp3'],
]

describe('resolveThemeMusic', () => {
  it('devuelve track por themeId con src del archivo', () => {
    for (const [darkId, lightId, file] of PAIRED_THEMES) {
      expect(resolveThemeMusic(darkId)?.src).toMatch(new RegExp(`${file}$`))
      expect(resolveThemeMusic(lightId)?.src).toMatch(new RegExp(`${file}$`))
    }
  })

  it('light y dark comparten el mismo src', () => {
    for (const [darkId, lightId] of PAIRED_THEMES) {
      expect(resolveThemeMusic(darkId)?.src).toBe(resolveThemeMusic(lightId)?.src)
    }
  })

  it('sin match o tema sin música (credicorp) retorna null', () => {
    expect(resolveThemeMusic('credicorp')).toBeNull()
    expect(resolveThemeMusic('')).toBeNull()
  })

  it('el registro declara light y dark de cada tema con mp3', () => {
    expect(Object.keys(THEME_MUSIC_BY_THEME_ID).sort()).toEqual(
      PAIRED_THEMES.flatMap(([dark, light]) => [dark, light]).sort(),
    )
  })
})
