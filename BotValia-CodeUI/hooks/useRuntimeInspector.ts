'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRuntimeClient } from '@/lib/runtime-client';
import { getNextPermissionMode } from '@/lib/permission-modes';
import {
  appendOptimisticMessage,
  applyRuntimeRegistryEvent,
  applyRuntimeSessionEvent,
  mergeDetailIntoSessions,
  mergeSnapshotsIntoSessions,
} from '@/lib/runtime-mappers';
import {
  readBrowserStorage,
  removeBrowserStorage,
  writeBrowserStorage,
} from '@/lib/runtime-browser-storage';
import {
  clearRuntimeLaunchParamsFromBrowserUrl,
  extractRuntimeAuthToken,
  readRuntimeLaunchConfigFromLocation,
  stripRuntimeAuthToken,
} from '@/lib/runtime-url';
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
  claimSessionControl: (sessionId?: string | null) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  sendDirectInstruction: (teammateName: string, text: string) => Promise<void>;
  interrupt: () => Promise<void>;
  createSession: (title: string, workspacePath: string) => Promise<void>;
  renameSession: (sessionId: string, newTitle: string) => Promise<void>;
  archiveSession: (sessionId: string) => Promise<void>;
  restoreSession: (sessionId: string) => Promise<void>;
  togglePinnedSession: (sessionId: string) => Promise<void>;
  updateSessionNotes: (sessionId: string, notes: string) => Promise<void>;
  cyclePermissionMode: () => Promise<void>;
  toggleAutoRefresh: () => void;
  dismissNotice: () => void;
  reportPendingFeature: (feature: string) => void;
};

const AUTO_REFRESH_STORAGE_KEY = 'botvalia.runtime.autoRefresh';
const RUNTIME_URL_STORAGE_KEY = 'botvalia.runtime.url';
const RUNTIME_AUTH_TOKEN_STORAGE_KEY = 'botvalia.runtime.authToken';

function readInitialRuntimeConfig(): {
  autoRefresh: boolean;
  runtimeUrl: string | null;
  runtimeAuthToken: string | null;
} {
  if (typeof window === 'undefined') {
    return {
      autoRefresh: true,
      runtimeUrl: null,
      runtimeAuthToken: null,
    };
  }

  const runtimeFromLaunch = readRuntimeLaunchConfigFromLocation(window.location);
  const runtimeFromStorage = stripRuntimeAuthToken(
    readBrowserStorage(RUNTIME_URL_STORAGE_KEY, 'session'),
  );
  const runtimeAuthTokenFromStorage =
    readBrowserStorage(RUNTIME_AUTH_TOKEN_STORAGE_KEY, 'session') ||
    extractRuntimeAuthToken(readBrowserStorage(RUNTIME_URL_STORAGE_KEY, 'session'));
  removeBrowserStorage(RUNTIME_URL_STORAGE_KEY, 'local');
  removeBrowserStorage(RUNTIME_AUTH_TOKEN_STORAGE_KEY, 'local');
  removeBrowserStorage(AUTO_REFRESH_STORAGE_KEY, 'local');

  return {
    autoRefresh: readBrowserStorage(AUTO_REFRESH_STORAGE_KEY, 'session') !== 'false',
    runtimeUrl: runtimeFromLaunch.runtimeUrl || runtimeFromStorage || null,
    runtimeAuthToken:
      runtimeFromLaunch.runtimeAuthToken || runtimeAuthTokenFromStorage || null,
  };
}

type SessionLease = {
  leaseId: string;
  leaseExpiresAt?: string | null;
};

function isLeaseExpired(leaseExpiresAt?: string | null): boolean {
  if (!leaseExpiresAt) {
    return false;
  }

  return Date.parse(leaseExpiresAt) <= Date.now();
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

  const selectedSession = useMemo(
    () => sessions.find(session => session.id === selectedSessionId) || null,
    [sessions, selectedSessionId],
  );

  const clientRef = useRef<BrowserRuntimeClient | null>(null);
  const clientIdRef = useRef<string | null>(null);
  const sessionLeasesRef = useRef<Map<string, SessionLease>>(new Map());
  const runtimeSubscriptionIdRef = useRef<string | null>(null);
  const sessionSubscriptionIdRef = useRef<string | null>(null);
  const selectedSessionIdRef = useRef<string | null>(null);
  const runtimeUrlRef = useRef<string | null>(initialRuntimeConfig.runtimeUrl);
  const runtimeAuthTokenRef = useRef<string | null>(
    initialRuntimeConfig.runtimeAuthToken,
  );
  const sessionRefreshTimerRef = useRef<number | null>(null);
  const eventUnsubscribeRef = useRef<(() => void) | null>(null);
  const connectionUnsubscribeRef = useRef<(() => void) | null>(null);
  const handleProtocolEventRef = useRef<(event: RuntimeProtocolEvent) => void>(() => {});

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

  const upsertSessionLease = (
    sessionId: string,
    leaseId: string | null,
    leaseExpiresAt: string | null,
  ) => {
    if (!leaseId) {
      sessionLeasesRef.current.delete(sessionId);
      return;
    }

    sessionLeasesRef.current.set(sessionId, {
      leaseId,
      leaseExpiresAt,
    });
  };

  const clearPendingSessionRefresh = () => {
    if (sessionRefreshTimerRef.current !== null) {
      window.clearTimeout(sessionRefreshTimerRef.current);
      sessionRefreshTimerRef.current = null;
    }
  };

  const commitSessions = (updater: (previous: Session[]) => Session[]) => {
    setSessions(previous => updater(previous));
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

    commitSessions(previous => mergeDetailIntoSessions(previous, detail));
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
    clientIdRef.current = null;
    sessionLeasesRef.current.clear();

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

      commitSessions(previous => mergeSnapshotsIntoSessions(previous, snapshots));
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

    const client = new BrowserRuntimeClient(runtimeUrl, {
      authToken: runtimeAuthTokenRef.current,
    });
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
      clientIdRef.current = client.getClientId();
      await refresh(client);
      setConnectionVersion(previous => previous + 1);
    } catch (error) {
      await disconnectClient();
      throw error;
    }
  };

  const ensureWebLease = async (
    sessionId: string,
    client: BrowserRuntimeClient,
  ): Promise<string | undefined> => {
    const currentSession =
      sessions.find(candidate => candidate.id === sessionId) ||
      null;

    if (
      currentSession?.channelOwner?.clientId &&
      clientIdRef.current &&
      currentSession.channelOwner.clientId === clientIdRef.current &&
      currentSession.channelOwner.leaseId &&
      !isLeaseExpired(currentSession.channelOwner.leaseExpiresAt)
    ) {
      upsertSessionLease(
        sessionId,
        currentSession.channelOwner.leaseId,
        currentSession.channelOwner.leaseExpiresAt,
      );
      return currentSession.channelOwner.leaseId;
    }

    const cachedLease = sessionLeasesRef.current.get(sessionId);
    if (cachedLease && !isLeaseExpired(cachedLease.leaseExpiresAt)) {
      return cachedLease.leaseId;
    }

    const claimed = await client.claimSession(sessionId, 'web-ui');
    clientIdRef.current = claimed.clientId;
    upsertSessionLease(sessionId, claimed.leaseId, claimed.leaseExpiresAt);
    commitSessions(previous =>
      mergeSnapshotsIntoSessions(previous, [claimed.snapshot], claimed.snapshot.updatedAt),
    );
    return claimed.leaseId || undefined;
  };

  useEffect(() => {
    selectedSessionIdRef.current = selectedSessionId;
  }, [selectedSessionId]);

  useEffect(() => {
    if (selectedSessionId || sessions.length === 0) {
      return;
    }

    const firstVisibleSession = sessions.find(session => !session.archived);
    if (firstVisibleSession) {
      setSelectedSessionIdState(firstVisibleSession.id);
    }
  }, [selectedSessionId, sessions]);

  useEffect(() => {
    handleProtocolEventRef.current = event => {
      if (event.clientId) {
        clientIdRef.current = event.clientId;
      }

      if (event.type === 'runtime_bootstrap') {
        commitSessions(previous =>
          mergeSnapshotsIntoSessions(previous, event.sessions, event.timestamp),
        );
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
        commitSessions(previous =>
          mergeSnapshotsIntoSessions(previous, [event.session], event.timestamp),
        );
        return;
      }

      if (event.type === 'runtime_registry_event') {
        commitSessions(previous => applyRuntimeRegistryEvent(previous, event.event));
        if (selectedSessionIdRef.current === event.event.sessionId) {
          scheduleSessionDetailRefresh(event.event.sessionId);
        }
        return;
      }

      commitSessions(previous =>
        applyRuntimeSessionEvent(previous, event.sessionId, event.event),
      );

      if (
        event.sessionId === selectedSessionIdRef.current &&
        event.event.type !== 'message_delta' &&
        event.event.type !== 'thinking_delta' &&
        event.event.type !== 'thinking_started'
      ) {
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
    removeBrowserStorage(RUNTIME_URL_STORAGE_KEY, 'local');
    removeBrowserStorage(RUNTIME_AUTH_TOKEN_STORAGE_KEY, 'local');
    removeBrowserStorage(AUTO_REFRESH_STORAGE_KEY, 'local');

    if (initialRuntimeConfig.runtimeUrl) {
      writeBrowserStorage(
        RUNTIME_URL_STORAGE_KEY,
        initialRuntimeConfig.runtimeUrl,
        'session',
      );
    } else {
      removeBrowserStorage(RUNTIME_URL_STORAGE_KEY, 'session');
    }

    if (initialRuntimeConfig.runtimeAuthToken) {
      writeBrowserStorage(
        RUNTIME_AUTH_TOKEN_STORAGE_KEY,
        initialRuntimeConfig.runtimeAuthToken,
        'session',
      );
    } else {
      removeBrowserStorage(RUNTIME_AUTH_TOKEN_STORAGE_KEY, 'session');
    }

    clearRuntimeLaunchParamsFromBrowserUrl();
  }, [initialRuntimeConfig.runtimeAuthToken, initialRuntimeConfig.runtimeUrl]);

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
    if (
      !clientRef.current ||
      !selectedSessionId ||
      connectionVersion === 0 ||
      selectedSession?.hasLiveRuntime === false
    ) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionVersion, selectedSession?.hasLiveRuntime, selectedSessionId]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionVersion, globalState.autoRefresh]);

  const sendMessage = async (text: string) => {
    const client = clientRef.current;
    const sessionId = selectedSessionIdRef.current;
    const session = sessions.find(candidate => candidate.id === sessionId);
    if (!client || !sessionId || !session) {
      pushNotice('warn', 'Selecciona una sesión activa antes de enviar un mensaje.');
      return;
    }

    if (session.hasLiveRuntime === false) {
      pushNotice(
        'warn',
        'Esta sesión ya está persistida en backend, pero todavía no tiene un worker runtime vivo para recibir mensajes.',
      );
      return;
    }

    const leaseId = await ensureWebLease(sessionId, client);
    commitSessions(previous => appendOptimisticMessage(previous, sessionId, text));

    try {
      await client.sendMessage(
        sessionId,
        {
          text,
          channel: 'web-ui',
        },
        leaseId,
      );
      scheduleSessionDetailRefresh(sessionId);
    } catch (error) {
      await refresh(client);
      setRuntimeError(
        error instanceof Error ? error.message : 'No pude enviar el mensaje al runtime.',
      );
    }
  };

  const claimSessionControl = async (sessionIdOverride?: string | null) => {
    const client = clientRef.current;
    const sessionId = sessionIdOverride ?? selectedSessionIdRef.current;
    const session = sessions.find(candidate => candidate.id === sessionId);
    if (!client || !sessionId || !session) {
      pushNotice(
        'warn',
        'Selecciona una sesión runtime antes de tomar control desde la web.',
      );
      return;
    }

    try {
      const claimed = await client.claimSession(sessionId, 'web-ui');
      clientIdRef.current = claimed.clientId;
      upsertSessionLease(sessionId, claimed.leaseId, claimed.leaseExpiresAt);
      commitSessions(previous =>
        mergeSnapshotsIntoSessions(
          previous,
          [claimed.snapshot],
          claimed.snapshot.updatedAt,
        ),
      );
      pushNotice('info', 'La Web UI tomó control de esta sesión.');
      scheduleSessionDetailRefresh(sessionId);
    } catch (error) {
      setRuntimeError(
        error instanceof Error
          ? error.message
          : 'No pude tomar control de la sesión desde la UI.',
      );
    }
  };

  const sendDirectInstruction = async (teammateName: string, text: string) => {
    const trimmedName = teammateName.trim();
    const trimmedText = text.trim();

    if (!trimmedName || !trimmedText) {
      pushNotice('warn', 'La instrucción directa necesita agente y contenido.');
      return;
    }

    await sendMessage(`@${trimmedName} ${trimmedText}`);
  };

  const interrupt = async () => {
    const client = clientRef.current;
    const sessionId = selectedSessionIdRef.current;
    const session = sessions.find(candidate => candidate.id === sessionId);
    if (!client || !sessionId || !session) {
      return;
    }

    if (session.hasLiveRuntime === false) {
      pushNotice(
        'warn',
        'Esta sesión existe, pero no hay un worker runtime vivo para interrumpir.',
      );
      return;
    }

    try {
      const leaseId = await ensureWebLease(sessionId, client);
      await client.interrupt(sessionId, leaseId, 'web-ui');
      scheduleSessionDetailRefresh(sessionId);
    } catch (error) {
      setRuntimeError(
        error instanceof Error
          ? error.message
          : 'No pude interrumpir la sesión actual.',
      );
    }
  };

  const cyclePermissionMode = async () => {
    const client = clientRef.current;
    const sessionId = selectedSessionIdRef.current;
    const session = sessions.find(candidate => candidate.id === sessionId);
    if (!client || !sessionId || !session) {
      pushNotice('warn', 'Selecciona una sesión activa antes de cambiar el modo.');
      return;
    }

    const nextMode = getNextPermissionMode(session.permissionMode, {
      isBypassPermissionsModeAvailable: session.isBypassPermissionsModeAvailable,
      isAutoModeAvailable: session.isAutoModeAvailable,
    });

    try {
      const leaseId = await ensureWebLease(sessionId, client);
      const mode = await client.setPermissionMode(sessionId, nextMode, leaseId, 'web-ui');
      commitSessions(previous =>
        previous.map(candidate =>
          candidate.id === sessionId
            ? {
                ...candidate,
                permissionMode: mode,
                updatedAt: new Date().toISOString(),
              }
            : candidate,
        ),
      );
      pushNotice('info', `Modo cambiado a ${mode}.`);
    } catch (error) {
      setRuntimeError(
        error instanceof Error
          ? error.message
          : 'No pude cambiar el modo de permisos.',
      );
    }
  };

  const createSession = async (title: string, workspacePath: string) => {
    const client = clientRef.current;
    if (!client) {
      pushNotice('warn', 'Necesitas una conexión runtime activa para crear una sesión.');
      return;
    }

    const trimmedTitle = title.trim();
    const trimmedWorkspacePath = workspacePath.trim();
    if (!trimmedTitle || !trimmedWorkspacePath) {
      pushNotice('warn', 'La nueva sesión necesita título y workspace.');
      return;
    }

    try {
      const created = await client.createSession({
        title: trimmedTitle,
        cwd: trimmedWorkspacePath,
      });
      clientIdRef.current = created.clientId;
      upsertSessionLease(created.session.sessionId, created.leaseId, created.leaseExpiresAt);
      commitSessions(previous =>
        mergeSnapshotsIntoSessions(previous, [created.session], created.session.updatedAt),
      );
      setSelectedSessionIdState(created.session.sessionId);
      pushNotice(
        created.session.hasLiveRuntime
          ? 'info'
          : 'warn',
        created.session.hasLiveRuntime
          ? 'Sesión creada en backend.'
          : 'Sesión creada y persistida en backend. Aún falta adjuntarle un worker runtime vivo para ejecutar prompts.',
      );
      await loadSessionDetail(created.session.sessionId, client);
    } catch (error) {
      setRuntimeError(
        error instanceof Error
          ? error.message
          : 'No pude crear la nueva sesión runtime.',
      );
    }
  };

  const renameSession = async (sessionId: string, newTitle: string) => {
    const client = clientRef.current;
    if (!client) {
      pushNotice('warn', 'No hay conexión runtime activa para renombrar la sesión.');
      return;
    }

    const trimmedTitle = newTitle.trim();
    if (!trimmedTitle) {
      pushNotice('warn', 'El nombre de la sesión no puede quedar vacío.');
      return;
    }

    try {
      const leaseId = await ensureWebLease(sessionId, client);
      await client.renameSession(sessionId, trimmedTitle, leaseId);
      await loadSessionDetail(sessionId, client);
      pushNotice('info', 'Nombre de sesión guardado en backend.');
    } catch (error) {
      setRuntimeError(
        error instanceof Error
          ? error.message
          : 'No pude renombrar la sesión.',
      );
    }
  };

  const archiveSession = async (sessionId: string) => {
    const client = clientRef.current;
    if (!client) {
      pushNotice('warn', 'No hay conexión runtime activa para archivar la sesión.');
      return;
    }

    try {
      const leaseId = await ensureWebLease(sessionId, client);
      const snapshot = await client.archiveSession(sessionId, leaseId);
      commitSessions(previous =>
        mergeSnapshotsIntoSessions(previous, [snapshot], snapshot.updatedAt),
      );
      if (selectedSessionIdRef.current === sessionId) {
        setSelectedSessionIdState(
          sessions.find(candidate => candidate.id !== sessionId && !candidate.archived)?.id ||
            null,
        );
      }
      pushNotice('info', 'Sesión archivada en backend.');
      await loadSessionDetail(sessionId, client);
    } catch (error) {
      setRuntimeError(
        error instanceof Error ? error.message : 'No pude archivar la sesión.',
      );
    }
  };

  const restoreSession = async (sessionId: string) => {
    const client = clientRef.current;
    if (!client) {
      pushNotice('warn', 'No hay conexión runtime activa para restaurar la sesión.');
      return;
    }

    try {
      const leaseId = await ensureWebLease(sessionId, client);
      const snapshot = await client.unarchiveSession(sessionId, leaseId);
      commitSessions(previous =>
        mergeSnapshotsIntoSessions(previous, [snapshot], snapshot.updatedAt),
      );
      pushNotice('info', 'Sesión restaurada en backend.');
      await loadSessionDetail(sessionId, client);
    } catch (error) {
      setRuntimeError(
        error instanceof Error ? error.message : 'No pude restaurar la sesión.',
      );
    }
  };

  const togglePinnedSession = async (sessionId: string) => {
    const client = clientRef.current;
    const session = sessions.find(candidate => candidate.id === sessionId);
    if (!client || !session) {
      return;
    }

    try {
      const leaseId = await ensureWebLease(sessionId, client);
      const snapshot = await client.pinSession(sessionId, !session.pinned, leaseId);
      commitSessions(previous =>
        mergeSnapshotsIntoSessions(previous, [snapshot], snapshot.updatedAt),
      );
      await loadSessionDetail(sessionId, client);
    } catch (error) {
      setRuntimeError(
        error instanceof Error ? error.message : 'No pude fijar la sesión.',
      );
    }
  };

  const updateSessionNotes = async (sessionId: string, notes: string) => {
    const client = clientRef.current;
    if (!client) {
      return;
    }

    try {
      const leaseId = await ensureWebLease(sessionId, client);
      const snapshot = await client.updateSessionNotes(sessionId, notes, leaseId);
      commitSessions(previous =>
        mergeSnapshotsIntoSessions(previous, [snapshot], snapshot.updatedAt),
      );
      await loadSessionDetail(sessionId, client);
    } catch (error) {
      setRuntimeError(
        error instanceof Error
          ? error.message
          : 'No pude guardar las notas de la sesión.',
      );
    }
  };

  const toggleAutoRefresh = () => {
    setGlobalState(previous => {
      const nextValue = !previous.autoRefresh;
      writeBrowserStorage(
        AUTO_REFRESH_STORAGE_KEY,
        nextValue ? 'true' : 'false',
        'session',
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
      `${feature} todavía depende de un worker runtime vivo o de una integración adicional del backend.`,
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
    claimSessionControl,
    sendMessage,
    sendDirectInstruction,
    interrupt,
    createSession,
    renameSession,
    archiveSession,
    restoreSession,
    togglePinnedSession,
    updateSessionNotes,
    cyclePermissionMode,
    toggleAutoRefresh,
    dismissNotice: () => setNotice(null),
    reportPendingFeature,
  };
}
