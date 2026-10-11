/**
 * CatalystOS - Approval System & Company Context Integration Test Suite (P1 Task 5)
 * Covers all 10 verification scenarios:
 * 1. Approval Creation: Agent can create a structured approval.
 * 2. Approval Authorization: Only authorized founders can approve.
 * 3. Cross-Tenant Isolation: Company A cannot approve Company B's approval.
 * 4. Approval Execution: Approved supported action executes and persists to database.
 * 5. Double Approval (Idempotency): Repeated approval cannot execute the action twice.
 * 6. Rejected Approval: Rejected action does not execute or modify operational metrics.
 * 7. Execution Failure: Failed execution does not falsely update company state.
 * 8. Context Refresh: Successful action invalidates cache and subsequent context reflects new state.
 * 9. Non-State-Changing Approval: Approvals without state mutations leave metrics untouched.
 * 10. AI Feedback Loop: Chief of Staff prompt context reflects fresh operational state.
 */

import { approvalService, incrementTeamSize } from '../backend/services/approvalService';
import { companyContextService } from '../backend/services/companyContextService';
import { prisma, safeDbQuery } from '../backend/services/dbService';
import { workspaceService } from '../backend/services/workspaceService';

const apCreatedUserIds: string[] = [];
const apCreatedStartupIds: string[] = [];

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    testsPassed++;
  } else {
    console.error(`  ❌ FAIL: ${testName} - ${details || 'Assertion failed'}`);
    testsFailed++;
  }
}

async function runTests() {
  console.log('\n========================================================================');
  console.log('🧪 CATALYSTOS P1 TASK 5: APPROVAL SYSTEM + COMPANY CONTEXT TEST SUITE');
  console.log('========================================================================\n');

  const testUserAId = `usr_test_a_${Date.now()}`;
  apCreatedUserIds.push(testUserAId);
  const testUserBId = `usr_test_b_${Date.now()}`;
  apCreatedUserIds.push(testUserBId);
  let startupAId = '';
  let startupBId = '';
  let dbFixturesCreated = false;

  try {
    const isLiveDb = await safeDbQuery(async () => {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    }).catch(() => false);

    if (!isLiveDb) {
      console.log('⚠️ [ENVIRONMENT DEPENDENCY] Live PostgreSQL database connection is unavailable.');
      console.log('  Database credentials (DATABASE_URL) must be provided to run live DB integration fixtures.');
      console.log('  Status: BLOCKED — ENVIRONMENT DEPENDENCY (Rule 1)');
      return;
    }

    dbFixturesCreated = true;
    console.log('Setting up isolated test tenant fixtures in database...');

    // ── Setup Tenant A (Apex Robotics) ──────────────────────────────────────────
    await safeDbQuery(() =>
      prisma.user.create({
        data: {
          id: testUserAId,
          email: `alice_${Date.now()}@apexrobotics.test`,
          name: 'Alice Founder',
          role: 'Founder'
        }
      })
    );

    const contextA = await workspaceService.saveOnboardingData(testUserAId, {
      startupName: 'Apex Robotics Inc',
      industry: 'Robotics & Automation',
      description: 'Autonomous warehouse mobile robots',
      fundingStage: 'Seed',
      cashBalance: 500000,
      monthlyBurn: 25000,
      targetIcp: '3PL Logistics Operations',
      primaryProduct: 'Autonomous Fleet Navigator',
      problem: 'Inefficient manual forklift routing in high-throughput fulfillment hubs',
      timeline: '90 Days',
      teamSize: '5 engineers',
      additionalInfo: 'Tier-1 enterprise pilots signed'
    });
    startupAId = contextA.startupId;
    apCreatedStartupIds.push(startupAId);

    // ── Setup Tenant B (BioGen Systems) ─────────────────────────────────────────
    await safeDbQuery(() =>
      prisma.user.create({
        data: {
          id: testUserBId,
          email: `bob_${Date.now()}@biogensystems.test`,
          name: 'Bob Competitor',
          role: 'Founder'
        }
      })
    );

    const contextB = await workspaceService.saveOnboardingData(testUserBId, {
      startupName: 'BioGen Systems',
      industry: 'Biotechnology',
      description: 'AI genomic analysis platform',
      fundingStage: 'Pre-Seed',
      cashBalance: 200000,
      monthlyBurn: 10000,
      targetIcp: 'Genomics Diagnostic Labs',
      primaryProduct: 'DNA Variant Analyzer',
      problem: 'Slow clinical turnaround for genome sequencing',
      timeline: '120 Days',
      teamSize: '2 engineers'
    });
    startupBId = contextB.startupId;
    apCreatedStartupIds.push(startupBId);

    // ──────────────────────────────────────────────────────────────────────────
    // Helper unit check: incrementTeamSize
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Helper Unit Tests ---');
    assert(incrementTeamSize('5 engineers', 1) === '6 engineers', 'incrementTeamSize increments "5 engineers" to "6 engineers"');
    assert(incrementTeamSize('5', 1) === '6', 'incrementTeamSize increments "5" to "6"');
    assert(incrementTeamSize('4 engineers', 2) === '6 engineers', 'incrementTeamSize handles countToAdd = 2');
    assert(incrementTeamSize('1-5', 1) === '2-5' || incrementTeamSize('1-5', 1) === '2', 'incrementTeamSize parses bounded ranges');

    // ──────────────────────────────────────────────────────────────────────────
    // Scenario 1: Approval Creation
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 1: Agent Creates Approval ---');
    const hiringApproval = await approvalService.createApproval({
      startupId: startupAId,
      title: 'Hire 2x Senior Robotics Systems Engineer',
      description: 'Expands core perception stack and automated navigation throughput.',
      type: 'contract',
      content: '### Executive Action Proposal\n\nApprove compensation package for 2x Senior Robotics Engineers.',
      impact: 'Increases monthly burn by $16,000/mo. Projected runway: 12.2 months.',
      financialChange: -16000,
      metricChanges: { velocity: 15, financialHealth: -4, operationsEfficiency: 10 }
    });

    assert(Boolean(hiringApproval.id), 'Approval item created with valid ID');
    assert(hiringApproval.status === 'pending_review', 'Approval status defaults to "pending_review"');
    assert(hiringApproval.type === 'contract', 'Approval type matches contract');

    // Verify stored in PostgreSQL
    const dbApprA = await safeDbQuery(() => prisma.approval.findUnique({
      where: { id: hiringApproval.id },
      include: { plan: true }
    }));
    assert(Boolean(dbApprA), 'Approval persisted successfully in PostgreSQL');
    assert(dbApprA?.status === 'pending_review', 'PostgreSQL approval status is "pending_review"');
    assert(dbApprA?.plan.startupId === startupAId, 'Approval correctly linked to Startup A active Plan');

    // Verify company context reflects pending approval
    const freshContextA = await companyContextService.getContextForUser(testUserAId);
    assert(freshContextA?.operations.pendingApprovalsCount === 1, 'Company Context reflects pendingApprovalsCount === 1');
    assert(freshContextA?.operations.pendingApprovals[0].id === hiringApproval.id, 'Pending approval present in Company Context snapshot');

    // ──────────────────────────────────────────────────────────────────────────
    // Scenario 2: Approval Authorization
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 2: Approval Authorization ---');
    const unauthReview = await approvalService.reviewApproval({
      approvalId: hiringApproval.id,
      userId: '',
      action: 'approve'
    });
    assert(!unauthReview.success && unauthReview.statusCode === 401, 'Unauthenticated user review is rejected (401)');

    const executiveRoleReview = await approvalService.reviewApproval({
      approvalId: hiringApproval.id,
      userId: testUserAId,
      userRole: 'Executive',
      action: 'approve'
    });
    assert(!executiveRoleReview.success && executiveRoleReview.statusCode === 403, 'Executive account review is rejected (403)');

    // ──────────────────────────────────────────────────────────────────────────
    // Scenario 3: Cross-Tenant Isolation
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 3: Multi-Tenant Cross-Company Isolation ---');
    // User B attempts to approve Company A's approval
    const crossTenantReview = await approvalService.reviewApproval({
      approvalId: hiringApproval.id,
      userId: testUserBId,
      userRole: 'Founder',
      action: 'approve'
    });
    assert(!crossTenantReview.success && crossTenantReview.statusCode === 403, 'User B is strictly blocked from reviewing Company A approval (403 Forbidden)');

    // Verify Startup A data was NOT modified by unauthorized attempt
    const startupAPostBlock = await safeDbQuery(() => prisma.startup.findUnique({ where: { id: startupAId } }));
    assert(startupAPostBlock?.burnRate === 25000, 'Startup A burn rate unmodified after blocked cross-tenant attempt');
    assert(startupAPostBlock?.cashBalance === 500000, 'Startup A cash balance unmodified after blocked cross-tenant attempt');

    // ──────────────────────────────────────────────────────────────────────────
    // Scenario 4: Approval Execution (State-Changing Action)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 4: Approval Execution (State Mutation) ---');
    const validApprovalResult = await approvalService.reviewApproval({
      approvalId: hiringApproval.id,
      userId: testUserAId,
      userRole: 'Founder',
      action: 'approve',
      feedback: 'Approved after verifying Q2 hardware delivery milestones.'
    });

    assert(validApprovalResult.success === true, 'Authorized Founder A executes approval successfully');
    assert(validApprovalResult.stateChangesApplied?.isStateChanging === true, 'Action classified as state-changing');
    assert(validApprovalResult.stateChangesApplied?.burnRateDelta === 16000, 'Burn rate delta applied ($16,000)');
    assert(validApprovalResult.stateChangesApplied?.teamSizeDelta === 2, 'Team size delta applied (2 new hires)');

    // Verify PostgreSQL Startup state updated
    const startupAAfterExecution = await safeDbQuery(() => prisma.startup.findUnique({ where: { id: startupAId } }));
    assert(startupAAfterExecution?.burnRate === 41000, 'Startup A burn rate in DB updated: 25k + 16k = 41k');
    assert(startupAAfterExecution?.cashBalance === 500000, 'Startup A cash balance preserved at 500k');

    // Verify PostgreSQL Approval status updated
    const dbApprAfter = await safeDbQuery(() => prisma.approval.findUnique({ where: { id: hiringApproval.id } }));
    assert(dbApprAfter?.status === 'approved', 'PostgreSQL approval status updated to "approved"');

    // Verify Audit Trail (Execution, DecisionLog, TimelineItem)
    const executionRecord = await safeDbQuery(() => prisma.execution.findFirst({
      where: { action: hiringApproval.title }
    }));
    assert(Boolean(executionRecord), 'Execution record persisted in PostgreSQL');
    assert(executionRecord?.status === 'completed', 'Execution record marked "completed"');

    const decisionRecord = await safeDbQuery(() => prisma.decisionLog.findFirst({
      where: { startupId: startupAId, status: 'approved' },
      orderBy: { createdAt: 'desc' }
    }));
    assert(Boolean(decisionRecord), 'DecisionLog entry created in PostgreSQL');
    assert(decisionRecord?.title.includes('Hire 2x Senior Robotics'), 'DecisionLog contains approved deliverable title');

    const timelineRecord = await safeDbQuery(() => prisma.timelineItem.findFirst({
      where: { startupId: startupAId, type: 'hire' },
      orderBy: { createdAt: 'desc' }
    }));
    assert(Boolean(timelineRecord), 'TimelineItem entry created in PostgreSQL');

    // Verify Memory for TEAM_SIZE updated
    const teamMemory = await safeDbQuery(() => prisma.memory.findFirst({
      where: { startupId: startupAId, category: 'TEAM_SIZE' }
    }));
    assert(Boolean(teamMemory), 'Team size memory exists in PostgreSQL');
    assert(teamMemory?.description.includes('7'), `Team size memory updated to reflect 2 new hires: "${teamMemory?.description}"`);

    // ──────────────────────────────────────────────────────────────────────────
    // Scenario 5: Double Approval (Idempotency)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 5: Idempotency (Prevent Duplicate Execution) ---');
    // Immediate second attempt on the same approval
    const duplicateReviewResult = await approvalService.reviewApproval({
      approvalId: hiringApproval.id,
      userId: testUserAId,
      userRole: 'Founder',
      action: 'approve'
    });

    assert(duplicateReviewResult.alreadyProcessed === true, 'Duplicate approval detected as already processed');
    assert(duplicateReviewResult.message?.includes('already been processed'), 'User-friendly message returned on duplicate request');

    // Assert DB state was NOT double-incremented
    const startupAAfterDuplicate = await safeDbQuery(() => prisma.startup.findUnique({ where: { id: startupAId } }));
    assert(startupAAfterDuplicate?.burnRate === 41000, 'Burn rate NOT double-incremented (remains 41,000, not 57,000)');

    const executionsCount = await safeDbQuery(() => prisma.execution.count({
      where: { action: hiringApproval.title, plan: { startupId: startupAId } }
    }));
    assert(executionsCount === 1, 'Only 1 execution record exists despite duplicate API call');

    // ──────────────────────────────────────────────────────────────────────────
    // Scenario 6: Rejected Approval
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 6: Rejected Approval Handling ---');
    const equipmentApproval = await approvalService.createApproval({
      startupId: startupAId,
      title: 'Procure 10x Industrial Edge GPU Nodes',
      description: 'Hardware equipment commitment for on-prem robot telemetry.',
      type: 'financials',
      financialChange: -75000,
      impact: 'Deducts $75,000 from treasury cash.'
    });

    const rejectResult = await approvalService.reviewApproval({
      approvalId: equipmentApproval.id,
      userId: testUserAId,
      userRole: 'Founder',
      action: 'reject',
      feedback: 'Postpone capital expenditure until Series A financing.'
    });

    assert(rejectResult.success === true, 'Rejection processed successfully');
    assert(rejectResult.item?.status === 'rejected', 'Deliverable status set to "rejected"');

    // Verify DB metrics unchanged
    const startupAAfterReject = await safeDbQuery(() => prisma.startup.findUnique({ where: { id: startupAId } }));
    assert(startupAAfterReject?.cashBalance === 500000, 'Cash balance NOT deducted on rejected approval');
    assert(startupAAfterReject?.burnRate === 41000, 'Burn rate NOT modified on rejected approval');

    // Verify rejection logged in DecisionLog & TimelineItem
    const rejectDecision = await safeDbQuery(() => prisma.decisionLog.findFirst({
      where: { startupId: startupAId, status: 'rejected' },
      orderBy: { createdAt: 'desc' }
    }));
    assert(Boolean(rejectDecision), 'Rejection recorded in DecisionLog');
    assert(rejectDecision?.description.includes('Postpone capital expenditure'), 'Rejection logs founder feedback verbatim');

    // ──────────────────────────────────────────────────────────────────────────
    // Scenario 7: Execution Failure Handling
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 7: Failure Handling Boundary ---');
    const failingApproval = await approvalService.createApproval({
      startupId: startupAId,
      title: 'Migrate Core Cluster to Bare-Metal Data Center',
      description: 'Infrastructure relocation commitment.',
      type: 'contract',
      financialChange: -50000
    });

    const failureResult = await approvalService.reviewApproval({
      approvalId: failingApproval.id,
      userId: testUserAId,
      userRole: 'Founder',
      action: 'approve',
      simulateExecutionFailure: true
    });

    assert(!failureResult.success && failureResult.statusCode === 500, 'Subsystem execution failure returns HTTP 500');

    // Verify DB status marked as execution_failed
    const dbFailingAppr = await safeDbQuery(() => prisma.approval.findUnique({ where: { id: failingApproval.id } }));
    assert(dbFailingAppr?.status === 'execution_failed', 'Approval status in DB marked as "execution_failed"');

    // Verify failed execution record
    const failedExec = await safeDbQuery(() => prisma.execution.findFirst({
      where: { action: failingApproval.title, status: 'failed' }
    }));
    assert(Boolean(failedExec), 'Failed execution logged in Execution ledger');

    // Verify NO false mutation to company state
    const startupAAfterFailure = await safeDbQuery(() => prisma.startup.findUnique({ where: { id: startupAId } }));
    assert(startupAAfterFailure?.cashBalance === 500000, 'Cash balance preserved after execution failure');
    assert(startupAAfterFailure?.burnRate === 41000, 'Burn rate preserved after execution failure');

    // ──────────────────────────────────────────────────────────────────────────
    // Scenario 8: Context Refresh & Verification
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 8: Context Invalidation & Freshness ---');
    // Context was invalidated during Scenario 4 approval execution
    const freshContext = await companyContextService.getContextForUser(testUserAId);
    assert(Boolean(freshContext), 'Retrieved fresh Company Context after state-changing approval');
    assert(Boolean(freshContext?.financial), 'Context financial snapshot assembled');
    assert(freshContext?.financial.monthlyBurn === 41000, 'Fresh context reflects updated monthly burn: $41,000/mo');
    assert(freshContext?.financial.cashBalance === 500000, 'Fresh context reflects cash balance: $500,000');
    // 500,000 / 41,000 = 12.195... -> 12.2 months
    assert(freshContext?.financial.runwayMonths === 12.2, `Fresh context reflects recalculated runway: ${freshContext?.financial.runwayMonths} months`);
    assert(freshContext?.operations.pendingApprovalsCount === 0, 'Pending approvals count is now 0 (all reviewed)');

    // ──────────────────────────────────────────────────────────────────────────
    // Scenario 9: Non-State-Changing Approval
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 9: Non-State-Changing Approval ---');
    const copyApproval = await approvalService.createApproval({
      startupId: startupAId,
      title: 'Approve Enterprise Sales One-Pager & Pitch Deck',
      description: 'Marketing and customer collateral review for upcoming industry summit.',
      type: 'document',
      financialChange: 0,
      metricChanges: {}
    });

    const copyResult = await approvalService.reviewApproval({
      approvalId: copyApproval.id,
      userId: testUserAId,
      userRole: 'Founder',
      action: 'approve',
      feedback: 'One-pager looks sharp, approved for distribution.'
    });

    assert(copyResult.success === true, 'Non-state-changing deliverable approved successfully');
    assert(copyResult.stateChangesApplied?.isStateChanging === false, 'Correctly identified as non-state-changing');
    assert(copyResult.stateChangesApplied?.cashBalanceDelta === 0, 'Cash balance delta is 0');
    assert(copyResult.stateChangesApplied?.burnRateDelta === 0, 'Burn rate delta is 0');

    // Verify DB state is completely untouched
    const startupAPostCopy = await safeDbQuery(() => prisma.startup.findUnique({ where: { id: startupAId } }));
    assert(startupAPostCopy?.cashBalance === 500000, 'Cash balance untouched: $500,000');
    assert(startupAPostCopy?.burnRate === 41000, 'Burn rate untouched: $41,000');

    // ──────────────────────────────────────────────────────────────────────────
    // Scenario 10: Financial Approval (Cash Influx) & AI Prompt Feedback Loop
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Test 10: Financial Approval & AI Feedback Loop ---');
    const fundingApproval = await approvalService.createApproval({
      startupId: startupAId,
      title: 'Strategic Angel Seed Extension Tranche',
      description: 'Closing $250,000 strategic angel extension from robotics syndicate.',
      type: 'financials',
      financialChange: 250000
    });

    const fundingResult = await approvalService.reviewApproval({
      approvalId: fundingApproval.id,
      userId: testUserAId,
      userRole: 'Founder',
      action: 'approve'
    });

    assert(fundingResult.success === true, 'Financial commitment approved successfully');
    assert(fundingResult.stateChangesApplied?.cashBalanceDelta === 250000, 'Cash balance delta +$250,000');

    // Verify DB cash updated: 500,000 + 250,000 = 750,000
    const startupAPostFunding = await safeDbQuery(() => prisma.startup.findUnique({ where: { id: startupAId } }));
    assert(startupAPostFunding?.cashBalance === 750000, 'PostgreSQL cash balance updated to $750,000');

    // Verify new runway: 750,000 / 41,000 = 18.29 -> 18.3 months
    const postFundingContext = await companyContextService.getContextForUser(testUserAId);
    assert(postFundingContext?.financial.cashBalance === 750000, 'Company Context reflects new cash: $750,000');
    assert(postFundingContext?.financial.runwayMonths === 18.3, `Company Context reflects extended runway: ${postFundingContext?.financial.runwayMonths} months`);

    // Verify AI Chief of Staff Prompt Feedback Loop
    const ceoPrompt = companyContextService.toPromptContext(postFundingContext!, 'CEO');
    assert(ceoPrompt.includes('$750,000'), 'CEO Prompt Context contains updated treasury cash: $750,000');
    assert(ceoPrompt.includes('$41,000'), 'CEO Prompt Context contains updated monthly burn: $41,000/mo');
    assert(ceoPrompt.includes('18.3 months'), 'CEO Prompt Context contains verified updated runway: 18.3 months');
    assert(ceoPrompt.includes('7 engineers'), 'CEO Prompt Context contains updated team structure: 7 engineers');

  } catch (error: any) {
    console.error('Unexpected test runner exception:', error);
    testsFailed++;
  } finally {
    if (dbFixturesCreated) {
      console.log('\nCleaning up test database records...');
      try {
        if (startupAId) {
          await safeDbQuery(() => prisma.startup.delete({ where: { id: startupAId } }));
        }
        if (startupBId) {
          await safeDbQuery(() => prisma.startup.delete({ where: { id: startupBId } }));
        }
        if (testUserAId) {
          await safeDbQuery(() => prisma.user.delete({ where: { id: testUserAId } }));
        }
        if (testUserBId) {
          await safeDbQuery(() => prisma.user.delete({ where: { id: testUserBId } }));
        }
        companyContextService.clearCache();
        console.log('Cleanup completed.');
      } catch (cleanupErr: any) {
        console.warn('Cleanup warning:', cleanupErr.message);
      }
    }
  }

  console.log('\n========================================================================');
  console.log(`🏁 TEST SUMMARY: ${testsPassed} PASSED | ${testsFailed} FAILED`);
  console.log('========================================================================\n');

  if (testsFailed > 0) {
    process.exitCode = 1;
  }
}

/**
 * This suite previously created two companies per run and never removed them,
 * which is why the shared development database accumulated orphan fixtures.
 */
async function cleanupFixtures() {
  try {
    if (apCreatedStartupIds.length) {
      const plans = await prisma.plan.findMany({
        where: { startupId: { in: apCreatedStartupIds } }, select: { id: true }
      });
      const planIds = plans.map(p => p.id);
      if (planIds.length) {
        await prisma.task.deleteMany({ where: { planId: { in: planIds } } });
        await prisma.approval.deleteMany({ where: { planId: { in: planIds } } });
        await prisma.plan.deleteMany({ where: { id: { in: planIds } } });
      }
      for (const m of ['memory','timelineItem','decisionLog','notification','healthScore','command','executiveAgent'] as const) {
        await (prisma as any)[m].deleteMany({ where: { startupId: { in: apCreatedStartupIds } } }).catch(() => {});
      }
      const docs = await prisma.startupDocument.findMany({
        where: { startupId: { in: apCreatedStartupIds } }, select: { id: true }
      });
      if (docs.length) {
        const chunks = await prisma.knowledgeChunk.findMany({
          where: { documentId: { in: docs.map(d => d.id) } }, select: { id: true }
        });
        if (chunks.length) {
          await prisma.embedding.deleteMany({ where: { chunkId: { in: chunks.map(c => c.id) } } }).catch(() => {});
          await prisma.knowledgeChunk.deleteMany({ where: { id: { in: chunks.map(c => c.id) } } }).catch(() => {});
        }
        await prisma.startupDocument.deleteMany({ where: { id: { in: docs.map(d => d.id) } } }).catch(() => {});
      }
      await prisma.membership.deleteMany({ where: { startupId: { in: apCreatedStartupIds } } }).catch(() => {});
      await prisma.startup.deleteMany({ where: { id: { in: apCreatedStartupIds } } }).catch(() => {});
    }
    if (apCreatedUserIds.length) {
      await prisma.membership.deleteMany({ where: { userId: { in: apCreatedUserIds } } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: apCreatedUserIds } } }).catch(() => {});
    }
  } catch (err: any) {
    console.warn('Cleanup note:', err.message);
  }
}

runTests()
  .catch(err => {
    console.error('Test suite crashed:', err);
    process.exitCode = 1;
  })
  .finally(cleanupFixtures);
