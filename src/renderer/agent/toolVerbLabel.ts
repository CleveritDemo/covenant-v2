type Translate = (key: string, vars?: Record<string, string | number>) => string

/** Verbo de producto para una tool del CLI; null si el nombre no se reconoce. */
export function toolVerbLabel(name: string, detail: string | undefined, t: Translate): string | null {
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, '')

  let verbKey: string | null = null
  if (key.includes('todo')) verbKey = 'plan'
  else if (key.includes('websearch') || key.includes('webfetch') || key.includes('fetch') || key.includes('browser')) {
    verbKey = 'web'
  } else if (key.includes('task') || key.includes('subagent') || key.includes('agent')) {
    verbKey = 'delegate'
  } else if (key.includes('read') || key.includes('view') || key.includes('cat')) {
    verbKey = 'read'
  } else if (
    key.includes('edit')
    || key.includes('write')
    || key.includes('patch')
    || key.includes('filechange')
    || key.includes('create')
    || key.includes('apply')
  ) {
    verbKey = 'edit'
  } else if (
    key.includes('bash')
    || key.includes('shell')
    || key.includes('command')
    || key.includes('exec')
    || key.includes('terminal')
    || key.includes('run')
  ) {
    verbKey = 'run'
  } else if (
    key.includes('grep')
    || key.includes('glob')
    || key.includes('search')
    || key.includes('find')
    || key.includes('listdir')
    || key.includes('codebase')
    || key === 'ls'
  ) {
    verbKey = 'search'
  } else if (key.includes('mcp')) {
    verbKey = 'tool'
  } else {
    return null
  }

  const verb = t(`toolVerb.${verbKey}`)
  const alwaysBare = verbKey === 'delegate' || verbKey === 'plan' || verbKey === 'tool'
  const hasDetail = detail !== undefined && detail.trim() !== ''

  if (alwaysBare || !hasDetail) {
    return t('toolVerb.bare', { verb })
  }
  return t('toolVerb.withTarget', { verb, target: detail })
}
