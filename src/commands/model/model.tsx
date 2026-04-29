import chalk from 'chalk'
import * as React from 'react'
import type { CommandResultDisplay } from '../../commands.js'
import { ModelPicker } from '../../components/ModelPicker.js'
import { COMMON_HELP_ARGS, COMMON_INFO_ARGS } from '../../constants/xml.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from '../../services/analytics/index.js'
import { useAppState, useSetAppState } from '../../state/AppState.js'
import type { LocalJSXCommandCall } from '../../types/command.js'
import type { EffortLevel } from '../../utils/effort.js'
import { isBilledAsExtraUsage } from '../../utils/extraUsage.js'
import {
  clearFastModeCooldown,
  isFastModeAvailable,
  isFastModeEnabled,
  isFastModeSupportedByModel,
} from '../../utils/fastMode.js'
import { MODEL_ALIASES } from '../../utils/model/aliases.js'
import {
  checkOpus1mAccess,
  checkSonnet1mAccess,
} from '../../utils/model/check1mAccess.js'
import {
  AUTO_ALL_MODEL_ALIAS,
  AUTO_OLLAMA_MODEL_ALIAS,
  AUTO_OPENROUTER_MODEL_ALIAS,
  getDefaultMainLoopModelSetting,
  isOpus1mMergeEnabled,
  renderDefaultModelSetting,
} from '../../utils/model/model.js'
import { isModelAllowed } from '../../utils/model/modelAllowlist.js'
import {
  isProviderRouteSpec,
  parseProviderRoute,
} from '../../utils/model/providerRouting.js'
import { validateModel } from '../../utils/model/validateModel.js'

type PickerStage = 'mode' | 'manual'

const FREE_ONLY_MODEL_HEADER_TEXT =
  'Free-only mode: choose Auto (All), Auto (OpenRouter), Auto (Ollama), or Manual. Manual opens a second list of fixed models.'

const FREE_ONLY_MODEL_HELP_TEXT = [
  'Run /model to open the mode selector, or /model [mode] to set it directly.',
  'Top-level options: Auto (All), Auto (OpenRouter), Auto (Ollama), Manual.',
  'Manual opens a second list with exact fixed models ordered by tier.',
  'Auto (All): hybrid free routing with OpenRouter and Ollama. Each lane has one primary model plus two fallbacks.',
  'Auto (OpenRouter): free OpenRouter routing with two same-provider fallbacks per tier.',
  'Auto (Ollama): local Ollama routing with two same-provider fallbacks per tier.',
  'openrouter/free is an OpenRouter router, not a fixed manual model. BotValia uses it inside the automatic OpenRouter fast lane.',
  'Direct examples: /model auto-all, /model auto-openrouter, /model auto-ollama, /model manual, /model openrouter::qwen/qwen3.6-plus:free, /model ollama::qwen3-coder',
].join('\n')

const FREE_ONLY_MODEL_DIRECT_HINT =
  'Tip: use /model auto-all, /model auto-openrouter, /model auto-ollama, /model manual, /model openrouter::MODEL, or /model ollama::MODEL.'

function isFreeOnlyModeEnabled(): boolean {
  return process.env.BOTVALIA_FREE_ONLY_MODE === '1'
}

function isAllowedFreeOnlyDirectModel(model: string): boolean {
  if (
    model === AUTO_ALL_MODEL_ALIAS ||
    model === AUTO_OPENROUTER_MODEL_ALIAS ||
    model === AUTO_OLLAMA_MODEL_ALIAS
  ) {
    return true
  }

  const providerRoute = parseProviderRoute(model ?? undefined)
  return providerRoute?.kind === 'openrouter' || providerRoute?.kind === 'ollama'
}

function appendModelModeSummary(
  message: string,
  model: string | null,
): string {
  const summary = getModelModeSummary(model)
  return summary ? `${message}\n${chalk.dim(`Mode: ${summary}`)}` : message
}

function appendDirectSetHint(message: string): string {
  return `${message}\n${chalk.dim(FREE_ONLY_MODEL_DIRECT_HINT)}`
}

function getModelModeSummary(model: string | null): string | undefined {
  if (model === AUTO_ALL_MODEL_ALIAS) {
    return 'Automatic hybrid free routing with OpenRouter and Ollama fallbacks.'
  }

  if (model === AUTO_OPENROUTER_MODEL_ALIAS) {
    return 'Automatic free OpenRouter routing with fallbacks.'
  }

  if (model === AUTO_OLLAMA_MODEL_ALIAS) {
    return 'Automatic local Ollama routing with fallbacks.'
  }

  const providerRoute = parseProviderRoute(model ?? undefined)
  if (!providerRoute) {
    return undefined
  }

  if (providerRoute.kind === 'openrouter') {
    return 'Manual OpenRouter route pinned to one exact model with no auto routing or fallbacks.'
  }

  if (providerRoute.kind === 'ollama') {
    return 'Manual Ollama route pinned to one exact local model with no auto routing or fallbacks.'
  }

  return 'Manual Anthropic route pinned to one exact model with no auto routing or fallbacks.'
}

function ModelPickerWrapper({
  onDone,
  initialPickerStage = 'mode',
}: {
  onDone: (
    result?: string,
    options?: { display?: CommandResultDisplay },
  ) => void
  initialPickerStage?: PickerStage
}): React.ReactNode {
  const mainLoopModel = useAppState(s => s.mainLoopModel)
  const mainLoopModelForSession = useAppState(s => s.mainLoopModelForSession)
  const isFastMode = useAppState(s => s.fastMode)
  const setAppState = useSetAppState()

  function handleCancel(): void {
    logEvent('tengu_model_command_menu', {
      action:
        'cancel' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })
    const displayModel = renderModelLabel(mainLoopModel)
    onDone(`Kept model as ${chalk.bold(displayModel)}`, {
      display: 'system',
    })
  }

  function handleSelect(
    model: string | null,
    effort: EffortLevel | undefined,
  ): void {
    logEvent('tengu_model_command_menu', {
      action:
        model as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      from_model:
        mainLoopModel as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      to_model:
        model as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })

    setAppState(previous => ({
      ...previous,
      mainLoopModel: model,
      mainLoopModelForSession: null,
    }))

    let message = `Set model to ${chalk.bold(renderModelLabel(model))}`

    if (effort !== undefined) {
      message += ` with ${chalk.bold(effort)} effort`
    }

    let wasFastModeToggledOn: boolean | undefined
    if (isFastModeEnabled()) {
      clearFastModeCooldown()
      if (!isFastModeSupportedByModel(model) && isFastMode) {
        setAppState(previous => ({
          ...previous,
          fastMode: false,
        }))
        wasFastModeToggledOn = false
      } else if (
        isFastModeSupportedByModel(model) &&
        isFastModeAvailable() &&
        isFastMode
      ) {
        message += ' · Fast mode ON'
        wasFastModeToggledOn = true
      }
    }

    if (
      isBilledAsExtraUsage(
        model,
        wasFastModeToggledOn === true,
        isOpus1mMergeEnabled(),
      )
    ) {
      message += ' · Billed as extra usage'
    }

    if (wasFastModeToggledOn === false) {
      message += ' · Fast mode OFF'
    }

    onDone(appendModelModeSummary(message, model))
  }

  return (
    <ModelPicker
      initial={mainLoopModel}
      sessionModel={mainLoopModelForSession}
      onSelect={handleSelect}
      onCancel={handleCancel}
      isStandaloneCommand
      showFastModeNotice={
        isFastModeEnabled() &&
        isFastMode &&
        isFastModeSupportedByModel(mainLoopModel) &&
        isFastModeAvailable()
      }
      headerText={FREE_ONLY_MODEL_HEADER_TEXT}
      initialPickerStage={initialPickerStage}
    />
  )
}

function SetModelAndClose({
  args,
  onDone,
}: {
  args: string
  onDone: (
    result?: string,
    options?: { display?: CommandResultDisplay },
  ) => void
}): React.ReactNode {
  const isFastMode = useAppState(s => s.fastMode)
  const setAppState = useSetAppState()
  const model = args === 'default' ? null : args

  React.useEffect(() => {
    async function handleModelChange(): Promise<void> {
      if (model && !isModelAllowed(model)) {
        onDone(
          `Model '${model}' is not available. Your organization restricts model selection.`,
          { display: 'system' },
        )
        return
      }

      if (model && isFreeOnlyModeEnabled() && !isAllowedFreeOnlyDirectModel(model)) {
        onDone(
          appendDirectSetHint(
            'Free-only mode only allows Auto (All), Auto (OpenRouter), Auto (Ollama), or manual OpenRouter/Ollama routes.',
          ),
          { display: 'system' },
        )
        return
      }

      if (model && isOpus1mUnavailable(model)) {
        onDone(
          'Opus 4.6 with 1M context is not available for your account. Learn more: https://code.claude.com/docs/en/model-config#extended-context-with-1m',
          { display: 'system' },
        )
        return
      }

      if (model && isSonnet1mUnavailable(model)) {
        onDone(
          'Sonnet 4.6 with 1M context is not available for your account. Learn more: https://code.claude.com/docs/en/model-config#extended-context-with-1m',
          { display: 'system' },
        )
        return
      }

      if (!model) {
        setModel(null)
        return
      }

      if (isKnownAlias(model) || isProviderRouteSpec(model)) {
        setModel(model)
        return
      }

      try {
        const { valid, error } = await validateModel(model)
        if (valid) {
          setModel(model)
        } else {
          onDone(appendDirectSetHint(error || `Model '${model}' not found`), {
            display: 'system',
          })
        }
      } catch (error) {
        onDone(`Failed to validate model: ${(error as Error).message}`, {
          display: 'system',
        })
      }
    }

    function setModel(modelValue: string | null): void {
      setAppState(previous => ({
        ...previous,
        mainLoopModel: modelValue,
        mainLoopModelForSession: null,
      }))

      let message = `Set model to ${chalk.bold(renderModelLabel(modelValue))}`
      let wasFastModeToggledOn: boolean | undefined

      if (isFastModeEnabled()) {
        clearFastModeCooldown()
        if (!isFastModeSupportedByModel(modelValue) && isFastMode) {
          setAppState(previous => ({
            ...previous,
            fastMode: false,
          }))
          wasFastModeToggledOn = false
        } else if (isFastModeSupportedByModel(modelValue) && isFastMode) {
          message += ' · Fast mode ON'
          wasFastModeToggledOn = true
        }
      }

      if (
        isBilledAsExtraUsage(
          modelValue,
          wasFastModeToggledOn === true,
          isOpus1mMergeEnabled(),
        )
      ) {
        message += ' · Billed as extra usage'
      }

      if (wasFastModeToggledOn === false) {
        message += ' · Fast mode OFF'
      }

      onDone(appendModelModeSummary(message, modelValue))
    }

    void handleModelChange()
  }, [isFastMode, model, onDone, setAppState])

  return null
}

function isKnownAlias(model: string): boolean {
  return (MODEL_ALIASES as readonly string[]).includes(
    model.toLowerCase().trim(),
  )
}

function isOpus1mUnavailable(model: string): boolean {
  const normalized = model.toLowerCase()
  return (
    !checkOpus1mAccess() &&
    !isOpus1mMergeEnabled() &&
    normalized.includes('opus') &&
    normalized.includes('[1m]')
  )
}

function isSonnet1mUnavailable(model: string): boolean {
  const normalized = model.toLowerCase()
  return (
    !checkSonnet1mAccess() &&
    (normalized.includes('sonnet[1m]') ||
      normalized.includes('sonnet-4-6[1m]'))
  )
}

function ShowModelAndClose({
  onDone,
}: {
  onDone: (result?: string) => void
}): React.ReactNode {
  const mainLoopModel = useAppState(s => s.mainLoopModel)
  const mainLoopModelForSession = useAppState(s => s.mainLoopModelForSession)
  const effortValue = useAppState(s => s.effortValue)
  const displayModel = renderModelLabel(mainLoopModel)
  const effortInfo =
    effortValue !== undefined ? ` (effort: ${effortValue})` : ''

  if (mainLoopModelForSession) {
    onDone(
      appendModelModeSummary(
        `Current model: ${chalk.bold(renderModelLabel(mainLoopModelForSession))} (session override from plan mode)\nBase model: ${displayModel}${effortInfo}`,
        mainLoopModelForSession,
      ),
    )
  } else {
    onDone(
      appendModelModeSummary(
        `Current model: ${displayModel}${effortInfo}`,
        mainLoopModel,
      ),
    )
  }

  return null
}

export const call: LocalJSXCommandCall = async (onDone, _context, args) => {
  args = args?.trim() || ''

  if (COMMON_INFO_ARGS.includes(args)) {
    logEvent('tengu_model_command_inline_help', {
      args: args as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })
    return <ShowModelAndClose onDone={onDone} />
  }

  if (COMMON_HELP_ARGS.includes(args)) {
    onDone(FREE_ONLY_MODEL_HELP_TEXT, { display: 'system' })
    return
  }

  if (args) {
    logEvent('tengu_model_command_inline', {
      args: args as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })

    if (isFreeOnlyModeEnabled() && args === 'manual') {
      return <ModelPickerWrapper onDone={onDone} initialPickerStage="manual" />
    }

    return <SetModelAndClose args={args} onDone={onDone} />
  }

  return <ModelPickerWrapper onDone={onDone} />
}

function renderModelLabel(model: string | null): string {
  const rendered = renderDefaultModelSetting(
    model ?? getDefaultMainLoopModelSetting(),
  )
  return model === null ? `${rendered} (default)` : rendered
}
