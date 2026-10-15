import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Volume2,
  Mic,
  Plus,
  Trash2,
  ShieldCheck,
  Cpu,
  Radio,
  Play,
  Check,
  Sliders,
  Sparkles,
  Server,
  Layers,
  HelpCircle,
  AlertCircle
} from 'lucide-react';
import { voiceService, VoiceProfileClient, VoiceStatusClient } from '../../services/voiceService';

interface VoiceStudioPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function VoiceStudioPanel({ isOpen, onClose }: VoiceStudioPanelProps) {
  const [status, setStatus] = useState<VoiceStatusClient | null>(null);
  const [voices, setVoices] = useState<VoiceProfileClient[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(voiceService.getSelectedVoice());
  const [speechSpeed, setSpeechSpeed] = useState<number>(voiceService.getSpeed());
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(voiceService.isVoiceEnabled());

  // New voice creation state
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [newVoiceName, setNewVoiceName] = useState('');
  const [newVoiceLanguage, setNewVoiceLanguage] = useState('en');
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    const s = await voiceService.getStatus();
    setStatus(s);
    const v = await voiceService.fetchVoices();
    setVoices(v);
    setSelectedVoiceId(voiceService.getSelectedVoice());
    setSpeechSpeed(voiceService.getSpeed());
    setVoiceEnabled(voiceService.isVoiceEnabled());
  };

  const handleSelectVoice = (id: string) => {
    setSelectedVoiceId(id);
    voiceService.setSelectedVoice(id);
  };

  const handleSpeedChange = (val: number) => {
    setSpeechSpeed(val);
    voiceService.setSpeed(val);
  };

  const handleToggleVoiceEnabled = (val: boolean) => {
    setVoiceEnabled(val);
    voiceService.setVoiceEnabled(val);
  };

  const handlePreviewVoice = async (voice: VoiceProfileClient) => {
    setPreviewingVoiceId(voice.id);
    try {
      await voiceService.synthesizeAndPlay(
        `Hello, I am ${voice.name}. Your Catalyst OS executive council is standing by.`,
        voice.id
      );
    } finally {
      setPreviewingVoiceId(null);
    }
  };

  const handleCreateVoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVoiceName.trim()) return;

    try {
      const res = await fetch('/api/voice/voices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newVoiceName.trim(),
          language: newVoiceLanguage
        })
      });

      if (res.ok) {
        const created = await res.json();
        setVoices(prev => [...prev, created]);
        handleSelectVoice(created.id);
        setIsCreatingProfile(false);
        setNewVoiceName('');
      }
    } catch (err) {
      console.error('Failed to create voice profile:', err);
    }
  };

  const handleDeleteVoice = async (id: string) => {
    try {
      await fetch(`/api/voice/voices/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setVoices(prev => prev.filter(v => v.id !== id));
      if (selectedVoiceId === id) {
        handleSelectVoice('atlas_voice_default');
      }
    } catch (err) {
      console.error('Failed to delete voice:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/20 backdrop-blur-xs">
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="w-full max-w-md h-full shadow-2xl flex flex-col justify-between overflow-hidden"
          style={{
            backgroundColor: 'var(--c-surface)',
            color: 'var(--c-fg)',
            borderLeft: '1px solid var(--c-border)'
          }}
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Voice Studio
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Manage speech engines, profiles, and neural models
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Service Health & Status Card */}
            <div className="p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider font-mono">
                  Engine Status
                </span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                  status?.connected
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200'
                    : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${status?.connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  {status?.connected ? 'Voice Studio Online' : 'Browser Web Speech Active'}
                </span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {status?.engine || 'Catalyst Native Speech Engine'}
              </p>

              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  Processing: <strong>{status?.local ? 'LOCAL (Private)' : 'REMOTE'}</strong>
                </span>
                <span>Active Voices: <strong>{voices.length}</strong></span>
              </div>
            </div>

            {/* General Settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Speech Response Output
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={voiceEnabled}
                    onChange={(e) => handleToggleVoiceEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* Speed Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                  <span>Speech Rate</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{speechSpeed}x</span>
                </div>
                <input
                  type="range"
                  min="0.75"
                  max="1.5"
                  step="0.05"
                  value={speechSpeed}
                  onChange={(e) => handleSpeedChange(Number(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>
            </div>

            {/* Available Voices List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Council Voice Profiles
                </span>
                <button
                  type="button"
                  onClick={() => setIsCreatingProfile(true)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Clone</span>
                </button>
              </div>

              <div className="space-y-2">
                {voices.map((v) => {
                  const isSelected = selectedVoiceId === v.id;
                  const isPreviewing = previewingVoiceId === v.id;

                  return (
                    <div
                      key={v.id}
                      onClick={() => handleSelectVoice(v.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-indigo-50/70 dark:bg-indigo-950/50 border-indigo-500 shadow-xs'
                          : 'border-slate-200/80 dark:border-slate-800 hover:border-indigo-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}>
                          {v.type === 'CLONED' ? 'CL' : 'AI'}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">
                            {v.name}
                          </p>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {v.language.toUpperCase()} · {v.type}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handlePreviewVoice(v)}
                          disabled={isPreviewing}
                          title="Preview Voice"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <Volume2 className={`w-4 h-4 ${isPreviewing ? 'text-indigo-600 animate-pulse' : ''}`} />
                        </button>
                        {v.type === 'CUSTOM' && (
                          <button
                            type="button"
                            onClick={() => handleDeleteVoice(v.id)}
                            title="Delete Profile"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isSelected && (
                          <Check className="w-4 h-4 text-indigo-600 ml-1" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Create Custom Profile Drawer */}
            {isCreatingProfile && (
              <form onSubmit={handleCreateVoice} className="p-4 rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/40 dark:bg-indigo-950/30 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    Create Custom Voice Profile
                  </h4>
                  <button
                    type="button"
                    onClick={() => setIsCreatingProfile(false)}
                    className="text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Profile Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Founder Cloned Voice"
                    value={newVoiceName}
                    onChange={(e) => setNewVoiceName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-hidden focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Primary Language
                  </label>
                  <select
                    value={newVoiceLanguage}
                    onChange={(e) => setNewVoiceLanguage(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-hidden"
                  >
                    <option value="en">English (US/UK)</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="zh">Chinese</option>
                    <option value="ja">Japanese</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-xs cursor-pointer"
                >
                  Save Profile to Voice Studio
                </button>
              </form>
            )}
          </div>

          {/* Footer Note */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 text-center">
            <p className="text-[11px] text-slate-400">
              Audio is synthesized on-demand with zero data leakage.
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
