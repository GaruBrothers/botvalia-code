import capitalize from 'lodash-es/capitalize.js'
import * as React from 'react'
import { useMemo, useState } from 'react'
import { useExitOnCtrlCDWithKeybindings } from 'src/hooks/useExitOnCtrlCDWithKeybindings.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from 'src/services/analytics/index.js'
import {
  FAST_MODE_MODEL_DISPLAY,
  isFastModeAvailable,
  isFastModeCooldown,
  isFastModeEnabled,
} from 'src/utils/fastMode.js'
import { Box, Text } from '../ink.js'
import { useKeybindings } from '../keybindings/useKeybinding.js'
import { useAppState, useSetAppState } from '../state/AppState.js'
import {
  convertEffortValueToLevel,
  type EffortLevel,
  getDefaultEffortForModel,
  modelSupportsEffort,
  modelSupportsMaxEffort,
  resolvePickerEffortPersistence,
  toPersistableEffort,
} from '../utils/effort.js'
import {
  AUTO_ALL_MODEL_ALIAS,
  AUTO_OLLAMA_MODEL_ALIAS,
  AUTO_OPENROUTER_MODEL_ALIAS,
  getDefaultMainLoopModel,
  type ModelSetting,
  modelDisplayString,
  parseUserSpecifiedModel,
} from '../utils/model/model.js'
import {
  getFreeOnlyManualModelOptions,
  getFreeOnlyModePickerOptions,
  getModelOptions,
  MANUAL_MODEL_PICKER_VALUE,
  type ModelOption,
} from '../utils/model/modelOptions.js'
import { parseProviderRoute } from '../utils/model/providerRouting.js'
import {
  getSettingsForSource,
  updateSettingsForSource,
} from '../utils/settings/settings.js'
import { ConfigurableShortcutHint } from './ConfigurableShortcutHint.js'
import { Select } from './CustomSelect/index.js'
import { Byline } from './design-system/Byline.js'
import { KeyboardShortcutHint } from './design-system/KeyboardShortcutHint.js'
import { Pane } from './design-system/Pane.js'
import { effortLevelToSymbol } from './EffortIndicator.js'

type PickerStage = 'mode' | 'manual'

export type Props = {
  initial: string | null
  sessionModel?: ModelSetting
  onSelect: (model: string | null, effort: EffortLevel | undefined) => void
  onCancel?: () => void
  isStandaloneCommand?: boolean
  showFastModeNotice?: boolean
  headerText?: string
  skipSettingsWrite?: boolean
  initialPickerStage?: PickerStage
}

const NO_PREFERENCE = '__NO_PREFERENCE__'

function isFreeOnlyModeEnabled(): boolean {
  return process.env.BOTVALIA_FREE_ONLY_MODE === '1'
}

function isManualFreeOnlyRoute(model: string | null | undefined): boolean {
  const route = parseProviderRoute(model ?? undefined)
  return route?.kind === 'openrouter' || route?.kind === 'ollama'
}

function toSelectValue(value: string | null): string {
  return value === null ? NO_PREFERENCE : value
}

function getModeStageInitialValue(initial: string | null): string {
  if (
    initial === AUTO_ALL_MODEL_ALIAS ||
    initial === AUTO_OPENROUTER_MODEL_ALIAS ||
    initial === AUTO_OLLAMA_MODEL_ALIAS
  ) {
    return initial
  }

  if (isManualFreeOnlyRoute(initial)) {
    return MANUAL_MODEL_PICKER_VALUE
  }

  return AUTO_ALL_MODEL_ALIAS
}

function getManualCurrentOption(
  initial: string | null,
): ModelOption | undefined {
  if (!isManualFreeOnlyRoute(initial) || !initial) {
    return undefined
  }

  return {
    value: initial,
    label: modelDisplayString(initial),
    description: 'Modelo manual actual',
  }
}

function appendCurrentOption(
  options: ModelOption[],
  initial: string | null,
): ModelOption[] {
  if (initial === null || options.some(option => option.value === initial)) {
    return options
  }

  return [
    ...options,
    {
      value: initial,
      label: modelDisplayString(initial),
      description: 'Current model',
    },
  ]
}

function resolveOptionModel(value?: string): string | undefined {
  if (!value || value === MANUAL_MODEL_PICKER_VALUE) {
    return undefined
  }

  return value === NO_PREFERENCE
    ? getDefaultMainLoopModel()
    : parseUserSpecifiedModel(value)
}

function EffortLevelIndicator({
  effort,
}: {
  effort: EffortLevel | undefined
}): React.ReactNode {
  return (
    <Text color={effort ? 'claude' : 'subtle'}>
      {effortLevelToSymbol(effort ?? 'low')}
    </Text>
  )
}

export function ModelPicker({
  initial,
  sessionModel,
  onSelect,
  onCancel,
  isStandaloneCommand,
  showFastModeNotice,
  headerText,
  skipSettingsWrite,
  initialPickerStage,
}: Props): React.ReactNode {
  const setAppState = useSetAppState()
  const exitState = useExitOnCtrlCDWithKeybindings()
  const isFastMode = useAppState(s => (isFastModeEnabled() ? s.fastMode : false))
  const effortValue = useAppState(s => s.effortValue)
  const [hasToggledEffort, setHasToggledEffort] = useState(false)
  const [effort, setEffort] = useState<EffortLevel | undefined>(
    effortValue !== undefined ? convertEffortValueToLevel(effortValue) : undefined,
  )

  const freeOnlyModeEnabled = isFreeOnlyModeEnabled()
  const manualModelOptions = useMemo(() => {
    const currentManualOption = getManualCurrentOption(initial)
    const options = getFreeOnlyManualModelOptions()
    if (
      currentManualOption &&
      !options.some(option => option.value === currentManualOption.value)
    ) {
      return [...options, currentManualOption]
    }
    return options
  }, [initial])

  const [pickerStage, setPickerStage] = useState<PickerStage>(
    freeOnlyModeEnabled && initialPickerStage === 'manual' ? 'manual' : 'mode',
  )
  const [focusedValue, setFocusedValue] = useState<string>(() => {
    if (freeOnlyModeEnabled && initialPickerStage === 'manual') {
      return toSelectValue(
        isManualFreeOnlyRoute(initial)
          ? initial
          : manualModelOptions[0]?.value ?? null,
      )
    }
    return freeOnlyModeEnabled
      ? getModeStageInitialValue(initial)
      : toSelectValue(initial)
  })

  const modelOptions = useMemo(() => {
    if (!freeOnlyModeEnabled) {
      return appendCurrentOption(getModelOptions(isFastMode ?? false), initial)
    }

    return pickerStage === 'manual'
      ? manualModelOptions
      : getFreeOnlyModePickerOptions()
  }, [freeOnlyModeEnabled, initial, isFastMode, manualModelOptions, pickerStage])

  const selectOptions = useMemo(
    () =>
      modelOptions.map(option => ({
        ...option,
        value: toSelectValue(option.value),
      })),
    [modelOptions],
  )

  const stageDefaultValue = useMemo(() => {
    if (!freeOnlyModeEnabled) {
      return toSelectValue(initial)
    }

    if (pickerStage === 'manual') {
      const initialManualValue = isManualFreeOnlyRoute(initial) ? initial : null
      return toSelectValue(
        initialManualValue && manualModelOptions.some(option => option.value === initialManualValue)
          ? initialManualValue
          : manualModelOptions[0]?.value ?? null,
      )
    }

    return getModeStageInitialValue(initial)
  }, [freeOnlyModeEnabled, initial, manualModelOptions, pickerStage])

  const resolvedDefaultValue = useMemo(() => {
    if (selectOptions.some(option => option.value === stageDefaultValue)) {
      return stageDefaultValue
    }

    return selectOptions[0]?.value ?? undefined
  }, [selectOptions, stageDefaultValue])

  const resolvedFocusedValue = useMemo(() => {
    if (selectOptions.some(option => option.value === focusedValue)) {
      return focusedValue
    }

    return resolvedDefaultValue
  }, [focusedValue, resolvedDefaultValue, selectOptions])

  const visibleCount = Math.min(10, selectOptions.length)
  const hiddenCount = Math.max(0, selectOptions.length - visibleCount)
  const focusedOption = selectOptions.find(
    option => option.value === resolvedFocusedValue,
  )
  const focusedModelName =
    typeof focusedOption?.label === 'string' ? focusedOption.label : undefined
  const manualEntryFocused =
    freeOnlyModeEnabled &&
    pickerStage === 'mode' &&
    resolvedFocusedValue === MANUAL_MODEL_PICKER_VALUE
  const focusedModel = resolveOptionModel(resolvedFocusedValue)
  const focusedSupportsEffort = manualEntryFocused
    ? false
    : focusedModel
      ? modelSupportsEffort(focusedModel)
      : false
  const focusedSupportsMax = manualEntryFocused
    ? false
    : focusedModel
      ? modelSupportsMaxEffort(focusedModel)
      : false
  const focusedDefaultEffort = getDefaultEffortLevelForOption(
    resolvedFocusedValue,
  )
  const displayEffort =
    effort === 'max' && !focusedSupportsMax ? 'high' : effort

  const handleFocus = (value: string): void => {
    setFocusedValue(value)

    if (!hasToggledEffort && effortValue === undefined) {
      setEffort(getDefaultEffortLevelForOption(value))
    }
  }

  const handleCycleEffort = (direction: 'left' | 'right'): void => {
    if (!focusedSupportsEffort) {
      return
    }

    setEffort(previous =>
      cycleEffortLevel(
        previous ?? focusedDefaultEffort,
        direction,
        focusedSupportsMax,
      ),
    )
    setHasToggledEffort(true)
  }

  useKeybindings(
    {
      'modelPicker:decreaseEffort': () => handleCycleEffort('left'),
      'modelPicker:increaseEffort': () => handleCycleEffort('right'),
    },
    { context: 'ModelPicker' },
  )

  const handleSelect = (value: string): void => {
    if (freeOnlyModeEnabled && pickerStage === 'mode') {
      if (value === MANUAL_MODEL_PICKER_VALUE) {
        setPickerStage('manual')
        setFocusedValue(
          toSelectValue(
            isManualFreeOnlyRoute(initial)
              ? initial
              : manualModelOptions[0]?.value ?? null,
          ),
        )
        return
      }
    }

    logEvent('tengu_model_command_menu_effort', {
      effort: effort as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })

    if (!skipSettingsWrite) {
      const effortLevel = resolvePickerEffortPersistence(
        effort,
        getDefaultEffortLevelForOption(value),
        getSettingsForSource('userSettings')?.effortLevel,
        hasToggledEffort,
      )
      const persistable = toPersistableEffort(effortLevel)

      if (persistable !== undefined) {
        updateSettingsForSource('userSettings', {
          effortLevel: persistable,
        })
      }

      setAppState(previous => ({
        ...previous,
        effortValue: effortLevel,
      }))
    }

    const selectedModel = resolveOptionModel(value)
    const selectedEffort =
      hasToggledEffort && selectedModel && modelSupportsEffort(selectedModel)
        ? effort
        : undefined

    if (value === NO_PREFERENCE) {
      onSelect(null, selectedEffort)
      return
    }

    onSelect(value, selectedEffort)
  }

  const handleCancel = (): void => {
    if (freeOnlyModeEnabled && pickerStage === 'manual') {
      setPickerStage('mode')
      setFocusedValue(MANUAL_MODEL_PICKER_VALUE)
      return
    }

    onCancel?.()
  }

  const pickerTitle =
    freeOnlyModeEnabled && pickerStage === 'manual'
      ? 'Select manual model'
      : 'Select model'

  const pickerHeaderText =
    freeOnlyModeEnabled && pickerStage === 'manual'
      ? 'Manual: choose one exact OpenRouter or Ollama model. No auto-routing and no fallbacks. Press Esc to go back.'
      : headerText ??
        'Switch between BotValia models. Applies to this session and future BotValia Code sessions. For other/previous model names, specify with --model.'

  const footerCancelAction =
    freeOnlyModeEnabled && pickerStage === 'manual' ? 'back' : 'exit'

  const content = (
    <Box flexDirection="column">
      <Box marginBottom={1} flexDirection="column">
        <Text color="remember" bold>
          {pickerTitle}
        </Text>
        <Text dimColor>{pickerHeaderText}</Text>
        {sessionModel ? (
          <Text dimColor>
            Currently using {modelDisplayString(sessionModel)} for this session
            (set by plan mode). Selecting a model will undo this.
          </Text>
        ) : null}
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Box flexDirection="column">
          <Select
            key={pickerStage}
            defaultValue={resolvedDefaultValue}
            defaultFocusValue={resolvedFocusedValue}
            options={selectOptions}
            onChange={handleSelect}
            onFocus={handleFocus}
            onCancel={handleCancel}
            visibleOptionCount={visibleCount}
          />
        </Box>
        {hiddenCount > 0 ? (
          <Box paddingLeft={3}>
            <Text dimColor>and {hiddenCount} more…</Text>
          </Box>
        ) : null}
      </Box>

      <Box marginBottom={1} flexDirection="column">
        {manualEntryFocused ? (
          <Text color="subtle">
            <EffortLevelIndicator effort={undefined} /> Press Enter to open the
            fixed model list
          </Text>
        ) : focusedSupportsEffort ? (
          <Text dimColor>
            <EffortLevelIndicator effort={displayEffort} />{' '}
            {capitalize(displayEffort)} effort
            {displayEffort === focusedDefaultEffort ? ' (default)' : ''}{' '}
            <Text color="subtle">← → to adjust</Text>
          </Text>
        ) : (
          <Text color="subtle">
            <EffortLevelIndicator effort={undefined} /> Effort not supported
            {focusedModelName ? ` for ${focusedModelName}` : ''}
          </Text>
        )}
      </Box>

      {isFastModeEnabled() ? (
        showFastModeNotice ? (
          <Box marginBottom={1}>
            <Text dimColor>
              Fast mode is <Text bold>ON</Text> and available with{' '}
              {FAST_MODE_MODEL_DISPLAY} only (/fast). Switching to other models
              turn off fast mode.
            </Text>
          </Box>
        ) : isFastModeAvailable() && !isFastModeCooldown() ? (
          <Box marginBottom={1}>
            <Text dimColor>
              Use <Text bold>/fast</Text> to turn on Fast mode (
              {FAST_MODE_MODEL_DISPLAY} only).
            </Text>
          </Box>
        ) : null
      ) : null}

      {isStandaloneCommand ? (
        <Text dimColor italic>
          {exitState.pending ? (
            <>Press {exitState.keyName} again to exit</>
          ) : (
            <Byline>
              <KeyboardShortcutHint shortcut="Enter" action="confirm" />
              <ConfigurableShortcutHint
                action="select:cancel"
                context="Select"
                fallback="Esc"
                description={footerCancelAction}
              />
            </Byline>
          )}
        </Text>
      ) : null}
    </Box>
  )

  if (!isStandaloneCommand) {
    return content
  }

  return <Pane color="permission">{content}</Pane>
}

function cycleEffortLevel(
  current: EffortLevel,
  direction: 'left' | 'right',
  includeMax: boolean,
): EffortLevel {
  const levels: EffortLevel[] = includeMax
    ? ['low', 'medium', 'high', 'max']
    : ['low', 'medium', 'high']
  const index = levels.indexOf(current)
  const currentIndex = index !== -1 ? index : levels.indexOf('high')

  if (direction === 'right') {
    return levels[(currentIndex + 1) % levels.length]!
  }

  return levels[(currentIndex - 1 + levels.length) % levels.length]!
}

function getDefaultEffortLevelForOption(value?: string): EffortLevel {
  const resolved = resolveOptionModel(value) ?? getDefaultMainLoopModel()
  const defaultValue = getDefaultEffortForModel(resolved)
  return defaultValue !== undefined
    ? convertEffortValueToLevel(defaultValue)
    : 'high'
}
