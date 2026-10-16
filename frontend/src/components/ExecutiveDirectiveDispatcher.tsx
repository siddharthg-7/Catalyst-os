import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Lock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  FileText,
  CheckSquare,
  XCircle,
  Ban,
  TrendingUp,
  Scale,
  Users,
  Shield,
  Layers,
  ExternalLink,
  History,
  Copy,
  Check
} from 'lucide-react';
import { ChatMessage } from '../hooks/useChat';

export interface ExecutiveDirectiveDispatcherProps {
  messages: ChatMessage[];
  isTyping: boolean;
  onSendDirective: (directive: string) => Promise<void>;
  onCancelRun?: (runId: string) => Promise<void>;
  onNavigate?: (tab: 'dashboard' | 'workspace' | 'approvals' | 'scenarios' | 'decisions' | 'knowledge' | 'workflows' | 'agents' | 'council' | 'people') => void;
  startupName?: string;
  initialPrompt?: string;
  compactMode?: boolean;
}

const SUGGESTED_DIRECTIVES = [
  { label: '30-Day GTM & Budget Plan', prompt: 'Prepare a 30-day go-to-market plan and assess the budget.' },
  { label: 'Current Product Priorities', prompt: 'What are our current product priorities?' },
  { label: 'Runway & Hiring Feasibility', prompt: 'Can we afford to hire two engineers?' },
  { label: 'Create Operational Tasks', prompt: 'Create three tasks from this approved product plan.' }
];

/**
 * Parses bold **text**, document tags **[Tag]**, italics *text*, and inline `code`.
 * Ensures NO raw asterisks or markdown symbols leak into the UI.
 */
function renderInlineMarkdown(text: string): React.ReactNode {
  if (!text) return null;

  // 1. Remove internal heading prefixes and safely remove leading bullet indicators without stripping '**'
  let sanitized = text
    .replace(/^#+\s+/g, '')
    .replace(/^(?:[•]\s*|[-*]\s+)+/, '')
    .trim();

  // 2. Fix unmatched bold asterisks before tokenizing:
  // E.g. "DocName.pdf**: Excerpt" or "Priority Title** (Sourced from...)"
  const boldMatches = sanitized.match(/\*\*/g);
  if (boldMatches && boldMatches.length % 2 !== 0) {
    if (/^[^*]+\*\*:\s*/.test(sanitized)) {
      sanitized = '**' + sanitized;
    } else if (/^[^*]+\*\*\s*\(/.test(sanitized)) {
      sanitized = '**' + sanitized;
    } else {
      // Remove trailing or lone orphan '**'
      const lastIdx = sanitized.lastIndexOf('**');
      sanitized = sanitized.slice(0, lastIdx) + sanitized.slice(lastIdx + 2);
    }
  }

  // 3. Split on bold **...**, italics *...*, or inline code `...`
  const tokens = sanitized.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);

  return tokens.map((token, i) => {
    if (token.startsWith('**') && token.endsWith('**') && token.length >= 4) {
      const inner = token.slice(2, -2).trim();
      // If it's a bracketed document tag like [Company Profile]
      if (inner.startsWith('[') && inner.includes(']')) {
        const closeIdx = inner.indexOf(']');
        const tag = inner.slice(1, closeIdx);
        const rest = inner.slice(closeIdx + 1).trim();
        return (
          <span key={i} className="inline-flex items-baseline gap-1">
            <span className="px-1.5 py-0.5 rounded bg-[#141413]/08 text-[#141413] border border-[#141413]/10 font-mono font-semibold text-[10px] mr-1 inline-block align-middle">
              {tag}
            </span>
            <strong className="font-semibold text-[#141413]">{rest}</strong>
          </span>
        );
      }
      return (
        <strong key={i} className="font-semibold text-[#141413]">
          {inner}
        </strong>
      );
    }

    if (token.startsWith('*') && token.endsWith('*') && token.length >= 2 && !token.startsWith('**')) {
      const inner = token.slice(1, -1).trim();
      return (
        <em key={i} className="italic text-[#696969]">
          {inner}
        </em>
      );
    }

    if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
      return (
        <code key={i} className="px-1.5 py-0.5 rounded bg-[#F3F0EE] text-[#141413] font-mono text-[11px] border border-[#141413]/10">
          {token.slice(1, -1)}
        </code>
      );
    }

    // For unstyled plain text tokens, strip any stray raw asterisks so stars never appear in the UI
    const cleanToken = token.replace(/\*{2,}/g, '').replace(/\*/g, '');
    return cleanToken;
  });
}

/**
 * Renders executive responses with clean markdown parsing, eliminating raw asterisks ('**'),
 * hashes ('###'), double bullets ('• •'), and unstyled markdown artifacts.
 */
function ExecutiveSummaryRenderer({ content }: { content: string }) {
  if (!content) return null;

  // Split by markdown sections: ### Title
  const rawSections = content.split(/(?=###\s+)/g);

  return (
    <div className="space-y-3.5 text-xs text-[#141413] leading-relaxed">
      {rawSections.map((section, sIdx) => {
        const trimmed = section.trim();
        if (!trimmed) return null;

        if (trimmed.startsWith('### ')) {
          const lines = trimmed.split('\n');
          const headingLine = lines[0].replace(/^###\s+/, '').trim();
          const bodyLines = lines.slice(1).filter(l => l.trim().length > 0);

          let icon = <Sparkles className="w-3.5 h-3.5 text-[#141413]" />;
          let headerBadgeBg = 'bg-[#FCFBFA] border-[#141413]/15 text-[#141413]';
          let dotColor = 'bg-[#141413]';

          const lowerHeading = headingLine.toLowerCase();
          if (lowerHeading.includes('completed')) {
            icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />;
            headerBadgeBg = 'bg-emerald-50 border-emerald-200/80 text-emerald-900';
            dotColor = 'bg-emerald-600';
          } else if (lowerHeading.includes('blocked') || lowerHeading.includes('failed')) {
            icon = <AlertCircle className="w-3.5 h-3.5 text-rose-700" />;
            headerBadgeBg = 'bg-rose-50 border-rose-200/80 text-rose-900';
            dotColor = 'bg-rose-600';
          } else if (lowerHeading.includes('decision') || lowerHeading.includes('approval')) {
            icon = <Shield className="w-3.5 h-3.5 text-amber-700" />;
            headerBadgeBg = 'bg-amber-50 border-amber-200/80 text-amber-900';
            dotColor = 'bg-amber-600';
          }

          return (
            <div key={sIdx} className="rounded-[14px] border border-[#141413]/10 bg-[#FCFBFA] p-3.5 space-y-2.5">
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-mono font-bold uppercase tracking-wider ${headerBadgeBg}`}>
                {icon}
                <span>{headingLine}</span>
              </div>

              <div className="space-y-1.5 pl-1">
                {bodyLines.map((line, lIdx) => {
                  const cleanedLine = line.trim();
                  // Check if numbered list (e.g. "1. Atlas...")
                  const numberedMatch = cleanedLine.match(/^(\d+)\.\s+(.*)/);
                  if (numberedMatch) {
                    return (
                      <div key={lIdx} className="flex items-start gap-2 text-xs text-[#141413]">
                        <span className="font-mono font-bold text-[#696969] text-[11px] shrink-0 min-w-4">{numberedMatch[1]}.</span>
                        <div className="flex-1">{renderInlineMarkdown(numberedMatch[2])}</div>
                      </div>
                    );
                  }

                  // Strip all leading bullets/asterisks/dashes to prevent double bullets WITHOUT eating bold **
                  const strippedText = cleanedLine.replace(/^(?:[•]\s*|[-*]\s+)+/, '').trim();
                  if (!strippedText) return null;

                  return (
                    <div key={lIdx} className="flex items-start gap-2 text-xs text-[#141413]">
                      <span className={`w-1.5 h-1.5 rounded-full ${dotColor} mt-1.5 shrink-0`} />
                      <div className="flex-1 leading-relaxed">{renderInlineMarkdown(strippedText)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }

        // Non-heading content: intro paragraphs or notes
        const paragraphs = trimmed.split('\n\n').filter(p => p.trim());
        return (
          <div key={sIdx} className="space-y-2">
            {paragraphs.map((p, pIdx) => {
              // If paragraph starts with bullet
              if (p.trim().startsWith('•') || /^(?:[-*]\s+)/.test(p.trim())) {
                const bulletLines = p.split('\n').filter(l => l.trim());
                return (
                  <div key={pIdx} className="space-y-1.5 pl-1">
                    {bulletLines.map((bl, blIdx) => {
                      const stripped = bl.replace(/^(?:[•]\s*|[-*]\s+)+/, '').trim();
                      if (!stripped) return null;
                      return (
                        <div key={blIdx} className="flex items-start gap-2 text-xs text-[#141413]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#141413]/30 mt-1.5 shrink-0" />
                          <div className="flex-1 leading-relaxed">{renderInlineMarkdown(stripped)}</div>
                        </div>
                      );
                    })}
                  </div>
                );
              }
              return (
                <p key={pIdx} className="text-xs text-[#141413] leading-relaxed font-normal">
                  {renderInlineMarkdown(p)}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export const ExecutiveDirectiveDispatcher: React.FC<ExecutiveDirectiveDispatcherProps> = ({
  messages,
  isTyping,
  onSendDirective,
  onCancelRun,
  onNavigate,
  startupName = 'Company',
  initialPrompt = '',
  compactMode = false
}) => {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});
  const [showHistory, setShowHistory] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chipsScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScrollBounds = () => {
    const el = chipsScrollRef.current;
    if (el) {
      setCanScrollLeft(el.scrollLeft > 2);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    }
  };

  useEffect(() => {
    checkScrollBounds();
    const el = chipsScrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScrollBounds);
      window.addEventListener('resize', checkScrollBounds);
      return () => {
        el.removeEventListener('scroll', checkScrollBounds);
        window.removeEventListener('resize', checkScrollBounds);
      };
    }
  }, []);

  const scrollChips = (dir: 'left' | 'right') => {
    if (chipsScrollRef.current) {
      chipsScrollRef.current.scrollBy({
        left: dir === 'left' ? -200 : 200,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    if (initialPrompt) {
      setPrompt(initialPrompt);
    }
  }, [initialPrompt]);

  const handleCopyVerdict = async () => {
    const textToCopy = latestAssistantMessage?.content;
    if (!textToCopy) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy verdict:', err);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || isTyping) return;
    const textToSend = prompt.trim();
    setPrompt('');
    await onSendDirective(textToSend);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const toggleTaskExpanded = (taskId: string) => {
    setExpandedTasks(prev => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  // Find latest active assistant response
  const latestAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
  const pastAssistantMessages = messages.filter(m => m.role === 'assistant' && m.id !== latestAssistantMessage?.id);

  const getDomainColor = (domain?: string) => {
    switch (domain) {
      case 'finance': return 'bg-emerald-50 text-emerald-800 border-emerald-200/80';
      case 'growth': return 'bg-amber-50 text-amber-800 border-amber-200/80';
      case 'product_engineering': return 'bg-[#F3F0EE] text-[#141413] border-[#141413]/15';
      case 'people_talent': return 'bg-rose-50 text-rose-800 border-rose-200/80';
      case 'legal_compliance': return 'bg-indigo-50 text-indigo-800 border-indigo-200/80';
      case 'auditor': return 'bg-[#FCFBFA] text-[#141413] border-[#141413]/15';
      default: return 'bg-[#FCFBFA] text-[#141413] border-[#141413]/15';
    }
  };

  const renderStatusBadge = (status?: string) => {
    switch (status) {
      case 'running':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-[#141413] text-[#F3F0EE] shadow-2xs animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin text-[#F3F0EE]" />
            <span>Running</span>
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200/80">
            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
            <span>Completed</span>
          </span>
        );
      case 'blocked':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200/80">
            <Lock className="w-3 h-3 text-amber-700" />
            <span>Blocked</span>
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-rose-50 text-rose-800 border border-rose-200/80">
            <XCircle className="w-3 h-3 text-rose-700" />
            <span>Failed</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-[#F3F0EE] text-[#696969] border border-[#141413]/10">
            <Ban className="w-3 h-3" />
            <span>Cancelled</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-[#FCFBFA] text-[#696969] border border-[#141413]/10">
            <Clock className="w-3 h-3" />
            <span>Queued</span>
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-[24px] border border-[#141413]/10 shadow-[rgba(0,0,0,0.04)_0px_8px_32px_0px] overflow-hidden transition-all duration-200">
      
      {/* ── Dispatcher Header (Sophia Vance window chrome) ────────────────── */}
      <div className="p-4 sm:p-5 border-b border-[#141413]/08 bg-[#FCFBFA] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="relative">
            <div className="w-10 h-10 rounded-[14px] bg-[#141413] text-[#F3F0EE] flex items-center justify-center shadow-xs border border-[#141413]/20">
              <Bot className="w-5 h-5 text-[#F3F0EE]" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full shadow-xs" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-[#141413] font-sans tracking-tight">Sophia Vance</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#F3F0EE] text-[#141413] border border-[#141413]/15 uppercase tracking-wider">
                Executive Directive Dispatcher
              </span>
            </div>
            <p className="text-xs text-[#696969] mt-0.5 font-sans">
              Multi-level autonomous orchestrator grounded in <span className="font-semibold text-[#141413]">{startupName}</span> company records.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          {pastAssistantMessages.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#141413]/10 bg-white hover:bg-[#F3F0EE] text-[#141413] text-xs font-mono font-medium transition-all shadow-[rgba(0,0,0,0.02)_0px_1px_4px_0px] cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-[#696969]" />
              <span>History ({pastAssistantMessages.length})</span>
            </button>
          )}

          {/* Compact Online Status Indicator & Neutral Level Tag (Section 4.1 compliant) */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50/80 text-emerald-700 border border-emerald-200/50 text-[11px] font-medium font-sans">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Online</span>
            </span>
            <span className="text-[11px] font-medium text-[#141413]/70 bg-[#141413]/5 border border-[#141413]/8 px-2 py-0.5 rounded-md font-mono">
              Level 1–4
            </span>
          </div>
        </div>
      </div>

      {/* ── Command Input & Quick Directive Chips (Section 7 Compliant) ──── */}
      <div className="p-4 sm:p-5 border-b border-[#141413]/08 space-y-3.5 bg-white">
        {/* Suggested Chips Carousel with Left/Right Scroll Controls */}
        <div className="relative flex items-center gap-2">
          <span className="text-[11px] font-medium text-[#666562] shrink-0 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#141413]" />
            <span>Suggested:</span>
          </span>

          {/* Left Arrow Button */}
          <button
            type="button"
            onClick={() => scrollChips('left')}
            disabled={!canScrollLeft}
            aria-label="Scroll suggested directives left"
            className={`p-1 rounded-full border border-[#141413]/10 bg-white text-[#141413] transition-opacity shrink-0 cursor-pointer ${
              canScrollLeft ? 'opacity-80 hover:opacity-100 hover:bg-[#F3F0EE]' : 'opacity-20 cursor-not-allowed'
            }`}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {/* Horizontal Scrolling Chips Row */}
          <div 
            ref={chipsScrollRef}
            className="overflow-x-auto scrollbar-none flex gap-2.5 items-center py-1 scroll-smooth flex-1"
          >
            {SUGGESTED_DIRECTIVES.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                disabled={isTyping}
                onClick={() => {
                  setPrompt(chip.prompt);
                  textareaRef.current?.focus();
                }}
                className="whitespace-nowrap flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs border border-[#141413]/10 bg-white hover:bg-[#141413]/5 text-[#141413]/90 font-normal transition-colors cursor-pointer disabled:opacity-40"
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Right Arrow Button */}
          <button
            type="button"
            onClick={() => scrollChips('right')}
            disabled={!canScrollRight}
            aria-label="Scroll suggested directives right"
            className={`p-1 rounded-full border border-[#141413]/10 bg-white text-[#141413] transition-opacity shrink-0 cursor-pointer ${
              canScrollRight ? 'opacity-80 hover:opacity-100 hover:bg-[#F3F0EE]' : 'opacity-20 cursor-not-allowed'
            }`}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Input Textarea & Submit */}
        <form onSubmit={handleSubmit} className="relative">
          <div className="rounded-[18px] border border-[#141413]/15 bg-[#FCFBFA] p-3.5 focus-within:border-[#141413] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#141413]/05 transition-all shadow-[rgba(0,0,0,0.02)_0px_2px_8px_0px_inset]">
            <textarea
              ref={textareaRef}
              rows={compactMode ? 2 : 3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type an executive directive... (e.g. 'Prepare a 30-day go-to-market plan and assess the budget' or 'What are our current product priorities?')"
              className="w-full bg-transparent border-0 focus:outline-none text-xs sm:text-[13px] text-[#141413] placeholder:text-[#696969]/60 resize-none transition-all leading-relaxed font-sans"
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#141413]/08 mt-1">
              {isTyping && latestAssistantMessage?.runId && onCancelRun && (
                <button
                  type="button"
                  onClick={() => onCancelRun(latestAssistantMessage.runId!)}
                  className="px-3.5 py-2 rounded-[12px] border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Cancel Run</span>
                </button>
              )}

              <button
                type="submit"
                disabled={isTyping || !prompt.trim()}
                className="px-5 py-2 rounded-[12px] bg-[#141413] hover:bg-[#262627] text-[#F3F0EE] text-xs font-semibold shadow-[rgba(0,0,0,0.12)_0px_4px_14px_0px] disabled:opacity-40 transition-all flex items-center gap-2 cursor-pointer font-sans"
              >
                {isTyping ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#F3F0EE]" />
                    <span>Orchestrating...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 text-[#F3F0EE]" />
                    <span>Run Directive</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ── Active / Latest Orchestration Execution Panel ─────────────────── */}
      <div className="p-4 sm:p-5 space-y-4 bg-white">
        {latestAssistantMessage ? (
          <div className="space-y-4">

            {/* Directive Objective & Execution Header */}
            <div className="p-4 rounded-[16px] border border-[#141413]/10 bg-[#FCFBFA] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[rgba(0,0,0,0.02)_0px_2px_8px_0px]">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#141413] text-[#F3F0EE]">
                    {latestAssistantMessage.intent || 'Directive'}
                  </span>
                  <span className="text-xs font-bold text-[#141413] font-sans">
                    {latestAssistantMessage.objective || 'Autonomous Multi-Level Orchestration'}
                  </span>
                </div>
                {latestAssistantMessage.currentPhase && (
                  <p className="text-[11px] text-[#696969] mt-1.5 flex items-center gap-1.5 font-sans">
                    <span className="font-semibold text-[#141413]">Phase:</span> {latestAssistantMessage.currentPhase}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                {renderStatusBadge(latestAssistantMessage.status || (isTyping ? 'running' : 'completed'))}
                {latestAssistantMessage.runId && (
                  <span className="text-[10px] font-mono text-[#696969] bg-white px-2.5 py-0.5 rounded-full border border-[#141413]/10">
                    {latestAssistantMessage.runId.slice(0, 14)}...
                  </span>
                )}
              </div>
            </div>

            {/* DAG Task Steps List (When Multi-Agent Plan Exists) */}
            {latestAssistantMessage.dagTasks && latestAssistantMessage.dagTasks.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs pb-1">
                  <div className="flex items-center gap-2 font-bold text-[#141413] font-sans">
                    <Layers className="w-4 h-4 text-[#141413]" />
                    <span>Multi-Agent Execution Pipeline ({latestAssistantMessage.dagTasks.length} Stages)</span>
                  </div>
                  <span className="text-[11px] text-[#666562] font-mono font-medium">
                    {latestAssistantMessage.dagTasks.filter(t => t.status === 'completed').length} / {latestAssistantMessage.dagTasks.length} Completed
                  </span>
                </div>

                {/* Compact Pipeline Ribbon */}
                <div className="flex items-center gap-1.5 overflow-x-auto py-2 px-1 scrollbar-none border-b border-[#141413]/06 pb-2">
                  {latestAssistantMessage.dagTasks.map((task: any, idx: number) => {
                    const isCompleted = task.status === 'completed';
                    const isRunning = task.status === 'running';
                    const isFailed = task.status === 'failed';
                    const isExpanded = !!expandedTasks[task.id];

                    return (
                      <React.Fragment key={task.id || idx}>
                        <button
                          type="button"
                          onClick={() => toggleTaskExpanded(task.id)}
                          className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono border transition-all cursor-pointer ${
                            isRunning 
                              ? 'bg-[#141413] text-[#FDFCFA] border-[#141413] shadow-xs'
                              : isCompleted
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80'
                              : isFailed
                              ? 'bg-rose-50 text-rose-800 border-rose-200/80'
                              : 'bg-[#FDFCFA] text-[#666562] border-[#141413]/10 hover:border-[#141413]/25'
                          } ${isExpanded ? 'ring-1 ring-[#141413]' : ''}`}
                        >
                          {isRunning ? (
                            <Loader2 className="w-3 h-3 animate-spin text-[#FDFCFA]" />
                          ) : isCompleted ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                          ) : isFailed ? (
                            <XCircle className="w-3 h-3 text-rose-700" />
                          ) : (
                            <Clock className="w-3 h-3 text-[#666562]" />
                          )}
                          <span className="font-semibold">{task.assignedAgent?.name || task.assignedAgent?.role || `Stage ${idx + 1}`}</span>
                          <span className="text-[10px] opacity-75">({task.domain || 'Audit'})</span>
                        </button>
                        {idx < latestAssistantMessage.dagTasks.length - 1 && (
                          <span className="text-[#666562]/40 text-xs shrink-0">→</span>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {latestAssistantMessage.dagTasks.map((task: any, idx: number) => {
                    const isExpanded = !!expandedTasks[task.id];
                    return (
                      <div
                        key={task.id || idx}
                        className="rounded-xl border border-[#141413]/10 bg-white hover:border-[#141413]/25 transition-all shadow-[rgba(20,20,19,0.02)_0px_1px_3px_0px] overflow-hidden"
                      >
                        <div
                          onClick={() => toggleTaskExpanded(task.id)}
                          className="p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-6 h-6 rounded-md bg-[#141413] text-[#FDFCFA] font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                              {task.stepNumber || idx + 1}
                            </span>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-[#141413] truncate font-sans">
                                  {task.title}
                                </span>
                                <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getDomainColor(task.domain)} shrink-0`}>
                                  {task.domain}
                                </span>
                              </div>

                              <div className="text-[11px] text-[#666562] flex items-center gap-2 mt-0.5 flex-wrap">
                                <span>Agent: <strong className="text-[#141413] font-semibold">{task.assignedAgent?.name || task.assignedAgent?.role || 'Executive'}</strong></span>
                                {task.dependsOn && task.dependsOn.length > 0 && (
                                  <>
                                    <span>•</span>
                                    <span className="text-amber-800 font-medium">Depends on: {task.dependsOn.join(', ')}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {renderStatusBadge(task.status)}
                            <button
                              type="button"
                              className="text-[#666562] hover:text-[#141413] p-1 rounded transition-colors"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {/* Collapsible Details */}
                        {isExpanded && (
                          <div className="px-4 pb-4 pt-1 border-t border-[#141413]/08 bg-[#FDFCFA] text-xs text-[#141413] space-y-2.5">
                            {task.expectedOutput && (
                              <div>
                                <span className="font-semibold text-[#141413]">Expected Output: </span>
                                <span className="text-[#666562]">{task.expectedOutput}</span>
                              </div>
                            )}

                            {task.output && (
                              <div className="p-3 rounded-lg bg-white border border-[#141413]/10 font-mono text-[11px] space-y-1 shadow-2xs">
                                <div className="font-bold text-[#141413] text-xs font-sans">Execution Result:</div>
                                {typeof task.output === 'object' ? (
                                  Object.entries(task.output).map(([k, v]) => (
                                    <div key={k} className="text-[#666562]">
                                      <span className="text-[#141413] font-semibold">{k}:</span> {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-[#141413]">{String(task.output)}</div>
                                )}
                              </div>
                            )}

                            {task.error && (
                              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-700" />
                                <div>
                                  <span className="font-bold">Execution Error: </span>
                                  <span>{task.error}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sophia Vance Consolidated Response */}
            <div className="p-5 rounded-xl border border-[#141413]/10 bg-white space-y-3.5 shadow-[rgba(20,20,19,0.02)_0px_1px_4px_0px]">
              <div className="flex items-center justify-between pb-2.5 border-b border-[#141413]/08">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-[#141413]" />
                  <h3 className="text-xs font-mono font-bold text-[#141413] uppercase tracking-wider">
                    Executive Verdict &amp; Consolidated Summary
                  </h3>
                </div>
                {latestAssistantMessage.content && (
                  <button
                    type="button"
                    onClick={handleCopyVerdict}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border border-[#141413]/10 hover:bg-[#F3F0EE] text-[#141413] transition-all cursor-pointer"
                  >
                    {hasCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#666562]" />
                        <span>Copy Verdict</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              <div>
                {latestAssistantMessage.content ? (
                  <ExecutiveSummaryRenderer content={latestAssistantMessage.content} />
                ) : (
                  <p className="text-xs text-[#666562] italic">
                    {isTyping ? 'Synthesizing verified multi-agent domain recommendations...' : 'Directive processed.'}
                  </p>
                )}
              </div>

              {/* Created Records Links (Real Tasks / Approvals / Decisions) */}
              {latestAssistantMessage.createdRecords && (
                <div className="pt-2 flex flex-wrap gap-2.5">
                  {latestAssistantMessage.createdRecords.tasks && latestAssistantMessage.createdRecords.tasks.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onNavigate?.('workspace')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FDFCFA] hover:bg-[#F3F0EE] text-[#141413] border border-[#141413]/10 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                    >
                      <CheckSquare className="w-3.5 h-3.5 text-[#141413]" />
                      <span>{latestAssistantMessage.createdRecords.tasks.length} Tasks Created in Workspace →</span>
                    </button>
                  )}

                  {latestAssistantMessage.createdRecords.approvals && latestAssistantMessage.createdRecords.approvals.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onNavigate?.('approvals')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                    >
                      <Shield className="w-3.5 h-3.5 text-amber-700" />
                      <span>Approval Pending in Queue →</span>
                    </button>
                  )}

                  {latestAssistantMessage.createdRecords.decisions && latestAssistantMessage.createdRecords.decisions.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onNavigate?.('decisions')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FDFCFA] hover:bg-[#F3F0EE] text-[#141413] border border-[#141413]/10 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                    >
                      <Scale className="w-3.5 h-3.5 text-[#666562]" />
                      <span>Decision Logged in Audit Ledger →</span>
                    </button>
                  )}
                </div>
              )}

              {/* Supporting Financial Telemetry if present */}
              {latestAssistantMessage.calculations && latestAssistantMessage.calculations.length > 0 && (
                <div className="p-3.5 rounded-[14px] bg-[#FCFBFA] border border-[#141413]/10 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {latestAssistantMessage.calculations.map((calc, i) => (
                    <div key={i} className="min-w-0">
                      <div className="text-[11px] font-mono text-[#696969] uppercase tracking-wider truncate">{calc.metric}</div>
                      <div className="font-bold text-[#141413] font-mono text-sm mt-0.5">{calc.value}</div>
                      <div className="text-[10px] text-[#696969]/80 truncate mt-0.5">{calc.source}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="py-12 px-6 text-center space-y-4 bg-gradient-to-b from-transparent via-[#FCFBFA]/50 to-[#FCFBFA] rounded-[20px] border border-dashed border-[#141413]/15 my-2">
            <div className="w-12 h-12 rounded-[16px] bg-white border border-[#141413]/10 shadow-[rgba(0,0,0,0.04)_0px_4px_16px_0px] flex items-center justify-center mx-auto text-[#141413]">
              <Bot className="w-6 h-6 text-[#141413]" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[#141413] font-sans tracking-tight">Awaiting your executive directive</h3>
              <p className="max-w-md mx-auto text-xs text-[#696969] leading-relaxed font-sans">
                Direct Sophia Vance to create go-to-market plans, model runway scenarios, decompose actionable tasks, or retrieve verified company knowledge.
              </p>
            </div>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
              {['GTM Strategy & Budgets', 'Runway Scenarios', 'DAG Task Decomposition', 'Vector Knowledge Grounding'].map((tag, i) => (
                <span key={i} className="text-[10px] font-mono font-medium text-[#696969] bg-white border border-[#141413]/10 px-2.5 py-0.5 rounded-full shadow-2xs">
                  • {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Conversation History Drawer / Accordion ──────────────────────── */}
        {showHistory && pastAssistantMessages.length > 0 && (
          <div className="pt-4 border-t border-[#141413]/08 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-[#141413]">
              <span>Directive Conversation History ({pastAssistantMessages.length})</span>
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                className="text-xs font-mono text-[#696969] hover:text-[#141413] cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {pastAssistantMessages.map((msg, i) => (
                <div key={msg.id || i} className="p-3.5 rounded-[14px] border border-[#141413]/10 bg-[#FCFBFA] text-xs space-y-1 shadow-2xs">
                  <div className="flex items-center justify-between text-[11px] text-[#696969] font-mono">
                    <span className="font-bold text-[#141413]">{msg.intent || 'Directive'}</span>
                    <span>{msg.timestamp}</span>
                  </div>
                  <div className="text-[#141413] line-clamp-2">
                    {renderInlineMarkdown(msg.content)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default ExecutiveDirectiveDispatcher;
