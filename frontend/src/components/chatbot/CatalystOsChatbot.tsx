import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import ChatButton from './ChatButton';
import ChatWindow from './ChatWindow';
import { useChat } from '../../hooks/useChat';
import { useAuth } from '../../context/AuthContext';

export interface CatalystOsChatbotProps {
  startupName?: string;
  userRole?: string;
  userName?: string;
  isMembershipResolved?: boolean;
}

export default function CatalystOsChatbot({
  startupName,
  userRole,
  userName,
  isMembershipResolved = true,
}: CatalystOsChatbotProps) {
  const location = useLocation();

  // Extract auth context safely
  let apiFetch: ((url: string, options?: RequestInit) => Promise<Response>) | undefined;
  let user: any = null;
  let loading = true;
  let logout: (() => Promise<void>) | undefined;

  try {
    const auth = useAuth();
    apiFetch = auth.apiFetch;
    user = auth.user;
    loading = auth.loading;
    logout = auth.logout;
  } catch {
    apiFetch = undefined;
    user = null;
    loading = false;
    logout = undefined;
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
    error,
    clearError,
    sessionExpired,
  } = useChat(apiFetch, user?.id, 'rag');

  // Close chat or handle revoked session on auth expiration event
  useEffect(() => {
    const handleAuthExpired = () => {
      closeChat();
      if (logout) {
        logout().catch(() => {});
      }
    };

    window.addEventListener('CATALYST_AUTH_EXPIRED', handleAuthExpired);
    return () => window.removeEventListener('CATALYST_AUTH_EXPIRED', handleAuthExpired);
  }, [closeChat, logout]);

  // Demo trigger event listener
  useEffect(() => {
    const handleDemo = () => {
      openChat();
      clearChat();
      
      // Give the chat window a moment to animate open
      setTimeout(() => {
        sendMessage("Give me a summary of Catalyst OS features and runway projection.");
      }, 800);
    };

    window.addEventListener('START_CHATBOT_DEMO', handleDemo);
    return () => window.removeEventListener('START_CHATBOT_DEMO', handleDemo);
  }, [openChat, clearChat, sendMessage]);

  // PHASE 2 GUARD RULES:
  // 1. Remain hidden while authentication is unresolved (loading === true).
  // 2. Remain hidden if there is no authenticated user.
  // 3. Remain hidden if company membership is unresolved.
  // 4. Remain hidden on public landing, sign-up, sign-in, verification, and onboarding screens.
  const publicPaths = [
    '/',
    '/auth',
    '/login',
    '/signup',
    '/verify-email',
    '/reset-password',
    '/accept-invitation',
    '/onboarding'
  ];

  const isPublicScreen = publicPaths.includes(location.pathname);

  if (loading || !user || !isMembershipResolved || isPublicScreen) {
    return null;
  }

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
        error={error}
        onClearError={clearError}
        sessionExpired={sessionExpired}
        companyName={startupName}
        userRole={userRole || user?.role}
        userName={userName || user?.name}
      />
      <ChatButton
        isOpen={isOpen}
        onClick={toggleOpen}
        unreadCount={messages.filter(m => m.role === 'assistant').length}
      />
    </>
  );
}
