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
  const [auxiliaryTab, setAuxiliaryTab] = useState<'sprints' | 'tasks' | 'decisions'>('sprints');

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
  };  return (
    <div className="space-y-6 pb-12 font-sans">

      {/* ── 1. Page Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-2xl lg:text-[30px] font-semibold tracking-tight text-[#141413] leading-tight font-sans">
            Overview
          </h1>
          <p className="text-[14px] lg:text-[15px] font-normal leading-relaxed text-[#666562] mt-1 font-sans">
            Real-time operating telemetry, capital runway, and governance execution for <span className="font-semibold text-[#141413]">{startup.name}</span>.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsCalibratingTreasury(true)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-[#141413]/10 bg-white hover:bg-[#FDFCFA] hover:border-[#141413]/25 text-[#141413] text-xs font-medium transition-all shadow-[rgba(20,20,19,0.02)_0px_1px_3px_0px] cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#666562]" />
            <span>Calibrate Treasury</span>
          </button>

          <button
            onClick={() => setIsDirectiveOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-[#141413]/10 bg-white hover:bg-[#FDFCFA] hover:border-[#141413]/25 text-[#141413] text-xs font-medium transition-all shadow-[rgba(20,20,19,0.02)_0px_1px_3px_0px] cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#141413]" />
            <span>Issue Directive</span>
          </button>

          <button
            onClick={() => setIsLaunchingInitiative(true)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#141413] hover:bg-[#262627] text-[#FDFCFA] text-xs font-semibold transition-all shadow-[rgba(20,20,19,0.08)_0px_2px_6px_0px] cursor-pointer font-sans"
          >
            <Plus className="w-3.5 h-3.5 text-[#FDFCFA]" />
            <span>New Initiative</span>
          </button>
        </div>
      </div>

      {/* ── 2. Unified Top Telemetry Strip ───────────────────────────────── */}
      <div className="bg-[#FDFCFA] rounded-2xl border border-[#141413]/10 shadow-[rgba(20,20,19,0.02)_0px_1px_4px_0px] overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#141413]/10">
          
          {/* Treasury Reserve */}
          <div 
            onClick={() => setIsCalibratingTreasury(true)}
            className="px-6 py-3.5 hover:bg-white transition-colors cursor-pointer group flex flex-col justify-between"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-medium text-[#666562]">Treasury Reserve</span>
              <span className="text-emerald-700 bg-emerald-50 border border-emerald-200/40 px-2 py-0.5 rounded-md font-mono text-xs flex items-center gap-1 font-medium">
                <TrendingUp className="w-3 h-3 text-emerald-600" />
                <span>+12.4% MoM</span>
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-2">
              <span className="text-2xl lg:text-[24px] font-semibold font-mono tracking-tight text-[#141413]">
                {formatCurrency(cashBalance)}
              </span>
              <span className="text-[11px] font-mono text-[#666562] group-hover:text-[#141413] transition-colors">
                Edit ⚙
              </span>
            </div>
          </div>

          {/* Net Monthly Burn */}
          <div 
            onClick={() => setIsCalibratingTreasury(true)}
            className="px-6 py-3.5 hover:bg-white transition-colors cursor-pointer group flex flex-col justify-between"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-medium text-[#666562]">Net Monthly Burn</span>
              <span className="text-[#666562] bg-[#141413]/5 border border-[#141413]/08 px-2 py-0.5 rounded-md font-mono text-xs font-medium">
                {monthlyBurnRatio}% / mo
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-2">
              <span className="text-2xl lg:text-[24px] font-semibold font-mono tracking-tight text-[#141413]">
                {formatCurrency(burnRate)}<span className="text-sm text-[#666562] font-normal font-sans">/mo</span>
              </span>
              <span className="text-[11px] font-mono text-[#666562]">Outflows</span>
            </div>
          </div>

          {/* Runway Horizon */}
          <div className="px-6 py-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-medium text-[#666562]">Runway Horizon</span>
              <span className={`px-2 py-0.5 rounded-md font-mono text-xs font-medium border ${
                runwayMonths >= 12
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200/40'
                  : runwayMonths >= 6
                  ? 'text-amber-700 bg-amber-50 border-amber-200/60'
                  : 'text-rose-700 bg-rose-50 border-rose-200/60'
              }`}>
                {runwayMonths >= 12 ? 'Healthy' : runwayMonths >= 6 ? 'Buffer Zone' : 'Critical'}
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-2">
              <span className="text-2xl lg:text-[24px] font-semibold font-mono tracking-tight text-[#141413]">
                {runwayMonths.toFixed(1)} <span className="text-sm text-[#666562] font-normal font-sans">months</span>
              </span>
              <span className="text-[11px] font-mono text-[#666562]">Gate: &lt;4.0mo</span>
            </div>
          </div>

          {/* Startup Health Index */}
          <div className="px-6 py-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-medium text-[#666562]">Health Index</span>
              <span className="text-[#141413] bg-[#141413]/5 border border-[#141413]/08 px-2 py-0.5 rounded-md font-mono text-xs font-medium">
                {healthScore} / 100
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-2xl lg:text-[24px] font-semibold font-mono tracking-tight text-[#141413]">
                {healthScore}%
              </span>
              <div className="w-24 bg-[#141413]/08 h-2 rounded-full overflow-hidden border border-[#141413]/06">
                <div 
                  className="bg-[#141413] h-full rounded-full transition-all duration-700" 
                  style={{ width: `${Math.min(100, Math.max(0, healthScore))}%` }}
                />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── 3. Main 60/40 Asymmetrical Workspace (7 Cols / 5 Cols) ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* ── Left Column (7 Cols): Strategic Engine ──────────────────────── */}
        <div className="lg:col-span-7 space-y-6">

          {/* 3.1 Executive Directive Dispatcher (Sophia Vance) */}
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

          {/* 3.2 Tabbed Auxiliary Workspace: Sprints, Tasks, Decisions */}
          <div className="bg-white rounded-xl border border-[#141413]/10 shadow-[rgba(20,20,19,0.02)_0px_1px_4px_0px] overflow-hidden">
            {/* Tab Bar Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#141413]/08 bg-[#FDFCFA]">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setAuxiliaryTab('sprints')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    auxiliaryTab === 'sprints'
                      ? 'bg-[#141413] text-[#FDFCFA] shadow-xs'
                      : 'text-[#666562] hover:text-[#141413] hover:bg-[#141413]/05'
                  }`}
                >
                  Active Sprints ({initiatives.length})
                </button>
                <button
                  onClick={() => setAuxiliaryTab('tasks')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    auxiliaryTab === 'tasks'
                      ? 'bg-[#141413] text-[#FDFCFA] shadow-xs'
                      : 'text-[#666562] hover:text-[#141413] hover:bg-[#141413]/05'
                  }`}
                >
                  Priority Tasks ({tasks.length})
                </button>
                <button
                  onClick={() => setAuxiliaryTab('decisions')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    auxiliaryTab === 'decisions'
                      ? 'bg-[#141413] text-[#FDFCFA] shadow-xs'
                      : 'text-[#666562] hover:text-[#141413] hover:bg-[#141413]/05'
                  }`}
                >
                  Recent Decisions ({decisions.length})
                </button>
              </div>

              {onNavigate && (
                <button
                  onClick={() => {
                    if (auxiliaryTab === 'sprints') onNavigate('workflows');
                    else if (auxiliaryTab === 'tasks') onNavigate('workspace');
                    else onNavigate('decisions');
                  }}
                  className="text-xs font-medium text-[#666562] hover:text-[#141413] flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>View all</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Tab Content 1: Active Sprints */}
            {auxiliaryTab === 'sprints' && (
              <div className="p-4 space-y-3">
                {initiatives.length > 0 ? (
                  initiatives.slice(0, 4).map((init) => {
                    const completedTasks = init.tasks?.filter(t => t.status === 'completed').length || 0;
                    const totalTasks = init.tasks?.length || 1;
                    const progressPct = Math.round((completedTasks / totalTasks) * 100);

                    return (
                      <div 
                        key={init.id}
                        className="p-3.5 rounded-lg border border-[#141413]/08 bg-[#FDFCFA] hover:bg-white transition-all space-y-2 shadow-[rgba(20,20,19,0.01)_0px_1px_3px_0px]"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-semibold text-[#141413] truncate font-sans">{init.title}</span>
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-[#141413]/5 border border-[#141413]/08 text-[#141413]/70 shrink-0">
                              {init.category}
                            </span>
                          </div>
                          <span className="text-xs font-mono font-semibold text-[#141413] shrink-0">
                            {progressPct}%
                          </span>
                        </div>

                        <div className="w-full bg-[#F3F0EE] h-1.5 rounded-full overflow-hidden border border-[#141413]/06">
                          <div 
                            className="bg-[#141413] h-full rounded-full transition-all duration-300"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-[#666562] pt-0.5 font-sans">
                          <span>Status: {init.status === 'active' ? 'Execution in Progress' : 'Pending Deployment'}</span>
                          <button
                            onClick={() => onSimulateInitiative(init.id)}
                            className="text-[#141413] hover:underline font-semibold flex items-center gap-1 cursor-pointer font-sans"
                          >
                            <span>Simulate Next Step</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-8 text-center text-[#666562] text-xs">
                    <p>No active workflow initiatives currently deployed.</p>
                    <button
                      onClick={() => setIsLaunchingInitiative(true)}
                      className="mt-3 px-3.5 py-1.5 rounded-lg bg-[#141413] text-[#FDFCFA] font-semibold hover:bg-[#262627] transition-all cursor-pointer shadow-xs"
                    >
                      Launch Strategic Initiative
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Tab Content 2: Priority Tasks */}
            {auxiliaryTab === 'tasks' && (
              <div className="p-4 space-y-2">
                {tasks.length > 0 ? (
                  tasks.slice(0, 5).map((t) => (
                    <div 
                      key={t.id}
                      className="p-3 rounded-lg border border-[#141413]/08 bg-[#FDFCFA] hover:bg-white transition-all flex items-center justify-between gap-3 shadow-[rgba(20,20,19,0.01)_0px_1px_3px_0px]"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-xs text-[#141413] truncate font-sans">{t.title}</span>
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-[#141413]/5 border border-[#141413]/08 text-[#141413]/70">
                            {t.department}
                          </span>
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                            t.priority === 'CRITICAL' ? 'bg-rose-50 text-rose-700 border-rose-200/60' :
                            t.priority === 'HIGH' ? 'bg-amber-50 text-amber-700 border-amber-200/60' :
                            'bg-[#F3F0EE] text-[#666562] border-[#141413]/08'
                          }`}>
                            {t.priority}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#666562] line-clamp-1 mt-0.5">{t.expectedOutcome || t.title}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                          t.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/40' :
                          t.status === 'in_progress' ? 'bg-[#141413]/5 text-[#141413] border-[#141413]/10' :
                          'bg-[#F3F0EE] text-[#666562] border-[#141413]/08'
                        }`}>
                          {t.status.replace('_', ' ')}
                        </span>
                        {onNavigate && (
                          <button
                            onClick={() => onNavigate('workspace')}
                            className="text-xs text-[#141413] hover:underline font-medium"
                          >
                            Inspect
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-[#666562] text-xs">
                    <p>No tasks delegated yet. Issue a directive above to dispatch work.</p>
                  </div>
                )}
              </div>
            )}

            {/* Tab Content 3: Recent Decisions */}
            {auxiliaryTab === 'decisions' && (
              <div className="p-4">
                {decisions.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-sans">
                      <thead>
                        <tr className="border-b border-[#141413]/10 text-[#666562] text-[12px] font-medium">
                          <th className="py-2.5 px-3 font-medium">Timestamp</th>
                          <th className="py-2.5 px-3 font-medium">Decision Title</th>
                          <th className="py-2.5 px-3 font-medium">Category</th>
                          <th className="py-2.5 px-3 font-medium">Financial Impact</th>
                          <th className="py-2.5 px-3 font-medium text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#141413]/06">
                        {decisions.slice(0, 5).map((d) => (
                          <tr key={d.id} className="hover:bg-[#FDFCFA] transition-colors">
                            <td className="py-3 px-3 text-[#666562] font-mono text-[11px]">
                              {new Date(d.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </td>
                            <td className="py-3 px-3 font-semibold text-[#141413] max-w-xs truncate">
                              {d.title}
                            </td>
                            <td className="py-3 px-3">
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-[#141413]/5 text-[#141413]/70 border border-[#141413]/08">
                                {d.category}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono font-medium">
                              {d.financialImpact !== undefined && d.financialImpact !== 0 ? (
                                <span className={d.financialImpact > 0 ? 'text-emerald-700' : 'text-[#141413]'}>
                                  {d.financialImpact > 0 ? `+${formatCurrency(d.financialImpact)}` : formatCurrency(d.financialImpact)}
                                </span>
                              ) : (
                                <span className="text-[#666562]/50 font-normal">—</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                                d.status === 'approved'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200/40'
                                  : 'bg-[#F3F0EE] text-[#666562] border-[#141413]/10'
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
                  <div className="py-6 text-center text-[#666562] text-xs">
                    No decisions logged yet. Decisions signed off in the Approval Queue will be recorded here.
                  </div>
                )}
              </div>
            )}

          </div>

        </div>

        {/* ── Right Column (5 Cols): Founder's Desk / Gating Station ────────── */}
        <div className="lg:col-span-5 space-y-6">

          {/* 3.3 Founder's Desk: Pending Approvals Station */}
          <div className="bg-white rounded-xl border border-[#141413]/10 p-5 shadow-[rgba(20,20,19,0.02)_0px_1px_4px_0px] space-y-3.5">
            <div className="flex items-center justify-between pb-3 border-b border-[#141413]/08">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#141413]" />
                <h2 className="text-base font-semibold text-[#141413] tracking-tight font-sans">
                  Founder's Desk ({pendingApprovals.length})
                </h2>
              </div>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('approvals')}
                  className="text-xs font-semibold text-[#141413] hover:underline flex items-center gap-0.5 cursor-pointer font-sans"
                >
                  <span>Queue</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {pendingApprovals.length > 0 ? (
              <div className="divide-y divide-[#141413]/06">
                {pendingApprovals.map((item) => (
                  <div key={item.id} className="py-3 first:pt-0 last:pb-0 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-xs text-[#141413]">{item.title}</span>
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-[#141413]/5 text-[#141413]/80 border border-[#141413]/08">
                            {item.type.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#666562] line-clamp-1 mt-0.5">{item.description}</p>
                      </div>

                      {item.financialChange !== undefined && item.financialChange !== 0 && (
                        <span className={`text-xs font-mono font-medium px-2 py-0.5 rounded-md border shrink-0 ${
                          item.financialChange > 0 
                            ? 'text-emerald-700 bg-emerald-50 border-emerald-200/40' 
                            : 'text-rose-700 bg-rose-50 border-rose-200/60'
                        }`}>
                          {item.financialChange > 0 ? `+${formatCurrency(item.financialChange)}` : `-${formatCurrency(Math.abs(item.financialChange))}`}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] font-mono text-[#666562]">
                        Urgency: {item.urgency || 'NORMAL'}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          disabled={reviewingId === item.id}
                          onClick={() => handleQuickApprove(item.id)}
                          className="px-2.5 py-1 rounded-md bg-[#141413] hover:bg-[#262627] text-[#FDFCFA] text-[11px] font-semibold transition-all shadow-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          {reviewingId === item.id ? (
                            <Loader2 className="w-3 h-3 animate-spin text-[#FDFCFA]" />
                          ) : (
                            <Check className="w-3 h-3 text-[#FDFCFA]" />
                          )}
                          <span>Approve</span>
                        </button>
                        {onNavigate && (
                          <button
                            onClick={() => onNavigate('approvals')}
                            className="px-2 py-1 rounded-md border border-[#141413]/10 text-[#141413] hover:bg-[#FDFCFA] text-[11px] font-medium transition-all cursor-pointer"
                          >
                            Inspect
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-[#FDFCFA] border border-[#141413]/08 flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-emerald-50 border border-emerald-200/50 flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 text-emerald-700" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#141413]">✓ All caught up</p>
                  <p className="text-[11px] text-[#666562] mt-0.5">No pending executive authorizations or budget requests requiring review.</p>
                </div>
              </div>
            )}
          </div>

          {/* 3.4 Sentinel Risk Radar */}
          <div className="bg-white rounded-xl border border-[#141413]/10 p-5 shadow-[rgba(20,20,19,0.02)_0px_1px_4px_0px] space-y-3.5">
            <div className="flex items-center justify-between pb-3 border-b border-[#141413]/08">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#141413]" />
                <h3 className="text-base font-semibold text-[#141413] tracking-tight font-sans">
                  Sentinel Risk Radar
                </h3>
              </div>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                detectedRisks.length === 0
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50'
                  : 'bg-amber-50 text-amber-700 border-amber-200/60'
              }`}>
                {detectedRisks.length === 0 ? 'All Systems Nominal' : `${detectedRisks.length} Guardrails Active`}
              </span>
            </div>

            {detectedRisks.length > 0 ? (
              <div className="space-y-2">
                {detectedRisks.map((risk) => (
                  <div 
                    key={risk.id}
                    className="p-3 rounded-lg border border-[#141413]/08 bg-[#FDFCFA] space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-[#141413]">{risk.title}</span>
                      <span className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border ${
                        risk.severity === 'CRITICAL' ? 'bg-rose-50 text-rose-700 border-rose-200/60' :
                        risk.severity === 'HIGH' ? 'bg-amber-50 text-amber-700 border-amber-200/60' :
                        'bg-[#F3F0EE] text-[#141413] border-[#141413]/10'
                      }`}>
                        {risk.severity}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#666562]">{risk.description}</p>
                    <div className="pt-1 flex justify-end">
                      <button
                        onClick={risk.action}
                        className="text-[11px] font-semibold text-[#141413] hover:underline"
                      >
                        {risk.actionLabel} →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-3.5 py-2.5 rounded-xl bg-[#FDFCFA] border border-emerald-200/50 flex items-center gap-2.5 text-xs">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-medium text-[#141413]">All systems nominal</span>
                  <span className="text-[#666562]">— Capital runway ({runwayMonths.toFixed(1)}mo) and governance compliance within safe bounds.</span>
                </div>
              </div>
            )}

            {/* Checklist Telemetry */}
            <div className="space-y-2 pt-2 border-t border-[#141413]/06 text-[12px]">
              <div className="flex items-center justify-between text-[#666562]">
                <span>Treasury Runway Horizon</span>
                <span className="font-mono font-semibold text-[#141413]">{runwayMonths.toFixed(1)} mo</span>
              </div>
              <div className="flex items-center justify-between text-[#666562]">
                <span>Executive Task Delegation</span>
                <span className="font-mono font-semibold text-[#141413]">
                  {unassignedTasks.length > 0 ? `${unassignedTasks.length} unassigned` : 'Fully Staffed'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[#666562]">
                <span>Ledger Security</span>
                <span className="font-mono font-semibold text-emerald-700">SOC-2 Ready</span>
              </div>
            </div>
          </div>

          {/* 3.5 Executive Roster Pulse */}
          <div className="bg-white rounded-xl border border-[#141413]/10 p-5 shadow-[rgba(20,20,19,0.02)_0px_1px_4px_0px] space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-[#141413]/08">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#141413]" />
                <h3 className="text-base font-semibold text-[#141413] tracking-tight font-sans">
                  Executive Council ({agents.length})
                </h3>
              </div>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('council')}
                  className="text-xs font-semibold text-[#141413] hover:underline"
                >
                  Convene →
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {agents.slice(0, 4).map((ag) => (
                <div 
                  key={ag.id}
                  onClick={() => onNavigate?.('council')}
                  className="p-2.5 rounded-lg border border-[#141413]/08 bg-[#FDFCFA] hover:bg-white transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-[#141413] text-[#FDFCFA] flex items-center justify-center font-mono font-bold text-[10px] shrink-0">
                      {ag.role.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-[#141413] truncate">{ag.name.split(' ')[0]}</div>
                      <div className="text-[10px] font-mono text-[#666562] truncate uppercase">{ag.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* ── 7. Calibrate Treasury Modal ────────────────────────────────────── */}
      {isCalibratingTreasury && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141413]/40 backdrop-blur-xs">
          <div className="bg-white rounded-[24px] border border-[#141413]/15 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#141413]/08">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[12px] bg-[#141413] text-[#F3F0EE] flex items-center justify-center shadow-xs">
                  <SlidersHorizontal className="w-4 h-4 text-[#F3F0EE]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#141413] font-sans">Calibrate Treasury &amp; Runway</h3>
                  <p className="text-xs text-[#696969]">Update cash reserves and monthly net burn rate</p>
                </div>
              </div>
              <button
                onClick={() => setIsCalibratingTreasury(false)}
                className="p-1.5 rounded-lg text-[#696969] hover:text-[#141413] hover:bg-[#F3F0EE] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTreasury} className="space-y-4 text-xs font-sans">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[#141413] mb-1">Cash Reserves (₹ INR)</label>
                  <input
                    type="number"
                    min="0"
                    step="50000"
                    value={editCash}
                    onChange={(e) => setEditCash(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-[12px] border border-[#141413]/15 focus:outline-none focus:border-[#141413] focus:ring-1 focus:ring-[#141413]/10 text-xs font-mono font-semibold text-[#141413]"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#141413] mb-1">Monthly Net Burn (₹/mo)</label>
                  <input
                    type="number"
                    min="0"
                    step="10000"
                    value={editBurn}
                    onChange={(e) => setEditBurn(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-[12px] border border-[#141413]/15 focus:outline-none focus:border-[#141413] focus:ring-1 focus:ring-[#141413]/10 text-xs font-mono font-semibold text-[#141413]"
                    required
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-[14px] bg-[#FCFBFA] border border-[#141413]/10 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[#696969]">Projected Runway: </span>
                  <span className="font-bold text-[#141413] font-mono">
                    {editBurn > 0 ? (editCash / editBurn).toFixed(1) : '∞'} Months
                  </span>
                </div>
                <div>
                  <span className="text-[#696969]">Burn Ratio: </span>
                  <span className="font-bold text-[#141413] font-mono">
                    {editCash > 0 ? ((editBurn / editCash) * 100).toFixed(1) : 0}% / mo
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCalibratingTreasury(false)}
                  className="px-4 py-2 rounded-[12px] border border-[#141413]/10 text-[#141413] hover:bg-[#FCFBFA] transition-colors font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingTreasury}
                  className="px-5 py-2 rounded-[12px] bg-[#141413] hover:bg-[#262627] text-[#F3F0EE] font-semibold shadow-xs transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isSavingTreasury ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#F3F0EE]" /> : <Check className="w-3.5 h-3.5 text-[#F3F0EE]" />}
                  <span>Save Parameters</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 8. Launch Initiative Modal ──────────────────────────────────────── */}
      {isLaunchingInitiative && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141413]/40 backdrop-blur-xs">
          <div className="bg-white rounded-[24px] border border-[#141413]/15 shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#141413]/08">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[12px] bg-[#141413] text-[#F3F0EE] flex items-center justify-center shadow-xs">
                  <Plus className="w-4 h-4 text-[#F3F0EE]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#141413] font-sans">Launch Strategic Initiative</h3>
                  <p className="text-xs text-[#696969]">Deploy cross-functional workflow to executive council</p>
                </div>
              </div>
              <button
                onClick={() => setIsLaunchingInitiative(false)}
                className="p-1.5 rounded-lg text-[#696969] hover:text-[#141413] hover:bg-[#F3F0EE] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateInitiative} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block font-semibold text-[#141413] mb-1">Initiative Title</label>
                <input
                  type="text"
                  value={initTitle}
                  onChange={(e) => setInitTitle(e.target.value)}
                  placeholder="e.g. Q3 Enterprise Sales GTM Acceleration"
                  className="w-full px-3.5 py-2.5 rounded-[12px] border border-[#141413]/15 focus:outline-none focus:border-[#141413] focus:ring-1 focus:ring-[#141413]/10 text-xs text-[#141413]"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-[#141413] mb-1">Category &amp; Domain</label>
                <select
                  value={initCategory}
                  onChange={(e: any) => setInitCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-[12px] border border-[#141413]/15 focus:outline-none focus:border-[#141413] focus:ring-1 focus:ring-[#141413]/10 text-xs text-[#141413]"
                >
                  <option value="growth">Growth &amp; Acquisition (Vector)</option>
                  <option value="hiring">Hiring &amp; Headcount (Echo)</option>
                  <option value="funding">Funding &amp; Capital (Marcus)</option>
                  <option value="operations">Operations &amp; Delivery (Helix)</option>
                  <option value="legal">Legal &amp; Compliance (Helena)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#141413] mb-1">Strategic Objective &amp; Scope</label>
                <textarea
                  rows={3}
                  value={initDesc}
                  onChange={(e) => setInitDesc(e.target.value)}
                  placeholder="Describe target deliverable, success criteria, and budget expectations..."
                  className="w-full px-3.5 py-2.5 rounded-[12px] border border-[#141413]/15 focus:outline-none focus:border-[#141413] focus:ring-1 focus:ring-[#141413]/10 text-xs text-[#141413] resize-none"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLaunchingInitiative(false)}
                  className="px-4 py-2 rounded-[12px] border border-[#141413]/10 text-[#141413] hover:bg-[#FCFBFA] transition-colors font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDeployingInit}
                  className="px-5 py-2 rounded-[12px] bg-[#141413] hover:bg-[#262627] text-[#F3F0EE] font-semibold shadow-xs transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isDeployingInit ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#F3F0EE]" /> : <Plus className="w-3.5 h-3.5 text-[#F3F0EE]" />}
                  <span>Deploy to Council</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 9. Issue Executive Directive Modal ─────────────────────────────── */}
      {isDirectiveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141413]/40 backdrop-blur-xs">
          <div className="bg-white rounded-[24px] border border-[#141413]/15 shadow-2xl max-w-2xl w-full p-4 sm:p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#141413]/08">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[12px] bg-[#141413] text-[#F3F0EE] flex items-center justify-center shadow-xs">
                  <Bot className="w-4 h-4 text-[#F3F0EE]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#141413] font-sans">Issue Executive Directive</h3>
                  <p className="text-xs text-[#696969]">Sophia Vance — Executive Directive Dispatcher</p>
                </div>
              </div>
              <button
                onClick={() => setIsDirectiveOpen(false)}
                className="p-1.5 rounded-lg text-[#696969] hover:text-[#141413] hover:bg-[#F3F0EE] transition-colors cursor-pointer"
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
