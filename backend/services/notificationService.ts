/**
 * Phase 4 — Task Notification Service.
 *
 * Implements persistent in-app notifications and email alerts for:
 *   - New task assignments
 *   - Assignment changes
 *   - Deadline reminders
 *   - Founder review requests (deliverable submission)
 *   - Requested revisions
 *   - Task approvals & completions
 *
 * Guarantees:
 *   - Zero schema drift: stores task ID, target recipient, and dedup key inside
 *     structured envelopes in Notification.message.
 *   - Idempotency & retry-safety: duplicate notifications are prevented via dedup keys.
 *   - Transactional creation when a transaction client is supplied.
 *   - Multi-tenant and role-scoped notification filtering for employees and founders.
 *   - Server-side email delivery via invitationMailer without exposing secrets.
 */

import { prisma, safeDbQuery } from './dbService';
import { resolveMembership } from './membershipService';
import {
  sendTaskAssignmentEmail,
  sendTaskReviewRequestEmail,
  sendTaskRevisionRequestedEmail,
  sendTaskApprovedEmail,
  sendDeadlineReminderEmail
} from './invitationMailer';

export interface ParsedNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
  startupId: string;
  taskId?: string | null;
  targetUserId?: string | null;
}

export interface CreateNotificationParams {
  startupId: string;
  title: string;
  message: string;
  type: string;
  taskId?: string | null;
  targetUserId?: string | null;
  dedupKey?: string | null;
  tx?: any;
}

/**
 * Parses embedded metadata tags [TASK_ID:...], [TARGET:...], [DEDUP:...]
 * from a notification message and returns the clean text and parsed fields.
 */
export function parseNotificationMessage(rawMessage: string): {
  cleanMessage: string;
  taskId: string | null;
  targetUserId: string | null;
  dedupKey: string | null;
} {
  let message = rawMessage || '';
  let taskId: string | null = null;
  let targetUserId: string | null = null;
  let dedupKey: string | null = null;

  const taskMatch = message.match(/\[TASK_ID:([^\]]+)\]/);
  if (taskMatch) {
    taskId = taskMatch[1].trim();
    message = message.replace(taskMatch[0], '');
  }

  const targetMatch = message.match(/\[TARGET:([^\]]+)\]/);
  if (targetMatch) {
    targetUserId = targetMatch[1].trim();
    message = message.replace(targetMatch[0], '');
  }

  const dedupMatch = message.match(/\[DEDUP:([^\]]+)\]/);
  if (dedupMatch) {
    dedupKey = dedupMatch[1].trim();
    message = message.replace(dedupMatch[0], '');
  }

  return {
    cleanMessage: message.trim(),
    taskId,
    targetUserId,
    dedupKey
  };
}

/**
 * Formats a message with embedded metadata tags.
 */
export function formatNotificationMessage(params: {
  message: string;
  taskId?: string | null;
  targetUserId?: string | null;
  dedupKey?: string | null;
}): string {
  const parts: string[] = [];
  if (params.taskId) parts.push(`[TASK_ID:${params.taskId}]`);
  if (params.targetUserId) parts.push(`[TARGET:${params.targetUserId}]`);
  if (params.dedupKey) parts.push(`[DEDUP:${params.dedupKey}]`);
  parts.push(params.message.trim());
  return parts.join(' ');
}

/**
 * Creates a persistent notification with deduplication to prevent duplicates on retries.
 */
export async function createNotification(params: CreateNotificationParams): Promise<any> {
  const db = params.tx || prisma;
  if (!db) {
    console.warn('[notificationService] Database unavailable for notification creation');
    return null;
  }

  const dedupKey = params.dedupKey || null;

  // Prevent duplicate notifications during retries
  if (dedupKey) {
    try {
      const existing = await safeDbQuery(() =>
        db.notification.findFirst({
          where: {
            startupId: params.startupId,
            message: { contains: `[DEDUP:${dedupKey}]` }
          }
        })
      );
      if (existing) {
        return existing;
      }
    } catch {}
  }

  const formattedMessage = formatNotificationMessage({
    message: params.message,
    taskId: params.taskId,
    targetUserId: params.targetUserId,
    dedupKey
  });

  try {
    return await safeDbQuery(() =>
      db.notification.create({
        data: {
          startupId: params.startupId,
          title: params.title,
          message: formattedMessage,
          type: params.type,
          read: false
        }
      })
    );
  } catch (err: any) {
    console.error('[notificationService] Failed to create notification:', err.message);
    return null;
  }
}

/**
 * Dispatches notification & email when a task is newly assigned to an employee.
 */
export async function notifyNewAssignment(params: {
  startupId: string;
  task: {
    id: string;
    title: string;
    priority?: string;
    deadline?: string;
    parentTask?: string;
    agent?: string;
  };
  assigneeUserId: string;
  assignerUserId?: string;
  tx?: any;
}): Promise<any> {
  const { startupId, task, assigneeUserId, assignerUserId, tx } = params;
  const dedupKey = `new_assign_${task.id}_${assigneeUserId}`;

  // Fetch company and user details for rich alert and email
  const [startup, assigneeUser, assignerUser] = await Promise.all([
    safeDbQuery(() => prisma.startup.findUnique({ where: { id: startupId }, select: { name: true } })),
    safeDbQuery(() => prisma.user.findUnique({ where: { id: assigneeUserId }, select: { name: true, email: true } })),
    assignerUserId
      ? safeDbQuery(() => prisma.user.findUnique({ where: { id: assignerUserId }, select: { name: true } }))
      : Promise.resolve(null)
  ]);

  const companyName = startup?.name || 'CatalystOS Venture';
  const employeeName = assigneeUser?.name || assigneeUser?.email || 'Team Member';
  const assignerName = assignerUser?.name || 'The Founder';
  const priority = task.priority || 'HIGH';
  const cleanTitle = task.title.replace(/^\[.*?\]\s*/, '');

  // 1. Create In-App Persistent Notification
  const notif = await createNotification({
    startupId,
    title: `Task Assigned: ${cleanTitle}`,
    message: `You were assigned "${cleanTitle}" (Priority: ${priority}) by ${assignerName}.${task.deadline ? ` Due: ${task.deadline}.` : ''} AI specialist companion ${task.agent || 'assistant'} is ready in your workspace.`,
    type: 'TASK_ASSIGNED',
    taskId: task.id,
    targetUserId: assigneeUserId,
    dedupKey,
    tx
  });

  // 2. Dispatch Email Asynchronously without blocking
  if (assigneeUser?.email) {
    sendTaskAssignmentEmail({
      to: assigneeUser.email,
      employeeName,
      taskTitle: cleanTitle,
      companyName,
      priority,
      deadline: task.deadline,
      parentTask: task.parentTask,
      agentName: task.agent
    }).catch(err => console.warn('[notificationService] Email dispatch note:', err?.message));
  }

  return notif;
}

/**
 * Dispatches notification & email when a task's assignment is modified or reassigned.
 */
export async function notifyAssignmentChange(params: {
  startupId: string;
  task: {
    id: string;
    title: string;
    priority?: string;
    deadline?: string;
  };
  previousAssigneeId?: string | null;
  newAssigneeId?: string | null;
  changedByUserId: string;
  tx?: any;
}): Promise<any> {
  const { startupId, task, previousAssigneeId, newAssigneeId, changedByUserId, tx } = params;
  const cleanTitle = task.title.replace(/^\[.*?\]\s*/, '');

  // If newly assigned, delegate to notifyNewAssignment
  if (!previousAssigneeId && newAssigneeId) {
    return notifyNewAssignment({
      startupId,
      task,
      assigneeUserId: newAssigneeId,
      assignerUserId: changedByUserId,
      tx
    });
  }

  const [startup, changedByUser, newAssigneeUser, prevAssigneeUser] = await Promise.all([
    safeDbQuery(() => prisma.startup.findUnique({ where: { id: startupId }, select: { name: true } })),
    safeDbQuery(() => prisma.user.findUnique({ where: { id: changedByUserId }, select: { name: true } })),
    newAssigneeId
      ? safeDbQuery(() => prisma.user.findUnique({ where: { id: newAssigneeId }, select: { name: true, email: true } }))
      : Promise.resolve(null),
    previousAssigneeId
      ? safeDbQuery(() => prisma.user.findUnique({ where: { id: previousAssigneeId }, select: { name: true } }))
      : Promise.resolve(null)
  ]);

  const companyName = startup?.name || 'CatalystOS Venture';
  const changedByName = changedByUser?.name || 'Founder';
  const newAssigneeName = newAssigneeUser?.name || newAssigneeUser?.email || 'Unassigned';

  // Notify new assignee
  if (newAssigneeId && newAssigneeId !== previousAssigneeId) {
    const dedupKey = `reassign_${task.id}_${newAssigneeId}_${Date.now()}`;
    await createNotification({
      startupId,
      title: `Assignment Updated: ${cleanTitle}`,
      message: `Task "${cleanTitle}" was reassigned to you by ${changedByName}. Priority: ${task.priority || 'HIGH'}.`,
      type: 'TASK_REASSIGNED',
      taskId: task.id,
      targetUserId: newAssigneeId,
      dedupKey,
      tx
    });

    if (newAssigneeUser?.email) {
      sendTaskAssignmentEmail({
        to: newAssigneeUser.email,
        employeeName: newAssigneeName,
        taskTitle: cleanTitle,
        companyName,
        priority: task.priority || 'HIGH',
        deadline: task.deadline
      }).catch(err => console.warn('[notificationService] Email dispatch note:', err?.message));
    }
  }

  // Notify previous assignee that work was reassigned
  if (previousAssigneeId && previousAssigneeId !== newAssigneeId) {
    const dedupKey = `unassign_${task.id}_${previousAssigneeId}_${Date.now()}`;
    await createNotification({
      startupId,
      title: `Assignment Transferred: ${cleanTitle}`,
      message: `Task "${cleanTitle}" was transferred to ${newAssigneeName} by ${changedByName}.`,
      type: 'TASK_REASSIGNED',
      taskId: task.id,
      targetUserId: previousAssigneeId,
      dedupKey,
      tx
    });
  }

  return true;
}

/**
 * Dispatches notification & email when an employee submits deliverable work for Founder Review.
 */
export async function notifyReviewRequest(params: {
  startupId: string;
  task: {
    id: string;
    title: string;
    department?: string;
  };
  employeeUserId: string;
  summary?: string;
  tx?: any;
}): Promise<any> {
  const { startupId, task, employeeUserId, summary, tx } = params;
  const dedupKey = `review_req_${task.id}_${Date.now()}`;
  const cleanTitle = task.title.replace(/^\[.*?\]\s*/, '');

  const [startup, employeeUser] = await Promise.all([
    safeDbQuery(() =>
      prisma.startup.findUnique({
        where: { id: startupId },
        select: { name: true, ownerId: true, owner: { select: { name: true, email: true } } }
      })
    ),
    safeDbQuery(() =>
      prisma.user.findUnique({
        where: { id: employeeUserId },
        select: { name: true, email: true }
      })
    )
  ]);

  const companyName = startup?.name || 'CatalystOS Venture';
  const employeeName = employeeUser?.name || employeeUser?.email || 'Team Member';
  const founderName = startup?.owner?.name || 'Founder';

  // 1. In-App Notification (Targeted to FOUNDER / ADMIN)
  const notif = await createNotification({
    startupId,
    title: `Review Requested: ${cleanTitle}`,
    message: `${employeeName} submitted deliverable work for "${cleanTitle}". Review and authorize operational execution.`,
    type: 'REVIEW_REQUESTED',
    taskId: task.id,
    targetUserId: 'FOUNDER',
    dedupKey,
    tx
  });

  // 2. Email Founder
  if (startup?.owner?.email) {
    sendTaskReviewRequestEmail({
      to: startup.owner.email,
      founderName,
      employeeName,
      taskTitle: cleanTitle,
      companyName,
      summary
    }).catch(err => console.warn('[notificationService] Email dispatch note:', err?.message));
  }

  return notif;
}

/**
 * Dispatches notification & email when the founder requests revisions on a submitted deliverable.
 */
export async function notifyRevisionRequested(params: {
  startupId: string;
  task: {
    id: string;
    title: string;
    assignedUserId?: string | null;
  };
  feedback: string;
  founderUserId: string;
  tx?: any;
}): Promise<any> {
  const { startupId, task, feedback, founderUserId, tx } = params;
  const dedupKey = `revision_req_${task.id}_${Date.now()}`;
  const cleanTitle = task.title.replace(/^\[.*?\]\s*/, '');

  const [startup, assigneeUser] = await Promise.all([
    safeDbQuery(() => prisma.startup.findUnique({ where: { id: startupId }, select: { name: true } })),
    task.assignedUserId
      ? safeDbQuery(() => prisma.user.findUnique({ where: { id: task.assignedUserId! }, select: { name: true, email: true } }))
      : Promise.resolve(null)
  ]);

  const companyName = startup?.name || 'CatalystOS Venture';
  const employeeName = assigneeUser?.name || assigneeUser?.email || 'Team Member';

  // 1. In-App Notification
  const notif = await createNotification({
    startupId,
    title: `Revisions Requested: ${cleanTitle}`,
    message: `Founder feedback: "${feedback}". Please update your deliverable artifacts and resubmit for approval.`,
    type: 'REVISION_REQUESTED',
    taskId: task.id,
    targetUserId: task.assignedUserId || null,
    dedupKey,
    tx
  });

  // 2. Email Employee
  if (assigneeUser?.email) {
    sendTaskRevisionRequestedEmail({
      to: assigneeUser.email,
      employeeName,
      taskTitle: cleanTitle,
      companyName,
      feedback
    }).catch(err => console.warn('[notificationService] Email dispatch note:', err?.message));
  }

  return notif;
}

/**
 * Dispatches notification & email when the founder approves a submitted deliverable.
 */
export async function notifyTaskApproval(params: {
  startupId: string;
  task: {
    id: string;
    title: string;
    assignedUserId?: string | null;
  };
  founderUserId: string;
  tx?: any;
}): Promise<any> {
  const { startupId, task, founderUserId, tx } = params;
  const dedupKey = `approval_${task.id}_${Date.now()}`;
  const cleanTitle = task.title.replace(/^\[.*?\]\s*/, '');

  const [startup, assigneeUser] = await Promise.all([
    safeDbQuery(() => prisma.startup.findUnique({ where: { id: startupId }, select: { name: true } })),
    task.assignedUserId
      ? safeDbQuery(() => prisma.user.findUnique({ where: { id: task.assignedUserId! }, select: { name: true, email: true } }))
      : Promise.resolve(null)
  ]);

  const companyName = startup?.name || 'CatalystOS Venture';
  const employeeName = assigneeUser?.name || assigneeUser?.email || 'Team Member';

  // 1. In-App Notification
  const notif = await createNotification({
    startupId,
    title: `Task Approved: ${cleanTitle}`,
    message: `Great job! Your deliverable for "${cleanTitle}" was reviewed and approved by the founder.`,
    type: 'TASK_APPROVED',
    taskId: task.id,
    targetUserId: task.assignedUserId || null,
    dedupKey,
    tx
  });

  // 2. Email Employee
  if (assigneeUser?.email) {
    sendTaskApprovedEmail({
      to: assigneeUser.email,
      employeeName,
      taskTitle: cleanTitle,
      companyName
    }).catch(err => console.warn('[notificationService] Email dispatch note:', err?.message));
  }

  return notif;
}

/**
 * Scans active tasks and dispatches deadline reminders for deliverables due within 48 hours.
 * Deduplicates per task per day.
 */
export async function checkAndDispatchDeadlineReminders(startupId?: string): Promise<{ remindedCount: number }> {
  if (!prisma) return { remindedCount: 0 };

  const todayStr = new Date().toISOString().split('T')[0];
  const now = Date.now();
  const fortyEightHoursMs = 48 * 60 * 60 * 1000;

  try {
    const whereClause: any = {
      status: { in: ['pending', 'in_progress'] }
    };
    if (startupId) {
      whereClause.plan = { startupId };
    }

    const tasks: any[] = await safeDbQuery(() =>
      (prisma as any).task.findMany({
        where: whereClause,
        include: {
          plan: { select: { startupId: true, title: true } }
        }
      })
    ) || [];

    let remindedCount = 0;

    for (const task of tasks) {
      // Decode metadata to get deadline and assigned user
      const rawAssigned = (task.assignedTo || '').trim();
      const colonIdx = rawAssigned.indexOf(':');
      const assignedUserId = colonIdx !== -1 ? rawAssigned.slice(colonIdx + 1) : null;

      let deadline: string | null = null;
      if (task.result && task.result.includes('[TASK_META]:')) {
        try {
          const match = task.result.match(/\[TASK_META\]:\s*(\{.*?\})/);
          if (match) {
            const meta = JSON.parse(match[1]);
            deadline = meta.deadline || meta.dueDate || null;
          }
        } catch {}
      }

      if (!deadline || !assignedUserId) continue;

      const dueTime = new Date(deadline).getTime();
      const timeLeft = dueTime - now;

      // Check if due within next 48 hours and not expired past 24 hours
      if (timeLeft > -24 * 3600 * 1000 && timeLeft <= fortyEightHoursMs) {
        const cleanTitle = task.title.replace(/^\[.*?\]\s*/, '');
        const taskStartupId = task.plan?.startupId;
        if (!taskStartupId) continue;

        const dedupKey = `deadline_${task.id}_${todayStr}`;

        // Check if already reminded today
        const existing = await safeDbQuery(() =>
          prisma.notification.findFirst({
            where: {
              startupId: taskStartupId,
              message: { contains: `[DEDUP:${dedupKey}]` }
            }
          })
        );

        if (!existing) {
          const [startup, user] = await Promise.all([
            safeDbQuery(() => prisma.startup.findUnique({ where: { id: taskStartupId }, select: { name: true } })),
            safeDbQuery(() => prisma.user.findUnique({ where: { id: assignedUserId }, select: { name: true, email: true } }))
          ]);

          await createNotification({
            startupId: taskStartupId,
            title: `Deadline Approaching: ${cleanTitle}`,
            message: `Task "${cleanTitle}" is approaching its target deadline (${deadline}). Please update progress or submit deliverable.`,
            type: 'DEADLINE_REMINDER',
            taskId: task.id,
            targetUserId: assignedUserId,
            dedupKey
          });

          if (user?.email) {
            sendDeadlineReminderEmail({
              to: user.email,
              employeeName: user.name || user.email,
              taskTitle: cleanTitle,
              companyName: startup?.name || 'CatalystOS Venture',
              deadline
            }).catch(err => console.warn('[notificationService] Deadline email note:', err?.message));
          }

          remindedCount++;
        }
      }
    }

    return { remindedCount };
  } catch (err: any) {
    console.warn('[notificationService] Deadline check warning:', err.message);
    return { remindedCount: 0 };
  }
}

/**
 * Retrieves notifications visible to the authenticated user within their company workspace.
 * Resolves both membership and owner relationships, filtering by audience.
 */
export async function listNotificationsForUser(userId: string): Promise<ParsedNotification[]> {
  if (!prisma) return [];

  // 1. Resolve caller membership & company
  const membership = await resolveMembership(userId);
  let startupId = membership?.startupId;

  // Fallback to startup owned if no membership
  if (!startupId) {
    const owned = await safeDbQuery(() => prisma.startup.findFirst({ where: { ownerId: userId } }));
    startupId = owned?.id;
  }

  if (!startupId) return [];

  const role = membership?.role || 'FOUNDER';
  const isPrivileged = role === 'FOUNDER' || role === 'ADMIN';

  // 2. Fetch recent notifications for this company
  const rawNotifs: any[] = await safeDbQuery(() =>
    prisma.notification.findMany({
      where: { startupId },
      orderBy: { createdAt: 'desc' },
      take: 60
    })
  ) || [];

  // 3. Filter notifications by recipient targeting
  const parsedList: ParsedNotification[] = [];

  for (const n of rawNotifs) {
    const parsed = parseNotificationMessage(n.message);

    // Visibility rules:
    // - If targeted to specific userId, only that user (or founder/admin) can view it.
    // - If targeted to 'FOUNDER', only founder/admin can view it.
    // - If no target or target 'ALL', everyone in the company can view it.
    let isVisible = false;
    if (isPrivileged) {
      isVisible = true; // Founders/Admins have full operational visibility
    } else if (!parsed.targetUserId || parsed.targetUserId === 'ALL') {
      isVisible = true;
    } else if (parsed.targetUserId === userId) {
      isVisible = true;
    } else if (parsed.targetUserId === role) {
      isVisible = true;
    }

    if (isVisible) {
      parsedList.push({
        id: n.id,
        title: n.title,
        message: parsed.cleanMessage,
        type: n.type,
        read: n.read,
        createdAt: n.createdAt.toISOString ? n.createdAt.toISOString() : String(n.createdAt),
        startupId: n.startupId,
        taskId: parsed.taskId,
        targetUserId: parsed.targetUserId
      });
    }
  }

  return parsedList;
}

/**
 * Marks a notification as read.
 */
export async function markNotificationRead(notificationId: string): Promise<boolean> {
  if (!prisma) return false;
  try {
    await safeDbQuery(() =>
      prisma.notification.update({
        where: { id: notificationId },
        data: { read: true }
      })
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Marks all notifications visible to a user as read.
 */
export async function markAllNotificationsRead(userId: string): Promise<number> {
  if (!prisma) return 0;
  const membership = await resolveMembership(userId);
  let startupId = membership?.startupId;
  if (!startupId) {
    const owned = await safeDbQuery(() => prisma.startup.findFirst({ where: { ownerId: userId } }));
    startupId = owned?.id;
  }
  if (!startupId) return 0;

  try {
    const updated = await safeDbQuery(() =>
      prisma.notification.updateMany({
        where: { startupId, read: false },
        data: { read: true }
      })
    );
    return updated?.count || 0;
  } catch {
    return 0;
  }
}
