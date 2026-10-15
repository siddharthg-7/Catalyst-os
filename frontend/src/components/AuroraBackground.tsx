import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  opacity: number;
  color: string;
}

export default function AuroraBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // CatalystOS warm neutral ambient tones
    const colors = ['#696969', '#141413', '#A19D98', '#C4BFBA'];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Subtle drifting particles
    const initParticles = () => {
      particlesRef.current = Array.from({ length: 28 }, () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight + window.innerHeight,
        size: Math.random() * 1.8 + 0.6,
        speedY: -(Math.random() * 0.35 + 0.12),
        speedX: (Math.random() - 0.5) * 0.2,
        opacity: Math.random() * 0.22 + 0.05,
        color: colors[Math.floor(Math.random() * colors.length)],
      }));
    };
    initParticles();

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particlesRef.current.forEach((p) => {
        p.y += p.speedY;
        p.x += p.speedX;
        if (p.y < -10) {
          p.y = canvas.height + 10;
          p.x = Math.random() * canvas.width;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return (
    <>
      {/* Aurora Ambient Orbs */}
      <div className="aurora-bg" aria-hidden="true">
        <div className="aurora-orb aurora-orb-1" />
        <div className="aurora-orb aurora-orb-2" />
        <div className="aurora-orb aurora-orb-3" />
      </div>
      {/* Particle canvas */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 z-0 pointer-events-none"
        aria-hidden="true"
      />
    </>
  );
}
