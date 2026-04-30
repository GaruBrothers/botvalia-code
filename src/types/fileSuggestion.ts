export type FileSuggestion = {
  path: string
  score?: number
}

export type FileSuggestionCommandInput = {
  query: string
  [key: string]: unknown
}
