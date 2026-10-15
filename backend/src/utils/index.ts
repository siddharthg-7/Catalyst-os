/**
 * Backend Utility Functions
 */

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T = any>(str: string, fallback: T): T {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

/**
 * Standard delay helper for backoff
 */
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
