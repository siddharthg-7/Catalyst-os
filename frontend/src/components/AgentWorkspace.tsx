/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Agent, StartupProfile, DecisionRecord, KnowledgeFile } from '../types';
import {
  Rocket, Landmark, Users, Briefcase, Cog, Shield,
  CheckCircle2, AlertCircle, FileText, Clock, TrendingUp,
  Settings, ArrowRight, ShieldCheck, Activity, Layers,
  ChevronRight, Calendar, UserCheck, Scale, Compass, Check
} from 'lucide-react';
import Section from './Section';

interface AgentWorkspaceProps {
  agents: Agent[];
  startup: StartupProfile;
  decisions?: DecisionRecord[];
  knowledge?: KnowledgeFile[];
  onUpdateStartup: (updated: StartupProfile) => void;
  selectedAgentId?: string;
  onSelectAgent?: (id: string) => void;
}

interface ExecutiveDetail {
  role: string;
  officialTitle: string;
  responsibilities: string[];
  capabilities: string[];
  keyMetrics: Array<{ label: string; value: string; trend?: string }>;
  sampleTasks: string[];
}

const EXECUTIVE_DETAILS: Record<string, ExecutiveDetail> = {
  CEO: {
    role: 'CEO',
    officialTitle: 'Chief Executive Officer & Chief Orchestrator',
    responsibilities: [
      'Strategic corporate direction and multi-quarter milestones',
      'Dynamic cross-agent coordination and conflict resolution',
      'Executive decision synthesis and founder briefings',
      'High-impact governance and approval delegation',
      'Investor relations and board updates formulation'
    ],
    capabilities: [
      'Autonomous intent decomposition',
      'Context hydration across all databases',
      'Specialist role activation matrix',
      'Executive summary generation'
    ],
    keyMetrics: [
      { label: 'Strategic Velocity', value: '78%', trend: '+4% this sprint' },
      { label: 'Council Health', value: '94/100', trend: 'Optimal' },
      { label: 'Pending Directives', value: '3 Active', trend: 'On Schedule' }
    ],
    sampleTasks: [
      'Synthesize monthly investor performance brief',
      'Coordinate hiring roadmap with Talent and Finance',
      'Review high-impact operational commitments'
    ]
  },
  Finance: {
    role: 'Finance',
    officialTitle: 'Chief Financial Officer (CFO)',
    responsibilities: [
      'Cash-flow tracking, deterministic runway computation and burn analysis',
      'Headcount affordability modeling and salary benchmark simulations',
      'Treasury risk monitoring and variance detection',
      'Financial model updates and scenario modeling'
    ],
    capabilities: [
      'Zero-hallucination deterministic math engine',
      'Runway scenario calculation',
      'Hiring impact analysis',
      'Budget gatekeeping and approvals'
    ],
    keyMetrics: [
      { label: 'Cash Balance', value: '₹2,45,000', trend: 'Confirmed' },
      { label: 'Monthly Burn', value: '₹18,500/mo', trend: 'Base rate' },
      { label: 'Active Runway', value: '13.2 Months', trend: 'Calculated' }
    ],
    sampleTasks: [
      'Run deterministic runway calculation against current burn',
      'Simulate runway impact of 2 new senior engineering hires',
      'Review monthly software SaaS subscription expenditure'
    ]
  },
  Talent: {
    role: 'Talent',
    officialTitle: 'Chief People & Talent Officer (Echo)',
    responsibilities: [
      'Organizational structure mapping and headcount planning',
      'Job description synthesis and candidate screening criteria',
      'Compensation benchmarking and equity allocation guidelines',
      'Team velocity and recruitment funnel optimization'
    ],
    capabilities: [
      'Role requirement parsing',
      'Market compensation estimation',
      'Inter-departmental staffing recommendations',
      'Hiring gate validation'
    ],
    keyMetrics: [
      { label: 'Open Headcount', value: '2 Roles', trend: 'Approved' },
      { label: 'Time to Hire Target', value: '28 Days', trend: 'Benchmarked' },
      { label: 'Hiring Budget', value: '₹55,00,000', trend: 'Scoped' }
    ],
    sampleTasks: [
      'Formulate senior full-stack engineer technical scorecard',
      'Draft equity distribution schedule for key hires',
      'Benchmark GTM sales executive compensation'
    ]
  },
  Growth: {
    role: 'Growth',
    officialTitle: 'Chief Growth & Marketing Officer (Vector)',
    responsibilities: [
      'Go-to-market strategy formulation and execution',
      'Customer acquisition cost (CAC) and LTV tracking',
      'Funnel conversion optimization and viral distribution loops',
      'Target customer persona (ICP) refining and messaging'
    ],
    capabilities: [
      'Marketing channel attribution',
      'Product launch sequencing',
      'Positioning matrix generation',
      'Audience segmentation'
    ],
    keyMetrics: [
      { label: 'Target ICP', value: 'Early Startups', trend: 'Defined' },
      { label: 'Core Metric', value: '100 Paying Users', trend: 'Goal' },
      { label: 'Launch Readiness', value: '82%', trend: 'On Track' }
    ],
    sampleTasks: [
      'Structure 30-day developer-first launch campaign',
      'Define conversion funnel metrics for beta users',
      'Refine value proposition messaging for target ICP'
    ]
  },
  Legal: {
    role: 'Legal',
    officialTitle: 'General Counsel & Regulatory Executive (Nexus)',
    responsibilities: [
      'Contract and agreement review (NDAs, MSAs, Offer Letters)',
      'Intellectual property safeguards and assignment validation',
      'Regulatory compliance (GDPR, SOC2, Delaware C-Corp governance)',
      'Risk assessment for prospective commercial partnerships'
    ],
    capabilities: [
      'Contract term extraction & risk scoring',
      'Compliance checklist auditing',
      'Governance approval gate enforcement',
      'Liability mitigation recommendations'
    ],
    keyMetrics: [
      { label: 'Compliance Index', value: '92%', trend: 'High' },
      { label: 'Contracts Scanned', value: '12 Documents', trend: 'Up to date' },
      { label: 'Risk Status', value: 'Protected', trend: 'Standard terms' }
    ],
    sampleTasks: [
      'Review proprietary IP assignment terms in contractor template',
      'Audit privacy policy for GDPR and California consumer guidelines',
      'Draft standardized mutual NDA for enterprise pilots'
    ]
  },
  Operations: {
    role: 'Operations',
    officialTitle: 'Chief Operating Officer (COO) (Helix)',
    responsibilities: [
      'Milestone tracking, sprint execution, and internal operational tooling',
      'Cross-functional blocker resolution and delivery cadence',
      'Vendor management and infrastructure efficiency',
      'Standard operating procedure (SOP) documentation'
    ],
    capabilities: [
      'Timeline schedule dependency mapping',
      'Resource bottleneck identification',
      'Execution gate enforcement',
      'Process automation orchestration'
    ],
    keyMetrics: [
      { label: 'Sprint Delivery', value: '88%', trend: 'Ahead of target' },
      { label: 'Active Milestones', value: '4 In Progress', trend: 'On schedule' },
      { label: 'System Uptime', value: '99.9%', trend: 'Stable' }
    ],
    sampleTasks: [
      'Track 90-day product launch milestone dependencies',
      'Optimize multi-agent tool execution latency',
      'Establish incident escalation protocol for backend infrastructure'
    ]
  },
  Investment: {
    role: 'Investment',
    officialTitle: 'VP of Capital & Investor Relations (Apex)',
    responsibilities: [
      'Fundraising readiness and pitch narrative optimization',
      'Cap table modeling and dilution scenarios',
      'Investor pipeline management and due diligence preparation',
      'Valuation benchmarking against recent comparable deals'
    ],
    capabilities: [
      'Cap table scenario modeling',
      'Pitch deck slide critique against tier-1 VC criteria',
      'Investor Q&A simulation',
      'Due diligence data room indexing'
    ],
    keyMetrics: [
      { label: 'Funding Stage', value: 'Pre-Seed', trend: 'Active' },
      { label: 'Target Raise', value: '₹8,00,00,000', trend: 'Planned' },
      { label: 'Diligence Room', value: 'Ready', trend: 'Grounded in RAG' }
    ],
    sampleTasks: [
      'Index corporate pitch deck and financial plan in RAG',
      'Model 15% SAFE dilution on ₹65 Cr post-money cap',
      'Prepare responses for technical due diligence queries'
    ]
  },
  Auditor: {
    role: 'Auditor',
    officialTitle: 'Chief Verification Officer & Auditor (Sentry)',
    responsibilities: [
      'Mathematical verification of all financial claims and calculations',
      'Evidence citation validation against indexed company documents',
      'Hallucination prevention and boundary enforcement',
      'Approval requirement verification for high-impact actions'
    ],
    capabilities: [
      'Deterministic proof checker',
      'Source attribution auditor',
      'Compliance cross-verification',
      'Zero-tolerance policy enforcement'
    ],
    keyMetrics: [
      { label: 'Proof Accuracy', value: '100%', trend: 'Verified' },
      { label: 'Grounding Score', value: '96/100', trend: 'Strict RAG' },
      { label: 'Audit Status', value: 'Enforcing', trend: 'Active' }
    ],
    sampleTasks: [
      'Audit runway calculation: 7200000 / 800000 = 9.0 months',
      'Verify source citations for target ICP market claims',
      'Trigger approval requirement for commitments > ₹1,00,000'
    ]
  }
};

export default function AgentWorkspace({
  agents,
  startup,
  decisions = [],
  knowledge = [],
  onUpdateStartup,
  selectedAgentId,
  onSelectAgent
}: AgentWorkspaceProps) {
  const [activeView, setActiveView] = useState<'agent' | 'all' | 'config'>('agent');
  const [currentRole, setCurrentRole] = useState<string>('CEO');
  const [agentTab, setAgentTab] = useState<'overview' | 'responsibilities' | 'work' | 'decisions' | 'activity'>('overview');

  useEffect(() => {
    if (selectedAgentId) {
      // Find matching agent by ID or role
      const matched = agents.find(a => 
        a.id.toLowerCase() === selectedAgentId.toLowerCase() ||
        a.role.toLowerCase() === selectedAgentId.toLowerCase()
      );
      if (matched) {
        setCurrentRole(matched.role);
        setActiveView('agent');
      }
    }
  }, [selectedAgentId, agents]);

  // Current active agent
  const activeAgent = agents.find(a => a.role === currentRole) || agents[0];
  const detail = EXECUTIVE_DETAILS[currentRole] || EXECUTIVE_DETAILS['CEO'];

  const dynamicKeyMetrics = useMemo(() => {
    switch (currentRole) {
      case 'Finance':
        return [
          { label: 'Cash Balance', value: `$${(startup.cashBalance ?? 0).toLocaleString()}`, trend: 'Live Treasury' },
          { label: 'Monthly Burn', value: `$${(startup.burnRate ?? 0).toLocaleString()}/mo`, trend: 'Active Rate' },
          { label: 'Active Runway', value: `${(startup.runwayMonths > 0 ? startup.runwayMonths : (startup.burnRate ? startup.cashBalance / startup.burnRate : 12)).toFixed(1)} Months`, trend: 'Deterministic' },
        ];
      case 'CEO':
        return [
          { label: 'Strategic Velocity', value: `${startup.metrics?.velocity ?? 78}%`, trend: 'Council Measured' },
          { label: 'Health Score', value: `${startup.healthScore ?? 78}/100`, trend: 'Overall Index' },
          { label: 'Decisions Logged', value: `${decisions.length} Records`, trend: 'Audited' },
        ];
      case 'Growth':
        return [
          { label: 'Growth Velocity', value: `${startup.metrics?.growthRate ?? 65}%`, trend: 'Traction Index' },
          { label: 'Target ICP', value: startup.industry || 'B2B SaaS', trend: 'Target Market' },
          { label: 'GTM Readiness', value: `${Math.round(((startup.metrics?.growthRate ?? 65) + (startup.metrics?.velocity ?? 78)) / 2)}%`, trend: 'Calibrated' },
        ];
      case 'Legal':
        return [
          { label: 'Compliance Index', value: `${startup.metrics?.legalCompliance ?? 92}%`, trend: 'Verified' },
          { label: 'Contract Hygiene', value: 'Audited', trend: 'Guardrails Active' },
          { label: 'Grounded Docs', value: `${knowledge.length} Files`, trend: 'Indexed' },
        ];
      case 'Operations':
        return [
          { label: 'Ops Efficiency', value: `${startup.metrics?.operationsEfficiency ?? 80}%`, trend: 'Workflow Throughput' },
          { label: 'Active Executives', value: `${agents.length} Agents`, trend: 'Synchronized' },
          { label: 'Council Pace', value: 'High', trend: 'Responsive' },
        ];
      case 'Auditor':
        return [
          { label: 'Verification Pass', value: '100%', trend: 'Deterministic Math' },
          { label: 'Grounded Records', value: `${knowledge.length} Ingested`, trend: 'RAG Grounded' },
          { label: 'Audit Status', value: 'Enforced', trend: 'Zero Hallucinations' },
        ];
      default:
        return detail.keyMetrics;
    }
  }, [currentRole, startup, decisions, knowledge, agents, detail]);

  // Form states for profile adjustment
  const [name, setName] = useState(startup.name);
  const [industry, setIndustry] = useState(startup.industry);
  const [description, setDescription] = useState(startup.description);
  const [fundingStage, setFundingStage] = useState(startup.fundingStage);
  const [cashBalance, setCashBalance] = useState(startup.cashBalance);
  const [burnRate, setBurnRate] = useState(startup.burnRate);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/startup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          industry,
          description,
          fundingStage,
          cashBalance: Number(cashBalance),
          burnRate: Number(burnRate)
        }),
      });

      if (res.ok) {
        const data = await res.json();
        onUpdateStartup(data);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Error saving startup configuration:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'CEO': return <Rocket className="w-4 h-4 text-indigo-700" />;
      case 'Finance': return <Landmark className="w-4 h-4 text-emerald-700" />;
      case 'Talent': return <Users className="w-4 h-4 text-pink-700" />;
      case 'Growth': return <Briefcase className="w-4 h-4 text-amber-700" />;
      case 'Operations': return <Cog className="w-4 h-4 text-sky-700" />;
      case 'Legal': return <Shield className="w-4 h-4 text-rose-700" />;
      case 'Investment': return <TrendingUp className="w-4 h-4 text-purple-700" />;
      case 'Auditor': return <ShieldCheck className="w-4 h-4 text-blue-700" />;
      default: return <Compass className="w-4 h-4 text-[var(--c-fg)]" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'analyzing':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200"><span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />Analyzing</span>;
      case 'collaborating':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200"><span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />Collaborating</span>;
      case 'generating':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-purple-50 text-purple-700 border border-purple-200"><span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />Generating</span>;
      case 'completed':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"><Check className="w-3.5 h-3.5" />Ready</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-gray-100 text-gray-700 border border-gray-200"><span className="w-2 h-2 rounded-full bg-gray-400" />Idle</span>;
    }
  };

  // Filter decisions relevant to this role
  const roleDecisions = decisions.filter(d => 
    d.category.toLowerCase() === currentRole.toLowerCase() ||
    d.title.toLowerCase().includes(currentRole.toLowerCase())
  );

  return (
    <div className="space-y-6 font-sans">
      {/* Top Header & View Mode Switcher */}
      <Section delay={0.05} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--c-border)] pb-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--c-fg)] tracking-tight">Executive Agent Workspace</h2>
          <p className="text-xs text-[var(--c-muted)] mt-0.5">Direct oversight of individual AI executive officers & operational governance</p>
        </div>

        <div className="relative flex items-center p-1 rounded-xl bg-[var(--c-surface-2)] border border-[var(--c-border)] text-xs font-semibold">
          {[
            { id: 'agent' as const, label: 'Officer Workspace' },
            { id: 'all' as const, label: `All Officers (${agents.length})` },
            { id: 'config' as const, label: 'Parameters', icon: <Settings className="w-3.5 h-3.5" /> },
          ].map((v) => {
            const isActive = activeView === v.id;
            return (
              <button
                key={v.id}
                onClick={() => setActiveView(v.id)}
                className={`relative z-10 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  isActive ? 'text-[var(--c-fg)]' : 'text-[var(--c-muted)] hover:text-[var(--c-fg)]'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="agentViewSwitcherTab"
                    className="absolute inset-0 bg-[var(--c-surface)] rounded-lg shadow-sm"
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  />
                )}
                {v.icon && <span className="relative z-10">{v.icon}</span>}
                <span className="relative z-10">{v.label}</span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* Role Picker Strip (Section 24 & 27: Data-driven agent navigation) */}
      {activeView === 'agent' && (
        <Section delay={0.1}>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {agents.map((ag) => {
              const isSelected = ag.role === currentRole;
              return (
                <button
                  key={ag.id}
                  onClick={() => {
                    setCurrentRole(ag.role);
                    if (onSelectAgent) onSelectAgent(ag.id);
                  }}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-[14px] text-xs font-semibold shrink-0 transition-all border cursor-pointer interactive-btn ${
                    isSelected
                      ? 'bg-[var(--c-fg)] text-[var(--c-bg)] border-[#141413] shadow-xs'
                      : 'bg-[var(--c-surface)] text-[var(--c-muted)] border-[var(--c-border)] hover:text-[var(--c-fg)] hover:border-[var(--c-border-strong)] card-hover'
                  }`}
                >
                  {getRoleIcon(ag.role)}
                  <span>{ag.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {ag.role}
                  </span>
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {/* VIEW 1: DEDICATED AGENT WORKSPACE (Section 25 of PROMPT.MD) */}
      {activeView === 'agent' && activeAgent && (
        <div className="space-y-6">
          {/* Agent Identity & Status Header Card */}
          <div className="p-6 rounded-[20px] bg-[var(--c-surface)] border border-[var(--c-border)] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 card-hover glow-border">
            <div className="flex items-start gap-4">
              <img
                src={activeAgent.avatar}
                alt={activeAgent.name}
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-2xl object-cover border border-[var(--c-border)] shadow-xs shrink-0 group-hover:scale-105 transition-transform"
              />
              <div className="space-y-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-xl font-bold text-[var(--c-fg)] tracking-tight">{activeAgent.name}</h3>
                  <span className="tech-badge">
                    {activeAgent.role}
                  </span>
                  {getStatusBadge(activeAgent.status)}
                </div>
                <p className="text-xs font-medium text-[var(--c-muted)]">{detail.officialTitle}</p>
                <p className="text-xs text-[var(--c-fg)]/80 max-w-xl leading-relaxed mt-1">{activeAgent.description}</p>
              </div>
            </div>

            <div className="flex sm:flex-col items-end justify-between border-t md:border-t-0 md:border-l border-[var(--c-border)] pt-4 md:pt-0 md:pl-6 shrink-0 gap-2">
              <div className="text-right">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--c-muted)] block">Core Authority</span>
                <span className="text-sm font-bold text-[var(--c-fg)]">{activeAgent.keyMetric}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--c-muted)] block">Governance Status</span>
                <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Grounded & Active
                </span>
              </div>
            </div>
          </div>

          {/* Key Metrics Strip (Section 25 Supporting Data) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {dynamicKeyMetrics.map((km, idx) => (
              <div key={idx} className="p-4 rounded-[16px] bg-[var(--c-surface)] border border-[var(--c-border)] shadow-xs card-hover glow-border">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--c-muted)] font-bold block">{km.label}</span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-xl font-bold text-[var(--c-fg)] font-mono">{km.value}</span>
                  {km.trend && (
                    <span className="text-[11px] text-emerald-700 font-medium">{km.trend}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Workspace Sub-Navigation Tabs (Sections 9 & 10) */}
          <div className="flex items-center gap-1.5 border-b border-[var(--c-border)] pb-2 overflow-x-auto scrollbar-none">
            {[
              { id: 'overview' as const, label: 'Overview' },
              { id: 'responsibilities' as const, label: 'Responsibilities' },
              { id: 'work' as const, label: 'Work & Tasks' },
              { id: 'decisions' as const, label: 'Decisions', badge: roleDecisions.length > 0 ? String(roleDecisions.length) : undefined },
              { id: 'activity' as const, label: 'Activity' },
            ].map(t => {
              const isActive = agentTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setAgentTab(t.id)}
                  className={`relative px-4 py-2 rounded-full text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'text-[var(--c-bg)]'
                      : 'text-[var(--c-muted)] hover:text-[var(--c-fg)]'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="agentWorkspaceSubTab"
                      className="absolute inset-0 bg-[var(--c-fg)] rounded-full shadow-xs"
                      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    />
                  )}
                  <span className="relative z-10">{t.label}</span>
                  {t.badge && (
                    <span className={`relative z-10 text-[10px] font-mono px-1.5 py-0.2 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-[var(--c-surface-2)] text-[var(--c-fg)]'}`}>
                      {t.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* TAB 1: OVERVIEW (Section 10 of PROMPT.MD) */}
          {agentTab === 'overview' && (
            <div className="space-y-6 animate-fadeIn">
              {/* 1. Current Focus */}
              <div className="p-6 rounded-[20px] bg-[var(--c-surface)] border border-[var(--c-border)] shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Compass className="w-4 h-4 text-[var(--c-fg)]" />
                    <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--c-muted)]">Current Strategic Focus</h4>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    Active Authority
                  </span>
                </div>
                <p className="text-base font-bold text-[var(--c-fg)] tracking-tight">{activeAgent.keyMetric}</p>
                <p className="text-xs text-[var(--c-muted)] leading-relaxed max-w-2xl">{detail.responsibilities[0]}</p>
              </div>

              {/* 2. AI Brief */}
              <div className="p-6 rounded-[20px] bg-[var(--c-surface)] border border-[var(--c-border)] shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--c-muted)]">AI Executive Brief</h4>
                </div>
                <div className="p-4 rounded-xl bg-[var(--c-surface-2)] border border-[var(--c-border)] text-xs text-[var(--c-fg)] leading-relaxed space-y-2">
                  <p>
                    <strong className="text-[var(--c-fg)]">{detail.officialTitle}</strong> operating in synchronized autonomous alignment with the CatalystOS founder council.
                  </p>
                  <p className="text-[var(--c-muted)]">
                    {activeAgent.description} Grounded in verified corporate telemetry, deterministic runway boundaries, and live team records.
                  </p>
                </div>
              </div>

              {/* 3. Current Priorities & 4. Active Work (Two Columns) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Current Priorities */}
                <div className="p-6 rounded-[20px] bg-[var(--c-surface)] border border-[var(--c-border)] shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-1 border-b border-[var(--c-border)]">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[var(--c-fg)]" />
                      <h4 className="text-sm font-bold text-[var(--c-fg)]">Current Priorities</h4>
                    </div>
                    <span className="text-[10px] font-mono text-[var(--c-muted)]">Active</span>
                  </div>
                  <ul className="space-y-2.5">
                    {detail.responsibilities.slice(0, 3).map((resp, i) => (
                      <li key={i} className="text-xs text-[var(--c-fg)] flex items-start gap-2.5 leading-relaxed">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--c-fg)] mt-1.5 shrink-0" />
                        <span>{resp}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Active Work */}
                <div className="p-6 rounded-[20px] bg-[var(--c-surface)] border border-[var(--c-border)] shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-1 border-b border-[var(--c-border)]">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-[var(--c-fg)]" />
                      <h4 className="text-sm font-bold text-[var(--c-fg)]">Active Workload</h4>
                    </div>
                    <span className="text-[10px] font-mono text-[var(--c-muted)]">In Flight</span>
                  </div>
                  <div className="space-y-2.5">
                    {detail.sampleTasks.slice(0, 3).map((task, i) => (
                      <div key={i} className="p-3 rounded-xl bg-[var(--c-surface-2)] border border-[var(--c-border)] flex items-center justify-between text-xs">
                        <span className="text-[var(--c-fg)] font-medium truncate">{task}</span>
                        <span className="text-[10px] font-mono text-[var(--c-muted)] bg-white px-2 py-0.5 rounded border border-[var(--c-border)] shrink-0 ml-2">
                          Audited
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 5. Recent Activity */}
              <div className="p-6 rounded-[20px] bg-[var(--c-surface)] border border-[var(--c-border)] shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-1 border-b border-[var(--c-border)]">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[var(--c-muted)]" />
                    <h4 className="text-sm font-bold text-[var(--c-fg)]">Recent Activity & Directives</h4>
                  </div>
                  <span className="text-[10px] font-mono text-[var(--c-muted)]">Audit Trail</span>
                </div>
                {roleDecisions.length > 0 ? (
                  <div className="space-y-2.5">
                    {roleDecisions.slice(0, 3).map((dec) => (
                      <div key={dec.id} className="p-3.5 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div>
                          <span className="font-bold text-[var(--c-fg)]">{dec.title}</span>
                          <p className="text-[var(--c-muted)] text-[11px] mt-0.5">{dec.description}</p>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--c-surface)] border border-[var(--c-border)] text-[var(--c-fg)] shrink-0">
                          {dec.status.toUpperCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--c-muted)] italic py-2">
                    No custom directives logged for {activeAgent.name} yet. System commands record automatically during execution.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: RESPONSIBILITIES */}
          {agentTab === 'responsibilities' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
              <div className="p-6 rounded-[20px] bg-[var(--c-surface)] border border-[var(--c-border)] shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-1 border-b border-[var(--c-border)]">
                  <CheckCircle2 className="w-4 h-4 text-[var(--c-fg)]" />
                  <h4 className="text-sm font-bold text-[var(--c-fg)]">Official Responsibilities</h4>
                </div>
                <ul className="space-y-2.5">
                  {detail.responsibilities.map((resp, i) => (
                    <li key={i} className="text-xs text-[var(--c-fg)] flex items-start gap-2.5 leading-relaxed">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--c-fg)] mt-1.5 shrink-0" />
                      <span>{resp}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-6 rounded-[20px] bg-[var(--c-surface)] border border-[var(--c-border)] shadow-sm space-y-4">
                <div className="flex items-center gap-2 pb-1 border-b border-[var(--c-border)]">
                  <Layers className="w-4 h-4 text-[var(--c-fg)]" />
                  <h4 className="text-sm font-bold text-[var(--c-fg)]">Core Capabilities & Tools</h4>
                </div>
                <ul className="space-y-2.5">
                  {detail.capabilities.map((cap, i) => (
                    <li key={i} className="text-xs text-[var(--c-fg)] flex items-start gap-2.5 leading-relaxed">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                      <span>{cap}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* TAB 3: WORK & TASKS */}
          {agentTab === 'work' && (
            <div className="p-6 rounded-[20px] bg-[var(--c-surface)] border border-[var(--c-border)] shadow-sm space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between pb-1 border-b border-[var(--c-border)]">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[var(--c-fg)]" />
                  <h4 className="text-sm font-bold text-[var(--c-fg)]">Operational Workload & Task Pipeline</h4>
                </div>
                <span className="text-xs font-mono text-[var(--c-muted)]">{detail.sampleTasks.length} Pipeline Items</span>
              </div>
              <div className="space-y-3">
                {detail.sampleTasks.map((task, i) => (
                  <div key={i} className="p-4 rounded-xl bg-[var(--c-surface-2)] border border-[var(--c-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="text-sm font-semibold text-[var(--c-fg)] block">{task}</span>
                      <span className="text-[11px] text-[var(--c-muted)] font-mono mt-0.5 block">Automated execution verified by Sentry (Auditor)</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 shrink-0 w-fit">
                      Grounded
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: DECISIONS */}
          {agentTab === 'decisions' && (
            <div className="p-6 rounded-[20px] bg-[var(--c-surface)] border border-[var(--c-border)] shadow-sm space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between pb-1 border-b border-[var(--c-border)]">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[var(--c-muted)]" />
                  <h4 className="text-sm font-bold text-[var(--c-fg)]">Executive Directives & Decision History</h4>
                </div>
                <span className="text-[10px] font-mono text-[var(--c-muted)]">PERSISTENT AUDIT TRAIL</span>
              </div>

              {roleDecisions.length > 0 ? (
                <div className="space-y-3">
                  {roleDecisions.map((dec) => (
                    <div key={dec.id} className="p-4 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="font-bold text-[var(--c-fg)] text-sm block">{dec.title}</span>
                        <p className="text-[var(--c-muted)] text-xs mt-1 leading-relaxed">{dec.description}</p>
                      </div>
                      <span className="text-[10px] font-mono px-2.5 py-1 rounded bg-[var(--c-surface)] border border-[var(--c-border)] text-[var(--c-fg)] shrink-0 font-bold w-fit">
                        {dec.status.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 rounded-xl border border-dashed border-[var(--c-border)] text-center space-y-2">
                  <Clock className="w-8 h-8 text-[var(--c-muted)] mx-auto opacity-50" />
                  <p className="text-xs font-bold text-[var(--c-fg)]">No Directives Logged Yet</p>
                  <p className="text-xs text-[var(--c-muted)] max-w-sm mx-auto">
                    Directives for {activeAgent.name} will record here when cross-agent council initiatives and decisions execute.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: ACTIVITY */}
          {agentTab === 'activity' && (
            <div className="p-6 rounded-[20px] bg-[var(--c-surface)] border border-[var(--c-border)] shadow-sm space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between pb-1 border-b border-[var(--c-border)]">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[var(--c-fg)]" />
                  <h4 className="text-sm font-bold text-[var(--c-fg)]">Live Operational Stream</h4>
                </div>
                <span className="text-[10px] font-mono text-[var(--c-muted)]">Real-Time Telemetry</span>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-[var(--c-surface-2)] border border-[var(--c-border)] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <div>
                      <p className="font-semibold text-[var(--c-fg)]">{activeAgent.name} Status: {activeAgent.status}</p>
                      <p className="text-[11px] text-[var(--c-muted)]">{activeAgent.currentTask || 'Monitoring startup parameters and council updates'}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-[var(--c-muted)]">Active</span>
                </div>

                <div className="p-4 rounded-xl bg-[var(--c-surface-2)] border border-[var(--c-border)] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    <div>
                      <p className="font-semibold text-[var(--c-fg)]">RAG Grounding Verification</p>
                      <p className="text-[11px] text-[var(--c-muted)]">Operating strictly against {knowledge.length} indexed corporate documents</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-700 font-bold">Verified</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: ALL OFFICERS ROSTER (Executive Council Grid - Section 8 of PROMPT.MD) */}
      {activeView === 'all' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[var(--c-fg)]">Autonomous Executive Council</h3>
              <p className="text-xs text-[var(--c-muted)] mt-0.5">8 AI executive agents orchestrating strategy, capital, talent, and compliance</p>
            </div>
            <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-[var(--c-surface)] border border-[var(--c-border)] text-[var(--c-fg)]">
              {agents.length} Executives Active
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {agents.map((agent) => (
              <div
                key={agent.id}
                onClick={() => {
                  setCurrentRole(agent.role);
                  setActiveView('agent');
                  setAgentTab('overview');
                  if (onSelectAgent) onSelectAgent(agent.id);
                }}
                className="catalyst-card card-hover glow-border p-6 flex flex-col justify-between cursor-pointer group"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <img
                      src={agent.avatar}
                      alt={agent.name}
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 rounded-2xl object-cover border border-[var(--c-border)] group-hover:scale-105 transition-transform shadow-xs"
                    />
                    <span className="tech-badge">
                      {agent.role}
                    </span>
                  </div>

                  <div className="mt-4">
                    <h4 className="text-base font-bold text-[var(--c-fg)] flex items-center gap-1.5 leading-snug">
                      {getRoleIcon(agent.role)}
                      <span>{agent.name}</span>
                    </h4>
                    <p className="text-[11px] font-medium text-[var(--c-muted)] mt-0.5">
                      {EXECUTIVE_DETAILS[agent.role]?.officialTitle || agent.role}
                    </p>
                    <p className="text-xs text-[var(--c-fg)]/80 mt-2.5 leading-relaxed line-clamp-2">
                      {agent.description}
                    </p>
                  </div>
                </div>

                <div className="mt-5 pt-3.5 border-t border-[var(--c-border)] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${agent.status !== 'idle' ? 'bg-emerald-500 animate-pulse' : 'bg-stone-300'}`} />
                    <span className="text-[11px] font-mono text-[var(--c-muted)] capitalize">{agent.status}</span>
                  </div>
                  <span className="text-xs font-bold text-[var(--c-fg)] group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
                    <span>Inspect</span>
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 3: CONFIGURATION (Startup profile adjustment) */}
      {activeView === 'config' && (
        <div className="max-w-xl mx-auto p-6 rounded-[20px] border border-[var(--c-border)] bg-[var(--c-surface)] shadow-sm">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-[var(--c-fg)]">Startup Profile Adjustments</h3>
            <p className="text-xs text-[var(--c-muted)] mt-1">Configure treasury details and business metadata. Changes update the canonical startup context.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[var(--c-muted)] mb-1.5 font-mono uppercase tracking-wider text-[10px]">Startup Legal Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-[12px] bg-white border border-[var(--c-border-strong)] text-sm text-[var(--c-fg)] focus:outline-none focus:border-[#141413] font-sans"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--c-muted)] mb-1.5 font-mono uppercase tracking-wider text-[10px]">Primary Target Industry</label>
              <input
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-[12px] bg-white border border-[var(--c-border-strong)] text-sm text-[var(--c-fg)] focus:outline-none focus:border-[#141413] font-sans"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--c-muted)] mb-1.5 font-mono uppercase tracking-wider text-[10px]">Product Description & Objective</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-[12px] bg-white border border-[var(--c-border-strong)] text-sm text-[var(--c-fg)] focus:outline-none focus:border-[#141413] font-sans resize-none leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[var(--c-muted)] mb-1.5 font-mono uppercase tracking-wider text-[10px]">Funding Stage</label>
                <select
                  value={fundingStage}
                  onChange={(e) => setFundingStage(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-[12px] bg-[var(--c-surface-2)] border border-[var(--c-border-strong)] text-sm text-[var(--c-fg)] focus:outline-none focus:border-[#141413]"
                >
                  <option value="Idea Phase">Idea Phase</option>
                  <option value="Pre-Seed">Pre-Seed</option>
                  <option value="Seed Stage">Seed Stage</option>
                  <option value="Series A">Series A</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--c-muted)] mb-1.5 font-mono uppercase tracking-wider text-[10px]">Current Cash Balance ($)</label>
                <input
                  type="number"
                  value={cashBalance}
                  onChange={(e) => setCashBalance(Number(e.target.value))}
                  required
                  className="w-full px-3.5 py-2.5 rounded-[12px] bg-white border border-[var(--c-border-strong)] text-sm text-[var(--c-fg)] focus:outline-none focus:border-[#141413] font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--c-muted)] mb-1.5 font-mono uppercase tracking-wider text-[10px]">Target Monthly Burn Rate ($)</label>
              <input
                type="number"
                value={burnRate}
                onChange={(e) => setBurnRate(Number(e.target.value))}
                required
                className="w-full px-3.5 py-2.5 rounded-[12px] bg-white border border-[var(--c-border-strong)] text-sm text-[var(--c-fg)] focus:outline-none focus:border-[#141413] font-mono"
              />
            </div>

            <div className="pt-4 flex items-center justify-between">
              {saveSuccess && (
                <span className="text-xs text-emerald-700 font-bold">
                  ✓ Profile updated successfully!
                </span>
              )}
              <button
                type="submit"
                disabled={isSaving}
                className="ml-auto px-5 py-2.5 rounded-[20px] bg-[var(--c-fg)] hover:opacity-90 text-xs font-bold text-[var(--c-bg)] transition-all disabled:opacity-50 cursor-pointer font-sans"
              >
                {isSaving ? 'Updating...' : 'Save Configuration'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
