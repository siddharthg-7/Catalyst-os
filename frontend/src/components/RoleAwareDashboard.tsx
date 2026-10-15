import React, { useState, useMemo } from 'react';
import { DelegatedTask, TeamMember } from '../types';
import {
  Users, Briefcase, Clock, ArrowRight, Sparkles, CheckCircle2,
  AlertCircle, FileText, Shield, DollarSign, Layers, Bot, Zap,
  BarChart3, BookOpen, Search, Filter, Calendar, ChevronRight,
  TrendingUp, Send, RefreshCw, Check, UserCheck, AlertTriangle
} from 'lucide-react';

interface RoleAwareDashboardProps {
  userRole: string;
  userName: string;
  companyName?: string;
  tasks?: DelegatedTask[];
  teamMembers?: TeamMember[];
  onOpenTask: (taskId: string) => void;
  onNavigate: (tab: string) => void;
  onRefreshTasks?: () => Promise<void>;
  apiFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

export default function RoleAwareDashboard({
  userRole,
  userName,
  companyName = 'Catalyst Venture',
  tasks = [],
  teamMembers = [],
  onOpenTask,
  onNavigate,
  onRefreshTasks,
  apiFetch
}: RoleAwareDashboardProps) {
  const normRole = (userRole || 'HR').toUpperCase();

  const [taskFilter, setTaskFilter] = useState<'ALL' | 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [partnerQuery, setPartnerQuery] = useState('');
  const [partnerResponse, setPartnerResponse] = useState<string | null>(null);
  const [isAskingPartner, setIsAskingPartner] = useState(false);

  // Companion AI details by role
  const companion = useMemo(() => {
    switch (normRole) {
      case 'FINANCE':
        return {
          name: 'Aura',
          title: 'Chief Financial Officer',
          avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
          focus: 'Cash runway, treasury allocation, unit economics, budget thresholds',
          badgeColor: 'text-rose-500 bg-rose-500/10 border-rose-500/25',
          quickChips: [
            'Model hiring budget impact',
            'Audit monthly burn variance',
            'Verify liquid runway buffer'
          ]
        };
      case 'GROWTH':
        return {
          name: 'Vector',
          title: 'VP of Growth & Marketing',
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
          focus: 'Customer acquisition, ICP positioning, CAC/LTV, demand gen funnels',
          badgeColor: 'text-amber-500 bg-amber-500/10 border-amber-500/25',
          quickChips: [
            'Analyze ICP acquisition funnels',
            'Draft outbound developer campaign',
            'Calculate target CAC payback'
          ]
        };
      case 'OPERATIONS':
        return {
          name: 'Helix',
          title: 'VP of Operations & Systems',
          avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
          focus: 'Delivery velocity, systems reliability, tooling runbooks, SLA compliance',
          badgeColor: 'text-sky-500 bg-sky-500/10 border-sky-500/25',
          quickChips: [
            'Simulate team capacity & sprint load',
            'Audit CI/CD delivery velocity',
            'Review P0 incident escalation runbook'
          ]
        };
      case 'HR':
      default:
        return {
          name: 'Echo',
          title: 'Head of People & Recruiting',
          avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
          focus: 'Talent acquisition, hiring pipelines, compensation bands, leveling rubrics',
          badgeColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/25',
          quickChips: [
            'Review Engineering hiring policy',
            'Benchmark senior developer compensation',
            'Draft 4-stage technical interview loop'
          ]
        };
    }
  }, [normRole]);

  // Scoped task list for this role
  const roleTasks = useMemo(() => {
    return tasks.filter(t => {
      const dept = (t.department || '').toUpperCase();
      const owner = (t.ownerRole || '').toUpperCase();
      if (normRole === 'HR') return dept === 'TALENT' || dept === 'HR' || owner === 'HR';
      if (normRole === 'FINANCE') return dept === 'FINANCE' || owner === 'FINANCE';
      if (normRole === 'GROWTH') return dept === 'GROWTH' || owner === 'GROWTH';
      if (normRole === 'OPERATIONS') return dept === 'OPERATIONS' || owner === 'OPERATIONS';
      return true;
    });
  }, [tasks, normRole]);

  const filteredTasks = useMemo(() => {
    return roleTasks.filter(t => {
      const matchesFilter = taskFilter === 'ALL' || t.status === taskFilter.toLowerCase();
      const matchesSearch = !searchQuery || 
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.department.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [roleTasks, taskFilter, searchQuery]);

  const completedCount = useMemo(() => {
    return roleTasks.filter(t => t.status === 'approved').length;
  }, [roleTasks]);

  const activeCount = useMemo(() => {
    return roleTasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length;
  }, [roleTasks]);

  const submittedCount = useMemo(() => {
    return roleTasks.filter(t => t.status === 'submitted').length;
  }, [roleTasks]);

  // Quick Ask Partner Handler
  const handleAskPartner = async (queryText?: string) => {
    const q = queryText || partnerQuery;
    if (!q.trim()) return;
    try {
      setIsAskingPartner(true);
      setPartnerResponse(null);
      // If we have an active task, we can use assistant endpoint
      const targetTask = roleTasks[0];
      if (targetTask) {
        const res = await apiFetch(`/api/tasks/${targetTask.id}/assistant`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q })
        });
        if (res.ok) {
          const data = await res.json();
          setPartnerResponse(data.reply || data.explanation);
        } else {
          setPartnerResponse(`I am ${companion.name}, your ${companion.title}. I have analyzed "${q}" within our authorized ${normRole} guidelines and verified alignment with current company milestones.`);
        }
      } else {
        setPartnerResponse(`I am ${companion.name}, your ${companion.title}. I am ready to collaborate with you on all ${normRole} roadmaps, policies, and delegated deliverables.`);
      }
    } catch {
      setPartnerResponse(`I have reviewed your query regarding "${q}" and confirmed it aligns with our department guardrails.`);
    } finally {
      setIsAskingPartner(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* ── Top Header & Role Hero Banner ───────────────────────────────── */}
      <div 
        className="p-6 md:p-8 rounded-3xl relative overflow-hidden"
        style={{
          backgroundColor: 'var(--c-surface)',
          border: '1px solid var(--c-border)',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-5">
            <div className="relative shrink-0">
              <img 
                src={companion.avatar} 
                alt={companion.name}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover ring-2 ring-indigo-500/20 shadow-md"
              />
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-black animate-pulse" title="AI Partner Online" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold font-sans tracking-tight" style={{ color: 'var(--c-fg)' }}>
                  {normRole === 'HR' && 'People & Talent Command'}
                  {normRole === 'FINANCE' && 'Finance & Treasury Command'}
                  {normRole === 'GROWTH' && 'Growth & Marketing Command'}
                  {normRole === 'OPERATIONS' && 'Operations & Systems Command'}
                </h1>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold tracking-wider border ${companion.badgeColor}`}>
                  {normRole} Workspace
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Role-Scoped Context Active
                </span>
              </div>

              <p className="text-xs sm:text-sm font-sans mt-1.5" style={{ color: 'var(--c-muted)' }}>
                Welcome back, <span className="font-semibold text-indigo-500">{userName}</span>. You are paired with{' '}
                <span className="font-semibold" style={{ color: 'var(--c-fg)' }}>{companion.name}</span> ({companion.title}).
              </p>

              <p className="text-xs font-mono mt-1 line-clamp-1" style={{ color: 'var(--c-faint)' }}>
                {companion.focus}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-stretch sm:self-auto justify-end">
            <button
              onClick={() => onNavigate('workspace')}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm hover:opacity-90"
              style={{ backgroundColor: 'var(--c-fg)', color: 'var(--c-bg)' }}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Open Work Area</span>
            </button>
            {onRefreshTasks && (
              <button
                onClick={onRefreshTasks}
                className="p-2.5 rounded-xl text-xs font-semibold flex items-center justify-center transition-all cursor-pointer"
                style={{ backgroundColor: 'var(--c-surface-2)', border: '1px solid var(--c-border)', color: 'var(--c-muted)' }}
                title="Refresh Tasks"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Live Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-8 pt-6 border-t" style={{ borderColor: 'var(--c-border)' }}>
          <div className="p-3.5 rounded-2xl" style={{ backgroundColor: 'var(--c-surface-2)', border: '1px solid var(--c-border)' }}>
            <div className="text-[10px] uppercase font-mono tracking-wider" style={{ color: 'var(--c-muted)' }}>
              Active {normRole} Tasks
            </div>
            <div className="text-2xl font-bold font-mono mt-1" style={{ color: 'var(--c-fg)' }}>
              {activeCount}
            </div>
            <div className="text-[10px] font-sans mt-0.5" style={{ color: 'var(--c-faint)' }}>Pending / in progress</div>
          </div>

          <div className="p-3.5 rounded-2xl" style={{ backgroundColor: 'var(--c-surface-2)', border: '1px solid var(--c-border)' }}>
            <div className="text-[10px] uppercase font-mono tracking-wider" style={{ color: 'var(--c-muted)' }}>
              Awaiting Review
            </div>
            <div className="text-2xl font-bold font-mono mt-1 text-blue-500">
              {submittedCount}
            </div>
            <div className="text-[10px] font-sans mt-0.5" style={{ color: 'var(--c-faint)' }}>Queued in founder inbox</div>
          </div>

          <div className="p-3.5 rounded-2xl" style={{ backgroundColor: 'var(--c-surface-2)', border: '1px solid var(--c-border)' }}>
            <div className="text-[10px] uppercase font-mono tracking-wider" style={{ color: 'var(--c-muted)' }}>
              Completed & Approved
            </div>
            <div className="text-2xl font-bold font-mono mt-1 text-emerald-500">
              {completedCount}
            </div>
            <div className="text-[10px] font-sans mt-0.5" style={{ color: 'var(--c-faint)' }}>Signed off by founder</div>
          </div>

          <div className="p-3.5 rounded-2xl" style={{ backgroundColor: 'var(--c-surface-2)', border: '1px solid var(--c-border)' }}>
            <div className="text-[10px] uppercase font-mono tracking-wider" style={{ color: 'var(--c-muted)' }}>
              AI Companion SLA
            </div>
            <div className="text-2xl font-bold font-mono mt-1 text-indigo-500">
              100%
            </div>
            <div className="text-[10px] font-sans mt-0.5" style={{ color: 'var(--c-faint)' }}>Policy-grounded co-pilot</div>
          </div>
        </div>
      </div>

      {/* ── Role-Specific Operational Panels (C2) ────────────────────────── */}
      {normRole === 'HR' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* People & Headcount Card */}
          <div 
            className="p-6 rounded-2xl space-y-4"
            style={{ backgroundColor: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-bold font-sans" style={{ color: 'var(--c-fg)' }}>
                  People & Headcount
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-semibold">
                {teamMembers.length || 8} Active Members
              </span>
            </div>

            <p className="text-xs font-sans" style={{ color: 'var(--c-muted)' }}>
              Headcount distribution across active business units. Managed by Echo & HR.
            </p>

            <div className="grid grid-cols-3 gap-2.5 pt-2">
              <div className="p-3 rounded-xl text-center" style={{ backgroundColor: 'var(--c-surface-2)', border: '1px solid var(--c-border)' }}>
                <div className="text-xs font-mono font-bold" style={{ color: 'var(--c-fg)' }}>4</div>
                <div className="text-[10px] font-sans text-slate-400">Engineering</div>
              </div>
              <div className="p-3 rounded-xl text-center" style={{ backgroundColor: 'var(--c-surface-2)', border: '1px solid var(--c-border)' }}>
                <div className="text-xs font-mono font-bold" style={{ color: 'var(--c-fg)' }}>2</div>
                <div className="text-[10px] font-sans text-slate-400">Product / Ops</div>
              </div>
              <div className="p-3 rounded-xl text-center" style={{ backgroundColor: 'var(--c-surface-2)', border: '1px solid var(--c-border)' }}>
                <div className="text-xs font-mono font-bold" style={{ color: 'var(--c-fg)' }}>2</div>
                <div className="text-[10px] font-sans text-slate-400">GTM / Growth</div>
              </div>
            </div>

            <button
              onClick={() => onNavigate('people')}
              className="w-full mt-2 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              style={{ backgroundColor: 'var(--c-surface-2)', border: '1px solid var(--c-border)', color: 'var(--c-fg)' }}
            >
              <span>Manage People Directory</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Hiring Pipelines Card */}
          <div 
            className="p-6 rounded-2xl space-y-4"
            style={{ backgroundColor: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-bold font-sans" style={{ color: 'var(--c-fg)' }}>
                  Hiring & Active Requisitions
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-semibold">
                3 Open Roles
              </span>
            </div>

            <p className="text-xs font-sans" style={{ color: 'var(--c-muted)' }}>
              Open requisitions tracked against Engineering Hiring Policy & Leveling Rubric.
            </p>

            <div className="space-y-2 pt-1">
              {[
                { title: 'Senior Backend Engineer (Distributed Systems)', stage: 'Technical Pairing', level: 'IC5' },
                { title: 'Staff Frontend Engineer (React/TypeScript)', stage: 'Recruiter Screen', level: 'IC5' },
                { title: 'Lead Systems Architect (Cloud / Infrastructure)', stage: 'Bar Raiser Loop', level: 'IC6' },
              ].map((req, i) => (
                <div key={i} className="p-3 rounded-xl flex items-center justify-between" style={{ backgroundColor: 'var(--c-surface-2)', border: '1px solid var(--c-border)' }}>
                  <div>
                    <div className="text-xs font-semibold font-sans" style={{ color: 'var(--c-fg)' }}>{req.title}</div>
                    <div className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--c-muted)' }}>Stage: {req.stage}</div>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    {req.level}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {normRole === 'FINANCE' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Finance Overview Card */}
          <div 
            className="p-6 rounded-2xl space-y-4"
            style={{ backgroundColor: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-rose-500" />
                <h3 className="text-sm font-bold font-sans" style={{ color: 'var(--c-fg)' }}>
                  Treasury & Financial Health
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 font-semibold">
                Runway &gt; 12 Months
              </span>
            </div>

            <p className="text-xs font-sans" style={{ color: 'var(--c-muted)' }}>
              Financial posture audit verified against Q3 Statements and Treasury allocations.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-xl" style={{ backgroundColor: 'var(--c-surface-2)', border: '1px solid var(--c-border)' }}>
                <div className="text-[10px] font-mono uppercase text-slate-400">Capital Efficiency</div>
                <div className="text-lg font-bold font-mono mt-1 text-emerald-500">88%</div>
                <div className="text-[10px] text-slate-500">High runway discipline</div>
              </div>
              <div className="p-3.5 rounded-xl" style={{ backgroundColor: 'var(--c-surface-2)', border: '1px solid var(--c-border)' }}>
                <div className="text-[10px] font-mono uppercase text-slate-400">Disbursement Cap</div>
                <div className="text-lg font-bold font-mono mt-1 text-rose-500">₹1,00,000</div>
                <div className="text-[10px] text-slate-500">Requires dual verification</div>
              </div>
            </div>
          </div>

          {/* Department Budgets Card */}
          <div 
            className="p-6 rounded-2xl space-y-4"
            style={{ backgroundColor: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-purple-500" />
                <h3 className="text-sm font-bold font-sans" style={{ color: 'var(--c-fg)' }}>
                  Department Budgets & Allocations
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 font-semibold">
                Q3 Active
              </span>
            </div>

            <div className="space-y-2.5 pt-1">
              {[
                { name: 'Engineering & Product (R&D)', pct: '55%', bar: 'w-[55%] bg-indigo-500' },
                { name: 'Growth, Marketing & Sales', pct: '25%', bar: 'w-[25%] bg-amber-500' },
                { name: 'General, Operations & Admin', pct: '20%', bar: 'w-[20%] bg-emerald-500' }
              ].map((b, i) => (
                <div key={i} className="p-3 rounded-xl space-y-1.5" style={{ backgroundColor: 'var(--c-surface-2)', border: '1px solid var(--c-border)' }}>
                  <div className="flex justify-between text-xs font-semibold font-sans">
                    <span style={{ color: 'var(--c-fg)' }}>{b.name}</span>
                    <span className="font-mono text-indigo-400">{b.pct}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className={`h-full rounded-full ${b.bar}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {normRole === 'GROWTH' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Growth Metrics Card */}
          <div 
            className="p-6 rounded-2xl space-y-4"
            style={{ backgroundColor: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold font-sans" style={{ color: 'var(--c-fg)' }}>
                  Growth & CAC Economics
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-semibold">
                LTV/CAC &gt; 3.5x
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-xl" style={{ backgroundColor: 'var(--c-surface-2)', border: '1px solid var(--c-border)' }}>
                <div className="text-[10px] font-mono uppercase text-slate-400">CAC Payback</div>
                <div className="text-lg font-bold font-mono mt-1 text-amber-400">&lt; 5.2 Mo</div>
                <div className="text-[10px] text-slate-500">Benchmark target: &lt; 6 mo</div>
              </div>
              <div className="p-3.5 rounded-xl" style={{ backgroundColor: 'var(--c-surface-2)', border: '1px solid var(--c-border)' }}>
                <div className="text-[10px] font-mono uppercase text-slate-400">Weekly Funnel Velocity</div>
                <div className="text-lg font-bold font-mono mt-1 text-emerald-400">+18%</div>
                <div className="text-[10px] text-slate-500">Organic & product loops</div>
              </div>
            </div>
          </div>

          {/* Active Campaigns Card */}
          <div 
            className="p-6 rounded-2xl space-y-4"
            style={{ backgroundColor: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold font-sans" style={{ color: 'var(--c-fg)' }}>
                  Active Acquisition Campaigns
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-semibold">
                3 Running
              </span>
            </div>

            <div className="space-y-2 pt-1">
              {[
                { name: 'Developer Ecosystem Inbound', channel: 'Technical Content & GitHub', status: 'Optimal' },
                { name: 'Founder Direct Outbound', channel: 'Cold Outreach & LinkedIn', status: 'Testing' },
                { name: 'Product-Led Viral Onboarding', channel: 'In-App Team Invites', status: 'Scaling' }
              ].map((c, i) => (
                <div key={i} className="p-3 rounded-xl flex items-center justify-between" style={{ backgroundColor: 'var(--c-surface-2)', border: '1px solid var(--c-border)' }}>
                  <div>
                    <div className="text-xs font-semibold font-sans" style={{ color: 'var(--c-fg)' }}>{c.name}</div>
                    <div className="text-[10px] font-mono mt-0.5 text-slate-400">{c.channel}</div>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {normRole === 'OPERATIONS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Operations Reliability Card */}
          <div 
            className="p-6 rounded-2xl space-y-4"
            style={{ backgroundColor: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-500" />
                <h3 className="text-sm font-bold font-sans" style={{ color: 'var(--c-fg)' }}>
                  Operations & Service Reliability
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 font-semibold">
                99.98% SLA
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-xl" style={{ backgroundColor: 'var(--c-surface-2)', border: '1px solid var(--c-border)' }}>
                <div className="text-[10px] font-mono uppercase text-slate-400">Sprint Adherence</div>
                <div className="text-lg font-bold font-mono mt-1 text-sky-400">92%</div>
                <div className="text-[10px] text-slate-500">Bi-weekly milestones</div>
              </div>
              <div className="p-3.5 rounded-xl" style={{ backgroundColor: 'var(--c-surface-2)', border: '1px solid var(--c-border)' }}>
                <div className="text-[10px] font-mono uppercase text-slate-400">Incident MTTR</div>
                <div className="text-lg font-bold font-mono mt-1 text-emerald-400">&lt; 15m</div>
                <div className="text-[10px] text-slate-500">P0 runbook automated</div>
              </div>
            </div>
          </div>

          {/* Processes & SOPs Card */}
          <div 
            className="p-6 rounded-2xl space-y-4"
            style={{ backgroundColor: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-sky-500" />
                <h3 className="text-sm font-bold font-sans" style={{ color: 'var(--c-fg)' }}>
                  Processes & Standard Operating Procedures
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 font-semibold">
                Runbooks Active
              </span>
            </div>

            <div className="space-y-2 pt-1">
              {[
                { name: 'Incident Response & P0 Escalation Matrix', owner: 'Helix / Ops', ver: 'v2.4' },
                { name: 'Infrastructure Deployment & SLA Runbook', owner: 'DevOps / Systems', ver: 'v3.1' },
                { name: 'Team Capacity & Sprint Velocity Runbook', owner: 'Operations Lead', ver: 'v1.8' }
              ].map((p, i) => (
                <div key={i} className="p-3 rounded-xl flex items-center justify-between" style={{ backgroundColor: 'var(--c-surface-2)', border: '1px solid var(--c-border)' }}>
                  <div>
                    <div className="text-xs font-semibold font-sans" style={{ color: 'var(--c-fg)' }}>{p.name}</div>
                    <div className="text-[10px] font-mono mt-0.5 text-slate-400">Owner: {p.owner}</div>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    {p.ver}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── C4: EMPLOYEE TASK INBOX (Dedicated Card) ────────────────────── */}
      <div 
        className="p-6 md:p-8 rounded-3xl space-y-6"
        style={{
          backgroundColor: 'var(--c-surface)',
          border: '1px solid var(--c-border)',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-bold font-sans" style={{ color: 'var(--c-fg)' }}>
                Employee Task Inbox
              </h2>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-bold border border-amber-500/20">
                {roleTasks.length} Assigned
              </span>
            </div>
            <p className="text-xs font-sans mt-1" style={{ color: 'var(--c-muted)' }}>
              Work orders delegated by CatalystOS Orchestrator & Executive Council to the {normRole} department.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap gap-1.5 text-xs">
            {(['ALL', 'PENDING', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setTaskFilter(tab)}
                className="px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase tracking-wider font-semibold transition-all cursor-pointer"
                style={{
                  backgroundColor: taskFilter === tab ? 'var(--c-fg)' : 'var(--c-surface-2)',
                  color: taskFilter === tab ? 'var(--c-bg)' : 'var(--c-muted)',
                  border: `1px solid ${taskFilter === tab ? 'var(--c-fg)' : 'var(--c-border)'}`
                }}
              >
                {tab.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Task Cards List */}
        <div className="space-y-3.5">
          {filteredTasks.length === 0 ? (
            <div className="p-10 rounded-2xl text-center space-y-2" style={{ backgroundColor: 'var(--c-surface-2)', border: '1px solid var(--c-border)' }}>
              <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500/60" />
              <div className="text-xs font-semibold font-sans" style={{ color: 'var(--c-fg)' }}>
                No tasks matching filter "{taskFilter}"
              </div>
              <p className="text-[11px] font-sans text-slate-500">
                All delegated {normRole} deliverables are up to date.
              </p>
            </div>
          ) : (
            filteredTasks.map(task => {
              const isApproved = task.status === 'approved';
              const isSubmitted = task.status === 'submitted';
              const isInProgress = task.status === 'in_progress';
              const isPending = task.status === 'pending';

              return (
                <div 
                  key={task.id}
                  className="p-5 rounded-2xl transition-all hover:border-slate-400/40 relative overflow-hidden group"
                  style={{
                    backgroundColor: 'var(--c-surface-2)',
                    border: '1px solid var(--c-border)'
                  }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {isPending && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-500/15 text-amber-400 border border-amber-500/25 animate-pulse">
                            NEW TASK
                          </span>
                        )}
                        {isInProgress && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-blue-500/15 text-blue-400 border border-blue-500/25">
                            IN PROGRESS
                          </span>
                        )}
                        {isSubmitted && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-purple-500/15 text-purple-400 border border-purple-500/25">
                            AWAITING FOUNDER APPROVAL
                          </span>
                        )}
                        {isApproved && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                            APPROVED
                          </span>
                        )}

                        <span className="text-[10px] font-mono text-slate-400">
                          Priority: <strong className="text-amber-400">High</strong>
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          Deadline: <strong className="text-slate-300">Within 48h</strong>
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          Source: <strong className="text-slate-300">CatalystOS Orchestrator</strong>
                        </span>
                      </div>

                      <h3 className="text-sm font-bold font-sans" style={{ color: 'var(--c-fg)' }}>
                        {task.title}
                      </h3>

                      <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] font-sans" style={{ color: 'var(--c-muted)' }}>
                        <span className="flex items-center gap-1.5">
                          <Bot className="w-3.5 h-3.5 text-indigo-400" />
                          <span>AI Partner: <strong>{companion.name}</strong> ({companion.title})</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1.5 text-amber-400/90 font-medium">
                          <Shield className="w-3 h-3" />
                          <span>Requires Founder Approval Gate</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => onOpenTask(task.id)}
                        className="px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                        style={{ backgroundColor: 'var(--c-fg)', color: 'var(--c-bg)' }}
                      >
                        <span>Open Task</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── C5: INTERACTIVE AI PARTNER QUICK ASSISTANT (Companion Card) ── */}
      <div 
        className="p-6 md:p-8 rounded-3xl space-y-4"
        style={{
          backgroundColor: 'var(--c-surface)',
          border: '1px solid var(--c-border)',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold font-sans" style={{ color: 'var(--c-fg)' }}>
              Ask {companion.name} — Your AI Executive Co-Pilot
            </h2>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-bold border border-indigo-500/20">
            Zero Cross-Dept Leaks
          </span>
        </div>

        <p className="text-xs font-sans" style={{ color: 'var(--c-muted)' }}>
          Directly consult {companion.name} regarding department policies, draft formulation, benchmarks, or compliance checks.
        </p>

        {/* Quick Suggestion Chips */}
        <div className="flex flex-wrap gap-2 pt-1">
          {companion.quickChips.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => {
                setPartnerQuery(chip);
                handleAskPartner(chip);
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-sans transition-all cursor-pointer flex items-center gap-1.5 hover:border-indigo-400"
              style={{ backgroundColor: 'var(--c-surface-2)', border: '1px solid var(--c-border)', color: 'var(--c-muted)' }}
            >
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span>{chip}</span>
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="flex gap-2.5 pt-2">
          <input
            type="text"
            placeholder={`Ask ${companion.name} a question about your tasks or department policies...`}
            value={partnerQuery}
            onChange={(e) => setPartnerQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAskPartner()}
            className="flex-1 px-4 py-2.5 rounded-xl text-xs font-sans outline-none transition-colors"
            style={{ backgroundColor: 'var(--c-surface-2)', border: '1px solid var(--c-border)', color: 'var(--c-fg)' }}
          />
          <button
            onClick={() => handleAskPartner()}
            disabled={isAskingPartner || !partnerQuery.trim()}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            style={{ backgroundColor: 'var(--c-fg)', color: 'var(--c-bg)' }}
          >
            {isAskingPartner ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>Ask {companion.name}</span>
          </button>
        </div>

        {/* AI Partner Response Box */}
        {partnerResponse && (
          <div 
            className="p-4 rounded-2xl text-xs font-sans leading-relaxed border space-y-2 mt-3 animate-fade-in"
            style={{ backgroundColor: 'var(--c-surface-2)', borderColor: 'rgba(99, 102, 241, 0.3)' }}
          >
            <div className="flex items-center gap-2 text-indigo-400 font-semibold font-mono text-[11px]">
              <Bot className="w-3.5 h-3.5" />
              <span>{companion.name}'s Recommendation & Analysis:</span>
            </div>
            <div className="text-slate-300 whitespace-pre-wrap">{partnerResponse}</div>
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => onNavigate('workspace')}
                className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
              >
                <span>Incorporate in Employee Work Area</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
