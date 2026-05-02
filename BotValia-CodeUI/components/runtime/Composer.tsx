import { useState, useRef } from "react";
import { ArrowUp, Sparkles, StopCircle, Zap, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const QUICK_PROMPTS = ["Resumen", "Estado", "Coordinar swarm"];

const COMMANDS = [
  { name: "/init", desc: "Initialize workspace" },
  { name: "/modal", desc: "Open modal component" },
  { name: "/clear", desc: "Clear chat history" },
  { name: "/help", desc: "Show available commands" }
];

const SKILLS = [
  { name: "@FrontendDesign", desc: "Design & UX guidelines" },
  { name: "@GeminiAPI", desc: "AI integrations" },
  { name: "@Firestore", desc: "Database recipes" },
  { name: "@OAuth", desc: "Auth integration" }
];

type ComposerProps = {
  isRunning: boolean;
  onSend: (text: string) => void;
  onStop?: () => void;
  onAttach?: () => void;
  onCyclePermissionMode?: () => void;
  placeholder?: string;
  permissionModeLabel?: string;
  disabled?: boolean;
};

export function Composer({
  isRunning,
  onSend,
  onStop,
  onAttach,
  onCyclePermissionMode,
  placeholder,
  permissionModeLabel,
  disabled,
}: ComposerProps) {
  const [text, setText] = useState("");
  const [showQuick, setShowQuick] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Suggestion state
  const [suggestionType, setSuggestionType] = useState<'command' | 'skill' | null>(null);
  const [suggestionQuery, setSuggestionQuery] = useState("");

  const handleSend = () => {
    if (!text.trim() || disabled) return;
    onSend(text);
    setText("");
    setSuggestionType(null);
  };

  const handleAttach = () => {
    if (disabled) return;
    if (onAttach) {
      onAttach();
      return;
    }
    fileInputRef.current?.click();
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);

    const words = val.split(' ');
    const lastWord = words[words.length - 1];

    if (lastWord.startsWith('/')) {
      setSuggestionType('command');
      setSuggestionQuery(lastWord.slice(1).toLowerCase());
    } else if (lastWord.startsWith('@')) {
      setSuggestionType('skill');
      setSuggestionQuery(lastWord.slice(1).toLowerCase());
    } else {
      setSuggestionType(null);
    }
  };

  const insertSuggestion = (suggestion: string) => {
    const words = text.split(' ');
    words.pop();
    const newText = [...words, suggestion, ""].join(" ");
    setText(newText.replace(/^\s+/, ''));
    setSuggestionType(null);
  };

  const filteredCommands = COMMANDS.filter(c => c.name.toLowerCase().includes(suggestionQuery));
  const filteredSkills = SKILLS.filter(s => s.name.toLowerCase().includes(suggestionQuery));

  return (
    <div className="w-full max-w-4xl mx-auto px-4 pt-0 pb-2 relative">
      {/* Glow Behind the Composer */}
      <div className={`absolute -inset-1 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-indigo-500/20 blur-xl transition-opacity duration-500 rounded-3xl ${isFocused ? 'opacity-100' : 'opacity-0'}`} />
      
      <div className={`relative rounded-2xl border transition-all duration-300 bg-black/60 shadow-lg ${isFocused ? 'border-indigo-500/40' : 'border-white/[0.08]'}`}>
        
        {/* Command / Skill Suggestions */}
        {suggestionType && (
          <div className="absolute bottom-[calc(100%+12px)] left-0 w-64 bg-[#111] border border-white/[0.1] rounded-xl shadow-2xl overflow-hidden z-20 animate-in fade-in slide-in-from-bottom-2">
            <div className="px-3 py-2 border-b border-white/[0.05] bg-white/[0.02] text-[10px] uppercase tracking-widest text-gray-500 font-semibold">
               {suggestionType === 'command' ? 'Commands' : 'Plugins & Skills'}
            </div>
            <div className="max-h-48 overflow-y-auto">
              {(suggestionType === 'command' ? filteredCommands : filteredSkills).map(item => (
                <button
                  key={item.name}
                  className="w-full text-left px-3 py-2 flex flex-col hover:bg-white/[0.05] transition-colors outline-none focus:bg-white/[0.1]"
                  onClick={(e) => {
                    e.preventDefault();
                    insertSuggestion(item.name);
                  }}
                  onMouseDown={(e) => e.preventDefault()} // prevent blur on textarea
                >
                  <span className="text-sm font-semibold text-indigo-300">{item.name}</span>
                  <span className="text-[10px] text-gray-500">{item.desc}</span>
                </button>
              ))}
              {(suggestionType === 'command' ? filteredCommands : filteredSkills).length === 0 && (
                <div className="px-3 py-4 text-xs text-gray-500 text-center">No matches found.</div>
              )}
            </div>
          </div>
        )}

        {showQuick && !suggestionType && (
           <div className="absolute bottom-[calc(100%+12px)] left-0 flex flex-wrap gap-2 animate-in fade-in slide-in-from-bottom-2 z-10">
             {QUICK_PROMPTS.map(p => (
               <button 
                 key={p} 
                 onMouseDown={(e) => e.preventDefault()}
                 onClick={() => { if (!disabled) { onSend(p); setShowQuick(false); } }}
                 disabled={disabled}
                 className="text-[12px] font-medium px-4 py-2 rounded-full bg-white/[0.05] border border-white/[0.1] text-gray-300 hover:text-white hover:bg-white/[0.1] backdrop-blur-md transition-all shadow-[0_4px_12px_rgba(0,0,0,0.5)] flex items-center space-x-1.5"
               >
                 <Sparkles className="w-3 h-3 text-indigo-400" />
                 <span>{p}</span>
               </button>
             ))}
           </div>
        )}

        <Textarea
          value={text}
          onChange={handleTextChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
             setIsFocused(false);
             // Small delay to allow clicks to register
             setTimeout(() => setSuggestionType(null), 150);
          }}
          placeholder={placeholder || "Ask BotValia Code or send a command..."}
          disabled={disabled}
          className="min-h-[46px] w-full resize-none border-0 bg-transparent py-3 px-4 focus-visible:ring-0 text-white placeholder:text-gray-500 scrollbar-hide text-[15px] leading-6"
          onKeyDown={(e) => {
            if (disabled) {
              return;
            }
            if (e.key === 'Tab' && e.shiftKey) {
              e.preventDefault();
              e.stopPropagation();
              onCyclePermissionMode?.();
            } else if (e.key === 'Enter' && !e.shiftKey && !suggestionType) {
              e.preventDefault();
              handleSend();
            } else if (e.key === 'Enter' && !e.shiftKey && suggestionType) {
              // On enter, insert the first suggestion if any
              e.preventDefault();
              const items = suggestionType === 'command' ? filteredCommands : filteredSkills;
              if (items.length > 0) {
                insertSuggestion(items[0].name);
              }
            } else if (e.key === 'Escape' && suggestionType) {
              e.preventDefault();
              setSuggestionType(null);
            }
          }}
        />

        <div className="flex items-center justify-between px-3 pb-2">
          <div className="flex items-center space-x-2">
            <Button 
              variant="ghost" 
              size="sm" 
              disabled={disabled}
              onClick={() => setShowQuick(!showQuick)}
              className={`h-8 px-3 rounded-full text-xs font-medium transition-colors ${showQuick ? 'bg-indigo-500/20 text-indigo-300' : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.05]'}`}
            >
              <Zap className={`h-3.5 w-3.5 mr-1.5 ${showQuick ? 'text-indigo-400' : ''}`} /> Prompts
            </Button>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              multiple 
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  onAttach?.();
                }
              }}
            />
            <Button 
              variant="ghost" 
              size="icon" 
              disabled={disabled}
              onClick={handleAttach}
              className="h-8 w-8 rounded-full text-gray-500 hover:text-gray-300 hover:bg-white/[0.05]"
              title="Attach File"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            {isRunning && (
              <Button onClick={onStop} variant="ghost" size="icon" className="h-8 w-8 rounded-full text-red-400 hover:bg-red-500/20 hover:text-red-300">
                <StopCircle className="h-5 w-5" />
              </Button>
            )}
            <Button 
              size="icon" 
              className="h-8 w-8 rounded-full bg-white text-black hover:bg-gray-200 disabled:bg-white/10 disabled:text-white/30 transition-all font-bold shadow-md"
              disabled={disabled || (!text.trim() && !isRunning)}
              onClick={handleSend}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      <div className="text-center mt-2.5">
        <div className="flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest font-semibold opacity-60">
          <span className="flex items-center space-x-1.5 text-gray-500 mix-blend-plus-lighter">
            <Zap className="w-3 h-3" />
            <span>BotValia Runtime v3</span>
          </span>
          {permissionModeLabel ? (
            <>
              <span className="text-gray-700">•</span>
              <button
                type="button"
                onClick={onCyclePermissionMode}
                className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] tracking-[0.16em] text-indigo-200 transition-colors hover:bg-white/[0.08] hover:text-white"
              >
                Shift+Tab · {permissionModeLabel}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
