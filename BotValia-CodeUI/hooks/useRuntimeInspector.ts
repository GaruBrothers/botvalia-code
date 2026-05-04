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
  applyRuntimeSessionOwnership,
  createSessionDraft,
  getNextVisibleSessionId,
  readRuntimeSessionOwnershipStore,
  stripDraftSessions,
  updateSessionDraft,
  upsertSessionDraft,
  upsertSessionOwnershipMetadata,
  writeRuntimeSessionOwnershipStore,
} from '@/lib/runtime-session-ownership';
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
  togglePinnedSession: (sessionId: string) => void;
  updateSessionNotes: (sessionId: string, notes: string) => void;
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

export function useRuntimeInspector(): UseRuntimeInspectorResult {
  const [initialRuntimeConfig] = useState(readInitialRuntimeConfig);
  const ownershipStoreRef = useRef(
    readRuntimeSessionOwnershipStore(initialRuntimeConfig.runtimeUrl),
  );
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
  const [sessions, setSessions] = useState<Session[]>(() =>
    applyRuntimeSessionOwnership([], ownershipStoreRef.current),
  );
  const [selectedSessionId, setSelectedSessionIdState] = useState<string | null>(null);
  const [notice, setNotice] = useState<RuntimeNotice | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [connectionVersion, setConnectionVersion] = useState(0);

  const clientRef = useRef<BrowserRuntimeClient | null>(null);
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

  const selectedSession = useMemo(
    () => sessions.find(session => session.id === selectedSessionId) || null,
    [sessions, selectedSessionId],
  );

  const applyOwnedSessions = (runtimeSessions: Session[]) =>
    applyRuntimeSessionOwnership(runtimeSessions, ownershipStoreRef.current);

  const commitRuntimeSessions = (
    updater: (runtimeSessions: Session[]) => Session[],
  ) => {
    setSessions(previous => applyOwnedSessions(updater(stripDraftSessions(previous))));
  };

  const commitOwnershipStore = (
    nextStore: ReturnType<typeof readRuntimeSessionOwnershipStore>,
    baseSessions: Session[] = stripDraftSessions(sessions),
  ) => {
    ownershipStoreRef.current = nextStore;
    writeRuntimeSessionOwnershipStore(runtimeUrlRef.current, nextStore);
    const nextSessions = applyRuntimeSessionOwnership(baseSessions, nextStore);
    setSessions(nextSessions);
    return nextSessions;
  };

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
    if (!client || !sessionId || ownershipStoreRef.current.drafts[sessionId]) {
      return;
    }

    const detail = await client.getSessionDetail(sessionId);
    if (!detail) {
      return;
    }

    commitRuntimeSessions(previous => mergeDetailIntoSessions(previous, detail));
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

      commitRuntimeSessions(previous => mergeSnapshotsIntoSessions(previous, snapshots));
      setSelectedSessionIdState(previousSelectedId => {
        if (
          previousSelectedId &&
          ownershipStoreRef.current.drafts[previousSelectedId]
        ) {
          nextSelectedId = previousSelectedId;
          return previousSelectedId;
        }

        if (snapshots.length === 0) {
          nextSelectedId =
            applyRuntimeSessionOwnership([], ownershipStoreRef.current).find(
              session => !session.archived,
            )?.id || null;
          return nextSelectedId;
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
      if (event.type === 'runtime_bootstrap') {
        commitRuntimeSessions(previous =>
          mergeSnapshotsIntoSessions(previous, event.sessions, event.timestamp),
        );
        setSelectedSessionIdState(previousSelectedId => {
          if (
            previousSelectedId &&
            ownershipStoreRef.current.drafts[previousSelectedId]
          ) {
            return previousSelectedId;
          }

          if (event.sessions.length === 0) {
            return (
              applyRuntimeSessionOwnership([], ownershipStoreRef.current).find(
                session => !session.archived,
              )?.id || null
            );
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
        commitRuntimeSessions(previous =>
          mergeSnapshotsIntoSessions(previous, [event.session], event.timestamp),
        );
        return;
      }

      if (event.type === 'runtime_registry_event') {
        commitRuntimeSessions(previous => applyRuntimeRegistryEvent(previous, event.event));
        if (selectedSessionIdRef.current === event.event.sessionId) {
          scheduleSessionDetailRefresh(event.event.sessionId);
        }
        return;
      }

      commitRuntimeSessions(previous =>
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
      selectedSession?.isDraft
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
    // The session subscription lifecycle is keyed only by connection and selected session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionVersion, selectedSession?.isDraft, selectedSessionId]);

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
    const session = sessions.find(candidate => candidate.id === sessionId);
    if (!client || !sessionId || !session || session.isDraft) {
      pushNotice('warn', 'Selecciona una sesión activa antes de enviar un mensaje.');
      return;
    }

    commitRuntimeSessions(previous => appendOptimisticMessage(previous, sessionId, text));

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

  const claimSessionControl = async (sessionIdOverride?: string | null) => {
    const client = clientRef.current;
    const sessionId = sessionIdOverride ?? selectedSessionIdRef.current;
    const session = sessions.find(candidate => candidate.id === sessionId);
    if (!client || !sessionId || !session || session.isDraft) {
      pushNotice(
        'warn',
        'Selecciona una sesion runtime activa antes de tomar control desde la web.',
      );
      return;
    }

    try {
      const snapshot = await client.claimSession(sessionId, 'web-ui');
      commitRuntimeSessions(previous =>
        mergeSnapshotsIntoSessions(previous, [snapshot], snapshot.activeChannelUpdatedAt),
      );
      pushNotice('info', 'La Web UI tomo control de esta sesion.');
      scheduleSessionDetailRefresh(sessionId);
    } catch (error) {
      setRuntimeError(
        error instanceof Error
          ? error.message
          : 'No pude tomar control de la sesion desde la UI.',
      );
    }
  };

  const sendDirectInstruction = async (teammateName: string, text: string) => {
    const trimmedName = teammateName.trim();
    const trimmedText = text.trim();

    if (!trimmedName || !trimmedText) {
      pushNotice('warn', 'La instruccion directa necesita agente y contenido.');
      return;
    }

    await sendMessage(`@${trimmedName} ${trimmedText}`);
  };

  const interrupt = async () => {
    const client = clientRef.current;
    const sessionId = selectedSessionIdRef.current;
    const session = sessions.find(candidate => candidate.id === sessionId);
    if (!client || !sessionId || !session || session.isDraft) {
      return;
    }

    try {
      await client.interrupt(sessionId, 'web-ui');
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
    if (!client || !sessionId || !session || session.isDraft) {
      pushNotice('warn', 'Selecciona una sesión activa antes de cambiar el modo.');
      return;
    }

    const nextMode = getNextPermissionMode(session.permissionMode, {
      isBypassPermissionsModeAvailable: session.isBypassPermissionsModeAvailable,
      isAutoModeAvailable: session.isAutoModeAvailable,
    });

    try {
      await client.setPermissionMode(sessionId, nextMode, 'web-ui');
      commitRuntimeSessions(previous =>
        previous.map(candidate =>
          candidate.id === sessionId
            ? {
                ...candidate,
                permissionMode: nextMode,
                updatedAt: new Date().toISOString(),
              }
            : candidate,
        ),
      );
      pushNotice('info', `Modo cambiado a ${nextMode}.`);
    } catch (error) {
      setRuntimeError(
        error instanceof Error
          ? error.message
          : 'No pude cambiar el modo de permisos.',
      );
    }
  };

  const createSession = async (title: string, workspacePath: string) => {
    const trimmedTitle = title.trim();
    const trimmedWorkspacePath = workspacePath.trim();
    if (!trimmedTitle) {
      pushNotice('warn', 'El borrador necesita al menos un titulo.');
      return;
    }

    const draft = createSessionDraft({
      title: trimmedTitle,
      workspacePath: trimmedWorkspacePath,
    });
    const nextStore = upsertSessionDraft(ownershipStoreRef.current, draft);
    commitOwnershipStore(nextStore);
    setSelectedSessionIdState(draft.id);
    pushNotice(
      'warn',
      'Borrador creado en la UI. El runtime actual todavia no expone create_session para lanzar un worker real desde browser.',
    );
  };

  const renameSession = async (sessionId: string, newTitle: string) => {
    const trimmedTitle = newTitle.trim();
    if (!trimmedTitle) {
      pushNotice('warn', 'El nombre de la sesion no puede quedar vacio.');
      return;
    }

    const session = sessions.find(candidate => candidate.id === sessionId);
    if (!session) {
      pushNotice('warn', 'No encontre la sesion que intentabas renombrar.');
      return;
    }

    if (session.isDraft) {
      const nextStore = updateSessionDraft(ownershipStoreRef.current, sessionId, {
        title: trimmedTitle,
      });
      commitOwnershipStore(nextStore);
      pushNotice('info', 'Borrador renombrado en esta UI.');
      return;
    }

    const nextStore = upsertSessionOwnershipMetadata(
      ownershipStoreRef.current,
      sessionId,
      { customTitle: trimmedTitle },
    );
    commitOwnershipStore(nextStore);

    const client = clientRef.current;
    if (!client) {
      pushNotice(
        'warn',
        'Nombre guardado solo en esta UI/browser. No hay conexion runtime activa para persistirlo en backend.',
      );
      return;
    }

    try {
      await client.renameSession(sessionId, trimmedTitle);
      pushNotice('info', 'Nombre de sesion guardado en runtime y UI.');
    } catch (error) {
      pushNotice(
        'warn',
        `Nombre guardado solo en esta UI/browser. Backend runtime sin soporte completo o error: ${
          error instanceof Error ? error.message : 'rename_session no disponible'
        }`,
      );
    }
  };

  const archiveSession = async (sessionId: string) => {
    const session = sessions.find(candidate => candidate.id === sessionId);
    if (!session) {
      return;
    }

    const nextStore = session.isDraft
      ? updateSessionDraft(ownershipStoreRef.current, sessionId, { archived: true })
      : upsertSessionOwnershipMetadata(ownershipStoreRef.current, sessionId, {
          archived: true,
        });
    const nextSessions = commitOwnershipStore(nextStore);

    if (selectedSessionIdRef.current === sessionId) {
      setSelectedSessionIdState(getNextVisibleSessionId(nextSessions, sessionId));
    }

    pushNotice(
      session.isDraft ? 'info' : 'warn',
      session.isDraft
        ? 'Borrador archivado en la UI.'
        : 'Sesion archivada en la UI. El runtime/CLI actual todavia no expone archive_session.',
    );
  };

  const restoreSession = async (sessionId: string) => {
    const session = sessions.find(candidate => candidate.id === sessionId);
    if (!session) {
      return;
    }

    const nextStore = session.isDraft
      ? updateSessionDraft(ownershipStoreRef.current, sessionId, { archived: false })
      : upsertSessionOwnershipMetadata(ownershipStoreRef.current, sessionId, {
          archived: false,
        });
    commitOwnershipStore(nextStore);
    pushNotice('info', 'Sesion restaurada en la UI.');
  };

  const togglePinnedSession = (sessionId: string) => {
    const session = sessions.find(candidate => candidate.id === sessionId);
    if (!session) {
      return;
    }

    const nextPinned = !session.pinned;
    const nextStore = session.isDraft
      ? updateSessionDraft(ownershipStoreRef.current, sessionId, { pinned: nextPinned })
      : upsertSessionOwnershipMetadata(ownershipStoreRef.current, sessionId, {
          pinned: nextPinned,
        });
    commitOwnershipStore(nextStore);
  };

  const updateSessionNotes = (sessionId: string, notes: string) => {
    const session = sessions.find(candidate => candidate.id === sessionId);
    if (!session) {
      return;
    }

    const nextStore = session.isDraft
      ? updateSessionDraft(ownershipStoreRef.current, sessionId, { notes })
      : upsertSessionOwnershipMetadata(ownershipStoreRef.current, sessionId, { notes });
    commitOwnershipStore(nextStore);
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
