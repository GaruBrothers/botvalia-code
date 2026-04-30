import type * as React from 'react'

export type WizardStepComponent<
  T extends Record<string, unknown> = Record<string, unknown>,
> = React.ComponentType

export type WizardContextValue<
  T extends Record<string, unknown> = Record<string, unknown>,
> = {
  currentStepIndex: number
  totalSteps: number
  wizardData: T
  setWizardData: React.Dispatch<React.SetStateAction<T>>
  updateWizardData: (updates: Partial<T>) => void
  goNext: () => void
  goBack: () => void
  goToStep: (step: number) => void
  cancel: () => void
  title?: string
  showStepCounter?: boolean
}

export type WizardProviderProps<
  T extends Record<string, unknown> = Record<string, unknown>,
> = {
  steps: WizardStepComponent<T>[]
  initialData?: T
  onComplete: (data: T) => void | Promise<void>
  onCancel?: () => void
  children?: React.ReactNode
  title?: string
  showStepCounter?: boolean
}
