import React from 'react';
import { FileText, Database } from 'lucide-react';

interface SourceCardProps {
  sources: Array<{ title: string; score: number }>;
}

export default function SourceCard({ sources }: SourceCardProps) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="pt-2 mt-2 border-t border-[#151A2D]/10 space-y-1.5 font-mono text-[10px]">
      <div className="flex items-center gap-1.5 text-[#68758F] uppercase tracking-wider font-bold">
        <Database className="w-3 h-3 text-[#536079]" />
        <span>RAG Vector Memory References ({sources.length})</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {sources.map((src, i) => (
          <div
            key={i}
            className="px-2.5 py-1 rounded-lg bg-[#F3F5FB] border border-[#151A2D]/10 text-[#536079] flex items-center gap-1.5 hover:border-[#5546ED]/40 transition-colors"
          >
            <FileText className="w-3 h-3 text-[#151A2D]" />
            <span className="truncate max-w-[140px]">{src.title}</span>
            <span className="text-emerald-400 font-bold">{(src.score * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
