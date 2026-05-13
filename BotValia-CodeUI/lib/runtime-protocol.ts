export type RuntimeSessionId = string;
export type RuntimeSessionChannel = 'cli' | 'web-ui';
export type RuntimeLeaseId = string;

export type RuntimeSessionStatus =
  | 'idle'
  | 'running'
  | 'requires_action'
  | 'completed'
  | 'interrupted'
  | 'errored';

export interface RuntimeTaskSummary {
  id: string;
  status: string;
  kind?: string;
  title?: string;
  isBackgrounded?: boolean;
  owner?: string;
  assigneeName?: string;
}

export interface RuntimeSwarmTeammateSummary {
  id: string;
  name: string;
  agentType?: string;
  color?: string;
  cwd?: string;
  worktreePath?: string;
  tmuxSessionName?: string;
  tmuxPaneId?: string;
}

export interface RuntimeSwarmSummary {
  teamName?: string;
  isLeader: boolean;
  teammateNames: string[];
  teammates: RuntimeSwarmTeammateSummary[];
}

export interface RuntimeThinkingSummary {
  messageUuid?: string;
  blockType?: 'thinking' | 'redacted_thinking';
  source:
    | 'sdk-stream'
    | 'sdk-message'
    | 'assistant-message'
    | 'message-result'
    | 'app-state'
    | 'session-runtime';
}

export interface RuntimeTaskUsageSummary {
  totalTokens?: number;
  toolUses?: number;
  durationMs?: number;
}

export interface RuntimeTaskEventPayload {
  task: RuntimeTaskSummary;
  source:
    | 'sdk-stream'
    | 'sdk-message'
    | 'assistant-message'
    | 'message-result'
    | 'app-state'
    | 'session-runtime';
  toolUseId?: string;
  workflowName?: string;
  prompt?: string;
  description?: string;
  summary?: string;
  progressText?: string;
  usage?: RuntimeTaskUsageSummary;
  lastToolName?: string;
}

export interface RuntimeToolEventPayload {
  toolUseId: string;
  toolName: string;
  source:
    | 'sdk-stream'
    | 'sdk-message'
    | 'assistant-message'
    | 'message-result'
    | 'app-state'
    | 'session-runtime';
  parentToolUseId?: string | null;
  taskId?: string;
  elapsedTimeSeconds?: number;
  summary?: string;
  inputPreview?: string;
  outputPreview?: string;
}

export interface RuntimeAgentEventPayload {
  kind:
    | 'task_started'
    | 'task_progress'
    | 'task_completed'
    | 'tool_started'
    | 'tool_completed'
    | 'updated';
  source:
    | 'sdk-stream'
    | 'sdk-message'
    | 'assistant-message'
    | 'message-result'
    | 'app-state'
    | 'session-runtime';
  agentId?: string;
  agentName?: string;
  taskId?: string;
  taskTitle?: string;
  detail?: string;
}

export interface RuntimeSwarmEventPayload {
  kind:
    | 'updated'
    | 'task_started'
    | 'task_progress'
    | 'task_completed'
    | 'tool_started'
    | 'tool_completed';
  source:
    | 'sdk-stream'
    | 'sdk-message'
    | 'assistant-message'
    | 'message-result'
    | 'app-state'
    | 'session-runtime';
  swarm: RuntimeSwarmSummary;
  taskId?: string;
  taskTitle?: string;
  toolUseId?: string;
  toolName?: string;
}

export interface RuntimeSessionChannelOwner {
  channel: RuntimeSessionChannel;
  clientId?: string;
  leaseId?: RuntimeLeaseId;
  claimedAt: string;
  leaseExpiresAt?: string;
  takeoverAt?: string;
}

export interface RuntimeSessionSnapshot {
  sessionId: RuntimeSessionId;
  cwd: string;
  title: string;
  isArchived: boolean;
  isPinned: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  status: RuntimeSessionStatus;
  hasLiveRuntime: boolean;
  activeChannel: RuntimeSessionChannel;
  activeChannelUpdatedAt: string;
  channelOwner: RuntimeSessionChannelOwner | null;
  leaseExpiresAt?: string;
  permissionMode:
    | 'default'
    | 'acceptEdits'
    | 'plan'
    | 'bypassPermissions'
    | 'dontAsk'
    | 'auto'
    | 'bubble';
  isBypassPermissionsModeAvailable: boolean;
  isAutoModeAvailable: boolean;
  messageCount: number;
  taskCount: number;
  mainLoopModel: string | null;
  mainLoopModelForSession: string | null;
  swarm: RuntimeSwarmSummary;
}

export type RuntimeMessageBlock =
  | {
      type: 'text' | 'markdown';
      text: string;
    }
  | {
      type: 'thinking' | 'redacted_thinking';
      text: string;
    }
  | {
      type: 'tool_use';
      toolUseId?: string;
      toolName?: string;
      text: string;
      inputPreview?: string;
    }
  | {
      type: 'tool_result';
      toolUseId?: string;
      text: string;
    }
  | {
      type: 'attachment_reference';
      attachmentType?: string;
      path?: string;
      text: string;
    }
  | {
      type: 'json';
      text: string;
    };

export interface RuntimeMessageSummary {
  uuid: string;
  timestamp: string;
  type: string;
  label: string;
  text: string;
  blocks: RuntimeMessageBlock[];
  isMeta?: boolean;
}

export interface RuntimeSessionEventRecord {
  id: string;
  timestamp: string;
  source: 'runtime' | 'service' | 'session-store';
  severity: 'info' | 'warn' | 'error';
  eventType: string;
  message: string;
}

export interface RuntimeModelOption {
  value: string | null;
  label: string;
  description: string;
}

export interface RuntimeSwarmThreadSummary {
  threadId: string;
  topic?: string;
  participants: string[];
  lastKind: string;
  lastAt: string;
  lastBody: string;
  priority: string;
  open: boolean;
  waitingOn?: {
    from: string;
    to: string;
    eventId: string;
  };
}

export interface RuntimeSwarmWaitingEdge {
  threadId: string;
  topic?: string;
  from: string;
  to: string;
  eventId: string;
  body: string;
  priority: string;
  createdAt: string;
}

export interface RuntimeSessionDetail {
  snapshot: RuntimeSessionSnapshot;
  messages: RuntimeMessageSummary[];
  tasks: RuntimeTaskSummary[];
  swarmThreads: RuntimeSwarmThreadSummary[];
  swarmWaitingEdges: RuntimeSwarmWaitingEdge[];
  events: RuntimeSessionEventRecord[];
}

export interface RuntimeSendMessageInput {
  text: string;
  uuid?: string;
  isMeta?: boolean;
  channel?: 'cli' | 'web-ui';
}

export type RuntimeProtocolRequest =
  | {
      requestId: string;
      method: 'list_sessions';
    }
  | {
      requestId: string;
      method: 'get_session';
      sessionId: RuntimeSessionId;
    }
  | {
      requestId: string;
      method: 'get_session_detail';
      sessionId: RuntimeSessionId;
    }
  | {
      requestId: string;
      method: 'create_session';
      title: string;
      cwd: string;
      notes?: string;
    }
  | {
      requestId: string;
      method: 'claim_session';
      sessionId: RuntimeSessionId;
      channel: RuntimeSessionChannel;
    }
  | {
      requestId: string;
      method: 'send_message';
      sessionId: RuntimeSessionId;
      leaseId?: string;
      input: RuntimeSendMessageInput;
    }
  | {
      requestId: string;
      method: 'interrupt';
      sessionId: RuntimeSessionId;
      leaseId?: string;
      channel?: RuntimeSessionChannel;
    }
  | {
      requestId: string;
      method: 'rename_session';
      sessionId: RuntimeSessionId;
      leaseId?: string;
      title: string;
    }
  | {
      requestId: string;
      method: 'archive_session';
      sessionId: RuntimeSessionId;
      leaseId?: string;
    }
  | {
      requestId: string;
      method: 'unarchive_session';
      sessionId: RuntimeSessionId;
      leaseId?: string;
    }
  | {
      requestId: string;
      method: 'pin_session';
      sessionId: RuntimeSessionId;
      leaseId?: string;
      pinned: boolean;
    }
  | {
      requestId: string;
      method: 'update_session_notes';
      sessionId: RuntimeSessionId;
      leaseId?: string;
      notes: string;
    }
  | {
      requestId: string;
      method: 'set_session_model';
      sessionId: RuntimeSessionId;
      leaseId?: string;
      model: string | null;
    }
  | {
      requestId: string;
      method: 'list_models';
    }
  | {
      requestId: string;
      method: 'get_session_events';
      sessionId: RuntimeSessionId;
    }
  | {
      requestId: string;
      method: 'set_permission_mode';
      sessionId: RuntimeSessionId;
      leaseId?: string;
      mode:
        | 'default'
        | 'acceptEdits'
        | 'plan'
        | 'bypassPermissions'
        | 'dontAsk'
        | 'auto'
        | 'bubble';
      channel?: RuntimeSessionChannel;
    }
  | {
      requestId: string;
      method: 'subscribe_runtime';
    }
  | {
      requestId: string;
      method: 'subscribe_session';
      sessionId: RuntimeSessionId;
    }
  | {
      requestId: string;
      method: 'unsubscribe';
      subscriptionId: string;
    };

export type RuntimeProtocolSuccessResponse =
  | {
      requestId: string;
      ok: true;
      method: 'list_sessions';
      sessions: RuntimeSessionSnapshot[];
    }
  | {
      requestId: string;
      ok: true;
      method: 'get_session';
      session: RuntimeSessionSnapshot | null;
    }
  | {
      requestId: string;
      ok: true;
      method: 'get_session_detail';
      detail: RuntimeSessionDetail | null;
    }
  | {
      requestId: string;
      ok: true;
      method: 'create_session';
      clientId: string;
      leaseId: string | null;
      leaseExpiresAt: string | null;
      session: RuntimeSessionSnapshot;
    }
  | {
      requestId: string;
      ok: true;
      method: 'claim_session';
      sessionId: RuntimeSessionId;
      clientId: string;
      leaseId: string | null;
      leaseExpiresAt: string | null;
      channel: RuntimeSessionChannel;
      snapshot: RuntimeSessionSnapshot;
    }
  | {
      requestId: string;
      ok: true;
      method: 'send_message';
      accepted: true;
      sessionId: RuntimeSessionId;
    }
  | {
      requestId: string;
      ok: true;
      method: 'archive_session' | 'unarchive_session';
      sessionId: RuntimeSessionId;
      archived: boolean;
      snapshot: RuntimeSessionSnapshot;
    }
  | {
      requestId: string;
      ok: true;
      method: 'pin_session';
      sessionId: RuntimeSessionId;
      pinned: boolean;
      snapshot: RuntimeSessionSnapshot;
    }
  | {
      requestId: string;
      ok: true;
      method: 'update_session_notes';
      sessionId: RuntimeSessionId;
      notes: string;
      snapshot: RuntimeSessionSnapshot;
    }
  | {
      requestId: string;
      ok: true;
      method: 'set_session_model';
      sessionId: RuntimeSessionId;
      model: string | null;
      snapshot: RuntimeSessionSnapshot;
    }
  | {
      requestId: string;
      ok: true;
      method: 'list_models';
      models: RuntimeModelOption[];
    }
  | {
      requestId: string;
      ok: true;
      method: 'get_session_events';
      sessionId: RuntimeSessionId;
      events: RuntimeSessionEventRecord[];
    }
  | {
      requestId: string;
      ok: true;
      method: 'interrupt';
      interrupted: true;
      sessionId: RuntimeSessionId;
      channel?: RuntimeSessionChannel;
    }
  | {
      requestId: string;
      ok: true;
      method: 'rename_session';
      renamed: true;
      sessionId: RuntimeSessionId;
      title: string;
    }
  | {
      requestId: string;
      ok: true;
      method: 'set_permission_mode';
      sessionId: RuntimeSessionId;
      mode:
        | 'default'
        | 'acceptEdits'
        | 'plan'
        | 'bypassPermissions'
        | 'dontAsk'
        | 'auto'
        | 'bubble';
      channel?: RuntimeSessionChannel;
    }
  | {
      requestId: string;
      ok: true;
      method: 'subscribe_runtime' | 'subscribe_session';
      clientId: string;
      subscriptionId: string;
    }
  | {
      requestId: string;
      ok: true;
      method: 'unsubscribe';
      unsubscribed: boolean;
      subscriptionId: string;
    };

export interface RuntimeProtocolErrorResponse {
  requestId: string;
  ok: false;
  code:
    | 'unauthorized'
    | 'lease_expired'
    | 'channel_conflict'
    | 'session_not_found'
    | 'runtime_unavailable'
    | 'validation_error';
  error: string;
}

export type RuntimeProtocolResponse =
  | RuntimeProtocolSuccessResponse
  | RuntimeProtocolErrorResponse;

export interface RuntimeRegistryEvent {
  type: 'registered' | 'unregistered' | 'runtime_event';
  sessionId: RuntimeSessionId;
  timestamp: string;
  snapshot?: RuntimeSessionSnapshot;
  event?: RuntimeEvent;
}

export interface RuntimeRawMessage {
  uuid: string;
  timestamp: string;
  type: string;
  subtype?: string;
  content?: string;
  message?: {
    content?: unknown;
  };
  attachment?: {
    type?: string;
    stdout?: string;
    stderr?: string;
    message?: string;
    command?: string;
  };
  data?: unknown;
  isMeta?: boolean;
}

export type RuntimeEvent =
  | {
      type: 'session_started' | 'session_updated';
      sessionId: RuntimeSessionId;
      snapshot: RuntimeSessionSnapshot;
      timestamp: string;
    }
  | {
      type: 'message_delta';
      sessionId: RuntimeSessionId;
      delta: string;
      timestamp: string;
    }
  | {
      type: 'thinking_started';
      sessionId: RuntimeSessionId;
      thinking: RuntimeThinkingSummary;
      timestamp: string;
    }
  | {
      type: 'thinking_delta';
      sessionId: RuntimeSessionId;
      delta: string;
      thinking: RuntimeThinkingSummary;
      timestamp: string;
    }
  | {
      type: 'thinking_completed';
      sessionId: RuntimeSessionId;
      thinking: RuntimeThinkingSummary;
      timestamp: string;
    }
  | {
      type: 'message_completed';
      sessionId: RuntimeSessionId;
      message: RuntimeRawMessage;
      timestamp: string;
    }
  | {
      type: 'task_updated';
      sessionId: RuntimeSessionId;
      task: RuntimeTaskSummary;
      source?:
        | 'sdk-stream'
        | 'sdk-message'
        | 'assistant-message'
        | 'message-result'
        | 'app-state'
        | 'session-runtime';
      timestamp: string;
    }
  | {
      type: 'task_started';
      sessionId: RuntimeSessionId;
      payload: RuntimeTaskEventPayload;
      timestamp: string;
    }
  | {
      type: 'task_progress';
      sessionId: RuntimeSessionId;
      payload: RuntimeTaskEventPayload;
      timestamp: string;
    }
  | {
      type: 'task_completed';
      sessionId: RuntimeSessionId;
      payload: RuntimeTaskEventPayload;
      timestamp: string;
    }
  | {
      type: 'tool_started';
      sessionId: RuntimeSessionId;
      payload: RuntimeToolEventPayload;
      timestamp: string;
    }
  | {
      type: 'tool_progress';
      sessionId: RuntimeSessionId;
      payload: RuntimeToolEventPayload;
      timestamp: string;
    }
  | {
      type: 'tool_completed';
      sessionId: RuntimeSessionId;
      payload: RuntimeToolEventPayload;
      timestamp: string;
    }
  | {
      type: 'swarm_updated';
      sessionId: RuntimeSessionId;
      swarm: RuntimeSwarmSummary;
      timestamp: string;
    }
  | {
      type: 'swarm_event';
      sessionId: RuntimeSessionId;
      payload: RuntimeSwarmEventPayload;
      timestamp: string;
    }
  | {
      type: 'agent_event';
      sessionId: RuntimeSessionId;
      payload: RuntimeAgentEventPayload;
      timestamp: string;
    }
  | {
      type: 'model_switched';
      sessionId: RuntimeSessionId;
      model: string;
      reason?: string;
      timestamp: string;
    }
  | {
      type: 'permission_mode_changed';
      sessionId: RuntimeSessionId;
      mode:
        | 'default'
        | 'acceptEdits'
        | 'plan'
        | 'bypassPermissions'
        | 'dontAsk'
        | 'auto'
        | 'bubble';
      timestamp: string;
    }
  | {
      type: 'interrupted';
      sessionId: RuntimeSessionId;
      timestamp: string;
    }
  | {
      type: 'error';
      sessionId: RuntimeSessionId;
      error: string;
      timestamp: string;
    };

export type RuntimeProtocolEvent =
  | {
      type: 'runtime_bootstrap';
      clientId: string;
      subscriptionId: string;
      sessions: RuntimeSessionSnapshot[];
      timestamp: string;
    }
  | {
      type: 'session_bootstrap';
      clientId: string;
      subscriptionId: string;
      session: RuntimeSessionSnapshot;
      timestamp: string;
    }
  | {
      type: 'runtime_registry_event';
      subscriptionId: string;
      event: RuntimeRegistryEvent;
      timestamp: string;
    }
  | {
      type: 'runtime_session_event';
      subscriptionId: string;
      sessionId: RuntimeSessionId;
      event: RuntimeEvent;
      timestamp: string;
    };

export type RuntimeProtocolMessage =
  | RuntimeProtocolResponse
  | RuntimeProtocolEvent;
