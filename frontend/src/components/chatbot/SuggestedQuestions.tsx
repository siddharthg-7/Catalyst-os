import React from 'react';
import { ArrowUpRight, Sparkles } from 'lucide-react';

interface SuggestedQuestionsProps {
  questions: string[];
  onSelect: (question: string) => void;
}

export default function SuggestedQuestions({ questions, onSelect }: SuggestedQuestionsProps) {
  if (!questions || questions.length === 0) return null;

  return (
    <div className="space-y-2 pt-2">
      <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#68758F] uppercase tracking-wider font-bold">
        <Sparkles className="w-3 h-3 text-[#151A2D]" />
        <span>Suggested Questions</span>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {questions.map((q, idx) => (
          <button
            key={idx}
            onClick={() => onSelect(q)}
            className="p-3 rounded-xl bg-[#F3F5FB] border border-[#151A2D]/10 hover:border-[#5546ED]/40 text-left text-xs text-[#536079] hover:text-[#151A2D] transition-all flex items-center justify-between group cursor-pointer font-sans shadow-sm"
          >
            <span className="truncate pr-2 font-medium">{q}</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-[#68758F] group-hover:text-[#151A2D] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
