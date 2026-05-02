import { Search, Hash, Users, Plus, MoreHorizontal, Folder, FolderOpen, Archive, Edit2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Session } from "@/lib/types";
import { cn } from "@/lib/utils";
import * as motion from "motion/react-client";
import { useState, useMemo } from "react";

function StatusDot({ status }: { status: Session['status'] }) {
  return (
    <span className={cn("h-1.5 w-1.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]", {
      "bg-emerald-400 shadow-emerald-500/50": status === "running",
      "bg-amber-400 shadow-amber-500/50": status === "waiting",
      "bg-gray-500": status === "idle",
      "bg-red-400 shadow-red-500/50": status === "error",
      "bg-blue-400 shadow-blue-500/50": status === "completed",
    })} />
  );
}

interface SidebarProps {
  sessions: Session[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRename?: (id: string, newTitle: string) => void;
  onArchive?: (id: string) => void;
}

export function SessionSidebar({ sessions, selectedId, onSelect, onRename, onArchive }: SidebarProps) {
  const [search, setSearch] = useState("");
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectPath, setNewProjectPath] = useState("");
  const [renameModalContext, setRenameModalContext] = useState<{ id: string, title: string } | null>(null);

  const filteredSessions = useMemo(() => {
    return sessions.filter(s => 
      !s.archived && 
      (s.projectName.toLowerCase().includes(search.toLowerCase()) || 
       s.title?.toLowerCase().includes(search.toLowerCase()))
    );
  }, [sessions, search]);

  const grouped = useMemo(() => {
    const groups: Record<string, Session[]> = {};
    for (const s of filteredSessions) {
      if (!groups[s.projectName]) groups[s.projectName] = [];
      groups[s.projectName].push(s);
    }
    return groups;
  }, [filteredSessions]);

  const toggleProject = (proj: string) => {
    setExpandedProjects(prev => ({ ...prev, [proj]: prev[proj] === false ? true : false }));
  };

  const handleCreateProject = () => {
    if (!newProjectName.trim()) return;
    // Mock action
    setShowNewProjectModal(false);
    setNewProjectName("");
    setNewProjectPath("");
  };

  return (
    <div className="flex h-full w-full flex-col bg-transparent relative">
      <div className="p-4 border-b border-white/[0.05] flex flex-col space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Workspace</span>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/20" onClick={() => setShowNewProjectModal(true)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative group">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500 group-focus-within:text-indigo-400 transition-colors" />
          <Input 
            placeholder="Search sessions..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-white/[0.03] border-white/[0.05] hover:bg-white/[0.05] focus-visible:ring-indigo-500/50 focus-visible:border-indigo-500/50 rounded-lg shadow-inner transition-all text-sm"
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {Object.entries(grouped).map(([projectName, projSessions]) => {
          const isExpanded = expandedProjects[projectName] !== false; // true by default

          return (
            <div key={projectName} className="space-y-1">
              <button 
                onClick={() => toggleProject(projectName)}
                className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors group"
              >
                <div className="flex items-center space-x-2">
                  {isExpanded ? <FolderOpen className="w-3.5 h-3.5" /> : <Folder className="w-3.5 h-3.5" />}
                  <span className="tracking-wide">{projectName}</span>
                </div>
                <span className="text-[10px] bg-white/[0.05] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                  {projSessions.length}
                </span>
              </button>

              {isExpanded && (
                <div className="pl-2 space-y-1 mt-1">
                  {projSessions.map(s => {
                    const isSelected = s.id === selectedId;
                    return (
                      <div key={s.id} className="relative group/item">
                        <button
                          onClick={() => onSelect(s.id)}
                          className="w-full text-left relative outline-none flex flex-col p-2.5 rounded-xl transition-all duration-200 active:scale-[0.98] cursor-pointer"
                        >
                          {isSelected && (
                            <motion.div 
                               layoutId="active-session-bg"
                               className="absolute inset-0 bg-white/[0.08] ring-1 ring-white/[0.1] rounded-xl z-0"
                               transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                          )}
                          
                          <div className="relative z-10">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center space-x-2">
                                <StatusDot status={s.status} />
                                <span className={cn("font-medium text-[13px] transition-colors tracking-tight line-clamp-1", isSelected ? "text-white" : "text-gray-300 group-hover/item:text-gray-100")}>
                                  {s.title || s.projectName}
                                </span>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between mt-1.5">
                              <div className="text-[10px] text-gray-500 font-mono mix-blend-plus-lighter truncate w-24">
                                {s.model}
                              </div>
                              <div className="flex items-center space-x-2 flex-shrink-0">
                                {s.swarm && (
                                  <Badge variant="outline" className="h-[16px] px-1 text-[9px] gap-1 border-indigo-500/20 bg-indigo-500/10 text-indigo-300 rounded-md">
                                    <Users className="w-2.5 h-2.5" />
                                    {s.swarm.teammates.length}
                                  </Badge>
                                )}
                                <span className="text-[9px] text-gray-500 font-mono">
                                  {s.messages.length}m
                                </span>
                              </div>
                            </div>
                          </div>
                        </button>
                        
                        {/* Context Menu (Hover) */}
                        <div className="absolute right-2 top-2 opacity-0 group-hover/item:opacity-100 transition-opacity flex space-x-1 z-20">
                           <button 
                             onClick={(e) => { e.stopPropagation(); onArchive?.(s.id); }}
                             className="p-1 rounded-md bg-black/60 border border-white/[0.1] text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                             title="Archive"
                           >
                             <Archive className="w-3 h-3" />
                           </button>
                           <button 
                             onClick={(e) => { 
                               e.stopPropagation(); 
                               setRenameModalContext({ id: s.id, title: s.title || s.projectName });
                             }}
                             className="p-1 rounded-md bg-black/60 border border-white/[0.1] text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                             title="Rename"
                           >
                             <Edit2 className="w-3 h-3" />
                           </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* New Project Modal Overlay */}
      {showNewProjectModal && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-[#111] border border-white/[0.1] rounded-2xl w-full max-w-sm p-5 shadow-2xl flex flex-col">
             <h3 className="text-sm font-semibold text-white mb-4">Create New Project</h3>
             
             <div className="space-y-3">
               <div>
                 <label className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-1.5 block">Project Name</label>
                 <Input 
                   value={newProjectName}
                   onChange={e => setNewProjectName(e.target.value)}
                   placeholder="e.g. Acme Web" 
                   className="h-9 bg-white/[0.03] border-white/[0.05] text-sm"
                 />
               </div>
               <div>
                 <label className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-1.5 block">Local Path</label>
                 <div className="flex space-x-2">
                   <Input 
                     value={newProjectPath}
                     onChange={e => setNewProjectPath(e.target.value)}
                     placeholder="/Users/dev/acme" 
                     className="h-9 bg-white/[0.03] border-white/[0.05] text-sm flex-1"
                   />
                   <Button 
                     variant="outline" 
                     size="sm"
                     className="h-9 px-3 border-white/[0.05] bg-white/[0.03] hover:bg-white/[0.08]"
                     onClick={(e) => {
                        e.preventDefault();
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.webkitdirectory = true;
                        input.onchange = (e: any) => {
                          const files = e.target.files;
                          if (files && files.length > 0) {
                            // Extract just the first folder name for mock path
                            const path = files[0].webkitRelativePath.split('/')[0];
                            setNewProjectPath(`/${path}`);
                            if (!newProjectName) {
                              setNewProjectName(path);
                            }
                          }
                        };
                        input.click();
                     }}
                   >
                     Browse
                   </Button>
                 </div>
               </div>
             </div>

             <div className="flex justify-end space-x-2 mt-6">
                <Button variant="ghost" size="sm" onClick={() => setShowNewProjectModal(false)} className="text-gray-400 hover:text-white hover:bg-white/[0.05]">
                  Cancel
                </Button>
                <Button size="sm" onClick={handleCreateProject} disabled={!newProjectName} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                  Create
                </Button>
             </div>
           </div>
        </div>
      )}

      {/* Rename Chat Modal Overlay */}
      {renameModalContext && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-[var(--color-panel,#111)] border border-[var(--color-border-subtle)] rounded-2xl w-full max-w-sm p-5 shadow-2xl flex flex-col">
             <h3 className="text-sm font-semibold text-[var(--color-text-main)] mb-4">Rename Chat</h3>
             
             <div className="space-y-3">
               <div>
                 <label className="text-xs text-[var(--color-text-muted)] uppercase tracking-widest font-semibold mb-1.5 block">New Title</label>
                 <Input 
                   value={renameModalContext.title}
                   onChange={e => setRenameModalContext({ ...renameModalContext, title: e.target.value })}
                   onKeyDown={(e) => {
                     if (e.key === 'Enter' && renameModalContext.title.trim()) {
                       onRename?.(renameModalContext.id, renameModalContext.title);
                       setRenameModalContext(null);
                     }
                   }}
                   placeholder="e.g. Debug Login Issue" 
                   className="h-9 bg-[var(--color-glass-bg)] border-[var(--color-border-subtle)] text-[var(--color-text-main)] text-sm"
                   autoFocus
                 />
               </div>
             </div>

             <div className="flex justify-end space-x-2 mt-6">
                <Button variant="ghost" size="sm" onClick={() => setRenameModalContext(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-glass-border)]">
                  Cancel
                </Button>
                <Button size="sm" onClick={() => {
                   if (renameModalContext.title.trim()) {
                     onRename?.(renameModalContext.id, renameModalContext.title);
                     setRenameModalContext(null);
                   }
                }} disabled={!renameModalContext.title.trim()} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                  Rename
                </Button>
             </div>
           </div>
        </div>
      )}
    </div>
  )
}
