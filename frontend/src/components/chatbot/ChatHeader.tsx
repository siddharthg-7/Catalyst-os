import React from 'react';
import { RefreshCw, Minus, X, Download } from 'lucide-react';
import CatalystLogo from '../CatalystLogo';

interface ChatHeaderProps {
  onClear: () => void;
  onMinimize: () => void;
  onClose: () => void;
  onExport?: () => void;
  language: string;
  onLanguageChange: (language: string) => void;
}

export default function ChatHeader({
  onClear,
  onMinimize,
  onClose,
  onExport,
  language,
  onLanguageChange,
}: ChatHeaderProps) {
  return (
    <div className="px-4 py-3 bg-white border-b border-[#151A2D]/10 flex items-center justify-between font-sans select-none gap-2">
      {/* Title & Status */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-[#F3F5FB] border border-[#151A2D]/10 p-1 flex items-center justify-center shadow-sm">
          <CatalystLogo className="w-5 h-5 text-[#151A2D]" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-xs font-bold text-[#151A2D] tracking-tight font-sans">CatalystOS</h3>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <span className="text-[9px] font-mono text-[#68758F] uppercase tracking-wider block">
            Building with you from idea to launch
          </span>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center gap-1">
        <select value={language} onChange={(event) => onLanguageChange(event.target.value)} title="Response and voice language" aria-label="Response language" className="max-w-[88px] rounded-lg border border-[#151A2D]/10 bg-[#F3F5FB] px-2 py-1.5 text-[10px] text-[#536079] outline-none hover:border-[#5546ED]/30">
          <option value="auto">Auto</option><option value="en">English</option><option value="te">తెలుగు</option><option value="hi">हिन्दी</option><option value="ta">தமிழ்</option><option value="kn">ಕನ್ನಡ</option><option value="ml">മലയാളം</option><option value="bn">বাংলা</option><option value="ar">العربية</option>
        </select>
        {onExport && (
          <button
            onClick={onExport}
            title="Export Conversation (.md)"
            className="p-1.5 rounded-lg hover:bg-[#5546ED]/5 text-[#68758F] hover:text-[#151A2D] transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          onClick={onClear}
          title="Clear Chat History"
          className="p-1.5 rounded-lg hover:bg-[#5546ED]/5 text-[#68758F] hover:text-[#151A2D] transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onMinimize}
          title="Minimize Chat"
          className="p-1.5 rounded-lg hover:bg-[#5546ED]/5 text-[#68758F] hover:text-[#151A2D] transition-colors cursor-pointer"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onClose}
          title="Close Chat"
          className="p-1.5 rounded-lg hover:bg-[#5546ED]/5 text-[#68758F] hover:text-[#151A2D] transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
