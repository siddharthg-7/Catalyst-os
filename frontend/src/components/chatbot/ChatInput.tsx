import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Mic, Paperclip, MicOff } from 'lucide-react';
import { voiceService } from '../../services/voiceService';

interface ChatInputProps {
  onSend: (text: string, isVoice?: boolean) => void;
  disabled?: boolean;
  language: string;
}

export default function ChatInput({ onSend, disabled, language }: ChatInputProps) {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  const [permissionError, setPermissionError] = useState<string | null>(null);

  const toggleRecording = async () => {
    setPermissionError(null);

    // Stop and process current recording
    if (isRecording) {
      setIsRecording(false);
      try {
        const audioBlob = await voiceService.stopRecording();
        const currentDraft = text.trim();
        const transcribed = (await voiceService.transcribeAudio(audioBlob)) || currentDraft;

        if (transcribed && transcribed.trim()) {
          onSend(transcribed.trim(), true);
          setText('');
        } else {
          setText('');
        }
      } catch (err: any) {
        console.error('[Voice Pipeline Error]:', err);
        setPermissionError('Could not process speech input.');
        setText('');
      }
      return;
    }

    // Start recording with real-time speech-to-text
    try {
      setIsRecording(true);
      setText('Listening...');

      await voiceService.startRecording(
        undefined,
        (liveText) => {
          if (liveText && liveText.trim()) {
            setText(liveText);
          }
        }
      );
    } catch (e: any) {
      console.error('[Mic Access Error]:', e);
      setIsRecording(false);
      setText('');
      setPermissionError(e.message || 'Could not access microphone.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setText(prev => (prev ? `${prev}\n\n${content}` : content));
      };
      reader.readAsText(file as Blob);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setText(prev => (prev ? `${prev}\n\n${content}` : content));
      };
      reader.readAsText(file);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!text.trim() || disabled) return;
    onSend(text);
    setText('');
    setPermissionError(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-3 border-t border-[#151A2D]/10 bg-white font-sans">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
        accept=".md,.txt,.pdf,.docx"
      />

      {permissionError && (
        <div className="mb-2 text-[10px] text-rose-400 bg-rose-950/30 border border-rose-900/50 p-1.5 rounded-lg flex justify-between items-center font-mono">
          <span>{permissionError}</span>
          <button type="button" onClick={() => setPermissionError(null)} className="text-[#151A2D] hover:underline cursor-pointer">Dismiss</button>
        </div>
      )}

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="relative flex items-center bg-[#F3F5FB] border border-[#151A2D]/10 rounded-2xl p-1.5 focus-within:border-white transition-colors shadow-inner gap-1"
      >
        {/* Attachment Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Attach file"
          className="p-2 text-[#68758F] hover:text-[#151A2D] transition-colors cursor-pointer"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        {/* Voice Input Button */}
        <button
          type="button"
          onClick={toggleRecording}
          title={isRecording ? 'Listening... click to stop' : 'Voice Input (Click to speak)'}
          className={`p-2 transition-colors cursor-pointer ${isRecording ? 'text-red-400 animate-pulse bg-red-950/40 rounded-lg' : 'text-[#68758F] hover:text-[#151A2D]'
            }`}
        >
          {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 2000))}
          onKeyDown={handleKeyDown}
          placeholder={isRecording ? 'Listening... speak now...' : 'Ask me anything about CatalystOS...'}
          disabled={disabled}
          rows={1}
          className="w-full bg-transparent px-2 py-2 text-xs sm:text-sm text-[#151A2D] placeholder:text-[#68758F] focus:outline-none resize-none max-h-32 font-sans"
        />

        <button
          type="submit"
          disabled={!text.trim() || disabled}
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0 cursor-pointer ${text.trim() && !disabled
              ? 'bg-[#5546ED] text-white hover:bg-[#4939D5] shadow-[0_0_15px_rgba(255,255,255,0.4)]'
              : 'bg-white/10 text-[#929BB0] cursor-not-allowed'
            }`}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center justify-between pt-2 px-1 text-[9px] font-mono text-[#68758F]">
        <span className="flex items-center gap-1">
          <Sparkles className="w-2.5 h-2.5 text-[#68758F]" />
          <span>Press Enter to send, Shift+Enter for new line</span>
        </span>
        <span>{text.length} / 2000</span>
      </div>
    </form>
  );
}
