import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, User } from 'lucide-react';
import { useStore } from '../store/useStore';

export function ChatHistory() {
  const { messages } = useStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="h-full flex flex-col">
      {/* Header - Hidden on mobile (shown in overlay header) */}
      <div className="hidden md:block px-4 py-3 border-b border-gray-200/50">
        <h2 className="text-lg font-semibold text-gray-700">Conversation</h2>
        <p className="text-xs text-gray-400">{messages.length} messages</p>
      </div>
      
      {/* Messages container */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 px-4">
            <Bot className="w-10 h-10 sm:w-12 sm:h-12 mb-3 opacity-30" />
            <p className="text-sm">No messages yet</p>
            <p className="text-xs mt-1">Click the mic to start talking!</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {messages.map((message) => (
              <motion.div
                key={message.id}
                className={`
                  flex gap-2 sm:gap-3 items-start
                  ${message.role === 'user' ? 'flex-row-reverse' : ''}
                `}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                layout
              >
                {/* Avatar */}
                <div
                  className={`
                    w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0
                    ${
                      message.role === 'assistant'
                        ? 'bg-gradient-to-br from-orange-300 to-orange-400'
                        : 'bg-gradient-to-br from-indigo-300 to-indigo-400'
                    }
                  `}
                >
                  {message.role === 'assistant' ? (
                    <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                  ) : (
                    <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                  )}
                </div>

                {/* Message bubble */}
                <div
                  className={`
                    max-w-[80%] sm:max-w-[85%] px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl text-sm leading-relaxed
                    ${
                      message.role === 'assistant'
                        ? 'bg-white text-gray-700 rounded-tl-sm shadow-sm'
                        : 'bg-indigo-500 text-white rounded-tr-sm'
                    }
                  `}
                >
                  {message.content}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
