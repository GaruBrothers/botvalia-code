const CANONICAL_PREFIX = '_canonical_'

export type DiscoveredRemoteSkill = {
  slug: string
  url: string
  title?: string
}

const discoveredRemoteSkills = new Map<string, DiscoveredRemoteSkill>()

export function stripCanonicalPrefix(commandName: string): string | null {
  return commandName.startsWith(CANONICAL_PREFIX)
    ? commandName.slice(CANONICAL_PREFIX.length)
    : null
}

export function getDiscoveredRemoteSkill(
  slug: string,
): DiscoveredRemoteSkill | null {
  return discoveredRemoteSkills.get(slug) ?? null
}

export function rememberDiscoveredRemoteSkill(
  skill: DiscoveredRemoteSkill,
): void {
  discoveredRemoteSkills.set(skill.slug, skill)
}

export function setDiscoveredRemoteSkills(
  skills: DiscoveredRemoteSkill[],
): void {
  discoveredRemoteSkills.clear()
  for (const skill of skills) {
    discoveredRemoteSkills.set(skill.slug, skill)
  }
}

export function getRemoteSkillState() {
  return {
    discoveredRemoteSkills,
  }
}
