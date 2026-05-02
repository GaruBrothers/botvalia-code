'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRuntimeClient } from '@/lib/runtime-client';
import {
  appendOptimisticMessage,
  applyRuntimeRegistryEvent,
  applyRuntimeSessionEvent,
  mergeDetailIntoSessions,
  mergeSnapshotsIntoSessions,
} from '@/lib/runtime-mappers';
import type { RuntimeProtocolEvent } from '@/lib/runtime-protocol';
import type { GlobalRuntimeState, Session } from '@/lib/types';

type NoticeKind = 'info' | 'warn' | 'error';

export interface RuntimeNotice {
  id: string;
  kind: NoticeKind;
  message: string;
}

type UseRuntimeInspectorResult = {
  globalState: GlobalRuntimeState;
  sessions: Session[];
  selectedSessionId: string | null;
  selectedSession: Session | null;
  notice: RuntimeNotice | null;
  isRefreshing: boolean;
  setSelectedSessionId: (sessionId: string | null) => void;
  reconnect: () => Promise<void>;
  refresh: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  interrupt: () => Promise<void>;
  toggleAutoRefresh: () => void;
  dismissNotice: () => void;
  reportPendingFeature: (feature: string) => void;
};

const AUTO_REFRESH_STORAGE_KEY = 'botvalia.runtime.autoRefresh';
const RUNTIME_URL_STORAGE_KEY = 'botvalia.runtime.url';

function readInitialRuntimeConfig(): {
  autoRefresh: boolean;
  runtimeUrl: string | null;
} {
  if (typeof window === 'undefined') {
    return {
      autoRefresh: true,
      runtimeUrl: null,
    };
  }

  const searchParams = new URLSearchParams(window.location.search);
  const runtimeFromQuery = searchParams.get('runtime')?.trim() || null;
  const runtimeFromStorage = window.localStorage.getItem(RUNTIME_URL_STORAGE_KEY);

  return {
    autoRefresh: window.localStorage.getItem(AUTO_REFRESH_STORAGE_KEY) !== 'false',
    runtimeUrl: runtimeFromQuery || runtimeFromStorage || null,
  };
}

export function useRuntimeInspector(): UseRuntimeInspectorResult {
  const [initialRuntimeConfig] = useState(readInitialRuntimeConfig);
  const [globalState, setGlobalState] = useState<GlobalRuntimeState>(() => ({
    isReady: false,
    isSocketConnected: false,
    autoRefresh: initialRuntimeConfig.autoRefresh,
    runtimeUrl: initialRuntimeConfig.runtimeUrl || undefined,
    connectionState: initialRuntimeConfig.runtimeUrl ? 'connecting' : 'missing',
    lastError: initialRuntimeConfig.runtimeUrl
      ? undefined
      : 'Falta la URL runtime en la pantalla actual.',
  }));
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionIdState] = useState<string | null>(null);
  const [notice, setNotice] = useState<RuntimeNotice | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [connectionVersion, setConnectionVersion] = useState(0);

  const clientRef = useRef<BrowserRuntimeClient | null>(null);
  const runtimeSubscriptionIdRef = useRef<string | null>(null);
  const sessionSubscriptionIdRef = useRef<string | null>(null);
  const selectedSessionIdRef = useRef<string | null>(null);
  const runtimeUrlRef = useRef<string | null>(initialRuntimeConfig.runtimeUrl);
  const sessionRefreshTimerRef = useRef<number | null>(null);
  const eventUnsubscribeRef = useRef<(() => void) | null>(null);
  const connectionUnsubscribeRef = useRef<(() => void) | null>(null);
  const handleProtocolEventRef = useRef<(event: RuntimeProtocolEvent) => void>(() => {});

  const selectedSession = useMemo(
    () => sessions.find(session => session.id === selectedSessionId) || null,
    [sessions, selectedSessionId],
  );

  const pushNotice = (kind: NoticeKind, message: string) => {
    setNotice({
      id: crypto.randomUUID(),
      kind,
      message,
    });
  };

  const setRuntimeError = (message: string) => {
    setGlobalState(previous => ({
      ...previous,
      isReady: false,
      isSocketConnected: false,
      connectionState: 'error',
      lastError: message,
    }));
    pushNotice('error', message);
  };

  const reportError = (error: unknown, fallbackMessage: string) => {
    setRuntimeError(error instanceof Error ? error.message : fallbackMessage);
  };

  const clearPendingSessionRefresh = () => {
    if (sessionRefreshTimerRef.current !== null) {
      window.clearTimeout(sessionRefreshTimerRef.current);
      sessionRefreshTimerRef.current = null;
    }
  };

  const loadSessionDetail = async (
    sessionId: string | null,
    client: BrowserRuntimeClient | null = clientRef.current,
  ): Promise<void> => {
    if (!client || !sessionId) {
      return;
    }

    const detail = await client.getSessionDetail(sessionId);
    if (!detail) {
      return;
    }

    setSessions(previous => mergeDetailIntoSessions(previous, detail));
  };

  const scheduleSessionDetailRefresh = (sessionId: string | null) => {
    if (!sessionId) {
      return;
    }

    clearPendingSessionRefresh();
    sessionRefreshTimerRef.current = window.setTimeout(() => {
      void loadSessionDetail(sessionId).catch(error => {
        setRuntimeError(
          error instanceof Error
            ? error.message
            : 'No pude refrescar el detalle de la sesión.',
        );
      });
    }, 250);
  };

  const disconnectClient = async () => {
    clearPendingSessionRefresh();

    const client = clientRef.current;
    clientRef.current = null;

    eventUnsubscribeRef.current?.();
    eventUnsubscribeRef.current = null;
    connectionUnsubscribeRef.current?.();
    connectionUnsubscribeRef.current = null;

    if (client && sessionSubscriptionIdRef.current) {
      try {
        await client.unsubscribe(sessionSubscriptionIdRef.current);
      } catch {
        // ignore unsubscribe failures during shutdown
      }
    }
    sessionSubscriptionIdRef.current = null;

    if (client && runtimeSubscriptionIdRef.current) {
      try {
        await client.unsubscribe(runtimeSubscriptionIdRef.current);
      } catch {
        // ignore unsubscribe failures during shutdown
      }
    }
    runtimeSubscriptionIdRef.current = null;

    if (client) {
      try {
        await client.close();
      } catch {
        // ignore close failures; a reconnect will recreate the socket
      }
    }
  };

  const refresh = async (client: BrowserRuntimeClient | null = clientRef.current) => {
    if (!client) {
      return;
    }

    setIsRefreshing(true);
    try {
      const snapshots = await client.listSessions();
      let nextSelectedId: string | null = null;

      setSessions(previous => mergeSnapshotsIntoSessions(previous, snapshots));
      setSelectedSessionIdState(previousSelectedId => {
        if (snapshots.length === 0) {
          nextSelectedId = null;
          return null;
        }

        if (
          previousSelectedId &&
          snapshots.some(snapshot => snapshot.sessionId === previousSelectedId)
        ) {
          nextSelectedId = previousSelectedId;
          return previousSelectedId;
        }

        nextSelectedId = snapshots[0].sessionId;
        return nextSelectedId;
      });

      if (nextSelectedId) {
        await loadSessionDetail(nextSelectedId, client);
      }

      setGlobalState(previous => ({
        ...previous,
        isReady: true,
        isSocketConnected: true,
        connectionState: 'connected',
        lastError: undefined,
      }));
    } finally {
      setIsRefreshing(false);
    }
  };

  const connect = async () => {
    const runtimeUrl = runtimeUrlRef.current;
    if (!runtimeUrl) {
      setGlobalState(previous => ({
        ...previous,
        runtimeUrl: undefined,
        isReady: false,
        isSocketConnected: false,
        connectionState: 'missing',
        lastError: 'Falta la URL runtime en la UI.',
      }));
      pushNotice(
        'error',
        'Falta la URL runtime. Abre esta pantalla desde /runtime open para conectarla al CLI.',
      );
      return;
    }

    await disconnectClient();
    setGlobalState(previous => ({
      ...previous,
      runtimeUrl,
      isReady: false,
      isSocketConnected: false,
      connectionState: 'connecting',
      lastError: undefined,
    }));

    const client = new BrowserRuntimeClient(runtimeUrl);
    clientRef.current = client;
    eventUnsubscribeRef.current = client.onEvent(event => {
      handleProtocolEventRef.current(event);
    });
    connectionUnsubscribeRef.current = client.onConnectionChange(connected => {
      setGlobalState(previous => ({
        ...previous,
        isSocketConnected: connected,
        connectionState: connected ? 'connected' : 'error',
      }));
    });

    try {
      await client.connect();
      runtimeSubscriptionIdRef.current = await client.subscribeRuntime();
      await refresh(client);
      setConnectionVersion(previous => previous + 1);
    } catch (error) {
      await disconnectClient();
      throw error;
    }
  };

  useEffect(() => {
    selectedSessionIdRef.current = selectedSessionId;
  }, [selectedSessionId]);

  useEffect(() => {
    handleProtocolEventRef.current = event => {
      if (event.type === 'runtime_bootstrap') {
        setSessions(previous => mergeSnapshotsIntoSessions(previous, event.sessions, event.timestamp));
        setSelectedSessionIdState(previousSelectedId => {
          if (event.sessions.length === 0) {
            return null;
          }

          if (
            previousSelectedId &&
            event.sessions.some(session => session.sessionId === previousSelectedId)
          ) {
            return previousSelectedId;
          }

          return event.sessions[0].sessionId;
        });
        return;
      }

      if (event.type === 'session_bootstrap') {
        setSessions(previous =>
          mergeSnapshotsIntoSessions(previous, [event.session], event.timestamp),
        );
        return;
      }

      if (event.type === 'runtime_registry_event') {
        setSessions(previous => applyRuntimeRegistryEvent(previous, event.event));
        if (selectedSessionIdRef.current === event.event.sessionId) {
          scheduleSessionDetailRefresh(event.event.sessionId);
        }
        return;
      }

      setSessions(previous =>
        applyRuntimeSessionEvent(previous, event.sessionId, event.event),
      );

      if (event.sessionId === selectedSessionIdRef.current && event.event.type !== 'message_delta') {
        scheduleSessionDetailRefresh(event.sessionId);
      }
    };
  });

  useEffect(() => {
    const dismissTimer = notice
      ? window.setTimeout(() => {
          setNotice(currentNotice =>
            currentNotice?.id === notice.id ? null : currentNotice,
          );
        }, 4000)
      : null;

    return () => {
      if (dismissTimer) {
        window.clearTimeout(dismissTimer);
      }
    };
  }, [notice]);

  useEffect(() => {
    if (initialRuntimeConfig.runtimeUrl) {
      window.localStorage.setItem(RUNTIME_URL_STORAGE_KEY, initialRuntimeConfig.runtimeUrl);
    }
  }, [initialRuntimeConfig.runtimeUrl]);

  useEffect(() => {
    void connect().catch(error => {
      reportError(error, 'No pude conectar la UI al runtime.');
    });

    return () => {
      void disconnectClient();
    };
    // We intentionally bootstrap the runtime connection once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!clientRef.current || !selectedSessionId || connectionVersion === 0) {
      return;
    }

    let cancelled = false;

    const subscribeToSession = async () => {
      const client = clientRef.current;
      if (!client || !selectedSessionId) {
        return;
      }

      if (sessionSubscriptionIdRef.current) {
        try {
          await client.unsubscribe(sessionSubscriptionIdRef.current);
        } catch {
          // ignore resubscribe cleanup failures
        }
        sessionSubscriptionIdRef.current = null;
      }

      const subscriptionId = await client.subscribeSession(selectedSessionId);
      if (cancelled) {
        try {
          await client.unsubscribe(subscriptionId);
        } catch {
          // ignore if the component already moved on
        }
        return;
      }

      sessionSubscriptionIdRef.current = subscriptionId;
      await loadSessionDetail(selectedSessionId, client);
    };

    void subscribeToSession().catch(error => {
      reportError(error, 'No pude suscribirme a la sesión seleccionada.');
    });

    return () => {
      cancelled = true;
    };
    // The session subscription lifecycle is keyed only by connection and selected session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionVersion, selectedSessionId]);

  useEffect(() => {
    if (!globalState.autoRefresh || connectionVersion === 0) {
      return;
    }

    const timer = window.setInterval(() => {
      void refresh().catch(error => {
        reportError(error, 'No pude refrescar las sesiones del runtime.');
      });
    }, 8_000);

    return () => window.clearInterval(timer);
    // The periodic refresh intentionally follows the current autoRefresh/connection state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionVersion, globalState.autoRefresh]);

  const sendMessage = async (text: string) => {
    const client = clientRef.current;
    const sessionId = selectedSessionIdRef.current;
    if (!client || !sessionId) {
      pushNotice('warn', 'Selecciona una sesión activa antes de enviar un mensaje.');
      return;
    }

    setSessions(previous => appendOptimisticMessage(previous, sessionId, text));

    try {
      await client.sendMessage(sessionId, {
        text,
        channel: 'web-ui',
      });
      scheduleSessionDetailRefresh(sessionId);
    } catch (error) {
      await refresh(client);
      setRuntimeError(
        error instanceof Error ? error.message : 'No pude enviar el mensaje al runtime.',
      );
    }
  };

  const interrupt = async () => {
    const client = clientRef.current;
    const sessionId = selectedSessionIdRef.current;
    if (!client || !sessionId) {
      return;
    }

    try {
      await client.interrupt(sessionId);
      scheduleSessionDetailRefresh(sessionId);
    } catch (error) {
      setRuntimeError(
        error instanceof Error
          ? error.message
          : 'No pude interrumpir la sesión actual.',
      );
    }
  };

  const toggleAutoRefresh = () => {
    setGlobalState(previous => {
      const nextValue = !previous.autoRefresh;
      window.localStorage.setItem(
        AUTO_REFRESH_STORAGE_KEY,
        nextValue ? 'true' : 'false',
      );
      return {
        ...previous,
        autoRefresh: nextValue,
      };
    });
  };

  const reportPendingFeature = (feature: string) => {
    pushNotice(
      'warn',
      `${feature} todavía depende de backend/runtime. Ya quedó mapeado en ROADMAP.md para fases siguientes.`,
    );
  };

  return {
    globalState,
    sessions,
    selectedSessionId,
    selectedSession,
    notice,
    isRefreshing,
    setSelectedSessionId: setSelectedSessionIdState,
    reconnect: connect,
    refresh: async () => {
      try {
        await refresh();
      } catch (error) {
        setRuntimeError(
          error instanceof Error ? error.message : 'No pude refrescar el runtime.',
        );
      }
    },
    sendMessage,
    interrupt,
    toggleAutoRefresh,
    dismissNotice: () => setNotice(null),
    reportPendingFeature,
  };
}
