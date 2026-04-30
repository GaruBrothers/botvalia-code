// biome-ignore-all assist/source/organizeImports: ANT-ONLY import markers must not be reordered
import { getInitialMainLoopModel } from '../../bootstrap/state.js'
import {
  isClaudeAISubscriber,
  isMaxSubscriber,
  isTeamPremiumSubscriber,
} from '../auth.js'
import { getModelStrings } from './modelStrings.js'
import {
  COST_TIER_3_15,
  COST_HAIKU_35,
  COST_HAIKU_45,
  formatModelPricing,
} from '../modelCost.js'
import { getSettings_DEPRECATED } from '../settings/settings.js'
import { checkOpus1mAccess, checkSonnet1mAccess } from './check1mAccess.js'
import { getAPIProvider } from './providers.js'
import { isModelAllowed } from './modelAllowlist.js'
import {
  AUTO_ALL_MODEL_ALIAS,
  AUTO_OLLAMA_MODEL_ALIAS,
  AUTO_OPENROUTER_MODEL_ALIAS,
  getCanonicalName,
  getClaudeAiUserDefaultModelDescription,
  getDefaultSonnetModel,
  getDefaultOpusModel,
  getDefaultHaikuModel,
  getDefaultMainLoopModelSetting,
  getMarketingNameForModel,
  getUserSpecifiedModelSetting,
  isOpus1mMergeEnabled,
  getOpus46PricingSuffix,
  renderDefaultModelSetting,
  type ModelSetting,
} from './model.js'
import { has1mContext } from '../context.js'
import { getGlobalConfig } from '../config.js'

// @[MODEL LAUNCH]: Update all the available and default model option strings below.

export type ModelOption = {
  value: ModelSetting
  label: string
  description: string
  descriptionForModel?: string
}

export const MANUAL_MODEL_PICKER_VALUE = '__manual_mode__'

export type ModelPickerModeOption = Omit<ModelOption, 'value'> & {
  value: string
}

type FreeOnlyCatalogTier = 'code' | 'general' | 'fast'
type FreeOnlyCatalogProvider = 'openrouter' | 'ollama'

type FreeOnlyCatalogOption = ModelOption & {
  provider: FreeOnlyCatalogProvider
  tier: FreeOnlyCatalogTier
}

const FREE_ONLY_MANUAL_MODEL_CATALOG: FreeOnlyCatalogOption[] = [
  {
    value: 'openrouter::poolside/laguna-m.1:free',
    label: 'Code · Laguna M.1 (OpenRouter)',
    description: 'Coding agentico · curado · free',
    provider: 'openrouter',
    tier: 'code',
  },
  {
    value: 'openrouter::qwen/qwen3-coder:free',
    label: 'Code · Qwen 3 Coder (OpenRouter)',
    description: 'Codigo repo-scale · curado · free',
    provider: 'openrouter',
    tier: 'code',
  },
  {
    value: 'openrouter::tencent/hy3-preview:free',
    label: 'Code · Hy3 Preview (OpenRouter)',
    description: 'Agentes + codigo · curado · free',
    provider: 'openrouter',
    tier: 'code',
  },
  {
    value: 'openrouter::openai/gpt-oss-120b:free',
    label: 'Code · GPT-OSS 120B (OpenRouter)',
    description: 'Razonamiento fuerte · curado · free',
    provider: 'openrouter',
    tier: 'code',
  },
  {
    value: 'openrouter::minimax/minimax-m2.5:free',
    label: 'Code · MiniMax M2.5 (OpenRouter)',
    description: 'Productividad + SWE · curado · free',
    provider: 'openrouter',
    tier: 'code',
  },
  {
    value: 'openrouter::qwen/qwen3-next-80b-a3b-instruct:free',
    label: 'Code · Qwen3 Next 80B (OpenRouter)',
    description: 'General potente con buen codigo · curado · free',
    provider: 'openrouter',
    tier: 'code',
  },
  {
    value: 'openrouter::google/gemma-4-31b-it:free',
    label: 'Code · Gemma 4 31B (OpenRouter)',
    description: 'Codigo + documentos · curado · free',
    provider: 'openrouter',
    tier: 'code',
  },
  {
    value: 'openrouter::nvidia/nemotron-3-super-120b-a12b:free',
    label: 'Code · Nemotron 3 Super (OpenRouter)',
    description: 'Multi-step + agentes · curado · free',
    provider: 'openrouter',
    tier: 'code',
  },
  {
    value: 'ollama::qwen3-coder:30b',
    label: 'Code · Qwen3 Coder 30B (Ollama)',
    description: 'Codigo local fuerte · curado',
    provider: 'ollama',
    tier: 'code',
  },
  {
    value: 'ollama::gpt-oss:20b',
    label: 'Code · GPT-OSS 20B (Ollama)',
    description: 'Agentes + razonamiento local · curado',
    provider: 'ollama',
    tier: 'code',
  },
  {
    value: 'ollama::deepseek-r1:14b',
    label: 'Code · DeepSeek R1 14B (Ollama)',
    description: 'Codigo con razonamiento local · curado',
    provider: 'ollama',
    tier: 'code',
  },
  {
    value: 'ollama::qwen3:30b',
    label: 'Code · Qwen3 30B (Ollama)',
    description: 'General potente para coding local · curado',
    provider: 'ollama',
    tier: 'code',
  },
  {
    value: 'ollama::gemma3:12b',
    label: 'Code · Gemma 3 12B (Ollama)',
    description: 'Ligero pero util para coding local · curado',
    provider: 'ollama',
    tier: 'code',
  },
  {
    value: 'ollama::qwen2.5-coder:14b',
    label: 'Code · Qwen 2.5 Coder 14B (Ollama)',
    description: 'Fallback local estable · curado',
    provider: 'ollama',
    tier: 'code',
  },
  {
    value: 'ollama::qwen2.5-coder:7b',
    label: 'Code · Qwen 2.5 Coder 7B (Ollama)',
    description: 'Fallback local compacto · curado',
    provider: 'ollama',
    tier: 'code',
  },
  {
    value: 'ollama::deepseek-coder-v2:16b',
    label: 'Code · DeepSeek Coder V2 16B (Ollama)',
    description: 'Fallback local pesado · curado',
    provider: 'ollama',
    tier: 'code',
  },
  {
    value: 'openrouter::tencent/hy3-preview:free',
    label: 'General · Hy3 Preview (OpenRouter)',
    description: 'Top free actual para agentes · curado · free',
    provider: 'openrouter',
    tier: 'general',
  },
  {
    value: 'openrouter::openai/gpt-oss-120b:free',
    label: 'General · GPT-OSS 120B (OpenRouter)',
    description: 'Razonamiento + tools · curado · free',
    provider: 'openrouter',
    tier: 'general',
  },
  {
    value: 'openrouter::minimax/minimax-m2.5:free',
    label: 'General · MiniMax M2.5 (OpenRouter)',
    description: 'Productividad real-world · curado · free',
    provider: 'openrouter',
    tier: 'general',
  },
  {
    value: 'openrouter::qwen/qwen3-next-80b-a3b-instruct:free',
    label: 'General · Qwen3 Next 80B (OpenRouter)',
    description: 'General equilibrado · curado · free',
    provider: 'openrouter',
    tier: 'general',
  },
  {
    value: 'openrouter::google/gemma-4-31b-it:free',
    label: 'General · Gemma 4 31B (OpenRouter)',
    description: 'General + multimodal · curado · free',
    provider: 'openrouter',
    tier: 'general',
  },
  {
    value: 'openrouter::nvidia/nemotron-3-super-120b-a12b:free',
    label: 'General · Nemotron 3 Super (OpenRouter)',
    description: 'Planeacion larga · curado · free',
    provider: 'openrouter',
    tier: 'general',
  },
  {
    value: 'openrouter::inclusionai/ling-2.6-1t:free',
    label: 'General · Ling 2.6 1T (OpenRouter)',
    description: 'Top usage reciente · curado · free',
    provider: 'openrouter',
    tier: 'general',
  },
  {
    value: 'openrouter::z-ai/glm-4.5-air:free',
    label: 'General · GLM 4.5 Air (OpenRouter)',
    description: 'Ligero pero muy capaz · curado · free',
    provider: 'openrouter',
    tier: 'general',
  },
  {
    value: 'ollama::gpt-oss:20b',
    label: 'General · GPT-OSS 20B (Ollama)',
    description: 'General local recomendado · curado',
    provider: 'ollama',
    tier: 'general',
  },
  {
    value: 'ollama::qwen3:30b',
    label: 'General · Qwen3 30B (Ollama)',
    description: 'General local fuerte · curado',
    provider: 'ollama',
    tier: 'general',
  },
  {
    value: 'ollama::deepseek-r1:32b',
    label: 'General · DeepSeek R1 32B (Ollama)',
    description: 'Razonamiento local largo · curado',
    provider: 'ollama',
    tier: 'general',
  },
  {
    value: 'ollama::deepseek-r1:14b',
    label: 'General · DeepSeek R1 14B (Ollama)',
    description: 'Razonamiento local medio · curado',
    provider: 'ollama',
    tier: 'general',
  },
  {
    value: 'ollama::gemma3:27b',
    label: 'General · Gemma 3 27B (Ollama)',
    description: 'General local multimodal · curado',
    provider: 'ollama',
    tier: 'general',
  },
  {
    value: 'ollama::gemma3:12b',
    label: 'General · Gemma 3 12B (Ollama)',
    description: 'General local balanceado · curado',
    provider: 'ollama',
    tier: 'general',
  },
  {
    value: 'ollama::qwen3:14b',
    label: 'General · Qwen3 14B (Ollama)',
    description: 'Fallback local solido · curado',
    provider: 'ollama',
    tier: 'general',
  },
  {
    value: 'ollama::qwen2.5-coder:14b',
    label: 'General · Qwen 2.5 Coder 14B (Ollama)',
    description: 'Fallback local por codigo/razonamiento · curado',
    provider: 'ollama',
    tier: 'general',
  },
  {
    value: 'openrouter::google/gemma-4-26b-a4b-it:free',
    label: 'Fast · Gemma 4 26B (OpenRouter)',
    description: 'Rapido + muy competente · curado · free',
    provider: 'openrouter',
    tier: 'fast',
  },
  {
    value: 'openrouter::z-ai/glm-4.5-air:free',
    label: 'Fast · GLM 4.5 Air (OpenRouter)',
    description: 'Fast reasoning ligero · curado · free',
    provider: 'openrouter',
    tier: 'fast',
  },
  {
    value: 'openrouter::openai/gpt-oss-20b:free',
    label: 'Fast · GPT-OSS 20B (OpenRouter)',
    description: 'Rapido con tools · curado · free',
    provider: 'openrouter',
    tier: 'fast',
  },
  {
    value: 'openrouter::nvidia/nemotron-nano-9b-v2:free',
    label: 'Fast · Nemotron Nano 9B (OpenRouter)',
    description: 'Nano tecnico · curado · free',
    provider: 'openrouter',
    tier: 'fast',
  },
  {
    value: 'openrouter::nvidia/nemotron-3-nano-30b-a3b:free',
    label: 'Fast · Nemotron 3 Nano 30B (OpenRouter)',
    description: 'Nano agente rapido · curado · free',
    provider: 'openrouter',
    tier: 'fast',
  },
  {
    value: 'openrouter::poolside/laguna-xs.2:free',
    label: 'Fast · Laguna XS.2 (OpenRouter)',
    description: 'Coding rapido de apoyo · curado · free',
    provider: 'openrouter',
    tier: 'fast',
  },
  {
    value: 'openrouter::google/gemma-3-12b-it:free',
    label: 'Fast · Gemma 3 12B (OpenRouter)',
    description: 'Fallback rapido actual · curado · free',
    provider: 'openrouter',
    tier: 'fast',
  },
  {
    value: 'openrouter::meta-llama/llama-3.2-3b-instruct:free',
    label: 'Fast · Llama 3.2 3B (OpenRouter)',
    description: 'Fallback minimo y estable · curado · free',
    provider: 'openrouter',
    tier: 'fast',
  },
  {
    value: 'ollama::gemma3:4b',
    label: 'Fast · Gemma 3 4B (Ollama)',
    description: 'Rapido local recomendado · curado',
    provider: 'ollama',
    tier: 'fast',
  },
  {
    value: 'ollama::qwen3:4b',
    label: 'Fast · Qwen3 4B (Ollama)',
    description: 'Fast general local · curado',
    provider: 'ollama',
    tier: 'fast',
  },
  {
    value: 'ollama::llama3.2:3b',
    label: 'Fast · Llama 3.2 3B (Ollama)',
    description: 'Fallback local muy liviano · curado',
    provider: 'ollama',
    tier: 'fast',
  },
  {
    value: 'ollama::deepseek-r1:1.5b',
    label: 'Fast · DeepSeek R1 1.5B (Ollama)',
    description: 'Razonamiento minimo local · curado',
    provider: 'ollama',
    tier: 'fast',
  },
  {
    value: 'ollama::qwen2.5:3b',
    label: 'Fast · Qwen 2.5 3B (Ollama)',
    description: 'Fallback local clasico · curado',
    provider: 'ollama',
    tier: 'fast',
  },
  {
    value: 'ollama::qwen2.5-coder:3b',
    label: 'Fast · Qwen 2.5 Coder 3B (Ollama)',
    description: 'Fallback local para snippets · curado',
    provider: 'ollama',
    tier: 'fast',
  },
  {
    value: 'ollama::gemma3:1b',
    label: 'Fast · Gemma 3 1B (Ollama)',
    description: 'Fallback minimo local · curado',
    provider: 'ollama',
    tier: 'fast',
  },
]

function splitCatalogEnv(raw: string | undefined): string[] {
  if (!raw) {
    return []
  }

  return raw
    .split(/[,\n\r;]+/)
    .map(value => value.trim())
    .filter(Boolean)
}

function getRouteModelValue(route: string): string {
  if (route.startsWith('openrouter::')) {
    return route.slice('openrouter::'.length)
  }
  if (route.startsWith('ollama::')) {
    return route.slice('ollama::'.length)
  }

  return route
}

function normalizeOllamaModelValue(model: string): string {
  if (model.startsWith('ollama::')) {
    return model.slice('ollama::'.length)
  }
  if (model.startsWith('ollama/')) {
    return model.slice('ollama/'.length)
  }

  return model
}

function prettifyOllamaModel(model: string): string {
  return normalizeOllamaModelValue(model)
    .replace(/[-_/]+/g, ' ')
    .replace(/:/g, ' ')
    .replace(/\b([a-z])/g, (_, char: string) => char.toUpperCase())
}

function inferDynamicTier(model: string): FreeOnlyCatalogTier {
  const normalized = normalizeOllamaModelValue(model).toLowerCase()
  if (normalized.includes('coder')) {
    return 'code'
  }
  if (
    normalized.includes('gpt-oss') ||
    normalized.includes('deepseek-r1') ||
    normalized.includes(':14b') ||
    normalized.includes(':27b') ||
    normalized.includes(':30b') ||
    normalized.includes(':32b') ||
    normalized.includes(':70b')
  ) {
    return 'general'
  }

  return 'fast'
}

function buildAvailabilityAwareManualModelOptions(): ModelOption[] {
  const openRouterSource = process.env.BOTVALIA_OPENROUTER_FREE_MODELS_SOURCE
  const openRouterAvailable = process.env.BOTVALIA_OPENROUTER_AVAILABLE
  const ollamaAvailable = process.env.BOTVALIA_OLLAMA_AVAILABLE
  const ollamaInventoryKnown = process.env.BOTVALIA_OLLAMA_INVENTORY_KNOWN === '1'
  const liveOpenRouterModels = new Set(
    splitCatalogEnv(process.env.BOTVALIA_OPENROUTER_FREE_MODELS).map(model =>
      model.toLowerCase(),
    ),
  )
  const installedOllamaModels = splitCatalogEnv(
    process.env.BOTVALIA_OLLAMA_AVAILABLE_MODELS,
  )
  const installedOllamaLookup = new Set(
    installedOllamaModels.map(model =>
      normalizeOllamaModelValue(model).toLowerCase(),
    ),
  )

  const curatedOptions = FREE_ONLY_MANUAL_MODEL_CATALOG.filter(option => {
    if (option.provider === 'openrouter') {
      if (openRouterAvailable === '0') {
        return false
      }
      if (openRouterSource === 'live' && liveOpenRouterModels.size > 0) {
        return liveOpenRouterModels.has(
          getRouteModelValue(option.value).toLowerCase(),
        )
      }

      return true
    }

    if (ollamaAvailable === '0') {
      return false
    }
    if (ollamaInventoryKnown) {
      return installedOllamaLookup.has(
        normalizeOllamaModelValue(option.value).toLowerCase(),
      )
    }

    return true
  })

  const curatedValues = new Set(curatedOptions.map(option => option.value))
  const dynamicOllamaOptions: FreeOnlyCatalogOption[] =
    ollamaInventoryKnown && ollamaAvailable !== '0'
      ? installedOllamaModels
          .filter(
            model =>
              !curatedValues.has(`ollama::${normalizeOllamaModelValue(model)}`),
          )
          .map(model => {
            const normalizedModel = normalizeOllamaModelValue(model)
            const tier = inferDynamicTier(normalizedModel)
            const tierLabel =
              tier === 'code' ? 'Code' : tier === 'general' ? 'General' : 'Fast'

            return {
              value: `ollama::${normalizedModel}`,
              label: `${tierLabel} · ${prettifyOllamaModel(normalizedModel)} (Ollama)`,
              description: 'Modelo local detectado · inventario real',
              provider: 'ollama' as const,
              tier,
            }
          })
      : []

  const seenValues = new Set<string>()

  return [...curatedOptions, ...dynamicOllamaOptions].filter(option => {
    if (seenValues.has(option.value)) {
      return false
    }

    seenValues.add(option.value)
    return true
  })
}

export function getFreeOnlyModePickerOptions(): ModelPickerModeOption[] {
  return [
    {
      value: AUTO_ALL_MODEL_ALIAS,
      label: 'Auto (All)',
      description:
        'Recomendado · mezcla cloud/local · code, general y fast con fallbacks enriquecidos',
    },
    {
      value: AUTO_OPENROUTER_MODEL_ALIAS,
      label: 'Auto (OpenRouter)',
      description:
        'Gratis en la nube · rutas curadas segun free list real de OpenRouter',
    },
    {
      value: AUTO_OLLAMA_MODEL_ALIAS,
      label: 'Auto (Ollama)',
      description:
        'Gratis y local · rutas curadas segun modelos realmente instalados',
    },
    {
      value: MANUAL_MODEL_PICKER_VALUE,
      label: 'Manual',
      description:
        'Catalogo curado de modelos fijos, filtrado por disponibilidad real cuando existe',
    },
  ]
}

export function getFreeOnlyManualModelOptions(): ModelOption[] {
  return buildAvailabilityAwareManualModelOptions()
}

function getFreeOnlyModelOptions(): ModelOption[] {
  const manualOptions = getFreeOnlyManualModelOptions()

  return [
    {
      value: AUTO_ALL_MODEL_ALIAS,
      label: 'Auto (All)',
      description:
        'Recomendado · hibrido gratis · code, general y fast con OpenRouter/Ollama y multi-fallback',
    },
    {
      value: AUTO_OPENROUTER_MODEL_ALIAS,
      label: 'Auto (OpenRouter)',
      description:
        'Gratis en la nube · varios fallbacks OpenRouter filtrados por free list vigente',
    },
    {
      value: AUTO_OLLAMA_MODEL_ALIAS,
      label: 'Auto (Ollama)',
      description:
        'Gratis y local · varios fallbacks Ollama priorizados por inventario instalado',
    },
    ...manualOptions,
  ]
}

function isSafeFreeOnlyModelSetting(model: ModelSetting): boolean {
  if (!model) {
    return false
  }

  if (
    model === AUTO_ALL_MODEL_ALIAS ||
    model === AUTO_OPENROUTER_MODEL_ALIAS ||
    model === AUTO_OLLAMA_MODEL_ALIAS
  ) {
    return true
  }

  return (
    typeof model === 'string' &&
    (model.startsWith('openrouter::') || model.startsWith('ollama::'))
  )
}

export function getDefaultOptionForUser(fastMode = false): ModelOption {
  if (process.env.USER_TYPE === 'ant') {
    const currentModel = renderDefaultModelSetting(
      getDefaultMainLoopModelSetting(),
    )
    return {
      value: null,
      label: 'Default (recommended)',
      description: `Use the default model for Ants (currently ${currentModel})`,
      descriptionForModel: `Default model (currently ${currentModel})`,
    }
  }

  // Subscribers
  if (isClaudeAISubscriber()) {
    return {
      value: null,
      label: 'Default (recommended)',
      description: getClaudeAiUserDefaultModelDescription(fastMode),
    }
  }

  // PAYG
  const is3P = getAPIProvider() !== 'firstParty'
  return {
    value: null,
    label: 'Default (recommended)',
    description: `Use the default model (currently ${renderDefaultModelSetting(getDefaultMainLoopModelSetting())})${is3P ? '' : ` · ${formatModelPricing(COST_TIER_3_15)}`}`,
  }
}

function getCustomSonnetOption(): ModelOption | undefined {
  const is3P = getAPIProvider() !== 'firstParty'
  const customSonnetModel = process.env.ANTHROPIC_DEFAULT_SONNET_MODEL
  // When a 3P user has a custom sonnet model string, show it directly
  if (is3P && customSonnetModel) {
    const is1m = has1mContext(customSonnetModel)
    return {
      value: 'sonnet',
      label:
        process.env.ANTHROPIC_DEFAULT_SONNET_MODEL_NAME ?? customSonnetModel,
      description:
        process.env.ANTHROPIC_DEFAULT_SONNET_MODEL_DESCRIPTION ??
        `Custom Sonnet model${is1m ? ' (1M context)' : ''}`,
      descriptionForModel: `${process.env.ANTHROPIC_DEFAULT_SONNET_MODEL_DESCRIPTION ?? `Custom Sonnet model${is1m ? ' with 1M context' : ''}`} (${customSonnetModel})`,
    }
  }
}

// @[MODEL LAUNCH]: Update or add model option functions (getSonnetXXOption, getOpusXXOption, etc.)
// with the new model's label and description. These appear in the /model picker.
function getSonnet46Option(): ModelOption {
  const is3P = getAPIProvider() !== 'firstParty'
  return {
    value: is3P ? getModelStrings().sonnet46 : 'sonnet',
    label: 'Sonnet',
    description: `Sonnet 4.6 · Best for everyday tasks${is3P ? '' : ` · ${formatModelPricing(COST_TIER_3_15)}`}`,
    descriptionForModel:
      'Sonnet 4.6 - best for everyday tasks. Generally recommended for most coding tasks',
  }
}

function getCustomOpusOption(): ModelOption | undefined {
  const is3P = getAPIProvider() !== 'firstParty'
  const customOpusModel = process.env.ANTHROPIC_DEFAULT_OPUS_MODEL
  // When a 3P user has a custom opus model string, show it directly
  if (is3P && customOpusModel) {
    const is1m = has1mContext(customOpusModel)
    return {
      value: 'opus',
      label: process.env.ANTHROPIC_DEFAULT_OPUS_MODEL_NAME ?? customOpusModel,
      description:
        process.env.ANTHROPIC_DEFAULT_OPUS_MODEL_DESCRIPTION ??
        `Custom Opus model${is1m ? ' (1M context)' : ''}`,
      descriptionForModel: `${process.env.ANTHROPIC_DEFAULT_OPUS_MODEL_DESCRIPTION ?? `Custom Opus model${is1m ? ' with 1M context' : ''}`} (${customOpusModel})`,
    }
  }
}

function getOpus41Option(): ModelOption {
  return {
    value: 'opus',
    label: 'Opus 4.1',
    description: `Opus 4.1 · Legacy`,
    descriptionForModel: 'Opus 4.1 - legacy version',
  }
}

function getOpus46Option(fastMode = false): ModelOption {
  const is3P = getAPIProvider() !== 'firstParty'
  return {
    value: is3P ? getModelStrings().opus46 : 'opus',
    label: 'Opus',
    description: `Opus 4.6 · Most capable for complex work${getOpus46PricingSuffix(fastMode)}`,
    descriptionForModel: 'Opus 4.6 - most capable for complex work',
  }
}

export function getSonnet46_1MOption(): ModelOption {
  const is3P = getAPIProvider() !== 'firstParty'
  return {
    value: is3P ? getModelStrings().sonnet46 + '[1m]' : 'sonnet[1m]',
    label: 'Sonnet (1M context)',
    description: `Sonnet 4.6 for long sessions${is3P ? '' : ` · ${formatModelPricing(COST_TIER_3_15)}`}`,
    descriptionForModel:
      'Sonnet 4.6 with 1M context window - for long sessions with large codebases',
  }
}

export function getOpus46_1MOption(fastMode = false): ModelOption {
  const is3P = getAPIProvider() !== 'firstParty'
  return {
    value: is3P ? getModelStrings().opus46 + '[1m]' : 'opus[1m]',
    label: 'Opus (1M context)',
    description: `Opus 4.6 for long sessions${getOpus46PricingSuffix(fastMode)}`,
    descriptionForModel:
      'Opus 4.6 with 1M context window - for long sessions with large codebases',
  }
}

function getCustomHaikuOption(): ModelOption | undefined {
  const is3P = getAPIProvider() !== 'firstParty'
  const customHaikuModel = process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL
  // When a 3P user has a custom haiku model string, show it directly
  if (is3P && customHaikuModel) {
    return {
      value: 'haiku',
      label: process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME ?? customHaikuModel,
      description:
        process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL_DESCRIPTION ??
        'Custom Haiku model',
      descriptionForModel: `${process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL_DESCRIPTION ?? 'Custom Haiku model'} (${customHaikuModel})`,
    }
  }
}

function getHaiku45Option(): ModelOption {
  const is3P = getAPIProvider() !== 'firstParty'
  return {
    value: 'haiku',
    label: 'Haiku',
    description: `Haiku 4.5 · Fastest for quick answers${is3P ? '' : ` · ${formatModelPricing(COST_HAIKU_45)}`}`,
    descriptionForModel:
      'Haiku 4.5 - fastest for quick answers. Lower cost but less capable than Sonnet 4.6.',
  }
}

function getHaiku35Option(): ModelOption {
  const is3P = getAPIProvider() !== 'firstParty'
  return {
    value: 'haiku',
    label: 'Haiku',
    description: `Haiku 3.5 for simple tasks${is3P ? '' : ` · ${formatModelPricing(COST_HAIKU_35)}`}`,
    descriptionForModel:
      'Haiku 3.5 - faster and lower cost, but less capable than Sonnet. Use for simple tasks.',
  }
}

function getHaikuOption(): ModelOption {
  // Return correct Haiku option based on provider
  const haikuModel = getDefaultHaikuModel()
  return haikuModel === getModelStrings().haiku45
    ? getHaiku45Option()
    : getHaiku35Option()
}

function getMaxOpusOption(fastMode = false): ModelOption {
  return {
    value: 'opus',
    label: 'Opus',
    description: `Opus 4.6 · Most capable for complex work${fastMode ? getOpus46PricingSuffix(true) : ''}`,
  }
}

export function getMaxSonnet46_1MOption(): ModelOption {
  const is3P = getAPIProvider() !== 'firstParty'
  const billingInfo = isClaudeAISubscriber() ? ' · Billed as extra usage' : ''
  return {
    value: 'sonnet[1m]',
    label: 'Sonnet (1M context)',
    description: `Sonnet 4.6 with 1M context${billingInfo}${is3P ? '' : ` · ${formatModelPricing(COST_TIER_3_15)}`}`,
  }
}

export function getMaxOpus46_1MOption(fastMode = false): ModelOption {
  const billingInfo = isClaudeAISubscriber() ? ' · Billed as extra usage' : ''
  return {
    value: 'opus[1m]',
    label: 'Opus (1M context)',
    description: `Opus 4.6 with 1M context${billingInfo}${getOpus46PricingSuffix(fastMode)}`,
  }
}

function getMergedOpus1MOption(fastMode = false): ModelOption {
  const is3P = getAPIProvider() !== 'firstParty'
  return {
    value: is3P ? getModelStrings().opus46 + '[1m]' : 'opus[1m]',
    label: 'Opus (1M context)',
    description: `Opus 4.6 with 1M context · Most capable for complex work${!is3P && fastMode ? getOpus46PricingSuffix(fastMode) : ''}`,
    descriptionForModel:
      'Opus 4.6 with 1M context - most capable for complex work',
  }
}

const MaxSonnet46Option: ModelOption = {
  value: 'sonnet',
  label: 'Sonnet',
  description: 'Sonnet 4.6 · Best for everyday tasks',
}

const MaxHaiku45Option: ModelOption = {
  value: 'haiku',
  label: 'Haiku',
  description: 'Haiku 4.5 · Fastest for quick answers',
}

function getOpusPlanOption(): ModelOption {
  return {
    value: 'opusplan',
    label: 'Opus Plan Mode',
    description: 'Use Opus 4.6 in plan mode, Sonnet 4.6 otherwise',
  }
}

// @[MODEL LAUNCH]: Update the model picker lists below to include/reorder options for the new model.
// Each user tier (ant, Max/Team Premium, Pro/Team Standard/Enterprise, PAYG 1P, PAYG 3P) has its own list.
function getModelOptionsBase(fastMode = false): ModelOption[] {
  if (process.env.USER_TYPE === 'ant') {
    // Build options from antModels config
    const antModelOptions: ModelOption[] = getAntModels().map(m => ({
      value: m.alias,
      label: m.label,
      description: m.description ?? `[ANT-ONLY] ${m.label} (${m.model})`,
    }))

    return [
      getDefaultOptionForUser(),
      ...antModelOptions,
      getMergedOpus1MOption(fastMode),
      getSonnet46Option(),
      getSonnet46_1MOption(),
      getHaiku45Option(),
    ]
  }

  return getFreeOnlyModelOptions()
}

// @[MODEL LAUNCH]: Add the new model ID to the appropriate family pattern below
// so the "newer version available" hint works correctly.
/**
 * Map a full model name to its family alias and the marketing name of the
 * version the alias currently resolves to. Used to detect when a user has
 * a specific older version pinned and a newer one is available.
 */
function getModelFamilyInfo(
  model: string,
): { alias: string; currentVersionName: string } | null {
  const canonical = getCanonicalName(model)

  // Sonnet family
  if (
    canonical.includes('claude-sonnet-4-6') ||
    canonical.includes('claude-sonnet-4-5') ||
    canonical.includes('claude-sonnet-4-') ||
    canonical.includes('claude-3-7-sonnet') ||
    canonical.includes('claude-3-5-sonnet')
  ) {
    const currentName = getMarketingNameForModel(getDefaultSonnetModel())
    if (currentName) {
      return { alias: 'Sonnet', currentVersionName: currentName }
    }
  }

  // Opus family
  if (canonical.includes('claude-opus-4')) {
    const currentName = getMarketingNameForModel(getDefaultOpusModel())
    if (currentName) {
      return { alias: 'Opus', currentVersionName: currentName }
    }
  }

  // Haiku family
  if (
    canonical.includes('claude-haiku') ||
    canonical.includes('claude-3-5-haiku')
  ) {
    const currentName = getMarketingNameForModel(getDefaultHaikuModel())
    if (currentName) {
      return { alias: 'Haiku', currentVersionName: currentName }
    }
  }

  return null
}

/**
 * Returns a ModelOption for a known Anthropic model with a human-readable
 * label, and an upgrade hint if a newer version is available via the alias.
 * Returns null if the model is not recognized.
 */
function getKnownModelOption(model: string): ModelOption | null {
  const marketingName = getMarketingNameForModel(model)
  if (!marketingName) return null

  const familyInfo = getModelFamilyInfo(model)
  if (!familyInfo) {
    return {
      value: model,
      label: marketingName,
      description: model,
    }
  }

  // Check if the alias currently resolves to a different (newer) version
  if (marketingName !== familyInfo.currentVersionName) {
    return {
      value: model,
      label: marketingName,
      description: `Newer version available · select ${familyInfo.alias} for ${familyInfo.currentVersionName}`,
    }
  }

  // Same version as the alias — just show the friendly name
  return {
    value: model,
    label: marketingName,
    description: model,
  }
}

export function getModelOptions(fastMode = false): ModelOption[] {
  const options = getModelOptionsBase(fastMode)

  // Add the custom model from the ANTHROPIC_CUSTOM_MODEL_OPTION env var
  const envCustomModel = process.env.ANTHROPIC_CUSTOM_MODEL_OPTION
  if (
    envCustomModel &&
    !options.some(existing => existing.value === envCustomModel)
  ) {
    options.push({
      value: envCustomModel,
      label: process.env.ANTHROPIC_CUSTOM_MODEL_OPTION_NAME ?? envCustomModel,
      description:
        process.env.ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION ??
        `Custom model (${envCustomModel})`,
    })
  }

  // Append additional model options fetched during bootstrap
  for (const opt of getGlobalConfig().additionalModelOptionsCache ?? []) {
    if (!options.some(existing => existing.value === opt.value)) {
      options.push(opt)
    }
  }

  // Add custom model from either the current model value or the initial one
  // if it is not already in the options.
  let customModel: ModelSetting = null
  const currentMainLoopModel = getUserSpecifiedModelSetting()
  const initialMainLoopModel = getInitialMainLoopModel()
  if (currentMainLoopModel !== undefined && currentMainLoopModel !== null) {
    customModel = currentMainLoopModel
  } else if (initialMainLoopModel !== null) {
    customModel = initialMainLoopModel
  }
  if (customModel === null || options.some(opt => opt.value === customModel)) {
    return filterModelOptionsByAllowlist(options)
  } else if (
    process.env.BOTVALIA_FREE_ONLY_MODE === '1' &&
    !isSafeFreeOnlyModelSetting(customModel)
  ) {
    return filterModelOptionsByAllowlist(options)
  } else if (customModel === 'opusplan') {
    return filterModelOptionsByAllowlist([...options, getOpusPlanOption()])
  } else if (customModel === 'opus' && getAPIProvider() === 'firstParty') {
    return filterModelOptionsByAllowlist([
      ...options,
      getMaxOpusOption(fastMode),
    ])
  } else if (customModel === 'opus[1m]' && getAPIProvider() === 'firstParty') {
    return filterModelOptionsByAllowlist([
      ...options,
      getMergedOpus1MOption(fastMode),
    ])
  } else {
    // Try to show a human-readable label for known Anthropic models, with an
    // upgrade hint if the alias now resolves to a newer version.
    const knownOption = getKnownModelOption(customModel)
    if (knownOption) {
      options.push(knownOption)
    } else {
      options.push({
        value: customModel,
        label: customModel,
        description: 'Custom model',
      })
    }
    return filterModelOptionsByAllowlist(options)
  }
}

/**
 * Filter model options by the availableModels allowlist.
 * Always preserves the "Default" option (value: null).
 */
function filterModelOptionsByAllowlist(options: ModelOption[]): ModelOption[] {
  const settings = getSettings_DEPRECATED() || {}
  if (!settings.availableModels) {
    return options // No restrictions
  }
  return options.filter(
    opt =>
      opt.value === null || (opt.value !== null && isModelAllowed(opt.value)),
  )
}
