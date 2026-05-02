import { useState } from "react";
import { X, Network, Activity, FileJson, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Session } from "@/lib/types";
import { motion, AnimatePresence } from "motion/react";

type TabId = 'ahora' | 'swarm' | 'eventos' | 'json';

export function ContextPanel({ session, onClose }: { session: Session | null, onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<TabId>('ahora');

  if (!session) return null;

  return (
    <div className="flex h-full w-full flex-col bg-transparent">
      <div className="flex items-center justify-between border-b border-white/[0.05] p-4">
        <h3 className="text-sm font-semibold text-gray-200 tracking-tight">Contexto</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex border-b border-white/[0.05] px-2 overflow-x-auto scrollbar-hide">
        {[
          { id: 'ahora', label: 'Ahora', icon: Clock },
          { id: 'swarm', label: 'Swarm', icon: Network },
          { id: 'eventos', label: 'Eventos', icon: Activity },
          { id: 'json', label: 'JSON', icon: FileJson },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as TabId)}
            className={`relative flex items-center whitespace-nowrap px-3 py-3 text-xs font-medium transition-colors outline-none ${
              activeTab === t.id 
                ? 'text-indigo-300' 
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <t.icon className="mr-1.5 h-3.5 w-3.5" />
            {t.label}
            {activeTab === t.id && (
              <motion.div 
                layoutId="context-tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-t-full shadow-[0_-2px_8px_rgba(99,102,241,0.5)]"
              />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-5 scrollbar-hide relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, scale: 0.98, filter: 'blur(2px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.98, filter: 'blur(2px)' }}
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            {activeTab === 'ahora' && (
              <>
                <div className="group">
                  <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1.5 font-semibold">Project</div>
                  <div className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors">{session.projectName}</div>
                </div>
                <div className="group">
                  <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1.5 font-semibold">Workspace</div>
                  <div className="text-sm text-gray-300 group-hover:text-white transition-colors">{session.workspaceName}</div>
                </div>
                <div className="group">
                  <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1.5 font-semibold">Model</div>
                  <div className="text-xs text-indigo-300 font-mono bg-indigo-500/10 border border-indigo-500/20 inline-block px-2 py-1 rounded shadow-sm">
                    {session.model}
                  </div>
                </div>
                <div className="group">
                  <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1.5 font-semibold">Messages</div>
                  <div className="text-sm text-gray-300 group-hover:text-white transition-colors">{session.messages.length}</div>
                </div>
              </>
            )}

            {activeTab === 'swarm' && (
              <>
                {session.swarm ? (
                  <>
                     <div className="bg-white/[0.02] border border-white/[0.05] p-4 rounded-xl shadow-inner">
                        <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1.5 font-semibold">Active Team</div>
                        <div className="text-sm font-semibold text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]">{session.swarm.activeTeam}</div>
                     </div>
                     {session.swarm.waitingOn && (
                       <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl shadow-[0_0_15px_rgba(245,158,11,0.05)]">
                         <div className="text-[10px] uppercase tracking-widest text-amber-500/70 mb-1 font-semibold">Waiting On</div>
                         <div className="text-sm font-medium text-amber-300">{session.swarm.waitingOn}</div>
                       </div>
                     )}
                     <div>
                        <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-3 font-semibold">Teammates</div>
                        <div className="space-y-2">
                          {session.swarm.teammates.map(t => (
                            <div key={t.id} className="flex justify-between items-center text-sm border border-white/[0.05] bg-white/[0.02] p-2 rounded-lg">
                               <div className="flex items-center space-x-3">
                                 <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-[10px] font-bold shadow-md">
                                    {t.name[0]}
                                 </div>
                                 <div>
                                   <div className="text-gray-200 font-medium">{t.name}</div>
                                   <div className="text-[10px] text-gray-500">{t.role}</div>
                                 </div>
                               </div>
                               <span className={`h-2 w-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)] ${t.status === 'working' ? 'bg-emerald-400 shadow-emerald-500/50' : 'bg-gray-600'}`}/>
                            </div>
                          ))}
                        </div>
                     </div>
                     {session.swarm.tasks.length > 0 && (
                       <div>
                          <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-3 font-semibold">Tasks</div>
                          <div className="space-y-1.5">
                            {session.swarm.tasks.map(t => (
                              <div key={t.id} className="text-xs text-gray-300 flex items-start space-x-2 bg-white/[0.02] p-2 rounded-md border border-white/[0.02]">
                                 <span className={`mt-0.5 ${t.status === 'completed' ? 'text-emerald-400' : t.status === 'active' ? 'text-indigo-400' : 'text-gray-600'}`}>
                                   {t.status === 'completed' ? '✓' : t.status === 'active' ? '●' : '○'}
                                 </span>
                                 <span>{t.description}</span>
                              </div>
                            ))}
                          </div>
                       </div>
                     )}
                  </>
                ) : (
                  <div className="text-sm text-gray-500 text-center py-6">No swarm active in this session.</div>
                )}
              </>
            )}

            {activeTab === 'eventos' && (
              <>
                 {session.events.length === 0 && (
                   <div className="text-sm text-gray-500 text-center py-6">No events recorded.</div>
                 )}
                 <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[5px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/[0.1] before:to-transparent">
                   {session.events.map(ev => (
                     <div key={ev.id} className="relative flex items-start space-x-3">
                       <div className={`mt-1 flex items-center justify-center w-3 h-3 rounded-full ring-4 ring-black z-10 shadow-[0_0_8px_rgba(0,0,0,0.8)] ${
                         ev.type === 'error' ? 'bg-red-400' : ev.type === 'warn' ? 'bg-amber-400' : 'bg-indigo-400'
                       }`} />
                       <div className="flex-1 bg-white/[0.02] border border-white/[0.05] p-2.5 rounded-lg space-y-1">
                         <div className="flex justify-between items-center">
                           <span className="text-[10px] text-gray-500 font-mono" suppressHydrationWarning>{new Date(ev.timestamp).toLocaleTimeString()}</span>
                           <span className={`text-[9px] uppercase tracking-widest font-bold ${ev.type === 'error' ? 'text-red-400' : ev.type === 'warn' ? 'text-amber-400' : 'text-gray-500'}`}>{ev.type}</span>
                         </div>
                         <div className="text-xs text-gray-300 shadow-sm leading-relaxed">{ev.message}</div>
                       </div>
                     </div>
                   ))}
                 </div>
              </>
            )}

            {activeTab === 'json' && (
              <div className="bg-black/50 border border-white/[0.05] rounded-xl p-3 shadow-inner">
                <pre className="text-[10px] text-gray-400 font-mono overflow-auto scollbar-hide">
                   {JSON.stringify(session, null, 2)}
                </pre>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
