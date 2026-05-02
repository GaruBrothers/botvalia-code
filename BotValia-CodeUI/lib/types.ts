export type SessionStatus = 'idle' | 'running' | 'waiting' | 'error' | 'completed';
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';
export type ConnectionState = 'missing' | 'connecting' | 'connected' | 'error';
export type PermissionMode =
  | 'default'
  | 'acceptEdits'
  | 'plan'
  | 'bypassPermissions'
  | 'dontAsk'
  | 'auto'
  | 'bubble';

export interface AgentTask {
  id: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  assigneeId?: string;
}

export interface SwarmMessage {
  id: string;
  fromId: string;
  fromName: string;
  toId?: string;
  toName?: string;
  content: string;
  timestamp: string;
}

export interface SwarmTeammate {
  id: string;
  name: string;
  role: string;
  status: 'idle' | 'working' | 'speaking';
  avatarColor?: string;
  currentTask?: string;
}

export interface SwarmThread {
  id: string;
  topic?: string;
  participants: string[];
  lastKind: string;
  lastAt: string;
  lastBody: string;
  open: boolean;
}

export interface SwarmWaitingEdge {
  id: string;
  threadId: string;
  topic?: string;
  from: string;
  to: string;
  body: string;
  createdAt: string;
}

export interface SwarmState {
  activeTeam: string;
  teammates: SwarmTeammate[];
  tasks: AgentTask[];
  waitingOn?: string;
  internalChat: SwarmMessage[];
  threads: SwarmThread[];
  waitingEdges: SwarmWaitingEdge[];
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  isHiddenInternally?: boolean; // Used to mock stripping out XML/Thinking
  isPending?: boolean;
  isEphemeral?: boolean;
  label?: string;
  streamKind?: 'thinking' | 'response';
}

export interface EventLog {
  id: string;
  timestamp: string;
  type: 'info' | 'warn' | 'error';
  message: string;
}

export interface Session {
  id: string;
  shortId: string;
  projectName: string;
  title?: string;
  workspaceName: string;
  status: SessionStatus;
  permissionMode: PermissionMode;
  isBypassPermissionsModeAvailable: boolean;
  isAutoModeAvailable: boolean;
  model: string;
  messages: Message[];
  swarm?: SwarmState;
  events: EventLog[];
  startedAt: string;
  updatedAt: string;
  archived?: boolean;
  messageCount: number;
  taskCount: number;
  rawSnapshot?: unknown;
  rawDetail?: unknown;
}

export interface GlobalRuntimeState {
  isReady: boolean;
  isSocketConnected: boolean;
  autoRefresh: boolean;
  runtimeUrl?: string;
  connectionState: ConnectionState;
  lastError?: string;
}
