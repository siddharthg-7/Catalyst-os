import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

import { 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  Check, 
  CheckCircle2, 
  Zap, 
  TrendingUp, 
  Bot, 
  LineChart, 
  ChevronDown, 
  Play, 
  Rocket, 
  DollarSign, 
  Layers, 
  Plus, 
  Minus, 
  Terminal, 
  ChevronRight
} from 'lucide-react';
import CatalystLogo from './CatalystLogo';

interface HackathonLandingPageProps {
  onStartBuilding: () => void;
  onDemoLogin?: () => void;
}

export default function HackathonLandingPage({ onStartBuilding, onDemoLogin }: HackathonLandingPageProps) {
  const [scrolled, setScrolled] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [activeTab, setActiveTab] = useState<'launch' | 'operations' | 'approvals' | 'finance' | 'growth'>('launch');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [lottieError, setLottieError] = useState(false);
  const [demoDropdownOpen, setDemoDropdownOpen] = useState(false);

  // Workspace typing simulation state
  const [typingText, setTypingText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [, setTypingDone] = useState(false);

  // UX-special, crisp, punchy micro-copy for simulated typing
  const launchTypingMsg = "Launch Readiness is At Risk: Final integration testing is pending before the announcement. Recommended: Confirm testing ownership to maintain release date.";
  const operationsTypingMsg = "Sprint overview: 12 active tasks across engineering and ops. 9 on track, 1 blocked on testing. All ownership and dependencies tracked in real time.";
  const approvalsTypingMsg = "1 deliverable awaiting review: Enterprise SLA Agreement with 1x fee liability cap. Autonomous execution is paused until founder approval.";
  const financeTypingMsg = "Runway health: 11.4 months remaining at ₹14.2L/mo burn. Deferring 1 non-critical hire extends cash runway past your 12-month target.";
  const growthTypingMsg = "GTM sprint active: Onboarding checklist ready. Power-user referral loop staged to trigger as soon as testing milestones clear.";

  useEffect(() => {
    setTypingText('');
    setTypingDone(false);
    setIsTyping(false);
    const delay = setTimeout(() => {
      setIsTyping(true);
      const msg = 
        activeTab === 'launch' ? launchTypingMsg : 
        activeTab === 'operations' ? operationsTypingMsg : 
        activeTab === 'approvals' ? approvalsTypingMsg : 
        activeTab === 'finance' ? financeTypingMsg : 
        activeTab === 'growth' ? growthTypingMsg : '';
      if (!msg) { setIsTyping(false); setTypingDone(true); return; }
      let i = 0;
      const timer = setInterval(() => {
        setTypingText(msg.slice(0, i + 1));
        i++;
        if (i >= msg.length) { clearInterval(timer); setIsTyping(false); setTypingDone(true); }
      }, 10);
      return () => clearInterval(timer);
    }, 120);
    return () => clearTimeout(delay);
  }, [activeTab]);

  const landingRef = useRef<HTMLDivElement | null>(null);

  // GSAP Entrance & ScrollTrigger Animations
  useEffect(() => {
    if (!landingRef.current) return;
    const ctx = gsap.context(() => {
      // 1. Kinetic Hero Title & CTA Reveal
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.fromTo(
        '.gsap-hero-title',
        { opacity: 0, y: 35, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 1 }
      )
      .fromTo(
        '.gsap-hero-sub',
        { opacity: 0, y: 25 },
        { opacity: 1, y: 0, duration: 0.8 },
        '-=0.6'
      )
      .fromTo(
        '.gsap-hero-cta',
        { opacity: 0, y: 20, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.7, stagger: 0.15, ease: 'back.out(1.5)' },
        '-=0.5'
      )
      .fromTo(
        '.gsap-hero-lottie',
        { opacity: 0, scale: 0.85, rotation: -5 },
        { opacity: 1, scale: 1, rotation: 0, duration: 1.2, ease: 'elastic.out(1, 0.6)' },
        '-=1'
      );

      // 2. Ambient Floating Badges Sine Wave
      gsap.to('.gsap-float-badge-1', {
        y: -12,
        rotation: 2,
        duration: 3.5,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
      gsap.to('.gsap-float-badge-2', {
        y: 12,
        rotation: -2,
        duration: 4.2,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        delay: 0.5,
      });

      // 3. ScrollTrigger for Feature Sections
      gsap.fromTo(
        '.gsap-scroll-section',
        { opacity: 0, y: 50 },
        {
          opacity: 1,
          y: 0,
          duration: 0.9,
          stagger: 0.2,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: '#solutions',
            start: 'top 80%',
            toggleActions: 'play none none none',
          },
        }
      );
    }, landingRef);

    return () => ctx.revert();
  }, []);

  // Monitor scroll for floating glass navbar shrinking (84px -> 68px)
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const faqs = [
    {
      question: "What is CatalystOS?",
      answer: "CatalystOS is an operating workspace that helps startup teams coordinate execution, surface blockers early, and maintain shared visibility into what matters."
    },
    {
      question: "Which AI advisors are included?",
      answer: "CatalystOS includes 8 specialist executive agents (CEO, CFO, Legal, Talent, Operations, Growth, IR, and Auditor) to analyze decisions and draft deliverables for human review."
    },
    {
      question: "Can I invite my team?",
      answer: "Yes. Founders can invite team members with role-based access across Admin, Finance, HR, Operations, and Growth to access dedicated workspaces and submit work."
    },
    {
      question: "Is my startup data secure?",
      answer: "Yes. Workspaces are isolated in PostgreSQL with bcrypt password hashing and signed JWT authentication. Consequential decisions require explicit founder approval."
    },
    {
      question: "Can I integrate with my existing tools?",
      answer: "You can upload company documents (PDF, DOCX, TXT, Markdown) into your workspace knowledge base. Direct SaaS integrations are in active development."
    },
    {
      question: "Do you offer a free trial?",
      answer: "Yes. You can explore core workspace features with a 14-day free trial for up to 2 users, or try the interactive demo without signing up."
    }
  ];

  return (
    <div ref={landingRef} className="min-h-screen bg-[#F3F0EE] text-[#141413] font-sans selection:bg-[#141413]/20 selection:text-[#141413] relative overflow-x-hidden">

      {/* 1. STICKY FLOATING WHITE PILL NAVBAR */}
      <header className="fixed top-0 left-0 right-0 z-50 px-4 pt-6 flex justify-center pointer-events-none">
        <nav className={`w-full max-w-[1280px] rounded-full bg-white px-8 flex items-center justify-between shadow-[rgba(0,0,0,0.04)_0px_4px_24px_0px] transition-all duration-300 pointer-events-auto ${
          scrolled ? 'h-[68px]' : 'h-[84px]'
        }`}>
          
          {/* Brand Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-9 h-9 rounded-xl bg-[#F3F0EE] border border-[#141413]/20 p-1 flex items-center justify-center hover:border-[#141413] transition-colors">
              <CatalystLogo className="w-5 h-5 text-[#141413]" />
            </div>
            <span className="font-bold text-[#141413] text-lg font-sans" style={{letterSpacing: '-0.02em'}}>CatalystOS</span>
          </div>

          {/* Navigation Items */}
          <div className="hidden lg:flex items-center gap-9 text-sm font-medium text-[#141413]/70 font-sans">
            <a href="#solutions" className="hover:text-[#141413] transition-colors">Product</a>
            <a href="#execution" className="hover:text-[#141413] transition-colors">Process</a>
            <a href="#pricing" className="hover:text-[#141413] transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-[#141413] transition-colors">FAQ</a>
          </div>

          {/* Action CTA Button */}
          <div className="flex items-center gap-4">
            <button
              onClick={onStartBuilding}
              className="px-6 py-2.5 bg-[#141413] hover:bg-[#262627] text-[#F3F0EE] text-xs font-medium transition-all cursor-pointer flex items-center gap-2 font-sans rounded-[20px]"
            >
              <span>Get Started</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </nav>
      </header>

      {/* 2. HERO SECTION - FOUNDER-FIRST EDITORIAL */}
      <section className="pt-48 pb-28 px-6 relative overflow-hidden">

        <div className="max-w-[1280px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Editorial Copy */}
          <div className="lg:col-span-6 space-y-8 text-left z-10 max-w-[560px]">
            
            <h1 
              className="gsap-hero-title text-5xl sm:text-7xl lg:text-[76px] font-bold text-[#141413] leading-[1.02] font-sans"
              style={{letterSpacing: '-0.02em'}}
            >
              Run Your Startup Without<br className="hidden sm:inline" /> Losing Track of What Matters.
            </h1>

            <p 
              className="gsap-hero-sub text-[#696969] text-base sm:text-lg leading-[160%] font-sans max-w-[500px]"
            >
              Connect priorities, blockers, and team dependencies in one clear workspace. Always know what needs attention next.
            </p>

            <div 
              className="gsap-hero-cta flex flex-col sm:flex-row items-center gap-4 pt-2"
            >
              <button
                onClick={onStartBuilding}
                className="w-full sm:w-auto px-8 py-4 bg-[#141413] hover:bg-[#262627] text-[#F3F0EE] font-medium text-[15px] transition-all cursor-pointer flex items-center justify-center gap-2 font-sans rounded-[20px]"
              >
                <span>Start Free Trial</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="relative w-full sm:w-auto">
                <button
                  onMouseEnter={() => setDemoDropdownOpen(true)}
                  onMouseLeave={() => setDemoDropdownOpen(false)}
                  className="w-full sm:w-auto px-8 py-4 bg-transparent hover:bg-[#F37338]/10 text-[#F3F0EE] border border-[#F37338]/30 font-medium text-[15px] transition-all flex items-center justify-center gap-2 font-sans rounded-[20px]"
                >
                  <Play className="w-4 h-4 text-[#F37338]" />
                  <span className="text-[#141413]">Explore the Workflow</span>
                  <ChevronDown className={`w-4 h-4 text-[#141413] transition-transform ${demoDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                <AnimatePresence>
                  {demoDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.15 }}
                      onMouseEnter={() => setDemoDropdownOpen(true)}
                      onMouseLeave={() => setDemoDropdownOpen(false)}
                      className="absolute left-0 mt-2 w-60 bg-white border border-[#141413]/10 rounded-[16px] shadow-[rgba(0,0,0,0.1)_0px_10px_30px] overflow-hidden z-50 p-2"
                    >
                      <button
                        onClick={() => window.dispatchEvent(new CustomEvent('START_CHATBOT_DEMO'))}
                        className="w-full text-left px-4 py-3 hover:bg-[#F3F0EE] rounded-[10px] transition-colors flex items-center gap-3 cursor-pointer group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#F37338]/10 flex items-center justify-center text-[#F37338] group-hover:scale-110 transition-transform">
                          <Bot className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-[#141413] font-sans">Chatbot Demo</div>
                          <div className="text-[10px] text-[#696969] font-sans">See grounded RAG assistant</div>
                        </div>
                      </button>
                      
                      <button
                        onClick={() => onDemoLogin && onDemoLogin()}
                        className="w-full text-left px-4 py-3 hover:bg-[#F3F0EE] rounded-[10px] transition-colors flex items-center gap-3 cursor-pointer group mt-1"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#141413]/5 flex items-center justify-center text-[#141413] group-hover:scale-110 transition-transform">
                          <Layers className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-[#141413] font-sans">Dashboard Demo</div>
                          <div className="text-[10px] text-[#696969] font-sans">Explore the founder workspace</div>
                        </div>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

          </div>

          {/* Right Column: HERO ROBOT / AI ILLUSTRATION */}
          <div className="lg:col-span-6 relative flex items-center justify-center z-20 w-full">
            
            {/* Ambient Animated Orbit Rings */}
            <div className="absolute w-[360px] sm:w-[460px] lg:w-[540px] h-[360px] sm:h-[460px] lg:h-[540px] rounded-full border border-[#141413]/10 sm:border-[#F37338]/20 animate-spin pointer-events-none" style={{ animationDuration: '35s' }} />
            <div className="absolute w-[300px] sm:w-[380px] lg:w-[460px] h-[300px] sm:h-[380px] lg:h-[460px] rounded-full border border-[#141413]/10 sm:border-[#F37338]/20 animate-spin pointer-events-none" style={{ animationDuration: '50s', animationDirection: 'reverse' }} />

            {/* Micro Deco Elements on Orbit */}
            <div className="absolute top-10 right-16 w-5 h-5 text-rose-400 opacity-60 animate-pulse pointer-events-none hidden sm:block">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6.4-4.8-6.4 4.8 2.4-7.2-6-4.8h7.6z"/></svg>
            </div>
            <div className="absolute bottom-20 left-12 w-4 h-4 text-blue-400 opacity-60 pointer-events-none hidden sm:block">
              <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8"/></svg>
            </div>
            <div className="absolute top-36 left-16 text-rose-500 font-bold text-xs opacity-70 pointer-events-none hidden sm:block">+</div>
            <div className="absolute bottom-32 right-14 text-blue-500 font-bold text-xs opacity-70 pointer-events-none hidden sm:block">✕</div>

            {/* Freely Floating Robot Animation / Graphic */}
            <div 
              className="gsap-hero-lottie w-full max-w-[420px] sm:max-w-[480px] lg:max-w-[520px] aspect-square relative flex items-center justify-center"
            >
              {!lottieError ? (
                <DotLottieReact
                  src="https://lottie.host/eb092f61-1eb3-4de7-8db1-7c72da2a7379/cAAGtnj4dN.lottie"
                  loop
                  autoplay
                  speed={0.8}
                  style={{ width: '100%', height: '100%' }}
                  onError={() => setLottieError(true)}
                />
              ) : (
                <svg viewBox="0 0 500 500" className="w-full h-full drop-shadow-xl select-none" fill="none">
                  <ellipse cx="250" cy="430" rx="140" ry="24" fill="#141413" fillOpacity="0.08" />
                  <g className="animate-[bounce_4s_ease-in-out_infinite]">
                    <path d="M200 300 C200 370 300 370 300 300 Z" fill="#FFFFFF" stroke="#E5E0DB" strokeWidth="3" />
                    <path d="M215 310 C215 355 285 355 285 310 Z" fill="#F3F0EE" />
                    <path d="M190 280 Q165 310 175 350 Q185 355 195 330 Q200 295 190 280 Z" fill="#FFFFFF" stroke="#E5E0DB" strokeWidth="2.5" />
                    <path d="M305 280 Q340 270 350 230 Q340 220 325 240 Q310 265 305 280 Z" fill="#FFFFFF" stroke="#E5E0DB" strokeWidth="2.5" />
                    <rect x="155" y="160" width="190" height="150" rx="75" fill="#FFFFFF" stroke="#E5E0DB" strokeWidth="3" />
                    <rect x="145" y="215" width="14" height="40" rx="7" fill="#E5E0DB" />
                    <rect x="341" y="215" width="14" height="40" rx="7" fill="#E5E0DB" />
                    <rect x="180" y="195" width="140" height="75" rx="36" fill="#141413" />
                    <rect x="205" y="220" width="14" height="26" rx="7" fill="#00D2FF" />
                    <rect x="281" y="220" width="14" height="26" rx="7" fill="#00D2FF" />
                  </g>
                </svg>
              )}

              {/* Floating Notification Badges — white cards on cream */}
              <div 
                className="gsap-float-badge-1 absolute top-2 sm:-top-4 left-0 sm:-left-6 p-3 sm:p-3.5 rounded-[18px] sm:rounded-[20px] bg-white shadow-[rgba(0,0,0,0.08)_0px_20px_40px_0px] border border-[#141413]/10 flex items-center gap-2.5 sm:gap-3 z-30"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#F3F0EE] border border-[#141413]/20 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#141413]" />
                </div>
                <div>
                  <span className="text-[9px] font-mono text-[#696969] uppercase font-bold block">PRIORITY</span>
                  <span className="text-xs font-bold text-[#141413] font-sans">Launch Roadmap Ready</span>
                </div>
              </div>

              <div 
                className="gsap-float-badge-2 absolute bottom-2 sm:-bottom-4 right-0 sm:-right-6 p-3 sm:p-3.5 rounded-[18px] sm:rounded-[20px] bg-white shadow-[rgba(0,0,0,0.08)_0px_20px_40px_0px] border border-[#141413]/10 flex items-center gap-2.5 sm:gap-3 z-30"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#F3F0EE] border border-[#141413]/20 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#141413]" />
                </div>
                <div>
                  <span className="text-[9px] font-mono text-[#696969] uppercase font-bold block">RUNWAY</span>
                  <span className="text-xs font-bold text-[#141413] font-sans">13.2-Month Runway Verified</span>
                </div>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* 3. PRODUCT VALUE PROPOSITION & WORKSPACE WORKFLOW PREVIEW */}
      <section id="solutions" className="py-36 px-6 bg-[#F3F0EE] border-y border-[#141413]/10 relative overflow-hidden">
        {/* Ghost watermark headline */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
          <span className="text-[200px] font-black text-[#141413]/[0.025] font-sans whitespace-nowrap" style={{letterSpacing: '-0.04em'}}>WORKSPACE</span>
        </div>

        <div className="max-w-[1280px] mx-auto space-y-16 relative">

          {/* Section header: Explains Outcome */}
          <div className="gsap-scroll-section text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-xs font-mono text-[#696969] uppercase tracking-widest font-bold">• WORKSPACE VISIBILITY</span>

            <h2 className="text-4xl sm:text-5xl font-bold text-[#141413] font-sans" style={{letterSpacing: '-0.02em'}}>
              Shared Visibility into What Needs Attention
            </h2>
            <p className="text-[#696969] text-sm sm:text-base leading-[160%] font-sans max-w-lg mx-auto">
              Connect priorities, dependencies, and responsibilities. Spot blockers early, coordinate next steps, and keep the whole team moving forward.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

            {/* ── Left: Workflow Navigation ── */}
            <div className="lg:col-span-4 space-y-2.5">
              {([
                { key: 'launch',     label: 'Product Launch',    sub: 'Launch readiness & blockers', icon: Rocket },
                { key: 'operations', label: 'Operations',        sub: 'Team tasks & dependencies',   icon: Layers },
                { key: 'approvals',  label: 'Founder Approvals', sub: 'Consequential decisions',     icon: ShieldCheck },
                { key: 'finance',    label: 'Runway & Treasury', sub: 'Burn rate & cash governance', icon: DollarSign },
                { key: 'growth',     label: 'Milestones & GTM',  sub: 'Sprint targets & progress',   icon: TrendingUp },
              ] as const).map((item) => {
                const isActive = activeTab === item.key;
                const ItemIcon = item.icon;
                return (
                  <button
                    key={item.key}
                    onClick={() => setActiveTab(item.key)}
                    className={`w-full p-4 rounded-[20px] border text-left transition-all duration-200 cursor-pointer flex items-center justify-between font-sans group ${
                      isActive
                        ? 'bg-[#141413] text-[#F3F0EE] border-[#141413] shadow-[rgba(0,0,0,0.12)_0px_8px_24px_0px]'
                        : 'bg-white text-[#696969] border-[#141413]/10 hover:border-[#141413]/25 hover:shadow-[rgba(0,0,0,0.04)_0px_4px_16px_0px]'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className={`w-9 h-9 rounded-[12px] flex items-center justify-center transition-all ${
                        isActive ? 'bg-white/15' : 'bg-[#F3F0EE] group-hover:bg-[#F3F0EE]'
                      }`}>
                        <ItemIcon className={`w-4 h-4 ${isActive ? 'text-[#F3F0EE]' : 'text-[#141413]'}`} />
                      </div>
                      <div>
                        <div className={`text-sm font-bold leading-tight ${isActive ? 'text-[#F3F0EE]' : 'text-[#141413]'}`}>{item.label}</div>
                        <div className={`text-[10px] font-mono mt-0.5 ${isActive ? 'text-[#F3F0EE]/55' : 'text-[#696969]'}`}>{item.sub}</div>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                      isActive ? 'bg-white/20' : 'bg-transparent'
                    }`}>
                      <ChevronRight className={`w-3 h-3 ${isActive ? 'text-[#F3F0EE]' : 'text-[#696969]/40'}`} />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* ── Right: Realistic Workspace Preview Window ── */}
            <div className="lg:col-span-8">
              <div className="rounded-[40px] bg-white border border-[#141413]/10 shadow-[rgba(0,0,0,0.08)_0px_24px_48px_0px] overflow-hidden">

                {/* Window chrome */}
                <div className="px-6 py-4 border-b border-[#141413]/08 bg-[#FCFBFA] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    </div>
                    <div className="h-4 w-px bg-[#141413]/10 mx-1" />
                    <span className="text-[11px] font-mono text-[#696969] font-bold uppercase tracking-wider">
                      CatalystOS — {
                        activeTab === 'launch' ? 'Product Launch Workspace' :
                        activeTab === 'operations' ? 'Operations & Team Workspace' :
                        activeTab === 'approvals' ? 'Founder Approvals Queue' :
                        activeTab === 'finance' ? 'Treasury & Runway Workspace' :
                        'Growth & GTM Workspace'
                      }
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-mono text-[#696969]">ACTIVE</span>
                  </div>
                </div>

                {/* Workspace content — switches by activeTab */}
                <div className="p-6 min-h-[460px]">

                  {/* ── TAB 1: PRODUCT LAUNCH (HERO DEMO WORKFLOW) ── */}
                  {activeTab === 'launch' && (
                    <div className="space-y-4 animate-fadeIn">
                      {/* AI Agent Synthesis */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#141413] flex items-center justify-center">
                            <Bot className="w-3 h-3 text-[#F3F0EE]" />
                          </div>
                          <span className="text-[10px] font-mono font-bold text-[#696969] uppercase">Atlas — CEO Agent</span>
                        </div>
                        <div className="bg-[#FCFBFA] border border-[#141413]/10 rounded-[16px] p-4 min-h-[72px] flex items-center">
                          <p className="text-sm text-[#141413] leading-relaxed font-sans">
                            {typingText}
                            {isTyping && <span className="inline-block w-0.5 h-4 bg-[#141413] ml-0.5 animate-pulse align-middle" />}
                          </p>
                        </div>
                      </div>

                      {/* 3 Status Cards: Realistic Launch State */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-4 rounded-[16px] border bg-amber-50/60 border-amber-200">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-mono font-bold text-[#696969] uppercase">Priority</span>
                            <span className="text-[9px] font-mono font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded-full">AT RISK</span>
                          </div>
                          <span className="text-base font-bold font-sans text-[#141413] block">Launch Readiness</span>
                          <span className="text-[10px] font-mono text-[#696969] block mt-0.5">Target: Oct 30</span>
                        </div>

                        <div className="p-4 rounded-[16px] border bg-white border-[#141413]/10">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-mono font-bold text-[#696969] uppercase">Dependency</span>
                            <span className="text-[9px] font-mono font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-full">BLOCKER</span>
                          </div>
                          <span className="text-base font-bold font-sans text-[#141413] block">Product Testing</span>
                          <span className="text-[10px] font-mono text-[#696969] block mt-0.5">Required for release</span>
                        </div>

                        <div className="p-4 rounded-[16px] border bg-white border-[#141413]/10">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-mono font-bold text-[#696969] uppercase">Oversight</span>
                            <span className="text-[9px] font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full">PENDING</span>
                          </div>
                          <span className="text-base font-bold font-sans text-[#141413] block">Timeline Decision</span>
                          <span className="text-[10px] font-mono text-[#696969] block mt-0.5">Sign-off staged</span>
                        </div>
                      </div>

                      {/* Clean Scannable Dependency Chain */}
                      <div className="p-4 rounded-[16px] bg-[#F3F0EE] border border-[#141413]/10 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold text-[#141413] uppercase tracking-wider flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5" />
                            Critical Path Dependency
                          </span>
                          <span className="text-[9px] font-mono font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                            POTENTIAL 3-DAY SLIP
                          </span>
                        </div>
                        <div className="p-3 bg-white rounded-[12px] border border-[#141413]/08 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-[10px] font-mono text-[#696969] uppercase block mb-0.5">Identified Blocker</span>
                            <span className="font-semibold text-[#141413]">Integration test suite incomplete</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-mono text-[#696969] uppercase block mb-0.5">Recommended Next Step</span>
                            <span className="font-semibold text-[#141413]">Assign testing owner &amp; update timeline</span>
                          </div>
                        </div>
                      </div>

                      {/* Team Tasks & Ownership Table */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold text-[#696969] uppercase">Team Tasks — Ownership &amp; Deadlines</span>
                          <span className="text-[10px] font-mono text-[#696969]">3 tasks linked to launch</span>
                        </div>

                        {[
                          { 
                            title: 'Final platform integration testing & regression suite', 
                            owner: 'Vikram Malhotra', 
                            role: 'Lead Eng', 
                            status: 'Delayed / In Progress',
                            statusColor: 'text-amber-800 bg-amber-50 border-amber-200',
                            deadline: 'Today, 5:00 PM'
                          },
                          { 
                            title: 'Launch announcement & user onboarding documentation', 
                            owner: 'Priya Sharma', 
                            role: 'Product Ops', 
                            status: 'Awaiting Testing',
                            statusColor: 'text-[#696969] bg-[#F3F0EE] border-[#141413]/10',
                            deadline: 'Tomorrow, 12:00 PM'
                          },
                          { 
                            title: 'Production infrastructure & API security verification', 
                            owner: 'Helix & Sentry', 
                            role: 'Ops & Auditor', 
                            status: 'Verified',
                            statusColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
                            deadline: 'Completed'
                          },
                        ].map((task, i) => (
                          <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-[12px] bg-[#FCFBFA] border border-[#141413]/08">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-full bg-[#141413] flex items-center justify-center text-[10px] font-bold text-[#F3F0EE] font-mono shrink-0">
                                {task.owner.split(' ').map(n => n[0]).join('')}
                              </div>
                              <div>
                                <div className="text-xs font-bold text-[#141413] font-sans">{task.title}</div>
                                <div className="text-[10px] font-mono text-[#696969]">{task.owner} · {task.role}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                              <span className={`text-[9px] font-mono font-bold border px-2 py-0.5 rounded-full ${task.statusColor}`}>
                                {task.status}
                              </span>
                              <span className="text-[10px] font-mono text-[#696969] hidden md:inline">{task.deadline}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── TAB 2: OPERATIONS & TEAM TASKS ── */}
                  {activeTab === 'operations' && (
                    <div className="space-y-4 animate-fadeIn">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#141413] flex items-center justify-center">
                            <Bot className="w-3 h-3 text-[#F3F0EE]" />
                          </div>
                          <span className="text-[10px] font-mono font-bold text-[#696969] uppercase">Helix — Operations Agent</span>
                        </div>
                        <div className="bg-[#FCFBFA] border border-[#141413]/10 rounded-[16px] p-4 min-h-[72px] flex items-center">
                          <p className="text-sm text-[#141413] leading-relaxed font-sans">
                            {typingText}
                            {isTyping && <span className="inline-block w-0.5 h-4 bg-[#141413] ml-0.5 animate-pulse align-middle" />}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: 'Active Tasks', value: '12', sub: 'Across 3 teams', color: 'text-[#141413]', bg: 'bg-[#FCFBFA] border-[#141413]/10' },
                          { label: 'Blocked', value: '1', sub: 'Awaiting testing', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
                          { label: 'Completed', value: '8', sub: 'Sprint velocity', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
                        ].map((m, i) => (
                          <div key={i} className={`p-4 rounded-[16px] border ${m.bg}`}>
                            <span className="text-[10px] font-mono font-bold text-[#696969] uppercase block mb-1">{m.label}</span>
                            <span className={`text-2xl font-black font-mono ${m.color}`}>{m.value}</span>
                            <span className="text-[10px] font-mono text-[#696969] block mt-0.5">{m.sub}</span>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-2">
                        <span className="text-[10px] font-mono font-bold text-[#696969] uppercase">Delegated Responsibilities</span>
                        {[
                          { name: 'API rate limiting & auth token verification', owner: 'Vikram Malhotra', dept: 'Engineering', status: 'Completed' },
                          { name: 'Customer onboarding survey review', owner: 'Priya Sharma', dept: 'Operations', status: 'In Review' },
                          { name: 'Vendor SLA compliance audit', owner: 'Nexus & Sentry', dept: 'Legal & Risk', status: 'Pending Approval' },
                        ].map((item, i) => (
                          <div key={i} className="flex items-center justify-between p-3 rounded-[12px] bg-[#FCFBFA] border border-[#141413]/08">
                            <div>
                              <div className="text-xs font-bold text-[#141413] font-sans">{item.name}</div>
                              <div className="text-[10px] font-mono text-[#696969]">{item.owner} · {item.dept}</div>
                            </div>
                            <span className="text-[10px] font-mono font-bold text-[#141413] bg-white border border-[#141413]/10 px-2 py-0.5 rounded-full">
                              {item.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── TAB 3: FOUNDER APPROVALS & GOVERNANCE ── */}
                  {activeTab === 'approvals' && (
                    <div className="space-y-4 animate-fadeIn">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#141413] flex items-center justify-center">
                            <Bot className="w-3 h-3 text-[#F3F0EE]" />
                          </div>
                          <span className="text-[10px] font-mono font-bold text-[#696969] uppercase">Sentry — Compliance Auditor</span>
                        </div>
                        <div className="bg-[#FCFBFA] border border-[#141413]/10 rounded-[16px] p-4 min-h-[72px] flex items-center">
                          <p className="text-sm text-[#141413] leading-relaxed font-sans">
                            {typingText}
                            {isTyping && <span className="inline-block w-0.5 h-4 bg-[#141413] ml-0.5 animate-pulse align-middle" />}
                          </p>
                        </div>
                      </div>

                      {/* Deliverable Review Card */}
                      <div className="p-4 rounded-[16px] bg-[#FCFBFA] border border-[#141413]/10 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-[#141413]" />
                            <span className="text-xs font-bold text-[#141413] font-sans">Enterprise Vendor Agreement &amp; SLA Addendum</span>
                          </div>
                          <span className="text-[9px] font-mono font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            AWAITING SIGN-OFF
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="p-2.5 rounded-[12px] bg-white border border-[#141413]/08">
                            <span className="text-[10px] font-mono text-[#696969] block">Prepared By</span>
                            <span className="font-bold text-[#141413]">Nexus (Legal)</span>
                          </div>
                          <div className="p-2.5 rounded-[12px] bg-white border border-[#141413]/08">
                            <span className="text-[10px] font-mono text-[#696969] block">Risk Score</span>
                            <span className="font-bold text-emerald-700">LOW (8/100)</span>
                          </div>
                          <div className="p-2.5 rounded-[12px] bg-white border border-[#141413]/08">
                            <span className="text-[10px] font-mono text-[#696969] block">Safeguard</span>
                            <span className="font-bold text-[#141413]">1x Fee Cap</span>
                          </div>
                        </div>

                        <p className="text-xs text-[#696969] leading-relaxed font-sans">
                          <strong className="text-[#141413]">Council Consensus:</strong> 4 of 4 agents recommend proceeding. Protects against uncapped liability before pilot onboarding.
                        </p>

                        <div className="flex items-center gap-3 pt-1">
                          <button className="flex-1 py-2 bg-[#141413] hover:bg-[#262627] text-[#F3F0EE] rounded-[12px] text-xs font-bold font-sans transition-all">
                            Approve Deliverable
                          </button>
                          <button className="px-4 py-2 bg-white hover:bg-[#F3F0EE] border border-[#141413]/15 text-[#141413] rounded-[12px] text-xs font-bold font-sans transition-all">
                            Request Modification
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── TAB 4: RUNWAY & TREASURY ── */}
                  {activeTab === 'finance' && (
                    <div className="space-y-4 animate-fadeIn">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#141413] flex items-center justify-center">
                            <Bot className="w-3 h-3 text-[#F3F0EE]" />
                          </div>
                          <span className="text-[10px] font-mono font-bold text-[#696969] uppercase">Aura — Finance Agent</span>
                        </div>
                        <div className="bg-[#FCFBFA] border border-[#141413]/10 rounded-[16px] p-4 min-h-[72px] flex items-center">
                          <p className="text-sm text-[#141413] leading-relaxed font-sans">
                            {typingText}
                            {isTyping && <span className="inline-block w-0.5 h-4 bg-[#141413] ml-0.5 animate-pulse align-middle" />}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: 'Monthly Burn',   value: '₹14.2L',  sub: '+₹1.1L vs last month', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-100' },
                          { label: 'Cash Runway',    value: '11.4 mo', sub: 'Target: >12 mo',        color: 'text-amber-700', bg: 'bg-amber-50 border-amber-100' },
                          { label: 'Cash Reserves',  value: '₹1.62Cr', sub: 'Verified balance',     color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100' },
                        ].map((m, i) => (
                          <div key={i} className={`p-4 rounded-[16px] border ${m.bg}`}>
                            <span className="text-[10px] font-mono font-bold text-[#696969] uppercase block mb-1">{m.label}</span>
                            <span className={`text-2xl font-black font-mono ${m.color}`}>{m.value}</span>
                            <span className="text-[10px] font-mono text-[#696969] block mt-0.5">{m.sub}</span>
                          </div>
                        ))}
                      </div>

                      {/* Burn breakdown bar */}
                      <div className="p-4 rounded-[16px] bg-[#F3F0EE] border border-[#141413]/10 space-y-3">
                        <span className="text-[10px] font-mono font-bold text-[#696969] uppercase">Burn Breakdown</span>
                        {[
                          { label: 'Salaries',       pct: 62, color: 'bg-[#141413]' },
                          { label: 'Cloud Infra',    pct: 18, color: 'bg-amber-500' },
                          { label: 'Tools & SaaS',   pct: 12, color: 'bg-rose-400' },
                          { label: 'Other',          pct: 8,  color: 'bg-[#696969]' },
                        ].map((b, i) => (
                          <div key={i} className="flex items-center gap-3 text-xs">
                            <span className="w-20 text-[#696969] font-sans shrink-0">{b.label}</span>
                            <div className="flex-1 h-1.5 bg-white rounded-full overflow-hidden">
                              <div className={`h-full ${b.color} rounded-full transition-all duration-700`} style={{ width: `${b.pct}%` }} />
                            </div>
                            <span className="text-[10px] font-mono font-bold text-[#141413] w-7 text-right">{b.pct}%</span>
                          </div>
                        ))}
                      </div>

                      {/* Treasury recommendation */}
                      <div className="p-4 rounded-[16px] bg-[#141413] space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-[#F3F0EE]/70" />
                          <span className="text-[10px] font-mono font-bold text-[#F3F0EE]/70 uppercase">Runway Recommendation</span>
                        </div>
                        <p className="text-xs text-[#F3F0EE] leading-relaxed font-sans">
                          Delaying one planned non-critical hire extends operating runway by <strong>1.4 months</strong> without slowing delivery.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ── TAB 5: GROWTH & GTM ── */}
                  {activeTab === 'growth' && (
                    <div className="space-y-4 animate-fadeIn">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#141413] flex items-center justify-center">
                            <Bot className="w-3 h-3 text-[#F3F0EE]" />
                          </div>
                          <span className="text-[10px] font-mono font-bold text-[#696969] uppercase">Vector — Growth Agent</span>
                        </div>
                        <div className="bg-[#FCFBFA] border border-[#141413]/10 rounded-[16px] p-4 min-h-[72px] flex items-center">
                          <p className="text-sm text-[#141413] leading-relaxed font-sans">
                            {typingText}
                            {isTyping && <span className="inline-block w-0.5 h-4 bg-[#141413] ml-0.5 animate-pulse align-middle" />}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-4 rounded-[16px] bg-[#F3F0EE] border border-[#141413]/10 space-y-2">
                          <span className="text-[10px] font-mono font-bold text-[#696969] uppercase block mb-1">GTM Checklist</span>
                          <div className="space-y-1.5">
                            {[
                              { label: 'Developer onboarding documentation', done: true },
                              { label: 'Early-access cohort invitation list', done: true },
                              { label: 'Product launch smoke tests', done: false },
                              { label: 'User feedback telemetry', done: false },
                            ].map((t, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs">
                                <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${
                                  t.done ? 'bg-emerald-600' : 'border border-[#141413]/25'
                                }`}>
                                  {t.done && <Check className="w-2 h-2 text-white" />}
                                </div>
                                <span className={`text-[10.5px] font-sans ${t.done ? 'text-[#696969] line-through' : 'text-[#141413]'}`}>{t.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="p-4 rounded-[16px] bg-[#FCFBFA] border border-[#141413]/10 space-y-2 flex flex-col justify-between">
                          <div>
                            <span className="text-[10px] font-mono font-bold text-[#141413] uppercase block mb-1">Target Audience</span>
                            <p className="text-xs text-[#696969] font-sans leading-relaxed">
                              Early-stage technical founders navigating operational scaling and cross-departmental coordination.
                            </p>
                          </div>
                          <div className="p-2.5 bg-white rounded-[12px] border border-[#141413]/08">
                            <span className="text-[10px] font-mono text-[#696969] block">Core Channel</span>
                            <span className="text-xs font-bold text-[#141413]">Direct founder networks &amp; developer communities</span>
                          </div>
                        </div>
                      </div>

                      {/* Campaign timeline */}
                      <div className="p-4 rounded-[16px] bg-[#FCFBFA] border border-[#141413]/10 space-y-2">
                        <span className="text-[10px] font-mono font-bold text-[#141413] uppercase">Launch Sprints</span>
                        <div className="flex items-center gap-0 text-[10px] font-mono">
                          {['Sprint 1 (Prep)', 'Sprint 2 (Testing)', 'Sprint 3 (Pilot)', 'Sprint 4 (Review)'].map((w, i) => (
                            <div key={i} className={`flex-1 py-2 text-center border-r last:border-r-0 border-[#141413]/08 ${
                              i < 2 ? 'text-[#141413] font-bold bg-[#141413]/05' : 'text-[#696969]'
                            }`}>{w}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                </div>{/* /workspace content */}
              </div>{/* /workspace card */}
            </div>{/* /right col */}

          </div>{/* /grid */}

        </div>
      </section>

      {/* 4. HOW IT WORKS / FROM IDEA TO EXECUTION */}
      <section id="execution" className="py-36 px-6 bg-[#FCFBFA] border-y border-[#141413]/10">
        <div className="max-w-[1280px] mx-auto space-y-16 text-center">
          
          <div className="space-y-3 max-w-2xl mx-auto">
            <span className="text-xs font-mono text-[#696969] uppercase tracking-widest font-bold">HOW IT WORKS</span>
            <h2 className="text-4xl sm:text-5xl font-bold text-[#141413] tracking-tight font-sans" style={{letterSpacing: '-0.02em'}}>
              From Idea to Execution
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {[
              { 
                step: '01', 
                title: 'Connect Your Startup', 
                desc: "Bring your priorities, projects, and documents into a shared workspace.", 
                icon: Terminal 
              },
              { 
                step: '02', 
                title: 'Understand Your Business', 
                desc: "See critical tasks, emerging blockers, and cross-team dependencies at a glance.", 
                icon: Bot 
              },
              { 
                step: '03', 
                title: 'Move Work Forward', 
                desc: "Turn priorities into clear next steps with explicit owners and approvals.", 
                icon: Zap 
              },
              { 
                step: '04', 
                title: 'Track Progress', 
                desc: "Monitor execution and keep everyone aligned as your roadmap evolves.", 
                icon: LineChart 
              },
            ].map((st, idx) => {
              const StepIcon = st.icon;
              return (
                <div
                  key={idx}
                  className="p-8 rounded-[40px] border border-[#141413]/10 bg-white hover:border-[#141413]/30 hover:-translate-y-1 transition-all text-left relative group shadow-[rgba(0,0,0,0.04)_0px_4px_24px_0px]"
                >
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-3xl font-extrabold font-mono text-[#141413]/20 group-hover:text-[#141413]/40 transition-colors">{st.step}</span>
                    <div className="w-10 h-10 rounded-full bg-[#F3F0EE] border border-[#141413]/20 flex items-center justify-center">
                      <StepIcon className="w-5 h-5 text-[#141413]" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold mb-2 font-sans text-[#141413]" style={{letterSpacing: '-0.02em'}}>{st.title}</h3>
                  <p className="text-sm leading-[160%] text-[#696969] font-sans">{st.desc}</p>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* 5. PRICING SECTION */}
      <section id="pricing" className="py-36 px-6 relative bg-[#F3F0EE]">
        <div className="max-w-[1280px] mx-auto space-y-16">
          
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <span className="text-xs font-mono text-[#696969] uppercase tracking-widest font-bold">PRICING</span>
            <h2 className="text-4xl sm:text-5xl font-bold text-[#141413] tracking-tight font-sans" style={{letterSpacing: '-0.02em'}}>
              Simple Pricing
            </h2>

            {/* Toggle Billing Cycle */}
            <div className="inline-flex items-center gap-3 p-1.5 rounded-full bg-white border border-[#141413]/10 pt-2 shadow-[rgba(0,0,0,0.04)_0px_4px_24px_0px]">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-5 py-2 rounded-full text-xs font-medium transition-all cursor-pointer font-sans ${
                  billingCycle === 'monthly' ? 'bg-[#141413] text-[#F3F0EE] font-bold' : 'text-[#696969] hover:text-[#141413]'
                }`}
              >
                Monthly Billing
              </button>
              <button
                onClick={() => setBillingCycle('annual')}
                className={`px-5 py-2 rounded-full text-xs font-medium transition-all cursor-pointer font-sans flex items-center gap-1.5 ${
                  billingCycle === 'annual' ? 'bg-[#141413] text-[#F3F0EE] font-bold' : 'text-[#696969] hover:text-[#141413]'
                }`}
              >
                <span>Annual Billing</span>
                <span className="px-2 py-0.5 rounded-full bg-[#141413]/10 text-[#141413] text-[9px] font-bold">SAVE 20%</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            
            {/* Free Trial Plan */}
            <div className="p-8 rounded-[40px] bg-white border border-[#141413]/10 space-y-6 flex flex-col justify-between shadow-[rgba(0,0,0,0.04)_0px_4px_24px_0px]">
              <div className="space-y-4">
                <span className="text-xs font-mono text-[#696969] uppercase font-bold">FREE TRIAL</span>
                <div className="text-4xl font-extrabold text-[#141413] font-mono">₹0 <span className="text-xs text-[#696969] font-sans">/ month</span></div>
                <p className="text-xs text-[#696969] leading-[160%] font-sans">Explore core workflows for up to 2 users before committing.</p>

                <div className="space-y-2.5 text-xs pt-4 border-t border-[#141413]/10 font-sans">
                  <div className="flex items-center gap-2 text-[#696969]"><Check className="w-4 h-4 text-[#141413]" /> Core Workflows</div>
                  <div className="flex items-center gap-2 text-[#696969]"><Check className="w-4 h-4 text-[#141413]" /> Up to 2 Users</div>
                  <div className="flex items-center gap-2 text-[#696969]"><Check className="w-4 h-4 text-[#141413]" /> 14-Day Free Trial</div>
                </div>
              </div>

              <button onClick={onStartBuilding} className="w-full py-3.5 rounded-[20px] bg-white hover:bg-[#F3F0EE] border border-[#141413] text-[#141413] text-xs font-bold transition-all cursor-pointer font-sans">
                Start Free Trial
              </button>
            </div>

            {/* Starter Plan */}
            <div className="p-8 rounded-[40px] bg-white border border-[#141413]/10 space-y-6 flex flex-col justify-between shadow-[rgba(0,0,0,0.04)_0px_4px_24px_0px]">
              <div className="space-y-4">
                <span className="text-xs font-mono text-[#696969] uppercase font-bold">STARTER</span>
                <div className="text-4xl font-extrabold text-[#141413] font-mono">₹{billingCycle === 'annual' ? Math.round(999 * 0.8) : 999} <span className="text-xs text-[#696969] font-sans">/ month</span></div>
                <p className="text-xs text-[#696969] leading-[160%] font-sans">Clear visibility into daily work for early teams.</p>

                <div className="space-y-2.5 text-xs pt-4 border-t border-[#141413]/10 font-sans">
                  <div className="flex items-center gap-2 text-[#696969]"><Check className="w-4 h-4 text-[#141413]" /> Core Workspace</div>
                  <div className="flex items-center gap-2 text-[#696969]"><Check className="w-4 h-4 text-[#141413]" /> Blocker Tracking</div>
                  <div className="flex items-center gap-2 text-[#696969]"><Check className="w-4 h-4 text-[#141413]" /> Up to 5 Users</div>
                </div>
              </div>

              <button onClick={onStartBuilding} className="w-full py-3.5 rounded-[20px] bg-white hover:bg-[#F3F0EE] border border-[#141413] text-[#141413] text-xs font-bold transition-all cursor-pointer font-sans">
                Get Started
              </button>
            </div>

            {/* Growth Plan — Featured Ink Black Stadium */}
            <div className="p-8 rounded-[40px] bg-[#141413] border-2 border-[#141413] space-y-6 flex flex-col justify-between relative shadow-[rgba(0,0,0,0.25)_0px_70px_110px_0px] scale-[1.03]">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#F3F0EE] text-[#141413] text-[10px] font-mono font-bold uppercase tracking-wider shadow-md">
                MOST POPULAR
              </div>

              <div className="space-y-4">
                <span className="text-xs font-mono text-[#F3F0EE]/60 uppercase font-bold">GROWTH</span>
                <div className="text-4xl font-extrabold text-[#F3F0EE] font-mono">
                  ₹{billingCycle === 'annual' ? Math.round(2999 * 0.8) : 2999} <span className="text-xs text-[#F3F0EE]/50 font-sans">/ month</span>
                </div>
                <p className="text-xs text-[#F3F0EE]/70 leading-[160%] font-sans">For scaling teams coordinating projects and dependencies.</p>

                <div className="space-y-2.5 text-xs pt-4 border-t border-white/10 font-sans">
                  <div className="flex items-center gap-2 text-[#F3F0EE]/80"><Check className="w-4 h-4 text-[#F3F0EE]" /> Workflows &amp; Approvals</div>
                  <div className="flex items-center gap-2 text-[#F3F0EE]/80"><Check className="w-4 h-4 text-[#F3F0EE]" /> Multi-Agent Collaboration</div>
                  <div className="flex items-center gap-2 text-[#F3F0EE]/80"><Check className="w-4 h-4 text-[#F3F0EE]" /> Up to 15 Users</div>
                  <div className="flex items-center gap-2 text-[#F3F0EE]/80"><Check className="w-4 h-4 text-[#F3F0EE]" /> Priority Support</div>
                </div>
              </div>

              <button onClick={onStartBuilding} className="w-full py-4 rounded-[20px] bg-[#F3F0EE] hover:bg-white text-[#141413] text-xs font-bold transition-all cursor-pointer font-sans">
                Get Started
              </button>
            </div>

            {/* Custom Plan */}
            <div className="p-8 rounded-[40px] bg-white border border-[#141413]/10 space-y-6 flex flex-col justify-between shadow-[rgba(0,0,0,0.04)_0px_4px_24px_0px]">
              <div className="space-y-4">
                <span className="text-xs font-mono text-[#696969] uppercase font-bold">ENTERPRISE</span>
                <div className="text-4xl font-extrabold text-[#141413] font-mono">Custom</div>
                <p className="text-xs text-[#696969] leading-[160%] font-sans">Tailored deployment and dedicated support for organizations.</p>

                <div className="space-y-2.5 text-xs pt-4 border-t border-[#141413]/10 font-sans">
                  <div className="flex items-center gap-2 text-[#696969]"><Check className="w-4 h-4 text-[#141413]" /> Custom Deployment</div>
                  <div className="flex items-center gap-2 text-[#696969]"><Check className="w-4 h-4 text-[#141413]" /> Dedicated Support</div>
                  <div className="flex items-center gap-2 text-[#696969]"><Check className="w-4 h-4 text-[#141413]" /> Flexible Team Limits</div>
                </div>
              </div>

              <button onClick={onStartBuilding} className="w-full py-3.5 rounded-[20px] bg-white hover:bg-[#F3F0EE] border border-[#141413] text-[#141413] text-xs font-bold transition-all cursor-pointer font-sans">
                Contact Sales
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* 6. FAQ ACCORDION SECTION */}
      <section id="faq" className="py-36 px-6 bg-[#FCFBFA] border-y border-[#141413]/10">
        <div className="max-w-3xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <span className="text-xs font-mono text-[#696969] uppercase tracking-widest font-bold">FAQ</span>
            <h2 className="text-4xl sm:text-5xl font-bold text-[#141413] tracking-tight font-sans" style={{letterSpacing: '-0.02em'}}>
              Questions &amp; Answers
            </h2>
          </div>

          <div className="space-y-3.5">
            {faqs.map((faq, idx) => (
              <div key={idx} className="rounded-[20px] bg-white border border-[#141413]/10 overflow-hidden shadow-[rgba(0,0,0,0.02)_0px_4px_16px_0px]">
                <button
                  onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                  className="w-full p-6 text-left font-bold text-base text-[#141413] flex items-center justify-between cursor-pointer font-sans"
                >
                  <span>{faq.question}</span>
                  {activeFaq === idx ? <Minus className="w-4 h-4 text-[#141413]" /> : <Plus className="w-4 h-4 text-[#696969]" />}
                </button>
                {activeFaq === idx && (
                  <div className="px-6 pb-6 text-sm text-[#696969] leading-[160%] border-t border-[#141413]/10 pt-4 font-sans">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. FINAL CTA SECTION — INK BLACK STADIUM ON CREAM */}
      <section className="py-36 px-6 relative overflow-hidden bg-[#F3F0EE]">

        <div className="max-w-5xl mx-auto p-12 sm:p-16 rounded-[40px] bg-[#141413] text-center space-y-6 relative z-10 shadow-[rgba(0,0,0,0.25)_0px_70px_110px_0px]">
          
          {/* Animated Rocket Lottie Animation Emblem */}
          <div className="w-20 h-20 mx-auto relative flex items-center justify-center">
            <DotLottieReact
              src="https://lottie.host/397854e7-c7d6-4622-b2d8-8c254f95320a/KB1JbtgXrH.lottie"
              loop
              autoplay
              style={{ width: '100%', height: '100%' }}
            />
          </div>

          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight font-sans" style={{letterSpacing: '-0.02em'}}>
            Bring Your Startup's Work Into Focus.
          </h2>

          <p className="text-white/70 text-base sm:text-lg max-w-lg mx-auto leading-[160%] font-sans">
            Get total clarity on your priorities, blockers, and team responsibilities. Start free today.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <button
              onClick={onStartBuilding}
              className="w-full sm:w-auto px-10 py-4 rounded-[20px] bg-[#F3F0EE] hover:bg-white text-[#141413] font-bold text-sm transition-all cursor-pointer font-sans"
            >
              Start Free Trial
            </button>
          </div>
        </div>
      </section>

      {/* 8. INK BLACK EDITORIAL FOOTER */}
      <footer id="about" className="py-20 px-6 bg-[#141413]">
        <div className="max-w-[1280px] mx-auto grid grid-cols-2 md:grid-cols-5 gap-10 text-xs">
          
          <div className="col-span-2 space-y-4">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <div className="w-8 h-8 rounded-lg bg-[#F3F0EE]/10 border border-white/20 p-1 flex items-center justify-center">
                <CatalystLogo className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-white text-lg font-sans" style={{letterSpacing: '-0.02em'}}>CatalystOS</span>
            </div>
            <p className="text-white/50 max-w-xs leading-[160%] font-sans">
              A workspace for startup priorities, dependencies, and execution.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="font-mono text-white/50 font-bold uppercase text-[10px] tracking-wider">Product</h4>
            <ul className="space-y-2.5 text-white/60 font-sans">
              <li><a href="#solutions" className="hover:text-white transition-colors cursor-pointer">Product Overview</a></li>
              <li><a href="#execution" className="hover:text-white transition-colors cursor-pointer">Process</a></li>
              <li><a href="#pricing" className="hover:text-white transition-colors cursor-pointer">Pricing</a></li>
              <li><a href="#faq" className="hover:text-white transition-colors cursor-pointer">FAQ</a></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="font-mono text-white/50 font-bold uppercase text-[10px] tracking-wider">Workflows</h4>
            <ul className="space-y-2.5 text-white/60 font-sans">
              <li><a href="#solutions" className="hover:text-white transition-colors cursor-pointer">Launch Readiness</a></li>
              <li><a href="#solutions" className="hover:text-white transition-colors cursor-pointer">Team Operations</a></li>
              <li><a href="#solutions" className="hover:text-white transition-colors cursor-pointer">Founder Approvals</a></li>
              <li><a href="#solutions" className="hover:text-white transition-colors cursor-pointer">Treasury &amp; Runway</a></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="font-mono text-white/50 font-bold uppercase text-[10px] tracking-wider">Get Started</h4>
            <ul className="space-y-2.5 text-white/60 font-sans">
              <li><span onClick={onStartBuilding} className="hover:text-white transition-colors cursor-pointer">Sign In</span></li>
              <li><span onClick={onStartBuilding} className="hover:text-white transition-colors cursor-pointer">Start Free Trial</span></li>
              <li><span onClick={() => onDemoLogin && onDemoLogin()} className="hover:text-white transition-colors cursor-pointer">Interactive Demo</span></li>
            </ul>
          </div>

        </div>

        <div className="max-w-[1280px] mx-auto pt-14 mt-14 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-white/40 gap-4">
          <span>© {new Date().getFullYear()} CatalystOS Inc. All rights reserved.</span>
        </div>
      </footer>

    </div>
  );
}
