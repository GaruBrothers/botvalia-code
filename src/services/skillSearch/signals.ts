export type DiscoverySignal = 'turn_zero' | 'subagent_spawn'

export function createSkillSearchSignal(): DiscoverySignal {
  return 'turn_zero'
}
