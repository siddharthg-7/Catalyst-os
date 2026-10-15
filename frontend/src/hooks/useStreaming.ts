import { useState, useRef, useCallback } from 'react';

/**
 * Hook to stream text character-by-character or token-by-token for realistic ChatGPT typing simulation.
 */
export function useStreaming() {
  const [streamedText, setStreamedText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startStreaming = useCallback((fullText: string, onComplete?: () => void, speedMs = 15) => {
    setIsStreaming(true);
    setStreamedText('');

    if (timerRef.current) clearInterval(timerRef.current);

    let index = 0;
    const chunkSize = 2; // characters per tick

    timerRef.current = setInterval(() => {
      index += chunkSize;
      if (index >= fullText.length) {
        setStreamedText(fullText);
        setIsStreaming(false);
        if (timerRef.current) clearInterval(timerRef.current);
        if (onComplete) onComplete();
      } else {
        setStreamedText(fullText.slice(0, index));
      }
    }, speedMs);
  }, []);

  const stopStreaming = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsStreaming(false);
  }, []);

  return {
    streamedText,
    isStreaming,
    startStreaming,
    stopStreaming,
  };
}
