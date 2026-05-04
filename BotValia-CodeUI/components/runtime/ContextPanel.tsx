import { useEffect, useState } from "react";
import {
  X,
  Network,
  Activity,
  FileJson,
  Clock,
  RotateCcw,
  Archive,
  ArchiveRestore,
  Pin,
  PinOff,
  Crown,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlobalRuntimeState, Session } from "@/lib/types";
import { formatPermissionModeLabel } from "@/lib/permission-modes";
import { motion, AnimatePresence } from "motion/react";

type TabId = "ahora" | "swarm" | "eventos" | "json";

function InfoCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 shadow-inner">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
        {label}
      </div>
      <div
        className={
          accent
            ? "text-sm font-semibold text-indigo-300"
            : "text-sm text-gray-200 break-words"
        }
      >
        {value}
      </div>
    </div>
  );
}

export function ContextPanel({
  session,
  runtimeState,
  onClose,
  onReconnect,
  onRename,
  onArchive,
  onRestore,
  onTogglePin,
  onUpdateNotes,
  onClaimSession,
}: {
  session: Session | null;
  runtimeState: GlobalRuntimeState;
  onClose: () => void;
  onReconnect?: () => void;
  onRename?: (sessionId: string, title: string) => Promise<void>;
  onArchive?: (sessionId: string) => Promise<void>;
  onRestore?: (sessionId: string) => Promise<void>;
  onTogglePin?: (sessionId: string) => void;
  onUpdateNotes?: (sessionId: string, notes: string) => void;
  onClaimSession?: (sessionId?: string | null) => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("ahora");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftNotes, setDraftNotes] = useState("");

  useEffect(() => {
    setDraftTitle(session?.title || session?.projectName || "");
    setDraftNotes(session?.notes || "");
  }, [session?.id, session?.notes, session?.projectName, session?.title]);

  if (!session) return null;

  const canRename = Boolean(onRename);
  const canUpdateNotes = Boolean(onUpdateNotes);
  const activeChannelLabel = session.activeChannel === "web-ui" ? "Web UI" : "CLI";
  const channelTime = new Date(session.activeChannelUpdatedAt).toLocaleTimeString();

  return (
    <div className="flex h-full w-full flex-col bg-transparent">
      <div className="flex items-center justify-between border-b border-white/[0.05] p-4">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-gray-200">Contexto</h3>
          <p className="mt-1 text-[11px] text-gray-500">
            Ejecucion, ownership y metadata de la sesion.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="scrollbar-hide flex overflow-x-auto border-b border-white/[0.05] px-2">
        {[
          { id: "ahora", label: "Ahora", icon: Clock },
          { id: "swarm", label: "Swarm", icon: Network },
          { id: "eventos", label: "Eventos", icon: Activity },
          { id: "json", label: "JSON", icon: FileJson },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabId)}
            className={`relative flex items-center whitespace-nowrap px-3 py-3 text-xs font-medium outline-none transition-colors ${
              activeTab === tab.id
                ? "text-indigo-300"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <tab.icon className="mr-1.5 h-3.5 w-3.5" />
            {tab.label}
            {activeTab === tab.id && (
              <motion.div
                layoutId="context-tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-indigo-500 shadow-[0_-2px_8px_rgba(99,102,241,0.5)]"
              />
            )}
          </button>
        ))}
      </div>

      <div className="relative flex-1 overflow-y-auto p-5 scrollbar-hide">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, scale: 0.98, filter: "blur(2px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.98, filter: "blur(2px)" }}
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            {activeTab === "ahora" && (
              <>
                <div className="grid grid-cols-1 gap-3">
                  <InfoCard label="Proyecto" value={session.projectName} />
                  <InfoCard label="Workspace" value={session.workspaceName} />
                  <InfoCard label="Runtime URL" value={runtimeState.runtimeUrl || "No runtime URL"} />
                  <InfoCard label="Sesion" value={session.id} />
                  <InfoCard label="Modelo" value={session.model} accent />
                  <InfoCard
                    label="Canal activo"
                    value={`${activeChannelLabel} · ${channelTime}`}
                    accent={session.activeChannel === "web-ui"}
                  />
                  <InfoCard
                    label="Modo"
                    value={formatPermissionModeLabel(session.permissionMode)}
                  />
                  <InfoCard label="Mensajes" value={String(session.messageCount)} />
                  <InfoCard label="Tareas" value={String(session.taskCount)} />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onReconnect}
                    className="h-8 border-white/[0.08] bg-white/[0.03] text-gray-300 hover:bg-white/[0.08]"
                  >
                    <RotateCcw className="mr-2 h-3.5 w-3.5" />
                    Reconnect Runtime
                  </Button>
                  {!session.isDraft && session.activeChannel !== "web-ui" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void onClaimSession?.(session.id)}
                      className="h-8 border-indigo-500/20 bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/15"
                    >
                      <Crown className="mr-2 h-3.5 w-3.5" />
                      Tomar control en web
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onTogglePin?.(session.id)}
                    className="h-8 border-white/[0.08] bg-white/[0.03] text-gray-300 hover:bg-white/[0.08]"
                  >
                    {session.pinned ? (
                      <PinOff className="mr-2 h-3.5 w-3.5" />
                    ) : (
                      <Pin className="mr-2 h-3.5 w-3.5" />
                    )}
                    {session.pinned ? "Unpin" : "Pin"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      session.archived
                        ? void onRestore?.(session.id)
                        : void onArchive?.(session.id)
                    }
                    className="h-8 border-white/[0.08] bg-white/[0.03] text-gray-300 hover:bg-white/[0.08]"
                  >
                    {session.archived ? (
                      <ArchiveRestore className="mr-2 h-3.5 w-3.5" />
                    ) : (
                      <Archive className="mr-2 h-3.5 w-3.5" />
                    )}
                    {session.archived ? "Restore" : "Archive"}
                  </Button>
                </div>

                <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4 shadow-inner">
                  <div className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                    Titulo de sesion
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={draftTitle}
                      onChange={event => setDraftTitle(event.target.value)}
                      className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2 text-sm text-gray-100 outline-none transition-colors focus:border-indigo-500/40"
                      placeholder="Nombre visible de la sesion"
                    />
                    <Button
                      size="sm"
                      disabled={!canRename || !draftTitle.trim()}
                      onClick={() => void onRename?.(session.id, draftTitle)}
                      className="bg-indigo-600 text-white hover:bg-indigo-500"
                    >
                      <Save className="mr-2 h-3.5 w-3.5" />
                      Save
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4 shadow-inner">
                  <div className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                    Notes
                  </div>
                  <textarea
                    value={draftNotes}
                    onChange={event => setDraftNotes(event.target.value)}
                    onBlur={() => onUpdateNotes?.(session.id, draftNotes)}
                    className="min-h-28 w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2 text-sm text-gray-200 outline-none transition-colors focus:border-indigo-500/40"
                    placeholder="Notas operativas, contexto o preferencias de esta sesion..."
                  />
                  <div className="mt-2 text-[11px] text-gray-500">
                    {canUpdateNotes
                      ? "Las notas se guardan al salir del campo."
                      : "Las notas no estan disponibles en esta sesion."}
                  </div>
                </div>

                {runtimeState.lastError && (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-200">
                    {runtimeState.lastError}
                  </div>
                )}
              </>
            )}

            {activeTab === "swarm" && (
              <>
                {session.swarm ? (
                  <>
                    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4 shadow-inner">
                      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                        Active Team
                      </div>
                      <div className="text-sm font-semibold text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]">
                        {session.swarm.activeTeam}
                      </div>
                    </div>
                    {session.swarm.waitingOn && (
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 shadow-[0_0_15px_rgba(245,158,11,0.05)]">
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-amber-500/70">
                          Waiting On
                        </div>
                        <div className="text-sm font-medium text-amber-300">{session.swarm.waitingOn}</div>
                      </div>
                    )}
                    <div>
                      <div className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                        Teammates
                      </div>
                      <div className="space-y-2">
                        {session.swarm.teammates.map(teammate => (
                          <div
                            key={teammate.id}
                            className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-medium text-gray-200">
                                  {teammate.name}
                                </div>
                                <div className="text-[10px] text-gray-500">
                                  {teammate.role}
                                </div>
                              </div>
                              <span
                                className={`h-2.5 w-2.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)] ${
                                  teammate.status === "working"
                                    ? "bg-emerald-400 shadow-emerald-500/50"
                                    : teammate.status === "waiting"
                                      ? "bg-amber-400 shadow-amber-500/50"
                                      : teammate.status === "speaking"
                                        ? "bg-indigo-400 shadow-indigo-500/50"
                                        : "bg-gray-600"
                                }`}
                              />
                            </div>
                            {teammate.currentTask && (
                              <div className="mt-2 text-xs text-gray-300">
                                Task: {teammate.currentTask}
                              </div>
                            )}
                            {teammate.currentInstruction && (
                              <div className="mt-1 text-xs text-gray-400">
                                Instruction: {teammate.currentInstruction}
                              </div>
                            )}
                            {teammate.workspace && (
                              <div className="mt-1 break-all text-[11px] text-gray-500">
                                {teammate.workspace}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="py-6 text-center text-sm text-gray-500">
                    No swarm active in this session.
                  </div>
                )}
              </>
            )}

            {activeTab === "eventos" && (
              <>
                {session.events.length === 0 && (
                  <div className="py-6 text-center text-sm text-gray-500">No events recorded.</div>
                )}
                <div className="relative space-y-4 before:absolute before:inset-0 before:ml-[5px] before:h-full before:w-0.5 before:-translate-x-px before:bg-gradient-to-b before:from-transparent before:via-white/[0.1] before:to-transparent md:before:mx-auto md:before:translate-x-0">
                  {session.events.map(event => (
                    <div key={event.id} className="relative flex items-start space-x-3">
                      <div
                        className={`z-10 mt-1 flex h-3 w-3 items-center justify-center rounded-full ring-4 ring-black shadow-[0_0_8px_rgba(0,0,0,0.8)] ${
                          event.type === "error"
                            ? "bg-red-400"
                            : event.type === "warn"
                              ? "bg-amber-400"
                              : "bg-indigo-400"
                        }`}
                      />
                      <div className="flex-1 space-y-1 rounded-lg border border-white/[0.05] bg-white/[0.02] p-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-gray-500" suppressHydrationWarning>
                            {new Date(event.timestamp).toLocaleTimeString()}
                          </span>
                          <span
                            className={`text-[9px] font-bold uppercase tracking-widest ${
                              event.type === "error"
                                ? "text-red-400"
                                : event.type === "warn"
                                  ? "text-amber-400"
                                  : "text-gray-500"
                            }`}
                          >
                            {event.type}
                          </span>
                        </div>
                        <div className="text-xs leading-relaxed text-gray-300">{event.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {activeTab === "json" && (
              <div className="rounded-xl border border-white/[0.05] bg-black/50 p-3 shadow-inner">
                <pre className="scollbar-hide overflow-auto font-mono text-[10px] text-gray-400">
                  {JSON.stringify(session.rawDetail || session.rawSnapshot || session, null, 2)}
                </pre>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
