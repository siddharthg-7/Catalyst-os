import React, { useEffect, useRef } from 'react';

export interface CustomCursorProps {
  color?: string;
  ringColor?: string;
  dotSize?: number;
  ringSize?: number;
}

export default function CustomCursor({
  color = '#4F46E5',
  ringColor = 'rgba(79, 70, 229, 0.22)',
  dotSize = 6,
  ringSize = 32,
}: CustomCursorProps) {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only activate for fine pointers and when reduced motion is NOT preferred
    const isFinePointer = window.matchMedia('(pointer: fine)').matches;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!isFinePointer || prefersReducedMotion) {
      return;
    }

    let mouseX = -100;
    let mouseY = -100;
    let ringX = -100;
    let ringY = -100;
    let isVisible = false;
    let isHoveringInteractive = false;
    let isHoveringPrimary = false;
    let animId: number;

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      if (!isVisible) {
        isVisible = true;
        ringX = mouseX;
        ringY = mouseY;
        if (dotRef.current) dotRef.current.style.opacity = '1';
        if (ringRef.current) ringRef.current.style.opacity = '1';
      }

      // Check target element for hover states
      const target = e.target as HTMLElement | null;
      if (target) {
        const isButton = !!target.closest('button, a, [role="button"]');
        const isPrimary = !!target.closest('[data-cursor="primary"]');
        const isInput = !!target.closest('input, textarea, select');

        isHoveringInteractive = isButton && !isInput;
        isHoveringPrimary = isPrimary;

        // When over inputs, keep cursor subtle
        if (isInput) {
          if (ringRef.current) ringRef.current.style.opacity = '0';
          if (dotRef.current) dotRef.current.style.opacity = '0.35';
        } else if (isVisible) {
          if (ringRef.current) ringRef.current.style.opacity = '1';
          if (dotRef.current) dotRef.current.style.opacity = '1';
        }
      }
    };

    const onMouseLeave = () => {
      isVisible = false;
      if (dotRef.current) dotRef.current.style.opacity = '0';
      if (ringRef.current) ringRef.current.style.opacity = '0';
    };

    const render = () => {
      // Lerp for smooth spring-like trailing ring
      const lerp = 0.18;
      ringX += (mouseX - ringX) * lerp;
      ringY += (mouseY - ringY) * lerp;

      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`;
      }

      if (ringRef.current) {
        let scale = 1;
        if (isHoveringPrimary) scale = 1.45;
        else if (isHoveringInteractive) scale = 1.25;

        ringRef.current.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%) scale(${scale})`;
      }

      animId = requestAnimationFrame(render);
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('mouseleave', onMouseLeave);
    animId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseleave', onMouseLeave);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      {/* Precision micro-dot */}
      <div
        ref={dotRef}
        style={{
          width: `${dotSize}px`,
          height: `${dotSize}px`,
          backgroundColor: color,
          borderRadius: '50%',
          position: 'fixed',
          top: 0,
          left: 0,
          opacity: 0,
          pointerEvents: 'none',
          transition: 'opacity 0.2s ease, width 0.2s ease, height 0.2s ease',
          boxShadow: '0 0 8px rgba(79, 70, 229, 0.4)',
        }}
      />
      {/* Smooth trailing accent ring */}
      <div
        ref={ringRef}
        style={{
          width: `${ringSize}px`,
          height: `${ringSize}px`,
          border: `1.5px solid ${color}`,
          backgroundColor: ringColor,
          borderRadius: '50%',
          position: 'fixed',
          top: 0,
          left: 0,
          opacity: 0,
          pointerEvents: 'none',
          transition: 'opacity 0.25s ease, border-color 0.2s ease, background-color 0.2s ease',
          backdropFilter: 'blur(1px)',
        }}
      />
    </div>
  );
}
