import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  Sparkles,
  Bot,
  Square,
  Radio,
  Settings2,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { voiceService } from '../../services/voiceService';

export type VoiceState = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'THINKING' | 'SPEAKING' | 'ERROR';

interface VoiceModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendCommand: (text: string, isVoice: boolean) => Promise<void>;
  lastAssistantResponse?: string;
  isOrchestrating?: boolean;
  onOpenVoiceStudio?: () => void;
}

export default function VoiceModeModal({
  isOpen,
  onClose,
  onSendCommand,
  lastAssistantResponse,
  isOrchestrating = false,
  onOpenVoiceStudio
}: VoiceModeModalProps) {
  const [voiceState, setVoiceState] = useState<VoiceState>('IDLE');
  const [volume, setVolume] = useState<number>(0);
  const [transcript, setTranscript] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('Atlas (CEO)');

  useEffect(() => {
    voiceService.fetchVoices().then((voices) => {
      const activeId = voiceService.getSelectedVoice();
      const match = voices.find(v => v.id === activeId);
      if (match) setSelectedVoiceName(match.name);
    });
  }, [isOpen]);

  // Sync thinking state from parent orchestrator
  useEffect(() => {
    if (isOrchestrating && voiceState !== 'SPEAKING') {
      setVoiceState('THINKING');
    }
  }, [isOrchestrating, voiceState]);

  // Sync assistant speaking state when last response updates
  useEffect(() => {
    if (lastAssistantResponse && voiceState === 'THINKING') {
      setVoiceState('SPEAKING');
      if (!isMuted) {
        voiceService.synthesizeAndPlay(lastAssistantResponse);
      }
    }
  }, [lastAssistantResponse, isMuted, voiceState]);

  // Start listening automatically when modal opens
  useEffect(() => {
    if (isOpen) {
      startListening();
    } else {
      stopAll();
    }
    return () => {
      stopAll();
    };
  }, [isOpen]);

  const stopAll = () => {
    voiceService.stopPlayback();
    voiceService.cancelRecording();
    setVoiceState('IDLE');
  };

  const startListening = async () => {
    setErrorMessage(null);
    voiceService.stopPlayback(); // Barge-in interruption: cancel previous speech
    try {
      setVoiceState('LISTENING');
      await voiceService.startRecording(
        (vol) => setVolume(vol),
        (liveText) => setTranscript(liveText)
      );
    } catch (err: any) {
      setVoiceState('ERROR');
      setErrorMessage(err.message || 'Microphone access denied');
    }
  };

  const handleStopAndProcess = async () => {
    if (voiceState !== 'LISTENING') return;

    try {
      setVoiceState('PROCESSING');
      const audioBlob = await voiceService.stopRecording();
      const text = (await voiceService.transcribeAudio(audioBlob)) || transcript;

      if (!text || !text.trim()) {
        setVoiceState('IDLE');
        setErrorMessage('No speech detected. Please tap Speak and try again.');
        return;
      }

      setTranscript(text);
      setVoiceState('THINKING');
      await onSendCommand(text, true);
    } catch (err: any) {
      setVoiceState('ERROR');
      setErrorMessage(err.message || 'Transcription failed');
    }
  };

  const handleMuteToggle = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (nextMuted) {
      voiceService.stopPlayback();
    }
  };

  const handleBargeIn = () => {
    voiceService.stopPlayback();
    startListening();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="w-full max-w-lg rounded-3xl border shadow-2xl p-7 relative overflow-hidden flex flex-col justify-between"
          style={{
            backgroundColor: 'var(--c-surface)',
            borderColor: 'var(--c-border)'
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-xs">
                <Radio className="w-4 h-4 text-white animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-white uppercase font-mono">
                  Catalyst Voice Mode
                </h3>
                <p className="text-[11px] text-slate-400">
                  Voice Engine: <span className="font-semibold text-indigo-600 dark:text-indigo-400">{selectedVoiceName}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onOpenVoiceStudio && (
                <button
                  type="button"
                  onClick={onOpenVoiceStudio}
                  title="Voice Studio Settings"
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Settings2 className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  stopAll();
                  onClose();
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Central Animated Orb */}
          <div className="my-8 flex flex-col items-center justify-center text-center space-y-6">
            <div className="relative flex items-center justify-center w-36 h-36">
              {/* Outer reactive sound wave rings */}
              <motion.div
                animate={{
                  scale: voiceState === 'LISTENING' ? [1, 1.2 + volume * 0.6, 1] : voiceState === 'SPEAKING' ? [1, 1.25, 1] : 1,
                  opacity: voiceState === 'LISTENING' ? 0.35 : voiceState === 'SPEAKING' ? 0.4 : 0.1
                }}
                transition={{ repeat: Infinity, duration: voiceState === 'LISTENING' ? 0.8 : 1.4, ease: 'easeInOut' }}
                className="absolute inset-0 rounded-full bg-indigo-500 blur-lg"
              />

              <motion.div
                animate={{
                  scale: voiceState === 'LISTENING' ? 1 + volume * 0.4 : voiceState === 'THINKING' ? [0.95, 1.05, 0.95] : 1
                }}
                transition={{ repeat: voiceState === 'THINKING' ? Infinity : 0, duration: 1.2 }}
                className={`w-28 h-28 rounded-full flex items-center justify-center text-white shadow-xl transition-all duration-300 ${
                  voiceState === 'LISTENING'
                    ? 'bg-gradient-to-tr from-rose-500 to-indigo-600 shadow-rose-500/25 ring-4 ring-rose-200 dark:ring-rose-950'
                    : voiceState === 'THINKING'
                    ? 'bg-gradient-to-tr from-amber-500 to-indigo-600 shadow-amber-500/25 animate-pulse'
                    : voiceState === 'SPEAKING'
                    ? 'bg-gradient-to-tr from-emerald-500 to-indigo-600 shadow-emerald-500/25 ring-4 ring-emerald-200 dark:ring-emerald-950'
                    : voiceState === 'PROCESSING'
                    ? 'bg-gradient-to-tr from-purple-600 to-indigo-700 shadow-purple-500/25'
                    : 'bg-slate-800 dark:bg-slate-700 text-slate-300'
                }`}
              >
                {voiceState === 'LISTENING' ? (
                  <Mic className="w-10 h-10 text-white animate-bounce" />
                ) : voiceState === 'THINKING' ? (
                  <RefreshCw className="w-9 h-9 text-white animate-spin" />
                ) : voiceState === 'SPEAKING' ? (
                  <Volume2 className="w-10 h-10 text-white animate-pulse" />
                ) : (
                  <Bot className="w-9 h-9 text-white" />
                )}
              </motion.div>
            </div>

            {/* State Label */}
            <div className="space-y-1">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                {voiceState === 'LISTENING' && '◉ Listening to command...'}
                {voiceState === 'PROCESSING' && 'Transcribing audio...'}
                {voiceState === 'THINKING' && 'Executive Council Deliberating...'}
                {voiceState === 'SPEAKING' && 'Speaking Response'}
                {voiceState === 'IDLE' && 'Standby'}
                {voiceState === 'ERROR' && 'Voice Engine Warning'}
              </span>
              <p className="text-sm font-semibold text-slate-900 dark:text-white max-w-sm mx-auto">
                {voiceState === 'LISTENING' && '"Ask about runway, burn rate, engineering hiring, or strategy..."'}
                {voiceState === 'THINKING' && 'Synthesizing verified findings & financial projections'}
                {voiceState === 'SPEAKING' && 'Tap "Interrupt" to speak a new instruction'}
                {voiceState === 'IDLE' && 'Press "Start Listening" to speak'}
                {voiceState === 'ERROR' && (errorMessage || 'Audio service error occurred')}
              </p>
            </div>

            {/* Live Transcript / Response preview */}
            {(transcript || lastAssistantResponse) && (
              <div className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-left text-xs space-y-2 max-h-32 overflow-y-auto">
                {transcript && (
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">YOU SAID:</span>
                    <p className="text-slate-800 dark:text-slate-200 font-medium">"{transcript}"</p>
                  </div>
                )}
                {lastAssistantResponse && voiceState === 'SPEAKING' && (
                  <div className="pt-2 border-t border-slate-200/50 dark:border-slate-800">
                    <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 uppercase block">CATALYST RESPONSE:</span>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed line-clamp-3">
                      {lastAssistantResponse}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 gap-3">
            <button
              type="button"
              onClick={handleMuteToggle}
              className={`p-2.5 rounded-2xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                isMuted
                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 border-rose-200 dark:border-rose-900'
                  : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
              }`}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span>{isMuted ? 'Muted' : 'Mute'}</span>
            </button>

            <div className="flex items-center gap-2">
              {voiceState === 'LISTENING' ? (
                <button
                  type="button"
                  onClick={handleStopAndProcess}
                  className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md flex items-center gap-2 transition-all hover:scale-105 cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Done Speaking</span>
                </button>
              ) : voiceState === 'SPEAKING' ? (
                <button
                  type="button"
                  onClick={handleBargeIn}
                  className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md flex items-center gap-2 transition-all hover:scale-105 cursor-pointer"
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>Interrupt & Speak</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startListening}
                  className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md flex items-center gap-2 transition-all hover:scale-105 cursor-pointer"
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>Start Listening</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
