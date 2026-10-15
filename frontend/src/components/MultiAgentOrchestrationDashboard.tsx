/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Multi-Agent Orchestration & Live Head Monitoring Dashboard
 * Implements the 5-Step Autonomous Multi-Agent Resource Allocation Pipeline:
 * [ Input Task ] ──► (1. Select Agents) ──► (2. Check Employee DB) 
 *                                                  │
 *                      ┌───────────────────────────┴───────────┐
 *                      ▼ (Available)                           ▼ (Not Available)
 *              (3A. Assign Work)                       (3B. Notify Head to Hire)
 *                      │                                       │
 *                      ▼                                       ▼
 *              (4. Generate Plan)                     (Suggest Domain Specs)
 *                      │
 *                      ▼
 *         (5. Live Monitoring Dashboard)
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Users,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  RotateCcw,
  UserPlus,
  Briefcase,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Clock,
  Check,
  X,
  Plus,
  Send,
  Loader2,
  HelpCircle,
  TrendingUp,
  Cpu,
  Workflow,
  Lightbulb,
  FileText,
  BadgeCheck
} from 'lucide-react';
import type { HiringReasoning } from '../types';

export interface AgentTaskAllocation {
  requiredDomain: string;
  subTaskTitle: string;
  taskScope: string;
  planSteps: string[];
  assignedAgent: {
    name: string;
    role: string;
    avatar: string;
    description: string;
  };
  status: 'ASSIGNED' | 'HIRE_REQUIRED';
  assignedWorker: {
    id?: string;
    name: string;
    domain: string;
    status: 'Available' | 'Busy' | 'On Leave';
    role?: string;
    email?: string;
    skills?: string[];
    responsibilities?: string[];
    capacityPercentage?: number;
    activeTasksCount?: number;
  } | null;
  assignmentReasoning?: string;
  hiringReasoning?: HiringReasoning;
  executionStatus: 'IN_PROGRESS' | 'BLOCKED' | 'PAUSED' | 'COMPLETED';
  monitoringStatus: string;
  systemAlert?: string;
  hiringSuggestion?: string;
  hinglishRecommendation?: string;
  headControls: {
    canPause: boolean;
    canRevoke: boolean;
    canPostJob: boolean;
    canAssign: boolean;
  };
}

export interface MasterTrackingRow {
  subTask: string;
  assignedAgent: string;
  humanEmployee: string;
  executionStatus: string;
  rawExecutionStatus: 'IN_PROGRESS' | 'BLOCKED' | 'PAUSED' | 'COMPLETED';
  headControls: Array<'Pause' | 'Revoke' | 'Click to Post Job' | 'Assign Worker'>;
}

export interface MultiAgentAssessmentResult {
  id: string;
  projectName: string;
  inputTask: string;
  currentStep: number;
  pipelineStatus: 'EXECUTING' | 'BLOCKED_ON_HIRE' | 'COMPLETED' | 'PAUSED';
  totalDomains: number;
  assignedCount: number;
  hireRequiredCount: number;
  allocations: AgentTaskAllocation[];
  monitoringBlueprint: MasterTrackingRow[];
  alerts: Array<{
    domain: string;
    severity: 'warning' | 'info' | 'success';
    title: string;
    message: string;
    recommendation: string;
    hinglishRecommendation?: string;
  }>;
  executionGated: boolean;
  gateReason?: string;
  timestamp: string;
}

interface MultiAgentOrchestrationDashboardProps {
  apiFetch?: (url: string, options?: RequestInit) => Promise<Response>;
  onNavigate?: (tab: string) => void;
  defaultTask?: string;
}

const PRESET_TASKS = [
  {
    title: 'Email Marketing & Python SMTP Worker',
    prompt: 'We need an email marketing system with a React dashboard and a secure Python SMTP background processing worker.'
  },
  {
    title: 'Enterprise Billing & Stripe Reconciliation',
    prompt: 'Build an automated SaaS billing dashboard with Stripe webhooks and Python financial reconciliation workers.'
  },
  {
    title: 'AI Document Knowledge Base & Vector Ingestion',
    prompt: 'Deploy a multi-tenant corporate knowledge base with React document viewer and Python PDF parser queue workers.'
  }
];

export default function MultiAgentOrchestrationDashboard({
  apiFetch,
  onNavigate,
  defaultTask
}: MultiAgentOrchestrationDashboardProps) {
  const [taskInput, setTaskInput] = useState<string>(
    defaultTask || 'We need an email marketing system with a React dashboard and a secure Python SMTP background processing worker.'
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [assessment, setAssessment] = useState<MultiAgentAssessmentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Quick Hire / Assign Modal State
  const [hireModalOpen, setHireModalOpen] = useState<boolean>(false);
  const [selectedSlotDomain, setSelectedSlotDomain] = useState<string>('');
  const [hiredName, setHiredName] = useState<string>('');
  const [hiredRole, setHiredRole] = useState<string>('');
  const [hiredEmail, setHiredEmail] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Load initial assessment on mount
  useEffect(() => {
    handleRunOrchestration(taskInput);
  }, []);

  const handleRunOrchestration = async (requirementToRun?: string) => {
    const textToRun = requirementToRun || taskInput;
    if (!textToRun.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const fetchImpl = apiFetch || fetch;
      const res = await fetchImpl('/api/orchestrate/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userRequirement: textToRun })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to process multi-agent orchestration.');
      }

      const data: MultiAgentAssessmentResult = await res.json();
      setAssessment(data);
    } catch (err: any) {
      console.error('[MultiAgentDashboard] Error:', err);
      setError(err.message || 'Error executing multi-agent orchestration.');
    } finally {
      setLoading(false);
    }
  };

  const handleSlotControl = async (domain: string, action: 'pause' | 'resume' | 'revoke') => {
    if (!assessment) return;
    setActionLoading(true);
    try {
      const fetchImpl = apiFetch || fetch;
      const res = await fetchImpl('/api/orchestrate/slot/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assessmentId: assessment.id,
          domain,
          action
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to ${action} slot.`);
      }

      const updated: MultiAgentAssessmentResult = await res.json();
      setAssessment(updated);
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenHireModal = (domain: string) => {
    setSelectedSlotDomain(domain);
    const alloc = assessment?.allocations.find(a => 
      a.requiredDomain.toLowerCase() === domain.toLowerCase() ||
      domain.toLowerCase().includes(a.requiredDomain.toLowerCase())
    );
    setHiredName('');
    setHiredRole(alloc?.hiringReasoning?.roleTitle || `${domain} Specialist`);
    setHiredEmail('');
    setHireModalOpen(true);
  };

  const handleConfirmHire = async () => {
    if (!assessment || !selectedSlotDomain || !hiredName.trim()) return;

    setActionLoading(true);
    try {
      const fetchImpl = apiFetch || fetch;
      const res = await fetchImpl('/api/orchestrate/slot/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assessmentId: assessment.id,
          domain: selectedSlotDomain,
          workerName: hiredName.trim(),
          workerRole: hiredRole.trim() || undefined,
          workerEmail: hiredEmail.trim() || undefined
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to assign worker to slot.');
      }

      const updated: MultiAgentAssessmentResult = await res.json();
      setAssessment(updated);
      setHireModalOpen(false);
    } catch (err: any) {
      alert(`Failed to assign worker: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 py-4">
      {/* ── Top Header & Title ────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 shadow-2xl backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1.5">
              <Cpu className="w-3 h-3 text-indigo-400" />
              Executive AI Engine
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              5-Step Sequential Pipeline
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            Multi-Agent Orchestration & Resource Allocation
          </h1>
          <p className="text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Decomposes founder initiatives into technical domains, inspects real-time employee availability, assigns available talent, and gates execution until missing roles are staffed.
          </p>
        </div>

        {assessment && (
          <div className="flex items-center gap-3 bg-slate-800/80 border border-slate-700/80 rounded-xl p-3.5 shadow-inner">
            <div className="text-right">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Pipeline State</div>
              <div className={`text-sm font-bold flex items-center gap-1.5 justify-end ${
                assessment.executionGated ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {assessment.executionGated ? (
                  <>
                    <ShieldAlert className="w-4 h-4 text-amber-400 animate-pulse" />
                    BLOCKED ON HIRE
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    EXECUTING
                  </>
                )}
              </div>
            </div>
            <div className="h-8 w-px bg-slate-700" />
            <div className="text-right">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Headcount Match</div>
              <div className="text-sm font-bold text-white">
                {assessment.assignedCount} / {assessment.totalDomains} Assigned
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 5-Step Visual Pipeline Stepper ───────────────────────────────── */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl backdrop-blur-md">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
          <Workflow className="w-3.5 h-3.5 text-indigo-400" />
          5-Stage Execution Architecture
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            {
              step: 'Step 1',
              title: 'Select Agents',
              desc: 'AI analyzes requirement and identifies required domains',
              active: true
            },
            {
              step: 'Step 2',
              title: 'Check Employee DB',
              desc: 'Queries active database for available domain workers',
              active: true
            },
            {
              step: 'Step 3',
              title: 'Assign / Hire Alert',
              desc: 'Assigns available workers or triggers Action Required alerts',
              active: true
            },
            {
              step: 'Step 4',
              title: 'Generate Plan',
              desc: 'Constructs sub-module plan & gates multi-agent execution',
              active: true
            },
            {
              step: 'Step 5',
              title: 'Head Monitoring',
              desc: 'Live master dashboard with Pause, Revoke & Post Job controls',
              active: true
            }
          ].map((s, idx) => (
            <div
              key={idx}
              className="relative p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 hover:border-indigo-500/50 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-400">
                    {s.step}
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                </div>
                <div className="text-xs font-bold text-white mb-1">{s.title}</div>
                <div className="text-[11px] text-slate-400 leading-snug">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Input Task Console ───────────────────────────────────────────── */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <label className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            Project Requirement Input (Head / Assigner Console)
          </label>
          <div className="text-xs text-slate-400">
            Powered by Google Gemini & Real-time Postgres Worker Roster
          </div>
        </div>

        <div className="relative">
          <textarea
            rows={3}
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            placeholder="Describe the initiative or system to orchestrate..."
            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-mono leading-relaxed"
          />
        </div>

        {/* Preset Task Buttons */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 mr-1">Presets:</span>
          {PRESET_TASKS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setTaskInput(p.prompt);
                handleRunOrchestration(p.prompt);
              }}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-indigo-900/40 text-slate-300 hover:text-white border border-slate-700 hover:border-indigo-500/50 transition-all font-medium"
            >
              {p.title}
            </button>
          ))}
        </div>

        {/* Action Button */}
        <div className="mt-4 flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={loading || !taskInput.trim()}
            onClick={() => handleRunOrchestration()}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing Agents & Employee DB...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                Run Multi-Agent Orchestration
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Dependency Gating Alert Banner ────────────────────────────────── */}
      {assessment && (
        <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          assessment.executionGated
            ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
            : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
        }`}>
          <div className="flex items-start gap-3">
            {assessment.executionGated ? (
              <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider">
                {assessment.executionGated ? 'Execution Pipeline Gated' : 'Sequential Pipeline Unblocked'}
              </div>
              <div className="text-xs opacity-90 mt-0.5">
                {assessment.executionGated
                  ? (assessment.gateReason || 'Cannot proceed with automated AI execution until all required technical domain roles are staffed.')
                  : 'All technical domain slots have active workers assigned. Multi-agent workflow is executing.'}
              </div>
            </div>
          </div>

          {assessment.executionGated && (
            <div className="text-xs font-bold text-amber-300 bg-amber-900/60 border border-amber-600/50 px-3 py-1.5 rounded-lg flex-shrink-0">
              {assessment.hireRequiredCount} Domain(s) Need Staffing
            </div>
          )}
        </div>
      )}

      {/* ── Step 3: Domain Allocation Cards (Case A vs Case B) ────────────── */}
      {assessment && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" />
              Step 3 & 4: Resource Allocation & Domain Assessment
            </h2>
            <span className="text-xs text-slate-400">
              {assessment.allocations.length} Required Technical Modules
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {assessment.allocations.map((alloc, idx) => {
              const isAssigned = alloc.status === 'ASSIGNED';

              return (
                <div
                  key={idx}
                  className={`rounded-2xl border p-5 transition-all shadow-lg flex flex-col justify-between ${
                    isAssigned
                      ? 'bg-slate-900/90 border-emerald-500/30 hover:border-emerald-500/60'
                      : 'bg-slate-900/90 border-amber-500/40 hover:border-amber-500/70 shadow-amber-950/20'
                  }`}
                >
                  <div>
                    {/* Header: Domain & Status */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">
                          [{alloc.requiredDomain} Domain]
                        </span>
                        {isAssigned ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            Available & Assigned
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                            Action Required
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] font-medium text-slate-400">
                        {alloc.subTaskTitle}
                      </div>
                    </div>

                    {/* Assigned Agent Details */}
                    <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 mb-3 flex items-center gap-3">
                      <img
                        src={alloc.assignedAgent.avatar}
                        alt={alloc.assignedAgent.name}
                        className="w-9 h-9 rounded-full object-cover border border-indigo-400/50"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>{alloc.assignedAgent.name}</span>
                          <span className="text-[10px] text-indigo-400 font-medium">
                            ({alloc.assignedAgent.role.split(' ')[0]})
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {alloc.assignedAgent.description}
                        </div>
                      </div>
                    </div>

                    {/* Case A: Worker is Available & Present */}
                    {isAssigned && alloc.assignedWorker && (
                      <div className="space-y-3 mb-4">
                        <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-3.5">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                              <BadgeCheck className="w-4 h-4 text-emerald-400" />
                              <span>Assigned: {alloc.assignedWorker.name}</span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              {alloc.assignedWorker.status} · Present
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-300 flex flex-wrap items-center gap-x-4 gap-y-1">
                            <span>Role: <strong className="text-slate-100">{alloc.assignedWorker.role || `${alloc.requiredDomain} Specialist`}</strong></span>
                            {alloc.assignedWorker.email && (
                              <span className="text-slate-400 font-mono">{alloc.assignedWorker.email}</span>
                            )}
                          </div>

                          {/* Verified Skills */}
                          {alloc.assignedWorker.skills && alloc.assignedWorker.skills.length > 0 && (
                            <div className="mt-2.5 pt-2 border-t border-emerald-500/20">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/90 mb-1.5">
                                Verified Competencies & Skills:
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {alloc.assignedWorker.skills.map((skill, sIdx) => (
                                  <span
                                    key={sIdx}
                                    className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-900/40 text-emerald-200 border border-emerald-700/50"
                                  >
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Role Responsibilities */}
                          {alloc.assignedWorker.responsibilities && alloc.assignedWorker.responsibilities.length > 0 && (
                            <div className="mt-2.5 pt-2 border-t border-emerald-500/20">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/90 mb-1 flex items-center gap-1">
                                <Briefcase className="w-3 h-3 text-emerald-400" />
                                Domain Responsibilities:
                              </div>
                              <ul className="space-y-1 text-[11px] text-slate-300">
                                {alloc.assignedWorker.responsibilities.slice(0, 3).map((resp, rIdx) => (
                                  <li key={rIdx} className="flex items-start gap-1.5">
                                    <Check className="w-3 h-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                                    <span>{resp}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        {/* Assignment Reasoning Callout */}
                        {alloc.assignmentReasoning && (
                          <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-xl p-3 text-xs text-indigo-200/90">
                            <div className="font-bold text-indigo-300 mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                              <Lightbulb className="w-3.5 h-3.5 text-indigo-400" />
                              AI Matching & Presence Reasoning:
                            </div>
                            <p className="leading-relaxed text-[11px] text-slate-300">
                              {alloc.assignmentReasoning}
                            </p>
                          </div>
                        )}

                        {/* Execution Plan */}
                        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 space-y-1.5">
                          <div className="text-[11px] text-slate-300">
                            <span className="font-bold text-slate-200">Execution Plan: </span>
                            {alloc.planSteps.join(' ')}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center justify-between">
                            <span>Monitoring Status: <strong className="text-slate-200">{alloc.monitoringStatus}</strong></span>
                            <span className="text-[10px] text-emerald-400 font-mono">Sequential Gate: Unblocked</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Case B: Worker is NOT Available (Core Requirement: AI Diagnostic & Role Responsibilities) */}
                    {!isAssigned && (
                      <div className="space-y-3 mb-4">
                        <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-3.5">
                          <div className="flex items-center gap-2 text-xs font-bold text-amber-300 mb-1">
                            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                            <span>{alloc.systemAlert || `No active or available worker found for ${alloc.requiredDomain}`}</span>
                          </div>
                          <div className="text-[11px] text-slate-300 leading-snug">
                            Multi-agent execution is gated. A human domain owner must be hired or assigned to oversee this module.
                          </div>
                        </div>

                        {/* Structured Autonomous Reasoning Card */}
                        <div className="bg-gradient-to-br from-indigo-950/40 via-slate-900/80 to-amber-950/20 border border-indigo-500/30 rounded-xl p-3.5 shadow-inner">
                          <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-indigo-300 mb-2">
                            <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                            Roster Diagnostic & AI Hiring Reasoning:
                          </div>

                          {alloc.hiringReasoning?.diagnostic && (
                            <div className="text-xs text-slate-200 mb-2 leading-relaxed bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
                              <strong className="text-amber-300">Diagnostic: </strong>
                              {alloc.hiringReasoning.diagnostic}
                            </div>
                          )}

                          {alloc.hiringReasoning?.rationale && (
                            <div className="text-xs text-slate-300 mb-2 leading-relaxed bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
                              <strong className="text-indigo-300">Governance Rationale: </strong>
                              {alloc.hiringReasoning.rationale}
                            </div>
                          )}

                          {/* Target Role & Responsibilities */}
                          <div className="mt-3 pt-2.5 border-t border-slate-800 space-y-2.5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                              <div>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Recommended Target Role</div>
                                <div className="text-xs font-extrabold text-white flex items-center gap-1.5">
                                  <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
                                  {alloc.hiringReasoning?.roleTitle || `${alloc.requiredDomain} Specialist`}
                                </div>
                              </div>
                              {alloc.hiringReasoning?.estimatedCompBand && (
                                <div className="text-right">
                                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Market Benchmark</div>
                                  <div className="text-[11px] font-mono font-bold text-emerald-400">
                                    {alloc.hiringReasoning.estimatedCompBand}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Core Responsibilities List */}
                            {alloc.hiringReasoning?.coreResponsibilities && alloc.hiringReasoning.coreResponsibilities.length > 0 && (
                              <div className="bg-slate-950/80 rounded-lg p-3 border border-amber-500/20">
                                <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-300 mb-1.5 flex items-center gap-1.5">
                                  <FileText className="w-3 h-3 text-amber-400" />
                                  Role Responsibilities (Why We Must Hire This Person):
                                </div>
                                <ul className="space-y-1.5 text-xs text-slate-200">
                                  {alloc.hiringReasoning.coreResponsibilities.map((resp, rIdx) => (
                                    <li key={rIdx} className="flex items-start gap-2">
                                      <span className="text-amber-400 font-bold leading-none mt-0.5">•</span>
                                      <span className="leading-relaxed">{resp}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Required Competencies Pills */}
                            {alloc.hiringReasoning?.requiredSkills && alloc.hiringReasoning.requiredSkills.length > 0 && (
                              <div>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                  Required Technical Competencies:
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {alloc.hiringReasoning.requiredSkills.map((sk, skIdx) => (
                                    <span
                                      key={skIdx}
                                      className="px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-950/60 text-indigo-200 border border-indigo-700/40"
                                    >
                                      {sk}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Immediate Deliverables */}
                            {alloc.hiringReasoning?.immediateDeliverables && alloc.hiringReasoning.immediateDeliverables.length > 0 && (
                              <div>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                  Immediate Ramp Deliverables:
                                </div>
                                <div className="space-y-1">
                                  {alloc.hiringReasoning.immediateDeliverables.map((deliv, dIdx) => (
                                    <div key={dIdx} className="text-[11px] text-slate-300 flex items-center gap-1.5">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                                      <span>{deliv}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {alloc.hinglishRecommendation && (
                            <div className="mt-3 text-xs text-indigo-200/90 bg-indigo-950/60 border border-indigo-500/30 rounded-lg p-2.5 italic">
                              <span className="font-bold text-indigo-300 not-italic">Founder / Head Directive: </span>
                              "{alloc.hinglishRecommendation}"
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Head Action Buttons */}
                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400">
                      Module: <strong className="text-slate-300">{alloc.subTaskTitle}</strong>
                    </span>

                    {isAssigned ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleSlotControl(alloc.requiredDomain, alloc.executionStatus === 'PAUSED' ? 'resume' : 'pause')}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all flex items-center gap-1"
                        >
                          {alloc.executionStatus === 'PAUSED' ? (
                            <>
                              <Play className="w-3 h-3 text-emerald-400" />
                              Resume
                            </>
                          ) : (
                            <>
                              <Pause className="w-3 h-3 text-amber-400" />
                              Pause
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleSlotControl(alloc.requiredDomain, 'revoke')}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 transition-all flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3 text-rose-400" />
                          Revoke
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => handleOpenHireModal(alloc.requiredDomain)}
                        className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 transition-all flex items-center gap-1.5 shadow-sm"
                      >
                        <UserPlus className="w-3.5 h-3.5 text-amber-300" />
                        Click to Post Job / Hire
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Step 5: Master Tracking Blueprint (Live Monitoring Table) ───── */}
      {assessment && (
        <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-5 shadow-2xl overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Workflow className="w-5 h-5 text-indigo-400" />
                Step 5: Master Tracking Blueprint (Head Monitoring Dashboard)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Live state variable returned from backend: updates synchronously as workers are staffed or paused.
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-mono text-emerald-400">Live Telemetry Active</span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-extrabold text-[11px] border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Sub-Task</th>
                  <th className="py-3 px-4">Assigned Agent</th>
                  <th className="py-3 px-4">Human Employee</th>
                  <th className="py-3 px-4">Execution Status</th>
                  <th className="py-3 px-4 text-right">Head Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 bg-slate-900/50">
                {assessment.monitoringBlueprint.map((row, idx) => {
                  const isBlocked = row.rawExecutionStatus === 'BLOCKED';
                  const isPaused = row.rawExecutionStatus === 'PAUSED';
                  const isProgress = row.rawExecutionStatus === 'IN_PROGRESS';

                  return (
                    <tr
                      key={idx}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isBlocked ? 'bg-amber-950/10' : ''
                      }`}
                    >
                      {/* Sub-Task */}
                      <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5 text-indigo-400" />
                        {row.subTask}
                      </td>

                      {/* Assigned Agent */}
                      <td className="py-3.5 px-4 text-slate-300 font-medium">
                        {row.assignedAgent}
                      </td>

                      {/* Human Employee */}
                      <td className="py-3.5 px-4">
                        {row.humanEmployee === 'None' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                            <AlertTriangle className="w-3 h-3 text-rose-400" />
                            None (Unassigned)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            <Check className="w-3 h-3 text-emerald-400" />
                            {row.humanEmployee}
                          </span>
                        )}
                      </td>

                      {/* Execution Status */}
                      <td className="py-3.5 px-4">
                        {isBlocked && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                            ❌ BLOCKED (Hire Recommended)
                          </span>
                        )}
                        {isProgress && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                            <Clock className="w-3.5 h-3.5 text-indigo-400" />
                            ⏳ In Progress
                          </span>
                        )}
                        {isPaused && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-700 text-slate-300 border border-slate-600">
                            <Pause className="w-3.5 h-3.5 text-slate-400" />
                            ⏸️ Paused
                          </span>
                        )}
                      </td>

                      {/* Head Controls */}
                      <td className="py-3.5 px-4 text-right">
                        {isBlocked ? (
                          <button
                            type="button"
                            onClick={() => {
                              const alloc = assessment.allocations.find(a => a.subTaskTitle === row.subTask);
                              handleOpenHireModal(alloc?.requiredDomain || 'Backend');
                            }}
                            className="px-3 py-1 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold text-xs shadow-md shadow-amber-900/30 transition-all flex items-center gap-1.5 ml-auto"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            Click to Post Job
                          </button>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                const alloc = assessment.allocations.find(a => a.subTaskTitle === row.subTask);
                                if (alloc) {
                                  handleSlotControl(alloc.requiredDomain, isPaused ? 'resume' : 'pause');
                                }
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all font-medium text-xs flex items-center gap-1"
                            >
                              {isPaused ? 'Resume' : 'Pause'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const alloc = assessment.allocations.find(a => a.subTaskTitle === row.subTask);
                                if (alloc) {
                                  handleSlotControl(alloc.requiredDomain, 'revoke');
                                }
                              }}
                              className="px-2.5 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 transition-all font-medium text-xs flex items-center gap-1"
                            >
                              Revoke
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Quick Hire / Assign Worker Modal ──────────────────────────────── */}
      <AnimatePresence>
        {hireModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto"
            >
              <button
                type="button"
                onClick={() => setHireModalOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <UserPlus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Assign / Hire Specialist
                  </h3>
                  <p className="text-xs text-slate-400">
                    Unblocks multi-agent execution for {selectedSlotDomain} domain
                  </p>
                </div>
              </div>

              {/* Selected Slot Role & Responsibilities Preview */}
              {(() => {
                const alloc = assessment?.allocations.find(a => 
                  a.requiredDomain.toLowerCase() === selectedSlotDomain.toLowerCase() ||
                  selectedSlotDomain.toLowerCase().includes(a.requiredDomain.toLowerCase())
                );
                const hr = alloc?.hiringReasoning;
                return hr ? (
                  <div className="mb-4 p-3.5 rounded-xl bg-slate-950 border border-amber-500/30 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                        Target Role to be Staffed
                      </span>
                      {hr.estimatedCompBand && (
                        <span className="text-[10px] font-mono text-emerald-400">
                          {hr.estimatedCompBand}
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-white text-sm">{hr.roleTitle}</div>
                    {hr.coreResponsibilities && hr.coreResponsibilities.length > 0 && (
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                          Role Responsibilities:
                        </div>
                        <ul className="space-y-1 text-[11px] text-slate-300">
                          {hr.coreResponsibilities.slice(0, 3).map((resp, rIdx) => (
                            <li key={rIdx} className="flex items-start gap-1.5">
                              <span className="text-amber-400 font-bold">•</span>
                              <span>{resp}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : null;
              })()}

              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Candidate Full Name *
                  </label>
                  <input
                    type="text"
                    value={hiredName}
                    onChange={(e) => setHiredName(e.target.value)}
                    placeholder="e.g. Vikram Sharma, Anita Rao"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Designation / Role Title
                  </label>
                  <input
                    type="text"
                    value={hiredRole}
                    onChange={(e) => setHiredRole(e.target.value)}
                    placeholder="e.g. Senior Financial Analyst, Python Backend Specialist"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Worker Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={hiredEmail}
                    onChange={(e) => setHiredEmail(e.target.value)}
                    placeholder="vikram@company.internal"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>

                <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-200">
                  <div className="font-bold mb-0.5">Automated Multi-Agent Gating:</div>
                  Once assigned, this worker will be marked <strong>Available & Present</strong> in the company database and this domain slot will transition from <strong>BLOCKED</strong> to <strong>⏳ In Progress</strong>.
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setHireModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!hiredName.trim() || actionLoading}
                    onClick={handleConfirmHire}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-lg shadow-emerald-900/30 disabled:opacity-50 flex items-center gap-2"
                  >
                    {actionLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Saving to DB...
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Confirm Hire & Unblock
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
