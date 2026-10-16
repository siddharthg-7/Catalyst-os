import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, X } from 'lucide-react';
import ChatHeader from './ChatHeader';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import EmptyState from './EmptyState';
import SuggestedQuestions from './SuggestedQuestions';
import TypingIndicator from './TypingIndicator';
import { ChatMessage } from '../../hooks/useChat';

interface ChatWindowProps {
  isOpen: boolean;
  messages: ChatMessage[];
  isTyping: boolean;
  suggestedQuestions: string[];
  onSendMessage: (text: string, isVoice?: boolean) => void;
  onClearChat: () => void;
  onClose: () => void;
  onRegenerate?: () => void;
  language: string;
  onLanguageChange: (language: string) => void;
  error?: string | null;
  onClearError?: () => void;
  sessionExpired?: boolean;
  companyName?: string;
  userRole?: string;
  userName?: string;
}

export default function ChatWindow({
  isOpen,
  messages,
  isTyping,
  suggestedQuestions,
  onSendMessage,
  onClearChat,
  onClose,
  onRegenerate,
  language,
  onLanguageChange,
  error,
  onClearError,
  sessionExpired,
  companyName,
  userRole,
  userName,
}: ChatWindowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages or typing status updates
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleExportConversation = () => {
    if (messages.length === 0) return;
    const markdownContent = messages.map(m => `### ${m.role.toUpperCase()} (${m.timestamp})\n${m.content}\n`).join('\n---\n\n');
    const blob = new Blob([markdownContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Catalyst_OS_Chat_Export_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed bottom-24 right-6 z-50 w-[92vw] sm:w-[420px] h-[620px] max-h-[82vh] rounded-[28px] bg-white border border-[#151A2D]/10 backdrop-blur-2xl shadow-xl flex flex-col overflow-hidden font-sans border-t-white/20"
        >
          {/* Header */}
          <ChatHeader
            onClear={onClearChat}
            onMinimize={onClose}
            onClose={onClose}
            onExport={handleExportConversation}
            language={language}
            onLanguageChange={onLanguageChange}
          />

          {/* Operational Error Banner with Retry & Dismiss */}
          {error && (
            <div className="mx-3 mt-2.5 mb-1 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-2 shadow-xs shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-medium truncate">{error}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {onRegenerate && !sessionExpired && (
                  <button
                    onClick={onRegenerate}
                    className="px-2 py-0.5 bg-white border border-rose-200 hover:bg-rose-100 text-rose-700 rounded-md font-semibold text-[11px] transition-colors cursor-pointer"
                  >
                    Retry
                  </button>
                )}
                {onClearError && (
                  <button
                    onClick={onClearError}
                    className="p-1 text-rose-500 hover:text-rose-700 rounded-md transition-colors cursor-pointer"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Messages & Content Area */}
          <div 
            ref={scrollRef} 
            className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
          >
            {messages.length === 0 ? (
              <div className="h-full flex flex-col justify-between">
                <EmptyState 
                  companyName={companyName}
                  userRole={userRole}
                  userName={userName}
                />
                <SuggestedQuestions
                  questions={suggestedQuestions}
                  onSelect={onSendMessage}
                />
              </div>
            ) : (
              <>
                {messages.map((msg, idx) => {
                  const isLast = idx === messages.length - 1;
                  const isAssistant = msg.role === 'assistant';
                  const shouldAutoPlay = isLast && isAssistant && !isTyping && msg.isStreaming !== true && Boolean(msg.autoPlaySpeech);

                  return (
                    <MessageBubble 
                      key={msg.id} 
                      message={msg} 
                      onRegenerate={isLast && isAssistant ? onRegenerate : undefined} 
                      speechLanguage={language}
                      autoPlaySpeech={shouldAutoPlay}
                    />
                  );
                })}

                {isTyping && <TypingIndicator />}

                {/* Show quick suggested chips if messages < 3 */}
                {messages.length < 3 && !isTyping && (
                  <SuggestedQuestions
                    questions={suggestedQuestions}
                    onSelect={onSendMessage}
                  />
                )}
              </>
            )}
          </div>

          {/* Input Box */}
          <ChatInput 
            onSend={onSendMessage} 
            disabled={isTyping || sessionExpired} 
            language={language} 
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
