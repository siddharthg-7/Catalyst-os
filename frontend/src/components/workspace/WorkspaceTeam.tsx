/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { ReportingHierarchy, DomainExpert, OrgMemberNode } from '../../types';
import {
  Users, User, Shield, Mail, Copy, Check, MessageSquare,
  ArrowDown, ChevronRight, Building, Award, ExternalLink,
  Search, Filter, Clock, AlertTriangle, CheckCircle2,
  Briefcase, Sparkles, UserCheck, Layers, GitBranch,
  MapPin, X, ArrowUpRight, ChevronDown, CheckCircle
} from 'lucide-react';

interface WorkspaceTeamProps {
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  userName?: string;
  userRole?: string;
  department?: string;
  onNavigateTab: (tab: 'work' | 'community') => void;
}

export default function WorkspaceTeam({
  apiFetch,
  userName = 'Team Member',
  userRole = 'Member',
  department = 'Operations',
  onNavigateTab
}: WorkspaceTeamProps) {
  const [hierarchy, setHierarchy] = useState<ReportingHierarchy | null>(null);
  const [experts, setExperts] = useState<DomainExpert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [hierarchyViewMode, setHierarchyViewMode] = useState<'full_org' | 'my_reporting'>('full_org');
  const [selectedMember, setSelectedMember] = useState<OrgMemberNode | DomainExpert | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadTeamData = async () => {
      try {
        setLoading(true);
        const [hierRes, expRes] = await Promise.allSettled([
          apiFetch('/api/team/hierarchy'),
          apiFetch('/api/workspace/experts')
        ]);

        if (isMounted) {
          if (hierRes.status === 'fulfilled' && hierRes.value.ok) {
            setHierarchy(await hierRes.value.json());
          }
          if (expRes.status === 'fulfilled' && expRes.value.ok) {
            setExperts(await expRes.value.json());
          }
        }
      } catch (e) {
        console.warn('Note: Could not load team data', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadTeamData();
    return () => { isMounted = false; };
  }, []);

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  // 6 verified members from hierarchy or experts
  const allTeamMembers: (OrgMemberNode | DomainExpert)[] = useMemo(() => {
    if (hierarchy?.allMembers && hierarchy.allMembers.length > 0) {
      return hierarchy.allMembers;
    }
    return experts;
  }, [hierarchy, experts]);

  // Filtered roster of team members
  const filteredMembers = useMemo(() => {
    return allTeamMembers.filter(exp => {
      if (deptFilter !== 'ALL' && exp.department.toUpperCase() !== deptFilter.toUpperCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = exp.name.toLowerCase().includes(q);
        const roleMatch = exp.role.toLowerCase().includes(q);
        const skillMatch = exp.skills?.some(s => s.toLowerCase().includes(q));
        const deptMatch = exp.department.toLowerCase().includes(q);
        return nameMatch || roleMatch || skillMatch || deptMatch;
      }
      return true;
    });
  }, [allTeamMembers, deptFilter, searchQuery]);

  // Derived hierarchy levels
  const level1Members = useMemo(() => {
    return hierarchy?.levels?.level1 || allTeamMembers.filter(m => m.level === 1 || m.role?.toLowerCase().includes('founder') || m.department === 'Executive');
  }, [hierarchy, allTeamMembers]);

  const level2Members = useMemo(() => {
    return hierarchy?.levels?.level2 || allTeamMembers.filter(m => (m.level === 2 || m.role?.toLowerCase().includes('lead') || m.role?.toLowerCase().includes('vp')) && m.level !== 1);
  }, [hierarchy, allTeamMembers]);

  const level3Members = useMemo(() => {
    return hierarchy?.levels?.level3 || allTeamMembers.filter(m => (m.level === 3 || m.role?.toLowerCase().includes('engineer')) && m.level !== 1 && m.level !== 2);
  }, [hierarchy, allTeamMembers]);

  return (
    <div className="space-y-6">
      {/* 1. HEADER */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Organization & Collaboration
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Team Directory & 6-Member Hierarchy
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Complete organizational structure, reporting relationships, and domain expertise across all 6 company members.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => onNavigateTab('community')}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Community Hub</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. TEAM WORKLOAD & STRUCTURE OVERVIEW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">{allTeamMembers.length || 6} Members</div>
            <div className="text-xs text-slate-500 font-medium">1 Exec • 4 Leads • 1 IC</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">3 Org Levels</div>
            <div className="text-xs text-slate-500 font-medium">Clear Reporting Hierarchy</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">83% Online</div>
            <div className="text-xs text-slate-500 font-medium">5 Available • 1 Focus Mode</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-900">3 Key Initiatives</div>
            <div className="text-xs text-slate-500 font-medium">UPI 2.0 • RBI • Analytics</div>
          </div>
        </div>
      </div>

      {/* 3. REPORTING HIERARCHY — SECTION 6.D */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-indigo-600" />
              <span>Company Organizational Hierarchy</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Every employee knows who reviews their work, where deliverables route, and who leads each domain.
            </p>
          </div>

          {/* Toggle between Full 6-Member Org Hierarchy and Personal Reporting Line */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-start sm:self-auto">
            <button
              onClick={() => setHierarchyViewMode('full_org')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                hierarchyViewMode === 'full_org'
                  ? 'bg-white text-slate-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Full Company Tree (6 Members)
            </button>
            <button
              onClick={() => setHierarchyViewMode('my_reporting')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                hierarchyViewMode === 'my_reporting'
                  ? 'bg-white text-slate-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              My Direct Reporting Line
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading organizational structure...</div>
        ) : hierarchyViewMode === 'full_org' ? (
          /* FULL 6-MEMBER ORGANIZATIONAL CHART */
          <div className="space-y-6">
            {/* LEVEL 1: EXECUTIVE LEADERSHIP (Founder & CEO) */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200">
                  Level 1: Executive Leadership
                </span>
                <span className="text-xs text-slate-400">Strategic Direction & Investor Governance</span>
              </div>

              {level1Members.map(member => (
                <div
                  key={member.id}
                  onClick={() => setSelectedMember(member)}
                  className="bg-indigo-50/40 hover:bg-indigo-50/80 border border-indigo-200 rounded-xl p-4.5 cursor-pointer transition-all hover:shadow-sm"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white font-bold text-base flex items-center justify-center shadow-xs shrink-0">
                        {member.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-slate-900">{member.name}</h3>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                            {member.role || 'Founder & CEO'}
                          </span>
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {member.department}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                          {member.bio || 'Ex-Razorpay PM, building autonomous FinTech infrastructure.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-indigo-100">
                      <span className="text-[11px] font-semibold text-indigo-700 flex items-center gap-1">
                        <span>4 Direct Reports (Domain Leads)</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                      <span className="text-[10px] text-slate-500">Click for full profile & projects</span>
                    </div>
                  </div>

                  {/* Connecting indicator */}
                  <div className="mt-3 pt-3 border-t border-indigo-200/60 flex items-center justify-between text-[11px] text-slate-600">
                    <span className="font-medium">Direct Reports: Priya Sundaram, Ananya Deshmukh, Vikram Malhotra, Neha Gupta</span>
                    <span className="text-indigo-600 font-semibold">Reports to: Board of Directors</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Tree Branch Visual Connector */}
            <div className="flex flex-col items-center my-1">
              <div className="w-0.5 h-6 bg-indigo-300" />
              <div className="w-full max-w-4xl h-0.5 bg-indigo-200" />
              <div className="w-full max-w-4xl flex justify-around">
                <div className="w-0.5 h-4 bg-indigo-200" />
                <div className="w-0.5 h-4 bg-indigo-200" />
                <div className="w-0.5 h-4 bg-indigo-200" />
                <div className="w-0.5 h-4 bg-indigo-200" />
              </div>
            </div>

            {/* LEVEL 2: FUNCTIONAL DOMAIN LEADS (4 Members) */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200">
                  Level 2: Functional Domain Leads & Department Heads
                </span>
                <span className="text-xs text-slate-400">Reports to Aarav Sharma (Founder & CEO)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {level2Members.map(member => {
                  const isEngLead = member.name.toLowerCase().includes('priya');
                  return (
                    <div
                      key={member.id}
                      onClick={() => setSelectedMember(member)}
                      className={`rounded-xl p-4 border cursor-pointer transition-all hover:shadow-md space-y-3 flex flex-col justify-between ${
                        isEngLead
                          ? 'bg-purple-50/40 border-purple-200 hover:border-purple-300'
                          : 'bg-white border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-lg bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                              {member.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-xs font-bold text-slate-900 truncate">{member.name}</h3>
                              <div className="text-[11px] font-medium text-slate-500 truncate">{member.role}</div>
                            </div>
                          </div>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                            member.availability === 'FOCUS' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {member.availability === 'FOCUS' ? 'Focus' : 'Available'}
                          </span>
                        </div>

                        <div className="mt-2.5">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            {member.department}
                          </span>
                          <p className="text-[11px] text-slate-600 mt-2 line-clamp-2 leading-relaxed">
                            {member.bio}
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 text-[10px] space-y-1">
                        <div className="flex items-center justify-between text-slate-500">
                          <span>Reports to:</span>
                          <span className="font-semibold text-slate-700 truncate">Aarav Sharma (CEO)</span>
                        </div>
                        {isEngLead ? (
                          <div className="flex items-center justify-between text-indigo-600 font-semibold">
                            <span>Direct Reports:</span>
                            <span>1 (Rohan Mehta)</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between text-slate-400">
                            <span>Direct Reports:</span>
                            <span>Direct Contributor</span>
                          </div>
                        )}
                        <div className="pt-1 text-right">
                          <span className="text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-0.5">
                            View details →
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tree Branch Visual Connector to Level 3 */}
            <div className="flex flex-col items-center my-1">
              <div className="w-0.5 h-6 bg-purple-300" />
              <div className="w-0.5 h-3 bg-purple-200" />
            </div>

            {/* LEVEL 3: SENIOR INDIVIDUAL CONTRIBUTORS & CORE EXECUTION (1 Member) */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                  Level 3: Core Engineering & Execution
                </span>
                <span className="text-xs text-slate-400">Reports to Priya Sundaram (VP of Engineering)</span>
              </div>

              {level3Members.map(member => (
                <div
                  key={member.id}
                  onClick={() => setSelectedMember(member)}
                  className="bg-emerald-50/40 hover:bg-emerald-50/80 border border-emerald-200 rounded-xl p-4.5 cursor-pointer transition-all hover:shadow-sm"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white font-bold text-sm flex items-center justify-center shadow-xs shrink-0">
                        {member.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-slate-900">{member.name}</h3>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                            {member.role || 'Senior Full-Stack Engineer'}
                          </span>
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {member.department}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                          {member.bio || 'Leads merchant dashboard frontend systems and interactive developer experiences.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-emerald-100">
                      <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                        <span>Reports to Priya Sundaram (VP Eng)</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                      <span className="text-[10px] text-slate-500">Active on UPI 2.0 Recurring Mandates</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-emerald-200/60 flex items-center justify-between text-[11px] text-slate-600">
                    <span className="font-medium">Active Deliverable: UPI Mandate Authorization Bottomsheet component</span>
                    <span className="text-emerald-700 font-semibold">Reviewer: Priya Sundaram</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* PERSONAL DIRECT REPORTING CHAIN VIEW */
          <div className="max-w-2xl mx-auto py-2">
            {/* Step 1: Founder / CEO */}
            <div className="flex items-start gap-4">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                  {hierarchy?.founder?.name?.charAt(0) || 'A'}
                </div>
                <div className="w-0.5 h-10 bg-indigo-200 my-1" />
              </div>
              <div className="pt-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-slate-900 truncate">{hierarchy?.founder?.name || 'Aarav Sharma'}</h3>
                  <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Founder & CEO (Level 1)
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Final approval authorization on core milestones & budget allocations</p>
              </div>
            </div>

            {/* Step 2: Direct Manager / Domain Lead */}
            {hierarchy?.myManager && (
              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                    {hierarchy.myManager.name?.charAt(0) || 'P'}
                  </div>
                  <div className="w-0.5 h-10 bg-purple-200 my-1" />
                </div>
                <div className="pt-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-slate-900 truncate">{hierarchy.myManager.name}</h3>
                    <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                      Direct Lead / Reviewer (Level 2)
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">Domain guidance, sprint task reviews, and technical sign-offs</p>
                </div>
              </div>
            )}

            {/* Step 3: Current Employee */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
                {userName.charAt(0) || 'R'}
              </div>
              <div className="pt-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-slate-900 truncate">{userName} (You)</h3>
                  <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {userRole} (Level 3)
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Author and owner of prioritized deliverables in {department}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. TEAM DIRECTORY & DOMAIN EXPERTS — SECTION 6.A & 6.B */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Company Team Members & Domain Expertise</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Click any team member card to view complete reporting lines, responsibilities, and active deliverables.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Department Filter Pills */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg overflow-x-auto">
              {['ALL', 'Engineering', 'Product', 'Compliance', 'Growth', 'Executive'].map(dept => (
                <button
                  key={dept}
                  onClick={() => setDeptFilter(dept)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    deptFilter === dept ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {dept}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search name, skill, or role..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Members Grid (All 6 Members) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMembers.map(exp => (
            <div
              key={exp.id}
              className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-indigo-300 transition-all space-y-3 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 text-white font-bold text-sm flex items-center justify-center shrink-0">
                      {exp.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs font-bold text-slate-900 truncate">{exp.name}</h3>
                      <div className="text-[11px] text-slate-500 truncate">{exp.role}</div>
                    </div>
                  </div>

                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                    exp.availability === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    exp.availability === 'FOCUS' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                    'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    {exp.availability === 'AVAILABLE' ? 'Available' : 'Focus'}
                  </span>
                </div>

                {/* Reporting line & Department pill */}
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {exp.department}
                  </span>
                  <span className="text-[10px] text-slate-500 truncate">
                    Reports to: {exp.reportsTo || 'Aarav Sharma (CEO)'}
                  </span>
                </div>

                <p className="text-[11px] text-slate-600 mt-2 line-clamp-2 leading-relaxed">
                  {exp.bio}
                </p>

                {/* Skill chips */}
                <div className="flex flex-wrap gap-1 pt-2">
                  {exp.skills?.slice(0, 3).map((skill, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                  {exp.skills && exp.skills.length > 3 && (
                    <span className="text-[10px] px-1 text-slate-400">+{exp.skills.length - 3}</span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-200/70 space-y-2">
                <button
                  onClick={() => setSelectedMember(exp)}
                  className="w-full py-1.5 px-3 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/80 transition-colors flex items-center justify-center gap-1"
                >
                  <span>View Full Profile & Shared Work</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>

                <div className="flex items-center justify-between text-[11px]">
                  <button
                    onClick={() => handleCopyEmail(exp.email)}
                    className="text-slate-600 hover:text-slate-900 flex items-center gap-1 font-medium transition-colors"
                  >
                    {copiedEmail === exp.email ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                    <span>{copiedEmail === exp.email ? 'Copied' : 'Copy Email'}</span>
                  </button>

                  <button
                    onClick={() => {
                      onNavigateTab('community');
                    }}
                    className="text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1"
                  >
                    <span>Ask in Community →</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. COMPREHENSIVE MEMBER PROFILE & DETAILS MODAL */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
            {/* Modal Header */}
            <div className="bg-slate-50 p-6 border-b border-slate-200 relative">
              <button
                onClick={() => setSelectedMember(null)}
                className="absolute top-5 right-5 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white font-bold text-xl flex items-center justify-center shadow-md shrink-0">
                  {selectedMember.name.charAt(0)}
                </div>
                <div className="min-w-0 pr-8">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold text-slate-900">{selectedMember.name}</h2>
                    <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${
                      selectedMember.availability === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      selectedMember.availability === 'FOCUS' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                      'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      {selectedMember.availability === 'AVAILABLE' ? '● Available' : '● Focus Mode'}
                    </span>
                  </div>

                  <div className="text-xs font-semibold text-indigo-700 mt-0.5">
                    {selectedMember.role}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-2 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Building className="w-3.5 h-3.5 text-slate-400" />
                      <span>{selectedMember.department}</span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{selectedMember.location || 'Bengaluru, Karnataka (HQ)'}</span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{selectedMember.timezone || 'IST (UTC+5:30)'}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Hierarchy Position & Reporting Lines */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Reporting Line & Team Position</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block">Reports directly to:</span>
                    <span className="font-semibold text-slate-900">
                      {selectedMember.reportsTo || 'Aarav Sharma (Founder & CEO)'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block">Organizational Tier:</span>
                    <span className="font-semibold text-slate-900">
                      {selectedMember.level === 1 ? 'Level 1: Executive' : selectedMember.level === 2 ? 'Level 2: Functional Domain Lead' : 'Level 3: Core Engineering & Execution'}
                    </span>
                  </div>
                </div>

                {selectedMember.directReportNames && selectedMember.directReportNames.length > 0 && (
                  <div className="pt-2 border-t border-slate-200/70 text-xs">
                    <span className="text-slate-500 block mb-1">Direct Reports ({selectedMember.directReportsCount}):</span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedMember.directReportNames.map((report, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded bg-white border border-slate-200 font-medium text-slate-800">
                          {report}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Bio */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Professional Background
                </h4>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {selectedMember.bio}
                </p>
              </div>

              {/* Core Responsibilities */}
              {selectedMember.responsibilities && selectedMember.responsibilities.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                    Core Operational Responsibilities
                  </h4>
                  <ul className="space-y-1.5">
                    {selectedMember.responsibilities.map((resp, idx) => (
                      <li key={idx} className="text-xs text-slate-700 flex items-start gap-2">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{resp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Active FinTech Initiatives & Current Deliverable */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  Active Projects & Deliverables
                </h4>

                <div className="space-y-2.5">
                  {selectedMember.activeProjects && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedMember.activeProjects.map((proj, idx) => (
                        <span key={idx} className="text-xs px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-medium flex items-center gap-1.5">
                          <Briefcase className="w-3 h-3 text-indigo-500" />
                          <span>{proj}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {selectedMember.currentDeliverable && (
                    <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
                      <span className="font-bold block text-amber-800 mb-0.5">Current Deliverable:</span>
                      <span>{selectedMember.currentDeliverable}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Skills */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  Verified Domain Skills
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedMember.skills?.map((skill, idx) => (
                    <span
                      key={idx}
                      className="text-xs px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer / Actions */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                onClick={() => handleCopyEmail(selectedMember.email)}
                className="w-full sm:w-auto px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-center gap-1.5"
              >
                {copiedEmail === selectedMember.email ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
                <span>{copiedEmail === selectedMember.email ? 'Copied Email' : `Copy ${selectedMember.email}`}</span>
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => {
                    setSelectedMember(null);
                    onNavigateTab('community');
                  }}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Ask in Community</span>
                </button>

                <button
                  onClick={() => setSelectedMember(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
