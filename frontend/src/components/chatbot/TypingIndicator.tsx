import React from 'react';
import { Bot } from 'lucide-react';

export default function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 my-2 animate-fade-in font-sans">
      <div className="w-8 h-8 rounded-xl bg-[#F3F5FB] border border-[#151A2D]/10 flex items-center justify-center text-white shrink-0 shadow-md">
        <Bot className="w-4 h-4" />
      </div>

      <div className="p-3.5 rounded-2xl bg-[#F3F5FB] border border-[#151A2D]/10 text-[#536079] flex items-center gap-2">
        <span className="text-xs font-mono text-[#68758F]">Catalyst OS AI is thinking</span>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}
