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
  Shield, 
  ShieldCheck, 
  Lock, 
  Check, 
  CheckCircle2, 
  Zap, 
  TrendingUp, 
  Users, 
  Bot, 
  Cpu, 
  LineChart, 
  FileText, 
  ChevronDown, 
  ChevronUp, 
  Star, 
  Play, 
  Building2, 
  Rocket, 
  Search, 
  Globe, 
  Activity, 
  DollarSign, 
  Layers, 
  Plus, 
  Minus, 
  HelpCircle, 
  Send, 
  Terminal, 
  X, 
  Menu,
  Clock,
  ArrowUpRight,
  Briefcase,
  Award,
  ChevronRight
} from 'lucide-react';
import CatalystLogo from './CatalystLogo';

import { 
  SiVercel, 
  SiSupabase, 
  SiGooglecloud, 
  SiNvidia, 
  SiCloudflare 
} from 'react-icons/si';

import { FaDocker, FaStripe, FaGithub, FaAws, FaBrain } from 'react-icons/fa6';

interface HackathonLandingPageProps {
  onStartBuilding: () => void;
  onDemoLogin?: () => void;
}

export default function HackathonLandingPage({ onStartBuilding, onDemoLogin }: HackathonLandingPageProps) {
  const [scrolled, setScrolled] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [activeAgent, setActiveAgent] = useState<'hiring' | 'finance' | 'legal' | 'investment' | 'growth'>('hiring');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [lottieError, setLottieError] = useState(false);
  const [demoDropdownOpen, setDemoDropdownOpen] = useState(false);

  // Workspace typing simulation state
  const [typingText, setTypingText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingDone, setTypingDone] = useState(false);

  const hiringTypingMsg = "I've analysed 47 applicants for your Senior Backend Engineer role. Three candidates stand out based on your criteria — strong Rust/TypeScript background, startup experience, and immediate availability.";
  const financeTypingMsg = "I've reviewed your June SaaS subscriptions. We can reclaim ₹82,000/month by archiving 14 inactive Slack accounts and deprecating the old testing server.";
  const legalTypingMsg = "Your custom NDA draft is ready. I've incorporated local intellectual property clauses and standard startup non-solicits. Ready for sign-off.";
  const investmentTypingMsg = "Here is your pre-meeting prep sheet for Sequoia. Key metric highlight: your ARR growth rate is in the top decile for SaaS startups at this stage.";
  const growthTypingMsg = "Based on your current MRR of ₹8.4L, I recommend launching a referral program targeting your top 20% power users. Estimated uplift: +18% signups in 60 days.";

  useEffect(() => {
    setTypingText('');
    setTypingDone(false);
    setIsTyping(false);
    const delay = setTimeout(() => {
      setIsTyping(true);
      const msg = 
        activeAgent === 'hiring' ? hiringTypingMsg : 
        activeAgent === 'finance' ? financeTypingMsg : 
        activeAgent === 'legal' ? legalTypingMsg : 
        activeAgent === 'investment' ? investmentTypingMsg : 
        activeAgent === 'growth' ? growthTypingMsg : '';
      if (!msg) { setIsTyping(false); setTypingDone(true); return; }
      let i = 0;
      const timer = setInterval(() => {
        setTypingText(msg.slice(0, i + 1));
        i++;
        if (i >= msg.length) { clearInterval(timer); setIsTyping(false); setTypingDone(true); }
      }, 10);
      return () => clearInterval(timer);
    }, 150);
    return () => clearTimeout(delay);
  }, [activeAgent]);

  // Dynamic Cursor Spotlight
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

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

  const partnerLogos = [
    { name: 'Techstars', icon: Award },
    { name: 'Y Combinator', icon: Rocket },
    { name: 'Vercel', icon: SiVercel },
    { name: 'Stripe', icon: FaStripe },
    { name: 'Docker', icon: FaDocker },
    { name: 'AWS', icon: FaAws },
    { name: 'GitHub', icon: FaGithub },
    { name: 'Google Cloud', icon: SiGooglecloud },
    { name: 'NVIDIA', icon: SiNvidia },
    { name: 'Cloudflare', icon: SiCloudflare },
  ];



  const testimonials = [
    {
      quote: "CatalystOS became our executive team overnight.",
      author: "Sarah Khan",
      role: "CEO, TechScale",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
    },
    {
      quote: "The finance module alone saved us ₹32 Lakhs in the first quarter.",
      author: "Verified Growth Founder",
      role: "Founder",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80"
    },
    {
      quote: "From planning to hiring — everything we need in one place.",
      author: "Verified Operations Lead",
      role: "COO",
      avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80"
    }
  ];

  const faqs = [
    {
      question: "What is CatalystOS?",
      answer: "An AI-powered platform that gives founders an autonomous executive team to plan, execute, and scale."
    },
    {
      question: "Which AI advisors are included?",
      answer: "Our council includes specialized AI agents for strategy (CEO), treasury (CFO), engineering (CTO), growth (CMO), operations (COO), and hiring (HR)."
    },
    {
      question: "Can I invite my team?",
      answer: "Yes. Collaborate seamlessly with your human team members and delegate workflows to AI executive agents directly."
    },
    {
      question: "Is my startup data secure?",
      answer: "Yes. We protect your data with end-to-end encryption, secure sandboxing, and strict privacy controls."
    },
    {
      question: "Can I integrate with my existing tools?",
      answer: "Yes. Connect with developer tools, payment platforms, chat systems, and other developer tools via the Model Context Protocol."
    },
    {
      question: "Do you offer a free trial?",
      answer: "Yes. Start with a 14-day free trial to explore all CatalystOS capabilities before selecting a plan."
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
            <a href="#solutions" className="hover:text-[#141413] transition-colors">AI Team</a>
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

      {/* 2. HERO SECTION - CREAM CANVAS EDITORIAL */}
      <section className="pt-48 pb-28 px-6 relative overflow-hidden">

        <div className="max-w-[1280px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Editorial Copy */}
          <div className="lg:col-span-6 space-y-8 text-left z-10 max-w-[560px]">
            
            <h1 
              className="gsap-hero-title text-5xl sm:text-7xl lg:text-[80px] font-bold text-[#141413] leading-[0.95] font-sans"
              style={{letterSpacing: '-0.02em'}}
            >
              From Idea to Launch.<br />One AI Operating System.
            </h1>

            <p 
              className="gsap-hero-sub text-[#696969] text-lg leading-[170%] font-sans"
            >
              Everything you need to take your startup from idea to launch, with AI by your side.
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

              <div className="relative">
                <button
                  onMouseEnter={() => setDemoDropdownOpen(true)}
                  onMouseLeave={() => setDemoDropdownOpen(false)}
                  className="w-full sm:w-auto px-8 py-4 bg-transparent hover:bg-[#F37338]/10 text-[#F3F0EE] border border-[#F37338]/30 font-medium text-[15px] transition-all flex items-center justify-center gap-2 font-sans rounded-[20px]"
                >
                  <Play className="w-4 h-4 text-[#F37338]" />
                  <span className="text-[#141413]">Interactive Demo</span>
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
                      className="absolute left-0 mt-2 w-56 bg-white border border-[#141413]/10 rounded-[16px] shadow-[rgba(0,0,0,0.1)_0px_10px_30px] overflow-hidden z-50 p-2"
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
                          <div className="text-[10px] text-[#696969] font-sans">See RAG capabilities</div>
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
                          <div className="text-[10px] text-[#696969] font-sans">Explore the SaaS app</div>
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
                /* High-fidelity Vector Robot Matching Exactly the User Screenshot */
                <svg viewBox="0 0 500 500" className="w-full h-full drop-shadow-xl select-none" fill="none">
                  {/* Subtle Floor Shadow */}
                  <ellipse cx="250" cy="430" rx="140" ry="24" fill="#141413" fillOpacity="0.08" />
                  
                  {/* Robot Body */}
                  <g className="animate-[bounce_4s_ease-in-out_infinite]">
                    {/* Torso */}
                    <path d="M200 300 C200 370 300 370 300 300 Z" fill="#FFFFFF" stroke="#E5E0DB" strokeWidth="3" />
                    <path d="M215 310 C215 355 285 355 285 310 Z" fill="#F3F0EE" />

                    {/* Left Arm Resting */}
                    <path d="M190 280 Q165 310 175 350 Q185 355 195 330 Q200 295 190 280 Z" fill="#FFFFFF" stroke="#E5E0DB" strokeWidth="2.5" />
                    
                    {/* Right Arm Waving */}
                    <path d="M305 280 Q340 270 350 230 Q340 220 325 240 Q310 265 305 280 Z" fill="#FFFFFF" stroke="#E5E0DB" strokeWidth="2.5" />
                    
                    {/* Head */}
                    <rect x="155" y="160" width="190" height="150" rx="75" fill="#FFFFFF" stroke="#E5E0DB" strokeWidth="3" />
                    
                    {/* Ear Antennas */}
                    <rect x="145" y="215" width="14" height="40" rx="7" fill="#E5E0DB" />
                    <rect x="341" y="215" width="14" height="40" rx="7" fill="#E5E0DB" />
                    
                    {/* Visor Screen */}
                    <rect x="180" y="195" width="140" height="75" rx="36" fill="#141413" />
                    
                    {/* Glowing Cyan Blue Visor Eyes */}
                    <rect x="205" y="220" width="14" height="26" rx="7" fill="#00D2FF" />
                    <rect x="281" y="220" width="14" height="26" rx="7" fill="#00D2FF" />
                  </g>
                </svg>
              )}

              {/* Floating AI Notification Badges — white cards on cream */}
              <div 
                className="gsap-float-badge-1 absolute top-2 sm:-top-4 left-0 sm:-left-6 p-3 sm:p-3.5 rounded-[18px] sm:rounded-[20px] bg-white shadow-[rgba(0,0,0,0.08)_0px_20px_40px_0px] border border-[#141413]/10 flex items-center gap-2.5 sm:gap-3 z-30"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#F3F0EE] border border-[#141413]/20 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#141413]" />
                </div>
                <div>
                  <span className="text-[9px] font-mono text-[#696969] uppercase font-bold block">CEO AGENT</span>
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
                  <span className="text-[9px] font-mono text-[#696969] uppercase font-bold block">CFO AGENT</span>
                  <span className="text-xs font-bold text-[#141413] font-sans">13.2-Month Runway Verified</span>
                </div>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* Floating Bottom Right CatalystOS Quick Action Widget */}
      <div className="fixed bottom-6 right-6 z-40 hidden sm:block">
        <button
          onClick={() => onDemoLogin ? onDemoLogin() : onStartBuilding()}
          title="Open CatalystOS Demo"
          className="p-3.5 bg-white text-[#141413] rounded-2xl border border-[#141413]/10 shadow-[rgba(0,0,0,0.12)_0px_10px_30px_0px] hover:scale-105 transition-transform flex items-center justify-center cursor-pointer group"
        >
          <CatalystLogo className="w-5 h-5 text-[#141413] group-hover:rotate-12 transition-transform" />
        </button>
      </div>

      {/* 3. TRUST BAR (REMOVED) */}

      {/* 4. FEATURES BENTO GRID SECTION */}


      {/* 5. MEET YOUR AI TEAM SECTION */}
      <section id="solutions" className="py-36 px-6 bg-[#F3F0EE] border-y border-[#141413]/10 relative overflow-hidden">
        {/* Ghost watermark headline */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
          <span className="text-[200px] font-black text-[#141413]/[0.025] font-sans whitespace-nowrap" style={{letterSpacing: '-0.04em'}}>AI TEAM</span>
        </div>

        <div className="max-w-[1280px] mx-auto space-y-16 relative">

          {/* Section header */}
          <div className="gsap-scroll-section text-center space-y-4 max-w-2xl mx-auto">
            <span className="text-xs font-mono text-[#696969] uppercase tracking-widest font-bold">• AI WORKSPACE</span>

            <h2 className="text-4xl sm:text-5xl font-bold text-[#141413] font-sans" style={{letterSpacing: '-0.02em'}}>
              Meet Your AI Team
            </h2>
            <p className="text-[#696969] text-base leading-[170%] font-sans max-w-xl mx-auto">
              Every AI agent specialises in one part of building your startup. They work together, so you don't have to switch between tools.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

            {/* ── Left: Agent Navigation ── */}
            <div className="lg:col-span-4 space-y-2.5">
              {([
                { key: 'hiring',     label: 'Hiring',     sub: 'Recruitment & JD builder',   icon: Users },
                { key: 'finance',    label: 'Finance',    sub: 'Burn, runway & budgets',       icon: DollarSign },
                { key: 'legal',      label: 'Legal',      sub: 'Contracts & NDA generator',   icon: FileText },
                { key: 'investment', label: 'Investment', sub: 'Investor prep & decks',       icon: TrendingUp },
                { key: 'growth',     label: 'Growth',     sub: 'GTM strategy & campaigns',    icon: Rocket },
              ] as const).map((agent) => {
                const isActive = activeAgent === agent.key;
                const AgentIcon = agent.icon;
                return (
                  <button
                    key={agent.key}
                    onClick={() => setActiveAgent(agent.key)}
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
                        <AgentIcon className={`w-4 h-4 ${isActive ? 'text-[#F3F0EE]' : 'text-[#141413]'}`} />
                      </div>
                      <div>
                        <div className={`text-sm font-bold leading-tight ${isActive ? 'text-[#F3F0EE]' : 'text-[#141413]'}`}>{agent.label}</div>
                        <div className={`text-[10px] font-mono mt-0.5 ${isActive ? 'text-[#F3F0EE]/55' : 'text-[#696969]'}`}>{agent.sub}</div>
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

            {/* ── Right: Workspace Preview ── */}
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
                      CatalystOS — {activeAgent.charAt(0).toUpperCase() + activeAgent.slice(1)} Workspace
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-mono text-[#696969]">LIVE</span>
                  </div>
                </div>

                {/* Workspace content — switches by agent */}
                <div className="p-6 min-h-[480px]">

                  {/* ── HIRING WORKSPACE ── */}
                  {activeAgent === 'hiring' && (
                    <div className="space-y-4 animate-fadeIn">
                      {/* AI Agent Chat */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-6 h-6 rounded-full bg-[#141413] flex items-center justify-center">
                            <Bot className="w-3 h-3 text-[#F3F0EE]" />
                          </div>
                          <span className="text-[10px] font-mono font-bold text-[#696969] uppercase">Hiring Agent</span>
                        </div>
                        <div className="bg-[#FCFBFA] border border-[#141413]/10 rounded-[16px] p-4 min-h-[76px] flex items-center">
                          <p className="text-sm text-[#141413] leading-relaxed font-sans">
                            {typingText}
                            {isTyping && <span className="inline-block w-0.5 h-4 bg-[#141413] ml-0.5 animate-pulse align-middle" />}
                          </p>
                        </div>
                      </div>

                      {/* JD Generator + Resume Upload */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-4 rounded-[16px] bg-[#F3F0EE] border border-[#141413]/10 space-y-2">
                          <div className="flex items-center gap-2">
                            <FileText className="w-3.5 h-3.5 text-[#141413]" />
                            <span className="text-[10px] font-mono font-bold text-[#141413] uppercase">Create Job Description</span>
                          </div>
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              value="Senior Backend Engineer"
                              readOnly
                              className="flex-1 bg-white border border-[#141413]/10 rounded-[12px] px-3 py-1.5 text-[11px] text-[#141413] focus:outline-none"
                            />
                            <button className="px-3 py-1 bg-[#141413] text-[#F3F0EE] rounded-[12px] text-[10px] font-bold font-sans hover:bg-[#262627] transition-all">
                              Create
                            </button>
                          </div>
                          <div className="p-2.5 bg-white rounded-[12px] border border-[#141413]/05">
                            <p className="text-[10px] text-[#696969] leading-relaxed font-sans">
                              <strong>Preview:</strong> 5+ yrs Rust/Go, distributed systems, high concurrency.
                            </p>
                          </div>
                        </div>
                        
                        <div className="p-4 rounded-[16px] bg-[#F3F0EE] border border-[#141413]/10 space-y-2 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Plus className="w-3.5 h-3.5 text-[#141413]" />
                              <span className="text-[10px] font-mono font-bold text-[#141413] uppercase">Resume Upload</span>
                            </div>
                            <div className="border-2 border-dashed border-[#141413]/15 rounded-[12px] p-3 text-center bg-white/50">
                              <p className="text-[10px] text-[#696969] font-sans">Drop CVs here or browse</p>
                              <p className="text-[9px] font-mono text-[#696969]/60 mt-0.5">PDF, DOCX accepted</p>
                            </div>
                          </div>
                          <button className="w-full py-1.5 bg-white hover:bg-[#F3F0EE] border border-[#141413]/10 text-[#141413] rounded-[12px] text-[10px] font-bold font-sans transition-all">
                            Parse Resumes
                          </button>
                        </div>
                      </div>

                      {/* Candidate ranking */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-mono font-bold text-[#696969] uppercase">Candidate Ranking — ATS Score</span>
                        {[
                          { name: 'Arjun Mehta', score: 94, tag: 'Rust · Go · AWS' },
                          { name: 'Priya Sharma', score: 88, tag: 'Node · PostgreSQL · Docker' },
                          { name: 'Rohan Das',   score: 81, tag: 'Python · FastAPI · k8s' },
                        ].map((c, i) => (
                          <div key={i} className="flex items-center gap-3 p-3 rounded-[12px] bg-[#FCFBFA] border border-[#141413]/08">
                            <div className="w-7 h-7 rounded-full bg-[#141413] flex items-center justify-center text-[10px] font-bold text-[#F3F0EE] font-mono shrink-0">{c.name.split(' ').map(n => n[0]).join('')}</div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-bold text-[#141413] font-sans">{c.name}</div>
                              <div className="text-[10px] font-mono text-[#696969]">{c.tag}</div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="h-1.5 w-16 bg-[#F3F0EE] rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-600 rounded-full transition-all duration-500" style={{ width: `${c.score}%` }} />
                              </div>
                              <span className="text-[10px] font-mono font-bold text-emerald-700 w-7 text-right">{c.score}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── FINANCE WORKSPACE ── */}
                  {activeAgent === 'finance' && (
                    <div className="space-y-4 animate-fadeIn">
                      {/* AI Agent Chat */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-6 h-6 rounded-full bg-[#141413] flex items-center justify-center">
                            <Bot className="w-3 h-3 text-[#F3F0EE]" />
                          </div>
                          <span className="text-[10px] font-mono font-bold text-[#696969] uppercase">Finance Agent</span>
                        </div>
                        <div className="bg-[#FCFBFA] border border-[#141413]/10 rounded-[16px] p-4 min-h-[76px] flex items-center">
                          <p className="text-sm text-[#141413] leading-relaxed font-sans">
                            {typingText}
                            {isTyping && <span className="inline-block w-0.5 h-4 bg-[#141413] ml-0.5 animate-pulse align-middle" />}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: 'Monthly Burn',   value: '₹14.2L',  sub: '+₹1.1L vs last month', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-100' },
                          { label: 'Cash Runway',    value: '11.4 mo', sub: 'At current burn rate',  color: 'text-amber-700', bg: 'bg-amber-50 border-amber-100' },
                          { label: 'Cash Available', value: '₹1.62Cr', sub: 'As of today',            color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100' },
                        ].map((m, i) => (
                          <div key={i} className={`p-4 rounded-[16px] border ${m.bg}`}>
                            <span className="text-[10px] font-mono font-bold text-[#696969] uppercase block mb-1">{m.label}</span>
                            <span className={`text-2xl font-black font-mono ${m.color}`}>{m.value}</span>
                            <span className="text-[10px] font-mono text-[#696969] block mt-1">{m.sub}</span>
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

                      {/* AI Recommendation */}
                      <div className="p-4 rounded-[16px] bg-[#141413] space-y-2">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-[#F3F0EE]/70" />
                          <span className="text-[10px] font-mono font-bold text-[#F3F0EE]/70 uppercase">AI Recommendation</span>
                        </div>
                        <p className="text-sm text-[#F3F0EE] leading-relaxed font-sans">
                          Delaying one planned hire extends your runway by <strong>1.4 months</strong>.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ── LEGAL WORKSPACE ── */}
                  {activeAgent === 'legal' && (
                    <div className="space-y-4 animate-fadeIn">
                      {/* AI Agent Chat */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-6 h-6 rounded-full bg-[#141413] flex items-center justify-center">
                            <Bot className="w-3 h-3 text-[#F3F0EE]" />
                          </div>
                          <span className="text-[10px] font-mono font-bold text-[#696969] uppercase">Legal Agent</span>
                        </div>
                        <div className="bg-[#FCFBFA] border border-[#141413]/10 rounded-[16px] p-4 min-h-[76px] flex items-center">
                          <p className="text-sm text-[#141413] leading-relaxed font-sans">
                            {typingText}
                            {isTyping && <span className="inline-block w-0.5 h-4 bg-[#141413] ml-0.5 animate-pulse align-middle" />}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: 'Generate NDA',          icon: FileText, ready: true },
                          { label: 'Employee Contract',      icon: Briefcase, ready: true },
                          { label: 'Founder Agreement',      icon: Users, ready: false },
                          { label: 'IP Assignment Deed',     icon: Lock, ready: false },
                        ].map((doc, i) => (
                          <button key={i} className={`p-4 rounded-[16px] border text-left transition-all group ${
                            doc.ready
                              ? 'bg-white border-[#141413]/15 hover:border-[#141413]/40 hover:shadow-[rgba(0,0,0,0.06)_0px_4px_16px_0px] cursor-pointer'
                              : 'bg-[#F3F0EE] border-[#141413]/08 opacity-60 cursor-default'
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <doc.icon className="w-4 h-4 text-[#141413]" />
                              {doc.ready
                                ? <span className="text-[9px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">READY</span>
                                : <span className="text-[9px] font-mono font-bold text-[#696969] bg-[#F3F0EE] border border-[#141413]/10 px-1.5 py-0.5 rounded-full">SOON</span>
                              }
                            </div>
                            <div className="text-xs font-bold text-[#141413] font-sans">{doc.label}</div>
                          </button>
                        ))}
                      </div>

                      {/* Document preview */}
                      <div className="p-4 rounded-[16px] bg-[#FCFBFA] border border-[#141413]/10 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold text-[#141413] uppercase">NDA Preview</span>
                          <button className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-[#141413] bg-white border border-[#141413]/15 px-3 py-1.5 rounded-full hover:bg-[#F3F0EE] transition-all cursor-pointer">
                            <ArrowUpRight className="w-3 h-3" /> Download PDF
                          </button>
                        </div>
                        <div className="space-y-2 font-mono text-[11px] text-[#696969] leading-relaxed">
                          <div className="h-2 bg-[#141413]/10 rounded-full w-3/4" />
                          <div className="h-2 bg-[#141413]/08 rounded-full w-full" />
                          <div className="h-2 bg-[#141413]/08 rounded-full w-5/6" />
                          <div className="h-2 bg-[#141413]/06 rounded-full w-4/5" />
                          <div className="h-2 bg-[#141413]/08 rounded-full w-full" />
                          <div className="h-2 bg-[#141413]/06 rounded-full w-2/3" />
                        </div>
                        <p className="text-[10px] font-mono text-[#696969] pt-1">This Non-Disclosure Agreement is entered into by <strong className="text-[#141413]">CatalystOS Inc.</strong> and the undersigned party on the effective date above...</p>
                      </div>
                    </div>
                  )}

                  {/* ── INVESTMENT WORKSPACE ── */}
                  {activeAgent === 'investment' && (
                    <div className="space-y-4 animate-fadeIn">
                      {/* AI Agent Chat */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-6 h-6 rounded-full bg-[#141413] flex items-center justify-center">
                            <Bot className="w-3 h-3 text-[#F3F0EE]" />
                          </div>
                          <span className="text-[10px] font-mono font-bold text-[#696969] uppercase">Investment Agent</span>
                        </div>
                        <div className="bg-[#FCFBFA] border border-[#141413]/10 rounded-[16px] p-4 min-h-[76px] flex items-center">
                          <p className="text-sm text-[#141413] leading-relaxed font-sans">
                            {typingText}
                            {isTyping && <span className="inline-block w-0.5 h-4 bg-[#141413] ml-0.5 animate-pulse align-middle" />}
                          </p>
                        </div>
                      </div>

                      {/* Upcoming meeting */}
                      <div className="p-4 rounded-[16px] bg-[#141413] flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-mono font-bold text-[#F3F0EE]/60 uppercase">Upcoming Investor Meeting</span>
                          <div className="text-sm font-bold text-[#F3F0EE] mt-0.5 font-sans">Sequoia India — Seed Round Call</div>
                          <div className="text-[10px] font-mono text-[#F3F0EE]/50 mt-0.5">Tomorrow · 3:00 PM IST · Google Meet</div>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1.5">
                          <Clock className="w-3 h-3 text-[#F3F0EE]/70" />
                          <span className="text-[10px] font-mono text-[#F3F0EE] font-bold">17h away</span>
                        </div>
                      </div>

                      {/* Startup metrics */}
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { label: 'MRR',       value: '₹8.4L' },
                          { label: 'ARR',       value: '₹1.0Cr' },
                          { label: 'Growth',    value: '+24%' },
                          { label: 'NPS',       value: '72' },
                        ].map((m, i) => (
                          <div key={i} className="p-3 rounded-[12px] bg-[#F3F0EE] border border-[#141413]/10 text-center">
                            <div className="text-[10px] font-mono text-[#696969] uppercase">{m.label}</div>
                            <div className="text-base font-black font-mono text-[#141413] mt-0.5">{m.value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Investor update draft */}
                      <div className="p-4 rounded-[16px] bg-[#FCFBFA] border border-[#141413]/10 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold text-[#141413] uppercase">Investor Update Draft</span>
                          <button className="text-[10px] font-mono font-bold text-[#141413] underline underline-offset-2">Edit Draft</button>
                        </div>
                        <p className="text-xs text-[#696969] leading-relaxed font-sans">
                          <strong className="text-[#141413]">Progress:</strong> Crossed ₹8.4L MRR (+24% MoM). Onboarded 12 new clients. Engineering team expanded to 6 FTEs.
                        </p>
                        <p className="text-xs text-[#696969] leading-relaxed font-sans">
                          <strong className="text-[#141413]">Ask:</strong> We are raising ₹4.5Cr seed to accelerate GTM, expand sales team, and hit ₹3Cr ARR by Q4.
                        </p>
                      </div>

                      {/* Meeting notes area */}
                      <div className="p-4 rounded-[16px] bg-[#F3F0EE] border border-[#141413]/10">
                        <span className="text-[10px] font-mono font-bold text-[#696969] uppercase block mb-2">Meeting Notes</span>
                        <div className="text-xs text-[#696969] font-sans italic">Agent will auto-transcribe and summarise your investor call in real-time...</div>
                      </div>
                    </div>
                  )}

                  {/* ── GROWTH WORKSPACE ── */}
                  {activeAgent === 'growth' && (
                    <div className="space-y-4 animate-fadeIn">
                      {/* AI Agent Chat */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-6 h-6 rounded-full bg-[#141413] flex items-center justify-center">
                            <Bot className="w-3 h-3 text-[#F3F0EE]" />
                          </div>
                          <span className="text-[10px] font-mono font-bold text-[#696969] uppercase">Growth Agent</span>
                        </div>
                        <div className="bg-[#FCFBFA] border border-[#141413]/10 rounded-[16px] p-4 min-h-[76px] flex items-center">
                          <p className="text-sm text-[#141413] leading-relaxed font-sans">
                            {typingText}
                            {isTyping && <span className="inline-block w-0.5 h-4 bg-[#141413] ml-0.5 animate-pulse align-middle" />}
                          </p>
                        </div>
                      </div>

                      {/* GTM Strategy & Campaign Generator */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-4 rounded-[16px] bg-[#F3F0EE] border border-[#141413]/10 space-y-2">
                          <span className="text-[10px] font-mono font-bold text-[#696969] uppercase block mb-1">GTM Strategy — Q3 Sprint</span>
                          <div className="space-y-1.5">
                            {[
                              { label: 'LinkedIn outreach campaign',        done: true },
                              { label: 'Developer newsletter — Issue #3',   done: true },
                              { label: 'Product Hunt launch prep',          done: false },
                              { label: 'B2B landing page A/B test',         done: false },
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

                        <div className="p-4 rounded-[16px] bg-[#F3F0EE] border border-[#141413]/10 space-y-2 flex flex-col justify-between">
                          <div>
                            <span className="text-[10px] font-mono font-bold text-[#696969] uppercase block mb-1.5">Marketing Campaign Generator</span>
                            <input 
                              type="text" 
                              value="Developer referral loop"
                              readOnly
                              className="w-full bg-white border border-[#141413]/10 rounded-[12px] px-3 py-1.5 text-[11px] text-[#141413] focus:outline-none mb-2"
                            />
                          </div>
                          <button className="w-full py-1.5 bg-[#141413] hover:bg-[#262627] text-white rounded-[12px] text-[10px] font-bold font-sans transition-all">
                            Generate Campaign
                          </button>
                        </div>
                      </div>

                      {/* Campaign timeline */}
                      <div className="p-4 rounded-[16px] bg-[#FCFBFA] border border-[#141413]/10 space-y-2">
                        <span className="text-[10px] font-mono font-bold text-[#141413] uppercase">Campaign Timeline</span>
                        <div className="flex items-center gap-0 text-[10px] font-mono">
                          {['Week 1', 'Week 2', 'Week 3', 'Week 4'].map((w, i) => (
                            <div key={i} className={`flex-1 py-2 text-center border-r last:border-r-0 border-[#141413]/08 ${
                              i < 2 ? 'text-[#141413] font-bold bg-[#141413]/05' : 'text-[#696969]'
                            }`}>{w}</div>
                          ))}
                        </div>
                        <div className="text-[10px] text-[#696969] font-sans">
                          <strong className="text-[#141413]">Suggested next action:</strong> Post the developer case study to Hacker News — your audience overlap with YC alumni is 68%.
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

      {/* 6. SECURITY SECTION (REMOVED) */}

      {/* 7. HOW IT WORKS */}
      <section id="execution" className="py-36 px-6 bg-[#FCFBFA] border-y border-[#141413]/10">
        <div className="max-w-[1280px] mx-auto space-y-16 text-center">
          
          <div className="space-y-4 max-w-2xl mx-auto">
            <span className="text-xs font-mono text-[#696969] uppercase tracking-widest font-bold">HOW IT WORKS</span>
            <h2 className="text-4xl sm:text-5xl font-bold text-[#141413] tracking-tight font-sans" style={{letterSpacing: '-0.02em'}}>
              From Idea to Execution
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {[
              { step: '01', title: 'Connect Your Startup', desc: 'Securely set up your workspace and provide your business context.', icon: Terminal },
              { step: '02', title: 'AI Understands Your Business', desc: 'CatalystOS builds context across your startup to deliver personalized recommendations.', icon: Bot },
              { step: '03', title: 'Execute with AI', desc: 'Collaborative AI agents help plan work, automate tasks, and support better decisions.', icon: Zap },
              { step: '04', title: 'Track & Scale', desc: 'Monitor progress, measure growth, and continuously improve as your startup evolves.', icon: LineChart },
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
                  <p className="text-sm leading-[170%] text-[#696969] font-sans">{st.desc}</p>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* 8. METRICS SECTION (REMOVED) */}

      {/* 9. TESTIMONIALS SECTION (REMOVED) */}

      {/* 10. PRICING SECTION */}
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
                <p className="text-xs text-[#696969] leading-[170%] font-sans">Explore CatalystOS with a 14-day free trial.</p>

                <div className="space-y-2.5 text-xs pt-4 border-t border-[#141413]/10 font-sans">
                  <div className="flex items-center gap-2 text-[#696969]"><Check className="w-4 h-4 text-[#141413]" /> Basic Modules</div>
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
                <p className="text-xs text-[#696969] leading-[170%] font-sans">Perfect for solo founders and early-stage startups.</p>

                <div className="space-y-2.5 text-xs pt-4 border-t border-[#141413]/10 font-sans">
                  <div className="flex items-center gap-2 text-[#696969]"><Check className="w-4 h-4 text-[#141413]" /> All Core Modules</div>
                  <div className="flex items-center gap-2 text-[#696969]"><Check className="w-4 h-4 text-[#141413]" /> Standard Analytics</div>
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
                <p className="text-xs text-[#F3F0EE]/70 leading-[170%] font-sans">Built for growing teams ready to scale efficiently.</p>

                <div className="space-y-2.5 text-xs pt-4 border-t border-white/10 font-sans">
                  <div className="flex items-center gap-2 text-[#F3F0EE]/80"><Check className="w-4 h-4 text-[#F3F0EE]" /> Advanced Analytics</div>
                  <div className="flex items-center gap-2 text-[#F3F0EE]/80"><Check className="w-4 h-4 text-[#F3F0EE]" /> Multi-Agent Collab</div>
                  <div className="flex items-center gap-2 text-[#F3F0EE]/80"><Check className="w-4 h-4 text-[#F3F0EE]" /> Up to 15 Users</div>
                  <div className="flex items-center gap-2 text-[#F3F0EE]/80"><Check className="w-4 h-4 text-[#F3F0EE]" /> 24/7 Priority Support</div>
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
                <p className="text-xs text-[#696969] leading-[170%] font-sans">Tailored AI solutions for organizations with advanced requirements.</p>

                <div className="space-y-2.5 text-xs pt-4 border-t border-[#141413]/10 font-sans">
                  <div className="flex items-center gap-2 text-[#696969]"><Check className="w-4 h-4 text-[#141413]" /> Custom Solutions</div>
                  <div className="flex items-center gap-2 text-[#696969]"><Check className="w-4 h-4 text-[#141413]" /> Dedicated Support</div>
                  <div className="flex items-center gap-2 text-[#696969]"><Check className="w-4 h-4 text-[#141413]" /> Unlimited Users</div>
                </div>
              </div>

              <button onClick={onStartBuilding} className="w-full py-3.5 rounded-[20px] bg-white hover:bg-[#F3F0EE] border border-[#141413] text-[#141413] text-xs font-bold transition-all cursor-pointer font-sans">
                Contact Sales
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* 11. FAQ ACCORDION SECTION */}
      <section id="faq" className="py-36 px-6 bg-[#FCFBFA] border-y border-[#141413]/10">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <span className="text-xs font-mono text-[#696969] uppercase tracking-widest font-bold">FAQ</span>
            <h2 className="text-4xl sm:text-5xl font-bold text-[#141413] tracking-tight font-sans" style={{letterSpacing: '-0.02em'}}>
              Questions &amp; Answers
            </h2>
          </div>

          <div className="space-y-4">
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
                  <div className="px-6 pb-6 text-sm text-[#696969] leading-[170%] border-t border-[#141413]/10 pt-4 font-sans">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 12. FINAL CTA SECTION — INK BLACK STADIUM ON CREAM */}
      <section className="py-36 px-6 relative overflow-hidden bg-[#F3F0EE]">

        <div className="max-w-5xl mx-auto p-16 rounded-[40px] bg-[#141413] text-center space-y-8 relative z-10 shadow-[rgba(0,0,0,0.25)_0px_70px_110px_0px]">
          
          {/* Animated Rocket Lottie Animation Emblem */}
          <div className="w-24 h-24 mx-auto relative flex items-center justify-center">
            <DotLottieReact
              src="https://lottie.host/397854e7-c7d6-4622-b2d8-8c254f95320a/KB1JbtgXrH.lottie"
              loop
              autoplay
              style={{ width: '100%', height: '100%' }}
            />
          </div>

          <h2 className="text-4xl sm:text-6xl font-bold text-white tracking-tight font-sans" style={{letterSpacing: '-0.02em'}}>
            Ready to Launch Smarter?
          </h2>

          <p className="text-white/70 text-lg max-w-xl mx-auto leading-[170%] font-sans">
            Start your journey with CatalystOS and let AI help you build, operate, and scale your startup from one intelligent workspace.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              onClick={onStartBuilding}
              className="w-full sm:w-auto px-10 py-4 rounded-[20px] bg-[#F3F0EE] hover:bg-white text-[#141413] font-bold text-sm transition-all cursor-pointer font-sans"
            >
              Start Free Trial
            </button>
          </div>
        </div>
      </section>

      {/* 13. INK BLACK EDITORIAL FOOTER */}
      <footer id="about" className="py-20 px-6 bg-[#141413]">
        <div className="max-w-[1280px] mx-auto grid grid-cols-2 md:grid-cols-5 gap-10 text-xs">
          
          <div className="col-span-2 space-y-4">
            <div className="flex items-center gap-3 cursor-pointer">
              <div className="w-8 h-8 rounded-lg bg-[#F3F0EE]/10 border border-white/20 p-1 flex items-center justify-center">
                <CatalystLogo className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-white text-lg font-sans" style={{letterSpacing: '-0.02em'}}>CatalystOS</span>
            </div>
            <p className="text-white/50 max-w-xs leading-[170%] font-sans">
              The AI operating platform for founders.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="font-mono text-white/50 font-bold uppercase text-[10px] tracking-wider">Product</h4>
            <ul className="space-y-2.5 text-white/60 font-sans">
              <li className="hover:text-white transition-colors cursor-pointer">Overview</li>
              <li className="hover:text-white transition-colors cursor-pointer">Features</li>
              <li className="hover:text-white transition-colors cursor-pointer">Pricing</li>
              <li className="hover:text-white transition-colors cursor-pointer">Integrations</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="font-mono text-white/50 font-bold uppercase text-[10px] tracking-wider">Company</h4>
            <ul className="space-y-2.5 text-white/60 font-sans">
              <li className="hover:text-white transition-colors cursor-pointer">About</li>
              <li className="hover:text-white transition-colors cursor-pointer">Careers</li>
              <li className="hover:text-white transition-colors cursor-pointer">Blog</li>
              <li className="hover:text-white transition-colors cursor-pointer">Contact</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="font-mono text-white/50 font-bold uppercase text-[10px] tracking-wider">Resources</h4>
            <ul className="space-y-2.5 text-white/60 font-sans">
              <li className="hover:text-white transition-colors cursor-pointer">Docs</li>
              <li className="hover:text-white transition-colors cursor-pointer">User Guides</li>
              <li className="hover:text-white transition-colors cursor-pointer">Guides</li>
              <li className="hover:text-white transition-colors cursor-pointer">Community</li>
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
