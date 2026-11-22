import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Indicator } from '../types'

const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const CRAB = '🦀'
const TICK_MS = 150
const RUNNING_AGENT_STATUSES = new Set(['pending', 'running'])

const value = atom(
  { plugin: 'working-indicator', key: 'value' } as const,
  { frame: 0, startedAt: 0 },
)

export const register: Register = on => {
  on('session.start', ($, e, next) => {
    $.clock.every(TICK_MS, () => {
      update($, value, (v: Indicator) => ({ ...v, frame: v.frame + 1 }))
    })

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    const startedAt = await $.clock.now()
    await update($, value, (v: Indicator) => ({ ...v, startedAt }))

    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }

    const agents = await $.agent.list()
    const runningAgents = agents.filter(a => RUNNING_AGENT_STATUSES.has(a.status))

    if (!e.props.isWorking && runningAgents.length === 0) {
      return next(e)
    }

    const v = await read($, value)
    const now = await $.clock.now()
    // Un agente in background può lavorare mentre il turno principale è fermo:
    // in quel caso usiamo l'orario di avvio dell'agente più vecchio.
    const startedAt = e.props.isWorking
      ? v.startedAt
      : Math.min(...runningAgents.map(a => a.startTime))
    const seconds = startedAt ? Math.max(0, Math.round((now - startedAt) / 1000)) : 0
    const spin = SPINNER[v.frame % SPINNER.length]
    const label = `${spin} Claude sta elaborando… (${seconds}s)`

    // Il granchietto corre avanti e indietro nello spazio libero della riga.
    const trackWidth = Math.max(4, Math.min(30, e.props.bodyColumns - label.length - 4))
    const period = trackWidth * 2
    const step = v.frame % period
    const offset = step <= trackWidth ? step : period - step

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box>
        <Text color="green">
          {label}
          {'  '}
          {' '.repeat(offset)}
          {CRAB}
        </Text>
      </Box>
    )
  })
}
