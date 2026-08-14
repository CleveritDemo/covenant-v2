import type { AgentCliImageAttachment } from '@shared/agentCliTypes'

export const MAX_PENDING_IMAGES = 6
/** Tope de aceptación al pegar (antes de optimizar). */
export const MAX_IMAGE_BYTES = 12 * 1024 * 1024
/**
 * Lado largo máximo enviado al modelo.
 * Claude/GPT reescalan cerca de ~1568px; 1536 evita tokens de más sin perder UI legible.
 */
export const MAX_MODEL_IMAGE_EDGE = 1536
/** Calidad WebP/JPEG; ~0.8 equilibra nitidez de texto y peso. */
export const MODEL_IMAGE_QUALITY = 0.82
/** Si ya es JPEG/WebP ≤ este peso y dentro del edge, no re-encodeamos. */
export const SKIP_OPTIMIZE_UNDER_BYTES = 400 * 1024

export interface ComposerPendingImage {
  id: string
  previewUrl: string
  /** Miniatura estable para chips del plano (data URL); el blob local sigue en previewUrl. */
  thumbnailDataUrl?: string
  blob: Blob
  mimeType: string
  name: string
}

/** Preview publicado al plano: data URL estable, no el blob revocable del pane. */
export function publishedQueueImagePreviewUrl(
  image: Pick<ComposerPendingImage, 'previewUrl' | 'thumbnailDataUrl'>,
): string {
  return image.thumbnailDataUrl ?? image.previewUrl
}

export function extensionForMime(mimeType: string): string {
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return '.jpg'
  if (mimeType === 'image/webp') return '.webp'
  if (mimeType === 'image/gif') return '.gif'
  return '.png'
}

function stemFromName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return 'paste'
  return trimmed.replace(/\.[^.]+$/, '') || 'paste'
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsDataURL(blob)
  })
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob), mimeType, quality)
  })
}

/**
 * Reduce la imagen para el modelo: max edge 1536px → WebP (fallback JPEG).
 * Ideal típico tras optimizar: ~150–400 KB; suficiente para leer UI/código en pantallas.
 */
export async function optimizeImageForModel(
  blob: Blob,
  name: string,
): Promise<{ blob: Blob; mimeType: string; name: string }> {
  const sourceMime = (blob.type || 'image/png').toLowerCase()
  try {
    const bitmap = await createImageBitmap(blob)
    const maxDim = Math.max(bitmap.width, bitmap.height)
    const needsResize = maxDim > MAX_MODEL_IMAGE_EDGE
    const alreadyCompact = !needsResize
      && blob.size > 0
      && blob.size <= SKIP_OPTIMIZE_UNDER_BYTES
      && (sourceMime === 'image/jpeg' || sourceMime === 'image/jpg' || sourceMime === 'image/webp')

    if (alreadyCompact) {
      bitmap.close()
      return { blob, mimeType: sourceMime === 'image/jpg' ? 'image/jpeg' : sourceMime, name }
    }

    const scale = needsResize ? MAX_MODEL_IMAGE_EDGE / maxDim : 1
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) {
      bitmap.close()
      return { blob, mimeType: sourceMime, name }
    }
    context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const stem = stemFromName(name)
    const webp = await canvasToBlob(canvas, 'image/webp', MODEL_IMAGE_QUALITY)
    if (webp && webp.size > 0 && webp.size < blob.size) {
      return { blob: webp, mimeType: 'image/webp', name: `${stem}.webp` }
    }
    if (webp && webp.size > 0 && needsResize) {
      return { blob: webp, mimeType: 'image/webp', name: `${stem}.webp` }
    }

    const jpeg = await canvasToBlob(canvas, 'image/jpeg', MODEL_IMAGE_QUALITY)
    if (jpeg && jpeg.size > 0 && (jpeg.size < blob.size || needsResize)) {
      return { blob: jpeg, mimeType: 'image/jpeg', name: `${stem}.jpg` }
    }

    return { blob, mimeType: sourceMime, name }
  } catch {
    return { blob, mimeType: sourceMime, name }
  }
}

/**
 * Preview del chat (data URL): suficiente para el lightbox, no la original.
 * Antes era 96px y al abrirla quedaba pixelada; 1280 deja leer UI/código.
 * La miniatura del hilo sigue a 36px vía CSS (`object-fit: cover`).
 */
export const MAX_CHAT_PREVIEW_EDGE = 1280
/** Nitidez de texto en capturas sin inflar demasiado el historial. */
export const CHAT_PREVIEW_QUALITY = 0.85

export async function blobToThumbnailDataUrl(blob: Blob): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(blob)
    const scale = Math.min(1, MAX_CHAT_PREVIEW_EDGE / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) {
      bitmap.close()
      return null
    }
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()
    return canvas.toDataURL('image/webp', CHAT_PREVIEW_QUALITY)
  } catch {
    return null
  }
}

export function imagesFromClipboard(data: DataTransfer | null): File[] {
  if (!data) return []
  const files: File[] = []
  for (const item of Array.from(data.items ?? [])) {
    if (!item.type.startsWith('image/')) continue
    const file = item.getAsFile()
    if (file && file.size > 0 && file.size <= MAX_IMAGE_BYTES) files.push(file)
  }
  if (files.length) return files
  for (const file of Array.from(data.files ?? [])) {
    if (file.type.startsWith('image/') && file.size > 0 && file.size <= MAX_IMAGE_BYTES) {
      files.push(file)
    }
  }
  return files
}

/**
 * Copia los bytes a un Blob estable y lo optimiza para el modelo.
 * Punto de entrada de cualquier origen: portapapeles, sketch, archivo.
 */
export async function pendingImageFromBlob(
  source: Blob,
  name: string,
): Promise<ComposerPendingImage | null> {
  try {
    const buffer = await source.arrayBuffer()
    if (!buffer.byteLength || buffer.byteLength > MAX_IMAGE_BYTES) return null
    const sourceMime = source.type || 'image/png'
    const sourceBlob = new Blob([buffer], { type: sourceMime })
    const optimized = await optimizeImageForModel(sourceBlob, name)
    const thumbnailDataUrl = await blobToThumbnailDataUrl(optimized.blob)
    return {
      id: crypto.randomUUID(),
      previewUrl: URL.createObjectURL(optimized.blob),
      ...(thumbnailDataUrl ? { thumbnailDataUrl } : {}),
      blob: optimized.blob,
      mimeType: optimized.mimeType,
      name: optimized.name,
    }
  } catch {
    return null
  }
}

/**
 * Igual que `pendingImageFromBlob`, pero conservando el nombre del File.
 * En Chromium/Electron el File de clipboard se invalida al terminar el paste,
 * por eso los bytes se copian antes de hacer cualquier otra cosa.
 */
export function materializeClipboardImage(
  file: File,
  fallbackName: string,
): Promise<ComposerPendingImage | null> {
  return pendingImageFromBlob(file, file.name || fallbackName)
}

export async function pendingImagesToAttachments(
  images: ComposerPendingImage[],
): Promise<AgentCliImageAttachment[]> {
  const attachments: AgentCliImageAttachment[] = []
  for (const [index, image] of images.entries()) {
    try {
      const optimized = await optimizeImageForModel(
        image.blob,
        image.name || `paste-${index + 1}${extensionForMime(image.mimeType)}`,
      )
      const base64 = await blobToBase64(optimized.blob)
      if (!base64) continue
      attachments.push({
        name: optimized.name || `paste-${index + 1}${extensionForMime(optimized.mimeType)}`,
        mimeType: optimized.mimeType,
        base64,
      })
    } catch {
      // Ignorar adjuntos ilegibles.
    }
  }
  return attachments
}

export async function attachmentsToPendingImages(
  images: AgentCliImageAttachment[],
): Promise<ComposerPendingImage[]> {
  const pending: ComposerPendingImage[] = []
  for (const image of images) {
    const binary = atob(image.base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    const blob = new Blob([bytes], { type: image.mimeType || 'image/png' })
    const thumbnailDataUrl = await blobToThumbnailDataUrl(blob)
    pending.push({
      id: crypto.randomUUID(),
      previewUrl: URL.createObjectURL(blob),
      ...(thumbnailDataUrl ? { thumbnailDataUrl } : {}),
      blob,
      mimeType: image.mimeType || 'image/png',
      name: image.name,
    })
  }
  return pending
}
