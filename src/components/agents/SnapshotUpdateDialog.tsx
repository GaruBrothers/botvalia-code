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
