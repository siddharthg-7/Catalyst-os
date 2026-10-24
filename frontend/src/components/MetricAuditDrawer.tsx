import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ShieldCheck, Calculator, Clock, AlertCircle,
  FileText, Sparkles, TrendingDown, ArrowRight, ExternalLink, SlidersHorizontal
} from 'lucide-react';
import { AuditedMetric, MetricConfidence } from '../types';

interface MetricAuditDrawerProps {
  metric: AuditedMetric<number> | null;
  isOpen: boolean;
  onClose: () => void;
  onCalibrate?: () => void;
  onUploadDocument?: () => void;
}

export default function MetricAuditDrawer({
  metric,
  isOpen,
  onClose,
  onCalibrate,
  onUploadDocument,
}: MetricAuditDrawerProps) {
  if (!isOpen || !metric) return null;

  const renderConfidenceBadge = (confidence: MetricConfidence) => {
    switch (confidence) {
      case 'VERIFIED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            <span>VERIFIED RECORD</span>
          </span>
        );
      case 'ESTIMATED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <Calculator className="w-3 h-3 text-amber-600" />
            <span>ESTIMATED ASSUMPTION</span>
          </span>
        );
      case 'STALE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-50 text-rose-800 border border-rose-200">
            <Clock className="w-3 h-3 text-rose-600" />
            <span>STALE (&gt;30 DAYS)</span>
          </span>
        );
      case 'MISSING_DATA':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <AlertCircle className="w-3 h-3 text-slate-500" />
            <span>MISSING DATA</span>
          </span>
        );
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden font-sans">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[#141413]/30 backdrop-blur-xs transition-opacity"
        />

        <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="w-screen max-w-lg bg-white border-l border-[#141413]/10 shadow-[rgba(0,0,0,0.12)_0px_20px_50px] flex flex-col justify-between"
          >
            {/* Header */}
            <div className="p-6 border-b border-[#141413]/08 flex items-start justify-between bg-[#FCFBFA]">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#666562] font-bold">
                    Metric Provenance &amp; Lineage Audit
                  </span>
                  {renderConfidenceBadge(metric.confidence)}
                </div>
                <h2 className="text-xl font-bold text-[#141413] tracking-tight font-sans">
                  {metric.title}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-[#8E8D8A] hover:text-[#141413] hover:bg-[#F3F0EE] transition-colors cursor-pointer"
                title="Close drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Primary Value Display */}
              <div className="p-4 rounded-2xl bg-[#FDFCFA] border border-[#141413]/10 flex items-baseline justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase text-[#666562] block font-bold">
                    Reported Value
                  </span>
                  <span className="text-3xl font-extrabold font-mono tracking-tight text-[#141413]">
                    {metric.formattedValue}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-mono text-[#666562] block">Last Reconciled</span>
                  <span className="text-xs font-semibold text-[#141413]">{metric.asOfDate}</span>
                </div>
              </div>

              {/* Data Provenance & Source Record */}
              <div className="space-y-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#666562] font-bold block">
                  1. Source Attribution &amp; Origin
                </span>
                <div className="p-3.5 rounded-xl bg-white border border-[#141413]/08 shadow-2xs space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[#666562]">Source Record:</span>
                    <span className="font-semibold text-[#141413] flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#141413]" />
                      {metric.source.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#666562]">Audit Agent Oversight:</span>
                    <span className="font-semibold text-[#141413]">
                      {metric.source.verifiedByAgent || 'Sentry · Compliance & Verification Auditor'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#666562]">Data Freshness:</span>
                    <span className={`font-mono text-[11px] font-semibold ${metric.isStale ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {metric.isStale ? 'Stale (>30 days since update)' : 'Fresh (< 24 hours)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Mathematical Formulation & Explicit Assumptions */}
              {metric.calculation && (
                <div className="space-y-2">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-[#666562] font-bold block">
                    2. Calculation Formula &amp; Assumptions
                  </span>
                  <div className="p-3.5 rounded-xl bg-white border border-[#141413]/08 shadow-2xs space-y-3 text-xs">
                    <div>
                      <span className="text-[10px] font-mono uppercase text-[#666562] block">Formula Applied</span>
                      <code className="text-xs font-mono font-bold text-[#141413] bg-[#F3F0EE] px-2 py-1 rounded-md block mt-1">
                        {metric.calculation.formula}
                      </code>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono uppercase text-[#666562] block">Methodology</span>
                      <p className="text-xs text-[#141413] mt-0.5 leading-relaxed">
                        {metric.calculation.methodology}
                      </p>
                    </div>

                    {metric.calculation.assumptions.length > 0 && (
                      <div>
                        <span className="text-[10px] font-mono uppercase text-[#666562] block mb-1">
                          Explicit Stated Assumptions:
                        </span>
                        <ul className="space-y-1">
                          {metric.calculation.assumptions.map((assump, idx) => (
                            <li key={idx} className="flex items-start gap-1.5 text-[11px] text-[#666562]">
                              <span className="text-[#141413] font-bold">•</span>
                              <span>{assump}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Dual Runway / Post-Commitment Scenario Projection */}
              {metric.forecast && (
                <div className="space-y-2">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-[#666562] font-bold block">
                    3. Scenario Modeling: Baseline vs. Post-Commitment
                  </span>
                  <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-mono text-amber-900 uppercase font-bold block">
                          Current Baseline
                        </span>
                        <span className="text-base font-bold font-mono text-[#141413]">
                          {metric.formattedValue}
                        </span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-amber-700" />
                      <div className="text-right">
                        <span className="text-[10px] font-mono text-amber-900 uppercase font-bold block">
                          Post-Commitment Forecast
                        </span>
                        <span className="text-base font-bold font-mono text-amber-900">
                          {metric.forecast.formattedAdjustedValue}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-amber-200/60">
                      <div className="flex items-center gap-1.5 text-amber-900 font-semibold text-[11px]">
                        <TrendingDown className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        <span>{metric.forecast.deltaNote}</span>
                      </div>
                      <ul className="mt-1 space-y-0.5">
                        {metric.forecast.scenarioAssumptions.map((sa, i) => (
                          <li key={i} className="text-[10px] font-mono text-amber-800">
                            • {sa}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Health Score 5-Pillar Scorecard Breakdown */}
              {metric.metricKey === 'healthScore' && (
                <div className="space-y-2">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-[#666562] font-bold block">
                    3. Health Scorecard Composition (Weighted Model)
                  </span>
                  <div className="p-3.5 rounded-xl bg-white border border-[#141413]/08 shadow-2xs space-y-2 text-xs">
                    {[
                      { pillar: 'Capital Runway Horizon', weight: '30%', score: 85, desc: 'Runway > 6 mo buffer' },
                      { pillar: 'Milestone Execution Velocity', weight: '25%', score: 82, desc: 'On-time sprint tasks' },
                      { pillar: 'Risk & Blocker Density', weight: '20%', score: 80, desc: 'Critical blocker audit' },
                      { pillar: 'Governance & Approvals', weight: '15%', score: 90, desc: 'Human-in-loop compliance' },
                      { pillar: 'Team Allocation & Coverage', weight: '10%', score: 75, desc: 'Open critical roles' },
                    ].map((p, i) => (
                      <div key={i} className="flex items-center justify-between py-1 border-b border-[#141413]/05 last:border-0">
                        <div>
                          <div className="font-semibold text-[#141413]">{p.pillar}</div>
                          <div className="text-[10px] font-mono text-[#666562]">Weight: {p.weight} · {p.desc}</div>
                        </div>
                        <span className="font-mono text-xs font-bold text-[#141413]">{p.score}/100</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-[#141413]/08 bg-[#FCFBFA] flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onCalibrate) onCalibrate();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#141413]/10 bg-white hover:bg-[#F3F0EE] text-[#141413] text-xs font-semibold transition-all cursor-pointer shadow-2xs font-sans"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#666562]" />
                <span>Calibrate Assumptions</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onUploadDocument) onUploadDocument();
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#141413] hover:bg-[#262627] text-[#FDFCFA] text-xs font-bold transition-all shadow-xs cursor-pointer font-sans"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#FDFCFA]" />
                <span>Verify with Corporate Document</span>
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
}
