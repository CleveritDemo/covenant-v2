import avatarUrl from '../renderer/assets/music/avatar.mp3?url'
import cyberpunkUrl from '../renderer/assets/music/cyberpunk.mp3?url'
import interstellarUrl from '../renderer/assets/music/interstellar.mp3?url'
import matrixUrl from '../renderer/assets/music/matrix.mp3?url'
import metroidUrl from '../renderer/assets/music/metroid.mp3?url'
import pokemonUrl from '../renderer/assets/music/pokemon.mp3?url'
import ragnarokonlineUrl from '../renderer/assets/music/ragnarokonline.mp3?url'
import saintseiyaUrl from '../renderer/assets/music/saintseiya.mp3?url'
import starwarsUrl from '../renderer/assets/music/starwars.mp3?url'
import strangerthingsUrl from '../renderer/assets/music/strangerthings.mp3?url'
import tokyoUrl from '../renderer/assets/music/tokyo.mp3?url'
import tronUrl from '../renderer/assets/music/tron.mp3?url'
import vikingsUrl from '../renderer/assets/music/vikings.mp3?url'
import zeldaUrl from '../renderer/assets/music/zelda.mp3?url'

/** Track de música de fondo ligado a un `themeId` explícito. */
export interface ThemeMusicTrack {
  id: string
  label: string
  src: string
  loop?: boolean
}

function track(id: string, label: string, src: string): ThemeMusicTrack {
  return { id, label, src }
}

const tokyo = track('tokyo', 'Tokyo Night', tokyoUrl)
const matrix = track('matrix', 'Matrix', matrixUrl)
const interstellar = track('interstellar', 'Interstellar', interstellarUrl)
const cyberpunk = track('cyberpunk', 'Cyberpunk Neon', cyberpunkUrl)
const tron = track('tron', 'TRON', tronUrl)
const strangerThings = track('strangerthings', 'Stranger Things', strangerthingsUrl)
const starWars = track('starwars', 'Star Wars', starwarsUrl)
const avatar = track('avatar', 'Avatar', avatarUrl)
const zelda = track('zelda', 'Zelda', zeldaUrl)
const vikings = track('vikings', 'Vikings', vikingsUrl)
const ragnarokOnline = track('ragnarokonline', 'Ragnarok Online', ragnarokonlineUrl)
const metroid = track('metroid', 'Metroid', metroidUrl)
const pokemon = track('pokemon', 'Pokémon', pokemonUrl)
const saintSeiya = track('saintseiya', 'Saint Seiya', saintseiyaUrl)

/**
 * Registro declarativo themeId → track.
 * Sin fallback: solo los ids listados tienen música.
 * Light/dark del mismo tema comparten el mismo src.
 */
export const THEME_MUSIC_BY_THEME_ID: Partial<Record<string, ThemeMusicTrack>> = {
  tokyoNight: tokyo,
  tokyoNightDay: tokyo,
  matrix,
  matrixLight: matrix,
  interstellar,
  interstellarLight: interstellar,
  cyberpunkNeon: cyberpunk,
  cyberpunkNeonLight: cyberpunk,
  tron,
  tronLight: tron,
  strangerThings,
  strangerThingsLight: strangerThings,
  starWars,
  starWarsLight: starWars,
  avatar,
  avatarLight: avatar,
  zeldaDeepWoods: zelda,
  zeldaDeepWoodsLight: zelda,
  vikings,
  vikingsLight: vikings,
  ragnarokOnline,
  ragnarokOnlineLight: ragnarokOnline,
  metroid,
  metroidLight: metroid,
  pokemon,
  pokemonLight: pokemon,
  saintSeiya,
  saintSeiyaLight: saintSeiya,
}

/** Solo match explícito; sin fallback a otro tema. */
export function resolveThemeMusic(themeId: string): ThemeMusicTrack | null {
  return THEME_MUSIC_BY_THEME_ID[themeId] ?? null
}
