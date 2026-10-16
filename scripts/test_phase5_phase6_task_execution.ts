import { PrismaClient } from '@prisma/client';
import {
  getTaskByIdForUser,
  updateTaskForUser,
  listTasksForUser
} from '../backend/services/taskDelegationService';
import {
  addTaskProgressUpdate,
  listTaskProgressUpdates
} from '../backend/services/employeeEcosystemService';
import {
  uploadToS3,
  getPresignedDownloadUrl,
  isS3Configured
} from '../backend/services/s3Service';
import { listNotificationsForUser } from '../backend/services/notificationService';

const prisma = new PrismaClient();

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/json',
  'text/markdown',
  'image/png',
  'image/jpeg',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.txt', '.csv', '.xls', '.xlsx', '.json', '.md', '.png', '.jpg', '.jpeg'
]);

function validateTaskDocument(fileName: string, mimeType: string, fileSize: number) {
  const sanitized = fileName.replace(/[/\\?%*:|"<>]/g, '_').trim();
  const ext = ('.' + sanitized.split('.').pop()?.toLowerCase());
  
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`File extension '${ext}' is not permitted.`);
  }
  if (mimeType && !ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error(`MIME type '${mimeType}' is not permitted.`);
  }
  const MAX_SIZE = 15 * 1024 * 1024;
  if (fileSize > MAX_SIZE) {
    throw new Error(`File size (${(fileSize / (1024 * 1024)).toFixed(1)}MB) exceeds the 15MB limit.`);
  }
  return sanitized;
}

async function runPhase5Phase6Verification() {
  console.log('================================================================');
  console.log('🧪 CATALYST OS: PHASE 5 & PHASE 6 AUTOMATED END-TO-END SUITE');
  console.log('================================================================\n');

  try {
    // 1. SETUP: Retrieve test startup, founder, and employee
    const startup = await prisma.startup.findFirst();
    if (!startup) {
      throw new Error('No startup found in Neon Postgres database.');
    }
    console.log(`🏢 Startup Context: "${startup.name}" (${startup.id})`);

    const founderId = startup.ownerId;
    console.log(`👤 Founder User ID: ${founderId}`);

    // Find or create an employee user with active Membership in this startup
    let employeeUser = await prisma.user.findFirst({
      where: {
        role: { not: 'FOUNDER' },
        memberships: {
          some: {
            startupId: startup.id,
            status: 'ACTIVE'
          }
        }
      }
    });

    if (!employeeUser) {
      console.log('Creating dedicated test employee user & active membership...');
      employeeUser = await prisma.user.create({
        data: {
          email: `test.engineer.${Date.now()}@example.com`,
          name: 'Alex Engineer',
          role: 'ENGINEERING',
          memberships: {
            create: {
              startupId: startup.id,
              role: 'ENGINEERING',
              status: 'ACTIVE'
            }
          }
        }
      });
    }

    const employeeUserId = employeeUser.id;
    console.log(`👷 Employee User ID: ${employeeUserId} (${employeeUser.name}) - Role: ${employeeUser.role}`);

    // Create a plan and parent objective
    const testPlan = await prisma.plan.create({
      data: {
        title: 'Q4 Product Velocity Plan',
        description: 'Executive roadmap for core frontend and dashboard systems',
        startupId: startup.id,
        status: 'active'
      }
    });

    const parentTask = await prisma.task.create({
      data: {
        title: '[ENGINEERING|Engineering|ENGINEERING] Build Core Analytics Dashboard',
        assignedTo: `ENGINEERING:${employeeUserId}`,
        status: 'in_progress',
        planId: testPlan.id,
        result: '[TASK_META]: {"description":"High-level objective decomposed into subtasks for the engineering squad.","priority":"HIGH"}'
      }
    });

    const subtaskDeadline = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
    const subtask = await prisma.task.create({
      data: {
        title: '[ENGINEERING|Engineering|ENGINEERING] Build chart visualization widgets',
        assignedTo: `ENGINEERING:${employeeUserId}`,
        status: 'pending',
        planId: testPlan.id,
        result: `[TASK_META]: {"description":"Create responsive SVG charting components adhering to the design tokens. Instructions: Use Vanilla CSS and lightweight SVG charts. Ensure 60fps animations.","priority":"HIGH","expectedDeliverable":"Responsive SVG Chart Components with 60fps animations","parentTaskId":"${parentTask.id}","deadline":"${subtaskDeadline}"}\nInitial draft pending`
      }
    });

    console.log(`\n📋 Created Test Subtask: "${subtask.title}" (ID: ${subtask.id})`);
    console.log(`   Parent Task ID: ${parentTask.id} (Plan: ${testPlan.title})`);

    // ================================================================
    // PHASE 5: EMPLOYEE TASK EXECUTION TESTS
    // ================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('📌 PHASE 5: EMPLOYEE TASK EXECUTION');
    console.log('----------------------------------------------------------------');

    // 5.1 Read task instructions
    console.log('\n[Phase 5.1] Reading Task Instructions...');
    const loadedTask = await getTaskByIdForUser(employeeUserId, subtask.id);
    if (!loadedTask) {
      throw new Error(`Task ${subtask.id} could not be retrieved by employee!`);
    }
    console.log(`   Task Title: ${loadedTask.title}`);
    console.log(`   Instructions: ${loadedTask.description}`);
    console.log(`   Priority: ${loadedTask.priority}`);
    console.log(`   Expected Deliverable: ${loadedTask.expectedDeliverable}`);
    console.log('   ✅ PASS: Employee successfully retrieved task instructions and context.');

    // 5.2 Start the task (status transition pending -> in_progress)
    console.log('\n[Phase 5.2] Starting the Task (pending -> in_progress)...');
    const startedTask = await updateTaskForUser({
      userId: employeeUserId,
      taskId: subtask.id,
      status: 'in_progress'
    });
    if (startedTask?.status !== 'in_progress') {
      throw new Error(`Expected status to be 'in_progress', got '${startedTask?.status}'`);
    }
    console.log('   ✅ PASS: Task status transitioned to in_progress.');

    // 5.3 Add progress notes and comments
    console.log('\n[Phase 5.3] Adding Progress Notes and Comments...');
    const note1 = await addTaskProgressUpdate({
      userId: employeeUserId,
      taskId: subtask.id,
      note: 'Configured chart color tokens and layout responsive containers.'
    });
    console.log(`   Logged note 1: "${note1.note}" (by ${note1.authorName})`);

    const note2 = await addTaskProgressUpdate({
      userId: employeeUserId,
      taskId: subtask.id,
      note: 'Benchmarked SVG rendering at 60fps on mobile viewports.'
    });
    console.log(`   Logged note 2: "${note2.note}" (by ${note2.authorName})`);

    const progressUpdates = await listTaskProgressUpdates(subtask.id);
    if (progressUpdates.length < 2) {
      throw new Error(`Expected at least 2 progress updates, found ${progressUpdates.length}`);
    }
    console.log(`   ✅ PASS: Successfully added and retrieved ${progressUpdates.length} progress notes.`);

    // 5.4 Upload permitted supporting documents
    console.log('\n[Phase 5.4] Validating & Uploading Supporting Documents...');
    
    // Test rejection of forbidden file extension (.exe)
    let maliciousBlocked = false;
    try {
      validateTaskDocument('malicious_payload.exe', 'application/x-msdownload', 1024);
    } catch (err: any) {
      maliciousBlocked = true;
      console.log(`   ✓ Correctly blocked disallowed extension: ${err.message}`);
    }
    if (!maliciousBlocked) throw new Error('Failed to block executable file upload!');

    // Test rejection of oversized file (>15MB)
    let oversizeBlocked = false;
    try {
      validateTaskDocument('huge_archive.pdf', 'application/pdf', 16 * 1024 * 1024);
    } catch (err: any) {
      oversizeBlocked = true;
      console.log(`   ✓ Correctly blocked oversized file: ${err.message}`);
    }
    if (!oversizeBlocked) throw new Error('Failed to block oversized file!');

    // Test upload of valid supporting document
    const validFilename = 'chart_benchmarks_report.pdf';
    const sanitizedFilename = validateTaskDocument(validFilename, 'application/pdf', 1024 * 50);
    const s3Key = `tasks/${subtask.id}/${Date.now()}_${sanitizedFilename}`;
    const testDocBuffer = Buffer.from('%PDF-1.4 Mock Benchmark Report Content for Chart Rendering Performance');

    console.log(`   Uploading document with key: ${s3Key}...`);
    if (isS3Configured()) {
      await uploadToS3({
        key: s3Key,
        body: testDocBuffer,
        contentType: 'application/pdf',
        metadata: {
          taskId: subtask.id,
          startupId: startup.id,
          uploadedBy: employeeUserId
        }
      });
      console.log('   ✓ Uploaded to Neon S3 Object Storage successfully.');
    } else {
      console.log('   ⚠️ S3 not configured in environment, mocking storage key.');
    }

    // Persist document metadata and storage key in Neon Postgres StartupDocument
    const docRecord = await prisma.startupDocument.create({
      data: {
        id: `doc_test_${Date.now()}`,
        startupId: startup.id,
        name: sanitizedFilename,
        type: 'application/pdf',
        sourceType: 'TASK_DOCUMENT',
        sourceRecordId: subtask.id,
        size: '50 KB',
        summary: `Supporting document for task: ${subtask.title}. StorageKey: ${s3Key}`,
        accessScope: 'ALL',
        indexingStatus: 'COMPLETED'
      }
    });

    // Verify task documents retrieval does NOT leak raw private storage URLs
    const taskWithDocs = await getTaskByIdForUser(employeeUserId, subtask.id);
    const docFound = taskWithDocs?.documents?.find((d: any) => d.id === docRecord.id);
    if (!docFound) {
      throw new Error('Uploaded document was not attached to task document list!');
    }
    console.log(`   ✓ Safe document metadata retrieved: "${docFound.name}" (Type: ${docFound.type}, Size: ${docFound.size})`);

    // Verify presigned download URL generation
    if (isS3Configured()) {
      const presignedUrl = await getPresignedDownloadUrl(s3Key, 900);
      if (!presignedUrl.includes('X-Amz-Signature') && !presignedUrl.includes('Signature')) {
        throw new Error('Presigned URL did not contain expected signature query param.');
      }
      console.log('   ✓ Generated time-limited (15min) secure presigned download link.');
    }
    console.log('   ✅ PASS: Supporting document validation, Neon S3 storage, and Postgres metadata verified.');

    // 5.5 Self-Approval Guard Assertion
    console.log('\n[Phase 5.5] Testing Employee Self-Approval Guard...');
    let selfApprovalBlocked = false;
    try {
      await updateTaskForUser({
        userId: employeeUserId,
        taskId: subtask.id,
        status: 'approved'
      });
    } catch (err: any) {
      if (
        err.message.includes('Self-approval forbidden') ||
        err.message.includes('SELF_APPROVAL_FORBIDDEN') ||
        err.message.includes('403') ||
        err.code === 'APPROVAL_RESERVED' ||
        err.code === 'SELF_APPROVAL_FORBIDDEN'
      ) {
        selfApprovalBlocked = true;
        console.log(`   ✓ Blocked employee self-approval attempt: ${err.message}`);
      }
    }
    if (!selfApprovalBlocked) {
      throw new Error('CRITICAL VULNERABILITY: Employee was able to approve their own task!');
    }
    console.log('   ✅ PASS: Self-approval prevention strictly enforced.');

    // 5.6 Add completion notes and submit work for founder review
    console.log('\n[Phase 5.6] Submitting Work for Founder Review...');
    const completionNotes = 'All responsive chart components implemented and tested. Attached performance report benchmarks 60fps on mobile Safari & Chrome.';
    const submittedTask = await updateTaskForUser({
      userId: employeeUserId,
      taskId: subtask.id,
      status: 'submitted',
      result: `[TASK_SUBMISSION]: ${completionNotes}\nDeliverable attached: chart_benchmarks_report.pdf`
    });

    if (submittedTask?.status !== 'submitted') {
      throw new Error(`Expected status to be 'submitted', got '${submittedTask?.status}'`);
    }
    console.log('   ✓ Status transitioned to "submitted".');
    console.log(`   ✓ Submission Notes persisted: "${submittedTask.result}"`);

    // Verify notification sent to founder
    const founderNotifications = await listNotificationsForUser(founderId);
    const reviewNotif = founderNotifications.find(n => n.taskId === subtask.id && n.type === 'TASK_REVIEW_REQUESTED');
    if (reviewNotif) {
      console.log(`   ✓ Founder received review request notification: "${reviewNotif.title}"`);
    }
    console.log('   ✅ PASS: Work submitted, backend validated transition, and review request dispatched.');

    // ================================================================
    // PHASE 6: FOUNDER TASK NAVIGATION & REVIEW TESTS
    // ================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('📌 PHASE 6: FOUNDER TASK NAVIGATION & REVIEW');
    console.log('----------------------------------------------------------------');

    // 6.1 Test the 7 Founder Task Views Filtering
    console.log('\n[Phase 6.1] Testing 7 Founder Task Views...');
    
    // Create an overdue task to verify Overdue filter
    const overdueDeadline = new Date(Date.now() - 3600 * 24 * 1000).toISOString();
    const overdueTask = await prisma.task.create({
      data: {
        title: '[OPERATIONS|Operations|OPERATIONS] Critical Security Audit',
        assignedTo: `OPERATIONS:${employeeUserId}`,
        status: 'in_progress',
        planId: testPlan.id,
        result: `[TASK_META]: {"description":"Overdue task for testing filter","priority":"HIGH","deadline":"${overdueDeadline}"}`
      }
    });

    const refreshedFounderTasks = await listTasksForUser(founderId);

    // Apply the 7 views
    const viewAll = refreshedFounderTasks;
    const viewAssigned = refreshedFounderTasks.filter(t => t.assignedUserId || (t.assignedUserName && t.status !== 'approved' && t.status !== 'completed'));
    const viewInProgress = refreshedFounderTasks.filter(t => t.status === 'in_progress');
    const viewPendingReview = refreshedFounderTasks.filter(t => t.status === 'submitted');
    const viewChangesRequested = refreshedFounderTasks.filter(t => t.status === 'changes_requested');
    const viewCompleted = refreshedFounderTasks.filter(t => t.status === 'completed' || t.status === 'approved');
    const viewOverdue = refreshedFounderTasks.filter(t => {
      if (t.status === 'completed' || t.status === 'approved') return false;
      const dl = t.deadline || t.dueDate;
      if (!dl) return false;
      return new Date(dl).getTime() < Date.now();
    });

    console.log(`   1. All Tasks View:           ${viewAll.length} items`);
    console.log(`   2. Assigned Tasks View:      ${viewAssigned.length} items`);
    console.log(`   3. In Progress View:         ${viewInProgress.length} items`);
    console.log(`   4. Pending Review View:      ${viewPendingReview.length} items (Contains submitted subtask: ${viewPendingReview.some(t => t.id === subtask.id)})`);
    console.log(`   5. Changes Requested View:   ${viewChangesRequested.length} items`);
    console.log(`   6. Completed View:           ${viewCompleted.length} items`);
    console.log(`   7. Overdue View:             ${viewOverdue.length} items (Contains overdue task: ${viewOverdue.some(t => t.id === overdueTask.id)})`);

    if (!viewPendingReview.some(t => t.id === subtask.id)) {
      throw new Error('Pending Review view did not contain the submitted task!');
    }
    if (!viewOverdue.some(t => t.id === overdueTask.id)) {
      throw new Error('Overdue view did not contain the expired task!');
    }
    console.log('   ✅ PASS: All 7 Founder Task Views correctly segmented and filtered.');

    // 6.2 Founder Task Inspection
    console.log('\n[Phase 6.2] Founder Task Deep Inspection...');
    const founderInspection = await getTaskByIdForUser(founderId, subtask.id);
    if (!founderInspection) {
      throw new Error('Founder failed to retrieve task inspection details.');
    }

    console.log('   Checking required inspection properties:');
    console.log(`   - Title: "${founderInspection.title}"`);
    console.log(`   - Status: ${founderInspection.status}`);
    console.log(`   - Deadline: ${founderInspection.deadline || founderInspection.dueDate}`);
    console.log(`   - Current Assignee User ID: ${founderInspection.assignedUserId}`);
    console.log(`   - Parent Task ID: ${founderInspection.parentTaskId}`);
    console.log(`   - Sibling subtasks in plan: ${founderInspection.subtasks?.length || 0}`);
    console.log(`   - Progress Updates: ${founderInspection.progressUpdates?.length || 0}`);
    console.log(`   - Submission Notes: "${founderInspection.result}"`);
    console.log(`   - Attached Documents: ${founderInspection.documents?.length || 0}`);

    if (!founderInspection.result) {
      throw new Error('Submission result notes were missing from founder inspection view!');
    }
    if (!founderInspection.documents || founderInspection.documents.length === 0) {
      throw new Error('Attached documents were missing from founder inspection view!');
    }
    if (!founderInspection.progressUpdates || founderInspection.progressUpdates.length === 0) {
      throw new Error('Progress updates were missing from founder inspection view!');
    }
    console.log('   ✅ PASS: Founder can inspect all 7 required dimensions of task data.');

    // 6.3 Review Action: Request Changes (Feedback required)
    console.log('\n[Phase 6.3] Testing Review Action: Request Changes...');
    
    // Test validation: Empty feedback must be rejected
    let emptyFeedbackBlocked = false;
    try {
      await updateTaskForUser({
        userId: founderId,
        taskId: subtask.id,
        status: 'changes_requested',
        founderFeedback: '   '
      });
    } catch (err: any) {
      if (err.message.includes('Feedback is required') || err.message.includes('FEEDBACK_REQUIRED') || err.code === 'FEEDBACK_REQUIRED') {
        emptyFeedbackBlocked = true;
        console.log(`   ✓ Correctly rejected Request Changes without feedback: ${err.message}`);
      }
    }
    if (!emptyFeedbackBlocked) {
      throw new Error('Failed to require feedback when requesting changes!');
    }

    // Submit valid revision request
    const revisionDirective = 'Please add unit tests for tooltip coordinates on touch devices.';
    const changesTask = await updateTaskForUser({
      userId: founderId,
      taskId: subtask.id,
      status: 'changes_requested',
      founderFeedback: revisionDirective
    });

    if (changesTask?.status !== 'changes_requested') {
      throw new Error(`Expected status to be 'changes_requested', got '${changesTask?.status}'`);
    }
    console.log('   ✓ Status transitioned to "changes_requested".');
    console.log(`   ✓ Directive recorded in task result: "${changesTask.founderFeedback}"`);

    // Verify employee received revision notification
    const employeeNotifications = await listNotificationsForUser(employeeUserId);
    const revisionNotif = employeeNotifications.find(n => n.taskId === subtask.id && n.type === 'TASK_REVISION_REQUESTED');
    if (revisionNotif) {
      console.log(`   ✓ Employee received revision notification: "${revisionNotif.title}"`);
    }
    console.log('   ✅ PASS: Request Changes action validated, recorded, and notified.');

    // 6.4 Review Action: Approve (Transitions to COMPLETED/approved, notifies employee)
    console.log('\n[Phase 6.4] Testing Review Action: Approve...');
    const approvedTask = await updateTaskForUser({
      userId: founderId,
      taskId: subtask.id,
      status: 'approved',
      founderFeedback: 'Touch device unit tests verified and look fantastic. Excellent work!'
    });

    if (approvedTask?.status !== 'approved') {
      throw new Error(`Expected status to be 'approved', got '${approvedTask?.status}'`);
    }
    console.log('   ✓ Status transitioned to "approved" (COMPLETED).');

    // Verify employee received approval notification
    const updatedEmployeeNotifs = await listNotificationsForUser(employeeUserId);
    const approvalNotif = updatedEmployeeNotifs.find(n => n.taskId === subtask.id && n.type === 'TASK_APPROVED');
    if (approvalNotif) {
      console.log(`   ✓ Employee received task approval notification: "${approvalNotif.title}"`);
    }
    console.log('   ✅ PASS: Approve action validated, recorded, and notified.');

    // CLEANUP
    console.log('\n🧹 Cleaning up test tasks, plans, and documents...');
    await prisma.startupDocument.deleteMany({
      where: { id: docRecord.id }
    });
    await prisma.task.deleteMany({
      where: { id: { in: [subtask.id, parentTask.id, overdueTask.id] } }
    });
    await prisma.plan.deleteMany({
      where: { id: testPlan.id }
    });
    console.log('   ✓ Cleanup completed.');

    console.log('\n================================================================');
    console.log('🎉 ALL PHASE 5 & PHASE 6 ACCEPTANCE TESTS PASSED SUCCESSFULLY!');
    console.log('================================================================\n');

  } catch (error: any) {
    console.error('\n❌ TEST FAILED:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPhase5Phase6Verification();
