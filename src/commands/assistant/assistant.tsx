import { useEffect } from 'react'

type NewInstallWizardProps = {
  defaultDir: string
  onInstalled: (dir: string) => void
  onCancel: () => void
  onError: (message: string) => void
}

export async function computeDefaultInstallDir(): Promise<string> {
  return process.cwd()
}

export function NewInstallWizard({
  onCancel,
}: NewInstallWizardProps): null {
  useEffect(() => {
    onCancel()
  }, [onCancel])

  return null
}
