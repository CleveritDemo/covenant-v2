import { describe, expect, it } from 'vitest'
import { splitBrainstormMessage } from '../brainstormMessageParts'

const WIKI_FENCE = [
  '```ia-terminal-wiki',
  JSON.stringify({
    ops: [{
      op: 'upsert',
      slug: 'onboarding-ct133-ui-options',
      title: 'CT-133 UI options',
      type: 'decision',
      body: 'No dashboard in this app.',
    }],
    log: 'Nodo de decisión de frontend.',
  }),
  '```',
].join('\n')

describe('splitBrainstormMessage', () => {
  // El JSON de las ops salía crudo en la transcripción y en la cola de la
  // tarjeta del asiento; taparlo a secas dejaba el trabajo invisible.
  it('saca las ops del wiki y deja la prosa limpia', () => {
    const parts = splitBrainstormMessage(`Refinado el alcance.\n\n${WIKI_FENCE}`)
    expect(parts.prose).toBe('Refinado el alcance.')
    expect(parts.wikiOps).toHaveLength(1)
    expect(parts.wikiOps[0]).toMatchObject({
      op: 'upsert',
      slug: 'onboarding-ct133-ui-options',
      title: 'CT-133 UI options',
      type: 'decision',
    })
    expect(parts.wikiLog).toBe('Nodo de decisión de frontend.')
  })

  // El orden importa: `stripBrainstormProtocolFences` borra la cerca entera,
  // así que si se ejecutara antes no quedaría nada que extraer.
  it('las otras cercas de protocolo siguen desapareciendo sin dejar ops', () => {
    const parts = splitBrainstormMessage(
      'Listo.\n\n```ia-terminal-results\n{"summary":"x"}\n```',
    )
    expect(parts.prose).toBe('Listo.')
    expect(parts.wikiOps).toEqual([])
  })

  it('un mensaje normal no inventa tarjetas', () => {
    const parts = splitBrainstormMessage('Propongo cerrar por schema.')
    expect(parts.prose).toBe('Propongo cerrar por schema.')
    expect(parts.wikiOps).toEqual([])
    expect(parts.wikiLog).toBeNull()
  })
})
