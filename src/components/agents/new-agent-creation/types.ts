import type { AgentMemoryScope } from '../../../tools/AgentTool/agentMemory.js'
import type {
  AgentColorName,
} from '../../../tools/AgentTool/agentColorManager.js'
import type {
  CustomAgentDefinition,
} from '../../../tools/AgentTool/loadAgentsDir.js'
import type { SettingSource } from '../../../utils/settings/constants.js'

export type GeneratedAgentDefinition = {
  identifier: string
  whenToUse: string
  systemPrompt: string
}

export type AgentWizardMethod = 'generate' | 'manual'

export type AgentWizardData = {
  location?: SettingSource
  method?: AgentWizardMethod
  generationPrompt?: string
  isGenerating?: boolean
  generatedAgent?: GeneratedAgentDefinition
  wasGenerated?: boolean
  agentType?: string
  systemPrompt?: string
  whenToUse?: string
  selectedTools?: string[]
  selectedModel?: string
  selectedColor?: AgentColorName
  selectedMemory?: AgentMemoryScope
  finalAgent?: CustomAgentDefinition
}
