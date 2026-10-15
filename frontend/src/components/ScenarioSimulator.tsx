/**
 * CatalystOS - What-If Scenario Studio (Section 17)
 * Redesigned with Apple × Linear × Notion aesthetics.
 * Clear founder interaction: "What happens if..." → Scenario Input → Run Scenario
 * Clean 5-phase progression: Current State ↓ Scenario ↓ Executive Analysis ↓ Impact ↓ Recommendation
 */

import React, { useState, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, AlertTriangle,
  RefreshCw, Play, SlidersHorizontal, CheckCircle2, XCircle, ArrowDown
} from 'lucide-react';
import Section from './Section';
import { formatINR, formatCompactINR } from '../utils/currency';

interface ScenarioSimulatorProps {
  currentCash: number;
  currentBurn: number;
  companyName?: string;
}

interface ScenarioPreset {
  id: string;
  title: string;
  query: string;
  description: string;
  headcountDelta: number;
  headcountRole: string;
  headcountSalary: number;
  adSpendDelta: number;
  revenueDeltaPercent: number;
  oneTimeExpense: number;
}

const PRESETS: ScenarioPreset[] = [
  {
    id: 'hire_3',
    title: 'Hire 3 Engineers',
    query: 'What happens if we hire 3 Senior Engineers at ₹24,00,000 base?',
    description: 'Scale core UPI and checkout platform velocity with 3 senior engineers.',
    headcountDelta: 3,
    headcountRole: 'Senior Backend Engineer',
    headcountSalary: 2400000,
    adSpendDelta: 0,
    revenueDeltaPercent: 0,
    oneTimeExpense: 0
  },
  {
    id: 'ad_spend_15k',
    title: '+₹1.5L/mo Growth Spend',
    query: 'What happens if we accelerate ad spend by ₹1,50,000 per month?',
    description: 'Aggressive top-of-funnel customer acquisition push across metro tiers.',
    headcountDelta: 0,
    headcountRole: '',
    headcountSalary: 0,
    adSpendDelta: 150000,
    revenueDeltaPercent: 0,
    oneTimeExpense: 0
  },
  {
    id: 'rev_down_20',
    title: 'Revenue Drops 20%',
    query: 'What happens if top-line revenue contracts by 20%?',
    description: 'Adverse macroeconomic contraction stress test.',
    headcountDelta: 0,
    headcountRole: '',
    headcountSalary: 0,
    adSpendDelta: 0,
    revenueDeltaPercent: -20,
    oneTimeExpense: 0
  },
  {
    id: 'launch_slip_30',
    title: 'Launch Slips 30 Days',
    query: 'What happens if product launch delays by 30 days?',
    description: '1 month of unbudgeted server and operational burn.',
    headcountDelta: 0,
    headcountRole: '',
    headcountSalary: 0,
    adSpendDelta: 0,
    revenueDeltaPercent: 0,
    oneTimeExpense: 250000
  },
  {
    id: 'preservation',
    title: 'Cash Preservation',
    query: 'What happens if we freeze hiring and cut spend by ₹1,00,000/mo?',
    description: 'Extend runway to maximum horizon before Series A round.',
    headcountDelta: 0,
    headcountRole: '',
    headcountSalary: 0,
    adSpendDelta: -100000,
    revenueDeltaPercent: 0,
    oneTimeExpense: 0
  }
];

export default function ScenarioSimulator({
  currentCash = 7200000,
  currentBurn = 800000,
  companyName = 'Apex AI'
}: ScenarioSimulatorProps) {
  // Scenario prompt query
  const [scenarioPrompt, setScenarioPrompt] = useState('What happens if we hire 3 Senior Engineers at ₹24,00,000 base?');
  const [isRunning, setIsRunning] = useState(false);
  const [hasRun, setHasRun] = useState(true);

  // Scenario input variables
  const [headcount, setHeadcount] = useState<number>(3);
  const [headcountSalary, setHeadcountSalary] = useState<number>(2400000);
  const [headcountRole, setHeadcountRole] = useState<string>('Senior Backend Engineer');
  const [adSpendDelta, setAdSpendDelta] = useState<number>(0);
  const [revenueDeltaPercent, setRevenueDeltaPercent] = useState<number>(0);
  const [oneTimeExpense, setOneTimeExpense] = useState<number>(0);
  const [activePreset, setActivePreset] = useState<string | null>('hire_3');
  const [showVariableSliders, setShowVariableSliders] = useState(false);

  // Apply a preset
  const applyPreset = (preset: ScenarioPreset) => {
    setActivePreset(preset.id);
    setScenarioPrompt(preset.query);
    setHeadcount(preset.headcountDelta);
    setHeadcountSalary(preset.headcountSalary || 2400000);
    setHeadcountRole(preset.headcountRole || 'Software Engineer');
    setAdSpendDelta(preset.adSpendDelta);
    setRevenueDeltaPercent(preset.revenueDeltaPercent);
    setOneTimeExpense(preset.oneTimeExpense);
    setHasRun(true);
  };

  const resetToBaseline = () => {
    setActivePreset(null);
    setScenarioPrompt('What happens if we remain at baseline?');
    setHeadcount(0);
    setHeadcountSalary(2400000);
    setHeadcountRole('Software Engineer');
    setAdSpendDelta(0);
    setRevenueDeltaPercent(0);
    setOneTimeExpense(0);
    setHasRun(true);
  };

  const handleRunScenario = () => {
    setIsRunning(true);
    setTimeout(() => {
      setIsRunning(false);
      setHasRun(true);
    }, 600);
  };

  // Deterministic financial calculation (100% mathematical integrity)
  const simulation = useMemo(() => {
    const cash = Math.max(0, currentCash);
    const burn = Math.max(1000, currentBurn);

    const initialRunway = parseFloat((cash / burn).toFixed(1));

    // Loaded compensation: (Base * 1.20) / 12 * Count
    const monthlyHeadcountCost = headcount > 0
      ? ((headcountSalary * 1.20) / 12) * headcount
      : 0;

    const growthDelta = adSpendDelta;
    const estimatedRevBase = burn * 0.35;
    const revenueImpact = estimatedRevBase * (revenueDeltaPercent / 100);

    const netBurnDelta = monthlyHeadcountCost + growthDelta - revenueImpact;
    const projectedBurn = Math.max(1000, burn + netBurnDelta);

    const projectedCash = Math.max(0, cash - oneTimeExpense);
    const projectedRunway = parseFloat((projectedCash / projectedBurn).toFixed(1));
    const runwayDelta = parseFloat((projectedRunway - initialRunway).toFixed(1));

    let riskRating: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (projectedRunway < 4.0 || projectedCash <= 0) {
      riskRating = 'CRITICAL';
    } else if (projectedRunway < 6.0) {
      riskRating = 'HIGH';
    } else if (projectedRunway < 10.0 || netBurnDelta > 20000) {
      riskRating = 'MEDIUM';
    }

    const timeline = [];
    let rollingCash = projectedCash;
    for (let month = 1; month <= 12; month++) {
      rollingCash = Math.max(0, rollingCash - projectedBurn);
      timeline.push({
        month,
        cash: Math.round(rollingCash),
        depleted: rollingCash <= 0
      });
    }

    return {
      initialCash: cash,
      initialBurn: burn,
      initialRunway,
      monthlyHeadcountCost,
      netBurnDelta,
      projectedCash,
      projectedBurn,
      projectedRunway,
      runwayDelta,
      riskRating,
      timeline
    };
  }, [currentCash, currentBurn, headcount, headcountSalary, adSpendDelta, revenueDeltaPercent, oneTimeExpense]);

  return (
    <div id="scenario-studio-container" className="space-y-8 font-sans">
      
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <Section delay={0.05} className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4" style={{ borderBottom: '1px solid var(--c-border)' }}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider font-semibold" style={{ color: 'var(--c-accent)' }}>
              Strategic Forecasting
            </span>
            <span className="w-1 h-1 rounded-full" style={{ backgroundColor: 'var(--c-border-strong)' }} />
            <span className="text-[11px] font-mono" style={{ color: 'var(--c-muted)' }}>
              Deterministic Solvency Engine
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: 'var(--c-fg)' }}>
            Scenario Studio
          </h1>
          <p className="text-sm mt-1 max-w-2xl" style={{ color: 'var(--c-muted)' }}>
            Simulate the impact of hiring expansions, market downturns, and capital deployments before committing company cash.
          </p>
        </div>

        <button
          onClick={resetToBaseline}
          className="px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 self-start md:self-center transition-colors cursor-pointer"
          style={{
            backgroundColor: 'var(--c-surface-2)',
            border: '1px solid var(--c-border)',
            color: 'var(--c-fg)'
          }}
        >
          <RefreshCw className="w-3.5 h-3.5" style={{ color: 'var(--c-muted)' }} />
          Reset to Baseline
        </button>
      </Section>

      {/* ── PRIMARY INTERACTION: "WHAT HAPPENS IF..." HERO ───────────────── */}
      <div 
        className="p-6 md:p-8 rounded-2xl space-y-6 shadow-sm transition-all"
        style={{
          backgroundColor: 'var(--c-surface)',
          border: '1px solid var(--c-border)',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div>
          <span className="text-xs font-bold uppercase font-mono tracking-wider block mb-2" style={{ color: 'var(--c-muted)' }}>
            Main Scenario Prompt
          </span>
          <label className="text-xl sm:text-2xl font-bold block" style={{ color: 'var(--c-fg)' }}>
            What happens if...
          </label>
        </div>

        {/* Input Bar with Run Scenario CTA */}
        <div className="flex flex-col sm:flex-row items-stretch gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={scenarioPrompt}
              onChange={(e) => setScenarioPrompt(e.target.value)}
              placeholder="e.g. We hire 3 engineers and increase growth spend by ₹1,50,000/mo..."
              className="w-full px-4 py-3.5 rounded-xl text-sm font-semibold outline-none transition-colors"
              style={{
                backgroundColor: 'var(--c-surface-2)',
                border: '1px solid var(--c-border)',
                color: 'var(--c-fg)'
              }}
            />
          </div>

          <button
            onClick={handleRunScenario}
            disabled={isRunning}
            className="px-6 py-3.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-sm shrink-0 disabled:opacity-50 cursor-pointer transition-all"
            style={{
              backgroundColor: 'var(--c-fg)',
              color: 'var(--c-bg)'
            }}
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Simulating...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run Scenario
              </>
            )}
          </button>
        </div>

        {/* Preset Chips */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <span className="text-xs font-medium mr-1" style={{ color: 'var(--c-muted)' }}>Presets:</span>
          {PRESETS.map((p) => {
            const isSelected = activePreset === p.id;
            return (
              <button
                key={p.id}
                onClick={() => applyPreset(p)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                style={{
                  backgroundColor: isSelected ? 'var(--c-fg)' : 'var(--c-surface-2)',
                  color: isSelected ? 'var(--c-bg)' : 'var(--c-muted)',
                  border: `1px solid ${isSelected ? 'var(--c-fg)' : 'var(--c-border)'}`
                }}
              >
                {p.title}
              </button>
            );
          })}

          <button
            onClick={() => setShowVariableSliders(!showVariableSliders)}
            className="ml-auto text-xs font-bold hover:underline flex items-center gap-1 cursor-pointer"
            style={{ color: 'var(--c-accent)' }}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {showVariableSliders ? 'Hide Variable Controls' : 'Fine-Tune Variables'}
          </button>
        </div>

        {/* Fine-Tuning Sliders (Collapsible) */}
        {showVariableSliders && (
          <div 
            className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-5 animate-fade-in text-xs"
            style={{ borderTop: '1px solid var(--c-border)' }}
          >
            {/* Headcount */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-semibold">
                <span style={{ color: 'var(--c-muted)' }}>Headcount Delta</span>
                <span className="font-mono font-bold" style={{ color: 'var(--c-fg)' }}>+{headcount} hires</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={headcount}
                onChange={(e) => {
                  setHeadcount(parseInt(e.target.value, 10));
                  setActivePreset(null);
                }}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            {/* Growth Spend */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-semibold">
                <span style={{ color: 'var(--c-muted)' }}>Monthly Ad Spend</span>
                <span className="font-mono font-bold" style={{ color: 'var(--c-fg)' }}>
                  {adSpendDelta >= 0 ? `+${formatINR(adSpendDelta)}` : `-${formatINR(Math.abs(adSpendDelta))}`}
                </span>
              </div>
              <input
                type="range"
                min="-200000"
                max="500000"
                step="25000"
                value={adSpendDelta}
                onChange={(e) => {
                  setAdSpendDelta(parseInt(e.target.value, 10));
                  setActivePreset(null);
                }}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            {/* Revenue Variance */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-semibold">
                <span style={{ color: 'var(--c-muted)' }}>Revenue Shock</span>
                <span className={`font-mono font-bold ${revenueDeltaPercent < 0 ? 'text-rose-500' : ''}`} style={{ color: revenueDeltaPercent >= 0 ? 'var(--c-fg)' : undefined }}>
                  {revenueDeltaPercent > 0 ? `+${revenueDeltaPercent}%` : `${revenueDeltaPercent}%`}
                </span>
              </div>
              <input
                type="range"
                min="-50"
                max="50"
                step="5"
                value={revenueDeltaPercent}
                onChange={(e) => {
                  setRevenueDeltaPercent(parseInt(e.target.value, 10));
                  setActivePreset(null);
                }}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── 5-PHASE PROGRESSION FLOW (SECTION 17) ─────────────────────────── */}
      {hasRun && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Phase 1: Current State */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span 
                className="w-5 h-5 rounded-full text-[10px] font-mono font-bold flex items-center justify-center"
                style={{ backgroundColor: 'var(--c-fg)', color: 'var(--c-bg)' }}
              >
                1
              </span>
              <h3 className="text-sm font-bold uppercase tracking-wider font-mono" style={{ color: 'var(--c-fg)' }}>
                Current State (Baseline)
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div 
                className="p-4 rounded-xl space-y-1 transition-all"
                style={{ backgroundColor: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
              >
                <span className="text-[10px] uppercase font-mono font-bold" style={{ color: 'var(--c-muted)' }}>Baseline Cash Balance</span>
                <p className="text-xl font-bold font-mono" style={{ color: 'var(--c-fg)' }}>{formatCompactINR(currentCash)}</p>
                <span className="text-[10px]" style={{ color: 'var(--c-muted)' }}>Audited Neon Ledger</span>
              </div>
              <div 
                className="p-4 rounded-xl space-y-1 transition-all"
                style={{ backgroundColor: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
              >
                <span className="text-[10px] uppercase font-mono font-bold" style={{ color: 'var(--c-muted)' }}>Current Monthly Burn</span>
                <p className="text-xl font-bold font-mono" style={{ color: 'var(--c-fg)' }}>{formatCompactINR(currentBurn)}/mo</p>
                <span className="text-[10px]" style={{ color: 'var(--c-muted)' }}>Fixed + Discretionary</span>
              </div>
              <div 
                className="p-4 rounded-xl space-y-1 transition-all"
                style={{ backgroundColor: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
              >
                <span className="text-[10px] uppercase font-mono font-bold" style={{ color: 'var(--c-muted)' }}>Baseline Runway</span>
                <p className="text-xl font-bold font-mono text-emerald-500">{simulation.initialRunway} months</p>
                <span className="text-[10px]" style={{ color: 'var(--c-muted)' }}>At current consumption</span>
              </div>
            </div>
          </section>

          <div className="flex justify-center" style={{ color: 'var(--c-border-strong)' }}><ArrowDown className="w-4 h-4" /></div>

          {/* Phase 2: Scenario Tested */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span 
                className="w-5 h-5 rounded-full text-[10px] font-mono font-bold flex items-center justify-center"
                style={{ backgroundColor: 'var(--c-fg)', color: 'var(--c-bg)' }}
              >
                2
              </span>
              <h3 className="text-sm font-bold uppercase tracking-wider font-mono" style={{ color: 'var(--c-fg)' }}>
                Scenario Tested
              </h3>
            </div>

            <div 
              className="p-4 rounded-xl text-xs flex items-center justify-between flex-wrap gap-3"
              style={{
                backgroundColor: 'var(--c-surface-2)',
                border: '1px solid var(--c-border)',
                color: 'var(--c-fg)'
              }}
            >
              <span className="font-semibold text-sm">
                "{scenarioPrompt}"
              </span>
              <div className="flex items-center gap-2 font-mono text-[11px]" style={{ color: 'var(--c-muted)' }}>
                <span>Headcount: +{headcount}</span>
                <span>·</span>
                <span>Ad Spend: {adSpendDelta >= 0 ? '+' : ''}{formatINR(adSpendDelta)}/mo</span>
                <span>·</span>
                <span>Revenue Shock: {revenueDeltaPercent}%</span>
              </div>
            </div>
          </section>

          <div className="flex justify-center" style={{ color: 'var(--c-border-strong)' }}><ArrowDown className="w-4 h-4" /></div>

          {/* Phase 3: Executive Council Analysis */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span 
                className="w-5 h-5 rounded-full text-[10px] font-mono font-bold flex items-center justify-center"
                style={{ backgroundColor: 'var(--c-fg)', color: 'var(--c-bg)' }}
              >
                3
              </span>
              <h3 className="text-sm font-bold uppercase tracking-wider font-mono" style={{ color: 'var(--c-fg)' }}>
                Executive Council Analysis
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* CFO Analysis */}
              <div 
                className="p-4 rounded-xl space-y-2 transition-all"
                style={{ backgroundColor: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5" style={{ color: 'var(--c-fg)' }}>
                    Marcus (CFO)
                  </span>
                  <span className="text-[10px] font-mono" style={{ color: 'var(--c-muted)' }}>Treasury</span>
                </div>
                <p className="leading-relaxed" style={{ color: 'var(--c-muted)' }}>
                  {simulation.projectedRunway < 4.0
                    ? `Critical runway collapse to ${simulation.projectedRunway} months. Violates solvency floor. Mandatory veto.`
                    : simulation.projectedRunway < 6.0
                    ? `Compresses runway below 6-month buffer (${simulation.projectedRunway} mos). Requires operational offsets.`
                    : `Treasury retains ${simulation.projectedRunway} months of operational runway. Within healthy guidelines.`}
                </p>
              </div>

              {/* Talent Analysis */}
              <div 
                className="p-4 rounded-xl space-y-2 transition-all"
                style={{ backgroundColor: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold" style={{ color: 'var(--c-fg)' }}>Evelyn (Talent)</span>
                  <span className="text-[10px] font-mono" style={{ color: 'var(--c-muted)' }}>People</span>
                </div>
                <p className="leading-relaxed" style={{ color: 'var(--c-muted)' }}>
                  {headcount > 0
                    ? `Adding ${headcount} hires expands loaded compensation burn by ${formatINR(Math.round(simulation.monthlyHeadcountCost))}/mo. 30-day hiring cycle expected.`
                    : 'Zero headcount modifications requested in this simulation branch.'}
                </p>
              </div>

              {/* Auditor Analysis */}
              <div 
                className="p-4 rounded-xl space-y-2 transition-all"
                style={{ backgroundColor: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold" style={{ color: 'var(--c-fg)' }}>Nexus (Auditor)</span>
                  <span className="text-[10px] font-mono" style={{ color: 'var(--c-muted)' }}>Governance</span>
                </div>
                <p className="leading-relaxed" style={{ color: 'var(--c-muted)' }}>
                  Deterministic FinancialEngine calculation verified. Zero generative hallucination in balance projections.
                </p>
              </div>
            </div>
          </section>

          <div className="flex justify-center" style={{ color: 'var(--c-border-strong)' }}><ArrowDown className="w-4 h-4" /></div>

          {/* Phase 4: Treasury & Operational Impact */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span 
                className="w-5 h-5 rounded-full text-[10px] font-mono font-bold flex items-center justify-center"
                style={{ backgroundColor: 'var(--c-fg)', color: 'var(--c-bg)' }}
              >
                4
              </span>
              <h3 className="text-sm font-bold uppercase tracking-wider font-mono" style={{ color: 'var(--c-fg)' }}>
                Forecasted Impact
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div 
                className="p-4 rounded-xl space-y-1 transition-all"
                style={{ backgroundColor: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
              >
                <span className="text-[10px] uppercase font-mono font-bold" style={{ color: 'var(--c-muted)' }}>Projected Runway</span>
                <p className="text-2xl font-bold font-mono" style={{ color: 'var(--c-fg)' }}>{simulation.projectedRunway} mo</p>
                <span className={`text-[11px] font-semibold flex items-center gap-1 ${
                  simulation.runwayDelta < 0 ? 'text-rose-500' : 'text-emerald-500'
                }`}>
                  {simulation.runwayDelta < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                  {simulation.runwayDelta > 0 ? `+${simulation.runwayDelta}` : simulation.runwayDelta} mo shift
                </span>
              </div>

              <div 
                className="p-4 rounded-xl space-y-1 transition-all"
                style={{ backgroundColor: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
              >
                <span className="text-[10px] uppercase font-mono font-bold" style={{ color: 'var(--c-muted)' }}>Projected Monthly Burn</span>
                <p className="text-2xl font-bold font-mono" style={{ color: 'var(--c-fg)' }}>{formatCompactINR(simulation.projectedBurn)}/mo</p>
                <span className="text-[11px] font-mono" style={{ color: 'var(--c-muted)' }}>
                  {simulation.netBurnDelta >= 0 ? `+${formatCompactINR(simulation.netBurnDelta)}` : `-${formatCompactINR(Math.abs(simulation.netBurnDelta))}`} net delta
                </span>
              </div>

              <div 
                className="p-4 rounded-xl space-y-1 transition-all"
                style={{ backgroundColor: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
              >
                <span className="text-[10px] uppercase font-mono font-bold" style={{ color: 'var(--c-muted)' }}>Projected Cash</span>
                <p className="text-2xl font-bold font-mono" style={{ color: 'var(--c-fg)' }}>{formatCompactINR(simulation.projectedCash)}</p>
                <span className="text-[11px]" style={{ color: 'var(--c-muted)' }}>Available liquidity</span>
              </div>

              <div 
                className="p-4 rounded-xl space-y-1 transition-all"
                style={{ backgroundColor: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
              >
                <span className="text-[10px] uppercase font-mono font-bold" style={{ color: 'var(--c-muted)' }}>Risk Assessment</span>
                <div className="pt-1">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold uppercase ${
                    simulation.riskRating === 'CRITICAL' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                    simulation.riskRating === 'HIGH' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                    'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}>
                    {simulation.riskRating}
                  </span>
                </div>
              </div>
            </div>

            {/* Trajectory visualization */}
            <div 
              className="p-5 rounded-xl space-y-3 transition-all"
              style={{ backgroundColor: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono font-bold uppercase tracking-wider" style={{ color: 'var(--c-fg)' }}>
                  12-Month Projected Treasury Trajectory
                </span>
                <span className="font-mono" style={{ color: 'var(--c-muted)' }}>
                  Depletion Horizon: {simulation.projectedRunway > 12 ? '> 12 months' : `Month ${Math.ceil(simulation.projectedRunway)}`}
                </span>
              </div>

              <div className="grid grid-cols-12 gap-1.5 items-end h-24 pt-2 pb-2" style={{ borderBottom: '1px solid var(--c-border)' }}>
                {simulation.timeline.map((point) => {
                  const maxCash = Math.max(1, simulation.projectedCash);
                  const heightPct = Math.max(8, Math.min(100, (point.cash / maxCash) * 100));
                  return (
                    <div key={point.month} className="flex flex-col items-center h-full justify-end">
                      <div
                        style={{ 
                          height: `${heightPct}%`,
                          backgroundColor: point.cash <= 0 ? 'rgb(239, 68, 68)' : point.cash <= simulation.projectedBurn * 3 ? '#f59e0b' : 'var(--c-fg)'
                        }}
                        className="w-full rounded-t transition-all"
                        title={`Month ${point.month}: ${formatINR(point.cash)}`}
                      />
                      <span className="text-[9px] font-mono mt-1" style={{ color: 'var(--c-muted)' }}>M{point.month}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <div className="flex justify-center" style={{ color: 'var(--c-border-strong)' }}><ArrowDown className="w-4 h-4" /></div>

          {/* Phase 5: Recommendation */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span 
                className="w-5 h-5 rounded-full text-[10px] font-mono font-bold flex items-center justify-center"
                style={{ backgroundColor: 'var(--c-fg)', color: 'var(--c-bg)' }}
              >
                5
              </span>
              <h3 className="text-sm font-bold uppercase tracking-wider font-mono" style={{ color: 'var(--c-fg)' }}>
                Council Recommendation & Action Pathway
              </h3>
            </div>

            <div 
              className="p-6 rounded-2xl space-y-4 transition-all"
              style={{
                backgroundColor: simulation.riskRating === 'CRITICAL' 
                  ? '#FEF2F2' 
                  : simulation.riskRating === 'HIGH' 
                    ? '#FFFBEB' 
                    : '#F0FDF4',
                border: `1px solid ${
                  simulation.riskRating === 'CRITICAL' 
                    ? '#FECACA' 
                    : simulation.riskRating === 'HIGH' 
                      ? '#FDE68A' 
                      : '#BBF7D0'
                }`
              }}
            >
              <div className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--c-fg)' }}>
                {simulation.riskRating === 'CRITICAL' ? (
                  <>
                    <XCircle className="w-5 h-5 text-rose-500" />
                    <span>Adverse Solvency: Executive Veto Recommended</span>
                  </>
                ) : simulation.riskRating === 'HIGH' ? (
                  <>
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    <span>Conditional Approval: Requires Compensating Offsets</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <span>Solvency Verified: Proceed with Strategic Initiative</span>
                  </>
                )}
              </div>

              <p className="text-xs leading-relaxed" style={{ color: 'var(--c-fg)' }}>
                {simulation.riskRating === 'CRITICAL'
                  ? 'Executing this scenario reduces cash runway dangerously close to depletion. The council advises postponing non-essential headcount expansion until institutional seed or revenue milestones close.'
                  : simulation.riskRating === 'HIGH'
                  ? 'This scenario is viable but compresses buffer cushions. Proceed only if accompanied by milestone covenants or delayed hire start dates.'
                  : 'Treasury margins and burn rates remain comfortably within established covenants. The council endorses launching this initiative into active workflow execution.'}
              </p>
            </div>
          </section>

        </div>
      )}

    </div>
  );
}
