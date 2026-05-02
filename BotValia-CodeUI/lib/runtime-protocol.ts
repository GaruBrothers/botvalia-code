export type RuntimeSessionId = string;

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
}

export interface RuntimeSwarmSummary {
  teamName?: string;
  isLeader: boolean;
  teammateNames: string[];
}

export interface RuntimeSessionSnapshot {
  sessionId: RuntimeSessionId;
  cwd: string;
  status: RuntimeSessionStatus;
  messageCount: number;
  taskCount: number;
  mainLoopModel: string | null;
  mainLoopModelForSession: string | null;
  swarm: RuntimeSwarmSummary;
}

export interface RuntimeMessageSummary {
  uuid: string;
  timestamp: string;
  type: string;
  label: string;
  text: string;
  isMeta?: boolean;
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
      method: 'send_message';
      sessionId: RuntimeSessionId;
      input: RuntimeSendMessageInput;
    }
  | {
      requestId: string;
      method: 'interrupt';
      sessionId: RuntimeSessionId;
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
      method: 'send_message';
      accepted: true;
      sessionId: RuntimeSessionId;
    }
  | {
      requestId: string;
      ok: true;
      method: 'interrupt';
      interrupted: true;
      sessionId: RuntimeSessionId;
    }
  | {
      requestId: string;
      ok: true;
      method: 'subscribe_runtime' | 'subscribe_session';
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
      type: 'message_completed';
      sessionId: RuntimeSessionId;
      message: RuntimeRawMessage;
      timestamp: string;
    }
  | {
      type: 'task_updated';
      sessionId: RuntimeSessionId;
      task: RuntimeTaskSummary;
      timestamp: string;
    }
  | {
      type: 'swarm_updated';
      sessionId: RuntimeSessionId;
      swarm: RuntimeSwarmSummary;
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
      subscriptionId: string;
      sessions: RuntimeSessionSnapshot[];
      timestamp: string;
    }
  | {
      type: 'session_bootstrap';
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
