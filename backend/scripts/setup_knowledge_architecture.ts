/**
 * Catalyst OS — Phase 3 Knowledge Architecture Setup & Migration Script
 *
 * 1. Enables native PostgreSQL `vector` extension (pgvector) in Neon Postgres.
 * 2. Adds the native `embedding vector(768)` column to the `Embedding` table.
 * 3. Populates native vector embeddings from existing float arrays.
 * 4. Builds an HNSW cosine similarity index for fast O(log N) vector searches.
 * 5. Backfills tenant metadata (startupId, sourceType, accessScope) onto existing chunks.
 * 6. Builds compound indexes for tenant filtering, source lookup, and access scopes.
 */

import 'dotenv/config';
import { prisma, safeDbQuery } from '../services/dbService';

export async function runKnowledgeArchitectureMigration() {
  console.log('\n========================================================================');
  console.log('🚀 CATALYST OS — PHASE 3 KNOWLEDGE ARCHITECTURE MIGRATION');
  console.log('========================================================================\n');

  try {
    // 1. Enable pgvector extension
    console.log('[1/6] Enabling pgvector extension in Neon Postgres...');
    await safeDbQuery(() => prisma.$executeRawUnsafe(`
      CREATE EXTENSION IF NOT EXISTS vector;
    `));
    console.log('  ✅ pgvector extension enabled.');

    // 2. Add native embedding column to Embedding table
    console.log('[2/6] Ensuring native vector(768) column on "Embedding" table...');
    await safeDbQuery(() => prisma.$executeRawUnsafe(`
      ALTER TABLE "Embedding" ADD COLUMN IF NOT EXISTS embedding vector(768);
    `));
    console.log('  ✅ Native vector(768) column verified.');

    // 3. Backfill startupId on KnowledgeChunk from parent StartupDocument
    console.log('[3/6] Backfilling tenant startupId onto existing KnowledgeChunk records...');
    const backfillCount = await safeDbQuery(() => prisma.$executeRawUnsafe(`
      UPDATE "KnowledgeChunk" c
      SET "startupId" = d."startupId",
          "sourceType" = COALESCE(d."sourceType", 'DOCUMENT'),
          "accessScope" = COALESCE(d."accessScope", 'ALL')
      FROM "StartupDocument" d
      WHERE c."documentId" = d.id
        AND (c."startupId" = 'default_startup' OR c."startupId" IS NULL);
    `));
    console.log(`  ✅ Backfilled tenant metadata on ${backfillCount} existing chunks.`);

    // 4. Populate native vector column from existing float array
    console.log('[4/6] Synchronizing float array vectors into native pgvector column...');
    const vectorSyncCount = await safeDbQuery(() => prisma.$executeRawUnsafe(`
      UPDATE "Embedding"
      SET embedding = vector::text::vector
      WHERE embedding IS NULL AND vector IS NOT NULL AND array_length(vector, 1) = 768;
    `));
    console.log(`  ✅ Synchronized ${vectorSyncCount} vectors into native pgvector format.`);

    // 5. Create HNSW index for vector cosine similarity search
    console.log('[5/6] Creating HNSW Cosine vector index on "Embedding"...');
    await safeDbQuery(() => prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS embedding_hnsw_idx 
      ON "Embedding" 
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64);
    `));
    console.log('  ✅ HNSW cosine index verified.');

    // 6. Create composite indexes for company filtering, source lookup, and access scopes
    console.log('[6/6] Verifying composite tenant & access scope indexes...');
    await safeDbQuery(() => prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_doc_tenant_source 
      ON "StartupDocument" ("startupId", "sourceType");
    `));

    await safeDbQuery(() => prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_doc_tenant_scope 
      ON "StartupDocument" ("startupId", "accessScope");
    `));

    await safeDbQuery(() => prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_doc_source_record 
      ON "StartupDocument" ("sourceRecordId");
    `));

    await safeDbQuery(() => prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_chunk_tenant_scope 
      ON "KnowledgeChunk" ("startupId", "accessScope");
    `));

    await safeDbQuery(() => prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_chunk_source_record 
      ON "KnowledgeChunk" ("startupId", "sourceRecordId");
    `));

    await safeDbQuery(() => prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_chunk_doc_index 
      ON "KnowledgeChunk" ("documentId", "chunkIndex");
    `));

    console.log('  ✅ Composite indexes created successfully.');

    console.log('\n========================================================================');
    console.log('🎉 PHASE 3 KNOWLEDGE ARCHITECTURE MIGRATION COMPLETE');
    console.log('========================================================================\n');
  } catch (err: any) {
    console.error('❌ Migration failed:', err.message);
    throw err;
  }
}

// Execute when run directly
runKnowledgeArchitectureMigration()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
