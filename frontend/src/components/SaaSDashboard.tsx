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
  CompanyInvitation,
  TeamMember
} from '../types';
import {
  TrendingUp, TrendingDown, Clock, ArrowRight,
  Sparkles, CheckSquare, Activity,
  Wallet, ChevronRight, Users, Scale,
  Briefcase, Check, ShieldCheck, AlertCircle,
  FileText, ExternalLink, Layers, Loader2,
  BookOpen, UploadCloud, Database, Target,
  Shield, ChevronDown, SlidersHorizontal, X,
  Plus, Radio, Mic, Send, Bot, AlertTriangle, ArrowUpRight,
  RotateCcw, UserCheck, RefreshCw, GitBranch, CheckCircle2,
  Download, Paperclip, Calendar, User, MessageSquare, History, CornerDownRight, Eye
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
  teamMembers?: TeamMember[];
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
  teamMembers = [],
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
  const { sendMessage, messages, isTyping, cancelRun } = useChat(apiFetch, user?.id, 'orchestrate');

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

  // Phase 2: Create & Decompose Task Modal States
  const [isTaskDecomposeOpen, setIsTaskDecomposeOpen] = useState(false);
  const [parentTaskTitle, setParentTaskTitle] = useState('');
  const [parentTaskDesc, setParentTaskDesc] = useState('');
  const [parentTaskPriority, setParentTaskPriority] = useState<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('HIGH');
  const [parentTaskDeadline, setParentTaskDeadline] = useState(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [isDecomposing, setIsDecomposing] = useState(false);
  const [decompositionPreview, setDecompositionPreview] = useState<any | null>(null);
  const [subtaskAssignments, setSubtaskAssignments] = useState<Record<string, string>>({});
  const [isPersistingDecomposition, setIsPersistingDecomposition] = useState(false);

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

  // Helper to check if a task is overdue
  const isTaskOverdue = (t: DelegatedTask) => {
    if (t.status === 'approved' || (t.status as string) === 'completed' || t.status === 'rejected') return false;
    const deadlineStr = t.dueDate || t.deadline;
    if (!deadlineStr) return false;
    const d = new Date(deadlineStr);
    if (isNaN(d.getTime())) return false;
    return d.getTime() < Date.now();
  };

  // Phase 6: Founder 7 Views
  type FounderTaskView = 'ALL' | 'ASSIGNED' | 'IN_PROGRESS' | 'PENDING_REVIEW' | 'CHANGES_REQUESTED' | 'COMPLETED' | 'OVERDUE';
  const [taskSectionFilter, setTaskSectionFilter] = useState<FounderTaskView>('ALL');
  const [isAssigningTaskId, setIsAssigningTaskId] = useState<string | null>(null);

  // Founder Task Navigation & Review Drawer State (Phase 6)
  const [selectedFounderTaskId, setSelectedFounderTaskId] = useState<string | null>(null);
  const [founderTaskDetail, setFounderTaskDetail] = useState<DelegatedTask | null>(null);
  const [loadingFounderTaskDetail, setLoadingFounderTaskDetail] = useState<boolean>(false);
  const [founderTaskDocuments, setFounderTaskDocuments] = useState<Array<{ id: string; name: string; size: string; type: string; createdAt: string }>>([]);
  const [founderTaskActivities, setFounderTaskActivities] = useState<Array<{ id: string; action: string; actorRole?: string; actorName?: string; details?: any; timestamp: string }>>([]);
  const [founderTaskProgress, setFounderTaskProgress] = useState<Array<{ id: string; note: string; authorName: string; authorRole: string; createdAt: string }>>([]);

  // Review actions state
  const [isRequestChangesModalOpen, setIsRequestChangesModalOpen] = useState<boolean>(false);
  const [changesFeedbackText, setChangesFeedbackText] = useState<string>('');
  const [isProcessingTaskReview, setIsProcessingTaskReview] = useState<boolean>(false);
  const [reviewActionError, setReviewActionError] = useState<string | null>(null);
  const [reviewActionSuccess, setReviewActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedFounderTaskId) {
      setFounderTaskDetail(null);
      setFounderTaskDocuments([]);
      setFounderTaskActivities([]);
      setFounderTaskProgress([]);
      setReviewActionError(null);
      setReviewActionSuccess(null);
      return;
    }

    const loadTaskData = async () => {
      try {
        setLoadingFounderTaskDetail(true);
        const res = await apiFetch(`/api/tasks/${selectedFounderTaskId}`);
        if (res.ok) {
          const data: DelegatedTask = await res.json();
          setFounderTaskDetail(data);
          if (Array.isArray(data.documents)) setFounderTaskDocuments(data.documents);
          if (Array.isArray(data.progressUpdates)) setFounderTaskProgress(data.progressUpdates as any);
        }

        try {
          const docRes = await apiFetch(`/api/tasks/${selectedFounderTaskId}/documents`);
          if (docRes.ok) {
            const docs = await docRes.json();
            if (Array.isArray(docs)) setFounderTaskDocuments(docs);
          }
        } catch {}

        try {
          const actRes = await apiFetch(`/api/tasks/${selectedFounderTaskId}/activity`);
          if (actRes.ok) {
            const acts = await actRes.json();
            if (Array.isArray(acts)) setFounderTaskActivities(acts);
          }
        } catch {}

        try {
          const progRes = await apiFetch(`/api/tasks/${selectedFounderTaskId}/progress`);
          if (progRes.ok) {
            const progs = await progRes.json();
            if (Array.isArray(progs)) setFounderTaskProgress(progs);
          }
        } catch {}
      } catch (err) {
        console.warn('Error loading founder task detail:', err);
      } finally {
        setLoadingFounderTaskDetail(false);
      }
    };

    loadTaskData();
  }, [selectedFounderTaskId]);

  const handleApproveTask = async () => {
    if (!founderTaskDetail) return;
    setReviewActionError(null);
    setReviewActionSuccess(null);

    // Self-approval guard: An employee must not be able to approve their own submission
    const isSelfAssigned = founderTaskDetail.assignedUserId === user?.id;
    const isEmployee = (user?.role || '').toUpperCase() === 'EMPLOYEE';
    if (isSelfAssigned && isEmployee) {
      setReviewActionError('Self-approval forbidden: An employee cannot approve their own submission.');
      return;
    }

    try {
      setIsProcessingTaskReview(true);
      const res = await apiFetch(`/api/tasks/${founderTaskDetail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' })
      });

      if (res.ok) {
        setFounderTaskDetail(prev => prev ? { ...prev, status: 'approved' } : null);
        setReviewActionSuccess('Task approved! Deliverable transitioned to COMPLETED and employee notified.');
        if (onRefreshTasks) await onRefreshTasks();
      } else {
        const errData = await res.json().catch(() => null);
        setReviewActionError(errData?.error || 'Failed to approve task.');
      }
    } catch {
      setReviewActionError('Network error approving task.');
    } finally {
      setIsProcessingTaskReview(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!founderTaskDetail) return;
    const feedback = changesFeedbackText.trim();
    if (!feedback) {
      setReviewActionError('Feedback is required when requesting revisions or changes.');
      return;
    }

    try {
      setIsProcessingTaskReview(true);
      const res = await apiFetch(`/api/tasks/${founderTaskDetail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'changes_requested',
          founderFeedback: feedback
        })
      });

      if (res.ok) {
        setFounderTaskDetail(prev => prev ? { ...prev, status: 'changes_requested', founderFeedback: feedback, changesRequested: true } : null);
        setIsRequestChangesModalOpen(false);
        setChangesFeedbackText('');
        setReviewActionSuccess('Revisions requested. Feedback returned to employee.');
        if (onRefreshTasks) await onRefreshTasks();
      } else {
        const errData = await res.json().catch(() => null);
        setReviewActionError(errData?.error || 'Failed to request changes.');
      }
    } catch {
      setReviewActionError('Network error requesting changes.');
    } finally {
      setIsProcessingTaskReview(false);
    }
  };

  const handleDownloadFounderDocument = async (docId: string, filename: string) => {
    if (!founderTaskDetail) return;
    try {
      const res = await apiFetch(`/api/tasks/${founderTaskDetail.id}/documents/${docId}/download`);
      if (res.ok) {
        const data = await res.json();
        if (data.downloadUrl) {
          const a = document.createElement('a');
          a.href = data.downloadUrl;
          a.download = data.filename || filename;
          a.target = '_blank';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      }
    } catch (err) {
      console.warn('Error downloading document:', err);
    }
  };

  const assignableMemberList = useMemo(() => {
    const map = new Map<string, { id: string; name: string; role: string; department?: string }>();
    teamMembers.forEach(m => {
      const id = m.linkedUserId || m.id;
      if (id && !map.has(id)) {
        map.set(id, { id, name: m.fullName || m.name || m.email, role: m.role || 'Member', department: m.department });
      }
    });
    memberships.forEach(m => {
      const id = m.userId || m.id;
      if (id && !map.has(id)) {
        map.set(id, { id, name: (m as any).user?.name || (m as any).user?.email || m.userId, role: m.role || 'Member', department: (m as any).department });
      }
    });
    return Array.from(map.values());
  }, [teamMembers, memberships]);

  const filteredDashboardTasks = useMemo(() => {
    return tasks.filter(t => {
      if (taskSectionFilter === 'ASSIGNED') return Boolean(t.assignedUserId);
      if (taskSectionFilter === 'IN_PROGRESS') return t.status === 'in_progress';
      if (taskSectionFilter === 'PENDING_REVIEW') return t.status === 'submitted';
      if (taskSectionFilter === 'CHANGES_REQUESTED') return t.status === 'changes_requested' || Boolean(t.changesRequested);
      if (taskSectionFilter === 'COMPLETED') return t.status === 'approved' || (t.status as string) === 'completed';
      if (taskSectionFilter === 'OVERDUE') return isTaskOverdue(t);
      return true; // 'ALL'
    });
  }, [tasks, taskSectionFilter]);

  const handleAssignTask = async (taskId: string, assigneeId: string) => {
    try {
      setIsAssigningTaskId(taskId);
      const res = await apiFetch(`/api/tasks/${taskId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigneeId: assigneeId || null })
      });
      if (res.ok) {
        if (onRefreshTasks) await onRefreshTasks();
      }
    } catch (err) {
      console.warn('Error assigning task:', err);
    } finally {
      setIsAssigningTaskId(null);
    }
  };

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

  // Phase 2: Multi-Agent Task Decomposition & Persistence Handlers
  const handleDecomposeTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentTaskTitle.trim() || isDecomposing) return;
    setIsDecomposing(true);
    try {
      const res = await apiFetch('/api/tasks/decompose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: parentTaskTitle.trim(),
          description: parentTaskDesc.trim(),
          priority: parentTaskPriority,
          deadline: parentTaskDeadline
        })
      });
      if (res.ok) {
        const preview = await res.json();
        setDecompositionPreview(preview);
        const initialMap: Record<string, string> = {};
        for (const st of preview.proposedSubtasks || []) {
          if (st.assignedUserId) {
            initialMap[st.id] = st.assignedUserId;
          }
        }
        setSubtaskAssignments(initialMap);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to decompose task.');
      }
    } catch (err: any) {
      alert('Error connecting to multi-agent council: ' + err.message);
    } finally {
      setIsDecomposing(false);
    }
  };

  const handleApproveAndPersistDecomposition = async () => {
    if (!decompositionPreview || isPersistingDecomposition) return;
    setIsPersistingDecomposition(true);
    try {
      const payload = {
        parentTask: decompositionPreview.parentTask,
        subtasks: decompositionPreview.proposedSubtasks.map((st: any) => ({
          title: st.title,
          description: st.description,
          department: st.department,
          agent: st.agent,
          suggestedRole: st.suggestedRole,
          priority: st.priority,
          dependencies: st.dependencies,
          expectedDeliverable: st.expectedDeliverable,
          deadline: st.deadline,
          assignedUserId: subtaskAssignments[st.id] || null
        }))
      };

      const res = await apiFetch('/api/tasks/create-decomposed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setIsTaskDecomposeOpen(false);
        setDecompositionPreview(null);
        setParentTaskTitle('');
        setParentTaskDesc('');
        if (onRefreshTasks) {
          await onRefreshTasks();
        }
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to persist task decomposition.');
      }
    } catch (err: any) {
      alert('Failed to persist task decomposition: ' + err.message);
    } finally {
      setIsPersistingDecomposition(false);
    }
  };

  return (
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
            onClick={() => {
              setDecompositionPreview(null);
              setIsTaskDecomposeOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold transition-colors shadow-xs cursor-pointer"
          >
            <GitBranch className="w-3.5 h-3.5 text-indigo-600" />
            <span>Delegate Task</span>
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

            <div 
              onClick={() => {
                const el = document.getElementById('founder-task-delegation-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
                else onNavigate?.('workspace');
              }}
              className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-indigo-50/40 hover:border-indigo-200 transition-colors flex items-center justify-between cursor-pointer group"
            >
              <div>
                <div className="text-xs font-semibold text-slate-900 group-hover:text-indigo-600 flex items-center gap-1.5">
                  <span>Executive Task Delegation</span>
                  <ArrowRight className="w-3 h-3 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
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

      {/* ── 5.5 Section: Delegated Work Orders & Team Execution ────────────── */}
      <div id="founder-task-delegation-section" className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-semibold text-slate-900">Delegated Work Orders &amp; Team Execution</h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-100">
                {tasks.length} Total
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Multi-agent council task decompositions, human employee assignments, deliverable execution, and approval gates.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => {
                setDecompositionPreview(null);
                setIsTaskDecomposeOpen(true);
              }}
              className="px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>+ Decompose &amp; Delegate</span>
            </button>
            {onRefreshTasks && (
              <button
                onClick={onRefreshTasks}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
                title="Refresh Task Telemetry"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
            {onNavigate && (
              <button
                onClick={() => onNavigate('workspace')}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>Open Employee Workspace</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'ALL', label: 'All Tasks', count: tasks.length },
              { id: 'ASSIGNED', label: 'Assigned Tasks', count: tasks.filter(t => Boolean(t.assignedUserId)).length, badgeColor: 'bg-indigo-100 text-indigo-800' },
              { id: 'IN_PROGRESS', label: 'In Progress', count: tasks.filter(t => t.status === 'in_progress').length, badgeColor: 'bg-blue-100 text-blue-800' },
              { id: 'PENDING_REVIEW', label: 'Pending Review', count: tasks.filter(t => t.status === 'submitted').length, badgeColor: 'bg-purple-100 text-purple-800' },
              { id: 'CHANGES_REQUESTED', label: 'Changes Requested', count: tasks.filter(t => t.status === 'changes_requested' || t.changesRequested).length, badgeColor: 'bg-rose-100 text-rose-800' },
              { id: 'COMPLETED', label: 'Completed', count: tasks.filter(t => t.status === 'approved' || (t.status as string) === 'completed').length, badgeColor: 'bg-emerald-100 text-emerald-800' },
              { id: 'OVERDUE', label: 'Overdue', count: tasks.filter(t => isTaskOverdue(t)).length, badgeColor: 'bg-amber-100 text-amber-800' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setTaskSectionFilter(tab.id as any)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
                  taskSectionFilter === tab.id
                    ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100 border border-slate-200/80 bg-white'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  taskSectionFilter === tab.id 
                    ? 'bg-slate-800 text-white' 
                    : (tab.badgeColor || 'bg-slate-100 text-slate-700')
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {unassignedTasks.length > 0 && (
            <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>{unassignedTasks.length} task{unassignedTasks.length > 1 ? 's' : ''} require employee assignment</span>
            </div>
          )}
        </div>

        {/* Task Cards & Table */}
        {filteredDashboardTasks.length > 0 ? (
          <div className="space-y-2.5 pt-1">
            {filteredDashboardTasks.map(task => {
              const cleanTitle = task.title.replace(/^\[.*?\]\s*/, '');
              const isSubmitted = task.status === 'submitted';
              const isApproved = task.status === 'approved';
              const isRevision = task.status === 'changes_requested' || Boolean(task.changesRequested);
              const isInProgress = task.status === 'in_progress';
              const isAssigningThis = isAssigningTaskId === task.id;

              return (
                <div
                  key={task.id}
                  className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3.5"
                >
                  <div 
                    onClick={() => setSelectedFounderTaskId(task.id)}
                    className="min-w-0 space-y-1.5 flex-1 cursor-pointer group"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {task.department || 'GENERAL'}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Agent: <strong className="text-slate-700">{task.agent || 'AI Specialist'}</strong>
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        isApproved ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        isRevision ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        isSubmitted ? 'bg-purple-50 text-purple-700 border-purple-200' :
                        isInProgress ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {isApproved ? 'Approved' : isRevision ? 'Revision Required' : isSubmitted ? 'Awaiting Review' : isInProgress ? 'In Progress' : 'Unassigned'}
                      </span>
                      {isTaskOverdue(task) && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          <span>Overdue</span>
                        </span>
                      )}
                    </div>

                    <h4 className="text-xs font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
                      {cleanTitle}
                    </h4>

                    {task.result && (
                      <p className="text-[11px] text-slate-500 line-clamp-1 italic bg-slate-50 px-2 py-1 rounded border border-slate-100">
                        "{task.result.slice(0, 140)}..."
                      </p>
                    )}

                    {task.founderFeedback && (
                      <div className="text-[11px] text-amber-800 bg-amber-50/80 px-2.5 py-1 rounded border border-amber-200 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span><strong>Founder Directive:</strong> "{task.founderFeedback}"</span>
                      </div>
                    )}
                  </div>

                  {/* Middle Column: Assignee Selector */}
                  <div className="flex items-center gap-2 shrink-0 self-start md:self-auto min-w-[220px]">
                    <div className="w-full space-y-1">
                      <div className="text-[10px] font-mono uppercase text-slate-400">Assigned Employee</div>
                      <div className="relative">
                        <select
                          disabled={isAssigningThis}
                          value={task.assignedUserId || ''}
                          onChange={(e) => handleAssignTask(task.id, e.target.value)}
                          className="w-full text-xs py-1.5 pl-2.5 pr-7 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer disabled:opacity-50"
                        >
                          <option value="">-- Unassigned (Needs Owner) --</option>
                          {assignableMemberList.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.role})
                            </option>
                          ))}
                        </select>
                        {isAssigningThis ? (
                          <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin absolute right-2.5 top-2.5 pointer-events-none" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                    <button
                      onClick={() => setSelectedFounderTaskId(task.id)}
                      className="px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Open &amp; Review</span>
                    </button>

                    {isSubmitted && onNavigate && (
                      <button
                        onClick={() => onNavigate('approvals')}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                        title="View in Executive Approvals"
                      >
                        <Shield className="w-3.5 h-3.5" />
                        <span className="hidden xl:inline">Approvals</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 rounded-xl border border-dashed border-slate-200 text-center space-y-2">
            <CheckSquare className="w-8 h-8 text-slate-400 mx-auto" />
            <div className="text-xs font-semibold text-slate-700">No work orders matching filter "{taskSectionFilter}"</div>
            <p className="text-[11px] text-slate-500 max-w-md mx-auto">
              Run a strategic executive directive with Sophia Vance above or launch a Strategic Initiative to auto-decompose cross-functional work orders.
            </p>
          </div>
        )}

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Continuous employee delegation with companion AI verification</span>
          {onNavigate && (
            <button
              onClick={() => onNavigate('workspace')}
              className="text-indigo-600 font-medium hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Employee OS Command</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
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

      {/* ── 9.5 Phase 2: Create & Decompose Task Modal ────────────────────── */}
      {isTaskDecomposeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                  <GitBranch className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {decompositionPreview ? 'Founder Review — Proposed Task Decomposition' : 'Create & Decompose Strategic Task'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {decompositionPreview
                      ? 'Review AI subtask breakdown, dependencies, and employee assignments before persisting.'
                      : 'Define parent objective. The Multi-Agent Council will formulate subtasks and resolve roles.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsTaskDecomposeOpen(false);
                  setDecompositionPreview(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* STEP 1: DEFINE PARENT TASK */}
            {!decompositionPreview ? (
              <form onSubmit={handleDecomposeTask} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Parent Task Objective <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={parentTaskTitle}
                    onChange={(e) => setParentTaskTitle(e.target.value)}
                    placeholder="e.g. Implement Enterprise SSO, SOC-2 Audit Readiness, and Role Scoping"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Operational Scope &amp; Deliverables
                  </label>
                  <textarea
                    rows={3}
                    value={parentTaskDesc}
                    onChange={(e) => setParentTaskDesc(e.target.value)}
                    placeholder="Specify target deliverables, operational constraints, budget expectations, and cross-functional expectations..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs leading-relaxed"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Priority Tier</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setParentTaskPriority(p)}
                          className={`py-1.5 text-center font-bold text-[10px] rounded-lg border transition-all cursor-pointer ${
                            parentTaskPriority === p
                              ? p === 'CRITICAL' ? 'bg-rose-600 text-white border-rose-600 shadow-2xs' :
                                p === 'HIGH' ? 'bg-amber-600 text-white border-amber-600 shadow-2xs' :
                                p === 'LOW' ? 'bg-slate-700 text-white border-slate-700 shadow-2xs' :
                                'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Target Completion Deadline</label>
                    <input
                      type="date"
                      value={parentTaskDeadline}
                      onChange={(e) => setParentTaskDeadline(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsTaskDecomposeOpen(false)}
                    className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors font-medium cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isDecomposing}
                    className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                  >
                    {isDecomposing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Council Decomposing Plan &amp; Resolving Roles...</span>
                      </>
                    ) : (
                      <>
                        <span>Decompose with Multi-Agent Council</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* STEP 2: REVIEW & APPROVE PROPOSED SUBTASKS & ASSIGNMENTS */
              <div className="space-y-4 text-xs">
                {/* Parent Task Banner */}
                <div className="p-3.5 rounded-xl border border-indigo-100 bg-indigo-50/50 flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 font-mono">
                      Parent Objective
                    </span>
                    <h4 className="text-sm font-bold text-slate-900">{decompositionPreview.parentTask.title}</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      decompositionPreview.parentTask.priority === 'CRITICAL' ? 'bg-rose-100 text-rose-800 border-rose-300' :
                      decompositionPreview.parentTask.priority === 'HIGH' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                      'bg-indigo-100 text-indigo-800 border-indigo-200'
                    }`}>
                      {decompositionPreview.parentTask.priority}
                    </span>
                    <span className="text-xs text-slate-600 font-mono">
                      Deadline: {decompositionPreview.parentTask.deadline}
                    </span>
                  </div>
                </div>

                {/* Proposed Subtasks List */}
                <div className="space-y-3 max-h-[46vh] overflow-y-auto pr-1">
                  {decompositionPreview.proposedSubtasks.map((st: any, idx: number) => {
                    const assignedMemberId = subtaskAssignments[st.id] || '';
                    const needsAttention = st.needsAttention && !assignedMemberId;

                    return (
                      <div
                        key={st.id}
                        className={`p-4 rounded-xl border transition-all space-y-3 ${
                          needsAttention ? 'border-amber-200 bg-amber-50/20' : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-bold">
                                Step {st.stepNumber || idx + 1}
                              </span>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                {st.department}
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="text-[10px] text-indigo-600 font-semibold">
                                AI Co-Pilot: {st.agent}
                              </span>
                              {st.dependencies?.length > 0 && (
                                <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                                  Depends on: {st.dependencies.join(', ')}
                                </span>
                              )}
                            </div>

                            <h4 className="text-xs font-bold text-slate-900">{st.title}</h4>
                            <p className="text-[11px] text-slate-600 leading-relaxed">{st.description}</p>
                          </div>

                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase shrink-0 border ${
                            st.priority === 'CRITICAL' ? 'bg-rose-100 text-rose-800 border-rose-300' :
                            st.priority === 'HIGH' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                            'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                            {st.priority}
                          </span>
                        </div>

                        {/* Deliverable expectation */}
                        {st.expectedDeliverable && (
                          <div className="text-[11px] text-indigo-700 bg-indigo-50/70 px-3 py-1.5 rounded-lg border border-indigo-100 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            <span><strong>Deliverable:</strong> {st.expectedDeliverable}</span>
                          </div>
                        )}

                        {/* Assignee Resolution & Attention Banner */}
                        <div className="pt-2 border-t border-slate-100 space-y-2">
                          {needsAttention && (
                            <div className="text-[11px] text-amber-800 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200 flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span><strong>Needs Attention:</strong> {st.reason || 'No employee in company has this role. Select an assignee or leave for founder.'}</span>
                            </div>
                          )}

                          <div className="flex items-center justify-between gap-3">
                            <div className="text-[11px] font-semibold text-slate-700">
                              Assigned Team Member:
                            </div>
                            <select
                              value={assignedMemberId}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSubtaskAssignments(prev => ({ ...prev, [st.id]: val }));
                              }}
                              className="text-xs py-1 px-2.5 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer min-w-[220px]"
                            >
                              <option value="">-- Needs Owner (Unassigned) --</option>
                              {decompositionPreview.companyMembers?.map((m: any) => (
                                <option key={m.id} value={m.id}>
                                  {m.name} ({m.role})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer Review Controls */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setDecompositionPreview(null)}
                    className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors font-medium cursor-pointer"
                  >
                    ← Back to Edit Directive
                  </button>

                  <button
                    type="button"
                    disabled={isPersistingDecomposition}
                    onClick={handleApproveAndPersistDecomposition}
                    className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                  >
                    {isPersistingDecomposition ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Persisting Tasks &amp; Alerting Team...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve &amp; Persist Delegation ({decompositionPreview.proposedSubtasks?.length || 0} Subtasks)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PHASE 6: FOUNDER TASK DETAIL & REVIEW DRAWER ─────────────────────── */}
      {selectedFounderTaskId && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex justify-end z-50 transition-all">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="min-w-0 flex-1 mr-4">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                    {founderTaskDetail?.department || 'GENERAL'}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    founderTaskDetail?.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    founderTaskDetail?.status === 'changes_requested' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                    founderTaskDetail?.status === 'submitted' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                    founderTaskDetail?.status === 'in_progress' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    'bg-slate-100 text-slate-700 border-slate-200'
                  }`}>
                    {founderTaskDetail?.status ? founderTaskDetail.status.replace(/_/g, ' ') : 'Loading...'}
                  </span>
                  {founderTaskDetail && isTaskOverdue(founderTaskDetail) && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-rose-600" />
                      <span>Overdue</span>
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-slate-900 truncate">
                  {founderTaskDetail ? founderTaskDetail.title.replace(/^\[.*?\]\s*/, '') : 'Task Inspection'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedFounderTaskId(null)}
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notification / Toast Banner inside Drawer */}
            {reviewActionSuccess && (
              <div className="p-3 bg-emerald-50 border-b border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{reviewActionSuccess}</span>
                </div>
                <button onClick={() => setReviewActionSuccess(null)} className="cursor-pointer">
                  <X className="w-3.5 h-3.5 text-emerald-600" />
                </button>
              </div>
            )}
            {reviewActionError && (
              <div className="p-3 bg-rose-50 border-b border-rose-200 text-xs font-semibold text-rose-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>{reviewActionError}</span>
                </div>
                <button onClick={() => setReviewActionError(null)} className="cursor-pointer">
                  <X className="w-3.5 h-3.5 text-rose-600" />
                </button>
              </div>
            )}

            {/* Drawer Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loadingFounderTaskDetail ? (
                <div className="p-12 text-center space-y-3">
                  <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                  <p className="text-xs text-slate-500">Loading task data, subtasks &amp; documents...</p>
                </div>
              ) : founderTaskDetail ? (
                <>
                  {/* Founder Directive banner if changes were requested */}
                  {founderTaskDetail.founderFeedback && (
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        <span>Founder Revision Directive</span>
                      </div>
                      <p className="italic pl-5.5">"{founderTaskDetail.founderFeedback}"</p>
                    </div>
                  )}

                  {/* 1. Task Metadata, Assignee & Deadline Card */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-3 border-b border-slate-200/80">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                          Current Assignee
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">
                            {(founderTaskDetail.assignedUserName || founderTaskDetail.assignedUserId || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-slate-800 block">
                              {founderTaskDetail.assignedUserName || (founderTaskDetail.assignedUserId ? 'Assigned Member' : 'Unassigned (Needs Owner)')}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              Role: {founderTaskDetail.ownerRole || 'General'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                          Status &amp; Deadline
                        </span>
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>Deadline: <strong>{founderTaskDetail.dueDate || founderTaskDetail.deadline || 'No hard deadline'}</strong></span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            Priority: <strong className={founderTaskDetail.priority === 'CRITICAL' ? 'text-rose-600 font-bold' : founderTaskDetail.priority === 'HIGH' ? 'text-amber-600 font-bold' : 'text-slate-700'}>{founderTaskDetail.priority || 'MEDIUM'}</strong>
                          </div>
                        </div>
                      </div>
                    </div>

                    {founderTaskDetail.description && (
                      <div className="text-xs text-slate-600">
                        <span className="font-semibold text-slate-800">Task Scope: </span>
                        <span>{founderTaskDetail.description}</span>
                      </div>
                    )}

                    {founderTaskDetail.expectedDeliverable && (
                      <div className="text-xs text-indigo-800 bg-indigo-50/70 p-2.5 rounded-lg border border-indigo-100">
                        <span className="font-bold flex items-center gap-1.5 mb-1">
                          <FileText className="w-3.5 h-3.5" />
                          <span>Expected Deliverable:</span>
                        </span>
                        <p className="leading-relaxed">{founderTaskDetail.expectedDeliverable}</p>
                      </div>
                    )}
                  </div>

                  {/* 2. Parent Task & Subtasks Breakdown */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Parent Task &amp; Subtasks</span>
                      </h4>
                      <span className="text-[10px] font-mono text-slate-400">
                        Plan ID: {founderTaskDetail.planId || founderTaskDetail.parentTaskId || 'N/A'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Parent Operating Plan</span>
                      <span className="font-semibold text-slate-800">{founderTaskDetail.parentTask || 'Core Operating Plan'}</span>
                    </div>

                    {founderTaskDetail.subtasks && founderTaskDetail.subtasks.length > 0 ? (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Related Work Orders ({founderTaskDetail.subtasks.length})
                        </span>
                        {founderTaskDetail.subtasks.map((st: any) => (
                          <div
                            key={st.id}
                            onClick={() => setSelectedFounderTaskId(st.id)}
                            className="p-2.5 rounded-lg bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all text-xs flex items-center justify-between cursor-pointer group"
                          >
                            <div className="min-w-0 pr-2">
                              <span className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors truncate block">
                                {st.title.replace(/^\[.*?\]\s*/, '')}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {st.department} • {st.assignedUserName || 'Unassigned'}
                              </span>
                            </div>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                              st.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                              st.status === 'changes_requested' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                              st.status === 'submitted' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                              st.status === 'in_progress' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              'bg-slate-100 text-slate-700 border-slate-200'
                            }`}>
                              {st.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No sibling subtasks found in this plan.</p>
                    )}
                  </div>

                  {/* 3. Employee Submission Notes / Deliverable */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Submission Notes &amp; Work Output</span>
                      </h4>
                      {founderTaskDetail.status === 'submitted' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                          Awaiting Founder Review
                        </span>
                      )}
                    </div>

                    {founderTaskDetail.result ? (
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                        {founderTaskDetail.result}
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400 italic">
                        No deliverable or submission notes recorded yet.
                      </div>
                    )}
                  </div>

                  {/* 4. Submitted Supporting Documents */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Paperclip className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Submitted Documents ({founderTaskDocuments.length})</span>
                      </h4>
                    </div>

                    {founderTaskDocuments.length === 0 ? (
                      <div className="p-3 rounded-lg border border-dashed border-slate-200 text-center text-xs text-slate-400 italic">
                        No supporting files attached.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {founderTaskDocuments.map(doc => (
                          <div key={doc.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                              <div className="min-w-0">
                                <span className="font-semibold text-slate-800 truncate block">{doc.name}</span>
                                <span className="text-[10px] text-slate-400 font-mono">{doc.size} • {new Date(doc.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDownloadFounderDocument(doc.id, doc.name)}
                              className="px-2.5 py-1 text-slate-700 bg-white hover:bg-slate-100 rounded-md transition-colors flex items-center gap-1 text-[11px] font-semibold border border-slate-200 cursor-pointer shadow-2xs"
                              title="Secure download"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Download</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 5. Progress Notes & Comments */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Progress Notes &amp; Comments ({founderTaskProgress.length})</span>
                    </h4>

                    {founderTaskProgress.length === 0 ? (
                      <div className="p-3 text-center border border-dashed border-slate-200 rounded-lg text-slate-400 text-xs italic">
                        No employee progress logs recorded yet.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {founderTaskProgress.map((p, idx) => (
                          <div key={p.id || idx} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs space-y-1">
                            <div className="font-semibold text-slate-800">{p.note}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {p.authorName} ({p.authorRole}) • {new Date(p.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 6. Relevant Task Activity History */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Task Activity History</span>
                    </h4>

                    {founderTaskActivities.length === 0 ? (
                      <div className="p-3 text-center border border-dashed border-slate-200 rounded-lg text-slate-400 text-xs italic">
                        No activity records found for this task.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {founderTaskActivities.map((act, idx) => (
                          <div key={act.id || idx} className="p-2.5 rounded-lg bg-slate-50/80 border border-slate-100 text-xs flex items-start gap-2.5">
                            <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <span className="font-semibold text-slate-800">{act.action?.replace(/_/g, ' ')}</span>
                              {act.details?.note && (
                                <p className="text-[11px] text-slate-600 mt-0.5 italic">"{act.details.note}"</p>
                              )}
                              {act.details?.documentName && (
                                <p className="text-[11px] text-slate-600 mt-0.5">Uploaded file: <strong>{act.details.documentName}</strong> ({act.details.size})</p>
                              )}
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                {act.actorRole || 'SYSTEM'} • {new Date(act.timestamp).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            {/* Drawer Footer: Review Actions */}
            {founderTaskDetail && (
              <div className="p-4 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between gap-3">
                <div className="text-xs text-slate-500">
                  {founderTaskDetail.status === 'approved' ? (
                    <span className="font-semibold text-emerald-700 flex items-center gap-1">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>Completed &amp; Approved</span>
                    </span>
                  ) : (
                    <span>Review Deliverable &amp; Decision</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    disabled={isProcessingTaskReview}
                    onClick={() => setIsRequestChangesModalOpen(true)}
                    className="px-3.5 py-2 rounded-lg text-xs font-semibold text-rose-700 bg-white hover:bg-rose-50 border border-rose-300 transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <CornerDownRight className="w-3.5 h-3.5 text-rose-600" />
                    <span>Request Changes</span>
                  </button>

                  <button
                    disabled={isProcessingTaskReview || founderTaskDetail.status === 'approved'}
                    onClick={handleApproveTask}
                    className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isProcessingTaskReview ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>Approve (Mark Completed)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PHASE 6: REQUEST CHANGES FEEDBACK MODAL ───────────────────────── */}
      {isRequestChangesModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                <AlertCircle className="w-5 h-5 text-rose-600" />
                <span>Request Task Changes</span>
              </div>
              <button onClick={() => setIsRequestChangesModalOpen(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Please specify the required adjustments, missing sections, or feedback. The assigned employee will be notified immediately.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleRequestChanges();
              }}
              className="space-y-3"
            >
              <textarea
                rows={4}
                required
                value={changesFeedbackText}
                onChange={(e) => setChangesFeedbackText(e.target.value)}
                placeholder="E.g., Please clarify how the CAC payback horizon handles blended channel attribution..."
                className="w-full p-3 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRequestChangesModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessingTaskReview || !changesFeedbackText.trim()}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isProcessingTaskReview ? 'Submitting...' : 'Send Directive'}
                </button>
              </div>
            </form>
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
