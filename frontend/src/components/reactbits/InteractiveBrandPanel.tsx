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
      className="relative hidden lg:flex flex-col justify-between p-10 xl:p-12 bg-[#FDFCFA] border-r border-[rgba(20,20,19,0.08)] overflow-hidden select-none"
      style={{
        boxShadow: 'inset -1px 0 0 rgba(20,20,19,0.04)',
      }}
    >
      {/* ── Cursor-following ambient radial color glow (Restrained Warm Carbon) ── */}
      <div
        ref={glowRef}
        className="pointer-events-none absolute top-0 left-0 w-[500px] h-[500px] rounded-full transition-opacity duration-700 ease-out z-0"
        style={{
          background:
            'radial-gradient(circle, rgba(20, 20, 19, 0.04) 0%, rgba(20, 20, 19, 0.015) 35%, transparent 70%)',
          filter: 'blur(40px)',
          opacity: 0.6,
          willChange: 'transform, opacity',
        }}
      />

      {/* Decorative orbital concentric lines in subtle warm border */}
      <div className="pointer-events-none absolute inset-0 z-0 opacity-60">
        <div
          className="absolute rounded-full border border-[rgba(20,20,19,0.06)]"
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
          className="absolute rounded-full border border-dashed border-[rgba(20,20,19,0.05)]"
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
          className="absolute rounded-full border border-[rgba(20,20,19,0.04)]"
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
            <div className="w-10 h-10 rounded-2xl bg-[#141413] text-[#FDFCFA] shadow-sm flex items-center justify-center">
              <CatalystLogo className="w-5 h-5 text-[#FDFCFA]" />
            </div>
            <div>
              <span className="text-base font-extrabold text-[#141413] tracking-tight block">CatalystOS</span>
              <span className="text-[10px] font-mono text-[#666562] font-semibold tracking-wider uppercase">Executive Platform</span>
            </div>
          </motion.div>

          {/* Elegant ambient badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[rgba(20,20,19,0.10)] shadow-2xs text-[11px] font-medium text-[#141413]">
            <Sparkles className="w-3.5 h-3.5 text-[#141413]" />
            <span>AI Multi-Agent OS</span>
          </div>
        </div>

        {/* Headline: Clean Executive Carbon Typography */}
        <div className="mb-4">
          <h1 className="text-3xl xl:text-4xl font-extrabold tracking-tight leading-[1.2] font-sans text-[#141413]">
            The Autonomous Executive OS for Startups.
          </h1>
        </div>

        {/* Subtitle with DecryptedText */}
        <p className="text-sm text-[#666562] leading-relaxed max-w-md font-sans mb-8">
          <DecryptedText
            text="Deploy 8 coordinated AI executives. From strategy to cash runway, run your company with autonomous precision."
            speed={25}
            maxIterations={8}
            sequential={true}
            animateOn="view"
            className="text-sm text-[#666562] leading-relaxed font-normal"
          />
        </p>
      </div>

      {/* Center: Executive AI Council Showcase Cards */}
      <div className="relative z-10 space-y-3.5 my-2">
        {/* Card 1: Executive AI Council */}
        <motion.div
          style={{
            transform: `translate3d(${parallax.x * 6}px, ${parallax.y * 6}px, 0)`,
            transition: 'transform 0.25s ease-out',
          }}
        >
          <SpotlightCard
            className="p-4 bg-white border border-[rgba(20,20,19,0.08)] hover:border-[rgba(20,20,19,0.18)] shadow-sm hover:shadow-md transition-all rounded-2xl"
            spotlightColor="rgba(20, 20, 19, 0.04)"
            borderColor="rgba(20, 20, 19, 0.16)"
            size={280}
          >
            <div className="flex items-center justify-between gap-3.5">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#141413] text-[#FDFCFA] shadow-xs flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-[#141413] font-sans">Atlas & Aura Intelligence</h3>
                  <p className="text-[11px] text-[#666562] font-sans mt-0.5 leading-normal">
                    Strategic alignment, sprint roadmaps & council consensus.
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-[#F3F0EE] text-[#141413] border border-[rgba(20,20,19,0.08)] shadow-2xs flex-shrink-0">
                Co-Pilots
              </span>
            </div>
          </SpotlightCard>
        </motion.div>

        {/* Card 2: Financial Engine & Governance */}
        <motion.div
          style={{
            transform: `translate3d(${parallax.x * -4}px, ${parallax.y * -4}px, 0)`,
            transition: 'transform 0.25s ease-out',
          }}
        >
          <SpotlightCard
            className="p-4 bg-white border border-[rgba(20,20,19,0.08)] hover:border-[rgba(20,20,19,0.18)] shadow-sm hover:shadow-md transition-all rounded-2xl"
            spotlightColor="rgba(20, 20, 19, 0.04)"
            borderColor="rgba(20, 20, 19, 0.16)"
            size={280}
          >
            <div className="flex items-center justify-between gap-3.5">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#141413] text-[#FDFCFA] shadow-xs flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-[#141413] font-sans">Nexus Financial Engine</h3>
                  <p className="text-[11px] text-[#666562] font-sans mt-0.5 leading-normal">
                    Deterministic runway calculations & real-time burn audits.
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-[#DCFCE7] text-[#15803D] border border-emerald-200/80 shadow-2xs flex-shrink-0">
                Runway Guard
              </span>
            </div>
          </SpotlightCard>
        </motion.div>

        {/* Card 3: Enterprise Trust & Governance */}
        <motion.div
          style={{
            transform: `translate3d(${parallax.x * 5}px, ${parallax.y * 5}px, 0)`,
            transition: 'transform 0.25s ease-out',
          }}
        >
          <SpotlightCard
            className="p-4 bg-white border border-[rgba(20,20,19,0.08)] hover:border-[rgba(20,20,19,0.18)] shadow-sm hover:shadow-md transition-all rounded-2xl"
            spotlightColor="rgba(20, 20, 19, 0.04)"
            borderColor="rgba(20, 20, 19, 0.16)"
            size={280}
          >
            <div className="flex items-center justify-between gap-3.5">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#141413] text-[#FDFCFA] shadow-xs flex items-center justify-center flex-shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-[#141413] font-sans">Deterministic Governance</h3>
                  <p className="text-[11px] text-[#666562] font-sans mt-0.5 leading-normal">
                    Multi-agent human-in-the-loop gating with cryptographic audit logs.
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-[#F3F0EE] text-[#666562] border border-[rgba(20,20,19,0.08)] shadow-2xs flex-shrink-0">
                Enterprise
              </span>
            </div>
          </SpotlightCard>
        </motion.div>
      </div>

      {/* Bottom Footer */}
      <div className="relative z-10 pt-6 border-t border-[rgba(20,20,19,0.08)] flex items-center justify-between text-[11px] text-[#8E8D8A] font-mono">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#141413]" />
          <span className="text-[#666562]">CatalystOS Protocol 2026</span>
        </div>
        <div className="flex items-center gap-4 text-[#8E8D8A]">
          <span className="hover:text-[#141413] transition-colors cursor-pointer">Enterprise Security</span>
          <span>•</span>
          <span className="hover:text-[#141413] transition-colors cursor-pointer">Privacy First</span>
        </div>
      </div>
    </div>
  );
}
