import React, { useState, useEffect, useRef } from 'react';

export interface MagnetProps {
  children: React.ReactNode;
  padding?: number;
  disabled?: boolean;
  magnetStrength?: number;
  activeTransition?: string;
  inactiveTransition?: string;
  wrapperClassName?: string;
  innerClassName?: string;
}

export default function Magnet({
  children,
  padding = 60,
  disabled = false,
  magnetStrength = 0.25,
  activeTransition = 'transform 0.15s cubic-bezier(0.25, 1, 0.5, 1)',
  inactiveTransition = 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)',
  wrapperClassName = '',
  innerClassName = '',
}: MagnetProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const magnetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check for reduced motion or coarse pointer
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isCoarse = window.matchMedia('(pointer: coarse)').matches;
    if (prefersReducedMotion || isCoarse || disabled) {
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!magnetRef.current) return;
      const { left, top, width, height } = magnetRef.current.getBoundingClientRect();
      const centerX = left + width / 2;
      const centerY = top + height / 2;

      const distX = Math.abs(centerX - e.clientX);
      const distY = Math.abs(centerY - e.clientY);

      if (distX < width / 2 + padding && distY < height / 2 + padding) {
        setIsHovered(true);
        // Restrain max pull to 10px so the button is always effortlessly clickable
        const rawOffsetCoordX = (e.clientX - centerX) * magnetStrength;
        const rawOffsetCoordY = (e.clientY - centerY) * magnetStrength;
        const clampedX = Math.max(-10, Math.min(10, rawOffsetCoordX));
        const clampedY = Math.max(-8, Math.min(8, rawOffsetCoordY));
        setPosition({ x: clampedX, y: clampedY });
      } else {
        setIsHovered(false);
        setPosition({ x: 0, y: 0 });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [padding, disabled, magnetStrength]);

  const transition = isHovered ? activeTransition : inactiveTransition;

  return (
    <div ref={magnetRef} className={`inline-block ${wrapperClassName}`}>
      <div
        className={innerClassName}
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
          transition,
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </div>
  );
}
