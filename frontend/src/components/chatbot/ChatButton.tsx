import React from 'react';
import { Bot, X, Sparkles } from 'lucide-react';
import CatalystLogo from '../CatalystLogo';

interface ChatButtonProps {
  isOpen: boolean;
  onClick: () => void;
  unreadCount?: number;
}

export default function ChatButton({ isOpen, onClick, unreadCount = 0 }: ChatButtonProps) {
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <button
        onClick={onClick}
        aria-label="Toggle Catalyst OS AI Chatbot"
        className="w-13 h-13 rounded-2xl bg-[#5546ED] hover:bg-[#4939D5] text-white shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center relative cursor-pointer group scale-100 hover:scale-105 active:scale-95 border border-indigo-400/30"
      >

        {/* Icon Transition */}
        {isOpen ? (
          <X className="w-6 h-6 text-white transition-transform duration-300 rotate-90" />
        ) : (
          <div className="relative flex items-center justify-center">
            <CatalystLogo className="w-7 h-7 text-white transition-transform duration-300 group-hover:scale-110" />
            <Sparkles className="w-3.5 h-3.5 text-white absolute -top-1 -right-1 animate-pulse" />
          </div>
        )}

        {/* Unread Badge */}
        {!isOpen && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-white font-mono text-[10px] font-bold flex items-center justify-center shadow-lg border border-black">
            {unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}
