import type {
  RuntimeSessionChannel,
  RuntimeProtocolEvent,
  RuntimeProtocolMessage,
  RuntimeProtocolRequest,
  RuntimeProtocolResponse,
  RuntimeSendMessageInput,
  RuntimeSessionDetail,
  RuntimeSessionId,
  RuntimeSessionSnapshot,
} from './runtime-protocol';
import type { PermissionMode } from './types';
import { normalizeRuntimeUrl, withRuntimeAuthToken } from './runtime-url';

type PendingRequest = {
  resolve: (value: RuntimeProtocolResponse) => void;
  reject: (error: Error) => void;
  cleanup: () => void;
};

type RuntimeProtocolEventListener = (event: RuntimeProtocolEvent) => void;
type RuntimeConnectionListener = (connected: boolean) => void;
type RuntimeProtocolRequestInput = RuntimeProtocolRequest extends infer Request
  ? Request extends { requestId: string }
    ? Omit<Request, 'requestId'>
    : never
  : never;

function isProtocolResponse(
  value: RuntimeProtocolMessage,
): value is RuntimeProtocolResponse {
  return 'requestId' in value;
}

const RUNTIME_REQUEST_TIMEOUT_MS = 20_000;

export type BrowserRuntimeClientConfig = {
  authToken?: string | null;
};

export class BrowserRuntimeClient {
  private readonly url: string;
  private socket: WebSocket | null = null;
  private readonly listeners = new Set<RuntimeProtocolEventListener>();
  private readonly connectionListeners = new Set<RuntimeConnectionListener>();
  private readonly pending = new Map<string, PendingRequest>();

  constructor(url: string, config: BrowserRuntimeClientConfig = {}) {
    const normalizedUrl = normalizeRuntimeUrl(url);
    if (!normalizedUrl) {
      throw new Error('La URL runtime debe usar ws:// o wss://.');
    }

    this.url = withRuntimeAuthToken(normalizedUrl, config.authToken) || normalizedUrl;
  }

  async connect(): Promise<void> {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return;
    }

    const socket = new WebSocket(this.url);
    this.socket = socket;

    socket.addEventListener('open', () => {
      this.emitConnectionChange(true);
    });

    socket.addEventListener('message', event => {
      const parsed = JSON.parse(event.data as string) as RuntimeProtocolMessage;

      if (isProtocolResponse(parsed)) {
        const pending = this.pending.get(parsed.requestId);
        if (!pending) {
          return;
        }

        this.pending.delete(parsed.requestId);
        pending.cleanup();
        pending.resolve(parsed);
        return;
      }

      for (const listener of this.listeners) {
        listener(parsed);
      }
    });

    socket.addEventListener('close', () => {
      this.emitConnectionChange(false);
      for (const [requestId, pending] of this.pending.entries()) {
        this.pending.delete(requestId);
        pending.cleanup();
        pending.reject(new Error('La conexión runtime WebSocket fue cerrada.'));
      }
    });

    socket.addEventListener('error', () => {
      this.emitConnectionChange(false);
      for (const [requestId, pending] of this.pending.entries()) {
        this.pending.delete(requestId);
        pending.cleanup();
        pending.reject(new Error('Ocurrió un error en la conexión runtime WebSocket.'));
      }
    });

    await new Promise<void>((resolvePromise, rejectPromise) => {
      socket.addEventListener('open', () => resolvePromise(), { once: true });
      socket.addEventListener(
        'error',
        () => rejectPromise(new Error('No pude abrir el WebSocket del runtime.')),
        { once: true },
      );
    });
  }

  onEvent(listener: RuntimeProtocolEventListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  onConnectionChange(listener: RuntimeConnectionListener): () => void {
    this.connectionListeners.add(listener);

    return () => {
      this.connectionListeners.delete(listener);
    };
  }

  private emitConnectionChange(connected: boolean): void {
    for (const listener of this.connectionListeners) {
      listener(connected);
    }
  }

  private async sendRequest(
    request: RuntimeProtocolRequestInput,
  ): Promise<RuntimeProtocolResponse> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('El cliente runtime WebSocket no está conectado.');
    }

    const requestId = crypto.randomUUID();
    const fullRequest = {
      requestId,
      ...request,
    } as RuntimeProtocolRequest;

    const responsePromise = new Promise<RuntimeProtocolResponse>(
      (resolvePromise, rejectPromise) => {
        const timeoutId = window.setTimeout(() => {
          this.pending.delete(requestId);
          rejectPromise(
            new Error('El runtime tardó demasiado en responder a la solicitud.'),
          );
        }, RUNTIME_REQUEST_TIMEOUT_MS);

        this.pending.set(requestId, {
          resolve: resolvePromise,
          reject: rejectPromise,
          cleanup: () => window.clearTimeout(timeoutId),
        });
      },
    );

    this.socket.send(JSON.stringify(fullRequest));
    return responsePromise;
  }

  async listSessions(): Promise<RuntimeSessionSnapshot[]> {
    const response = await this.sendRequest({
      method: 'list_sessions',
    });

    if (!response.ok) {
      throw new Error(response.error);
    }
    if (response.method !== 'list_sessions') {
      throw new Error('La respuesta runtime no coincide con list_sessions.');
    }

    return response.sessions;
  }

  async getSessionDetail(
    sessionId: RuntimeSessionId,
  ): Promise<RuntimeSessionDetail | null> {
    const response = await this.sendRequest({
      method: 'get_session_detail',
      sessionId,
    });

    if (!response.ok) {
      throw new Error(response.error);
    }
    if (response.method !== 'get_session_detail') {
      throw new Error('La respuesta runtime no coincide con get_session_detail.');
    }

    return response.detail;
  }

  async sendMessage(
    sessionId: RuntimeSessionId,
    input: RuntimeSendMessageInput,
  ): Promise<void> {
    const response = await this.sendRequest({
      method: 'send_message',
      sessionId,
      input,
    });

    if (!response.ok) {
      throw new Error(response.error);
    }
    if (response.method !== 'send_message') {
      throw new Error('La respuesta runtime no coincide con send_message.');
    }
  }

  async claimSession(
    sessionId: RuntimeSessionId,
    channel: RuntimeSessionChannel,
  ): Promise<RuntimeSessionSnapshot> {
    const response = await this.sendRequest({
      method: 'claim_session',
      sessionId,
      channel,
    });

    if (!response.ok) {
      throw new Error(response.error);
    }
    if (response.method !== 'claim_session') {
      throw new Error('La respuesta runtime no coincide con claim_session.');
    }

    return response.snapshot;
  }

  async interrupt(
    sessionId: RuntimeSessionId,
    channel?: RuntimeSessionChannel,
  ): Promise<void> {
    const response = await this.sendRequest({
      method: 'interrupt',
      sessionId,
      channel,
    });

    if (!response.ok) {
      throw new Error(response.error);
    }
    if (response.method !== 'interrupt') {
      throw new Error('La respuesta runtime no coincide con interrupt.');
    }
  }

  async renameSession(sessionId: RuntimeSessionId, title: string): Promise<string> {
    const response = await this.sendRequest({
      method: 'rename_session',
      sessionId,
      title,
    });

    if (!response.ok) {
      throw new Error(response.error);
    }
    if (response.method !== 'rename_session') {
      throw new Error('La respuesta runtime no coincide con rename_session.');
    }

    return response.title;
  }

  async setPermissionMode(
    sessionId: RuntimeSessionId,
    mode: PermissionMode,
    channel?: RuntimeSessionChannel,
  ): Promise<PermissionMode> {
    const response = await this.sendRequest({
      method: 'set_permission_mode',
      sessionId,
      mode,
      channel,
    });

    if (!response.ok) {
      throw new Error(response.error);
    }
    if (response.method !== 'set_permission_mode') {
      throw new Error(
        'La respuesta runtime no coincide con set_permission_mode.',
      );
    }

    return response.mode;
  }

  async subscribeRuntime(): Promise<string> {
    const response = await this.sendRequest({
      method: 'subscribe_runtime',
    });

    if (!response.ok) {
      throw new Error(response.error);
    }
    if (response.method !== 'subscribe_runtime') {
      throw new Error('La respuesta runtime no coincide con subscribe_runtime.');
    }

    return response.subscriptionId;
  }

  async subscribeSession(sessionId: RuntimeSessionId): Promise<string> {
    const response = await this.sendRequest({
      method: 'subscribe_session',
      sessionId,
    });

    if (!response.ok) {
      throw new Error(response.error);
    }
    if (response.method !== 'subscribe_session') {
      throw new Error('La respuesta runtime no coincide con subscribe_session.');
    }

    return response.subscriptionId;
  }

  async unsubscribe(subscriptionId: string): Promise<boolean> {
    const response = await this.sendRequest({
      method: 'unsubscribe',
      subscriptionId,
    });

    if (!response.ok) {
      throw new Error(response.error);
    }
    if (response.method !== 'unsubscribe') {
      throw new Error('La respuesta runtime no coincide con unsubscribe.');
    }

    return response.unsubscribed;
  }

  async close(): Promise<void> {
    if (!this.socket) {
      return;
    }

    const socket = this.socket;
    this.socket = null;

    await new Promise<void>(resolvePromise => {
      socket.addEventListener('close', () => resolvePromise(), { once: true });
      socket.close();
    });
  }
}
