import { PrismaClient } from '@prisma/client';
import {
  assertNonTerminalLlmOutput,
  planParentTaskWithRecovery,
  retryTaskPlanning,
  persistAssignmentsWithResilientNotifications,
  retryTaskNotification,
  OrchestrationLifecycleStage
} from '../backend/services/orchestrationReliabilityService';
import {
  updateTaskForUser,
  assignTaskForUser,
  getTaskByIdForUser,
  TaskDelegationError
} from '../backend/services/taskDelegationService';
import { listNotificationsForUser } from '../backend/services/notificationService';

const prisma = new PrismaClient();

async function runPhase9Tests() {
  console.log('================================================================');
  console.log('🧪 CATALYST OS: PHASE 9 RELIABLE ORCHESTRATION VERIFICATION');
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
    // ----------------------------------------------------------------
    // SETUP: Multi-Company Setup for Isolation & Orchestration Testing
    // ----------------------------------------------------------------
    console.log('--- Setup: Initializing Company & Users ---');
    const timestamp = Date.now();

    const founderA = await prisma.user.create({
      data: {
        email: `founder.p9.${timestamp}@example.com`,
        name: 'Grace Founder',
        role: 'FOUNDER'
      }
    });

    const companyA = await prisma.startup.create({
      data: {
        name: `Orchestration Corp ${timestamp}`,
        industry: 'Cloud Infrastructure',
        description: 'Reliable Cloud Workflows',
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

    const employeeA1 = await prisma.user.create({
      data: {
        email: `dev.p9.${timestamp}@example.com`,
        name: 'Dave Developer',
        role: 'ENGINEER'
      }
    });

    await prisma.membership.create({
      data: {
        userId: employeeA1.id,
        startupId: companyA.id,
        role: 'ENGINEER',
        status: 'ACTIVE'
      }
    });

    // Foreign Company B (to test cross-company validation)
    const founderB = await prisma.user.create({
      data: {
        email: `founder.b.${timestamp}@example.com`,
        name: 'Bob Foreign Founder',
        role: 'FOUNDER'
      }
    });

    const companyB = await prisma.startup.create({
      data: {
        name: `Foreign Corp ${timestamp}`,
        industry: 'Security',
        description: 'External Corp',
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

    const employeeB1 = await prisma.user.create({
      data: {
        email: `foreign.dev.${timestamp}@example.com`,
        name: 'Frank Foreigner',
        role: 'ENGINEER'
      }
    });

    await prisma.membership.create({
      data: {
        userId: employeeB1.id,
        startupId: companyB.id,
        role: 'ENGINEER',
        status: 'ACTIVE'
      }
    });

    console.log(`  Initialized Company A (${companyA.id}) and Company B (${companyB.id})\n`);

    // ----------------------------------------------------------------
    // SECTION 1: LLM Non-Terminal Status Invariant
    // ----------------------------------------------------------------
    console.log('--- 1. Testing LLM Response Non-Terminal Invariant ---');

    let llmCompletedRejected = false;
    try {
      assertNonTerminalLlmOutput('AutomatedAssistant', 'COMPLETED');
    } catch (err: any) {
      if (err instanceof TaskDelegationError && err.code === 'LLM_TERMINAL_STATUS_FORBIDDEN') {
        llmCompletedRejected = true;
      }
    }
    assert(llmCompletedRejected, 'Rejects automated LLM output attempting "COMPLETED" status transition');

    let llmApprovedRejected = false;
    try {
      assertNonTerminalLlmOutput('AutomatedAssistant', 'APPROVED');
    } catch (err: any) {
      if (err instanceof TaskDelegationError && err.code === 'LLM_TERMINAL_STATUS_FORBIDDEN') {
        llmApprovedRejected = true;
      }
    }
    assert(llmApprovedRejected, 'Rejects automated LLM output attempting "APPROVED" status transition');

    let llmSubmittedRejected = false;
    try {
      assertNonTerminalLlmOutput('AutomatedAssistant', 'SUBMITTED');
    } catch (err: any) {
      if (err instanceof TaskDelegationError && err.code === 'LLM_TERMINAL_STATUS_FORBIDDEN') {
        llmSubmittedRejected = true;
      }
    }
    assert(llmSubmittedRejected, 'Rejects automated LLM output attempting "SUBMITTED" status transition');

    let nonTerminalAllowed = true;
    try {
      assertNonTerminalLlmOutput('AutomatedAssistant', 'IN_PROGRESS');
      assertNonTerminalLlmOutput('AutomatedAssistant', 'PENDING');
      assertNonTerminalLlmOutput('AutomatedAssistant', undefined);
    } catch (err) {
      nonTerminalAllowed = false;
    }
    assert(nonTerminalAllowed, 'Allows non-terminal advisory LLM status guidance');

    // ----------------------------------------------------------------
    // SECTION 2: Seven Lifecycle Stages Separation
    // ----------------------------------------------------------------
    console.log('\n--- 2. Testing 7 Separated Lifecycle Stages ---');

    // Stage 1: Task Planning
    console.log('  [Stage 1: Task Planning]');
    const planningResult = await planParentTaskWithRecovery({
      userId: founderA.id,
      input: {
        title: 'Build SOC2 Compliance Logging Engine',
        description: 'Complete audit trailing, access controls, and encryption key rotation.',
        priority: 'HIGH'
      }
    });

    assert(planningResult.success === true, 'Stage 1 Task Planning succeeds with decomposed preview');
    assert(
      planningResult.currentStage === OrchestrationLifecycleStage.TASK_PLANNING,
      'Identifies current stage as TASK_PLANNING'
    );
    assert(
      Array.isArray(planningResult.preview?.proposedSubtasks) && planningResult.preview!.proposedSubtasks.length > 0,
      'Returns decomposed preview subtasks without committing them directly'
    );
    assert(!!planningResult.parentTaskId, 'Parent task preserved in DB during planning stage');

    // Stage 2: Assignment Validation (Validate membership & filter cross-company assignees)
    console.log('  [Stage 2: Assignment Validation]');
    const subtasksToPersist = [
      {
        title: 'Implement Immutable Audit Ledger',
        description: 'Write audit trail append service in PostgreSQL',
        department: 'ENGINEERING',
        agent: 'Architect',
        priority: 'HIGH',
        assignedUserId: employeeA1.id // Valid member of Company A
      },
      {
        title: 'Review Key Management Policies',
        description: 'Verify SOC2 KMS access compliance',
        department: 'OPERATIONS',
        agent: 'Operations',
        priority: 'HIGH',
        assignedUserId: employeeB1.id // INVALID: Foreign member of Company B!
      }
    ];

    // Stage 3 & 4: Assignment Persistence & Resilient Notification Creation
    console.log('  [Stage 3 & 4: Assignment Persistence & Notification Creation]');
    const persistenceResult = await persistAssignmentsWithResilientNotifications({
      userId: founderA.id,
      parentTask: {
        title: 'Build SOC2 Compliance Logging Engine',
        description: 'Core security infrastructure',
        priority: 'HIGH'
      },
      subtasks: subtasksToPersist
    });

    assert(persistenceResult.success === true, 'Stage 3 Persistence succeeds');
    assert(persistenceResult.tasks.length === 2, 'Two tasks persisted in database');

    const validAssignedTask = persistenceResult.tasks.find(t => t.assignedUserId === employeeA1.id);
    const sanitizedTask = persistenceResult.tasks.find(t => t.title.includes('Review Key Management Policies'));

    assert(!!validAssignedTask, 'Valid company member task successfully assigned to employeeA1');
    assert(
      sanitizedTask?.assignedUserId === null,
      'Stage 2 Assignment Validation prevented foreign user assignment (sanitized to role/unassigned)'
    );

    // Initial status check: Must be pending (ASSIGNED), NEVER auto-completed
    assert(
      validAssignedTask?.status === 'pending' || validAssignedTask?.canonicalStatus === 'ASSIGNED',
      'Persisted assignment is non-terminal (status: pending/ASSIGNED)'
    );

    // Verify Notification created for valid assigned user
    const employeeNotifications = await listNotificationsForUser(employeeA1.id);
    const assignmentNotification = employeeNotifications.find(n => n.taskId === validAssignedTask?.id);
    assert(!!assignmentNotification, 'Stage 4: Notification record created for employee assignment');

    // Stage 5: Employee Execution
    console.log('  [Stage 5: Employee Execution]');
    const taskId = validAssignedTask!.id;

    // Employee starts work
    const inProgressTask = await updateTaskForUser({
      userId: employeeA1.id,
      taskId,
      status: 'in_progress'
    });
    assert(inProgressTask.status === 'in_progress', 'Stage 5: Employee advances task to in_progress');

    // Stage 6: Submission
    console.log('  [Stage 6: Submission]');
    const submissionDeliverable = 'Completed immutable audit log service with SHA-256 hash chaining.';
    const submittedTask = await updateTaskForUser({
      userId: employeeA1.id,
      taskId,
      status: 'submitted',
      submissionNotes: submissionDeliverable
    });

    assert(submittedTask.status === 'submitted', 'Stage 6: Employee submits deliverables');
    assert(
      submittedTask.result?.includes('[TASK_SUBMISSION]:'),
      'Submission notes securely recorded in task deliverable payload'
    );

    // Stage 7: Human Review
    console.log('  [Stage 7: Human Review]');

    // 7a. Employee self-approval must be rejected
    let selfApprovalBlocked = false;
    try {
      await updateTaskForUser({
        userId: employeeA1.id,
        taskId,
        status: 'completed'
      });
    } catch (err: any) {
      if (err instanceof TaskDelegationError && (err.code === 'SELF_APPROVAL_FORBIDDEN' || err.status === 403)) {
        selfApprovalBlocked = true;
      }
    }
    assert(selfApprovalBlocked, 'Stage 7: Employee self-approval strictly rejected');

    // 7b. Founder conducts human review and approves
    const approvedTask = await updateTaskForUser({
      userId: founderA.id,
      taskId,
      status: 'completed'
    });
    assert(
      approvedTask.canonicalStatus === 'COMPLETED' || approvedTask.status === 'approved',
      'Stage 7: Founder completes human review and marks task completed'
    );

    // ----------------------------------------------------------------
    // SECTION 3: Recoverable Agent Planning Failure (Parent Task Preservation)
    // ----------------------------------------------------------------
    console.log('\n--- 3. Testing Recoverable Agent Planning Failure ---');

    const failingPlanResult = await planParentTaskWithRecovery({
      userId: founderA.id,
      input: {
        title: 'Complex Multi-Cloud Disaster Recovery Automation',
        description: 'Failover mechanisms for database replicas and DNS failover.',
        priority: 'URGENT'
      },
      simulateFailure: true
    });

    assert(failingPlanResult.success === false, 'Detects simulated agent planning failure');
    assert(failingPlanResult.recovery?.recoverable === true, 'Marks failure as recoverable');
    assert(failingPlanResult.recovery?.suggestedAction === 'RETRY_PLANNING', 'Suggests RETRY_PLANNING action');
    assert(!!failingPlanResult.parentTaskId, 'Parent task ID is returned in error context');

    // Verify parent task is PRESERVED in database
    const preservedParent = await prisma.task.findUnique({
      where: { id: failingPlanResult.parentTaskId }
    });
    assert(!!preservedParent, 'Parent task is preserved in Neon Postgres DB despite planning failure');
    assert(
      preservedParent?.status === 'pending',
      'Preserved parent task remains pending in the backlog'
    );
    assert(
      preservedParent?.result?.includes('"planningStatus":"FAILED"'),
      'Preserved task records "planningStatus":"FAILED" in metadata'
    );
    assert(
      preservedParent?.result?.includes('[PLANNING_ERROR]:'),
      'Preserved task records planning error details in result'
    );

    // ----------------------------------------------------------------
    // SECTION 4: Recovery & Retry of Preserved Parent Task
    // ----------------------------------------------------------------
    console.log('\n--- 4. Testing Retry of Preserved Parent Task Planning ---');

    const retryResult = await retryTaskPlanning(founderA.id, failingPlanResult.parentTaskId);
    assert(retryResult.success === true, 'Retry planning successfully generates decomposition');
    assert(retryResult.parentTaskId === failingPlanResult.parentTaskId, 'Retains original parent task ID');

    const updatedPreservedParent = await prisma.task.findUnique({
      where: { id: failingPlanResult.parentTaskId }
    });
    assert(
      updatedPreservedParent?.result?.includes('"planningStatus":"PLANNED"'),
      'Metadata updated to "planningStatus":"PLANNED" after successful retry'
    );

    // ----------------------------------------------------------------
    // SECTION 5: Notification Failure Resilience (No Assignment Loss)
    // ----------------------------------------------------------------
    console.log('\n--- 5. Testing Assignment Persistence Resilient to Notification Delivery Failure ---');

    const resilientResult = await persistAssignmentsWithResilientNotifications({
      userId: founderA.id,
      parentTask: {
        title: 'Emergency Hotfix Rollout',
        description: 'Deploy patch to resolve edge routing latency'
      },
      subtasks: [
        {
          title: 'Deploy Edge Proxy Filter',
          description: 'Apply envoy config update to region us-east',
          assignedUserId: employeeA1.id,
          priority: 'URGENT'
        }
      ],
      simulateNotificationFailure: true // Simulate SMTP network timeout
    });

    assert(resilientResult.success === true, 'Persistence succeeds even when notification delivery fails');
    assert(resilientResult.notificationSummary.failed === 1, 'Records 1 failed notification delivery');
    assert(resilientResult.tasks.length === 1, 'Assignment was NOT rolled back or lost');

    const resilientTaskId = resilientResult.tasks[0].id;
    const taskInDb = await prisma.task.findUnique({
      where: { id: resilientTaskId }
    });

    assert(!!taskInDb, 'Task is safely persisted in Neon Postgres database');
    assert(
      taskInDb?.result?.includes('"notificationDelivery":{"status":"FAILED"'),
      'Task metadata notes notification delivery failure for subsequent retry'
    );

    // ----------------------------------------------------------------
    // SECTION 6: Retrying Failed Notification Delivery
    // ----------------------------------------------------------------
    console.log('\n--- 6. Testing Retrying Failed Notification ---');

    const notifRetryResult = await retryTaskNotification(founderA.id, resilientTaskId);
    assert(notifRetryResult.success === true, 'Notification retry returns success');

    const retriedTaskInDb = await prisma.task.findUnique({
      where: { id: resilientTaskId }
    });
    assert(
      retriedTaskInDb?.result?.includes('"notificationDelivery":{"status":"SENT"'),
      'Task metadata updated to "notificationDelivery":{"status":"SENT"}'
    );

    const updatedNotifications = await listNotificationsForUser(employeeA1.id);
    const deliveredNotif = updatedNotifications.find(n => n.taskId === resilientTaskId);
    assert(!!deliveredNotif, 'Notification is now safely received by assignee');

    // ----------------------------------------------------------------
    // SECTION 7: Manual Assignment Fallback for Preserved Parent Task
    // ----------------------------------------------------------------
    console.log('\n--- 7. Testing Manual Assignment Fallback for Preserved Task ---');

    // If AI decomposition is not desired, founder can manually assign the preserved parent task
    const manualAssignResult = await assignTaskForUser({
      userId: founderA.id,
      taskId: failingPlanResult.parentTaskId,
      assigneeId: employeeA1.id
    });

    assert(
      manualAssignResult.assignedUserId === employeeA1.id,
      'Founder successfully falls back to manual assignment on preserved parent task'
    );

    const claimedTask = await updateTaskForUser({
      userId: employeeA1.id,
      taskId: failingPlanResult.parentTaskId,
      status: 'in_progress'
    });

    assert(
      claimedTask.status === 'in_progress',
      'Assigned employee can immediately execute manually assigned preserved task'
    );

  } catch (error: any) {
    console.error('💥 UNEXPECTED EXCEPTION DURING VERIFICATION:', error);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n================================================================');
  console.log(`📊 PHASE 9 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase9Tests();
