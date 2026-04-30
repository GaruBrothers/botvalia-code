import type { CommandResultDisplay } from '../../commands.js'
import type { LocalWorkflowTaskState } from '../../tasks/LocalWorkflowTask/LocalWorkflowTask.js'
import type { DeepImmutable } from '../../types/utils.js'

type Props = {
  workflow: DeepImmutable<LocalWorkflowTaskState>
  onDone: (result?: string, options?: { display?: CommandResultDisplay }) => void
  onKill?: () => void
  onSkipAgent?: (agentId: string) => void
  onRetryAgent?: (agentId: string) => void
  onBack: () => void
}

export function WorkflowDetailDialog(_props: Props) {
  return null
}
