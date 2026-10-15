import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Settings, 
  Building, 
  Wallet, 
  Shield, 
  User, 
  Check, 
  Sliders, 
  Radio,
  Save,
  Sparkles
} from 'lucide-react';
import { StartupProfile } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  startup: StartupProfile;
  onUpdateStartup: (updated: StartupProfile) => void;
  user: any;
}

export default function SettingsModal({
  isOpen,
  onClose,
  startup,
  onUpdateStartup,
  user
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'workspace' | 'financials' | 'account'>('workspace');

  // Form State
  const [name, setName] = useState(startup.name || '');
  const [industry, setIndustry] = useState(startup.industry || '');
  const [stage, setStage] = useState(startup.fundingStage || 'Seed');
  const [description, setDescription] = useState(startup.description || '');
  const [cashBalance, setCashBalance] = useState<number>(startup.cashBalance || 250000);
  const [burnRate, setBurnRate] = useState<number>(startup.burnRate || 15000);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    const updated: StartupProfile = {
      ...startup,
      name,
      industry,
      fundingStage: stage,
      description,
      cashBalance: Number(cashBalance) || 0,
      burnRate: Number(burnRate) || 0,
      runwayMonths: Number(burnRate) > 0 ? (Number(cashBalance) / Number(burnRate)) : startup.runwayMonths,
    };
    onUpdateStartup(updated);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 900);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <Settings className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Workspace Settings</h3>
                <p className="text-xs text-slate-500">Configure venture identity, financial parameters, and governance</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 px-6 bg-white gap-6">
            <button
              onClick={() => setActiveTab('workspace')}
              className={`py-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'workspace'
                  ? 'border-indigo-600 text-indigo-600 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              <span>Workspace Profile</span>
            </button>
            <button
              onClick={() => setActiveTab('financials')}
              className={`py-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'financials'
                  ? 'border-indigo-600 text-indigo-600 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Treasury & Runway</span>
            </button>
            <button
              onClick={() => setActiveTab('account')}
              className={`py-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'account'
                  ? 'border-indigo-600 text-indigo-600 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Account & Security</span>
            </button>
          </div>

          {/* Content Body */}
          <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
            {activeTab === 'workspace' && (
              <div className="space-y-4">
                <div>
                  <label className="block font-medium text-slate-700 mb-1.5">Company / Venture Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs"
                    placeholder="e.g. NovaTech AI"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1.5">Stage</label>
                    <select
                      value={stage}
                      onChange={(e) => setStage(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs"
                    >
                      <option value="Pre-Seed">Pre-Seed</option>
                      <option value="Seed">Seed</option>
                      <option value="Series A">Series A</option>
                      <option value="Bootstrapped">Bootstrapped</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-1.5">Industry Vertical</label>
                    <input
                      type="text"
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs"
                      placeholder="e.g. B2B SaaS / Developer Tools"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1.5">Mission & Operational Mandate</label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs"
                    placeholder="Brief description of the venture's target market, product roadmap, and strategic goals..."
                  />
                </div>
              </div>
            )}

            {activeTab === 'financials' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-100 flex items-start gap-3">
                  <Shield className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-indigo-950 leading-relaxed">
                    Treasury parameters ground the autonomous CFO agent (Marcus / Aura). When runway falls below 4 months, automatic capital vetoes are placed on non-essential expenditures.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1.5">Cash Balance ($ USD)</label>
                    <input
                      type="number"
                      value={cashBalance}
                      onChange={(e) => setCashBalance(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-1.5">Monthly Net Burn ($ USD)</label>
                    <input
                      type="number"
                      value={burnRate}
                      onChange={(e) => setBurnRate(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div>
                    <div className="text-slate-500 font-medium">Estimated Deterministic Runway</div>
                    <div className="text-lg font-bold text-slate-900">
                      {burnRate > 0 ? (cashBalance / burnRate).toFixed(1) : '∞'} <span className="text-xs font-normal text-slate-500">months</span>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                    (cashBalance / (burnRate || 1)) >= 12
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : (cashBalance / (burnRate || 1)) >= 6
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    {(cashBalance / (burnRate || 1)) >= 12 ? 'Healthy Horizon' : (cashBalance / (burnRate || 1)) >= 6 ? 'Buffer Zone' : 'Critical Runway'}
                  </span>
                </div>
              </div>
            )}

            {activeTab === 'account' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50">
                  <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">
                    {user?.name?.slice(0, 2).toUpperCase() || 'AD'}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">{user?.name || 'Venture Founder'}</div>
                    <div className="text-slate-500 text-xs">{user?.email || 'founder@catalystos.internal'}</div>
                  </div>
                  <span className="ml-auto px-2 py-0.5 rounded text-[11px] font-medium bg-slate-200 text-slate-700">
                    {user?.role || 'FOUNDER'}
                  </span>
                </div>

                <div className="border-t border-slate-100 pt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-slate-900">Tenant Isolation & Data Encryption</div>
                      <div className="text-slate-500 text-[11px]">PostgreSQL RLS with AES-256 encrypted vector storage</div>
                    </div>
                    <span className="text-emerald-600 font-medium text-xs flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Active
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-slate-900">Multi-Agent Autonomy Threshold</div>
                      <div className="text-slate-500 text-[11px]">Require human sign-off for actions exceeding ₹1,00,000</div>
                    </div>
                    <span className="text-emerald-600 font-medium text-xs flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Enforced
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs flex items-center gap-2 shadow-xs transition-colors"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
