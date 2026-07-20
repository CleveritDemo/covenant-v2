import type { AgentCliImageAttachment } from '@shared/agentCliTypes'

export const MAX_PENDING_IMAGES = 6
export const MAX_IMAGE_BYTES = 12 * 1024 * 1024

export interface ComposerPendingImage {
  id: string
  previewUrl: string
  blob: Blob
  mimeType: string
  name: string
}

export function extensionForMime(mimeType: string): string {
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return '.jpg'
  if (mimeType === 'image/webp') return '.webp'
  if (mimeType === 'image/gif') return '.gif'
  return '.png'
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

/** Miniatura pequeña (máx. 96px) en data URL para persistir junto al mensaje. */
export async function blobToThumbnailDataUrl(blob: Blob): Promise<string | null> {
  const MAX_THUMB_DIM = 96
  try {
    const bitmap = await createImageBitmap(blob)
    const scale = Math.min(1, MAX_THUMB_DIM / Math.max(bitmap.width, bitmap.height))
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
    context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()
    return canvas.toDataURL('image/webp', 0.75)
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
 * Copia los bytes del archivo del portapapeles a un Blob estable.
 * En Chromium/Electron el File de clipboard se invalida al terminar el paste.
 */
export async function materializeClipboardImage(
  file: File,
  fallbackName: string,
): Promise<ComposerPendingImage | null> {
  try {
    const buffer = await file.arrayBuffer()
    if (!buffer.byteLength || buffer.byteLength > MAX_IMAGE_BYTES) return null
    const mimeType = file.type || 'image/png'
    const blob = new Blob([buffer], { type: mimeType })
    return {
      id: crypto.randomUUID(),
      previewUrl: URL.createObjectURL(blob),
      blob,
      mimeType,
      name: file.name || fallbackName,
    }
  } catch {
    return null
  }
}

export async function pendingImagesToAttachments(
  images: ComposerPendingImage[],
): Promise<AgentCliImageAttachment[]> {
  const attachments: AgentCliImageAttachment[] = []
  for (const [index, image] of images.entries()) {
    try {
      const base64 = await blobToBase64(image.blob)
      if (!base64) continue
      attachments.push({
        name: image.name || `paste-${index + 1}${extensionForMime(image.mimeType)}`,
        mimeType: image.mimeType,
        base64,
      })
    } catch {
      // Ignorar adjuntos ilegibles.
    }
  }
  return attachments
}

export function attachmentsToPendingImages(
  images: AgentCliImageAttachment[],
): ComposerPendingImage[] {
  return images.map(image => {
    const binary = atob(image.base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    const blob = new Blob([bytes], { type: image.mimeType || 'image/png' })
    return {
      id: crypto.randomUUID(),
      previewUrl: URL.createObjectURL(blob),
      blob,
      mimeType: image.mimeType || 'image/png',
      name: image.name,
    }
  })
}
