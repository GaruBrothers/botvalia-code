import { MessageBubble } from "./MessageBubble";
import { Message } from "@/lib/types";

export function ConversationView({ messages }: { messages: Message[] }) {
  const visibleMessages = messages.filter(m => !m.isHiddenInternally);

  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-8 py-8 w-full max-w-4xl mx-auto flex flex-col space-y-1 scrollbar-hide relative">
      {visibleMessages.length === 0 ? (
         <div className="flex-1 flex flex-col items-center justify-center text-gray-500 text-sm opacity-50 select-none">
           <div className="w-12 h-12 mb-4 rounded-full border border-white/[0.05] bg-white/[0.02] flex items-center justify-center shadow-inner">
             <div className="w-4 h-4 bg-white/20 rounded-full blur-[2px]" />
           </div>
           No messages to display.
         </div>
      ) : (
        visibleMessages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} />
        ))
      )}
      
      {/* Spacer for Composer */}
      <div className="h-10 flex-shrink-0" />
    </div>
  )
}
