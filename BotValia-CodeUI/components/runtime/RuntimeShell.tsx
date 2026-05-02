'use client';

import { useEffect, useState } from 'react';
import { TopStatusBar } from './TopStatusBar';
import { SessionSidebar } from './SessionSidebar';
import { ConversationView } from './ConversationView';
import { Composer } from './Composer';
import { ContextPanel } from './ContextPanel';
import { SwarmOfficeView } from './SwarmOfficeView';
import { Sidebar, MessageSquare, Users, Moon, Sun, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'motion/react';
import { useRuntimeInspector } from '@/hooks/useRuntimeInspector';
import { formatPermissionModeLabel } from '@/lib/permission-modes';

const THEME_STORAGE_KEY = 'botvalia.runtime.theme';

export function RuntimeShell() {
  const {
    globalState,
    sessions,
    selectedSessionId,
    selectedSession,
    notice,
    isRefreshing,
    setSelectedSessionId,
    reconnect,
    refresh,
    sendMessage,
    interrupt,
    cyclePermissionMode,
    toggleAutoRefresh,
    dismissNotice,
    reportPendingFeature,
  } = useRuntimeInspector();

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') {
      return 'dark';
    }

    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return storedTheme === 'light' ? 'light' : 'dark';
  });
  const [showSidebar, setShowSidebar] = useState(() => {
    if (typeof window === 'undefined') {
      return true;
    }

    return window.innerWidth >= 768;
  });
  const [showContext, setShowContext] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [viewMode, setViewMode] = useState<'chat' | 'swarm'>('chat');

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      if (event.key !== 'Tab' || !event.shiftKey) {
        return;
      }

      event.preventDefault();
      void cyclePermissionMode();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cyclePermissionMode]);

  const handlePendingFeature = (feature: string) => {
    reportPendingFeature(feature);
  };

  return (
    <div
      className={cn(
        'relative flex h-screen w-full flex-col overflow-hidden bg-[#050505] text-gray-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-500 transition-all duration-700 ease-in-out',
        theme === 'light' ? 'light-theme' : '',
      )}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-indigo-900/20 via-transparent to-transparent" />
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-[-20%] left-[-10%] h-[60%] w-[60%] rounded-full bg-indigo-600/20 blur-[120px]"
        />
        <motion.div
          animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute bottom-[-20%] right-[-10%] h-[60%] w-[60%] rounded-full bg-cyan-600/20 blur-[150px]"
        />
        <motion.div
          animate={{ y: [0, -50, 0], opacity: [0.1, 0.4, 0.1] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute top-[40%] left-[30%] h-[40%] w-[40%] rounded-full bg-purple-600/10 blur-[120px]"
        />
      </div>

      <TopStatusBar
        state={globalState}
        permissionModeLabel={
          selectedSession ? formatPermissionModeLabel(selectedSession.permissionMode) : undefined
        }
        theme={theme}
        isRefreshing={isRefreshing}
        onToggleTheme={() => setTheme(current => (current === 'dark' ? 'light' : 'dark'))}
        onSettings={() => setShowSettings(true)}
        onRefresh={refresh}
        onReconnect={reconnect}
        onCyclePermissionMode={cyclePermissionMode}
        onToggleAutoRefresh={toggleAutoRefresh}
      />

      <div className="relative z-10 mx-auto flex max-w-[1920px] flex-1 overflow-hidden border-x border-white/[0.02] w-full">
        <AnimatePresence>
          {showSidebar && (
            <motion.div
              initial={{ x: -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="absolute top-0 bottom-0 left-0 z-40 flex md:relative md:z-20"
            >
              <div
                className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
                onClick={() => setShowSidebar(false)}
              />
              <div className="relative z-40 flex h-full w-72 flex-shrink-0 flex-col border-r border-white/[0.05] bg-[#0c0c0c] shadow-[20px_0_40px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all md:w-72 md:bg-black/40 md:shadow-none">
                <SessionSidebar
                  sessions={sessions}
                  selectedId={selectedSessionId}
                  onSelect={sessionId => {
                    setSelectedSessionId(sessionId);
                    if (window.innerWidth < 768) {
                      setShowSidebar(false);
                    }
                  }}
                  onCreateSession={() => handlePendingFeature('Crear sesión desde la UI')}
                  onRename={() => handlePendingFeature('Renombrar sesión')}
                  onArchive={() => handlePendingFeature('Archivar sesión')}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative flex flex-1 flex-col bg-transparent shadow-[inset_1px_0_0_0_rgba(255,255,255,0.02)]">
          <div className="z-30 flex items-center justify-between border-b border-white/[0.02] bg-black/20 p-3 backdrop-blur-md transition-colors">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSidebar(current => !current)}
                className="rounded-full text-gray-400 hover:text-white md:hidden"
              >
                <Sidebar className="h-4 w-4" />
              </Button>

              <div className="flex items-center space-x-2">
                <span className="text-sm font-semibold tracking-tight text-gray-200">
                  {selectedSession?.projectName || 'BotValia Runtime'}
                </span>
                {selectedSession && (
                  <span className="rounded border border-white/[0.05] bg-white/[0.02] px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-gray-500">
                    {selectedSession.status}
                  </span>
                )}
              </div>

              <div className="relative z-10 ml-6 hidden items-center rounded-full border border-white/[0.05] bg-black/50 p-1 shadow-inner sm:flex">
                <button
                  onClick={() => setViewMode('chat')}
                  className={cn(
                    'flex items-center space-x-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all shadow-sm',
                    viewMode === 'chat'
                      ? 'bg-indigo-500/10 text-indigo-500'
                      : 'text-gray-500 hover:text-gray-300',
                  )}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Chat</span>
                </button>
                <button
                  onClick={() => setViewMode('swarm')}
                  className={cn(
                    'flex items-center space-x-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all shadow-sm',
                    viewMode === 'swarm'
                      ? 'bg-indigo-500/10 text-indigo-500'
                      : 'text-gray-500 hover:text-gray-300',
                  )}
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>Swarm Agents</span>
                </button>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowContext(current => !current)}
              className="h-8 rounded-md border-white/[0.1] bg-white/[0.03] px-3 text-xs font-medium text-gray-300 shadow-none transition-all"
            >
              Panel Contexto
            </Button>
          </div>

          <div className="flex justify-center border-b border-white/[0.05] bg-black/50 p-2 transition-colors sm:hidden">
            <div className="flex w-full max-w-sm items-center rounded-full border border-white/[0.05] bg-black/60 p-1">
              <button
                onClick={() => setViewMode('chat')}
                className={cn(
                  'flex flex-1 items-center justify-center space-x-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all shadow-sm',
                  viewMode === 'chat'
                    ? 'bg-indigo-500/10 text-indigo-500'
                    : 'text-gray-500 hover:text-gray-300',
                )}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Chat</span>
              </button>
              <button
                onClick={() => setViewMode('swarm')}
                className={cn(
                  'flex flex-1 items-center justify-center space-x-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all shadow-sm',
                  viewMode === 'swarm'
                    ? 'bg-indigo-500/10 text-indigo-500'
                    : 'text-gray-500 hover:text-gray-300',
                )}
              >
                <Users className="h-3.5 w-3.5" />
                <span>Swarm</span>
              </button>
            </div>
          </div>

          {viewMode === 'chat' ? (
            <ConversationView messages={selectedSession?.messages || []} />
          ) : (
            <SwarmOfficeView
              swarm={selectedSession?.swarm}
              onDirectInstruction={() =>
                handlePendingFeature('Instrucción directa a un agente del swarm')
              }
            />
          )}

          <div className="z-20 mt-auto bg-gradient-to-t from-black via-black/80 to-transparent pt-3 pb-2 backdrop-blur-xl">
            <Composer
              isRunning={selectedSession?.status === 'running'}
              onSend={sendMessage}
              onStop={interrupt}
              onCyclePermissionMode={cyclePermissionMode}
              onAttach={() => handlePendingFeature('Adjuntar archivos desde la UI')}
              permissionModeLabel={
                selectedSession
                  ? formatPermissionModeLabel(selectedSession.permissionMode)
                  : undefined
              }
              disabled={!selectedSession || !globalState.isSocketConnected}
              placeholder={
                !selectedSession
                  ? 'No hay una sesión viva seleccionada...'
                  : viewMode === 'swarm'
                    ? 'Send global instruction to swarm...'
                    : undefined
              }
            />
          </div>
        </div>

        <AnimatePresence>
          {showContext && (
            <motion.div
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="absolute top-0 right-0 bottom-0 z-40 flex md:relative md:z-20"
            >
              <div
                className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
                onClick={() => setShowContext(false)}
              />
              <div className="relative z-40 h-full max-w-[85vw] w-80 flex-shrink-0 border-l border-white/[0.05] bg-[#0c0c0c] shadow-[0_0_40px_rgba(0,0,0,0.8)] backdrop-blur-2xl transition-all md:w-80 md:bg-black/60 md:shadow-none">
                <ContextPanel
                  session={selectedSession}
                  runtimeState={globalState}
                  onClose={() => setShowContext(false)}
                  onReconnect={reconnect}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="pointer-events-auto flex w-full max-w-lg flex-col rounded-2xl border border-white/[0.1] bg-[#111] p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Runtime Settings</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettings(false)}
                className="h-8 w-8 text-gray-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Theme
                </label>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTheme('dark')}
                    className={cn(
                      'transition-colors',
                      theme === 'dark'
                        ? 'border-indigo-500/50 bg-indigo-500/20 text-indigo-400'
                        : 'border-white/[0.1] bg-transparent text-gray-400',
                    )}
                  >
                    <Moon className="mr-1 h-3.5 w-3.5" /> Dark Premium
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTheme('light')}
                    className={cn(
                      'transition-colors',
                      theme === 'light'
                        ? 'border-indigo-500/50 bg-indigo-500/20 text-indigo-600'
                        : 'border-white/[0.1] bg-transparent text-gray-400',
                    )}
                  >
                    <Sun className="mr-1 h-3.5 w-3.5" /> Light Premium
                  </Button>
                </div>
              </div>

              <div>
                <label className="mb-2 mt-4 block text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Default Global Model
                </label>
                <select
                  disabled
                  onChange={() => handlePendingFeature('Cambiar modelo global del runtime')}
                  className="w-full rounded-lg border border-white/[0.1] bg-black p-2 text-sm text-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={selectedSession?.model || ''}
                >
                  <option value={selectedSession?.model || ''}>
                    {selectedSession?.model || 'Runtime-controlled'}
                  </option>
                </select>
                <p className="mt-2 text-[11px] text-amber-400/80">
                  Cambiar modelo desde la UI queda pendiente de soporte en el runtime.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Runtime WebSocket
                </label>
                <input
                  type="text"
                  value={globalState.runtimeUrl || 'No runtime URL'}
                  readOnly
                  className="w-full rounded-lg border border-white/[0.1] bg-black p-2 text-sm text-gray-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Local Workspace Root
                </label>
                <input
                  type="text"
                  value={selectedSession?.workspaceName || 'No active session'}
                  readOnly
                  className="w-full rounded-lg border border-white/[0.1] bg-black p-2 text-sm text-gray-400"
                />
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <Button
                onClick={() => setShowSettings(false)}
                className="bg-indigo-600 text-white hover:bg-indigo-500"
              >
                Save & Close
              </Button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            className="pointer-events-none fixed right-4 bottom-4 z-[120] max-w-md"
          >
            <div
              className={cn(
                'pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-xl',
                notice.kind === 'error'
                  ? 'border-red-500/20 bg-red-500/10 text-red-100'
                  : notice.kind === 'warn'
                    ? 'border-amber-500/20 bg-amber-500/10 text-amber-100'
                    : 'border-indigo-500/20 bg-indigo-500/10 text-indigo-100',
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-relaxed">{notice.message}</p>
              </div>
              <button
                onClick={dismissNotice}
                className="rounded-full p-1 text-current/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
