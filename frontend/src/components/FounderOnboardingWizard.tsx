import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Users, Rocket, Target, DollarSign,
  BarChart3, Flag, ArrowRight, ArrowLeft, CheckCircle2,
  RefreshCw, Sparkles
} from 'lucide-react';
import CatalystLogo from './CatalystLogo';
import { User } from '../types';

interface FounderOnboardingWizardProps {
  user: User | null;
  onComplete: (payload: any) => Promise<void> | void;
  onCancel: () => void;
}

export default function FounderOnboardingWizard({
  user,
  onComplete,
  onCancel,
}: FounderOnboardingWizardProps) {
  // Pathway: 'existing' = Operating Startup, 'new' = New Startup Idea
  const [onboardingPath, setOnboardingPath] = useState<'existing' | 'new'>('existing');

  // Current Step: 0 = Pathway Selection, 1 = Company/Idea, 2 = Founder, 3 = Business/Problem, 4 = Financial, 5 = Goals, 6 = Checklist
  const [currentStep, setCurrentStep] = useState(0);
  const [checkmarkProgress, setCheckmarkProgress] = useState(0);

  // 1. Company / Idea Information
  const [companyName, setCompanyName] = useState('');
  const [companyIndustry, setCompanyIndustry] = useState('SaaS');
  const [companyStage, setCompanyStage] = useState('Seed');
  const [companyDescription, setCompanyDescription] = useState('');

  // 2. Founder Information
  const [founderName, setFounderName] = useState(user?.name || '');
  const [founderRole, setFounderRole] = useState('Founder & CEO');
  const [teamSize, setTeamSize] = useState('Solo Founder');

  useEffect(() => {
    if (user?.name && !founderName) {
      setFounderName(user.name);
    }
  }, [user, founderName]);

  // 3. Business / Product Information
  const [primaryProduct, setPrimaryProduct] = useState('');
  const [targetIcp, setTargetIcp] = useState('');
  const [coreProblem, setCoreProblem] = useState('');

  // 4. Financial Baseline
  const [cashBalance, setCashBalance] = useState('250000');
  const [monthlyBurn, setMonthlyBurn] = useState('15000');

  // 5. Goals & Priorities
  const [milestoneGoal, setMilestoneGoal] = useState('Scale customer acquisition and secure next funding round');
  const [biggestChallenge, setBiggestChallenge] = useState('Finding Customers / GTM');
  const [additionalNotes, setAdditionalNotes] = useState('');

  const handleSelectPath = (path: 'existing' | 'new') => {
    setOnboardingPath(path);
    if (path === 'new') {
      setCompanyStage('Idea');
      setCashBalance('50000');
      setMonthlyBurn('5000');
      setMilestoneGoal('Validate concept with 10 design partners and launch MVP');
    } else {
      setCompanyStage('Seed');
      setCashBalance('250000');
      setMonthlyBurn('15000');
      setMilestoneGoal('Scale customer acquisition and secure next funding round');
    }
  };

  const calculatedRunway = useMemo(() => {
    const cash = parseFloat(String(cashBalance).replace(/,/g, '')) || 0;
    const burn = parseFloat(String(monthlyBurn).replace(/,/g, '')) || 0;
    if (burn <= 0) return cash > 0 ? '99+' : '0';
    return (cash / burn).toFixed(1);
  }, [cashBalance, monthlyBurn]);

  const isNextDisabled = useMemo(() => {
    if (currentStep === 1 && (!companyName.trim() || !companyDescription.trim())) return true;
    if (currentStep === 2 && !founderName.trim()) return true;
    if (currentStep === 3 && (!targetIcp.trim() || !primaryProduct.trim())) return true;
    if (currentStep === 4 && (!cashBalance || !monthlyBurn)) return true;
    if (currentStep === 5 && !milestoneGoal.trim()) return true;
    return false;
  }, [currentStep, companyName, companyDescription, founderName, targetIcp, primaryProduct, cashBalance, monthlyBurn, milestoneGoal]);

  const runChecklistAnimation = async () => {
    setCheckmarkProgress(0);
    for (let i = 1; i <= 4; i++) {
      await new Promise(resolve => setTimeout(resolve, 200));
      setCheckmarkProgress(i);
    }
    await new Promise(resolve => setTimeout(resolve, 200));

    const numCash = parseFloat(String(cashBalance).replace(/,/g, '')) || (onboardingPath === 'new' ? 50000 : 250000);
    const numBurn = parseFloat(String(monthlyBurn).replace(/,/g, '')) || (onboardingPath === 'new' ? 5000 : 15000);
    const numRunway = numBurn > 0 ? parseFloat((numCash / numBurn).toFixed(1)) : 999;

    const finalPayload = {
      path: onboardingPath,
      startupName: companyName.trim() || (onboardingPath === 'new' ? 'New Venture Project' : 'Catalyst Venture'),
      industry: companyIndustry,
      stage: companyStage,
      fundingStage: companyStage,
      description: companyDescription.trim() || `${companyName} software solution`,
      idea: companyDescription.trim(),
      founderName: founderName.trim() || user?.name || 'Founder',
      founderRole,
      teamSize,
      primaryProduct: primaryProduct.trim() || companyDescription.trim() || 'Core Platform',
      targetIcp: targetIcp.trim() || (onboardingPath === 'new' ? 'Early adopters' : `${companyIndustry} clients`),
      newCustomers: targetIcp.trim(),
      problem: coreProblem.trim() || 'Market workflow inefficiency',
      cashBalance: numCash,
      monthlyBurn: numBurn,
      budget: numCash,
      burnRate: numBurn,
      runway: `${numRunway} Months`,
      timeline: onboardingPath === 'new' ? '30 Days' : '90 Days',
      goals: [milestoneGoal.trim() || (onboardingPath === 'new' ? 'Launch MVP' : 'Scale ARR')],
      priorities: [biggestChallenge],
      biggestChallenge,
      additionalInfo: additionalNotes.trim()
    };

    if (user?.id) {
      localStorage.setItem(`catalystos_onboarding_context_${user.id}`, JSON.stringify(finalPayload));
    }

    await onComplete(finalPayload);
  };

  const handleQuickLaunchDemo = async () => {
    setCurrentStep(6);
    setCheckmarkProgress(0);
    for (let i = 1; i <= 4; i++) {
      await new Promise(resolve => setTimeout(resolve, 150));
      setCheckmarkProgress(i);
    }
    await new Promise(resolve => setTimeout(resolve, 150));

    const demoPayload = {
      path: 'existing' as const,
      startupName: 'Cyberdyne Systems',
      industry: 'AI / Developer Tools',
      stage: 'Seed',
      fundingStage: 'Seed',
      description: 'Autonomous multi-agent developer infrastructure that validates, tests, and deploys mission-critical microservices with zero downtime and strict compliance boundaries.',
      idea: 'Autonomous multi-agent developer infrastructure',
      founderName: user?.name && user.name !== 'Founder' ? user.name : 'Alex Rivera',
      founderRole: 'Founder & CEO',
      teamSize: '2–5 Members',
      primaryProduct: 'Autonomous Infrastructure Orchestration Engine',
      targetIcp: 'Enterprise Series A–C VP of Engineering & DevOps Directors',
      newCustomers: 'Enterprise Series A–C VP of Engineering & DevOps Directors',
      problem: 'Engineering teams waste 35% of sprint cycles manually writing, debugging, and auditing deployment pipelines instead of shipping revenue-generating features.',
      cashBalance: 7200000,
      monthlyBurn: 800000,
      budget: 7200000,
      burnRate: 800000,
      runway: '9.0 Months',
      timeline: '90 Days',
      goals: ['Launch Enterprise Beta with 5 design partners and reach ₹15,00,000 MRR'],
      priorities: ['Finding Customers / GTM'],
      biggestChallenge: 'Finding Customers / GTM',
      additionalInfo: 'Atlas (CEO) and Aura (CFO) should prioritize preserving at least 14 months of runway while Vector (Growth) runs targeted outbound pilots.'
    };

    if (user?.id) {
      localStorage.setItem(`catalystos_onboarding_context_${user.id}`, JSON.stringify(demoPayload));
      localStorage.setItem(`catalystos_onboarding_completed_${user.id}`, 'true');
    }

    await onComplete(demoPayload);
  };

  const handleNext = () => {
    if (currentStep < 5) {
      setCurrentStep(prev => prev + 1);
    } else {
      setCurrentStep(6);
      runChecklistAnimation();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const inputCls = "w-full bg-white border border-[#141413]/15 rounded-[12px] px-3.5 py-2.5 text-sm text-[#141413] placeholder-[#696969] focus:outline-none focus:border-[#141413] focus:ring-2 focus:ring-[#141413]/06 transition-all font-sans";
  const labelCls = "block text-[10px] uppercase tracking-widest text-[#696969] mb-1.5 font-bold font-mono";

  return (
    <div className="w-full max-w-xl bg-white border border-[#141413]/10 rounded-[32px] p-8 md:p-10 shadow-[rgba(0,0,0,0.08)_0px_40px_80px] relative overflow-hidden">
      
      {/* Step Progress Header */}
      {currentStep > 0 && currentStep <= 5 && (
        <div className="flex items-center justify-between border-b border-[#141413]/10 pb-3.5 mb-6">
          <div>
            <span className="text-[10px] font-mono font-bold text-[#696969] uppercase tracking-widest block">
              {onboardingPath === 'existing' ? 'Operating Company' : 'Zero-to-One Idea'} • Phase {currentStep} of 5
            </span>
            <span className="text-xs font-bold text-[#141413]">
              {currentStep === 1 && (onboardingPath === 'existing' ? 'Company Information' : 'Venture Idea & Concept')}
              {currentStep === 2 && (onboardingPath === 'existing' ? 'Founder & Leadership' : 'Founder & Team Setup')}
              {currentStep === 3 && (onboardingPath === 'existing' ? 'Market & Target ICP' : 'Problem & Early Customers')}
              {currentStep === 4 && (onboardingPath === 'existing' ? 'Financial Baseline & Burn' : 'Initial Budget & Runway')}
              {currentStep === 5 && (onboardingPath === 'existing' ? '90-Day Strategic Priorities' : 'First 30-Day Launch Milestone')}
            </span>
          </div>
          <div className="flex gap-2.5 items-center">
            <button
              type="button"
              onClick={handleQuickLaunchDemo}
              className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 text-[10px] font-bold rounded-full transition-colors flex items-center gap-1 cursor-pointer font-sans"
              title="Skip wizard and launch pre-configured example startup (Cyberdyne Systems)"
            >
              <Sparkles className="w-3 h-3 text-amber-600" />
              <span>Load Example</span>
            </button>
            <div className="flex gap-1.5 items-center">
              {Array.from({ length: 5 }).map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx + 1 === currentStep 
                      ? 'w-7 bg-[#141413]' 
                      : idx + 1 < currentStep 
                      ? 'w-2.5 bg-[#141413]/50' 
                      : 'w-2 bg-[#141413]/10'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Questionnaire Content Panels */}
      <AnimatePresence mode="wait">
        
        {/* ── Step 0: Welcome Screen with Existing vs New Startup Pathway Selection ── */}
        {currentStep === 0 && (
          <motion.div
            key="step-welcome"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="space-y-6 relative"
          >
            <button
              onClick={onCancel}
              className="absolute -top-2 -left-2 p-2 text-[#696969] hover:text-[#141413] hover:bg-[#F3F0EE] rounded-full transition-colors flex items-center justify-center cursor-pointer"
              title="Cancel & Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            
            <div className="space-y-2 text-center pt-1">
              <div className="w-12 h-12 rounded-2xl bg-[#F3F0EE] border border-[#141413]/10 flex items-center justify-center mx-auto mb-2 shadow-xs">
                <CatalystLogo className="w-6 h-6 text-[#141413]" />
              </div>
              <h2 className="text-2xl font-bold text-[#141413] font-sans" style={{ letterSpacing: '-0.02em' }}>
                Welcome to CatalystOS
              </h2>
              <p className="text-xs text-[#696969] leading-relaxed max-w-md mx-auto font-sans">
                Select your startup pathway. CatalystOS calibrates your autonomous executive council to your venture's exact operational stage.
              </p>
            </div>

            <div className="space-y-3">
              <span className="text-[10px] uppercase font-mono tracking-widest text-[#696969] font-bold block text-center">
                Select Your Venture Pathway
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Pathway 1: Existing Startup */}
                <div
                  onClick={() => handleSelectPath('existing')}
                  className={`p-4 rounded-[20px] border cursor-pointer transition-all ${
                    onboardingPath === 'existing'
                      ? 'bg-white border-[#141413] shadow-[rgba(0,0,0,0.08)_0px_8px_24px] ring-2 ring-[#141413]/10'
                      : 'bg-[#F3F0EE]/60 border-[#141413]/10 hover:border-[#141413]/30 hover:bg-white/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#141413] text-[#F3F0EE] flex items-center justify-center">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      OPERATING
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-[#141413] mb-1 font-sans">Existing Startup</h3>
                  <p className="text-[11px] text-[#696969] leading-relaxed font-sans">
                    Active operating company with current cash reserves, team structure, monthly burn rate, and defined ICP.
                  </p>
                </div>

                {/* Pathway 2: New Startup Idea */}
                <div
                  onClick={() => handleSelectPath('new')}
                  className={`p-4 rounded-[20px] border cursor-pointer transition-all ${
                    onboardingPath === 'new'
                      ? 'bg-white border-[#141413] shadow-[rgba(0,0,0,0.08)_0px_8px_24px] ring-2 ring-[#141413]/10'
                      : 'bg-[#F3F0EE]/60 border-[#141413]/10 hover:border-[#141413]/30 hover:bg-white/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#141413] text-[#F3F0EE] flex items-center justify-center">
                      <Rocket className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                      ZERO-TO-ONE
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-[#141413] mb-1 font-sans">New Startup Idea</h3>
                  <p className="text-[11px] text-[#696969] leading-relaxed font-sans">
                    Starting a new venture from scratch. Define the problem hypothesis, early adopters, initial budget, and MVP goals.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleNext}
                className="w-full py-3.5 px-6 bg-[#141413] hover:bg-[#262627] text-[#F3F0EE] font-bold text-xs rounded-[20px] transition-all flex items-center justify-center gap-2 shadow-[rgba(0,0,0,0.15)_0px_4px_12px] cursor-pointer mt-2"
              >
                <span>Continue as {onboardingPath === 'existing' ? 'Existing Startup' : 'New Startup Idea'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="relative py-1 my-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#141413]/10" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-widest text-[#696969]">
                  <span className="bg-white px-2">Or Direct Demo Access</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleQuickLaunchDemo}
                className="w-full py-3 px-6 bg-gradient-to-r from-amber-500/10 via-orange-500/15 to-amber-500/10 hover:from-amber-500/20 hover:to-orange-500/25 border border-amber-500/30 hover:border-amber-500/60 text-amber-950 font-bold text-xs rounded-[20px] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs font-sans group"
              >
                <Sparkles className="w-4 h-4 text-amber-600 group-hover:scale-110 transition-transform" />
                <span>⚡ Quick-Launch Example Startup (Cyberdyne Systems — 1 Click)</span>
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Step 1: Company Information ── */}
        {currentStep === 1 && (
          <motion.div
            key="step-company"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#141413] font-sans flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#141413]/60" />
                {onboardingPath === 'existing' ? 'Company / Startup Name' : 'Project / Startup Name'}
              </label>
              <input
                type="text"
                placeholder={onboardingPath === 'existing' ? 'e.g. Acme AI, Cyberdyne Systems, PulseHQ...' : 'e.g. NovaCloud, Orbit, Apex AI...'}
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                className={inputCls}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className={labelCls}>Industry Sector</label>
                <select
                  value={companyIndustry}
                  onChange={e => setCompanyIndustry(e.target.value)}
                  className={inputCls}
                >
                  {['SaaS', 'AI / Developer Tools', 'FinTech', 'Healthcare', 'E-commerce', 'EdTech', 'Security', 'Other'].map(ind => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className={labelCls}>Stage</label>
                <select
                  value={companyStage}
                  onChange={e => setCompanyStage(e.target.value)}
                  className={inputCls}
                >
                  {(onboardingPath === 'existing'
                    ? ['Pre-Seed', 'Seed', 'Series A', 'Series B', 'Bootstrapped', 'Profitable']
                    : ['Idea', 'Concept Validation', 'Building MVP', 'Pre-Launch Beta']
                  ).map(stg => (
                    <option key={stg} value={stg}>{stg}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#141413] font-sans">
                {onboardingPath === 'existing' ? 'What does your operating company do?' : 'What is your startup idea?'}
              </label>
              <textarea
                placeholder={onboardingPath === 'existing' ? 'Describe your product, core proposition, or company mission...' : 'Describe your vision, core hypothesis, and what problem you aim to solve...'}
                value={companyDescription}
                onChange={e => setCompanyDescription(e.target.value)}
                className={`${inputCls} min-h-[110px] resize-none`}
              />
            </div>
          </motion.div>
        )}

        {/* ── Step 2: Founder Information ── */}
        {currentStep === 2 && (
          <motion.div
            key="step-founder"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#141413] font-sans flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#141413]/60" />
                Founder / Executive Full Name
              </label>
              <input
                type="text"
                placeholder="e.g. Alex Rivera"
                value={founderName}
                onChange={e => setFounderName(e.target.value)}
                className={inputCls}
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <label className={labelCls}>Founder Role / Title</label>
              <select
                value={founderRole}
                onChange={e => setFounderRole(e.target.value)}
                className={inputCls}
              >
                {['Founder & CEO', 'Co-Founder', 'Technical Founder / CTO', 'Head of Product', 'Executive'].map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2 pt-1">
              <label className="text-xs font-bold text-[#141413] font-sans">
                {onboardingPath === 'existing' ? 'Current Team Scale' : 'Team / Founding Setup'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(onboardingPath === 'existing'
                  ? ['Solo Founder', '2–5 Members', '6–15 Members', '15+ Members']
                  : ['Solo Founder', '2 Co-Founders', 'Small Founding Team', 'Advisors Only']
                ).map(ts => (
                  <button
                    key={ts}
                    type="button"
                    onClick={() => setTeamSize(ts)}
                    className={`p-3 rounded-[14px] border text-xs font-bold transition-all cursor-pointer font-sans text-center ${
                      teamSize === ts
                        ? 'bg-[#141413] border-[#141413] text-[#F3F0EE]'
                        : 'bg-[#F3F0EE] border-[#141413]/10 hover:border-[#141413]/30 hover:bg-white text-[#141413]'
                    }`}
                  >
                    {ts}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Step 3: Business Information ── */}
        {currentStep === 3 && (
          <motion.div
            key="step-business"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#141413] font-sans flex items-center gap-1.5">
                <Rocket className="w-3.5 h-3.5 text-[#141413]/60" />
                {onboardingPath === 'existing' ? 'Primary Product Offering' : 'Proposed Product / MVP Concept'}
              </label>
              <input
                type="text"
                placeholder={onboardingPath === 'existing' ? 'e.g. AI-powered workflow automation platform' : 'e.g. Automated documentation & developer tools platform'}
                value={primaryProduct}
                onChange={e => setPrimaryProduct(e.target.value)}
                className={inputCls}
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#141413] font-sans flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-[#141413]/60" />
                {onboardingPath === 'existing' ? 'Target Ideal Customer Profile (ICP)' : 'First Target Audience / Early Adopters'}
              </label>
              <input
                type="text"
                placeholder={onboardingPath === 'existing' ? 'e.g. B2B SaaS engineering managers, Seed-stage founders' : 'e.g. Indie developers, early-stage design agencies, growth teams'}
                value={targetIcp}
                onChange={e => setTargetIcp(e.target.value)}
                className={inputCls}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#141413] font-sans">
                {onboardingPath === 'existing' ? 'Core Market Problem Solved' : 'Customer Problem or Friction Being Solved'}
              </label>
              <textarea
                placeholder={onboardingPath === 'existing' ? 'What specific friction, cost, or operational inefficiency do you eliminate for your customers?' : 'What core frustration or unmet customer pain point are you validating?'}
                value={coreProblem}
                onChange={e => setCoreProblem(e.target.value)}
                className={`${inputCls} min-h-[100px] resize-none`}
              />
            </div>
          </motion.div>
        )}

        {/* ── Step 4: Financial Baseline ── */}
        {currentStep === 4 && (
          <motion.div
            key="step-financial"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#141413] font-sans flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-[#141413]/60" />
                {onboardingPath === 'existing' ? 'Available Cash Reserves (USD)' : 'Initial Budget / Capital to Invest (USD)'}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-sm font-bold text-[#696969]">$</span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  placeholder={onboardingPath === 'existing' ? '250000' : '50000'}
                  value={cashBalance}
                  onChange={e => setCashBalance(e.target.value)}
                  className={`${inputCls} pl-7 font-mono font-semibold`}
                  autoFocus
                />
              </div>
              <span className="text-[10px] text-[#696969]">
                {onboardingPath === 'existing' ? 'Total active bank balance & venture treasury.' : 'Initial capital allocated to build and validate the MVP.'}
              </span>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#141413] font-sans flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-[#141413]/60" />
                {onboardingPath === 'existing' ? 'Monthly Net Burn Rate (USD / Month)' : 'Estimated Monthly Operating Expense (USD / Month)'}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-sm font-bold text-[#696969]">$</span>
                <input
                  type="number"
                  min="0"
                  step="500"
                  placeholder={onboardingPath === 'existing' ? '15000' : '5000'}
                  value={monthlyBurn}
                  onChange={e => setMonthlyBurn(e.target.value)}
                  className={`${inputCls} pl-7 font-mono font-semibold`}
                />
              </div>
              <span className="text-[10px] text-[#696969]">
                {onboardingPath === 'existing' ? 'Monthly operating expenses minus incoming revenue.' : 'Projected monthly spending on software, tools, and contractor fees.'}
              </span>
            </div>

            {/* Live Calculated Runway */}
            <div className="p-3.5 rounded-[16px] bg-[#F3F0EE] border border-[#141413]/10 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#696969] block">
                  Deterministic Operational Runway
                </span>
                <span className="text-xs text-[#141413] font-sans">
                  {onboardingPath === 'existing' ? 'Cash Balance ÷ Monthly Burn' : 'Starting Budget ÷ Monthly Expense'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold font-mono text-[#141413] block">
                  {calculatedRunway} Months
                </span>
                <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full inline-block ${
                  Number(calculatedRunway) >= 12
                    ? 'bg-emerald-100 text-emerald-800'
                    : Number(calculatedRunway) >= 6
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}>
                  {Number(calculatedRunway) >= 12 ? 'Healthy (>12 mo)' : Number(calculatedRunway) >= 6 ? 'Adequate (6-12 mo)' : 'Critical (<6 mo)'}
                </span>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Step 5: Goals & Priorities ── */}
        {currentStep === 5 && (
          <motion.div
            key="step-goals"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#141413] font-sans flex items-center gap-1.5">
                <Flag className="w-3.5 h-3.5 text-[#141413]/60" />
                {onboardingPath === 'existing' ? 'Primary 90-Day Milestone / Strategic Goal' : 'First 30-Day Milestone (e.g. Launch MVP)'}
              </label>
              <input
                type="text"
                placeholder={onboardingPath === 'existing' ? 'e.g. Launch MVP and onboard initial 10 paying customers' : 'e.g. Launch MVP on Product Hunt and onboard 10 beta teams'}
                value={milestoneGoal}
                onChange={e => setMilestoneGoal(e.target.value)}
                className={inputCls}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label className={labelCls}>
                {onboardingPath === 'existing' ? 'Top Operational Priority / Challenge' : 'Biggest Immediate Hurdle'}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  'Finding Customers / GTM',
                  'Product Development & MVP',
                  'Hiring & Engineering',
                  'Fundraising & Capital',
                  'Operations & Compliance'
                ].map(ch => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setBiggestChallenge(ch)}
                    className={`p-2.5 rounded-[12px] border text-left text-xs font-bold transition-all cursor-pointer font-sans truncate ${
                      biggestChallenge === ch
                        ? 'bg-[#141413] border-[#141413] text-[#F3F0EE]'
                        : 'bg-[#F3F0EE] border-[#141413]/10 hover:border-[#141413]/30 hover:bg-white text-[#141413]'
                    }`}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#141413] font-sans block">
                Additional Directives for AI Executive Council (Optional)
              </label>
              <textarea
                placeholder="Share any special constraints, strategic hypotheses, or domain guidance for the executive agents..."
                value={additionalNotes}
                onChange={e => setAdditionalNotes(e.target.value)}
                className={`${inputCls} min-h-[85px] resize-none`}
              />
            </div>
          </motion.div>
        )}

        {/* ── Step 6: Checklist Loader ── */}
        {currentStep === 6 && (
          <motion.div
            key="step-checklist"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="py-6 text-center space-y-6"
          >
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-[#141413] font-sans" style={{ letterSpacing: '-0.02em' }}>
                Initializing CatalystOS Workspace
              </h2>
              <p className="text-xs text-[#696969] font-sans">
                Grounding your autonomous executive agents with your company context.
              </p>
            </div>

            <div className="space-y-2.5 max-w-sm mx-auto text-left">
              {[
                { label: 'Synthesizing company context & parameters...', step: 1 },
                { label: 'Deploying autonomous AI executive council...', step: 2 },
                { label: 'Indexing living company profile into vector RAG...', step: 3 },
                { label: 'Personalizing your CatalystOS dashboard...', step: 4 },
              ].map((item) => (
                <div
                  key={item.step}
                  className={`flex items-center gap-3 p-3.5 rounded-[16px] border transition-all duration-500 font-sans ${
                    checkmarkProgress >= item.step
                      ? 'bg-[#141413] border-[#141413] text-[#F3F0EE] shadow-[rgba(0,0,0,0.1)_0px_4px_12px]'
                      : checkmarkProgress === item.step - 1
                      ? 'bg-[#F3F0EE] border-[#141413]/15 text-[#696969]'
                      : 'bg-white border-[#141413]/05 text-[#141413]/20'
                  }`}
                >
                  {checkmarkProgress >= item.step ? (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex-shrink-0">
                      <CheckCircle2 className="w-4 h-4 text-[#F3F0EE]" />
                    </motion.div>
                  ) : checkmarkProgress === item.step - 1 ? (
                    <RefreshCw className="w-3.5 h-3.5 text-[#696969] animate-spin flex-shrink-0" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border border-[#141413]/10 flex-shrink-0" />
                  )}
                  <span className="text-xs font-semibold">{item.label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Wizard Navigation Footer */}
      {currentStep > 0 && currentStep <= 5 && (
        <div className="flex items-center justify-between border-t border-[#141413]/10 pt-4 mt-8">
          <button
            type="button"
            onClick={handlePrev}
            className="flex items-center gap-1 text-xs text-[#696969] hover:text-[#141413] transition-colors cursor-pointer font-sans"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={isNextDisabled}
            className="flex items-center gap-1.5 px-6 py-2.5 bg-[#141413] hover:bg-[#262627] text-[#F3F0EE] text-xs font-bold transition-all rounded-[20px] disabled:opacity-40 cursor-pointer font-sans animate-fade-in"
          >
            <span>{currentStep === 5 ? 'Finish Setup & Deploy' : 'Continue'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
