import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import CatalystLogo from '../CatalystLogo';
import DecryptedText from './DecryptedText';

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
      className="relative flex flex-col justify-between p-6 sm:p-8 lg:p-10 xl:p-12 bg-[#FDFCFA] border-b lg:border-b-0 lg:border-r border-[rgba(20,20,19,0.08)] overflow-hidden select-none min-h-[300px] lg:min-h-full"
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
      <div className="relative z-10 flex items-center justify-between">
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
            <span className="text-base font-extrabold text-[#141413] tracking-tight block font-sans">CatalystOS</span>
            <span className="text-[10px] font-mono text-[#666562] font-semibold tracking-wider uppercase">Executive Platform</span>
          </div>
        </motion.div>

        {/* Elegant ambient badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[rgba(20,20,19,0.10)] shadow-2xs text-[11px] font-medium text-[#141413] font-sans">
          <Sparkles className="w-3.5 h-3.5 text-[#141413]" />
          <span>AI Multi-Agent OS</span>
        </div>
      </div>

      {/* Center: Cohesive Hero Content Group (Centered Horizontally & Vertically) */}
      <div className="relative z-10 flex-1 flex flex-col justify-center items-center text-center my-auto py-10 sm:py-14 lg:py-16 px-2">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-md w-full space-y-4 sm:space-y-5"
        >
          <h1 className="text-3xl sm:text-4xl xl:text-[40px] font-extrabold tracking-tight leading-[1.18] font-sans text-[#141413]">
            The Autonomous Executive OS for Startups.
          </h1>
          <p className="text-sm sm:text-[15px] text-[#666562] leading-relaxed font-sans max-w-sm sm:max-w-md mx-auto">
            <DecryptedText
              text="Deploy 8 coordinated AI executives. From strategy to cash runway, run your company with autonomous precision."
              speed={25}
              maxIterations={8}
              sequential={true}
              animateOn="view"
              className="text-sm sm:text-[15px] text-[#666562] leading-relaxed font-normal"
            />
          </p>
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
