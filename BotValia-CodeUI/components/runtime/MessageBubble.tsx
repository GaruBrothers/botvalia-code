import { Message } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Sparkles, TerminalSquare, User } from "lucide-react";
import * as motion from "motion/react-client";
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

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

  let Icon = Sparkles;
  if (isUser) Icon = User;
  if (isSys) Icon = TerminalSquare;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className={cn("flex w-full group py-5", {
        "justify-end": isUser,
        "justify-start": !isUser,
      })}
    >
      <div className={cn("flex max-w-[85%] sm:max-w-[75%]", {
             "flex-row-reverse": isUser,
      })}>
        
        <div className={cn("flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full border shadow-sm relative mt-1", {
          "bg-gradient-to-tr from-gray-800 to-gray-700 border-gray-600 ml-4": isUser,
          "bg-gradient-to-tr from-indigo-900 to-purple-900 border-indigo-700/50 mr-4 shadow-indigo-500/20": !isUser && !isSys,
          "bg-black border-gray-800 mr-4": isSys,
        })}>
          <Icon className={cn("w-4 h-4", {
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
           <div className={cn("flex items-center space-x-2 mb-1.5", isUser && "flex-row-reverse space-x-reverse")}>
             <span className="text-[11px] font-semibold text-gray-400 tracking-wide uppercase">
               {isUser ? "You" : isSys ? "System" : "BotValia Code"}
             </span>
             <span className="text-[10px] text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" suppressHydrationWarning>
               {formatTime(msg.timestamp)}
             </span>
           </div>
           
           <div className={cn("px-5 py-3.5 text-[14px] leading-relaxed shadow-sm overflow-hidden", {
             "bg-white/[0.06] text-gray-100 rounded-2xl rounded-tr-sm border border-white/[0.05] whitespace-pre-wrap": isUser,
             "bg-transparent text-gray-200 w-full": !isUser && !isSys,
             "border border-white/[0.05] rounded-xl bg-black/50 text-gray-400 font-mono text-[11px] backdrop-blur-sm whitespace-pre-wrap": isSys,
           })}>
             {isUser || isSys ? (
                tryParseCleanContent(msg.content)
             ) : (
                <div className="markdown-body text-[14px] leading-7 space-y-4">
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
                            <div className="overflow-x-auto overflow-y-auto max-h-[600px] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                              <SyntaxHighlighter
                                {...props}
                                style={vscDarkPlus as any}
                                language={match[1]}
                                PreTag="div"
                                className="!m-0 text-[13px] !bg-[#050505] !p-4"
                                wrapLines={true}
                                showLineNumbers={match[1] !== 'diff'}
                                lineNumberStyle={{ minWidth: '3em', paddingRight: '1em', color: '#444', textAlign: 'right' }}
                                lineProps={(lineNumber) => {
                                  const style: any = { display: 'block', padding: '0 4px' };
                                  if (match[1] === 'diff') {
                                    const lines = String(children).split('\n');
                                    const line = lines[lineNumber - 1] || '';
                                    if (line.startsWith('+')) {
                                      style.backgroundColor = 'rgba(16, 185, 129, 0.15)'; // Emerald
                                      style.boxShadow = 'inset 2px 0 0 rgba(16, 185, 129, 0.5)';
                                    } else if (line.startsWith('-')) {
                                      style.backgroundColor = 'rgba(239, 68, 68, 0.15)'; // Red
                                      style.boxShadow = 'inset 2px 0 0 rgba(239, 68, 68, 0.5)';
                                    } else if (line.startsWith('@@')) {
                                      style.color = 'rgb(147, 197, 253)'; // Blue
                                    }
                                  }
                                  return { style };
                                }}
                              >
                                {String(children).replace(/\n$/, '')}
                              </SyntaxHighlighter>
                            </div>
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
                    {tryParseCleanContent(msg.content)}
                  </Markdown>
                </div>
             )}
           </div>
        </div>

      </div>
    </motion.div>
  )
}
