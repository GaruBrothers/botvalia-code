import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname } from 'path'
import { EmbeddingService } from './EmbeddingService.js'

type VectorRecord = {
  messageId: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  embedding: number[]
}

type SearchResult = {
  messageId: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  similarity: number
}

export class VectorStoreService {
  private readonly embeddingService: EmbeddingService
  private readonly vectorStorePath: string
  private cache: VectorRecord[] | null = null

  constructor(embeddingService: EmbeddingService, vectorStorePath: string) {
    this.embeddingService = embeddingService
    this.vectorStorePath = vectorStorePath
  }

  private async load(): Promise<VectorRecord[]> {
    if (this.cache) {
      return this.cache
    }

    try {
      const raw = await readFile(this.vectorStorePath, 'utf-8')
      const parsed = JSON.parse(raw) as VectorRecord[]
      this.cache = Array.isArray(parsed) ? parsed : []
      return this.cache
    } catch {
      this.cache = []
      return this.cache
    }
  }

  private async save(records: VectorRecord[]): Promise<void> {
    await mkdir(dirname(this.vectorStorePath), { recursive: true })
    await writeFile(this.vectorStorePath, JSON.stringify(records), 'utf-8')
    this.cache = records
  }

  async add(record: Omit<VectorRecord, 'embedding'>): Promise<void> {
    const records = await this.load()
    if (records.some(item => item.messageId === record.messageId)) {
      return
    }

    const embedding = this.embeddingService.generateEmbedding(record.content)
    records.push({
      ...record,
      embedding,
    })
    await this.save(records)
  }

  async search(
    conversationId: string,
    query: string,
    topK: number,
  ): Promise<SearchResult[]> {
    const records = await this.load()
    const queryEmbedding = this.embeddingService.generateEmbedding(query)

    return records
      .filter(record => record.conversationId === conversationId)
      .map(record => ({
        messageId: record.messageId,
        role: record.role,
        content: record.content,
        timestamp: record.timestamp,
        similarity: this.embeddingService.cosineSimilarity(
          queryEmbedding,
          record.embedding,
        ),
      }))
      .filter(result => result.similarity > 0)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK)
  }
}

export type { SearchResult }
