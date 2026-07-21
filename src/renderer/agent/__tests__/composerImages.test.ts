import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MAX_MODEL_IMAGE_EDGE,
  optimizeImageForModel,
  SKIP_OPTIMIZE_UNDER_BYTES,
} from '../composerImages'

function mockBitmap(width: number, height: number): ImageBitmap {
  return {
    width,
    height,
    close: vi.fn(),
  } as unknown as ImageBitmap
}

describe('optimizeImageForModel', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('skips re-encode for compact jpeg already within model edge', async () => {
    const bytes = new Uint8Array(Math.min(32_000, SKIP_OPTIMIZE_UNDER_BYTES - 1))
    const blob = new Blob([bytes], { type: 'image/jpeg' })
    vi.stubGlobal('createImageBitmap', vi.fn(async () => mockBitmap(800, 600)))

    const result = await optimizeImageForModel(blob, 'shot.jpg')

    expect(result.blob).toBe(blob)
    expect(result.mimeType).toBe('image/jpeg')
    expect(result.name).toBe('shot.jpg')
  })

  it('resizes oversized images to the model edge as webp', async () => {
    const source = new Blob([new Uint8Array(900_000)], { type: 'image/png' })
    const optimizedBlob = new Blob([new Uint8Array(40_000)], { type: 'image/webp' })
    vi.stubGlobal('createImageBitmap', vi.fn(async () => mockBitmap(4000, 3000)))

    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ drawImage: vi.fn() })),
      toBlob: vi.fn((callback: BlobCallback, mimeType?: string) => {
        if (mimeType === 'image/webp') callback(optimizedBlob)
        else callback(null)
      }),
    }
    vi.stubGlobal('document', {
      createElement: vi.fn(() => canvas),
    })

    const result = await optimizeImageForModel(source, 'huge-screenshot.png')

    expect(canvas.width).toBe(MAX_MODEL_IMAGE_EDGE)
    expect(canvas.height).toBe(1152)
    expect(result.mimeType).toBe('image/webp')
    expect(result.name).toBe('huge-screenshot.webp')
    expect(result.blob).toBe(optimizedBlob)
  })
})
