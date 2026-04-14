const DEFAULT_EMBEDDING_DIMENSIONS = 256

function hashToken(token: string): number {
  // FNV-1a 32-bit
  let hash = 0x811c9dc5
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}_]+/u)
    .filter(token => token.length > 1)
}

function normalizeL2(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))
  if (magnitude === 0) {
    return vector
  }
  return vector.map(value => value / magnitude)
}

export class EmbeddingService {
  private readonly dimensions: number

  constructor(dimensions = DEFAULT_EMBEDDING_DIMENSIONS) {
    this.dimensions = dimensions
  }

  generateEmbedding(text: string): number[] {
    const vector = new Array(this.dimensions).fill(0)
    const tokens = tokenize(text)

    for (const token of tokens) {
      const hash = hashToken(token)
      const index = hash % this.dimensions
      const sign = hash % 2 === 0 ? 1 : -1
      vector[index] += sign
    }

    return normalizeL2(vector)
  }

  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0
    let dot = 0
    for (let i = 0; i < a.length; i++) {
      dot += a[i]! * b[i]!
    }
    return dot
  }
}
