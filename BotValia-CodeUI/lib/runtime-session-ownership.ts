import type { EventLog, Session } from './types';
import {
  readBrowserStorage,
  removeBrowserStorage,
  writeBrowserStorage,
} from './runtime-browser-storage';
import { getRuntimeStorageScope } from './runtime-url';

const OWNERSHIP_STORAGE_PREFIX = 'botvalia.runtime.ownership';

export type RuntimeSessionOwnershipMetadata = {
  customTitle?: string;
  archived?: boolean;
  pinned?: boolean;
  notes?: string;
  workspacePath?: string;
  updatedAt: string;
};

export type RuntimeSessionDraft = {
  id: string;
  title: string;
  workspacePath: string;
  projectName: string;
  notes?: string;
  archived?: boolean;
  pinned?: boolean;
  createdAt: string;
  updatedAt: string;
};

type RuntimeSessionOwnershipStore = {
  version: 1;
  sessions: Record<string, RuntimeSessionOwnershipMetadata>;
  drafts: Record<string, RuntimeSessionDraft>;
};

const EMPTY_STORE: RuntimeSessionOwnershipStore = {
  version: 1,
  sessions: {},
  drafts: {},
};

function cloneStore(
  store: RuntimeSessionOwnershipStore = EMPTY_STORE,
): RuntimeSessionOwnershipStore {
  return {
    version: 1,
    sessions: { ...store.sessions },
    drafts: { ...store.drafts },
  };
}

function compactStore(
  store: RuntimeSessionOwnershipStore = EMPTY_STORE,
): RuntimeSessionOwnershipStore {
  const nextStore = cloneStore(store);

  nextStore.sessions = Object.fromEntries(
    Object.entries(nextStore.sessions).flatMap(([sessionId, metadata]) => {
      const customTitle = metadata.customTitle?.trim() || undefined;
      const notes = metadata.notes?.trim() || undefined;
      const workspacePath = metadata.workspacePath?.trim() || undefined;
      const archived = metadata.archived === true ? true : undefined;
      const pinned = metadata.pinned === true ? true : undefined;

      if (!customTitle && !notes && !workspacePath && !archived && !pinned) {
        return [];
      }

      return [
        [
          sessionId,
          {
            ...metadata,
            customTitle,
            notes,
            workspacePath,
            archived,
            pinned,
          },
        ] satisfies [string, RuntimeSessionOwnershipMetadata],
      ];
    }),
  );

  nextStore.drafts = Object.fromEntries(
    Object.entries(nextStore.drafts).map(([draftId, draft]) => [
      draftId,
      {
        ...draft,
        title: draft.title.trim(),
        workspacePath: draft.workspacePath.trim(),
        notes: draft.notes?.trim() || undefined,
      },
    ]),
  );

  return nextStore;
}

function getStorageKey(runtimeUrl: string | null | undefined): string | null {
  const scope = getRuntimeStorageScope(runtimeUrl);
  if (!scope) {
    return null;
  }

  return `${OWNERSHIP_STORAGE_PREFIX}:${scope}`;
}

function getLegacyStorageKey(runtimeUrl: string | null | undefined): string | null {
  if (!runtimeUrl?.trim()) {
    return null;
  }

  return `${OWNERSHIP_STORAGE_PREFIX}:${runtimeUrl.trim()}`;
}

function sortSessions(sessions: Session[]): Session[] {
  return [...sessions].sort((left, right) => {
    if (Boolean(left.pinned) !== Boolean(right.pinned)) {
      return left.pinned ? -1 : 1;
    }

    return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
  });
}

function createDraftEvent(timestamp: string, message: string): EventLog {
  return {
    id: `draft-event-${timestamp}-${message.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    timestamp,
    type: 'warn',
    message,
  };
}

function createDraftSession(draft: RuntimeSessionDraft): Session {
  const timestamp = draft.updatedAt || draft.createdAt;

  return {
    id: draft.id,
    shortId: 'draft',
    projectName: draft.projectName,
    title: draft.title,
    workspaceName: draft.workspacePath || draft.projectName,
    status: 'idle',
    activeChannel: 'web-ui',
    activeChannelUpdatedAt: timestamp,
    permissionMode: 'default',
    isBypassPermissionsModeAvailable: false,
    isAutoModeAvailable: false,
    model: 'pending-cli-runtime',
    messages: [
      {
        id: `${draft.id}-intro`,
        role: 'system',
        content:
          'Este borrador vive solo en la UI. Para convertirlo en una sesion runtime real todavia necesitas iniciarla desde el CLI.',
        timestamp,
        label: 'draft',
      },
    ],
    swarm: undefined,
    events: [
      createDraftEvent(
        timestamp,
        'Borrador creado en la UI. Pendiente de backend/create_session para lanzar el worker desde browser.',
      ),
    ],
    startedAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    archived: draft.archived || false,
    pinned: draft.pinned || false,
    notes: draft.notes,
    isDraft: true,
    messageCount: 0,
    taskCount: 0,
    rawSnapshot: draft,
    rawDetail: draft,
  };
}

export function readRuntimeSessionOwnershipStore(
  runtimeUrl: string | null | undefined,
): RuntimeSessionOwnershipStore {
  if (typeof window === 'undefined') {
    return cloneStore();
  }

  const storageKey = getStorageKey(runtimeUrl);
  if (!storageKey) {
    return cloneStore();
  }

  try {
    const legacyStorageKey = getLegacyStorageKey(runtimeUrl);
    const raw =
      readBrowserStorage(storageKey, 'session') ||
      (legacyStorageKey ? readBrowserStorage(legacyStorageKey, 'local') : null);
    if (!raw) {
      return cloneStore();
    }

    const parsed = JSON.parse(raw) as Partial<RuntimeSessionOwnershipStore>;
    const hydratedStore: RuntimeSessionOwnershipStore = {
      version: 1,
      sessions:
        parsed.sessions && typeof parsed.sessions === 'object' ? parsed.sessions : {},
      drafts: parsed.drafts && typeof parsed.drafts === 'object' ? parsed.drafts : {},
    };

    if (!readBrowserStorage(storageKey, 'session')) {
      writeBrowserStorage(storageKey, JSON.stringify(hydratedStore), 'session');
    }
    if (legacyStorageKey) {
      removeBrowserStorage(legacyStorageKey, 'local');
    }

    return hydratedStore;
  } catch {
    return cloneStore();
  }
}

export function writeRuntimeSessionOwnershipStore(
  runtimeUrl: string | null | undefined,
  store: RuntimeSessionOwnershipStore,
): void {
  if (typeof window === 'undefined') {
    return;
  }

  const storageKey = getStorageKey(runtimeUrl);
  if (!storageKey) {
    return;
  }

  const compactedStore = compactStore(store);
  const legacyStorageKey = getLegacyStorageKey(runtimeUrl);
  const hasStoredSessions =
    Object.keys(compactedStore.sessions).length > 0 ||
    Object.keys(compactedStore.drafts).length > 0;

  if (!hasStoredSessions) {
    removeBrowserStorage(storageKey, 'session');
  } else {
    writeBrowserStorage(storageKey, JSON.stringify(compactedStore), 'session');
  }

  if (legacyStorageKey) {
    removeBrowserStorage(legacyStorageKey, 'local');
  }
}

export function applyRuntimeSessionOwnership(
  sessions: Session[],
  store: RuntimeSessionOwnershipStore,
): Session[] {
  const liveSessions = sessions.map(session => {
    if (session.isDraft) {
      return session;
    }

    const metadata = store.sessions[session.id];
    if (!metadata) {
      return {
        ...session,
        pinned: session.pinned || false,
        notes: session.notes,
      };
    }

    return {
      ...session,
      title: metadata.customTitle?.trim() || session.title,
      workspaceName: metadata.workspacePath?.trim() || session.workspaceName,
      archived: metadata.archived ?? session.archived ?? false,
      pinned: metadata.pinned ?? session.pinned ?? false,
      notes: metadata.notes ?? session.notes,
    };
  });

  const drafts = Object.values(store.drafts).map(createDraftSession);
  return sortSessions([...liveSessions, ...drafts]);
}

export function stripDraftSessions(sessions: Session[]): Session[] {
  return sessions.filter(session => !session.isDraft);
}

export function upsertSessionOwnershipMetadata(
  store: RuntimeSessionOwnershipStore,
  sessionId: string,
  patch: Partial<Omit<RuntimeSessionOwnershipMetadata, 'updatedAt'>>,
): RuntimeSessionOwnershipStore {
  const nextStore = cloneStore(store);
  const previous = nextStore.sessions[sessionId] || { updatedAt: new Date().toISOString() };

  nextStore.sessions[sessionId] = {
    ...previous,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  return nextStore;
}

export function createSessionDraft(params: {
  title: string;
  workspacePath: string;
}): RuntimeSessionDraft {
  const timestamp = new Date().toISOString();
  const trimmedPath = params.workspacePath.trim();
  const trimmedTitle = params.title.trim();

  return {
    id: `draft-${crypto.randomUUID()}`,
    title: trimmedTitle,
    workspacePath: trimmedPath,
    projectName:
      trimmedTitle ||
      trimmedPath.replace(/\\/g, '/').split('/').filter(Boolean).at(-1) ||
      'Runtime Draft',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function upsertSessionDraft(
  store: RuntimeSessionOwnershipStore,
  draft: RuntimeSessionDraft,
): RuntimeSessionOwnershipStore {
  const nextStore = cloneStore(store);
  nextStore.drafts[draft.id] = draft;
  return nextStore;
}

export function updateSessionDraft(
  store: RuntimeSessionOwnershipStore,
  draftId: string,
  patch: Partial<Omit<RuntimeSessionDraft, 'id' | 'createdAt'>>,
): RuntimeSessionOwnershipStore {
  const existing = store.drafts[draftId];
  if (!existing) {
    return cloneStore(store);
  }

  const nextStore = cloneStore(store);
  nextStore.drafts[draftId] = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  return nextStore;
}

export function getNextVisibleSessionId(
  sessions: Session[],
  excludedSessionId: string,
): string | null {
  const candidate = sessions.find(
    session => session.id !== excludedSessionId && !session.archived,
  );
  return candidate?.id || null;
}
