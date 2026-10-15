import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bot, TrendingUp, Lock, Sparkles } from 'lucide-react';
import CatalystLogo from '../CatalystLogo';
import BlurText from './BlurText';
import DecryptedText from './DecryptedText';
import SpotlightCard from './SpotlightCard';

export default function InteractiveBrandPanel() {
  const panelRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  // Parallax offsets
  const [parallax, setParallax] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    let targetGlowX = panel.clientWidth / 2;
    let targetGlowY = panel.clientHeight / 2;
    let currentGlowX = targetGlowX;
    let currentGlowY = targetGlowY;
    let isInside = false;
    let animId: number;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = panel.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      targetGlowX = x;
      targetGlowY = y;
      isInside = true;

      // Calculate gentle parallax (-1 to 1 normalized)
      const normX = (x / rect.width - 0.5) * 2;
      const normY = (y / rect.height - 0.5) * 2;
      setParallax({ x: normX, y: normY });
    };

    const handleMouseLeave = () => {
      isInside = false;
      targetGlowX = panel.clientWidth / 2;
      targetGlowY = panel.clientHeight / 2;
      setParallax({ x: 0, y: 0 });
    };

    const loop = () => {
      // Smooth lerp for ambient glow
      const lerpFactor = 0.08;
      currentGlowX += (targetGlowX - currentGlowX) * lerpFactor;
      currentGlowY += (targetGlowY - currentGlowY) * lerpFactor;

      if (glowRef.current) {
        glowRef.current.style.transform = `translate3d(${currentGlowX - 250}px, ${currentGlowY - 250}px, 0)`;
        glowRef.current.style.opacity = isInside ? '0.9' : '0.55';
      }

      animId = requestAnimationFrame(loop);
    };

    panel.addEventListener('mousemove', handleMouseMove, { passive: true });
    panel.addEventListener('mouseleave', handleMouseLeave);
    animId = requestAnimationFrame(loop);

    return () => {
      panel.removeEventListener('mousemove', handleMouseMove);
      panel.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div
      ref={panelRef}
      className="relative hidden lg:flex flex-col justify-between p-10 xl:p-12 bg-gradient-to-br from-[#EEF2FF] via-[#F8FAFC] to-[#F3E8FF] border-r border-indigo-100/70 overflow-hidden select-none"
      style={{
        boxShadow: 'inset -1px 0 0 rgba(79,70,229,0.06)',
      }}
    >
      {/* ── Cursor-following ambient radial color glow ──────────────────────── */}
      <div
        ref={glowRef}
        className="pointer-events-none absolute top-0 left-0 w-[500px] h-[500px] rounded-full transition-opacity duration-700 ease-out z-0"
        style={{
          background:
            'radial-gradient(circle, rgba(99, 102, 241, 0.22) 0%, rgba(168, 85, 247, 0.14) 35%, rgba(14, 165, 233, 0.08) 60%, transparent 75%)',
          filter: 'blur(40px)',
          opacity: 0.6,
          willChange: 'transform, opacity',
        }}
      />

      {/* Decorative orbital concentric lines */}
      <div className="pointer-events-none absolute inset-0 z-0 opacity-60">
        <div
          className="absolute rounded-full border border-indigo-200/40"
          style={{
            width: '640px',
            height: '640px',
            top: '-160px',
            right: '-180px',
            transform: `translate3d(${parallax.x * -6}px, ${parallax.y * -6}px, 0)`,
            transition: 'transform 0.4s ease-out',
          }}
        />
        <div
          className="absolute rounded-full border border-dashed border-violet-200/40"
          style={{
            width: '420px',
            height: '420px',
            top: '-50px',
            right: '-70px',
            transform: `translate3d(${parallax.x * -10}px, ${parallax.y * -10}px, 0)`,
            transition: 'transform 0.4s ease-out',
          }}
        />
        <div
          className="absolute rounded-full border border-blue-200/35"
          style={{
            width: '520px',
            height: '520px',
            bottom: '-180px',
            left: '-140px',
            transform: `translate3d(${parallax.x * 8}px, ${parallax.y * 8}px, 0)`,
            transition: 'transform 0.4s ease-out',
          }}
        />
      </div>

      {/* Top Header: Brand Identity */}
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-8">
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30 flex items-center justify-center">
              <CatalystLogo className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-base font-extrabold text-slate-900 tracking-tight block">CatalystOS</span>
              <span className="text-[10px] font-mono text-indigo-600 font-semibold tracking-wider uppercase">Executive Platform</span>
            </div>
          </motion.div>

          {/* Elegant ambient badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 backdrop-blur-md border border-indigo-100 shadow-xs text-[11px] font-medium text-indigo-700">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>AI Multi-Agent OS</span>
          </div>
        </div>

        {/* Headline with Rich Gradient */}
        <div className="mb-4">
          <h1 className="text-3xl xl:text-4xl font-extrabold tracking-tight leading-[1.2] font-sans">
            <span className="text-slate-900">The Autonomous </span>
            <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 bg-clip-text text-transparent">
              Executive OS
            </span>
            <br />
            <span className="text-slate-900">for Startups.</span>
          </h1>
        </div>

        {/* High-tech Subtitle with DecryptedText */}
        <p className="text-sm text-slate-600 leading-relaxed max-w-md font-sans mb-8">
          <DecryptedText
            text="Deploy 8 coordinated AI executives. From strategy to cash runway, run your company with autonomous precision."
            speed={25}
            maxIterations={8}
            sequential={true}
            animateOn="view"
            className="text-sm text-slate-600 leading-relaxed font-normal"
          />
        </p>
      </div>

      {/* Center: Interactive AI Council Showcase Cards (Vibrant, tasteful colors) */}
      <div className="relative z-10 space-y-3.5 my-2">
        {/* Card 1: Executive AI Council (Indigo theme) */}
        <motion.div
          style={{
            transform: `translate3d(${parallax.x * 6}px, ${parallax.y * 6}px, 0)`,
            transition: 'transform 0.25s ease-out',
          }}
        >
          <SpotlightCard
            className="p-4 bg-white/95 backdrop-blur-md border border-indigo-100 hover:border-indigo-300 shadow-[0_8px_24px_rgba(79,70,229,0.06)] hover:shadow-[0_12px_32px_rgba(79,70,229,0.12)] transition-all"
            spotlightColor="rgba(99, 102, 241, 0.14)"
            borderColor="rgba(99, 102, 241, 0.40)"
            size={280}
          >
            <div className="flex items-center justify-between gap-3.5">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-500/25 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-slate-900 font-sans">Atlas & Aura Intelligence</h3>
                  <p className="text-[11px] text-slate-500 font-sans mt-0.5 leading-normal">
                    Strategic alignment, sprint roadmaps & council consensus.
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/70 shadow-2xs flex-shrink-0">
                Co-Pilots
              </span>
            </div>
          </SpotlightCard>
        </motion.div>

        {/* Card 2: Financial Engine & Governance (Sky/Blue theme) */}
        <motion.div
          style={{
            transform: `translate3d(${parallax.x * -4}px, ${parallax.y * -4}px, 0)`,
            transition: 'transform 0.25s ease-out',
          }}
        >
          <SpotlightCard
            className="p-4 bg-white/95 backdrop-blur-md border border-sky-100 hover:border-sky-300 shadow-[0_8px_24px_rgba(14,165,233,0.06)] hover:shadow-[0_12px_32px_rgba(14,165,233,0.12)] transition-all"
            spotlightColor="rgba(14, 165, 233, 0.14)"
            borderColor="rgba(14, 165, 233, 0.40)"
            size={280}
          >
            <div className="flex items-center justify-between gap-3.5">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-md shadow-blue-500/25 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-slate-900 font-sans">Nexus Financial Engine</h3>
                  <p className="text-[11px] text-slate-500 font-sans mt-0.5 leading-normal">
                    Automated burn rate projections & scenario simulations.
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200/70 shadow-2xs flex-shrink-0">
                Runway Guard
              </span>
            </div>
          </SpotlightCard>
        </motion.div>

        {/* Card 3: Enterprise Trust & Row Security (Violet/Purple theme) */}
        <motion.div
          style={{
            transform: `translate3d(${parallax.x * 5}px, ${parallax.y * 5}px, 0)`,
            transition: 'transform 0.25s ease-out',
          }}
        >
          <SpotlightCard
            className="p-4 bg-white/95 backdrop-blur-md border border-purple-100 hover:border-purple-300 shadow-[0_8px_24px_rgba(168,85,247,0.06)] hover:shadow-[0_12px_32px_rgba(168,85,247,0.12)] transition-all"
            spotlightColor="rgba(168, 85, 247, 0.14)"
            borderColor="rgba(168, 85, 247, 0.40)"
            size={280}
          >
            <div className="flex items-center justify-between gap-3.5">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md shadow-purple-500/25 flex items-center justify-center flex-shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-slate-900 font-sans">Role-Based Security</h3>
                  <p className="text-[11px] text-slate-500 font-sans mt-0.5 leading-normal">
                    Database row isolation with cryptographic session tokens.
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200/70 shadow-2xs flex-shrink-0">
                Enterprise
              </span>
            </div>
          </SpotlightCard>
        </motion.div>
      </div>

      {/* Bottom Footer */}
      <div className="relative z-10 pt-6 border-t border-indigo-100/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          <span className="text-slate-600">CatalystOS Protocol 2026</span>
        </div>
        <div className="flex items-center gap-4 text-slate-500">
          <span className="hover:text-indigo-600 transition-colors cursor-pointer">Enterprise Security</span>
          <span>•</span>
          <span className="hover:text-indigo-600 transition-colors cursor-pointer">Privacy First</span>
        </div>
      </div>
    </div>
  );
}
