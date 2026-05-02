export type SessionStatus = 'idle' | 'running' | 'waiting' | 'error' | 'completed';
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

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

export interface SwarmState {
  activeTeam: string;
  teammates: SwarmTeammate[];
  tasks: AgentTask[];
  waitingOn?: string;
  internalChat: SwarmMessage[];
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  isHiddenInternally?: boolean; // Used to mock stripping out XML/Thinking
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
  model: string;
  messages: Message[];
  swarm?: SwarmState;
  events: EventLog[];
  startedAt: string;
  updatedAt: string;
  archived?: boolean;
}

export interface GlobalRuntimeState {
  isReady: boolean;
  isSocketConnected: boolean;
  autoRefresh: boolean;
}
