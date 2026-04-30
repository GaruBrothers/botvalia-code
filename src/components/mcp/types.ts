import type {
  ConfigScope,
  MCPServerConnection,
  McpClaudeAIProxyServerConfig,
  McpHTTPServerConfig,
  McpSSEServerConfig,
  McpStdioServerConfig,
} from '../../services/mcp/types.js'

type BaseServerInfo<
  TTransport extends string,
  TConfig,
> = {
  name: string
  client: MCPServerConnection
  scope: ConfigScope
  transport: TTransport
  config: TConfig
}

export type ClaudeAIServerInfo = BaseServerInfo<
  'claudeai-proxy',
  McpClaudeAIProxyServerConfig
> & {
  isAuthenticated: false
}

export type HTTPServerInfo = BaseServerInfo<'http', McpHTTPServerConfig> & {
  isAuthenticated?: boolean
}

export type SSEServerInfo = BaseServerInfo<'sse', McpSSEServerConfig> & {
  isAuthenticated?: boolean
}

export type StdioServerInfo = BaseServerInfo<'stdio', McpStdioServerConfig>

export type ServerInfo =
  | ClaudeAIServerInfo
  | HTTPServerInfo
  | SSEServerInfo
  | StdioServerInfo

type AgentServerBase<
  TTransport extends string,
  TExtras extends object = {},
> = {
  name: string
  transport: TTransport
  needsAuth: boolean
  sourceAgents: string[]
  isAuthenticated?: boolean
  url?: string
  command?: string
} & TExtras

export type AgentMcpServerInfo =
  | AgentServerBase<'stdio', {
      command: string
    }>
  | AgentServerBase<'sse', {
      url: string
    }>
  | AgentServerBase<'http', {
      url: string
    }>
  | AgentServerBase<'ws', {
      url: string
    }>

export type MCPViewState =
  | {
      type: 'list'
      defaultTab?: string
    }
  | {
      type: 'server-menu'
      server: ServerInfo
    }
  | {
      type: 'server-tools'
      server: ServerInfo
    }
  | {
      type: 'server-tool-detail'
      server: ServerInfo
      toolIndex: number
    }
  | {
      type: 'agent-server-menu'
      agentServer: AgentMcpServerInfo
    }
