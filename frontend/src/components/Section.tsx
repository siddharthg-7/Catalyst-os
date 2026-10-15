import React, { ReactNode, CSSProperties } from 'react';
import { motion } from 'framer-motion';

interface SectionProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  id?: string;
  style?: CSSProperties;
}

/**
 * Reusable Section component with high-fidelity reveal animation and consistent layout bounds.
 * Derived from reference portfolio motion design engine.
 */
export default function Section({ children, className = '', delay = 0, id, style }: SectionProps) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay, ease: [0.23, 1, 0.32, 1] }}
      className={className}
      style={style}
    >
      {children}
    </motion.section>
  );
}
