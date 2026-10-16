/**
 * Catalyst OS — Phase 4 Dynamic Ingestion and Durable Outbox Setup Script
 *
 * 1. Adds model & strategy tracking columns to StartupDocument & KnowledgeChunk.
 * 2. Adds active state tracking for deactivation of chunks upon source deletion.
 * 3. Creates the durable outbox table `KnowledgeJob` for reliable asynchronous
 *    ingestion, retries, duplicate-processing protection, and status tracking.
 * 4. Creates performance indexes on KnowledgeJob and KnowledgeChunk.
 */

import 'dotenv/config';
import { prisma, safeDbQuery } from '../services/dbService';

export async function runPhase4Migration() {
  console.log('\n========================================================================');
  console.log('🚀 CATALYST OS — PHASE 4 DYNAMIC INGESTION ARCHITECTURE MIGRATION');
  console.log('========================================================================\n');

  try {
    // 1. Add model tracking columns to StartupDocument
    console.log('[1/4] Adding embedding model and chunking strategy columns to "StartupDocument"...');
    await safeDbQuery(() => prisma.$executeRawUnsafe(`
      ALTER TABLE "StartupDocument"
        ADD COLUMN IF NOT EXISTS "embeddingModel" VARCHAR(100) DEFAULT 'gemini-embedding-2-preview',
        ADD COLUMN IF NOT EXISTS "embeddingDimensions" INT DEFAULT 768,
        ADD COLUMN IF NOT EXISTS "chunkingStrategy" VARCHAR(100) DEFAULT 'fixed_tokens_500_overlap_50';
    `));
    console.log('  ✅ StartupDocument columns verified.');

    // 2. Add model tracking & active status columns to KnowledgeChunk
    console.log('[2/4] Adding model, strategy & active columns to "KnowledgeChunk"...');
    await safeDbQuery(() => prisma.$executeRawUnsafe(`
      ALTER TABLE "KnowledgeChunk"
        ADD COLUMN IF NOT EXISTS "embeddingModel" VARCHAR(100) DEFAULT 'gemini-embedding-2-preview',
        ADD COLUMN IF NOT EXISTS "chunkingStrategy" VARCHAR(100) DEFAULT 'fixed_tokens_500_overlap_50',
        ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT TRUE;
    `));
    console.log('  ✅ KnowledgeChunk columns verified.');

    // 3. Create durable outbox table: KnowledgeJob
    console.log('[3/4] Creating durable outbox table "KnowledgeJob"...');
    await safeDbQuery(() => prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "KnowledgeJob" (
        "id" VARCHAR(64) PRIMARY KEY,
        "startupId" VARCHAR(64) NOT NULL,
        "sourceType" VARCHAR(64) NOT NULL DEFAULT 'DOCUMENT',
        "sourceRecordId" VARCHAR(128) NOT NULL,
        "action" VARCHAR(32) NOT NULL DEFAULT 'UPSERT',
        "status" VARCHAR(32) NOT NULL DEFAULT 'PENDING',
        "payload" JSONB,
        "idempotencyKey" VARCHAR(256) UNIQUE NOT NULL,
        "attempts" INT NOT NULL DEFAULT 0,
        "maxAttempts" INT NOT NULL DEFAULT 3,
        "lastError" TEXT,
        "embeddingModel" VARCHAR(100) NOT NULL DEFAULT 'gemini-embedding-2-preview',
        "chunkingStrategy" VARCHAR(100) NOT NULL DEFAULT 'fixed_tokens_500_overlap_50',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "processedAt" TIMESTAMP(3)
      );
    `));
    console.log('  ✅ KnowledgeJob table verified.');

    // 4. Create performance indexes
    console.log('[4/4] Creating indexes for durable job processing & chunk filtering...');
    await safeDbQuery(() => prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_kjob_startup_status" ON "KnowledgeJob" ("startupId", "status");
    `));
    await safeDbQuery(() => prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_kjob_status_created" ON "KnowledgeJob" ("status", "createdAt");
    `));
    await safeDbQuery(() => prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_kjob_source" ON "KnowledgeJob" ("sourceType", "sourceRecordId");
    `));
    await safeDbQuery(() => prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_chunk_active" ON "KnowledgeChunk" ("startupId", "isActive");
    `));
    await safeDbQuery(() => prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_chunk_model" ON "KnowledgeChunk" ("embeddingModel");
    `));
    console.log('  ✅ Performance indexes created successfully.');

    console.log('\n========================================================================');
    console.log('🎉 PHASE 4 DYNAMIC INGESTION MIGRATION COMPLETE');
    console.log('========================================================================\n');
  } catch (err: any) {
    console.error('❌ Phase 4 Migration failed:', err.message);
    throw err;
  }
}

// Execute when run directly
runPhase4Migration()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
