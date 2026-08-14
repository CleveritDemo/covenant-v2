import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  attachmentsToPendingImages,
  MAX_CHAT_PREVIEW_EDGE,
  MAX_MODEL_IMAGE_EDGE,
  blobToThumbnailDataUrl,
  optimizeImageForModel,
  pendingImageFromBlob,
  publishedQueueImagePreviewUrl,
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

describe('blobToThumbnailDataUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('scales chat preview to the readable edge, not a tiny thumb', async () => {
    const source = new Blob([new Uint8Array(8_000)], { type: 'image/png' })
    vi.stubGlobal('createImageBitmap', vi.fn(async () => mockBitmap(2560, 1440)))

    const context = {
      drawImage: vi.fn(),
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low' as ImageSmoothingQuality,
    }
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
      toDataURL: vi.fn(() => 'data:image/webp;base64,AAA'),
    }
    vi.stubGlobal('document', {
      createElement: vi.fn(() => canvas),
    })

    const result = await blobToThumbnailDataUrl(source)

    expect(canvas.width).toBe(MAX_CHAT_PREVIEW_EDGE)
    expect(canvas.height).toBe(720)
    expect(context.imageSmoothingQuality).toBe('high')
    expect(result).toBe('data:image/webp;base64,AAA')
  })
})

describe('pendingImageFromBlob', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('stores thumbnailDataUrl alongside the blob previewUrl', async () => {
    const source = new Blob([new Uint8Array(4_000)], { type: 'image/png' })
    vi.stubGlobal('crypto', { randomUUID: () => 'img-1' })
    vi.stubGlobal('createImageBitmap', vi.fn(async () => mockBitmap(400, 300)))
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:local-preview'),
      revokeObjectURL: vi.fn(),
    })

    const context = { drawImage: vi.fn() }
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
      toBlob: vi.fn((callback: BlobCallback) => callback(source)),
      toDataURL: vi.fn(() => 'data:image/webp;base64,thumb'),
    }
    vi.stubGlobal('document', {
      createElement: vi.fn(() => canvas),
    })

    const image = await pendingImageFromBlob(source, 'shot.png')

    expect(image?.previewUrl).toBe('blob:local-preview')
    expect(image?.thumbnailDataUrl).toBe('data:image/webp;base64,thumb')
    expect(publishedQueueImagePreviewUrl(image!)).toBe('data:image/webp;base64,thumb')
  })
})

describe('attachmentsToPendingImages', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('builds pending images with stable thumbnail data URLs', async () => {
    const bytes = new Uint8Array([1, 2, 3])
    const base64 = btoa(String.fromCharCode(...bytes))
    vi.stubGlobal('crypto', { randomUUID: () => 'img-1' })
    vi.stubGlobal('createImageBitmap', vi.fn(async () => mockBitmap(80, 60)))
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:attachment'),
      revokeObjectURL: vi.fn(),
    })

    const context = { drawImage: vi.fn(), imageSmoothingEnabled: false, imageSmoothingQuality: 'low' }
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
      toDataURL: vi.fn(() => 'data:image/webp;base64,queued'),
    }
    vi.stubGlobal('document', {
      createElement: vi.fn(() => canvas),
    })

    const pending = await attachmentsToPendingImages([{
      name: 'paste.png',
      mimeType: 'image/png',
      base64,
    }])

    expect(pending).toHaveLength(1)
    expect(pending[0]?.previewUrl).toBe('blob:attachment')
    expect(pending[0]?.thumbnailDataUrl).toBe('data:image/webp;base64,queued')
    URL.revokeObjectURL('blob:attachment')
    expect(publishedQueueImagePreviewUrl(pending[0]!)).toMatch(/^data:/)
  })
})

describe('publishedQueueImagePreviewUrl', () => {
  it('prefers thumbnailDataUrl over revocable blob preview', () => {
    expect(publishedQueueImagePreviewUrl({
      previewUrl: 'blob:dead',
      thumbnailDataUrl: 'data:image/webp;base64,alive',
    })).toBe('data:image/webp;base64,alive')
  })
})
