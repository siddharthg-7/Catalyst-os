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
  History
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
            <span className="px-1.5 py-0.5 rounded bg-slate-200/90 text-slate-700 font-semibold text-[10px] mr-1 inline-block align-middle">
              {tag}
            </span>
            <strong className="font-semibold text-slate-900">{rest}</strong>
          </span>
        );
      }
      return (
        <strong key={i} className="font-semibold text-slate-900">
          {inner}
        </strong>
      );
    }

    if (token.startsWith('*') && token.endsWith('*') && token.length >= 2 && !token.startsWith('**')) {
      const inner = token.slice(1, -1).trim();
      return (
        <em key={i} className="italic text-slate-600">
          {inner}
        </em>
      );
    }

    if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
      return (
        <code key={i} className="px-1.5 py-0.5 rounded bg-slate-100 text-indigo-700 font-mono text-[11px] border border-slate-200">
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
    <div className="space-y-3.5 text-xs text-slate-800 leading-relaxed">
      {rawSections.map((section, sIdx) => {
        const trimmed = section.trim();
        if (!trimmed) return null;

        if (trimmed.startsWith('### ')) {
          const lines = trimmed.split('\n');
          const headingLine = lines[0].replace(/^###\s+/, '').trim();
          const bodyLines = lines.slice(1).filter(l => l.trim().length > 0);

          let icon = <Sparkles className="w-3.5 h-3.5 text-indigo-500" />;
          let headerBadgeBg = 'bg-indigo-50/80 border-indigo-100 text-indigo-900';
          let dotColor = 'bg-indigo-500';

          const lowerHeading = headingLine.toLowerCase();
          if (lowerHeading.includes('completed')) {
            icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
            headerBadgeBg = 'bg-emerald-50/80 border-emerald-100 text-emerald-900';
            dotColor = 'bg-emerald-500';
          } else if (lowerHeading.includes('blocked') || lowerHeading.includes('failed')) {
            icon = <AlertCircle className="w-3.5 h-3.5 text-rose-500" />;
            headerBadgeBg = 'bg-rose-50/80 border-rose-100 text-rose-900';
            dotColor = 'bg-rose-500';
          } else if (lowerHeading.includes('decision') || lowerHeading.includes('approval')) {
            icon = <Shield className="w-3.5 h-3.5 text-amber-500" />;
            headerBadgeBg = 'bg-amber-50/80 border-amber-100 text-amber-900';
            dotColor = 'bg-amber-500';
          }

          return (
            <div key={sIdx} className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 space-y-2">
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold ${headerBadgeBg}`}>
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
                      <div key={lIdx} className="flex items-start gap-2 text-xs text-slate-800">
                        <span className="font-semibold text-slate-500 text-[11px] shrink-0 min-w-4">{numberedMatch[1]}.</span>
                        <div className="flex-1">{renderInlineMarkdown(numberedMatch[2])}</div>
                      </div>
                    );
                  }

                  // Strip all leading bullets/asterisks/dashes to prevent double bullets WITHOUT eating bold **
                  const strippedText = cleanedLine.replace(/^(?:[•]\s*|[-*]\s+)+/, '').trim();
                  if (!strippedText) return null;

                  return (
                    <div key={lIdx} className="flex items-start gap-2 text-xs text-slate-800">
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
                        <div key={blIdx} className="flex items-start gap-2 text-xs text-slate-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                          <div className="flex-1 leading-relaxed">{renderInlineMarkdown(stripped)}</div>
                        </div>
                      );
                    })}
                  </div>
                );
              }
              return (
                <p key={pIdx} className="text-xs text-slate-800 leading-relaxed font-normal">
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (initialPrompt) {
      setPrompt(initialPrompt);
    }
  }, [initialPrompt]);

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
      case 'finance': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'growth': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'product_engineering': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'people_talent': return 'bg-pink-50 text-pink-700 border-pink-200';
      case 'legal_compliance': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'auditor': return 'bg-purple-50 text-purple-700 border-purple-200';
      default: return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    }
  };

  const renderStatusBadge = (status?: string) => {
    switch (status) {
      case 'running':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Running</span>
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            <span>Completed</span>
          </span>
        );
      case 'blocked':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Lock className="w-3 h-3" />
            <span>Blocked</span>
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3" />
            <span>Failed</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <Ban className="w-3 h-3" />
            <span>Cancelled</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-50 text-slate-600 border border-slate-200">
            <Clock className="w-3 h-3" />
            <span>Queued</span>
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all duration-200">
      
      {/* ── Dispatcher Header ────────────────────────────────────────────── */}
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-indigo-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center shadow-xs">
              <Bot className="w-5 h-5" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">Sophia Vance</h2>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase tracking-wider">
                Executive Directive Dispatcher
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Multi-level autonomous orchestrator grounded in <span className="font-medium text-slate-700">{startupName}</span> company records.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {pastAssistantMessages.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-medium transition-colors shadow-2xs"
            >
              <History className="w-3.5 h-3.5 text-slate-500" />
              <span>History ({pastAssistantMessages.length})</span>
            </button>
          )}

          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            <span>Level 1-4 Engine Online</span>
          </div>
        </div>
      </div>

      {/* ── Command Input & Quick Directive Chips ────────────────────────── */}
      <div className="p-4 sm:p-5 border-b border-slate-100 space-y-3">
        {/* Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-[11px] font-medium text-slate-400 shrink-0 mr-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-indigo-500" />
            <span>Suggested:</span>
          </span>
          {SUGGESTED_DIRECTIVES.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isTyping}
              onClick={() => {
                setPrompt(chip.prompt);
                textareaRef.current?.focus();
              }}
              className="shrink-0 text-xs px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 text-slate-600 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Input Textarea & Submit */}
        <form onSubmit={handleSubmit} className="relative">
          <textarea
            ref={textareaRef}
            rows={compactMode ? 2 : 3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type an executive directive... (e.g. 'Prepare a 30-day go-to-market plan and assess the budget' or 'What are our current product priorities?')"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-xs text-slate-900 placeholder:text-slate-400 resize-none transition-all leading-relaxed"
          />

          <div className="flex items-center justify-between pt-2">
            <div className="text-[11px] text-slate-400 flex items-center gap-2">
              <span>Press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 font-mono text-[10px]">Enter</kbd> to dispatch</span>
              <span>•</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 font-mono text-[10px]">Shift + Enter</kbd> for new line</span>
            </div>

            <div className="flex items-center gap-2">
              {isTyping && latestAssistantMessage?.runId && onCancelRun && (
                <button
                  type="button"
                  onClick={() => onCancelRun(latestAssistantMessage.runId!)}
                  className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Cancel Run</span>
                </button>
              )}

              <button
                type="submit"
                disabled={isTyping || !prompt.trim()}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs disabled:opacity-40 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {isTyping ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Orchestrating...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Run Directive</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ── Active / Latest Orchestration Execution Panel ─────────────────── */}
      <div className="p-4 sm:p-5 space-y-4">
        {latestAssistantMessage ? (
          <div className="space-y-4">

            {/* Directive Objective & Execution Header */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">
                    {latestAssistantMessage.intent || 'Directive'}
                  </span>
                  <span className="text-xs font-semibold text-slate-900">
                    {latestAssistantMessage.objective || 'Autonomous Multi-Level Orchestration'}
                  </span>
                </div>
                {latestAssistantMessage.currentPhase && (
                  <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                    <span className="font-medium text-slate-700">Phase:</span> {latestAssistantMessage.currentPhase}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                {renderStatusBadge(latestAssistantMessage.status || (isTyping ? 'running' : 'completed'))}
                {latestAssistantMessage.runId && (
                  <span className="text-[10px] font-mono text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {latestAssistantMessage.runId.slice(0, 14)}...
                  </span>
                )}
              </div>
            </div>

            {/* DAG Task Steps List (When Multi-Agent Plan Exists) */}
            {latestAssistantMessage.dagTasks && latestAssistantMessage.dagTasks.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs pb-1">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span>Multi-Level DAG Execution Plan ({latestAssistantMessage.dagTasks.length} Subtasks)</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {latestAssistantMessage.dagTasks.filter(t => t.status === 'completed').length} / {latestAssistantMessage.dagTasks.length} Completed
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {latestAssistantMessage.dagTasks.map((task: any, idx: number) => {
                    const isExpanded = !!expandedTasks[task.id];
                    return (
                      <div
                        key={task.id || idx}
                        className="rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors shadow-2xs overflow-hidden"
                      >
                        <div
                          onClick={() => toggleTaskExpanded(task.id)}
                          className="p-3 flex items-center justify-between gap-3 cursor-pointer select-none"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-600 font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                              {task.stepNumber || idx + 1}
                            </span>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-900 truncate">
                                  {task.title}
                                </span>
                                <span className={`text-[10px] font-medium px-1.5 py-0.2 rounded border ${getDomainColor(task.domain)} shrink-0`}>
                                  {task.domain}
                                </span>
                              </div>

                              <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                                <span>Agent: <strong className="text-slate-600">{task.assignedAgent?.name || task.assignedAgent?.role || 'Executive'}</strong></span>
                                {task.dependsOn && task.dependsOn.length > 0 && (
                                  <>
                                    <span>•</span>
                                    <span className="text-amber-700 font-medium">Depends on: {task.dependsOn.join(', ')}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {renderStatusBadge(task.status)}
                            <button
                              type="button"
                              className="text-slate-400 hover:text-slate-600 p-0.5"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {/* Collapsible Details */}
                        {isExpanded && (
                          <div className="px-3 pb-3 pt-1 border-t border-slate-100 bg-slate-50/40 text-xs text-slate-600 space-y-2">
                            {task.expectedOutput && (
                              <div>
                                <span className="font-semibold text-slate-700">Expected Output: </span>
                                <span className="text-slate-600">{task.expectedOutput}</span>
                              </div>
                            )}

                            {task.output && (
                              <div className="p-2.5 rounded-lg bg-white border border-slate-200 font-mono text-[11px] space-y-1">
                                <div className="font-bold text-slate-700 text-xs font-sans">Execution Result:</div>
                                {typeof task.output === 'object' ? (
                                  Object.entries(task.output).map(([k, v]) => (
                                    <div key={k} className="text-slate-600">
                                      <span className="text-slate-500">{k}:</span> {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-slate-700">{String(task.output)}</div>
                                )}
                              </div>
                            )}

                            {task.error && (
                              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
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
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <Bot className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Executive Verdict &amp; Consolidated Summary
                </h3>
              </div>

              <div>
                {latestAssistantMessage.content ? (
                  <ExecutiveSummaryRenderer content={latestAssistantMessage.content} />
                ) : (
                  <p className="text-xs text-slate-500 italic">
                    {isTyping ? 'Synthesizing verified multi-agent domain recommendations...' : 'Directive processed.'}
                  </p>
                )}
              </div>

              {/* Created Records Links (Real Tasks / Approvals / Decisions) */}
              {latestAssistantMessage.createdRecords && (
                <div className="pt-2 flex flex-wrap gap-2">
                  {latestAssistantMessage.createdRecords.tasks && latestAssistantMessage.createdRecords.tasks.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onNavigate?.('workspace')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold hover:bg-indigo-100 transition-colors cursor-pointer"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>{latestAssistantMessage.createdRecords.tasks.length} Tasks Created in Workspace →</span>
                    </button>
                  )}

                  {latestAssistantMessage.createdRecords.approvals && latestAssistantMessage.createdRecords.approvals.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onNavigate?.('approvals')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold hover:bg-amber-100 transition-colors cursor-pointer"
                    >
                      <Shield className="w-3.5 h-3.5 text-amber-600" />
                      <span>Approval Pending in Queue →</span>
                    </button>
                  )}

                  {latestAssistantMessage.createdRecords.decisions && latestAssistantMessage.createdRecords.decisions.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onNavigate?.('decisions')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
                    >
                      <Scale className="w-3.5 h-3.5 text-slate-500" />
                      <span>Decision Logged in Audit Ledger →</span>
                    </button>
                  )}
                </div>
              )}

              {/* Supporting Financial Telemetry if present */}
              {latestAssistantMessage.calculations && latestAssistantMessage.calculations.length > 0 && (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  {latestAssistantMessage.calculations.map((calc, i) => (
                    <div key={i} className="min-w-0">
                      <div className="text-[11px] text-slate-500 truncate">{calc.metric}</div>
                      <div className="font-bold text-slate-900 font-mono mt-0.5">{calc.value}</div>
                      <div className="text-[10px] text-slate-400 truncate">{calc.source}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="py-8 text-center text-slate-500 text-xs space-y-2">
            <Bot className="w-8 h-8 text-indigo-400 mx-auto" />
            <p className="font-semibold text-slate-800">Awaiting your executive directive</p>
            <p className="max-w-md mx-auto text-slate-500">
              Direct Sophia Vance to create go-to-market plans, model runway scenarios, decompose actionable tasks, or retrieve verified company knowledge.
            </p>
          </div>
        )}

        {/* ── Conversation History Drawer / Accordion ──────────────────────── */}
        {showHistory && pastAssistantMessages.length > 0 && (
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span>Directive Conversation History ({pastAssistantMessages.length})</span>
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                Close
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {pastAssistantMessages.map((msg, i) => (
                <div key={msg.id || i} className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-700">{msg.intent || 'Directive'}</span>
                    <span>{msg.timestamp}</span>
                  </div>
                  <div className="text-slate-800 line-clamp-2">
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
