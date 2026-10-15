/**
 * CatalystOS - Interactive Team Members Hierarchy (React Flow)
 * Visual organizational tree: Founder & CEO -> Core Operational Domains -> Team Members.
 * Built with @xyflow/react, Aura light theme styling, and interactive detail drawers.
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Handle,
  Position,
  MarkerType,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  ReactFlowInstance
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { TeamMember } from '../types';
import {
  Crown,
  Users,
  Code2,
  Compass,
  TrendingUp,
  Coins,
  Boxes,
  ShieldCheck,
  Mail,
  UserPlus,
  Trash2,
  X,
  Search,
  CheckCircle2,
  ArrowRight,
  Shield,
  Layers,
  Sparkles,
  Info,
  Plus,
  Minus,
  Maximize2,
  RotateCcw
} from 'lucide-react';

// ── DOMAIN METADATA CONFIGURATION ──────────────────────────────────────────
export interface DomainConfig {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
}

export const CORE_DOMAINS: DomainConfig[] = [
  {
    id: 'engineering',
    label: 'Engineering & Platform',
    icon: Code2,
    color: '#4f46e5',
    bgColor: 'rgba(79, 70, 229, 0.08)',
    borderColor: 'rgba(79, 70, 229, 0.25)',
    description: 'UPI stack, backend architecture, payment security & microservices.'
  },
  {
    id: 'product',
    label: 'Product & Design',
    icon: Compass,
    color: '#d97706',
    bgColor: 'rgba(217, 119, 6, 0.08)',
    borderColor: 'rgba(217, 119, 6, 0.25)',
    description: 'Merchant checkout UX, feature roadmaps & D2C buyer workflows.'
  },
  {
    id: 'growth',
    label: 'Growth & Marketing',
    icon: TrendingUp,
    color: '#059669',
    bgColor: 'rgba(5, 150, 105, 0.08)',
    borderColor: 'rgba(5, 150, 105, 0.25)',
    description: 'Customer acquisition, partner ecosystem, brand campaigns & GTM.'
  },
  {
    id: 'finance',
    label: 'Finance & Treasury',
    icon: Coins,
    color: '#7c3aed',
    bgColor: 'rgba(124, 58, 237, 0.08)',
    borderColor: 'rgba(124, 58, 237, 0.25)',
    description: 'Runway modeling, FP&A forecasts, nodal accounts & tax compliance.'
  },
  {
    id: 'operations',
    label: 'Operations & Logistics',
    icon: Boxes,
    color: '#0891b2',
    bgColor: 'rgba(8, 145, 178, 0.08)',
    borderColor: 'rgba(8, 145, 178, 0.25)',
    description: 'Pan-India shipping coordination, KYC verification & SLA tracking.'
  },
  {
    id: 'people_legal',
    label: 'People & Legal Governance',
    icon: ShieldCheck,
    color: '#e11d48',
    bgColor: 'rgba(225, 29, 72, 0.08)',
    borderColor: 'rgba(225, 29, 72, 0.25)',
    description: 'Talent hiring pipelines, corporate contracts, and regulatory filings.'
  }
];

export const INITIAL_DEMO_TEAM_MEMBERS: TeamMember[] = [
  {
    id: 'team_rajesh',
    fullName: 'Rajesh Verma',
    name: 'Rajesh Verma',
    email: 'rajesh.verma@catalyst.os',
    role: 'Head of Fintech Operations',
    department: 'Engineering & Platform',
    status: 'Active',
    joinedAt: '2025-01-10T09:00:00.000Z'
  },
  {
    id: 'team_priya',
    fullName: 'Priya Nair',
    name: 'Priya Nair',
    email: 'priya.nair@catalyst.os',
    role: 'Lead Integrations Engineer',
    department: 'Engineering & Platform',
    status: 'Active',
    joinedAt: '2025-01-15T09:00:00.000Z'
  },
  {
    id: 'team_arjun',
    fullName: 'Arjun Patel',
    name: 'Arjun Patel',
    email: 'arjun.patel@catalyst.os',
    role: 'Platform & Cloud Architect',
    department: 'Engineering & Platform',
    status: 'Active',
    joinedAt: '2025-02-01T09:00:00.000Z'
  },
  {
    id: 'team_ananya',
    fullName: 'Ananya Sharma',
    name: 'Ananya Sharma',
    email: 'ananya.sharma@catalyst.os',
    role: 'VP of Product & Growth',
    department: 'Product & Design',
    status: 'Active',
    joinedAt: '2025-01-12T09:00:00.000Z'
  },
  {
    id: 'team_vikram',
    fullName: 'Vikram Sen',
    name: 'Vikram Sen',
    email: 'vikram.sen@catalyst.os',
    role: 'Growth Marketing Director',
    department: 'Growth & Marketing',
    status: 'Active',
    joinedAt: '2025-02-10T09:00:00.000Z'
  },
  {
    id: 'team_rohit',
    fullName: 'Rohit Mehra',
    name: 'Rohit Mehra',
    email: 'rohit.mehra@catalyst.os',
    role: 'Head of Treasury & FP&A',
    department: 'Finance & Treasury',
    status: 'Active',
    joinedAt: '2025-01-20T09:00:00.000Z'
  },
  {
    id: 'team_aditi',
    fullName: 'Aditi Rao',
    name: 'Aditi Rao',
    email: 'aditi.rao@catalyst.os',
    role: 'Operations & Logistics Lead',
    department: 'Operations & Logistics',
    status: 'Active',
    joinedAt: '2025-02-15T09:00:00.000Z'
  },
  {
    id: 'team_ritu',
    fullName: 'Ritu Mathur',
    name: 'Ritu Mathur',
    email: 'ritu.mathur@catalyst.os',
    role: 'People Operations & Legal Lead',
    department: 'People & Legal Governance',
    status: 'Active',
    joinedAt: '2025-01-25T09:00:00.000Z'
  }
];

// Helper to match or create domain config from member's department string
export function resolveDomain(department: string): DomainConfig {
  const norm = (department || '').toLowerCase().trim();
  if (norm.includes('eng') || norm.includes('platform') || norm.includes('tech') || norm.includes('dev') || norm.includes('cloud')) {
    return CORE_DOMAINS[0];
  }
  if (norm.includes('prod') || norm.includes('design') || norm.includes('ux') || norm.includes('ui')) {
    return CORE_DOMAINS[1];
  }
  if (norm.includes('growth') || norm.includes('market') || norm.includes('sales') || norm.includes('rev')) {
    return CORE_DOMAINS[2];
  }
  if (norm.includes('fin') || norm.includes('treas') || norm.includes('acc') || norm.includes('tax')) {
    return CORE_DOMAINS[3];
  }
  if (norm.includes('op') || norm.includes('logist') || norm.includes('fulfill') || norm.includes('supply')) {
    return CORE_DOMAINS[4];
  }
  if (norm.includes('peop') || norm.includes('hr') || norm.includes('talent') || norm.includes('legal') || norm.includes('gov')) {
    return CORE_DOMAINS[5];
  }
  // Fallback for custom domains
  return {
    id: `custom_${norm.replace(/\s+/g, '_')}`,
    label: department || 'General Operations',
    icon: Layers,
    color: '#64748b',
    bgColor: 'rgba(100, 116, 139, 0.08)',
    borderColor: 'rgba(100, 116, 139, 0.25)',
    description: `Dedicated ${department} operations and strategic execution.`
  };
}

// ── CUSTOM NODE: FOUNDER / ROOT NODE ───────────────────────────────────────
function FounderNode({ data }: { data: any }) {
  return (
    <div 
      className="w-[320px] rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.04)] transition-all select-none hover:border-slate-300 hover:shadow-md cursor-pointer"
    >
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-md bg-amber-500/10 flex items-center justify-center">
            <Crown className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <span className="text-[11px] font-semibold text-slate-700 tracking-tight">
            Founder & Workspace Owner
          </span>
        </div>
        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
          Apex Authority
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center font-mono font-bold text-sm uppercase shrink-0 shadow-xs">
          {data.name?.slice(0, 2) || 'FO'}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-slate-900 truncate leading-tight">
            {data.name}
          </h3>
          <p className="text-xs font-medium text-slate-500 truncate mt-0.5">
            {data.role || 'Founder & CEO'}
          </p>
          <div className="flex items-center gap-1.5 mt-1 text-[11px] font-mono text-slate-400">
            <Mail className="w-3 h-3 shrink-0" />
            <span className="truncate">{data.email}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-500">
        <span>Org Scale:</span>
        <span className="font-semibold text-slate-800">
          {data.totalMembers} {data.totalMembers === 1 ? 'Member' : 'Members'} · {data.numDomains} Domains
        </span>
      </div>

      {/* Connection Handle to Domains */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        style={{ background: '#0f172a', width: 9, height: 9, border: '2px solid #ffffff' }} 
      />
    </div>
  );
}

// ── CUSTOM NODE: DOMAIN NODE ───────────────────────────────────────────────
function DomainNode({ data }: { data: any }) {
  const Icon = data.domain.icon;
  return (
    <div 
      className="w-[270px] rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] transition-all select-none hover:border-slate-300 hover:shadow-md cursor-pointer relative"
      style={{
        borderTop: `3px solid ${data.domain.color}`
      }}
    >
      <Handle 
        type="target" 
        position={Position.Top} 
        style={{ background: data.domain.color, width: 8, height: 8, border: '2px solid #ffffff' }} 
      />

      <div className="flex items-center justify-between mb-2.5">
        <div 
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-2xs"
          style={{ backgroundColor: data.domain.bgColor, color: data.domain.color }}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex items-center gap-1.5">
          <span 
            className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: data.domain.bgColor, color: data.domain.color }}
          >
            {data.memberCount} {data.memberCount === 1 ? 'Person' : 'People'}
          </span>
          {data.onAddClick && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                data.onAddClick(data.domain.label);
              }}
              title={`Add member to ${data.domain.label}`}
              className="p-1 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <h4 className="text-xs font-bold text-slate-900 leading-tight">
        {data.domain.label}
      </h4>
      <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-relaxed min-h-[32px]">
        {data.domain.description}
      </p>

      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-400">
        <span>Reports to:</span>
        <span className="font-semibold text-slate-700">Founder & CEO</span>
      </div>

      <Handle 
        type="source" 
        position={Position.Bottom} 
        style={{ background: data.domain.color, width: 8, height: 8, border: '2px solid #ffffff' }} 
      />
    </div>
  );
}

// ── CUSTOM NODE: TEAM MEMBER NODE ──────────────────────────────────────────
function MemberNode({ data }: { data: any }) {
  const isSelected = data.isSelected;
  return (
    <div 
      className={`w-[270px] rounded-xl border bg-white p-3.5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] transition-all select-none hover:border-slate-300 hover:shadow-sm cursor-pointer ${
        isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200'
      }`}
    >
      <Handle 
        type="target" 
        position={Position.Top} 
        style={{ background: '#94a3b8', width: 7, height: 7, border: '2px solid #ffffff' }} 
      />

      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-mono font-bold text-xs uppercase flex items-center justify-center shrink-0">
          {data.member.fullName?.slice(0, 2) || 'TM'}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <h5 className="text-xs font-bold text-slate-900 truncate">
              {data.member.fullName}
            </h5>
            <span 
              className={`w-2 h-2 rounded-full shrink-0 ${data.member.status === 'Invited' ? 'bg-amber-400' : 'bg-emerald-500'}`} 
              title={data.member.status || 'Active'}
            />
          </div>
          <p className="text-[11px] font-medium text-slate-500 truncate mt-0.5">
            {data.member.role}
          </p>
        </div>
      </div>

      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-400">
        <span className="truncate max-w-[160px]">
          {data.member.email || 'roster@catalyst.os'}
        </span>
        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-600">
          {data.member.status || 'Active'}
        </span>
      </div>

      <Handle 
        type="source" 
        position={Position.Bottom} 
        style={{ background: '#94a3b8', width: 7, height: 7, border: '2px solid #ffffff' }} 
      />
    </div>
  );
}

const nodeTypes = {
  founderNode: FounderNode,
  domainNode: DomainNode,
  memberNode: MemberNode
};

// ── CUSTOM CANVAS VIEWPORT CONTROLS ─────────────────────────────────────────
function CanvasViewportControls({
  onZoomIn,
  onZoomOut,
  onFitView,
  onResetView
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onResetView: () => void;
}) {
  return (
    <div className="absolute bottom-4 left-4 z-10 flex items-center gap-1 p-1 bg-white/95 backdrop-blur-md rounded-xl border border-slate-200/90 shadow-sm text-slate-600">
      <button
        onClick={onZoomIn}
        title="Zoom In (+)"
        aria-label="Zoom in org chart"
        className="p-1.5 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
      >
        <Plus className="w-4 h-4" />
      </button>
      <button
        onClick={onZoomOut}
        title="Zoom Out (-)"
        aria-label="Zoom out org chart"
        className="p-1.5 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
      >
        <Minus className="w-4 h-4" />
      </button>
      <div className="h-4 w-px bg-slate-200 mx-0.5" />
      <button
        onClick={onFitView}
        title="Fit All to View"
        aria-label="Fit all nodes to view"
        className="px-2.5 py-1 rounded-lg hover:bg-slate-100 hover:text-slate-900 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
      >
        <Maximize2 className="w-3.5 h-3.5" />
        <span>Fit</span>
      </button>
      <button
        onClick={onResetView}
        title="Center on Founder Node"
        aria-label="Center view on root founder node"
        className="px-2.5 py-1 rounded-lg hover:bg-slate-100 hover:text-slate-900 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span>Center</span>
      </button>
    </div>
  );
}

// ── COMPONENT PROPS ────────────────────────────────────────────────────────
interface OrgHierarchyFlowProps {
  founder: {
    name: string;
    email: string;
    role: string;
  };
  teamMembers: TeamMember[];
  onAddMemberClick?: (prefillDept?: string) => void;
  onRemoveMember?: (id: string) => Promise<void>;
  companyName?: string;
}

export default function OrgHierarchyFlow({
  founder,
  teamMembers,
  onAddMemberClick,
  onRemoveMember,
  companyName = 'Venture'
}: OrgHierarchyFlowProps) {
  const [selectedNode, setSelectedNode] = useState<{ type: 'founder' | 'domain' | 'member'; data: any } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDomain, setFilterDomain] = useState<string>('ALL');

  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);

  // Group team members by resolved domain
  const { domainsWithMembers, totalPeopleCount } = useMemo(() => {
    const map = new Map<string, { domain: DomainConfig; members: TeamMember[] }>();

    // Seed core domains so the org structure is clear even if zero members are in a domain
    CORE_DOMAINS.forEach((d) => {
      map.set(d.id, { domain: d, members: [] });
    });

    // Populate members
    teamMembers.forEach((m) => {
      const resolved = resolveDomain(m.department || m.role || 'General');
      if (!map.has(resolved.id)) {
        map.set(resolved.id, { domain: resolved, members: [] });
      }
      map.get(resolved.id)!.members.push(m);
    });

    const list = Array.from(map.values()).filter(item => {
      if (filterDomain === 'ALL') return true;
      return item.domain.id === filterDomain;
    });

    return {
      domainsWithMembers: list,
      totalPeopleCount: teamMembers.length + 1
    };
  }, [teamMembers, filterDomain]);

  // Construct React Flow Nodes and Edges with clean hierarchical coordinates
  const { nodes: computedNodes, edges: computedEdges, founderCenterX, founderCenterY } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    const activeList = domainsWithMembers;
    const numDomains = activeList.length;

    // Layout configuration
    const colWidth = 270;
    const gapX = 36;
    const startY = 28;
    const domainY = 210;
    const memberStartY = 390;
    const memberGapY = 116;

    const totalWidth = numDomains * colWidth + Math.max(0, numDomains - 1) * gapX;
    const founderWidth = 320;
    const founderX = totalWidth > founderWidth ? (totalWidth - founderWidth) / 2 : 0;
    const founderCenterX = founderX + founderWidth / 2;
    const founderCenterY = startY + 70;

    // 1. Root Node: Founder
    nodes.push({
      id: 'founder-root',
      type: 'founderNode',
      position: { x: founderX, y: startY },
      data: {
        name: founder.name,
        email: founder.email,
        role: founder.role,
        totalMembers: totalPeopleCount,
        numDomains: activeList.length
      }
    });

    // 2. Domain & Member Nodes
    activeList.forEach((group, dIdx) => {
      const currentX = totalWidth > founderWidth
        ? dIdx * (colWidth + gapX)
        : (founderWidth - colWidth) / 2;
      const domainNodeId = `domain-${group.domain.id}`;

      // Domain Node
      nodes.push({
        id: domainNodeId,
        type: 'domainNode',
        position: { x: currentX, y: domainY },
        data: {
          domain: group.domain,
          memberCount: group.members.length,
          onAddClick: onAddMemberClick
        }
      });

      // Edge from Founder -> Domain
      edges.push({
        id: `e-founder-${group.domain.id}`,
        source: 'founder-root',
        target: domainNodeId,
        type: 'smoothstep',
        animated: true,
        style: { stroke: group.domain.color, strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: group.domain.color,
          width: 12,
          height: 12
        }
      });

      // Member Nodes under this domain
      group.members.forEach((member, mIdx) => {
        const memberNodeId = `member-${member.id}`;
        const isMatched = searchQuery.trim() 
          ? member.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
            member.role?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            member.email?.toLowerCase().includes(searchQuery.toLowerCase())
          : false;

        nodes.push({
          id: memberNodeId,
          type: 'memberNode',
          position: { x: currentX, y: memberStartY + mIdx * memberGapY },
          data: {
            member,
            domain: group.domain,
            isSelected: selectedNode?.data?.member?.id === member.id || isMatched
          }
        });

        // Edge: Domain -> Member 0, and chained for subsequent members to prevent crossing lines
        const edgeSourceId = mIdx === 0 ? domainNodeId : `member-${group.members[mIdx - 1].id}`;
        edges.push({
          id: `e-${edgeSourceId}-${member.id}`,
          source: edgeSourceId,
          target: memberNodeId,
          type: 'smoothstep',
          style: { stroke: '#cbd5e1', strokeWidth: 1.75 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#94a3b8',
            width: 10,
            height: 10
          }
        });
      });
    });

    return { nodes, edges, founderCenterX, founderCenterY };
  }, [domainsWithMembers, totalPeopleCount, founder, searchQuery, selectedNode, onAddMemberClick]);

  // Sync state when computed nodes change
  const currentNodes = useMemo(() => computedNodes, [computedNodes]);
  const currentEdges = useMemo(() => computedEdges, [computedEdges]);

  const handleNodeClick = useCallback((_: any, node: Node) => {
    if (node.type === 'founderNode') {
      setSelectedNode({ type: 'founder', data: node.data });
    } else if (node.type === 'domainNode') {
      setSelectedNode({ type: 'domain', data: node.data });
    } else if (node.type === 'memberNode') {
      setSelectedNode({ type: 'member', data: node.data });
    }
  }, []);

  return (
    <div className="w-full flex flex-col font-sans">
      
      {/* ── 1. REDESIGNED UNIFIED TOOLBAR ─────────────────────────────────── */}
      <div 
        id="org-hierarchy-toolbar"
        className="w-full bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 shadow-xs mb-4"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
          
          {/* LEFT: Search */}
          <div className="relative w-full lg:w-64 xl:w-72 shrink-0">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              id="org-search-input"
              placeholder="Search people or domains..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-8 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50/60 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* CENTER: Domain Filters */}
          <div className="flex items-center gap-1 overflow-x-auto py-0.5 px-0.5 rounded-xl bg-slate-100/70 border border-slate-200/70 scrollbar-none max-w-full">
            <button
              onClick={() => setFilterDomain('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                filterDomain === 'ALL'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              All Domains
            </button>
            {CORE_DOMAINS.map(d => {
              const isSelected = filterDomain === d.id;
              const shortLabel = d.label.split(' ')[0];
              return (
                <button
                  key={d.id}
                  onClick={() => setFilterDomain(d.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? 'bg-white text-slate-900 font-semibold shadow-xs border border-slate-200/80'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  {shortLabel}
                </button>
              );
            })}
          </div>

          {/* RIGHT: Team summary and Primary Action */}
          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
            <div className="flex items-center gap-2 whitespace-nowrap text-xs font-mono text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span>
                {teamMembers.length} {teamMembers.length === 1 ? 'team member' : 'team members'} · 1 founder
              </span>
            </div>

            <div className="h-4 w-px bg-slate-200 hidden sm:block" />

            {onAddMemberClick && (
              <button
                onClick={() => onAddMemberClick()}
                id="flow-add-team-member-btn"
                className="h-10 px-4 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-xs cursor-pointer bg-slate-900 hover:bg-slate-800 text-white whitespace-nowrap shrink-0 hover:shadow-sm active:scale-[0.98]"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Add Team Member</span>
              </button>
            )}
          </div>

        </div>
      </div>

      {/* ── 2. REACT FLOW CANVAS WORKSPACE ───────────────────────────────── */}
      <div 
        id="org-hierarchy-canvas-wrapper"
        className="relative w-full h-[620px] sm:h-[680px] lg:h-[720px] rounded-2xl border border-slate-200/90 overflow-hidden bg-slate-50/60 shadow-xs"
      >
        <ReactFlow
          nodes={currentNodes}
          edges={currentEdges}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          fitView
          fitViewOptions={{ padding: 0.12, minZoom: 0.75, maxZoom: 1.0 }}
          minZoom={0.35}
          maxZoom={1.5}
          onInit={(instance) => {
            rfInstanceRef.current = instance;
          }}
          zoomOnScroll={false}
          panOnScroll={false}
          panOnDrag={true}
          preventScrolling={false}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#cbd5e1" />

          {/* Canvas Viewport Controls in bottom-left */}
          <CanvasViewportControls
            onZoomIn={() => rfInstanceRef.current?.zoomIn({ duration: 300 })}
            onZoomOut={() => rfInstanceRef.current?.zoomOut({ duration: 300 })}
            onFitView={() => rfInstanceRef.current?.fitView({ padding: 0.12, minZoom: 0.75, duration: 400 })}
            onResetView={() => {
              rfInstanceRef.current?.setCenter(founderCenterX, founderCenterY, { zoom: 0.95, duration: 400 });
            }}
          />
        </ReactFlow>

        {/* ── INTERACTIVE NODE DETAIL DRAWER ──────────────────────────────── */}
        {selectedNode && (
          <div 
            className="absolute top-4 right-4 z-20 w-80 max-w-[90vw] rounded-2xl p-5 border border-slate-200 bg-white/95 backdrop-blur-md shadow-xl animate-fade-in space-y-4"
          >
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold uppercase tracking-wider font-mono text-slate-800">
                  Hierarchy Information
                </span>
              </div>
              <button 
                onClick={() => setSelectedNode(null)}
                aria-label="Close detail drawer"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Member Details */}
            {selectedNode.type === 'member' && (
              <div className="space-y-3.5 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 flex items-center justify-center font-mono font-bold text-sm uppercase shrink-0">
                    {selectedNode.data.member.fullName?.slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-slate-900 truncate">
                      {selectedNode.data.member.fullName}
                    </h4>
                    <p className="text-xs font-medium text-slate-500 truncate mt-0.5">
                      {selectedNode.data.member.role}
                    </p>
                  </div>
                </div>

                {/* Reporting Line Breadcrumb */}
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">
                    Reporting Line
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700">
                    <span>Founder</span>
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                    <span className="font-semibold text-indigo-600">
                      {selectedNode.data.domain.label}
                    </span>
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                    <span className="font-bold">{selectedNode.data.member.fullName.split(' ')[0]}</span>
                  </div>
                </div>

                {/* Metadata Fields */}
                <div className="space-y-2 pt-1 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Domain:</span>
                    <span className="font-semibold text-slate-800">
                      {selectedNode.data.member.department || selectedNode.data.domain.label}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Contact:</span>
                    <span className="truncate max-w-[170px] text-slate-800">
                      {selectedNode.data.member.email}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Status:</span>
                    <span className="text-emerald-600 font-bold">
                      {selectedNode.data.member.status || 'Active Roster'}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex gap-2">
                  <a
                    href={`mailto:${selectedNode.data.member.email}`}
                    className="flex-1 py-2 rounded-xl text-center font-semibold text-xs transition-all border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center justify-center gap-1.5"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Email Member</span>
                  </a>
                  {onRemoveMember && (
                    <button
                      onClick={() => {
                        onRemoveMember(selectedNode.data.member.id);
                        setSelectedNode(null);
                      }}
                      title="Remove from roster"
                      className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 transition-colors border border-rose-200 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Domain Details */}
            {selectedNode.type === 'domain' && (
              <div className="space-y-3.5 text-xs">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {selectedNode.data.domain.label}
                  </h4>
                  <p className="text-[11px] mt-1 leading-relaxed text-slate-500">
                    {selectedNode.data.domain.description}
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">
                    Domain Structure
                  </span>
                  <p className="text-[11px] text-slate-700">
                    Reports directly to <strong className="text-indigo-600">{founder.name}</strong>. Manages {selectedNode.data.memberCount} operational team members.
                  </p>
                </div>

                {onAddMemberClick && (
                  <button
                    onClick={() => {
                      onAddMemberClick(selectedNode.data.domain.label);
                      setSelectedNode(null);
                    }}
                    className="w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xs bg-slate-900 hover:bg-slate-800 text-white"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>+ Add Member to this Domain</span>
                  </button>
                )}
              </div>
            )}

            {/* Founder Details */}
            {selectedNode.type === 'founder' && (
              <div className="space-y-3.5 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center font-mono font-bold text-sm uppercase shrink-0">
                    {founder.name?.slice(0, 2)}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      {founder.name}
                    </h4>
                    <p className="text-xs font-medium text-slate-500">
                      {founder.role}
                    </p>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">
                    Apex Leadership Mandate
                  </span>
                  <p className="text-[11px] text-slate-700 leading-relaxed">
                    Ultimate venture signing authority, cap table oversight, capital allocation, and executive approval gate.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
