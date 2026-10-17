import { prisma, safeDbQuery } from './dbService';
import { resolveMembership } from './membershipService';
import { normalizeRole } from './permissionService';
import {
  decomposeParentTask,
  persistDecomposedTaskPlan,
  decodeTask,
  agentForDepartment,
  ownerRoleForDepartment,
  enrichTasksWithUserNames,
  TaskDelegationError,
  DecomposeTaskInput,
  TaskDecompositionPreview,
  DelegatedTask,
  Department
} from './taskDelegationService';
import { notifyNewAssignment } from './notificationService';

const encodeTitle = (dept: string, agent: string, role: string | null, title: string) =>
  `[${dept}|${agent}|${role || dept}] ${title}`;

export enum OrchestrationLifecycleStage {
  TASK_PLANNING = 'TASK_PLANNING',
  ASSIGNMENT_VALIDATION = 'ASSIGNMENT_VALIDATION',
  ASSIGNMENT_PERSISTENCE = 'ASSIGNMENT_PERSISTENCE',
  NOTIFICATION_CREATION = 'NOTIFICATION_CREATION',
  EMPLOYEE_EXECUTION = 'EMPLOYEE_EXECUTION',
  SUBMISSION = 'SUBMISSION',
  HUMAN_REVIEW = 'HUMAN_REVIEW'
}

export interface PlanningRecoveryContext {
  recoverable: boolean;
  parentTaskId: string;
  parentTitle: string;
  errorMessage: string;
  errorCode: string;
  suggestedAction: 'RETRY_PLANNING' | 'ASSIGN_MANUALLY';
}

export interface ReliableDecompositionResult {
  success: boolean;
  currentStage: OrchestrationLifecycleStage;
  parentTaskId: string;
  preview?: TaskDecompositionPreview;
  recovery?: PlanningRecoveryContext;
}

export interface ResilientPersistenceResult {
  success: boolean;
  currentStage: OrchestrationLifecycleStage;
  plan: any;
  tasks: DelegatedTask[];
  notificationSummary: {
    total: number;
    dispatched: number;
    failed: number;
  };
}

/**
 * PHASE 9 — Guard against treating LLM responses as completed assignments.
 * Ensures automated agent responses never auto-complete assignments or bypass human execution.
 */
export function assertNonTerminalLlmOutput(actionName: string, proposedStatus?: string): void {
  if (!proposedStatus) return;
  const canonical = proposedStatus.toUpperCase();
  if (canonical === 'COMPLETED' || canonical === 'APPROVED' || canonical === 'SUBMITTED') {
    throw new TaskDelegationError(
      400,
      `Unsafe automated status transition: LLM responses cannot auto-complete or submit assignments. Only human employees can submit deliverables, and only authorized founders/admins can approve them.`,
      'LLM_TERMINAL_STATUS_FORBIDDEN'
    );
  }
}

/**
 * PHASE 9 — Recoverable Task Planning.
 * Separates Task Planning from Persistence.
 * If the agent or AI planner produces an invalid plan (or fails during decomposition),
 * the parent task is preserved in the database so the founder can retry AI decomposition
 * or assign work manually without losing context.
 */
export async function planParentTaskWithRecovery(params: {
  userId: string;
  input: DecomposeTaskInput;
  parentTaskId?: string;
  simulateFailure?: boolean;
}): Promise<ReliableDecompositionResult> {
  const { userId, input, parentTaskId, simulateFailure } = params;
  if (!prisma) {
    throw new TaskDelegationError(503, 'Database is unavailable.', 'DB_UNAVAILABLE');
  }

  // 1. Validate membership and role
  const membership = await resolveMembership(userId);
  if (!membership) {
    throw new TaskDelegationError(403, 'No active company membership.', 'NO_ACTIVE_MEMBERSHIP');
  }
  const isPrivileged = membership.role === 'FOUNDER' || membership.role === 'ADMIN';
  if (!isPrivileged) {
    throw new TaskDelegationError(403, 'Only founders or admins can initiate task planning.', 'FOUNDER_REQUIRED');
  }

  const cleanTitle = (input.title || '').trim();
  if (!cleanTitle && !parentTaskId) {
    throw new TaskDelegationError(400, 'Task title is required.', 'TITLE_REQUIRED');
  }

  // 2. Resolve or create preserved parent task in DB
  let preservedParentTask: any = null;

  if (parentTaskId) {
    preservedParentTask = await safeDbQuery(async () => {
      return await (prisma as any).task.findFirst({
        where: {
          id: parentTaskId,
          plan: { startupId: membership.startupId }
        },
        include: { plan: true }
      });
    });
    if (!preservedParentTask) {
      throw new TaskDelegationError(404, 'Parent task not found in this company.', 'NOT_FOUND');
    }
  } else {
    // Preserve new parent task immediately in the company's active plan
    let activePlan: any = await safeDbQuery(async () => {
      return await (prisma as any).plan.findFirst({
        where: { startupId: membership.startupId, status: 'active' },
        orderBy: { createdAt: 'desc' }
      });
    });

    if (!activePlan) {
      activePlan = await safeDbQuery(async () => {
        return await (prisma as any).plan.create({
          data: {
            title: 'Company Operations Plan',
            description: 'Core venture operational backlog',
            status: 'active',
            startupId: membership.startupId
          }
        });
      });
    }

    const priority = input.priority || 'HIGH';
    const deadline = input.deadline || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const encodedTitle = `[OPERATIONS|Operations|OPERATIONS] ${cleanTitle}`;
    const initialMeta = {
      description: input.description || `Strategic initiative: ${cleanTitle}`,
      priority,
      deadline,
      planningStatus: 'IN_PROGRESS',
      isParentInitiative: true
    };

    preservedParentTask = await safeDbQuery(async () => {
      return await (prisma as any).task.create({
        data: {
          title: encodedTitle,
          assignedTo: 'UNASSIGNED',
          status: 'pending',
          result: `[TASK_META]: ${JSON.stringify(initialMeta)}\n`,
          planId: activePlan.id
        }
      });
    });
  }

  const targetTaskId = preservedParentTask.id;
  const targetTaskTitle = preservedParentTask.title.replace(/^\[.*?\]\s*/, '');

  // 3. Attempt AI Task Planning Decomposition
  try {
    if (simulateFailure) {
      throw new Error('Simulated Agent Planning Failure: Agent model generated unparseable step schema.');
    }

    const preview = await decomposeParentTask({
      userId,
      input: {
        title: cleanTitle || targetTaskTitle,
        description: input.description || preservedParentTask.result || '',
        priority: input.priority,
        deadline: input.deadline
      }
    });

    // Mark parent task planning as successful in DB
    await safeDbQuery(async () => {
      const currentMetaStr = preservedParentTask.result?.match(/\[TASK_META\]:\s*(\{.*?\})/)?.[1];
      let meta: any = {};
      try {
        if (currentMetaStr) meta = JSON.parse(currentMetaStr);
      } catch {}
      meta.planningStatus = 'PLANNED';
      delete meta.planningError;

      await (prisma as any).task.update({
        where: { id: targetTaskId },
        data: {
          result: `[TASK_META]: ${JSON.stringify(meta)}\n`
        }
      });
    });

    return {
      success: true,
      currentStage: OrchestrationLifecycleStage.TASK_PLANNING,
      parentTaskId: targetTaskId,
      preview
    };
  } catch (planningError: any) {
    console.warn(`[orchestrationReliabilityService] Planning failed for task ${targetTaskId}: ${planningError.message}`);

    // PRESERVE PARENT TASK IN DATABASE WITH ERROR CONTEXT
    await safeDbQuery(async () => {
      const currentMetaStr = preservedParentTask.result?.match(/\[TASK_META\]:\s*(\{.*?\})/)?.[1];
      let meta: any = {};
      try {
        if (currentMetaStr) meta = JSON.parse(currentMetaStr);
      } catch {}
      meta.planningStatus = 'FAILED';
      meta.planningError = planningError.message;
      meta.planningFailedAt = new Date().toISOString();

      await (prisma as any).task.update({
        where: { id: targetTaskId },
        data: {
          status: 'pending', // Preserved in backlog
          result: `[TASK_META]: ${JSON.stringify(meta)}\n[PLANNING_ERROR]: ${planningError.message}`
        }
      });
    });

    return {
      success: false,
      currentStage: OrchestrationLifecycleStage.TASK_PLANNING,
      parentTaskId: targetTaskId,
      recovery: {
        recoverable: true,
        parentTaskId: targetTaskId,
        parentTitle: targetTaskTitle,
        errorMessage: planningError.message || 'Agent planning failed to decompose task.',
        errorCode: 'PLANNING_FAILED',
        suggestedAction: 'RETRY_PLANNING'
      }
    };
  }
}

/**
 * PHASE 9 — Retry previously failed task planning.
 */
export async function retryTaskPlanning(
  userId: string,
  parentTaskId: string
): Promise<ReliableDecompositionResult> {
  const membership = await resolveMembership(userId);
  if (!membership) {
    throw new TaskDelegationError(403, 'No active company membership.', 'NO_ACTIVE_MEMBERSHIP');
  }

  const taskRow: any = await safeDbQuery(async () => {
    return await (prisma as any).task.findFirst({
      where: { id: parentTaskId, plan: { startupId: membership.startupId } }
    });
  });

  if (!taskRow) {
    throw new TaskDelegationError(404, 'Task not found in this company workspace.', 'NOT_FOUND');
  }

  const cleanTitle = taskRow.title.replace(/^\[.*?\]\s*/, '');
  let meta: any = {};
  if (taskRow.result && taskRow.result.includes('[TASK_META]:')) {
    try {
      const match = taskRow.result.match(/\[TASK_META\]:\s*(\{.*?\})/);
      if (match) meta = JSON.parse(match[1]);
    } catch {}
  }

  return await planParentTaskWithRecovery({
    userId,
    input: {
      title: cleanTitle,
      description: meta.description || '',
      priority: meta.priority || 'HIGH',
      deadline: meta.deadline
    },
    parentTaskId
  });
}

/**
 * PHASE 9 — Resilient Assignment Persistence & Isolated Notification Delivery.
 * Enforces the strict lifecycle:
 * Stage 1: Task Planning (input validation)
 * Stage 2: Assignment Validation (membership and role checks)
 * Stage 3: Assignment Persistence (atomic DB creation, non-terminal pending/in_progress)
 * Stage 4: Notification Creation (isolated so notification/SMTP failures NEVER lose assignments!)
 */
export async function persistAssignmentsWithResilientNotifications(params: {
  userId: string;
  parentTask: {
    title: string;
    description?: string;
    priority?: string;
    deadline?: string;
  };
  subtasks: Array<{
    title: string;
    description?: string;
    department?: string;
    agent?: string;
    suggestedRole?: string | null;
    priority?: string;
    dependencies?: string[];
    expectedDeliverable?: string;
    deadline?: string;
    assignedUserId?: string | null;
  }>;
  simulateNotificationFailure?: boolean;
}): Promise<ResilientPersistenceResult> {
  const { userId, parentTask, subtasks, simulateNotificationFailure } = params;

  // 1. Resolve membership
  const membership = await resolveMembership(userId);
  if (!membership) {
    throw new TaskDelegationError(403, 'No active company membership.', 'NO_ACTIVE_MEMBERSHIP');
  }
  const isPrivileged = membership.role === 'FOUNDER' || membership.role === 'ADMIN';
  if (!isPrivileged) {
    throw new TaskDelegationError(403, 'Only founders or admins can persist task decompositions.', 'FOUNDER_REQUIRED');
  }

  // 2. Stage 2: Assignment Validation
  const companyMemberships: any[] = await safeDbQuery(async () => {
    return await prisma.membership.findMany({
      where: { startupId: membership.startupId, status: 'ACTIVE' },
      select: { userId: true, role: true }
    });
  }) || [];
  const validMemberIds = new Set(companyMemberships.map(m => m.userId));

  // 3. Stage 3: Assignment Persistence
  const parentTitle = (parentTask?.title || '').trim();
  const parentDesc = (parentTask?.description || '').trim();
  const parentPriority = (parentTask?.priority || 'HIGH').toUpperCase();
  const parentDeadline = parentTask?.deadline || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const plan: any = await safeDbQuery(async () => {
    return await (prisma as any).plan.create({
      data: {
        title: parentTitle,
        description: parentDesc || `Strategic parent initiative: ${parentTitle}`,
        status: 'active',
        startupId: membership.startupId
      }
    });
  });

  const planId = plan?.id || `plan_${Date.now()}`;
  const createdTasks: DelegatedTask[] = [];
  const pendingNotificationDispatches: Array<{
    taskId: string;
    rawTitle: string;
    priority: string;
    deadline: string;
    parentTitle: string;
    agent: string;
    targetAssigneeId: string;
  }> = [];

  for (const st of subtasks) {
    const rawTitle = (st.title || '').trim();
    if (!rawTitle) continue;

    const dept = (st.department || 'GENERAL').toUpperCase() as Department;
    const agent = st.agent || agentForDepartment(dept);
    const suggestedRole = st.suggestedRole ? normalizeRole(st.suggestedRole) : ownerRoleForDepartment(dept);
    const subtaskPriority = st.priority || parentPriority;
    const subtaskDeadline = st.deadline || parentDeadline;
    const subtaskDesc = (st.description || '').trim() || `Execute ${rawTitle} with ${agent} assistance.`;
    const subtaskDeliverable = (st.expectedDeliverable || '').trim() || `Deliverable artifact for "${rawTitle}"`;

    let targetAssigneeId: string | null = st.assignedUserId || null;
    if (targetAssigneeId && !validMemberIds.has(targetAssigneeId)) {
      console.warn(`[orchestrationReliabilityService] Rejecting cross-company assignment: ${targetAssigneeId}`);
      targetAssigneeId = null;
    }

    const encodedTitle = encodeTitle(dept, agent, suggestedRole, rawTitle);
    const meta = {
      description: subtaskDesc,
      priority: subtaskPriority,
      deadline: subtaskDeadline,
      dependencies: Array.isArray(st.dependencies) ? st.dependencies : [],
      expectedDeliverable: subtaskDeliverable,
      assignedBy: userId,
      parentTaskId: planId,
      parentTaskTitle: parentTitle,
      companyId: membership.startupId,
      lifecycleStage: OrchestrationLifecycleStage.ASSIGNMENT_PERSISTENCE,
      notificationDelivery: { status: targetAssigneeId ? 'PENDING' : 'SKIPPED' }
    };

    const rolePrefix = suggestedRole || 'UNASSIGNED';
    const assignedTo = targetAssigneeId ? `${rolePrefix}:${targetAssigneeId}` : rolePrefix;

    // Persist in DB — Status is strictly 'pending' (canonical ASSIGNED). NEVER auto-completed.
    const taskRow: any = await (prisma as any).task.create({
      data: {
        title: encodedTitle,
        assignedTo,
        status: 'pending',
        result: `[TASK_META]: ${JSON.stringify(meta)}\n`,
        planId
      }
    });

    const decoded = decodeTask(taskRow);
    createdTasks.push(decoded);

    if (targetAssigneeId) {
      pendingNotificationDispatches.push({
        taskId: taskRow.id,
        rawTitle,
        priority: subtaskPriority,
        deadline: subtaskDeadline,
        parentTitle,
        agent,
        targetAssigneeId
      });
    }
  }

  // 4. Stage 4: Notification Creation (ISOLATED DISPATCH)
  // CRITICAL REQUIREMENT: Do not lose assignments when notification delivery fails.
  let dispatchedCount = 0;
  let failedCount = 0;

  for (const notifItem of pendingNotificationDispatches) {
    try {
      if (simulateNotificationFailure) {
        throw new Error('Simulated SMTP Delivery Timeout: Connection to mail server dropped.');
      }

      await notifyNewAssignment({
        startupId: membership.startupId,
        task: {
          id: notifItem.taskId,
          title: notifItem.rawTitle,
          priority: notifItem.priority,
          deadline: notifItem.deadline,
          parentTask: notifItem.parentTitle,
          agent: notifItem.agent
        },
        assigneeUserId: notifItem.targetAssigneeId,
        assignerUserId: userId
      });

      dispatchedCount++;

      // Update delivery record to SENT
      await safeDbQuery(async () => {
        const row = await (prisma as any).task.findUnique({ where: { id: notifItem.taskId } });
        if (row?.result) {
          const updated = row.result.replace('"notificationDelivery":{"status":"PENDING"}', '"notificationDelivery":{"status":"SENT"}');
          await (prisma as any).task.update({ where: { id: notifItem.taskId }, data: { result: updated } });
        }
      });
    } catch (notifErr: any) {
      failedCount++;
      console.warn(`[orchestrationReliabilityService] Notification delivery failed for task ${notifItem.taskId} (Assignment preserved):`, notifErr.message);

      // Record failed notification delivery in task metadata without rolling back task!
      await safeDbQuery(async () => {
        const row = await (prisma as any).task.findUnique({ where: { id: notifItem.taskId } });
        if (row?.result) {
          const failedMeta = JSON.stringify({ status: 'FAILED', error: notifErr.message, attemptedAt: new Date().toISOString() });
          const updated = row.result.replace('"notificationDelivery":{"status":"PENDING"}', `"notificationDelivery":${failedMeta}`);
          await (prisma as any).task.update({ where: { id: notifItem.taskId }, data: { result: updated } });
        }
      });
    }
  }

  const enrichedTasks = await enrichTasksWithUserNames(createdTasks);

  return {
    success: true,
    currentStage: OrchestrationLifecycleStage.NOTIFICATION_CREATION,
    plan,
    tasks: enrichedTasks,
    notificationSummary: {
      total: pendingNotificationDispatches.length,
      dispatched: dispatchedCount,
      failed: failedCount
    }
  };
}

/**
 * PHASE 9 — Retry a failed notification delivery for an assigned task.
 */
export async function retryTaskNotification(userId: string, taskId: string): Promise<{ success: boolean; message: string }> {
  const membership = await resolveMembership(userId);
  if (!membership) {
    throw new TaskDelegationError(403, 'No active company membership.', 'NO_ACTIVE_MEMBERSHIP');
  }

  const taskRow: any = await safeDbQuery(async () => {
    return await (prisma as any).task.findFirst({
      where: { id: taskId, plan: { startupId: membership.startupId } },
      include: { plan: true }
    });
  });

  if (!taskRow) {
    throw new TaskDelegationError(404, 'Task not found in this company.', 'NOT_FOUND');
  }

  const decoded = decodeTask(taskRow);
  if (!decoded.assignedUserId) {
    throw new TaskDelegationError(400, 'Task has no assigned user to notify.', 'NO_ASSIGNEE');
  }

  const cleanTitle = taskRow.title.replace(/^\[.*?\]\s*/, '');
  await notifyNewAssignment({
    startupId: membership.startupId,
    task: {
      id: taskRow.id,
      title: cleanTitle,
      priority: decoded.priority || 'HIGH',
      deadline: decoded.deadline || '',
      parentTask: taskRow.plan?.title || '',
      agent: decoded.agent
    },
    assigneeUserId: decoded.assignedUserId,
    assignerUserId: userId
  });

  // Mark status as SENT
  await safeDbQuery(async () => {
    if (taskRow.result) {
      const sentMeta = JSON.stringify({ status: 'SENT', retriedAt: new Date().toISOString() });
      const updated = taskRow.result.replace(/"notificationDelivery":\{.*?\}/, `"notificationDelivery":${sentMeta}`);
      await (prisma as any).task.update({ where: { id: taskId }, data: { result: updated } });
    }
  });

  return { success: true, message: `Notification successfully dispatched to assignee ${decoded.assignedUserId}.` };
}
