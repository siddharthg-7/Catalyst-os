import React, { useState, useEffect, useRef } from 'react';
import { Bot, User, Check, Copy, ThumbsUp, ThumbsDown, Volume2, Square, RotateCw } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';
import SourceCard from './SourceCard';
import { ChatMessage } from '../../hooks/useChat';

interface MessageBubbleProps {
  key?: React.Key;
  message: ChatMessage;
  onRegenerate?: () => void;
  speechLanguage?: string;
  autoPlaySpeech?: boolean;
}

export default function MessageBubble({ message, onRegenerate, speechLanguage = 'auto', autoPlaySpeech = false }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [isPlayingSpeech, setIsPlayingSpeech] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const isAssistant = message.role === 'assistant';
  const hasAutoPlayedRef = useRef(false);

  useEffect(() => {
    if (autoPlaySpeech && isAssistant && !hasAutoPlayedRef.current) {
      hasAutoPlayedRef.current = true;
      handleSpeech(true);
    }
  }, [autoPlaySpeech, isAssistant]);

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  const fallbackWebSpeech = (plainText: string, isAutoPlay: boolean) => {
    if (!('speechSynthesis' in window)) {
      if (!isAutoPlay) alert('Text-to-speech is not supported in your browser.');
      return;
    }

    console.log('[TTS fallback]: Utilizing browser SpeechSynthesis');
    const utterance = new SpeechSynthesisUtterance(plainText);
    utteranceRef.current = utterance;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setIsPlayingSpeech(true);
      console.log('[Playback started]');
    };

    utterance.onend = () => {
      setIsPlayingSpeech(false);
      console.log('[Playback ended]');
    };

    utterance.onerror = (e) => {
      console.error('[Voice Pipeline Error]: Web Speech fallback error:', e);
      setIsPlayingSpeech(false);
    };

    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
    window.speechSynthesis.cancel();
    setIsPlayingSpeech(true);
    setTimeout(() => {
      window.speechSynthesis.speak(utterance);
    }, 50);
  };

  const handleSpeech = async (isAutoPlay = false) => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
      setIsPlayingSpeech(false);
      if (!isAutoPlay) return;
    }

    if (isPlayingSpeech && !isAutoPlay) {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      setIsPlayingSpeech(false);
      return;
    }

    const plainText = message.content
      .replace(/#+\s+/g, '')
      .replace(/\*+/g, '')
      .replace(/`{1,3}[^`]*`{1,3}/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim();

    if (!plainText) return;

    // Stage 3: TTS request started
    console.log('[TTS request started]:', plainText);

    try {
      const { fetchTTSAudio } = await import('../../services/api');
      const audioBlob = await fetchTTSAudio(plainText);

      // Stage 4: TTS response received
      console.log('[TTS response received]: Audio Blob generated successfully');

      const audioUrl = URL.createObjectURL(audioBlob);

      // Stage 5: Audio element created
      const audio = new Audio(audioUrl);
      console.log('[Audio element created]');
      activeAudioRef.current = audio;

      audio.onplay = () => {
        setIsPlayingSpeech(true);
        // Stage 6: Playback started
        console.log('[Playback started]');
      };

      audio.onended = () => {
        setIsPlayingSpeech(false);
        activeAudioRef.current = null;
        URL.revokeObjectURL(audioUrl);
        // Stage 7: Playback ended
        console.log('[Playback ended]');
      };

      audio.onerror = (e) => {
        console.error('[Voice Pipeline Error]: Audio element error:', e);
        setIsPlayingSpeech(false);
        activeAudioRef.current = null;
        URL.revokeObjectURL(audioUrl);
        fallbackWebSpeech(plainText, isAutoPlay);
      };

      try {
        await audio.play();
      } catch (playErr) {
        console.warn('[Autoplay policy blocked direct audio play, attempting fallback]:', playErr);
        fallbackWebSpeech(plainText, isAutoPlay);
      }
    } catch (err) {
      // Stage 8: Any errors
      console.error('[Voice Pipeline Error]: Deepgram TTS API request failed:', err);
      fallbackWebSpeech(plainText, isAutoPlay);
    }
  };

  const handleFeedback = (rating: 'up' | 'down') => {
    setFeedback(rating);
    fetch('/api/chat/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message_id: message.id, rating })
    }).catch(console.error);
  };

  return (
    <div className={`flex items-start gap-3 my-3 font-sans group ${!isAssistant ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 shadow-md ${
        isAssistant 
          ? 'bg-[#F3F5FB] border-[#151A2D]/10 text-[#151A2D]' 
          : 'bg-[#5546ED] text-white border-[#5546ED]'
      }`}>
        {isAssistant ? <Bot className="w-4 h-4 text-[#151A2D]" /> : <User className="w-4 h-4 text-white" />}
      </div>

      <div className={`max-w-[85%] p-4 rounded-2xl border text-sm relative space-y-2 shadow-sm ${
        isAssistant 
          ? 'bg-[#F3F5FB] border-[#151A2D]/10 text-[#536079] rounded-tl-sm' 
          : 'bg-[#F0EEFF] border-[#DAD5FF] text-[#151A2D] rounded-tr-sm'
      }`}>
        <div className="flex items-center justify-between gap-4 border-b border-[#151A2D]/10 pb-1.5 text-[10px] font-mono text-[#68758F]">
          <span className="font-bold uppercase tracking-wider">
            {isAssistant ? 'Catalyst OS AI' : 'You'}
          </span>
          <div className="flex items-center gap-2">
            <span>{message.timestamp}</span>
            <button
              onClick={handleCopyMessage}
              title="Copy message text"
              className="opacity-0 group-hover:opacity-100 hover:text-[#151A2D] transition-opacity cursor-pointer"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>

        <MarkdownRenderer content={message.content} />

        {isAssistant && message.sources && message.sources.length > 0 && (
          <SourceCard sources={message.sources} />
        )}

        {isAssistant && (
          <div className="flex items-center justify-between pt-1 border-t border-[#151A2D]/10 text-zinc-500 text-[10px] font-mono">
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSpeech(false)}
                title={isPlayingSpeech ? 'Stop Voice Speech' : 'Listen to Voice Speech (TTS)'}
                className={`flex items-center gap-1 hover:text-[#151A2D] transition-colors cursor-pointer ${
                  isPlayingSpeech ? 'text-emerald-400 font-bold' : ''
                }`}
              >
                {isPlayingSpeech ? <Square className="w-3 h-3 animate-pulse" /> : <Volume2 className="w-3 h-3" />}
                <span>{isPlayingSpeech ? 'Speaking...' : 'Listen'}</span>
              </button>

              {onRegenerate && (
                <button
                  onClick={onRegenerate}
                  title="Regenerate response"
                  className="flex items-center gap-1 hover:text-[#151A2D] transition-colors cursor-pointer"
                >
                  <RotateCw className="w-3 h-3" />
                  <span>Regenerate</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleFeedback('up')}
                className={`p-1 rounded hover:text-[#151A2D] transition-colors cursor-pointer ${
                  feedback === 'up' ? 'text-emerald-400' : ''
                }`}
                title="Helpful"
              >
                <ThumbsUp className="w-3 h-3" />
              </button>
              <button
                onClick={() => handleFeedback('down')}
                className={`p-1 rounded hover:text-[#151A2D] transition-colors cursor-pointer ${
                  feedback === 'down' ? 'text-rose-400' : ''
                }`}
                title="Not helpful"
              >
                <ThumbsDown className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
