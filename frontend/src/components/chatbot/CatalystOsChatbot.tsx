import React, { useEffect } from 'react';
import ChatButton from './ChatButton';
import ChatWindow from './ChatWindow';
import { useChat } from '../../hooks/useChat';
import { useAuth } from '../../context/AuthContext';

export default function CatalystOsChatbot() {
  // Grab apiFetch if available inside AuthProvider
  let apiFetch: ((url: string, options?: RequestInit) => Promise<Response>) | undefined;
  let userId: string | undefined;
  try {
    const auth = useAuth();
    apiFetch = auth.apiFetch;
    userId = auth.user?.id;
  } catch (e) {
    // If mounted outside AuthProvider, use standard fetch
    apiFetch = undefined;
    userId = undefined;
  }

  const {
    isOpen,
    toggleOpen,
    openChat,
    closeChat,
    clearChat,
    messages,
    isTyping,
    suggestedQuestions,
    language,
    setLanguage,
    sendMessage,
    regenerateLastMessage,
  } = useChat(apiFetch, userId);

  useEffect(() => {
    const handleDemo = () => {
      openChat();
      clearChat();
      
      // Give the chat window a moment to animate open
      setTimeout(() => {
        sendMessage("Give me a summary of Catalyst OS features and pricing.");
      }, 800);
    };

    window.addEventListener('START_CHATBOT_DEMO', handleDemo);
    return () => window.removeEventListener('START_CHATBOT_DEMO', handleDemo);
  }, [openChat, clearChat, sendMessage]);

  return (
    <>
      <ChatWindow
        isOpen={isOpen}
        messages={messages}
        isTyping={isTyping}
        suggestedQuestions={suggestedQuestions}
        language={language}
        onLanguageChange={setLanguage}
        onSendMessage={sendMessage}
        onClearChat={clearChat}
        onClose={closeChat}
        onRegenerate={regenerateLastMessage}
      />
      <ChatButton
        isOpen={isOpen}
        onClick={toggleOpen}
        unreadCount={messages.filter(m => m.role === 'assistant').length}
      />
    </>
  );
}
