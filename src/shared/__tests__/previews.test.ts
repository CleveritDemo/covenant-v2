import { describe, expect, it } from 'vitest'
import { isPreviewFileName, previewTitleFromHtml } from '../previews'

describe('isPreviewFileName', () => {
  it('rechaza traversal y extensiones no válidas', () => {
    expect(isPreviewFileName('../x.html')).toBe(false)
    expect(isPreviewFileName('a/b.html')).toBe(false)
    expect(isPreviewFileName('x.txt')).toBe(false)
  })

  it('acepta html, htm y svg', () => {
    expect(isPreviewFileName('foo.html')).toBe(true)
    expect(isPreviewFileName('bar.htm')).toBe(true)
    expect(isPreviewFileName('icon.svg')).toBe(true)
  })
})

describe('previewTitleFromHtml', () => {
  it('extrae title del html', () => {
    expect(previewTitleFromHtml('<html><title>  Mi   Título  </title></html>', 'stem')).toBe('Mi Título')
  })

  it('usa stem si no hay title', () => {
    expect(previewTitleFromHtml('<html><body>x</body></html>', 'my-stem_file')).toBe('my stem file')
  })

  it('usa stem si title vacío', () => {
    expect(previewTitleFromHtml('<html><title>   </title></html>', 'fallback')).toBe('fallback')
  })
})
