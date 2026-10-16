/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { DelegatedTask, TaskBlocker, TaskProgressUpdate } from '../../types';
import {
  CheckSquare, Search, Filter, AlertTriangle, Clock,
  CheckCircle2, Send, FileText, ArrowRight, BookOpen,
  User, Shield, ChevronRight, X, AlertCircle, Copy, Check,
  RotateCcw, MessageSquare, ExternalLink, Calendar,
  LayoutGrid, List, UserPlus, Play, CheckCircle, Flag,
  Sparkles, Plus, AlertOctagon, CornerDownRight, Layers,
  Paperclip, UploadCloud, Download
} from 'lucide-react';

interface WorkspaceMyWorkProps {
  tasks: DelegatedTask[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string | null) => void;
  accessibleDocuments?: Array<{
    id: string;
    name: string;
    type: string;
    summary: string;
    category?: string;
  }>;
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onRefreshTasks?: () => Promise<void>;
  userName?: string;
  userRole?: string;
}

export type WorkViewType = 'LIST' | 'BOARD' | 'CALENDAR' | 'REVIEW';

export default function WorkspaceMyWork({
  tasks,
  selectedTaskId,
  onSelectTask,
  accessibleDocuments = [],
  apiFetch,
  onRefreshTasks,
  userName = 'Team Member',
  userRole = 'Member'
}: WorkspaceMyWorkProps) {
  // ── Work View Switcher (Section 5.A) ──────────────────────────────────────────
  const [currentView, setCurrentView] = useState<WorkViewType>('LIST');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // ── Task Execution & Detail Drawer State ─────────────────────────────────────
  const [editorText, setEditorText] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [statusNotification, setStatusNotification] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Blocker state
  const [isBlockerModalOpen, setIsBlockerModalOpen] = useState<boolean>(false);
  const [blockerReason, setBlockerReason] = useState<string>('');
  const [isSubmittingBlocker, setIsSubmittingBlocker] = useState<boolean>(false);
  const [taskBlockers, setTaskBlockers] = useState<TaskBlocker[]>([]);
  const [loadingBlockers, setLoadingBlockers] = useState<boolean>(false);

  // Progress update log state
  const [progressLogNote, setProgressLogNote] = useState<string>('');
  const [progressUpdates, setProgressUpdates] = useState<TaskProgressUpdate[]>([]);
  const [isSubmittingProgress, setIsSubmittingProgress] = useState<boolean>(false);

  // Supporting documents state (Phase 5)
  const [taskDocuments, setTaskDocuments] = useState<Array<{ id: string; name: string; size: string; type: string; createdAt: string }>>([]);
  const [isUploadingDoc, setIsUploadingDoc] = useState<boolean>(false);
  const [uploadDocError, setUploadDocError] = useState<string | null>(null);

  // Add collaborator state
  const [isCollaboratorModalOpen, setIsCollaboratorModalOpen] = useState<boolean>(false);
  const [selectedCollaboratorName, setSelectedCollaboratorName] = useState<string>('Priya Sundaram');
  const [isAddingCollaborator, setIsAddingCollaborator] = useState<boolean>(false);

  // AI companion draft
  const [companionDraft, setCompanionDraft] = useState<string | null>(null);
  const [isCopiedDraft, setIsCopiedDraft] = useState<boolean>(false);

  // Review feedback action state (for Awaiting Review)
  const [reviewFeedbackText, setReviewFeedbackText] = useState<string>('');
  const [isProcessingReview, setIsProcessingReview] = useState<boolean>(false);
  const [fetchedTask, setFetchedTask] = useState<DelegatedTask | null>(null);

  // If selected task is not in current list (e.g. across filters or newly assigned), load it directly
  useEffect(() => {
    if (selectedTaskId && !tasks.some(t => t.id === selectedTaskId)) {
      apiFetch(`/api/tasks/${selectedTaskId}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.id) {
            setFetchedTask(data);
          }
        })
        .catch(() => {});
    } else {
      setFetchedTask(null);
    }

    if (selectedTaskId) {
      setFilterStatus('ALL');
    }
  }, [selectedTaskId, tasks]);

  // Identify currently selected task
  const activeTask = useMemo(() => {
    return tasks.find(t => t.id === selectedTaskId) || (fetchedTask?.id === selectedTaskId ? fetchedTask : null);
  }, [tasks, selectedTaskId, fetchedTask]);

  // Is user a privileged reviewer?
  const isReviewerRole = useMemo(() => {
    const roleUpper = (userRole || '').toUpperCase();
    return ['FOUNDER', 'ADMIN', 'FINANCE', 'HR', 'OPERATIONS', 'GROWTH', 'LEAD', 'MANAGER'].includes(roleUpper);
  }, [userRole]);

  // Load deliverable result, companion draft, blockers, progress updates, and supporting documents when active task changes
  useEffect(() => {
    if (!activeTask) {
      setEditorText('');
      setCompanionDraft(null);
      setTaskBlockers([]);
      setProgressUpdates([]);
      setTaskDocuments([]);
      setUploadDocError(null);
      return;
    }

    setEditorText(activeTask.result || '');

    // Fetch AI draft
    const fetchDraft = async () => {
      try {
        const res = await apiFetch(`/api/tasks/${activeTask.id}/draft`);
        if (res.ok) {
          const draftData = await res.json();
          if (draftData?.draftContent) {
            setCompanionDraft(draftData.draftContent);
            if (!activeTask.result && draftData.draftContent) {
              setEditorText(draftData.draftContent);
            }
          }
        }
      } catch (e) {
        console.warn('Note: Could not load companion draft', e);
      }
    };

    // Fetch blockers for this task
    const fetchBlockers = async () => {
      try {
        setLoadingBlockers(true);
        const res = await apiFetch(`/api/tasks/${activeTask.id}/blockers`);
        if (res.ok) {
          const blockers = await res.json();
          setTaskBlockers(blockers);
        }
      } catch (e) {
        console.warn('Note: Could not load blockers', e);
      } finally {
        setLoadingBlockers(false);
      }
    };

    // Fetch progress updates for this task
    const fetchProgressUpdates = async () => {
      try {
        const res = await apiFetch(`/api/tasks/${activeTask.id}/progress`);
        if (res.ok) {
          const updates = await res.json();
          setProgressUpdates(updates);
        }
      } catch (e) {
        console.warn('Note: Could not load progress updates', e);
      }
    };

    // Fetch supporting documents for this task (Phase 5)
    const fetchDocuments = async () => {
      try {
        const res = await apiFetch(`/api/tasks/${activeTask.id}/documents`);
        if (res.ok) {
          const docs = await res.json();
          setTaskDocuments(Array.isArray(docs) ? docs : []);
        }
      } catch (e) {
        console.warn('Note: Could not load task documents', e);
      }
    };

    fetchDraft();
    fetchBlockers();
    fetchProgressUpdates();
    fetchDocuments();
  }, [activeTask?.id]);

  // Handle supporting document upload (Phase 5)
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeTask) return;

    setUploadDocError(null);

    // Validate extension
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const ALLOWED_EXTS = ['pdf', 'docx', 'doc', 'txt', 'csv', 'xlsx', 'xls', 'json', 'md', 'png', 'jpg', 'jpeg'];
    if (!ALLOWED_EXTS.includes(ext)) {
      setUploadDocError(`Unsupported format (.${ext}). Permitted: PDF, DOCX, TXT, CSV, JSON, MD, PNG, JPG.`);
      e.target.value = '';
      return;
    }

    // Validate size (max 15MB)
    const MAX_SIZE = 15 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setUploadDocError(`File size exceeds 15MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB).`);
      e.target.value = '';
      return;
    }

    try {
      setIsUploadingDoc(true);
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = (reader.result as string).split(',')[1];
          const res = await apiFetch(`/api/tasks/${activeTask.id}/documents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: file.name,
              fileData: base64Data,
              mimeType: file.type || 'application/octet-stream',
              type: ext === 'pdf' ? 'pdf' : ['png', 'jpg', 'jpeg'].includes(ext) ? 'image' : 'document'
            })
          });

          if (res.ok) {
            const created = await res.json();
            setTaskDocuments(prev => [created, ...prev]);
            setStatusNotification({ type: 'success', text: `Uploaded "${file.name}" successfully.` });
          } else {
            const errData = await res.json().catch(() => null);
            setUploadDocError(errData?.error || 'Failed to upload document.');
          }
        } catch {
          setUploadDocError('Network error uploading document.');
        } finally {
          setIsUploadingDoc(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setIsUploadingDoc(false);
      setUploadDocError('Error reading file.');
    } finally {
      e.target.value = '';
    }
  };

  // Handle supporting document secure download (Phase 5)
  const handleDownloadDocument = async (docId: string, filename: string) => {
    if (!activeTask) return;
    try {
      const res = await apiFetch(`/api/tasks/${activeTask.id}/documents/${docId}/download`);
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
      } else {
        setStatusNotification({ type: 'error', text: 'Could not generate secure download link.' });
      }
    } catch (err) {
      console.warn('Download error:', err);
    }
  };

  // Handle saving draft
  const handleSaveDraft = async () => {
    if (!activeTask) return;
    try {
      setIsSaving(true);
      const res = await apiFetch(`/api/tasks/${activeTask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: activeTask.status === 'pending' ? 'in_progress' : activeTask.status,
          result: editorText
        })
      });

      if (res.ok) {
        setStatusNotification({ type: 'success', text: 'Deliverable draft saved successfully.' });
        if (onRefreshTasks) await onRefreshTasks();
      } else {
        setStatusNotification({ type: 'error', text: 'Failed to save deliverable draft.' });
      }
    } catch {
      setStatusNotification({ type: 'error', text: 'Network error saving draft.' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setStatusNotification(null), 3500);
    }
  };

  // Handle start work (pending -> in_progress)
  const handleStartWork = async (taskId: string) => {
    try {
      const res = await apiFetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress' })
      });
      if (res.ok) {
        setStatusNotification({ type: 'success', text: 'Task started! Status is now In Progress.' });
        if (onRefreshTasks) await onRefreshTasks();
      }
    } catch (e) {
      console.warn('Error starting task:', e);
    }
  };

  // Handle submit deliverable for review
  const handleSubmitDeliverable = async () => {
    if (!activeTask) return;
    if (!editorText.trim()) {
      setStatusNotification({ type: 'error', text: 'Please write or paste deliverable content before submitting.' });
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await apiFetch(`/api/tasks/${activeTask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'submitted',
          result: editorText.trim()
        })
      });

      if (res.ok) {
        setStatusNotification({
          type: 'success',
          text: 'Deliverable successfully submitted to founder review queue!'
        });
        if (onRefreshTasks) await onRefreshTasks();
      } else {
        setStatusNotification({ type: 'error', text: 'Submission failed. Please check permissions.' });
      }
    } catch {
      setStatusNotification({ type: 'error', text: 'Network error submitting deliverable.' });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setStatusNotification(null), 4000);
    }
  };

  // Handle submit blocker
  const handleReportBlocker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTask || !blockerReason.trim()) return;

    try {
      setIsSubmittingBlocker(true);
      const res = await apiFetch(`/api/tasks/${activeTask.id}/blocker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: blockerReason.trim() })
      });

      if (res.ok) {
        const newBlocker: TaskBlocker = await res.json();
        setTaskBlockers(prev => [newBlocker, ...prev]);
        setBlockerReason('');
        setIsBlockerModalOpen(false);
        setStatusNotification({ type: 'info', text: 'Blocker reported to founder & team lead.' });
        if (onRefreshTasks) await onRefreshTasks();
      }
    } catch {
      setStatusNotification({ type: 'error', text: 'Could not report blocker.' });
    } finally {
      setIsSubmittingBlocker(false);
      setTimeout(() => setStatusNotification(null), 3500);
    }
  };

  // Handle resolve blocker
  const handleResolveBlocker = async (blockerId: string) => {
    if (!activeTask) return;
    try {
      const res = await apiFetch(`/api/tasks/${activeTask.id}/blocker/${blockerId}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolutionNote: 'Unblocked by task owner.' })
      });
      if (res.ok) {
        setTaskBlockers(prev => prev.map(b => b.id === blockerId ? { ...b, status: 'RESOLVED' } : b));
        setStatusNotification({ type: 'success', text: 'Blocker marked as resolved.' });
        if (onRefreshTasks) await onRefreshTasks();
      }
    } catch {}
  };

  // Handle submit progress log update
  const handleAddProgressUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTask || !progressLogNote.trim()) return;

    try {
      setIsSubmittingProgress(true);
      const res = await apiFetch(`/api/tasks/${activeTask.id}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: progressLogNote.trim() })
      });

      if (res.ok) {
        const newUpdate: TaskProgressUpdate = await res.json();
        setProgressUpdates(prev => [newUpdate, ...prev]);
        setProgressLogNote('');
        setStatusNotification({ type: 'success', text: 'Progress update logged.' });
      }
    } catch {} finally {
      setIsSubmittingProgress(false);
    }
  };

  // Reviewer approval or request changes (for Awaiting Review)
  const handleReviewAction = async (taskId: string, verdict: 'APPROVE' | 'REJECT') => {
    try {
      setIsProcessingReview(true);
      const newStatus = verdict === 'APPROVE' ? 'approved' : 'changes_requested';
      const res = await apiFetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          founderFeedback: reviewFeedbackText.trim() || (verdict === 'APPROVE' ? 'Approved by reviewer.' : 'Please revise based on feedback.')
        })
      });
      if (res.ok) {
        setStatusNotification({
          type: 'success',
          text: verdict === 'APPROVE' ? 'Task deliverable approved!' : 'Changes requested. Feedback sent to author.'
        });
        setReviewFeedbackText('');
        if (onRefreshTasks) await onRefreshTasks();
      }
    } catch {} finally {
      setIsProcessingReview(false);
    }
  };

  // ── Filtered Tasks Calculation ───────────────────────────────────────────────
  // ── Filtered Tasks Calculation (Phase 3 Filters) ────────────────────────────
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      // Review tab only shows submitted items
      if (currentView === 'REVIEW') {
        if (t.status !== 'submitted') return false;
      } else {
        if ((filterStatus === 'NEW_ASSIGNMENTS' || filterStatus === 'UPCOMING') && t.status !== 'pending') return false;
        if (filterStatus === 'IN_PROGRESS' && t.status !== 'in_progress') return false;
        if ((filterStatus === 'SUBMITTED' || filterStatus === 'REVIEW') && t.status !== 'submitted') return false;
        if ((filterStatus === 'CHANGES_REQUESTED' || filterStatus === 'REVISION' || filterStatus === 'BLOCKED') && t.status !== 'changes_requested' && !t.changesRequested) return false;
        if (filterStatus === 'COMPLETED' && t.status !== 'approved') return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = t.title.toLowerCase().includes(q);
        const deptMatch = (t.department || '').toLowerCase().includes(q);
        const descMatch = (t.description || '').toLowerCase().includes(q);
        const parentMatch = (t.parentTask || '').toLowerCase().includes(q);
        return titleMatch || deptMatch || descMatch || parentMatch;
      }
      return true;
    });
  }, [tasks, currentView, filterStatus, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Status banner notification */}
      {statusNotification && (
        <div className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between border transition-all ${
          statusNotification.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
          statusNotification.type === 'error' ? 'bg-rose-50 text-rose-800 border-rose-200' :
          'bg-indigo-50 text-indigo-800 border-indigo-200'
        }`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{statusNotification.text}</span>
          </div>
          <button onClick={() => setStatusNotification(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. HEADER & VIEW SWITCHER (Section 5.A) */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              My Execution Workspace
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Formulate, execute, and deliver prioritized sprint milestones.
            </p>
          </div>

          {/* Compact View Switcher Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start md:self-auto">
            <button
              onClick={() => setCurrentView('LIST')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentView === 'LIST'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>My Tasks</span>
            </button>

            <button
              onClick={() => setCurrentView('BOARD')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentView === 'BOARD'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Board</span>
            </button>

            <button
              onClick={() => setCurrentView('CALENDAR')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentView === 'CALENDAR'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Timeline / Calendar</span>
            </button>

            {isReviewerRole && (
              <button
                onClick={() => setCurrentView('REVIEW')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  currentView === 'REVIEW'
                    ? 'bg-white text-rose-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Awaiting Review</span>
                {tasks.filter(t => t.status === 'submitted').length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-700 font-bold">
                    {tasks.filter(t => t.status === 'submitted').length}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Filter bar for List & Board views */}
        {currentView !== 'CALENDAR' && currentView !== 'REVIEW' && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 mt-4 border-t border-slate-100">
            {/* Status pills matching Phase 3 */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: 'ALL', label: 'My Tasks', count: tasks.length },
                { id: 'NEW_ASSIGNMENTS', label: 'New Assignments', count: tasks.filter(t => t.status === 'pending').length },
                { id: 'IN_PROGRESS', label: 'In Progress', count: tasks.filter(t => t.status === 'in_progress').length },
                { id: 'SUBMITTED', label: 'Submitted', count: tasks.filter(t => t.status === 'submitted').length },
                { id: 'CHANGES_REQUESTED', label: 'Changes Requested', count: tasks.filter(t => t.status === 'changes_requested' || t.changesRequested).length },
                { id: 'COMPLETED', label: 'Completed', count: tasks.filter(t => t.status === 'approved').length },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilterStatus(f.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                    filterStatus === f.id
                      ? 'bg-slate-900 text-white font-semibold'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>{f.label}</span>
                  <span className={`text-[10px] px-1 rounded-full ${filterStatus === f.id ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-700'}`}>
                    {f.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Search input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search tasks by title, parent, or dept..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. MAIN WORK VIEW RENDERER */}
      {currentView === 'LIST' && (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm divide-y divide-slate-100">
          {filteredTasks.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No deliverables match the active filter criteria.</p>
            </div>
          ) : (
            filteredTasks.map(task => {
              const isSelected = task.id === selectedTaskId;
              const isInProgress = task.status === 'in_progress';
              const isRevision = task.status === 'changes_requested' || Boolean(task.changesRequested);
              const isSubmitted = task.status === 'submitted';
              const isApproved = task.status === 'approved';

              return (
                <div
                  key={task.id}
                  onClick={() => onSelectTask(isSelected ? null : task.id)}
                  className={`p-4 flex items-center justify-between gap-4 cursor-pointer transition-colors ${
                    isSelected ? 'bg-indigo-50/50' : 'hover:bg-slate-50/80'
                  }`}
                >
                  <div className="min-w-0 flex items-start gap-3 flex-1">
                    <div className="mt-1 shrink-0">
                      {isApproved ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : isRevision ? (
                        <AlertCircle className="w-4 h-4 text-rose-600" />
                      ) : isInProgress ? (
                        <Clock className="w-4 h-4 text-indigo-600" />
                      ) : isSubmitted ? (
                        <Clock className="w-4 h-4 text-amber-600" />
                      ) : (
                        <CheckSquare className="w-4 h-4 text-slate-400" />
                      )}
                    </div>

                    <div className="min-w-0 space-y-1.5 flex-1">
                      {/* Meta badges: Department, Status, Priority, Due Date, Parent Task */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          {task.department || 'GENERAL'}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          isApproved ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          isRevision ? 'bg-rose-50 text-rose-700 border-rose-200' :
                          isInProgress ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                          isSubmitted ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {isApproved ? 'Completed' : isRevision ? 'Changes Requested' : isInProgress ? 'In Progress' : isSubmitted ? 'Submitted (In Review)' : 'New Assignment'}
                        </span>

                        {/* Priority Badge */}
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider border ${
                          task.priority === 'CRITICAL' ? 'bg-rose-100 text-rose-800 border-rose-300' :
                          task.priority === 'HIGH' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                          task.priority === 'LOW' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                          'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {task.priority || 'MEDIUM'}
                        </span>

                        {/* Due Date Badge */}
                        {(task.dueDate || task.deadline) && (
                          <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>Due: {task.dueDate || task.deadline}</span>
                          </span>
                        )}

                        {/* Parent Task Badge */}
                        {task.parentTask && (
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1">
                            <Layers className="w-3 h-3 text-slate-400" />
                            <span className="truncate max-w-[200px]">Parent: {task.parentTask}</span>
                          </span>
                        )}
                      </div>

                      {/* Task Title */}
                      <h3 className="text-sm font-semibold text-slate-900 truncate">
                        {task.title.replace(/^\[.*?\]\s*/, '')}
                      </h3>

                      {/* Task Description */}
                      {task.description && (
                        <p className="text-xs text-slate-600 line-clamp-1">
                          {task.description}
                        </p>
                      )}

                      {/* Deliverables snippet */}
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-0.5">
                        {task.expectedDeliverable && (
                          <span className="flex items-center gap-1 text-indigo-600 font-medium">
                            <FileText className="w-3 h-3 text-indigo-500 shrink-0" />
                            <span className="truncate max-w-sm">Expected Deliverable: {task.expectedDeliverable}</span>
                          </span>
                        )}
                        {task.result && (
                          <span className="text-slate-400 font-mono text-[10px] truncate max-w-xs">
                            Submission: {task.result.slice(0, 80)}...
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {task.status === 'pending' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartWork(task.id);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200 transition-colors flex items-center gap-1"
                      >
                        <Play className="w-3 h-3 fill-indigo-600" />
                        <span>Start</span>
                      </button>
                    )}

                    <button
                      onClick={() => onSelectTask(isSelected ? null : task.id)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      {isSelected ? 'Close' : 'Details & Editor'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* BOARD VIEW (KANBAN LANES) */}
      {currentView === 'BOARD' && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
          {[
            { id: 'pending', title: 'New Assignments', color: 'border-slate-200 bg-slate-50/50' },
            { id: 'in_progress', title: 'In Progress', color: 'border-indigo-200 bg-indigo-50/30' },
            { id: 'submitted', title: 'Submitted', color: 'border-amber-200 bg-amber-50/30' },
            { id: 'changes_requested', title: 'Changes Requested', color: 'border-rose-200 bg-rose-50/30' },
            { id: 'approved', title: 'Completed', color: 'border-emerald-200 bg-emerald-50/30' },
          ].map(lane => {
            const laneTasks = tasks.filter(t => {
              if (lane.id === 'changes_requested') {
                return t.status === 'changes_requested' || Boolean(t.changesRequested);
              }
              return t.status === lane.id;
            });

            return (
              <div key={lane.id} className={`rounded-xl border ${lane.color} p-4 space-y-3`}>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">{lane.title}</h3>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-white text-slate-700 shadow-2xs">
                    {laneTasks.length}
                  </span>
                </div>

                <div className="space-y-2.5 min-h-[300px]">
                  {laneTasks.length === 0 ? (
                    <div className="py-12 text-center text-[11px] text-slate-400">Empty</div>
                  ) : (
                    laneTasks.map(task => (
                      <div
                        key={task.id}
                        onClick={() => onSelectTask(task.id)}
                        className="bg-white p-3 rounded-lg border border-slate-200/90 shadow-2xs hover:shadow-xs hover:border-indigo-300 cursor-pointer transition-all space-y-2"
                      >
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                          <span>{task.department || 'GENERAL'}</span>
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                            task.priority === 'CRITICAL' ? 'bg-rose-100 text-rose-700' :
                            task.priority === 'HIGH' ? 'bg-amber-100 text-amber-700' :
                            task.priority === 'LOW' ? 'bg-slate-100 text-slate-600' :
                            'bg-blue-50 text-blue-700'
                          }`}>
                            {task.priority || 'MEDIUM'}
                          </span>
                        </div>

                        <h4 className="text-xs font-semibold text-slate-900 line-clamp-2">
                          {task.title.replace(/^\[.*?\]\s*/, '')}
                        </h4>

                        {task.description && (
                          <p className="text-[11px] text-slate-500 line-clamp-1">
                            {task.description}
                          </p>
                        )}

                        {task.parentTask && (
                          <div className="text-[10px] text-slate-500 truncate flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded">
                            <Layers className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                            <span className="truncate">{task.parentTask}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-500">
                          <span className="flex items-center gap-1 font-mono">
                            <Calendar className="w-2.5 h-2.5 text-slate-400" />
                            <span>{task.dueDate || task.deadline || 'Active'}</span>
                          </span>
                          <span className="text-indigo-600 font-medium">Open Editor →</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CALENDAR / TIMELINE VIEW (Section 5.E) */}
      {currentView === 'CALENDAR' && (
        <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Sprint Delivery Timeline</h2>
              <p className="text-xs text-slate-500 mt-0.5">Deliverable deadlines plotted across current execution sprint</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Active Tasks</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Approved</span>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-500 py-1 border-b border-slate-100">
            <div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div><div>Sun</div>
          </div>

          <div className="grid grid-cols-7 gap-2 min-h-[240px]">
            {[12, 13, 14, 15, 16, 17, 18].map((day, idx) => {
              const dayTasks = tasks.slice(idx * 1, idx * 1 + 2);
              const isToday = day === 15; // Example current sprint day

              return (
                <div key={day} className={`p-2 rounded-xl border min-h-[90px] flex flex-col justify-between ${isToday ? 'border-indigo-400 bg-indigo-50/30' : 'border-slate-100 bg-slate-50/50'}`}>
                  <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                    <span>{day} Oct</span>
                    {isToday && <span className="text-[9px] px-1 bg-indigo-600 text-white rounded">Today</span>}
                  </div>
                  <div className="space-y-1 mt-1">
                    {dayTasks.map(t => (
                      <div
                        key={t.id}
                        onClick={() => onSelectTask(t.id)}
                        className="text-[10px] font-medium p-1 rounded bg-white border border-slate-200 truncate cursor-pointer hover:border-indigo-400"
                        title={t.title}
                      >
                        {t.title.replace(/^\[.*?\]\s*/, '')}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AWAITING REVIEW VIEW (Reviewer-only Section) */}
      {currentView === 'REVIEW' && (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm divide-y divide-slate-100">
          <div className="p-4 bg-rose-50/50 border-b border-rose-100">
            <h2 className="text-xs font-bold text-rose-900 uppercase tracking-wider">Submitted Deliverables Awaiting Your Approval</h2>
            <p className="text-xs text-rose-700 mt-0.5">As an executive lead, review deliverables submitted by team members.</p>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-80" />
              <p>No deliverables currently awaiting your review.</p>
            </div>
          ) : (
            filteredTasks.map(task => (
              <div key={task.id} className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{task.department}</span>
                    <h3 className="text-sm font-bold text-slate-900 mt-0.5">{task.title.replace(/^\[.*?\]\s*/, '')}</h3>
                    <div className="text-xs text-slate-500 mt-1">Submitted for founder review</div>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                    Awaiting Review
                  </span>
                </div>

                {task.result && (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {task.result}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                  <input
                    type="text"
                    placeholder="Optional reviewer feedback or requested changes..."
                    value={reviewFeedbackText}
                    onChange={e => setReviewFeedbackText(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      disabled={isProcessingReview}
                      onClick={() => handleReviewAction(task.id, 'REJECT')}
                      className="px-3.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors"
                    >
                      Request Changes
                    </button>
                    <button
                      disabled={isProcessingReview}
                      onClick={() => handleReviewAction(task.id, 'APPROVE')}
                      className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors"
                    >
                      Approve Deliverable
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 3. FOCUSED TASK DETAIL DRAWER / MODAL (Section 5.D) */}
      {activeTask && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex justify-end z-50 transition-all">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="min-w-0 flex-1 mr-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {activeTask.department || 'GENERAL'}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                    activeTask.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    activeTask.status === 'changes_requested' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                    activeTask.status === 'submitted' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                    activeTask.status === 'in_progress' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    'bg-slate-100 text-slate-700 border-slate-200'
                  }`}>
                    {activeTask.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <h2 className="text-base font-bold text-slate-900 truncate">
                  {activeTask.title.replace(/^\[.*?\]\s*/, '')}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {(activeTask.status === 'pending' || activeTask.status === 'changes_requested') && (
                  <button
                    onClick={() => handleStartWork(activeTask.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Start Task</span>
                  </button>
                )}
                <button
                  onClick={() => onSelectTask(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Drawer Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Blocker Alert Banner if any */}
              {taskBlockers.filter(b => b.status === 'OPEN').length > 0 && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-2">
                  <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Active Blocker Reported</span>
                  </div>
                  {taskBlockers.filter(b => b.status === 'OPEN').map(b => (
                    <div key={b.id} className="flex items-center justify-between text-xs text-rose-700 pl-6">
                      <span>"{b.reason}"</span>
                      <button
                        onClick={() => handleResolveBlocker(b.id)}
                        className="text-[10px] px-2 py-0.5 bg-white text-rose-700 border border-rose-300 rounded font-semibold hover:bg-rose-100"
                      >
                        Mark Resolved
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Reviewer Feedback banner if changes requested */}
              {activeTask.founderFeedback && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span>Reviewer Feedback</span>
                  </div>
                  <p className="italic pl-5.5">"{activeTask.founderFeedback}"</p>
                </div>
              )}

              {/* Task Specification & Deliverables Details Card */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Priority:
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      activeTask.priority === 'CRITICAL' ? 'bg-rose-100 text-rose-800 border-rose-300' :
                      activeTask.priority === 'HIGH' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                      activeTask.priority === 'LOW' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                      'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>
                      {activeTask.priority || 'MEDIUM'}
                    </span>
                  </div>

                  {(activeTask.dueDate || activeTask.deadline) && (
                    <div className="text-xs text-slate-600 flex items-center gap-1 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>Deadline: {activeTask.dueDate || activeTask.deadline}</span>
                    </div>
                  )}
                </div>

                {activeTask.parentTask && (
                  <div className="text-xs text-slate-700 flex items-start gap-1.5">
                    <Layers className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-slate-800">Parent Task: </span>
                      <span>{activeTask.parentTask}</span>
                    </div>
                  </div>
                )}

                {activeTask.description && (
                  <div className="text-xs text-slate-600">
                    <span className="font-semibold text-slate-800">Scope: </span>
                    <span>{activeTask.description}</span>
                  </div>
                )}

                {activeTask.expectedDeliverable && (
                  <div className="text-xs text-indigo-700 bg-indigo-50/80 p-2.5 rounded-lg border border-indigo-100">
                    <span className="font-bold flex items-center gap-1.5 mb-1">
                      <FileText className="w-3.5 h-3.5" />
                      <span>Expected Deliverable:</span>
                    </span>
                    <p className="leading-relaxed">{activeTask.expectedDeliverable}</p>
                  </div>
                )}
              </div>

              {/* Quick Action Toolbar */}
              <div className="flex flex-wrap items-center gap-2.5 pb-4 border-b border-slate-100">
                {(activeTask.status === 'pending' || activeTask.status === 'changes_requested') && (
                  <button
                    onClick={() => handleStartWork(activeTask.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current text-emerald-600" />
                    <span>Start Task</span>
                  </button>
                )}

                <button
                  onClick={() => setIsBlockerModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <AlertOctagon className="w-3.5 h-3.5" />
                  <span>Report Blocker</span>
                </button>

                <button
                  onClick={() => setIsCollaboratorModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add Collaborator</span>
                </button>
              </div>

              {/* Supporting Documents & Deliverable Files Section (Phase 5) */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Supporting Documents</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Attach documents, schemas, or specs (PDF, DOCX, TXT, CSV, JSON, MD, PNG, JPG • Max 15MB)
                    </p>
                  </div>
                  <label className={`px-3 py-1.5 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1.5 shadow-2xs transition-all ${isUploadingDoc ? 'opacity-50 pointer-events-none' : ''}`}>
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>{isUploadingDoc ? 'Uploading...' : 'Upload File'}</span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.docx,.doc,.txt,.csv,.xlsx,.xls,.json,.md,.png,.jpg,.jpeg"
                      onChange={handleFileSelect}
                      disabled={isUploadingDoc}
                    />
                  </label>
                </div>

                {uploadDocError && (
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                    <span>{uploadDocError}</span>
                  </div>
                )}

                {/* Document list */}
                <div className="space-y-1.5">
                  {taskDocuments.length === 0 ? (
                    <div className="p-3 text-center border border-dashed border-slate-200 rounded-lg text-slate-400 text-xs italic">
                      No supporting documents attached yet.
                    </div>
                  ) : (
                    taskDocuments.map(doc => (
                      <div key={doc.id} className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between text-xs hover:border-slate-300 transition-colors">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-800 truncate block">{doc.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{doc.size} • {new Date(doc.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDownloadDocument(doc.id, doc.name)}
                          className="px-2.5 py-1 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors flex items-center gap-1 text-[11px] font-semibold cursor-pointer border border-slate-200"
                          title="Download document securely"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Completion Notes & Deliverable Formulation Area */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Completion Notes & Deliverable Formulation</span>
                  </label>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Markdown supported
                  </span>
                </div>

                <textarea
                  rows={10}
                  value={editorText}
                  onChange={e => setEditorText(e.target.value)}
                  placeholder="Add completion notes, specifications, architecture summary, or final deliverables..."
                  className="w-full p-4 rounded-xl border border-slate-200 text-xs font-mono text-slate-800 leading-relaxed focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />

                <div className="flex items-center justify-between pt-1">
                  <button
                    disabled={isSaving}
                    onClick={handleSaveDraft}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    {isSaving ? 'Saving...' : 'Save Draft'}
                  </button>

                  <button
                    disabled={isSubmitting}
                    onClick={handleSubmitDeliverable}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? 'Submitting...' : 'Submit Work for Founder Review'}</span>
                  </button>
                </div>
              </div>

              {/* Progress Log Timeline */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Progress Updates & Activity History
                </h4>

                <form onSubmit={handleAddProgressUpdate} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Log progress note (e.g. 'Completed schema migration')..."
                    value={progressLogNote}
                    onChange={e => setProgressLogNote(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs"
                  />
                  <button
                    type="submit"
                    disabled={isSubmittingProgress || !progressLogNote.trim()}
                    className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800"
                  >
                    Log
                  </button>
                </form>

                <div className="space-y-2 pt-1">
                  {progressUpdates.length === 0 ? (
                    <div className="text-xs text-slate-400 italic">No progress logs recorded yet.</div>
                  ) : (
                    progressUpdates.map(u => (
                      <div key={u.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                        <div className="font-semibold text-slate-800">{u.note}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                          {u.authorName} • {new Date(u.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. REPORT BLOCKER MODAL */}
      {isBlockerModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                <AlertOctagon className="w-5 h-5" />
                <span>Report Task Blocker</span>
              </div>
              <button onClick={() => setIsBlockerModalOpen(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Describe what is blocking this task. Company leadership will be notified immediately to help unblock you.
            </p>

            <form onSubmit={handleReportBlocker} className="space-y-3">
              <textarea
                rows={4}
                required
                value={blockerReason}
                onChange={e => setBlockerReason(e.target.value)}
                placeholder="E.g., Awaiting NPCI sandbox merchant API keys from banking partner..."
                className="w-full p-3 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBlockerModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBlocker}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs"
                >
                  {isSubmittingBlocker ? 'Reporting...' : 'Submit Blocker'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. ADD COLLABORATOR MODAL */}
      {isCollaboratorModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
                <UserPlus className="w-5 h-5" />
                <span>Invite Teammate Collaborator</span>
              </div>
              <button onClick={() => setIsCollaboratorModalOpen(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Select a colleague to contribute to this task deliverable.
            </p>

            <div className="space-y-2">
              {['Priya Sundaram (VP Engineering)', 'Ananya Deshmukh (Lead PM)', 'Neha Gupta (Compliance Lead)', 'Vikram Malhotra (Growth Lead)'].map(name => (
                <button
                  key={name}
                  onClick={() => {
                    setSelectedCollaboratorName(name);
                    setIsCollaboratorModalOpen(false);
                    setStatusNotification({ type: 'success', text: `Added ${name} as task collaborator.` });
                  }}
                  className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 text-xs font-medium text-slate-800 transition-colors flex items-center justify-between"
                >
                  <span>{name}</span>
                  <Plus className="w-3.5 h-3.5 text-indigo-600" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
