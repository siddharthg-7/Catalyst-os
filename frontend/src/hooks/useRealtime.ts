import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export type RealtimeStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

export interface RealtimeEventPayload {
  eventId: string;
  type:
    | 'task.assigned'
    | 'task.updated'
    | 'task.submitted'
    | 'task.approved'
    | 'task.changes_requested'
    | 'notification.created'
    | 'notification.read';
  startupId: string;
  taskId?: string;
  notificationId?: string;
  targetUserId?: string;
  targetRole?: string;
  timestamp: number;
}

interface UseRealtimeOptions {
  token: string | null;
  startupId?: string | null;
  onEvent?: (event: RealtimeEventPayload) => void;
  onNotification?: (event: RealtimeEventPayload) => void;
  onTaskEvent?: (event: RealtimeEventPayload) => void;
}

/**
 * Custom React hook for robust Server-Sent Events (SSE) connection with:
 * - Automatic reconnection with exponential backoff
 * - Missed event replay via lastEventId
 * - Event deduplication
 * - Targeted TanStack Query invalidation
 * - Cross-component custom event broadcasting
 */
export function useRealtime({
  token,
  startupId,
  onEvent,
  onNotification,
  onTaskEvent,
}: UseRealtimeOptions) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<RealtimeStatus>('disconnected');
  const [lastEvent, setLastEvent] = useState<RealtimeEventPayload | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const backoffRef = useRef<number>(1000); // Start with 1s
  const lastEventIdRef = useRef<string | null>(null);
  const processedEventIdsRef = useRef<Set<string>>(new Set());

  const handleIncomingEvent = useCallback(
    (event: RealtimeEventPayload) => {
      if (!event || !event.eventId) return;

      // Deduplicate events to prevent double-firing
      if (processedEventIdsRef.current.has(event.eventId)) {
        return;
      }
      processedEventIdsRef.current.add(event.eventId);
      if (processedEventIdsRef.current.size > 200) {
        const first = Array.from(processedEventIdsRef.current)[0];
        processedEventIdsRef.current.delete(first);
      }

      lastEventIdRef.current = event.eventId;
      setLastEvent(event);

      // Targeted TanStack Query Invalidation
      if (event.type.startsWith('task.')) {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        queryClient.invalidateQueries({ queryKey: ['employee-workspace'] });
        queryClient.invalidateQueries({ queryKey: ['overview'] });

        if (
          event.type === 'task.submitted' ||
          event.type === 'task.approved' ||
          event.type === 'task.changes_requested'
        ) {
          queryClient.invalidateQueries({ queryKey: ['approvals'] });
        }

        onTaskEvent?.(event);
      } else if (event.type.startsWith('notification.')) {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        onNotification?.(event);
      }

      onEvent?.(event);

      // Broadcast globally for non-hook components
      try {
        window.dispatchEvent(
          new CustomEvent('catalyst:realtime', { detail: event })
        );
        window.dispatchEvent(
          new CustomEvent(`catalyst:${event.type}`, { detail: event })
        );
      } catch {}
    },
    [queryClient, onEvent, onNotification, onTaskEvent]
  );

  useEffect(() => {
    if (!token) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setStatus('disconnected');
      return;
    }

    let isCancelled = false;

    const connect = () => {
      if (isCancelled) return;

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      setStatus('connecting');

      const params = new URLSearchParams();
      params.set('token', token);
      if (startupId) params.set('startupId', startupId);
      if (lastEventIdRef.current) params.set('lastEventId', lastEventIdRef.current);

      const url = `/api/realtime/stream?${params.toString()}`;
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => {
        if (isCancelled) return;
        setStatus('connected');
        backoffRef.current = 1000; // Reset backoff upon successful connection
      };

      // Custom event types emitted by backend
      const eventTypes = [
        'task.assigned',
        'task.updated',
        'task.submitted',
        'task.approved',
        'task.changes_requested',
        'notification.created',
        'notification.read',
      ];

      eventTypes.forEach((type) => {
        es.addEventListener(type, (e: MessageEvent) => {
          try {
            const data: RealtimeEventPayload = JSON.parse(e.data);
            handleIncomingEvent(data);
          } catch (err) {
            console.warn('[useRealtime] Failed to parse SSE event data:', err);
          }
        });
      });

      es.onerror = () => {
        if (isCancelled) return;
        setStatus('disconnected');
        es.close();
        eventSourceRef.current = null;

        // Schedule reconnection with exponential backoff (max 15s)
        const delay = Math.min(backoffRef.current, 15000);
        backoffRef.current = Math.min(backoffRef.current * 1.5, 15000);

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };
    };

    connect();

    return () => {
      isCancelled = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setStatus('disconnected');
    };
  }, [token, startupId, handleIncomingEvent]);

  return {
    status,
    lastEvent,
    isConnected: status === 'connected',
  };
}
