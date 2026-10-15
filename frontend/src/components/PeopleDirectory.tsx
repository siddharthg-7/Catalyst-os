/**
 * CatalystOS - People & Access Directory
 * Redesigned with Apple × Linear × Notion aesthetics.
 * Venture ownership, human team members, sign-in accounts, and autonomous AI executive suite.
 * Theme-aware tokens, high-contrast badges, and clean modal dialogs.
 */

import React, { useState } from 'react';
import { TeamMember, UserRole, CompanyInvitation, CompanyMembership } from '../types';
import { 
  Users, 
  UserPlus, 
  Mail, 
  Trash2, 
  X, 
  AlertCircle,
  Send,
  RotateCcw,
  Ban,
  ShieldCheck,
  Bot,
  UserMinus,
  Network,
  Plus,
  Check
} from 'lucide-react';
import Section from './Section';
import OrgHierarchyFlow, { CORE_DOMAINS } from './OrgHierarchyFlow';
import { sendEmailWithEmailJS } from '../services/emailJsService';

const ASSIGNABLE_ROLES = [
  { value: 'ADMIN',      label: 'Admin',      hint: 'Full access to every area, agent and approval.' },
  { value: 'FINANCE',    label: 'Finance',    hint: 'Dashboard, Finance/Auditor/Investment agents, scenarios. Approvals read-only.' },
  { value: 'HR',         label: 'HR',         hint: 'Dashboard, Talent and Legal agents, People (can add members).' },
  { value: 'OPERATIONS', label: 'Operations', hint: 'Workflows, Operations and CEO agents, decision ledger.' },
  { value: 'GROWTH',     label: 'Growth',     hint: 'Workflows, Growth and CEO agents, knowledge base.' }
] as const;

// The 8 AI Executive Agents
const AI_EXECUTIVES = [
  {
    id: 'atlas',
    name: 'Atlas',
    title: 'Chief Executive Officer',
    department: 'Executive Office',
    mandate: 'Strategic orchestration, council synthesis, and quarterly milestone execution.',
    autonomy: 'Tier 1 Orchestrator',
    guardrail: '₹2,50,000 Cap'
  },
  {
    id: 'aura',
    name: 'Aura',
    title: 'Chief Marketing Officer',
    department: 'Marketing & Brand',
    mandate: 'Brand positioning, competitive benchmarking, and top-of-funnel customer narrative.',
    autonomy: 'Autonomous GTM',
    guardrail: '₹1,00,000 Cap'
  },
  {
    id: 'echo',
    name: 'Echo',
    title: 'Chief Technology Officer',
    department: 'Engineering & Tech',
    mandate: 'System architecture, technical security, and scalable infrastructure.',
    autonomy: 'Autonomous Architecture',
    guardrail: '₹1,50,000 Cap'
  },
  {
    id: 'vector',
    name: 'Vector',
    title: 'Chief Operating Officer',
    department: 'Operations',
    mandate: 'Operational cadence, multi-agent sprint execution, and SOC-2 compliance.',
    autonomy: 'Autonomous Sprints',
    guardrail: '₹1,50,000 Cap'
  },
  {
    id: 'nexus',
    name: 'Nexus',
    title: 'Chief Compliance & Audit Officer',
    department: 'Audit & Governance',
    mandate: 'Ledger verification, audit trails, and deterministic treasury arithmetic check.',
    autonomy: 'Governance Sentinel',
    guardrail: 'Full Veto Authority'
  },
  {
    id: 'helix',
    name: 'Helix',
    title: 'Chief Investment Officer',
    department: 'Treasury & Finance',
    mandate: 'Cash runway forecasting, investor pitch scripts, and cap table scenario stress testing.',
    autonomy: 'Treasury Modeling',
    guardrail: '₹5,00,000 Cap'
  },
  {
    id: 'apex',
    name: 'Apex',
    title: 'Chief Revenue Officer',
    department: 'Sales & Growth',
    mandate: 'CAC payback modeling, conversion funnel optimization, and commercial contracts.',
    autonomy: 'Autonomous Growth',
    guardrail: '₹1,00,000 Cap'
  },
  {
    id: 'sentry',
    name: 'Sentry',
    title: 'Chief Information Security Officer',
    department: 'Security & InfoSec',
    mandate: 'Continuous vulnerability scanning, policy generation, and vendor risk mitigation.',
    autonomy: 'Autonomous InfoSec',
    guardrail: 'Immediate Threat Freeze'
  }
];

interface PeopleDirectoryProps {
  user: {
    id?: string;
    name?: string;
    email?: string;
    role?: UserRole | string;
  } | null;
  companyName?: string;
  teamMembers: TeamMember[];
  onAddMember?: (member: { 
    fullName: string; 
    email: string; 
    role: string; 
    department: string; 
    status?: 'Active' | 'Invited' 
  }) => Promise<void>;
  onRemoveMember?: (id: string) => Promise<void>;
  memberships?: CompanyMembership[];
  invitations?: CompanyInvitation[];
  onInviteMember?: (invite: { email: string; role: string; department?: string }) => Promise<void>;
  onRevokeInvitation?: (id: string) => Promise<void>;
  onResendInvitation?: (id: string) => Promise<void>;
  onRemoveMembership?: (id: string) => Promise<void>;
}

export default function PeopleDirectory({
  user,
  companyName = 'Venture',
  teamMembers,
  onAddMember,
  onRemoveMember,
  memberships = [],
  invitations = [],
  onInviteMember,
  onRevokeInvitation,
  onResendInvitation,
  onRemoveMembership,
}: PeopleDirectoryProps) {
  const [activeTab, setActiveTab] = useState<'hierarchy' | 'humans' | 'agents'>('hierarchy');

  // Custom departments state (persisted across sessions)
  const [customDepartments, setCustomDepartments] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('catalystos_custom_departments');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [newDeptInput, setNewDeptInput] = useState('');
  const [showNewDeptInput, setShowNewDeptInput] = useState(false);

  const handleAddCustomDepartment = (deptName: string): string => {
    const trimmed = deptName.trim();
    if (!trimmed) return '';
    if (!customDepartments.includes(trimmed)) {
      const updated = [...customDepartments, trimmed];
      setCustomDepartments(updated);
      try {
        localStorage.setItem('catalystos_custom_departments', JSON.stringify(updated));
      } catch {}
    }
    setNewDeptInput('');
    setShowNewDeptInput(false);
    return trimmed;
  };

  const allAvailableDepartments = Array.from(
    new Set([
      ...CORE_DOMAINS.map(d => d.label),
      'Operations',
      'Finance & Accounting',
      'People & HR',
      'Growth & Marketing',
      'Engineering & Tech',
      'Product & Design',
      'Security & InfoSec',
      ...customDepartments,
      ...teamMembers.map(m => m.department).filter(Boolean)
    ])
  );

  // Invite modal state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('');
  const [inviteDepartment, setInviteDepartment] = useState('Operations');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Add member modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [department, setDepartment] = useState('Operations');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accountEmails = new Set(
    memberships.map(m => (m.email || '').trim().toLowerCase()).filter(Boolean)
  );
  const rosterOnly = teamMembers.filter(m => {
    if (m.hasAccount) return false;
    const rosterEmail = (m.email || '').trim().toLowerCase();
    return !(rosterEmail && accountEmails.has(rosterEmail));
  });

  const pendingInvitations = invitations.filter(i => i.status === 'PENDING');
  const closedInvitations = invitations.filter(i => i.status !== 'PENDING');

  const founderName = user?.name?.trim() || 'Siddharth';
  const founderEmail = user?.email?.trim() || 'founder@catalyst.os';
  const founderRole = user?.role ? `${user.role} / Owner` : 'Founder / Owner';

  const resetForm = () => {
    setFullName('');
    setEmail('');
    setRole('');
    setDepartment('Operations');
    setError(null);
  };

  const handleOpenModal = (prefillDept?: string) => {
    resetForm();
    if (prefillDept) {
      setDepartment(prefillDept);
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    resetForm();
    setModalOpen(false);
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    if (!inviteEmail.includes('@')) {
      setInviteError('Enter a valid email address.');
      return;
    }
    if (!inviteRole) {
      setInviteError('Select a role for this person.');
      return;
    }

    const chosenDept = inviteDepartment.trim() || 'Operations';
    setInviteSubmitting(true);
    try {
      // 1. Dispatch directly via EmailJS (service_6dwbxni / template_xqoitun)
      sendEmailWithEmailJS({
        to_email: inviteEmail.trim(),
        to_name: inviteEmail.split('@')[0],
        from_name: founderName,
        company_name: companyName,
        role: inviteRole,
        department: chosenDept,
        subject: `You've been invited to join ${companyName} on CatalystOS`
      }).catch(err => console.warn('[PeopleDirectory] EmailJS invite attempt:', err));

      // 2. Delegate to parent invite handler
      await onInviteMember?.({ 
        email: inviteEmail.trim(), 
        role: inviteRole,
        department: chosenDept 
      });

      setInviteEmail('');
      setInviteRole('');
      setInviteDepartment('Operations');
      setInviteOpen(false);
    } catch (err: any) {
      setInviteError(err?.message || 'The invitation could not be sent.');
    } finally {
      setInviteSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    const trimmedRole = role.trim();
    const trimmedDept = department.trim() || 'Operations';

    if (!trimmedName) {
      setError('Please provide the person\'s full name.');
      return;
    }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please provide a valid email address.');
      return;
    }
    if (!trimmedRole) {
      setError('Please enter a role.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Dispatch directly via EmailJS (service_6dwbxni / template_xqoitun)
      sendEmailWithEmailJS({
        to_email: trimmedEmail,
        to_name: trimmedName,
        from_name: founderName,
        company_name: companyName,
        role: trimmedRole,
        department: trimmedDept,
        subject: `Welcome to the ${companyName} Team on CatalystOS`
      }).catch(err => console.warn('[PeopleDirectory] EmailJS welcome attempt:', err));

      if (onAddMember) {
        await onAddMember({
          fullName: trimmedName,
          email: trimmedEmail,
          role: trimmedRole,
          department: trimmedDept,
          status: 'Active'
        });
      }
      resetForm();
      setModalOpen(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to add team member.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="people-directory-container" className="space-y-6 font-sans">
      
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <Section delay={0.05} className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4" style={{ borderBottom: '1px solid var(--c-border)' }}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider font-semibold" style={{ color: 'var(--c-accent)' }}>
              Organization & Access Control
            </span>
            <span className="w-1 h-1 rounded-full" style={{ backgroundColor: 'var(--c-border-strong)' }} />
            <span className="text-[11px] font-mono" style={{ color: 'var(--c-muted)' }}>
              {companyName}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: 'var(--c-fg)' }}>
            People & Executives
          </h1>
          <p className="text-sm mt-1 max-w-2xl" style={{ color: 'var(--c-muted)' }}>
            Venture ownership, human team members, sign-in accounts, and autonomous AI executive roster.
          </p>
        </div>

        {/* Tab Switcher: Org Hierarchy vs Human Roster vs AI Executives */}
        <div 
          className="flex items-center p-1 rounded-xl text-xs font-semibold self-start md:self-center"
          style={{
            backgroundColor: 'var(--c-surface-2)',
            border: '1px solid var(--c-border)'
          }}
        >
          <button
            onClick={() => setActiveTab('hierarchy')}
            id="tab-org-hierarchy-btn"
            className="px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 cursor-pointer"
            style={{
              backgroundColor: activeTab === 'hierarchy' ? 'var(--c-surface)' : 'transparent',
              color: activeTab === 'hierarchy' ? 'var(--c-fg)' : 'var(--c-muted)',
              fontWeight: activeTab === 'hierarchy' ? 700 : 500,
              boxShadow: activeTab === 'hierarchy' ? 'var(--shadow-sm)' : 'none'
            }}
          >
            <Network className="w-3.5 h-3.5" />
            <span>Org Hierarchy (React Flow)</span>
          </button>
          <button
            onClick={() => setActiveTab('humans')}
            id="tab-directory-roster-btn"
            className="px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 cursor-pointer"
            style={{
              backgroundColor: activeTab === 'humans' ? 'var(--c-surface)' : 'transparent',
              color: activeTab === 'humans' ? 'var(--c-fg)' : 'var(--c-muted)',
              fontWeight: activeTab === 'humans' ? 700 : 500,
              boxShadow: activeTab === 'humans' ? 'var(--shadow-sm)' : 'none'
            }}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Directory Roster ({teamMembers.length + 1})</span>
          </button>
          <button
            onClick={() => setActiveTab('agents')}
            id="tab-ai-executives-btn"
            className="px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 cursor-pointer"
            style={{
              backgroundColor: activeTab === 'agents' ? 'var(--c-surface)' : 'transparent',
              color: activeTab === 'agents' ? 'var(--c-fg)' : 'var(--c-muted)',
              fontWeight: activeTab === 'agents' ? 700 : 500,
              boxShadow: activeTab === 'agents' ? 'var(--shadow-sm)' : 'none'
            }}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>AI Executives (8)</span>
          </button>
        </div>
      </Section>

      {/* ── TAB 1: INTERACTIVE REACT FLOW ORG HIERARCHY ──────────────────── */}
      {activeTab === 'hierarchy' && (
        <div className="animate-fade-in">
          <OrgHierarchyFlow
            founder={{
              name: founderName,
              email: founderEmail,
              role: founderRole
            }}
            teamMembers={teamMembers}
            onAddMemberClick={(dept) => handleOpenModal(dept)}
            onRemoveMember={onRemoveMember}
            companyName={companyName}
          />
        </div>
      )}

      {/* ── TAB 2: HUMAN TEAM MEMBERS & ACCOUNTS ───────────────────────────── */}
      {activeTab === 'humans' && (
        <div className="space-y-8 animate-fade-in">
          
          {/* 1. Founder Card */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-widest font-bold" style={{ color: 'var(--c-muted)' }}>
                Venture Founder & Owner
              </span>
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', color: 'rgb(16, 185, 129)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                Ultimate Governance Authority
              </span>
            </div>

            <div 
              className="p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
              style={{
                backgroundColor: 'var(--c-surface)',
                border: '1px solid var(--c-border)',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <div className="flex items-center gap-4">
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center font-mono font-bold text-sm uppercase shrink-0 shadow-sm"
                  style={{ backgroundColor: 'var(--c-fg)', color: 'var(--c-bg)' }}
                >
                  {founderName.slice(0, 2)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold" style={{ color: 'var(--c-fg)' }}>
                      {founderName}
                    </span>
                    <span 
                      className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md"
                      style={{ backgroundColor: 'var(--c-surface-2)', color: 'var(--c-fg)', border: '1px solid var(--c-border)' }}
                    >
                      {founderRole}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs" style={{ color: 'var(--c-muted)' }}>
                    <Mail className="w-3.5 h-3.5" />
                    <span className="font-mono">{founderEmail}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold" style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', color: 'rgb(16, 185, 129)' }}>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Active Founder
                </span>
              </div>
            </div>
          </section>

          {/* 2. Company Accounts (Sign-in access) */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-mono uppercase tracking-widest font-bold" style={{ color: 'var(--c-muted)' }}>
                  Company Accounts (Sign-In Access)
                </span>
                <p className="text-xs mt-0.5" style={{ color: 'var(--c-muted)' }}>
                  Authenticated accounts who can sign in to {companyName} and participate in operations.
                </p>
              </div>

              {onInviteMember && (
                <button
                  onClick={() => setInviteOpen(true)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer transition-all"
                  style={{
                    backgroundColor: 'var(--c-fg)',
                    color: 'var(--c-bg)'
                  }}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Invite Member</span>
                </button>
              )}
            </div>

            {memberships.length === 0 ? (
              <div 
                className="p-8 rounded-2xl text-center text-xs"
                style={{ backgroundColor: 'var(--c-surface)', border: '1px dashed var(--c-border)', color: 'var(--c-muted)' }}
              >
                No additional sign-in accounts created yet. Use "Invite Member" above to grant portal access.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {memberships.map((member) => (
                  <div
                    key={member.id}
                    className="p-4 rounded-xl flex items-center justify-between gap-3 transition-all"
                    style={{
                      backgroundColor: 'var(--c-surface)',
                      border: '1px solid var(--c-border)',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div 
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: 'var(--c-surface-2)', border: '1px solid var(--c-border)' }}
                      >
                        <ShieldCheck className="w-4 h-4" style={{ color: 'var(--c-accent)' }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate" style={{ color: 'var(--c-fg)' }}>{member.fullName}</p>
                        <p className="text-[11px] font-mono truncate" style={{ color: 'var(--c-muted)' }}>{member.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span 
                        className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md font-bold"
                        style={{ backgroundColor: 'var(--c-surface-2)', color: 'var(--c-fg)', border: '1px solid var(--c-border)' }}
                      >
                        {member.role}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', color: 'rgb(16, 185, 129)' }}>
                        {member.status}
                      </span>
                      {member.isOwner ? (
                        <span 
                          className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md"
                          style={{ backgroundColor: 'var(--c-surface-2)', color: 'var(--c-muted)', border: '1px solid var(--c-border)' }}
                        >
                          Owner
                        </span>
                      ) : onRemoveMembership ? (
                        <button
                          onClick={() => onRemoveMembership(member.id)}
                          title={`Revoke access for ${member.fullName}`}
                          className="p-1.5 rounded-lg transition-colors cursor-pointer"
                          style={{ color: 'var(--c-muted)' }}
                        >
                          <UserMinus className="w-3.5 h-3.5 hover:text-rose-500" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 3. Team Member Roster (Roster Only) */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-mono uppercase tracking-widest font-bold" style={{ color: 'var(--c-muted)' }}>
                  Operational Team Roster
                </span>
                <p className="text-xs mt-0.5" style={{ color: 'var(--c-muted)' }}>
                  Core employees, contract engineers, and department heads tracked in venture memory.
                </p>
              </div>

              {onAddMember && (
                <button
                  onClick={handleOpenModal}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                  style={{
                    backgroundColor: 'var(--c-surface-2)',
                    border: '1px solid var(--c-border)',
                    color: 'var(--c-fg)'
                  }}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Add Team Member</span>
                </button>
              )}
            </div>

            {rosterOnly.length === 0 ? (
              <div 
                className="p-10 rounded-2xl text-center space-y-2"
                style={{ backgroundColor: 'var(--c-surface)', border: '1px dashed var(--c-border)' }}
              >
                <Users className="w-6 h-6 mx-auto" style={{ color: 'var(--c-muted)' }} />
                <h4 className="text-xs font-bold" style={{ color: 'var(--c-fg)' }}>No roster-only members</h4>
                <p className="text-xs max-w-sm mx-auto" style={{ color: 'var(--c-muted)' }}>
                  All active team members currently hold company accounts, or click below to track new roster members.
                </p>
              </div>
            ) : (
              <div 
                className="rounded-2xl overflow-hidden divide-y"
                style={{ backgroundColor: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
              >
                {rosterOnly.map((member) => {
                  const displayName = member.fullName || member.name || 'Team Member';
                  const memberRole = member.role || 'Member';
                  const memberDept = member.department || 'General';
                  const memberEmail = member.email || '';

                  return (
                    <div
                      key={member.id}
                      className="p-4 flex items-center justify-between gap-4 transition-colors"
                      style={{ borderBottom: '1px solid var(--c-border)' }}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div 
                          className="w-9 h-9 rounded-xl flex items-center justify-center font-mono font-bold text-xs uppercase shrink-0"
                          style={{ backgroundColor: 'var(--c-surface-2)', color: 'var(--c-fg)', border: '1px solid var(--c-border)' }}
                        >
                          {displayName.slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold truncate" style={{ color: 'var(--c-fg)' }}>{displayName}</h4>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] font-medium" style={{ color: 'var(--c-muted)' }}>
                            <span style={{ color: 'var(--c-fg)' }}>{memberRole}</span>
                            <span>·</span>
                            <span>{memberDept}</span>
                            {memberEmail && (
                              <>
                                <span>·</span>
                                <span className="font-mono text-[10px]">{memberEmail}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span 
                          className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium"
                          style={{ backgroundColor: 'var(--c-surface-2)', color: 'var(--c-muted)', border: '1px solid var(--c-border)' }}
                        >
                          Roster Only
                        </span>

                        {onRemoveMember && (
                          <button
                            onClick={() => onRemoveMember(member.id)}
                            title="Remove member"
                            className="p-1.5 rounded-lg transition-colors cursor-pointer"
                            style={{ color: 'var(--c-muted)' }}
                          >
                            <Trash2 className="w-3.5 h-3.5 hover:text-rose-500" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* 4. Pending Invitations */}
          {(pendingInvitations.length > 0 || closedInvitations.length > 0) && (
            <section className="space-y-3">
              <span className="text-xs font-mono uppercase tracking-widest font-bold" style={{ color: 'var(--c-muted)' }}>
                Invitations Sent ({pendingInvitations.length} Pending)
              </span>

              <div className="space-y-2">
                {[...pendingInvitations, ...closedInvitations].map((invite) => (
                  <div
                    key={invite.id}
                    className="p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs"
                    style={{
                      backgroundColor: 'var(--c-surface)',
                      border: '1px solid var(--c-border)'
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Mail className="w-4 h-4 shrink-0" style={{ color: 'var(--c-muted)' }} />
                      <div className="min-w-0">
                        <span className="font-semibold truncate block" style={{ color: 'var(--c-fg)' }}>{invite.email}</span>
                        <span className="text-[10px] font-mono" style={{ color: 'var(--c-muted)' }}>
                          Role: {invite.role} · Sent: {new Date(invite.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase ${
                        invite.status === 'PENDING' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/25' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/25'
                      }`}>
                        {invite.status}
                      </span>

                      {invite.status !== 'ACCEPTED' && onResendInvitation && (
                        <button
                          onClick={() => onResendInvitation(invite.id)}
                          title="Resend invitation link"
                          className="p-1 cursor-pointer"
                          style={{ color: 'var(--c-muted)' }}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {invite.status === 'PENDING' && onRevokeInvitation && (
                        <button
                          onClick={() => onRevokeInvitation(invite.id)}
                          className="p-1 cursor-pointer"
                          style={{ color: 'var(--c-muted)' }}
                          title="Revoke invitation"
                        >
                          <Ban className="w-3.5 h-3.5 hover:text-rose-500" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>
      )}

      {/* ── TAB 2: AI EXECUTIVE COUNCIL SUITE ──────────────────────────────── */}
      {activeTab === 'agents' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-mono uppercase tracking-widest font-bold" style={{ color: 'var(--c-muted)' }}>
                Autonomous Executive Council
              </span>
              <p className="text-xs mt-0.5" style={{ color: 'var(--c-muted)' }}>
                8 specialized cognitive agents executing corporate functions within founder governance guardrails.
              </p>
            </div>
            <span 
              className="px-3 py-1 rounded-full text-xs font-mono font-bold"
              style={{ backgroundColor: 'var(--c-surface-2)', color: 'var(--c-fg)', border: '1px solid var(--c-border)' }}
            >
              8 Active Agents
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {AI_EXECUTIVES.map((agent) => (
              <div
                key={agent.id}
                className="p-5 rounded-2xl flex flex-col justify-between space-y-4 transition-all"
                style={{
                  backgroundColor: 'var(--c-surface)',
                  border: '1px solid var(--c-border)',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span 
                      className="px-2 py-0.5 text-[9px] font-mono font-bold uppercase rounded-md"
                      style={{ backgroundColor: 'var(--c-surface-2)', color: 'var(--c-fg)', border: '1px solid var(--c-border)' }}
                    >
                      AI Executive
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-500">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Active
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold" style={{ color: 'var(--c-fg)' }}>{agent.name}</h3>
                    <p className="text-xs font-semibold" style={{ color: 'var(--c-muted)' }}>{agent.title}</p>
                    <span className="text-[10px] font-mono block mt-0.5" style={{ color: 'var(--c-muted)' }}>{agent.department}</span>
                  </div>

                  <p className="text-xs leading-relaxed line-clamp-3" style={{ color: 'var(--c-muted)' }}>
                    {agent.mandate}
                  </p>
                </div>

                <div className="pt-3 space-y-1.5 text-[11px] font-mono" style={{ borderTop: '1px solid var(--c-border)' }}>
                  <div className="flex items-center justify-between" style={{ color: 'var(--c-muted)' }}>
                    <span>Autonomy:</span>
                    <span className="font-bold" style={{ color: 'var(--c-fg)' }}>{agent.autonomy}</span>
                  </div>
                  <div className="flex items-center justify-between" style={{ color: 'var(--c-muted)' }}>
                    <span>Guardrail:</span>
                    <span className="font-bold text-emerald-500">{agent.guardrail}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── INVITE MODAL ───────────────────────────────────────────────────── */}
      {inviteOpen && onInviteMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs">
          <div 
            className="w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-5 animate-scale-up"
            style={{
              backgroundColor: 'var(--c-surface)',
              border: '1px solid var(--c-border)'
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold" style={{ color: 'var(--c-fg)' }}>Invite Team Member</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--c-muted)' }}>
                  Sends an invitation email via Gmail SMTP with a secure token to join {companyName}.
                </p>
              </div>
              <button
                onClick={() => { setInviteOpen(false); setInviteError(null); }}
                className="p-1 rounded-full cursor-pointer"
                style={{ color: 'var(--c-muted)' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] uppercase font-mono font-bold block mb-1" style={{ color: 'var(--c-muted)' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none"
                  style={{
                    backgroundColor: 'var(--c-surface-2)',
                    border: '1px solid var(--c-border)',
                    color: 'var(--c-fg)'
                  }}
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-mono font-bold block mb-1" style={{ color: 'var(--c-muted)' }}>
                  Access Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none"
                  style={{
                    backgroundColor: 'var(--c-surface-2)',
                    border: '1px solid var(--c-border)',
                    color: 'var(--c-fg)'
                  }}
                >
                  <option value="">Select a role…</option>
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                <p className="text-[10px] mt-1" style={{ color: 'var(--c-muted)' }}>
                  {ASSIGNABLE_ROLES.find(r => r.value === inviteRole)?.hint || 'Determines which modules and AI agents they can access.'}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] uppercase font-mono font-bold" style={{ color: 'var(--c-muted)' }}>
                    Department / Domain
                  </label>
                  <span className="text-[10px] font-mono text-emerald-500 font-semibold flex items-center gap-1">
                    <Check className="w-3 h-3" /> EmailJS Enabled
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="Select domain below or enter custom department"
                  value={inviteDepartment}
                  onChange={(e) => setInviteDepartment(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none"
                  style={{
                    backgroundColor: 'var(--c-surface-2)',
                    border: '1px solid var(--c-border)',
                    color: 'var(--c-fg)'
                  }}
                  required
                />
                
                {/* Domain Quick Preset Selector with custom department add */}
                <div className="flex flex-wrap items-center gap-1 mt-2">
                  {allAvailableDepartments.slice(0, 8).map((d) => {
                    const isSelected = inviteDepartment === d;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setInviteDepartment(d)}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                        }`}
                      >
                        {d}
                      </button>
                    );
                  })}
                  {!showNewDeptInput ? (
                    <button
                      type="button"
                      onClick={() => setShowNewDeptInput(true)}
                      className="px-2 py-0.5 rounded text-[10px] font-medium text-sky-500 hover:bg-sky-500/10 transition-all flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Add Dept
                    </button>
                  ) : (
                    <div className="flex items-center gap-1 mt-1">
                      <input
                        type="text"
                        placeholder="New department name"
                        value={newDeptInput}
                        onChange={(e) => setNewDeptInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const added = handleAddCustomDepartment(newDeptInput);
                            if (added) setInviteDepartment(added);
                          }
                        }}
                        className="px-2 py-0.5 rounded text-[10px] outline-none border border-sky-400 bg-transparent text-slate-800 dark:text-slate-100"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const added = handleAddCustomDepartment(newDeptInput);
                          if (added) setInviteDepartment(added);
                        }}
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500 text-white cursor-pointer"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowNewDeptInput(false)}
                        className="px-1 py-0.5 text-[10px] text-slate-400 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {inviteError && (
                <div className="p-3 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/25 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{inviteError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setInviteOpen(false); setInviteError(null); }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                  style={{ color: 'var(--c-muted)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-semibold shadow-sm cursor-pointer transition-all"
                  style={{
                    backgroundColor: 'var(--c-fg)',
                    color: 'var(--c-bg)'
                  }}
                >
                  {inviteSubmitting ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ADD TEAM MEMBER MODAL ──────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs">
          <div 
            className="rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5 animate-scale-up"
            style={{
              backgroundColor: 'var(--c-surface)',
              border: '1px solid var(--c-border)'
            }}
          >
            <div className="flex items-start justify-between pb-2" style={{ borderBottom: '1px solid var(--c-border)' }}>
              <div>
                <h3 className="text-base font-bold" style={{ color: 'var(--c-fg)' }}>Add Team Member</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--c-muted)' }}>
                  Adds member to venture roster and automatically dispatches onboarding email via Gmail SMTP.
                </p>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-1 rounded-full cursor-pointer"
                style={{ color: 'var(--c-muted)' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/25 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="text-[10px] uppercase font-mono font-bold block mb-1" style={{ color: 'var(--c-muted)' }}>Full Name</label>
                <input
                  type="text"
                  placeholder="e.g., Alex Chen"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none"
                  style={{
                    backgroundColor: 'var(--c-surface-2)',
                    border: '1px solid var(--c-border)',
                    color: 'var(--c-fg)'
                  }}
                  required
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-mono font-bold block mb-1" style={{ color: 'var(--c-muted)' }}>Email</label>
                <input
                  type="email"
                  placeholder="e.g., alex@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none"
                  style={{
                    backgroundColor: 'var(--c-surface-2)',
                    border: '1px solid var(--c-border)',
                    color: 'var(--c-fg)'
                  }}
                  required
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-mono font-bold block mb-1" style={{ color: 'var(--c-muted)' }}>Role Title</label>
                <input
                  type="text"
                  placeholder="e.g., Lead Integrations Engineer, Growth Lead, Solutions Architect"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none"
                  style={{
                    backgroundColor: 'var(--c-surface-2)',
                    border: '1px solid var(--c-border)',
                    color: 'var(--c-fg)'
                  }}
                  required
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {['Operations', 'Growth Lead', 'Finance Analyst', 'HR Specialist', 'Software Engineer'].map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] uppercase font-mono font-bold" style={{ color: 'var(--c-muted)' }}>Domain / Department</label>
                  <span className="text-[10px] font-mono text-slate-400">Branches under Founder</span>
                </div>
                <input
                  type="text"
                  placeholder="Select domain below or enter custom department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none"
                  style={{
                    backgroundColor: 'var(--c-surface-2)',
                    border: '1px solid var(--c-border)',
                    color: 'var(--c-fg)'
                  }}
                  required
                />
                
                {/* Domain Quick Preset Selector with custom department add */}
                <div className="flex flex-wrap items-center gap-1 mt-2">
                  {allAvailableDepartments.slice(0, 8).map((d) => {
                    const isSelected = department === d;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDepartment(d)}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                        }`}
                      >
                        {d}
                      </button>
                    );
                  })}
                  {!showNewDeptInput ? (
                    <button
                      type="button"
                      onClick={() => setShowNewDeptInput(true)}
                      className="px-2 py-0.5 rounded text-[10px] font-medium text-sky-500 hover:bg-sky-500/10 transition-all flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Add Dept
                    </button>
                  ) : (
                    <div className="flex items-center gap-1 mt-1">
                      <input
                        type="text"
                        placeholder="New department name"
                        value={newDeptInput}
                        onChange={(e) => setNewDeptInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const added = handleAddCustomDepartment(newDeptInput);
                            if (added) setDepartment(added);
                          }
                        }}
                        className="px-2 py-0.5 rounded text-[10px] outline-none border border-sky-400 bg-transparent text-slate-800 dark:text-slate-100"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const added = handleAddCustomDepartment(newDeptInput);
                          if (added) setDepartment(added);
                        }}
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500 text-white cursor-pointer"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowNewDeptInput(false)}
                        className="px-1 py-0.5 text-[10px] text-slate-400 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3" style={{ borderTop: '1px solid var(--c-border)' }}>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                  style={{ color: 'var(--c-muted)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-semibold shadow-sm cursor-pointer transition-all"
                  style={{
                    backgroundColor: 'var(--c-fg)',
                    color: 'var(--c-bg)'
                  }}
                >
                  {isSubmitting ? 'Saving...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
