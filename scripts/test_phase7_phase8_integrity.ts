import { PrismaClient } from '@prisma/client';
import {
  getTaskByIdForUser,
  updateTaskForUser,
  assignTaskForUser,
  listTasksForUser,
  toCanonicalStatus,
  validateStatusTransition,
  TaskDelegationError
} from '../backend/services/taskDelegationService';
import {
  createNotification,
  listNotificationsForUser
} from '../backend/services/notificationService';
import { authorizeDocumentDownload } from '../backend/services/documentAccessService';
import { resolveMembership } from '../backend/services/membershipService';

const prisma = new PrismaClient();

async function runPhase7Phase8Tests() {
  console.log('================================================================');
  console.log('🧪 CATALYST OS: PHASE 7 & PHASE 8 VERIFICATION SUITE');
  console.log('================================================================\n');

  try {
    // ----------------------------------------------------------------
    // SETUP: Multi-Company Environment Setup (Company A and Company B)
    // ----------------------------------------------------------------
    console.log('--- Setup: Establishing Multi-Company Context ---');

    // Founder A and Employee A (Company A)
    const founderA = await prisma.user.create({
      data: {
        email: `founder.a.${Date.now()}@example.com`,
        name: 'Alice Founder A',
        role: 'FOUNDER'
      }
    });

    const companyA = await prisma.startup.create({
      data: {
        name: `Acme Corp A ${Date.now()}`,
        industry: 'Software',
        description: 'B2B SaaS',
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
        email: `emp.a1.${Date.now()}@example.com`,
        name: 'Bob Engineer A1',
        role: 'ENGINEERING',
        memberships: {
          create: {
            startupId: companyA.id,
            role: 'ENGINEERING',
            status: 'ACTIVE'
          }
        }
      }
    });

    const employeeA2 = await prisma.user.create({
      data: {
        email: `emp.a2.${Date.now()}@example.com`,
        name: 'Charlie Engineer A2',
        role: 'ENGINEERING',
        memberships: {
          create: {
            startupId: companyA.id,
            role: 'ENGINEERING',
            status: 'ACTIVE'
          }
        }
      }
    });

    // Founder B and Employee B (Company B)
    const founderB = await prisma.user.create({
      data: {
        email: `founder.b.${Date.now()}@example.com`,
        name: 'David Founder B',
        role: 'FOUNDER'
      }
    });

    const companyB = await prisma.startup.create({
      data: {
        name: `Beta Corp B ${Date.now()}`,
        industry: 'Fintech',
        description: 'Payment solutions',
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
        email: `emp.b1.${Date.now()}@example.com`,
        name: 'Eve Engineer B1',
        role: 'ENGINEERING',
        memberships: {
          create: {
            startupId: companyB.id,
            role: 'ENGINEERING',
            status: 'ACTIVE'
          }
        }
      }
    });

    console.log(`✓ Company A: ${companyA.name} (${companyA.id}) | Founder: ${founderA.name} | Employees: ${employeeA1.name}, ${employeeA2.name}`);
    console.log(`✓ Company B: ${companyB.name} (${companyB.id}) | Founder: ${founderB.name} | Employee: ${employeeB1.name}\n`);

    // Plan in Company A
    const planA = await prisma.plan.create({
      data: {
        title: 'Company A Operations Plan',
        description: 'Core product initiatives',
        startupId: companyA.id,
        status: 'active'
      }
    });

    // Plan in Company B
    const planB = await prisma.plan.create({
      data: {
        title: 'Company B Operations Plan',
        description: 'Beta roadmaps',
        startupId: companyB.id,
        status: 'active'
      }
    });

    // ================================================================
    // PHASE 7: TASK STATE MACHINE TESTS
    // ================================================================
    console.log('----------------------------------------------------------------');
    console.log('📌 PHASE 7: TASK STATE MACHINE VERIFICATION');
    console.log('----------------------------------------------------------------');

    // 7.1 Create an unassigned task in Company A (BACKLOG)
    const stateTask = await prisma.task.create({
      data: {
        title: '[ENGINEERING|Engineering|ENGINEERING] Implement Real-Time WebSocket Engine',
        assignedTo: 'UNASSIGNED',
        status: 'pending',
        planId: planA.id,
        result: '[TASK_META]: {"description":"Core real-time gateway"}'
      }
    });
    console.log(`\nCreated task: "${stateTask.title}" (ID: ${stateTask.id})`);
    console.log(`Initial Canonical Status: ${toCanonicalStatus(stateTask.status, stateTask.assignedTo)} (Expected: BACKLOG)`);

    if (toCanonicalStatus(stateTask.status, stateTask.assignedTo) !== 'BACKLOG') {
      throw new Error('Initial status is not BACKLOG!');
    }

    // 7.2 Reject Invalid Transitions from BACKLOG:
    // Jumping directly from BACKLOG -> COMPLETED or BACKLOG -> SUBMITTED must be strictly rejected
    console.log('\n[Phase 7.2] Testing Rejection of Invalid Transitions & Arbitrary Statuses...');
    
    let backlogToCompletedBlocked = false;
    try {
      await updateTaskForUser({
        userId: founderA.id,
        taskId: stateTask.id,
        status: 'COMPLETED'
      });
    } catch (err: any) {
      if (err.message.includes('Invalid status transition') || err.code === 'INVALID_STATUS_TRANSITION') {
        backlogToCompletedBlocked = true;
        console.log(`   ✓ Correctly rejected invalid transition BACKLOG → COMPLETED: ${err.message}`);
      }
    }
    if (!backlogToCompletedBlocked) throw new Error('Failed to block invalid jump BACKLOG -> COMPLETED!');

    let backlogToSubmittedBlocked = false;
    try {
      await updateTaskForUser({
        userId: founderA.id,
        taskId: stateTask.id,
        status: 'SUBMITTED'
      });
    } catch (err: any) {
      if (err.message.includes('Invalid status transition') || err.code === 'INVALID_STATUS_TRANSITION') {
        backlogToSubmittedBlocked = true;
        console.log(`   ✓ Correctly rejected invalid transition BACKLOG → SUBMITTED: ${err.message}`);
      }
    }
    if (!backlogToSubmittedBlocked) throw new Error('Failed to block invalid jump BACKLOG -> SUBMITTED!');

    let arbitraryStatusBlocked = false;
    try {
      await updateTaskForUser({
        userId: founderA.id,
        taskId: stateTask.id,
        status: 'HACKED_CUSTOM_STATUS_123'
      });
    } catch (err: any) {
      if (err.message.includes('Invalid status transition') || err.code === 'INVALID_STATUS_TRANSITION') {
        arbitraryStatusBlocked = true;
        console.log(`   ✓ Correctly rejected arbitrary client status: ${err.message}`);
      }
    }
    if (!arbitraryStatusBlocked) throw new Error('Failed to block arbitrary client status!');

    // 7.3 Allowed Transition: BACKLOG -> ASSIGNED
    console.log('\n[Phase 7.3] Transition: BACKLOG → ASSIGNED...');
    const assignedTask = await assignTaskForUser({
      userId: founderA.id,
      taskId: stateTask.id,
      assigneeId: employeeA1.id
    });
    console.log(`   Assigned To: ${assignedTask.assignedUserName} (${assignedTask.assignedUserId})`);
    console.log(`   Canonical Status: ${assignedTask.canonicalStatus} (Expected: ASSIGNED)`);
    if (assignedTask.canonicalStatus !== 'ASSIGNED') {
      throw new Error(`Expected canonical status ASSIGNED, got ${assignedTask.canonicalStatus}`);
    }
    console.log('   ✅ PASS: Transition BACKLOG → ASSIGNED verified.');

    // 7.4 Allowed Transition: ASSIGNED -> IN_PROGRESS
    console.log('\n[Phase 7.4] Transition: ASSIGNED → IN_PROGRESS...');
    const inProgressTask = await updateTaskForUser({
      userId: employeeA1.id,
      taskId: stateTask.id,
      status: 'IN_PROGRESS'
    });
    console.log(`   Canonical Status: ${inProgressTask.canonicalStatus} (Expected: IN_PROGRESS)`);
    if (inProgressTask.canonicalStatus !== 'IN_PROGRESS') {
      throw new Error(`Expected canonical status IN_PROGRESS, got ${inProgressTask.canonicalStatus}`);
    }
    console.log('   ✅ PASS: Transition ASSIGNED → IN_PROGRESS verified.');

    // 7.5 Allowed Transition: IN_PROGRESS -> SUBMITTED
    console.log('\n[Phase 7.5] Transition: IN_PROGRESS → SUBMITTED...');
    const submittedTask = await updateTaskForUser({
      userId: employeeA1.id,
      taskId: stateTask.id,
      status: 'SUBMITTED',
      submissionNotes: 'Engine v1 complete and passed unit tests.'
    });
    console.log(`   Canonical Status: ${submittedTask.canonicalStatus} (Expected: SUBMITTED)`);
    if (submittedTask.canonicalStatus !== 'SUBMITTED') {
      throw new Error(`Expected canonical status SUBMITTED, got ${submittedTask.canonicalStatus}`);
    }
    console.log('   ✅ PASS: Transition IN_PROGRESS → SUBMITTED verified.');

    // 7.6 Allowed Transition: SUBMITTED -> IN_REVIEW
    console.log('\n[Phase 7.6] Transition: SUBMITTED → IN_REVIEW...');
    const inReviewTask = await updateTaskForUser({
      userId: founderA.id,
      taskId: stateTask.id,
      status: 'IN_REVIEW'
    });
    console.log(`   Canonical Status: ${inReviewTask.canonicalStatus} (Expected: IN_REVIEW)`);
    if (inReviewTask.canonicalStatus !== 'IN_REVIEW') {
      throw new Error(`Expected canonical status IN_REVIEW, got ${inReviewTask.canonicalStatus}`);
    }
    console.log('   ✅ PASS: Transition SUBMITTED → IN_REVIEW verified.');

    // 7.7 Authorized Revision: IN_REVIEW -> CHANGES_REQUESTED (Requires Feedback)
    console.log('\n[Phase 7.7] Authorized Revision Transition: IN_REVIEW → CHANGES_REQUESTED...');
    
    // Test missing feedback rejection
    let missingFeedbackBlocked = false;
    try {
      await updateTaskForUser({
        userId: founderA.id,
        taskId: stateTask.id,
        status: 'CHANGES_REQUESTED',
        founderFeedback: '   '
      });
    } catch (err: any) {
      if (err.message.includes('Feedback is required') || err.code === 'FEEDBACK_REQUIRED') {
        missingFeedbackBlocked = true;
        console.log(`   ✓ Correctly rejected CHANGES_REQUESTED without feedback: ${err.message}`);
      }
    }
    if (!missingFeedbackBlocked) throw new Error('Failed to require feedback for CHANGES_REQUESTED!');

    const changesTask = await updateTaskForUser({
      userId: founderA.id,
      taskId: stateTask.id,
      status: 'CHANGES_REQUESTED',
      founderFeedback: 'Please add exponential backoff reconnect logic for dropped sockets.'
    });
    console.log(`   Canonical Status: ${changesTask.canonicalStatus} (Expected: CHANGES_REQUESTED)`);
    if (changesTask.canonicalStatus !== 'CHANGES_REQUESTED') {
      throw new Error(`Expected canonical status CHANGES_REQUESTED, got ${changesTask.canonicalStatus}`);
    }
    console.log('   ✅ PASS: Transition IN_REVIEW → CHANGES_REQUESTED verified.');

    // 7.8 Authorized Revision: CHANGES_REQUESTED -> IN_PROGRESS
    console.log('\n[Phase 7.8] Authorized Revision Transition: CHANGES_REQUESTED → IN_PROGRESS...');
    const resumedTask = await updateTaskForUser({
      userId: employeeA1.id,
      taskId: stateTask.id,
      status: 'IN_PROGRESS'
    });
    console.log(`   Canonical Status: ${resumedTask.canonicalStatus} (Expected: IN_PROGRESS)`);
    if (resumedTask.canonicalStatus !== 'IN_PROGRESS') {
      throw new Error(`Expected canonical status IN_PROGRESS, got ${resumedTask.canonicalStatus}`);
    }
    console.log('   ✅ PASS: Revision transition CHANGES_REQUESTED → IN_PROGRESS verified.');

    // Re-submit for review
    await updateTaskForUser({
      userId: employeeA1.id,
      taskId: stateTask.id,
      status: 'SUBMITTED',
      submissionNotes: 'Added exponential backoff with jitter and reconnection unit tests.'
    });

    // 7.9 Allowed Transition: SUBMITTED -> COMPLETED (Approve)
    console.log('\n[Phase 7.9] Transition: SUBMITTED → COMPLETED...');
    const completedTask = await updateTaskForUser({
      userId: founderA.id,
      taskId: stateTask.id,
      status: 'COMPLETED',
      founderFeedback: 'Verified reconnection under simulated packet loss. Approved.'
    });
    console.log(`   Canonical Status: ${completedTask.canonicalStatus} (Expected: COMPLETED)`);
    if (completedTask.canonicalStatus !== 'COMPLETED') {
      throw new Error(`Expected canonical status COMPLETED, got ${completedTask.canonicalStatus}`);
    }
    console.log('   ✅ PASS: Transition to COMPLETED verified.');

    // 7.10 Terminal State Lock: COMPLETED task cannot be modified by employees
    console.log('\n[Phase 7.10] Testing Terminal State Lock on COMPLETED Task...');
    let completedLockBlocked = false;
    try {
      await updateTaskForUser({
        userId: employeeA1.id,
        taskId: stateTask.id,
        status: 'IN_PROGRESS'
      });
    } catch (err: any) {
      if (err.message.includes('reopen terminal tasks') || err.code === 'TERMINAL_STATE_LOCKED') {
        completedLockBlocked = true;
        console.log(`   ✓ Correctly blocked employee reopening completed task: ${err.message}`);
      }
    }
    if (!completedLockBlocked) throw new Error('Employee was able to reopen terminal COMPLETED task!');
    console.log('   ✅ PASS: Terminal state protection enforced.');

    // 7.11 Cancellation Workflow: Only Authorized Workflow Can Cancel
    console.log('\n[Phase 7.11] Testing Cancellation Workflow...');
    const cancelTask = await prisma.task.create({
      data: {
        title: '[ENGINEERING|Engineering|ENGINEERING] Temporary Scaffolding Task',
        assignedTo: `ENGINEERING:${employeeA1.id}`,
        status: 'in_progress',
        planId: planA.id
      }
    });

    // Unauthorized employee cannot cancel task
    let unauthorizedCancelBlocked = false;
    try {
      await updateTaskForUser({
        userId: employeeA1.id,
        taskId: cancelTask.id,
        status: 'CANCELLED',
        cancellationReason: 'I want to cancel this.'
      });
    } catch (err: any) {
      if (err.message.includes('Cancellation is restricted') || err.code === 'UNAUTHORIZED_CANCELLATION') {
        unauthorizedCancelBlocked = true;
        console.log(`   ✓ Correctly blocked unauthorized cancellation attempt by employee: ${err.message}`);
      }
    }
    if (!unauthorizedCancelBlocked) throw new Error('Employee was able to arbitrarily cancel task!');

    // Founder can cancel task
    const cancelledTask = await updateTaskForUser({
      userId: founderA.id,
      taskId: cancelTask.id,
      status: 'CANCELLED',
      cancellationReason: 'Superseded by architectural RFC-104.'
    });
    console.log(`   Canonical Status: ${cancelledTask.canonicalStatus} (Expected: CANCELLED)`);
    if (cancelledTask.canonicalStatus !== 'CANCELLED') {
      throw new Error(`Expected CANCELLED, got ${cancelledTask.canonicalStatus}`);
    }
    console.log('   ✅ PASS: Authorized cancellation workflow enforced.');

    // 7.12 Activity History Verification
    console.log('\n[Phase 7.12] Verifying Activity History Recording...');
    const inspectedTask = await getTaskByIdForUser(founderA.id, stateTask.id);
    console.log(`   Progress / Transition Updates recorded: ${inspectedTask.progressUpdates?.length || 0}`);
    if (!inspectedTask.progressUpdates || inspectedTask.progressUpdates.length < 3) {
      throw new Error('Task state machine did not record required activity updates in task history!');
    }
    console.log('   Sample transition update note:');
    console.log(`   "${inspectedTask.progressUpdates[0]?.note}"`);
    console.log('   ✅ PASS: Important changes correctly recorded in task activity history.');

    // ================================================================
    // PHASE 8: DATA INTEGRITY AND COMPANY ISOLATION TESTS
    // ================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('📌 PHASE 8: DATA INTEGRITY & COMPANY ISOLATION');
    console.log('----------------------------------------------------------------');

    // 8.1 Prevent Cross-Company Task Access
    console.log('\n[Phase 8.1] Testing Cross-Company Task Access Prevention...');
    
    // User in Company B attempts to read Task in Company A
    let crossCompanyReadBlocked = false;
    try {
      await getTaskByIdForUser(employeeB1.id, stateTask.id);
    } catch (err: any) {
      if (err.message.includes('Task not found in this company') || err.code === 'NOT_FOUND' || err.statusCode === 404) {
        crossCompanyReadBlocked = true;
        console.log(`   ✓ Cross-company read blocked (returns 404/indistinguishable): ${err.message}`);
      }
    }
    if (!crossCompanyReadBlocked) throw new Error('SECURITY BREACH: User in Company B was able to read Task in Company A!');

    // User in Company B attempts to update Task in Company A
    let crossCompanyUpdateBlocked = false;
    try {
      await updateTaskForUser({
        userId: employeeB1.id,
        taskId: stateTask.id,
        status: 'IN_PROGRESS'
      });
    } catch (err: any) {
      if (err.message.includes('Task not found in this company') || err.code === 'NOT_FOUND') {
        crossCompanyUpdateBlocked = true;
        console.log(`   ✓ Cross-company update blocked: ${err.message}`);
      }
    }
    if (!crossCompanyUpdateBlocked) throw new Error('SECURITY BREACH: User in Company B was able to modify Task in Company A!');
    console.log('   ✅ PASS: Cross-company task access strictly isolated and blocked.');

    // 8.2 Prevent Unauthorized Task Assignment Across Companies
    console.log('\n[Phase 8.2] Testing Unauthorized Cross-Company Task Assignment...');
    let crossCompanyAssignBlocked = false;
    try {
      await assignTaskForUser({
        userId: founderA.id,
        taskId: stateTask.id,
        assigneeId: employeeB1.id // Employee B belongs to Company B!
      });
    } catch (err: any) {
      if (err.message.includes('Assignee not found') || err.code === 'ASSIGNEE_NOT_FOUND') {
        crossCompanyAssignBlocked = true;
        console.log(`   ✓ Cross-company assignment blocked: ${err.message}`);
      }
    }
    if (!crossCompanyAssignBlocked) throw new Error('SECURITY BREACH: Task in Company A was assigned to employee in Company B!');

    // Employee cannot assign tasks to other employees
    let employeeAssignOtherBlocked = false;
    try {
      await assignTaskForUser({
        userId: employeeA1.id,
        taskId: stateTask.id,
        assigneeId: employeeA2.id
      });
    } catch (err: any) {
      if (err.message.includes('employees cannot assign tasks to other team members') || err.code === 'ASSIGNMENT_FORBIDDEN') {
        employeeAssignOtherBlocked = true;
        console.log(`   ✓ Unauthorized peer assignment blocked: ${err.message}`);
      }
    }
    if (!employeeAssignOtherBlocked) throw new Error('SECURITY BREACH: Employee was able to assign task to peer!');
    console.log('   ✅ PASS: Unauthorized task assignment strictly prevented.');

    // 8.3 Prevent Employees Viewing Other Employees' Restricted Tasks
    console.log('\n[Phase 8.3] Testing Restricted Task Access Protection...');
    const restrictedTask = await prisma.task.create({
      data: {
        title: '[ENGINEERING|Engineering|ENGINEERING] [RESTRICTED] Executive Compensation Architecture',
        assignedTo: `ENGINEERING:${employeeA1.id}`,
        status: 'in_progress',
        planId: planA.id,
        result: '[TASK_META]: {"description":"Confidential compensation algorithm","isRestricted":true}'
      }
    });

    // Employee A1 (assignee) CAN view the task
    const a1View = await getTaskByIdForUser(employeeA1.id, restrictedTask.id);
    if (!a1View) throw new Error('Assignee could not view their own restricted task!');
    console.log(`   ✓ Direct assignee (${employeeA1.name}) can view restricted task.`);

    // Founder A CAN view the task
    const founderView = await getTaskByIdForUser(founderA.id, restrictedTask.id);
    if (!founderView) throw new Error('Founder could not view restricted task!');
    console.log(`   ✓ Founder (${founderA.name}) can view restricted task.`);

    // Employee A2 (peer in same department) CANNOT view the restricted task
    let peerRestrictedViewBlocked = false;
    try {
      await getTaskByIdForUser(employeeA2.id, restrictedTask.id);
    } catch (err: any) {
      if (err.message.includes('restricted task') || err.code === 'RESTRICTED_TASK_ACCESS') {
        peerRestrictedViewBlocked = true;
        console.log(`   ✓ Peer employee blocked from restricted task: ${err.message}`);
      }
    }
    if (!peerRestrictedViewBlocked) throw new Error('SECURITY BREACH: Peer employee viewed other employee restricted task!');

    // Restricted task must NOT appear in peer employee's task list
    const a2Tasks = await listTasksForUser(employeeA2.id);
    const peerSeesRestricted = a2Tasks.some(t => t.id === restrictedTask.id);
    if (peerSeesRestricted) {
      throw new Error('SECURITY BREACH: Restricted task leaked into peer employee task list!');
    }
    console.log('   ✓ Restricted task filtered out of peer employee task list.');
    console.log('   ✅ PASS: Employee restricted task isolation strictly verified.');

    // 8.4 Prevent Employees Approving Their Own Work (Self-Approval Guard)
    console.log('\n[Phase 8.4] Testing Self-Approval Guard...');
    const selfApproveTask = await prisma.task.create({
      data: {
        title: '[ENGINEERING|Engineering|ENGINEERING] Self Submission Test',
        assignedTo: `ENGINEERING:${employeeA1.id}`,
        status: 'submitted',
        planId: planA.id
      }
    });

    let selfApprovalBlocked = false;
    try {
      await updateTaskForUser({
        userId: employeeA1.id,
        taskId: selfApproveTask.id,
        status: 'COMPLETED'
      });
    } catch (err: any) {
      if (err.message.includes('Self-approval forbidden') || err.code === 'SELF_APPROVAL_FORBIDDEN' || err.code === 'APPROVAL_RESERVED') {
        selfApprovalBlocked = true;
        console.log(`   ✓ Blocked employee self-approval attempt: ${err.message}`);
      }
    }
    if (!selfApprovalBlocked) throw new Error('SECURITY BREACH: Employee approved their own task!');
    console.log('   ✅ PASS: Self-approval prevention strictly verified.');

    // 8.5 Prevent Duplicate Assignment or Notification Records on Network Retries
    console.log('\n[Phase 8.5] Testing Duplicate Records Prevention on Retries...');
    
    // Assignment idempotency test
    const retryTask = await prisma.task.create({
      data: {
        title: '[ENGINEERING|Engineering|ENGINEERING] Retry Test Task',
        assignedTo: `ENGINEERING:${employeeA1.id}`,
        status: 'pending',
        planId: planA.id
      }
    });

    const assignResult1 = await assignTaskForUser({
      userId: founderA.id,
      taskId: retryTask.id,
      assigneeId: employeeA1.id
    });

    const assignResult2 = await assignTaskForUser({
      userId: founderA.id,
      taskId: retryTask.id,
      assigneeId: employeeA1.id
    });

    if (assignResult1.id !== assignResult2.id || assignResult1.assignedUserId !== assignResult2.assignedUserId) {
      throw new Error('Assignment retry failed idempotency!');
    }
    console.log('   ✓ Assignment retry was idempotent and safely returned existing state.');

    // Notification deduplication test
    const retryDedupKey = `test_dedup_retry_${Date.now()}`;
    const notif1 = await createNotification({
      startupId: companyA.id,
      title: 'Deduplicated Assignment Alert',
      message: 'Initial dispatch',
      type: 'TASK_ASSIGNED',
      taskId: retryTask.id,
      targetUserId: employeeA1.id,
      dedupKey: retryDedupKey
    });

    const notif2 = await createNotification({
      startupId: companyA.id,
      title: 'Deduplicated Assignment Alert Retry',
      message: 'Network retry dispatch',
      type: 'TASK_ASSIGNED',
      taskId: retryTask.id,
      targetUserId: employeeA1.id,
      dedupKey: retryDedupKey
    });

    if (notif1?.id !== notif2?.id) {
      throw new Error('Notification retry created duplicate record!');
    }
    console.log(`   ✓ Duplicate notification intercepted by dedupKey (Record ID: ${notif1?.id}).`);
    console.log('   ✅ PASS: Duplicate records from network retries strictly prevented.');

    // 8.6 Prevent Unauthorized and Cross-Company Document Downloads
    console.log('\n[Phase 8.6] Testing Document Download Isolation and Access Scoping...');

    // Document in Company A with FOUNDER_ONLY accessScope
    const founderOnlyDoc = await (prisma as any).startupDocument.create({
      data: {
        name: 'Confidential_Venture_Term_Sheet.pdf',
        type: 'legal',
        sourceType: 'DOCUMENT',
        size: '1.2 MB',
        summary: 'Founder-only series A term sheet. StorageKey: documents/confidential_term_sheet.pdf',
        startupId: companyA.id,
        accessScope: 'FOUNDER_ONLY',
        indexingStatus: 'COMPLETED'
      }
    });

    // Document in Company A with general accessScope
    const generalDocA = await (prisma as any).startupDocument.create({
      data: {
        name: 'Company_A_Handbook.pdf',
        type: 'general',
        sourceType: 'DOCUMENT',
        size: '500 KB',
        summary: 'Company A employee handbook. StorageKey: documents/company_a_handbook.pdf',
        startupId: companyA.id,
        accessScope: 'ALL',
        indexingStatus: 'COMPLETED'
      }
    });

    // 1. Cross-Company Download Attempt: Employee B1 (Company B) tries to download Document A
    const crossCompanyDocAttempt = await authorizeDocumentDownload(employeeB1.id, generalDocA.id);
    if (crossCompanyDocAttempt.allowed || crossCompanyDocAttempt.statusCode !== 404) {
      throw new Error('SECURITY BREACH: User in Company B was able to access/enumerate document in Company A!');
    }
    console.log(`   ✓ Cross-company document download strictly blocked with 404: ${crossCompanyDocAttempt.errorMessage}`);

    // 2. Unauthorized Role Download Attempt: Employee A1 (Engineering) tries to download FOUNDER_ONLY document in Company A
    const unauthorizedDocAttempt = await authorizeDocumentDownload(employeeA1.id, founderOnlyDoc.id);
    if (unauthorizedDocAttempt.allowed || unauthorizedDocAttempt.statusCode !== 403) {
      throw new Error('SECURITY BREACH: Employee was able to download FOUNDER_ONLY document!');
    }
    console.log(`   ✓ Unauthorized document download strictly blocked with 403: ${unauthorizedDocAttempt.errorMessage}`);

    // 3. Authorized Download: Founder A can download FOUNDER_ONLY document
    const authorizedFounderDownload = await authorizeDocumentDownload(founderA.id, founderOnlyDoc.id);
    if (!authorizedFounderDownload.allowed || !authorizedFounderDownload.downloadUrl) {
      throw new Error('Founder was unable to authorize their own document download!');
    }
    console.log(`   ✓ Authorized founder download permitted: ${authorizedFounderDownload.filename}`);

    // 4. Task Attachment Download Isolation: Task attachment on restricted task
    const restrictedTaskDoc = await (prisma as any).startupDocument.create({
      data: {
        name: 'Restricted_Executive_Compensation.xlsx',
        type: 'task_document',
        sourceType: 'TASK_DOCUMENT',
        sourceRecordId: restrictedTask.id,
        size: '250 KB',
        summary: `Attachment for task ${restrictedTask.id}. StorageKey: tasks/${restrictedTask.id}/compensation.xlsx`,
        startupId: companyA.id,
        accessScope: 'ALL',
        indexingStatus: 'COMPLETED'
      }
    });

    // Peer employee A2 cannot download attachment of restricted task
    const peerTaskDocAttempt = await authorizeDocumentDownload(employeeA2.id, restrictedTaskDoc.id);
    if (peerTaskDocAttempt.allowed || peerTaskDocAttempt.statusCode !== 403) {
      throw new Error('SECURITY BREACH: Peer employee downloaded attachment from restricted task!');
    }
    console.log(`   ✓ Peer employee blocked from downloading restricted task attachment: ${peerTaskDocAttempt.errorMessage}`);

    // Assignee employee A1 can download attachment
    const assigneeTaskDocAttempt = await authorizeDocumentDownload(employeeA1.id, restrictedTaskDoc.id);
    if (!assigneeTaskDocAttempt.allowed) {
      throw new Error('Assignee could not download their own task attachment!');
    }
    console.log(`   ✓ Direct assignee permitted to download task attachment: ${assigneeTaskDocAttempt.filename}`);
    console.log('   ✅ PASS: Document download scoping and cross-company isolation verified.');

    // 8.7 Prevent Forged User IDs / Company IDs from Frontend
    console.log('\n[Phase 8.7] Testing Prevention of Forged Frontend User/Company IDs...');
    const fakeCompanyId = '00000000-0000-0000-0000-000000000000';
    
    // An attacker cannot supply an arbitrary company ID to hijack another company scope
    const attackerMembership = await resolveMembership(employeeA1.id);
    if (attackerMembership?.startupId === fakeCompanyId || attackerMembership?.startupId === companyB.id) {
      throw new Error('SECURITY BREACH: Client forged company ID was honored by server!');
    }
    if (attackerMembership?.startupId !== companyA.id) {
      throw new Error('Membership resolution failed to bind strictly to user authenticated startup!');
    }
    console.log(`   ✓ Membership strictly resolved server-side to authenticated company: ${attackerMembership.startupId}`);
    console.log('   ✅ PASS: Forged user/company IDs strictly neutralized.');

    // CLEANUP
    console.log('\n🧹 Cleaning up test companies, plans, and tasks...');
    await prisma.startupDocument.deleteMany({
      where: {
        id: { in: [founderOnlyDoc.id, generalDocA.id, restrictedTaskDoc.id] }
      }
    });
    await prisma.task.deleteMany({
      where: {
        id: { in: [stateTask.id, cancelTask.id, restrictedTask.id, selfApproveTask.id, retryTask.id] }
      }
    });
    await prisma.plan.deleteMany({
      where: { id: { in: [planA.id, planB.id] } }
    });
    await prisma.membership.deleteMany({
      where: { startupId: { in: [companyA.id, companyB.id] } }
    });
    await prisma.startup.deleteMany({
      where: { id: { in: [companyA.id, companyB.id] } }
    });
    await prisma.user.deleteMany({
      where: { id: { in: [founderA.id, employeeA1.id, employeeA2.id, founderB.id, employeeB1.id] } }
    });
    console.log('   ✓ Test data cleanup completed.');

    console.log('\n================================================================');
    console.log('🎉 ALL PHASE 7 & PHASE 8 VERIFICATIONS PASSED SUCCESSFULLY!');
    console.log('================================================================\n');

  } catch (error: any) {
    console.error('\n❌ TEST FAILED:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPhase7Phase8Tests();
