import React, { useState } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { voiceService } from '../../services/voiceService';

interface VoiceMicButtonProps {
  onTranscript: (transcript: string) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function VoiceMicButton({ onTranscript, className = '', size = 'md' }: VoiceMicButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [volume, setVolume] = useState(0);

  const handleToggleRecord = async () => {
    if (isTranscribing) return;

    if (isRecording) {
      // Stop recording and transcribe
      try {
        setIsTranscribing(true);
        setIsRecording(false);
        const audioBlob = await voiceService.stopRecording();
        const text = await voiceService.transcribeAudio(audioBlob);
        if (text && text.trim()) {
          onTranscript(text.trim());
        }
      } catch (err: any) {
        console.error('Recording/transcription error:', err);
      } finally {
        setIsTranscribing(false);
      }
    } else {
      // Start recording
      try {
        await voiceService.startRecording((vol) => setVolume(vol));
        setIsRecording(true);
      } catch (err: any) {
        alert(err.message || 'Could not access microphone.');
        setIsRecording(false);
      }
    }
  };

  const sizeClasses = size === 'sm'
    ? 'p-1.5 text-xs'
    : size === 'lg'
    ? 'p-3 text-base'
    : 'p-2 text-sm';

  return (
    <button
      type="button"
      onClick={handleToggleRecord}
      disabled={isTranscribing}
      title={isRecording ? 'Click to stop recording & send' : 'Click to speak to CatalystOS'}
      className={`relative inline-flex items-center justify-center rounded-xl transition-all duration-200 cursor-pointer ${sizeClasses} ${
        isRecording
          ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30 animate-pulse'
          : isTranscribing
          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 border border-indigo-200 dark:border-indigo-800'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 hover:bg-slate-200 dark:hover:bg-slate-700'
      } ${className}`}
    >
      {isTranscribing ? (
        <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
      ) : isRecording ? (
        <Mic className="w-4 h-4 text-white" />
      ) : (
        <Mic className="w-4 h-4" />
      )}

      {/* Ripple ring when recording */}
      {isRecording && (
        <span
          className="absolute inset-0 rounded-xl bg-rose-400 opacity-40 animate-ping pointer-events-none"
          style={{ transform: `scale(${1 + volume * 0.5})` }}
        />
      )}
    </button>
  );
}
