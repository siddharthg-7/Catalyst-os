/**
 * CatalystOS - Application Footer
 * Apple x Linear minimalist design tokens.
 */

import React from 'react';
import { Shield, Database } from 'lucide-react';
import CatalystLogo from './CatalystLogo';

interface FooterProps {
  onNavigate?: (tab: string) => void;
}

const moduleLinks = [
  { id: 'dashboard', label: 'Command Center' },
  { id: 'agents', label: 'Executive Council' },
  { id: 'workflows', label: 'Workflows & Sprints' },
  { id: 'approvals', label: 'Decision Inbox' },
  { id: 'ledger', label: 'Decision Ledger' },
  { id: 'knowledge', label: 'Company Knowledge' },
  { id: 'scenarios', label: 'Scenario Studio' },
  { id: 'people', label: 'People Directory' },
];

export default function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="relative mt-16 font-sans transition-all" style={{ borderTop: '1px solid var(--c-border)' }}>
      <div className="relative max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
          
          {/* Brand & Mission */}
          <div className="space-y-3.5">
            <div className="flex items-center gap-2.5">
              <div 
                className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm"
                style={{ backgroundColor: 'var(--c-fg)', color: 'var(--c-bg)' }}
              >
                <CatalystLogo className="w-4 h-4" />
              </div>
              <span className="font-bold tracking-tight" style={{ color: 'var(--c-fg)' }}>CatalystOS</span>
            </div>

            <p className="text-xs leading-relaxed max-w-xs" style={{ color: 'var(--c-muted)' }}>
              Autonomous corporate operating system. Powering high-assurance venture orchestration, multi-agent debates, and audited executive governance.
            </p>

            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-mono font-medium text-emerald-500">
                8 Autonomous Executives Live & Grounded
              </span>
            </div>
          </div>

          {/* Module Navigation */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider font-mono" style={{ color: 'var(--c-fg)' }}>
              Workspace Navigation
            </h4>
            <ul className="grid grid-cols-2 gap-2 text-xs">
              {moduleLinks.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => onNavigate?.(item.id)}
                    className="transition-colors cursor-pointer text-left font-medium hover:underline"
                    style={{ color: 'var(--c-muted)' }}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Security & Governance Badges */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider font-mono" style={{ color: 'var(--c-fg)' }}>
              Governance Architecture
            </h4>
            <div className="space-y-2 text-xs">
              <div 
                className="p-3 rounded-xl flex items-center justify-between"
                style={{ backgroundColor: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
              >
                <span className="flex items-center gap-2 font-medium" style={{ color: 'var(--c-fg)' }}>
                  <Database className="w-3.5 h-3.5" style={{ color: 'var(--c-accent)' }} />
                  PostgreSQL / pgvector (Neon)
                </span>
                <span className="text-[10px] font-mono font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  Synced
                </span>
              </div>

              <div 
                className="p-3 rounded-xl flex items-center justify-between"
                style={{ backgroundColor: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
              >
                <span className="flex items-center gap-2 font-medium" style={{ color: 'var(--c-fg)' }}>
                  <Shield className="w-3.5 h-3.5 text-emerald-500" />
                  SOC-2 Immutable Audit Ledger
                </span>
                <span className="text-[10px] font-mono font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  Enforced
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom credits */}
        <div 
          className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs"
          style={{ borderTop: '1px solid var(--c-border)', color: 'var(--c-muted)' }}
        >
          <p>© {new Date().getFullYear()} CatalystOS. Built for venture founders.</p>
          <p className="font-mono text-[11px]">Enterprise High-Assurance AI Infrastructure</p>
        </div>
      </div>
    </footer>
  );
}
