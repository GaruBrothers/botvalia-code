export type RemoteSkillLoadResult = {
  cacheHit: boolean
  latencyMs: number
  skillPath: string
  content: string
  fileCount: number
  totalBytes: number
  fetchMethod: 'stub'
}

export async function loadRemoteSkill(
  slug: string,
  url: string,
): Promise<RemoteSkillLoadResult> {
  return {
    cacheHit: false,
    latencyMs: 0,
    skillPath: url || slug,
    content: '',
    fileCount: 0,
    totalBytes: 0,
    fetchMethod: 'stub',
  }
}
