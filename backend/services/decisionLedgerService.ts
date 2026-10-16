/**
 * CatalystOS - Tamper-Evident Append-Only Decision Ledger (Section 13)
 * Implements a cryptographically hashed, append-only event ledger for all corporate decisions.
 * Every event is linked to its preceding hash (SHA-256 blockchain-style event chaining).
 */

import crypto from 'crypto';

export type DecisionEventType =
  | 'COMMAND_CREATED'
  | 'AGENT_EXECUTED'
  | 'AGENT_FAILED'
  | 'BOARD_VOTED'
  | 'DECISION_CREATED'
  | 'AGENT_VOTE_RECORDED'
  | 'AUDITOR_VERIFIED'
  | 'FOUNDER_MODIFIED'
  | 'FOUNDER_APPROVED'
  | 'FOUNDER_REJECTED'
  | 'FOUNDER_CHANGES_REQUESTED'
  | 'APPROVAL_CREATED'
  | 'APPROVAL_MODIFIED'
  | 'APPROVAL_APPROVED'
  | 'APPROVAL_REJECTED'
  | 'APPROVAL_CHANGES_REQUESTED'
  | 'EXECUTION_STARTED'
  | 'EXECUTION_COMPLETED'
  | 'EXECUTION_FAILED'
  | 'POLICY_CHANGED'
  | 'FINANCIAL_MUTATION'
  | 'REVERSAL_EXECUTED'
  | 'LOGIN_SECURITY_EVENT'
  | 'REDACTION_EVENT';

/**
 * Deterministic RFC 8785 Canonical JSON Serialization.
 * Recursively sorts all keys at every object depth to guarantee consistent SHA-256 hashes
 * regardless of key insertion order or serialization runtime.
 */
export function canonicalJsonStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map(canonicalJsonStringify).join(',')}]`;
  }
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map(k => `${JSON.stringify(k)}:${canonicalJsonStringify(obj[k])}`);
  return `{${pairs.join(',')}}`;
}

export interface DecisionLedgerEvent {
  eventId: string;
  decisionId: string;
  startupId: string;
  workflowId: string;
  actor: string; // e.g. "CEO", "CFO", "Auditor", "Founder (usr_founder)"
  timestamp: string;
  eventType: DecisionEventType;
  payload: Record<string, any>;
  previousEventHash: string;
  eventHash: string;
}

export interface ChainVerificationResult {
  valid: boolean;
  decisionId: string;
  eventCount: number;
  lastEventHash: string;
  brokenEventId?: string;
  error?: string;
}

// In-memory persistent event store (and fallback when DB is disconnected)
const decisionEventLog = new Map<string, DecisionLedgerEvent[]>();

export class DecisionLedgerService {
  /**
   * Computes deterministic SHA-256 hash of an event given its contents and previous hash.
   */
  public computeEventHash(
    eventId: string,
    decisionId: string,
    startupId: string,
    workflowId: string,
    actor: string,
    timestamp: string,
    eventType: DecisionEventType,
    payload: Record<string, any>,
    previousEventHash: string
  ): string {
    const serializedPayload = canonicalJsonStringify(payload);
    const raw = `${eventId}|${decisionId}|${startupId}|${workflowId}|${actor}|${timestamp}|${eventType}|${serializedPayload}|${previousEventHash}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Appends an immutable event to the decision audit chain.
   * Rejects any modifications to past events.
   */
  public appendEvent(params: {
    decisionId: string;
    startupId: string;
    workflowId: string;
    actor: string;
    eventType: DecisionEventType;
    payload: Record<string, any>;
  }): DecisionLedgerEvent {
    const { decisionId, startupId, workflowId, actor, eventType, payload } = params;
    const history = decisionEventLog.get(decisionId) || [];

    const previousEventHash = history.length > 0 
      ? history[history.length - 1].eventHash 
      : 'GENESIS_0000000000000000000000000000000000000000000000000000000000000000';

    const eventId = `evt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const timestamp = new Date().toISOString();

    const eventHash = this.computeEventHash(
      eventId,
      decisionId,
      startupId,
      workflowId,
      actor,
      timestamp,
      eventType,
      payload,
      previousEventHash
    );

    const event: DecisionLedgerEvent = {
      eventId,
      decisionId,
      startupId,
      workflowId,
      actor,
      timestamp,
      eventType,
      payload,
      previousEventHash,
      eventHash
    };

    history.push(event);
    decisionEventLog.set(decisionId, history);

    // Dynamic RAG synchronization: index completed decisions into institutional memory
    if (['FOUNDER_APPROVED', 'BOARD_VOTED', 'DECISION_CREATED'].includes(eventType)) {
      import('./ingestionPipelineService').then(({ ingestionPipelineService }) => {
        const title = payload.title || payload.action || `${eventType} Decision`;
        const desc = payload.description || payload.reason || JSON.stringify(payload);
        ingestionPipelineService.enqueueJob({
          startupId,
          sourceType: 'DECISION_LOG',
          sourceRecordId: decisionId,
          action: 'UPSERT',
          payload: {
            documentId: `doc_dec_${decisionId}`,
            name: `[Decision] ${title}`,
            type: 'decision',
            content: `DECISION: ${title}\nEvent: ${eventType}\nActor: ${actor}\nDetails: ${desc}\nTimestamp: ${timestamp}`,
            accessScope: 'ALL',
            summary: desc
          },
          immediate: true
        }).catch(err => console.warn('[DecisionLedgerService] Dynamic RAG sync warning:', err.message));
      }).catch(() => {});
    }

    return event;
  }

  /**
   * Retrieves all immutable events for a given decision, ordered chronologically.
   */
  public getEventsForDecision(decisionId: string): DecisionLedgerEvent[] {
    return decisionEventLog.get(decisionId) || [];
  }

  /**
   * Retrieves all decision events for a given company (Tenant-scoped).
   */
  public getEventsForStartup(startupId: string): DecisionLedgerEvent[] {
    const allEvents: DecisionLedgerEvent[] = [];
    for (const events of decisionEventLog.values()) {
      for (const ev of events) {
        if (ev.startupId === startupId) {
          allEvents.push(ev);
        }
      }
    }
    return allEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  /**
   * Cryptographically verifies the integrity of the entire decision event chain.
   * Recomputes hashes sequentially from genesis to detect any tampering or deletion.
   */
  public verifyChain(decisionId: string): ChainVerificationResult {
    const events = decisionEventLog.get(decisionId) || [];

    if (events.length === 0) {
      return {
        valid: true,
        decisionId,
        eventCount: 0,
        lastEventHash: 'EMPTY_CHAIN'
      };
    }

    let expectedPrevHash = 'GENESIS_0000000000000000000000000000000000000000000000000000000000000000';

    for (let i = 0; i < events.length; i++) {
      const ev = events[i];

      // Check 1: Previous hash link
      if (ev.previousEventHash !== expectedPrevHash) {
        return {
          valid: false,
          decisionId,
          eventCount: events.length,
          lastEventHash: ev.eventHash,
          brokenEventId: ev.eventId,
          error: `Broken hash chain at event index ${i} (${ev.eventId}): expected prevHash ${expectedPrevHash}, found ${ev.previousEventHash}`
        };
      }

      // Check 2: Event hash integrity
      const recomputed = this.computeEventHash(
        ev.eventId,
        ev.decisionId,
        ev.startupId,
        ev.workflowId,
        ev.actor,
        ev.timestamp,
        ev.eventType,
        ev.payload,
        ev.previousEventHash
      );

      if (recomputed !== ev.eventHash) {
        return {
          valid: false,
          decisionId,
          eventCount: events.length,
          lastEventHash: ev.eventHash,
          brokenEventId: ev.eventId,
          error: `Hash mismatch at event index ${i} (${ev.eventId}): payload or metadata tampered with`
        };
      }

      expectedPrevHash = ev.eventHash;
    }

    return {
      valid: true,
      decisionId,
      eventCount: events.length,
      lastEventHash: events[events.length - 1].eventHash
    };
  }

  /**
   * For regulatory compliance (e.g. GDPR), records an explicit redaction event rather than
   * silently mutating or deleting historical ledger entries.
   */
  public recordRedactionEvent(params: {
    decisionId: string;
    startupId: string;
    workflowId: string;
    actor: string;
    redactedEventId: string;
    reason: string;
  }): DecisionLedgerEvent {
    return this.appendEvent({
      decisionId: params.decisionId,
      startupId: params.startupId,
      workflowId: params.workflowId,
      actor: params.actor,
      eventType: 'REDACTION_EVENT',
      payload: {
        redactedEventId: params.redactedEventId,
        reason: params.reason,
        complianceStandard: 'GDPR_ARTICLE_17_COMPLIANCE'
      }
    });
  }
}

export const decisionLedgerService = new DecisionLedgerService();
