/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';


// Register GSAP plugins safely
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Hook for animated numerical count-up using GSAP
 */
export function useGsapCountUp(
  targetValue: number,
  prefix: string = '',
  suffix: string = '',
  decimals: number = 0
) {
  const elementRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    const obj = { value: 0 };
    const ctx = gsap.context(() => {
      gsap.to(obj, {
        value: targetValue,
        duration: 1.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          toggleActions: 'play none none none',
        },
        onUpdate: () => {
          const val = decimals > 0 
            ? obj.value.toFixed(decimals) 
            : Math.round(obj.value).toLocaleString();
          el.innerText = `${prefix}${val}${suffix}`;
        },
      });
    });

    return () => ctx.revert();
  }, [targetValue, prefix, suffix, decimals]);

  return elementRef;
}

/**
 * Hook for 3D card tilt tracking mouse cursor with GSAP quickTo for 60fps performance
 */
export function useGsap3DTilt(maxTilt: number = 12) {
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const xTo = gsap.quickTo(card, 'rotateY', { duration: 0.4, ease: 'power2.out' });
    const yTo = gsap.quickTo(card, 'rotateX', { duration: 0.4, ease: 'power2.out' });
    const scaleTo = gsap.quickTo(card, 'scale', { duration: 0.3, ease: 'power2.out' });

    const handleMouseMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      const rotateX = (-y / (rect.height / 2)) * maxTilt;
      const rotateY = (x / (rect.width / 2)) * maxTilt;

      xTo(rotateY);
      yTo(rotateX);
      scaleTo(1.02);
    };

    const handleMouseLeave = () => {
      xTo(0);
      yTo(0);
      scaleTo(1);
    };

    card.addEventListener('mousemove', handleMouseMove);
    card.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      card.removeEventListener('mousemove', handleMouseMove);
      card.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [maxTilt]);

  return cardRef;
}

/**
 * Hook for continuous floating sine wave animation
 */
export function useGsapFloat(yOffset: number = 15, duration: number = 3.5) {
  const floatRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = floatRef.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      gsap.to(el, {
        y: `+=${yOffset}`,
        rotation: 3,
        duration: duration,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
    });

    return () => ctx.revert();
  }, [yOffset, duration]);

  return floatRef;
}

/**
 * Hook for staggered ScrollTrigger entry animations
 */
export function useGsapStaggerReveal(
  selector: string,
  triggerRef?: React.RefObject<HTMLElement | null>
) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = triggerRef?.current || containerRef.current;
    if (!container) return;

    const ctx = gsap.context(() => {
      const items = container.querySelectorAll(selector);
      if (items.length === 0) return;

      gsap.fromTo(
        items,
        {
          opacity: 0,
          y: 40,
          scale: 0.95,
        },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.8,
          stagger: 0.12,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: container,
            start: 'top 80%',
            toggleActions: 'play none none none',
          },
        }
      );
    }, container);

    return () => ctx.revert();
  }, [selector, triggerRef]);

  return containerRef;
}
