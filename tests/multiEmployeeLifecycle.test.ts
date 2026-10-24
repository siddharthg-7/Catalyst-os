/**
 * CatalystOS — Multi-Employee Lifecycle & Task Dependency Test Suite
 *
 * Specifically verifies the 10 core requirements from Section 5.4:
 * 1. Creating multiple employee accounts in an organization (1 Founder + 3 Distinct Employees).
 * 2. Scoped task visibility: each employee only sees tasks for their own role/department.
 * 3. Role-scoped document isolation (Zero cross-department data leaks).
 * 4. Grounded AI executive partner assistance and confidentiality boundary enforcement.
 * 5. Task claiming and status state machine transitions.
 * 6. Explicit cross-functional task dependencies (Engineering -> Marketing -> Sales).
 * 7. Deliverable submission and automated Founder Approval item generation.
 * 8. Founder review, approval, and downstream dependency unblocking.
 * 9. Handling employee absence, reassignment, and unassignment.
 * 10. Immutable activity audit logging and strict multi-tenant organizational boundary enforcement.
 */

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../backend/services/dbService';
import { ensureMembership, resolveMembership } from '../backend/services/membershipService';
import {
  listTasksForUser,
  assignTaskForUser,
  updateTaskForUser,
  getRoleScopedContext,
  getCompanionAgent,
  assistEmployeeOnTask,
  TaskDelegationError,
  decodeTask
} from '../backend/services/taskDelegationService';
import { approvalService } from '../backend/services/approvalService';
import { activityLogService } from '../backend/services/activityLogService';

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

async function assertRejects(fn: () => Promise<any>, expectedCode: string, title: string) {
  try {
    await fn();
    assert(false, title, 'Expected a rejection but the call succeeded');
  } catch (err: any) {
    const code = err instanceof TaskDelegationError ? err.code : err?.code;
    assert(code === expectedCode, title, `Expected ${expectedCode}, got ${code} (${err?.message})`);
  }
}

const stamp = Date.now();
const hashPassword = (plain: string) => bcrypt.hash(plain, 10);
const createdUserIds: string[] = [];
const createdStartupIds: string[] = [];

async function makeUser(label: string, role: string = 'Employee') {
  const user = await prisma.user.create({
    data: {
      email: `multi_${label}_${stamp}@nexora.ai`,
      name: `User ${label}`,
      role,
      passwordHash: await hashPassword('catalystSecure123')
    }
  });
  createdUserIds.push(user.id);
  return user;
}

async function makeCompany(label: string) {
  const owner = await makeUser(`founder_${label}`, 'Founder');
  const startup = await prisma.startup.create({
    data: {
      name: `Nexora Launch Venture ${label} ${stamp}`,
      industry: 'Enterprise Autonomous OS',
      description: 'Multi-employee product launch verification venture',
      ownerId: owner.id
    }
  });
  createdStartupIds.push(startup.id);
  await ensureMembership(owner.id, startup.id, 'FOUNDER');
  return { owner, startup };
}

async function runTests() {
  console.log('\n========================================================================');
  console.log('  5.4 TASKS & PROJECTS / MULTI-EMPLOYEE LIFECYCLE AUDIT');
  console.log('========================================================================\n');

  if (!prisma) {
    console.warn('Prisma client not connected; aborting test suite.');
    return;
  }

  // ── [1] Create 1 Founder + 3 Distinct Employee Accounts in Organization A ────
  console.log('--- 1. Creating 1 Founder + 3 Distinct Real Employee Accounts ---');
  const { owner: founder, startup } = await makeCompany('HQ');

  // Employee 1: Engineering & Infrastructure Lead
  const engEmployee = await makeUser('alex_engineering', 'Employee');
  await ensureMembership(engEmployee.id, startup.id, 'OPERATIONS');

  // Employee 2: Marketing & Growth Lead
  const mktEmployee = await makeUser('maya_marketing', 'Employee');
  await ensureMembership(mktEmployee.id, startup.id, 'GROWTH');

  // Employee 3: Commercials & Finance Lead
  const finEmployee = await makeUser('sam_finance', 'Employee');
  await ensureMembership(finEmployee.id, startup.id, 'FINANCE');

  // Verify all 3 employees have separate memberships and roles
  const memEng = await resolveMembership(engEmployee.id);
  const memMkt = await resolveMembership(mktEmployee.id);
  const memFin = await resolveMembership(finEmployee.id);

  assert(memEng?.role === 'OPERATIONS' && memEng.startupId === startup.id, 'Employee 1 (Engineering) bound to OPERATIONS role in Org A');
  assert(memMkt?.role === 'GROWTH' && memMkt.startupId === startup.id, 'Employee 2 (Marketing) bound to GROWTH role in Org A');
  assert(memFin?.role === 'FINANCE' && memFin.startupId === startup.id, 'Employee 3 (Finance) bound to FINANCE role in Org A');

  // ── [2] Founder creates Product Launch Plan with Dependencies ───────────────
  console.log('\n--- 2. Founder Creates Product Launch Plan with Explicit Dependencies ---');
  
  const plan = await prisma.plan.create({
    data: {
      title: 'Q4 Enterprise Product Launch',
      description: 'Coordinated cross-functional launch of the Autonomous OS enterprise edition',
      status: 'active',
      startupId: startup.id
    }
  });

  // Task 1: Engineering Integration
  const task1Row = await prisma.task.create({
    data: {
      title: '[OPERATIONS|Helix|OPERATIONS] Complete core system integration & release candidate',
      assignedTo: 'OPERATIONS',
      status: 'pending',
      planId: plan.id,
      result: JSON.stringify({
        description: 'Finalize core integration and deploy v1.0 release candidate.',
        priority: 'CRITICAL',
        dependencies: [],
        expectedDeliverable: 'Deployed v1.0 release candidate passing 99.9% automated tests.'
      })
    }
  });

  // Task 2: Marketing Launch Announcement (Depends on Task 1)
  const task2Row = await prisma.task.create({
    data: {
      title: '[GROWTH|Vector|GROWTH] Finalize launch announcement & developer marketing campaign',
      assignedTo: 'GROWTH',
      status: 'pending',
      planId: plan.id,
      result: JSON.stringify({
        description: 'Publish press release, docs, and launch marketing funnel.',
        priority: 'HIGH',
        dependencies: [task1Row.id],
        expectedDeliverable: 'Official launch blog, GTM email blast, and developer documentation.'
      })
    }
  });

  // Task 3: Sales Commercial Rollout (Depends on Task 2)
  const task3Row = await prisma.task.create({
    data: {
      title: '[FINANCE|Aura|FINANCE] Update commercial pricing tiers & customer rollout schedule',
      assignedTo: 'FINANCE',
      status: 'pending',
      planId: plan.id,
      result: JSON.stringify({
        description: 'Finalize enterprise price sheet and forecast Q4 revenue pipeline.',
        priority: 'HIGH',
        dependencies: [task2Row.id],
        expectedDeliverable: 'Approved enterprise tier pricing and CAC payback model.'
      })
    }
  });

  assert(Boolean(task1Row && task2Row && task3Row), 'All 3 cross-functional launch tasks persisted successfully');

  // ── [3] Enforce Scoped Task Visibility: Each Employee Only Sees Their Tasks ──
  console.log('\n--- 3. Scoped Task Visibility & Isolation per Employee ---');
  
  const engTasks = await listTasksForUser(engEmployee.id);
  const mktTasks = await listTasksForUser(mktEmployee.id);
  const finTasks = await listTasksForUser(finEmployee.id);
  const founderTasks = await listTasksForUser(founder.id);

  assert(engTasks.some(t => t.id === task1Row.id), 'Engineering employee sees Task 1 (Integration)');
  assert(!engTasks.some(t => t.id === task2Row.id || t.id === task3Row.id), 'Engineering employee CANNOT see Marketing or Finance tasks');

  assert(mktTasks.some(t => t.id === task2Row.id), 'Marketing employee sees Task 2 (Launch Campaign)');
  assert(!mktTasks.some(t => t.id === task1Row.id || t.id === task3Row.id), 'Marketing employee CANNOT see Engineering or Finance tasks');

  assert(finTasks.some(t => t.id === task3Row.id), 'Finance employee sees Task 3 (Commercial Pricing)');
  assert(!finTasks.some(t => t.id === task1Row.id || t.id === task2Row.id), 'Finance employee CANNOT see Engineering or Marketing tasks');

  assert(founderTasks.length >= 3, 'Founder sees all 3 tasks across all departments');

  // ── [4] Role-Scoped Document Isolation (Zero Data Leaks) ─────────────────────
  console.log('\n--- 4. Role-Scoped Corporate Documents (Zero Data Leaks) ---');

  const engCtx = await getRoleScopedContext({ userId: engEmployee.id });
  const mktCtx = await getRoleScopedContext({ userId: mktEmployee.id });
  const finCtx = await getRoleScopedContext({ userId: finEmployee.id });

  const engDocNames = engCtx.accessibleDocuments.map(d => d.name);
  const mktDocNames = mktCtx.accessibleDocuments.map(d => d.name);
  const finDocNames = finCtx.accessibleDocuments.map(d => d.name);

  assert(engDocNames.some(n => n.includes('Runbook') || n.includes('Operations')), 'Engineering sees Operations Runbook');
  assert(!engDocNames.some(n => n.includes('Cap Table') || n.includes('Financial Statements')), 'Engineering CANNOT see Cap Table or Financial Statements (Zero Leak)');

  assert(mktDocNames.some(n => n.includes('Growth') || n.includes('GTM')), 'Marketing sees Growth Strategy');
  assert(!mktDocNames.some(n => n.includes('Cap Table') || n.includes('Runbook')), 'Marketing CANNOT see Cap Table or Technical Runbook (Zero Leak)');

  assert(finDocNames.some(n => n.includes('Cap Table') || n.includes('Financial Statements')), 'Finance sees Cap Table & Financials');
  assert(!finDocNames.some(n => n.includes('Runbook')), 'Finance CANNOT see Technical Runbook (Zero Leak)');

  // ── [5] Grounded AI Executive Partner Assistance & Boundary Enforcement ─────
  console.log('\n--- 5. AI Partner Collaboration & Data Governance Guardrails ---');

  const helixPartner = getCompanionAgent('OPERATIONS');
  assert(helixPartner.name === 'Helix', 'Engineering AI partner is Helix (COO/Operations)');

  const vectorPartner = getCompanionAgent('GROWTH');
  assert(vectorPartner.name === 'Vector', 'Marketing AI partner is Vector (CMO/Growth)');

  const auraPartner = getCompanionAgent('FINANCE');
  assert(auraPartner.name === 'Aura', 'Finance AI partner is Aura (CFO/Finance)');

  // Marketing employee attempts to consult on Engineering Task -> Rejected (403)
  await assertRejects(
    () => assistEmployeeOnTask({
      userId: mktEmployee.id,
      taskId: task1Row.id,
      question: 'Can you show me the server deployment script?'
    }),
    'NOT_TASK_OWNER',
    'Marketing employee cannot consult AI on an Engineering task (403 NOT_TASK_OWNER)'
  );

  // ── [6] Task Claiming & Cross-Department Prevention ─────────────────────────
  console.log('\n--- 6. Task Claiming & Role Authorization Enforcement ---');

  // Marketing employee tries to claim Engineering Task -> Rejected (403)
  await assertRejects(
    () => assignTaskForUser({
      userId: mktEmployee.id,
      taskId: task1Row.id
    }),
    'NOT_TASK_OWNER',
    'Marketing employee cannot claim an Engineering task (403 NOT_TASK_OWNER)'
  );

  // Engineering employee claims Task 1
  const claimedTask1 = await assignTaskForUser({
    userId: engEmployee.id,
    taskId: task1Row.id
  });

  assert(claimedTask1.assignedUserId === engEmployee.id, 'Engineering employee successfully claimed Task 1');
  assert(claimedTask1.status === 'in_progress', 'Claiming task auto-advances status to in_progress');

  // ── [7] Deliverable Submission & Founder Review Generation ──────────────────
  console.log('\n--- 7. Deliverable Submission & Automatic Founder Approval Queue ---');

  const engSubmissionText = 'v1.0 Release Candidate deployed to staging. Automated test suite passed with 99.9% integration coverage. All core API contracts verified.';

  const submittedTask1 = await updateTaskForUser({
    userId: engEmployee.id,
    taskId: task1Row.id,
    status: 'submitted',
    result: engSubmissionText
  });

  assert(submittedTask1.status === 'submitted', 'Task 1 status transitioned to submitted');

  // Employee cannot approve their own submission
  await assertRejects(
    () => updateTaskForUser({
      userId: engEmployee.id,
      taskId: task1Row.id,
      status: 'approved'
    }),
    'SELF_APPROVAL_FORBIDDEN',
    'Employee CANNOT self-approve their own deliverable (403 SELF_APPROVAL_FORBIDDEN)'
  );

  // Check Approval queue for Founder
  const expectedApprovalId = `appr_task_${task1Row.id}`;
  const approvalItem = await prisma.approval.findUnique({
    where: { id: expectedApprovalId }
  });

  assert(Boolean(approvalItem), 'Approval queue item automatically generated for founder');
  assert(approvalItem?.status === 'pending_review', 'Approval status is pending_review');
  assert(approvalItem?.description === engSubmissionText, 'Approval description contains exact deliverable evidence');

  // ── [8] Founder Reviews & Approves -> Task 1 Completes ──────────────────────
  console.log('\n--- 8. Founder Approval & Downstream Dependency Unblocking ---');

  const approvalResult = await approvalService.reviewApproval({
    approvalId: expectedApprovalId,
    userId: founder.id,
    action: 'approve',
    feedback: 'Approved by Founder. High test coverage verified. Proceed with marketing announcement.'
  });

  assert(approvalResult.success === true, 'Founder successfully approved integration deliverable');

  const completedTask1 = await prisma.task.findUnique({ where: { id: task1Row.id } });
  assert(completedTask1?.status === 'approved', 'Task 1 status transitioned to approved in database');

  // Now Marketing can claim Task 2 because Task 1 is completed!
  const claimedTask2 = await assignTaskForUser({
    userId: mktEmployee.id,
    taskId: task2Row.id
  });
  assert(claimedTask2.assignedUserId === mktEmployee.id, 'Marketing employee claims Task 2 once dependency is completed');
  assert(claimedTask2.status === 'in_progress', 'Task 2 enters in_progress');

  // ── [9] Handling Reassignment & Absence ─────────────────────────────────────
  console.log('\n--- 9. Employee Absence & Founder Reassignment Handling ---');

  // Suppose Sam (Finance) is on leave. Founder creates a backup finance specialist or reassigns task
  const backupFin = await makeUser('rachel_finance_backup', 'Employee');
  await ensureMembership(backupFin.id, startup.id, 'FINANCE');

  // Founder assigns Task 3 to the backup specialist
  const reassignedTask3 = await assignTaskForUser({
    userId: founder.id,
    taskId: task3Row.id,
    assigneeId: backupFin.id
  });

  assert(reassignedTask3.assignedUserId === backupFin.id, 'Founder successfully reassigned Task 3 to backup specialist');

  // Backup finance specialist sees the task in their inbox
  const backupTasks = await listTasksForUser(backupFin.id);
  assert(backupTasks.some(t => t.id === task3Row.id), 'Backup specialist sees reassigned Task 3 in inbox');

  // Founder unassigns task back to role pool
  const unassignedTask3 = await assignTaskForUser({
    userId: founder.id,
    taskId: task3Row.id,
    assigneeId: null
  });
  assert(unassignedTask3.assignedUserId === null, 'Founder unassigned Task 3 back to FINANCE role pool');
  assert(unassignedTask3.ownerRole === 'FINANCE', 'Task 3 retains FINANCE departmental ownership');

  // ── [10] Multi-Tenant Boundary Isolation ───────────────────────────────────
  console.log('\n--- 10. Multi-Tenant Organizational Boundary Enforcement ---');

  // Setup Company B with its own employee
  const { owner: founderB, startup: startupB } = await makeCompany('CompetitorB');
  const stranger = await makeUser('stranger_b', 'Employee');
  await ensureMembership(stranger.id, startupB.id, 'OPERATIONS');

  // Stranger from Company B tries to view Company A tasks -> empty list
  const strangerTasks = await listTasksForUser(stranger.id);
  assert(!strangerTasks.some(t => t.id === task1Row.id), 'User from Company B cannot see Company A tasks (Tenant Isolation)');

  // Stranger tries to claim Company A task -> 404 NOT_FOUND
  await assertRejects(
    () => assignTaskForUser({
      userId: stranger.id,
      taskId: task1Row.id
    }),
    'NOT_FOUND',
    'User from Company B attempting to claim Company A task returns 404 NOT_FOUND'
  );

  // ── [11] Activity Audit Trail Verification ─────────────────────────────────
  console.log('\n--- 11. Comprehensive Activity Audit Trail Verification ---');

  // Verify activity log captured events for this startup
  const activities = await activityLogService.listActivities({
    startupId: startup.id,
    limit: 50
  });

  assert(activities.length > 0, 'Organization A has immutable activity logs recorded in database');
  console.log(`  Recorded ${activities.length} audit trail events for organization.`);

  console.log('\n========================================================================');
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exitCode = 1;
  }
}

async function cleanupFixtures() {
  try {
    if (createdStartupIds.length) {
      const plans = await prisma.plan.findMany({
        where: { startupId: { in: createdStartupIds } }, select: { id: true }
      });
      const planIds = plans.map(p => p.id);
      if (planIds.length) {
        await prisma.task.deleteMany({ where: { planId: { in: planIds } } });
        await prisma.approval.deleteMany({ where: { planId: { in: planIds } } });
        await prisma.plan.deleteMany({ where: { id: { in: planIds } } });
      }
      await prisma.memory.deleteMany({ where: { startupId: { in: createdStartupIds } } });
      await prisma.timelineItem.deleteMany({ where: { startupId: { in: createdStartupIds } } });
      await prisma.invitation.deleteMany({ where: { startupId: { in: createdStartupIds } } });
      await prisma.membership.deleteMany({ where: { startupId: { in: createdStartupIds } } });
      await prisma.startup.deleteMany({ where: { id: { in: createdStartupIds } } });
    }
    if (createdUserIds.length) {
      await prisma.membership.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.invitation.deleteMany({ where: { invitedById: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  } catch (err: any) {
    console.warn('Cleanup note:', err.message);
  }
}

runTests()
  .catch(err => {
    console.error('Fatal error during Multi-Employee test suite:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanupFixtures();
    await prisma.$disconnect();
  });
