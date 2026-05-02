'use client';

import { useState, useEffect } from "react";
import { TopStatusBar } from "./TopStatusBar";
import { SessionSidebar } from "./SessionSidebar";
import { ConversationView } from "./ConversationView";
import { Composer } from "./Composer";
import { ContextPanel } from "./ContextPanel";
import { SwarmOfficeView } from "./SwarmOfficeView";
import { mockGlobalState, mockSessions } from "@/lib/mock-data";
import { Sidebar, MessageSquare, Users, Settings2, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "motion/react";

export function RuntimeShell() {
  const [globalState] = useState(mockGlobalState);
  const [sessions, setSessions] = useState(mockSessions);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(sessions[0]?.id || null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  
  const [showSidebar, setShowSidebar] = useState(true);
  const [showContext, setShowContext] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [viewMode, setViewMode] = useState<'chat' | 'swarm'>('chat');

  useEffect(() => {
    if (window.innerWidth < 768) {
      setShowSidebar(false);
    }
  }, []);

  const selectedSession = sessions.find(s => s.id === selectedSessionId) || null;

  const handleSend = (text: string) => {
    console.log("Send to session:", selectedSessionId, "text:", text);
    // In a real app we'd dispatch to WebSocket or local API here
  };

  const handleStop = () => {
    alert("Mock: Request to halt agent processing sent.");
  };

  const handleRename = (id: string, newTitle: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s));
  };

  const handleArchive = (id: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, archived: true } : s));
    if (selectedSessionId === id) {
      setSelectedSessionId(sessions.find(s => s.id !== id && !s.archived)?.id || null);
    }
  };

  return (
    <div className={cn("flex h-screen w-full flex-col bg-[#050505] text-gray-100 overflow-hidden font-sans selection:bg-indigo-500/30 selection:text-indigo-500 relative transition-all duration-700 ease-in-out", theme === 'light' ? 'light-theme' : '')}>
      {/* Premium Animated AI Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-indigo-900/20 via-transparent to-transparent pointer-events-none" />
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-600/20 blur-[120px]" 
        />
        <motion.div 
          animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-cyan-600/20 blur-[150px]" 
        />
        <motion.div 
          animate={{ y: [0, -50, 0], opacity: [0.1, 0.4, 0.1] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute top-[40%] left-[30%] w-[40%] h-[40%] rounded-full bg-purple-600/10 blur-[120px]" 
        />
      </div>

      <TopStatusBar 
        state={globalState} 
        theme={theme}
        onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
        onSettings={() => setShowSettings(true)}
        onRefresh={() => alert("Mock: Reloading runtime state...")}
      />
      
      <div className="flex flex-1 overflow-hidden relative z-10 w-[100%] max-w-[1920px] mx-auto border-x border-white/[0.02]">
        {/* Left Sidebar */}
        <AnimatePresence>
        {showSidebar && (
           <motion.div 
             initial={{ x: -300, opacity: 0 }}
             animate={{ x: 0, opacity: 1 }}
             exit={{ x: -300, opacity: 0 }}
             transition={{ type: "spring", stiffness: 300, damping: 30 }}
             className="absolute top-0 bottom-0 left-0 md:relative z-40 md:z-20 flex"
           >
             {/* Mobile Overlay */}
             <div 
               className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30"
               onClick={() => setShowSidebar(false)}
             />
             <div className="relative z-40 border-r border-white/[0.05] bg-[#0c0c0c] md:bg-black/40 backdrop-blur-xl transition-all w-72 md:w-72 flex-shrink-0 flex flex-col h-full shadow-[20px_0_40px_rgba(0,0,0,0.5)] md:shadow-none">
               <SessionSidebar 
                 sessions={sessions} 
                 selectedId={selectedSessionId} 
                 onSelect={(id) => {
                    setSelectedSessionId(id);
                    if (window.innerWidth < 768) setShowSidebar(false);
                 }} 
                 onRename={handleRename}
                 onArchive={handleArchive}
               />
             </div>
           </motion.div>
        )}
        </AnimatePresence>

        {/* Main Conversation Area */}
        <div className="flex flex-1 flex-col relative bg-transparent shadow-[inset_1px_0_0_0_rgba(255,255,255,0.02)]">
           <div className="flex items-center justify-between p-3 border-b border-white/[0.02] bg-black/20 backdrop-blur-md z-30 transition-colors">
              <div className="flex items-center space-x-4">
                <Button variant="ghost" size="icon" onClick={() => setShowSidebar(!showSidebar)} className="md:hidden text-gray-400 hover:text-white rounded-full">
                  <Sidebar className="h-4 w-4" />
                </Button>
                {selectedSession && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-semibold text-gray-200 tracking-tight">
                      {selectedSession.projectName}
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono tracking-wider border border-white/[0.05] bg-white/[0.02] px-1.5 py-0.5 rounded uppercase">
                      {selectedSession.status}
                    </span>
                  </div>
                )}
                
                {/* View Toggle */}
                <div className="hidden sm:flex items-center ml-6 bg-black/50 border border-white/[0.05] rounded-full p-1 shadow-inner relative z-10 transition-colors">
                  <button
                    onClick={() => setViewMode('chat')}
                    className={cn("flex items-center space-x-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all shadow-sm",
                      viewMode === 'chat' ? "bg-indigo-500/10 text-indigo-500" : "text-gray-500 hover:text-gray-300"
                    )}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Chat</span>
                  </button>
                  <button
                    onClick={() => setViewMode('swarm')}
                    className={cn("flex items-center space-x-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all shadow-sm",
                      viewMode === 'swarm' ? "bg-indigo-500/10 text-indigo-500" : "text-gray-500 hover:text-gray-300"
                    )}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Swarm Agents</span>
                  </button>
                </div>
              </div>

              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowContext(!showContext)}
                className="h-8 text-xs font-medium border-white/[0.1] bg-white/[0.03] shadow-none text-gray-300 transition-all rounded-md px-3"
              >
                Panel Contexto
              </Button>
           </div>
           
           {/* Mobile View Toggle */}
           <div className="sm:hidden flex p-2 bg-black/50 border-b border-white/[0.05] justify-center transition-colors">
             <div className="flex items-center bg-black/60 border border-white/[0.05] rounded-full p-1 w-full max-w-sm">
                <button
                  onClick={() => setViewMode('chat')}
                  className={cn("flex-1 flex justify-center items-center space-x-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all shadow-sm",
                    viewMode === 'chat' ? "bg-indigo-500/10 text-indigo-500" : "text-gray-500 hover:text-gray-300"
                  )}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Chat</span>
                </button>
                <button
                  onClick={() => setViewMode('swarm')}
                  className={cn("flex-1 flex justify-center items-center space-x-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all shadow-sm",
                    viewMode === 'swarm' ? "bg-indigo-500/10 text-indigo-500" : "text-gray-500 hover:text-gray-300"
                  )}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Swarm</span>
                </button>
             </div>
           </div>

           {viewMode === 'chat' ? (
             <ConversationView messages={selectedSession?.messages || []} />
           ) : (
             <SwarmOfficeView swarm={selectedSession?.swarm} />
           )}
           
           <div className="mt-auto backdrop-blur-xl bg-gradient-to-t from-black via-black/80 to-transparent pt-6 pb-4 z-20">
             <Composer 
               isRunning={selectedSession?.status === "running"} 
               onSend={handleSend}
               onStop={handleStop}
               placeholder={viewMode === 'swarm' ? "Send global instruction to swarm..." : undefined}
             />
           </div>
        </div>

        {/* Right Context Panel */}
        <AnimatePresence>
        {showContext && (
           <motion.div 
             initial={{ x: 300, opacity: 0 }}
             animate={{ x: 0, opacity: 1 }}
             exit={{ x: 300, opacity: 0 }}
             transition={{ type: "spring", stiffness: 300, damping: 30 }}
             className="absolute right-0 top-0 bottom-0 z-40 md:relative md:z-20 flex"
           >
             {/* Mobile Overlay */}
             <div 
               className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30"
               onClick={() => setShowContext(false)}
             />
             <div className="relative z-40 bg-[#0c0c0c] md:bg-black/60 backdrop-blur-2xl border-l border-white/[0.05] shadow-[0_0_40px_rgba(0,0,0,0.8)] md:shadow-none transition-all flex-shrink-0 w-80 md:w-80 h-full max-w-[85vw]">
               <ContextPanel session={selectedSession} onClose={() => setShowContext(false)} />
             </div>
           </motion.div>
        )}
        </AnimatePresence>
      </div>
      
      {/* Settings Modal Overlay */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-[#111] border border-white/[0.1] rounded-2xl w-full max-w-lg p-6 shadow-2xl flex flex-col pointer-events-auto">
             <div className="flex items-center justify-between mb-6">
               <h3 className="text-lg font-semibold text-white">Runtime Settings</h3>
               <Button variant="ghost" size="icon" onClick={() => setShowSettings(false)} className="h-8 w-8 text-gray-400 hover:text-white">
                 <Settings2 className="h-4 w-4" />
               </Button>
             </div>
             
             <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-widest font-semibold block mb-2">Theme</label>
                  <div className="flex space-x-2">
                    <Button 
                       variant="outline" 
                       size="sm" 
                       onClick={() => setTheme('dark')} 
                       className={cn("transition-colors", theme === 'dark' ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-400" : "bg-transparent border-white/[0.1] text-gray-400")}
                    >
                      <Moon className="w-3.5 h-3.5 mr-1" /> Dark Premium
                    </Button>
                    <Button 
                       variant="outline" 
                       size="sm" 
                       onClick={() => setTheme('light')} 
                       className={cn("transition-colors", theme === 'light' ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-600" : "bg-transparent border-white/[0.1] text-gray-400")}
                    >
                      <Sun className="w-3.5 h-3.5 mr-1" /> Light Premium
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-widest font-semibold block mb-2 mt-4">Default Global Model</label>
                  <select className="w-full bg-black border border-white/[0.1] rounded-lg p-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                    <option value="gemini-3.1-pro">Gemini 3.1 Pro</option>
                    <option value="gemini-3.1-flash">Gemini 3.1 Flash</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-widest font-semibold block mb-2">Local Workspace Root</label>
                  <input type="text" value="/Users/dev/botvalia-projects" readOnly className="w-full bg-black border border-white/[0.1] rounded-lg p-2 text-sm text-gray-400" />
                </div>
             </div>

             <div className="flex justify-end mt-8">
               <Button onClick={() => setShowSettings(false)} className="bg-indigo-600 text-white hover:bg-indigo-500">
                 Save & Close
               </Button>
             </div>
           </div>
        </div>
      )}
    </div>
  )
}
