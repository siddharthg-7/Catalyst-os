import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import HackathonLandingPage from './HackathonLandingPage';
import CatalystOsChatbot from './chatbot/CatalystOsChatbot';
import FounderOnboardingWizard from './FounderOnboardingWizard';
import InteractiveBrandPanel from './reactbits/InteractiveBrandPanel';
import AuthForm from './reactbits/AuthForm';
import CustomCursor from './reactbits/CustomCursor';

// ── Luminous atmospheric ambient background for Auth ──────────────────────
function AmbientAuthBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0">
      {/* Soft Indigo / Violet luminous glow orb */}
      <div
        className="absolute rounded-full"
        style={{
          width: '750px',
          height: '750px',
          top: '-250px',
          right: '-180px',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.16) 0%, rgba(139, 92, 246, 0.08) 40%, transparent 70%)',
          filter: 'blur(55px)',
        }}
      />
      {/* Soft Sky / Cyan luminous glow orb */}
      <div
        className="absolute rounded-full"
        style={{
          width: '700px',
          height: '700px',
          bottom: '-240px',
          left: '-160px',
          background: 'radial-gradient(circle, rgba(14, 165, 233, 0.14) 0%, rgba(99, 102, 241, 0.06) 50%, transparent 70%)',
          filter: 'blur(55px)',
        }}
      />
      {/* Soft Rose luminous accent */}
      <div
        className="absolute rounded-full"
        style={{
          width: '500px',
          height: '500px',
          top: '30%',
          left: '20%',
          background: 'radial-gradient(circle, rgba(244, 114, 182, 0.06) 0%, transparent 65%)',
          filter: 'blur(60px)',
        }}
      />
      {/* Subtle orbital lines with soft indigo tint */}
      <div
        className="absolute rounded-full border border-indigo-200/35"
        style={{ width: '850px', height: '850px', top: '-220px', right: '-240px' }}
      />
      <div
        className="absolute rounded-full border border-violet-200/25"
        style={{ width: '600px', height: '600px', bottom: '-150px', left: '-150px' }}
      />
    </div>
  );
}

interface AuthScreenProps {
  key?: string;
  initialView?: 'landing' | 'auth' | 'onboarding';
  onOnboardingComplete?: (onboardingData: any) => void;
}

export default function AuthScreen({ initialView = 'landing', onOnboardingComplete }: AuthScreenProps) {
  const navigate = useNavigate();
  const { loginAsDemo, user, logout } = useAuth();
  const [view, setView] = useState<'landing' | 'auth' | 'onboarding'>(initialView);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  const navigateTo = (newView: typeof view) => {
    setDirection(newView === 'landing' ? -1 : 1);
    setView(newView);
    if (newView === 'landing') navigate('/');
    else if (newView === 'auth') navigate('/auth');
    else if (newView === 'onboarding') navigate('/onboarding');
  };

  const pageVariants = {
    enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 30 : -30, scale: 0.98 }),
    center: { opacity: 1, x: 0, scale: 1 },
    exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -30 : 30, scale: 0.98 }),
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8FAFC] via-[#F1F5F9] to-[#EEF2FF] text-slate-900 relative font-sans overflow-x-hidden selection:bg-indigo-100 selection:text-indigo-900">
      {/* Custom cursor accent on desktop fine pointers */}
      <CustomCursor color="#4F46E5" ringColor="rgba(79, 70, 229, 0.22)" />

      <AmbientAuthBackground />

      <AnimatePresence mode="wait" custom={direction}>
        {/* ── LANDING VIEW (HackathonLandingPage) ─────────────────────────── */}
        {view === 'landing' && (
          <motion.div
            key="landing"
            custom={direction}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="w-full min-h-screen relative z-10"
          >
            <HackathonLandingPage
              onStartBuilding={() => navigateTo('auth')}
              onDemoLogin={async () => {
                await loginAsDemo();
                localStorage.setItem('catalystos_onboarding_completed_usr_founder_demo', 'true');
                navigate('/dashboard');
              }}
            />
          </motion.div>
        )}

        {/* ── ONBOARDING VIEW (Founder Onboarding Wizard) ────────────────── */}
        {view === 'onboarding' && (
          <motion.div
            key="onboarding"
            custom={direction}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative z-10"
          >
            <FounderOnboardingWizard
              user={user}
              onComplete={async (payload) => {
                if (onOnboardingComplete) {
                  await onOnboardingComplete(payload);
                }
                navigate('/dashboard');
              }}
              onCancel={() => {
                if (user) logout();
                navigateTo('landing');
              }}
            />
          </motion.div>
        )}

        {/* ── AUTH VIEW (Premium Split-Screen with React Bits) ───────────── */}
        {view === 'auth' && (
          <motion.div
            key="auth"
            custom={direction}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 relative z-10"
          >
            <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 rounded-[32px] overflow-hidden bg-white border border-indigo-100/80 shadow-[0_32px_80px_-16px_rgba(79,70,229,0.14),0_0_0_1px_rgba(99,102,241,0.08)]">
              {/* Left Panel: Interactive Visual Brand Panel */}
              <InteractiveBrandPanel />

              {/* Right Panel: Refined Authentication Form */}
              <AuthForm onBackToLanding={() => navigateTo('landing')} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Catalyst OS AI Chatbot Widget */}
      <CatalystOsChatbot />
    </div>
  );
}
