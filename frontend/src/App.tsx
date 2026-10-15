/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { StartupProfile, Agent, Initiative, Deliverable, KnowledgeFile, DecisionRecord, TeamMember, UserPermissions, CompanyInvitation, DelegatedTask } from './types';
import SaaSDashboard from './components/SaaSDashboard';
import AgentWorkspace from './components/AgentWorkspace';
import WorkflowCanvas from './components/WorkflowCanvas';
import ApprovalQueue from './components/ApprovalQueue';
import KnowledgeBase from './components/KnowledgeBase';
import DecisionLog from './components/DecisionLog';
import ScenarioSimulator from './components/ScenarioSimulator';
import PeopleDirectory from './components/PeopleDirectory';
import { INITIAL_DEMO_TEAM_MEMBERS } from './components/OrgHierarchyFlow';
import AcceptInvitation from './components/AcceptInvitation';
import EmployeeWorkspace from './components/EmployeeWorkspace';
import ExecutiveCouncilWorkspace from './components/ExecutiveCouncilWorkspace';
import RoleAwareDashboard from './components/RoleAwareDashboard';
import MultiAgentOrchestrationDashboard from './components/MultiAgentOrchestrationDashboard';
import { 
  Bell,
  CheckSquare, 
  FileText, 
  Activity,
  Menu,
  X,
  Sparkles,
  RefreshCw,
  Search,
  Shield,
  LogOut,
  ArrowRight,
  ChevronDown,
  Users,
  TrendingUp,
  Layers,
  Database,
  Briefcase,
  Radio,
  Sun,
  Moon,
  Building,
  Command,
  LayoutDashboard,
  ShieldCheck,
  BookOpen,
  GitMerge,
  SlidersHorizontal,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Cpu
} from 'lucide-react';
import CommandPalette from './components/CommandPalette';
import { useAuth } from './context/AuthContext';
import AuthScreen from './components/AuthScreen';
import CatalystLogo from './components/CatalystLogo';
import CatalystOsChatbot from './components/chatbot/CatalystOsChatbot';
import NotificationPanel from './components/NotificationPanel';
import { sendEmailWithEmailJS } from './services/emailJsService';
import MouseSpotlight from './components/MouseSpotlight';
import AuroraBackground from './components/AuroraBackground';
import Footer from './components/Footer';
import VoiceStudioPanel from './components/voice/VoiceStudioPanel';
import SettingsModal from './components/SettingsModal';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, logout, apiFetch, loginAsDemo } = useAuth();
  
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean>(() => {
    try {
      const savedUserStr = localStorage.getItem('catalystos_user') || localStorage.getItem('catalystos_demo_user');
      if (savedUserStr) {
        const u = JSON.parse(savedUserStr);
        if (u?.id) {
          return localStorage.getItem(`catalystos_onboarding_completed_${u.id}`) === 'true';
        }
      }
    } catch {}
    return false;
  });

  const [isCheckingStartup, setIsCheckingStartup] = useState<boolean>(false);
  const [scrolled, setScrolled] = useState<boolean>(false);
  const [isVoiceStudioOpen, setIsVoiceStudioOpen] = useState<boolean>(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === 'true') {
      loginAsDemo();
      localStorage.setItem('catalystos_onboarding_completed_usr_founder_demo', 'true');
      try {
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch {}
      navigate('/dashboard');
    }
  }, []);

  useEffect(() => {
    // Reset scoped collections so a previous session or other user's data never leaks
    setKnowledge([]);
    setApprovals([]);
    setDecisions([]);
    setInitiatives([]);
    setTeamMembers([]);

    if (user) {
      const isAlreadyMarked = localStorage.getItem(`catalystos_onboarding_completed_${user.id}`) === 'true';
      setIsCheckingStartup(true);

      apiFetch('/api/startup')
        .then(res => res.json())
        .then(data => {
          if (data && data.onboarded && data.name) {
            setOnboardingCompleted(true);
            setStartup(data);
            try {
              localStorage.setItem(`catalystos_onboarding_completed_${user.id}`, 'true');
              localStorage.setItem(`catalystos_startup_${user.id}`, JSON.stringify(data));
            } catch {}
          } else {
            setOnboardingCompleted(false);
            setStartup(null);
            try {
              localStorage.removeItem(`catalystos_onboarding_completed_${user.id}`);
              localStorage.removeItem(`catalystos_startup_${user.id}`);
            } catch {}
          }
        })
        .catch((err) => {
          console.warn('[App] Startup profile fetch warning:', err);
          setOnboardingCompleted(isAlreadyMarked);
        })
        .finally(() => {
          setIsCheckingStartup(false);
        });
    } else {
      setOnboardingCompleted(false);
      setIsCheckingStartup(false);
      setStartup(null);
    }
  }, [user]);

  const handleOnboardingComplete = async (onboardingData: any) => {
    try {
      const res = await apiFetch('/api/startup/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(onboardingData)
      });
      if (res.ok) {
        const result = await res.json();
        if (result.startup) {
          setStartup(result.startup);
          if (user?.id) {
            try {
              localStorage.setItem(`catalystos_startup_${user.id}`, JSON.stringify(result.startup));
            } catch {}
          }
        }
      }
    } catch (err) {
      console.error('[Onboarding] Error submitting onboarding data:', err);
    }
    if (user?.id) {
      localStorage.setItem(`catalystos_onboarding_completed_${user.id}`, 'true');
    }
    setOnboardingCompleted(true);
    await hydrateState();
  };

  // ── Derive activeTab from URL pathname ───────────────────────────────────────
  const getActiveTabFromPath = (pathname: string): 'dashboard' | 'workspace' | 'approvals' | 'scenarios' | 'decisions' | 'knowledge' | 'workflows' | 'agents' | 'council' | 'people' | 'orchestration' => {
    if (pathname.includes('/orchestration')) return 'orchestration';
    if (pathname.includes('/council')) return 'council';
    if (pathname.includes('/workspace')) return 'workspace';
    if (pathname.includes('/approvals')) return 'approvals';
    if (pathname.includes('/scenarios')) return 'scenarios';
    if (pathname.includes('/decisions')) return 'decisions';
    if (pathname.includes('/knowledge')) return 'knowledge';
    if (pathname.includes('/workflows')) return 'workflows';
    if (pathname.includes('/people')) return 'people';
    if (pathname.includes('/agents')) return 'agents';
    return 'dashboard';
  };

  const activeTab = getActiveTabFromPath(location.pathname);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('ceo');
  const [agentsExpanded, setAgentsExpanded] = useState<boolean>(true);
  const [notificationsOpen, setNotificationsOpen] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [selectedTaskIdForWorkspace, setSelectedTaskIdForWorkspace] = useState<string | null>(null);

  // Sync selected agent with URL if on /dashboard/agents/:agentId
  useEffect(() => {
    const match = location.pathname.match(/\/agents\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      setSelectedAgentId(match[1]);
    }
  }, [location.pathname]);

  const handleTabChange = (tab: 'dashboard' | 'workspace' | 'approvals' | 'scenarios' | 'decisions' | 'knowledge' | 'workflows' | 'agents' | 'council' | 'people' | 'orchestration', agentId?: string) => {
    if (tab === 'agents') {
      const targetAgent = agentId || selectedAgentId || 'ceo';
      setSelectedAgentId(targetAgent);
      navigate(`/dashboard/agents/${targetAgent}`);
    } else if (tab === 'dashboard') {
      navigate('/dashboard');
    } else {
      navigate(`/dashboard/${tab}`);
    }
  };

  const handleSelectAgent = (agentId: string) => {
    setSelectedAgentId(agentId);
    navigate(`/dashboard/agents/${agentId}`);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const DEFAULT_STARTUP_PROFILE: StartupProfile = {
    name: 'CatalystOS Startup',
    industry: 'B2B SaaS / Developer Tools',
    description: 'Enterprise-grade automated workflow orchestration platform for hybrid cloud environments.',
    fundingStage: 'Pre-Seed',
    cashBalance: 245000,
    burnRate: 18500,
    runwayMonths: 13.2,
    healthScore: 78,
    metrics: {
      velocity: 65,
      financialHealth: 72,
      legalCompliance: 80,
      growthRate: 45,
      operationsEfficiency: 70,
    },
  };

  const DEFAULT_AGENTS: Agent[] = [
    {
      id: 'ceo',
      name: 'CEO Orchestrator (Atlas)',
      role: 'CEO',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
      description: 'Autonomous corporate strategist. Formulates broad roadmaps and coordinates specialist executives.',
      status: 'idle',
      keyMetric: 'Company Velocity',
      metricValue: '78%',
      color: 'indigo',
    },
    {
      id: 'finance',
      name: 'Chief Financial Officer (Aura)',
      role: 'Finance',
      avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
      description: 'Automated Chief Financial Officer. Optimizes unit economics, burn rates, and deterministic runways.',
      status: 'idle',
      keyMetric: 'Financial Health',
      metricValue: '85%',
      color: 'emerald',
    },
    {
      id: 'talent',
      name: 'Head of People & HR (Echo)',
      role: 'Talent',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
      description: 'AI Recruiting and HR Executive. Strategizes resource allocation and compensation structures.',
      status: 'idle',
      keyMetric: 'Hiring Speed',
      metricValue: '28 days',
      color: 'pink',
    },
    {
      id: 'growth',
      name: 'VP of Growth (Vector)',
      role: 'Growth',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      description: 'Autonomous Marketing and Acquisition Officer. Focuses on customer acquisition and GTM loops.',
      status: 'idle',
      keyMetric: 'Growth Index',
      metricValue: '82%',
      color: 'amber',
    },
    {
      id: 'legal',
      name: 'General Counsel (Nexus)',
      role: 'Legal',
      avatar: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=150',
      description: 'Automated General Counsel. Drafts contracts, assesses IP protection, and reviews compliance.',
      status: 'idle',
      keyMetric: 'Compliance Index',
      metricValue: '92%',
      color: 'rose',
    },
    {
      id: 'operations',
      name: 'Chief Operating Officer (Helix)',
      role: 'Operations',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      description: 'Chief Operating Officer. Orchestrates milestone deliveries, sprint cadences, and systems reliability.',
      status: 'idle',
      keyMetric: 'Ops Efficiency',
      metricValue: '88%',
      color: 'sky',
    },
    {
      id: 'investment',
      name: 'Head of Capital (Apex)',
      role: 'Investment',
      avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150',
      description: 'Investor Relations & Capital Executive. Formulates cap table simulations and fundraising models.',
      status: 'idle',
      keyMetric: 'Capital Readiness',
      metricValue: 'Pre-Seed',
      color: 'purple',
    },
    {
      id: 'auditor',
      name: 'Verification Auditor (Sentry)',
      role: 'Auditor',
      avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150',
      description: 'Governance & Verification Officer. Audits calculations, checks evidence grounding, and enforces gates.',
      status: 'idle',
      keyMetric: 'Verification Pass',
      metricValue: '100%',
      color: 'blue',
    },
  ];

  const [startup, setStartup] = useState<StartupProfile | null>(() => {
    try {
      const savedUserStr = localStorage.getItem('catalystos_user') || localStorage.getItem('catalystos_demo_user');
      if (savedUserStr) {
        const u = JSON.parse(savedUserStr);
        if (u?.id) {
          const cached = localStorage.getItem(`catalystos_startup_${u.id}`);
          if (cached) return JSON.parse(cached);
        }
      }
    } catch {}
    return DEFAULT_STARTUP_PROFILE;
  });
  const [agents, setAgents] = useState<Agent[]>(DEFAULT_AGENTS);
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [approvals, setApprovals] = useState<Deliverable[]>([]);
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeFile[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(() => {
    try {
      const savedUserStr = localStorage.getItem('catalystos_user') || localStorage.getItem('catalystos_demo_user');
      if (savedUserStr) {
        const u = JSON.parse(savedUserStr);
        if (u?.id) {
          const cached = localStorage.getItem(`catalystos_team_${u.id}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
          }
        }
      }
    } catch {}
    return INITIAL_DEMO_TEAM_MEMBERS;
  });

  // P1 Task 8 — accounts with real access (Membership) and pending invitations.
  const [memberships, setMemberships] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<CompanyInvitation[]>([]);

  // Phase A3 — Council decomposed work orders and delegated tasks.
  const [tasks, setTasks] = useState<DelegatedTask[]>([]);

  // P1 Task 7 — effective permissions, mirrored from the backend.
  // Founder-equivalent defaults keep the UI usable until /api/permissions/me answers.
  const [permissions, setPermissions] = useState<UserPermissions>({
    role: 'FOUNDER',
    areas: ['dashboard', 'approvals', 'knowledge', 'workflows', 'agents', 'council', 'people', 'scenarios', 'decisions'],
    agents: ['CEO', 'Finance', 'Talent', 'Growth', 'Legal', 'Operations', 'Investment', 'Auditor'],
    actions: [
      'startup:write', 'approvals:review', 'knowledge:write',
      'people:read', 'people:write', 'people:access',
      'orchestrate:execute', 'orchestrate:request'
    ]
  });

  const hasPermission = (action: UserPermissions['actions'][number]) => permissions.actions.includes(action);
  const isEmployeeRole = (role?: string) => Boolean(role && !['FOUNDER', 'ADMIN', 'Founder'].includes(role.toUpperCase()));

  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const hydrateTasks = async () => {
    if (!user) return;
    try {
      const res = await apiFetch('/api/tasks');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setTasks(data);
      }
    } catch (err) {
      console.warn('[App] Tasks refresh warning:', err);
    }
  };

  const hydrateState = async () => {
    if (!user) return;
    try {
      const userRoleUpper = (user.role || '').toUpperCase();
      const isEmployee = ['HR', 'FINANCE', 'GROWTH', 'OPERATIONS'].includes(userRoleUpper);

      // Fast-path role-scoped loading for employees: avoids 7 unauthorized founder roundtrips
      if (isEmployee) {
        const [startupRes, agentsRes, permissionsRes, tasksRes] = await Promise.allSettled([
          apiFetch('/api/startup'),
          apiFetch('/api/agents'),
          apiFetch('/api/permissions/me'),
          apiFetch('/api/tasks'),
        ]);

        if (tasksRes.status === 'fulfilled' && tasksRes.value.ok) {
          const taskData = await tasksRes.value.json();
          if (Array.isArray(taskData)) setTasks(taskData);
        }
        if (permissionsRes.status === 'fulfilled' && permissionsRes.value.ok) {
          const perms = await permissionsRes.value.json();
          if (perms && Array.isArray(perms.areas) && Array.isArray(perms.actions)) setPermissions(perms);
        }
        if (startupRes.status === 'fulfilled' && startupRes.value.ok) setStartup(await startupRes.value.json());
        if (agentsRes.status === 'fulfilled' && agentsRes.value.ok) setAgents(await agentsRes.value.json());
        return;
      }

      const results = await Promise.allSettled([
        apiFetch('/api/startup'),
        apiFetch('/api/agents'),
        apiFetch('/api/initiatives'),
        apiFetch('/api/approvals'),
        apiFetch('/api/decisions'),
        apiFetch('/api/knowledge'),
        apiFetch('/api/team'),
        apiFetch('/api/permissions/me'),
        apiFetch('/api/invitations'),
        apiFetch('/api/memberships'),
        apiFetch('/api/tasks'),
      ]);

      const [startupRes, agentsRes, initiativesRes, approvalsRes, decisionsRes, knowledgeRes, teamRes, permissionsRes, invitationsRes, membershipsRes, tasksRes] = results;

      if (invitationsRes.status === 'fulfilled' && invitationsRes.value.ok) {
        const data = await invitationsRes.value.json();
        if (Array.isArray(data)) setInvitations(data);
      }
      if (membershipsRes.status === 'fulfilled' && membershipsRes.value.ok) {
        const data = await membershipsRes.value.json();
        if (Array.isArray(data)) setMemberships(data);
      }
      if (tasksRes.status === 'fulfilled' && tasksRes.value.ok) {
        const taskData = await tasksRes.value.json();
        if (Array.isArray(taskData)) setTasks(taskData);
      }

      if (permissionsRes.status === 'fulfilled' && permissionsRes.value.ok) {
        const perms = await permissionsRes.value.json();
        if (perms && Array.isArray(perms.areas) && Array.isArray(perms.actions)) setPermissions(perms);
      }

      if (startupRes.status === 'fulfilled' && startupRes.value.ok) setStartup(await startupRes.value.json());
      if (agentsRes.status === 'fulfilled' && agentsRes.value.ok) setAgents(await agentsRes.value.json());
      if (initiativesRes.status === 'fulfilled' && initiativesRes.value.ok) setInitiatives(await initiativesRes.value.json());
      if (approvalsRes.status === 'fulfilled' && approvalsRes.value.ok) setApprovals(await approvalsRes.value.json());
      if (decisionsRes.status === 'fulfilled' && decisionsRes.value.ok) setDecisions(await decisionsRes.value.json());
      if (knowledgeRes.status === 'fulfilled' && knowledgeRes.value.ok) setKnowledge(await knowledgeRes.value.json());
      if (teamRes.status === 'fulfilled' && teamRes.value.ok) {
        const teamData = await teamRes.value.json();
        if (Array.isArray(teamData)) {
          setTeamMembers(teamData);
          if (user?.id) {
            try {
              localStorage.setItem(`catalystos_team_${user.id}`, JSON.stringify(teamData));
            } catch {}
          }
        }
      }
    } catch (err) {
      console.error('Error hydrating applet state:', err);
    }
  };

  const handleAddTeamMember = async (newMember: { fullName: string; email: string; role: string; department: string; status?: 'Active' | 'Invited' }) => {
    const memberName = newMember.fullName;

    // Dispatch welcome notification via EmailJS (service_6dwbxni / template_xqoitun)
    sendEmailWithEmailJS({
      to_email: newMember.email,
      to_name: newMember.fullName,
      from_name: user?.name || 'The Founder',
      company_name: startup.name,
      role: newMember.role,
      department: newMember.department,
      subject: `Welcome to the ${startup.name} Team on CatalystOS`
    }).catch(err => console.warn('[App] Client EmailJS welcome error:', err));

    try {
      const res = await apiFetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMember)
      });
      if (res.ok) {
        const created = await res.json();
        setTeamMembers(prev => {
          const updated = [created, ...prev.filter(m => m.id !== created.id)];
          if (user?.id) {
            try {
              localStorage.setItem(`catalystos_team_${user.id}`, JSON.stringify(updated));
            } catch {}
          }
          return updated;
        });
        await refreshInvitations();
        showToast(`Team member "${memberName}" added & invitation dispatched via EmailJS.`, 'success');
        return;
      }
    } catch (err) {
      console.warn('[App] Team member API error, fallback to local:', err);
    }

    // Local fallback
    const fallbackMember: TeamMember = {
      id: window.crypto?.randomUUID?.() || `member_${Date.now()}`,
      fullName: newMember.fullName,
      name: newMember.fullName,
      email: newMember.email,
      role: newMember.role,
      department: newMember.department,
      status: newMember.status || 'Active',
      joinedAt: new Date().toISOString()
    };
    setTeamMembers(prev => {
      const updated = [fallbackMember, ...prev];
      if (user?.id) {
        try {
          localStorage.setItem(`catalystos_team_${user.id}`, JSON.stringify(updated));
        } catch {}
      }
      return updated;
    });
    showToast(`Team member "${memberName}" added to venture.`, 'success');
  };

  // ── P1 Task 9: revoke a company account's access ──────────────────────────
  const refreshMemberships = async () => {
    try {
      const res = await apiFetch('/api/memberships');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setMemberships(data);
      }
    } catch (err) {
      console.warn('[App] Membership refresh warning:', err);
    }
  };

  const handleRemoveMembership = async (id: string) => {
    const res = await apiFetch(`/api/memberships/${id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(data?.error || 'That member could not be removed.', 'error');
      return;
    }
    // The person may still exist as a roster entry, so refresh both lists.
    await Promise.all([refreshMemberships(), hydrateTeam()]);
    showToast(`${data.fullName || 'Member'} no longer has access to the workspace.`, 'success');
  };

  const hydrateTeam = async () => {
    try {
      const res = await apiFetch('/api/team');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setTeamMembers(data);
          if (user?.id) {
            try {
              localStorage.setItem(`catalystos_team_${user.id}`, JSON.stringify(data));
            } catch {}
          }
        }
      }
    } catch (err) {
      console.warn('[App] Team refresh warning:', err);
    }
  };

  // ── P1 Task 8: invitations ────────────────────────────────────────────────
  const refreshInvitations = async () => {
    try {
      const res = await apiFetch('/api/invitations');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setInvitations(data);
      }
    } catch (err) {
      console.warn('[App] Invitation refresh warning:', err);
    }
  };

  const handleInviteMember = async (invite: { email: string; role: string; department?: string }) => {
    // 1. Dispatch invitation email via EmailJS (service_6dwbxni / template_xqoitun)
    sendEmailWithEmailJS({
      to_email: invite.email,
      to_name: invite.email.split('@')[0],
      from_name: user?.name || 'The Founder',
      company_name: startup.name,
      role: invite.role,
      department: invite.department || 'Operations',
      subject: `Invitation to join ${startup.name} on CatalystOS`
    }).catch(err => console.warn('[App] Client EmailJS invite error:', err));

    const res = await apiFetch('/api/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invite)
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data?.error || 'The invitation could not be created.', 'error');
      throw new Error(data?.error || 'Invitation failed');
    }
    await refreshInvitations();
    showToast(`Invitation dispatched to ${invite.email} via EmailJS.`, 'success');
  };

  const handleRevokeInvitation = async (id: string) => {
    const res = await apiFetch(`/api/invitations/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(data?.error || 'The invitation could not be revoked.', 'error');
      return;
    }
    await refreshInvitations();
    showToast('Invitation revoked.', 'success');
  };

  const handleResendInvitation = async (id: string) => {
    const res = await apiFetch(`/api/invitations/${id}/resend`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(data?.error || 'The invitation could not be resent.', 'error');
      return;
    }
    await refreshInvitations();
    if (data.invitationUrl && !data.emailDelivered) {
      try {
        await navigator.clipboard?.writeText(data.invitationUrl);
        showToast('New invitation link created and copied to clipboard.', 'success');
      } catch {
        showToast('New invitation link created. Copy it from the server log.', 'info');
      }
    } else {
      showToast('Invitation resent.', 'success');
    }
  };

  const handleRemoveTeamMember = async (id: string) => {
    try {
      await apiFetch(`/api/team/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('[App] Team member delete API warning:', err);
    }
    setTeamMembers(prev => {
      const updated = prev.filter(m => m.id !== id);
      if (user?.id) {
        try {
          localStorage.setItem(`catalystos_team_${user.id}`, JSON.stringify(updated));
        } catch {}
      }
      return updated;
    });
    showToast('Team member removed from venture roster.', 'info');
  };

  useEffect(() => {
    hydrateState();
  }, [user]);

  const handleUpdateStartup = async (updated: StartupProfile) => {
    if (user?.role === 'Executive') {
      showToast('Unauthorized: Executive accounts cannot update startup parameters. Please login as Founder.', 'error');
      return;
    }
    try {
      const res = await apiFetch('/api/startup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });

      if (res.ok) {
        const data = await res.json();
        setStartup(data);
        showToast('Startup configuration & AI analysis updated successfully.', 'success');
        const knowRes = await apiFetch('/api/knowledge');
        if (knowRes.ok) setKnowledge(await knowRes.json());
      } else {
        const errData = await res.json();
        showToast(errData.error || 'Failed to save startup configuration.', 'error');
      }
    } catch (err) {
      showToast('Error syncing profile with server.', 'error');
    }
  };

  const handleLaunchInitiative = async (title: string, description: string, category: 'funding' | 'hiring' | 'growth' | 'operations' | 'legal') => {
    try {
      const res = await apiFetch('/api/initiatives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, category }),
      });

      if (res.ok) {
        const newInit = await res.json();
        setInitiatives(prev => [newInit, ...prev]);
        showToast(`Strategic Initiative "${title}" successfully launched.`, 'success');
      } else {
        const errData = await res.json();
        showToast(errData.error || 'Failed to deploy initiative.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to deploy initiative.', 'error');
    }
  };

  const handleSimulateInitiative = async (id: string) => {
    try {
      const res = await apiFetch(`/api/initiatives/${id}/simulate`, {
        method: 'POST',
      });

      if (res.ok) {
        const updatedInit = await res.json();
        setInitiatives(prev => prev.map(i => i.id === id ? updatedInit : i));
        
        const [apprRes, decRes, startRes] = await Promise.all([
          apiFetch('/api/approvals'),
          apiFetch('/api/decisions'),
          apiFetch('/api/startup'),
        ]);
        if (apprRes.ok) setApprovals(await apprRes.json());
        if (decRes.ok) setDecisions(await decRes.json());
        if (startRes.ok) setStartup(await startRes.json());

        showToast('Multi-agent collaboration cycle finalized. Check Approval Queue!', 'success');
      } else {
        const errData = await res.json();
        showToast(errData.error || 'Failed to execute collaboration cycle.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error executing multi-agent simulator.', 'error');
    }
  };

  const handleReviewItem = async (
    id: string, 
    action: 'approve' | 'modify' | 'reject' | 'request_changes', 
    feedback?: string,
    modifications?: any
  ) => {
    if (user?.role === 'Executive') {
      showToast('Unauthorized: Executive accounts cannot review or approve deliverables. Please login as Founder.', 'error');
      return;
    }
    try {
      const res = await apiFetch(`/api/approvals/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, feedback, modifications }),
      });

      if (res.ok) {
        const data = await res.json();
        setStartup(data.startupProfile);
        setApprovals(prev => prev.filter(item => item.id !== id));
        
        const decRes = await apiFetch('/api/decisions');
        if (decRes.ok) setDecisions(await decRes.json());

        // Refresh task status across the shared application shell
        await hydrateTasks();

        const toastMsg = 
          action === 'approve'
            ? 'Deliverable signed off. System metrics and ledger adjusted.'
            : action === 'modify'
            ? 'Deliverable approved with modified parameters. Metrics adjusted.'
            : action === 'request_changes'
            ? 'Revision requested. Deliverable returned to employee workspace with founder directives.'
            : 'Deliverable rejected with founder directives and returned to council.';
        showToast(toastMsg, action === 'reject' ? 'info' : 'success');
      } else {
        const errData = await res.json();
        showToast(errData.error || 'Failed to review asset.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to review asset.', 'error');
    }
  };

  const handleUploadDoc = async (name: string, content: string, type: string, fileData?: string, mimeType?: string) => {
    try {
      const res = await apiFetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, content, type, fileData, mimeType }),
      });

      if (res.ok) {
        const newDoc = await res.json();
        setKnowledge(prev => [newDoc, ...prev]);
        showToast(`Document "${name}" parsed and ingested into vector base.`, 'success');
      } else {
        const errData = await res.json();
        showToast(errData.error || 'Failed to ingest file.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to ingest corporate file.', 'error');
    }
  };

  const renderDashboard = () => {
    if (!startup) {
      return (
        <div className="flex h-screen w-screen items-center justify-center transition-colors duration-300" style={{ backgroundColor: 'var(--c-bg)', color: 'var(--c-fg)' }}>
          <div className="text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto shadow-md border" style={{ backgroundColor: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
            </div>
            <p className="text-xs font-mono uppercase tracking-widest text-slate-500">Initializing CatalystOS Executive Council...</p>
          </div>
        </div>
      );
    }

    // ── Navigation Categories (Linear & Notion Information Architecture) ───────
    interface NavItem {
      id: string;
      label: string;
      Icon: any;
      badge?: string;
      badgeColor?: string;
    }

    interface NavSection {
      title: string;
      items: NavItem[];
    }

    const isPrivileged = user?.role === 'FOUNDER' || user?.role === 'ADMIN' || user?.role === 'Founder' || permissions.role === 'FOUNDER' || permissions.role === 'ADMIN';
    const normRole = (user?.role || permissions.role || 'FOUNDER').toUpperCase();

    const navSections: NavSection[] = [
      {
        title: isPrivileged ? 'Workspace' : `${normRole} Command`,
        items: [
          { id: 'dashboard' as const, label: 'Overview', Icon: LayoutDashboard },
          { id: 'workspace' as const, label: 'Tasks & Projects', Icon: CheckSquare },
          { 
            id: 'approvals' as const, 
            label: 'Approvals', 
            Icon: ShieldCheck, 
            badge: approvals.length > 0 ? String(approvals.length) : undefined,
            badgeColor: 'text-rose-600 bg-rose-50 border-rose-200' 
          },
        ].filter(item => item.id === 'workspace' || permissions.areas.includes(item.id as any)) as NavItem[]
      },
      {
        title: 'Intelligence',
        items: [
          { id: 'orchestration' as const, label: 'Multi-Agent Orchestrator', Icon: Cpu, badge: '5-Step', badgeColor: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
          { id: 'knowledge' as const, label: 'Company Knowledge', Icon: BookOpen },
          { id: 'workflows' as const, label: 'Workflows', Icon: GitMerge },
          { id: 'scenarios' as const, label: 'Scenario Planning', Icon: SlidersHorizontal },
          { id: 'council' as const,   label: 'Executive Council', Icon: Sparkles },
        ].filter(item => item.id === 'orchestration' || item.id === 'council' || permissions.areas.includes(item.id as any)) as NavItem[]
      },
      {
        title: 'Governance',
        items: [
          { id: 'decisions' as const, label: 'Decision Log', Icon: FileText },
          { id: 'people' as const,    label: 'Team & Access', Icon: Users },
        ].filter(item => permissions.areas.includes(item.id as any)) as NavItem[]
      }
    ];

    const allNavItems: NavItem[] = navSections.flatMap(s => s.items);
    const currentNavItem = allNavItems.find(n => n.id === activeTab) || (activeTab === 'agents' ? { label: 'Executive Agents', id: 'agents', Icon: Users } : { label: activeTab, id: activeTab as any, Icon: LayoutDashboard });
    const tabLabel = currentNavItem.label;

    return (
      <div className="flex h-screen overflow-hidden font-sans bg-slate-50 text-slate-900">
      {/* ── Desktop Sidebar (Clean, Minimal, Aura Template Structure) ───────────────────── */}
      <aside 
        className="hidden md:flex flex-col border-r border-slate-200 bg-white shrink-0 justify-between select-none z-20 transition-all duration-200" 
        style={{ width: sidebarCollapsed ? '68px' : '240px' }}
      >
        <div className="flex flex-col flex-1 min-h-0">
          
          {/* Workspace Identity & Switcher */}
          <div className="p-3.5 border-b border-slate-200">
            <div 
              onClick={() => setIsSettingsOpen(true)}
              className={`flex items-center gap-3 p-2 rounded-xl transition-colors hover:bg-slate-50 cursor-pointer group ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}
              title={sidebarCollapsed ? `${startup?.name || 'CatalystOS'} - Workspace Settings` : undefined}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-xs shrink-0 text-white shadow-xs">
                  <CatalystLogo className="w-4 h-4 text-white" />
                </div>
                {!sidebarCollapsed && (
                  <div className="min-w-0">
                    <span className="font-semibold text-xs text-slate-900 truncate block">
                      {startup?.name || 'CatalystOS'}
                    </span>
                    <span className="text-[11px] block truncate text-slate-500 font-normal">
                      {startup?.stage || 'Seed'} Workspace
                    </span>
                  </div>
                )}
              </div>
              {!sidebarCollapsed && (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-colors shrink-0" />
              )}
            </div>
          </div>

          {/* Grouped Navigation */}
          <nav className="flex-1 overflow-y-auto p-2.5 space-y-5">
            {navSections.map((section, idx) => {
              if (section.items.length === 0) return null;
              return (
                <div key={idx} className="space-y-0.5">
                  {!sidebarCollapsed && (
                    <div className="px-2.5 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      {section.title}
                    </div>
                  )}
                  <div className="space-y-0.5">
                    {section.items.map(({ id, label, Icon, badge, badgeColor }) => {
                      const isActive = activeTab === id;
                      return (
                        <button
                          key={id}
                          onClick={() => handleTabChange(id as any)}
                          title={sidebarCollapsed ? label : undefined}
                          className={`w-full flex items-center rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                            sidebarCollapsed ? 'justify-center p-2' : 'justify-between px-2.5 py-2'
                          } ${
                            isActive
                              ? 'bg-indigo-50 text-indigo-700 font-semibold'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                          }`}
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <Icon 
                              className={`w-4 h-4 shrink-0 transition-colors ${
                                isActive ? 'text-indigo-600' : 'text-slate-400'
                              }`} 
                            />
                            {!sidebarCollapsed && (
                              <span className="truncate">{label}</span>
                            )}
                          </span>
                          {!sidebarCollapsed && badge && (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${badgeColor}`}>
                              {badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>

          {/* Administration & User Profile Footer */}
          <div className="p-2.5 border-t border-slate-200 space-y-1 bg-white">
            
            {/* Voice Studio Action */}
            <button
              onClick={() => setIsVoiceStudioOpen(true)}
              className={`w-full flex items-center rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer ${
                sidebarCollapsed ? 'justify-center p-2' : 'justify-between px-2.5 py-2'
              }`}
              title="Voice Studio"
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Radio className="w-4 h-4 text-indigo-600 shrink-0" />
                {!sidebarCollapsed && <span>Voice Studio</span>}
              </span>
              {!sidebarCollapsed && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">
                  Live
                </span>
              )}
            </button>

            {/* Dedicated Employee Workspace Action */}
            <button
              onClick={() => navigate('/employee')}
              className={`w-full flex items-center rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer ${
                sidebarCollapsed ? 'justify-center p-2' : 'justify-between px-2.5 py-2'
              }`}
              title="Employee Workspace"
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Users className="w-4 h-4 text-emerald-600 shrink-0" />
                {!sidebarCollapsed && <span>Employee Workspace</span>}
              </span>
              {!sidebarCollapsed && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                  /employee
                </span>
              )}
            </button>

            {/* Workspace Settings Action */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className={`w-full flex items-center rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer ${
                sidebarCollapsed ? 'justify-center p-2' : 'justify-between px-2.5 py-2'
              }`}
              title="Settings"
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Settings className="w-4 h-4 text-slate-400 shrink-0" />
                {!sidebarCollapsed && <span>Settings</span>}
              </span>
            </button>
            
            {/* User Profile Card */}
            <div className={`mt-1.5 pt-2 border-t border-slate-100 flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between px-1'}`}>
              <div 
                onClick={() => setIsSettingsOpen(true)}
                className={`flex items-center gap-2 min-w-0 cursor-pointer ${sidebarCollapsed ? 'justify-center' : ''}`}
                title={sidebarCollapsed ? `${user?.name || 'Founder'} (${user?.role || 'Founder'})` : undefined}
              >
                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  {user?.name?.slice(0, 2).toUpperCase() || 'AD'}
                </div>
                {!sidebarCollapsed && (
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 truncate">{user?.name || 'Founder'}</div>
                    <div className="text-[10px] text-slate-500 truncate capitalize">{user?.role || 'Founder'}</div>
                  </div>
                )}
              </div>
              {!sidebarCollapsed && (
                <button
                  onClick={() => {
                    logout();
                    navigate('/');
                  }}
                  title="Sign Out"
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main Content Area ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-slate-50">
        
        {/* Top Navbar */}
        <header className="shrink-0 z-30 px-6 py-2.5 bg-white border-b border-slate-200">
          <div className="flex items-center justify-between w-full">
            {/* Left: Mobile Menu, Sidebar Toggle, Breadcrumbs */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Menu className="w-4 h-4" />
              </button>

              <button
                onClick={() => setSidebarCollapsed(prev => !prev)}
                className="hidden md:flex p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
                title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              >
                {sidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
              </button>

              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium text-slate-500">
                  {startup?.name || 'CatalystOS'}
                </span>
                <span className="text-slate-300">/</span>
                <span className="font-semibold text-slate-900">
                  {tabLabel}
                </span>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              {/* Search ⌘K */}
              <button
                onClick={() => setCommandPaletteOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-slate-50 hover:bg-white text-slate-600 transition-colors cursor-pointer shadow-xs"
              >
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">Search...</span>
                <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-500">
                  ⌘K
                </kbd>
              </button>

              {/* Voice Studio Button */}
              <button
                onClick={() => setIsVoiceStudioOpen(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer shadow-xs"
                title="Voice Studio"
              >
                <Radio className="w-3.5 h-3.5 text-indigo-600" />
                <span>Voice</span>
              </button>

              {/* Notifications */}
              <button 
                onClick={() => setNotificationsOpen(true)}
                className="relative p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer shadow-xs"
                title="Open Operational Alerts"
              >
                <Bell className="w-4 h-4" />
                {approvals.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-rose-500" />
                )}
              </button>

              {/* Settings */}
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer shadow-xs"
                title="Workspace Settings"
              >
                <Settings className="w-4 h-4" />
              </button>

              {/* User Avatar */}
              <div 
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer shadow-xs"
              >
                <div className="w-6 h-6 rounded-md bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center">
                  {user?.name?.slice(0, 2).toUpperCase() || 'AD'}
                </div>
                <span className="text-xs font-semibold text-slate-800 hidden sm:inline">{user?.name}</span>
              </div>
            </div>
          </div>
        </header>

        {/* View Content */}
        <main
          onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 15)}
          className="flex-1 overflow-y-auto scroll-smooth"
          style={{ backgroundColor: 'transparent' }}
        >
          <div className={`${activeTab === 'people' ? 'max-w-[1440px] py-6 space-y-6' : 'app-container py-8 space-y-8'} page-padding mx-auto w-full`}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
              >
                {activeTab === 'dashboard' && startup && (
                  isPrivileged ? (
                    <SaaSDashboard 
                      startup={startup}
                      agents={agents}
                      initiatives={initiatives}
                      approvals={approvals}
                      decisions={decisions}
                      knowledge={knowledge}
                      tasks={tasks}
                      memberships={memberships}
                      invitations={invitations}
                      onReviewItem={handleReviewItem}
                      onUploadDoc={handleUploadDoc}
                      onLaunchInitiative={handleLaunchInitiative}
                      onSimulateInitiative={handleSimulateInitiative}
                      onUpdateStartup={handleUpdateStartup}
                      onRefreshTasks={hydrateTasks}
                      onNavigate={(tab) => handleTabChange(tab as any)}
                    />
                  ) : (
                    <RoleAwareDashboard 
                      userRole={user?.role || permissions.role}
                      userName={user?.name || 'Team Member'}
                      companyName={startup?.name}
                      tasks={tasks}
                      teamMembers={teamMembers}
                      onOpenTask={(taskId) => {
                        setSelectedTaskIdForWorkspace(taskId);
                        handleTabChange('workspace');
                      }}
                      onNavigate={(tab) => handleTabChange(tab as any)}
                      onRefreshTasks={hydrateTasks}
                      apiFetch={apiFetch}
                    />
                  )
                )}

                {activeTab === 'workspace' && (
                  <div className="space-y-4">
                    {/* Founder notice for dedicated separate employee workspace */}
                    <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
                          EW
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-slate-900">Separate Employee Operating Environment</h4>
                          <p className="text-[11px] text-slate-500">Employees operate in their own focused environment at <code className="bg-slate-100 text-indigo-600 px-1 py-0.5 rounded font-mono font-medium">/employee</code> with Overview, My Work, Team, and Community.</p>
                        </div>
                      </div>
                      <button
                        onClick={() => navigate('/employee')}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shadow-xs shrink-0 self-start sm:self-auto"
                      >
                        <span>Open Employee Workspace</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <RoleAwareDashboard 
                      userRole={user?.role || permissions.role}
                      userName={user?.name || 'Founder'}
                      companyName={startup?.name}
                      tasks={tasks}
                      teamMembers={teamMembers}
                      onOpenTask={(taskId) => {
                        navigate(`/employee?task=${taskId}`);
                      }}
                      onNavigate={(tab) => handleTabChange(tab as any)}
                      onRefreshTasks={hydrateTasks}
                      apiFetch={apiFetch}
                    />
                  </div>
                )}
                
                {activeTab === 'council' && (
                  <ExecutiveCouncilWorkspace
                    agents={agents}
                    startup={startup}
                    decisions={decisions}
                    knowledge={knowledge}
                    tasks={tasks}
                    initiatives={initiatives}
                    approvals={approvals}
                    selectedAgentId={selectedAgentId}
                    onSelectAgent={handleSelectAgent}
                    onReviewItem={handleReviewItem}
                    onUpdateStartup={handleUpdateStartup}
                    onRefreshTasks={hydrateTasks}
                    onNavigate={(tab) => handleTabChange(tab as any)}
                    apiFetch={apiFetch}
                    teamMembers={teamMembers}
                    currentUser={user}
                  />
                )}

                {activeTab === 'agents' && (
                  <AgentWorkspace 
                    agents={agents} 
                    startup={startup} 
                    decisions={decisions}
                    knowledge={knowledge}
                    onUpdateStartup={handleUpdateStartup} 
                    selectedAgentId={selectedAgentId}
                    onSelectAgent={handleSelectAgent}
                  />
                )}

                {activeTab === 'orchestration' && (
                  <MultiAgentOrchestrationDashboard
                    apiFetch={apiFetch}
                    onNavigate={(tab) => handleTabChange(tab as any)}
                  />
                )}

                {activeTab === 'workflows' && (
                  <WorkflowCanvas 
                    initiatives={initiatives} 
                    onLaunchInitiative={handleLaunchInitiative} 
                    onSimulateInitiative={handleSimulateInitiative} 
                    onNavigate={(tab) => handleTabChange(tab as any)}
                  />
                )}

                {activeTab === 'approvals' && (
                  <ApprovalQueue 
                    approvals={approvals} 
                    onReviewItem={handleReviewItem} 
                    currentCash={startup.cashBalance}
                    currentBurn={startup.burnRate}
                  />
                )}

                {activeTab === 'scenarios' && (
                  <ScenarioSimulator
                    currentCash={startup.cashBalance}
                    currentBurn={startup.burnRate}
                    companyName={startup.name}
                  />
                )}

                {activeTab === 'decisions' && (
                  <DecisionLog 
                    decisions={decisions} 
                    onRefresh={hydrateState}
                  />
                )}

                {activeTab === 'knowledge' && (
                  <KnowledgeBase 
                    documents={knowledge} 
                    onUploadDoc={handleUploadDoc} 
                  />
                )}

                {activeTab === 'people' && (
                  <PeopleDirectory 
                    user={user}
                    companyName={startup.name}
                    teamMembers={teamMembers}
                    onAddMember={hasPermission('people:write') ? handleAddTeamMember : undefined}
                    onRemoveMember={hasPermission('people:write') ? handleRemoveTeamMember : undefined}
                    memberships={memberships}
                    invitations={invitations}
                    onInviteMember={hasPermission('people:access') ? handleInviteMember : undefined}
                    onRevokeInvitation={hasPermission('people:access') ? handleRevokeInvitation : undefined}
                    onResendInvitation={hasPermission('people:access') ? handleResendInvitation : undefined}
                    onRemoveMembership={hasPermission('people:access') ? handleRemoveMembership : undefined}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
          <Footer onNavigate={(tab) => handleTabChange(tab as any)} />
        </main>

      {/* Toast Alerts */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl flex items-center gap-3.5 min-w-[300px] max-w-sm font-sans"
            style={{
              backgroundColor: 'var(--c-surface)',
              border: `1px solid ${toast.type === 'success' ? 'var(--c-success)' : toast.type === 'error' ? 'var(--c-danger)' : 'var(--c-border)'}`,
              color: toast.type === 'success' ? 'var(--c-success)' : toast.type === 'error' ? 'var(--c-danger)' : 'var(--c-fg)',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            <Sparkles className="w-4 h-4 shrink-0 opacity-60" />
            <div className="flex-1">
              <p className="text-xs font-semibold leading-normal">{toast.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={(tab) => {
          handleTabChange(tab);
          showToast(`Switched workspace view to: ${tab.toUpperCase()}`, 'info');
        }}
        onRunAction={(actionName) => {
          if (actionName === 'simulate') {
            const firstPending = initiatives.find(i => i.status === 'pending');
            if (firstPending) {
              handleSimulateInitiative(firstPending.id);
            } else {
              showToast('No pending sprints available for simulation. Launch an initiative first!', 'error');
            }
          }
        }}
      />

      </div>

      {/* ── Mobile Drawer (Animated) ─────────────────────────────────────── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 md:hidden"
              style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 z-50 w-72 md:hidden flex flex-col justify-between bg-white border-r border-slate-200 shadow-xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-5 space-y-5 flex-1 overflow-y-auto">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-xs text-white shadow-xs">
                      <CatalystLogo className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-900 block">{startup?.name || 'CatalystOS'}</span>
                      <span className="text-[10px] text-slate-500 font-normal">{startup?.stage || 'Seed'} Workspace</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <nav className="space-y-4">
                  {navSections.map((section, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="px-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        {section.title}
                      </div>
                      <div className="space-y-0.5">
                        {section.items.map(({ id, label, Icon, badge, badgeColor }) => (
                          <button
                            key={id}
                            onClick={() => { handleTabChange(id as any); setMobileMenuOpen(false); }}
                            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                              activeTab === id
                                ? 'bg-indigo-50 text-indigo-700 font-semibold'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                            }`}
                          >
                            <span className="flex items-center gap-2.5">
                              <Icon className={`w-4 h-4 ${activeTab === id ? 'text-indigo-600' : 'text-slate-400'}`} />
                              <span>{label}</span>
                            </span>
                            {badge && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeColor}`}>{badge}</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </nav>
              </div>

              <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-2">
                <button
                  onClick={() => { setIsVoiceStudioOpen(true); setMobileMenuOpen(false); }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-indigo-600" />
                    <span>Voice Studio</span>
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-medium">Live</span>
                </button>
                <button
                  onClick={() => { setIsSettingsOpen(true); setMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer"
                >
                  <Settings className="w-4 h-4 text-slate-500" />
                  <span>Settings</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Catalyst OS AI Chatbot */}
      <CatalystOsChatbot />

      {/* Real-time Operational Notifications Drawer */}
      <NotificationPanel 
        isOpen={notificationsOpen} 
        onClose={() => setNotificationsOpen(false)} 
        onNavigate={(tab) => handleTabChange(tab)} 
      />

      {/* Global Voice Studio Management Panel */}
      <VoiceStudioPanel
        isOpen={isVoiceStudioOpen}
        onClose={() => setIsVoiceStudioOpen(false)}
      />

      {/* Global Workspace Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        startup={startup}
        onUpdateStartup={handleUpdateStartup}
        user={user}
      />

    </div>
    );
  };

  return (
    <Routes>
      {/* Landing Phase Route - Guarded: If authenticated, redirect to workspace or onboarding */}
      <Route
        path="/"
        element={
          loading || isCheckingStartup ? (
            <div className="flex h-screen w-screen items-center justify-center transition-colors duration-300" style={{ backgroundColor: 'var(--c-bg)', color: 'var(--c-fg)' }}>
              <div className="text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto shadow-md border" style={{ backgroundColor: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
                </div>
                <p className="text-xs font-mono uppercase tracking-widest text-slate-500">Checking Workspace Status...</p>
              </div>
            </div>
          ) : user ? (
            isEmployeeRole(user?.role || permissions.role) ? (
              <Navigate to="/employee" replace />
            ) : onboardingCompleted ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Navigate to="/onboarding" replace />
            )
          ) : (
            <AuthScreen key="landing" initialView="landing" />
          )
        }
      />

      {/* Aliases for login and signup routes */}
      <Route path="/login" element={<Navigate to="/auth" replace />} />
      <Route path="/signup" element={<Navigate to="/auth" replace />} />

      {/* Authentication Phase Route */}
      {/* P1 Task 8: public invitation acceptance. The raw token is the credential,
          so this route must not sit behind the authentication guard. */}
      <Route path="/accept-invitation" element={<AcceptInvitation />} />

      <Route
        path="/auth"
        element={
          loading || isCheckingStartup ? (
            <div className="flex h-screen w-screen items-center justify-center transition-colors duration-300" style={{ backgroundColor: 'var(--c-bg)', color: 'var(--c-fg)' }}>
              <div className="text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto shadow-md border" style={{ backgroundColor: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
                </div>
                <p className="text-xs font-mono uppercase tracking-widest text-slate-500">Checking Workspace Status...</p>
              </div>
            </div>
          ) : user ? (
            isEmployeeRole(user?.role || permissions.role) ? (
              <Navigate to="/employee" replace />
            ) : onboardingCompleted ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Navigate to="/onboarding" replace />
            )
          ) : (
            <AuthScreen key="auth" initialView="auth" />
          )
        }
      />

      {/* Onboarding Phase Route */}
      <Route
        path="/onboarding"
        element={
          loading || isCheckingStartup ? (
            <div className="flex h-screen w-screen items-center justify-center transition-colors duration-300" style={{ backgroundColor: 'var(--c-bg)', color: 'var(--c-fg)' }}>
              <div className="text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto shadow-md border" style={{ backgroundColor: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
                </div>
                <p className="text-xs font-mono uppercase tracking-widest text-slate-500">Checking Workspace Status...</p>
              </div>
            </div>
          ) : !user ? (
            <Navigate to="/auth" replace />
          ) : onboardingCompleted ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <AuthScreen
              key="onboarding"
              initialView="onboarding"
              onOnboardingComplete={handleOnboardingComplete}
            />
          )
        }
      />

      {/* Direct Shortcuts for Workspace Phases */}
      <Route path="/workspace" element={<Navigate to="/dashboard/workspace" replace />} />
      <Route path="/approvals" element={<Navigate to="/dashboard/approvals" replace />} />
      <Route path="/knowledge" element={<Navigate to="/dashboard/knowledge" replace />} />
      <Route path="/workflows" element={<Navigate to="/dashboard/workflows" replace />} />
      <Route path="/people" element={<Navigate to="/dashboard/people" replace />} />
      <Route path="/scenarios" element={<Navigate to="/dashboard/scenarios" replace />} />
      <Route path="/decisions" element={<Navigate to="/dashboard/decisions" replace />} />
      <Route path="/agents" element={<Navigate to="/dashboard/agents" replace />} />
      <Route path="/agents/:agentId" element={<Navigate to="/dashboard/agents" replace />} />
      <Route path="/council" element={<Navigate to="/dashboard/council" replace />} />
      <Route path="/workspace/employee" element={<Navigate to="/employee" replace />} />

      {/* Dedicated Employee Operating System Workspace Route */}
      <Route
        path="/employee/*"
        element={
          loading || isCheckingStartup ? (
            <div className="flex h-screen w-screen items-center justify-center bg-[#F3F0EE]">
              <div className="text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-white border border-[#141413]/10 flex items-center justify-center mx-auto shadow-[rgba(0,0,0,0.06)_0px_8px_24px]">
                  <RefreshCw className="w-6 h-6 text-[#141413] animate-spin" />
                </div>
                <p className="text-xs font-mono text-[#696969] uppercase tracking-widest">Verifying Employee Session...</p>
              </div>
            </div>
          ) : !user ? (
            <Navigate to="/auth" replace />
          ) : (
            <EmployeeWorkspace
              userRole={user?.role || permissions.role}
              userName={user?.name}
              companyName={startup?.name}
              initialTaskId={selectedTaskIdForWorkspace}
              onRefreshTasks={hydrateTasks}
              onNavigateToDashboard={() => navigate('/dashboard')}
              onNavigateToApprovals={() => navigate('/dashboard/approvals')}
            />
          )
        }
      />
      <Route path="/employee" element={<Navigate to="/employee/overview" replace />} />

      {/* Executive Workspace Dashboard Phase Route */}
      <Route
        path="/dashboard/*"
        element={
          loading || isCheckingStartup ? (
            <div className="flex h-screen w-screen items-center justify-center bg-[#F3F0EE]">
              <div className="text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-white border border-[#141413]/10 flex items-center justify-center mx-auto shadow-[rgba(0,0,0,0.06)_0px_8px_24px]">
                  <RefreshCw className="w-6 h-6 text-[#141413] animate-spin" />
                </div>
                <p className="text-xs font-mono text-[#696969] uppercase tracking-widest">Verifying Active Platform Session...</p>
              </div>
            </div>
          ) : !user ? (
            <Navigate to="/auth" replace />
          ) : isEmployeeRole(user?.role || permissions.role) ? (
            <Navigate to="/employee" replace />
          ) : !onboardingCompleted ? (
            <Navigate to="/onboarding" replace />
          ) : (
            renderDashboard()
          )
        }
      />

      {/* Fallback Catch-all Route */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
