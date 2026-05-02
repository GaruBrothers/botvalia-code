import { RefreshCcw, Settings2, Wifi, Zap, Moon, Sun, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlobalRuntimeState } from "@/lib/types";

type TopStatusBarProps = {
  state: GlobalRuntimeState;
  theme?: 'dark' | 'light';
  isRefreshing?: boolean;
  onToggleTheme?: () => void;
  onSettings?: () => void;
  onRefresh?: () => void;
  onReconnect?: () => void;
  onToggleAutoRefresh?: () => void;
};

export function TopStatusBar({
  state,
  theme,
  isRefreshing,
  onToggleTheme,
  onSettings,
  onRefresh,
  onReconnect,
  onToggleAutoRefresh,
}: TopStatusBarProps) {
  return (
    <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-white/[0.05] bg-black/40 backdrop-blur-md px-5 z-50">
      <div className="flex items-center space-x-4">
        <div className="flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg w-8 h-8 shadow-[0_0_15px_rgba(99,102,241,0.3)]">
          <Zap className="h-4 w-4 text-white fill-current" />
        </div>
        <span className="text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-100 to-gray-400 tracking-tight">BotValia Code</span>
        
        <div className="h-4 w-px bg-white/[0.08] mx-2" />
        
        <Badge variant={state.isReady ? "success" : "warning"} className={`font-mono text-[10px] tracking-widest uppercase border-none px-2 py-0.5 rounded-full ${state.isReady ? 'bg-emerald-500/10 text-emerald-400 lg:text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'bg-amber-500/10 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.15)]'}`}>
          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${state.isReady ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          {state.isReady ? "Ready" : "Initializing"}
        </Badge>
        <Badge variant={state.isSocketConnected ? "success" : "destructive"} className={`font-mono text-[10px] uppercase gap-1.5 tracking-widest pl-2 pr-2.5 py-0.5 rounded-full border-none ${state.isSocketConnected ? 'bg-indigo-500/10 text-indigo-400 lg:text-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.2)]' : 'bg-red-500/10 text-red-300 shadow-[0_0_10px_rgba(239,68,68,0.15)]'}`}>
           <Wifi className={`h-3 w-3 ${state.isSocketConnected ? 'animate-pulse' : ''}`} />
          {state.isSocketConnected ? "Live" : "Offline"}
        </Badge>
      </div>

      <div className="flex items-center space-x-3">
        <button className="text-xs text-gray-500 font-mono tracking-tighter hover:text-gray-300 transition-colors">v3.1.0-alpha</button>
        <div className="h-4 w-px bg-white/[0.08]" />

        <Button variant="ghost" size="sm" onClick={onToggleAutoRefresh} className={`h-8 rounded-full px-3 text-[11px] font-semibold uppercase tracking-wider ${state.autoRefresh ? 'bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25' : 'text-gray-500 hover:bg-white/10 hover:text-gray-300'}`} title="Toggle auto refresh">
          Auto
        </Button>
        <Button variant="ghost" size="icon" onClick={onReconnect} className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all" title="Reconnect runtime">
          <RotateCcw className="h-4 w-4" />
        </Button>
        
        <Button variant="ghost" size="icon" onClick={onToggleTheme} className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all" title="Toggle Theme">
          {theme === 'light' ? <Moon className="h-4 w-4 text-indigo-500" /> : <Sun className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" onClick={onRefresh} className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all" title="Refresh runtime state">
          <RefreshCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
        <Button variant="ghost" size="icon" onClick={onSettings} className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all" title="Settings">
          <Settings2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
