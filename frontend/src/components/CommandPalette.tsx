import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Activity, 
  CheckSquare, 
  Briefcase,
  Database, 
  Sparkles, 
  Rocket, 
  Loader2, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle,
  Layers,
  Users,
  TrendingUp,
  Shield,
  Radio,
  ArrowRight,
  CornerDownLeft
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: any) => void;
  onRunAction: (actionName: string) => void;
}

interface ExecutionStep {
  agent: string;
  action: string;
  status: string;
  summary?: string;
}

export default function CommandPalette({ isOpen, onClose, onNavigate, onRunAction }: CommandPaletteProps) {
  const { apiFetch } = useAuth();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isFetchingAI, setIsFetchingAI] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [executionSteps, setExecutionSteps] = useState<ExecutionStep[]>([]);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);
  const [apiError, setApiError] = useState<string | null>(null);
  
  const [calculations, setCalculations] = useState<any[]>([]);
  const [evidence, setEvidence] = useState<any[]>([]);
  const [approval, setApproval] = useState<any | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = [
    { id: 'nav-dash',  name: 'Executive Dashboard', category: 'Navigation', icon: Activity, action: () => onNavigate('dashboard'), hint: 'Real-time KPIs & Runway' },
    { id: 'nav-work',  name: 'Employee Workspace', category: 'Navigation', icon: Briefcase, action: () => onNavigate('workspace'), hint: 'Role task board & co-pilot' },
    { id: 'nav-appr',  name: 'Approval Queue', category: 'Navigation', icon: CheckSquare, action: () => onNavigate('approvals'), hint: 'Founder sign-offs' },
    { id: 'nav-flow',  name: 'Workflows & DAG', category: 'Navigation', icon: Layers, action: () => onNavigate('workflows'), hint: 'Strategic initiatives' },
    { id: 'nav-know',  name: 'Company Knowledge', category: 'Navigation', icon: Database, action: () => onNavigate('knowledge'), hint: 'RAG vector corpus' },
    { id: 'nav-scen',  name: 'Scenario Studio', category: 'Navigation', icon: TrendingUp, action: () => onNavigate('scenarios'), hint: 'Financial What-Ifs' },
    { id: 'nav-peop',  name: 'People & Access', category: 'Navigation', icon: Users, action: () => onNavigate('people'), hint: 'Team roster & invites' },
    { id: 'nav-deci',  name: 'Decision Ledger', category: 'Navigation', icon: Shield, action: () => onNavigate('decisions'), hint: 'Immutable audit logs' },
    { id: 'act-sim',   name: 'Simulate Collaboration Cycle', category: 'Quick Actions', icon: Sparkles, action: () => onRunAction('simulate'), hint: 'Multi-agent DAG run' },
  ];

  const filtered = commands.filter(cmd => 
    cmd.name.toLowerCase().includes(query.toLowerCase()) || 
    cmd.category.toLowerCase().includes(query.toLowerCase()) ||
    (cmd.hint && cmd.hint.toLowerCase().includes(query.toLowerCase()))
  );

  async function handleExecuteCommand(userCommand: string) {
    if (!userCommand.trim() || isFetchingAI) return;
    setIsFetchingAI(true);
    setAiResponse(null);
    setApiError(null);
    setCalculations([]);
    setEvidence([]);
    setApproval(null);
    setExecutionSteps([
      { agent: 'CEO Orchestrator', action: 'Analyzing founder intent & routing to executive specialists', status: 'running' }
    ]);
    
    try {
      const fetchImpl = apiFetch || fetch;
      const response = await fetchImpl('/api/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: userCommand, context: { source: 'command_palette' } })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setApiError(`Execution failed: ${data.error || data.detail || 'Unknown error'}`);
        return;
      }
      
      setAiResponse(data.answer?.summary || 'Command processed.');
      if (data.agents && data.agents.length > 0) {
        setExecutionSteps(data.agents.map((a: any) => ({
          agent: a.role,
          action: a.contribution || `Status: ${a.status}`,
          status: a.status
        })));
      }
      if (data.calculations) {
        setCalculations(data.calculations);
      }
      if (data.evidence) {
        setEvidence(data.evidence);
      }
      if (data.approval?.required) {
        setApproval(data.approval);
        setPendingApprovalsCount(1);
      } else {
        setPendingApprovalsCount(0);
      }
    } catch (err: any) {
      console.error(err);
      setApiError(`Error reaching AI Executive Team: ${err.message}`);
    } finally {
      setIsFetchingAI(false);
    }
  }

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setAiResponse(null);
      setApiError(null);
      setExecutionSteps([]);
      setTimeout(() => inputRef.current?.focus(), 50);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(filtered.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + Math.max(filtered.length, 1)) % Math.max(filtered.length, 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (query.trim().length > 0 && filtered.length === 0) {
        handleExecuteCommand(query);
      } else if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
        onClose();
      } else if (query.trim()) {
        handleExecuteCommand(query);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] p-4 bg-slate-900/30 backdrop-blur-xs animate-fade-in select-none">
      <div 
        ref={containerRef}
        className="w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[640px] border transition-all"
        style={{ 
          backgroundColor: 'var(--c-surface)', 
          borderColor: 'var(--c-border)',
          color: 'var(--c-fg)',
          boxShadow: 'var(--shadow-xl)'
        }}
      >
        {/* Raycast-Style Search Bar */}
        <div 
          className="flex items-center gap-3 px-4 py-3.5 border-b"
          style={{ borderColor: 'var(--c-border)', backgroundColor: 'var(--c-surface)' }}
        >
          <Search className="w-5 h-5 shrink-0 opacity-60" style={{ color: 'var(--c-muted)' }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Ask CEO Orchestrator or search commands..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent text-sm focus:outline-none font-sans"
            style={{ color: 'var(--c-fg)' }}
          />
          <span 
            className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold border shrink-0"
            style={{ 
              backgroundColor: 'var(--c-surface-2)', 
              borderColor: 'var(--c-border)', 
              color: 'var(--c-muted)' 
            }}
          >
            ESC
          </span>
        </div>

        {/* Content list & Live Execution view */}
        <div 
          className="flex-1 overflow-y-auto p-2.5 space-y-2.5"
          style={{ backgroundColor: 'var(--c-bg)' }}
        >
          {query.trim().length > 0 && (
            <div className="mb-2">
              <div className="flex items-center justify-between px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider font-mono text-[var(--c-faint)]">
                <span>Direct AI Directive</span>
                <span className="text-emerald-500 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  CEO Orchestrator Ready
                </span>
              </div>
              <button
                onClick={() => handleExecuteCommand(query)}
                disabled={isFetchingAI}
                className="w-full text-left flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all border font-sans cursor-pointer group"
                style={{
                  backgroundColor: 'var(--c-surface)',
                  borderColor: 'var(--c-border)',
                  color: 'var(--c-fg)'
                }}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Rocket className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span className="truncate">Execute Directive: <span className="text-indigo-500">"{query}"</span></span>
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--c-surface-2)] border border-[var(--c-border)] text-[var(--c-muted)] shrink-0 flex items-center gap-1">
                  <CornerDownLeft className="w-2.5 h-2.5" /> Enter
                </span>
              </button>

              {/* Execution Steps & Live Progress */}
              {isFetchingAI && (
                <div 
                  className="mt-2.5 p-3.5 rounded-xl border text-xs font-sans space-y-2"
                  style={{ 
                    backgroundColor: 'var(--c-surface)', 
                    borderColor: 'var(--c-border)' 
                  }}
                >
                  <div className="flex items-center gap-2 font-semibold" style={{ color: 'var(--c-fg)' }}>
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                    <span>CEO Orchestrator Coordinating Executive Specialists...</span>
                  </div>
                  <div className="space-y-1.5 pl-6 text-[11px]" style={{ color: 'var(--c-muted)' }}>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                      Analyzing intent, consulting company memory & RAG context
                    </div>
                  </div>
                </div>
              )}

              {/* Completed Execution Steps */}
              {!isFetchingAI && executionSteps.length > 0 && (
                <div 
                  className="mt-2.5 p-3 rounded-xl border text-xs space-y-2"
                  style={{ 
                    backgroundColor: 'var(--c-surface)', 
                    borderColor: 'var(--c-border)' 
                  }}
                >
                  <div className="font-semibold text-[10px] uppercase tracking-wider font-mono" style={{ color: 'var(--c-faint)' }}>
                    Executive Agents Engaged
                  </div>
                  {executionSteps.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-[11px]" style={{ color: 'var(--c-fg-secondary)' }}>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold capitalize text-[var(--c-fg)]">{step.agent.replace('_', ' ')}</span>: {step.action}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Deterministic Calculations */}
              {!isFetchingAI && calculations.length > 0 && (
                <div 
                  className="mt-2.5 p-3 rounded-xl border text-xs space-y-1.5"
                  style={{ 
                    backgroundColor: 'rgba(99, 102, 241, 0.05)', 
                    borderColor: 'rgba(99, 102, 241, 0.2)' 
                  }}
                >
                  <div className="font-semibold text-[10px] uppercase tracking-wider font-mono text-indigo-500">
                    Deterministic Financial Models
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {calculations.map((calc, idx) => (
                      <div 
                        key={idx} 
                        className="p-2 rounded-lg border"
                        style={{ 
                          backgroundColor: 'var(--c-surface)', 
                          borderColor: 'var(--c-border)' 
                        }}
                      >
                        <div className="text-[10px]" style={{ color: 'var(--c-muted)' }}>{calc.metric}</div>
                        <div className="text-xs font-bold font-mono" style={{ color: 'var(--c-fg)' }}>
                          {typeof calc.value === 'number' ? calc.value.toLocaleString() : calc.value}
                        </div>
                        <div className="text-[9px] text-indigo-500">{calc.source}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Response Card */}
              {aiResponse && (
                <div 
                  className="mt-2.5 p-4 rounded-xl border text-xs font-sans"
                  style={{ 
                    backgroundColor: 'var(--c-surface)', 
                    borderColor: 'var(--c-border)' 
                  }}
                >
                  <div className="flex items-center gap-1.5 font-bold mb-2 pb-1.5 border-b" style={{ borderColor: 'var(--c-border)', color: 'var(--c-fg)' }}>
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    Unified Recommendation (Audited & Grounded)
                  </div>
                  <div className="leading-relaxed whitespace-pre-wrap font-sans" style={{ color: 'var(--c-fg-secondary)' }}>
                    {aiResponse}
                  </div>

                  {/* Evidence Citations */}
                  {evidence.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t" style={{ borderColor: 'var(--c-border)' }}>
                      <div className="text-[10px] font-mono font-semibold mb-1" style={{ color: 'var(--c-muted)' }}>Grounded Evidence / Sources:</div>
                      <div className="flex flex-wrap gap-1">
                        {evidence.map((ev, idx) => (
                          <span 
                            key={idx} 
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] border font-mono"
                            style={{ 
                              backgroundColor: 'var(--c-surface-2)', 
                              borderColor: 'var(--c-border)', 
                              color: 'var(--c-fg)' 
                            }}
                          >
                            {ev.citationId}: {ev.documentName || 'Startup Record'}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {approval && approval.required && (
                    <div 
                      className="mt-3 pt-2.5 flex items-center justify-between p-2.5 rounded-lg border"
                      style={{ 
                        backgroundColor: 'rgba(245, 158, 11, 0.08)', 
                        borderColor: 'rgba(245, 158, 11, 0.25)' 
                      }}
                    >
                      <span className="text-[11px] font-medium flex items-center gap-1.5 text-amber-500">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                        Requires Founder Approval: {approval.reason || 'High-impact decision'}
                      </span>
                      <button
                        onClick={() => {
                          onNavigate('approvals');
                          onClose();
                        }}
                        className="px-2.5 py-1 text-[10px] font-semibold rounded-md transition-colors cursor-pointer"
                        style={{ 
                          backgroundColor: 'var(--c-fg)', 
                          color: 'var(--c-bg)' 
                        }}
                      >
                        Review in Approvals →
                      </button>
                    </div>
                  )}
                </div>
              )}

              {apiError && (
                <div className="mt-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-500 font-semibold">
                  {apiError}
                </div>
              )}
            </div>
          )}

          {filtered.length === 0 && !query.trim() ? (
            <div className="text-center py-6 text-xs font-sans" style={{ color: 'var(--c-muted)' }}>
              Type to search views or issue an AI directive...
            </div>
          ) : filtered.length === 0 && query.trim() ? null : (
            <>
              {['Navigation', 'Quick Actions'].map(category => {
                const categoryCmds = filtered.filter(c => c.category === category);
                if (categoryCmds.length === 0) return null;

                return (
                  <div key={category} className="space-y-1">
                    <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider font-mono" style={{ color: 'var(--c-faint)' }}>
                      {category}
                    </div>
                    {categoryCmds.map((cmd) => {
                      const itemIndex = filtered.indexOf(cmd);
                      const isHighlighted = itemIndex === selectedIndex;
                      return (
                        <button
                          key={cmd.id}
                          onClick={() => {
                            cmd.action();
                            onClose();
                          }}
                          onMouseEnter={() => setSelectedIndex(itemIndex)}
                          className="w-full text-left flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all font-sans cursor-pointer border"
                          style={{
                            backgroundColor: isHighlighted ? 'var(--c-surface-2)' : 'var(--c-surface)',
                            borderColor: isHighlighted ? 'var(--c-border-strong)' : 'transparent',
                            color: isHighlighted ? 'var(--c-fg)' : 'var(--c-muted)',
                          }}
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <cmd.icon 
                              className="w-4 h-4 shrink-0 transition-colors" 
                              style={{ color: isHighlighted ? 'var(--c-accent)' : 'inherit' }} 
                            />
                            <span className="truncate">{cmd.name}</span>
                            {cmd.hint && (
                              <span className="text-[10px] font-normal truncate opacity-60 ml-1">
                                {cmd.hint}
                              </span>
                            )}
                          </span>
                          <span 
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 opacity-70"
                            style={{ 
                              backgroundColor: 'var(--c-bg)', 
                              borderColor: 'var(--c-border)',
                              color: 'var(--c-muted)'
                            }}
                          >
                            ↵ Jump
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Raycast Keyboard Shortcuts Footer */}
        <div 
          className="px-4 py-2 border-t flex items-center justify-between text-[11px] font-mono"
          style={{ 
            backgroundColor: 'var(--c-surface-2)', 
            borderColor: 'var(--c-border)', 
            color: 'var(--c-muted)' 
          }}
        >
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
          </div>
          <div className="text-[10px] text-[var(--c-faint)]">
            CatalystOS Raycast Engine
          </div>
        </div>
      </div>
    </div>
  );
}
