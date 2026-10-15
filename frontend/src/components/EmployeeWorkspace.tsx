import React, { useState, useEffect, useMemo } from 'react';
import { EmployeeWorkspacePayload, DelegatedTask, CommunityPost, ReportingHierarchy } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  Compass, CheckSquare, Users, MessageSquare, RefreshCw,
  User, Shield, Building, Mail, X, Check, ArrowRight,
  ExternalLink, Bell, Briefcase, LayoutDashboard, LogOut
} from 'lucide-react';
import WorkspaceOverview from './workspace/WorkspaceOverview';
import WorkspaceMyWork from './workspace/WorkspaceMyWork';
import WorkspaceTeam from './workspace/WorkspaceTeam';
import WorkspaceCommunity from './workspace/WorkspaceCommunity';

interface EmployeeWorkspaceProps {
  userRole?: string;
  userName?: string;
  companyName?: string;
  initialTaskId?: string | null;
  onRefreshTasks?: () => Promise<void>;
  onNavigateToApprovals?: () => void;
  onNavigateToDashboard?: () => void;
}

export type WorkspaceTab = 'overview' | 'work' | 'team' | 'community';

export default function EmployeeWorkspace({
  userRole: propUserRole,
  userName: propUserName,
  companyName = 'Catalyst Venture',
  initialTaskId,
  onRefreshTasks,
  onNavigateToApprovals,
  onNavigateToDashboard
}: EmployeeWorkspaceProps) {
  const { apiFetch, user, logout } = useAuth();
  const userRole = propUserRole || user?.role || 'Member';
  const userName = propUserName || user?.name || 'Team Member';

  // Navigation: strictly 4 sections
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(initialTaskId || null);

  // Sync tab & task from URL pathname or search params on direct load/refresh
  useEffect(() => {
    try {
      const pathname = window.location.pathname.toLowerCase();
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      const taskParam = params.get('task');

      let initialMatchedTab: WorkspaceTab | null = null;
      if (pathname.includes('/work')) initialMatchedTab = 'work';
      else if (pathname.includes('/team')) initialMatchedTab = 'team';
      else if (pathname.includes('/community')) initialMatchedTab = 'community';
      else if (pathname.includes('/overview')) initialMatchedTab = 'overview';
      else if (tabParam && ['overview', 'work', 'team', 'community'].includes(tabParam)) {
        initialMatchedTab = tabParam as WorkspaceTab;
      }

      if (initialMatchedTab) {
        setActiveTab(initialMatchedTab);
      }
      if (taskParam) {
        setSelectedTaskId(taskParam);
        setActiveTab('work');
      }
    } catch {}
  }, []);

  const handleTabChange = (tab: WorkspaceTab) => {
    setActiveTab(tab);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      if (window.location.pathname.startsWith('/employee')) {
        url.pathname = `/employee/${tab}`;
      }
      window.history.replaceState({}, '', url.toString());
    } catch {}
  };

  // Data state
  const [workspaceData, setWorkspaceData] = useState<EmployeeWorkspacePayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [latestAnnouncement, setLatestAnnouncement] = useState<CommunityPost | null>(null);

  // Profile modal state (Section 8: compact employee profile)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [hierarchyData, setHierarchyData] = useState<ReportingHierarchy | null>(null);

  // Handle incoming initialTaskId prop
  useEffect(() => {
    if (initialTaskId) {
      setSelectedTaskId(initialTaskId);
      setActiveTab('work');
    }
  }, [initialTaskId]);

  // Load workspace data
  const loadWorkspace = async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) setIsRefreshing(true);
      else setLoading(true);

      const [workspaceRes, announcementRes, hierarchyRes] = await Promise.allSettled([
        apiFetch('/api/workspace/employee'),
        apiFetch('/api/community/posts?type=announcement'),
        apiFetch('/api/team/hierarchy')
      ]);

      if (workspaceRes.status === 'fulfilled' && workspaceRes.value.ok) {
        const data: EmployeeWorkspacePayload = await workspaceRes.value.json();
        setWorkspaceData(data);
        if (data.tasks?.length > 0 && !selectedTaskId) {
          setSelectedTaskId(data.tasks[0].id);
        }
      }

      if (announcementRes.status === 'fulfilled' && announcementRes.value.ok) {
        const announcements: CommunityPost[] = await announcementRes.value.json();
        if (announcements.length > 0) {
          setLatestAnnouncement(announcements[0]);
        }
      }

      if (hierarchyRes.status === 'fulfilled' && hierarchyRes.value.ok) {
        const hierarchy: ReportingHierarchy = await hierarchyRes.value.json();
        setHierarchyData(hierarchy);
      }
    } catch (err) {
      console.error('[EmployeeWorkspace] Error loading workspace:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadWorkspace();
  }, []);

  const handleRefresh = async () => {
    await loadWorkspace(true);
    if (onRefreshTasks) await onRefreshTasks();
  };

  const tasks = workspaceData?.tasks || [];
  const department = workspaceData?.department || 'Operations';
  const openTasksCount = useMemo(() => {
    return tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length;
  }, [tasks]);

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 pb-16">
      {/* 1. TOP APPLICATION BAR / WORKSPACE SHELL */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Left: Brand & Workspace Title */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                C
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-900 truncate">
                    {companyName}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="text-xs font-medium text-slate-500">
                    Employee Operating System
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Quick actions & Profile access */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleRefresh}
                title="Refresh Workspace"
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
              </button>

              {onNavigateToApprovals && (
                <button
                  onClick={onNavigateToApprovals}
                  className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200/80 transition-colors"
                >
                  <Shield className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Approvals Queue</span>
                </button>
              )}

              {onNavigateToDashboard && (
                <button
                  onClick={onNavigateToDashboard}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100/90 rounded-lg border border-indigo-200/80 transition-colors"
                >
                  <LayoutDashboard className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Founder Dashboard</span>
                </button>
              )}

              {/* Profile summary button */}
              <button
                onClick={() => setIsProfileModalOpen(true)}
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-lg transition-colors text-left"
              >
                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-semibold text-xs">
                  {userName.charAt(0) || 'U'}
                </div>
                <div className="hidden sm:block">
                  <div className="text-xs font-semibold text-slate-900 leading-none truncate max-w-[120px]">
                    {userName}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 leading-none">
                    {userRole}
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* 2. THE FOUR PRIMARY NAVIGATION TABS */}
          <nav className="flex items-center gap-1 overflow-x-auto border-t border-slate-100 py-2 -mx-4 px-4 sm:mx-0 sm:px-0">
            {[
              { id: 'overview', label: 'Overview', icon: Compass, count: null },
              { id: 'work', label: 'My Work', icon: CheckSquare, count: openTasksCount > 0 ? openTasksCount : null },
              { id: 'team', label: 'Team', icon: Users, count: null },
              { id: 'community', label: 'Community', icon: MessageSquare, count: null },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id as WorkspaceTab)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-slate-900 text-white font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  {tab.count !== null && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                      isActive ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* 3. MAIN WORKSPACE CONTENT */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {loading ? (
          <div className="py-20 text-center flex flex-col items-center justify-center">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-xs font-medium text-slate-500">Loading your workspace...</p>
          </div>
        ) : (
          <>
            {/* TAB A: OVERVIEW */}
            {activeTab === 'overview' && (
              <WorkspaceOverview
                userName={userName}
                userRole={userRole}
                department={department}
                tasks={tasks}
                onSelectTask={(id) => {
                  setSelectedTaskId(id);
                  setActiveTab('work');
                }}
                onNavigateTab={(tab) => setActiveTab(tab)}
                latestAnnouncement={latestAnnouncement}
                apiFetch={apiFetch}
              />
            )}

            {/* TAB B: MY WORK */}
            {activeTab === 'work' && (
              <WorkspaceMyWork
                tasks={tasks}
                selectedTaskId={selectedTaskId}
                onSelectTask={setSelectedTaskId}
                accessibleDocuments={workspaceData?.accessibleDocuments || []}
                apiFetch={apiFetch}
                onRefreshTasks={handleRefresh}
                userName={userName}
                userRole={userRole}
              />
            )}

            {/* TAB C: TEAM */}
            {activeTab === 'team' && (
              <WorkspaceTeam
                apiFetch={apiFetch}
                userName={userName}
                userRole={userRole}
                department={department}
                onNavigateTab={(tab) => setActiveTab(tab)}
              />
            )}

            {/* TAB D: COMMUNITY */}
            {activeTab === 'community' && (
              <WorkspaceCommunity
                apiFetch={apiFetch}
                userName={userName}
                userRole={userRole}
                department={department}
              />
            )}
          </>
        )}
      </main>

      {/* 4. COMPACT EMPLOYEE PROFILE MODAL (Section 8) */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Employee Profile Summary
              </h3>
              <button
                onClick={() => setIsProfileModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-xs">
                {userName.charAt(0) || 'U'}
              </div>
              <div className="min-w-0">
                <h4 className="text-base font-bold text-slate-900 leading-tight">
                  {userName}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">{user?.email || 'employee@catalyst.os'}</p>
                <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full">
                  {userRole}
                </span>
              </div>
            </div>

            <div className="space-y-3 pt-2 text-xs">
              <div className="bg-slate-50 rounded-xl p-3.5 space-y-2 border border-slate-100">
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Domain / Department</span>
                  <span className="font-semibold text-slate-800">{department}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Direct Manager</span>
                  <span className="font-semibold text-slate-800">
                    {hierarchyData?.myManager?.name || hierarchyData?.founder?.name || 'Founder & CEO'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Active Workload</span>
                  <span className="font-semibold text-slate-800">{openTasksCount} active tasks</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Access Scope</span>
                  <span className="font-semibold text-emerald-700">Tenant Isolated & Verified</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                onClick={() => logout()}
                className="px-3.5 py-2 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
              <button
                onClick={() => setIsProfileModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
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
