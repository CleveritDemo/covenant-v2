import './AgentActivityDot.css'

export type AgentActivityDotTone = 'accent' | 'beam'

export interface AgentActivityDotProps {
  tone?: AgentActivityDotTone
}

export function AgentActivityDot({ tone }: AgentActivityDotProps) {
  return (
    <span
      className={[
        'agent-activity-dot',
        tone === 'beam' ? 'agent-activity-dot--beam' : '',
      ].filter(Boolean).join(' ')}
      aria-hidden="true"
    />
  )
}
