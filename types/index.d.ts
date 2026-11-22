export type Indicator = { frame: number; startedAt: number }

declare module 'claude-code' {
  interface PluginState {
    'working-indicator': { value: Indicator }
  }
}
