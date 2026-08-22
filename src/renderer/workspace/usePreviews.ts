import { useCallback, useEffect, useRef, useState } from 'react'
import type { PreviewEntry } from '@shared/previews'
import { relativeTime } from '@shared/relativeTime'
import type { PreviewsViewEntry } from './PreviewsView'

function mapPreviewEntries(previews: PreviewEntry[]): PreviewsViewEntry[] {
  const nowMs = Date.now()
  return previews.map(entry => ({
    fileName: entry.fileName,
    title: entry.title,
    subtitle: relativeTime(entry.mtimeMs, nowMs),
  }))
}

export function usePreviews(cwd: string, open: boolean): {
  entries: PreviewsViewEntry[]
  selectedFileName: string | null
  html: string | null
  loading: boolean
  error: string | null
  select: (fileName: string) => void
  remove: (fileName: string) => void
  refresh: () => void
} {
  const [entries, setEntries] = useState<PreviewsViewEntry[]>([])
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)
  const [html, setHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selectGenRef = useRef(0)

  const select = useCallback((fileName: string): void => {
    if (!cwd.trim()) return
    const gen = ++selectGenRef.current
    setSelectedFileName(fileName)
    setLoading(true)
    setError(null)
    setHtml(null)
    void window.api.previewsRead(cwd, fileName).then(result => {
      if (gen !== selectGenRef.current) return
      setLoading(false)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setHtml(result.html)
    })
  }, [cwd])

  const loadList = useCallback(async (): Promise<PreviewEntry[]> => {
    if (!cwd.trim()) {
      setEntries([])
      return []
    }
    const result = await window.api.previewsList(cwd)
    if (!result.ok) {
      setError(result.error)
      setEntries([])
      return []
    }
    setError(null)
    setEntries(mapPreviewEntries(result.previews))
    return result.previews
  }, [cwd])

  const refresh = useCallback((): void => {
    if (!open || !cwd.trim()) return
    void loadList()
  }, [open, cwd, loadList])

  const remove = useCallback((fileName: string): void => {
    if (!cwd.trim()) return
    const wasSelected = selectedFileName === fileName
    void window.api.previewsDelete(cwd, fileName).then(async result => {
      if (!result.ok) {
        setError(result.error)
        return
      }
      await loadList()
      if (wasSelected) {
        selectGenRef.current += 1
        setSelectedFileName(null)
        setHtml(null)
        setLoading(false)
      }
    })
  }, [cwd, selectedFileName, loadList])

  useEffect(() => {
    if (!open || !cwd.trim()) return
    let cancelled = false
    void loadList().then(previews => {
      if (cancelled) return
      if (previews.length > 0) {
        select(previews[0].fileName)
      } else {
        setSelectedFileName(null)
        setHtml(null)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [open, cwd, loadList, select])

  return {
    entries,
    selectedFileName,
    html,
    loading,
    error,
    select,
    remove,
    refresh,
  }
}
