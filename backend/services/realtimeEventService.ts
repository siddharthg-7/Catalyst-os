import { Response } from 'express';

export type RealtimeEventType =
  | 'task.assigned'
  | 'task.updated'
  | 'task.submitted'
  | 'task.approved'
  | 'task.changes_requested'
  | 'notification.created'
  | 'notification.read';

export interface RealtimeEvent {
  eventId: string;
  type: RealtimeEventType;
  startupId: string;
  taskId?: string;
  notificationId?: string;
  targetUserId?: string;
  targetRole?: string;
  timestamp: number;
}

interface RealtimeClient {
  connectionId: string;
  userId: string;
  startupId: string;
  role: string;
  res: Response;
  connectedAt: number;
}

class RealtimeEventService {
  private clients: Map<string, RealtimeClient> = new Map();
  private eventHistory: RealtimeEvent[] = [];
  private readonly MAX_HISTORY = 300;
  private sequenceCounter = 0;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startHeartbeat();
  }

  /**
   * Registers an authenticated SSE client connection.
   */
  public registerClient(params: {
    connectionId: string;
    userId: string;
    startupId: string;
    role: string;
    res: Response;
    lastEventId?: string | null;
  }): void {
    const { connectionId, userId, startupId, role, res, lastEventId } = params;

    // Send initial connection establishment event
    res.write(`event: connected\ndata: ${JSON.stringify({
      connectionId,
      startupId,
      connectedAt: Date.now()
    })}\n\n`);

    const client: RealtimeClient = {
      connectionId,
      userId,
      startupId,
      role: role.toUpperCase(),
      res,
      connectedAt: Date.now()
    };

    this.clients.set(connectionId, client);

    // Replay missed events if client reconnected with Last-Event-ID
    if (lastEventId) {
      this.replayMissedEvents(client, lastEventId);
    }
  }

  /**
   * Unregisters a client connection upon disconnect or logout.
   */
  public unregisterClient(connectionId: string): void {
    this.clients.delete(connectionId);
  }

  /**
   * Broadcasts a real-time event with strict tenant isolation and role-scoped delivery.
   * Minimal payload only: contains only eventId, type, taskId, and timestamp.
   */
  public emitEvent(eventParams: Omit<RealtimeEvent, 'eventId' | 'timestamp'>): RealtimeEvent {
    this.sequenceCounter++;
    const event: RealtimeEvent = {
      ...eventParams,
      eventId: `evt_${Date.now()}_${this.sequenceCounter}`,
      timestamp: Date.now()
    };

    // Store in circular buffer for reliable reconnection replay
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.MAX_HISTORY) {
      this.eventHistory.shift();
    }

    // Deliver to authorized connected clients
    for (const client of this.clients.values()) {
      if (this.isClientAuthorized(client, event)) {
        this.writeSseEvent(client.res, event);
      }
    }

    return event;
  }

  /**
   * Checks authorization boundary:
   * 1. Tenant boundary: Startup IDs must strictly match.
   * 2. Role boundary: Founders and Admins receive all company task events.
   * 3. Direct targets: Assigned employees receive events designated for them or their role.
   */
  private isClientAuthorized(client: RealtimeClient, event: RealtimeEvent): boolean {
    // 1. Cross-company delivery is strictly forbidden
    if (client.startupId !== event.startupId) {
      return false;
    }

    const isPrivileged = client.role === 'FOUNDER' || client.role === 'ADMIN';

    // 2. Notification events are targeted specifically to recipient
    if (event.type.startsWith('notification.')) {
      if (event.targetUserId && event.targetUserId !== client.userId) {
        return false;
      }
      return true;
    }

    // 3. Task events
    if (isPrivileged) {
      return true;
    }

    // Direct assignee or role match
    if (event.targetUserId && event.targetUserId === client.userId) {
      return true;
    }
    if (event.targetRole && event.targetRole === client.role) {
      return true;
    }

    // Generic company task update without private target
    if (!event.targetUserId && !event.targetRole) {
      return true;
    }

    return false;
  }

  private writeSseEvent(res: Response, event: RealtimeEvent): void {
    try {
      // Send minimal sanitized event
      const sanitized = {
        eventId: event.eventId,
        type: event.type,
        taskId: event.taskId,
        notificationId: event.notificationId,
        timestamp: event.timestamp
      };
      res.write(`id: ${event.eventId}\n`);
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(sanitized)}\n\n`);
    } catch {
      // Socket write failure handled on connection close
    }
  }

  private replayMissedEvents(client: RealtimeClient, lastEventId: string): void {
    const lastIndex = this.eventHistory.findIndex(e => e.eventId === lastEventId);
    const missed = lastIndex >= 0
      ? this.eventHistory.slice(lastIndex + 1)
      : this.eventHistory.slice(-50); // Fallback to last 50 if ID too old

    for (const event of missed) {
      if (this.isClientAuthorized(client, event)) {
        this.writeSseEvent(client.res, event);
      }
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) return;
    this.heartbeatInterval = setInterval(() => {
      for (const [connId, client] of this.clients.entries()) {
        try {
          client.res.write(':keepalive\n\n');
        } catch {
          this.clients.delete(connId);
        }
      }
    }, 15000);
  }

  public getConnectedClientsCount(): number {
    return this.clients.size;
  }

  public stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}

export const realtimeEventService = new RealtimeEventService();
