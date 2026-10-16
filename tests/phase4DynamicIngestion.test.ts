/**
 * Catalyst OS — Phase 4 Dynamic Ingestion and Updates Test Suite
 *
 * Validates:
 * 1. Initial ingestion of existing company data (Profile, Policies, Documents, Decisions, Tasks).
 * 2. Incremental ingestion of new records.
 * 3. Reprocessing of updated documents with version increments.
 * 4. Stale chunk removal: Old chunks are deleted and not returned after edits.
 * 5. Source deletion: Chunks are removed/deactivated, returning 0 results after deletion.
 * 6. Retryable processing failures with attempt tracking and error recording.
 * 7. Duplicate-processing protection using database-backed idempotency keys.
 * 8. Embedding-model and chunking strategy tracking and reindexing.
 * 9. Demonstrable freshness guarantees (timed update-to-query latency).
 * 10. Query independence (user queries are read-only and never trigger complete reindexes).
 */

import 'dotenv/config';
import crypto from 'crypto';
import assert from 'assert';
import { prisma, safeDbQuery } from '../backend/services/dbService';
import { ingestionPipelineService, CURRENT_EMBEDDING_MODEL, CURRENT_CHUNKING_STRATEGY } from '../backend/services/ingestionPipelineService';
import { performHybridSearch, ingestDocument } from '../backend/services/ragEngine';
import { companyPolicyService } from '../backend/services/companyPolicyService';

let totalTests = 0;
let passedTests = 0;

function report(name: string, ok: boolean, detail?: string) {
  totalTests++;
  if (ok) {
    passedTests++;
    console.log(`  ✅ PASS: ${name}`);
  } else {
    console.error(`  ❌ FAIL: ${name}${detail ? ` -> ${detail}` : ''}`);
  }
}

async function runTests() {
  console.log('\n========================================================================');
  console.log('🧪 CATALYST OS — PHASE 4 DYNAMIC INGESTION & DURABLE OUTBOX TEST SUITE');
  console.log('========================================================================\n');

  const testTenantId = `stp_p4_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const testUserId = `usr_p4_${Date.now()}`;

  try {
    // 0. Setup test tenant in Neon Postgres
    console.log('[Setup] Creating isolated test startup tenant...');
    await safeDbQuery(async () => {
      await (prisma.user as any).create({
        data: {
          id: testUserId,
          email: `${testUserId}@catalystos.test`,
          role: 'founder'
        }
      });

      await (prisma.startup as any).create({
        data: {
          id: testTenantId,
          name: 'Apex Robotics Labs',
          industry: 'Industrial Automation',
          description: 'Autonomous warehousing and robotic fulfillment.',
          fundingStage: 'seed',
          cashBalance: 1200000,
          burnRate: 45000,
          healthScore: 92,
          ownerId: testUserId
        }
      });
    });
    report('Test tenant and founder provisioned in database', true);

    // ========================================================================
    // 1. Initial Ingestion of Existing Company Data
    // ========================================================================
    console.log('\n[1] Initial Ingestion of Existing Company Data');

    const initResult = await ingestionPipelineService.initialIngestCompanyData(testTenantId);
    report('initialIngestCompanyData returns ingested count >= 2', initResult.ingestedCount >= 2, `Count: ${initResult.ingestedCount}`);

    // Verify company profile was indexed
    const profileResults = await performHybridSearch('robotic fulfillment and cash balance', testTenantId, 5, 0.7, 'FOUNDER');
    report('RAG search finds newly ingested Company Profile', profileResults.some(r => r.content.includes('Apex Robotics Labs') || r.content.includes('1,200,000')));

    // Verify company policies were indexed
    const policyResults = await performHybridSearch('minimum runway and CFO veto', testTenantId, 5, 0.7, 'FOUNDER');
    report('RAG search finds Company Policy operational boundaries', policyResults.some(r => r.sourceType === 'POLICY'));

    // ========================================================================
    // 2. Incremental Ingestion of New Records
    // ========================================================================
    console.log('\n[2] Incremental Ingestion of New Records');

    const docId1 = `doc_p4_${Date.now()}_alpha`;
    const docContent1 = 'Project Zephyr is an autonomous high-payload robotic arm for automotive assembly lines. The unit cost is $18,500.';

    const job1 = await ingestionPipelineService.enqueueJob({
      startupId: testTenantId,
      sourceType: 'DOCUMENT',
      sourceRecordId: docId1,
      action: 'UPSERT',
      payload: {
        documentId: docId1,
        name: 'Project Zephyr Specifications',
        type: 'technical_spec',
        content: docContent1,
        version: 1,
        accessScope: 'ALL'
      },
      immediate: true
    });

    report('Incremental job enqueued with status COMPLETED', job1.status === 'COMPLETED');

    const zephyrResults = await performHybridSearch('What is the unit cost of Project Zephyr?', testTenantId, 5, 0.7, 'OPERATIONS');
    report('Incremental document is immediately queryable via RAG', zephyrResults.some(r => r.content.includes('$18,500')));

    // ========================================================================
    // 3 & 4. Reprocessing of Updated Documents & Stale Chunk Removal
    // ========================================================================
    console.log('\n[3 & 4] Reprocessing Updated Documents & Stale Chunk Removal');

    const updatedDocContent = 'Project Zephyr revised pricing: The updated unit cost is $24,000 after titanium gear redesign. Old $18,500 pricing is obsolete.';

    const updateJob = await ingestionPipelineService.enqueueJob({
      startupId: testTenantId,
      sourceType: 'DOCUMENT',
      sourceRecordId: docId1,
      action: 'UPSERT',
      payload: {
        documentId: docId1,
        name: 'Project Zephyr Specifications',
        type: 'technical_spec',
        content: updatedDocContent,
        version: 2,
        accessScope: 'ALL'
      },
      immediate: true
    });

    report('Update job processed with incremented version 2', updateJob.status === 'COMPLETED');

    // Verify database document version is updated to 2
    const docInDb: any = await safeDbQuery(() =>
      prisma.$queryRawUnsafe<any[]>(`SELECT version FROM "StartupDocument" WHERE id = $1`, docId1)
    );
    report('StartupDocument version in database is 2', docInDb[0]?.version === 2);

    // Query for new information
    const revisedSearch = await performHybridSearch('unit cost Project Zephyr updated titanium', testTenantId, 5, 0.7, 'OPERATIONS');
    report('RAG search returns updated content ($24,000)', revisedSearch.some(r => r.content.includes('$24,000')));

    // Verify stale chunks are completely removed: no chunks exist with old version
    const staleChunks: any = await safeDbQuery(() =>
      prisma.$queryRawUnsafe<any[]>(
        `SELECT content FROM "KnowledgeChunk" WHERE "documentId" = $1 AND content NOT LIKE '%$24,000%'`,
        docId1
      )
    );
    report('Stale chunks from version 1 are completely purged (0 stale chunks)', staleChunks.length === 0, `Found: ${staleChunks.length}`);

    // ========================================================================
    // 5. Source Deletion & Chunk Deactivation/Removal
    // ========================================================================
    console.log('\n[5] Source Deletion & Chunk Removal');

    const deleteJob = await ingestionPipelineService.enqueueJob({
      startupId: testTenantId,
      sourceType: 'DOCUMENT',
      sourceRecordId: docId1,
      action: 'DELETE',
      payload: { documentId: docId1 },
      immediate: true
    });

    report('Delete job completed successfully', deleteJob.status === 'COMPLETED');

    // Verify all chunks for docId1 are purged from database
    const remainingChunks: any = await safeDbQuery(() =>
      prisma.$queryRawUnsafe<any[]>(`SELECT id FROM "KnowledgeChunk" WHERE "documentId" = $1`, docId1)
    );
    report('0 KnowledgeChunk records remain in database after source deletion', remainingChunks.length === 0);

    // Verify RAG search returns 0 results for deleted document
    const afterDeleteSearch = await performHybridSearch('Project Zephyr titanium gear', testTenantId, 5, 0.7, 'FOUNDER');
    report('RAG search returns NO results for deleted document', !afterDeleteSearch.some(r => r.documentId === docId1));

    // ========================================================================
    // 6. Retryable Processing Failures & Error Tracking
    // ========================================================================
    console.log('\n[6] Retryable Processing Failures & Error Tracking');

    const faultyJobId = `job_faulty_${Date.now()}`;
    const faultyKey = `job:${testTenantId}:FAULTY:doc_faulty:UPSERT:v1`;

    // Insert a job that will fail (empty content)
    await safeDbQuery(() =>
      prisma.$executeRawUnsafe(
        `INSERT INTO "KnowledgeJob" (
          id, "startupId", "sourceType", "sourceRecordId", action, status,
          payload, "idempotencyKey", attempts, "maxAttempts", "embeddingModel",
          "chunkingStrategy", "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, 'DOCUMENT', 'doc_faulty', 'UPSERT', 'PENDING',
          '{"content": ""}'::jsonb, $3, 0, 2, 'gemini-embedding-2-preview',
          'fixed_tokens_500_overlap_50', NOW(), NOW()
        );`,
        faultyJobId,
        testTenantId,
        faultyKey
      )
    );

    // Attempt 1: should fail and remain PENDING for retry
    const res1 = await ingestionPipelineService.processJob(faultyJobId);
    report('Attempt 1 fails and captures error', !res1.success && !!res1.error);

    const jobAfterAttempt1 = await ingestionPipelineService.getJobStatus(faultyJobId);
    report('Job attempts incremented to 1 and status is PENDING', jobAfterAttempt1?.attempts === 1 && jobAfterAttempt1?.status === 'PENDING');

    // Attempt 2: reaches maxAttempts (2) -> transitions to FAILED
    const res2 = await ingestionPipelineService.processJob(faultyJobId);
    report('Attempt 2 reaches maxAttempts and fails', !res2.success);

    const jobAfterAttempt2 = await ingestionPipelineService.getJobStatus(faultyJobId);
    report('Job transitions to FAILED with lastError recorded', jobAfterAttempt2?.status === 'FAILED' && !!jobAfterAttempt2?.lastError);

    // Test retryJob functionality
    // Update payload with valid content to simulate resolution
    await safeDbQuery(() =>
      prisma.$executeRawUnsafe(
        `UPDATE "KnowledgeJob" SET payload = '{"content": "Resolved error content with valid text."}'::jsonb WHERE id = $1`,
        faultyJobId
      )
    );

    const retryRes = await ingestionPipelineService.retryJob(faultyJobId);
    report('retryJob successfully processes after resolving underlying issue', retryRes.success);

    const jobAfterRetry = await ingestionPipelineService.getJobStatus(faultyJobId);
    report('Job status transitions to COMPLETED after retry', jobAfterRetry?.status === 'COMPLETED');

    // ========================================================================
    // 7. Duplicate-Processing Protection
    // ========================================================================
    console.log('\n[7] Duplicate-Processing Protection');

    const dupRecordId = `doc_dup_${Date.now()}`;
    const dupKey = `job:${testTenantId}:DOCUMENT:${dupRecordId}:UPSERT:v1`;

    const jobFirst = await ingestionPipelineService.enqueueJob({
      startupId: testTenantId,
      sourceType: 'DOCUMENT',
      sourceRecordId: dupRecordId,
      action: 'UPSERT',
      idempotencyKey: dupKey,
      payload: {
        documentId: dupRecordId,
        name: 'Deduplication Test Doc',
        content: 'This document tests duplicate job protection.'
      },
      immediate: true
    });

    const jobSecond = await ingestionPipelineService.enqueueJob({
      startupId: testTenantId,
      sourceType: 'DOCUMENT',
      sourceRecordId: dupRecordId,
      action: 'UPSERT',
      idempotencyKey: dupKey,
      payload: {
        documentId: dupRecordId,
        name: 'Deduplication Test Doc',
        content: 'This document tests duplicate job protection.'
      },
      immediate: false
    });

    report('Idempotency key prevents duplicate job creation (same job ID returned)', jobFirst.id === jobSecond.id);

    // Verify only 1 job exists in the database for this idempotency key
    const dbJobCount: any = await safeDbQuery(() =>
      prisma.$queryRawUnsafe<any[]>(
        `SELECT COUNT(*) as count FROM "KnowledgeJob" WHERE "idempotencyKey" = $1`,
        dupKey
      )
    );
    report('Exactly 1 job record in database for idempotency key', parseInt(dbJobCount[0]?.count, 10) === 1);

    // ========================================================================
    // 8. Embedding-Model Version Tracking & Reindexing
    // ========================================================================
    console.log('\n[8] Embedding-Model Tracking & Reindexing');

    const modelDocId = `doc_model_${Date.now()}`;
    await ingestionPipelineService.enqueueJob({
      startupId: testTenantId,
      sourceType: 'DOCUMENT',
      sourceRecordId: modelDocId,
      action: 'UPSERT',
      payload: {
        documentId: modelDocId,
        name: 'Model Tracking Document',
        content: 'Content verifying embedding model version tracking.'
      },
      immediate: true
    });

    // Verify current model metadata on document and chunks
    const modelDocInDb: any = await safeDbQuery(() =>
      prisma.$queryRawUnsafe<any[]>(
        `SELECT "embeddingModel", "chunkingStrategy" FROM "StartupDocument" WHERE id = $1`,
        modelDocId
      )
    );
    report(
      'Document tracks embeddingModel (gemini-embedding-2-preview) and chunkingStrategy',
      modelDocInDb[0]?.embeddingModel === CURRENT_EMBEDDING_MODEL &&
        modelDocInDb[0]?.chunkingStrategy === CURRENT_CHUNKING_STRATEGY
    );

    // Simulate an outdated document that was indexed under legacy model
    await safeDbQuery(() =>
      prisma.$executeRawUnsafe(
        `UPDATE "StartupDocument" SET "embeddingModel" = 'legacy-text-embedding-001' WHERE id = $1`,
        modelDocId
      )
    );

    // Run reindexOutdatedDocuments
    const reindexResult = await ingestionPipelineService.reindexOutdatedDocuments(testTenantId);
    report('reindexOutdatedDocuments identifies and reindexes outdated document', reindexResult.reindexedCount >= 1);

    const reindexedDoc: any = await safeDbQuery(() =>
      prisma.$queryRawUnsafe<any[]>(
        `SELECT "embeddingModel", version FROM "StartupDocument" WHERE id = $1`,
        modelDocId
      )
    );
    report('Document reindexed to current model version', reindexedDoc[0]?.embeddingModel === CURRENT_EMBEDDING_MODEL);

    // ========================================================================
    // 9. Demonstrable Freshness Guarantees (Update-to-Query Latency)
    // ========================================================================
    console.log('\n[9] Demonstrable Freshness Guarantees');

    const freshnessDocId = `doc_fresh_${Date.now()}`;
    const uniqueSecretToken = `KRYPTON_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const freshnessContent = `Critical security passkey for lab sector 7 is: ${uniqueSecretToken}.`;

    const startIngest = Date.now();
    await ingestionPipelineService.enqueueJob({
      startupId: testTenantId,
      sourceType: 'DOCUMENT',
      sourceRecordId: freshnessDocId,
      action: 'UPSERT',
      payload: {
        documentId: freshnessDocId,
        name: 'Sector 7 Security Passkey',
        content: freshnessContent,
        accessScope: 'ALL'
      },
      immediate: true
    });
    const ingestDuration = Date.now() - startIngest;

    const startQuery = Date.now();
    const freshSearchResults = await performHybridSearch(`What is the passkey for lab sector 7 ${uniqueSecretToken}`, testTenantId, 5, 0.7, 'FOUNDER');
    const queryDuration = Date.now() - startQuery;

    const matched = freshSearchResults.some(r => r.content.includes(uniqueSecretToken));
    report('Record becomes queryable immediately after ingestion', matched);
    report(`Ingest-to-query freshness latency demonstrated (${ingestDuration}ms ingest, ${queryDuration}ms retrieval)`, ingestDuration < 30000 && queryDuration < 5000);

    // ========================================================================
    // 10. Query Independence (User Queries NEVER Trigger Reindexes)
    // ========================================================================
    console.log('\n[10] Query Independence');

    // Count chunks and jobs before query
    const chunkCountBefore: any = await safeDbQuery(() =>
      prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*) as count FROM "KnowledgeChunk" WHERE "startupId" = $1`, testTenantId)
    );
    const jobCountBefore: any = await safeDbQuery(() =>
      prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*) as count FROM "KnowledgeJob" WHERE "startupId" = $1`, testTenantId)
    );

    // Run 5 diverse user queries
    await performHybridSearch('robotic fulfillment', testTenantId, 5, 0.7, 'FOUNDER');
    await performHybridSearch('unit cost', testTenantId, 5, 0.7, 'OPERATIONS');
    await performHybridSearch('cash balance', testTenantId, 5, 0.7, 'FINANCE');
    await performHybridSearch('company policies', testTenantId, 5, 0.7, 'FOUNDER');
    await performHybridSearch('security passkey', testTenantId, 5, 0.7, 'FOUNDER');

    // Count chunks and jobs after query
    const chunkCountAfter: any = await safeDbQuery(() =>
      prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*) as count FROM "KnowledgeChunk" WHERE "startupId" = $1`, testTenantId)
    );
    const jobCountAfter: any = await safeDbQuery(() =>
      prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*) as count FROM "KnowledgeJob" WHERE "startupId" = $1`, testTenantId)
    );

    report('Chunk count is strictly unchanged after user queries (query independence)', chunkCountBefore[0]?.count === chunkCountAfter[0]?.count);
    report('No reindexing jobs were enqueued by user queries', jobCountBefore[0]?.count === jobCountAfter[0]?.count);

    // Cleanup test data
    console.log('\n[Cleanup] Removing isolated test tenant data...');
    await safeDbQuery(async () => {
      await prisma.$executeRawUnsafe(`DELETE FROM "KnowledgeChunk" WHERE "startupId" = $1`, testTenantId);
      await prisma.$executeRawUnsafe(`DELETE FROM "KnowledgeJob" WHERE "startupId" = $1`, testTenantId);
      await prisma.$executeRawUnsafe(`DELETE FROM "StartupDocument" WHERE "startupId" = $1`, testTenantId);
      await (prisma.startup as any).deleteMany({ where: { id: testTenantId } });
      await (prisma.user as any).deleteMany({ where: { id: testUserId } });
    });
    report('Test tenant data cleaned up', true);

  } catch (err: any) {
    console.error('Fatal test error:', err);
    report('Unexpected fatal error', false, err.message);
  }

  console.log('\n========================================================================');
  console.log(`Phase 4 Tests Finished: ${passedTests} passed, ${totalTests - passedTests} failed`);
  console.log('========================================================================\n');

  if (totalTests - passedTests > 0) {
    process.exit(1);
  }
}

runTests().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
