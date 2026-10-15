import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  StartupProfile, 
  Agent, 
  Initiative, 
  Deliverable, 
  KnowledgeFile, 
  DecisionRecord, 
  DelegatedTask, 
  CompanyMembership, 
  CompanyInvitation 
} from '../types';
import {
  TrendingUp, TrendingDown, Clock, ArrowRight,
  Sparkles, CheckSquare, Activity,
  Wallet, ChevronRight, Users, Scale,
  Briefcase, Check, ShieldCheck, AlertCircle,
  FileText, ExternalLink, Layers, Loader2,
  BookOpen, UploadCloud, Database, Target,
  Shield, ChevronDown, SlidersHorizontal, X,
  Plus, Radio, Mic, Send, Bot, AlertTriangle, ArrowUpRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../hooks/useChat';
import { formatINR, formatCompactINR } from '../utils/currency';
import VoiceModeModal from './voice/VoiceModeModal';
import VoiceStudioPanel from './voice/VoiceStudioPanel';
import ExecutiveDirectiveDispatcher from './ExecutiveDirectiveDispatcher';

interface SaaSDashboardProps {
  startup: StartupProfile;
  agents: Agent[];
  initiatives: Initiative[];
  approvals: Deliverable[];
  decisions: DecisionRecord[];
  knowledge: KnowledgeFile[];
  tasks?: DelegatedTask[];
  memberships?: CompanyMembership[];
  invitations?: CompanyInvitation[];
  onReviewItem: (id: string, action: 'approve' | 'modify' | 'reject', feedback?: string, modifications?: any) => Promise<void>;
  onUploadDoc: (name: string, content: string, type: string) => Promise<void>;
  onLaunchInitiative: (title: string, description: string, category: 'funding' | 'hiring' | 'growth' | 'operations' | 'legal') => Promise<void>;
  onSimulateInitiative: (id: string) => Promise<void>;
  onUpdateStartup: (updated: StartupProfile) => void;
  onRefreshTasks?: () => Promise<void>;
  onNavigate?: (tab: 'dashboard' | 'workspace' | 'approvals' | 'knowledge' | 'agents' | 'workflows' | 'people' | 'scenarios' | 'decisions' | 'council') => void;
}

function formatCurrency(val: number): string {
  return formatINR(val);
}

export default function SaaSDashboard({
  startup,
  agents,
  initiatives,
  approvals,
  decisions,
  knowledge,
  tasks = [],
  memberships = [],
  invitations = [],
  onReviewItem,
  onLaunchInitiative,
  onSimulateInitiative,
  onUpdateStartup,
  onRefreshTasks,
  onNavigate,
}: SaaSDashboardProps) {
  const { user, apiFetch } = useAuth();
  const { sendMessage, messages, isTyping, cancelRun } = useChat(apiFetch, user?.id);

  // Modals state
  const [isCalibratingTreasury, setIsCalibratingTreasury] = useState(false);
  const [isLaunchingInitiative, setIsLaunchingInitiative] = useState(false);
  const [isDirectiveOpen, setIsDirectiveOpen] = useState(false);
  const [isVoiceModeOpen, setIsVoiceModeOpen] = useState(false);
  const [isVoiceStudioOpen, setIsVoiceStudioOpen] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  // Form states - realistic INR defaults (₹72L reserves, ₹8L/mo burn)
  const [editCash, setEditCash] = useState<number>(startup.cashBalance || 7200000);
  const [editBurn, setEditBurn] = useState<number>(startup.burnRate || 800000);
  const [isSavingTreasury, setIsSavingTreasury] = useState(false);

  const [initTitle, setInitTitle] = useState('');
  const [initDesc, setInitDesc] = useState('');
  const [initCategory, setInitCategory] = useState<'funding' | 'hiring' | 'growth' | 'operations' | 'legal'>('growth');
  const [isDeployingInit, setIsDeployingInit] = useState(false);

  const [directivePrompt, setDirectivePrompt] = useState('');
  const [isSendingDirective, setIsSendingDirective] = useState(false);

  useEffect(() => {
    if (startup.cashBalance !== undefined) setEditCash(startup.cashBalance);
    if (startup.burnRate !== undefined) setEditBurn(startup.burnRate);
  }, [startup.cashBalance, startup.burnRate]);

  // Financial calculations in INR
  const cashBalance = startup.cashBalance ?? 7200000;
  const burnRate = startup.burnRate ?? 800000;
  const runwayMonths = startup.runwayMonths > 0 ? startup.runwayMonths : (burnRate > 0 ? cashBalance / burnRate : 9.0);
  const healthScore = startup.healthScore ?? 84;
  const monthlyBurnRatio = cashBalance > 0 ? ((burnRate / cashBalance) * 100).toFixed(1) : '0';

  const metrics = {
    velocity: startup.metrics?.velocity ?? 78,
    financialHealth: startup.metrics?.financialHealth ?? 84,
    legalCompliance: startup.metrics?.legalCompliance ?? 92,
    growthRate: startup.metrics?.growthRate ?? 65,
    operationsEfficiency: startup.metrics?.operationsEfficiency ?? 80,
  };

  // Strictly deduplicated pending approvals (max 3 distinct items, never repeated)
  const pendingApprovals = useMemo(() => {
    const seen = new Set<string>();
    const unique: Deliverable[] = [];
    for (const a of approvals) {
      const key = (a.title || '').trim().toLowerCase();
      if (a.status === 'pending_review' && !seen.has(key)) {
        seen.add(key);
        unique.push(a);
      }
    }
    return unique.slice(0, 3);
  }, [approvals]);

  const unassignedTasks = useMemo(() => {
    return tasks.filter(t => t.needsHumanOwner && t.status !== 'approved' && t.status !== 'rejected');
  }, [tasks]);

  // Detected risks (max 2 distinct risks)
  const detectedRisks = useMemo(() => {
    const risks: Array<{
      id: string;
      title: string;
      description: string;
      severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
      actionLabel: string;
      action: () => void;
    }> = [];

    if (runwayMonths < 4) {
      risks.push({
        id: 'r_runway_crit',
        title: 'Critical Capital Runway (< 4.0 Months)',
        description: `Current runway is ${runwayMonths.toFixed(1)} months. Non-essential expenses will trigger CFO vetoes.`,
        severity: 'CRITICAL',
        actionLabel: 'Calibrate Reserves',
        action: () => setIsCalibratingTreasury(true),
      });
    } else if (runwayMonths < 8) {
      risks.push({
        id: 'r_runway_warn',
        title: 'Runway Buffer Horizon (< 8.0 Months)',
        description: `Cash reserves support ${runwayMonths.toFixed(1)} months of runway. Staged hiring pace is advised.`,
        severity: 'MEDIUM',
        actionLabel: 'Calibrate Reserves',
        action: () => setIsCalibratingTreasury(true),
      });
    }

    if (unassignedTasks.length > 0) {
      risks.push({
        id: 'r_unassigned',
        title: `${unassignedTasks.length} Delegated Task${unassignedTasks.length > 1 ? 's' : ''} Awaiting Owner`,
        description: `Council-decomposed items in ${Array.from(new Set(unassignedTasks.map(t => t.department))).join(', ')} require human review.`,
        severity: 'MEDIUM',
        actionLabel: 'Assign in Workspace',
        action: () => onNavigate?.('workspace'),
      });
    }

    if (knowledge.length === 0) {
      risks.push({
        id: 'r_knowledge',
        title: 'Zero Corporate Knowledge Documents Ingested',
        description: 'AI agents are running on baseline heuristics. Upload pitch decks or financials for precision grounding.',
        severity: 'LOW',
        actionLabel: 'Ingest Documents',
        action: () => onNavigate?.('knowledge'),
      });
    }

    return risks.slice(0, 2);
  }, [runwayMonths, unassignedTasks, knowledge, onNavigate]);

  // Fallback distinct realistic priorities when queue is light
  const fallbackPriorities = useMemo(() => [
    {
      id: 'p_upi_webhook',
      title: 'Review UPI Auto-Reversal Webhook Handlers',
      category: 'ENGINEERING',
      owner: 'Amit Patel (Backend Lead)',
      urgency: 'HIGH',
      description: 'Ensure NPCI timeout error code 92 triggers automated refund reversals within 120 seconds.',
      actionLabel: 'Review Specs',
      action: () => onNavigate?.('workspace'),
    },
    {
      id: 'p_gst_compliance',
      title: 'Validate E-Invoicing GST Portal Credentials',
      category: 'LEGAL',
      owner: 'Helena Vance (Counsel)',
      urgency: 'MEDIUM',
      description: 'Test GSP production API tokens for automatic B2B IRN generation ahead of Q3 enterprise launch.',
      actionLabel: 'Inspect Gate',
      action: () => onNavigate?.('workspace'),
    }
  ], [onNavigate]);

  const handleQuickApprove = async (id: string) => {
    setReviewingId(id);
    try {
      await onReviewItem(id, 'approve');
    } finally {
      setReviewingId(null);
    }
  };

  const handleSendDirective = async () => {
    if (!directivePrompt.trim() || isSendingDirective) return;
    setIsSendingDirective(true);
    try {
      await sendMessage(directivePrompt.trim());
      setDirectivePrompt('');
      setIsDirectiveOpen(false);
      if (onRefreshTasks) {
        setTimeout(() => onRefreshTasks(), 1200);
      }
    } finally {
      setIsSendingDirective(false);
    }
  };

  const handleSaveTreasury = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingTreasury(true);
    try {
      const numCash = Math.max(0, Number(editCash) || 0);
      const numBurn = Math.max(0, Number(editBurn) || 0);
      const numRunway = numBurn > 0 ? parseFloat((numCash / numBurn).toFixed(1)) : 999;
      const updated: StartupProfile = {
        ...startup,
        cashBalance: numCash,
        burnRate: numBurn,
        runwayMonths: numRunway,
      };
      await onUpdateStartup(updated);
      setIsCalibratingTreasury(false);
    } finally {
      setIsSavingTreasury(false);
    }
  };

  const handleCreateInitiative = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!initTitle.trim() || isDeployingInit) return;
    setIsDeployingInit(true);
    try {
      await onLaunchInitiative(initTitle.trim(), initDesc.trim(), initCategory);
      setInitTitle('');
      setInitDesc('');
      setIsLaunchingInitiative(false);
    } finally {
      setIsDeployingInit(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">

      {/* ── 1. Page Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Overview
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time operating telemetry, capital runway, and governance execution for <span className="font-semibold text-slate-700">{startup.name}</span>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCalibratingTreasury(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors shadow-xs cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
            <span>Calibrate Treasury</span>
          </button>

          <button
            onClick={() => setIsDirectiveOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors shadow-xs cursor-pointer"
          >
            <Bot className="w-3.5 h-3.5 text-indigo-600" />
            <span>Issue Directive</span>
          </button>

          <button
            onClick={() => setIsLaunchingInitiative(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Initiative</span>
          </button>
        </div>
      </div>

      {/* ── 1.5 Executive Directive Dispatcher (Sophia Vance) ──────────────── */}
      <ExecutiveDirectiveDispatcher
        messages={messages}
        isTyping={isTyping}
        onSendDirective={async (directive) => {
          await sendMessage(directive);
          if (onRefreshTasks) setTimeout(() => onRefreshTasks(), 1200);
        }}
        onCancelRun={cancelRun}
        onNavigate={onNavigate}
        startupName={startup.name}
      />

      {/* ── 2. Core Metrics: 4 Clean KPI Cards ────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Treasury Reserves */}
        <div 
          onClick={() => setIsCalibratingTreasury(true)}
          className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-slate-300 transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Treasury Reserves</span>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              <span>+12.4% MoM</span>
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900 font-sans">
            {formatCurrency(cashBalance)}
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Monthly Burn {formatCurrency(burnRate)}</span>
            <span className="text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity font-medium">Edit →</span>
          </div>
        </div>

        {/* Monthly Net Burn */}
        <div 
          onClick={() => setIsCalibratingTreasury(true)}
          className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-slate-300 transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Monthly Net Burn</span>
            <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
              {monthlyBurnRatio}% of capital/mo
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900 font-sans">
            {formatCurrency(burnRate)}
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Operating Outflows</span>
            <span className="text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity font-medium">Edit →</span>
          </div>
        </div>

        {/* Estimated Runway */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Runway Horizon</span>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
              runwayMonths >= 12
                ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
                : runwayMonths >= 6
                ? 'text-amber-700 bg-amber-50 border-amber-100'
                : 'text-rose-700 bg-rose-50 border-rose-100'
            }`}>
              {runwayMonths >= 12 ? 'Healthy' : runwayMonths >= 6 ? 'Buffer Zone' : 'Critical'}
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900 font-sans">
            {runwayMonths.toFixed(1)} <span className="text-xs font-normal text-slate-500">months</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            <span>CFO Veto Gate: &lt; 4.0 months</span>
          </div>
        </div>

        {/* Operational Health Index */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Health Index</span>
            <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
              {healthScore} / 100
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900 font-sans">
            {healthScore}%
          </div>
          <div className="mt-2 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-indigo-600 h-full rounded-full transition-all duration-500" 
              style={{ width: `${Math.min(100, Math.max(0, healthScore))}%` }}
            />
          </div>
        </div>

      </div>

      {/* ── 3. Section 1: Today's Priorities & Action Items (Top Priority) ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-600" />
            <h2 className="text-sm font-semibold text-slate-900">Today's Priorities</h2>
            <span className="text-[11px] font-medium text-slate-500">
              ({pendingApprovals.length + detectedRisks.length} actionable items)
            </span>
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate('approvals')}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>View all approvals</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Priority Items List */}
        {pendingApprovals.length > 0 || detectedRisks.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {/* Pending Approvals (Distinct, Deduplicated) */}
            {pendingApprovals.map((item) => (
              <div 
                key={item.id} 
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 first:pt-0 last:pb-0"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0 mt-0.5">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-xs text-slate-900">{item.title}</span>
                      <span className="text-[10px] font-medium uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {item.type.replace('_', ' ')}
                      </span>
                      {item.financialChange !== undefined && item.financialChange !== 0 && (
                        <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded ${
                          item.financialChange > 0 
                            ? 'text-emerald-700 bg-emerald-50' 
                            : 'text-rose-700 bg-rose-50'
                        }`}>
                          {item.financialChange > 0 ? `+${formatCurrency(item.financialChange)}` : `-${formatCurrency(Math.abs(item.financialChange))}`}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{item.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    disabled={reviewingId === item.id}
                    onClick={() => handleQuickApprove(item.id)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors shadow-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {reviewingId === item.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Check className="w-3 h-3" />
                    )}
                    <span>Approve</span>
                  </button>
                  {onNavigate && (
                    <button
                      onClick={() => onNavigate('approvals')}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium transition-colors cursor-pointer"
                    >
                      Details
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Critical Sentinel Risks */}
            {detectedRisks.map((risk) => (
              <div 
                key={risk.id} 
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 first:pt-0 last:pb-0"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    risk.severity === 'CRITICAL' 
                      ? 'bg-rose-50 text-rose-600 border border-rose-100'
                      : risk.severity === 'HIGH'
                      ? 'bg-amber-50 text-amber-600 border border-amber-100'
                      : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                  }`}>
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-slate-900">{risk.title}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                        risk.severity === 'CRITICAL'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : risk.severity === 'HIGH'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {risk.severity}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{risk.description}</p>
                  </div>
                </div>

                <button
                  onClick={risk.action}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium transition-colors cursor-pointer shrink-0 self-end sm:self-center"
                >
                  {risk.actionLabel}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {fallbackPriorities.map((item) => (
              <div 
                key={item.id} 
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 first:pt-0 last:pb-0"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-xs text-slate-900">{item.title}</span>
                      <span className="text-[10px] font-medium uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {item.category}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        Owner: {item.owner}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{item.description}</p>
                  </div>
                </div>

                <button
                  onClick={item.action}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium transition-colors cursor-pointer shrink-0 self-end sm:self-center"
                >
                  {item.actionLabel}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 4. Section 2: Work in Progress (Active Sprints & Council) ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        
        {/* Left: Active Strategic Sprints (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4 flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-semibold text-slate-900">Work in Progress</h3>
                <span className="text-xs text-slate-400">({initiatives.length} initiatives)</span>
              </div>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('workflows')}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>Workflows &amp; DAG</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {initiatives.length > 0 ? (
              <div className="space-y-3 mt-3">
                {initiatives.slice(0, 3).map((init) => {
                  const completedTasks = init.tasks?.filter(t => t.status === 'completed').length || 0;
                  const totalTasks = init.tasks?.length || 1;
                  const progressPct = Math.round((completedTasks / totalTasks) * 100);

                  return (
                    <div 
                      key={init.id}
                      className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-semibold text-slate-900 truncate">{init.title}</span>
                          <span className="text-[10px] uppercase font-medium px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 shrink-0">
                            {init.category}
                          </span>
                        </div>
                        <span className="text-xs font-mono font-medium text-slate-500 shrink-0">
                          {progressPct}%
                        </span>
                      </div>

                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                        <span>Phase: {init.status === 'active' ? 'Execution in Progress' : 'Pending Deployment'}</span>
                        <button
                          onClick={() => onSimulateInitiative(init.id)}
                          className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 cursor-pointer"
                        >
                          <span>Simulate Next Step</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-500 text-xs">
                <p>No active workflow initiatives currently deployed.</p>
                <button
                  onClick={() => setIsLaunchingInitiative(true)}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
                >
                  Launch Strategic Initiative
                </button>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Autonomous multi-agent sprint orchestration</span>
            {onNavigate && (
              <button 
                onClick={() => onNavigate('workflows')} 
                className="text-indigo-600 font-medium hover:underline"
              >
                Manage full DAG pipeline →
              </button>
            )}
          </div>
        </div>

        {/* Right: Executive Council Roster (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-semibold text-slate-900">Executive Council</h3>
              </div>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('council')}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>Council Suite</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="space-y-2 mt-3">
              {agents.slice(0, 5).map((ag) => (
                <div 
                  key={ag.id}
                  onClick={() => onNavigate?.('council')}
                  className="p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-700 shrink-0">
                      {ag.role.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-slate-900 truncate">{ag.name.split(' ')[0]}</div>
                      <div className="text-[10px] text-slate-500 truncate">{ag.role}</div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[11px] font-mono font-medium text-slate-700 block">
                      {ag.metricValue}
                    </span>
                    <span className="text-[10px] text-slate-400 block">{ag.keyMetric}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>8 Autonomous Executives Grounded</span>
            {onNavigate && (
              <button 
                onClick={() => onNavigate('council')} 
                className="text-indigo-600 font-medium hover:underline"
              >
                Convene Council →
              </button>
            )}
          </div>
        </div>

      </div>

      {/* ── 5. Section 3: Company Intelligence & Sentinel Risks ────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
        
        {/* Left: Company Knowledge */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4 flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-semibold text-slate-900">Company Knowledge Base</h3>
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                {knowledge.length} Documents Synced
              </span>
            </div>

            <p className="text-xs text-slate-500 mt-2">
              Corporate pitch decks, cap tables, and financials ingested into PostgreSQL vector storage to ground autonomous decision-making.
            </p>

            {knowledge.length > 0 ? (
              <div className="space-y-2 mt-3">
                {knowledge.slice(0, 3).map((doc) => (
                  <div 
                    key={doc.id}
                    onClick={() => onNavigate?.('knowledge')}
                    className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-xs font-medium text-slate-800 truncate">{doc.name}</span>
                    </div>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-500 shrink-0">
                      {doc.type.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 text-center text-xs text-slate-500 mt-3">
                No corporate documents uploaded yet. Upload your deck to ground the AI executive team.
              </div>
            )}
          </div>

          <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-100 mt-3">
            <span className="text-slate-500 font-mono text-[11px]">pgvector RLS Enforced</span>
            {onNavigate && (
              <button 
                onClick={() => onNavigate('knowledge')}
                className="text-indigo-600 font-medium hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Upload &amp; Manage Knowledge</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right: Sentinel Risk Matrix */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4 flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-semibold text-slate-900">Sentinel Risk Radar</h3>
              </div>
              <span className="text-xs text-slate-400">Automated Audit Guardrails</span>
            </div>

            <div className="space-y-3 mt-3">
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-900">Treasury Runway Horizon</div>
                <div className="text-[11px] text-slate-500">{runwayMonths.toFixed(1)} months remaining at current burn rate</div>
              </div>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                runwayMonths >= 12
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {runwayMonths >= 12 ? 'Healthy' : 'Caution'}
              </span>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-900">Executive Task Delegation</div>
                <div className="text-[11px] text-slate-500">
                  {unassignedTasks.length > 0 ? `${unassignedTasks.length} tasks need human owners` : 'All tasks assigned to verified owners'}
                </div>
              </div>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                unassignedTasks.length > 0
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                {unassignedTasks.length > 0 ? 'Pending Action' : 'Fully Staffed'}
              </span>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-900">Governance &amp; Audit Trail</div>
                <div className="text-[11px] text-slate-500">Immutable ledger records with cryptographic timestamps</div>
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                SOC-2 Ready
              </span>
            </div>
          </div>
        </div>

          <div className="pt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 mt-3">
            <span>Automated auditor verification pass</span>
            {onNavigate && (
              <button 
                onClick={() => onNavigate('decisions')}
                className="text-indigo-600 font-medium hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Audit Ledger</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

      </div>

      {/* ── 6. Section 4: Recent Decisions & Activity Table ────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-900">Recent Decisions Ledger</h3>
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate('decisions')}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>Full Decision Log</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {decisions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="pb-2 font-medium">Timestamp</th>
                  <th className="pb-2 font-medium">Decision Title</th>
                  <th className="pb-2 font-medium">Category</th>
                  <th className="pb-2 font-medium">Financial Impact</th>
                  <th className="pb-2 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {decisions.slice(0, 5).map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-2.5 text-slate-500 font-mono text-[11px]">
                      {new Date(d.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="py-2.5 font-medium text-slate-900 max-w-xs truncate">
                      {d.title}
                    </td>
                    <td className="py-2.5">
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {d.category}
                      </span>
                    </td>
                    <td className="py-2.5 font-mono">
                      {d.financialImpact !== undefined && d.financialImpact !== 0 ? (
                        <span className={d.financialImpact > 0 ? 'text-emerald-600 font-semibold' : 'text-slate-600'}>
                          {d.financialImpact > 0 ? `+${formatCurrency(d.financialImpact)}` : formatCurrency(d.financialImpact)}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        d.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {d.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-6 text-center text-slate-500 text-xs">
            No decisions logged yet. Decisions signed off in the Approval Queue will be recorded here.
          </div>
        )}
      </div>

      {/* ── 7. Calibrate Treasury Modal ────────────────────────────────────── */}
      {isCalibratingTreasury && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Calibrate Treasury &amp; Runway</h3>
                  <p className="text-xs text-slate-500">Update cash reserves and monthly net burn rate</p>
                </div>
              </div>
              <button
                onClick={() => setIsCalibratingTreasury(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTreasury} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Cash Reserves (₹ INR)</label>
                  <input
                    type="number"
                    min="0"
                    step="50000"
                    value={editCash}
                    onChange={(e) => setEditCash(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs font-semibold text-slate-900"
                    required
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Monthly Net Burn (₹/mo)</label>
                  <input
                    type="number"
                    min="0"
                    step="10000"
                    value={editBurn}
                    onChange={(e) => setEditBurn(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs font-semibold text-slate-900"
                    required
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-slate-500">Projected Runway: </span>
                  <span className="font-bold text-slate-900">
                    {editBurn > 0 ? (editCash / editBurn).toFixed(1) : '∞'} Months
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Burn Ratio: </span>
                  <span className="font-bold text-slate-900">
                    {editCash > 0 ? ((editBurn / editCash) * 100).toFixed(1) : 0}% / mo
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCalibratingTreasury(false)}
                  className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingTreasury}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSavingTreasury ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Save Parameters</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 8. Launch Initiative Modal ──────────────────────────────────────── */}
      {isLaunchingInitiative && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Launch Strategic Initiative</h3>
                  <p className="text-xs text-slate-500">Deploy cross-functional workflow to executive council</p>
                </div>
              </div>
              <button
                onClick={() => setIsLaunchingInitiative(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateInitiative} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Initiative Title</label>
                <input
                  type="text"
                  value={initTitle}
                  onChange={(e) => setInitTitle(e.target.value)}
                  placeholder="e.g. Q3 Enterprise Sales GTM Acceleration"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Category &amp; Domain</label>
                <select
                  value={initCategory}
                  onChange={(e: any) => setInitCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs"
                >
                  <option value="growth">Growth &amp; Acquisition (Vector)</option>
                  <option value="hiring">Hiring &amp; Headcount (Echo)</option>
                  <option value="funding">Funding &amp; Capital (Marcus)</option>
                  <option value="operations">Operations &amp; Delivery (Helix)</option>
                  <option value="legal">Legal &amp; Compliance (Helena)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Strategic Objective &amp; Scope</label>
                <textarea
                  rows={3}
                  value={initDesc}
                  onChange={(e) => setInitDesc(e.target.value)}
                  placeholder="Describe target deliverable, success criteria, and budget expectations..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLaunchingInitiative(false)}
                  className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDeployingInit}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isDeployingInit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>Deploy to Council</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 9. Issue Executive Directive Modal ─────────────────────────────── */}
      {isDirectiveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full p-4 sm:p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Issue Executive Directive</h3>
                  <p className="text-xs text-slate-500">Sophia Vance — Executive Directive Dispatcher</p>
                </div>
              </div>
              <button
                onClick={() => setIsDirectiveOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <ExecutiveDirectiveDispatcher
              messages={messages}
              isTyping={isTyping}
              onSendDirective={async (directive) => {
                await sendMessage(directive);
                if (onRefreshTasks) setTimeout(() => onRefreshTasks(), 1200);
              }}
              onCancelRun={cancelRun}
              onNavigate={(tab) => {
                setIsDirectiveOpen(false);
                onNavigate?.(tab);
              }}
              startupName={startup.name}
              compactMode={true}
            />
          </div>
        </div>
      )}

      {/* Voice Mode Modal & Voice Studio Panel */}
      <VoiceModeModal
        isOpen={isVoiceModeOpen}
        onClose={() => setIsVoiceModeOpen(false)}
        onSendCommand={sendMessage}
        lastAssistantResponse={messages.filter(m => m.role === 'assistant').slice(-1)[0]?.content}
        isOrchestrating={isTyping}
        onOpenVoiceStudio={() => setIsVoiceStudioOpen(true)}
      />

      <VoiceStudioPanel
        isOpen={isVoiceStudioOpen}
        onClose={() => setIsVoiceStudioOpen(false)}
      />

    </div>
  );
}
