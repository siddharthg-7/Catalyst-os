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
    <div className="space-y-6 font-sans">
      {/* ── Top Header & Title ────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-[#141413]/10 rounded-xl p-6 shadow-[rgba(20,20,19,0.02)_0px_1px_4px_0px]">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase bg-[#F3F0EE] text-[#141413] border border-[#141413]/10 flex items-center gap-1.5">
              <Cpu className="w-3 h-3 text-[#141413]" />
              Executive AI Engine
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase bg-emerald-50 text-emerald-800 border border-emerald-200/80">
              5-Step Sequential Pipeline
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#141413] tracking-tight flex items-center gap-3">
            Multi-Agent Orchestration &amp; Resource Allocation
          </h1>
          <p className="text-xs sm:text-sm text-[#666562] mt-1 max-w-2xl leading-relaxed">
            Decomposes founder initiatives into technical domains, inspects real-time employee availability, assigns available talent, and gates execution until missing roles are staffed.
          </p>
        </div>

        {assessment && (
          <div className="flex items-center gap-3 bg-[#FDFCFA] border border-[#141413]/10 rounded-xl p-3.5 shadow-xs">
            <div className="text-right">
              <div className="text-[10px] font-mono uppercase tracking-wider text-[#666562]">Pipeline State</div>
              <div className={`text-xs font-bold font-mono flex items-center gap-1.5 justify-end ${
                assessment.executionGated ? 'text-amber-800' : 'text-emerald-700'
              }`}>
                {assessment.executionGated ? (
                  <>
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-700 animate-pulse" />
                    BLOCKED ON HIRE
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                    EXECUTING
                  </>
                )}
              </div>
            </div>
            <div className="h-8 w-px bg-[#141413]/10" />
            <div className="text-right">
              <div className="text-[10px] font-mono uppercase tracking-wider text-[#666562]">Headcount Match</div>
              <div className="text-xs font-bold font-mono text-[#141413]">
                {assessment.assignedCount} / {assessment.totalDomains} Assigned
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 5-Step Visual Pipeline Stepper ───────────────────────────────── */}
      <div className="bg-white border border-[#141413]/10 rounded-xl p-5 shadow-[rgba(20,20,19,0.02)_0px_1px_4px_0px]">
        <div className="text-xs font-bold uppercase tracking-wider text-[#666562] mb-3 flex items-center gap-2 font-mono">
          <Workflow className="w-3.5 h-3.5 text-[#141413]" />
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
              className="relative p-3.5 rounded-lg border border-[#141413]/08 bg-[#FDFCFA] hover:bg-white hover:border-[#141413]/25 transition-all flex flex-col justify-between shadow-[rgba(20,20,19,0.01)_0px_1px_3px_0px]"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#141413]">
                    {s.step}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                </div>
                <div className="text-xs font-bold text-[#141413] mb-0.5">{s.title}</div>
                <div className="text-[11px] text-[#666562] leading-snug">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Input Task Console ───────────────────────────────────────────── */}
      <div className="bg-white border border-[#141413]/10 rounded-xl p-5 shadow-[rgba(20,20,19,0.02)_0px_1px_4px_0px]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <label className="text-xs font-bold text-[#141413] uppercase tracking-wider font-mono flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-[#141413]" />
            Project Requirement Input (Head / Assigner Console)
          </label>
          <div className="text-[11px] text-[#666562]">
            Powered by Google Gemini &amp; Real-time Postgres Worker Roster
          </div>
        </div>

        <div className="relative">
          <textarea
            rows={3}
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            placeholder="Describe the initiative or system to orchestrate..."
            className="w-full bg-[#FDFCFA] border border-[#141413]/10 rounded-xl p-3.5 text-xs sm:text-[13px] text-[#141413] placeholder:text-[#666562]/60 focus:outline-none focus:border-[#141413] focus:bg-white focus:ring-1 focus:ring-[#141413]/10 transition-all font-mono leading-relaxed"
          />
        </div>

        {/* Preset Task Buttons */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[#666562] mr-1">Presets:</span>
          {PRESET_TASKS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setTaskInput(p.prompt);
                handleRunOrchestration(p.prompt);
              }}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-[#F3F0EE] hover:bg-[#FDFCFA] text-[#141413] border border-[#141413]/10 hover:border-[#141413]/25 transition-all font-medium cursor-pointer"
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
            className="px-5 py-2.5 rounded-lg bg-[#141413] hover:bg-[#262627] text-[#FDFCFA] font-bold text-xs shadow-xs disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 cursor-pointer font-sans"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FDFCFA]" />
                <span>Analyzing Agents &amp; Employee DB...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-[#FDFCFA]" />
                <span>Run Multi-Agent Orchestration</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Dependency Gating Alert Banner ────────────────────────────────── */}
      {assessment && (
        <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          assessment.executionGated
            ? 'bg-amber-50 border-amber-200/80 text-amber-900'
            : 'bg-emerald-50 border-emerald-200/80 text-emerald-900'
        }`}>
          <div className="flex items-start gap-3">
            {assessment.executionGated ? (
              <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider font-mono">
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
            <div className="text-xs font-mono font-bold text-amber-900 bg-amber-100 border border-amber-300 px-3 py-1.5 rounded-lg shrink-0">
              {assessment.hireRequiredCount} Domain(s) Need Staffing
            </div>
          )}
        </div>
      )}

      {/* ── Step 3: Domain Allocation Cards (Case A vs Case B) ────────────── */}
      {assessment && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#141413] flex items-center gap-2">
              <Users className="w-4 h-4 text-[#141413]" />
              Step 3 & 4: Resource Allocation & Domain Assessment
            </h2>
            <span className="text-xs text-[#666562]">
              {assessment.allocations.length} Required Technical Modules
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {assessment.allocations.map((alloc, idx) => {
              const isAssigned = alloc.status === 'ASSIGNED';

              return (
                <div
                  key={idx}
                  className={`rounded-2xl border p-5 transition-all shadow-xs flex flex-col justify-between ${
                    isAssigned
                      ? 'bg-white border-[#141413]/10 hover:border-[#141413]/20'
                      : 'bg-white border-amber-200/80 hover:border-amber-300'
                  }`}
                >
                  <div>
                    {/* Header: Domain & Status */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[#141413]">
                          [{alloc.requiredDomain} Domain]
                        </span>
                        {isAssigned ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
                            Available & Assigned
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            Action Required
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] font-medium text-[#666562]">
                        {alloc.subTaskTitle}
                      </div>
                    </div>

                    {/* Assigned Agent Details */}
                    <div className="bg-[#FDFCFA] rounded-xl p-3 border border-[#141413]/10 mb-3 flex items-center gap-3">
                      <img
                        src={alloc.assignedAgent.avatar}
                        alt={alloc.assignedAgent.name}
                        className="w-9 h-9 rounded-full object-cover border border-[#141413]/10"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-[#141413] flex items-center gap-1.5">
                          <span>{alloc.assignedAgent.name}</span>
                          <span className="text-[10px] text-[#666562] font-medium">
                            ({alloc.assignedAgent.role.split(' ')[0]})
                          </span>
                        </div>
                        <div className="text-[11px] text-[#666562] truncate">
                          {alloc.assignedAgent.description}
                        </div>
                      </div>
                    </div>

                    {/* Case A: Worker is Available & Present */}
                    {isAssigned && alloc.assignedWorker && (
                      <div className="space-y-3 mb-4">
                        <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-xl p-3.5">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                              <BadgeCheck className="w-4 h-4 text-emerald-700" />
                              <span>Assigned: {alloc.assignedWorker.name}</span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                              {alloc.assignedWorker.status} · Present
                            </span>
                          </div>

                          <div className="text-[11px] text-[#141413] flex flex-wrap items-center gap-x-4 gap-y-1">
                            <span>Role: <strong className="text-[#141413]">{alloc.assignedWorker.role || `${alloc.requiredDomain} Specialist`}</strong></span>
                            {alloc.assignedWorker.email && (
                              <span className="text-[#666562] font-mono">{alloc.assignedWorker.email}</span>
                            )}
                          </div>

                          {/* Verified Skills */}
                          {alloc.assignedWorker.skills && alloc.assignedWorker.skills.length > 0 && (
                            <div className="mt-2.5 pt-2 border-t border-emerald-200/60">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 mb-1.5">
                                Verified Competencies & Skills:
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {alloc.assignedWorker.skills.map((skill, sIdx) => (
                                  <span
                                    key={sIdx}
                                    className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-white text-emerald-900 border border-emerald-200"
                                  >
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Role Responsibilities */}
                          {alloc.assignedWorker.responsibilities && alloc.assignedWorker.responsibilities.length > 0 && (
                            <div className="mt-2.5 pt-2 border-t border-emerald-200/60">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 mb-1 flex items-center gap-1">
                                <Briefcase className="w-3 h-3 text-emerald-700" />
                                Domain Responsibilities:
                              </div>
                              <ul className="space-y-1 text-[11px] text-[#141413]">
                                {alloc.assignedWorker.responsibilities.slice(0, 3).map((resp, rIdx) => (
                                  <li key={rIdx} className="flex items-start gap-1.5">
                                    <Check className="w-3 h-3 text-emerald-700 mt-0.5 flex-shrink-0" />
                                    <span>{resp}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        {/* Assignment Reasoning Callout */}
                        {alloc.assignmentReasoning && (
                          <div className="bg-[#FDFCFA] border border-[#141413]/10 rounded-xl p-3 text-xs text-[#666562]">
                            <div className="font-bold text-[#141413] mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                              <Lightbulb className="w-3.5 h-3.5 text-[#141413]" />
                              AI Matching & Presence Reasoning:
                            </div>
                            <p className="leading-relaxed text-[11px] text-[#666562]">
                              {alloc.assignmentReasoning}
                            </p>
                          </div>
                        )}

                        {/* Execution Plan */}
                        <div className="bg-[#FDFCFA] border border-[#141413]/10 rounded-xl p-3 space-y-1.5">
                          <div className="text-[11px] text-[#141413]">
                            <span className="font-bold text-[#141413]">Execution Plan: </span>
                            {alloc.planSteps.join(' ')}
                          </div>
                          <div className="text-[11px] text-[#666562] flex items-center justify-between">
                            <span>Monitoring Status: <strong className="text-[#141413]">{alloc.monitoringStatus}</strong></span>
                            <span className="text-[10px] text-emerald-700 font-mono font-medium">Sequential Gate: Unblocked</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Case B: Worker is NOT Available (Core Requirement: AI Diagnostic & Role Responsibilities) */}
                    {!isAssigned && (
                      <div className="space-y-3 mb-4">
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5">
                          <div className="flex items-center gap-2 text-xs font-bold text-amber-900 mb-1">
                            <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0" />
                            <span>{alloc.systemAlert || `No active or available worker found for ${alloc.requiredDomain}`}</span>
                          </div>
                          <div className="text-[11px] text-amber-800 leading-snug">
                            Multi-agent execution is gated. A human domain owner must be hired or assigned to oversee this module.
                          </div>
                        </div>

                        {/* Structured Autonomous Reasoning Card */}
                        <div className="bg-[#FDFCFA] border border-[#141413]/10 rounded-xl p-3.5 shadow-xs">
                          <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#141413] mb-2">
                            <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                            Roster Diagnostic & AI Hiring Reasoning:
                          </div>

                          {alloc.hiringReasoning?.diagnostic && (
                            <div className="text-xs text-[#141413] mb-2 leading-relaxed bg-white p-2.5 rounded-lg border border-[#141413]/10">
                              <strong className="text-amber-800">Diagnostic: </strong>
                              {alloc.hiringReasoning.diagnostic}
                            </div>
                          )}

                          {alloc.hiringReasoning?.rationale && (
                            <div className="text-xs text-[#666562] mb-2 leading-relaxed bg-white p-2.5 rounded-lg border border-[#141413]/10">
                              <strong className="text-[#141413]">Governance Rationale: </strong>
                              {alloc.hiringReasoning.rationale}
                            </div>
                          )}

                          {/* Target Role & Responsibilities */}
                          <div className="mt-3 pt-2.5 border-t border-[#141413]/10 space-y-2.5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                              <div>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-[#666562]">Recommended Target Role</div>
                                <div className="text-xs font-extrabold text-[#141413] flex items-center gap-1.5">
                                  <Briefcase className="w-3.5 h-3.5 text-[#141413]" />
                                  {alloc.hiringReasoning?.roleTitle || `${alloc.requiredDomain} Specialist`}
                                </div>
                              </div>
                              {alloc.hiringReasoning?.estimatedCompBand && (
                                <div className="text-right">
                                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#666562]">Market Benchmark</div>
                                  <div className="text-[11px] font-mono font-bold text-emerald-700">
                                    {alloc.hiringReasoning.estimatedCompBand}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Core Responsibilities List */}
                            {alloc.hiringReasoning?.coreResponsibilities && alloc.hiringReasoning.coreResponsibilities.length > 0 && (
                              <div className="bg-amber-50/50 rounded-lg p-3 border border-amber-200">
                                <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900 mb-1.5 flex items-center gap-1.5">
                                  <FileText className="w-3 h-3 text-amber-700" />
                                  Role Responsibilities (Why We Must Hire This Person):
                                </div>
                                <ul className="space-y-1.5 text-xs text-amber-950">
                                  {alloc.hiringReasoning.coreResponsibilities.map((resp, rIdx) => (
                                    <li key={rIdx} className="flex items-start gap-2">
                                      <span className="text-amber-700 font-bold leading-none mt-0.5">•</span>
                                      <span className="leading-relaxed">{resp}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Required Competencies Pills */}
                            {alloc.hiringReasoning?.requiredSkills && alloc.hiringReasoning.requiredSkills.length > 0 && (
                              <div>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-[#666562] mb-1">
                                  Required Technical Competencies:
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {alloc.hiringReasoning.requiredSkills.map((sk, skIdx) => (
                                    <span
                                      key={skIdx}
                                      className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#F3F0EE] text-[#141413] border border-[#141413]/10"
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
                                <div className="text-[10px] font-bold uppercase tracking-wider text-[#666562] mb-1">
                                  Immediate Ramp Deliverables:
                                </div>
                                <div className="space-y-1">
                                  {alloc.hiringReasoning.immediateDeliverables.map((deliv, dIdx) => (
                                    <div key={dIdx} className="text-[11px] text-[#141413] flex items-center gap-1.5">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-700 flex-shrink-0" />
                                      <span>{deliv}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {alloc.hinglishRecommendation && (
                            <div className="mt-3 text-xs text-[#666562] bg-[#F3F0EE] border border-[#141413]/10 rounded-lg p-2.5 italic">
                              <span className="font-bold text-[#141413] not-italic">Founder / Head Directive: </span>
                              "{alloc.hinglishRecommendation}"
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Head Action Buttons */}
                  <div className="pt-3 border-t border-[#141413]/10 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-[#666562]">
                      Module: <strong className="text-[#141413]">{alloc.subTaskTitle}</strong>
                    </span>

                    {isAssigned ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleSlotControl(alloc.requiredDomain, alloc.executionStatus === 'PAUSED' ? 'resume' : 'pause')}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#F3F0EE] hover:bg-[#EAE6E2] text-[#141413] border border-[#141413]/10 transition-all flex items-center gap-1"
                        >
                          {alloc.executionStatus === 'PAUSED' ? (
                            <>
                              <Play className="w-3 h-3 text-emerald-700" />
                              Resume
                            </>
                          ) : (
                            <>
                              <Pause className="w-3 h-3 text-amber-700" />
                              Pause
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleSlotControl(alloc.requiredDomain, 'revoke')}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 transition-all flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3 text-rose-700" />
                          Revoke
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => handleOpenHireModal(alloc.requiredDomain)}
                        className="px-3 py-1.5 text-xs font-bold rounded-lg bg-[#141413] hover:bg-[#282725] text-white border border-[#141413] transition-all flex items-center gap-1.5 shadow-xs"
                      >
                        <UserPlus className="w-3.5 h-3.5 text-white" />
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
        <div className="bg-white border border-[#141413]/10 rounded-2xl p-5 shadow-xs overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-bold text-[#141413] flex items-center gap-2">
                <Workflow className="w-4 h-4 text-[#141413]" />
                Step 5: Master Tracking Blueprint (Head Monitoring Dashboard)
              </h2>
              <p className="text-xs text-[#666562] mt-0.5">
                Live state variable returned from backend: updates synchronously as workers are staffed or paused.
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              <span className="text-xs font-mono text-emerald-700 font-medium">Live Telemetry Active</span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#141413]/10">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FDFCFA] text-[#666562] uppercase tracking-wider font-extrabold text-[11px] border-b border-[#141413]/10">
                <tr>
                  <th className="py-3 px-4">Sub-Task</th>
                  <th className="py-3 px-4">Assigned Agent</th>
                  <th className="py-3 px-4">Human Employee</th>
                  <th className="py-3 px-4">Execution Status</th>
                  <th className="py-3 px-4 text-right">Head Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#141413]/10 bg-white">
                {assessment.monitoringBlueprint.map((row, idx) => {
                  const isBlocked = row.rawExecutionStatus === 'BLOCKED';
                  const isPaused = row.rawExecutionStatus === 'PAUSED';
                  const isProgress = row.rawExecutionStatus === 'IN_PROGRESS';

                  return (
                    <tr
                      key={idx}
                      className={`hover:bg-[#F3F0EE]/50 transition-colors ${
                        isBlocked ? 'bg-amber-50/40' : ''
                      }`}
                    >
                      {/* Sub-Task */}
                      <td className="py-3.5 px-4 font-bold text-[#141413] flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5 text-[#666562]" />
                        {row.subTask}
                      </td>

                      {/* Assigned Agent */}
                      <td className="py-3.5 px-4 text-[#666562] font-medium">
                        {row.assignedAgent}
                      </td>

                      {/* Human Employee */}
                      <td className="py-3.5 px-4">
                        {row.humanEmployee === 'None' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                            <AlertTriangle className="w-3 h-3 text-rose-700" />
                            None (Unassigned)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <Check className="w-3 h-3 text-emerald-700" />
                            {row.humanEmployee}
                          </span>
                        )}
                      </td>

                      {/* Execution Status */}
                      <td className="py-3.5 px-4">
                        {isBlocked && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-700 animate-pulse" />
                            BLOCKED (Hire Recommended)
                          </span>
                        )}
                        {isProgress && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#F3F0EE] text-[#141413] border border-[#141413]/10">
                            <Clock className="w-3.5 h-3.5 text-[#666562]" />
                            In Progress
                          </span>
                        )}
                        {isPaused && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-stone-100 text-[#666562] border border-[#141413]/10">
                            <Pause className="w-3.5 h-3.5 text-[#666562]" />
                            Paused
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
                            className="px-3 py-1 rounded-lg bg-[#141413] hover:bg-[#282725] text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 ml-auto"
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
                              className="px-2.5 py-1 rounded-lg bg-[#F3F0EE] hover:bg-[#EAE6E2] text-[#141413] border border-[#141413]/10 transition-all font-medium text-xs flex items-center gap-1"
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
                              className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 transition-all font-medium text-xs flex items-center gap-1"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-[#141413]/10 rounded-2xl w-full max-w-lg p-6 shadow-xl relative max-h-[90vh] overflow-y-auto"
            >
              <button
                type="button"
                onClick={() => setHireModalOpen(false)}
                className="absolute top-4 right-4 text-[#666562] hover:text-[#141413] p-1 rounded-lg hover:bg-[#F3F0EE]"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#141413]">
                    Assign / Hire Specialist
                  </h3>
                  <p className="text-xs text-[#666562]">
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
                  <div className="mb-4 p-3.5 rounded-xl bg-[#FDFCFA] border border-amber-200 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                        Target Role to be Staffed
                      </span>
                      {hr.estimatedCompBand && (
                        <span className="text-[10px] font-mono font-medium text-emerald-700">
                          {hr.estimatedCompBand}
                        </span>
                      )}
                    </div>
                    <div className="font-bold text-[#141413] text-sm">{hr.roleTitle}</div>
                    {hr.coreResponsibilities && hr.coreResponsibilities.length > 0 && (
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[#666562] mb-1">
                          Role Responsibilities:
                        </div>
                        <ul className="space-y-1 text-[11px] text-[#141413]">
                          {hr.coreResponsibilities.slice(0, 3).map((resp, rIdx) => (
                            <li key={rIdx} className="flex items-start gap-1.5">
                              <span className="text-amber-700 font-bold">•</span>
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
                  <label className="block text-xs font-semibold text-[#141413] mb-1">
                    Candidate Full Name *
                  </label>
                  <input
                    type="text"
                    value={hiredName}
                    onChange={(e) => setHiredName(e.target.value)}
                    placeholder="e.g. Vikram Sharma, Anita Rao"
                    className="w-full bg-[#FDFCFA] border border-[#141413]/15 rounded-xl px-3.5 py-2.5 text-sm text-[#141413] placeholder-[#8E8D8A] focus:outline-none focus:ring-1 focus:ring-[#141413] focus:border-[#141413] font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#141413] mb-1">
                    Designation / Role Title
                  </label>
                  <input
                    type="text"
                    value={hiredRole}
                    onChange={(e) => setHiredRole(e.target.value)}
                    placeholder="e.g. Senior Financial Analyst, Python Backend Specialist"
                    className="w-full bg-[#FDFCFA] border border-[#141413]/15 rounded-xl px-3.5 py-2.5 text-sm text-[#141413] placeholder-[#8E8D8A] focus:outline-none focus:ring-1 focus:ring-[#141413] focus:border-[#141413] font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#141413] mb-1">
                    Worker Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={hiredEmail}
                    onChange={(e) => setHiredEmail(e.target.value)}
                    placeholder="vikram@company.internal"
                    className="w-full bg-[#FDFCFA] border border-[#141413]/15 rounded-xl px-3.5 py-2.5 text-sm text-[#141413] placeholder-[#8E8D8A] focus:outline-none focus:ring-1 focus:ring-[#141413] focus:border-[#141413] font-medium"
                  />
                </div>

                <div className="p-3 rounded-xl bg-[#FDFCFA] border border-[#141413]/10 text-xs text-[#666562]">
                  <div className="font-bold text-[#141413] mb-0.5">Automated Multi-Agent Gating:</div>
                  Once assigned, this worker will be marked <strong>Available & Present</strong> in the company database and this domain slot will transition from <strong>BLOCKED</strong> to <strong>In Progress</strong>.
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setHireModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#F3F0EE] hover:bg-[#EAE6E2] text-[#141413] border border-[#141413]/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!hiredName.trim() || actionLoading}
                    onClick={handleConfirmHire}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-[#141413] hover:bg-[#282725] text-white border border-[#141413] shadow-xs disabled:opacity-50 flex items-center gap-2"
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
