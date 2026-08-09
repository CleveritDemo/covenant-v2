import { describe, expect, it } from 'vitest'
import { gitWorktreeOptions } from '../gitWorktreeOptions'

describe('gitWorktreeOptions', () => {
  it('etiqueta con el nombre de carpeta y marca el principal', () => {
    const options = gitWorktreeOptions([
      { path: '/Sources/gravity', branch: 'main', head: 'aaaaaaaaaaaa' },
      { path: '/Sources/gravity/.covenant/worktrees/wt-1/', branch: 'agent/wt-1', head: 'bbbbbbbbbbbb' },
    ])
    expect(options).toEqual([
      { value: '/Sources/gravity', label: 'gravity', hint: 'main worktree · main' },
      {
        value: '/Sources/gravity/.covenant/worktrees/wt-1/',
        label: 'wt-1',
        hint: 'agent/wt-1',
      },
    ])
  })

  it('cae al head corto cuando el worktree está detached', () => {
    const [option] = gitWorktreeOptions([{ path: '/repo/detached', branch: '', head: 'abcdef1234567' }])
    expect(option.hint).toBe('main worktree · abcdef1')
  })
})
