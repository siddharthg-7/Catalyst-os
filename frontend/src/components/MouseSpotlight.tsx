import React, { useEffect, useRef } from 'react';

/**
 * Interactive Mouse Spotlight Effect
 * Follows the founder's cursor across CatalystOS with an ethereal, warm radial glow.
 */
export default function MouseSpotlight() {
  const spotlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = spotlightRef.current;
    if (!el) return;

    const move = (e: MouseEvent) => {
      el.style.left = `${e.clientX}px`;
      el.style.top = `${e.clientY}px`;
      el.style.opacity = '1';
    };

    const leave = () => {
      if (el) el.style.opacity = '0';
    };

    window.addEventListener('mousemove', move);
    window.addEventListener('mouseleave', leave);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseleave', leave);
    };
  }, []);

  return (
    <div
      ref={spotlightRef}
      className="spotlight"
      style={{ opacity: 0 }}
      aria-hidden="true"
    />
  );
}
