export type NotebookCellType = 'code' | 'markdown' | 'raw'

export type NotebookOutputImage = {
  image_data: string
  media_type: 'image/png' | 'image/jpeg'
}

export type NotebookCellOutput =
  | {
      output_type: 'stream'
      text?: string | string[]
      name?: string
    }
  | {
      output_type: 'execute_result' | 'display_data'
      data?: Record<string, unknown>
      metadata?: Record<string, unknown>
    }
  | {
      output_type: 'error'
      ename: string
      evalue: string
      traceback: string[]
    }

export type NotebookCell = {
  cell_type: NotebookCellType
  source: string | string[]
  id?: string
  execution_count?: number | null
  outputs?: NotebookCellOutput[]
  metadata?: Record<string, unknown>
}

export type NotebookCellSourceOutput = {
  output_type: 'stream' | 'execute_result' | 'display_data' | 'error'
  text?: string
  image?: NotebookOutputImage
}

export type NotebookCellSource = {
  cellType: NotebookCellType
  source: string
  execution_count?: number
  cell_id: string
  language?: string
  outputs?: (NotebookCellSourceOutput | undefined)[]
}

export type NotebookContent = {
  cells: NotebookCell[]
  metadata: {
    language_info?: {
      name?: string
    }
    [key: string]: unknown
  }
  nbformat?: number
  nbformat_minor?: number
}
