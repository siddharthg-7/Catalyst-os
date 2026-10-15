import React, { useRef, useState } from 'react';

export interface GlareCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  glareColor?: string;
  maxTilt?: number;
}

export default function GlareCard({
  children,
  className = '',
  glareColor = 'rgba(255, 255, 255, 0.45)',
  maxTilt = 7,
  ...props
}: GlareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [glarePosition, setGlarePosition] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -maxTilt;
    const rotateY = ((x - centerX) / centerX) * maxTilt;

    setRotation({ x: rotateX, y: rotateY });
    setGlarePosition({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
    });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotation({ x: 0, y: 0 });
    setGlarePosition({ x: 50, y: 50 });
  };

  return (
    <div
      style={{ perspective: 1000 }}
      className="inline-block w-full"
    >
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`relative overflow-hidden transition-all duration-300 ease-out will-change-transform ${className}`}
        style={{
          transform: isHovered
            ? `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) scale3d(1.015, 1.015, 1.015)`
            : 'rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
          transformStyle: 'preserve-3d',
        }}
        {...props}
      >
        {children}
        {/* Specular glare sheen */}
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{
            opacity: isHovered ? 0.6 : 0,
            background: `radial-gradient(circle 260px at ${glarePosition.x}% ${glarePosition.y}%, ${glareColor}, transparent 70%)`,
            mixBlendMode: 'overlay',
          }}
        />
      </div>
    </div>
  );
}
