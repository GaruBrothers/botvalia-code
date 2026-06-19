export type OpenAIModel = {
  id: string
  object: 'model'
  created: number
  owned_by: string
}

export type OpenAIModelResponse = {
  object: 'list'
  data: OpenAIModel[]
}
