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
        className="w-12 h-12 rounded-[16px] bg-[#141413] hover:bg-[#262627] text-[#F3F0EE] shadow-[rgba(0,0,0,0.16)_0px_10px_30px_0px] hover:shadow-[rgba(0,0,0,0.22)_0px_14px_36px_0px] transition-all duration-200 flex items-center justify-center relative cursor-pointer group scale-100 hover:scale-105 active:scale-95 border border-[#141413]/20"
      >

        {/* Icon Transition */}
        {isOpen ? (
          <X className="w-5 h-5 text-[#F3F0EE] transition-transform duration-300 rotate-90" />
        ) : (
          <div className="relative flex items-center justify-center">
            <CatalystLogo className="w-6 h-6 text-[#F3F0EE] transition-transform duration-300 group-hover:scale-110" />
            <Sparkles className="w-3 h-3 text-[#F37338] absolute -top-1 -right-1 animate-pulse" />
          </div>
        )}

        {/* Unread Badge */}
        {!isOpen && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-white font-mono text-[10px] font-bold flex items-center justify-center shadow-md border-2 border-white">
            {unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}
