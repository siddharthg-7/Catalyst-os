import { PrismaClient } from '@prisma/client';
import {
  planParentTaskWithRecovery,
  retryTaskPlanning,
  persistAssignmentsWithResilientNotifications,
  retryTaskNotification,
  assertNonTerminalLlmOutput,
  OrchestrationLifecycleStage
} from '../backend/services/orchestrationReliabilityService';
import {
  decomposeParentTask,
  getTaskByIdForUser,
  updateTaskForUser,
  assignTaskForUser,
  listTasksForUser,
  getRoleScopedContext,
  assistEmployeeOnTask,
  validateStatusTransition,
  TaskDelegationError
} from '../backend/services/taskDelegationService';
import {
  createNotification,
  listNotificationsForUser,
  notifyNewAssignment
} from '../backend/services/notificationService';
import {
  authorizeDocumentDownload,
  authorizeDocumentUpload
} from '../backend/services/documentAccessService';

const prisma = new PrismaClient();

async function runPhase10Verification() {
  console.log('================================================================');
  console.log('🧪 CATALYST OS: PHASE 10 COMPREHENSIVE VERIFICATION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} ${details ? `(${details})` : ''}`);
      failed++;
    }
  }

  try {
    const timestamp = Date.now();

    // ----------------------------------------------------------------
    // SETUP: Multi-Company Environment (Company A & Company B)
    // ----------------------------------------------------------------
    console.log('--- Setup: Creating Multi-Company Environment ---');

    // Company A: Founder A, Operations Lead A1, Recruiter A2
    const founderA = await prisma.user.create({
      data: {
        email: `founder.p10.${timestamp}@example.com`,
        name: 'Amelia Founder',
        role: 'FOUNDER'
      }
    });

    const companyA = await prisma.startup.create({
      data: {
        name: `Catalyst Core A ${timestamp}`,
        industry: 'Enterprise Software',
        description: 'Venture Operating System',
        ownerId: founderA.id
      }
    });

    await prisma.membership.create({
      data: {
        userId: founderA.id,
        startupId: companyA.id,
        role: 'FOUNDER',
        status: 'ACTIVE'
      }
    });

    const opsA1 = await prisma.user.create({
      data: {
        email: `ops.a1.${timestamp}@example.com`,
        name: 'Oliver Operations',
        role: 'OPERATIONS'
      }
    });

    await prisma.membership.create({
      data: {
        userId: opsA1.id,
        startupId: companyA.id,
        role: 'OPERATIONS',
        status: 'ACTIVE'
      }
    });

    const recruiterA2 = await prisma.user.create({
      data: {
        email: `recruiter.a2.${timestamp}@example.com`,
        name: 'Rachel Recruiter',
        role: 'HR'
      }
    });

    await prisma.membership.create({
      data: {
        userId: recruiterA2.id,
        startupId: companyA.id,
        role: 'HR',
        status: 'ACTIVE'
      }
    });

    // Company B: Foreign Founder B, Foreign Operations B1
    const founderB = await prisma.user.create({
      data: {
        email: `founder.b.${timestamp}@example.com`,
        name: 'Boris Founder B',
        role: 'FOUNDER'
      }
    });

    const companyB = await prisma.startup.create({
      data: {
        name: `Competitor B ${timestamp}`,
        industry: 'Cyber Security',
        description: 'External Venture',
        ownerId: founderB.id
      }
    });

    await prisma.membership.create({
      data: {
        userId: founderB.id,
        startupId: companyB.id,
        role: 'FOUNDER',
        status: 'ACTIVE'
      }
    });

    const opsB1 = await prisma.user.create({
      data: {
        email: `ops.b1.${timestamp}@example.com`,
        name: 'Brian Operations B1',
        role: 'OPERATIONS'
      }
    });

    await prisma.membership.create({
      data: {
        userId: opsB1.id,
        startupId: companyB.id,
        role: 'OPERATIONS',
        status: 'ACTIVE'
      }
    });

    console.log(`  Initialized Company A (${companyA.id}) and Company B (${companyB.id})\n`);

    // ----------------------------------------------------------------
    // 1. Parent Task Creation
    // ----------------------------------------------------------------
    console.log('--- 1. Parent Task Creation ---');
    const parentPlanResult = await planParentTaskWithRecovery({
      userId: founderA.id,
      input: {
        title: 'Recruit Senior Infrastructure Architect for Core Security',
        description: 'Assess engineering capacity, determine hiring criteria, review legal employment policies, and audit financial budget runway.',
        priority: 'HIGH',
        deadline: '2026-12-31'
      }
    });

    assert(parentPlanResult.success === true, 'Parent task planning succeeds');
    assert(!!parentPlanResult.parentTaskId, 'Parent task ID is generated and returned');

    const parentInDb = await prisma.task.findUnique({
      where: { id: parentPlanResult.parentTaskId }
    });
    assert(!!parentInDb, 'Parent task is persisted in Neon Postgres database');
    assert(parentInDb?.status === 'pending', 'Parent task initial status is pending (non-terminal)');
    assert(
      parentInDb?.result?.includes('"isParentInitiative":true'),
      'Parent task metadata flags isParentInitiative: true'
    );

    // ----------------------------------------------------------------
    // 2. Structured Subtask Generation
    // ----------------------------------------------------------------
    console.log('\n--- 2. Structured Subtask Generation ---');
    const preview = parentPlanResult.preview;
    assert(!!preview, 'Preview decomposition is generated');
    assert(
      Array.isArray(preview?.proposedSubtasks) && preview!.proposedSubtasks.length >= 3,
      'Generates multiple structured proposed subtasks (at least 3 steps)'
    );

    const firstSubtask = preview!.proposedSubtasks[0];
    assert(
      typeof firstSubtask.stepNumber === 'number' &&
      !!firstSubtask.title &&
      !!firstSubtask.department &&
      !!firstSubtask.agent &&
      !!firstSubtask.expectedDeliverable,
      'Subtask conforms to structured schema (stepNumber, title, department, agent, deliverable)'
    );

    // ----------------------------------------------------------------
    // 3. Assignment to an Existing Employee
    // ----------------------------------------------------------------
    console.log('\n--- 3. Assignment to an Existing Employee ---');
    // Subtask matching OPERATIONS should automatically resolve to opsA1
    const opsSubtask = preview!.proposedSubtasks.find(
      s => s.department === 'OPERATIONS' || s.suggestedRole === 'OPERATIONS'
    );
    assert(!!opsSubtask, 'Identified operations subtask');
    assert(
      opsSubtask?.assignedUserId === opsA1.id,
      'Automatically resolves assignment to existing company operations lead (Oliver Operations)'
    );
    assert(
      opsSubtask?.assignmentStatus === 'ASSIGNED',
      'Flags assignment status as ASSIGNED for single matching employee'
    );

    // ----------------------------------------------------------------
    // 4. Missing Employee Resolution
    // ----------------------------------------------------------------
    console.log('\n--- 4. Missing Employee Resolution ---');
    // Company A has NO finance employee. Subtask for FINANCE should flag UNFILLED.
    const financeSubtask = preview!.proposedSubtasks.find(
      s => s.department === 'FINANCE' || s.suggestedRole === 'FINANCE'
    );
    assert(!!financeSubtask, 'Identified finance subtask');
    assert(
      financeSubtask?.assignedUserId === null,
      'Assignee ID is null when no employee exists for role'
    );
    assert(
      financeSubtask?.assignmentStatus === 'UNFILLED',
      'Flags assignmentStatus as UNFILLED for missing role'
    );
    assert(
      financeSubtask?.needsAttention === true,
      'Flags needsAttention: true for founder action'
    );
    assert(
      typeof financeSubtask?.reason === 'string' && financeSubtask.reason.includes('No active team member'),
      'Provides human-readable diagnostic reason for unfilled role'
    );

    // Persist assignments (including unfilled task) to DB
    const persistenceResult = await persistAssignmentsWithResilientNotifications({
      userId: founderA.id,
      parentTask: {
        title: 'Launch SOC2 Type II Security Certification',
        description: 'Core compliance initiative'
      },
      subtasks: [
        {
          title: 'Implement Immutable Audit Ledger',
          department: 'OPERATIONS',
          suggestedRole: 'OPERATIONS',
          assignedUserId: opsA1.id,
          priority: 'HIGH'
        },
        {
          title: 'Finance & Compliance Budget Allocation',
          department: 'FINANCE',
          suggestedRole: 'FINANCE',
          assignedUserId: null, // UNFILLED / Missing employee
          priority: 'HIGH'
        }
      ]
    });

    assert(persistenceResult.success === true, 'Successfully persists assignments including unfilled tasks');
    assert(persistenceResult.tasks.length === 2, 'Persists both filled and unfilled tasks');

    const persistedAssignedTask = persistenceResult.tasks.find(t => t.assignedUserId === opsA1.id)!;
    const persistedUnfilledTask = persistenceResult.tasks.find(t => !t.assignedUserId)!;

    assert(!!persistedAssignedTask, 'Assigned task persisted in DB');
    assert(!!persistedUnfilledTask, 'Unfilled task safely persisted in DB as role-scoped / unassigned');

    // Founder manually resolves unfilled task by assigning to recruiter
    const manuallyAssigned = await assignTaskForUser({
      userId: founderA.id,
      taskId: persistedUnfilledTask.id,
      assigneeId: recruiterA2.id
    });
    assert(
      manuallyAssigned.assignedUserId === recruiterA2.id,
      'Founder successfully resolves missing employee by assigning work manually'
    );

    // ----------------------------------------------------------------
    // 5. Company-Isolation Enforcement
    // ----------------------------------------------------------------
    console.log('\n--- 5. Company-Isolation Enforcement ---');

    // 5a. Foreign user reading Company A task
    let foreignReadBlocked = false;
    try {
      await getTaskByIdForUser(opsB1.id, persistedAssignedTask.id);
    } catch (err: any) {
      if (err instanceof TaskDelegationError && err.status === 404) {
        foreignReadBlocked = true;
      }
    }
    assert(foreignReadBlocked, 'Cross-company task read blocked (indistinguishable 404)');

    // 5b. Foreign user updating Company A task
    let foreignUpdateBlocked = false;
    try {
      await updateTaskForUser({
        userId: opsB1.id,
        taskId: persistedAssignedTask.id,
        status: 'in_progress'
      });
    } catch (err: any) {
      if (err instanceof TaskDelegationError && err.status === 404) {
        foreignUpdateBlocked = true;
      }
    }
    assert(foreignUpdateBlocked, 'Cross-company task update blocked (404)');

    // 5c. Foreign user assigned to Company A task
    let foreignAssignBlocked = false;
    try {
      await assignTaskForUser({
        userId: founderA.id,
        taskId: persistedAssignedTask.id,
        assigneeId: opsB1.id
      });
    } catch (err: any) {
      if (err instanceof TaskDelegationError && (err.code === 'ASSIGNEE_NOT_FOUND' || err.status === 404)) {
        foreignAssignBlocked = true;
      }
    }
    assert(foreignAssignBlocked, 'Assigning foreign user to task blocked (ASSIGNEE_NOT_FOUND)');

    // ----------------------------------------------------------------
    // 6. Employee Dashboard Task Retrieval
    // ----------------------------------------------------------------
    console.log('\n--- 6. Employee Dashboard Task Retrieval ---');

    const opsATasks = await listTasksForUser(opsA1.id);
    assert(
      opsATasks.some(t => t.id === persistedAssignedTask.id),
      'Employee dashboard retrieves assigned task'
    );
    assert(
      !opsATasks.some(t => t.id === parentPlanResult.parentTaskId && t.isRestricted),
      'Employee dashboard does not leak restricted tasks'
    );

    const opsBTasks = await listTasksForUser(opsB1.id);
    assert(
      !opsBTasks.some(t => t.id === persistedAssignedTask.id),
      'Foreign employee dashboard contains 0 tasks from other companies'
    );

    const workspacePayload = await getRoleScopedContext({ userId: opsA1.id });
    assert(
      typeof workspacePayload.departmentMetrics?.activeTasks === 'number' && workspacePayload.departmentMetrics.activeTasks >= 1,
      'Role-scoped workspace context returns active task metrics'
    );
    assert(
      typeof workspacePayload.companionAgent.name === 'string' && workspacePayload.companionAgent.name.length > 0,
      'Role-scoped workspace loads designated AI companion agent'
    );

    // ----------------------------------------------------------------
    // 7. Notification Creation and Deduplication
    // ----------------------------------------------------------------
    console.log('\n--- 7. Notification Creation and Deduplication ---');

    const dedupKey = `alert_dedup_test_${timestamp}`;
    const firstNotif = await createNotification({
      startupId: companyA.id,
      title: 'Deduplication Test Alert',
      message: 'Initial dispatch of notification',
      type: 'TASK_ASSIGNED',
      taskId: persistedAssignedTask.id,
      targetUserId: opsA1.id,
      dedupKey
    });

    assert(!!firstNotif, 'Initial notification created successfully');

    // Attempt second creation with identical dedupKey
    const secondNotif = await createNotification({
      startupId: companyA.id,
      title: 'Deduplication Test Alert (Retry)',
      message: 'Second duplicate dispatch of notification',
      type: 'TASK_ASSIGNED',
      taskId: persistedAssignedTask.id,
      targetUserId: opsA1.id,
      dedupKey
    });

    assert(
      secondNotif?.id === firstNotif?.id,
      'Duplicate notification intercepted by dedupKey (returns existing record)'
    );

    const matchingCount = await prisma.notification.count({
      where: {
        startupId: companyA.id,
        message: { contains: `[DEDUP:${dedupKey}]` }
      }
    });
    assert(matchingCount === 1, 'Database contains exactly 1 notification record despite retry');

    // ----------------------------------------------------------------
    // 8. Notification Navigation
    // ----------------------------------------------------------------
    console.log('\n--- 8. Notification Navigation ---');

    const opsNotifications = await listNotificationsForUser(opsA1.id);
    const targetNotif = opsNotifications.find(n => n.taskId === persistedAssignedTask.id);

    assert(!!targetNotif, 'Employee notification list contains task assignment notification');
    assert(
      targetNotif?.taskId === persistedAssignedTask.id,
      'Notification parses and exposes exact taskId navigation link'
    );
    assert(
      !targetNotif?.message.includes('[TASK_ID:'),
      'Clean message content delivered without leaking raw envelope tags'
    );

    // ----------------------------------------------------------------
    // 9. Task Start and Submission
    // ----------------------------------------------------------------
    console.log('\n--- 9. Task Start and Submission ---');

    // 9a. Employee starts task
    const startedTask = await updateTaskForUser({
      userId: opsA1.id,
      taskId: persistedAssignedTask.id,
      status: 'in_progress'
    });
    assert(startedTask.status === 'in_progress', 'Employee advances task to in_progress');

    // 9b. Employee submits deliverables
    const deliverablePayload = 'Completed SHA-256 hash chaining and PostgreSQL append-only audit trail service.';
    const submittedTask = await updateTaskForUser({
      userId: opsA1.id,
      taskId: persistedAssignedTask.id,
      status: 'submitted',
      submissionNotes: deliverablePayload
    });

    assert(submittedTask.status === 'submitted', 'Employee transitions task to submitted');
    assert(
      submittedTask.result?.includes('[TASK_SUBMISSION]:'),
      'Submission notes securely appended into task deliverable payload'
    );

    // Verify approval record was generated
    const approvalRecord = await prisma.approval.findUnique({
      where: { id: `appr_task_${persistedAssignedTask.id}` }
    });
    assert(!!approvalRecord, 'Submission automatically creates Founder Review approval queue record');
    assert(
      approvalRecord?.status === 'pending_review' || approvalRecord?.status === 'pending',
      'Approval queue item is pending founder review (pending_review)'
    );

    // 9c. Self-Approval Guard: verify employee cannot approve their own submission
    let selfApprovalBlocked = false;
    try {
      await updateTaskForUser({
        userId: opsA1.id,
        taskId: persistedAssignedTask.id,
        status: 'completed'
      });
    } catch (err: any) {
      if (err instanceof TaskDelegationError && (err.code === 'SELF_APPROVAL_FORBIDDEN' || err.status === 403)) {
        selfApprovalBlocked = true;
      }
    }
    assert(selfApprovalBlocked, 'Employee self-approval strictly rejected (SELF_APPROVAL_FORBIDDEN)');

    // ----------------------------------------------------------------
    // 10. Document Upload Authorization
    // ----------------------------------------------------------------
    console.log('\n--- 10. Document Upload Authorization ---');

    // 10a. Direct assignee uploading attachment to their task
    const assigneeUploadAuth = await authorizeDocumentUpload({
      userId: opsA1.id,
      taskId: persistedAssignedTask.id
    });
    assert(assigneeUploadAuth.allowed === true, 'Direct assignee authorized to upload task deliverable');

    // 10b. Peer employee uploading to a task they are not assigned to
    const peerUploadAuth = await authorizeDocumentUpload({
      userId: recruiterA2.id,
      taskId: persistedAssignedTask.id
    });
    assert(
      peerUploadAuth.allowed === false && peerUploadAuth.statusCode === 403,
      'Peer employee rejected from uploading to unassigned task (403 UNAUTHORIZED_TASK_ACCESS)'
    );

    // 10c. Foreign company employee uploading to Company A task
    const foreignUploadAuth = await authorizeDocumentUpload({
      userId: opsB1.id,
      taskId: persistedAssignedTask.id
    });
    assert(
      foreignUploadAuth.allowed === false,
      'Foreign employee rejected from uploading to another company task (403/404)'
    );

    // 10d. Employee attempting to upload with FOUNDER_ONLY access scope
    const employeeFounderScopeAuth = await authorizeDocumentUpload({
      userId: opsA1.id,
      accessScope: 'FOUNDER_ONLY'
    });
    assert(
      employeeFounderScopeAuth.allowed === false && employeeFounderScopeAuth.statusCode === 403,
      'Regular employee rejected from uploading FOUNDER_ONLY document (403 UNAUTHORIZED_SCOPE)'
    );

    // 10e. Founder authorized to upload FOUNDER_ONLY document
    const founderScopeAuth = await authorizeDocumentUpload({
      userId: founderA.id,
      accessScope: 'FOUNDER_ONLY'
    });
    assert(founderScopeAuth.allowed === true, 'Founder authorized to upload with FOUNDER_ONLY access scope');

    // ----------------------------------------------------------------
    // 11. Revision Requests
    // ----------------------------------------------------------------
    console.log('\n--- 11. Revision Requests ---');

    // 11a. Request changes without feedback -> should fail validation
    const invalidRevisionCheck = validateStatusTransition({
      currentStatus: 'submitted',
      nextStatus: 'changes_requested',
      callerUserId: founderA.id,
      callerRole: 'FOUNDER',
      isDirectAssignee: false,
      founderFeedback: '' // Missing feedback!
    });
    assert(
      invalidRevisionCheck.allowed === false && invalidRevisionCheck.statusCode === 400,
      'Requesting revisions without feedback rejected (400 feedback required)'
    );

    // 11b. Founder requests changes with directive feedback
    const revisionFeedback = 'Please include automated unit tests verifying tamper-resistance under simulated attack.';
    const revisionTask = await updateTaskForUser({
      userId: founderA.id,
      taskId: persistedAssignedTask.id,
      status: 'changes_requested',
      founderFeedback: revisionFeedback
    });

    assert(
      revisionTask.canonicalStatus === 'CHANGES_REQUESTED' || revisionTask.status === 'changes_requested',
      'Task transitioned to changes_requested'
    );
    assert(
      revisionTask.result?.includes('[FOUNDER_FEEDBACK]:'),
      'Founder feedback recorded in deliverable payload'
    );

    // 11c. Employee restarts work and resubmits
    await updateTaskForUser({
      userId: opsA1.id,
      taskId: persistedAssignedTask.id,
      status: 'in_progress'
    });

    const resubmittedTask = await updateTaskForUser({
      userId: opsA1.id,
      taskId: persistedAssignedTask.id,
      status: 'submitted',
      submissionNotes: 'Added 14 adversarial tamper-test cases verifying hash chain break detection.'
    });
    assert(resubmittedTask.status === 'submitted', 'Employee successfully resubmits revised work');

    // ----------------------------------------------------------------
    // 12. Founder Review and Approval
    // ----------------------------------------------------------------
    console.log('\n--- 12. Founder Review and Approval ---');

    const approvedTask = await updateTaskForUser({
      userId: founderA.id,
      taskId: persistedAssignedTask.id,
      status: 'completed'
    });

    assert(
      approvedTask.canonicalStatus === 'COMPLETED' || approvedTask.status === 'approved',
      'Founder approves deliverable and marks task completed'
    );

    // ----------------------------------------------------------------
    // 13. Invalid Status Transitions
    // ----------------------------------------------------------------
    console.log('\n--- 13. Invalid Status Transitions ---');

    // 13a. Arbitrary invalid status string
    let arbitraryStatusBlocked = false;
    try {
      await updateTaskForUser({
        userId: founderA.id,
        taskId: persistedAssignedTask.id,
        status: 'MALICIOUS_CUSTOM_STATUS_99'
      });
    } catch (err: any) {
      if (err instanceof TaskDelegationError && err.code === 'INVALID_STATUS_TRANSITION') {
        arbitraryStatusBlocked = true;
      }
    }
    assert(arbitraryStatusBlocked, 'Arbitrary unrecognized status string rejected (INVALID_STATUS_TRANSITION)');

    // 13b. Regular employee reopening completed task
    let reopenBlocked = false;
    try {
      await updateTaskForUser({
        userId: opsA1.id,
        taskId: persistedAssignedTask.id,
        status: 'in_progress'
      });
    } catch (err: any) {
      if (err instanceof TaskDelegationError && (err.code === 'TERMINAL_STATE_LOCKED' || err.status === 403)) {
        reopenBlocked = true;
      }
    }
    assert(reopenBlocked, 'Employee reopening terminal completed task blocked (TERMINAL_STATE_LOCKED)');

    // 13c. Skipping directly from BACKLOG to COMPLETED
    const backlogCheck = validateStatusTransition({
      currentStatus: 'pending',
      assignedTo: null, // BACKLOG
      nextStatus: 'completed',
      callerUserId: founderA.id,
      callerRole: 'FOUNDER',
      isDirectAssignee: false
    });
    assert(
      backlogCheck.allowed === false,
      'Skipping directly from BACKLOG to COMPLETED blocked without execution'
    );

    // ----------------------------------------------------------------
    // 14. Existing AI Workflows Remaining Functional
    // ----------------------------------------------------------------
    console.log('\n--- 14. Existing AI Workflows Remaining Functional ---');

    // 14a. Automated LLM cannot auto-complete task
    let llmAutoCompleteBlocked = false;
    try {
      assertNonTerminalLlmOutput('GeminiAssistant', 'COMPLETED');
    } catch (err: any) {
      if (err instanceof TaskDelegationError && err.code === 'LLM_TERMINAL_STATUS_FORBIDDEN') {
        llmAutoCompleteBlocked = true;
      }
    }
    assert(llmAutoCompleteBlocked, 'AI assistant cannot auto-complete assignments (LLM_TERMINAL_STATUS_FORBIDDEN)');

    // 14b. Companion AI Assistant interaction on task
    const assistantReply = await assistEmployeeOnTask({
      userId: opsA1.id,
      taskId: persistedAssignedTask.id,
      question: 'How should I structure the audit ledger hashing?',
      currentDraft: 'Initial audit schema'
    });

    assert(
      typeof assistantReply.reply === 'string' && assistantReply.reply.length > 20,
      'Companion AI executive assistant returns grounded analysis'
    );
    assert(
      typeof assistantReply.suggestedEdits === 'string' && assistantReply.suggestedEdits.length > 0,
      'Companion AI provides structured suggested deliverable edits'
    );

  } catch (error: any) {
    console.error('💥 UNEXPECTED EXCEPTION DURING VERIFICATION:', error);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n================================================================');
  console.log(`📊 PHASE 10 VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase10Verification();
