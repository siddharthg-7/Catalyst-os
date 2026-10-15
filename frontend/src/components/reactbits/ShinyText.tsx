import React from 'react';

export interface ShinyTextProps {
  text: string;
  disabled?: boolean;
  speed?: number;
  className?: string;
  shineColor?: string;
}

export default function ShinyText({
  text,
  disabled = false,
  speed = 4,
  className = '',
  shineColor = 'rgba(255, 255, 255, 0.85)',
}: ShinyTextProps) {
  const animationDuration = `${speed}s`;

  return (
    <span
      className={`relative inline-block overflow-hidden ${className}`}
      style={
        disabled
          ? {}
          : {
              backgroundImage: `linear-gradient(120deg, currentColor 0%, currentColor 38%, ${shineColor} 50%, currentColor 62%, currentColor 100%)`,
              backgroundSize: '200% 100%',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              animation: `shineSweep ${animationDuration} ease-in-out infinite`,
            }
      }
    >
      {text}
      <style>{`
        @keyframes shineSweep {
          0% {
            background-position: 150% 0;
          }
          100% {
            background-position: -150% 0;
          }
        }
      `}</style>
    </span>
  );
}
