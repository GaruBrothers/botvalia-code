import type { MonitorMcpTaskState } from '../../tasks/MonitorMcpTask/MonitorMcpTask.js'
import type { DeepImmutable } from '../../types/utils.js'

type Props = {
  task: DeepImmutable<MonitorMcpTaskState>
  onKill?: () => void
  onBack: () => void
}

export function MonitorMcpDetailDialog(_props: Props) {
  return null
}
