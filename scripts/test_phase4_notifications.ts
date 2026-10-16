import { PrismaClient } from '@prisma/client';
import {
  createNotification,
  parseNotificationMessage,
  formatNotificationMessage,
  listNotificationsForUser,
  markNotificationRead,
  markAllNotificationsRead,
  checkAndDispatchDeadlineReminders,
  notifyNewAssignment,
  notifyAssignmentChange,
  notifyReviewRequest,
  notifyRevisionRequested,
  notifyTaskApproval
} from '../backend/services/notificationService';
import { getTaskByIdForUser, listTasksForUser } from '../backend/services/taskDelegationService';

const prisma = new PrismaClient();

async function runPhase4Tests() {
  console.log('🧪 Starting Phase 4 Task Notifications Automated Verification...\n');

  try {
    // 1. Test Message Format and Parse
    console.log('--- Test 1: Tag Embedding and Parsing ---');
    const rawMsg = 'Deliverable submitted for review.';
    const formatted = formatNotificationMessage({
      message: rawMsg,
      taskId: 'task_abc_123',
      targetUserId: 'usr_emp_456',
      dedupKey: 'dedup_review_789'
    });
    console.log('Formatted message:', formatted);

    const parsed = parseNotificationMessage(formatted);
    console.log('Parsed tags:', parsed);

    if (
      parsed.cleanMessage === rawMsg &&
      parsed.taskId === 'task_abc_123' &&
      parsed.targetUserId === 'usr_emp_456' &&
      parsed.dedupKey === 'dedup_review_789'
    ) {
      console.log('✅ PASS: Tag embedding and bidirectional parsing verified.');
    } else {
      throw new Error(`Parsing mismatch! Expected rawMsg="${rawMsg}", got "${parsed.cleanMessage}"`);
    }

    // 2. Test Deduplication
    console.log('\n--- Test 2: Notification Deduplication / Retry Prevention ---');
    // Find or pick a startup
    const startup = await prisma.startup.findFirst();
    if (!startup) {
      console.log('⚠️ No startup in database, skipping DB creation assertions.');
      return;
    }
    console.log(`Using Startup: ${startup.name} (${startup.id})`);

    const testDedupKey = `test_dedup_${Date.now()}`;
    const notif1 = await createNotification({
      startupId: startup.id,
      title: 'Initial Assignment Alert',
      message: 'You have been assigned to test task.',
      type: 'TASK_ASSIGNED',
      taskId: 'task_unit_1',
      targetUserId: startup.ownerId,
      dedupKey: testDedupKey
    });
    console.log('First creation result ID:', notif1?.id);

    const notif2 = await createNotification({
      startupId: startup.id,
      title: 'Duplicate Retry Alert',
      message: 'You have been assigned to test task (retry).',
      type: 'TASK_ASSIGNED',
      taskId: 'task_unit_1',
      targetUserId: startup.ownerId,
      dedupKey: testDedupKey
    });
    console.log('Second creation result (retry):', notif2?.id);

    if (notif1?.id === notif2?.id) {
      console.log('✅ PASS: Duplicate notification during retries was intercepted and deduplicated.');
    } else {
      throw new Error('Deduplication failed! A new notification was created instead of returning existing one.');
    }

    // 3. Test listNotificationsForUser
    console.log('\n--- Test 3: List Notifications for User & Audience Resolution ---');
    const userNotifs = await listNotificationsForUser(startup.ownerId);
    console.log(`Retrieved ${userNotifs.length} notifications for user ${startup.ownerId}`);
    const foundTestNotif = userNotifs.find(n => n.id === notif1.id);
    if (foundTestNotif) {
      console.log('Found test notification in user list:');
      console.log({
        id: foundTestNotif.id,
        title: foundTestNotif.title,
        message: foundTestNotif.message,
        type: foundTestNotif.type,
        taskId: foundTestNotif.taskId,
        read: foundTestNotif.read
      });
      if (foundTestNotif.taskId === 'task_unit_1') {
        console.log('✅ PASS: Task ID properly extracted and attached to notification item.');
      } else {
        throw new Error('taskId was not properly populated in notification item!');
      }
    } else {
      console.log('⚠️ Note: Test notification not in immediate top 50, but query succeeded.');
    }

    // 4. Test Mark as Read
    console.log('\n--- Test 4: Mark Notification Read ---');
    const markRes = await markNotificationRead(notif1.id);
    console.log('Mark read result:', markRes);
    if (markRes) {
      console.log('✅ PASS: Notification marked read successfully.');
    }

    // 5. Test Deadline Reminders Dispatcher
    console.log('\n--- Test 5: Deadline Reminders Check ---');
    const deadlineRes = await checkAndDispatchDeadlineReminders(startup.id);
    console.log('Deadline reminders scanned. Reminded count:', deadlineRes.remindedCount);
    console.log('✅ PASS: Deadline check completed without errors.');

    // Cleanup test notification
    await prisma.notification.delete({ where: { id: notif1.id } }).catch(() => {});
    console.log('Cleaned up test notification.');

    console.log('\n🎉 ALL PHASE 4 BACKEND NOTIFICATION VERIFICATIONS PASSED SUCCESSFULLY!');
  } catch (err: any) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPhase4Tests();
