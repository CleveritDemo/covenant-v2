function humanizeWikiSlug(slug: string): string {
  return slug.replace(/[-_]/g, ' ')
}

export function formatWikiPageBodyForHuman(raw: string): string {
  let text = raw

  text = text.replace(/<!--[\s\S]*?-->/g, '')
  text = text.replace(/```[\s\S]*?```/g, '')

  text = text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, slug: string, label?: string) => (
    label ?? humanizeWikiSlug(slug)
  ))

  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

  text = text.replace(/^#{1,6}\s+/gm, '')

  text = text.replace(/\*\*(.+?)\*\*/g, '$1')
  text = text.replace(/__(.+?)__/g, '$1')
  text = text.replace(/~~(.+?)~~/g, '$1')
  text = text.replace(/`([^`]+)`/g, '$1')
  text = text.replace(/(?<![*_])\*(?!\*)(.+?)(?<![*_])\*(?!\*)/g, '$1')
  text = text.replace(/(?<![*_])_(?!_)(.+?)(?<![*_])_(?!_)/g, '$1')

  text = text.replace(/^[\s]*[-*+]\s+/gm, '')
  text = text.replace(/^[\s]*\d+\.\s+/gm, '')

  text = text.replace(/\n{3,}/g, '\n\n').trim()

  return text
}
