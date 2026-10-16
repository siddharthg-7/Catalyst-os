/**
 * CatalystOS - Founder Decision Inbox & Approvals (Section 14)
 * Engineered with Apple × Linear × Notion aesthetics.
 * Scannable Decision Inbox table with translucent risk badges, clean 8pt spacing,
 * and a focused slide-over evaluation drawer with Before vs After state projections,
 * parameter modification sliders, and high-assurance audit trails.
 */

import React, { useState, useMemo, useEffect } from 'react';
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

  // Escape key dismissal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedItemId) {
        setSelectedItemId(null);
        setIsModifying(false);
        setIsRequestingChanges(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItemId]);

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
      <Section delay={0.05} className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#141413]/10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-[#141413]">
              Executive Governance
            </span>
            <span className="w-1 h-1 rounded-full bg-[#141413]/30" />
            <span className="text-[11px] font-mono text-[#666562]">
              {approvals.length} Gate{approvals.length === 1 ? '' : 's'} Pending Sign-Off
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#141413]">
            Decision Inbox
          </h1>
          <p className="text-xs sm:text-sm mt-1 max-w-2xl text-[#666562]">
            Human-in-the-loop review queue for contracts, budget expansions, and high-impact council deliverables.
          </p>
        </div>

        {/* Quick Summary Pill */}
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl text-xs font-mono flex items-center gap-3 bg-white border border-[#141413]/10 shadow-[rgba(20,20,19,0.02)_0px_1px_3px_0px]">
            <div>
              <span className="block text-[10px] uppercase font-semibold text-[#666562]">Total Exposure</span>
              <span className="font-bold text-sm font-mono text-[#141413]">
                {formatINR(totalImpact)}
              </span>
            </div>
            <div className="w-px h-6 bg-[#141413]/10" />
            <div>
              <span className="block text-[10px] uppercase font-semibold text-[#666562]">Pending</span>
              <span className="font-bold text-amber-800">{approvals.length} items</span>
            </div>
          </div>
        </div>
      </Section>

      {/* ── SEARCH & FILTER BAR ────────────────────────────────────────────── */}
      <Section delay={0.1} className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#666562]" />
          <input
            type="text"
            placeholder="Search pending decisions by title or context..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl text-xs bg-white border border-[#141413]/10 text-[#141413] shadow-[rgba(20,20,19,0.02)_0px_1px_3px_0px] focus:outline-none focus:border-[#141413] focus:ring-1 focus:ring-[#141413]/10 transition-all placeholder:text-[#666562]/60"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-medium shrink-0 mr-1 text-[#666562]">Type:</span>
          {['ALL', 'CONTRACT', 'FINANCIALS', 'MARKETING_PLAN'].map((type) => {
            const isSelected = filterType === type;
            return (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#141413] text-[#FDFCFA] shadow-xs'
                    : 'bg-white text-[#666562] border border-[#141413]/10 hover:border-[#141413]/25'
                }`}
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
        <div className="rounded-xl overflow-hidden divide-y divide-[#141413]/06 bg-white border border-[#141413]/10 shadow-[rgba(20,20,19,0.02)_0px_1px_4px_0px]">
          {/* Table Header */}
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 text-[12px] font-medium bg-[#FDFCFA] text-[#666562] border-b border-[#141413]/08">
            <div className="col-span-4">Decision &amp; Context</div>
            <div className="col-span-2">Recommended By</div>
            <div className="col-span-2">Treasury Impact</div>
            <div className="col-span-2">Risk / Reversibility</div>
            <div className="col-span-2 text-right">Action</div>
          </div>

          {/* Table Rows */}
          {filteredApprovals.map((item) => {
            const gov = getItemGovernance(item);
            const cost = item.financialChange || 0;
            const isSelected = selectedItemId === item.id;

            return (
              <div
                key={item.id}
                className={`grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-3.5 items-center transition-colors group cursor-pointer ${
                  isSelected ? 'bg-[#FDFCFA] ring-1 ring-[#141413]/20' : 'hover:bg-[#FDFCFA]'
                }`}
                onClick={() => {
                  setSelectedItemId(item.id);
                  setIsModifying(false);
                  setFeedback('');
                }}
              >
                {/* Decision & Context (4 cols) */}
                <div className="md:col-span-4 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#141413]/5 text-[#141413]/80 border border-[#141413]/08">
                      {item.type.replace('_', ' ')}
                    </span>
                    <span className="text-[11px] font-mono text-[#666562]">Score: {item.impact}/10</span>
                  </div>
                  <h4 className="text-xs font-semibold leading-snug text-[#141413] group-hover:underline transition-colors">
                    {item.title}
                  </h4>
                  <p className="text-[11px] line-clamp-1 leading-normal text-[#666562]">
                    {item.description}
                  </p>
                </div>

                {/* Recommended By (2 cols) */}
                <div className="md:col-span-2 flex items-center gap-2 text-xs">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center font-bold text-[10px] font-mono shrink-0 bg-[#141413] text-[#FDFCFA]">
                    {gov.rec[0]}
                  </div>
                  <span className="font-semibold text-xs truncate text-[#141413]">{gov.rec}</span>
                </div>

                {/* Impact (2 cols) */}
                <div className="md:col-span-2 text-xs font-mono">
                  {cost !== 0 ? (
                    <span className={`font-semibold ${cost > 0 ? 'text-emerald-700' : 'text-[#141413]'}`}>
                      {cost > 0 ? `+${formatINR(cost)}` : `-${formatINR(Math.abs(cost))}`}
                    </span>
                  ) : (
                    <span className="text-[#666562]">Neutral (₹0)</span>
                  )}
                  <span className="text-[10px] block font-sans text-[#666562]">Treasury impact</span>
                </div>

                {/* Risk / Reversibility (2 cols) */}
                <div className="md:col-span-2 space-y-1">
                  <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-md border ${
                    gov.risk === 'CRITICAL' ? 'bg-rose-50 text-rose-700 border-rose-200/60' :
                    gov.risk === 'HIGH' ? 'bg-amber-50 text-amber-700 border-amber-200/60' :
                    'bg-[#141413]/5 text-[#141413]/80 border-[#141413]/08'
                  }`}>
                    {gov.risk} Risk
                  </span>
                  <span className="text-[11px] block font-mono text-[#666562]">
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
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer bg-[#141413] hover:bg-[#262627] text-[#FDFCFA] shadow-xs"
                  >
                    <span>Inspect</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="p-16 rounded-xl text-center space-y-3 bg-white border border-dashed border-[#141413]/15">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-[#141413]">Decision Inbox Clear</h3>
          <p className="text-xs max-w-sm mx-auto leading-relaxed text-[#666562]">
            All AI executive operations are currently executing within founder-authorized parameters. No pending gates blocked.
          </p>
        </div>
      )}
      </Section>

      {/* ── FOCUSED EVALUATION DRAWER / SLIDE-OVER ──────────────────────────── */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-[#141413]/40 backdrop-blur-xs">
          <div className="w-full max-w-2xl h-full bg-white border-l border-[#141413]/10 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
            
            {/* Drawer Header */}
            <div className="p-6 space-y-3 sticky top-0 bg-white/95 backdrop-blur-xs z-10 border-b border-[#141413]/08">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold rounded-full uppercase bg-[#F3F0EE] text-[#141413] border border-[#141413]/10">
                    {selectedItem.type.replace('_', ' ')}
                  </span>
                  {selectedGovernance && (
                    <span className={`px-2.5 py-0.5 text-[10px] font-mono font-bold rounded-full border ${
                      selectedGovernance.risk === 'CRITICAL' ? 'bg-rose-50 text-rose-800 border-rose-200/80' :
                      selectedGovernance.risk === 'HIGH' ? 'bg-amber-50 text-amber-800 border-amber-200/80' :
                      'bg-[#F3F0EE] text-[#141413] border-[#141413]/10'
                    }`}>
                      {selectedGovernance.risk} Risk
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setSelectedItemId(null)}
                  className="p-1.5 rounded-lg text-[#666562] hover:text-[#141413] hover:bg-[#F3F0EE] transition-colors cursor-pointer"
                  title="Close (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <h3 className="text-lg font-bold leading-snug text-[#141413]">
                  {selectedItem.title}
                </h3>
                <p className="text-xs mt-1 text-[#666562]">
                  {selectedItem.description}
                </p>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="p-6 space-y-6 flex-1">
              
              {/* Executive Evaluation Card */}
              <div className="p-5 rounded-xl border border-[#141413]/10 bg-[#FDFCFA] space-y-4 shadow-[rgba(20,20,19,0.01)_0px_1px_3px_0px]">
                <div className="flex items-center justify-between pb-2 border-b border-[#141413]/08">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-800 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
                    APPROVAL REQUIRED
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#141413] text-[#FDFCFA]">
                    Gating Station
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider block font-bold text-[#666562]">
                    Task:
                  </span>
                  <h4 className="text-sm font-bold mt-0.5 text-[#141413]">
                    {selectedItem.title}
                  </h4>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg border border-[#141413]/08 bg-white">
                    <span className="text-[9px] font-mono uppercase tracking-wider block font-bold text-[#666562]">
                      Prepared by:
                    </span>
                    <span className="text-xs font-semibold mt-0.5 block truncate text-[#141413]">
                      {selectedItem.preparedBy || 'Employee Assigned'}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg border border-[#141413]/08 bg-white">
                    <span className="text-[9px] font-mono uppercase tracking-wider block font-bold text-[#666562]">
                      AI assistance:
                    </span>
                    <span className="text-xs font-semibold mt-0.5 block truncate text-[#141413]">
                      {selectedItem.aiAssistance || selectedGovernance?.rec || 'Sophia Vance'}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider block font-bold text-[#666562]">
                    Summary:
                  </span>
                  <p className="text-xs mt-1 leading-relaxed text-[#141413]">
                    {selectedItem.summary || selectedItem.description}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider block font-bold text-[#666562]">
                    Impact:
                  </span>
                  <p className="text-xs mt-1 leading-relaxed text-emerald-800 font-medium">
                    {selectedItem.impact || 'Verified operational deliverable with treasury runway safety.'}
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-[#141413]/10 bg-white">
                  <span className="text-[9px] font-mono uppercase tracking-wider block font-bold text-[#141413]">
                    Recommendation:
                  </span>
                  <p className="text-xs mt-1 leading-relaxed text-[#666562]">
                    {selectedItem.recommendation || `Approve deliverable and authorize operational execution.`}
                  </p>
                </div>

                {selectedItem.founderFeedback && (
                  <div className="p-3 rounded-lg border border-amber-200/80 bg-amber-50">
                    <span className="text-[9px] font-mono uppercase tracking-wider block font-bold text-amber-900">
                      Previous Revision Directive:
                    </span>
                    <p className="text-xs mt-0.5 text-amber-950 font-medium">
                      "{selectedItem.founderFeedback}"
                    </p>
                  </div>
                )}
              </div>

              {/* Deterministic Impact Projections */}
              <div className="p-4 rounded-xl space-y-3 bg-[#FDFCFA] border border-[#141413]/10">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 text-[#666562]">
                    <Shield className="w-3.5 h-3.5 text-[#141413]" />
                    Forecasted Runway &amp; Treasury Shift
                  </span>
                  <span className="text-[10px] font-mono text-[#666562]">Postgres Treasury Sync</span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg space-y-1 bg-white border border-[#141413]/08">
                    <span className="text-[9px] block font-mono uppercase font-bold text-[#666562]">Cash Balance</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono text-[#666562]">{formatCompactINR(currentCash)}</span>
                      <ArrowRight className="w-3 h-3 text-[#666562]" />
                      <span className="text-xs font-mono font-bold text-[#141413]">{formatCompactINR(stateProjection.projectedCash)}</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg space-y-1 bg-white border border-[#141413]/08">
                    <span className="text-[9px] block font-mono uppercase font-bold text-[#666562]">Monthly Burn</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono text-[#666562]">{formatCompactINR(currentBurn)}</span>
                      <ArrowRight className="w-3 h-3 text-[#666562]" />
                      <span className="text-xs font-mono font-bold text-[#141413]">{formatCompactINR(stateProjection.projectedBurn)}</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg space-y-1 bg-white border border-[#141413]/08">
                    <span className="text-[9px] block font-mono uppercase font-bold text-[#666562]">Runway</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono text-[#666562]">{stateProjection.initialRunway}m</span>
                      <ArrowRight className="w-3 h-3 text-[#666562]" />
                      <span className="text-xs font-mono font-bold text-emerald-700">{stateProjection.projectedRunway}m</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Charter / Terms Content */}
              {selectedItem.content && (
                <div className="space-y-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider font-bold block text-[#666562]">
                    Deliverable Legal Charter &amp; Terms
                  </span>
                  <div className="p-4 rounded-xl max-h-56 overflow-y-auto text-xs font-mono leading-relaxed whitespace-pre-wrap bg-[#FDFCFA] border border-[#141413]/10 text-[#141413]">
                    {selectedItem.content}
                  </div>
                </div>
              )}

              {/* Inline Modifications Section */}
              {isModifying && (
                <div className="p-4 rounded-xl space-y-3 bg-amber-50/50 border border-amber-200/80">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      Parameter Modifications
                    </span>
                    <button
                      onClick={() => setIsModifying(false)}
                      className="text-xs text-amber-900 hover:underline cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-amber-900 uppercase block mb-1">Adjusted Budget (₹ INR)</label>
                      <input
                        type="number"
                        placeholder="e.g. 185000"
                        value={customCost}
                        onChange={(e) => setCustomCost(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg text-xs font-mono outline-none bg-white border border-amber-300 text-[#141413] focus:border-[#141413]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-amber-900 uppercase block mb-1">Headcount Adjust</label>
                      <input
                        type="number"
                        value={customHeadcount}
                        onChange={(e) => setCustomHeadcount(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg text-xs font-mono outline-none bg-white border border-amber-300 text-[#141413] focus:border-[#141413]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-amber-900 uppercase block mb-1">Founder Directives</label>
                    <input
                      type="text"
                      placeholder="e.g. Include 1-year cliff, review at quarterly board meeting"
                      value={customConditions}
                      onChange={(e) => setCustomConditions(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg text-xs outline-none bg-white border border-amber-300 text-[#141413] focus:border-[#141413]"
                    />
                  </div>
                </div>
              )}

              {/* Feedback Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider block text-[#666562]">
                  Directives for Executive Council
                </label>
                <input
                  type="text"
                  placeholder="Optional directives attached to audit ledger..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none transition-colors bg-[#FDFCFA] border border-[#141413]/10 text-[#141413] focus:border-[#141413] focus:bg-white"
                />
              </div>

            </div>

            {/* Drawer Footer Actions */}
            <div className="p-5 space-y-3 sticky bottom-0 bg-white border-t border-[#141413]/08">
              {/* Inline Request Changes Directives Box */}
              {isRequestingChanges && (
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 space-y-2.5 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                      <RotateCcw className="w-3.5 h-3.5" />
                      Founder Directives for Employee
                    </span>
                    <span className="text-[10px] font-mono text-amber-800">Returns to Employee Loop</span>
                  </div>
                  <input
                    type="text"
                    placeholder='e.g. "Reduce hiring budget by 20% and resubmit."'
                    value={changesDirective}
                    onChange={(e) => setChangesDirective(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-lg text-xs outline-none bg-white border border-amber-300 text-[#141413] focus:border-[#141413]"
                    autoFocus
                  />
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsRequestingChanges(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer text-[#666562] hover:text-[#141413]"
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
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 transition-all bg-amber-500 hover:bg-amber-600 text-black font-bold shadow-xs"
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
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer bg-white border border-[#141413]/10 hover:border-[#141413]/25 text-[#141413]"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#666562]" />
                  <span>{isModifying ? 'Hide Adjustments' : 'Modify Parameters'}</span>
                </button>

                <div className="flex items-center gap-2">
                  {/* [ Reject ] */}
                  <button
                    onClick={() => handleAction('reject')}
                    disabled={isSubmitting}
                    className="px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>

                  {/* [ Request Changes ] */}
                  <button
                    onClick={() => setIsRequestingChanges(!isRequestingChanges)}
                    disabled={isSubmitting}
                    className="px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900"
                  >
                    <RotateCcw className="w-4 h-4" /> Request Changes
                  </button>

                  {/* [ Approve ] */}
                  {isModifying ? (
                    <button
                      onClick={() => handleAction('modify')}
                      disabled={isSubmitting}
                      className="px-5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer bg-amber-600 hover:bg-amber-700 text-white transition-all"
                    >
                      <Check className="w-4 h-4" /> Authorize with Modifications
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAction('approve')}
                      disabled={isSubmitting}
                      className="px-5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer transition-all bg-[#141413] hover:bg-[#262627] text-[#FDFCFA]"
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
