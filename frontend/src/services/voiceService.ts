/**
 * Catalyst OS — Client-Side Voice Service
 * Handles microphone recording, waveform telemetry, transcription API calls,
 * audio playback with barge-in interruption, and browser Web Speech fallbacks.
 */

export interface VoiceProfileClient {
  id: string;
  name: string;
  provider: string;
  language: string;
  type: 'SYSTEM' | 'CUSTOM' | 'CLONED';
  gender?: 'male' | 'female' | 'neutral';
  previewUrl?: string;
}

export interface VoiceStatusClient {
  voiceEnabled: boolean;
  provider: string;
  connected: boolean;
  engine: string;
  local: boolean;
  activeVoicesCount: number;
}

class VoiceService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private isRecording: boolean = false;
  private volumeCallback: ((volume: number) => void) | null = null;
  private animationFrameId: number | null = null;
  private speechRecognition: any = null;
  private liveTranscript: string = '';
  private transcriptCallback: ((text: string) => void) | null = null;

  // Selected voice and preferences
  private selectedVoiceId: string = localStorage.getItem('catalyst_voice_id') || 'atlas_voice_default';
  private speechSpeed: number = Number(localStorage.getItem('catalyst_voice_speed')) || 1.0;
  private voiceEnabled: boolean = localStorage.getItem('catalyst_voice_enabled') !== 'false';

  // ── 1. Microphone & Recording ──────────────────────────────────────────────

  public async startRecording(
    onVolumeUpdate?: (volume: number) => void,
    onTranscriptUpdate?: (transcript: string) => void
  ): Promise<void> {
    if (this.isRecording) return;
    this.audioChunks = [];
    this.liveTranscript = '';
    this.volumeCallback = onVolumeUpdate || null;
    this.transcriptCallback = onTranscriptUpdate || null;

    try {
      // Intercept / barge-in: stop any currently playing assistant speech immediately
      this.stopPlayback();

      // Start browser Web Speech recognition in parallel for instant, real-time live transcription
      if (typeof window !== 'undefined') {
        const SpeechRec = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
        if (SpeechRec) {
          try {
            const recognition = new SpeechRec();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onresult = (event: any) => {
              let currentText = '';
              for (let i = 0; i < event.results.length; i++) {
                currentText += event.results[i][0].transcript;
              }
              const clean = currentText.trim();
              if (clean) {
                this.liveTranscript = clean;
                if (this.transcriptCallback) {
                  this.transcriptCallback(clean);
                }
              }
            };

            recognition.onerror = (e: any) => {
              console.warn('[Web Speech API] recognition notice:', e.error);
            };

            recognition.start();
            this.speechRecognition = recognition;
          } catch (e) {
            console.warn('[Web Speech API] not started:', e);
          }
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      this.micStream = stream;

      // Setup audio analyzer for reactive UI waveform
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.audioContext = new AudioCtx();
          const source = this.audioContext.createMediaStreamSource(stream);
          this.analyser = this.audioContext.createAnalyser();
          this.analyser.fftSize = 64;
          source.connect(this.analyser);
          this.startVolumeMeter();
        }
      } catch (e) {
        console.warn('AudioContext volume metering unavailable:', e);
      }

      // Check supported mime types
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        } else {
          mimeType = '';
        }
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      this.mediaRecorder = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      recorder.start(100);
      this.isRecording = true;
    } catch (err: any) {
      this.cleanupRecording();
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw new Error('Microphone permission was denied. Please allow microphone access in your browser settings.');
      }
      throw new Error(`Failed to access microphone: ${err.message}`);
    }
  }

  private startVolumeMeter() {
    if (!this.analyser || !this.volumeCallback) return;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const update = () => {
      if (!this.analyser || !this.isRecording) return;
      this.analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      const normalized = Math.min(1, average / 128); // 0 to 1
      if (this.volumeCallback) {
        this.volumeCallback(normalized);
      }
      this.animationFrameId = requestAnimationFrame(update);
    };

    update();
  }

  public async stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording) {
        this.cleanupRecording();
        return reject(new Error('No active audio recording to stop.'));
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });
        this.cleanupRecording();
        resolve(audioBlob);
      };

      try {
        this.mediaRecorder.stop();
      } catch (err) {
        this.cleanupRecording();
        reject(err);
      }
    });
  }

  public cancelRecording(): void {
    if (this.mediaRecorder && this.isRecording) {
      try {
        this.mediaRecorder.stop();
      } catch {}
    }
    this.cleanupRecording();
  }

  private cleanupRecording() {
    this.isRecording = false;
    if (this.speechRecognition) {
      try {
        this.speechRecognition.stop();
      } catch {}
      this.speechRecognition = null;
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach(t => t.stop());
      this.micStream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.analyser = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
  }

  public getLiveTranscript(): string {
    return this.liveTranscript;
  }

  // ── 2. Speech-to-Text Transcription ────────────────────────────────────────

  public async transcribeAudio(audioBlob: Blob): Promise<string> {
    // 1. If Web Speech recognition captured live real-time transcript, return it immediately
    if (this.liveTranscript && this.liveTranscript.trim().length > 0) {
      const captured = this.liveTranscript.trim();
      this.liveTranscript = '';
      return captured;
    }

    // 2. Convert audio blob to base64
    let base64Audio = '';
    try {
      base64Audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string) || '';
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });
    } catch {}

    try {
      const res = await fetch('/api/voice/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: base64Audio,
          mimeType: audioBlob.type || 'audio/webm'
        })
      });

      if (res.ok) {
        const data = await res.json();
        return data.transcript || data.text || '';
      }
    } catch (err) {
      console.warn('Backend transcription unavailable:', err);
    }

    return '';
  }

  // ── 3. Text-to-Speech Synthesis & Playback ──────────────────────────────────

  public async synthesizeAndPlay(text: string, voiceId?: string): Promise<void> {
    if (!this.voiceEnabled || !text || !text.trim()) return;

    // Barge-in: stop any existing speech
    this.stopPlayback();

    const cleanText = text
      .replace(/[*#_`~\[\]]/g, '') // strip markdown
      .replace(/https?:\/\/\S+/g, 'link')
      .slice(0, 800) // cap length for conversational punchiness
      .trim();

    try {
      const targetVoice = voiceId || this.selectedVoiceId;
      const res = await fetch('/api/voice/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanText,
          voiceId: targetVoice,
          format: 'wav',
          speed: this.speechSpeed
        })
      });

      if (!res.ok) {
        throw new Error(`Voice synthesis failed (${res.status})`);
      }

      const blob = await res.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      this.currentAudio = audio;

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        if (this.currentAudio === audio) {
          this.currentAudio = null;
        }
      };

      await audio.play();
    } catch (err: any) {
      console.warn('Backend TTS failed, falling back to browser SpeechSynthesis:', err.message);
      this.playBrowserSpeech(cleanText);
    }
  }

  private playBrowserSpeech(text: string) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = this.speechSpeed;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Browser SpeechSynthesis error:', e);
    }
  }

  public stopPlayback(): void {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch {}
      this.currentAudio = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  }

  // ── 4. Configuration & Preferences ─────────────────────────────────────────

  public async getStatus(): Promise<VoiceStatusClient> {
    try {
      const res = await fetch('/api/voice/status');
      if (res.ok) {
        return await res.json();
      }
    } catch {}

    return {
      voiceEnabled: this.voiceEnabled,
      provider: 'browser-fallback',
      connected: false,
      engine: 'Browser Web Speech (Offline)',
      local: true,
      activeVoicesCount: 4
    };
  }

  public async fetchVoices(): Promise<VoiceProfileClient[]> {
    try {
      const res = await fetch('/api/voice/voices');
      if (res.ok) {
        const data = await res.json();
        return data.voices || [];
      }
    } catch {}

    return [
      { id: 'atlas_voice_default', name: 'Atlas (CEO Strategy)', provider: 'mock', language: 'en', type: 'SYSTEM', gender: 'male' },
      { id: 'marcus_voice_default', name: 'Marcus (CFO Capital)', provider: 'mock', language: 'en', type: 'SYSTEM', gender: 'male' },
      { id: 'evelyn_voice_default', name: 'Evelyn (CPO Product)', provider: 'mock', language: 'en', type: 'SYSTEM', gender: 'female' },
      { id: 'dax_voice_default', name: 'Dax (CRO Growth)', provider: 'mock', language: 'en', type: 'SYSTEM', gender: 'neutral' }
    ];
  }

  public setSelectedVoice(voiceId: string) {
    this.selectedVoiceId = voiceId;
    localStorage.setItem('catalyst_voice_id', voiceId);
  }

  public getSelectedVoice(): string {
    return this.selectedVoiceId;
  }

  public setSpeed(speed: number) {
    this.speechSpeed = speed;
    localStorage.setItem('catalyst_voice_speed', String(speed));
  }

  public getSpeed(): number {
    return this.speechSpeed;
  }

  public setVoiceEnabled(enabled: boolean) {
    this.voiceEnabled = enabled;
    localStorage.setItem('catalyst_voice_enabled', String(enabled));
  }

  public isVoiceEnabled(): boolean {
    return this.voiceEnabled;
  }
}

export const voiceService = new VoiceService();
