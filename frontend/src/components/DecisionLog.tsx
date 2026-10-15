/**
 * CatalystOS - Corporate Decision Ledger Component (Section 15)
 * Redesigned with Apple × Linear × Notion aesthetics.
 * Institutional memory & auditable corporate record.
 * Formatted with clean table columns (Decision, Context, Owner, Recommendation, Status, Date)
 * and an interactive slide-over detail drawer.
 */

import React, { useState, useMemo } from 'react';
import { DecisionRecord } from '../types';
import {
  FileText, Search, Download, ChevronRight, X,
  Clock, Check
} from 'lucide-react';
import Section from './Section';
import { formatINR } from '../utils/currency';

interface DecisionLogProps {
  decisions: DecisionRecord[];
  onRefresh?: () => Promise<void>;
}

export default function DecisionLog({ decisions, onRefresh }: DecisionLogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedRecord, setSelectedRecord] = useState<DecisionRecord | null>(null);

  // Filter & Search Pipeline
  const filteredDecisions = useMemo(() => {
    return decisions.filter(d => {
      // Category filter
      if (selectedCategory !== 'ALL' && d.category.toUpperCase() !== selectedCategory) {
        return false;
      }
      // Status filter
      if (selectedStatus !== 'ALL' && d.status.toUpperCase() !== selectedStatus) {
        return false;
      }
      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = d.title.toLowerCase().includes(q);
        const matchesDesc = d.description.toLowerCase().includes(q);
        const matchesCat = d.category.toLowerCase().includes(q);
        const matchesImpact = d.impactText?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesCat && !matchesImpact) {
          return false;
        }
      }
      return true;
    });
  }, [decisions, searchQuery, selectedCategory, selectedStatus]);

  // Aggregate Metrics
  const stats = useMemo(() => {
    const total = decisions.length;
    const approved = decisions.filter(d => d.status === 'approved').length;
    const rejected = decisions.filter(d => d.status === 'rejected').length;
    const netCapital = decisions.reduce((acc, d) => d.status === 'approved' ? acc + (d.financialImpact || 0) : acc, 0);

    return { total, approved, rejected, netCapital };
  }, [decisions]);

  // CSV Export
  const exportCSV = () => {
    if (decisions.length === 0) return;
    const headers = ['Timestamp', 'Title', 'Category', 'Status', 'Financial Impact (USD)', 'Description', 'Impact Summary'];
    const rows = filteredDecisions.map(d => [
      `"${new Date(d.timestamp).toISOString()}"`,
      `"${d.title.replace(/"/g, '""')}"`,
      `"${d.category}"`,
      `"${d.status}"`,
      d.financialImpact || 0,
      `"${d.description.replace(/"/g, '""')}"`,
      `"${(d.impactText || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `catalystos_decision_log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // JSON Export
  const exportJSON = () => {
    if (decisions.length === 0) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredDecisions, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', `catalystos_decision_ledger_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="decision-log-container" className="space-y-6 font-sans">
      
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <Section delay={0.05} className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4" style={{ borderBottom: '1px solid var(--c-border)' }}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider font-semibold" style={{ color: 'var(--c-accent)' }}>
              Institutional Memory
            </span>
            <span className="w-1 h-1 rounded-full" style={{ backgroundColor: 'var(--c-border-strong)' }} />
            <span className="text-[11px] font-mono" style={{ color: 'var(--c-muted)' }}>
              {decisions.length} Decisions Archived
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: 'var(--c-fg)' }}>
            Decision Ledger
          </h1>
          <p className="text-sm mt-1 max-w-2xl" style={{ color: 'var(--c-muted)' }}>
            Immutable, auditable corporate record of all executive deliberations, founder verdicts, financial shifts, and board authorizations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            style={{
              backgroundColor: 'var(--c-surface-2)',
              border: '1px solid var(--c-border)',
              color: 'var(--c-fg)'
            }}
          >
            <Download className="w-3.5 h-3.5" style={{ color: 'var(--c-muted)' }} />
            <span>Export CSV</span>
          </button>
          <button
            onClick={exportJSON}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            style={{
              backgroundColor: 'var(--c-fg)',
              color: 'var(--c-bg)'
            }}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Audit JSON</span>
          </button>
        </div>
      </Section>

      {/* ── METRIC SUMMARY ROW ────────────────────────────────────────────── */}
      <Section delay={0.1} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div 
          className="p-4 rounded-xl space-y-1 transition-all"
          style={{
            backgroundColor: 'var(--c-surface)',
            border: '1px solid var(--c-border)',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <span className="text-[10px] uppercase font-mono font-bold tracking-wider" style={{ color: 'var(--c-muted)' }}>
            Total Decisions
          </span>
          <p className="text-2xl font-bold font-mono" style={{ color: 'var(--c-fg)' }}>{stats.total}</p>
        </div>
        <div 
          className="p-4 rounded-xl space-y-1 transition-all"
          style={{
            backgroundColor: 'var(--c-surface)',
            border: '1px solid var(--c-border)',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <span className="text-[10px] uppercase font-mono font-bold tracking-wider" style={{ color: 'var(--c-muted)' }}>
            Authorizations
          </span>
          <p className="text-2xl font-bold font-mono text-emerald-500">{stats.approved}</p>
        </div>
        <div 
          className="p-4 rounded-xl space-y-1 transition-all"
          style={{
            backgroundColor: 'var(--c-surface)',
            border: '1px solid var(--c-border)',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <span className="text-[10px] uppercase font-mono font-bold tracking-wider" style={{ color: 'var(--c-muted)' }}>
            Rejected / Vetoed
          </span>
          <p className="text-2xl font-bold font-mono text-rose-500">{stats.rejected}</p>
        </div>
        <div 
          className="p-4 rounded-xl space-y-1 transition-all"
          style={{
            backgroundColor: 'var(--c-surface)',
            border: '1px solid var(--c-border)',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <span className="text-[10px] uppercase font-mono font-bold tracking-wider" style={{ color: 'var(--c-muted)' }}>
            Committed Capital
          </span>
          <p className={`text-2xl font-bold font-mono ${stats.netCapital >= 0 ? 'text-emerald-500' : ''}`} style={{ color: stats.netCapital < 0 ? 'var(--c-fg)' : undefined }}>
            {stats.netCapital >= 0 ? '+' : ''}{formatINR(Math.abs(Math.round(stats.netCapital)))}
          </p>
        </div>
      </Section>

      {/* ── SEARCH & FILTER CONTROLS ──────────────────────────────────────── */}
      <Section delay={0.15} className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--c-muted)' }} />
          <input
            type="text"
            placeholder="Search ledger by title, keyword, context..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl text-xs outline-none transition-colors"
            style={{
              backgroundColor: 'var(--c-surface)',
              border: '1px solid var(--c-border)',
              color: 'var(--c-fg)',
              boxShadow: 'var(--shadow-sm)'
            }}
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl font-medium outline-none transition-colors"
            style={{
              backgroundColor: 'var(--c-surface)',
              border: '1px solid var(--c-border)',
              color: 'var(--c-fg)'
            }}
          >
            <option value="ALL">All Tracks</option>
            <option value="HIRING">Hiring & Talent</option>
            <option value="FINANCE">Finance & Treasury</option>
            <option value="GROWTH">Growth & GTM</option>
            <option value="LEGAL">Legal & Contracts</option>
            <option value="OPERATIONS">Operations & Sprints</option>
            <option value="STRATEGY">CEO Strategy</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl font-medium outline-none transition-colors"
            style={{
              backgroundColor: 'var(--c-surface)',
              border: '1px solid var(--c-border)',
              color: 'var(--c-fg)'
            }}
          >
            <option value="ALL">All Statuses</option>
            <option value="APPROVED">Approved & Executed</option>
            <option value="REJECTED">Rejected by Founder</option>
            <option value="FAILED">Execution Failed</option>
          </select>
        </div>
      </Section>

      {/* ── CLEAN TABLE / LIST: SECTION 15 COMPLIANT ─────────────────────── */}
      <Section delay={0.2} className="rounded-2xl overflow-hidden divide-y" style={{ backgroundColor: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
        {/* Table Header Columns: Decision | Context | Owner | Recommendation | Status | Date */}
        <div 
          className="hidden lg:grid grid-cols-12 gap-4 px-6 py-3.5 text-[10px] font-mono font-bold uppercase tracking-wider"
          style={{
            backgroundColor: 'var(--c-surface-2)',
            color: 'var(--c-muted)',
            borderBottom: '1px solid var(--c-border)'
          }}
        >
          <div className="col-span-3">Decision</div>
          <div className="col-span-3">Context & Directives</div>
          <div className="col-span-2">Owner / Lead</div>
          <div className="col-span-2">Recommendation</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-1 text-right">Date</div>
        </div>

        {/* Table Rows */}
        {filteredDecisions.length > 0 ? (
          filteredDecisions.map((record) => {
            const isApproved = record.status === 'approved';
            const isFailed = record.status === 'failed';
            const dateStr = new Date(record.timestamp).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric'
            });

            return (
              <div
                key={record.id}
                onClick={() => setSelectedRecord(record)}
                className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 px-6 py-4 items-center transition-colors cursor-pointer group"
                style={{
                  backgroundColor: 'var(--c-surface)',
                  borderBottom: '1px solid var(--c-border)'
                }}
              >
                {/* 1. Decision (Col 3) */}
                <div className="lg:col-span-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <span 
                      className="px-2 py-0.5 text-[9px] font-mono font-bold rounded-md uppercase"
                      style={{ backgroundColor: 'var(--c-surface-2)', color: 'var(--c-fg)', border: '1px solid var(--c-border)' }}
                    >
                      {record.category}
                    </span>
                    {record.reversibility && (
                      <span className={`text-[8px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
                        record.reversibility === 'REVERSIBLE' ? 'bg-sky-500/10 text-sky-500' : 'bg-amber-500/10 text-amber-500'
                      }`}>
                        {record.reversibility}
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs font-bold line-clamp-1 transition-colors group-hover:text-indigo-400" style={{ color: 'var(--c-fg)' }}>
                    {record.title}
                  </h4>
                </div>

                {/* 2. Context & Directives (Col 3) */}
                <div className="lg:col-span-3 text-xs" style={{ color: 'var(--c-muted)' }}>
                  <p className="line-clamp-2 leading-relaxed">
                    {record.impactText || record.description}
                  </p>
                </div>

                {/* 3. Owner / Lead (Col 2) */}
                <div className="lg:col-span-2 flex items-center gap-2 text-xs">
                  <div 
                    className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] font-mono shrink-0"
                    style={{ backgroundColor: 'var(--c-surface-2)', color: 'var(--c-fg)', border: '1px solid var(--c-border)' }}
                  >
                    {record.approver ? record.approver[0] : 'F'}
                  </div>
                  <span className="font-semibold truncate" style={{ color: 'var(--c-fg)' }}>
                    {record.approver || 'Founder Sign-off'}
                  </span>
                </div>

                {/* 4. Recommendation / Impact (Col 2) */}
                <div className="lg:col-span-2 text-xs font-mono">
                  {record.financialImpact ? (
                    <span className={`font-bold ${record.financialImpact > 0 ? 'text-emerald-500' : ''}`} style={{ color: record.financialImpact < 0 ? 'var(--c-fg)' : undefined }}>
                      {record.financialImpact > 0 ? '+' : ''}${Math.abs(record.financialImpact).toLocaleString()}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--c-muted)' }}>Operational Alignment</span>
                  )}
                  <span className="text-[10px] block font-sans truncate" style={{ color: 'var(--c-muted)' }}>
                    {record.recommendationBy || 'Executive Council'}
                  </span>
                </div>

                {/* 5. Status (Col 1) */}
                <div className="lg:col-span-1">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase ${
                    isApproved ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    isFailed ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                    'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}>
                    {isApproved ? <Check className="w-2.5 h-2.5" /> : null}
                    {record.status}
                  </span>
                </div>

                {/* 6. Date (Col 1) */}
                <div className="lg:col-span-1 text-right text-xs font-mono flex items-center justify-end gap-1.5" style={{ color: 'var(--c-muted)' }}>
                  <span>{dateStr}</span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-12 text-center text-xs space-y-1" style={{ color: 'var(--c-muted)' }}>
            <p className="font-bold" style={{ color: 'var(--c-fg)' }}>No ledger records matching filters</p>
            <p>Try refining your search terms or selecting all tracks.</p>
          </div>
        )}
      </Section>

      {/* ── FOCUSED DETAIL DRAWER ─────────────────────────────────────────── */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/20 backdrop-blur-xs">
          <div 
            className="w-full max-w-xl h-full shadow-2xl flex flex-col justify-between overflow-y-auto animate-fade-in"
            style={{
              backgroundColor: 'var(--c-surface)',
              borderLeft: '1px solid var(--c-border)'
            }}
          >
            
            <div 
              className="p-6 space-y-3 sticky top-0 z-10 backdrop-blur-md"
              style={{
                backgroundColor: 'var(--c-surface)',
                borderBottom: '1px solid var(--c-border)'
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span 
                    className="px-2.5 py-0.5 text-[10px] font-mono font-bold rounded-full uppercase"
                    style={{ backgroundColor: 'var(--c-surface-2)', color: 'var(--c-fg)', border: '1px solid var(--c-border)' }}
                  >
                    {selectedRecord.category}
                  </span>
                  <span className={`px-2.5 py-0.5 text-[10px] font-mono font-bold rounded-full uppercase ${
                    selectedRecord.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}>
                    {selectedRecord.status}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="p-1.5 rounded-full transition-colors cursor-pointer"
                  style={{ color: 'var(--c-muted)', backgroundColor: 'var(--c-surface-2)' }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <h3 className="text-lg font-bold" style={{ color: 'var(--c-fg)' }}>{selectedRecord.title}</h3>
                <span className="text-[11px] font-mono flex items-center gap-1.5 mt-1" style={{ color: 'var(--c-muted)' }}>
                  <Clock className="w-3.5 h-3.5" />
                  Logged: {new Date(selectedRecord.timestamp).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="p-6 space-y-6 flex-1">
              
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider block" style={{ color: 'var(--c-muted)' }}>
                  Deliberation Context & Summary
                </span>
                <p 
                  className="text-xs leading-relaxed p-4 rounded-xl"
                  style={{
                    backgroundColor: 'var(--c-surface-2)',
                    border: '1px solid var(--c-border)',
                    color: 'var(--c-fg)'
                  }}
                >
                  {selectedRecord.description}
                </p>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider block" style={{ color: 'var(--c-muted)' }}>
                  Forecasted & Executed Impact
                </span>
                <p 
                  className="text-xs leading-relaxed p-4 rounded-xl"
                  style={{
                    backgroundColor: 'var(--c-surface-2)',
                    border: '1px solid var(--c-border)',
                    color: 'var(--c-fg)'
                  }}
                >
                  {selectedRecord.impactText || 'Standard strategic trajectory parameters recorded.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div 
                  className="p-3.5 rounded-xl space-y-1"
                  style={{ backgroundColor: 'var(--c-surface-2)', border: '1px solid var(--c-border)' }}
                >
                  <span className="text-[10px] font-mono font-bold uppercase block" style={{ color: 'var(--c-muted)' }}>Authorizing Party</span>
                  <span className="font-bold" style={{ color: 'var(--c-fg)' }}>{selectedRecord.approver || 'Founder Sign-off'}</span>
                </div>
                <div 
                  className="p-3.5 rounded-xl space-y-1"
                  style={{ backgroundColor: 'var(--c-surface-2)', border: '1px solid var(--c-border)' }}
                >
                  <span className="text-[10px] font-mono font-bold uppercase block" style={{ color: 'var(--c-muted)' }}>Capital Delta</span>
                  <span className="font-bold font-mono" style={{ color: 'var(--c-fg)' }}>
                    {selectedRecord.financialImpact ? `${selectedRecord.financialImpact < 0 ? '-' : '+'}${formatINR(Math.abs(selectedRecord.financialImpact))}` : '₹0 (Neutral)'}
                  </span>
                </div>
              </div>

              {selectedRecord.rawCouncilDeliberation && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider block" style={{ color: 'var(--c-muted)' }}>
                    Audited Council Raw Log
                  </span>
                  <div 
                    className="p-4 rounded-xl max-h-48 overflow-y-auto text-[11px] font-mono leading-relaxed whitespace-pre-wrap"
                    style={{
                      backgroundColor: 'var(--c-surface-2)',
                      border: '1px solid var(--c-border)',
                      color: 'var(--c-fg)'
                    }}
                  >
                    {selectedRecord.rawCouncilDeliberation}
                  </div>
                </div>
              )}

            </div>

            <div 
              className="p-5 flex items-center justify-between"
              style={{ backgroundColor: 'var(--c-surface)', borderTop: '1px solid var(--c-border)' }}
            >
              <span className="text-[10px] font-mono" style={{ color: 'var(--c-muted)' }}>Record ID: {selectedRecord.id}</span>
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all"
                style={{
                  backgroundColor: 'var(--c-fg)',
                  color: 'var(--c-bg)'
                }}
              >
                Close Drawer
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
