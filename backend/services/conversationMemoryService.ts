/**
 * CatalystOS — Phase 6 Conversation History and Memory Service
 *
 * Implements:
 * 1. Conversation IDs, authenticated user ownership, and company/tenant scope.
 * 2. Message roles ('user', 'assistant', 'system'), citations, and timestamps.
 * 3. Context-window management:
 *    - Sliding window of recent turns (e.g. last 4 messages / 2 turns) for immediate continuity.
 *    - Semantic/lexical retrieval of older relevant messages when needed.
 *    - NEVER blindly appends the entire conversation history.
 * 4. Strict separation between private user history and shared company knowledge:
 *    - Private messages stay private per user and tenant.
 *    - Authorized promotion process: Only users with 'FOUNDER' or 'ADMIN' role can promote
 *      a private message/decision into company-wide knowledge.
 * 5. Citing timestamps and sources for historical decisions ([HIST-MSG: YYYY-MM-DD HH:MM]).
 * 6. Conversation deletion with full cascade.
 */

import crypto from 'crypto';
import { prisma, safeDbQuery, hasValidDbUrl } from './dbService';
import { ingestDocument, Citation } from './ragEngine';

export interface ConversationRecord {
  id: string;
  title: string;
  userId: string;
  startupId: string;
  isArchived: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ConversationMessageRecord {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations: any[];
  metadata: Record<string, any>;
  isDecision: boolean;
  isSharedKnowledge: boolean;
  createdAt: Date | string;
}

export interface ConversationMemoryContext {
  conversationId: string;
  recentMessages: ConversationMessageRecord[];
  historicalMessages: ConversationMessageRecord[];
  memoryContextText: string;
  historicalCitations: Citation[];
  totalHistoryCount: number;
}

// In-memory fallback stores for test isolation and offline resilience
const inMemoryConversations = new Map<string, ConversationRecord>();
const inMemoryMessages = new Map<string, ConversationMessageRecord[]>();

const DECISION_KEYWORDS = [
  'we decided',
  'decided to',
  'decided on',
  'decision:',
  'agreed to',
  'agreed on',
  'chose to',
  'chosen strategy',
  'approved budget',
  'final decision',
  'resolution:'
];

/**
 * Detects if a message contains an executive decision.
 */
export function isDecisionContent(content: string): boolean {
  if (!content) return false;
  const lower = content.toLowerCase();
  return DECISION_KEYWORDS.some(kw => lower.includes(kw));
}

/**
 * Creates a new conversation row with tenant and user ownership.
 */
export async function createConversation(params: {
  userId: string;
  startupId: string;
  title?: string;
  conversationId?: string;
}): Promise<ConversationRecord> {
  const { userId, startupId, title = 'New Conversation' } = params;
  const id = params.conversationId || `conv_${crypto.randomUUID()}`;
  const now = new Date();

  const record: ConversationRecord = {
    id,
    title,
    userId,
    startupId,
    isArchived: false,
    createdAt: now,
    updatedAt: now
  };

  // 1. In-memory update
  inMemoryConversations.set(id, record);
  if (!inMemoryMessages.has(id)) {
    inMemoryMessages.set(id, []);
  }

  // 2. Persistent Neon DB update
  if (hasValidDbUrl && prisma) {
    try {
      await safeDbQuery(() => prisma.$executeRawUnsafe(
        `INSERT INTO "Conversation" ("id", "title", "userId", "startupId", "isArchived", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, FALSE, $5, $5)
         ON CONFLICT ("id") DO UPDATE SET "title" = $2, "updatedAt" = $5;`,
        id, title, userId, startupId, now
      ));
    } catch (err: any) {
      console.warn(`[Conversation Memory] DB insert warning for ${id}:`, err.message);
    }
  }

  return record;
}

/**
 * Retrieves a conversation and validates authenticated user ownership and company scope.
 */
export async function getConversation(params: {
  conversationId: string;
  userId: string;
  startupId: string;
}): Promise<ConversationRecord | null> {
  const { conversationId, userId, startupId } = params;

  if (hasValidDbUrl && prisma) {
    try {
      const rows = await safeDbQuery(() => prisma.$queryRawUnsafe<any[]>(
        `SELECT "id", "title", "userId", "startupId", "isArchived", "createdAt", "updatedAt"
         FROM "Conversation"
         WHERE "id" = $1 AND "userId" = $2 AND "startupId" = $3 AND "isArchived" = FALSE
         LIMIT 1;`,
        conversationId, userId, startupId
      ));
      if (rows && rows.length > 0) {
        return rows[0] as ConversationRecord;
      }
    } catch (err: any) {
      console.warn(`[Conversation Memory] DB lookup warning for ${conversationId}:`, err.message);
    }
  }

  // Fallback to in-memory store
  const mem = inMemoryConversations.get(conversationId);
  if (mem && mem.userId === userId && mem.startupId === startupId && !mem.isArchived) {
    return mem;
  }

  return null;
}

/**
 * Lists active conversations for an authenticated user within a company tenant.
 */
export async function listConversationsForUser(
  userId: string,
  startupId: string
): Promise<ConversationRecord[]> {
  if (hasValidDbUrl && prisma) {
    try {
      const rows = await safeDbQuery(() => prisma.$queryRawUnsafe<any[]>(
        `SELECT "id", "title", "userId", "startupId", "isArchived", "createdAt", "updatedAt"
         FROM "Conversation"
         WHERE "userId" = $1 AND "startupId" = $2 AND "isArchived" = FALSE
         ORDER BY "updatedAt" DESC;`,
        userId, startupId
      ));
      if (rows && rows.length > 0) {
        return rows as ConversationRecord[];
      }
    } catch (err: any) {
      console.warn(`[Conversation Memory] DB list warning:`, err.message);
    }
  }

  // Fallback to in-memory
  const results: ConversationRecord[] = [];
  for (const conv of inMemoryConversations.values()) {
    if (conv.userId === userId && conv.startupId === startupId && !conv.isArchived) {
      results.push(conv);
    }
  }
  return results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/**
 * Deletes a conversation and its messages with full ownership validation.
 */
export async function deleteConversation(params: {
  conversationId: string;
  userId: string;
  startupId: string;
  userRole?: string;
}): Promise<boolean> {
  const { conversationId, userId, startupId, userRole } = params;

  // Verify conversation ownership: caller must be conversation owner or tenant FOUNDER/ADMIN
  const conv = await getConversation({ conversationId, userId, startupId });
  const isOwner = conv && conv.userId === userId;
  const isPrivileged = userRole === 'FOUNDER' || userRole === 'ADMIN';

  if (!conv && !isPrivileged) {
    throw new Error('Conversation not found or you do not have permission to delete it.');
  }

  // Delete from in-memory
  inMemoryConversations.delete(conversationId);
  inMemoryMessages.delete(conversationId);

  // Delete from Neon DB
  if (hasValidDbUrl && prisma) {
    try {
      await safeDbQuery(() => prisma.$executeRawUnsafe(
        `DELETE FROM "ConversationMessage" WHERE "conversationId" = $1;`,
        conversationId
      ));
      await safeDbQuery(() => prisma.$executeRawUnsafe(
        `DELETE FROM "Conversation" WHERE "id" = $1;`,
        conversationId
      ));
    } catch (err: any) {
      console.warn(`[Conversation Memory] DB delete warning for ${conversationId}:`, err.message);
    }
  }

  return true;
}

/**
 * Appends a message to a conversation.
 */
export async function appendMessage(params: {
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: any[];
  metadata?: Record<string, any>;
  isDecision?: boolean;
  isSharedKnowledge?: boolean;
}): Promise<ConversationMessageRecord> {
  const {
    conversationId,
    role,
    content,
    citations = [],
    metadata = {},
    isSharedKnowledge = false
  } = params;

  const id = `msg_${crypto.randomUUID()}`;
  const now = new Date();
  const isDecision = params.isDecision !== undefined ? params.isDecision : isDecisionContent(content);

  const messageRecord: ConversationMessageRecord = {
    id,
    conversationId,
    role,
    content,
    citations,
    metadata,
    isDecision,
    isSharedKnowledge,
    createdAt: now
  };

  // 1. In-memory update
  const list = inMemoryMessages.get(conversationId) || [];
  list.push(messageRecord);
  inMemoryMessages.set(conversationId, list);

  const existingConv = inMemoryConversations.get(conversationId);
  if (existingConv) {
    existingConv.updatedAt = now;
  }

  // 2. Persistent DB update
  if (hasValidDbUrl && prisma) {
    try {
      await safeDbQuery(() => prisma.$executeRawUnsafe(
        `INSERT INTO "ConversationMessage" ("id", "conversationId", "role", "content", "citations", "metadata", "isDecision", "isSharedKnowledge", "createdAt")
         VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9);`,
        id,
        conversationId,
        role,
        content,
        JSON.stringify(citations),
        JSON.stringify(metadata),
        isDecision,
        isSharedKnowledge,
        now
      ));

      await safeDbQuery(() => prisma.$executeRawUnsafe(
        `UPDATE "Conversation" SET "updatedAt" = $1 WHERE "id" = $2;`,
        now,
        conversationId
      ));
    } catch (err: any) {
      console.warn(`[Conversation Memory] DB message append warning:`, err.message);
    }
  }

  return messageRecord;
}

/**
 * Fetches all messages for a conversation, ordered chronologically.
 */
export async function getConversationMessages(conversationId: string): Promise<ConversationMessageRecord[]> {
  if (hasValidDbUrl && prisma) {
    try {
      const rows = await safeDbQuery(() => prisma.$queryRawUnsafe<any[]>(
        `SELECT "id", "conversationId", "role", "content", "citations", "metadata", "isDecision", "isSharedKnowledge", "createdAt"
         FROM "ConversationMessage"
         WHERE "conversationId" = $1
         ORDER BY "createdAt" ASC;`,
        conversationId
      ));
      if (rows && rows.length > 0) {
        return rows.map(r => ({
          ...r,
          citations: typeof r.citations === 'string' ? JSON.parse(r.citations) : (r.citations || []),
          metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : (r.metadata || {})
        })) as ConversationMessageRecord[];
      }
    } catch (err: any) {
      console.warn(`[Conversation Memory] DB get messages warning for ${conversationId}:`, err.message);
    }
  }

  return inMemoryMessages.get(conversationId) || [];
}

/**
 * Builds the conversation context for LLM synthesis.
 * 
 * Enforces context-window limits:
 * - Uses the last `maxRecentTurns` messages (default: 4 messages, i.e. 2 turns) for immediate continuity.
 * - Does NOT blindly append the entire history!
 * - When needed, searches older messages using lexical/token overlap against `query`.
 * - Surfaces up to `maxHistoricalRecall` relevant older messages, citing exact timestamps:
 *   [HIST-MSG: YYYY-MM-DD HH:MM].
 */
export async function buildConversationMemoryContext(params: {
  conversationId: string;
  userId: string;
  startupId: string;
  query: string;
  maxRecentTurns?: number;
  maxHistoricalRecall?: number;
}): Promise<ConversationMemoryContext> {
  const {
    conversationId,
    userId,
    startupId,
    query,
    maxRecentTurns = 4,
    maxHistoricalRecall = 2
  } = params;

  // 1. Verify tenant & user authorization
  const conv = await getConversation({ conversationId, userId, startupId });
  if (!conv) {
    return {
      conversationId,
      recentMessages: [],
      historicalMessages: [],
      memoryContextText: '',
      historicalCitations: [],
      totalHistoryCount: 0
    };
  }

  // 2. Fetch all messages
  const allMessages = await getConversationMessages(conversationId);
  const totalHistoryCount = allMessages.length;

  if (totalHistoryCount === 0) {
    return {
      conversationId,
      recentMessages: [],
      historicalMessages: [],
      memoryContextText: '',
      historicalCitations: [],
      totalHistoryCount: 0
    };
  }

  // 3. Slice recent messages for immediate dialogue continuity
  const recentMessages = allMessages.slice(-maxRecentTurns);
  const olderMessages = allMessages.slice(0, Math.max(0, totalHistoryCount - maxRecentTurns));

  // 4. Retrieve older relevant messages (if any exist)
  const historicalMessages: ConversationMessageRecord[] = [];
  const historicalCitations: Citation[] = [];

  if (olderMessages.length > 0 && query && query.trim()) {
    const queryTokens = query.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(t => t.length > 2);

    const scoredOlder = olderMessages.map(msg => {
      const contentLower = msg.content.toLowerCase();
      let matchCount = 0;
      for (const token of queryTokens) {
        if (contentLower.includes(token)) {
          matchCount++;
        }
      }

      // Boost messages that capture executive decisions
      const decisionBoost = msg.isDecision ? 2 : 0;
      const score = matchCount + decisionBoost;

      return { msg, score };
    });

    // Filter to those with positive relevance and sort descending
    const relevantScored = scoredOlder
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxHistoricalRecall);

    for (const item of relevantScored) {
      historicalMessages.push(item.msg);
    }
  }

  // 5. Construct formatted memory context block with explicit timestamps
  let memoryContextText = '';

  if (historicalMessages.length > 0) {
    memoryContextText += `<retrieved_historical_conversation_memory conversation_id="${conversationId}">\n`;
    memoryContextText += `NOTE: The following messages are older past discussions retrieved based on relevance to your query.\n\n`;

    historicalMessages.forEach((msg, idx) => {
      const dateStr = new Date(msg.createdAt).toISOString().replace('T', ' ').slice(0, 16);
      const histCitationId = `[HIST-MSG: ${dateStr}]`;

      memoryContextText += `  <historical_message id="${histCitationId}" role="${msg.role}" timestamp="${dateStr}" is_decision="${msg.isDecision}">\n`;
      memoryContextText += `    ${msg.content}\n`;
      memoryContextText += `  </historical_message>\n`;

      historicalCitations.push({
        citationId: histCitationId,
        documentId: `conv_${conversationId}`,
        documentName: `Past Conversation (${dateStr})`,
        documentType: msg.isDecision ? 'past_decision' : 'historical_chat',
        sourceType: 'CONVERSATION_HISTORY',
        sourceRecordId: msg.id,
        version: 1,
        accessScope: 'PRIVATE_USER',
        chunkContent: msg.content,
        similarityScore: 0.85
      });
    });

    memoryContextText += `</retrieved_historical_conversation_memory>\n\n`;
  }

  if (recentMessages.length > 0) {
    memoryContextText += `<recent_dialogue_turns count="${recentMessages.length}">\n`;
    recentMessages.forEach(msg => {
      const dateStr = new Date(msg.createdAt).toISOString().replace('T', ' ').slice(0, 16);
      memoryContextText += `  <turn role="${msg.role}" timestamp="${dateStr}">\n`;
      memoryContextText += `    ${msg.content}\n`;
      memoryContextText += `  </turn>\n`;
    });
    memoryContextText += `</recent_dialogue_turns>\n`;
  }

  return {
    conversationId,
    recentMessages,
    historicalMessages,
    memoryContextText,
    historicalCitations,
    totalHistoryCount
  };
}

/**
 * Promotes a private message into company-wide knowledge.
 * 
 * Strict Authorization:
 * - Only users with role 'FOUNDER' or 'ADMIN' can promote private conversation messages into company knowledge.
 * - Non-founders/non-admins are rejected with an explicit authorization error.
 * - Promoted messages are marked `isSharedKnowledge = true` and indexed into the RAG vector store
 *   with sourceType 'PROMOTED_CONVERSATION_DECISION'.
 */
export async function promoteMessageToCompanyKnowledge(params: {
  messageId: string;
  conversationId: string;
  userId: string;
  startupId: string;
  callerRole: string;
}): Promise<{
  success: boolean;
  messageId: string;
  documentId: string;
  documentName: string;
}> {
  const { messageId, conversationId, userId, startupId, callerRole } = params;

  // 1. Enforce strict role authorization: only FOUNDER or ADMIN can promote
  const normRole = (callerRole || '').toUpperCase();
  if (normRole !== 'FOUNDER' && normRole !== 'ADMIN') {
    throw new Error('Unauthorized: Only company founders and administrators can promote private messages into company-wide knowledge.');
  }

  // 2. Fetch conversation and verify company scope
  const conv = await getConversation({ conversationId, userId, startupId });
  if (!conv) {
    throw new Error('Conversation not found or does not belong to this company.');
  }

  // 3. Find message
  const messages = await getConversationMessages(conversationId);
  const msg = messages.find(m => m.id === messageId);
  if (!msg) {
    throw new Error(`Message with ID ${messageId} was not found in conversation ${conversationId}.`);
  }

  // 4. Mark message as shared knowledge
  msg.isSharedKnowledge = true;

  if (hasValidDbUrl && prisma) {
    try {
      await safeDbQuery(() => prisma.$executeRawUnsafe(
        `UPDATE "ConversationMessage"
         SET "isSharedKnowledge" = TRUE
         WHERE "id" = $1;`,
        messageId
      ));
    } catch (err: any) {
      console.warn(`[Conversation Memory] DB update warning for shared knowledge:`, err.message);
    }
  }

  // 5. Index into the company knowledge base (Phase 3 & Phase 4 RAG pipeline)
  const dateStr = new Date(msg.createdAt).toISOString().replace('T', ' ').slice(0, 16);
  const documentId = `doc_decision_${messageId}`;
  const documentName = `Promoted Executive Decision (${dateStr})`;

  const fullText = `PROMOTED EXECUTIVE DECISION\nDate: ${dateStr}\nPromoted By: ${userId} (${callerRole})\nContent: ${msg.content}`;

  if (hasValidDbUrl && prisma) {
    try {
      await safeDbQuery(() => prisma.$executeRawUnsafe(
        `INSERT INTO "StartupDocument" (
           id, name, type, size, summary, insights, "startupId",
           "sourceType", "sourceRecordId", version, "accessScope",
           "indexingStatus", "embeddingModel", "embeddingDimensions",
           "chunkingStrategy", "createdAt", "updatedAt"
         ) VALUES (
           $1, $2, 'executive_decision', '1 KB', $3, ARRAY[]::text[], $4,
           'PROMOTED_CONVERSATION_DECISION', $5, 1, 'ALL',
           'PENDING', 'gemini-embedding-2-preview', 768,
           'fixed_tokens_500_overlap_50', NOW(), NOW()
         )
         ON CONFLICT (id) DO UPDATE SET "updatedAt" = NOW();`,
        documentId, documentName, fullText.slice(0, 300), startupId, messageId
      ));
    } catch (docErr: any) {
      console.warn(`[Conversation Memory] Document upsert warning:`, docErr.message);
    }
  }

  await ingestDocument(documentId, fullText, documentName, 'executive_decision', {
    startupId,
    sourceType: 'PROMOTED_CONVERSATION_DECISION',
    sourceRecordId: messageId,
    version: 1,
    accessScope: 'ALL'
  });

  return {
    success: true,
    messageId,
    documentId,
    documentName
  };
}

/**
 * Resets in-memory state (useful for test isolation).
 */
export function resetConversationMemoryState(): void {
  inMemoryConversations.clear();
  inMemoryMessages.clear();
}
