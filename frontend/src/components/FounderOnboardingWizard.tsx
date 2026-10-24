import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Rocket, DollarSign, Users, Scale,
  ArrowRight, ArrowLeft, CheckCircle2,
  RefreshCw, Sparkles, ShieldCheck, Check
} from 'lucide-react';
import { User } from '../types';

interface FounderOnboardingWizardProps {
  user: User | null;
  onComplete: (payload: any) => Promise<void> | void;
  onCancel: () => void;
}

export type ImmediateObjective = 'launch' | 'finance' | 'hiring' | 'decision';
export type FundingStage = 'Pre-seed' | 'Seed' | 'Series A' | 'Bootstrapped';

export default function FounderOnboardingWizard({
  user,
  onComplete,
  onCancel,
}: FounderOnboardingWizardProps) {
  // ── Progressive Onboarding Stages ──
  // Stage 1: Immediate objective (Ask what needs attention, require only company name & stage)
  // Stage 2: Adaptive context collection (2-3 fields specific to the chosen priority)
  // Stage 3: Deliverable preview (Interactive preview of first generated output)
  // Stage 4: Workspace initialization (Smooth 4-step checklist loader)
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [checkmarkProgress, setCheckmarkProgress] = useState(0);

  // ── Stage 1: Immediate Objective Fields ──
  const [companyName, setCompanyName] = useState('');
  const [companyStage, setCompanyStage] = useState<FundingStage>('Pre-seed');
  const [objective, setObjective] = useState<ImmediateObjective>('launch');
  const [briefDescription, setBriefDescription] = useState('');

  // ── Stage 2: Adaptive Context Fields ──
  // 1. Launch readiness fields
  const [launchHorizon, setLaunchHorizon] = useState('In 30 Days');
  const [launchLead, setLaunchLead] = useState('Lead Integrations Engineer');
  const [blocker, setBlocker] = useState('Staging integration testing & regression suite incomplete');

  // 2. Cash & runway fields
  const [cashBalance, setCashBalance] = useState('7200000');
  const [monthlyBurn, setMonthlyBurn] = useState('800000');

  // 3. Hiring & team allocation fields
  const [hiringRole, setHiringRole] = useState('Senior Backend Engineer');
  const [hiringTimeline, setHiringTimeline] = useState('Immediate (30 Days)');
  const [hiringBudget, setHiringBudget] = useState('₹18L–₹24L / year');

  // 4. Strategic decision backlog fields
  const [decisionTopic, setDecisionTopic] = useState('Self-serve PLG rollout vs enterprise sales assisted onboarding');
  const [decisionOptions, setDecisionOptions] = useState('Option A: 14-day free trial tier; Option B: High-touch sales demo gate');
  const [decisionDeadline, setDecisionDeadline] = useState('In 14 Days');

  // Dynamic runway calculation
  const calculatedRunway = useMemo(() => {
    const cash = parseFloat(String(cashBalance).replace(/,/g, '')) || 0;
    const burn = parseFloat(String(monthlyBurn).replace(/,/g, '')) || 0;
    if (burn <= 0) return cash > 0 ? '99+' : '0';
    return (cash / burn).toFixed(1);
  }, [cashBalance, monthlyBurn]);

  // Validation
  const isNextDisabled = useMemo(() => {
    if (currentStep === 1) {
      return !companyName.trim();
    }
    if (currentStep === 2) {
      if (objective === 'launch') return !blocker.trim();
      if (objective === 'finance') return !cashBalance || !monthlyBurn;
      if (objective === 'hiring') return !hiringRole.trim();
      if (objective === 'decision') return !decisionTopic.trim();
    }
    return false;
  }, [currentStep, companyName, objective, blocker, cashBalance, monthlyBurn, hiringRole, decisionTopic]);

  // Final Submit & Workspace Transition
  const handleFinalSubmit = async () => {
    setCurrentStep(4);
    setCheckmarkProgress(0);

    for (let i = 1; i <= 4; i++) {
      await new Promise(resolve => setTimeout(resolve, 220));
      setCheckmarkProgress(i);
    }
    await new Promise(resolve => setTimeout(resolve, 200));

    // Construct unified payload compatible with backend workspaceService
    const numCash = objective === 'finance'
      ? (parseFloat(String(cashBalance).replace(/,/g, '')) || 7200000)
      : (companyStage === 'Pre-seed' || companyStage === 'Bootstrapped' ? 5000000 : 12000000);

    const numBurn = objective === 'finance'
      ? (parseFloat(String(monthlyBurn).replace(/,/g, '')) || 800000)
      : (companyStage === 'Pre-seed' || companyStage === 'Bootstrapped' ? 500000 : 1200000);

    const numRunway = numBurn > 0 ? parseFloat((numCash / numBurn).toFixed(1)) : 10;

    const objectiveLabels: Record<ImmediateObjective, string> = {
      launch: 'Prepare Product Launch',
      finance: 'Audit Cash Runway & SaaS Spend',
      hiring: `Make Key Hire: ${hiringRole}`,
      decision: `Resolve Strategic Decision: ${decisionTopic.slice(0, 45)}`,
    };

    const finalPayload = {
      path: 'existing',
      startupName: companyName.trim() || 'Catalyst Venture',
      industry: 'Technology / Software',
      stage: companyStage,
      fundingStage: companyStage,
      description: briefDescription.trim() || `${companyName} software workspace`,
      idea: briefDescription.trim() || `${companyName} core venture`,
      founderName: user?.name || 'Founder',
      founderRole: 'Founder & CEO',
      teamSize: '2–5 Members',
      primaryProduct: briefDescription.trim() || 'Core Product',
      targetIcp: 'Technology teams & software builders',
      newCustomers: 'Technology teams & software builders',
      problem: objective === 'launch' ? blocker.trim() :
               objective === 'finance' ? 'Cash runway governance' :
               objective === 'hiring' ? `Hiring pipeline for ${hiringRole}` :
               `Pending decision: ${decisionTopic.trim()}`,
      cashBalance: numCash,
      monthlyBurn: numBurn,
      budget: numCash,
      burnRate: numBurn,
      runway: `${numRunway} Months`,
      timeline: objective === 'launch' ? launchHorizon : '30 Days',
      goals: [objectiveLabels[objective]],
      priorities: [
        objective === 'launch' ? blocker.trim() :
        objective === 'finance' ? 'Treasury Runway Optimization' :
        objective === 'hiring' ? `Staffing: ${hiringRole}` :
        'Executive Decision Governance'
      ],
      biggestChallenge: objective === 'launch' ? blocker.trim() : 'Operational Delivery',
      additionalInfo: `Immediate Priority: ${objectiveLabels[objective]}. Context: ${
        objective === 'launch' ? `Owner: ${launchLead}, Horizon: ${launchHorizon}` :
        objective === 'finance' ? `Runway: ${numRunway} mo, Burn: ₹${numBurn.toLocaleString()}/mo` :
        objective === 'hiring' ? `Budget: ${hiringBudget}, Timeline: ${hiringTimeline}` :
        `Options: ${decisionOptions}, Deadline: ${decisionDeadline}`
      }`,
    };

    if (user?.id) {
      localStorage.setItem(`catalystos_onboarding_context_${user.id}`, JSON.stringify(finalPayload));
      localStorage.setItem(`catalystos_onboarding_completed_${user.id}`, 'true');
    }

    await onComplete(finalPayload);
  };

  // 1-Click Quick-Launch Demo (Pre-configured DataPulse Labs)
  const handleQuickLaunchDemo = async () => {
    setCurrentStep(4);
    setCheckmarkProgress(0);
    for (let i = 1; i <= 4; i++) {
      await new Promise(resolve => setTimeout(resolve, 150));
      setCheckmarkProgress(i);
    }
    await new Promise(resolve => setTimeout(resolve, 150));

    const demoPayload = {
      path: 'existing' as const,
      startupName: 'DataPulse Labs',
      industry: 'AI / Developer Tools',
      stage: 'Seed',
      fundingStage: 'Seed',
      description: 'Distributed API observability platform tracking staging regressions and team dependencies.',
      idea: 'Distributed API observability platform',
      founderName: user?.name && user.name !== 'Founder' ? user.name : 'Alex Rivera',
      founderRole: 'Founder & CEO',
      teamSize: '2–5 Members',
      primaryProduct: 'Observability & Integration Engine',
      targetIcp: 'Engineering Teams & B2B SaaS Builders',
      newCustomers: 'Engineering Teams & B2B SaaS Builders',
      problem: 'Staging integration testing incomplete and delayed before public launch announcement.',
      cashBalance: 7200000,
      monthlyBurn: 800000,
      budget: 7200000,
      burnRate: 800000,
      runway: '9.0 Months',
      timeline: '30 Days',
      goals: ['Prepare Product Launch and unblock staging dependencies'],
      priorities: ['Product Testing & Launch Readiness'],
      biggestChallenge: 'Product Testing & Launch Readiness',
      additionalInfo: 'Atlas (CEO) and Helix (Ops) prioritize unblocking the integration test suite and staging timeline sign-off.'
    };

    if (user?.id) {
      localStorage.setItem(`catalystos_onboarding_context_${user.id}`, JSON.stringify(demoPayload));
      localStorage.setItem(`catalystos_onboarding_completed_${user.id}`, 'true');
    }

    await onComplete(demoPayload);
  };

  const inputCls = "w-full bg-white border border-[#141413]/15 rounded-[12px] px-3.5 py-2.5 text-sm text-[#141413] placeholder-[#8E8D8A] focus:outline-none focus:border-[#141413] focus:ring-2 focus:ring-[#141413]/06 transition-all font-sans";
  const labelCls = "block text-[10px] uppercase tracking-widest text-[#666562] mb-1 font-bold font-mono";

  return (
    <div className="w-full max-w-xl bg-white border border-[#141413]/10 rounded-[32px] p-6 sm:p-8 md:p-10 shadow-[rgba(0,0,0,0.08)_0px_40px_80px] relative overflow-hidden">
      
      {/* ── Progressive Steps Header ── */}
      {currentStep <= 3 && (
        <div className="flex items-center justify-between border-b border-[#141413]/10 pb-3.5 mb-6">
          <div>
            <span className="text-[10px] font-mono font-bold text-[#666562] uppercase tracking-widest block">
              PROGRESSIVE ONBOARDING • STAGE {currentStep} OF 3
            </span>
            <span className="text-xs font-bold text-[#141413]">
              {currentStep === 1 && 'Establish Immediate Goal'}
              {currentStep === 2 && 'Gather Relevant Context'}
              {currentStep === 3 && 'Deliverable Preview & Confirmation'}
            </span>
          </div>

          <div className="flex gap-2.5 items-center">
            <button
              type="button"
              onClick={handleQuickLaunchDemo}
              className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 text-[10px] font-bold rounded-full transition-colors flex items-center gap-1 cursor-pointer font-sans"
              title="Load pre-configured launch scenario (DataPulse Labs)"
            >
              <Sparkles className="w-3 h-3 text-amber-600" />
              <span>Load Example</span>
            </button>
            <div className="flex gap-1.5 items-center">
              {[1, 2, 3].map((step) => (
                <div
                  key={step}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    step === currentStep 
                      ? 'w-7 bg-[#141413]' 
                      : step < currentStep 
                      ? 'w-2.5 bg-[#141413]/50' 
                      : 'w-2 bg-[#141413]/10'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Progressive Steps Content ── */}
      <AnimatePresence mode="wait">
        
        {/* ── STAGE 1: IMMEDIATE OBJECTIVE ── */}
        {currentStep === 1 && (
          <motion.div
            key="stage-1"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="space-y-5"
          >
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#141413] font-sans" style={{ letterSpacing: '-0.02em' }}>
                What is your most pressing priority right now?
              </h2>
              <p className="text-xs text-[#666562] font-sans mt-0.5">
                CatalystOS begins by organizing what needs attention today. Complete company parameters can be enriched later.
              </p>
            </div>

            {/* Company Name & Funding Stage */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className={labelCls}>Company / Project Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Acme HQ, DataPulse, NovaCloud..."
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    className={inputCls}
                    autoFocus
                  />
                </div>

                <div className="space-y-1">
                  <label className={labelCls}>Current Funding Stage</label>
                  <div className="grid grid-cols-4 gap-1">
                    {(['Pre-seed', 'Seed', 'Series A', 'Bootstrapped'] as FundingStage[]).map(stg => (
                      <button
                        key={stg}
                        type="button"
                        onClick={() => setCompanyStage(stg)}
                        className={`py-2 px-1 text-center rounded-[10px] border text-[11px] font-bold transition-all cursor-pointer font-sans truncate ${
                          companyStage === stg
                            ? 'bg-[#141413] border-[#141413] text-[#F3F0EE]'
                            : 'bg-[#F3F0EE] border-[#141413]/10 text-[#666562] hover:text-[#141413]'
                        }`}
                        title={stg}
                      >
                        {stg === 'Bootstrapped' ? 'Bootstr.' : stg}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Optional brief venture description */}
              <div className="space-y-1">
                <label className={labelCls}>What is your venture building? (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Distributed API observability platform for microservices"
                  value={briefDescription}
                  onChange={e => setBriefDescription(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            {/* 4 Objective Cards Matching Specifications */}
            <div className="space-y-2">
              <label className={labelCls}>Select Your Immediate Priority</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  {
                    key: 'launch',
                    label: 'Launch readiness',
                    sub: 'Ship product on time — blockers, dependencies & release timeline',
                    icon: Rocket
                  },
                  {
                    key: 'finance',
                    label: 'Cash & runway analysis',
                    sub: 'Extend runway & control burn — cash modeling & burn forecast',
                    icon: DollarSign
                  },
                  {
                    key: 'hiring',
                    label: 'Hiring & team allocation',
                    sub: 'Staff key roles — role scope, budget & hiring pipeline',
                    icon: Users
                  },
                  {
                    key: 'decision',
                    label: 'Strategic decision backlog',
                    sub: 'Unblock key decisions — trade-offs, options & execution deadline',
                    icon: Scale
                  },
                ].map(opt => {
                  const isSelected = objective === opt.key;
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setObjective(opt.key as ImmediateObjective)}
                      className={`p-3 rounded-[16px] border text-left transition-all cursor-pointer font-sans flex items-start gap-3 ${
                        isSelected
                          ? 'bg-[#141413] text-[#F3F0EE] border-[#141413] shadow-md ring-2 ring-[#141413]/10'
                          : 'bg-[#FCFBFA] border-[#141413]/10 text-[#666562] hover:border-[#141413]/30 hover:bg-white'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-[10px] flex items-center justify-center shrink-0 mt-0.5 ${
                        isSelected ? 'bg-white/20 text-[#F3F0EE]' : 'bg-[#F3F0EE] text-[#141413]'
                      }`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className={`text-xs font-bold leading-tight ${isSelected ? 'text-[#F3F0EE]' : 'text-[#141413]'}`}>{opt.label}</div>
                        <div className={`text-[10px] font-mono mt-0.5 leading-snug ${isSelected ? 'text-[#F3F0EE]/60' : 'text-[#666562]'}`}>{opt.sub}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── STAGE 2: ADAPTIVE CONTEXT COLLECTION (2-3 FIELDS SPECIFIC TO PRIORITY) ── */}
        {currentStep === 2 && (
          <motion.div
            key="stage-2"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.25 }}
            className="space-y-5"
          >
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#F3F0EE] border border-[#141413]/10 text-[10px] font-mono text-[#141413] font-bold mb-1.5">
                <span>PRIORITY:</span>
                <span className="uppercase text-amber-800 font-bold">
                  {objective === 'launch' ? 'Launch Readiness' :
                   objective === 'finance' ? 'Cash & Runway' :
                   objective === 'hiring' ? 'Hiring & Team' :
                   'Strategic Decision'}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#141413] font-sans" style={{ letterSpacing: '-0.02em' }}>
                {objective === 'launch' && 'Target Launch Date & Critical Blockers'}
                {objective === 'finance' && 'Current Cash Balance & Monthly Burn'}
                {objective === 'hiring' && 'Open Role, Timeline & Allocated Budget'}
                {objective === 'decision' && 'Pending Decision, Options & Deadline'}
              </h2>
              <p className="text-xs text-[#666562] font-sans">
                Only gathering the inputs necessary to coordinate this initial deliverable.
              </p>
            </div>

            {/* PRIORITY 1: LAUNCH READINESS */}
            {objective === 'launch' && (
              <div className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className={labelCls}>Target Launch Date / Horizon</label>
                    <div className="grid grid-cols-3 gap-1">
                      {['In 14 Days', 'In 30 Days', 'In 60 Days'].map(hz => (
                        <button
                          key={hz}
                          type="button"
                          onClick={() => setLaunchHorizon(hz)}
                          className={`py-2 px-1 text-center rounded-[10px] border text-[11px] font-bold transition-all cursor-pointer font-sans ${
                            launchHorizon === hz
                              ? 'bg-[#141413] border-[#141413] text-[#F3F0EE]'
                              : 'bg-[#F3F0EE] border-[#141413]/10 text-[#666562] hover:text-[#141413]'
                          }`}
                        >
                          {hz}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className={labelCls}>Primary Technical Owner</label>
                    <input
                      type="text"
                      placeholder="e.g. Vikram Malhotra · Lead Eng"
                      value={launchLead}
                      onChange={e => setLaunchLead(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className={labelCls}>Critical Blocker or Dependency *</label>
                    <div className="flex gap-1">
                      {['Testing incomplete', 'Staging regressions', 'Owner sign-off'].map(chip => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => setBlocker(chip)}
                          className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-[#F3F0EE] hover:bg-[#141413]/10 border border-[#141413]/10 text-[#141413] transition-colors cursor-pointer"
                        >
                          + {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    placeholder="e.g. Staging integration testing and end-to-end regression suite must complete before public launch"
                    value={blocker}
                    onChange={e => setBlocker(e.target.value)}
                    className={`${inputCls} min-h-[85px] resize-none`}
                  />
                </div>
              </div>
            )}

            {/* PRIORITY 2: CASH & RUNWAY ANALYSIS */}
            {objective === 'finance' && (
              <div className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className={labelCls}>Current Cash Balance (₹) *</label>
                    <input
                      type="text"
                      placeholder="e.g. 7200000"
                      value={cashBalance}
                      onChange={e => setCashBalance(e.target.value)}
                      className={inputCls}
                      autoFocus
                    />
                  </div>

                  <div className="space-y-1">
                    <label className={labelCls}>Monthly Burn Rate (₹) *</label>
                    <input
                      type="text"
                      placeholder="e.g. 800000"
                      value={monthlyBurn}
                      onChange={e => setMonthlyBurn(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>

                {/* Live Runway Preview Gauge */}
                <div className="p-3.5 rounded-[16px] bg-[#FCFBFA] border border-[#141413]/10 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-[#666562] block font-bold">Estimated Operational Runway</span>
                    <span className="text-xl font-black font-mono text-[#141413]">{calculatedRunway} Months</span>
                  </div>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                    parseFloat(calculatedRunway) >= 12
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {parseFloat(calculatedRunway) >= 12 ? 'RUNWAY HEALTHY (>12 mo)' : 'ATTENTION REQUIRED (<12 mo)'}
                  </span>
                </div>
              </div>
            )}

            {/* PRIORITY 3: HIRING & TEAM ALLOCATION */}
            {objective === 'hiring' && (
              <div className="space-y-3.5">
                <div className="space-y-1">
                  <label className={labelCls}>Open Role to Fill *</label>
                  <input
                    type="text"
                    placeholder="e.g. Senior Backend Engineer (Distributed Systems)"
                    value={hiringRole}
                    onChange={e => setHiringRole(e.target.value)}
                    className={inputCls}
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className={labelCls}>Allocated Budget / Compensation Ceiling</label>
                    <input
                      type="text"
                      placeholder="e.g. ₹18L–₹24L / year or $120k"
                      value={hiringBudget}
                      onChange={e => setHiringBudget(e.target.value)}
                      className={inputCls}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className={labelCls}>Hiring Timeline</label>
                    <input
                      type="text"
                      placeholder="e.g. Immediate (30 Days)"
                      value={hiringTimeline}
                      onChange={e => setHiringTimeline(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* PRIORITY 4: STRATEGIC DECISION BACKLOG */}
            {objective === 'decision' && (
              <div className="space-y-3.5">
                <div className="space-y-1">
                  <label className={labelCls}>Pending Strategic Decision *</label>
                  <input
                    type="text"
                    placeholder="e.g. Self-serve PLG rollout vs enterprise sales assisted onboarding"
                    value={decisionTopic}
                    onChange={e => setDecisionTopic(e.target.value)}
                    className={inputCls}
                    autoFocus
                  />
                </div>

                <div className="space-y-1">
                  <label className={labelCls}>Options Under Consideration</label>
                  <textarea
                    placeholder="e.g. Option A: 14-day self-serve trial tier; Option B: Demo request gate with sales qualification"
                    value={decisionOptions}
                    onChange={e => setDecisionOptions(e.target.value)}
                    className={`${inputCls} min-h-[75px] resize-none`}
                  />
                </div>

                <div className="space-y-1">
                  <label className={labelCls}>Decision Deadline</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {['In 7 Days', 'In 14 Days', 'End of Month'].map(dl => (
                      <button
                        key={dl}
                        type="button"
                        onClick={() => setDecisionDeadline(dl)}
                        className={`py-2 px-1 text-center rounded-[10px] border text-[11px] font-bold transition-all cursor-pointer font-sans ${
                          decisionDeadline === dl
                            ? 'bg-[#141413] border-[#141413] text-[#F3F0EE]'
                            : 'bg-[#F3F0EE] border-[#141413]/10 text-[#666562] hover:text-[#141413]'
                        }`}
                      >
                        {dl}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── STAGE 3: DELIVERABLE PREVIEW (THE "AHA!" MOMENT) ── */}
        {currentStep === 3 && (
          <motion.div
            key="stage-3"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-mono text-emerald-800 font-bold mb-1">
                <Check className="w-3 h-3 text-emerald-700" />
                <span>FIRST DELIVERABLE SYNTHESIZED</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#141413] font-sans" style={{ letterSpacing: '-0.02em' }}>
                Your First Actionable Deliverable is Ready
              </h2>
              <p className="text-xs text-[#666562] font-sans">
                Atlas (CEO) and your executive council generated this output from your inputs.
              </p>
            </div>

            {/* Generated Deliverable Card Tailored to Chosen Objective */}
            <div className="p-4 rounded-[18px] bg-[#FCFBFA] border border-[#141413]/10 space-y-3">
              
              {/* Header of Deliverable */}
              <div className="flex items-center justify-between border-b border-[#141413]/08 pb-2">
                <div>
                  <span className="text-[10px] font-mono text-[#666562] uppercase font-bold block">
                    {objective === 'launch' && 'Deliverable: Launch Countdown & Blocker Checklist'}
                    {objective === 'finance' && 'Deliverable: Runway Forecast & Burn Projection'}
                    {objective === 'hiring' && 'Deliverable: Headcount Requisition & Evaluation Rubric'}
                    {objective === 'decision' && 'Deliverable: Strategic Decision Memo Draft'}
                  </span>
                  <span className="text-sm font-bold text-[#141413] font-sans">
                    {objective === 'launch' && `${companyName || 'Venture'} Launch Readiness Sprint`}
                    {objective === 'finance' && `Treasury Health & Capital Allocation Model`}
                    {objective === 'hiring' && `Requisition Profile: ${hiringRole}`}
                    {objective === 'decision' && `Decision Memo: ${decisionTopic.slice(0, 40)}`}
                  </span>
                </div>
                <span className="text-[9px] font-mono font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  STAGE 1 INITIALIZED
                </span>
              </div>

              {/* SPECIFIC DELIVERABLE VIEW 1: LAUNCH READINESS */}
              {objective === 'launch' && (
                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-[12px] bg-rose-50/60 border border-rose-200/60 flex items-start justify-between">
                    <div>
                      <div className="font-bold text-rose-900 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-600 inline-block animate-pulse" />
                        Critical Dependency: {blocker}
                      </div>
                      <div className="text-[11px] text-rose-700 mt-0.5">
                        Assigned Owner: <span className="font-semibold">{launchLead}</span> · Target Horizon: {launchHorizon}
                      </div>
                    </div>
                    <span className="text-[9px] font-mono font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-full">
                      AT RISK
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono text-[#666562] uppercase font-bold block">Council Milestones</span>
                    <div className="p-2.5 rounded-[10px] bg-white border border-[#141413]/08 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-[#141413]">Execute integration regression test suite &amp; verify staging build</div>
                        <div className="text-[10px] font-mono text-[#666562]">Helix · VP Operations &amp; {launchLead}</div>
                      </div>
                      <span className="text-[9px] font-mono font-bold text-[#141413] bg-[#F3F0EE] px-1.5 py-0.5 rounded-md">Immediate</span>
                    </div>
                    <div className="p-2.5 rounded-[10px] bg-white border border-[#141413]/08 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-[#141413]">Launch readiness audit &amp; staging gate sign-off</div>
                        <div className="text-[10px] font-mono text-[#666562]">Sentry · Compliance Auditor</div>
                      </div>
                      <span className="text-[9px] font-mono font-bold text-[#141413] bg-[#F3F0EE] px-1.5 py-0.5 rounded-md">T-7 Days</span>
                    </div>
                  </div>
                </div>
              )}

              {/* SPECIFIC DELIVERABLE VIEW 2: CASH & RUNWAY */}
              {objective === 'finance' && (
                <div className="space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 rounded-[12px] bg-white border border-[#141413]/08">
                      <span className="text-[10px] font-mono text-[#666562] block">Current Reserves</span>
                      <span className="text-base font-bold font-mono text-[#141413]">
                        ₹{parseFloat(String(cashBalance).replace(/,/g, '') || '0').toLocaleString()}
                      </span>
                    </div>
                    <div className="p-3 rounded-[12px] bg-white border border-[#141413]/08">
                      <span className="text-[10px] font-mono text-[#666562] block">Monthly Burn</span>
                      <span className="text-base font-bold font-mono text-[#141413]">
                        ₹{parseFloat(String(monthlyBurn).replace(/,/g, '') || '0').toLocaleString()}/mo
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono text-[#666562] uppercase font-bold block">Council Actions</span>
                    <div className="p-2.5 rounded-[10px] bg-white border border-[#141413]/08 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-[#141413]">Audit cloud and recurring SaaS spend to extend runway by +1.8 mo</div>
                        <div className="text-[10px] font-mono text-[#666562]">Aura · Chief Financial Officer</div>
                      </div>
                      <span className="text-[9px] font-mono font-bold text-[#141413] bg-[#F3F0EE] px-1.5 py-0.5 rounded-md">Immediate</span>
                    </div>
                  </div>
                </div>
              )}

              {/* SPECIFIC DELIVERABLE VIEW 3: HIRING */}
              {objective === 'hiring' && (
                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-[12px] bg-white border border-[#141413]/08 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-[#141413]">{hiringRole}</div>
                      <div className="text-[11px] text-[#666562]">Timeline: {hiringTimeline} · Budget: {hiringBudget}</div>
                    </div>
                    <span className="text-[9px] font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      REQUISITION DRAFTED
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono text-[#666562] uppercase font-bold block">Screening Rubric</span>
                    <div className="p-2.5 rounded-[10px] bg-white border border-[#141413]/08 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-[#141413]">Technical screening rubric and take-home benchmark challenge</div>
                        <div className="text-[10px] font-mono text-[#666562]">Echo · Head of People &amp; Talent</div>
                      </div>
                      <span className="text-[9px] font-mono font-bold text-[#141413] bg-[#F3F0EE] px-1.5 py-0.5 rounded-md">Ready</span>
                    </div>
                  </div>
                </div>
              )}

              {/* SPECIFIC DELIVERABLE VIEW 4: STRATEGIC DECISION */}
              {objective === 'decision' && (
                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-[12px] bg-white border border-[#141413]/08">
                    <span className="text-[10px] font-mono text-[#666562] block">Decision Topic</span>
                    <div className="font-bold text-[#141413]">{decisionTopic}</div>
                    <div className="text-[11px] text-[#666562] mt-1">Options: {decisionOptions}</div>
                    <div className="text-[10px] font-mono text-amber-800 mt-1">Target Decision Gate: {decisionDeadline}</div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono text-[#666562] uppercase font-bold block">Synthesized Executive Memo</span>
                    <div className="p-2.5 rounded-[10px] bg-white border border-[#141413]/08 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-[#141413]">Trade-off analysis &amp; CAC/LTV projection memo</div>
                        <div className="text-[10px] font-mono text-[#666562]">Atlas (CEO) &amp; Nexus (Legal)</div>
                      </div>
                      <span className="text-[9px] font-mono font-bold text-[#141413] bg-[#F3F0EE] px-1.5 py-0.5 rounded-md">Draft Ready</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Staged in Approvals Callout */}
              <div className="p-3 rounded-[12px] bg-[#F3F0EE] border border-[#141413]/10 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#141413]" />
                  <div>
                    <span className="font-bold text-[#141413] block">Staged in Approvals Queue</span>
                    <span className="text-[10px] text-[#666562]">1 action awaiting founder review before execution</span>
                  </div>
                </div>
                <span className="text-[9px] font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                  READY
                </span>
              </div>
            </div>

            <p className="text-[11px] font-mono text-[#666562] text-center">
              Additional company parameters can be enriched anytime in your workspace.
            </p>
          </motion.div>
        )}

        {/* ── STAGE 4: CHECKLIST INITIALIZATION LOADER ── */}
        {currentStep === 4 && (
          <motion.div
            key="stage-4"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="py-6 text-center space-y-6"
          >
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-[#141413] font-sans" style={{ letterSpacing: '-0.02em' }}>
                Launching Your Workspace
              </h2>
              <p className="text-xs text-[#666562] font-sans">
                Calibrating your autonomous executive council around your immediate priority.
              </p>
            </div>

            <div className="space-y-2.5 max-w-sm mx-auto text-left">
              {[
                { label: 'Grounding executive council around your priority...', step: 1 },
                { label: 'Generating first 30-day execution deliverable...', step: 2 },
                { label: 'Staging initial deliverable in your Approvals Queue...', step: 3 },
                { label: 'Opening your CatalystOS founder workspace...', step: 4 },
              ].map((item) => (
                <div
                  key={item.step}
                  className={`flex items-center gap-3 p-3 rounded-[14px] border transition-all duration-300 font-sans ${
                    checkmarkProgress >= item.step
                      ? 'bg-[#141413] border-[#141413] text-[#F3F0EE] shadow-sm'
                      : checkmarkProgress === item.step - 1
                      ? 'bg-[#F3F0EE] border-[#141413]/15 text-[#666562]'
                      : 'bg-white border-[#141413]/05 text-[#141413]/20'
                  }`}
                >
                  {checkmarkProgress >= item.step ? (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="shrink-0">
                      <CheckCircle2 className="w-4 h-4 text-[#F3F0EE]" />
                    </motion.div>
                  ) : checkmarkProgress === item.step - 1 ? (
                    <RefreshCw className="w-3.5 h-3.5 text-[#666562] animate-spin shrink-0" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border border-[#141413]/10 shrink-0" />
                  )}
                  <span className="text-xs font-semibold">{item.label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Navigation Footer ── */}
      {currentStep <= 3 && (
        <div className="flex items-center justify-between border-t border-[#141413]/10 pt-4 mt-6">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep(prev => prev - 1)}
              className="flex items-center gap-1 text-xs text-[#666562] hover:text-[#141413] transition-colors cursor-pointer font-sans"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
          ) : (
            <button
              type="button"
              onClick={onCancel}
              className="flex items-center gap-1 text-xs text-[#666562] hover:text-[#141413] transition-colors cursor-pointer font-sans"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Exit
            </button>
          )}

          {currentStep < 3 ? (
            <button
              type="button"
              onClick={() => setCurrentStep(prev => prev + 1)}
              disabled={isNextDisabled}
              className="flex items-center gap-1.5 px-6 py-2.5 bg-[#141413] hover:bg-[#262627] text-[#F3F0EE] text-xs font-bold transition-all rounded-[20px] disabled:opacity-40 cursor-pointer font-sans"
            >
              <span>Continue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinalSubmit}
              className="flex items-center gap-1.5 px-6 py-2.5 bg-[#141413] hover:bg-[#262627] text-[#F3F0EE] text-xs font-bold transition-all rounded-[20px] cursor-pointer font-sans shadow-md"
            >
              <span>Enter Workspace &amp; Review Deliverable</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
