/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { GitHubJob, GitHubJobStep } from '@shared/githubActionsTypes'
import { GitHubActionsJobList } from '../GitHubActionsJobList'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${Object.values(params).join(',')}` : key,
  }),
}))

afterEach(cleanup)

function step(n: number, name: string, from: string, to: string, conclusion = 'success'): GitHubJobStep {
  return {
    number: n,
    name,
    status: 'completed',
    conclusion,
    startedAt: `2026-08-07T${from}Z`,
    completedAt: `2026-08-07T${to}Z`,
  }
}

// Job macos real del run de v0.4.0: 11 steps, 4 de andamiaje.
const MACOS: GitHubJob = {
  id: 1,
  name: 'macos',
  status: 'completed',
  conclusion: 'success',
  startedAt: '2026-08-07T03:50:12Z',
  completedAt: '2026-08-07T03:53:16Z',
  url: 'https://github.com/x/y/actions/runs/1/job/1',
  steps: [
    step(1, 'Set up job', '03:50:12', '03:50:12'),
    step(2, 'Run actions/checkout@v4', '03:50:12', '03:50:15'),
    step(4, 'Run npm ci', '03:50:21', '03:50:40'),
    step(7, 'Build + sign + notarize + publish', '03:50:41', '03:53:06'),
    step(15, 'Post Run actions/setup-node@v4', '03:53:07', '03:53:12'),
    step(17, 'Complete job', '03:53:12', '03:53:13'),
  ],
}

const CASK: GitHubJob = {
  id: 2,
  name: 'cask',
  status: 'completed',
  conclusion: 'success',
  startedAt: '2026-08-07T03:53:19Z',
  completedAt: '2026-08-07T03:53:28Z',
  url: '',
  steps: [step(1, 'Update Homebrew tap', '03:53:20', '03:53:26')],
}

describe('GitHubActionsJobList', () => {
  it('lista los jobs con su duración sin abrir ninguno', () => {
    render(<GitHubActionsJobList jobs={[MACOS, CASK]} initialOpen={[]} onOpen={() => {}} />)

    expect(screen.getByText('macos')).toBeTruthy()
    expect(screen.getByText('3m4s')).toBeTruthy()
    expect(screen.getByText('9s')).toBeTruthy()
    expect(screen.queryByText('Run npm ci')).toBeNull()
  })

  it('al abrir un job pliega el andamiaje y deja los steps propios', () => {
    render(<GitHubActionsJobList jobs={[MACOS]} initialOpen={[]} onOpen={() => {}} />)
    fireEvent.click(screen.getByText('macos'))

    expect(screen.getByText('Run npm ci')).toBeTruthy()
    expect(screen.queryByText('Set up job')).toBeNull()
    // 3 plegados: Set up job, Post Run…, Complete job.
    expect(screen.getByText('githubActions.scaffoldSteps:3')).toBeTruthy()
  })

  it('desplegar el andamiaje muestra los steps escondidos', () => {
    render(<GitHubActionsJobList jobs={[MACOS]} initialOpen={[]} onOpen={() => {}} />)
    fireEvent.click(screen.getByText('macos'))
    fireEvent.click(screen.getByText('githubActions.scaffoldSteps:3'))

    expect(screen.getByText('Set up job')).toBeTruthy()
    expect(screen.getByText('Complete job')).toBeTruthy()
  })

  it('un job fallido llega abierto y por su step roto', () => {
    const broken: GitHubJob = {
      ...MACOS,
      name: 'manifest',
      conclusion: 'failure',
      steps: [
        step(1, 'Set up job', '03:50:12', '03:50:12'),
        step(2, 'Publish manifest', '03:50:12', '03:50:47', 'failure'),
      ],
    }
    const { container } = render(
      <GitHubActionsJobList jobs={[broken]} initialOpen={['manifest']} onOpen={() => {}} />,
    )

    const failed = container.querySelector('.gh-step--failed')
    expect(failed?.textContent).toContain('Publish manifest')
  })

  it('resalta el step más lento del job', () => {
    const { container } = render(
      <GitHubActionsJobList jobs={[MACOS]} initialOpen={['macos']} onOpen={() => {}} />,
    )
    const slow = container.querySelector('.gh-step--slow')
    expect(slow?.textContent).toContain('Build + sign + notarize + publish')
  })

  it('las barras reflejan el orden real: cask arranca cuando macos casi acabó', () => {
    const { container } = render(
      <GitHubActionsJobList jobs={[MACOS, CASK]} initialOpen={[]} onOpen={() => {}} />,
    )
    const bars = container.querySelectorAll<HTMLElement>('.gh-job__bar')
    expect(bars[0].style.left).toBe('0%')
    expect(parseFloat(bars[1].style.left)).toBeGreaterThan(90)
  })

  it('avisa del paralelismo sólo cuando hay algo que ganar', () => {
    const { rerender } = render(
      <GitHubActionsJobList jobs={[MACOS, CASK]} initialOpen={[]} onOpen={() => {}} />,
    )
    // macos y cask van casi en serie: no hay paralelismo que contar.
    expect(screen.queryByText(/githubActions\.wallClock/)).toBeNull()

    const paralelo: GitHubJob = { ...CASK, id: 3, name: 'linux', startedAt: MACOS.startedAt, completedAt: MACOS.completedAt }
    rerender(<GitHubActionsJobList jobs={[MACOS, paralelo]} initialOpen={[]} onOpen={() => {}} />)
    expect(screen.getByText(/githubActions\.wallClock/)).toBeTruthy()
  })

  it('el enlace a logs sólo sale si el job tiene url', () => {
    const onOpen = vi.fn()
    render(<GitHubActionsJobList jobs={[MACOS, CASK]} initialOpen={['macos', 'cask']} onOpen={onOpen} />)

    const links = screen.getAllByText('githubActions.viewLogs')
    expect(links).toHaveLength(1) // cask no tiene url

    fireEvent.click(links[0])
    expect(onOpen).toHaveBeenCalledWith(MACOS.url)
  })
})
