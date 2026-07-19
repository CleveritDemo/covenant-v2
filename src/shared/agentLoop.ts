/** Marcador que el modelo emite para pedir el fin del loop autónomo. */
export const LOOP_DONE_MARKER = '[[LOOP_DONE]]'

/** Tope de seguridad para no dejar un loop infinito. */
export const MAX_AGENT_LOOP_ITERATIONS = 40

/** Pausa breve entre iteraciones para que la UI y el CLI se estabilicen. */
export const AGENT_LOOP_CONTINUE_DELAY_MS = 700

export function buildLoopPrompt(objective: string, iteration: number): string {
  const goal = objective.trim()
  if (iteration <= 1) {
    return [
      'You are working autonomously in a loop toward this objective:',
      '',
      goal,
      '',
      'Rules:',
      '- Make concrete progress each turn toward the objective.',
      '- Prefer action over planning when the next step is clear.',
      '- Do not wait for the user unless you are blocked.',
      `- When the objective is fully complete, OR you are blocked and need the user, end your reply with exactly ${LOOP_DONE_MARKER} on its own line.`,
      '- Otherwise continue working; another turn will follow automatically.',
    ].join('\n')
  }
  return [
    `Continue the autonomous loop (iteration ${iteration}).`,
    'Objective (unchanged):',
    goal,
    '',
    'Review what you already did in this session, take the next useful step, and avoid repeating finished work.',
    `When fully done or blocked, end with ${LOOP_DONE_MARKER} on its own line.`,
  ].join('\n')
}

export function stripLoopDoneMarker(text: string): { text: string; done: boolean } {
  const done = text.includes(LOOP_DONE_MARKER)
  if (!done) return { text, done: false }
  return {
    done: true,
    text: text
      .split(LOOP_DONE_MARKER)
      .join('')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd(),
  }
}
