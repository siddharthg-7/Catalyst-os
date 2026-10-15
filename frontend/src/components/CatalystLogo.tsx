import React from 'react';

interface CatalystLogoProps {
  className?: string;
  size?: number | string;
  color?: string;
}

/**
 * Catalyst OS Official Hexagonal Ribbon Logo Mark
 */
export default function CatalystLogo({ className = "w-8 h-8", size, color = "currentColor" }: CatalystLogoProps) {
  return (
    <svg 
      viewBox="0 0 100 115" 
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={size ? { width: size, height: size } : undefined}
    >
      <g fill={color}>
        {/* Top Folded Ribbon Segment (Upper 'S' loop) */}
        <path d="M 58 11.5 
                 L 88 28.8 
                 C 91 30.5 91 34.5 88 36.2 
                 L 44 61.6 
                 L 26 51.2 
                 L 60 31.6 
                 L 34 16.6 
                 L 58 11.5 Z" />
        
        {/* Middle Cross Ribbon Connector */}
        <path d="M 28 43.2 
                 L 74 16.6 
                 L 88 24.6 
                 L 42 51.2 
                 L 28 43.2 Z" />

        {/* Upper Chevron Ribbon */}
        <path d="M 12 40.5 
                 L 12 49.5 
                 L 50 71.4 
                 L 88 49.5 
                 L 88 40.5 
                 L 50 62.4 
                 L 12 40.5 Z" />

        {/* Bottom Hexagonal Base Chevron Band */}
        <path d="M 12 65.5 
                 L 50 87.4 
                 L 88 65.5 
                 L 88 77.0 
                 C 88 79.5 86.5 82.0 84 83.5 
                 L 53 101.4 
                 C 51 102.5 49 102.5 47 101.4 
                 L 16 83.5 
                 C 13.5 82.0 12 79.5 12 77.0 
                 L 12 65.5 Z" />
      </g>
    </svg>
  );
}
