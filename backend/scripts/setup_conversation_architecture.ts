/**
 * Catalyst OS — Phase 6 Conversation Architecture Setup & Migration Script
 *
 * Sets up conversation and message tables in Neon PostgreSQL with:
 * - Explicit user ownership and company scope
 * - Message roles, citations, and timestamps
 * - Separation between private user history and shared company knowledge
 * - Proper compound indexes for fast historical lookup and context-window slicing
 */

import 'dotenv/config';
import { prisma, safeDbQuery } from '../services/dbService';

export async function runConversationArchitectureMigration() {
  console.log('\n========================================================================');
  console.log('🚀 CATALYST OS — PHASE 6 CONVERSATION ARCHITECTURE MIGRATION');
  console.log('========================================================================\n');

  try {
    // 1. Create Conversation table
    console.log('[1/4] Ensuring "Conversation" table exists...');
    await safeDbQuery(() => prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Conversation" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "title" TEXT NOT NULL DEFAULT 'New Conversation',
        "userId" TEXT NOT NULL,
        "startupId" TEXT NOT NULL,
        "isArchived" BOOLEAN NOT NULL DEFAULT FALSE,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "Conversation_startupId_fkey" FOREIGN KEY ("startupId") REFERENCES "Startup"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `));
    console.log('  ✅ "Conversation" table verified.');

    // 2. Indexes for Conversation
    console.log('[2/4] Ensuring indexes on "Conversation"...');
    await safeDbQuery(() => prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Conversation_userId_startupId_idx" ON "Conversation"("userId", "startupId");
    `));
    await safeDbQuery(() => prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Conversation_startupId_idx" ON "Conversation"("startupId");
    `));
    console.log('  ✅ Indexes on "Conversation" verified.');

    // 3. Create ConversationMessage table
    console.log('[3/4] Ensuring "ConversationMessage" table exists...');
    await safeDbQuery(() => prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ConversationMessage" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "conversationId" TEXT NOT NULL,
        "role" TEXT NOT NULL,
        "content" TEXT NOT NULL,
        "citations" JSONB,
        "metadata" JSONB,
        "isDecision" BOOLEAN NOT NULL DEFAULT FALSE,
        "isSharedKnowledge" BOOLEAN NOT NULL DEFAULT FALSE,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ConversationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `));
    console.log('  ✅ "ConversationMessage" table verified.');

    // 4. Indexes for ConversationMessage
    console.log('[4/4] Ensuring indexes on "ConversationMessage"...');
    await safeDbQuery(() => prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "ConversationMessage_conversationId_createdAt_idx" ON "ConversationMessage"("conversationId", "createdAt");
    `));
    await safeDbQuery(() => prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "ConversationMessage_isSharedKnowledge_idx" ON "ConversationMessage"("isSharedKnowledge");
    `));
    await safeDbQuery(() => prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "ConversationMessage_isDecision_idx" ON "ConversationMessage"("isDecision");
    `));
    console.log('  ✅ Compound indexes on "ConversationMessage" verified.');

    console.log('\n🎉 Conversation architecture migration finished successfully in Neon PostgreSQL!\n');
    return true;
  } catch (err: any) {
    console.error('❌ Conversation architecture migration failed:', err.message);
    throw err;
  }
}

if (process.argv[1]?.includes('setup_conversation_architecture')) {
  runConversationArchitectureMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
