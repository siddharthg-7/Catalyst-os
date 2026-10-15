/**
 * CatalystOS - Founder Decision Inbox & Approvals (Section 14)
 * Engineered with Apple × Linear × Notion aesthetics.
 * Scannable Decision Inbox table with translucent risk badges, clean 8pt spacing,
 * and a focused slide-over evaluation drawer with Before vs After state projections,
 * parameter modification sliders, and high-assurance audit trails.
 */

import React, { useState, useMemo } from 'react';
import { Deliverable } from '../types';
import {
  CheckCircle2, XCircle, FileText, ChevronRight,
  Shield, SlidersHorizontal, ArrowRight, Check, X,
  Search, ExternalLink, Scale, Sparkles, RotateCcw
} from 'lucide-react';
import Section from './Section';
import { formatINR, formatCompactINR } from '../utils/currency';

interface ApprovalQueueProps {
  approvals: Deliverable[];
  onReviewItem: (id: string, action: 'approve' | 'modify' | 'reject' | 'request_changes', feedback?: string, modifications?: any) => Promise<void>;
  currentCash?: number;
  currentBurn?: number;
}

export default function ApprovalQueue({
  approvals,
  onReviewItem,
  currentCash = 7200000,
  currentBurn = 800000
}: ApprovalQueueProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Review Drawer state
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModifying, setIsModifying] = useState(false);
  const [isRequestingChanges, setIsRequestingChanges] = useState(false);
  const [changesDirective, setChangesDirective] = useState('');

  // Modification form state
  const [customCost, setCustomCost] = useState<string>('');
  const [customHeadcount, setCustomHeadcount] = useState<string>('1');
  const [customConditions, setCustomConditions] = useState<string>('');

  const selectedItem = approvals.find(a => a.id === selectedItemId) || null;

  // Filtered approvals list
  const filteredApprovals = useMemo(() => {
    return approvals.filter(item => {
      if (filterType !== 'ALL' && item.type.toUpperCase() !== filterType) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesDesc = item.description.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc) return false;
      }
      return true;
    });
  }, [approvals, filterType, searchQuery]);

  // Derive risk tier & reversibility deterministically
  const getItemGovernance = (item: Deliverable) => {
    const cost = Math.abs(item.financialChange || 0);
    const type = item.type.toLowerCase();

    if (type === 'contract' || cost >= 50000) {
      return { risk: 'CRITICAL' as const, reversibility: 'IRREVERSIBLE' as const, rec: 'Helena (Legal)' };
    }
    if (cost >= 15000 || type === 'financials') {
      return { risk: 'HIGH' as const, reversibility: 'IRREVERSIBLE' as const, rec: 'Marcus (Finance)' };
    }
    if (type === 'marketing_plan' || cost > 0) {
      return { risk: 'MEDIUM' as const, reversibility: 'REVERSIBLE' as const, rec: 'Dax (Growth)' };
    }
    return { risk: 'LOW' as const, reversibility: 'REVERSIBLE' as const, rec: 'Atlas (CEO)' };
  };

  // Deterministic Before vs After Calculations for currently reviewed item
  const stateProjection = useMemo(() => {
    if (!selectedItem) {
      return {
        initialRunway: (currentCash / currentBurn).toFixed(1),
        projectedCash: currentCash,
        projectedBurn: currentBurn,
        projectedRunway: (currentCash / currentBurn).toFixed(1)
      };
    }

    const finChange = isModifying && customCost
      ? -Math.abs(parseFloat(customCost) || 0)
      : (selectedItem.financialChange || 0);

    let projectedCash = currentCash;
    let projectedBurn = currentBurn;

    if (finChange > 0) {
      projectedCash += finChange;
    } else if (finChange < 0) {
      const absCost = Math.abs(finChange);
      const monthlyAdd = absCost > 20000 ? Math.round(absCost / 12) : absCost;
      projectedBurn += monthlyAdd;
    }

    const initialRunway = currentBurn > 0 ? (currentCash / currentBurn).toFixed(1) : '99+';
    const projectedRunway = projectedBurn > 0 ? (projectedCash / projectedBurn).toFixed(1) : '99+';

    return {
      initialRunway,
      projectedCash,
      projectedBurn,
      projectedRunway
    };
  }, [selectedItem, currentCash, currentBurn, isModifying, customCost]);

  const handleAction = async (action: 'approve' | 'modify' | 'reject') => {
    if (!selectedItem) return;
    setIsSubmitting(true);
    try {
      let modifications: any = undefined;
      if (action === 'modify') {
        modifications = {
          financialChange: customCost ? -Math.abs(parseFloat(customCost) || 0) : selectedItem.financialChange,
          headcount: parseInt(customHeadcount, 10) || 1,
          conditions: customConditions.trim() || 'Custom founder constraints applied'
        };
      }

      await onReviewItem(selectedItem.id, action, feedback, modifications);
      setFeedback('');
      setIsModifying(false);
      setCustomCost('');
      setCustomConditions('');
      setSelectedItemId(null);
    } catch (err) {
      console.error('[ApprovalQueue] Review error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedGovernance = selectedItem ? getItemGovernance(selectedItem) : null;
  const totalImpact = approvals.reduce((acc, a) => acc + Math.abs(a.financialChange || 0), 0);

  return (
    <div id="approval-queue-container" className="space-y-6 font-sans">
      
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <Section delay={0.05} className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4" style={{ borderBottom: '1px solid var(--c-border)' }}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider font-semibold" style={{ color: 'var(--c-accent)' }}>
              Executive Governance
            </span>
            <span className="w-1 h-1 rounded-full" style={{ backgroundColor: 'var(--c-border-strong)' }} />
            <span className="text-[11px] font-mono" style={{ color: 'var(--c-muted)' }}>
              {approvals.length} Gate{approvals.length === 1 ? '' : 's'} Pending Sign-Off
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: 'var(--c-fg)' }}>
            Decision Inbox
          </h1>
          <p className="text-sm mt-1 max-w-2xl" style={{ color: 'var(--c-muted)' }}>
            Human-in-the-loop review queue for contracts, budget expansions, and high-impact council deliverables.
          </p>
        </div>

        {/* Quick Summary Pill */}
        <div className="flex items-center gap-3">
          <div 
            className="px-4 py-2 rounded-xl text-xs font-mono flex items-center gap-3 shadow-sm transition-all"
            style={{ 
              backgroundColor: 'var(--c-surface)', 
              border: '1px solid var(--c-border)', 
              boxShadow: 'var(--shadow-sm)' 
            }}
          >
            <div>
              <span className="block text-[10px] uppercase font-semibold" style={{ color: 'var(--c-muted)' }}>Total Exposure</span>
              <span className="font-bold text-sm" style={{ color: 'var(--c-fg)' }}>
                ${totalImpact.toLocaleString()}
              </span>
            </div>
            <div className="w-px h-6" style={{ backgroundColor: 'var(--c-border)' }} />
            <div>
              <span className="block text-[10px] uppercase font-semibold" style={{ color: 'var(--c-muted)' }}>Pending</span>
              <span className="font-bold text-amber-500">{approvals.length} items</span>
            </div>
          </div>
        </div>
      </Section>

      {/* ── SEARCH & FILTER BAR ────────────────────────────────────────────── */}
      <Section delay={0.1} className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--c-muted)' }} />
          <input
            type="text"
            placeholder="Search pending decisions by title or context..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl text-xs transition-all focus:outline-none"
            style={{
              backgroundColor: 'var(--c-surface)',
              border: '1px solid var(--c-border)',
              color: 'var(--c-fg)',
              boxShadow: 'var(--shadow-sm)'
            }}
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-medium shrink-0 mr-1" style={{ color: 'var(--c-muted)' }}>Type:</span>
          {['ALL', 'CONTRACT', 'FINANCIALS', 'MARKETING_PLAN'].map((type) => {
            const isSelected = filterType === type;
            return (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer"
                style={{
                  backgroundColor: isSelected ? 'var(--c-fg)' : 'var(--c-surface)',
                  color: isSelected ? 'var(--c-bg)' : 'var(--c-muted)',
                  border: `1px solid ${isSelected ? 'var(--c-fg)' : 'var(--c-border)'}`
                }}
              >
                {type === 'ALL' ? 'All Types' : type.replace('_', ' ')}
              </button>
            );
          })}
        </div>
      </Section>

      {/* ── DECISION INBOX TABLE / ROWS ───────────────────────────────────── */}
      <Section delay={0.15}>
      {filteredApprovals.length > 0 ? (
        <div 
          className="rounded-2xl overflow-hidden divide-y transition-all"
          style={{ 
            backgroundColor: 'var(--c-surface)', 
            border: '1px solid var(--c-border)',
            borderColor: 'var(--c-border)',
            divideColor: 'var(--c-border)'
          }}
        >
          {/* Table Header */}
          <div 
            className="hidden md:grid grid-cols-12 gap-4 px-6 py-3.5 text-[10px] font-mono font-bold uppercase tracking-wider"
            style={{ 
              backgroundColor: 'var(--c-surface-2)', 
              color: 'var(--c-muted)',
              borderBottom: '1px solid var(--c-border)'
            }}
          >
            <div className="col-span-4">Decision & Context</div>
            <div className="col-span-2">Recommended By</div>
            <div className="col-span-2">Treasury Impact</div>
            <div className="col-span-2">Risk / Reversibility</div>
            <div className="col-span-2 text-right">Action</div>
          </div>

          {/* Table Rows */}
          {filteredApprovals.map((item) => {
            const gov = getItemGovernance(item);
            const cost = item.financialChange || 0;

            return (
              <div
                key={item.id}
                className="grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-4 items-center transition-colors group cursor-pointer"
                style={{
                  backgroundColor: 'var(--c-surface)',
                  borderBottom: '1px solid var(--c-border)'
                }}
                onClick={() => {
                  setSelectedItemId(item.id);
                  setIsModifying(false);
                  setFeedback('');
                }}
              >
                {/* Decision & Context (4 cols) */}
                <div className="md:col-span-4 space-y-1">
                  <div className="flex items-center gap-2">
                    <span 
                      className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider font-semibold"
                      style={{ 
                        backgroundColor: 'var(--c-surface-2)', 
                        color: 'var(--c-fg)',
                        border: '1px solid var(--c-border)'
                      }}
                    >
                      {item.type.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] font-mono" style={{ color: 'var(--c-muted)' }}>Score: {item.impact}/10</span>
                  </div>
                  <h4 className="text-xs font-bold leading-snug group-hover:text-indigo-400 transition-colors" style={{ color: 'var(--c-fg)' }}>
                    {item.title}
                  </h4>
                  <p className="text-[11px] line-clamp-1 leading-normal" style={{ color: 'var(--c-muted)' }}>
                    {item.description}
                  </p>
                </div>

                {/* Recommended By (2 cols) */}
                <div className="md:col-span-2 flex items-center gap-2 text-xs">
                  <div 
                    className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] font-mono shrink-0"
                    style={{ backgroundColor: 'var(--c-surface-2)', color: 'var(--c-fg)', border: '1px solid var(--c-border)' }}
                  >
                    {gov.rec[0]}
                  </div>
                  <span className="font-semibold text-xs truncate" style={{ color: 'var(--c-fg)' }}>{gov.rec}</span>
                </div>

                {/* Impact (2 cols) */}
                <div className="md:col-span-2 text-xs font-mono">
                  {cost !== 0 ? (
                    <span className={`font-bold ${cost > 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
                      {cost > 0 ? `+${formatINR(cost)}` : `-${formatINR(Math.abs(cost))}`}
                    </span>
                  ) : (
                    <span className="text-slate-400">Neutral (₹0)</span>
                  )}
                  <span className="text-[10px] block font-sans text-slate-500">Treasury impact</span>
                </div>

                {/* Risk / Reversibility (2 cols) */}
                <div className="md:col-span-2 space-y-1">
                  <span className={`inline-flex px-2 py-0.5 text-[9px] font-mono font-bold rounded-full ${
                    gov.risk === 'CRITICAL' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                    gov.risk === 'HIGH' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                    'bg-sky-50 text-sky-700 border border-sky-200'
                  }`}>
                    {gov.risk} Risk
                  </span>
                  <span className="text-[10px] block font-mono" style={{ color: 'var(--c-muted)' }}>
                    {gov.reversibility}
                  </span>
                </div>

                {/* Primary Action: Review (2 cols) */}
                <div className="md:col-span-2 flex items-center justify-end">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedItemId(item.id);
                      setIsModifying(false);
                      setFeedback('');
                    }}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                    style={{
                      backgroundColor: 'var(--c-fg)',
                      color: 'var(--c-bg)'
                    }}
                  >
                    <span>Review</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div 
          className="p-16 rounded-2xl text-center space-y-3 transition-all"
          style={{ 
            backgroundColor: 'var(--c-surface)', 
            border: '1px dashed var(--c-border-strong)' 
          }}
        >
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold" style={{ color: 'var(--c-fg)' }}>Decision Inbox Clear</h3>
          <p className="text-xs max-w-sm mx-auto leading-relaxed" style={{ color: 'var(--c-muted)' }}>
            All AI executive operations are currently executing within founder-authorized parameters. No pending gates blocked.
          </p>
        </div>
      )}
      </Section>

      {/* ── FOCUSED EVALUATION DRAWER / MODAL ──────────────────────────────── */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/20 backdrop-blur-xs">
          <div 
            className="w-full max-w-2xl h-full shadow-2xl flex flex-col justify-between overflow-y-auto animate-fade-in"
            style={{ 
              backgroundColor: 'var(--c-surface)', 
              borderLeft: '1px solid var(--c-border)' 
            }}
          >
            
            {/* Drawer Header */}
            <div 
              className="p-6 space-y-3 sticky top-0 backdrop-blur-md z-10"
              style={{ 
                backgroundColor: 'var(--c-surface)', 
                borderBottom: '1px solid var(--c-border)' 
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span 
                    className="px-2.5 py-0.5 text-[10px] font-mono font-bold rounded-full uppercase"
                    style={{ 
                      backgroundColor: 'var(--c-surface-2)', 
                      color: 'var(--c-fg)', 
                      border: '1px solid var(--c-border)' 
                    }}
                  >
                    {selectedItem.type.replace('_', ' ')}
                  </span>
                  {selectedGovernance && (
                    <span className={`px-2.5 py-0.5 text-[10px] font-mono font-bold rounded-full ${
                      selectedGovernance.risk === 'CRITICAL' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                      selectedGovernance.risk === 'HIGH' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                      'bg-sky-50 text-sky-700 border border-sky-200'
                    }`}>
                      {selectedGovernance.risk} Risk
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setSelectedItemId(null)}
                  className="p-1.5 rounded-full transition-colors cursor-pointer"
                  style={{ color: 'var(--c-muted)', backgroundColor: 'var(--c-surface-2)' }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <h3 className="text-lg font-bold leading-snug" style={{ color: 'var(--c-fg)' }}>
                  {selectedItem.title}
                </h3>
                <p className="text-xs mt-1" style={{ color: 'var(--c-muted)' }}>
                  {selectedItem.description}
                </p>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="p-6 space-y-6 flex-1">
              
              {/* Phase D2 — Founder Approval Experience Card */}
              <div 
                className="p-5 rounded-2xl border space-y-4 shadow-sm"
                style={{ 
                  backgroundColor: 'var(--c-surface-2)', 
                  border: '1px solid var(--c-border)' 
                }}
              >
                <div className="flex items-center justify-between pb-2" style={{ borderBottom: '1px solid var(--c-border)' }}>
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-500 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    APPROVAL REQUIRED
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    Phase D Executive Gate
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider block font-bold" style={{ color: 'var(--c-muted)' }}>
                    Task:
                  </span>
                  <h4 className="text-sm font-bold mt-0.5" style={{ color: 'var(--c-fg)' }}>
                    {selectedItem.title}
                  </h4>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl border" style={{ backgroundColor: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
                    <span className="text-[9px] font-mono uppercase tracking-wider block font-bold" style={{ color: 'var(--c-muted)' }}>
                      Prepared by:
                    </span>
                    <span className="text-xs font-semibold mt-0.5 block truncate" style={{ color: 'var(--c-fg)' }}>
                      {selectedItem.preparedBy || 'HR Employee'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl border" style={{ backgroundColor: 'var(--c-surface)', borderColor: 'var(--c-border)' }}>
                    <span className="text-[9px] font-mono uppercase tracking-wider block font-bold" style={{ color: 'var(--c-muted)' }}>
                      AI assistance:
                    </span>
                    <span className="text-xs font-semibold mt-0.5 block truncate text-indigo-400">
                      {selectedItem.aiAssistance || selectedGovernance?.rec || 'Echo'}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider block font-bold" style={{ color: 'var(--c-muted)' }}>
                    Summary:
                  </span>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--c-fg)' }}>
                    {selectedItem.summary || selectedItem.description}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider block font-bold" style={{ color: 'var(--c-muted)' }}>
                    Impact:
                  </span>
                  <p className="text-xs mt-1 leading-relaxed text-emerald-500 font-medium">
                    {selectedItem.impact || 'Verified operational deliverable with treasury runway safety.'}
                  </p>
                </div>

                <div className="p-3 rounded-xl border bg-indigo-500/5 border-indigo-500/20">
                  <span className="text-[9px] font-mono uppercase tracking-wider block font-bold text-indigo-400">
                    Recommendation:
                  </span>
                  <p className="text-xs mt-1 leading-relaxed text-indigo-200">
                    {selectedItem.recommendation || `Approve deliverable and authorize operational execution.`}
                  </p>
                </div>

                {selectedItem.founderFeedback && (
                  <div className="p-3 rounded-xl border bg-amber-500/10 border-amber-500/25">
                    <span className="text-[9px] font-mono uppercase tracking-wider block font-bold text-amber-500">
                      Previous Revision Directive:
                    </span>
                    <p className="text-xs mt-0.5 text-amber-300">
                      "{selectedItem.founderFeedback}"
                    </p>
                  </div>
                )}
              </div>

              {/* Deterministic Impact Projections */}
              <div 
                className="p-4 rounded-xl space-y-3"
                style={{ 
                  backgroundColor: 'var(--c-surface-2)', 
                  border: '1px solid var(--c-border)' 
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--c-muted)' }}>
                    <Shield className="w-3.5 h-3.5" style={{ color: 'var(--c-accent)' }} />
                    Forecasted Runway & Treasury Shift
                  </span>
                  <span className="text-[10px] font-mono" style={{ color: 'var(--c-muted)' }}>Postgres Treasury Sync</span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div 
                    className="p-3 rounded-lg space-y-1"
                    style={{ backgroundColor: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
                  >
                    <span className="text-[9px] block font-mono uppercase font-bold" style={{ color: 'var(--c-muted)' }}>Cash Balance</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono" style={{ color: 'var(--c-muted)' }}>{formatCompactINR(currentCash)}</span>
                      <ArrowRight className="w-3 h-3 opacity-50" style={{ color: 'var(--c-muted)' }} />
                      <span className="text-xs font-mono font-bold" style={{ color: 'var(--c-fg)' }}>{formatCompactINR(stateProjection.projectedCash)}</span>
                    </div>
                  </div>

                  <div 
                    className="p-3 rounded-lg space-y-1"
                    style={{ backgroundColor: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
                  >
                    <span className="text-[9px] block font-mono uppercase font-bold" style={{ color: 'var(--c-muted)' }}>Monthly Burn</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono" style={{ color: 'var(--c-muted)' }}>{formatCompactINR(currentBurn)}</span>
                      <ArrowRight className="w-3 h-3 opacity-50" style={{ color: 'var(--c-muted)' }} />
                      <span className="text-xs font-mono font-bold" style={{ color: 'var(--c-fg)' }}>{formatCompactINR(stateProjection.projectedBurn)}</span>
                    </div>
                  </div>

                  <div 
                    className="p-3 rounded-lg space-y-1"
                    style={{ backgroundColor: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
                  >
                    <span className="text-[9px] block font-mono uppercase font-bold" style={{ color: 'var(--c-muted)' }}>Runway</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono" style={{ color: 'var(--c-muted)' }}>{stateProjection.initialRunway}m</span>
                      <ArrowRight className="w-3 h-3 opacity-50" style={{ color: 'var(--c-muted)' }} />
                      <span className="text-xs font-mono font-bold text-emerald-500">{stateProjection.projectedRunway}m</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Charter / Terms Content */}
              <div className="space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-wider font-bold block" style={{ color: 'var(--c-muted)' }}>
                  Deliverable Legal Charter & Terms
                </span>
                <div 
                  className="p-4 rounded-xl max-h-56 overflow-y-auto text-xs font-mono leading-relaxed whitespace-pre-wrap"
                  style={{ 
                    backgroundColor: 'var(--c-surface-2)', 
                    border: '1px solid var(--c-border)', 
                    color: 'var(--c-fg)' 
                  }}
                >
                  {selectedItem.content}
                </div>
              </div>

              {/* Inline Modifications Section */}
              {isModifying && (
                <div 
                  className="p-4 rounded-xl space-y-3"
                  style={{ 
                    backgroundColor: 'rgba(245, 158, 11, 0.08)', 
                    border: '1px solid rgba(245, 158, 11, 0.25)' 
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-500 flex items-center gap-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      Parameter Modifications
                    </span>
                    <button
                      onClick={() => setIsModifying(false)}
                      className="text-xs text-amber-500 hover:underline cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-amber-500 uppercase block mb-1">Adjusted Budget (₹ INR)</label>
                      <input
                        type="number"
                        placeholder="e.g. 185000"
                        value={customCost}
                        onChange={(e) => setCustomCost(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg text-xs font-mono outline-none"
                        style={{ backgroundColor: 'var(--c-surface)', border: '1px solid rgba(245, 158, 11, 0.3)', color: 'var(--c-fg)' }}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-amber-500 uppercase block mb-1">Headcount Adjust</label>
                      <input
                        type="number"
                        value={customHeadcount}
                        onChange={(e) => setCustomHeadcount(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg text-xs font-mono outline-none"
                        style={{ backgroundColor: 'var(--c-surface)', border: '1px solid rgba(245, 158, 11, 0.3)', color: 'var(--c-fg)' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-amber-500 uppercase block mb-1">Founder Directives</label>
                    <input
                      type="text"
                      placeholder="e.g. Include 1-year cliff, review at quarterly board meeting"
                      value={customConditions}
                      onChange={(e) => setCustomConditions(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg text-xs outline-none"
                      style={{ backgroundColor: 'var(--c-surface)', border: '1px solid rgba(245, 158, 11, 0.3)', color: 'var(--c-fg)' }}
                    />
                  </div>
                </div>
              )}

              {/* Feedback Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider block" style={{ color: 'var(--c-muted)' }}>
                  Directives for Executive Council
                </label>
                <input
                  type="text"
                  placeholder="Optional directives attached to audit ledger..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none transition-colors"
                  style={{
                    backgroundColor: 'var(--c-surface-2)',
                    border: '1px solid var(--c-border)',
                    color: 'var(--c-fg)'
                  }}
                />
              </div>

            </div>

            {/* Drawer Footer Actions */}
            <div 
              className="p-5 space-y-3 sticky bottom-0"
              style={{ 
                backgroundColor: 'var(--c-surface)', 
                borderTop: '1px solid var(--c-border)' 
              }}
            >
              {/* Phase D3: Inline Request Changes Directives Box */}
              {isRequestingChanges && (
                <div 
                  className="p-4 rounded-xl border space-y-2.5 animate-fade-in"
                  style={{
                    backgroundColor: 'rgba(245, 158, 11, 0.08)',
                    borderColor: 'rgba(245, 158, 11, 0.3)'
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                      <RotateCcw className="w-3.5 h-3.5" />
                      Founder Directives for Employee (Phase D3)
                    </span>
                    <span className="text-[10px] font-mono text-amber-500/70">Returns to Employee + AI Loop</span>
                  </div>
                  <input
                    type="text"
                    placeholder='e.g. "Reduce hiring budget and resubmit."'
                    value={changesDirective}
                    onChange={(e) => setChangesDirective(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none transition-all"
                    style={{
                      backgroundColor: 'var(--c-surface)',
                      border: '1px solid rgba(245, 158, 11, 0.4)',
                      color: 'var(--c-fg)'
                    }}
                    autoFocus
                  />
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsRequestingChanges(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                      style={{ color: 'var(--c-muted)' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!changesDirective.trim()) return;
                        setIsSubmitting(true);
                        try {
                          await onReviewItem(selectedItem.id, 'request_changes', changesDirective.trim());
                          setIsRequestingChanges(false);
                          setChangesDirective('');
                          setSelectedItemId(null);
                        } finally {
                          setIsSubmitting(false);
                        }
                      }}
                      disabled={!changesDirective.trim() || isSubmitting}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 transition-all text-black font-bold"
                      style={{ backgroundColor: '#f59e0b' }}
                    >
                      Send Revision Request
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setIsModifying(!isModifying)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  style={{
                    backgroundColor: 'var(--c-surface-2)',
                    border: '1px solid var(--c-border)',
                    color: 'var(--c-fg)'
                  }}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" style={{ color: 'var(--c-muted)' }} />
                  <span>{isModifying ? 'Hide Adjustments' : 'Modify Parameters'}</span>
                </button>

                <div className="flex items-center gap-2">
                  {/* [ Reject ] */}
                  <button
                    onClick={() => handleAction('reject')}
                    disabled={isSubmitting}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                    style={{
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      color: 'rgb(239, 68, 68)'
                    }}
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>

                  {/* [ Request Changes ] */}
                  <button
                    onClick={() => setIsRequestingChanges(!isRequestingChanges)}
                    disabled={isSubmitting}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                    style={{
                      backgroundColor: isRequestingChanges ? 'rgba(245, 158, 11, 0.25)' : 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid rgba(245, 158, 11, 0.35)',
                      color: 'rgb(245, 158, 11)'
                    }}
                  >
                    <RotateCcw className="w-4 h-4" /> Request Changes
                  </button>

                  {/* [ Approve ] */}
                  {isModifying ? (
                    <button
                      onClick={() => handleAction('modify')}
                      disabled={isSubmitting}
                      className="px-5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer text-white transition-all"
                      style={{ backgroundColor: '#d97706' }}
                    >
                      <Check className="w-4 h-4" /> Authorize with Modifications
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAction('approve')}
                      disabled={isSubmitting}
                      className="px-5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer transition-all"
                      style={{
                        backgroundColor: 'var(--c-fg)',
                        color: 'var(--c-bg)'
                      }}
                    >
                      <CheckCircle2 className="w-4 h-4" /> Approve
                    </button>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
