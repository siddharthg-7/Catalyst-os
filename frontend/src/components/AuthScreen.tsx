import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import HackathonLandingPage from './HackathonLandingPage';
import FounderOnboardingWizard from './FounderOnboardingWizard';
import InteractiveBrandPanel from './reactbits/InteractiveBrandPanel';
import AuthForm from './reactbits/AuthForm';
import CustomCursor from './reactbits/CustomCursor';

// ── Warm Luxury Enterprise Carbon atmospheric ambient background for Auth ──
function AmbientAuthBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0">
      {/* Subtle warm ambient elevation glow */}
      <div
        className="absolute rounded-full"
        style={{
          width: '750px',
          height: '750px',
          top: '-250px',
          right: '-180px',
          background: 'radial-gradient(circle, rgba(20, 20, 19, 0.035) 0%, rgba(20, 20, 19, 0.01) 45%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
      {/* Warm stone atmospheric glow */}
      <div
        className="absolute rounded-full"
        style={{
          width: '700px',
          height: '700px',
          bottom: '-240px',
          left: '-160px',
          background: 'radial-gradient(circle, rgba(253, 252, 250, 0.9) 0%, rgba(243, 240, 238, 0.5) 50%, transparent 70%)',
          filter: 'blur(55px)',
        }}
      />
      {/* Subtle orbital lines in warm border */}
      <div
        className="absolute rounded-full border border-[rgba(20,20,19,0.06)]"
        style={{ width: '850px', height: '850px', top: '-220px', right: '-240px' }}
      />
      <div
        className="absolute rounded-full border border-[rgba(20,20,19,0.04)]"
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
    <div className="min-h-screen bg-[#F3F0EE] text-[#141413] relative font-sans overflow-x-hidden selection:bg-[#141413]/10 selection:text-[#141413]">
      {/* Custom cursor accent on desktop fine pointers */}
      <CustomCursor color="#141413" ringColor="rgba(20, 20, 19, 0.16)" />

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

        {/* ── AUTH VIEW (Premium Split-Screen with Warm Luxury Enterprise Carbon) ─ */}
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
            <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 rounded-[28px] overflow-hidden bg-white border border-[rgba(20,20,19,0.10)] shadow-[rgba(20,20,19,0.06)_0px_24px_50px_-12px,rgba(20,20,19,0.04)_0px_0px_0px_1px]">
              {/* Left Panel: Interactive Visual Brand Panel */}
              <InteractiveBrandPanel />

              {/* Right Panel: Refined Authentication Form */}
              <AuthForm onBackToLanding={() => navigateTo('landing')} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
