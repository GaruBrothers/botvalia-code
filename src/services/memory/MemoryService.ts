import { randomUUID } from 'crypto'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import type { Message } from 'src/types/message.js'
import { extractTextContent, getContentText, isToolUseResultMessage } from 'src/utils/messages.js'
import { getCwd } from 'src/utils/cwd.js'
import { EmbeddingService } from './EmbeddingService.js'
import { type SearchResult, VectorStoreService } from './VectorStoreService.js'

type InteractionRecord = {
  messageId: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

type SummaryRecord = {
  conversationId: string
  summary: string
  upToIndexExclusive: number
  createdAt: string
}

type MemoryState = {
  seenMessageIds: string[]
  summarizedUntilByConversation: Record<string, number>
}

type MemoryContextPayload = {
  optimizedMessages: Message[]
  summaryText: string | null
  relevantMemories: SearchResult[]
}

const DEFAULT_SHORT_TERM_LIMIT = 10
const DEFAULT_SUMMARY_TRIGGER_MESSAGES = 40
const DEFAULT_SUMMARY_KEEP_RECENT = 14
const DEFAULT_RELEVANT_TOP_K = 5
const SYSTEM_MEMORY_PREFIX = '[BotValia Memory]'

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed
  }
  return fallback
}

function nowIso(): string {
  return new Date().toISOString()
}

function summarizeChunk(records: InteractionRecord[]): string {
  const userNotes = records
    .filter(record => record.role === 'user')
    .slice(-8)
    .map(record => `- Usuario: ${record.content.slice(0, 220)}`)
  const assistantNotes = records
    .filter(record => record.role === 'assistant')
    .slice(-8)
    .map(record => `- Asistente: ${record.content.slice(0, 220)}`)

  const lines = [
    'Resumen comprimido de conversación previa:',
    ...userNotes,
    ...assistantNotes,
  ]

  return lines.join('\n')
}

function asInformationalSystemMessage(content: string): Message {
  return {
    type: 'system',
    subtype: 'informational',
    content,
    uuid: randomUUID(),
    timestamp: nowIso(),
  } as Message
}

export class MemoryService {
  private readonly baseDir: string
  private readonly interactionsPath: string
  private readonly summariesPath: string
  private readonly statePath: string
  private readonly shortTermLimit: number
  private readonly summaryTriggerMessages: number
  private readonly summaryKeepRecent: number
  private readonly relevantTopK: number
  private readonly vectorStoreService: VectorStoreService
  private stateCache: MemoryState | null = null

  constructor(baseDir: string) {
    this.baseDir = baseDir
    this.interactionsPath = join(baseDir, 'interactions.json')
    this.summariesPath = join(baseDir, 'summaries.json')
    this.statePath = join(baseDir, 'state.json')
    this.shortTermLimit = parsePositiveInt(
      process.env.BOTVALIA_MEMORY_SHORT_TERM_LIMIT,
      DEFAULT_SHORT_TERM_LIMIT,
    )
    this.summaryTriggerMessages = parsePositiveInt(
      process.env.BOTVALIA_MEMORY_SUMMARY_TRIGGER,
      DEFAULT_SUMMARY_TRIGGER_MESSAGES,
    )
    this.summaryKeepRecent = parsePositiveInt(
      process.env.BOTVALIA_MEMORY_SUMMARY_KEEP_RECENT,
      DEFAULT_SUMMARY_KEEP_RECENT,
    )
    this.relevantTopK = parsePositiveInt(
      process.env.BOTVALIA_MEMORY_RELEVANT_TOP_K,
      DEFAULT_RELEVANT_TOP_K,
    )
    this.vectorStoreService = new VectorStoreService(
      new EmbeddingService(),
      join(baseDir, 'vectors.json'),
    )
  }

  private async ensureDir(): Promise<void> {
    await mkdir(this.baseDir, { recursive: true })
  }

  private async readJsonFile<T>(path: string, fallback: T): Promise<T> {
    try {
      const raw = await readFile(path, 'utf-8')
      return JSON.parse(raw) as T
    } catch {
      return fallback
    }
  }

  private async writeJsonFile(path: string, payload: unknown): Promise<void> {
    await this.ensureDir()
    await writeFile(path, JSON.stringify(payload), 'utf-8')
  }

  private async loadState(): Promise<MemoryState> {
    if (this.stateCache) return this.stateCache
    const loaded = await this.readJsonFile<MemoryState>(this.statePath, {
      seenMessageIds: [],
      summarizedUntilByConversation: {},
    })
    this.stateCache = loaded
    return loaded
  }

  private async saveState(state: MemoryState): Promise<void> {
    this.stateCache = state
    await this.writeJsonFile(this.statePath, state)
  }

  private async loadInteractions(): Promise<InteractionRecord[]> {
    return this.readJsonFile<InteractionRecord[]>(this.interactionsPath, [])
  }

  private async saveInteractions(records: InteractionRecord[]): Promise<void> {
    await this.writeJsonFile(this.interactionsPath, records)
  }

  private async loadSummaries(): Promise<SummaryRecord[]> {
    return this.readJsonFile<SummaryRecord[]>(this.summariesPath, [])
  }

  private async saveSummaries(records: SummaryRecord[]): Promise<void> {
    await this.writeJsonFile(this.summariesPath, records)
  }

  private extractMessageText(message: Message): string | null {
    if (message.type === 'user') {
      if (message.isMeta || isToolUseResultMessage(message)) {
        return null
      }
      return getContentText(message.message.content as never)
    }

    if (message.type === 'assistant') {
      const content = message.message?.content
      if (!Array.isArray(content)) {
        return null
      }
      const text = extractTextContent(
        content as readonly { readonly type: string }[],
        '\n',
      )
      return text || null
    }

    return null
  }

  async saveMessage(conversationId: string, message: Message): Promise<void> {
    const role =
      message.type === 'user'
        ? 'user'
        : message.type === 'assistant'
          ? 'assistant'
          : null
    if (!role) return

    const content = this.extractMessageText(message)
    if (!content || !content.trim()) return

    const messageId = message.uuid ?? randomUUID()
    const timestamp = message.timestamp ?? nowIso()
    const state = await this.loadState()
    if (state.seenMessageIds.includes(messageId)) {
      return
    }

    const interactions = await this.loadInteractions()
    interactions.push({
      messageId,
      conversationId,
      role,
      content,
      timestamp,
    })
    await this.saveInteractions(interactions)

    await this.vectorStoreService.add({
      messageId,
      conversationId,
      role,
      content,
      timestamp,
    })

    state.seenMessageIds.push(messageId)
    // Keep state bounded.
    if (state.seenMessageIds.length > 5000) {
      state.seenMessageIds = state.seenMessageIds.slice(-3000)
    }
    await this.saveState(state)
  }

  async getRelevantMemory(
    conversationId: string,
    query: string,
    topK = this.relevantTopK,
  ): Promise<SearchResult[]> {
    if (!query.trim()) return []
    return this.vectorStoreService.search(conversationId, query, topK)
  }

  async summarizeHistory(conversationId: string): Promise<string | null> {
    const interactions = (await this.loadInteractions()).filter(
      record => record.conversationId === conversationId,
    )

    if (interactions.length < this.summaryTriggerMessages) {
      return null
    }

    const state = await this.loadState()
    const summarizedUntil =
      state.summarizedUntilByConversation[conversationId] ?? 0
    const compressUntil = Math.max(0, interactions.length - this.summaryKeepRecent)

    if (compressUntil <= summarizedUntil + 4) {
      return null
    }

    const chunk = interactions.slice(summarizedUntil, compressUntil)
    if (chunk.length === 0) {
      return null
    }

    const summary = summarizeChunk(chunk)
    const summaries = await this.loadSummaries()
    summaries.push({
      conversationId,
      summary,
      upToIndexExclusive: compressUntil,
      createdAt: nowIso(),
    })
    await this.saveSummaries(summaries)

    state.summarizedUntilByConversation[conversationId] = compressUntil
    await this.saveState(state)

    return summary
  }

  async getLatestSummary(conversationId: string): Promise<string | null> {
    const summaries = await this.loadSummaries()
    const latest = [...summaries]
      .reverse()
      .find(item => item.conversationId === conversationId)
    return latest?.summary ?? null
  }

  private selectShortTermMessages(messages: Message[]): Message[] {
    const filtered = messages.filter(message => {
      if (message.type === 'user' && isToolUseResultMessage(message)) {
        return false
      }
      if (
        message.type === 'user' ||
        message.type === 'assistant' ||
        message.type === 'attachment'
      ) {
        return true
      }
      return false
    })
    return filtered.slice(-this.shortTermLimit)
  }

  private findLastUserQuery(messages: Message[]): string {
    const reversed = [...messages].reverse()
    for (const message of reversed) {
      if (message.type !== 'user') continue
      if (isToolUseResultMessage(message)) continue
      const text = getContentText(message.message.content as never)
      if (text && text.trim()) {
        return text
      }
    }
    return ''
  }

  async buildOptimizedContext(
    conversationId: string,
    fullMessages: Message[],
  ): Promise<MemoryContextPayload> {
    await this.summarizeHistory(conversationId)

    const latestSummary = await this.getLatestSummary(conversationId)
    const query = this.findLastUserQuery(fullMessages)
    const relevantMemories = await this.getRelevantMemory(conversationId, query)
    const shortTermMessages = this.selectShortTermMessages(fullMessages)

    const prefixMessages: Message[] = []
    if (latestSummary) {
      prefixMessages.push(
        asInformationalSystemMessage(
          `${SYSTEM_MEMORY_PREFIX} Resumen previo\n${latestSummary}`,
        ),
      )
    }
    if (relevantMemories.length > 0) {
      const lines = relevantMemories.map(
        (item, index) =>
          `${index + 1}. (${item.role}, sim=${item.similarity.toFixed(3)}) ${item.content.slice(0, 220)}`,
      )
      prefixMessages.push(
        asInformationalSystemMessage(
          `${SYSTEM_MEMORY_PREFIX} Memorias relevantes\n${lines.join('\n')}`,
        ),
      )
    }

    return {
      optimizedMessages: [...prefixMessages, ...shortTermMessages],
      summaryText: latestSummary,
      relevantMemories,
    }
  }

  // Spec compatibility aliases
  async SaveMessage(conversationId: string, message: Message): Promise<void> {
    await this.saveMessage(conversationId, message)
  }

  async GetRelevantMemory(
    conversationId: string,
    query: string,
    topK = this.relevantTopK,
  ): Promise<SearchResult[]> {
    return this.getRelevantMemory(conversationId, query, topK)
  }

  async SummarizeHistory(conversationId: string): Promise<string | null> {
    return this.summarizeHistory(conversationId)
  }
}

let memoryServiceSingleton: MemoryService | null = null

export function getMemoryService(): MemoryService {
  if (!memoryServiceSingleton) {
    memoryServiceSingleton = new MemoryService(
      join(getCwd(), '.botvalia', 'memory'),
    )
  }
  return memoryServiceSingleton
}
