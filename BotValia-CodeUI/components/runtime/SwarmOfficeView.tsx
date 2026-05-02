import { SwarmState, AgentTask } from "@/lib/types";
import { Users, Bot, Code, Edit3, Shield, Zap, Search, ArrowRight, CheckCircle2, Clock, PlayCircle, XCircle, ListTodo } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

function getAgentIcon(role: string) {
  if (role.toLowerCase().includes('data')) return <Search className="w-5 h-5 text-blue-400" />;
  if (role.toLowerCase().includes('design')) return <Edit3 className="w-5 h-5 text-pink-400" />;
  if (role.toLowerCase().includes('qa') || role.toLowerCase().includes('test')) return <Shield className="w-5 h-5 text-purple-400" />;
  if (role.toLowerCase().includes('code')) return <Code className="w-5 h-5 text-indigo-400" />;
  return <Bot className="w-5 h-5 text-emerald-400" />;
}

function TaskStatusBadge({ status }: { status: AgentTask['status'] }) {
  const baseClasses = "flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] uppercase tracking-widest font-bold border backdrop-blur-md transition-colors";
  switch (status) {
    case 'pending':
      return <span className={cn(baseClasses, "bg-gray-500/10 text-gray-400 border-gray-500/20")}><Clock className="w-3 h-3" /> Pending</span>;
    case 'active':
      return <span className={cn(baseClasses, "bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-[0_0_10px_rgba(99,102,241,0.2)]")}><PlayCircle className="w-3 h-3 text-indigo-400 animate-pulse" /> Active</span>;
    case 'completed':
      return <span className={cn(baseClasses, "bg-emerald-500/10 text-emerald-400 border-emerald-500/20")}><CheckCircle2 className="w-3 h-3" /> Done</span>;
    case 'failed':
      return <span className={cn(baseClasses, "bg-red-500/10 text-red-400 border-red-500/20")}><XCircle className="w-3 h-3" /> Failed</span>;
    default:
      return null;
  }
}

export function SwarmOfficeView({ swarm }: { swarm: SwarmState | undefined }) {
  if (!swarm) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-500 text-sm opacity-50 select-none">
        <div className="w-16 h-16 mb-4 rounded-full border border-white/[0.05] bg-white/[0.02] flex items-center justify-center shadow-inner">
          <Users className="w-6 h-6 text-gray-400 opacity-50" />
        </div>
        No active swarm for this session.
      </div>
    );
  }

  const unassignedTasks = swarm.tasks?.filter(t => !t.assigneeId) || [];

  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-8 py-8 w-full max-w-6xl mx-auto flex flex-col scrollbar-hide relative">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-500/20 rounded-lg border border-indigo-500/30">
            <Users className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-100 tracking-tight">{swarm.activeTeam}</h2>
            <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mt-0.5">Live Team Sync</p>
          </div>
        </div>
      </div>

      {/* Unassigned Tasks */}
      {unassignedTasks.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center space-x-2 mb-3 px-1">
            <ListTodo className="w-4 h-4 text-gray-400" />
            <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400">Team Backlog</h3>
            <span className="bg-white/[0.05] border border-white/[0.05] text-gray-400 text-[10px] px-1.5 py-0.5 rounded-sm">{unassignedTasks.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {unassignedTasks.map(task => (
              <div key={task.id} className="p-3 rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02] flex flex-col space-y-2 relative overflow-hidden group">
                <div className="flex justify-between items-start">
                  <span className="text-sm text-gray-300 font-medium pl-1">{task.description}</span>
                </div>
                <div className="flex justify-start">
                  <TaskStatusBadge status={task.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Office Grid (Teammates) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {swarm.teammates.map((agent) => {
          const isWorking = agent.status !== 'idle';
          const assignedTasks = swarm.tasks?.filter(t => t.assigneeId === agent.id) || [];
          
          return (
            <motion.div 
              key={agent.id}
              layoutId={`agent-${agent.id}`}
              className={cn(
                "relative p-5 rounded-2xl border bg-black/40 backdrop-blur-md flex flex-col transition-all",
                isWorking ? "border-indigo-500/30 shadow-[0_4px_20px_rgba(99,102,241,0.15)]" : "border-white/[0.05]"
              )}
            >
              {/* Background glow if working */}
              {isWorking && (
                <div className="absolute inset-0 bg-indigo-500/5 blur-xl -z-10 rounded-2xl" />
              )}

              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg relative"
                    style={{ backgroundColor: `${agent.avatarColor || '#6366f1'}33`, border: `1px solid ${agent.avatarColor || '#6366f1'}80` }}
                  >
                    {getAgentIcon(agent.role)}
                    {/* Status dot */}
                    <span className={cn("absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[#0f0f11]",
                      isWorking ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-gray-500"
                    )} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-200 text-base">{agent.name}</h3>
                    <p className="text-xs text-gray-500">{agent.role}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className={cn("text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded",
                     isWorking ? "bg-indigo-500/20 text-indigo-300" : "bg-white/[0.05] text-gray-400"
                  )}>
                    {agent.status}
                  </span>
                </div>
              </div>

              {assignedTasks.length > 0 && (
                <div className="mt-4 space-y-3 flex-grow border-t border-white/[0.05] pt-4">
                   <div className="flex items-center justify-between text-[10px] uppercase tracking-widest font-semibold text-gray-500 px-1">
                     <span>Assigned Tasks</span>
                     <span className={cn("px-2 py-0.5 rounded-full font-bold border", isWorking ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/20" : "bg-white/[0.02] text-gray-500 border-white/[0.05]")}>{assignedTasks.length}</span>
                   </div>
                   <div className="space-y-2">
                     {assignedTasks.map(task => (
                       <div key={task.id} className={cn(
                           "p-3 rounded-xl border flex flex-col space-y-3 relative overflow-hidden transition-all duration-300 group",
                           task.status === 'active' ? "bg-indigo-500/5 border-indigo-500/20 shadow-[0_2px_15px_rgba(99,102,241,0.08)]" : "bg-black/40 border-white/[0.05] hover:border-white/[0.1] hover:bg-white/[0.02]"
                         )}
                       >
                         {task.status === 'active' && <div className="absolute top-0 left-0 bottom-0 w-1 bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.6)]" />}
                         {task.status === 'completed' && <div className="absolute top-0 left-0 bottom-0 w-1 bg-emerald-500/40" />}
                         {task.status === 'failed' && <div className="absolute top-0 left-0 bottom-0 w-1 bg-red-500/40" />}
                         <div className="text-xs text-gray-200 line-clamp-2 leading-relaxed ml-1 font-medium">
                           {task.description}
                         </div>
                         <div className="flex justify-start ml-1 mt-1">
                           <TaskStatusBadge status={task.status} />
                         </div>
                       </div>
                     ))}
                   </div>
                </div>
              )}

              {/* Direct Instruction Input */}
              <div className="mt-4 pt-4 border-t border-white/[0.05] flex items-center relative group/input mt-auto">
                <input
                  type="text"
                  placeholder={`Direct instruction to ${agent.name}...`}
                  className="w-full bg-black/50 border border-white/[0.1] rounded-lg pl-3 pr-8 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all shadow-inner"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                      alert(`Sent direct instruction to ${agent.name}: ${e.currentTarget.value}`);
                      e.currentTarget.value = '';
                    }
                  }}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within/input:text-indigo-400 transition-colors pointer-events-none">
                  <Zap className="w-3.5 h-3.5" />
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Live Multi-Agent Communication Log Below */}
      <div className="mt-8 rounded-2xl border border-white/[0.05] bg-black/40 backdrop-blur-md flex flex-col overflow-hidden max-h-[400px]">
        <div className="p-4 border-b border-white/[0.05] bg-white/[0.02]">
          <h3 className="text-sm font-semibold tracking-tight text-gray-200">Interaction History</h3>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {swarm.internalChat && swarm.internalChat.length > 0 ? (
            swarm.internalChat.map((chat) => {
              const receiver = chat.toId ? swarm.teammates.find(t => t.id === chat.toId)?.name || 'Swarm' : 'Swarm';

              return (
                <div key={chat.id} className="flex flex-col mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-2 text-xs font-semibold">
                      <span className="text-indigo-300">{chat.fromName}</span>
                      <ArrowRight className="w-3 h-3 text-gray-500" />
                      <span className="text-emerald-300">{receiver}</span>
                    </div>
                    <span className="text-[10px] text-gray-600 font-mono" suppressHydrationWarning>
                      {new Date(chat.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-sm text-gray-300 bg-white/[0.03] border border-white/[0.05] rounded-xl rounded-tl-sm p-3 shadow-inner">
                    {chat.content}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center text-xs text-gray-500 mt-10">No recent communication.</div>
          )}
          <div className="h-4" />
        </div>
      </div>
    </div>
  );
}
