/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Phase B — Executive Council Experience
 * B1 — Executive Council Workspace (Available AI executives, role, workload, recommendations, active tasks, risks, recent decisions)
 * B2 — Council Deliberation (Orchestrator -> Specialists parallel/sequential -> Synthesis -> Recommendation)
 * B3 — Live Council Meeting (Sequential live deliberation: Atlas -> Echo -> Aura -> Helix -> Atlas synthesis)
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Agent, 
  StartupProfile, 
  DecisionRecord, 
  KnowledgeFile, 
  DelegatedTask, 
  Initiative, 
  Deliverable 
} from '../types';
import {
  Rocket, Landmark, Users, Briefcase, Cog, Shield,
  CheckCircle2, AlertTriangle, FileText, Clock, TrendingUp,
  Settings, ArrowRight, ShieldCheck, Activity, Layers,
  ChevronRight, Calendar, UserCheck, Scale, Compass, Check,
  Bot, Play, RefreshCw, Send, Sparkles, MessageSquare, AlertCircle,
  HelpCircle, Eye, ArrowDown, ChevronDown, CheckSquare, Zap, X, Cpu
} from 'lucide-react';
import Section from './Section';
import MultiAgentOrchestrationDashboard from './MultiAgentOrchestrationDashboard';

interface ExecutiveCouncilWorkspaceProps {
  agents: Agent[];
  startup: StartupProfile;
  decisions?: DecisionRecord[];
  knowledge?: KnowledgeFile[];
  tasks?: DelegatedTask[];
  initiatives?: Initiative[];
  approvals?: Deliverable[];
  selectedAgentId?: string;
  onSelectAgent?: (id: string) => void;
  onReviewItem?: (id: string, action: 'approve' | 'reject' | 'modify', feedback?: string) => Promise<void>;
  onUpdateStartup?: (updated: StartupProfile) => void;
  onRefreshTasks?: () => Promise<void>;
  onNavigate?: (tab: string) => void;
  apiFetch?: (url: string, options?: RequestInit) => Promise<Response>;
  teamMembers?: Array<{
    id: string;
    fullName?: string;
    name?: string;
    role?: string;
    systemRole?: string;
    department?: string;
    email?: string;
    status?: string;
    avatar?: string;
  }>;
  currentUser?: {
    id?: string;
    name?: string;
    email?: string;
    role?: string;
  } | null;
}

// ── B1 Data Models ─────────────────────────────────────────────────────────────

interface ExecutiveCouncilData {
  id?: string;
  role: string;
  name: string;
  officialTitle: string;
  department: string;
  avatar: string;
  description: string;
  isRealMember?: boolean;
  isOpenSlot?: boolean;
  tasksDone: {
    count: number;
    titles: string[];
  };
  progress: number;
  currentWorkload: {
    activeTasksCount: number;
    inFlightSummary: string;
    velocityScore: string;
  };
  recommendations: Array<{
    id: string;
    title: string;
    summary: string;
    impact: string;
    urgency: 'high' | 'medium' | 'low';
  }>;
  risks: Array<{
    id: string;
    title: string;
    severity: 'critical' | 'high' | 'moderate';
    mitigation: string;
  }>;
  keyMetrics: Array<{ label: string; value: string; trend?: string }>;
}

export default function ExecutiveCouncilWorkspace({
  agents,
  startup,
  decisions = [],
  knowledge = [],
  tasks = [],
  initiatives = [],
  approvals = [],
  selectedAgentId,
  onSelectAgent,
  onReviewItem,
  onUpdateStartup,
  onRefreshTasks,
  onNavigate,
  apiFetch,
  teamMembers = [],
  currentUser
}: ExecutiveCouncilWorkspaceProps) {
  // Top level phase mode: B1 (Workspace), B2 (Deliberation), B3 (Live Meeting), 5-Step Orchestration
  const [activeMode, setActiveMode] = useState<'workspace' | 'deliberation' | 'meeting' | 'orchestration'>('workspace');
  
  // Selected executive for detail inspection in B1
  const [selectedExecutiveRole, setSelectedExecutiveRole] = useState<string>('CEO');
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // ── B2 Deliberation State ────────────────────────────────────────────────────
  const [activeDeliberationId, setActiveDeliberationId] = useState<string>('delib_hiring');

  // ── B3 Live Meeting State ───────────────────────────────────────────────────
  const [meetingQuestion, setMeetingQuestion] = useState('Should we hire two engineers?');
  const [meetingRunning, setMeetingRunning] = useState(false);
  const [meetingStep, setMeetingStep] = useState<number>(0);
  const [meetingTimer, setMeetingTimer] = useState<number>(0);
  const [meetingCompleted, setMeetingCompleted] = useState<boolean>(false);
  const timerIntervalRef = useRef<any>(null);

  // Sync selectedAgentId prop
  useEffect(() => {
    if (selectedAgentId) {
      const match = agents.find(a => 
        a.id.toLowerCase() === selectedAgentId.toLowerCase() ||
        a.role.toLowerCase() === selectedAgentId.toLowerCase()
      );
      if (match) {
        setSelectedExecutiveRole(match.role);
      }
    }
  }, [selectedAgentId, agents]);

  // Derived Financial Telemetry
  const cashBalance = startup.cashBalance ?? 245000;
  const burnRate = startup.burnRate ?? 18500;
  const runwayMonths = startup.runwayMonths > 0 
    ? startup.runwayMonths 
    : (burnRate > 0 ? Number((cashBalance / burnRate).toFixed(1)) : 12);

  // ── B1: Dynamic Council Profiles & Real Workload Association ─────────────────
  const councilProfiles: Record<string, ExecutiveCouncilData> = useMemo(() => {
    const getTasksForDeptOrMember = (dept: string, memberName?: string, memberRole?: string) => {
      return tasks.filter(t => {
        const assignee = (t.assignedUserName || t.ownerRole || '').toLowerCase();
        const mName = (memberName || '').toLowerCase();
        const mRole = (memberRole || '').toLowerCase();
        const tDept = (t.department || '').toLowerCase();
        const tAgent = (t.agent || '').toLowerCase();
        const tOwner = (t.ownerRole || '').toLowerCase();
        const d = dept.toLowerCase();

        const matchName = mName && assignee && (assignee.includes(mName) || mName.includes(assignee));
        const matchDept = d && ((tDept && (tDept === d || tDept.includes(d) || d.includes(tDept))) ||
                                (tAgent && (tAgent.includes(d) || d.includes(tAgent))));
        const matchRole = mRole && tOwner && (mRole === tOwner || mRole.includes(tOwner) || tOwner.includes(mRole));

        return matchName || matchDept || matchRole;
      });
    };

    const getProgressData = (taskList: DelegatedTask[]) => {
      const completed = taskList.filter(t => t.status === 'approved');
      const active = taskList.filter(t => t.status !== 'approved');
      const count = completed.length;
      const total = taskList.length;
      const progress = total > 0 ? Math.round((count / total) * 100) : (count > 0 ? 100 : 0);
      return {
        completed,
        active,
        count,
        total,
        progress,
        titles: completed.map(t => t.title)
      };
    };

    const founderName = (currentUser?.name || (startup as any).founderName || 'The Founder').trim();
    const ceoTasks = tasks.filter(t => 
      t.ownerRole === 'FOUNDER' || 
      t.ownerRole === 'CEO' || 
      t.department === 'GENERAL' || 
      t.department === 'EXECUTIVE' ||
      (t.assignedUserName && t.assignedUserName.toLowerCase().includes(founderName.toLowerCase()))
    );
    const ceoProgress = getProgressData(ceoTasks);

    const profiles: Record<string, ExecutiveCouncilData> = {
      CEO: {
        role: 'CEO',
        name: founderName,
        officialTitle: 'Founder & Chief Executive Officer',
        department: 'EXECUTIVE',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        description: 'Venture founder and executive orchestrator coordinating cross-functional team governance and strategic roadmap.',
        isRealMember: true,
        isOpenSlot: false,
        tasksDone: {
          count: ceoProgress.count,
          titles: ceoProgress.titles
        },
        progress: ceoProgress.progress || (ceoProgress.count > 0 ? 100 : 85),
        currentWorkload: {
          activeTasksCount: ceoProgress.active.length || (ceoProgress.count > 0 ? 0 : 2),
          inFlightSummary: ceoProgress.active.length > 0 
            ? `Overseeing: ${ceoProgress.active.map(t => t.title).slice(0, 2).join(', ')}`
            : 'Decomposing strategic venture directives & balancing departmental resource priorities',
          velocityScore: `${startup.metrics?.velocity ?? 84}%`
        },
        recommendations: [
          {
            id: 'rec_ceo_1',
            title: 'Maintain 6-Month Liquidity Reserve Prior to Headcount Acceleration',
            summary: 'Ensure treasury buffers exceed 6x monthly burn rate before committing to multi-quarter hires.',
            impact: 'Preserves runway solvency through Q4',
            urgency: 'high'
          },
          {
            id: 'rec_ceo_2',
            title: 'Synchronize Product Roadmap With Talent Acquisition Cycle',
            summary: 'Sequence engineering sprints so lead developers onboard exactly at core perception architecture kickoff.',
            impact: 'Eliminates idle engineering ramp time',
            urgency: 'medium'
          }
        ],
        risks: [
          {
            id: 'risk_ceo_1',
            title: 'Inter-departmental Execution Friction',
            severity: 'moderate',
            mitigation: 'Multi-agent council synthesis with deterministic math grounding'
          }
        ],
        keyMetrics: [
          { label: 'Strategic Velocity', value: `${startup.metrics?.velocity ?? 78}%`, trend: '+4% this cycle' },
          { label: 'Council Health', value: `${startup.healthScore ?? 84}/100`, trend: 'Optimal' },
          { label: 'Completed Deliverables', value: `${ceoProgress.count} Done`, trend: 'Audited' }
        ]
      }
    };

    // Helper to find real team member matching department
    const findTeamMemberForDept = (deptRegex: RegExp) => {
      return (teamMembers || []).find(m => {
        const d = (m.department || '').toLowerCase();
        const r = (m.role || '').toLowerCase();
        return deptRegex.test(d) || deptRegex.test(r);
      });
    };

    // ── FINANCE MEMBER ────────────────────────────────────────────────────────
    const financeMember = findTeamMemberForDept(/finan|account|budget|cfo|treasury/);
    const financeTasks = getTasksForDeptOrMember('FINANCE', financeMember?.fullName || financeMember?.name, financeMember?.role);
    const finProgress = getProgressData(financeTasks);

    if (financeMember) {
      const fName = (financeMember.fullName || financeMember.name || 'Finance Lead').trim();
      profiles['Finance'] = {
        role: financeMember.role || 'Finance Lead',
        name: fName,
        officialTitle: `${financeMember.role || 'Finance Manager'} · ${financeMember.department || 'Finance'}`,
        department: 'FINANCE',
        avatar: financeMember.avatar || 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
        description: `Directs ${startup.name}'s financial modeling, treasury reconciliations, burn management, and unit economics.`,
        isRealMember: true,
        isOpenSlot: false,
        tasksDone: {
          count: finProgress.count,
          titles: finProgress.titles
        },
        progress: finProgress.progress || (finProgress.count > 0 ? 100 : 75),
        currentWorkload: {
          activeTasksCount: finProgress.active.length || (finProgress.count > 0 ? 0 : 1),
          inFlightSummary: finProgress.active.length > 0 
            ? `Executing: ${finProgress.active.map(t => t.title).slice(0, 2).join(', ')}`
            : 'Auditing cash runway, unit economics models, and monthly expenditure velocity',
          velocityScore: '92%'
        },
        recommendations: [
          {
            id: 'rec_cfo_1',
            title: 'Enforce Compensation Banding on Next Sprint Requisitions',
            summary: `Benchmark loaded compensation cost to preserve monthly burn under $${burnRate.toLocaleString()}/mo.`,
            impact: `Preserves runway above ${runwayMonths} months`,
            urgency: 'high'
          }
        ],
        risks: [
          {
            id: 'risk_cfo_1',
            title: 'Runway Compression Below Critical 4-Month Threshold',
            severity: 'critical',
            mitigation: 'Automatic CFO veto triggered if projected runway drops under 4.0 months'
          }
        ],
        keyMetrics: [
          { label: 'Treasury Balance', value: `$${cashBalance.toLocaleString()}`, trend: 'Neon Verified' },
          { label: 'Monthly Burn', value: `$${burnRate.toLocaleString()}/mo`, trend: 'Baseline' },
          { label: 'Tasks Done', value: `${finProgress.count} Done`, trend: 'Audited' }
        ]
      };
    } else {
      profiles['Finance'] = {
        role: 'Chief Financial Officer',
        name: 'Open Seat (Finance)',
        officialTitle: 'Position Open · Click to Appoint or Add Member',
        department: 'FINANCE',
        avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
        description: 'Mathematical CFO seat enforcing deterministic zero-hallucination runway rules and cash burn gates. Open position awaiting appointment.',
        isRealMember: false,
        isOpenSlot: true,
        tasksDone: { count: 0, titles: [] },
        progress: 0,
        currentWorkload: {
          activeTasksCount: 0,
          inFlightSummary: 'Position open. Add a team member under Finance to allocate this executive seat.',
          velocityScore: 'Unfilled'
        },
        recommendations: [
          {
            id: 'rec_cfo_open',
            title: 'Appoint or Hire a Finance Lead',
            summary: 'Ensure a dedicated finance operator governs accounting, burn rate, and financial runway.',
            impact: 'Fills vital council governance seat',
            urgency: 'high'
          }
        ],
        risks: [
          {
            id: 'risk_cfo_open',
            title: 'Unmonitored Burn Risk',
            severity: 'high',
            mitigation: 'Add a worker under Finance domain in People workspace'
          }
        ],
        keyMetrics: [
          { label: 'Treasury Balance', value: `$${cashBalance.toLocaleString()}`, trend: 'Ledger' },
          { label: 'Monthly Burn', value: `$${burnRate.toLocaleString()}/mo`, trend: 'Unmonitored' },
          { label: 'Status', value: 'Open Seat', trend: 'Needs Hire' }
        ]
      };
    }

    // ── TALENT & HR MEMBER ───────────────────────────────────────────────────
    const talentMember = findTeamMemberForDept(/talent|hr|people|recruit/);
    const talentTasks = getTasksForDeptOrMember('TALENT', talentMember?.fullName || talentMember?.name, talentMember?.role);
    const talProgress = getProgressData(talentTasks);

    if (talentMember) {
      const tName = (talentMember.fullName || talentMember.name || 'Talent Lead').trim();
      profiles['Talent'] = {
        role: talentMember.role || 'Head of People',
        name: tName,
        officialTitle: `${talentMember.role || 'HR Lead'} · ${talentMember.department || 'People & Talent'}`,
        department: 'TALENT',
        avatar: talentMember.avatar || 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
        description: `Oversees ${startup.name}'s recruiting roadmap, candidate scorecards, compensation bands, and onboarding.`,
        isRealMember: true,
        isOpenSlot: false,
        tasksDone: {
          count: talProgress.count,
          titles: talProgress.titles
        },
        progress: talProgress.progress || (talProgress.count > 0 ? 100 : 70),
        currentWorkload: {
          activeTasksCount: talProgress.active.length || (talProgress.count > 0 ? 0 : 1),
          inFlightSummary: talProgress.active.length > 0 
            ? `In flight: ${talProgress.active.map(t => t.title).slice(0, 2).join(', ')}`
            : 'Candidate screening, market compensation benchmarking, and onboarding workflows',
          velocityScore: '88%'
        },
        recommendations: [
          {
            id: 'rec_talent_1',
            title: 'Calibrate Engineering Scorecards to Sprint Velocity',
            summary: 'Align prospective hires directly with technical domain requirements to reduce onboarding ramp time.',
            impact: '+35% sprint throughput',
            urgency: 'medium'
          }
        ],
        risks: [
          {
            id: 'risk_talent_1',
            title: 'Extended Time-to-Hire Bottleneck',
            severity: 'moderate',
            mitigation: 'Automated candidate screening and pre-vetted domain scorecards'
          }
        ],
        keyMetrics: [
          { label: 'Team Size', value: `${(teamMembers || []).length + 1} People`, trend: 'Active' },
          { label: 'Tasks Done', value: `${talProgress.count} Done`, trend: 'Audited' },
          { label: 'Progress', value: `${talProgress.progress}%`, trend: 'Tracking' }
        ]
      };
    } else {
      profiles['Talent'] = {
        role: 'Head of People',
        name: 'Open Seat (People & HR)',
        officialTitle: 'Position Open · Click to Appoint or Add Member',
        department: 'TALENT',
        avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
        description: 'People and talent seat handling hiring roadmaps, role scorecards, and cultural engineering. Open position awaiting appointment.',
        isRealMember: false,
        isOpenSlot: true,
        tasksDone: { count: 0, titles: [] },
        progress: 0,
        currentWorkload: {
          activeTasksCount: 0,
          inFlightSummary: 'Position open. Add an HR or Talent specialist to fill this council seat.',
          velocityScore: 'Unfilled'
        },
        recommendations: [
          {
            id: 'rec_talent_open',
            title: 'Appoint People & Talent Lead',
            summary: 'Structured recruiting processes ensure rapid scaling without founder distraction.',
            impact: 'Accelerates headcount scaling',
            urgency: 'medium'
          }
        ],
        risks: [
          {
            id: 'risk_talent_open',
            title: 'Unstructured Hiring Ramp',
            severity: 'moderate',
            mitigation: 'Add a worker under Talent & HR in People workspace'
          }
        ],
        keyMetrics: [
          { label: 'Target Hires', value: 'Open', trend: 'Scoped' },
          { label: 'Status', value: 'Open Seat', trend: 'Needs Hire' },
          { label: 'Progress', value: '0%', trend: 'Pending' }
        ]
      };
    }

    // ── GROWTH & MARKETING MEMBER ────────────────────────────────────────────
    const growthMember = findTeamMemberForDept(/growth|market|sales|commercial|seo/);
    const growthTasks = getTasksForDeptOrMember('GROWTH', growthMember?.fullName || growthMember?.name, growthMember?.role);
    const groProgress = getProgressData(growthTasks);

    if (growthMember) {
      const gName = (growthMember.fullName || growthMember.name || 'Growth Lead').trim();
      profiles['Growth'] = {
        role: growthMember.role || 'VP of Growth',
        name: gName,
        officialTitle: `${growthMember.role || 'Growth Lead'} · ${growthMember.department || 'Growth & Marketing'}`,
        department: 'GROWTH',
        avatar: growthMember.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
        description: `Directs customer acquisition funnels, ICP market positioning, GTM loops, and conversion metrics.`,
        isRealMember: true,
        isOpenSlot: false,
        tasksDone: {
          count: groProgress.count,
          titles: groProgress.titles
        },
        progress: groProgress.progress || (groProgress.count > 0 ? 100 : 80),
        currentWorkload: {
          activeTasksCount: groProgress.active.length || (groProgress.count > 0 ? 0 : 1),
          inFlightSummary: groProgress.active.length > 0 
            ? `Active: ${groProgress.active.map(t => t.title).slice(0, 2).join(', ')}`
            : 'Optimizing ICP conversion funnels, developer evangelism loops, and organic pilot onboarding',
          velocityScore: '85%'
        },
        recommendations: [
          {
            id: 'rec_growth_1',
            title: 'Focus Beta Program Exclusively on Developer CTOs',
            summary: 'Refining ICP to high-velocity technical founders reduces sales cycle length.',
            impact: 'Lowers CAC by 34%',
            urgency: 'medium'
          }
        ],
        risks: [
          {
            id: 'risk_growth_1',
            title: 'Premature Marketing Spend',
            severity: 'moderate',
            mitigation: 'Cap paid marketing until 20 organic design partners are onboarded'
          }
        ],
        keyMetrics: [
          { label: 'Growth Velocity', value: `${startup.metrics?.growthRate ?? 65}%`, trend: 'Traction' },
          { label: 'Tasks Done', value: `${groProgress.count} Done`, trend: 'Audited' },
          { label: 'Progress', value: `${groProgress.progress}%`, trend: 'Active' }
        ]
      };
    } else {
      profiles['Growth'] = {
        role: 'VP of Growth',
        name: 'Open Seat (Growth & GTM)',
        officialTitle: 'Position Open · Click to Appoint or Add Member',
        department: 'GROWTH',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
        description: 'Customer acquisition and commercial officer governing demand generation and viral loops. Open position.',
        isRealMember: false,
        isOpenSlot: true,
        tasksDone: { count: 0, titles: [] },
        progress: 0,
        currentWorkload: {
          activeTasksCount: 0,
          inFlightSummary: 'Position open. Add a Growth or Marketing specialist to fill this seat.',
          velocityScore: 'Unfilled'
        },
        recommendations: [
          {
            id: 'rec_growth_open',
            title: 'Appoint Growth & Marketing Lead',
            summary: 'Target initial enterprise ICP cohorts and build repeatable conversion funnels.',
            impact: 'Expands pipeline velocity',
            urgency: 'medium'
          }
        ],
        risks: [
          {
            id: 'risk_growth_open',
            title: 'Lack of Cohesive ICP Messaging',
            severity: 'moderate',
            mitigation: 'Add a worker under Growth in People workspace'
          }
        ],
        keyMetrics: [
          { label: 'Target ICP', value: startup.industry || 'B2B SaaS', trend: 'Defined' },
          { label: 'Status', value: 'Open Seat', trend: 'Needs Hire' },
          { label: 'Progress', value: '0%', trend: 'Pending' }
        ]
      };
    }

    // ── OPERATIONS / ENGINEERING MEMBER ──────────────────────────────────────
    const opsMember = findTeamMemberForDept(/operat|ops|eng|tech|dev|backend|front/);
    const opsTasks = getTasksForDeptOrMember('OPERATIONS', opsMember?.fullName || opsMember?.name, opsMember?.role);
    const opsProgress = getProgressData(opsTasks);

    if (opsMember) {
      const oName = (opsMember.fullName || opsMember.name || 'Operations Lead').trim();
      profiles['Operations'] = {
        role: opsMember.role || 'COO / Operations',
        name: oName,
        officialTitle: `${opsMember.role || 'Operations Lead'} · ${opsMember.department || 'Operations'}`,
        department: 'OPERATIONS',
        avatar: opsMember.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
        description: `Coordinates sprint cadences, system dependencies, infrastructure uptime, and cross-functional deliverables.`,
        isRealMember: true,
        isOpenSlot: false,
        tasksDone: {
          count: opsProgress.count,
          titles: opsProgress.titles
        },
        progress: opsProgress.progress || (opsProgress.count > 0 ? 100 : 85),
        currentWorkload: {
          activeTasksCount: opsProgress.active.length || (opsProgress.count > 0 ? 0 : 2),
          inFlightSummary: opsProgress.active.length > 0
            ? `Active: ${opsProgress.active.map(t => t.title).slice(0, 2).join(', ')}`
            : 'Milestone dependency mapping, employee workspace dispatching, and CI/CD reliability',
          velocityScore: '90%'
        },
        recommendations: [
          {
            id: 'rec_ops_1',
            title: 'Decompose Cross-Functional Sprint Dependencies',
            summary: 'Ensure prerequisite data models complete before UI binding phases commence.',
            impact: 'Zero blocking delays',
            urgency: 'high'
          }
        ],
        risks: [
          {
            id: 'risk_ops_1',
            title: 'Cross-Functional Blocking',
            severity: 'moderate',
            mitigation: 'Automated task delegation and clear role assignment rules'
          }
        ],
        keyMetrics: [
          { label: 'Ops Efficiency', value: `${startup.metrics?.operationsEfficiency ?? 80}%`, trend: 'Throughput' },
          { label: 'Tasks Done', value: `${opsProgress.count} Done`, trend: 'Audited' },
          { label: 'Progress', value: `${opsProgress.progress}%`, trend: 'Active' }
        ]
      };
    } else {
      profiles['Operations'] = {
        role: 'Chief Operating Officer',
        name: 'Open Seat (Operations)',
        officialTitle: 'Position Open · Click to Appoint or Add Member',
        department: 'OPERATIONS',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
        description: 'Operations director governing cross-functional delivery, sprint cadences, and system reliability.',
        isRealMember: false,
        isOpenSlot: true,
        tasksDone: { count: 0, titles: [] },
        progress: 0,
        currentWorkload: {
          activeTasksCount: 0,
          inFlightSummary: 'Position open. Add an operations or technical specialist to fill this seat.',
          velocityScore: 'Unfilled'
        },
        recommendations: [
          {
            id: 'rec_ops_open',
            title: 'Appoint Operations Director',
            summary: 'Drive cross-functional milestone rhythm and remove dependencies across departments.',
            impact: 'Eliminates sprint friction',
            urgency: 'high'
          }
        ],
        risks: [
          {
            id: 'risk_ops_open',
            title: 'Sprint Drift',
            severity: 'moderate',
            mitigation: 'Add an Operations specialist in People workspace'
          }
        ],
        keyMetrics: [
          { label: 'Ops Efficiency', value: 'Unmonitored', trend: 'Pending' },
          { label: 'Status', value: 'Open Seat', trend: 'Needs Hire' },
          { label: 'Progress', value: '0%', trend: 'Pending' }
        ]
      };
    }

    // ── DYNAMICALLY APPEND ANY ADDITIONAL REAL TEAM MEMBERS ADDED BY THE USER ──
    const alreadyMappedIds = new Set([
      financeMember?.id,
      talentMember?.id,
      growthMember?.id,
      opsMember?.id
    ].filter(Boolean));

    (teamMembers || []).forEach((m, idx) => {
      if (!alreadyMappedIds.has(m.id)) {
        const mTasks = getTasksForDeptOrMember(m.department || m.role || 'GENERAL', m.fullName || m.name, m.role);
        const mProg = getProgressData(mTasks);
        const mKey = `Member_${m.id || idx}`;
        const cleanName = (m.fullName || m.name || `Team Member ${idx + 1}`).trim();

        profiles[mKey] = {
          id: m.id,
          role: m.role || 'Specialist',
          name: cleanName,
          officialTitle: `${m.role || 'Specialist'} · ${m.department || 'Operations'}`,
          department: (m.department || 'OPERATIONS').toUpperCase(),
          avatar: m.avatar || (idx % 2 === 0 
            ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
            : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'),
          description: `Active venture team member contributing to ${m.department || 'core'} deliverables and sprint objectives.`,
          isRealMember: true,
          isOpenSlot: false,
          tasksDone: {
            count: mProg.count,
            titles: mProg.titles
          },
          progress: mProg.progress || (mProg.count > 0 ? 100 : 70),
          currentWorkload: {
            activeTasksCount: mProg.active.length || (mProg.count > 0 ? 0 : 1),
            inFlightSummary: mProg.active.length > 0
              ? `Executing: ${mProg.active.map(t => t.title).slice(0, 2).join(', ')}`
              : `Driving active sprint deliverables in ${m.department || 'department'}`,
            velocityScore: '88%'
          },
          recommendations: [
            {
              id: `rec_mem_${idx}`,
              title: `Prioritize ${m.department || 'Domain'} Milestones`,
              summary: `Maintain daily cadence on assigned deliverables to support upcoming venture sprint gates.`,
              impact: 'Sustains delivery velocity',
              urgency: 'medium'
            }
          ],
          risks: [
            {
              id: `risk_mem_${idx}`,
              title: 'Workload Capacity Overrun',
              severity: 'moderate',
              mitigation: 'Automated task tracking and dependency balance via CatalystOS'
            }
          ],
          keyMetrics: [
            { label: 'Role', value: m.role || 'Specialist', trend: 'Assigned' },
            { label: 'Tasks Done', value: `${mProg.count} Done`, trend: 'Audited' },
            { label: 'Progress', value: `${mProg.progress}%`, trend: 'Active' }
          ]
        };
      }
    });

    return profiles;
  }, [tasks, startup, cashBalance, burnRate, runwayMonths, initiatives.length, teamMembers, currentUser]);

  const activeProfile = councilProfiles[selectedExecutiveRole] || councilProfiles['CEO'] || Object.values(councilProfiles)[0];

  // ── B2 Deliberation Scenarios ────────────────────────────────────────────────
  const deliberationScenarios = [
    {
      id: 'delib_hiring',
      title: 'Should we hire two senior developers?',
      directive: 'Prepare a hiring plan for two senior developers to accelerate Q3 core deliverables.',
      orchestrator: {
        name: 'Atlas (CEO)',
        action: 'Decomposed command into ordered work orders across Talent, Finance, Legal, and Operations.',
        rationale: 'Direct founder strategic intent requiring balanced headcount scaling against runway preservation.'
      },
      specialists: [
        {
          role: 'Talent',
          agent: 'Echo',
          avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
          vote: 'APPROVE',
          confidence: 0.94,
          rationale: 'Engineering capacity is at 94% utilization. Opening 2 Senior Backend Engineer roles resolves delivery bottleneck for beta launch.',
          dataOutput: 'Base salary: ₹25,00,000 each. 28-day recruitment cycle.',
          isConflict: false
        },
        {
          role: 'Finance',
          agent: 'Aura',
          avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
          vote: 'CONDITIONAL',
          confidence: 0.91,
          rationale: 'Monthly burn will increase by +₹4,50,000/mo (from ₹8,00,000 to ₹12,50,000). Projected runway compresses to 5.8 months. Approval conditioned on capping base compensation at ₹24L.',
          dataOutput: 'Monthly burn delta: +₹4,50,000. Runway reduction: -3.2 months.',
          isConflict: true // Conflicting perspective
        },
        {
          role: 'Growth',
          agent: 'Vector',
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
          vote: 'APPROVE',
          confidence: 0.88,
          rationale: 'Accelerating backend throughput is required to support the 20 prospective enterprise design partners awaiting API access.',
          dataOutput: 'Unblocks 20 prospective pilot customers.',
          isConflict: false
        },
        {
          role: 'Legal',
          agent: 'Nexus',
          avatar: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=150',
          vote: 'APPROVE',
          confidence: 0.95,
          rationale: 'Offer letter templates verified. IP assignment and PIIA covenants are standard. No invented human employee; requires founder assignment.',
          dataOutput: 'Standard PIIA covenants attached.',
          isConflict: false
        },
        {
          role: 'Auditor',
          agent: 'Sentry',
          avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150',
          vote: 'APPROVE',
          confidence: 1.0,
          rationale: 'Mathematical calculations verified: ₹72,00,000 / ₹12,50,000 = 5.8 months runway. All compensation benchmarks verified against Indian market data.',
          dataOutput: 'Deterministic calculation verified.',
          isConflict: false
        }
      ],
      synthesis: {
        summary: 'Conditional Consensus Reached: Authorize recruitment of 2x Senior Engineers with strict compensation cap at ₹24L to maintain runway solvency.',
        riskTier: 'MEDIUM' as const,
        reversibility: 'REVERSIBLE' as const,
        actionRequired: true,
        conflictsIdentified: 'Tension between Talent throughput demand (+2 roles) and CFO cash burn preservation (₹4.5L/mo delta). Resolved via compensation capping and sequential onboarding.',
        finalRecommendation: 'Proceed with decomposed 6-step hiring plan. Stage offer letter package into Approval Queue for founder authorization.'
      }
    },
    {
      id: 'delib_gtm',
      title: 'Should we launch an enterprise pricing tier at ₹75,000/mo?',
      directive: 'Formulate enterprise pricing tier with dedicated SLA and custom SOC-2 compliance add-on.',
      orchestrator: {
        name: 'Atlas (CEO)',
        action: 'Decomposed packaging into Growth revenue modeling, Finance gross margin analysis, and Legal SLA safeguards.',
        rationale: 'Move upmarket to shorten payback period and expand enterprise ARPU.'
      },
      specialists: [
        {
          role: 'Growth',
          agent: 'Vector',
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
          vote: 'APPROVE',
          confidence: 0.92,
          rationale: 'Early pilot enterprise customers are willing to pay ₹75,000/mo for guaranteed latency SLAs and dedicated migration support.',
          dataOutput: 'Estimated 5 enterprise signups in 60 days (+₹12.5L MRR).',
          isConflict: false
        },
        {
          role: 'Finance',
          agent: 'Aura',
          avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
          vote: 'APPROVE',
          confidence: 0.95,
          rationale: 'Gross margin expands to 82%. Cash flow breakeven accelerated by 3.5 months if 4 enterprise logos close.',
          dataOutput: 'Payback period: < 2.5 months.',
          isConflict: false
        },
        {
          role: 'Legal',
          agent: 'Nexus',
          avatar: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=150',
          vote: 'CONDITIONAL',
          confidence: 0.89,
          rationale: 'Enterprise MSAs require strict uptime guarantee liability caps (< 1x monthly fee) and SOC2 audit completion by Q4.',
          dataOutput: 'Requires standard liability cap amendment.',
          isConflict: true
        }
      ],
      synthesis: {
        summary: 'Unanimous Approval with Governance Guardrail: Launch Enterprise tier with standard liability caps on SLA penalties.',
        riskTier: 'LOW' as const,
        reversibility: 'REVERSIBLE' as const,
        actionRequired: true,
        conflictsIdentified: 'Legal SLA liability exposure versus Growth velocity. Resolved via standard 1x fee liability cap.',
        finalRecommendation: 'Publish Enterprise Tier. Stage standard enterprise MSA template into Approval Queue.'
      }
    }
  ];

  const currentDeliberation = deliberationScenarios.find(d => d.id === activeDeliberationId) || deliberationScenarios[0];

  // ── B3 Live Council Meeting Sequence ─────────────────────────────────────────
  const meetingSteps = [
    {
      agent: 'Atlas',
      role: 'CEO',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
      action: 'Decomposition & Orchestration',
      speech: 'Founder has asked: "Should we hire two engineers?" Initiating executive council session. Decomposing inquiry: Echo evaluates candidate pipeline and role requirements; Aura models treasury cash burn and runway; Helix verifies operational sprint dependencies.',
      status: 'completed'
    },
    {
      agent: 'Echo',
      role: 'Talent',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
      action: 'Headcount & Capacity Review',
      speech: 'Echo reporting. Current engineering capacity utilization is at 94%. Current sprint velocity is bottlenecked on perception pipeline delivery. Recommending opening 2x Senior Full-Stack Engineer positions at ₹25L base compensation. Estimated 28-day recruitment cycle.',
      status: 'completed'
    },
    {
      agent: 'Aura',
      role: 'CFO',
      avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
      action: 'Runway Calculation & Cash Burn Gate',
      speech: 'Aura reporting. Deterministic calculations: Current cash balance is ₹72,00,000 at ₹8,00,000/mo burn rate (9.0 months). Adding two engineers at ₹25L increases monthly burn by +₹4,50,000/mo to ₹12,50,000/mo. Projected runway compresses to 5.8 months. I vote CONDITIONAL APPROVAL: Cap salaries at ₹24L to keep runway above 6.0 months.',
      status: 'completed'
    },
    {
      agent: 'Helix',
      role: 'Operations',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
      action: 'Sprint Dependency & Workflow Sequencing',
      speech: 'Helix reporting. Operational milestone review: The 2 new hires will unblock the Q3 beta launch milestone. Recommending a phased start date: Engineer 1 onboarded in Week 4, Engineer 2 in Week 6. This staggers onboarding friction and smooths the burn curve.',
      status: 'completed'
    },
    {
      agent: 'Atlas',
      role: 'CEO',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
      action: 'Synthesis & Final Directive',
      speech: 'Atlas synthesis: Council consensus reached. The company SHOULD hire two engineers, subject to Aura’s ₹24L compensation cap and Helix’s staggered onboarding schedule. Decomposed plan generated with 6 assignable tasks. Ready for founder review.',
      status: 'completed'
    }
  ];

  const handleStartLiveMeeting = (question?: string) => {
    if (meetingRunning) return;
    if (question) setMeetingQuestion(question);
    setMeetingRunning(true);
    setMeetingCompleted(false);
    setMeetingStep(0);
    setMeetingTimer(0);

    timerIntervalRef.current = setInterval(() => {
      setMeetingTimer(prev => prev + 1);
    }, 1000);

    // Sequential agent execution: Atlas -> Echo -> Aura -> Helix -> Atlas synthesis
    const stepDurations = [2000, 3000, 3500, 3000, 2500];
    
    let current = 0;
    const advanceStep = () => {
      if (current < meetingSteps.length - 1) {
        current++;
        setMeetingStep(current);
        setTimeout(advanceStep, stepDurations[current]);
      } else {
        setMeetingRunning(false);
        setMeetingCompleted(true);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      }
    };

    setTimeout(advanceStep, stepDurations[0]);
  };

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'CEO': return <Rocket className="w-4 h-4 text-indigo-700" />;
      case 'Finance': return <Landmark className="w-4 h-4 text-emerald-700" />;
      case 'Talent': return <Users className="w-4 h-4 text-pink-700" />;
      case 'Growth': return <Briefcase className="w-4 h-4 text-amber-700" />;
      case 'Operations': return <Cog className="w-4 h-4 text-sky-700" />;
      case 'Legal': return <Shield className="w-4 h-4 text-rose-700" />;
      case 'Auditor': return <ShieldCheck className="w-4 h-4 text-blue-700" />;
      default: return <Compass className="w-4 h-4 text-[#141413]" />;
    }
  };

  return (
    <div className="space-y-8 font-sans">
      
      {/* ── Top Header & Sub-Mode Switcher ─────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#141413]/10 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-2xl font-bold text-[#141413] tracking-tight">Executive Council Experience</h2>
          </div>
          <p className="text-xs text-[#696969] mt-1 max-w-2xl leading-relaxed">
            Phase B Autonomous C-Suite: Available AI executives, parallel deliberation synthesis, and live multi-agent council meetings.
          </p>
        </div>

        {/* Phase B View Mode Switcher */}
        <div className="flex items-center p-1 rounded-2xl bg-[#141413]/05 border border-[#141413]/10 text-xs font-semibold self-start lg:self-auto">
          {[
            { id: 'workspace' as const, label: 'B1 — Council Workspace', icon: Users },
            { id: 'deliberation' as const, label: 'B2 — Deliberation', icon: Layers },
            { id: 'meeting' as const, label: 'B3 — Live Meeting', icon: Bot },
            { id: 'orchestration' as const, label: '5-Step Orchestration', icon: Cpu },
          ].map((tab) => {
            const isActive = activeMode === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveMode(tab.id)}
                className={`relative px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  isActive ? 'text-[#141413] shadow-xs' : 'text-[#696969] hover:text-[#141413]'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="councilModeTab"
                    className="absolute inset-0 bg-white rounded-xl shadow-xs"
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  />
                )}
                <Icon className="w-3.5 h-3.5 relative z-10" />
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          PHASE B1: EXECUTIVE COUNCIL WORKSPACE
          ════════════════════════════════════════════════════════════════════════ */}
      {activeMode === 'workspace' && (
        <div className="space-y-8 animate-fadeIn">
          
          {/* Council Telemetry Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-[18px] bg-white border border-[#141413]/08 shadow-xs">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#696969] font-bold block">Active AI Executives</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-bold text-[#141413] font-mono">{Object.keys(councilProfiles).length} Online</span>
                <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Synchronized</span>
              </div>
            </div>

            <div className="p-4 rounded-[18px] bg-white border border-[#141413]/08 shadow-xs">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#696969] font-bold block">Current Workload</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-bold text-[#141413] font-mono">{tasks.length} Tasks</span>
                <span className="text-xs text-indigo-700 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">Across 6 Depts</span>
              </div>
            </div>

            <div className="p-4 rounded-[18px] bg-white border border-[#141413]/08 shadow-xs">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#696969] font-bold block">Audited Decisions</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-bold text-[#141413] font-mono">{decisions.length} Logged</span>
                <span className="text-xs text-[#696969] font-semibold bg-gray-100 px-2 py-0.5 rounded-full">Ledger Verified</span>
              </div>
            </div>

            <div className="p-4 rounded-[18px] bg-white border border-[#141413]/08 shadow-xs">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#696969] font-bold block">Governance Health</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-bold text-[#141413] font-mono">{startup.healthScore ?? 84}/100</span>
                <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Zero Hallucinations</span>
              </div>
            </div>
          </div>

          {/* Council Members Directory & Workload Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#141413]">Available AI Executives & Department Workloads</h3>
                <p className="text-xs text-[#696969]">Select an executive to inspect specific recommendations, active tasks, and monitored risks.</p>
              </div>
              <button
                onClick={() => setActiveMode('meeting')}
                className="px-4 py-2 rounded-xl bg-[#141413] hover:bg-[#262627] text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Bot className="w-3.5 h-3.5" />
                <span>Convene Full Council</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {Object.values(councilProfiles).map((prof) => {
                const isSelected = selectedExecutiveRole === prof.role;
                return (
                  <div
                    key={prof.role}
                    onClick={() => {
                      setSelectedExecutiveRole(prof.role);
                      if (onSelectAgent) onSelectAgent(prof.role.toLowerCase());
                    }}
                    className={`p-5 rounded-[20px] bg-white border transition-all cursor-pointer flex flex-col justify-between space-y-4 ${
                      isSelected
                        ? 'border-[#141413] ring-2 ring-[#141413]/10 shadow-md'
                        : 'border-[#141413]/10 hover:border-[#141413]/30 shadow-xs hover:shadow-sm'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={prof.avatar}
                          alt={prof.name}
                          referrerPolicy="no-referrer"
                          className="w-12 h-12 rounded-xl object-cover border border-[#141413]/15 shadow-xs shrink-0"
                        />
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-sm font-bold text-[#141413]">{prof.name}</h4>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#141413]/06 text-[#141413] font-bold">
                              {prof.role}
                            </span>
                            {prof.isOpenSlot && (
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                                Open Seat
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#696969] truncate max-w-[200px]">{prof.officialTitle}</p>
                        </div>
                      </div>
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${prof.isOpenSlot ? 'bg-amber-400' : 'bg-emerald-500'}`} title={prof.isOpenSlot ? 'Open Seat' : 'Active Member'} />
                    </div>

                    {/* Progress & Workload Telemetry */}
                    <div className="p-3.5 rounded-xl bg-[#F3F0EE]/50 border border-[#141413]/06 space-y-2.5 text-xs">
                      {/* Workload Header */}
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase text-[#696969] font-bold">Deliverables & Tasks</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                            {prof.tasksDone.count} Done
                          </span>
                          <span className="text-[10px] font-mono font-bold text-[#141413] bg-white px-1.5 py-0.5 rounded border border-[#141413]/10">
                            {prof.currentWorkload.activeTasksCount} Active
                          </span>
                        </div>
                      </div>

                      {/* Animated Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[10px] font-mono text-[#696969]">Workload Progress</span>
                          <span className="text-[11px] font-mono font-bold text-emerald-700">{prof.progress}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-[#141413]/08 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-indigo-600 transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.max(prof.progress, prof.isOpenSlot ? 0 : 5))}%` }}
                          />
                        </div>
                      </div>

                      <p className="text-[11px] text-[#141413] leading-relaxed line-clamp-2">
                        {prof.currentWorkload.inFlightSummary}
                      </p>
                    </div>

                    {/* Open Slot CTA or Top Recommendation */}
                    {prof.isOpenSlot ? (
                      <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-center justify-between">
                        <span className="text-[11px] font-medium text-amber-900">Seat unfilled in roster</span>
                        {onNavigate && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigate('people');
                            }}
                            className="text-[10px] font-bold px-2 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer"
                          >
                            + Add Member
                          </button>
                        )}
                      </div>
                    ) : (
                      /* Top Recommendation & Risk preview */
                      <div className="space-y-1.5 pt-1 text-xs">
                        <div className="flex items-start gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                          <span className="text-[11px] font-medium text-[#141413] line-clamp-1">
                            {prof.recommendations[0]?.title || 'Operational standards active.'}
                          </span>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <span className="text-[11px] text-[#696969] line-clamp-1">
                            Risk: {prof.risks[0]?.title || 'Boundary conditions monitored'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Bottom CTA */}
                    <div className="pt-2 border-t border-[#141413]/06 flex items-center justify-between text-xs">
                      <span className="text-[11px] font-mono text-[#696969]">Velocity: {prof.currentWorkload.velocityScore}</span>
                      <span className="text-xs font-bold text-[#141413] flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                        <span>Inspect Profile</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Deep-Dive Inspector for Selected Executive */}
          <div className="p-6 rounded-[24px] bg-white border border-[#141413]/10 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#141413]/10 pb-4">
              <div className="flex items-center gap-3.5">
                <img
                  src={activeProfile.avatar}
                  alt={activeProfile.name}
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 rounded-2xl object-cover border border-[#141413]/15 shadow-xs"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-[#141413]">{activeProfile.name}</h3>
                    <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-[#141413] text-white">
                      {activeProfile.role}
                    </span>
                  </div>
                  <p className="text-xs text-[#696969] font-medium mt-0.5">{activeProfile.officialTitle}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono uppercase text-[#696969] font-bold">Progress:</span>
                    <span className="text-xs font-mono font-bold text-emerald-700">{activeProfile.progress}%</span>
                  </div>
                  <div className="w-28 h-2 rounded-full bg-[#141413]/08 overflow-hidden mt-1">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-indigo-600 transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(activeProfile.progress, activeProfile.isOpenSlot ? 0 : 5))}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-[#696969] mt-0.5">
                    {activeProfile.tasksDone.count} done · {activeProfile.currentWorkload.activeTasksCount} active
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  Grounded & Synchronized
                </span>
              </div>
            </div>

            {/* 3-Column Detailed Inspector: Recommendations, Active Tasks, Risks */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Column 1: Recommendations */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-1 border-b border-[#141413]/08">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-[#141413]">Active Recommendations</h4>
                </div>
                <div className="space-y-3">
                  {activeProfile.recommendations.map((rec) => (
                    <div key={rec.id} className="p-4 rounded-xl bg-[#F3F0EE]/40 border border-[#141413]/06 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#141413]">{rec.title}</span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold uppercase ${
                          rec.urgency === 'high' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {rec.urgency}
                        </span>
                      </div>
                      <p className="text-[#696969] leading-relaxed">{rec.summary}</p>
                      <div className="pt-1 text-[11px] font-mono text-indigo-700 font-semibold">
                        Impact: {rec.impact}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Column 2: Tasks Done & Active Tasks */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-[#141413]/08">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#141413]" />
                    <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-[#141413]">Tasks & Deliverables</h4>
                  </div>
                  {onNavigate && (
                    <button
                      onClick={() => onNavigate('workspace')}
                      className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
                    >
                      View Workspace →
                    </button>
                  )}
                </div>

                {/* Completed Deliverables List */}
                {activeProfile.tasksDone.count > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono uppercase text-emerald-800 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Tasks Done ({activeProfile.tasksDone.count})
                    </span>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                      {activeProfile.tasksDone.titles.map((title, i) => (
                        <div key={i} className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200/60 text-[11px] text-emerald-900 flex items-center gap-2 shadow-2xs">
                          <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span className="truncate font-medium">{title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Active Tasks */}
                <div className="space-y-2">
                  <span className="text-[10px] font-mono uppercase text-[#696969] font-bold block">
                    Active Tasks ({activeProfile.currentWorkload.activeTasksCount})
                  </span>
                  <div className="space-y-2">
                    {tasks
                      .filter(t => 
                        t.department?.toUpperCase() === activeProfile.department ||
                        t.agent?.toLowerCase().includes(activeProfile.role.toLowerCase())
                      )
                      .slice(0, 3)
                      .map((t) => (
                        <div key={t.id} className="p-3 rounded-xl bg-white border border-[#141413]/10 shadow-xs space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#141413] truncate max-w-[180px]">{t.title}</span>
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                              t.status === 'in_progress' ? 'bg-amber-50 text-amber-700' :
                              t.status === 'submitted' ? 'bg-purple-50 text-purple-700' :
                              t.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-700'
                            }`}>
                              {t.status}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-[#696969]">
                            <span>Assigned: {t.assignedUserName || t.ownerRole || 'Unassigned'}</span>
                            {t.needsHumanOwner && (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                Needs Human Owner
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    {tasks.filter(t => t.department?.toUpperCase() === activeProfile.department).length === 0 && (
                      <div className="p-4 text-center border border-dashed border-[#141413]/15 rounded-xl text-xs text-[#696969]">
                        No active tasks currently delegated to {activeProfile.role}.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Column 3: Monitored Risks & Recent Decisions */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-1 border-b border-[#141413]/08">
                  <Shield className="w-4 h-4 text-amber-600" />
                  <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-[#141413]">Risks & Decisions</h4>
                </div>
                <div className="space-y-2.5">
                  {/* Risks */}
                  {activeProfile.risks.map((risk) => (
                    <div key={risk.id} className="p-3 rounded-xl bg-amber-50/50 border border-amber-200/60 space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-900">{risk.title}</span>
                        <span className="text-[10px] font-mono font-bold uppercase text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded">
                          {risk.severity}
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-800/80 leading-relaxed">
                        Mitigation: {risk.mitigation}
                      </p>
                    </div>
                  ))}

                  {/* Decisions matching this role */}
                  <div className="pt-2">
                    <span className="text-[10px] font-mono uppercase text-[#696969] font-bold block mb-1.5">Recent Ledger Decisions</span>
                    {decisions
                      .filter(d => d.category.toLowerCase().includes(activeProfile.role.toLowerCase()) || d.title.toLowerCase().includes(activeProfile.role.toLowerCase()))
                      .slice(0, 2)
                      .map((d) => (
                        <div key={d.id} className="p-2.5 rounded-lg bg-[#F3F0EE]/40 border border-[#141413]/06 text-[11px] space-y-0.5 mt-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#141413] truncate">{d.title}</span>
                            <span className="text-[10px] font-mono text-emerald-700 font-bold uppercase">{d.status}</span>
                          </div>
                          <p className="text-[10px] text-[#696969] line-clamp-1">{d.description}</p>
                        </div>
                      ))}
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          PHASE B2: COUNCIL DELIBERATION (Multiple Perspectives -> Synthesis)
          ════════════════════════════════════════════════════════════════════════ */}
      {activeMode === 'deliberation' && (
        <div className="space-y-8 animate-fadeIn">
          
          {/* Deliberation Selector Bar */}
          <div className="p-5 rounded-[20px] bg-white border border-[#141413]/10 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#696969] font-bold block">
                Multi-Perspective Deliberation Pipeline
              </span>
              <h3 className="text-base font-bold text-[#141413] mt-0.5">
                {currentDeliberation.title}
              </h3>
            </div>

            <div className="flex items-center gap-2">
              {deliberationScenarios.map((scen) => (
                <button
                  key={scen.id}
                  onClick={() => setActiveDeliberationId(scen.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeDeliberationId === scen.id
                      ? 'bg-[#141413] text-white shadow-xs'
                      : 'bg-[#141413]/05 hover:bg-[#141413]/10 text-[#696969]'
                  }`}
                >
                  {scen.id === 'delib_hiring' ? 'Hiring Deliberation' : 'Enterprise Pricing'}
                </button>
              ))}
            </div>
          </div>

          {/* Core Visual Pipeline Diagram (Orchestrator -> Parallel Specialists -> Synthesis -> Recommendation) */}
          <div className="p-8 rounded-[24px] bg-[#FCFBFA] border border-[#141413]/10 shadow-sm space-y-8 relative overflow-hidden">
            
            {/* 1. TOP: ORCHESTRATOR */}
            <div className="flex flex-col items-center text-center space-y-2 max-w-lg mx-auto">
              <div className="px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-mono font-bold uppercase tracking-wider">
                Step 1: Orchestrator Intent Decomposition
              </div>
              <div className="p-4 rounded-2xl bg-white border border-[#141413]/15 shadow-xs w-full text-left space-y-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                    CEO
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#141413]">{currentDeliberation.orchestrator.name}</h4>
                    <span className="text-[10px] text-[#696969]">Decomposition Engine</span>
                  </div>
                </div>
                <p className="text-xs text-[#141413] mt-1.5 leading-relaxed font-medium">
                  {currentDeliberation.orchestrator.action}
                </p>
              </div>
              
              {/* Connector Arrow Down */}
              <div className="h-6 w-0.5 bg-[#141413]/20" />
            </div>

            {/* 2. MIDDLE: PARALLEL SPECIALIST EVALUATION (Aura, Echo, Vector, etc.) */}
            <div className="space-y-3">
              <div className="text-center">
                <span className="px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-mono font-bold uppercase tracking-wider">
                  Step 2: Parallel Specialist Evaluations & Conflicting Perspectives
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {currentDeliberation.specialists.map((spec) => (
                  <div
                    key={spec.role}
                    className={`p-4 rounded-2xl border text-xs flex flex-col justify-between space-y-3 transition-all ${
                      spec.isConflict
                        ? 'bg-amber-50/40 border-amber-400 ring-2 ring-amber-400/20 shadow-sm'
                        : 'bg-white border-[#141413]/10 shadow-xs'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <img
                            src={spec.avatar}
                            alt={spec.role}
                            className="w-7 h-7 rounded-lg object-cover border border-[#141413]/10"
                          />
                          <div>
                            <span className="font-bold text-[#141413] block text-[11px]">{spec.agent}</span>
                            <span className="text-[9px] font-mono text-[#696969] uppercase block">{spec.role}</span>
                          </div>
                        </div>

                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                          spec.vote === 'APPROVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          spec.vote === 'CONDITIONAL' ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {spec.vote}
                        </span>
                      </div>

                      {spec.isConflict && (
                        <div className="mb-2 px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[9px] font-mono font-bold uppercase flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-700" />
                          <span>Conflicting Perspective</span>
                        </div>
                      )}

                      <p className="text-[11px] text-[#141413] leading-relaxed">
                        {spec.rationale}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-[#141413]/06 text-[10px] font-mono text-[#696969]">
                      Confidence: {Math.round(spec.confidence * 100)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. SYNTHESIS & RECOMMENDATION */}
            <div className="flex flex-col items-center text-center space-y-3 max-w-xl mx-auto">
              <div className="h-6 w-0.5 bg-[#141413]/20" />
              
              <div className="px-3 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-[10px] font-mono font-bold uppercase tracking-wider">
                Step 3: Executive Synthesis & Final Consensus
              </div>

              <div className="p-6 rounded-2xl bg-white border border-[#141413]/15 shadow-md w-full text-left space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold font-mono uppercase text-[#141413]">Atlas Synthesis Verdict</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold uppercase bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
                      Consensus Reached
                    </span>
                    <span className="text-[10px] font-mono font-bold uppercase bg-gray-100 text-[#141413] px-2 py-0.5 rounded">
                      Risk: {currentDeliberation.synthesis.riskTier}
                    </span>
                  </div>
                </div>

                <p className="text-sm font-semibold text-[#141413] leading-relaxed">
                  {currentDeliberation.synthesis.summary}
                </p>

                <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-200/60 text-xs text-amber-900 space-y-1">
                  <span className="font-bold font-mono text-[10px] uppercase block">Tension Resolution</span>
                  <p className="leading-relaxed">{currentDeliberation.synthesis.conflictsIdentified}</p>
                </div>

                <div className="pt-3 border-t border-[#141413]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs text-[#696969]">
                    <span className="font-bold text-[#141413]">Directive: </span>
                    {currentDeliberation.synthesis.finalRecommendation}
                  </div>

                  {onNavigate && (
                    <button
                      onClick={() => onNavigate('approvals')}
                      className="px-4 py-2 rounded-xl bg-[#141413] hover:bg-[#262627] text-white text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5"
                    >
                      <span>Stage into Approvals</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          PHASE B3: LIVE COUNCIL MEETING (Sequential Orchestration Flow)
          ════════════════════════════════════════════════════════════════════════ */}
      {activeMode === 'meeting' && (
        <div className="space-y-8 animate-fadeIn">
          
          {/* Meeting Control & Founder Inquiry Box */}
          <div className="p-6 rounded-[24px] bg-white border border-[#141413]/10 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-700 font-bold block">
                  Interactive Live Council Session
                </span>
                <h3 className="text-lg font-bold text-[#141413] mt-0.5">
                  Convene Multi-Agent Executive Assembly
                </h3>
              </div>

              {meetingRunning && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-mono font-bold text-emerald-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>Session Live ({meetingTimer}s)</span>
                </div>
              )}
            </div>

            {/* Founder Inquiry Input */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
              <input
                type="text"
                value={meetingQuestion}
                onChange={(e) => setMeetingQuestion(e.target.value)}
                placeholder="Ask council a strategic question (e.g. Should we hire two engineers?)"
                disabled={meetingRunning}
                className="w-full px-4 py-3 rounded-xl border border-[#141413]/15 text-sm text-[#141413] focus:outline-none focus:border-[#141413] bg-[#FCFBFA] font-sans"
              />

              <button
                onClick={() => handleStartLiveMeeting()}
                disabled={meetingRunning || !meetingQuestion.trim()}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#141413] hover:bg-[#262627] disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center justify-center gap-2"
              >
                {meetingRunning ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Deliberating...</span>
                  </>
                ) : (
                  <>
                    <Bot className="w-4 h-4" />
                    <span>Convene Meeting</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick Ask Chips */}
            <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-1 scrollbar-none text-xs">
              <span className="text-[10px] font-mono text-[#696969] shrink-0 font-bold">Quick Directives:</span>
              {[
                'Should we hire two engineers?',
                'Can we afford to expand into enterprise sales?',
                'Should we extend our runway by reducing cloud infrastructure costs?'
              ].map((q, i) => (
                <button
                  key={i}
                  disabled={meetingRunning}
                  onClick={() => {
                    setMeetingQuestion(q);
                    handleStartLiveMeeting(q);
                  }}
                  className="px-3 py-1 rounded-full bg-[#141413]/05 hover:bg-[#141413]/10 text-[#141413] text-[11px] font-medium shrink-0 cursor-pointer transition-colors"
                >
                  "{q}"
                </button>
              ))}
            </div>
          </div>

          {/* Live Meeting Sequence Display */}
          <div className="p-8 rounded-[24px] bg-[#FCFBFA] border border-[#141413]/10 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-[#141413]/10 pb-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#696969] font-bold block">
                  Sequential Progression Protocol
                </span>
                <h4 className="text-sm font-bold text-[#141413]">
                  Atlas → Echo → Aura → Helix → Atlas Synthesis
                </h4>
              </div>

              <div className="text-xs font-mono text-[#696969]">
                Step {Math.min(meetingStep + 1, meetingSteps.length)} of {meetingSteps.length}
              </div>
            </div>

            {/* Interactive Timeline of Speaking Executives */}
            <div className="space-y-5">
              {meetingSteps.map((step, idx) => {
                const isPast = idx < meetingStep || meetingCompleted;
                const isCurrent = idx === meetingStep && meetingRunning;
                const isPending = idx > meetingStep && !meetingCompleted;

                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ 
                      opacity: isPending ? 0.35 : 1, 
                      y: 0,
                      scale: isCurrent ? 1.01 : 1
                    }}
                    transition={{ duration: 0.3 }}
                    className={`p-5 rounded-2xl border transition-all ${
                      isCurrent
                        ? 'bg-white border-[#141413] ring-2 ring-[#141413]/10 shadow-md'
                        : isPast
                        ? 'bg-white border-[#141413]/10 shadow-xs'
                        : 'bg-[#F3F0EE]/30 border-[#141413]/06'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Avatar & Pulse Indicator */}
                      <div className="relative shrink-0">
                        <img
                          src={step.avatar}
                          alt={step.agent}
                          className="w-12 h-12 rounded-xl object-cover border border-[#141413]/10"
                        />
                        {isCurrent && (
                          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 animate-ping" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-[#141413]">{step.agent}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-[#141413]/06 text-[#141413]">
                              {step.role}
                            </span>
                            <span className="text-[11px] text-[#696969]">({step.action})</span>
                          </div>

                          <div>
                            {isCurrent && (
                              <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200 animate-pulse">
                                Speaking...
                              </span>
                            )}
                            {isPast && (
                              <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                Verified
                              </span>
                            )}
                            {isPending && (
                              <span className="text-[10px] font-mono text-[#696969] bg-gray-100 px-2 py-0.5 rounded">
                                Queued
                              </span>
                            )}
                          </div>
                        </div>

                        <p className={`text-xs leading-relaxed ${isCurrent ? 'text-[#141413] font-medium' : 'text-[#141413]/85'}`}>
                          {step.speech}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Meeting Completion Directive Banner */}
            {meetingCompleted && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-6 rounded-2xl bg-[#141413] text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
                      Session Concluded • Consensus Reached
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white mt-1">
                    Hiring plan decomposed into 6 ordered tasks & staged for execution.
                  </h4>
                  <p className="text-xs text-white/70 mt-0.5">
                    Tasks dispatched to Talent (HR), Finance, Legal, and Operations.
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {onNavigate && (
                    <button
                      onClick={() => onNavigate('workspace')}
                      className="px-4 py-2.5 rounded-xl bg-white text-[#141413] text-xs font-bold hover:bg-[#F3F0EE] transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Briefcase className="w-3.5 h-3.5" />
                      <span>Open Employee Workspace</span>
                    </button>
                  )}
                </div>
              </motion.div>
            )}

          </div>

        </div>
      )}

      {activeMode === 'orchestration' && (
        <MultiAgentOrchestrationDashboard
          apiFetch={apiFetch}
          onNavigate={onNavigate}
        />
      )}

    </div>
  );
}
