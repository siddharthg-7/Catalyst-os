import React, { useEffect, useState, useRef } from 'react';
import { useInView } from 'framer-motion';

export interface DecryptedTextProps {
  text: string;
  speed?: number;
  maxIterations?: number;
  sequential?: boolean;
  revealDirection?: 'start' | 'end' | 'center';
  useOriginalCharsOnly?: boolean;
  characters?: string;
  className?: string;
  encryptedClassName?: string;
  parentClassName?: string;
  animateOn?: 'view' | 'hover';
}

export default function DecryptedText({
  text,
  speed = 50,
  maxIterations = 10,
  sequential = true,
  revealDirection = 'start',
  useOriginalCharsOnly = false,
  characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+',
  className = '',
  encryptedClassName = '',
  parentClassName = '',
  animateOn = 'view',
}: DecryptedTextProps) {
  const [displayText, setDisplayText] = useState(text);
  const [isHovering, setIsHovering] = useState(false);
  const [isScrambling, setIsScrambling] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const inView = useInView(containerRef, { once: true, amount: 0.1 });
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    let interval: any;
    let currentIteration = 0;

    const shouldAnimate =
      (animateOn === 'view' && inView && !hasAnimatedRef.current) ||
      (animateOn === 'hover' && isHovering);

    if (shouldAnimate) {
      setIsScrambling(true);
      if (animateOn === 'view') {
        hasAnimatedRef.current = true;
      }

      const originalChars = text.split('');
      const charPool = useOriginalCharsOnly
        ? Array.from(new Set(text.split(''))).filter((c) => c !== ' ')
        : characters.split('');

      const getRandomChar = () =>
        charPool[Math.floor(Math.random() * charPool.length)] || '*';

      interval = setInterval(() => {
        setDisplayText((_) => {
          return originalChars
            .map((char, index) => {
              if (char === ' ') return ' ';

              if (sequential) {
                let progress = 0;
                if (revealDirection === 'start') {
                  progress = (currentIteration / maxIterations) * originalChars.length;
                  if (index < progress) return char;
                } else if (revealDirection === 'end') {
                  progress = originalChars.length - (currentIteration / maxIterations) * originalChars.length;
                  if (index >= progress) return char;
                } else {
                  const center = originalChars.length / 2;
                  const dist = Math.abs(index - center);
                  progress = (currentIteration / maxIterations) * center;
                  if (dist < progress) return char;
                }
              } else {
                if (currentIteration >= maxIterations) return char;
              }

              return getRandomChar();
            })
            .join('');
        });

        currentIteration++;
        if (currentIteration > maxIterations) {
          clearInterval(interval);
          setIsScrambling(false);
          setDisplayText(text);
        }
      }, speed);
    } else if (!isHovering && animateOn === 'hover') {
      setDisplayText(text);
      setIsScrambling(false);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [
    text,
    speed,
    maxIterations,
    sequential,
    revealDirection,
    characters,
    useOriginalCharsOnly,
    animateOn,
    inView,
    isHovering,
  ]);

  return (
    <span
      ref={containerRef}
      className={`inline-block whitespace-pre-wrap ${parentClassName}`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <span className={isScrambling ? encryptedClassName || className : className}>
        {displayText}
      </span>
    </span>
  );
}
