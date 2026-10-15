import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
    a.download = `Catalyst OS_Chat_Export_${Date.now()}.md`;
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

          {/* Messages & Content Area */}
          <div 
            ref={scrollRef} 
            className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
          >
            {messages.length === 0 ? (
              <div className="h-full flex flex-col justify-between">
                <EmptyState />
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
          <ChatInput onSend={onSendMessage} disabled={isTyping} language={language} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
