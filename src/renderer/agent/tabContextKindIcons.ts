import type { TabContextKind } from '@shared/tabContext'
import type { IconName } from '../components/ui/Icon'
import {
  defaultIconForKind,
  resolveContextIcon,
  type TabContextIconName,
} from '@shared/tabContextAppearance'
import type { TabContext } from '@shared/tabContext'

export const KIND_ICONS: Record<TabContextKind, IconName> = {
  folderTree: 'folder',
  files: 'files',
  symbols: 'code',
  notes: 'note',
  git: 'git-branch',
  deps: 'package',
  readme: 'book',
  changelog: 'history',
  agentResult: 'bot',
}

export function contextIconName(
  context: Pick<TabContext, 'kind' | 'icon'>,
): IconName {
  return resolveContextIcon(context) as IconName
}

export function kindIconName(kind: TabContextKind): IconName {
  return defaultIconForKind(kind) as IconName
}

export function appearanceIconName(icon: TabContextIconName): IconName {
  return icon as IconName
}
