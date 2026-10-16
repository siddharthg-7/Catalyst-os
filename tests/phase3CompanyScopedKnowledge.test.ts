/**
 * Catalyst OS — Phase 3 Company-Scoped Knowledge Architecture Test Suite
 *
 * Validates:
 * 1. Neon Postgres Schema: Metadata columns exist (startupId, sourceType, sourceRecordId,
 *    version, accessScope, indexingStatus, errorMessage, chunkIndex, tokenCount, timestamps).
 * 2. Neon pgvector Integration: Extension is active, native embedding vector(768) column exists,
 *    and HNSW cosine index (idx_embedding_vector_hnsw) is functional.
 * 3. Ingestion Pipeline: Chunks have deterministic stable identifiers (chk_<docId>_<chunkIndex>),
 *    full metadata inheritance, and indexingStatus lifecycle (PENDING -> INDEXING -> COMPLETED).
 * 4. Query-Level Tenant Isolation: Queries strictly isolate companies at the SQL level.
 *    Company Beta NEVER retrieves Company Alpha knowledge under any circumstances.
 * 5. Query-Level Access Scope Authorization: Role-based filtering at the SQL level
 *    (General employee cannot retrieve FINANCE, HR, or FOUNDER_ONLY documents;
 *     Finance employee cannot retrieve HR or FOUNDER_ONLY documents;
 *     Founder has full access to all company scopes).
 * 6. API Endpoints: GET /api/knowledge, POST /api/knowledge, POST /api/knowledge/query,
 *    and POST /api/chat enforce tenant boundaries and role scopes.
 */

process.env.NODE_ENV = 'test';
process.env.STRICT_AUTH = 'true';

import 'dotenv/config';
import http from 'http';
import express from 'express';
import jwt from 'jsonwebtoken';
import apiRouter from '../backend/routes/api';
import { JWT_SECRET } from '../backend/services/neonAuthMiddleware';
import { prisma, safeDbQuery, hasValidDbUrl } from '../backend/services/dbService';
import { ingestDocument, performHybridSearch, buildContext, RetrievedChunk } from '../backend/services/ragEngine';

let passed = 0;
let failed = 0;

function assert(condition: boolean, title: string, details?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${title}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${title} - ${details || 'Assertion failed'}`);
    failed++;
  }
}

async function runPhase3Tests() {
  console.log('\n========================================================================');
  console.log('🧪 CATALYST OS — PHASE 3 COMPANY-SCOPED KNOWLEDGE ARCHITECTURE TESTS');
  console.log('========================================================================\n');

  if (!hasValidDbUrl || !prisma) {
    console.error('❌ Neon PostgreSQL database is not connected. Aborting tests.');
    process.exit(1);
  }

  const runId = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  try {
    // ------------------------------------------------------------------------
    // TEST 1: Neon Postgres Schema & pgvector Extension Verification
    // ------------------------------------------------------------------------
    console.log('[1] Database Schema & Native pgvector Verification');
    {
      // 1.1 Verify pgvector extension
      const extRows = await safeDbQuery(() => prisma.$queryRawUnsafe<any[]>(
        `SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';`
      ));
      assert(extRows.length > 0, 'Neon PostgreSQL vector extension is installed and active', `Version: ${extRows[0]?.extversion}`);

      // 1.2 Verify StartupDocument metadata columns
      const docCols = await safeDbQuery(() => prisma.$queryRawUnsafe<any[]>(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'StartupDocument' AND column_name IN (
          'startupId', 'sourceType', 'sourceRecordId', 'version', 'accessScope', 'indexingStatus', 'errorMessage', 'createdAt', 'updatedAt'
        );
      `));
      const docColNames = docCols.map(c => c.column_name);
      assert(docColNames.includes('startupId'), 'StartupDocument has tenant column (startupId)');
      assert(docColNames.includes('sourceType'), 'StartupDocument has sourceType column');
      assert(docColNames.includes('sourceRecordId'), 'StartupDocument has sourceRecordId column');
      assert(docColNames.includes('version'), 'StartupDocument has version column');
      assert(docColNames.includes('accessScope'), 'StartupDocument has accessScope column');
      assert(docColNames.includes('indexingStatus'), 'StartupDocument has indexingStatus column');
      assert(docColNames.includes('errorMessage'), 'StartupDocument has errorMessage column');

      // 1.3 Verify KnowledgeChunk metadata columns
      const chunkCols = await safeDbQuery(() => prisma.$queryRawUnsafe<any[]>(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'KnowledgeChunk' AND column_name IN (
          'chunkIndex', 'startupId', 'sourceType', 'sourceRecordId', 'accessScope', 'tokenCount', 'documentId'
        );
      `));
      const chunkColNames = chunkCols.map(c => c.column_name);
      assert(chunkColNames.includes('chunkIndex'), 'KnowledgeChunk has chunkIndex column');
      assert(chunkColNames.includes('startupId'), 'KnowledgeChunk has tenant column (startupId)');
      assert(chunkColNames.includes('sourceType'), 'KnowledgeChunk has sourceType column');
      assert(chunkColNames.includes('sourceRecordId'), 'KnowledgeChunk has sourceRecordId column');
      assert(chunkColNames.includes('accessScope'), 'KnowledgeChunk has accessScope column');
      assert(chunkColNames.includes('tokenCount'), 'KnowledgeChunk has tokenCount column');

      // 1.4 Verify Embedding native pgvector column and HNSW index
      const embCols = await safeDbQuery(() => prisma.$queryRawUnsafe<any[]>(`
        SELECT column_name, udt_name 
        FROM information_schema.columns 
        WHERE table_name = 'Embedding' AND column_name = 'embedding';
      `));
      assert(embCols.length > 0 && embCols[0].udt_name === 'vector', 'Embedding has native embedding vector(768) column', `Type: ${embCols[0]?.udt_name}`);

      const indexRows = await safeDbQuery(() => prisma.$queryRawUnsafe<any[]>(`
        SELECT indexname, indexdef FROM pg_indexes 
        WHERE tablename = 'Embedding' AND indexname IN ('embedding_hnsw_idx', 'idx_embedding_vector_hnsw');
      `));
      assert(indexRows.length > 0, 'HNSW cosine vector index (embedding_hnsw_idx) is active in Neon Postgres');
    }

    // ------------------------------------------------------------------------
    // TEST 2: Ingestion Pipeline: Stable Chunk Identifiers & Complete Metadata
    // ------------------------------------------------------------------------
    console.log('\n[2] Ingestion Pipeline: Stable Identifiers & Metadata Provenance');
    const tenantAlphaId = `startup_alpha_${runId}`;
    const tenantBetaId = `startup_beta_${runId}`;
    const alphaFounderId = `usr_founder_alpha_${runId}`;
    const betaFounderId = `usr_founder_beta_${runId}`;
    const alphaFinanceUserId = `usr_fin_alpha_${runId}`;

    // Create test owners
    await safeDbQuery(() => (prisma.user as any).create({
      data: {
        id: alphaFounderId,
        email: `founder_${runId}@alpha.aero`,
        name: 'Commander Shepard',
        role: 'Founder',
        emailVerified: true
      }
    }));

    await safeDbQuery(() => (prisma.user as any).create({
      data: {
        id: betaFounderId,
        email: `founder_${runId}@beta.bio`,
        name: 'Garrus Vakarian',
        role: 'Founder',
        emailVerified: true
      }
    }));

    // Create test startups in database
    await safeDbQuery(() => prisma.startup.create({
      data: {
        id: tenantAlphaId,
        name: `Alpha Aerospace ${runId}`,
        description: 'Next-generation orbital propulsion systems.',
        industry: 'Aerospace',
        fundingStage: 'Series A',
        cashBalance: 5000000,
        burnRate: 120000,
        healthScore: 92,
        ownerId: alphaFounderId
      }
    }));

    await safeDbQuery(() => prisma.startup.create({
      data: {
        id: tenantBetaId,
        name: `Beta BioTech ${runId}`,
        description: 'Synthetic enzymes and gene therapies.',
        industry: 'BioTech',
        fundingStage: 'Seed',
        cashBalance: 1200000,
        burnRate: 45000,
        healthScore: 84,
        ownerId: betaFounderId
      }
    }));

    const docAlphaGeneralId = `doc_alpha_gen_${runId}`;
    const docAlphaGeneralText = `
      Alpha Aerospace Corporate Governance and Overview.
      Mission: Building next-generation orbital propulsion systems for commercial micro-satellites.
      Headquarters: Austin, Texas. Total headcount: 42 full-time engineers and staff.
      Standard operating hours are 9am to 6pm Central Time with flexible hybrid schedules.
    `;

    {
      // Create document record
      await safeDbQuery(() => (prisma.startupDocument as any).create({
        data: {
          id: docAlphaGeneralId,
          name: 'Alpha General Handbook',
          type: 'handbook',
          size: '1.2 KB',
          summary: 'Corporate overview and operating standards for Alpha Aerospace.',
          insights: ['Hybrid working model active.', '42 total team headcount.'],
          startupId: tenantAlphaId,
          sourceType: 'DOCUMENT',
          sourceRecordId: 'rec_gen_001',
          version: 1,
          accessScope: 'ALL',
          indexingStatus: 'PENDING'
        }
      }));

      // Ingest document
      await ingestDocument(docAlphaGeneralId, docAlphaGeneralText, 'Alpha General Handbook', 'handbook', {
        startupId: tenantAlphaId,
        sourceType: 'DOCUMENT',
        sourceRecordId: 'rec_gen_001',
        version: 1,
        accessScope: 'ALL'
      });

      // Verify document status was updated to COMPLETED
      const updatedDoc: any = await safeDbQuery(() => prisma.startupDocument.findUnique({
        where: { id: docAlphaGeneralId }
      }));
      assert(updatedDoc.indexingStatus === 'COMPLETED', 'Document indexingStatus transitioned to COMPLETED');
      assert(updatedDoc.errorMessage === null, 'Document errorMessage is null on successful indexing');

      // Verify chunks have stable IDs: chk_<docId>_<chunkIndex>
      const chunks: any[] = await safeDbQuery(() => (prisma.knowledgeChunk as any).findMany({
        where: { documentId: docAlphaGeneralId },
        orderBy: { chunkIndex: 'asc' },
        include: { embedding: true }
      }));

      assert(chunks.length > 0, `Generated ${chunks.length} chunks from document text`);
      assert(chunks[0].id === `chk_${docAlphaGeneralId}_0`, 'Chunk has deterministic stable ID (chk_<docId>_0)', chunks[0].id);
      assert(chunks[0].chunkIndex === 0, 'Chunk chunkIndex is 0');
      assert(chunks[0].startupId === tenantAlphaId, 'Chunk inherits company/tenant ID');
      assert(chunks[0].sourceType === 'DOCUMENT', 'Chunk inherits sourceType');
      assert(chunks[0].sourceRecordId === 'rec_gen_001', 'Chunk inherits sourceRecordId');
      assert(chunks[0].accessScope === 'ALL', 'Chunk inherits accessScope ALL');
      assert(typeof chunks[0].tokenCount === 'number' && chunks[0].tokenCount > 0, 'Chunk has calculated tokenCount');
      assert(chunks[0].embedding !== null, 'Chunk has associated Embedding record');
      assert(Array.isArray(chunks[0].embedding?.vector) && chunks[0].embedding.vector.length === 768, 'Embedding vector has exact 768 dimensions');

      // Verify native pgvector column is populated
      const nativeEmbRows = await safeDbQuery(() => prisma.$queryRawUnsafe<any[]>(`
        SELECT "chunkId", (embedding IS NOT NULL) as "hasNativeVector"
        FROM "Embedding"
        WHERE "chunkId" = $1;
      `, chunks[0].id));
      assert(Boolean(nativeEmbRows[0]?.hasNativeVector), 'Native pgvector column embedding vector(768) is populated in database');
    }

    // ------------------------------------------------------------------------
    // TEST 3: Database-Query Level Tenant Isolation
    // ------------------------------------------------------------------------
    console.log('\n[3] Database-Query Level Tenant Isolation');
    {
      // Ingest confidential document into Beta BioTech
      const docBetaSecretId = `doc_beta_secret_${runId}`;
      const docBetaSecretText = `
        Beta BioTech Proprietary Genome CRISPR Splice Sequence.
        Formula AlphaBetaGamma-99: Highly confidential synthetic enzyme designed for DNA repair.
        Valuation target for upcoming Series A is $40 million.
      `;

      await safeDbQuery(() => (prisma.startupDocument as any).create({
        data: {
          id: docBetaSecretId,
          name: 'Beta BioTech CRISPR Secret',
          type: 'patent',
          size: '1.5 KB',
          summary: 'Proprietary enzyme sequences.',
          insights: ['Enzyme AlphaBetaGamma-99 formulation.'],
          startupId: tenantBetaId,
          sourceType: 'DOCUMENT',
          version: 1,
          accessScope: 'ALL',
          indexingStatus: 'PENDING'
        }
      }));

      await ingestDocument(docBetaSecretId, docBetaSecretText, 'Beta BioTech CRISPR Secret', 'patent', {
        startupId: tenantBetaId,
        sourceType: 'DOCUMENT',
        version: 1,
        accessScope: 'ALL'
      });

      // 3.1 Company Alpha queries for Beta's confidential term "CRISPR Splice Sequence"
      const alphaCrossTenantResults = await performHybridSearch(
        'Proprietary Genome CRISPR Splice Sequence AlphaBetaGamma-99',
        tenantAlphaId,
        10
      );

      const foreignChunks = alphaCrossTenantResults.filter(c => c.startupId !== tenantAlphaId);
      assert(foreignChunks.length === 0, 'Tenant Alpha search NEVER retrieves foreign company documents (0 foreign chunks)');
      const leakedBetaDoc = alphaCrossTenantResults.find(c => c.startupId === tenantBetaId || c.documentId === docBetaSecretId);
      assert(!leakedBetaDoc, 'Zero Beta BioTech records leaked to Alpha Aerospace');

      const emptyCompanyResults = await performHybridSearch('Proprietary Genome CRISPR', `startup_empty_${runId}`, 5);
      assert(emptyCompanyResults.length === 0, 'Company with zero documents retrieves 0 chunks (no global leak)');

      // 3.2 Company Beta queries for their own term
      const betaValidResults = await performHybridSearch(
        'Proprietary Genome CRISPR Splice Sequence',
        tenantBetaId,
        5
      );
      assert(betaValidResults.length > 0, 'Tenant Beta successfully retrieves their own document chunks');
      assert(betaValidResults[0].startupId === tenantBetaId, 'Retrieved chunk verified to belong to Tenant Beta');

      // 3.3 Query without startupId is blocked immediately
      const emptyTenantResults = await performHybridSearch('Proprietary Genome', '', 5);
      assert(emptyTenantResults.length === 0, 'Query without startupId is rejected immediately and returns empty array');
    }

    // ------------------------------------------------------------------------
    // TEST 4: Query-Level Role & Team Access Scope Authorization
    // ------------------------------------------------------------------------
    console.log('\n[4] Query-Level Role & Access Scope Authorization');
    {
      // Within Alpha Aerospace, ingest documents across 4 access scopes:
      // 1. ALL (Handbook already ingested)
      // 2. FINANCE (Confidential Runway & Cap Table)
      // 3. HR (Confidential Salaries & PIPs)
      // 4. FOUNDER_ONLY (M&A Term Sheet)

      const docAlphaFinanceId = `doc_alpha_fin_${runId}`;
      await safeDbQuery(() => (prisma.startupDocument as any).create({
        data: {
          id: docAlphaFinanceId,
          name: 'Q3 Financial Runway Model',
          type: 'financial',
          size: '2.1 KB',
          summary: 'Financial runway and cap table details.',
          insights: ['Runway 24 months.'],
          startupId: tenantAlphaId,
          sourceType: 'FINANCIAL',
          version: 2,
          accessScope: 'FINANCE',
          indexingStatus: 'PENDING'
        }
      }));
      await ingestDocument(docAlphaFinanceId, 'Confidential Q3 Financials: Current cash reserves $5,000,000, runway 24 months, pre-money valuation $25M.', 'Q3 Financial Runway Model', 'financial', {
        startupId: tenantAlphaId,
        sourceType: 'FINANCIAL',
        version: 2,
        accessScope: 'FINANCE'
      });

      const docAlphaHRId = `doc_alpha_hr_${runId}`;
      await safeDbQuery(() => (prisma.startupDocument as any).create({
        data: {
          id: docAlphaHRId,
          name: 'Executive Compensation Plan',
          type: 'hr',
          size: '1.8 KB',
          summary: 'Executive compensation tiers and equity allocations.',
          insights: ['VP Engineering compensation plan.'],
          startupId: tenantAlphaId,
          sourceType: 'POLICY',
          version: 1,
          accessScope: 'HR',
          indexingStatus: 'PENDING'
        }
      }));
      await ingestDocument(docAlphaHRId, 'Confidential HR compensation: VP of Engineering base salary $240,000 with 1.5% equity vesting over 4 years.', 'Executive Compensation Plan', 'hr', {
        startupId: tenantAlphaId,
        sourceType: 'POLICY',
        version: 1,
        accessScope: 'HR'
      });

      const docAlphaFounderId = `doc_alpha_founder_${runId}`;
      await safeDbQuery(() => (prisma.startupDocument as any).create({
        data: {
          id: docAlphaFounderId,
          name: 'Acquisition Term Sheet by OrbitCorp',
          type: 'contract',
          size: '3.0 KB',
          summary: 'Strictly confidential merger proposal.',
          insights: ['Merger valuation $80M.'],
          startupId: tenantAlphaId,
          sourceType: 'DOCUMENT',
          version: 1,
          accessScope: 'FOUNDER_ONLY',
          indexingStatus: 'PENDING'
        }
      }));
      await ingestDocument(docAlphaFounderId, 'Strictly Confidential: OrbitCorp offers to acquire 100% of Alpha Aerospace for $80,000,000 in cash and stock.', 'Acquisition Term Sheet by OrbitCorp', 'contract', {
        startupId: tenantAlphaId,
        sourceType: 'DOCUMENT',
        version: 1,
        accessScope: 'FOUNDER_ONLY'
      });

      // 4.1 General Employee Query: Can ONLY retrieve accessScope ALL
      const employeeResults = await performHybridSearch('Confidential valuation compensation salary acquisition', tenantAlphaId, 10, 0.7, {
        userRole: 'EMPLOYEE'
      });
      const employeeForbiddenDocs = employeeResults.filter(r => r.accessScope === 'FINANCE' || r.accessScope === 'HR' || r.accessScope === 'FOUNDER_ONLY');
      assert(employeeForbiddenDocs.length === 0, 'General EMPLOYEE cannot retrieve FINANCE, HR, or FOUNDER_ONLY documents (0 leaked)');

      // 4.2 Finance Employee Query: Can retrieve ALL and FINANCE, but NOT HR or FOUNDER_ONLY
      const financeResults = await performHybridSearch('Confidential valuation runway compensation salary acquisition', tenantAlphaId, 10, 0.7, {
        userRole: 'FINANCE'
      });
      const financeAllowedFin = financeResults.find(r => r.accessScope === 'FINANCE');
      const financeForbiddenHR = financeResults.find(r => r.accessScope === 'HR' || r.accessScope === 'FOUNDER_ONLY');
      assert(Boolean(financeAllowedFin), 'FINANCE role successfully retrieves FINANCE-scoped documents');
      assert(!financeForbiddenHR, 'FINANCE role is BLOCKED from HR and FOUNDER_ONLY documents');

      // 4.3 Founder Query: Can retrieve ALL, FINANCE, HR, and FOUNDER_ONLY
      const founderResults = await performHybridSearch('Confidential runway salary acquisition', tenantAlphaId, 10, 0.7, {
        userRole: 'FOUNDER'
      });
      const founderHasFounderOnly = founderResults.find(r => r.accessScope === 'FOUNDER_ONLY');
      const founderHasFinance = founderResults.find(r => r.accessScope === 'FINANCE');
      assert(Boolean(founderHasFounderOnly), 'FOUNDER role successfully accesses FOUNDER_ONLY documents');
      assert(Boolean(founderHasFinance), 'FOUNDER role successfully accesses FINANCE documents');

      // 4.4 Build Context Verification
      const contextBundle = buildContext(founderResults);
      assert(contextBundle.citations.length > 0, 'buildContext creates citations with provenance');
      assert(Boolean(contextBundle.citations[0].chunkId), 'Citation contains chunkId');
      assert(contextBundle.citations[0].chunkIndex !== undefined, 'Citation contains chunkIndex');
      assert(Boolean(contextBundle.citations[0].sourceType), 'Citation contains sourceType');
      assert(Boolean(contextBundle.citations[0].accessScope), 'Citation contains accessScope');
    }

    // ------------------------------------------------------------------------
    // TEST 5: HTTP API Endpoints & Role Scope Verification
    // ------------------------------------------------------------------------
    console.log('\n[5] End-to-End HTTP API Endpoints (GET / POST / Query)');
    {
      // Create test finance user for Alpha Aerospace
      await safeDbQuery(() => (prisma.user as any).create({
        data: {
          id: alphaFinanceUserId,
          email: `finance_${runId}@alpha.aero`,
          name: 'Liara T\'Soni',
          role: 'Employee',
          emailVerified: true
        }
      }));

      // Bind memberships
      await safeDbQuery(() => (prisma as any).membership.create({
        data: {
          id: `mem_founder_${runId}`,
          userId: alphaFounderId,
          startupId: tenantAlphaId,
          role: 'FOUNDER',
          status: 'ACTIVE'
        }
      }));

      await safeDbQuery(() => (prisma as any).membership.create({
        data: {
          id: `mem_fin_${runId}`,
          userId: alphaFinanceUserId,
          startupId: tenantAlphaId,
          role: 'FINANCE',
          status: 'ACTIVE'
        }
      }));

      // Mint JWTs
      const founderToken = jwt.sign(
        { sub: alphaFounderId, email: `founder_${runId}@alpha.aero`, role: 'Founder' },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      const financeToken = jwt.sign(
        { sub: alphaFinanceUserId, email: `finance_${runId}@alpha.aero`, role: 'Employee' },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      // 5.1 GET /api/knowledge as FINANCE employee: should only receive ALL and FINANCE documents, NOT HR or FOUNDER_ONLY
      const finDocsRes = await fetch(`${baseUrl}/knowledge?startupId=${tenantAlphaId}`, {
        headers: { 'Authorization': `Bearer ${financeToken}` }
      });
      assert(finDocsRes.status === 200, 'Finance user GET /api/knowledge returns HTTP 200');
      const finDocs = await finDocsRes.json();
      assert(Array.isArray(finDocs) && finDocs.length > 0, 'Finance user receives scoped documents');
      const finLeakedForbidden = finDocs.find((d: any) => d.accessScope === 'HR' || d.accessScope === 'FOUNDER_ONLY');
      assert(!finLeakedForbidden, 'GET /api/knowledge correctly filtered out HR and FOUNDER_ONLY documents for Finance employee');

      // 5.2 GET /api/knowledge as FOUNDER: should receive all 4 documents
      const founderDocsRes = await fetch(`${baseUrl}/knowledge?startupId=${tenantAlphaId}`, {
        headers: { 'Authorization': `Bearer ${founderToken}` }
      });
      assert(founderDocsRes.status === 200, 'Founder GET /api/knowledge returns HTTP 200');
      const founderDocs = await founderDocsRes.json();
      const founderHasFounderDoc = founderDocs.find((d: any) => d.accessScope === 'FOUNDER_ONLY');
      assert(Boolean(founderHasFounderDoc), 'Founder GET /api/knowledge retrieves FOUNDER_ONLY documents');

      // 5.3 POST /api/knowledge as Finance employee attempting to publish FOUNDER_ONLY: must be rejected with 403
      const illegalDocRes = await fetch(`${baseUrl}/knowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${financeToken}`
        },
        body: JSON.stringify({
          startupId: tenantAlphaId,
          name: 'Illegal Executive Coup Plan',
          type: 'strategy',
          content: 'Unpermitted founder only strategy proposal.',
          accessScope: 'FOUNDER_ONLY'
        })
      });
      assert(illegalDocRes.status === 403, 'Non-founder attempting to set FOUNDER_ONLY access scope returns HTTP 403 Forbidden', `Status: ${illegalDocRes.status}`);

      // 5.4 POST /api/knowledge as Founder with full Phase 3 metadata
      const newDocRes = await fetch(`${baseUrl}/knowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${founderToken}`
        },
        body: JSON.stringify({
          startupId: tenantAlphaId,
          name: 'Q4 Product Roadmap Milestone',
          type: 'roadmap',
          content: 'Q4 Objective: Complete Stage-2 engine test firing by November 15, 2026. Target altitude 120km.',
          sourceType: 'TASK',
          sourceRecordId: 'task_q4_stage2',
          version: 3,
          accessScope: 'ALL'
        })
      });
      assert(newDocRes.status === 201, 'Founder POST /api/knowledge with Phase 3 metadata returns HTTP 201 Created');
      const newDocData = await newDocRes.json();
      assert(newDocData.sourceType === 'TASK', 'Returned document reflects sourceType TASK');
      assert(newDocData.sourceRecordId === 'task_q4_stage2', 'Returned document reflects sourceRecordId');
      assert(newDocData.version === 3, 'Returned document reflects version 3');
      assert(newDocData.accessScope === 'ALL', 'Returned document reflects accessScope ALL');
      assert(newDocData.indexingStatus === 'COMPLETED', 'Returned document indexingStatus is COMPLETED');

      // 5.5 POST /api/knowledge/query as Founder
      const queryRes = await fetch(`${baseUrl}/knowledge/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${founderToken}`
        },
        body: JSON.stringify({
          startupId: tenantAlphaId,
          query: 'When is the Stage-2 engine test firing scheduled?'
        })
      });
      assert(queryRes.status === 200, 'POST /api/knowledge/query returns HTTP 200 OK');
      const queryData = await queryRes.json();
      assert(typeof queryData.answer === 'string' && queryData.answer.length > 0, 'RAG query returns synthesized answer');
      assert(Array.isArray(queryData.citations) && queryData.citations.length > 0, 'RAG query returns citations with document provenance');
      assert(Boolean(queryData.citations[0].chunkId), 'RAG citation includes stable chunkId');

      // 5.6 POST /api/chat querying company-scoped knowledge
      const chatRes = await fetch(`${baseUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${founderToken}`
        },
        body: JSON.stringify({
          startupId: tenantAlphaId,
          messages: [{ role: 'user', content: 'What is our Q4 Stage-2 engine objective?' }]
        })
      });
      assert(chatRes.status === 200, 'POST /api/chat with company knowledge query returns HTTP 200 OK');
      const chatData = await chatRes.json();
      assert(typeof chatData.reply === 'string' && chatData.reply.length > 0, 'Chat response contains grounded company reply');
      assert(Array.isArray(chatData.citations) && chatData.citations.length > 0, 'Chat response contains company-scoped citations');
      assert(chatData.citations[0].source?.includes('TASK'), 'Citation reflects source type in chat response');
    }

    console.log('\n========================================================================');
    console.log(`Phase 3 Tests Finished: ${passed} passed, ${failed} failed`);
    console.log('========================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    server.close();
  }
}

runPhase3Tests().catch((err) => {
  console.error('Fatal error during Phase 3 tests:', err);
  process.exit(1);
});
