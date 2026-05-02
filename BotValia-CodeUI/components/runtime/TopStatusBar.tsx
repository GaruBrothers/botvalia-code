import { Activity, RefreshCcw, Settings2, Wifi, Zap, Moon, Sun } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlobalRuntimeState } from "@/lib/types";

export function TopStatusBar({ state, theme, onToggleTheme, onSettings, onRefresh }: { state: GlobalRuntimeState, theme?: 'dark' | 'light', onToggleTheme?: () => void, onSettings?: () => void, onRefresh?: () => void }) {
  return (
    <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-white/[0.05] bg-black/40 backdrop-blur-md px-5 z-50">
      <div className="flex items-center space-x-4">
        <div className="flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg w-8 h-8 shadow-[0_0_15px_rgba(99,102,241,0.3)]">
          <Zap className="h-4 w-4 text-white fill-current" />
        </div>
        <span className="text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-100 to-gray-400 tracking-tight">BotValia Code</span>
        
        <div className="h-4 w-px bg-white/[0.08] mx-2" />
        
        <Badge variant={state.isReady ? "success" : "warning"} className="font-mono text-[10px] tracking-widest uppercase bg-emerald-500/10 text-emerald-400 lg:text-emerald-500 border-none px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.2)]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
          {state.isReady ? "Ready" : "Initializing"}
        </Badge>
        <Badge variant={state.isSocketConnected ? "success" : "destructive"} className="font-mono text-[10px] uppercase gap-1.5 tracking-widest pl-2 pr-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 lg:text-indigo-500 border-none shadow-[0_0_10px_rgba(99,102,241,0.2)]">
           <Wifi className="h-3 w-3 animate-pulse" />
          {state.isSocketConnected ? "Live" : "Offline"}
        </Badge>
      </div>

      <div className="flex items-center space-x-3">
        <button className="text-xs text-gray-500 font-mono tracking-tighter hover:text-gray-300 transition-colors">v3.1.0-alpha</button>
        <div className="h-4 w-px bg-white/[0.08]" />
        
        <Button variant="ghost" size="icon" onClick={onToggleTheme} className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all" title="Toggle Theme">
          {theme === 'light' ? <Moon className="h-4 w-4 text-indigo-500" /> : <Sun className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" onClick={onRefresh} className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all" title="Auto-refresh (mock)">
          <RefreshCcw className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onSettings} className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all" title="Settings">
          <Settings2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
