import { useEffect } from 'react'

type SnapshotUpdateDialogProps = {
  agentType: string
  scope: string
  snapshotTimestamp: string
  onComplete: (choice: 'merge' | 'keep' | 'replace') => void
  onCancel: () => void
}

export function SnapshotUpdateDialog({
  onCancel,
}: SnapshotUpdateDialogProps): null {
  useEffect(() => {
    onCancel()
  }, [onCancel])

  return null
}

export function buildMergePrompt(agentType: string, scope: string): string {
  return `Merge the pending ${agentType} memory snapshot for scope "${scope}" into the current session context before continuing.`
}
