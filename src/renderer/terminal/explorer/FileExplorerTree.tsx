import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { FileExplorerEntry } from '@shared/fileExplorerTypes'
import { FILE_EXPLORER_ERROR_CODES } from '@shared/fileExplorerErrorCodes'
import { useT } from '@i18n/useT'
import { shortcutLabel } from '@i18n/modKeyLabel'
import { Icon } from '../../components/ui/Icon'
import { Tooltip } from '../../components/ui/Tooltip'
import { ExplorerToolButton } from './ExplorerToolButton'
import { FileExplorerCreateAction } from './FileExplorerCreateAction'
import {
  FileExplorerContextMenu,
  type FileExplorerContextMenuTarget,
} from './FileExplorerContextMenu'
import { FileExplorerNewMenu } from './FileExplorerNewMenu'
import { FileExplorerTreeNode } from './FileExplorerTreeNode'
import { ExplorerToast } from './ExplorerToast'
import type { ExplorerConfirmRequest } from './ExplorerConfirmHost'
import {
  buildNewRelPath,
  expandedPathsKey,
  isRelPathInside,
  normalizeSessionCwd,
  parentDirForCreate,
  parentRelPath,
  pasteDestRelPath,
  resolveExplorerActionPaths,
  seedMultiSelect,
  filterRowsKeepingAncestors,
  sessionCwdPaneLabel,
  type ExplorerSelectedEntry,
} from './explorerPathUtils'
import { mergeListDirIntoCache } from './explorerListCache'
import {
  buildGitStatusMap,
  sameGitStatusMap,
  gitStatusFromMap,
  type ExplorerGitStatus,
} from './fileExplorerGitStatus'
import { fileExplorerErrorMessage } from './fileExplorerErrorI18n'

interface FileExplorerTreeProps {
  sessionId: string
  selectedRelPath: string | null
  selectedIsDirectory?: boolean
  expandedRelPaths: string[]
  showHiddenDirs: boolean
  openOnSingleClick: boolean
  onExpandedChange: (paths: string[]) => void
  onShowHiddenDirsChange: (show: boolean) => void
  onOpenOnSingleClickChange?: (value: boolean) => void
  onSelectEntry: (
    relPath: string,
    isDirectory: boolean,
    e?: React.MouseEvent,
    options?: { open?: boolean },
  ) => boolean | Promise<boolean>
  onRequestConfirm?: (req: ExplorerConfirmRequest) => Promise<boolean>
  /** Confirmar discard si las rutas afectan el archivo abierto dirty. */
  canMutateOpenPaths?: (paths: string[]) => Promise<boolean>
  /** Confirmar discard antes de resetear el árbol por cambio de cwd. */
  canResetSessionRoot?: () => Promise<boolean>
  onFileCreated?: (relPath: string) => void
  onSessionRootChange?: () => void
  onCloseExplorer?: () => void
  onEntryDeleted?: (relPath: string) => void
  onEntryRenamed?: (oldRelPath: string, newRelPath: string, isDirectory: boolean) => void
}

export interface FileExplorerTreeHandle {
  refreshDir: (relPath: string) => Promise<void>
  reloadTree: () => Promise<void>
  resetTreeForNewCwd: () => Promise<void>
  evictDirCache: (relPath: string) => void
  expandParents: (relPath: string) => void
  refreshGitStatus: () => Promise<void>
}

type CreateMode = 'file' | 'dir' | null

const VIRTUAL_THRESHOLD = 200
const ROW_HEIGHT = 18

export const FileExplorerTree = forwardRef<FileExplorerTreeHandle, FileExplorerTreeProps>(
  function FileExplorerTree(
    {
      sessionId,
      selectedRelPath,
      selectedIsDirectory,
      expandedRelPaths,
      showHiddenDirs,
      openOnSingleClick,
      onExpandedChange,
      onShowHiddenDirsChange,
      onOpenOnSingleClickChange,
      onSelectEntry,
      onRequestConfirm,
      canMutateOpenPaths,
      canResetSessionRoot,
      onFileCreated,
      onSessionRootChange,
      onCloseExplorer,
      onEntryDeleted,
      onEntryRenamed,
    },
    ref,
  ) {
    const { t } = useT()
    const expandedSet = useMemo(() => new Set(expandedRelPaths), [expandedRelPaths])
    const [childrenByDir, setChildrenByDir] = useState<Map<string, FileExplorerEntry[]>>(
      () => new Map(),
    )
    // Espejo del cache para leerlo dentro de efectos sin meterlo en sus deps:
    // como dependencia haría que el efecto de expansión se re-dispare en cada
    // respuesta de `listDir`, que es justo lo que se quiere evitar.
    const childrenByDirRef = useRef(childrenByDir)
    childrenByDirRef.current = childrenByDir
    const [loadingDirs, setLoadingDirs] = useState<Set<string>>(() => new Set())
    const [createMode, setCreateMode] = useState<CreateMode>(null)
    const [createName, setCreateName] = useState('')
    const [createError, setCreateError] = useState<string | null>(null)
    const [creating, setCreating] = useState(false)
    const [rootError, setRootError] = useState<string | null>(null)
    const [filterQuery, setFilterQuery] = useState('')
    const [searchOpen, setSearchOpen] = useState(false)
    const [globalSearchHits, setGlobalSearchHits] = useState<
      Array<{ relPath: string; isDirectory: boolean }>
    >([])
    const [globalSearchTruncated, setGlobalSearchTruncated] = useState(false)
    const [globalSearchLoading, setGlobalSearchLoading] = useState(false)
    const [cutRelPaths, setCutRelPaths] = useState<Set<string>>(() => new Set())
    const [dragOverRelPath, setDragOverRelPath] = useState<string | null>(null)
    const [toastMessage, setToastMessage] = useState<string | null>(null)
    const [newMenu, setNewMenu] = useState<{ x: number; y: number } | null>(null)
    const [createParentOverride, setCreateParentOverride] = useState<string | null>(null)
    const [multiSelected, setMultiSelected] = useState<Set<string>>(() => new Set())
    const [lastClickedPath, setLastClickedPath] = useState<string | null>(null)
    const [focusedRowIndex, setFocusedRowIndex] = useState(0)
    const [treeRootCwd, setTreeRootCwd] = useState('')
    const [contextMenu, setContextMenu] = useState<{
      x: number
      y: number
      target: FileExplorerContextMenuTarget | null
    } | null>(null)
    const [renamingEntry, setRenamingEntry] = useState<FileExplorerContextMenuTarget | null>(null)
    const [renameName, setRenameName] = useState('')
    const [renameError, setRenameError] = useState<string | null>(null)
    const [gitStatusByPath, setGitStatusByPath] = useState<Map<string, ExplorerGitStatus>>(
      () => new Map(),
    )
    const treeScrollRef = useRef<HTMLDivElement>(null)
    const searchInputRef = useRef<HTMLInputElement>(null)
    const dragRelPathRef = useRef<string | null>(null)
    /** Copia actual de carpetas expandidas; evita toggles perdidos con clics rápidos antes del re-render. */
    const expandedRelPathsRef = useRef(expandedRelPaths)
    const pendingExpandedKeyRef = useRef<string | null>(null)

    useEffect(() => {
      const key = expandedPathsKey(expandedRelPaths)
      if (pendingExpandedKeyRef.current != null) {
        if (pendingExpandedKeyRef.current === key) {
          pendingExpandedKeyRef.current = null
          expandedRelPathsRef.current = expandedRelPaths
        }
        return
      }
      expandedRelPathsRef.current = expandedRelPaths
    }, [expandedRelPaths])

    const createParentPath = createParentOverride ?? parentDirForCreate(selectedRelPath, selectedIsDirectory)

    const selectedEntry: ExplorerSelectedEntry | null = selectedRelPath
      ? { relPath: selectedRelPath, isDirectory: Boolean(selectedIsDirectory) }
      : null

    const closeContextMenu = useCallback(() => {
      setContextMenu(null)
    }, [])

    const showToast = useCallback((message: string) => {
      setToastMessage(message)
    }, [])

    const showErrorToast = useCallback((error?: string, code?: Parameters<typeof fileExplorerErrorMessage>[2]) => {
      setToastMessage(fileExplorerErrorMessage(t, error, code))
    }, [t])

    const dismissToast = useCallback(() => {
      setToastMessage(null)
    }, [])

    const startCreate = useCallback((mode: CreateMode, parentOverride: string | null = null) => {
      setCreateParentOverride(parentOverride)
      setCreateMode(mode)
      setCreateName('')
      setCreateError(null)
      setNewMenu(null)
      closeContextMenu()
    }, [closeContextMenu])

    // Mismo motivo que en `loadDir`: el watcher llama a esto cada pocos cientos
    // de milisegundos y `buildGitStatusMap` siempre devuelve un Map nuevo, así
    // que sin comparar antes cada evento re-renderizaba el árbol entero aunque
    // git dijera exactamente lo mismo.
    const refreshGitStatus = useCallback(async (): Promise<void> => {
      let next: Map<string, ExplorerGitStatus>
      try {
        next = buildGitStatusMap(await window.api.gitStatus({ sessionId }))
      } catch {
        next = new Map()
      }
      setGitStatusByPath(prev => (sameGitStatusMap(prev, next) ? prev : next))
    }, [sessionId])

    const loadDirGenRef = useRef(new Map<string, number>())
    const loadDirInflightRef = useRef(new Map<string, Promise<void>>())

    const loadDir = useCallback(
      async (relPath: string): Promise<void> => {
        const existing = loadDirInflightRef.current.get(relPath)
        if (existing) return existing

        const gen = (loadDirGenRef.current.get(relPath) ?? 0) + 1
        loadDirGenRef.current.set(relPath, gen)
        // Sólo se anuncia "cargando" la PRIMERA vez. Una revalidación de fondo
        // —y con la raíz en $HOME el watcher dispara una cada ~600 ms— no debe
        // tocar `loadingDirs`: está en las deps de `visibleRows`, así que cada
        // add+delete rehacía la lista de filas dos veces por evento.
        const isFirstLoad = !childrenByDirRef.current.has(relPath)
        if (isFirstLoad) setLoadingDirs(prev => new Set(prev).add(relPath))

        const run = (async (): Promise<void> => {
          try {
            const result = await window.api.fileExplorerListDir(sessionId, relPath, showHiddenDirs)
            if (loadDirGenRef.current.get(relPath) !== gen) return
            if (relPath === '') {
              setRootError(result.ok ? null : fileExplorerErrorMessage(t, result.error, result.code))
            }
            setChildrenByDir(prev => mergeListDirIntoCache(prev, relPath, result))
          } finally {
            if (isFirstLoad && loadDirGenRef.current.get(relPath) === gen) {
              setLoadingDirs(prev => {
                if (!prev.has(relPath)) return prev
                const next = new Set(prev)
                next.delete(relPath)
                return next
              })
            }
          }
        })()

        loadDirInflightRef.current.set(relPath, run)
        try {
          await run
        } finally {
          if (loadDirInflightRef.current.get(relPath) === run) {
            loadDirInflightRef.current.delete(relPath)
          }
        }
      },
      [sessionId, showHiddenDirs, t],
    )

    const expandedKey = useMemo(() => expandedPathsKey(expandedRelPaths), [expandedRelPaths])
    const loadedExpandedKeyRef = useRef<string | null>(null)
    const loadedSessionRef = useRef<string | null>(null)
    /** Raíz a la que pertenece `childrenByDir`; si el cwd deja de coincidir, el cache está caduco. */
    const cacheRootRef = useRef<string>('')

    const reloadExpandedDirs = useCallback(async (): Promise<void> => {
      loadedExpandedKeyRef.current = expandedPathsKey(expandedRelPaths)
      await Promise.all(expandedRelPaths.filter(Boolean).map(rel => loadDir(rel)))
    }, [expandedRelPaths, loadDir])

    const reloadTree = useCallback(async (): Promise<void> => {
      setRootError(null)
      setContextMenu(null)
      loadedExpandedKeyRef.current = null
      setChildrenByDir(new Map())
      await loadDir('')
      await reloadExpandedDirs()
      await refreshGitStatus()
    }, [loadDir, reloadExpandedDirs, refreshGitStatus])

    const resetTreeForNewCwd = useCallback(async (): Promise<void> => {
      if (canResetSessionRoot) {
        const ok = await canResetSessionRoot()
        if (!ok) return
      }
      setRootError(null)
      setContextMenu(null)
      loadedExpandedKeyRef.current = null
      setChildrenByDir(new Map())
      setMultiSelected(new Set())
      setCutRelPaths(new Set())
      setFilterQuery('')
      setSearchOpen(false)
      setGlobalSearchHits([])
      setGlobalSearchTruncated(false)
      setCreateMode(null)
      setCreateName('')
      setCreateError(null)
      setCreateParentOverride(null)
      setRenamingEntry(null)
      const cwd = normalizeSessionCwd(await window.api.getSessionCwd(sessionId))
      setTreeRootCwd(cwd)
      cacheRootRef.current = cwd
      onSessionRootChange?.()
      window.api.fileExplorerWatchStart(sessionId)
      await loadDir('')
    }, [loadDir, onSessionRootChange, sessionId, canResetSessionRoot])

    const evictDirCache = useCallback((relPath: string): void => {
      const prefix = `${relPath}/`
      setChildrenByDir(prev => {
        const next = new Map(prev)
        for (const key of next.keys()) {
          if (key === relPath || key.startsWith(prefix)) next.delete(key)
        }
        return next
      })
    }, [])

    const commitExpandedPaths = useCallback(
      (paths: string[]): void => {
        const key = expandedPathsKey(paths)
        if (key === expandedPathsKey(expandedRelPathsRef.current)) return
        expandedRelPathsRef.current = paths
        pendingExpandedKeyRef.current = key
        onExpandedChange(paths)
      },
      [onExpandedChange],
    )

    const expandParents = useCallback(
      (relPath: string) => {
        const parts = relPath.split('/').filter(Boolean)
        const next = new Set(expandedRelPathsRef.current)
        next.add('')
        if (parts.length > 1) {
          let acc = ''
          for (let i = 0; i < parts.length - 1; i++) {
            acc = acc ? `${acc}/${parts[i]!}` : parts[i]!
            next.add(acc)
          }
        }
        commitExpandedPaths(Array.from(next))
        for (const p of next) {
          if (p && !childrenByDir.has(p)) void loadDir(p)
        }
      },
      [commitExpandedPaths, childrenByDir, loadDir],
    )

    useImperativeHandle(ref, () => ({
      refreshDir: loadDir,
      reloadTree,
      resetTreeForNewCwd,
      evictDirCache,
      expandParents,
      refreshGitStatus,
    }), [loadDir, reloadTree, resetTreeForNewCwd, evictDirCache, expandParents, refreshGitStatus])

    useEffect(() => {
      void refreshGitStatus()
      const unsubGit = window.api.onGitStatusChanged(sessionId, () => { void refreshGitStatus() })
      return () => unsubGit()
    }, [refreshGitStatus, sessionId])

    useEffect(() => {
      window.api.fileExplorerWatchStart(sessionId)
      const unsub = window.api.onFileExplorerFsChanged(sessionId, dirs => {
        // El watcher reporta CUALQUIER cambio bajo la raíz de la sesión. Con la
        // raíz en $HOME eso incluye la caché de Chrome, el análisis de Fotos o
        // el .git de otro repo: directorios que el árbol no tiene abiertos ni
        // cargados. Recargarlos no cambiaba nada en pantalla pero sí encendía y
        // apagaba `loadingDirs` en cada evento, y eso rehace la lista de filas.
        // Sólo se revalida lo que el árbol ya tiene en cache.
        const unique = Array.from(new Set(dirs)).filter(d => childrenByDirRef.current.has(d))
        void Promise.all(unique.map(d => loadDir(d)))
        void loadDir('')
        void refreshGitStatus()
      })
      return () => {
        unsub()
        window.api.fileExplorerWatchStop(sessionId)
      }
    }, [sessionId, loadDir, refreshGitStatus])

    useEffect(() => {
      setCreateMode(null)
      setCreateName('')
      setCreateError(null)
      setChildrenByDir(new Map())
      setCutRelPaths(new Set())
      setMultiSelected(new Set())
      loadedExpandedKeyRef.current = null
      loadedSessionRef.current = sessionId
      // Cache nuevo: todavía no pertenece a ninguna raíz conocida. `syncCwd`
      // adopta la primera que lea en vez de disparar un reset gratuito.
      cacheRootRef.current = ''
      void window.api.getSessionCwd(sessionId).then(cwd => {
        const normalized = normalizeSessionCwd(cwd)
        setTreeRootCwd(normalized)
        cacheRootRef.current = normalized
      })
      void loadDir('')
    }, [sessionId, loadDir])

    // Vaciar y recargar el árbol es SÓLO para el toggle de "ver ocultos".
    //
    // Tenía `reloadExpandedDirs` en las deps, y esa callback depende de
    // `expandedRelPaths`: cambiaba de identidad cada vez que se expandía o
    // colapsaba una carpeta, así que el efecto corría y lo primero que hace es
    // `setChildrenByDir(new Map())` — el árbol entero se vaciaba y se repoblaba
    // en cada clic, y también varias veces durante el arranque mientras el
    // estado de expansión se asienta. Eso era el parpadeo: filas desapareciendo
    // y volviendo, con un "Empty folder" de por medio.
    //
    // Ahora se compara el valor real y la callback se lee de una ref, que es lo
    // que hace que la identidad de `expandedRelPaths` deje de importar aquí.
    const reloadExpandedDirsRef = useRef(reloadExpandedDirs)
    reloadExpandedDirsRef.current = reloadExpandedDirs
    const prevShowHiddenRef = useRef(showHiddenDirs)

    useEffect(() => {
      if (prevShowHiddenRef.current === showHiddenDirs) return
      prevShowHiddenRef.current = showHiddenDirs
      loadedExpandedKeyRef.current = null
      setChildrenByDir(new Map())
      void (async () => {
        await loadDir('')
        await reloadExpandedDirsRef.current()
      })()
    }, [showHiddenDirs, loadDir])

    // Al expandir una carpeta esto recargaba TODAS las expandidas: con 15
    // abiertas, 15 idas y vueltas por IPC y sus 15 `setChildrenByDir`. Sólo hay
    // que cargar las que aún no están en el cache — al resto ya las trajo el
    // `prefetchDepth: 1` de su padre, y `reloadTree()` sigue siendo quien fuerza
    // una recarga completa cuando de verdad hace falta.
    useEffect(() => {
      if (loadedSessionRef.current !== sessionId) return
      if (loadedExpandedKeyRef.current === expandedKey) return
      loadedExpandedKeyRef.current = expandedKey
      if (!expandedKey) return
      for (const rel of expandedKey.split('\0')) {
        if (childrenByDirRef.current.has(rel)) continue
        void loadDir(rel)
      }
    }, [expandedKey, loadDir, sessionId])

    // El cache pertenece SIEMPRE a una raíz concreta, y `cacheRootRef` dice a
    // cuál. Antes esto se guiaba por un debounce temporal: se actualizaba la
    // etiqueta de la raíz y, si el cambio caía dentro de los 3 s siguientes a un
    // reset manual, se salía sin vaciar el cache. El resultado era una cabecera
    // diciendo una carpeta y un árbol mostrando el contenido de otra, y al abrir
    // un archivo la ruta se resolvía contra la raíz nueva: "Could not load".
    //
    // Comparar contra la raíz del cache en vez de contra un reloj hace el
    // invariante explícito y quita el caso de carrera: si no coinciden, se
    // recarga; si coinciden, no hay nada que hacer aunque acabe de haber un
    // reset manual. La etiqueta la mueve `resetTreeForNewCwd`, así que ya no
    // puede adelantarse al contenido.
    useEffect(() => {
      const syncCwd = async (): Promise<void> => {
        const cwd = normalizeSessionCwd(await window.api.getSessionCwd(sessionId))
        if (!cwd) return
        if (cacheRootRef.current === '') {
          // Primera lectura tras montar: el efecto de sesión ya está cargando
          // para esta raíz, así que se adopta en vez de resetear.
          cacheRootRef.current = cwd
          setTreeRootCwd(cwd)
          return
        }
        if (cwd === cacheRootRef.current) return
        await resetTreeForNewCwd()
      }
      void syncCwd()
      const id = window.setInterval(() => { void syncCwd() }, 3000)
      return () => window.clearInterval(id)
    }, [sessionId, resetTreeForNewCwd])

    const setDirExpanded = useCallback(
      (relPath: string, expanded: boolean): void => {
        const next = new Set(expandedRelPathsRef.current)
        if (expanded) {
          if (next.has(relPath)) return
          next.add(relPath)
          if (!childrenByDir.has(relPath)) void loadDir(relPath)
        } else if (!next.delete(relPath)) {
          return
        }
        commitExpandedPaths(Array.from(next))
      },
      [childrenByDir, loadDir, commitExpandedPaths],
    )

    const toggleDir = useCallback(
      (relPath: string): void => {
        const isExpanded = expandedRelPathsRef.current.includes(relPath)
        setDirExpanded(relPath, !isExpanded)
      },
      [setDirExpanded],
    )

    const getSelectedRelPaths = useCallback((): string[] => {
      return resolveExplorerActionPaths(
        multiSelected,
        contextMenu?.target?.relPath,
        selectedRelPath,
      )
    }, [multiSelected, contextMenu, selectedRelPath])

    const handleSelectEntry = useCallback(
      async (relPath: string, isDirectory: boolean, e?: React.MouseEvent): Promise<void> => {
        const accel = e?.metaKey || e?.ctrlKey
        const range = e?.shiftKey

        if (accel) {
          setMultiSelected(prev => seedMultiSelect(prev, selectedRelPath, relPath))
          setLastClickedPath(relPath)
          return
        }

        if (range && lastClickedPath) {
          const idxA = visibleRowsRef.current.findIndex(r => r.entry.relPath === lastClickedPath)
          const idxB = visibleRowsRef.current.findIndex(r => r.entry.relPath === relPath)
          if (idxA >= 0 && idxB >= 0) {
            const [lo, hi] = idxA < idxB ? [idxA, idxB] : [idxB, idxA]
            const rangePaths = visibleRowsRef.current.slice(lo, hi + 1).map(r => r.entry.relPath)
            setMultiSelected(new Set(rangePaths))
          }
          return
        }

        setMultiSelected(new Set())
        setLastClickedPath(relPath)

        // Toggle de carpeta antes de await: la UI no debe esperar a la selección.
        if (isDirectory) {
          toggleDir(relPath)
        }

        // Modo doble-click: seleccionar archivo sin abrirlo; abrir solo con doble click
        const open = isDirectory ? false : openOnSingleClick
        await onSelectEntry(relPath, isDirectory, e, { open })
      },
      [lastClickedPath, onSelectEntry, openOnSingleClick, toggleDir, selectedRelPath],
    )

    const handleDoubleClickEntry = useCallback(
      (relPath: string, isDirectory: boolean): void => {
        // Carpetas: el click simple ya hace toggle; el dblclick no debe togglear de nuevo.
        if (isDirectory) return
        if (!openOnSingleClick) {
          void onSelectEntry(relPath, false, undefined, { open: true })
        }
      },
      [onSelectEntry, openOnSingleClick],
    )

    const submitCreate = useCallback(async () => {
      if (!createMode) return
      const relPath = buildNewRelPath(createName, createParentPath)
      if (!relPath) {
        setCreateError(t('fileExplorer.create.invalidName'))
        return
      }
      setCreating(true)
      setCreateError(null)
      const result =
        createMode === 'file'
          ? await window.api.fileExplorerCreateFile(sessionId, relPath)
          : await window.api.fileExplorerCreateDir(sessionId, relPath)
      setCreating(false)
      if (!result.ok) {
        setCreateError(fileExplorerErrorMessage(t, result.error, result.code))
        return
      }
      const parent = createParentPath
      expandParents(relPath)
      await loadDir(parent)
      await loadDir('')
      setCreateMode(null)
      setCreateName('')
      setCreateParentOverride(null)
      if (createMode === 'file') {
        onFileCreated?.(relPath)
        await onSelectEntry(relPath, false)
      } else {
        await onSelectEntry(relPath, true)
      }
      await refreshGitStatus()
    }, [
      createMode, createName, createParentPath, sessionId, expandParents, loadDir,
      onFileCreated, onSelectEntry, refreshGitStatus, t,
    ])

    const cancelCreate = useCallback(() => {
      setCreateMode(null)
      setCreateName('')
      setCreateError(null)
      setCreateParentOverride(null)
    }, [])

    const refreshAfterMutation = useCallback(
      async (parentRel: string) => {
        await loadDir(parentRel)
        await loadDir('')
      },
      [loadDir],
    )

    const openContextMenu = useCallback(
      (e: React.MouseEvent, target: FileExplorerContextMenuTarget | null) => {
        e.preventDefault()
        e.stopPropagation()
        if (target && multiSelected.size > 0 && !multiSelected.has(target.relPath)) {
          setMultiSelected(new Set())
          setLastClickedPath(target.relPath)
          void onSelectEntry(target.relPath, target.isDirectory, undefined, {
            open: false,
          })
        }
        setContextMenu({ x: e.clientX, y: e.clientY, target })
      },
      [multiSelected, onSelectEntry],
    )

    const onTreeContextMenu = useCallback(
      (e: React.MouseEvent) => {
        const node = (e.target as HTMLElement).closest(
          '.file-explorer-tree-node[data-rel-path]',
        ) as HTMLElement | null
        if (node?.dataset.relPath) {
          openContextMenu(e, {
            relPath: node.dataset.relPath,
            isDirectory: node.dataset.isDirectory === 'true',
            name: node.dataset.name ?? '',
          })
          return
        }
        openContextMenu(e, null)
      },
      [openContextMenu],
    )

    const copyTextToClipboard = useCallback((text: string): void => {
      void navigator.clipboard.writeText(text).catch(() => {})
    }, [])

    const handleCopy = useCallback(() => {
      const paths = getSelectedRelPaths()
      closeContextMenu()
      if (paths.length === 0) return
      void window.api.fileExplorerCopy(sessionId, paths).then(result => {
        if (!result.ok) {
          showErrorToast(result.error, result.code)
          return
        }
        setCutRelPaths(new Set())
        showToast(t('fileExplorer.toast.copied', { count: result.count ?? paths.length }))
      })
    }, [getSelectedRelPaths, closeContextMenu, sessionId, showErrorToast, showToast, t])

    const handleCut = useCallback(() => {
      const paths = getSelectedRelPaths()
      closeContextMenu()
      if (paths.length === 0) return
      void window.api.fileExplorerCut(sessionId, paths).then(result => {
        if (!result.ok) {
          showErrorToast(result.error, result.code)
          return
        }
        setCutRelPaths(new Set(paths))
        showToast(t('fileExplorer.toast.cut', { count: result.count ?? paths.length }))
      })
    }, [getSelectedRelPaths, closeContextMenu, sessionId, showErrorToast, showToast, t])

    const handleCopyName = useCallback(() => {
      const target = contextMenu?.target
      closeContextMenu()
      if (!target) return
      void copyTextToClipboard(target.name)
    }, [contextMenu, closeContextMenu, copyTextToClipboard])

    const handleCopyRelPath = useCallback(() => {
      const target = contextMenu?.target
      closeContextMenu()
      if (!target) return
      void copyTextToClipboard(target.relPath)
    }, [contextMenu, closeContextMenu, copyTextToClipboard])

    const handlePaste = useCallback(() => {
      const menuTarget = contextMenu?.target
      closeContextMenu()
      const destEntry: ExplorerSelectedEntry | null = menuTarget ?? selectedEntry
      const dest = pasteDestRelPath(destEntry)
      void window.api.fileExplorerPaste(sessionId, dest).then(result => {
        if (!result.ok) {
          if (result.count && result.count > 0) {
            showErrorToast(
              result.error
                ? `${result.error} (${t('fileExplorer.toast.pastePartial', { count: result.count })})`
                : undefined,
              result.code,
            )
            setCutRelPaths(new Set())
            void reloadTree()
            return
          }
          showErrorToast(result.error, result.code)
          return
        }
        setCutRelPaths(new Set())
        showToast(t('fileExplorer.toast.pasted', { count: result.count ?? 1 }))
        void reloadTree()
      })
    }, [
      contextMenu, closeContextMenu, selectedEntry, sessionId, reloadTree,
      showErrorToast, showToast, t,
    ])

    const startRename = useCallback(() => {
      const target = contextMenu?.target
      closeContextMenu()
      if (!target || multiSelected.size > 1) return
      setRenamingEntry(target)
      setRenameName(target.name)
      setRenameError(null)
    }, [contextMenu, closeContextMenu, multiSelected.size])

    const cancelRename = useCallback(() => {
      setRenamingEntry(null)
      setRenameName('')
      setRenameError(null)
    }, [])

    const submitRename = useCallback(async () => {
      if (!renamingEntry) return
      const parent = parentRelPath(renamingEntry.relPath)
      const newRel = buildNewRelPath(renameName, parent)
      if (!newRel) {
        setRenameError(t('fileExplorer.rename.invalidName'))
        return
      }
      if (newRel === renamingEntry.relPath) {
        cancelRename()
        return
      }
      const result = await window.api.fileExplorerRename(
        sessionId,
        renamingEntry.relPath,
        newRel,
      )
      if (!result.ok) {
        setRenameError(fileExplorerErrorMessage(t, result.error, result.code))
        return
      }
      const oldRel = renamingEntry.relPath
      const isDirectory = renamingEntry.isDirectory
      cancelRename()
      await refreshAfterMutation(parent)
      onEntryRenamed?.(oldRel, newRel, isDirectory)
      await refreshGitStatus()
    }, [
      renamingEntry, renameName, sessionId, cancelRename, refreshAfterMutation,
      onEntryRenamed, refreshGitStatus, t,
    ])

    const performDelete = useCallback(async (paths: string[]): Promise<void> => {
      if (paths.length === 0) return
      if (canMutateOpenPaths) {
        const ok = await canMutateOpenPaths(paths)
        if (!ok) return
      }
      for (const relPath of paths) {
        const result = await window.api.fileExplorerDelete(sessionId, relPath)
        if (!result.ok) {
          showErrorToast(result.error, result.code)
          return
        }
        const parent = parentRelPath(relPath)
        await refreshAfterMutation(parent)
        onEntryDeleted?.(relPath)
      }
      setMultiSelected(new Set())
      await refreshGitStatus()
    }, [
      sessionId, refreshAfterMutation, onEntryDeleted, refreshGitStatus,
      showErrorToast, canMutateOpenPaths,
    ])

    const confirmAndDelete = useCallback((paths: string[], focusRow?: {
      name: string
      isDirectory: boolean
    }) => {
      if (paths.length === 0) return
      const runDelete = (): void => { void performDelete(paths) }
      if (onRequestConfirm) {
        const firstName = focusRow?.name
          ?? paths[0]?.split('/').pop()
          ?? paths[0]
          ?? ''
        const message = paths.length > 1
          ? t('fileExplorer.confirm.deleteMany', { count: paths.length })
          : (focusRow?.isDirectory ?? false)
            ? t('fileExplorer.confirm.deleteDir', { name: firstName })
            : t('fileExplorer.confirm.deleteFile', { name: firstName })
        void onRequestConfirm({ type: 'delete', message, onConfirm: runDelete })
        return
      }
      runDelete()
    }, [performDelete, onRequestConfirm, t])

    const handleDelete = useCallback(() => {
      const paths = getSelectedRelPaths()
      const target = contextMenu?.target
      closeContextMenu()
      confirmAndDelete(
        paths,
        target
          ? { name: target.name, isDirectory: target.isDirectory }
          : undefined,
      )
    }, [getSelectedRelPaths, contextMenu, closeContextMenu, confirmAndDelete])

    const handleRevealInFinder = useCallback(() => {
      const target = contextMenu?.target
      closeContextMenu()
      if (!target) return
      void window.api.fileExplorerReveal(sessionId, target.relPath)
    }, [contextMenu, closeContextMenu, sessionId])

    const handleDropOnDir = useCallback(
      async (destRelPath: string, e: React.DragEvent): Promise<void> => {
        setDragOverRelPath(null)
        const raw = dragRelPathRef.current ?? e.dataTransfer.getData('text/plain')
        if (!raw) return
        const sources = raw.includes('\n')
          ? raw.split('\n').map(s => s.trim()).filter(Boolean)
          : [raw]
        const movePaths = sources.filter(src => {
          if (!src || src === destRelPath) return false
          if (isRelPathInside(src, destRelPath)) return false
          return true
        })
        if (movePaths.length === 0) {
          if (sources.some(src => isRelPathInside(src, destRelPath))) {
            showErrorToast(undefined, FILE_EXPLORER_ERROR_CODES.DROP_INTO_SELF)
          }
          return
        }
        if (canMutateOpenPaths) {
          const ok = await canMutateOpenPaths(movePaths)
          if (!ok) return
        }
        for (const src of movePaths) {
          const newRel = destRelPath
            ? `${destRelPath}/${src.split('/').pop()}`
            : src.split('/').pop()!
          const result = await window.api.fileExplorerMove(sessionId, src, newRel)
          if (!result.ok) {
            showErrorToast(result.error, result.code)
            return
          }
          let movedIsDir = false
          for (const entries of childrenByDir.values()) {
            const found = entries.find(entry => entry.relPath === src)
            if (found) {
              movedIsDir = found.isDirectory
              break
            }
          }
          onEntryRenamed?.(src, newRel, movedIsDir)
          await refreshAfterMutation(destRelPath)
          await refreshAfterMutation(parentRelPath(src))
        }
        setMultiSelected(new Set())
        await refreshGitStatus()
      },
      [
        sessionId, childrenByDir, refreshAfterMutation, refreshGitStatus,
        showErrorToast, onEntryRenamed, canMutateOpenPaths,
      ],
    )

    const loadedFilterMatches = useMemo(() => {
      const q = filterQuery.trim().toLowerCase()
      if (!q) return [] as string[]
      const matches: string[] = []
      for (const entries of childrenByDir.values()) {
        for (const entry of entries) {
          if (entry.name.toLowerCase().includes(q) || entry.relPath.toLowerCase().includes(q)) {
            matches.push(entry.relPath)
          }
        }
      }
      return matches
    }, [filterQuery, childrenByDir])

    useEffect(() => {
      const q = filterQuery.trim()
      if (!q) return
      // Solo expandir padres de matches ya cargados, con debounce largo para no expandir en cada tecla.
      const id = window.setTimeout(() => {
        const limited = loadedFilterMatches.slice(0, 40)
        for (const rel of limited) {
          expandParents(rel)
        }
      }, 400)
      return () => window.clearTimeout(id)
    }, [filterQuery, loadedFilterMatches, expandParents])

    useEffect(() => {
      const q = filterQuery.trim()
      if (!q) {
        setGlobalSearchHits([])
        setGlobalSearchTruncated(false)
        setGlobalSearchLoading(false)
        return
      }
      let cancelled = false
      setGlobalSearchLoading(true)
      const id = window.setTimeout(() => {
        void window.api.fileExplorerSearch(sessionId, q).then(result => {
          if (cancelled) return
          if (result.ok) {
            const hits = result.hits?.length
              ? result.hits
              : result.paths.map(relPath => ({ relPath, isDirectory: false }))
            setGlobalSearchHits(hits)
            setGlobalSearchTruncated(Boolean(result.truncated))
          } else {
            setGlobalSearchHits([])
            setGlobalSearchTruncated(false)
          }
          setGlobalSearchLoading(false)
        }).catch(() => {
          if (cancelled) return
          setGlobalSearchHits([])
          setGlobalSearchTruncated(false)
          setGlobalSearchLoading(false)
        })
      }, 200)
      return () => {
        cancelled = true
        window.clearTimeout(id)
      }
    }, [filterQuery, sessionId])

    const visibleRows = useMemo(() => {
      const rows: Array<{
        entry: FileExplorerEntry
        depth: number
        expanded: boolean
        loading: boolean
      }> = []

      const walk = (dirPath: string, depth: number): void => {
        const kids = childrenByDir.get(dirPath) ?? []
        for (const entry of kids) {
          const isExp = entry.isDirectory && expandedSet.has(entry.relPath)
          rows.push({
            entry,
            depth,
            expanded: isExp,
            loading: loadingDirs.has(entry.relPath),
          })
          if (isExp) walk(entry.relPath, depth + 1)
        }
      }

      walk('', 0)

      const q = filterQuery.trim().toLowerCase()
      if (!q) return rows
      const filtered = filterRowsKeepingAncestors(rows, q)
      const seen = new Set(filtered.map(r => r.entry.relPath))
      for (const hit of globalSearchHits) {
        if (seen.has(hit.relPath)) continue
        const name = hit.relPath.split('/').pop() ?? hit.relPath
        filtered.push({
          entry: { name, relPath: hit.relPath, isDirectory: hit.isDirectory },
          depth: 0,
          expanded: false,
          loading: false,
        })
        seen.add(hit.relPath)
      }
      return filtered
    }, [childrenByDir, expandedSet, loadingDirs, filterQuery, globalSearchHits])

    const showSearchHint = useMemo(() => {
      const q = filterQuery.trim().toLowerCase()
      if (!q) return false
      if (globalSearchLoading) return true
      if (loadedFilterMatches.length === 0 && globalSearchHits.length === 0) return true
      if (loadedFilterMatches.length === 0) return false
      for (const rel of loadedFilterMatches) {
        const parts = rel.split('/').filter(Boolean)
        let acc = ''
        for (let i = 0; i < parts.length - 1; i++) {
          acc = acc ? `${acc}/${parts[i]!}` : parts[i]!
          if (!childrenByDir.has(acc)) return true
        }
      }
      return false
    }, [filterQuery, loadedFilterMatches, childrenByDir, globalSearchLoading, globalSearchHits.length])

    const visibleRowsRef = useRef(visibleRows)
    visibleRowsRef.current = visibleRows

    const useVirtual = visibleRows.length > VIRTUAL_THRESHOLD
    const virtualizer = useVirtualizer({
      count: visibleRows.length,
      getScrollElement: () => treeScrollRef.current,
      estimateSize: () => ROW_HEIGHT,
      overscan: 12,
      enabled: useVirtual,
    })
    const virtualizerRef = useRef(virtualizer)
    virtualizerRef.current = virtualizer

    // Solo al mover el foco con teclado/clic en fila — no cuando `visibleRows` cambia
    // (p. ej. loadDir async), para no saltar al inicio mientras el usuario scrollea.
    useEffect(() => {
      const rows = visibleRowsRef.current
      if (rows.length === 0) return
      const idx = Math.min(focusedRowIndex, rows.length - 1)
      if (rows.length > VIRTUAL_THRESHOLD) {
        virtualizerRef.current.scrollToIndex(idx, { align: 'auto' })
      } else {
        const row = rows[idx]
        if (!row || !treeScrollRef.current) return
        const el = treeScrollRef.current.querySelector(
          `.file-explorer-tree-node[data-rel-path="${row.entry.relPath.replace(/"/g, '\\"')}"]`,
        )
        el?.scrollIntoView({ block: 'nearest' })
      }
    }, [focusedRowIndex])

    const handleTreeKeyDown = useCallback(
      (e: React.KeyboardEvent): void => {
        if ((e.metaKey || e.ctrlKey) && (e.key === 'f' || e.key === 'F')) {
          e.preventDefault()
          setSearchOpen(true)
          requestAnimationFrame(() => searchInputRef.current?.focus())
          return
        }
        if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
          e.preventDefault()
          setSearchOpen(true)
          requestAnimationFrame(() => searchInputRef.current?.focus())
          return
        }
        if (e.key === 'Escape') {
          if (cutRelPaths.size > 0) {
            e.preventDefault()
            setCutRelPaths(new Set())
            return
          }
        }
        if ((e.metaKey || e.ctrlKey) && !e.altKey) {
          const k = e.key.toLowerCase()
          if (k === 'c') {
            e.preventDefault()
            handleCopy()
            return
          }
          if (k === 'x') {
            e.preventDefault()
            handleCut()
            return
          }
          if (k === 'v') {
            e.preventDefault()
            handlePaste()
            return
          }
        }

        const rows = visibleRowsRef.current
        if (rows.length === 0) return

        const selectFocusedRow = (index: number): void => {
          const row = rows[index]
          if (!row) return
          setMultiSelected(new Set())
          setLastClickedPath(row.entry.relPath)
          void onSelectEntry(row.entry.relPath, row.entry.isDirectory, undefined, { open: false })
        }

        if (e.key === 'ArrowDown') {
          e.preventDefault()
          const next = Math.min(rows.length - 1, focusedRowIndex + 1)
          setFocusedRowIndex(next)
          selectFocusedRow(next)
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          const next = Math.max(0, focusedRowIndex - 1)
          setFocusedRowIndex(next)
          selectFocusedRow(next)
        } else if (e.key === 'Home') {
          e.preventDefault()
          setFocusedRowIndex(0)
          selectFocusedRow(0)
        } else if (e.key === 'End') {
          e.preventDefault()
          const next = rows.length - 1
          setFocusedRowIndex(next)
          selectFocusedRow(next)
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          const row = rows[focusedRowIndex]
          if (row?.entry.isDirectory && !expandedSet.has(row.entry.relPath)) {
            toggleDir(row.entry.relPath)
          }
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault()
          const row = rows[focusedRowIndex]
          if (!row) return
          if (row.entry.isDirectory && expandedSet.has(row.entry.relPath)) {
            toggleDir(row.entry.relPath)
            return
          }
          const parent = parentRelPath(row.entry.relPath)
          if (!parent && !row.entry.relPath.includes('/')) return
          const parentIdx = rows.findIndex(r => r.entry.relPath === parent)
          if (parentIdx >= 0) {
            setFocusedRowIndex(parentIdx)
            selectFocusedRow(parentIdx)
          }
        } else if (e.key === ' ' && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault()
          const row = rows[focusedRowIndex]
          if (row?.entry.isDirectory) toggleDir(row.entry.relPath)
        } else if (e.key === 'Enter') {
          e.preventDefault()
          const row = rows[focusedRowIndex]
          if (row) {
            if (!openOnSingleClick && !row.entry.isDirectory) {
              handleDoubleClickEntry(row.entry.relPath, row.entry.isDirectory)
            } else {
              void handleSelectEntry(row.entry.relPath, row.entry.isDirectory)
            }
          }
        } else if (e.key === 'F2') {
          e.preventDefault()
          const row = rows[focusedRowIndex]
          if (row) {
            setRenamingEntry({
              relPath: row.entry.relPath,
              isDirectory: row.entry.isDirectory,
              name: row.entry.name,
            })
            setRenameName(row.entry.name)
          }
        } else if (e.key === 'Delete' || (e.key === 'Backspace' && (e.metaKey || e.ctrlKey))) {
          e.preventDefault()
          const row = rows[focusedRowIndex]
          const paths = resolveExplorerActionPaths(
            multiSelected,
            null,
            row?.entry.relPath ?? selectedRelPath,
          )
          confirmAndDelete(
            paths,
            row
              ? { name: row.entry.name, isDirectory: row.entry.isDirectory }
              : undefined,
          )
        }
      },
      [
        focusedRowIndex, expandedSet, toggleDir, handleSelectEntry, handleDoubleClickEntry,
        openOnSingleClick, onSelectEntry, multiSelected, confirmAndDelete, selectedRelPath,
        handleCopy, handleCut, handlePaste, cutRelPaths.size,
      ],
    )

    const handleDragStartEntry = useCallback((relPath: string, e: React.DragEvent) => {
      const paths =
        multiSelected.size > 0 && multiSelected.has(relPath)
          ? Array.from(multiSelected)
          : [relPath]
      dragRelPathRef.current = paths.join('\n')
      e.dataTransfer.setData('text/plain', paths.join('\n'))
      e.dataTransfer.effectAllowed = 'move'
    }, [multiSelected])

    const renderRow = (row: typeof visibleRows[number], index: number): React.ReactNode => (
      <FileExplorerTreeNode
        key={row.entry.relPath}
        entry={row.entry}
        depth={row.depth}
        expanded={row.expanded}
        loading={row.loading}
        selected={
          selectedRelPath === row.entry.relPath &&
          Boolean(selectedIsDirectory) === row.entry.isDirectory
        }
        multiSelected={multiSelected.has(row.entry.relPath)}
        cutMarked={cutRelPaths.has(row.entry.relPath)}
        dragOver={dragOverRelPath === row.entry.relPath}
        gitStatus={gitStatusFromMap(gitStatusByPath, row.entry.relPath)}
        isRenaming={renamingEntry?.relPath === row.entry.relPath}
        renameValue={renameName}
        onRenameChange={setRenameName}
        onRenameSubmit={() => void submitRename()}
        onRenameCancel={cancelRename}
        onToggleDir={toggleDir}
        onSelectEntry={handleSelectEntry}
        onDoubleClickEntry={handleDoubleClickEntry}
        onDragStartEntry={handleDragStartEntry}
        onDragOverDir={rel => setDragOverRelPath(rel)}
        onDragLeaveDir={rel => {
          setDragOverRelPath(prev => (prev === rel ? null : prev))
        }}
        onDropOnDir={(dest, ev) => { void handleDropOnDir(dest, ev) }}
        nodeId={`explorer-row-${index}`}
        tabIndex={index === focusedRowIndex ? 0 : -1}
        onFocusNode={() => setFocusedRowIndex(index)}
      />
    )

    return (
      <div className="file-explorer-tree-wrap">
        <div className="file-explorer-tree__toolbar">
          <span
            className="file-explorer-tree__root-label"
          >
            {t('fileExplorer.toolbar.rootLabel', { path: sessionCwdPaneLabel(treeRootCwd, 2) })}
            {!showHiddenDirs && (
              <span className="file-explorer-tree__hidden-dot" aria-hidden />
            )}
          </span>
          <ExplorerToolButton
            aria-label={t('fileExplorer.toolbar.newMenu')}
            onClick={e => setNewMenu({ x: e.clientX, y: e.clientY })}
          >
            <Icon name="plus" size={11} aria-hidden />
          </ExplorerToolButton>
          <Tooltip content={t('fileExplorer.toolbar.foldAll')}>
            <ExplorerToolButton
              aria-label={t('fileExplorer.toolbar.foldAll')}
              disabled={expandedRelPaths.length === 0}
              onClick={() => commitExpandedPaths([])}
            >
              <Icon name="fold-all" size={11} aria-hidden />
            </ExplorerToolButton>
          </Tooltip>
          <Tooltip
            content={showHiddenDirs
              ? t('fileExplorer.toolbar.hideHidden')
              : t('fileExplorer.toolbar.showHidden')}
            hint={t('fileExplorer.toolbar.heavyDirsHint')}
          >
            <ExplorerToolButton
              aria-label={showHiddenDirs
                ? t('fileExplorer.toolbar.hideHidden')
                : t('fileExplorer.toolbar.showHidden')}
              aria-pressed={showHiddenDirs}
              onClick={() => onShowHiddenDirsChange(!showHiddenDirs)}
            >
              <Icon name={showHiddenDirs ? 'eye' : 'eye-off'} size={11} aria-hidden />
            </ExplorerToolButton>
          </Tooltip>
          {onCloseExplorer && (
            <ExplorerToolButton
              variant="close"
              aria-label={t('fileExplorer.toolbar.close')}
              onClick={onCloseExplorer}
            >
              <Icon name="close" size={9} aria-hidden />
            </ExplorerToolButton>
          )}
        </div>

        {(searchOpen || filterQuery) && (
          <div className="file-explorer-tree__search">
            <Icon name="search" size={10} aria-hidden />
            <input
              ref={searchInputRef}
              type="text"
              className="file-explorer-tree__search-input"
              value={filterQuery}
              placeholder={t('fileExplorer.search.placeholder')}
              aria-label={`${t('fileExplorer.search.shortcutTitle')} (${shortcutLabel('F')})`}
              onChange={e => setFilterQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  setSearchOpen(false)
                  setFilterQuery('')
                  treeScrollRef.current?.focus()
                }
              }}
              spellCheck={false}
            />
            {showSearchHint && (
              <span className="file-explorer-tree__search-hint">
                {globalSearchLoading
                  ? t('fileExplorer.search.hint')
                  : t('fileExplorer.search.hintExpand')}
              </span>
            )}
            {globalSearchTruncated && !globalSearchLoading && (
              <span className="file-explorer-tree__search-hint">
                {t('fileExplorer.search.truncated')}
              </span>
            )}
          </div>
        )}

        {createMode && (
          <form
            className="file-explorer-tree__create"
            onSubmit={e => {
              e.preventDefault()
              void submitCreate()
            }}
          >
            <span className="file-explorer-tree__create-label">
              {createMode === 'file' ? t('fileExplorer.create.fileLabel') : t('fileExplorer.create.dirLabel')}
              {createParentPath
                ? t('fileExplorer.create.inDir', { dir: createParentPath })
                : ` ${t('fileExplorer.create.inRoot')}`}
            </span>
            <input
              type="text"
              className="file-explorer-tree__create-input"
              value={createName}
              placeholder={createMode === 'file'
                ? t('fileExplorer.create.filePlaceholder')
                : t('fileExplorer.create.dirPlaceholder')}
              autoFocus
              disabled={creating}
              onChange={e => setCreateName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  cancelCreate()
                }
              }}
            />
            <div className="file-explorer-tree__create-actions">
              <FileExplorerCreateAction
                submit
                appearance="submit"
                label={t('fileExplorer.create.submit')}
                disabled={creating}
              />
              <FileExplorerCreateAction
                appearance="cancel"
                label={t('fileExplorer.create.cancel')}
                disabled={creating}
                onClick={cancelCreate}
              />
            </div>
            {createError && (
              <p className="file-explorer-tree__create-error" role="alert">{createError}</p>
            )}
          </form>
        )}

        <div
          ref={treeScrollRef}
          className="file-explorer-tree"
          role="tree"
          tabIndex={0}
          aria-activedescendant={
            visibleRows[focusedRowIndex]
              ? `explorer-row-${focusedRowIndex}`
              : undefined
          }
          onKeyDown={handleTreeKeyDown}
          onContextMenu={onTreeContextMenu}
          onDragOver={e => {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
            setDragOverRelPath('')
          }}
          onDragLeave={e => {
            if (e.currentTarget === e.target) setDragOverRelPath(null)
          }}
          onDrop={e => {
            e.preventDefault()
            void handleDropOnDir('', e)
          }}
        >
          {rootError && !loadingDirs.has('') && (
            <p className="file-explorer-tree__empty file-explorer-tree__empty--error" role="alert">
              {rootError}
            </p>
          )}
          {!rootError && visibleRows.length === 0 && !loadingDirs.has('') && !createMode && (
            <p className="file-explorer-tree__empty">
              {filterQuery.trim()
                ? t('fileExplorer.search.noMatches')
                : t('fileExplorer.empty.folderEmpty')}
            </p>
          )}
          {useVirtual ? (
            <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
              {virtualizer.getVirtualItems().map(vRow => {
                const row = visibleRows[vRow.index]
                if (!row) return null
                return (
                  <div
                    key={row.entry.relPath}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: vRow.size,
                      transform: `translateY(${vRow.start}px)`,
                    }}
                  >
                    {renderRow(row, vRow.index)}
                  </div>
                )
              })}
            </div>
          ) : (
            visibleRows.map((row, index) => renderRow(row, index))
          )}
          {renameError && (
            <p className="file-explorer-tree__create-error" role="alert">{renameError}</p>
          )}
        </div>

        {contextMenu && (
          <FileExplorerContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            target={contextMenu.target}
            selectionCount={getSelectedRelPaths().length}
            showHiddenDirs={showHiddenDirs}
            openOnSingleClick={openOnSingleClick}
            onCopy={handleCopy}
            onCut={handleCut}
            onCopyName={handleCopyName}
            onCopyRelPath={handleCopyRelPath}
            onPaste={handlePaste}
            onRename={startRename}
            onDelete={handleDelete}
            onRevealInFinder={handleRevealInFinder}
            onNewFile={() => {
              const target = contextMenu.target
              const parent = !target
                ? ''
                : target.isDirectory
                  ? target.relPath
                  : parentRelPath(target.relPath)
              startCreate('file', parent)
            }}
            onNewDir={() => {
              const target = contextMenu.target
              const parent = !target
                ? ''
                : target.isDirectory
                  ? target.relPath
                  : parentRelPath(target.relPath)
              startCreate('dir', parent)
            }}
            onRefresh={() => {
              closeContextMenu()
              void reloadTree()
            }}
            onToggleHiddenDirs={() => {
              closeContextMenu()
              onShowHiddenDirsChange(!showHiddenDirs)
            }}
            onToggleOpenOnSingleClick={() => {
              closeContextMenu()
              onOpenOnSingleClickChange?.(!openOnSingleClick)
            }}
            onClose={closeContextMenu}
          />
        )}

        {newMenu && (
          <FileExplorerNewMenu
            x={newMenu.x}
            y={newMenu.y}
            onNewFile={() => startCreate('file')}
            onNewDir={() => startCreate('dir')}
            onClose={() => setNewMenu(null)}
          />
        )}

        {toastMessage && (
          <ExplorerToast message={toastMessage} onClose={dismissToast} />
        )}
      </div>
    )
  },
)
