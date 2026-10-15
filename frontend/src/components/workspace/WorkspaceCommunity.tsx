/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { CommunityPost, CommunityComment, CommunityPostType, CompanyMeeting, DomainExpert } from '../../types';
import {
  MessageSquare, Megaphone, HelpCircle, BookOpen, FileText,
  Award, ThumbsUp, Check, CheckCircle2, Send, Plus, Search,
  ChevronDown, ChevronUp, User, Shield, AlertCircle, X,
  BookmarkCheck, Sparkles, Filter, Video, Calendar,
  Clock, ExternalLink, Download, Users, Lightbulb, Share2,
  ListChecks, Edit3, Copy
} from 'lucide-react';

interface WorkspaceCommunityProps {
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  userName?: string;
  userRole?: string;
  department?: string;
}

export type CommunitySectionTab = 'discussions' | 'meetings' | 'resources' | 'experts';

export default function WorkspaceCommunity({
  apiFetch,
  userName = 'Team Member',
  userRole = 'Member',
  department = 'Operations'
}: WorkspaceCommunityProps) {
  // ── 4 Main Sub-sections (Section 7 Architecture) ───────────────────────────
  const [currentSection, setCurrentSection] = useState<CommunitySectionTab>('discussions');

  // ── Discussions State ───────────────────────────────────────────────────────
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState<boolean>(true);
  const [discussionCategory, setDiscussionCategory] = useState<'all' | 'announcement' | 'question' | 'knowledge' | 'update'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Post composer
  const [isComposerOpen, setIsComposerOpen] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newContent, setNewContent] = useState<string>('');
  const [newType, setNewType] = useState<CommunityPostType>('update');
  const [newDept, setNewDept] = useState<string>(department);
  const [isSubmittingPost, setIsSubmittingPost] = useState<boolean>(false);

  // Expanded comments
  const [expandedPostComments, setExpandedPostComments] = useState<Record<string, CommunityComment[]>>({});
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({});
  const [newCommentText, setNewCommentText] = useState<Record<string, string>>({});
  const [submittingComment, setSubmittingComment] = useState<Record<string, boolean>>({});

  // ── Meetings State ──────────────────────────────────────────────────────────
  const [upcomingMeetings, setUpcomingMeetings] = useState<CompanyMeeting[]>([]);
  const [pastMeetings, setPastMeetings] = useState<CompanyMeeting[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState<boolean>(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState<boolean>(false);

  // Meet notes viewer & editor state
  const [selectedMeetingForNotes, setSelectedMeetingForNotes] = useState<CompanyMeeting | null>(null);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState<boolean>(false);
  const [isEditingNotes, setIsEditingNotes] = useState<boolean>(false);
  const [editNotesText, setEditNotesText] = useState<string>('');
  const [editDecisionsText, setEditDecisionsText] = useState<string>('');
  const [isSavingNotes, setIsSavingNotes] = useState<boolean>(false);
  const [copiedNotes, setCopiedNotes] = useState<boolean>(false);

  // New meeting form state
  const [meetTitle, setMeetTitle] = useState<string>('');
  const [meetPurpose, setMeetPurpose] = useState<string>('');
  const [meetStartTime, setMeetStartTime] = useState<string>('');
  const [meetEndTime, setMeetEndTime] = useState<string>('');
  const [meetJoinUrl, setMeetJoinUrl] = useState<string>('');
  const [meetProjectName, setMeetProjectName] = useState<string>('UPI 2.0 Recurring Mandates Integration');
  const [isSubmittingMeeting, setIsSubmittingMeeting] = useState<boolean>(false);

  // ── Domain Experts State ───────────────────────────────────────────────────
  const [experts, setExperts] = useState<DomainExpert[]>([]);
  const [loadingExperts, setLoadingExperts] = useState<boolean>(false);

  // Notification message
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Privileged status
  const isPrivileged = useMemo(() => {
    const roleUpper = (userRole || '').toUpperCase();
    return ['FOUNDER', 'ADMIN', 'FINANCE', 'HR', 'OPERATIONS', 'GROWTH'].includes(roleUpper);
  }, [userRole]);

  // Load posts
  const loadPosts = async () => {
    try {
      setLoadingPosts(true);
      const url = discussionCategory === 'all'
        ? `/api/community/posts${searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : ''}`
        : `/api/community/posts?type=${discussionCategory}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''}`;
      
      const res = await apiFetch(url);
      if (res.ok) {
        const data: CommunityPost[] = await res.json();
        setPosts(data);
      }
    } catch (e) {
      console.warn('Note: Could not load community posts', e);
    } finally {
      setLoadingPosts(false);
    }
  };

  // Load meetings
  const loadMeetings = async () => {
    try {
      setLoadingMeetings(true);
      const res = await apiFetch('/api/meetings');
      if (res.ok) {
        const data = await res.json();
        setUpcomingMeetings(data.upcoming || []);
        setPastMeetings(data.past || []);
      }
    } catch (e) {
      console.warn('Note: Could not load meetings', e);
    } finally {
      setLoadingMeetings(false);
    }
  };

  // Load experts
  const loadExperts = async () => {
    try {
      setLoadingExperts(true);
      const res = await apiFetch('/api/workspace/experts');
      if (res.ok) {
        setExperts(await res.json());
      }
    } catch (e) {
      console.warn('Note: Could not load experts', e);
    } finally {
      setLoadingExperts(false);
    }
  };

  useEffect(() => {
    if (currentSection === 'discussions') loadPosts();
    else if (currentSection === 'meetings') loadMeetings();
    else if (currentSection === 'experts') loadExperts();
  }, [currentSection, discussionCategory, searchQuery]);

  // Handle post creation
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    try {
      setIsSubmittingPost(true);
      const res = await apiFetch('/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          content: newContent.trim(),
          type: newType,
          department: newDept
        })
      });

      if (res.ok) {
        const createdPost: CommunityPost = await res.json();
        setPosts(prev => [createdPost, ...prev]);
        setNewTitle('');
        setNewContent('');
        setNewType('update');
        setIsComposerOpen(false);
        setStatusMessage({ type: 'success', text: 'Discussion posted to company community!' });
      } else {
        const err = await res.json();
        setStatusMessage({ type: 'error', text: err?.error || 'Failed to publish post.' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Network error creating discussion.' });
    } finally {
      setIsSubmittingPost(false);
      setTimeout(() => setStatusMessage(null), 3500);
    }
  };

  // Handle create meeting
  const handleScheduleMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetTitle.trim() || !meetPurpose.trim() || !meetJoinUrl.trim()) return;

    try {
      setIsSubmittingMeeting(true);
      const now = new Date();
      const start = meetStartTime ? new Date(meetStartTime).toISOString() : new Date(now.getTime() + 60 * 60000).toISOString();
      const end = meetEndTime ? new Date(meetEndTime).toISOString() : new Date(now.getTime() + 90 * 60000).toISOString();

      const res = await apiFetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: meetTitle.trim(),
          purpose: meetPurpose.trim(),
          startTime: start,
          endTime: end,
          timezone: 'IST (UTC+5:30)',
          joinUrl: meetJoinUrl.trim(),
          projectName: meetProjectName
        })
      });

      if (res.ok) {
        const newMeeting: CompanyMeeting = await res.json();
        setUpcomingMeetings(prev => [newMeeting, ...prev]);
        setIsScheduleModalOpen(false);
        setMeetTitle('');
        setMeetPurpose('');
        setMeetJoinUrl('');
        setStatusMessage({ type: 'success', text: 'Meeting scheduled with video link!' });
      } else {
        const err = await res.json();
        setStatusMessage({ type: 'error', text: err?.error || 'Failed to schedule meeting.' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Network error scheduling meeting.' });
    } finally {
      setIsSubmittingMeeting(false);
      setTimeout(() => setStatusMessage(null), 3500);
    }
  };

  // Open meeting notes modal
  const handleOpenNotes = (meet: CompanyMeeting) => {
    setSelectedMeetingForNotes(meet);
    setEditNotesText(meet.meetingNotes || '');
    setEditDecisionsText((meet.keyDecisions || []).join('\n'));
    setIsEditingNotes(false);
    setIsNotesModalOpen(true);
  };

  // Save updated notes to backend
  const handleSaveNotes = async () => {
    if (!selectedMeetingForNotes) return;
    try {
      setIsSavingNotes(true);
      const decisions = editDecisionsText.split('\n').map(d => d.trim()).filter(Boolean);
      const res = await apiFetch(`/api/meetings/${selectedMeetingForNotes.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meetingNotes: editNotesText,
          keyDecisions: decisions,
          actionItems: selectedMeetingForNotes.actionItems || []
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setSelectedMeetingForNotes(updated);
        setPastMeetings(prev => prev.map(m => m.id === updated.id ? updated : m));
        setIsEditingNotes(false);
        setStatusMessage({ type: 'success', text: 'Meeting notes published successfully.' });
      }
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: e.message || 'Failed to save notes' });
    } finally {
      setIsSavingNotes(false);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  // Toggle action item
  const handleToggleActionItem = async (meetingId: string, actionItemId: string) => {
    try {
      const res = await apiFetch(`/api/meetings/${meetingId}/action-items/${actionItemId}/toggle`, {
        method: 'PATCH'
      });
      if (res.ok) {
        const updated = await res.json();
        if (selectedMeetingForNotes?.id === meetingId) {
          setSelectedMeetingForNotes(updated);
        }
        setPastMeetings(prev => prev.map(m => m.id === updated.id ? updated : m));
      }
    } catch (e) {
      console.warn('Note: Could not toggle action item', e);
    }
  };

  // Copy notes to clipboard
  const handleCopyNotes = (meet: CompanyMeeting) => {
    const text = `📋 MEETING NOTES: ${meet.title}\nDate: ${new Date(meet.startTime).toLocaleDateString('en-IN')}\nOrganizer: ${meet.organizerName}\n\nSummary:\n${meet.meetingNotes || 'No notes'}\n\nKey Decisions:\n${(meet.keyDecisions || []).map((d, i) => `${i + 1}. ${d}`).join('\n')}\n\nAction Items:\n${(meet.actionItems || []).map(a => `[${a.completed ? 'x' : ' '}] ${a.text} (${a.assigneeName || 'Unassigned'})`).join('\n')}`;
    navigator.clipboard.writeText(text);
    setCopiedNotes(true);
    setTimeout(() => setCopiedNotes(false), 2000);
  };

  // Handle post reaction
  const handleToggleReaction = async (postId: string, reaction = 'helpful') => {
    try {
      const res = await apiFetch(`/api/community/posts/${postId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reaction })
      });
      if (res.ok) {
        const updated = await res.json();
        setPosts(prev => prev.map(p => p.id === postId ? {
          ...p,
          reactions: updated.reactions,
          userReactions: updated.userReactions
        } : p));
      }
    } catch {}
  };

  // Toggle comments
  const toggleComments = async (postId: string) => {
    if (expandedPostComments[postId]) {
      setExpandedPostComments(prev => {
        const next = { ...prev };
        delete next[postId];
        return next;
      });
      return;
    }

    try {
      setLoadingComments(prev => ({ ...prev, [postId]: true }));
      const res = await apiFetch(`/api/community/posts/${postId}/comments`);
      if (res.ok) {
        const comments = await res.json();
        setExpandedPostComments(prev => ({ ...prev, [postId]: comments }));
      }
    } catch {} finally {
      setLoadingComments(prev => ({ ...prev, [postId]: false }));
    }
  };

  // Submit comment
  const handleAddComment = async (postId: string) => {
    const text = newCommentText[postId]?.trim();
    if (!text) return;

    try {
      setSubmittingComment(prev => ({ ...prev, [postId]: true }));
      const res = await apiFetch(`/api/community/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text })
      });

      if (res.ok) {
        const comment = await res.json();
        setExpandedPostComments(prev => ({
          ...prev,
          [postId]: [...(prev[postId] || []), comment]
        }));
        setNewCommentText(prev => ({ ...prev, [postId]: '' }));
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, commentsCount: p.commentsCount + 1 } : p));
      }
    } catch {} finally {
      setSubmittingComment(prev => ({ ...prev, [postId]: false }));
    }
  };

  // Mark answer solved
  const handleMarkSolved = async (postId: string, commentId: string) => {
    try {
      const res = await apiFetch(`/api/community/posts/${postId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId })
      });
      if (res.ok) {
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, isAnswered: true } : p));
        setStatusMessage({ type: 'success', text: 'Marked answer as verified solution!' });
      }
    } catch {}
  };

  // Promote post to official knowledge
  const handlePromoteToKnowledge = async (postId: string) => {
    try {
      const res = await apiFetch(`/api/community/posts/${postId}/convert-to-knowledge`, {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, knowledgeDocId: data.documentId } : p));
        setStatusMessage({ type: 'success', text: `Promoted post to official Company Knowledge!` });
      }
    } catch {}
  };

  // Curated Company Resources (Section 7.C)
  const companyResources = [
    {
      id: 'res_rbi_lending',
      title: 'RBI Master Direction on Digital Lending Guidelines 2026',
      department: 'Compliance',
      type: 'Official Regulatory Directive',
      summary: 'Comprehensive compliance protocol for regulated entities regarding escrow accounts, tokenized mandate storage, and data localization.',
      downloadName: 'RBI_Digital_Lending_Master_Direction_2026.pdf',
      verifiedBy: 'Neha Gupta (Compliance Lead)'
    },
    {
      id: 'res_upi_autopay',
      title: 'NPCI UPI 2.0 Recurring Mandates & Autopay Integration Specification',
      department: 'Engineering',
      type: 'Architecture Runbook',
      summary: 'Webhook payload specifications, SHA256 checksum verification, pre-debit notifications, and mandate pause/resume lifecycle.',
      downloadName: 'NPCI_UPI_2_Recurring_Autopay_Spec.pdf',
      verifiedBy: 'Priya Sundaram (VP Engineering)'
    },
    {
      id: 'res_eng_handbook',
      title: 'Catalyst Engineering Coding Standards & PR Review Guidelines',
      department: 'Engineering',
      type: 'Internal Runbook',
      summary: 'TypeScript strict mode rules, unit test thresholds, zero-downtime database migrations, and production deploy checklist.',
      downloadName: 'Catalyst_Engineering_Handbook_v3.pdf',
      verifiedBy: 'Priya Sundaram (VP Engineering)'
    },
    {
      id: 'res_esop_policy',
      title: 'Employee Stock Option Plan (ESOP) & Leave Policy 2026',
      department: 'HR & Talent',
      type: 'Company Policy',
      summary: '4-year vesting schedules with 1-year cliff, exercise windows, maternity/paternity leave, and wellness allowances.',
      downloadName: 'NovaTech_ESOP_Leave_Policy_2026.pdf',
      verifiedBy: 'Aarav Sharma (Founder & CEO)'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Status banner */}
      {statusMessage && (
        <div className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between border ${
          statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* 1. COMMUNITY HEADER & 4 SECTION SUB-NAVIGATION (Section 7) */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Company Community & Coordination Hub
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Collaborate on discussions, coordinate meetings, access company knowledge, and find domain experts.
            </p>
          </div>

          {/* Sub-section Switcher Tabs (Discussions, Meetings, Resources, Experts) */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start md:self-auto">
            <button
              onClick={() => setCurrentSection('discussions')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentSection === 'discussions' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Discussions</span>
            </button>

            <button
              onClick={() => setCurrentSection('meetings')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentSection === 'meetings' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>Meetings</span>
              {upcomingMeetings.length > 0 && (
                <span className="text-[10px] px-1 rounded-full bg-indigo-100 text-indigo-700 font-bold">
                  {upcomingMeetings.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setCurrentSection('resources')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentSection === 'resources' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Resources & Runbooks</span>
            </button>

            <button
              onClick={() => setCurrentSection('experts')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                currentSection === 'experts' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Lightbulb className="w-3.5 h-3.5" />
              <span>Domain Experts</span>
            </button>
          </div>
        </div>

        {/* Action bar for Discussions tab */}
        {currentSection === 'discussions' && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: 'all', label: 'All Feeds' },
                { id: 'announcement', label: 'Announcements' },
                { id: 'question', label: 'Q&A' },
                { id: 'knowledge', label: 'Knowledge' },
                { id: 'update', label: 'Updates' },
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setDiscussionCategory(cat.id as any)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    discussionCategory === cat.id
                      ? 'bg-slate-900 text-white font-semibold'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsComposerOpen(!isComposerOpen)}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Discussion</span>
              </button>
            </div>
          </div>
        )}

        {/* Action bar for Meetings tab */}
        {currentSection === 'meetings' && (
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <span className="text-xs text-slate-500 font-medium">
              Synchronize video syncs via Google Meet, Microsoft Teams, or Zoom.
            </span>
            <button
              onClick={() => setIsScheduleModalOpen(true)}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Video className="w-3.5 h-3.5" />
              <span>Schedule Meeting</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. SUB-SECTION 1: DISCUSSIONS */}
      {currentSection === 'discussions' && (
        <div className="space-y-4">
          {/* Post Composer Drawer / Modal */}
          {isComposerOpen && (
            <div className="bg-white rounded-xl border border-indigo-200 p-5 shadow-sm space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Start a Company Discussion</h3>
                <button onClick={() => setIsComposerOpen(false)}><X className="w-4 h-4 text-slate-400" /></button>
              </div>

              <form onSubmit={handleCreatePost} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Discussion Type</label>
                    <select
                      value={newType}
                      onChange={e => setNewType(e.target.value as CommunityPostType)}
                      className="w-full p-2 rounded-lg border border-slate-200 text-xs"
                    >
                      <option value="update">Team Update</option>
                      <option value="question">Ask a Question / Help</option>
                      <option value="knowledge">Knowledge / Technical Insight</option>
                      <option value="recognition">Shout-out / Recognition</option>
                      {isPrivileged && <option value="announcement">Official Announcement</option>}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Related Department</label>
                    <select
                      value={newDept}
                      onChange={e => setNewDept(e.target.value)}
                      className="w-full p-2 rounded-lg border border-slate-200 text-xs"
                    >
                      <option value="Engineering">Engineering & Architecture</option>
                      <option value="Product">Product & Design</option>
                      <option value="Compliance">FinTech Compliance & Legal</option>
                      <option value="Growth">Growth & GTM</option>
                      <option value="Operations">Operations & HR</option>
                    </select>
                  </div>
                </div>

                <div>
                  <input
                    type="text"
                    required
                    placeholder="Subject title (e.g. 'UPI Autopay Sandbox Credentials Verification')..."
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-200 text-xs font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <textarea
                    rows={4}
                    required
                    placeholder="Write your update, ask your question, or share technical notes..."
                    value={newContent}
                    onChange={e => setNewContent(e.target.value)}
                    className="w-full p-3 rounded-lg border border-slate-200 text-xs leading-relaxed focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsComposerOpen(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingPost}
                    className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
                  >
                    {isSubmittingPost ? 'Publishing...' : 'Publish to Community'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Posts List */}
          <div className="space-y-4">
            {posts.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-xs text-slate-400">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No community discussions found matching your filter.</p>
              </div>
            ) : (
              posts.map(post => {
                const isAnnouncement = post.type === 'announcement';
                const isQuestion = post.type === 'question';
                const isKnowledge = post.type === 'knowledge';
                const isSolved = post.isAnswered;
                const comments = expandedPostComments[post.id];
                const isCommentsOpen = Boolean(comments);

                return (
                  <div
                    key={post.id}
                    className={`bg-white rounded-xl border p-5 shadow-sm space-y-3.5 transition-all ${
                      isAnnouncement ? 'border-amber-200 bg-amber-50/20' :
                      isSolved ? 'border-emerald-200 bg-emerald-50/10' :
                      'border-slate-200/90'
                    }`}
                  >
                    {/* Post Top Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                          {post.authorName.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xs font-bold text-slate-900">{post.authorName}</h3>
                            <span className="text-[10px] text-slate-500 capitalize">• {post.authorRole}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {new Date(post.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {isSolved && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            <span>Solved</span>
                          </span>
                        )}
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          isAnnouncement ? 'bg-amber-100 text-amber-800 border-amber-300' :
                          isQuestion ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                          isKnowledge ? 'bg-purple-50 text-purple-700 border-purple-200' :
                          'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {post.type.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {/* Content */}
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 mb-1">{post.title}</h4>
                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{post.content}</p>
                    </div>

                    {/* Actions Toolbar */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-600">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleToggleReaction(post.id, 'helpful')}
                          className="flex items-center gap-1.5 font-medium hover:text-indigo-600 transition-colors"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                          <span>{post.reactions?.helpful || 0} Helpful</span>
                        </button>

                        <button
                          onClick={() => toggleComments(post.id)}
                          className="flex items-center gap-1.5 font-medium hover:text-indigo-600 transition-colors"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>{post.commentsCount || 0} Comments</span>
                        </button>
                      </div>

                      {isPrivileged && !post.knowledgeDocId && (
                        <button
                          onClick={() => handlePromoteToKnowledge(post.id)}
                          className="text-[10px] font-semibold text-purple-700 hover:text-purple-900 flex items-center gap-1"
                        >
                          <BookmarkCheck className="w-3.5 h-3.5" />
                          <span>Promote to Company Knowledge</span>
                        </button>
                      )}
                    </div>

                    {/* Comments Thread */}
                    {isCommentsOpen && (
                      <div className="pt-3 border-t border-slate-100 space-y-3 bg-slate-50/70 -mx-5 -mb-5 p-5 rounded-b-xl">
                        <div className="space-y-2">
                          {comments.length === 0 ? (
                            <div className="text-xs text-slate-400 italic">No replies yet. Be the first to comment!</div>
                          ) : (
                            comments.map(c => (
                              <div key={c.id} className="p-3 rounded-lg bg-white border border-slate-200 text-xs space-y-1">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-slate-900">{c.authorName}</span>
                                    <span className="text-[10px] text-slate-400 font-mono">• {c.authorRole}</span>
                                  </div>
                                  {isQuestion && !isSolved && (
                                    <button
                                      onClick={() => handleMarkSolved(post.id, c.id)}
                                      className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200"
                                    >
                                      Mark as Solution
                                    </button>
                                  )}
                                </div>
                                <p className="text-slate-700">{c.content}</p>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Comment Input */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Write a constructive reply..."
                            value={newCommentText[post.id] || ''}
                            onChange={e => setNewCommentText(prev => ({ ...prev, [post.id]: e.target.value }))}
                            className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white"
                          />
                          <button
                            onClick={() => handleAddComment(post.id)}
                            disabled={submittingComment[post.id] || !newCommentText[post.id]?.trim()}
                            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                          >
                            Reply
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 3. SUB-SECTION 2: MEETINGS & MEET LINKS (Section 7.B) */}
      {currentSection === 'meetings' && (
        <div className="space-y-6">
          {/* Upcoming Meetings Card */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span>Upcoming Scheduled Meetings</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {upcomingMeetings.length === 0 ? (
                <div className="col-span-2 py-10 text-center text-xs text-slate-400">
                  <Video className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No upcoming meetings scheduled. Click "Schedule Meeting" to coordinate a call.</p>
                </div>
              ) : (
                upcomingMeetings.map(meet => {
                  const startTime = new Date(meet.startTime).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                    timeZone: 'Asia/Kolkata'
                  });

                  return (
                    <div key={meet.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-xs font-bold text-slate-900">{meet.title}</h3>
                          <div className="text-[11px] text-indigo-600 font-mono mt-0.5 font-semibold flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{startTime} IST</span>
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">
                          {meet.provider.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 line-clamp-2">{meet.purpose}</p>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                        <span className="text-[11px] text-slate-500">By {meet.organizerName}</span>
                        <a
                          href={meet.joinUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
                        >
                          <Video className="w-3.5 h-3.5" />
                          <span>Join Meeting</span>
                        </a>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Past Meetings & Meet Notes Archive */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span>Previous Meetings & Notes Archive</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Review discussion summaries, key decisions, and action items from previous company syncs.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 self-start sm:self-auto">
                {pastMeetings.length} Completed Meets
              </span>
            </div>

            {pastMeetings.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No archived meetings recorded yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pastMeetings.map(meet => {
                  const startTime = new Date(meet.startTime).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                    timeZone: 'Asia/Kolkata'
                  });

                  const completedActions = (meet.actionItems || []).filter(a => a.completed).length;
                  const totalActions = (meet.actionItems || []).length;

                  return (
                    <div
                      key={meet.id}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-indigo-300 transition-all space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-slate-900 truncate">{meet.title}</h4>
                            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                              {startTime} IST • By {meet.organizerName}
                            </div>
                          </div>
                          {meet.projectName && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0 truncate max-w-[150px]">
                              {meet.projectName}
                            </span>
                          )}
                        </div>

                        {/* Meet Notes Preview Snippet */}
                        {meet.meetingNotes ? (
                          <div className="bg-white rounded-lg p-2.5 border border-slate-200/80 text-[11px] text-slate-700 space-y-1">
                            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">
                              Meeting Notes
                            </span>
                            <p className="line-clamp-2 leading-relaxed text-slate-600">
                              {meet.meetingNotes}
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic">No notes recorded yet.</p>
                        )}

                        {/* Badges for Decisions & Actions */}
                        <div className="flex items-center gap-2 flex-wrap pt-1">
                          {meet.keyDecisions && meet.keyDecisions.length > 0 && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-purple-600" />
                              <span>{meet.keyDecisions.length} Decisions</span>
                            </span>
                          )}

                          {totalActions > 0 && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                              <ListChecks className="w-3 h-3 text-emerald-600" />
                              <span>{completedActions}/{totalActions} Action Items Done</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center justify-between pt-2.5 border-t border-slate-200/70 text-xs">
                        <button
                          onClick={() => handleOpenNotes(meet)}
                          className="font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>View Full Notes & Action Items →</span>
                        </button>

                        <button
                          onClick={() => {
                            handleOpenNotes(meet);
                            setIsEditingNotes(true);
                          }}
                          className="text-[11px] font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. SUB-SECTION 3: RESOURCES & RUNBOOKS (Section 7.C) */}
      {currentSection === 'resources' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {companyResources.map(res => (
            <div key={res.id} className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">{res.title}</h3>
                    <div className="text-[10px] text-slate-400 font-mono">{res.department} • {res.type}</div>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">{res.summary}</p>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <span className="text-[10px] text-slate-400">Verified by {res.verifiedBy}</span>
                <button
                  onClick={() => alert(`Opening ${res.downloadName}`)}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Spec</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 5. SUB-SECTION 4: DOMAIN EXPERTS (Section 7.D) */}
      {currentSection === 'experts' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {experts.map(exp => (
            <div key={exp.id} className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 text-white font-bold text-sm flex items-center justify-center shrink-0">
                      {exp.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs font-bold text-slate-900 truncate">{exp.name}</h3>
                      <div className="text-[11px] text-slate-500 truncate">{exp.role}</div>
                    </div>
                  </div>

                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                    exp.availability === 'FOCUS' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {exp.availability === 'FOCUS' ? 'Focus' : 'Available'}
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {exp.department}
                  </span>
                  <span className="text-[10px] text-slate-500 truncate">
                    Reports to: {exp.reportsTo || 'Aarav Sharma (CEO)'}
                  </span>
                </div>

                <p className="text-xs text-slate-600 mt-2 line-clamp-2 leading-relaxed">{exp.bio}</p>

                {exp.activeProjects && exp.activeProjects.length > 0 && (
                  <div className="mt-2 text-[10px] text-indigo-700 bg-indigo-50/60 px-2 py-1 rounded border border-indigo-100 truncate">
                    Projects: {exp.activeProjects.join(', ')}
                  </div>
                )}

                <div className="flex flex-wrap gap-1 pt-2">
                  {exp.skills.map((skill, idx) => (
                    <span key={idx} className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <button
                  onClick={() => {
                    setCurrentSection('discussions');
                    setIsComposerOpen(true);
                    setNewTitle(`Question for ${exp.name} on domain guidance`);
                  }}
                  className="w-full py-1.5 text-center text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-indigo-100"
                >
                  Ask for Guidance in Community →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 6. SCHEDULE MEETING MODAL */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm">
                <Video className="w-5 h-5" />
                <span>Schedule Team Video Meeting</span>
              </div>
              <button onClick={() => setIsScheduleModalOpen(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleScheduleMeeting} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Meeting Title</label>
                <input
                  type="text"
                  required
                  placeholder="E.g., UPI 2.0 Recurring Mandates Architecture Review"
                  value={meetTitle}
                  onChange={e => setMeetTitle(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Agenda & Purpose</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Outline key discussion points and expected outcomes..."
                  value={meetPurpose}
                  onChange={e => setMeetPurpose(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Video Link (Google Meet / Teams / Zoom)
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://meet.google.com/abc-defg-hij"
                  value={meetJoinUrl}
                  onChange={e => setMeetJoinUrl(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 text-xs font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingMeeting}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
                >
                  {isSubmittingMeeting ? 'Scheduling...' : 'Save & Notify Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MEETING NOTES & KEY DECISIONS MODAL */}
      {isNotesModalOpen && selectedMeetingForNotes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
            {/* Modal Header */}
            <div className="bg-slate-50 p-6 border-b border-slate-200 relative">
              <button
                onClick={() => setIsNotesModalOpen(false)}
                className="absolute top-5 right-5 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="pr-8">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-200">
                    Previous Meet Notes
                  </span>
                  {selectedMeetingForNotes.projectName && (
                    <span className="text-[10px] font-medium text-slate-600 bg-slate-200/70 px-2 py-0.5 rounded">
                      {selectedMeetingForNotes.projectName}
                    </span>
                  )}
                </div>

                <h2 className="text-lg font-bold text-slate-900">
                  {selectedMeetingForNotes.title}
                </h2>

                <div className="flex items-center gap-3 text-xs text-slate-500 mt-2 flex-wrap font-mono">
                  <span className="flex items-center gap-1 font-sans">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{new Date(selectedMeetingForNotes.startTime).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </span>
                  <span>•</span>
                  <span>{new Date(selectedMeetingForNotes.startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })} IST</span>
                  <span>•</span>
                  <span>Organized by {selectedMeetingForNotes.organizerName}</span>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {isEditingNotes ? (
                /* EDIT MODE */
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Meeting Notes & Discussion Summary
                    </label>
                    <textarea
                      rows={5}
                      value={editNotesText}
                      onChange={e => setEditNotesText(e.target.value)}
                      placeholder="Summarize key discussions, customer feedback, architecture decisions..."
                      className="w-full p-3 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Key Decisions (One per line)
                    </label>
                    <textarea
                      rows={3}
                      value={editDecisionsText}
                      onChange={e => setEditDecisionsText(e.target.value)}
                      placeholder="Decision 1&#10;Decision 2&#10;Decision 3"
                      className="w-full p-3 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => setIsEditingNotes(false)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveNotes}
                      disabled={isSavingNotes}
                      className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs"
                    >
                      {isSavingNotes ? 'Saving Notes...' : 'Save Notes'}
                    </button>
                  </div>
                </div>
              ) : (
                /* VIEW MODE */
                <>
                  {/* Meeting Notes */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Executive Discussion Summary & Notes</span>
                      </h3>
                      <button
                        onClick={() => setIsEditingNotes(true)}
                        className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit Notes</span>
                      </button>
                    </div>

                    <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                      {selectedMeetingForNotes.meetingNotes || (
                        <span className="text-slate-400 italic">No meeting notes entered yet. Click "Edit Notes" to write notes.</span>
                      )}
                    </div>
                  </div>

                  {/* Key Decisions */}
                  {selectedMeetingForNotes.keyDecisions && selectedMeetingForNotes.keyDecisions.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                        <span>Key Decisions Agreed Upon</span>
                      </h3>
                      <div className="space-y-2">
                        {selectedMeetingForNotes.keyDecisions.map((dec, idx) => (
                          <div key={idx} className="p-3 rounded-lg bg-purple-50/40 border border-purple-200 text-xs text-purple-900 flex items-start gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-purple-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <span className="leading-relaxed font-medium">{dec}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Items Checklist */}
                  {selectedMeetingForNotes.actionItems && selectedMeetingForNotes.actionItems.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                        <ListChecks className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Action Items & Assigned Deliverables</span>
                      </h3>
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                        {selectedMeetingForNotes.actionItems.map(item => (
                          <div
                            key={item.id}
                            onClick={() => handleToggleActionItem(selectedMeetingForNotes.id, item.id)}
                            className="p-3 flex items-center justify-between gap-3 text-xs cursor-pointer hover:bg-slate-50 transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={item.completed}
                                onChange={() => {}}
                                className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer shrink-0"
                              />
                              <span className={`truncate ${item.completed ? 'line-through text-slate-400 font-normal' : 'text-slate-800 font-medium'}`}>
                                {item.text}
                              </span>
                            </div>

                            {item.assigneeName && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                                {item.assigneeName}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Attendees */}
                  {selectedMeetingForNotes.attendees && selectedMeetingForNotes.attendees.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-slate-100">
                      <span className="text-[11px] font-semibold text-slate-500 block">Participants & Attendees:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedMeetingForNotes.attendees.map(a => (
                          <span key={a.id} className="text-[11px] px-2.5 py-1 rounded bg-slate-100 text-slate-700 font-medium">
                            {a.name} ({a.role})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => handleCopyNotes(selectedMeetingForNotes)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-1.5"
              >
                {copiedNotes ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                <span>{copiedNotes ? 'Copied to Clipboard' : 'Copy Meeting Summary'}</span>
              </button>

              <button
                onClick={() => setIsNotesModalOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
