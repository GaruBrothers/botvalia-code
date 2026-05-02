import { Message } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Sparkles, TerminalSquare, User } from "lucide-react";
import * as motion from "motion/react-client";
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function tryParseCleanContent(content: string) {
  // Replace raw XML or `<internal_thinking>` with nice blocks if we needed to, 
  // but keeping it simple for now as per instructions.
  return content;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function MessageBubble({ msg }: { msg: Message }) {
  if (msg.isHiddenInternally) return null;

  const isUser = msg.role === "user";
  const isSys = msg.role === "system";
  const isAssistantThinking =
    msg.role === "assistant" && msg.streamKind === "thinking";
  const isAssistantStreamingResponse =
    msg.role === "assistant" && msg.streamKind === "response" && msg.isPending;
  const assistantDisplayContent =
    isAssistantThinking && (!msg.content.trim() || msg.content === 'Pensando...')
      ? ''
      : msg.content;

  let Icon = Sparkles;
  if (isUser) Icon = User;
  if (isSys) Icon = TerminalSquare;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className={cn("flex w-full group py-2.5", {
        "justify-end": isUser,
        "justify-start": !isUser,
        "opacity-70": msg.isPending,
      })}
    >
      <div className={cn("flex max-w-[85%] sm:max-w-[75%]", {
             "flex-row-reverse": isUser,
      })}>
        
        <div className={cn("flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full border shadow-sm relative mt-0.5", {
          "bg-gradient-to-tr from-gray-800 to-gray-700 border-gray-600 ml-3": isUser,
          "bg-gradient-to-tr from-indigo-900 to-purple-900 border-indigo-700/50 mr-3 shadow-indigo-500/20": !isUser && !isSys,
          "bg-black border-gray-800 mr-3": isSys,
        })}>
          <Icon className={cn("w-3.5 h-3.5", {
            "text-gray-200": isUser,
            "text-indigo-200 fill-indigo-200/20": !isUser && !isSys,
            "text-gray-500": isSys,
          })} />
          {/* Subtle glow for AI */}
          {!isUser && !isSys && (
             <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-[8px] -z-10" />
          )}
        </div>

        <div className={cn("flex flex-col", {
          "items-end": isUser,
          "items-start": !isUser,
          "w-full": !isUser && !isSys // let AI messages expand to show tables nicely
        })}>
           <div className={cn("flex items-center space-x-2 mb-1", isUser && "flex-row-reverse space-x-reverse")}>
             <span className="text-[11px] font-semibold text-gray-400 tracking-wide uppercase">
               {isUser
                 ? msg.isPending
                   ? "You · pending"
                   : "You"
                 : isSys
                   ? "System"
                   : isAssistantThinking
                     ? "BotValia Code · thinking"
                     : isAssistantStreamingResponse
                       ? "BotValia Code · respondiendo"
                     : "BotValia Code"}
             </span>
             <span className="text-[10px] text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" suppressHydrationWarning>
               {formatTime(msg.timestamp)}
             </span>
           </div>
           
           <div className={cn("px-4 py-2.5 text-[13px] leading-relaxed shadow-sm overflow-hidden", {
             "bg-white/[0.06] text-gray-100 rounded-2xl rounded-tr-sm border border-white/[0.05] whitespace-pre-wrap": isUser,
             "bg-transparent text-gray-200 w-full": !isUser && !isSys,
             "border border-white/[0.05] rounded-xl bg-black/50 text-gray-400 font-mono text-[11px] backdrop-blur-sm whitespace-pre-wrap": isSys,
           })}>
             {isUser || isSys ? (
                tryParseCleanContent(msg.content)
             ) : (
                <div className="markdown-body text-[13px] leading-6 space-y-3">
                  {(isAssistantThinking || isAssistantStreamingResponse) && (
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-100 shadow-[0_0_24px_rgba(99,102,241,0.18)]">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="absolute inset-0 animate-ping rounded-full bg-indigo-300/60" />
                        <span className="relative h-2.5 w-2.5 rounded-full bg-indigo-200" />
                      </span>
                      <span>{isAssistantThinking ? 'Thinking' : 'Streaming'}</span>
                      <div className="flex items-center gap-1">
                        {[0, 1, 2].map(index => (
                          <motion.span
                            key={index}
                            animate={{ opacity: [0.25, 1, 0.25], y: [0, -1.5, 0] }}
                            transition={{ duration: 1.15, repeat: Infinity, delay: index * 0.14, ease: 'easeInOut' }}
                            className="h-1.5 w-1.5 rounded-full bg-indigo-100"
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {!assistantDisplayContent && isAssistantThinking ? (
                    <div className="rounded-2xl border border-indigo-400/10 bg-indigo-500/5 px-4 py-2.5 text-[13px] text-indigo-100/80">
                      BotValia Code está pensando y preparando la respuesta...
                    </div>
                  ) : (
                  <Markdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code({node, inline, className, children, ...props}: any) {
                        const match = /language-(\w+)/.exec(className || '')
                        return !inline && match ? (
                          <div className="my-4 rounded-lg overflow-hidden border border-white/[0.1] shadow-lg max-w-full">
                            <div className="bg-[#111111] px-4 py-2 flex justify-between items-center text-[10px] font-mono text-gray-400 border-b border-white/[0.05] uppercase tracking-wider font-semibold">
                              <span>{match[1]}</span>
                            </div>
                            <pre className="overflow-x-auto overflow-y-auto max-h-[600px] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent bg-[#050505] p-4 text-[13px] leading-6 text-gray-200">
                              <code {...props} className={className}>
                                {String(children).replace(/\n$/, '')}
                              </code>
                            </pre>
                          </div>
                        ) : (
                          <code {...props} className={className ? className : "bg-white/[0.1] text-indigo-300 px-1.5 py-0.5 rounded-md font-mono text-[13px]"}>
                            {children}
                          </code>
                        )
                      },
                      table: ({node, ...props}) => <div className="overflow-x-auto my-4"><table className="w-full text-left border-collapse" {...props} /></div>,
                      th: ({node, ...props}) => <th className="border-b border-white/[0.1] px-4 py-2 bg-white/[0.02] font-semibold text-gray-300" {...props} />,
                      td: ({node, ...props}) => <td className="border-b border-white/[0.05] px-4 py-2 text-gray-400" {...props} />,
                      a: ({node, ...props}) => <a className="text-indigo-400 hover:text-indigo-300 underline" {...props} />
                    }}
                  >
                    {tryParseCleanContent(assistantDisplayContent)}
                  </Markdown>
                  )}

                  {(isAssistantThinking || isAssistantStreamingResponse) && assistantDisplayContent && (
                    <motion.span
                      aria-hidden="true"
                      animate={{ opacity: [0.25, 1, 0.25] }}
                      transition={{ duration: 0.95, repeat: Infinity, ease: 'easeInOut' }}
                      className="inline-block h-5 w-2 rounded-full bg-indigo-300/70 align-middle"
                    />
                  )}
                </div>
             )}
           </div>
        </div>

      </div>
    </motion.div>
  )
}
