import { useEffect } from 'react'

type AssistantSessionChooserProps = {
  sessions: unknown[]
  onSelect: (sessionId: string) => void
  onCancel: () => void
}

export function AssistantSessionChooser({
  sessions,
  onCancel,
  onSelect,
}: AssistantSessionChooserProps): null {
  useEffect(() => {
    const firstSession = sessions[0] as
      | { id?: string; sessionId?: string }
      | undefined

    const sessionId = firstSession?.id ?? firstSession?.sessionId
    if (sessionId) {
      onSelect(sessionId)
      return
    }

    onCancel()
  }, [onCancel, onSelect, sessions])

  return null
}
