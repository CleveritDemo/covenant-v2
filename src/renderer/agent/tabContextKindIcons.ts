import type { TabContextKind } from '@shared/tabContext'
import type { IconName } from '../components/ui/Icon'

export const KIND_ICONS: Record<TabContextKind, IconName> = {
  folderTree: 'folder',
  files: 'files',
  symbols: 'code',
  notes: 'note',
  git: 'git-branch',
  deps: 'package',
  readme: 'book',
  changelog: 'history',
}
