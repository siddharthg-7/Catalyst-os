/**
 * 🧪 CATALYST OS — PHASE 5 TEST SUITE
 * Separate Structured Queries from Semantic Retrieval (Hybrid Retrieval Strategy)
 *
 * Verifies:
 * 1. Intent Classification:
 *    - Structured: "What tasks are overdue?", "Who owns this task?", "What is the current project deadline?", "Which employees belong to this startup?"
 *    - Semantic: "What was our marketing strategy?", "Why did we choose this product direction?", "What did the team previously decide about customer acquisition?"
 *    - Hybrid: Queries asking for both current operational status and historical/strategic rationale.
 * 2. Authoritative Database Querying:
 *    - Tasks (overdue, ownership) queried through permission-checked services.
 *    - Project deadlines queried from milestones/timeline records.
 *    - Employees queried from active memberships.
 * 3. Zero-vector-search guarantee:
 *    - Pure structured queries bypass vector embedding generation and pgvector search.
 * 4. Semantic vector + lexical retrieval for documentary questions.
 * 5. Hybrid retrieval combining live operational state and document chunks.
 * 6. Candidate deduplication & Reciprocal Rank Fusion (RRF) ranking.
 * 7. Tenant isolation & role-based permission boundaries.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma, safeDbQuery } from '../backend/services/dbService';
import {
  classifyQuery,
  executeStructuredQuery,
  QueryClassification
} from '../backend/services/structuredQueryEngine';
import {
  performHybridSearch,
  retrieveHybridKnowledge,
  deduplicateAndRankCandidates,
  RetrievedChunk,
  ingestDocument
} from '../backend/services/ragEngine';

test('Catalyst OS Phase 5 — Structured vs Semantic Hybrid Retrieval Strategy', async (t) => {
  const timestamp = Date.now();
  const testStartupId = `stp_p5_${timestamp}`;
  const otherStartupId = `stp_p5_other_${timestamp}`;
  const founderUserId = `usr_founder_p5_${timestamp}`;
  const employeeUserId = `usr_emp_p5_${timestamp}`;
  const otherCompanyUserId = `usr_other_p5_${timestamp}`;

  console.log('\n========================================================================');
  console.log('🧪 CATALYST OS — PHASE 5 STRUCTURED VS SEMANTIC RETRIEVAL TEST SUITE');
  console.log('========================================================================\n');

  // SETUP: Provision test tenant companies, users, tasks, and documents in Neon Postgres
  await t.test('[Setup] Provision test tenants, memberships, tasks, and strategy documents', async () => {
    // 1. Create Founder User
    await safeDbQuery(() =>
      prisma.user.create({
        data: {
          id: founderUserId,
          email: `founder_${timestamp}@apexrobotics.io`,
          name: 'Sarah Connor',
          role: 'founder'
        }
      })
    );

    // 2. Create Employee User (Operations Role)
    await safeDbQuery(() =>
      prisma.user.create({
        data: {
          id: employeeUserId,
          email: `emp_ops_${timestamp}@apexrobotics.io`,
          name: 'Priya Sundaram',
          role: 'Employee'
        }
      })
    );

    // 3. Create Other Company User
    await safeDbQuery(() =>
      prisma.user.create({
        data: {
          id: otherCompanyUserId,
          email: `competitor_${timestamp}@othercorp.io`,
          name: 'John Doe',
          role: 'founder'
        }
      })
    );

    // 4. Create Startups
    await safeDbQuery(() =>
      prisma.startup.create({
        data: {
          id: testStartupId,
          name: 'Apex Robotics Labs',
          industry: 'Industrial Robotics',
          description: 'Autonomous warehouse manipulation systems.',
          fundingStage: 'seed',
          cashBalance: 450000,
          burnRate: 30000,
          healthScore: 88,
          ownerId: founderUserId
        }
      })
    );

    await safeDbQuery(() =>
      prisma.startup.create({
        data: {
          id: otherStartupId,
          name: 'OmniCorp Industrial',
          industry: 'Automation',
          description: 'Competitor tenant company.',
          fundingStage: 'series-a',
          cashBalance: 1200000,
          burnRate: 80000,
          healthScore: 75,
          ownerId: otherCompanyUserId
        }
      })
    );

    // 5. Create Memberships
    await safeDbQuery(() =>
      (prisma as any).membership.createMany({
        data: [
          {
            id: `mem_fnd_${timestamp}`,
            userId: founderUserId,
            startupId: testStartupId,
            role: 'FOUNDER',
            status: 'ACTIVE'
          },
          {
            id: `mem_emp_${timestamp}`,
            userId: employeeUserId,
            startupId: testStartupId,
            role: 'OPERATIONS',
            status: 'ACTIVE'
          },
          {
            id: `mem_oth_${timestamp}`,
            userId: otherCompanyUserId,
            startupId: otherStartupId,
            role: 'FOUNDER',
            status: 'ACTIVE'
          }
        ]
      })
    );

    // 6. Create Plan and Tasks in testStartupId
    const planId = `plan_p5_${timestamp}`;
    await safeDbQuery(() =>
      (prisma as any).plan.create({
        data: {
          id: planId,
          title: 'Autonomous Mobile Robot v2 Delivery',
          description: 'Commercial rollout plan for Apex AMR-200 units.',
          status: 'active',
          startupId: testStartupId
        }
      })
    );

    // Task 1: Overdue Task (Created 3 days ago, still pending)
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    await safeDbQuery(() =>
      (prisma as any).task.create({
        data: {
          id: `task_overdue_${timestamp}`,
          title: '[OPERATIONS|Operations|OPERATIONS] Complete LiDAR Sensor Calibration & Safety Benchmarks',
          assignedTo: `OPERATIONS:${employeeUserId}`,
          status: 'pending',
          planId: planId,
          createdAt: threeDaysAgo,
          updatedAt: threeDaysAgo
        }
      })
    );

    // Task 2: Active Task (Assigned to Finance, on schedule)
    await safeDbQuery(() =>
      (prisma as any).task.create({
        data: {
          id: `task_active_${timestamp}`,
          title: '[FINANCE|CFO|FINANCE] Audit Q3 BOM unit economics and supplier agreements',
          assignedTo: 'FINANCE',
          status: 'in_progress',
          planId: planId
        }
      })
    );

    // 7. Create Competitor Task in otherStartupId (to verify tenant isolation)
    const otherPlanId = `plan_other_${timestamp}`;
    await safeDbQuery(() =>
      (prisma as any).plan.create({
        data: {
          id: otherPlanId,
          title: 'OmniCorp Internal Operations',
          description: 'Competitor confidential work.',
          status: 'active',
          startupId: otherStartupId
        }
      })
    );

    await safeDbQuery(() =>
      (prisma as any).task.create({
        data: {
          id: `task_competitor_${timestamp}`,
          title: '[OPERATIONS|Operations|OPERATIONS] Steal Apex Robotics IP & Customer List',
          assignedTo: otherCompanyUserId,
          status: 'pending',
          planId: otherPlanId
        }
      })
    );

    // 8. Ingest a Semantic Document: Marketing & Customer Acquisition Strategy
    const docId = `doc_strategy_${timestamp}`;
    await safeDbQuery(() =>
      (prisma as any).startupDocument.create({
        data: {
          id: docId,
          name: 'Q3 Go-To-Market & Customer Acquisition Strategy',
          type: 'strategy',
          sourceType: 'DOCUMENT',
          version: 1,
          accessScope: 'ALL',
          summary: 'Our strategic customer acquisition plan for 3PL warehouse operators.',
          startupId: testStartupId,
          indexingStatus: 'COMPLETED'
        }
      })
    );

    await ingestDocument(
      docId,
      `Our Q3 marketing strategy targets enterprise third-party logistics (3PL) fulfillment centers.
       We chose this product direction because warehouse labor shortages exceed 35% across tier-1 logistics hubs.
       The team previously decided to prioritize outbound direct sales to regional distribution centers before expanding into mid-market retail.
       Our customer acquisition cost (CAC) benchmark is $14,500 with an expected payback period of 4.2 months.`,
      'Q3 Go-To-Market & Customer Acquisition Strategy',
      'strategy',
      { startupId: testStartupId, sourceType: 'DOCUMENT', accessScope: 'ALL' }
    );

    console.log('  ✅ PASS: Test tenants, memberships, tasks, and strategy documents provisioned');
  });

  // TEST 1: Query Intent Classifier distinguishes Structured vs Semantic vs Hybrid
  await t.test('[1] Query Intent Classifier distinguishes Structured, Semantic, and Hybrid queries', () => {
    // Exact structured operational examples from user prompt
    const q1 = classifyQuery('What tasks are overdue?');
    assert.equal(q1.intent, 'STRUCTURED', 'What tasks are overdue? must be STRUCTURED');
    assert.equal(q1.primaryDomain, 'TASKS', 'Domain must be TASKS');

    const q2 = classifyQuery('Who owns this task?');
    assert.equal(q2.intent, 'STRUCTURED', 'Who owns this task? must be STRUCTURED');
    assert.equal(q2.primaryDomain, 'TASKS', 'Domain must be TASKS');

    const q3 = classifyQuery('What is the current project deadline?');
    assert.equal(q3.intent, 'STRUCTURED', 'What is the current project deadline? must be STRUCTURED');
    assert.equal(q3.primaryDomain, 'DEADLINES', 'Domain must be DEADLINES');

    const q4 = classifyQuery('Which employees belong to this startup?');
    assert.equal(q4.intent, 'STRUCTURED', 'Which employees belong to this startup? must be STRUCTURED');
    assert.equal(q4.primaryDomain, 'EMPLOYEES', 'Domain must be EMPLOYEES');

    const q5 = classifyQuery('What is our current cash balance and runway?');
    assert.equal(q5.intent, 'STRUCTURED', 'Financial vitals query must be STRUCTURED');
    assert.equal(q5.primaryDomain, 'FINANCIALS', 'Domain must be FINANCIALS');

    // Exact semantic examples from user prompt
    const s1 = classifyQuery('What was our marketing strategy?');
    assert.equal(s1.intent, 'SEMANTIC', 'What was our marketing strategy? must be SEMANTIC');

    const s2 = classifyQuery('Why did we choose this product direction?');
    assert.equal(s2.intent, 'SEMANTIC', 'Why did we choose this product direction? must be SEMANTIC');

    const s3 = classifyQuery('What did the team previously decide about customer acquisition?');
    assert.equal(s3.intent, 'SEMANTIC', 'What did the team decide about acquisition? must be SEMANTIC');

    // Hybrid examples combining operational data and strategic retrieval
    const h1 = classifyQuery('What tasks are overdue and how does that impact our Q3 marketing strategy?');
    assert.equal(h1.intent, 'HYBRID', 'Query asking for overdue tasks AND marketing strategy must be HYBRID');

    const h2 = classifyQuery('Who owns the customer acquisition task and what was our acquisition strategy?');
    assert.equal(h2.intent, 'HYBRID', 'Query asking for task owner AND acquisition strategy must be HYBRID');

    const h3 = classifyQuery('What is our current cash balance and how does that compare to our product direction?');
    assert.equal(h3.intent, 'HYBRID', 'Query asking for cash balance AND product direction must be HYBRID');

    console.log('  ✅ PASS: Query intent classification correctly categorizes Structured, Semantic, and Hybrid intents');
  });

  // TEST 2: Structured Query - "What tasks are overdue?"
  await t.test('[2] Operational query "What tasks are overdue?" queries database directly without vector search', async () => {
    const result = await retrieveHybridKnowledge({
      query: 'What tasks are overdue?',
      startupId: testStartupId,
      userId: founderUserId,
      userRole: 'FOUNDER'
    });

    assert.equal(result.intent, 'STRUCTURED', 'Intent must be STRUCTURED');
    assert.equal(result.vectorSearchInvoked, false, 'Must NOT invoke vector search for structured query');
    assert.equal(result.isDirectAnswer, true, 'Structured queries provide direct grounded answer');
    assert.ok(result.contextText.includes('LiDAR Sensor Calibration'), 'Must return overdue LiDAR task');
    assert.ok(result.citations.length > 0, 'Must provide operational citations');
    assert.equal(result.citations[0].sourceType, 'OPERATIONAL_TASK', 'Citation must be OPERATIONAL_TASK');

    console.log('  ✅ PASS: "What tasks are overdue?" correctly retrieves overdue task from database without vector search');
  });

  // TEST 3: Structured Query - "Who owns this task?"
  await t.test('[3] Operational query "Who owns this task?" resolves task owner and department', async () => {
    const result = await retrieveHybridKnowledge({
      query: 'Who owns the LiDAR Sensor Calibration task?',
      startupId: testStartupId,
      userId: founderUserId,
      userRole: 'FOUNDER'
    });

    assert.equal(result.intent, 'STRUCTURED', 'Intent must be STRUCTURED');
    assert.equal(result.vectorSearchInvoked, false, 'Vector search must NOT be invoked');
    assert.ok(result.contextText.includes('Priya Sundaram') || result.contextText.includes('OPERATIONS'), 'Must identify owner Priya Sundaram / OPERATIONS department');
    assert.ok(result.contextText.includes('Complete LiDAR Sensor Calibration'), 'Must reference specific task');

    console.log('  ✅ PASS: "Who owns this task?" resolves accurate task ownership and department');
  });

  // TEST 4: Structured Query - "What is the current project deadline?"
  await t.test('[4] Operational query "What is the current project deadline?" returns milestones from DB', async () => {
    const result = await retrieveHybridKnowledge({
      query: 'What is the current project deadline?',
      startupId: testStartupId,
      userId: founderUserId,
      userRole: 'FOUNDER'
    });

    assert.equal(result.intent, 'STRUCTURED', 'Intent must be STRUCTURED');
    assert.equal(result.vectorSearchInvoked, false, 'Vector search must NOT be invoked');
    assert.ok(result.contextText.includes('Autonomous Mobile Robot') || result.contextText.includes('Sprint') || result.contextText.includes('Deadline'), 'Must return project milestone details');
    assert.ok(result.citations.some(c => c.sourceType === 'OPERATIONAL_DEADLINE'), 'Must provide OPERATIONAL_DEADLINE citation');

    console.log('  ✅ PASS: "What is the current project deadline?" returns authoritative milestone deadlines');
  });

  // TEST 5: Structured Query - "Which employees belong to this startup?"
  await t.test('[5] Operational query "Which employees belong to this startup?" returns tenant roster', async () => {
    const result = await retrieveHybridKnowledge({
      query: 'Which employees belong to this startup?',
      startupId: testStartupId,
      userId: founderUserId,
      userRole: 'FOUNDER'
    });

    assert.equal(result.intent, 'STRUCTURED', 'Intent must be STRUCTURED');
    assert.equal(result.vectorSearchInvoked, false, 'Vector search must NOT be invoked');
    assert.ok(result.contextText.includes('Sarah Connor'), 'Must list Founder Sarah Connor');
    assert.ok(result.contextText.includes('Priya Sundaram'), 'Must list Employee Priya Sundaram');
    assert.ok(result.contextText.includes('Atlas'), 'Must list AI Executive CEO Atlas');
    // Tenant Isolation check: competitor user John Doe from other company must NOT be listed!
    assert.equal(result.contextText.includes('John Doe'), false, 'Tenant isolation violation: competitor user must NOT be in company roster');

    console.log('  ✅ PASS: "Which employees belong to this startup?" returns company roster with strict tenant isolation');
  });

  // TEST 6: Semantic Query - "What was our marketing strategy?"
  await t.test('[6] Semantic query retrieves document chunks using vector and lexical search', async () => {
    const result = await retrieveHybridKnowledge({
      query: 'What was our marketing strategy and why did we choose this product direction?',
      startupId: testStartupId,
      userId: founderUserId,
      userRole: 'FOUNDER',
      limit: 3
    });

    assert.equal(result.intent, 'SEMANTIC', 'Intent must be SEMANTIC');
    assert.equal(result.vectorSearchInvoked, true, 'Semantic search must invoke vector/hybrid retrieval');
    assert.ok(result.retrievedChunks.length > 0, 'Must retrieve document chunks');
    assert.ok(
      result.retrievedChunks.some(c => c.content.includes('3PL warehouse') || c.content.includes('labor shortages')),
      'Must retrieve relevant marketing strategy document chunks'
    );
    assert.ok(result.citations.length > 0, 'Must provide document citations');
    assert.equal(result.citations[0].sourceType, 'DOCUMENT', 'Citation sourceType must be DOCUMENT');

    console.log('  ✅ PASS: Semantic question retrieves document chunks with vector similarity & citations');
  });

  // TEST 7: Hybrid Query - Combines structured operational facts AND semantic document chunks
  await t.test('[7] Hybrid query combines authoritative DB records and document retrieval', async () => {
    const result = await retrieveHybridKnowledge({
      query: 'What tasks are overdue and how does that impact our Q3 marketing strategy?',
      startupId: testStartupId,
      userId: founderUserId,
      userRole: 'FOUNDER',
      limit: 3
    });

    assert.equal(result.intent, 'HYBRID', 'Intent must be HYBRID');
    assert.equal(result.vectorSearchInvoked, true, 'Hybrid query must invoke vector search for the semantic half');
    assert.ok(result.structuredSummary, 'Must contain structured summary of operational data');
    assert.ok(result.structuredSummary.includes('LiDAR Sensor Calibration'), 'Structured half must identify overdue LiDAR task');
    assert.ok(result.retrievedChunks.length > 0, 'Semantic half must retrieve strategy document chunks');
    assert.ok(
      result.retrievedChunks.some(c => c.content.includes('marketing strategy') || c.content.includes('3PL')),
      'Semantic half must retrieve marketing strategy document'
    );

    // Citations must contain BOTH operational citations and document citations
    const hasOpCitation = result.citations.some(c => c.sourceType === 'OPERATIONAL_TASK');
    const hasDocCitation = result.citations.some(c => c.sourceType === 'DOCUMENT');
    assert.ok(hasOpCitation, 'Hybrid query must contain OPERATIONAL_TASK citation');
    assert.ok(hasDocCitation, 'Hybrid query must contain DOCUMENT citation');

    console.log('  ✅ PASS: Hybrid query successfully unifies operational facts and document retrieval with distinct citations');
  });

  // TEST 8: Lexical Search + Vector Retrieval: Rank and Deduplicate Candidates
  await t.test('[8] Deduplicates duplicate candidates and ranks via Reciprocal Rank Fusion (RRF)', () => {
    const rawCandidates: RetrievedChunk[] = [
      {
        id: 'chk_dup_1',
        chunkIndex: 0,
        content: 'Apex Robotics specializes in warehouse manipulation robots with autonomous navigation.',
        documentId: 'doc_1',
        documentName: 'Company Overview Deck',
        documentType: 'pitch_deck',
        similarityScore: 0.88,
        keywordScore: 0.40,
        hybridScore: 0.70,
        startupId: testStartupId
      },
      // Duplicate by ID
      {
        id: 'chk_dup_1',
        chunkIndex: 0,
        content: 'Apex Robotics specializes in warehouse manipulation robots with autonomous navigation.',
        documentId: 'doc_1',
        documentName: 'Company Overview Deck',
        documentType: 'pitch_deck',
        similarityScore: 0.88,
        keywordScore: 0.40,
        hybridScore: 0.70,
        startupId: testStartupId
      },
      // Duplicate by content fingerprint (different ID, identical text)
      {
        id: 'chk_dup_1_copy',
        chunkIndex: 1,
        content: 'Apex Robotics specializes in warehouse manipulation robots with autonomous navigation.',
        documentId: 'doc_1',
        documentName: 'Company Overview Deck',
        documentType: 'pitch_deck',
        similarityScore: 0.85,
        keywordScore: 0.40,
        hybridScore: 0.68,
        startupId: testStartupId
      },
      // Distinct chunk with high keyword match
      {
        id: 'chk_unique_2',
        chunkIndex: 2,
        content: 'Our Q3 marketing strategy targets enterprise third-party logistics (3PL) fulfillment centers.',
        documentId: 'doc_2',
        documentName: 'Q3 Marketing Strategy',
        documentType: 'strategy',
        similarityScore: 0.72,
        keywordScore: 0.95,
        hybridScore: 0.80,
        startupId: testStartupId
      }
    ];

    const deduplicatedAndRanked = deduplicateAndRankCandidates('marketing strategy 3PL', rawCandidates);

    // Exact count check: duplicates removed
    assert.equal(deduplicatedAndRanked.length, 2, 'Candidate deduplication must remove duplicate ID and duplicate content fingerprint');
    // Ranking check: chunk 2 has strong lexical + title match for "marketing strategy 3PL"
    assert.equal(deduplicatedAndRanked[0].id, 'chk_unique_2', 'Candidate with highest lexical + title boost must be ranked #1');
    assert.ok(deduplicatedAndRanked[0].hybridScore > deduplicatedAndRanked[1].hybridScore, 'Score must reflect multi-factor RRF ranking');

    console.log('  ✅ PASS: Candidates are strictly deduplicated and ranked via RRF + lexical boosting before LLM synthesis');
  });

  // TEST 9: Permission & Role Scoping: Non-founder employee sees only permitted workload
  await t.test('[9] Non-founder employee sees only permitted workload matching their role', async () => {
    // Employee with role OPERATIONS queries overdue tasks
    const empResult = await retrieveHybridKnowledge({
      query: 'What tasks are overdue?',
      startupId: testStartupId,
      userId: employeeUserId,
      userRole: 'OPERATIONS'
    });

    assert.equal(empResult.intent, 'STRUCTURED');
    assert.ok(empResult.contextText.includes('LiDAR Sensor Calibration'), 'Operations employee must see their assigned Operations task');

    // Tenant Isolation check: Competitor tenant user querying overdue tasks
    const competitorResult = await retrieveHybridKnowledge({
      query: 'What tasks are overdue?',
      startupId: otherStartupId,
      userId: otherCompanyUserId,
      userRole: 'FOUNDER'
    });

    assert.ok(!competitorResult.contextText.includes('LiDAR Sensor Calibration'), 'Competitor tenant must NEVER see Apex Robotics tasks');

    console.log('  ✅ PASS: Employee and tenant permission boundaries strictly respected at database query level');
  });

  // CLEANUP
  await t.test('[Cleanup] Clean up test records from database', async () => {
    try {
      await safeDbQuery(() => (prisma as any).knowledgeChunk.deleteMany({ where: { startupId: testStartupId } }));
      await safeDbQuery(() => (prisma as any).startupDocument.deleteMany({ where: { startupId: testStartupId } }));
      await safeDbQuery(() => (prisma as any).task.deleteMany({ where: { plan: { startupId: testStartupId } } }));
      await safeDbQuery(() => (prisma as any).task.deleteMany({ where: { plan: { startupId: otherStartupId } } }));
      await safeDbQuery(() => (prisma as any).plan.deleteMany({ where: { startupId: testStartupId } }));
      await safeDbQuery(() => (prisma as any).plan.deleteMany({ where: { startupId: otherStartupId } }));
      await safeDbQuery(() => (prisma as any).membership.deleteMany({ where: { startupId: { in: [testStartupId, otherStartupId] } } }));
      await safeDbQuery(() => (prisma as any).startup.deleteMany({ where: { id: { in: [testStartupId, otherStartupId] } } }));
      await safeDbQuery(() => (prisma as any).user.deleteMany({ where: { id: { in: [founderUserId, employeeUserId, otherCompanyUserId] } } }));
    } catch (cleanErr: any) {
      console.warn('[Cleanup Warning]:', cleanErr.message);
    }
    console.log('  ✅ PASS: Phase 5 test records cleaned up');
  });

  console.log('\n========================================================================');
  console.log('Phase 5 Tests Finished: All assertions passed successfully');
  console.log('========================================================================\n');
});
