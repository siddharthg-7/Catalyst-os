import React from 'react';
import { Bot, Sparkles, Building2, ShieldCheck } from 'lucide-react';

interface EmptyStateProps {
  userName?: string;
  companyName?: string;
  userRole?: string;
}

export default function EmptyState({ userName, companyName, userRole }: EmptyStateProps) {
  const isEmployee = userRole && !['founder', 'executive', 'admin'].includes(userRole.toLowerCase());
  const displayName = userName ? userName.split(' ')[0] : null;

  return (
    <div className="py-8 px-4 text-center space-y-4 font-sans my-auto">
      <div className="w-14 h-14 rounded-2xl bg-[#F3F5FB] border border-[#151A2D]/10 flex items-center justify-center text-[#151A2D] mx-auto shadow-xl">
        <Bot className="w-7 h-7 text-[#151A2D]" />
      </div>

      <div className="space-y-1.5">
        <h3 className="text-base font-bold text-[#151A2D] tracking-tight flex items-center justify-center gap-2 font-sans">
          <span>Hello{displayName ? ` ${displayName}` : ''} 👋 How can I help?</span>
        </h3>
        
        {companyName && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-100/80 text-[11px] font-medium text-indigo-700 mx-auto">
            <Building2 className="w-3 h-3 text-indigo-600" />
            <span>{companyName}</span>
            <span className="text-indigo-400">•</span>
            <span className="capitalize">{userRole || 'Member'}</span>
          </div>
        )}

        <p className="text-xs text-[#536079] max-w-xs mx-auto leading-relaxed font-sans pt-1">
          {isEmployee
            ? `Ask about your team's assigned tasks, company documents, policies, or operational deliverables.`
            : `I'm here to help you steer ${companyName || 'your startup'}—from runway and hiring to execution.`}
        </p>
      </div>
    </div>
  );
}
