/**
 * API Service for Catalyst OS Chatbot
 * All chat requests go directly to the Python FastAPI backend (port 8000).
 * Does NOT depend on AuthContext or apiFetch — avoids all routing ambiguity.
 */

const CHAT_API = '/api/chat';

export interface ChatApiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatApiResponse {
  reply: string;
  sources?: Array<{ title: string; score: number; snippet?: string }>;
}

/**
 * Non-streaming chat — used as fallback when SSE stream fails.
 */
export async function sendChatMessage(
  messages: ChatApiMessage[],
  language = 'auto',
  _apiFetch?: unknown  // kept for API compatibility, ignored
): Promise<ChatApiResponse> {
  try {
    const res = await fetch(CHAT_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, language }),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        reply: data.reply || data.message || "I require more information to answer this query. Please upload relevant documents to the Knowledge Center.",
        sources: data.sources || [],
      };
    }

    console.warn('[Chat API] Backend returned', res.status);
  } catch (err) {
    console.warn('[Chat API] Backend unreachable:', err);
  }

  return {
    reply: "I require more information to answer this query. Please upload relevant documents to the Knowledge Center.",
    sources: [],
  };
}

/**
 * Streaming SSE chat — token-by-token, exactly like ChatGPT.
 */
export async function streamChatMessage(
  messages: ChatApiMessage[],
  onChunk: (chunk: string) => void,
  onSources: (sources: Array<{ title: string; score: number; snippet?: string }>) => void,
  language = 'auto',
  _apiFetch?: unknown  // kept for API compatibility, ignored
): Promise<void> {
  try {
    const res = await fetch(`${CHAT_API}/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, language }),
    });

    if (!res.ok || !res.body) {
      console.warn('[Chat Stream] Backend returned', res.status, '— falling back to non-stream');
      const fallback = await sendChatMessage(messages, language);
      const words = fallback.reply.split(' ');
      for (const word of words) {
        onChunk(word + ' ');
        await new Promise(r => setTimeout(r, 20));
      }
      if (fallback.sources) onSources(fallback.sources);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;

        const dataStr = trimmed.slice(6).trim();
        if (dataStr === '[DONE]') return;

        try {
          const parsed = JSON.parse(dataStr);
          if (parsed.text) onChunk(parsed.text);
          if (parsed.sources) onSources(parsed.sources);
        } catch {
          // Non-JSON SSE line — skip silently
        }
      }
    }
  } catch (err) {
    console.error('[Chat Stream] Connection error:', err);
    // Graceful degradation to non-streaming
    const fallback = await sendChatMessage(messages, language);
    const words = fallback.reply.split(' ');
    for (const word of words) {
      onChunk(word + ' ');
      await new Promise(r => setTimeout(r, 20));
    }
    if (fallback.sources) onSources(fallback.sources);
  }
}

/**
 * Synthesizes text to speech audio via backend Deepgram TTS.
 */
export async function fetchTTSAudio(text: string): Promise<Blob> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch('/api/audio/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const blob = await res.blob();
      console.log('[fetchTTSAudio blob size]:', blob.size);
      return blob;
    }

    console.warn('[fetchTTSAudio] /api/audio/speak returned status:', res.status);
    const fallbackRes = await fetch('/api/voice/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (fallbackRes.ok) {
      const data = await fallbackRes.json();
      if (data.audioUrl) {
        const audioFileRes = await fetch(data.audioUrl);
        return await audioFileRes.blob();
      }
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn('[fetchTTSAudio] Fetch error or timeout:', err.message || err);
  }

  throw new Error('TTS synthesis request failed');
}

