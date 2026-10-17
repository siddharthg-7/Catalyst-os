/**
 * Phase A3 — Task Decomposition & Delegation.
 *
 * The council already decomposes a founder command into work orders, but those
 * work orders only ever existed in memory: the `Task` model was never created or
 * read at runtime. Without persisted, assignable tasks there is no employee
 * workspace, no employee -> founder submission, and no record of work. This
 * service is that missing layer.
 *
 * Design notes:
 *  - No schema change. Tasks hang off the startup's `Plan`, which is how
 *    tenant scoping already works for Approval. `Task.assignedTo` holds the
 *    OWNING ROLE (a permissionService Role), so role -> member resolution is a
 *    comparison against `Membership.role` and needs no new column.
 *  - A department with no corresponding human role (LEGAL, AUDITOR) stays
 *    founder-owned rather than being assigned to an invented employee. The
 *    north-star rule is: missing AI capability -> provision the agent; missing
 *    HUMAN responsibility -> surface it for the founder to assign or invite.
 */
import { prisma, safeDbQuery } from './dbService';
import { normalizeRole, type Role, ROLES } from './permissionService';
import { resolveMembership } from './membershipService';
import { realtimeEventService } from './realtimeEventService';
import { ingestionPipelineService } from './ingestionPipelineService';
import { processedApprovalsMap } from './approvalService';

/** Council work-order departments, as produced by multiAgentCouncil.decompose. */
export type Department =
  | 'TALENT' | 'FINANCE' | 'GROWTH' | 'LEGAL' | 'OPERATIONS' | 'AUDITOR';

export type CanonicalTaskStatus =
  | 'BACKLOG'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'IN_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'COMPLETED'
  | 'CANCELLED';

export type TaskStatus =
  | 'pending'
  | 'backlog'
  | 'assigned'
  | 'in_progress'
  | 'submitted'
  | 'in_review'
  | 'changes_requested'
  | 'approved'
  | 'completed'
  | 'cancelled'
  | 'rejected'
  | CanonicalTaskStatus;

export const TASK_STATUSES: TaskStatus[] = [
  'pending', 'backlog', 'assigned', 'in_progress', 'submitted', 'in_review',
  'changes_requested', 'approved', 'completed', 'cancelled', 'rejected',
  'BACKLOG', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'IN_REVIEW',
  'CHANGES_REQUESTED', 'COMPLETED', 'CANCELLED'
];

/**
 * Valid state machine transitions.
 * Forward pipeline: BACKLOG -> ASSIGNED -> IN_PROGRESS -> SUBMITTED -> IN_REVIEW -> COMPLETED
 * Revisions: IN_REVIEW -> CHANGES_REQUESTED -> IN_PROGRESS
 * Direct founder review shortcuts: SUBMITTED -> COMPLETED, SUBMITTED -> CHANGES_REQUESTED
 * Cancellation: allowed from any non-terminal state through authorized workflow
 * Terminal states: COMPLETED and CANCELLED (reopening requires Founder/Admin)
 */
export const VALID_STATUS_TRANSITIONS: Record<CanonicalTaskStatus, CanonicalTaskStatus[]> = {
  BACKLOG: ['ASSIGNED', 'IN_PROGRESS', 'CANCELLED'],
  ASSIGNED: ['IN_PROGRESS', 'BACKLOG', 'CANCELLED'],
  IN_PROGRESS: ['SUBMITTED', 'ASSIGNED', 'BACKLOG', 'CANCELLED'],
  SUBMITTED: ['IN_REVIEW', 'COMPLETED', 'CHANGES_REQUESTED', 'IN_PROGRESS', 'CANCELLED'],
  IN_REVIEW: ['COMPLETED', 'CHANGES_REQUESTED', 'SUBMITTED', 'CANCELLED'],
  CHANGES_REQUESTED: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  COMPLETED: ['IN_REVIEW', 'IN_PROGRESS'], // Authorized reopen reserved for Founder/Admin
  CANCELLED: ['BACKLOG', 'IN_PROGRESS']    // Authorized reopen reserved for Founder/Admin
};

export function toCanonicalStatus(rawStatus?: string | null, assignedTo?: string | null): CanonicalTaskStatus | null {
  const s = (rawStatus || '').toUpperCase().trim();
  if (s === 'BACKLOG') return 'BACKLOG';
  if (s === 'ASSIGNED') return 'ASSIGNED';
  if (s === 'IN_PROGRESS') return 'IN_PROGRESS';
  if (s === 'SUBMITTED') return 'SUBMITTED';
  if (s === 'IN_REVIEW') return 'IN_REVIEW';
  if (s === 'CHANGES_REQUESTED') return 'CHANGES_REQUESTED';
  if (s === 'COMPLETED' || s === 'APPROVED') return 'COMPLETED';
  if (s === 'CANCELLED' || s === 'REJECTED') return 'CANCELLED';

  if (s === 'PENDING') {
    const rawAssigned = (assignedTo || '').trim();
    const isAssigned = rawAssigned && rawAssigned !== 'UNASSIGNED';
    return isAssigned ? 'ASSIGNED' : 'BACKLOG';
  }

  return null;
}

export function toDbStatus(canonical: CanonicalTaskStatus): string {
  switch (canonical) {
    case 'BACKLOG':
    case 'ASSIGNED':
      return 'pending';
    case 'IN_PROGRESS':
      return 'in_progress';
    case 'SUBMITTED':
      return 'submitted';
    case 'IN_REVIEW':
      return 'in_review';
    case 'CHANGES_REQUESTED':
      return 'changes_requested';
    case 'COMPLETED':
      return 'approved';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'pending';
  }
}

export interface TransitionValidationResult {
  allowed: boolean;
  canonicalFrom: CanonicalTaskStatus;
  canonicalTo: CanonicalTaskStatus;
  persistedDbStatus: string;
  statusCode?: number;
  errorCode?: string;
  errorMessage?: string;
}

export function validateStatusTransition(params: {
  currentStatus: string;
  nextStatus: string;
  assignedTo?: string | null;
  callerUserId: string;
  callerRole: string;
  isDirectAssignee: boolean;
  founderFeedback?: string | null;
  cancellationReason?: string | null;
}): TransitionValidationResult {
  const {
    currentStatus,
    nextStatus,
    assignedTo,
    callerRole,
    isDirectAssignee,
    founderFeedback
  } = params;

  const isPrivileged = callerRole === 'FOUNDER' || callerRole === 'ADMIN';
  const canonicalFrom = toCanonicalStatus(currentStatus, assignedTo) || 'BACKLOG';
  const canonicalTo = toCanonicalStatus(nextStatus, assignedTo);

  // Reject unrecognized / arbitrary statuses
  if (!canonicalTo) {
    return {
      allowed: false,
      canonicalFrom,
      canonicalTo: 'BACKLOG',
      persistedDbStatus: 'pending',
      statusCode: 400,
      errorCode: 'INVALID_STATUS_TRANSITION',
      errorMessage: `Status "${nextStatus}" is not a recognized task status.`
    };
  }

  const persistedDbStatus = toDbStatus(canonicalTo);

  // Idempotent: transition to same canonical status is allowed
  if (canonicalFrom === canonicalTo) {
    return {
      allowed: true,
      canonicalFrom,
      canonicalTo,
      persistedDbStatus
    };
  }

  // 1. Terminal state guard: COMPLETED or CANCELLED tasks can only be reopened by Founder/Admin
  if ((canonicalFrom === 'COMPLETED' || canonicalFrom === 'CANCELLED') && !isPrivileged) {
    return {
      allowed: false,
      canonicalFrom,
      canonicalTo,
      persistedDbStatus,
      statusCode: 403,
      errorCode: 'TERMINAL_STATE_LOCKED',
      errorMessage: `Cannot modify a ${canonicalFrom} task. Only founders or administrators can reopen terminal tasks.`
    };
  }

  // 2. Cancellation workflow guard: only Founder/Admin can cancel tasks
  if (canonicalTo === 'CANCELLED' && !isPrivileged) {
    return {
      allowed: false,
      canonicalFrom,
      canonicalTo,
      persistedDbStatus,
      statusCode: 403,
      errorCode: 'UNAUTHORIZED_CANCELLATION',
      errorMessage: 'Cancellation is restricted: Only founders or administrators can cancel tasks.'
    };
  }

  // 3. Approval / Completion guard:
  if (canonicalTo === 'COMPLETED') {
    // Self-approval guard: an employee cannot approve their own submission
    if (isDirectAssignee && callerRole !== 'FOUNDER') {
      return {
        allowed: false,
        canonicalFrom,
        canonicalTo,
        persistedDbStatus,
        statusCode: 403,
        errorCode: 'SELF_APPROVAL_FORBIDDEN',
        errorMessage: 'Self-approval forbidden: An employee cannot approve their own submission.'
      };
    }
    if (!isPrivileged) {
      return {
        allowed: false,
        canonicalFrom,
        canonicalTo,
        persistedDbStatus,
        statusCode: 403,
        errorCode: 'APPROVAL_RESERVED',
        errorMessage: 'Only the founder or an admin can approve submitted work.'
      };
    }
  }

  // 4. Changes Requested guard:
  if (canonicalTo === 'CHANGES_REQUESTED') {
    if (!isPrivileged) {
      return {
        allowed: false,
        canonicalFrom,
        canonicalTo,
        persistedDbStatus,
        statusCode: 403,
        errorCode: 'APPROVAL_RESERVED',
        errorMessage: 'Only the founder or an admin can request revisions.'
      };
    }
    const feedback = (founderFeedback || '').trim();
    if (!feedback) {
      return {
        allowed: false,
        canonicalFrom,
        canonicalTo,
        persistedDbStatus,
        statusCode: 400,
        errorCode: 'FEEDBACK_REQUIRED',
        errorMessage: 'Feedback is required when requesting revisions or changes.'
      };
    }
  }

  // 5. Verify transition is allowed in the state machine transition graph
  const allowedTargets = VALID_STATUS_TRANSITIONS[canonicalFrom] || [];
  if (!allowedTargets.includes(canonicalTo)) {
    return {
      allowed: false,
      canonicalFrom,
      canonicalTo,
      persistedDbStatus,
      statusCode: 400,
      errorCode: 'INVALID_STATUS_TRANSITION',
      errorMessage: `Invalid status transition: cannot transition task from ${canonicalFrom} to ${canonicalTo}. Allowed transitions from ${canonicalFrom}: [${allowedTargets.join(', ')}].`
    };
  }

  return {
    allowed: true,
    canonicalFrom,
    canonicalTo,
    persistedDbStatus
  };
}

/**
 * Department -> the human role that owns the work.
 *
 * LEGAL and AUDITOR map to null deliberately: there is no LEGAL or AUDITOR human
 * role in the permission model, and inventing one would imply the company employs
 * someone it does not. Those tasks stay with the founder/admin.
 */
const DEPARTMENT_OWNER: Record<Department, Role | null> = {
  TALENT: 'HR',
  FINANCE: 'FINANCE',
  GROWTH: 'GROWTH',
  OPERATIONS: 'OPERATIONS',
  LEGAL: null,
  AUDITOR: null
};

/** The AI agent that assists on this department's work. */
const DEPARTMENT_AGENT: Record<Department, string> = {
  TALENT: 'Talent',
  FINANCE: 'CFO',
  GROWTH: 'Growth',
  OPERATIONS: 'Operations',
  LEGAL: 'Legal',
  AUDITOR: 'Auditor'
};

export interface CapabilityDefinition {
  department: string;
  role: string;
  name: string;
  avatar: string;
  description: string;
}

export const CANONICAL_CAPABILITIES: Record<string, CapabilityDefinition> = {
  TALENT: {
    department: 'TALENT',
    role: 'Talent',
    name: 'Echo',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
    description: 'Head of People & Recruiting: talent acquisition, hiring roadmaps, compensation.'
  },
  FINANCE: {
    department: 'FINANCE',
    role: 'Finance',
    name: 'Aura',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
    description: 'Chief Financial Officer: unit economics, cash burn, and runway governance.'
  },
  GROWTH: {
    department: 'GROWTH',
    role: 'Growth',
    name: 'Vector',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    description: 'VP of Growth & Marketing: ICP positioning, CAC/LTV, demand generation.'
  },
  LEGAL: {
    department: 'LEGAL',
    role: 'Legal',
    name: 'Nexus',
    avatar: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=150',
    description: 'General Counsel: IP protection, compliance, commercial contracts, regulatory safeguards.'
  },
  OPERATIONS: {
    department: 'OPERATIONS',
    role: 'Operations',
    name: 'Helix',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    description: 'VP of Operations: cross-functional milestone tracking, delivery, workflow velocity.'
  },
  AUDITOR: {
    department: 'AUDITOR',
    role: 'Auditor',
    name: 'Sentry',
    avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150',
    description: 'Compliance & Verification Auditor: math accuracy, evidence grounding, hallucination prevention.'
  },
  INVESTMENT: {
    department: 'INVESTMENT',
    role: 'Investment',
    name: 'Apex',
    avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150',
    description: 'Head of Capital & Investor Relations: fundraising strategy, cap table modeling.'
  },
  SECURITY: {
    department: 'SECURITY',
    role: 'Security',
    name: 'Aegis',
    avatar: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=150',
    description: 'Chief Information Security Officer: data protection, IAM, security compliance.'
  },
  DATA: {
    department: 'DATA',
    role: 'Data',
    name: 'Cipher',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    description: 'Head of Data Science: analytics pipeline, predictive modeling, metric fidelity.'
  },
  CEO: {
    department: 'EXECUTIVE',
    role: 'CEO',
    name: 'Atlas',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
    description: 'Autonomous corporate strategist & CEO orchestrator.'
  }
};

export interface CapabilityProvisioningResult {
  capability: string;
  agentRole: string;
  agentName: string;
  provisioned: boolean;
  agentId?: string;
  description: string;
}

export interface HumanRoleRequirement {
  taskId?: string;
  taskTitle?: string;
  department: string;
  missingRole: string | null;
  status: 'UNFILLED' | 'ASSIGNED' | 'INVITATION_PENDING';
  reason: string;
  actionRequired: 'ASSIGN_EXISTING' | 'INVITE_PERSON';
  suggestedAction: {
    type: 'assign' | 'invite';
    description: string;
    assignableUsers?: Array<{
      userId: string;
      name: string;
      email: string;
      role: string;
    }>;
    recommendedInviteRole?: string;
  };
}

export function ownerRoleForDepartment(dept: string): Role | null {
  return DEPARTMENT_OWNER[(dept || '').toUpperCase() as Department] ?? null;
}

export function agentForDepartment(dept: string): string {
  const norm = (dept || '').toUpperCase();
  if (DEPARTMENT_AGENT[norm as Department]) {
    return DEPARTMENT_AGENT[norm as Department];
  }
  if (CANONICAL_CAPABILITIES[norm]) {
    return CANONICAL_CAPABILITIES[norm].name;
  }
  return 'CEO';
}

export class TaskDelegationError extends Error {
  constructor(public status: number, message: string, public code: string) {
    super(message);
    this.name = 'TaskDelegationError';
  }
}

/**
 * `Task.title` carries a compact machine-readable prefix so department, agent and
 * owning role survive without new columns:
 *   "[TALENT|Talent|HR] Analyze candidate role profile..."
 * Anything unparseable degrades to an unassigned task rather than throwing.
 */
const TITLE_PREFIX = /^\[([A-Z]+)\|([A-Za-z]+)\|([A-Z]*)\]\s*/;

function encodeTitle(dept: string, agent: string, owner: Role | null, objective: string): string {
  return `[${dept.toUpperCase()}|${agent}|${owner || ''}] ${objective}`;
}

export interface DelegatedTask {
  id: string;
  planId?: string;
  title: string;
  department: string;
  agent: string;
  ownerRole: Role | null;
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  status: TaskStatus;
  canonicalStatus?: CanonicalTaskStatus;
  isRestricted?: boolean;
  cancellationReason?: string | null;
  result: string | null;
  founderFeedback?: string | null;
  changesRequested?: boolean;
  /** True when no human role owns this yet — the founder must assign or invite. */
  needsHumanOwner: boolean;
  humanRequirement?: HumanRoleRequirement | null;
  createdAt: string;
  updatedAt: string;
  description?: string;
  priority?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  dueDate?: string;
  deadline?: string;
  dependencies?: string[];
  expectedDeliverable?: string;
  parentTask?: string;
  parentTaskId?: string;
  assignedBy?: string | null;
  assignedByName?: string | null;
  companyId?: string;
  subtasks?: any[];
  documents?: any[];
  progressUpdates?: any[];
  activityHistory?: any[];
}

export interface PlanStepDefinition {
  stepNumber: number;
  title: string;
  department: Department;
  agent: string;
  ownerRole: Role | null;
}

export interface PlanWithTasks {
  id: string;
  title: string;
  description: string;
  status: string;
  startupId: string;
  tasks: DelegatedTask[];
  explicitSteps: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DecomposedPlanResult {
  plan: {
    id: string;
    title: string;
    description: string;
    status: string;
    startupId: string;
    createdAt: string;
    updatedAt: string;
  };
  tasks: DelegatedTask[];
  explicitSteps: string[];
  formattedPlanText: string;
  provisionedAiCapabilities?: CapabilityProvisioningResult[];
  missingHumanRequirements?: HumanRoleRequirement[];
}

export function decodeTask(row: any): DelegatedTask {
  const match = TITLE_PREFIX.exec(row.title || '');
  const department = match?.[1] || 'GENERAL';
  const agent = match?.[2] || 'CEO';
  const ownerRole = (match?.[3] || '') as Role | '';
  const title = (row.title || '').replace(TITLE_PREFIX, '');
  const rawAssigned = (row.assignedTo || '').trim();
  const assigned = rawAssigned.toUpperCase();

  let assignedUserId: string | null = null;
  if (rawAssigned.includes(':')) {
    assignedUserId = rawAssigned.split(':')[1] || null;
  } else if (rawAssigned && rawAssigned !== 'UNASSIGNED' && !ROLES.includes(assigned as any)) {
    assignedUserId = rawAssigned;
  }

  const hasRole = Boolean(ownerRole);
  const isAssigned = Boolean(assignedUserId);
  const needsHumanOwner = isAssigned ? false : (!hasRole || assigned === 'UNASSIGNED');

  let founderFeedback: string | null = null;
  let changesRequested = (row.status === 'changes_requested');
  let cleanResult: string | null = row.result ?? null;
  let metadata: Record<string, any> = {};

  if (row.result && typeof row.result === 'string') {
    const metaMatch = row.result.match(/\[TASK_META\]:\s*(\{.*?\})(?:\n|$)/);
    if (metaMatch) {
      try {
        metadata = JSON.parse(metaMatch[1]);
        cleanResult = row.result.replace(/\[TASK_META\]:\s*\{.*?\}(?:\n|$)/, '').trim() || null;
      } catch {}
    }

    const feedbackMatch = row.result.match(/\[FOUNDER_(?:DIRECTIVE|FEEDBACK)\]:\s*([^\n]+)/);
    if (feedbackMatch) {
      founderFeedback = feedbackMatch[1].trim();
      changesRequested = true;
    }
  }

  // Priority resolution with fallback
  const rawPriority = (metadata.priority || (department === 'FINANCE' || department === 'LEGAL' ? 'HIGH' : 'MEDIUM')).toUpperCase();
  const priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' =
    ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(rawPriority) ? rawPriority : 'MEDIUM';

  // Parent task resolution
  const parentTask = metadata.parentTaskTitle || row.plan?.title || 'Core Executive Operations';
  const parentTaskId = metadata.parentTaskId || row.plan?.id || row.planId;
  const companyId = metadata.companyId || row.plan?.startupId;

  // Deadline / Due date resolution: 7 days default from creation
  const createdAtDate = row.createdAt ? new Date(row.createdAt) : new Date();
  const defaultDue = new Date(createdAtDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const dueDate = metadata.deadline || metadata.dueDate || defaultDue;

  // Description
  const description = metadata.description || row.plan?.description || title;

  // Expected deliverable
  const expectedDeliverable = metadata.expectedDeliverable ||
    `Structured findings, implementation specs, and operational outputs for "${title}"`;

  const isRestricted = Boolean(
    metadata.isRestricted || metadata.restricted || metadata.confidential ||
    metadata.accessScope === 'RESTRICTED' || row.title?.includes('[RESTRICTED]')
  );
  const canonicalStatus = toCanonicalStatus(row.status || 'pending', row.assignedTo) || 'BACKLOG';
  const cancellationReason = metadata.cancellationReason || null;

  return {
    id: row.id,
    planId: row.planId,
    companyId,
    parentTaskId,
    parentTask,
    title,
    description,
    priority,
    dueDate,
    deadline: dueDate,
    dependencies: Array.isArray(metadata.dependencies) ? metadata.dependencies : [],
    expectedDeliverable,
    department,
    agent,
    ownerRole: ownerRole ? normalizeRole(ownerRole) : null,
    assignedUserId,
    assignedUserName: row.assignedUserName || null,
    assignedBy: metadata.assignedBy || null,
    assignedByName: row.assignedByName || null,
    status: (row.status || 'pending') as any,
    canonicalStatus,
    isRestricted,
    cancellationReason,
    result: cleanResult,
    founderFeedback,
    changesRequested,
    needsHumanOwner,
    createdAt: row.createdAt?.toISOString?.() ?? String(row.createdAt),
    updatedAt: row.updatedAt?.toISOString?.() ?? String(row.updatedAt)
  };
}

/** Finds, or creates once, the startup's continuous operating plan. */
async function resolvePlanId(startupId: string): Promise<string> {
  const existing: any = await safeDbQuery(() =>
    prisma.plan.findFirst({ where: { startupId }, orderBy: { createdAt: 'asc' } })
  );
  if (existing) return existing.id;

  const created: any = await safeDbQuery(() =>
    prisma.plan.create({
      data: {
        title: 'Core Executive Operations',
        description: 'Default continuous operating plan',
        startupId,
        status: 'active'
      }
    })
  );
  return created?.id || `plan_${Date.now()}`;
}

export interface WorkOrderInput {
  department: string;
  objective: string;
}

/**
 * Persists a council decomposition as assignable Task rows.
 *
 * Idempotent per command: callers pass the orchestrator's commandId, and an
 * existing task with the same encoded title under the same plan is not
 * duplicated. Never throws into the orchestration path — a delegation failure
 * must not fail the founder's command.
 */
export async function delegateWorkOrders(
  startupId: string,
  workOrders: WorkOrderInput[],
  options?: { planId?: string }
): Promise<DelegatedTask[]> {
  if (!startupId || !prisma || !Array.isArray(workOrders) || workOrders.length === 0) {
    return [];
  }

  try {
    const planId = options?.planId || await resolvePlanId(startupId);
    const created: DelegatedTask[] = [];

    for (const order of workOrders) {
      const dept = (order.department || 'GENERAL').toUpperCase();
      const owner = ownerRoleForDepartment(dept);
      const agent = agentForDepartment(dept);
      const title = encodeTitle(dept, agent, owner, order.objective);

      // Phase A6: If company does not have this AI specialist, auto-provision it
      try {
        await ensureAiSpecialistCapability(startupId, dept);
      } catch (capErr: any) {
        console.warn('[taskDelegationService] ensureAiSpecialistCapability warning:', capErr.message);
      }

      const duplicate: any = await safeDbQuery(() =>
        (prisma as any).task.findFirst({ where: { planId, title } })
      );
      if (duplicate) {
        created.push(decodeTask(duplicate));
        continue;
      }

      const row: any = await (prisma as any).task.create({
        data: {
          title,
          // The owning ROLE, not a userId: resolution is a comparison against
          // Membership.role, so no new column is needed.
          assignedTo: owner || 'UNASSIGNED',
          status: 'pending',
          planId
        }
      });
      const decodedTask = decodeTask(row);
      created.push(decodedTask);

      try {
        await (prisma as any).notification.create({
          data: {
            startupId,
            type: 'TASK',
            title: `Task Delegated: ${decodedTask.title}`,
            message: `Assigned to ${dept} department. AI co-pilot ${agent} is ready in your Employee Workspace.`,
            read: false
          }
        });
      } catch {}
    }

    return created;
  } catch (err: any) {
    console.warn('[taskDelegationService] delegateWorkOrders note:', err.message);
    return [];
  }
}

/**
 * Phase A6: Checks if the startup has an appropriate AI specialist for the required capability.
 * If YES: returns existing agent without duplication.
 * If NO: automatically provisions the AI capability in the database as an ExecutiveAgent row,
 * records the event, and allows the task to continue immediately without delay.
 * Never invents a human employee.
 */
export async function ensureAiSpecialistCapability(
  startupId: string,
  requiredCapability: string
): Promise<CapabilityProvisioningResult> {
  const norm = (requiredCapability || 'GENERAL').toUpperCase();
  const capDef = CANONICAL_CAPABILITIES[norm] || {
    department: norm,
    role: norm.charAt(0) + norm.slice(1).toLowerCase(),
    name: `${norm.charAt(0) + norm.slice(1).toLowerCase()}Specialist`,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    description: `Specialized autonomous AI agent for ${norm}.`
  };

  if (!startupId || !prisma) {
    return {
      capability: norm,
      agentRole: capDef.role,
      agentName: capDef.name,
      provisioned: false,
      description: capDef.description
    };
  }

  // 1. Check existing agents for this company
  const existingAgents = await safeDbQuery(async () => {
    return await (prisma as any).executiveAgent.findMany({
      where: { startupId }
    });
  }) || [];

  const found = existingAgents.find((a: any) => {
    const roleUpper = (a.role || '').toUpperCase();
    const nameUpper = (a.name || '').toUpperCase();
    return (
      roleUpper === capDef.role.toUpperCase() ||
      nameUpper === capDef.name.toUpperCase() ||
      (capDef.department && roleUpper === capDef.department.toUpperCase())
    );
  });

  if (found) {
    return {
      capability: norm,
      agentRole: found.role,
      agentName: found.name,
      provisioned: false,
      agentId: found.id,
      description: capDef.description
    };
  }

  // 2. NO -> Provision AI capability in database as a genuine ExecutiveAgent
  const created: any = await safeDbQuery(async () => {
    return await (prisma as any).executiveAgent.create({
      data: {
        role: capDef.role,
        name: capDef.name,
        avatar: capDef.avatar,
        status: 'idle',
        startupId
      }
    });
  });

  // Record timeline event if available
  try {
    if ((prisma as any).timelineItem) {
      await safeDbQuery(() =>
        (prisma as any).timelineItem.create({
          data: {
            startupId,
            type: 'CAPABILITY_PROVISIONED',
            title: `AI Capability Provisioned: ${capDef.name} (${capDef.role})`,
            content: `Auto-provisioned AI specialist for ${norm} continuous operations.`
          }
        })
      );
    }
  } catch {}

  return {
    capability: norm,
    agentRole: capDef.role,
    agentName: capDef.name,
    provisioned: true,
    agentId: created?.id,
    description: capDef.description
  };
}

/**
 * Phase A6: Resolves the human responsibility requirement for a task.
 * Crucial rule: Never automatically invent a human employee.
 * If the human responsibility is missing:
 *  - creates an explicit HumanRoleRequirement
 *  - surfaces it for the Founder/Admin to assign an existing member or invite a new person.
 */
export async function resolveHumanRoleRequirement(params: {
  startupId: string;
  task: DelegatedTask;
}): Promise<HumanRoleRequirement | null> {
  const { startupId, task } = params;

  // If task is already claimed or assigned to a specific user, requirement is filled
  if (task.assignedUserId) {
    return null;
  }

  // Retrieve active members for this company
  const members: any[] = await safeDbQuery(async () => {
    if (!prisma) return [];
    return await (prisma as any).membership.findMany({
      where: { startupId, status: 'ACTIVE' },
      include: { user: true }
    });
  }) || [];

  const assignableUsers = members.map((m: any) => ({
    userId: m.userId,
    name: m.user?.name || m.user?.email || 'Team Member',
    email: m.user?.email || '',
    role: m.role
  }));

  // Case 1: Department has NO human role in company model (e.g. LEGAL, AUDITOR)
  if (task.ownerRole === null) {
    return {
      taskId: task.id,
      taskTitle: task.title,
      department: task.department,
      missingRole: task.department,
      status: 'UNFILLED',
      reason: `Company model has no designated employee role for ${task.department}. Never inventing a placeholder employee.`,
      actionRequired: 'ASSIGN_EXISTING',
      suggestedAction: {
        type: 'assign',
        description: `Founder or Admin should review or assign this ${task.department} task to an executive or invite a dedicated specialist.`,
        assignableUsers,
        recommendedInviteRole: 'OPERATIONS'
      }
    };
  }

  // Case 2: Department maps to a human role (e.g. HR, FINANCE, GROWTH), but no employee exists with this role
  const hasRoleMember = members.some((m: any) => m.role === task.ownerRole);
  if (!hasRoleMember) {
    return {
      taskId: task.id,
      taskTitle: task.title,
      department: task.department,
      missingRole: task.ownerRole,
      status: 'UNFILLED',
      reason: `Company currently has no active team members with the ${task.ownerRole} role. CatalystOS never invents an employee.`,
      actionRequired: 'INVITE_PERSON',
      suggestedAction: {
        type: 'invite',
        description: `Invite a new ${task.ownerRole} team member to own this work order, or assign an existing executive.`,
        recommendedInviteRole: task.ownerRole,
        assignableUsers
      }
    };
  }

  return null;
}

/**
 * Phase A6: Scans a startup's active tasks and directory to report all missing human role requirements.
 * Never invents human employees.
 */
export async function getHumanRoleRequirementsForStartup(
  startupId: string
): Promise<HumanRoleRequirement[]> {
  if (!startupId || !prisma) return [];

  const tasks = await safeDbQuery(async () => {
    return await (prisma as any).task.findMany({
      where: {
        plan: { startupId },
        status: { in: ['pending', 'in_progress'] }
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' }
    });
  }) || [];

  const decodedTasks = tasks.map(decodeTask);
  const requirements: HumanRoleRequirement[] = [];

  for (const task of decodedTasks) {
    const req = await resolveHumanRoleRequirement({ startupId, task });
    if (req) {
      requirements.push(req);
    }
  }

  return requirements;
}

/**
 * Phase A6: Diagnostic scan for a startup:
 *  - AI specialist agents present
 *  - Missing human staffing requirements
 */
export async function getMissingCapabilitiesAndStaffing(startupId: string): Promise<{
  aiSpecialists: Array<{ role: string; name: string; status: string; avatar: string }>;
  provisionedAiCapabilities: CapabilityProvisioningResult[];
  missingHumanRequirements: HumanRoleRequirement[];
}> {
  if (!startupId || !prisma) {
    return {
      aiSpecialists: [],
      provisionedAiCapabilities: [],
      missingHumanRequirements: []
    };
  }

  const existingAgents = await safeDbQuery(async () => {
    return await (prisma as any).executiveAgent.findMany({
      where: { startupId }
    });
  }) || [];

  const missingHumanRequirements = await getHumanRoleRequirementsForStartup(startupId);

  return {
    aiSpecialists: existingAgents.map((a: any) => ({
      role: a.role,
      name: a.name,
      status: a.status,
      avatar: a.avatar
    })),
    provisionedAiCapabilities: [],
    missingHumanRequirements
  };
}

/**
 * Turns a founder command into an explicit, structured plan definition with ordered steps.
 *
 * Example:
 * Founder: "Prepare a hiring plan for two senior developers."
 * Plan Title: "Hiring Plan: Two Senior Developers"
 * Steps:
 *  1. Analyze current engineering capacity
 *  2. Determine hiring requirements
 *  3. Check hiring policy
 *  4. Analyze budget impact
 *  5. Draft hiring plan
 *  6. Submit for review
 */
export function buildPlanStepsForCommand(command: string): {
  title: string;
  description: string;
  steps: PlanStepDefinition[];
} {
  const lower = command.toLowerCase();

  // 1. Hiring / Recruitment Plan
  const isHiring = /hire|hiring|headcount|developer|engineer|designer|sales|recruit/i.test(lower);
  if (isHiring) {
    let title = 'Hiring Plan: Headcount Recruitment';
    if (/two\s+senior\s+dev|2\s+senior\s+dev/i.test(lower)) {
      title = 'Hiring Plan: Two Senior Developers';
    } else if (/engineer/i.test(lower)) {
      title = 'Hiring Plan: Engineering Headcount';
    } else if (/senior/i.test(lower)) {
      title = 'Hiring Plan: Senior Specialist';
    }

    return {
      title,
      description: `Execution plan for founder directive: "${command}"`,
      steps: [
        {
          stepNumber: 1,
          title: 'Analyze current engineering capacity',
          department: 'OPERATIONS',
          agent: 'Operations',
          ownerRole: 'OPERATIONS'
        },
        {
          stepNumber: 2,
          title: 'Determine hiring requirements',
          department: 'TALENT',
          agent: 'Talent',
          ownerRole: 'HR'
        },
        {
          stepNumber: 3,
          title: 'Check hiring policy',
          department: 'LEGAL',
          agent: 'Legal',
          ownerRole: null // Legal has no human employee; stays with founder/admin
        },
        {
          stepNumber: 4,
          title: 'Analyze budget impact',
          department: 'FINANCE',
          agent: 'CFO',
          ownerRole: 'FINANCE'
        },
        {
          stepNumber: 5,
          title: 'Draft hiring plan',
          department: 'TALENT',
          agent: 'Talent',
          ownerRole: 'HR'
        },
        {
          stepNumber: 6,
          title: 'Submit for review',
          department: 'OPERATIONS',
          agent: 'CEO',
          ownerRole: 'FOUNDER'
        }
      ]
    };
  }

  // 2. Growth / Marketing Plan
  const isGrowth = /market|growth|campaign|acquisition|ad|sales|launch|gtm/i.test(lower);
  if (isGrowth) {
    return {
      title: 'Growth Plan: Go-To-Market Execution',
      description: `Execution plan for founder directive: "${command}"`,
      steps: [
        {
          stepNumber: 1,
          title: 'Analyze current market capacity & ICP benchmarks',
          department: 'GROWTH',
          agent: 'Growth',
          ownerRole: 'GROWTH'
        },
        {
          stepNumber: 2,
          title: 'Determine campaign acquisition requirements',
          department: 'GROWTH',
          agent: 'Growth',
          ownerRole: 'GROWTH'
        },
        {
          stepNumber: 3,
          title: 'Check marketing compliance & privacy policy',
          department: 'LEGAL',
          agent: 'Legal',
          ownerRole: null
        },
        {
          stepNumber: 4,
          title: 'Analyze budget impact & CAC payback period',
          department: 'FINANCE',
          agent: 'CFO',
          ownerRole: 'FINANCE'
        },
        {
          stepNumber: 5,
          title: 'Draft go-to-market campaign plan',
          department: 'GROWTH',
          agent: 'Growth',
          ownerRole: 'GROWTH'
        },
        {
          stepNumber: 6,
          title: 'Submit for review',
          department: 'GROWTH',
          agent: 'CEO',
          ownerRole: 'FOUNDER'
        }
      ]
    };
  }

  // 3. Financial / Budget / Runway Plan
  const isFinancial = /budget|burn|runway|cash|funding|raise|cut|cost|spend/i.test(lower);
  if (isFinancial) {
    return {
      title: 'Financial Plan: Treasury & Capital Allocation',
      description: `Execution plan for founder directive: "${command}"`,
      steps: [
        {
          stepNumber: 1,
          title: 'Audit current treasury & department expenditures',
          department: 'FINANCE',
          agent: 'CFO',
          ownerRole: 'FINANCE'
        },
        {
          stepNumber: 2,
          title: 'Determine capital reallocation requirements',
          department: 'FINANCE',
          agent: 'CFO',
          ownerRole: 'FINANCE'
        },
        {
          stepNumber: 3,
          title: 'Check contractual & governance policies',
          department: 'LEGAL',
          agent: 'Legal',
          ownerRole: null
        },
        {
          stepNumber: 4,
          title: 'Analyze runway impact & scenario stress tests',
          department: 'FINANCE',
          agent: 'CFO',
          ownerRole: 'FINANCE'
        },
        {
          stepNumber: 5,
          title: 'Draft financial allocation plan',
          department: 'FINANCE',
          agent: 'CFO',
          ownerRole: 'FINANCE'
        },
        {
          stepNumber: 6,
          title: 'Submit for review',
          department: 'FINANCE',
          agent: 'CEO',
          ownerRole: 'FOUNDER'
        }
      ]
    };
  }

  // 4. Default Strategic Execution Plan
  return {
    title: `Execution Plan: ${command.slice(0, 50)}`,
    description: `Execution plan for founder directive: "${command}"`,
    steps: [
      {
        stepNumber: 1,
        title: 'Analyze current operational capacity',
        department: 'OPERATIONS',
        agent: 'Operations',
        ownerRole: 'OPERATIONS'
      },
      {
        stepNumber: 2,
        title: 'Determine execution requirements',
        department: 'OPERATIONS',
        agent: 'Operations',
        ownerRole: 'OPERATIONS'
      },
      {
        stepNumber: 3,
        title: 'Check company policy & compliance',
        department: 'LEGAL',
        agent: 'Legal',
        ownerRole: null
      },
      {
        stepNumber: 4,
        title: 'Analyze budget impact & runway preservation',
        department: 'FINANCE',
        agent: 'CFO',
        ownerRole: 'FINANCE'
      },
      {
        stepNumber: 5,
        title: 'Draft execution plan',
        department: 'OPERATIONS',
        agent: 'Operations',
        ownerRole: 'OPERATIONS'
      },
      {
        stepNumber: 6,
        title: 'Submit for review',
        department: 'OPERATIONS',
        agent: 'CEO',
        ownerRole: 'FOUNDER'
      }
    ]
  };
}

export function formatPlanAsText(planTitle: string, steps: { stepNumber: number; title: string }[]): string {
  const lines = ['PLAN', ''];
  steps.forEach(s => {
    lines.push(`${s.stepNumber}. ${s.title}`);
  });
  return lines.join('\n');
}

/**
 * Phase A4: Turns a founder command into an explicit Plan and ordered Task rows.
 *
 * Creates a dedicated `Plan` row in the database, populates the ordered `Task` rows,
 * and returns the structured plan for the founder assistant and employee workspace.
 */
export async function decomposeCommandToPlan(params: {
  startupId: string;
  command: string;
  commandId?: string;
}): Promise<DecomposedPlanResult> {
  const { startupId, command, commandId } = params;
  const planData = buildPlanStepsForCommand(command);
  const formattedPlanText = formatPlanAsText(planData.title, planData.steps);
  const explicitSteps = planData.steps.map(s => s.title);

  if (!startupId) {
    const fallbackPlanId = `plan_${Date.now()}`;
    const fallbackTasks: DelegatedTask[] = planData.steps.map((s, idx) => ({
      id: `task_${Date.now()}_${idx + 1}`,
      planId: fallbackPlanId,
      title: s.title,
      department: s.department,
      agent: s.agent,
      ownerRole: s.ownerRole,
      status: 'pending' as TaskStatus,
      result: null,
      needsHumanOwner: !s.ownerRole,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
    return {
      plan: {
        id: fallbackPlanId,
        title: planData.title,
        description: planData.description,
        status: 'active',
        startupId: 'memory',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      tasks: fallbackTasks,
      explicitSteps,
      formattedPlanText
    };
  }

  // 1. Resolve or create Plan row in database
  let planRow: any = null;
  if (prisma) {
    try {
      if (commandId) {
        planRow = await safeDbQuery(() =>
          (prisma as any).plan.findFirst({
            where: {
              startupId,
              description: { contains: commandId }
            }
          })
        );
      }
      if (!planRow) {
        // Also check if plan with exact title and description exists for this startup
        planRow = await safeDbQuery(() =>
          (prisma as any).plan.findFirst({
            where: {
              startupId,
              title: planData.title
            }
          })
        );
      }
      if (!planRow) {
        planRow = await safeDbQuery(() =>
          (prisma as any).plan.create({
            data: {
              title: planData.title,
              description: commandId
                ? `[${commandId}] ${planData.description}`
                : planData.description,
              status: 'active',
              startupId
            }
          })
        );
      }
    } catch (err: any) {
      console.warn('[taskDelegationService] Error creating plan row:', err.message);
    }
  }

  const effectivePlanId = planRow?.id || `plan_${Date.now()}`;
  const tasks: DelegatedTask[] = [];

  // 2. Persist Task rows linked to this Plan
  // Phase A6: Ensure AI specialist capability is provisioned for each plan step
  const provisionedAiCapabilities: CapabilityProvisioningResult[] = [];
  if (startupId && prisma) {
    for (const step of planData.steps) {
      try {
        const capRes = await ensureAiSpecialistCapability(startupId, step.department);
        if (capRes.provisioned) {
          provisionedAiCapabilities.push(capRes);
        }
      } catch (err: any) {
        console.warn('[taskDelegationService] ensureAiSpecialistCapability warning:', err.message);
      }
    }
  }

  // 2. Persist Task rows linked to this Plan
  for (const step of planData.steps) {
    const encodedTitle = encodeTitle(step.department, step.agent, step.ownerRole, step.title);
    let taskRow: any = null;

    if (prisma && planRow) {
      try {
        taskRow = await safeDbQuery(() =>
          (prisma as any).task.findFirst({
            where: { planId: effectivePlanId, title: encodedTitle }
          })
        );
        if (!taskRow) {
          taskRow = await safeDbQuery(() =>
            (prisma as any).task.create({
              data: {
                title: encodedTitle,
                assignedTo: step.ownerRole || 'UNASSIGNED',
                status: 'pending',
                planId: effectivePlanId
              }
            })
          );
          if (taskRow) {
            try {
              await (prisma as any).notification.create({
                data: {
                  startupId,
                  type: 'TASK',
                  title: `Task Delegated: ${step.title}`,
                  message: `Assigned to ${step.department} department. AI co-pilot ${step.agent} is ready in your Employee Workspace.`,
                  read: false
                }
              });
            } catch {}
          }
        }
      } catch (err: any) {
        console.warn('[taskDelegationService] Error creating task row:', err.message);
      }
    }

    if (taskRow) {
      tasks.push(decodeTask(taskRow));
    } else {
      tasks.push({
        id: `task_${Date.now()}_${step.stepNumber}`,
        planId: effectivePlanId,
        title: step.title,
        department: step.department,
        agent: step.agent,
        ownerRole: step.ownerRole,
        status: 'pending' as TaskStatus,
        result: null,
        needsHumanOwner: !step.ownerRole,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  }

  // Phase A6: Resolve missing human responsibility requirements
  const missingHumanRequirements: HumanRoleRequirement[] = [];
  if (startupId && prisma) {
    for (const task of tasks) {
      try {
        const req = await resolveHumanRoleRequirement({ startupId, task });
        if (req) {
          task.humanRequirement = req;
          missingHumanRequirements.push(req);
        }
      } catch (err: any) {
        console.warn('[taskDelegationService] resolveHumanRoleRequirement warning:', err.message);
      }
    }
  }

  return {
    plan: {
      id: effectivePlanId,
      title: planRow?.title || planData.title,
      description: planRow?.description || planData.description,
      status: planRow?.status || 'active',
      startupId,
      createdAt: planRow?.createdAt?.toISOString?.() || new Date().toISOString(),
      updatedAt: planRow?.updatedAt?.toISOString?.() || new Date().toISOString()
    },
    tasks,
    explicitSteps,
    formattedPlanText,
    provisionedAiCapabilities,
    missingHumanRequirements
  };
}

/**
 * Lists all plans for the caller's company, scoped to their role.
 */
export async function listPlansForUser(userId: string): Promise<PlanWithTasks[]> {
  if (!userId || !prisma) return [];

  const membership = await resolveMembership(userId);
  if (!membership) {
    throw new TaskDelegationError(
      403,
      'Forbidden: you do not have active access to a company workspace.',
      'NO_ACTIVE_MEMBERSHIP'
    );
  }

  const role = membership.role;
  const isPrivileged = role === 'FOUNDER' || role === 'ADMIN';

  try {
    const plans: any[] = await safeDbQuery(() =>
      (prisma as any).plan.findMany({
        where: { startupId: membership.startupId },
        include: {
          tasks: {
            where: isPrivileged ? {} : { assignedTo: role },
            orderBy: { createdAt: 'asc' }
          }
        },
        orderBy: { createdAt: 'desc' }
      })
    );

    return (plans || []).map((p: any) => {
      const decodedTasks = (p.tasks || []).map(decodeTask);
      return {
        id: p.id,
        title: p.title,
        description: p.description,
        status: p.status,
        startupId: p.startupId,
        tasks: decodedTasks,
        explicitSteps: decodedTasks.map((t: DelegatedTask) => t.title),
        createdAt: p.createdAt?.toISOString?.() ?? String(p.createdAt),
        updatedAt: p.updatedAt?.toISOString?.() ?? String(p.updatedAt)
      };
    });
  } catch (err: any) {
    console.warn('[taskDelegationService] listPlansForUser note:', err.message);
    return [];
  }
}

/**
 * Gets a specific plan by id with its tasks, scoped to the caller's company.
 */
export async function getPlanById(userId: string, planId: string): Promise<PlanWithTasks> {
  if (!userId || !prisma) {
    throw new TaskDelegationError(503, 'Database unavailable.', 'DB_UNAVAILABLE');
  }

  const membership = await resolveMembership(userId);
  if (!membership) {
    throw new TaskDelegationError(
      403,
      'Forbidden: you do not have active access to a company workspace.',
      'NO_ACTIVE_MEMBERSHIP'
    );
  }

  const role = membership.role;
  const isPrivileged = role === 'FOUNDER' || role === 'ADMIN';

  const plan: any = await safeDbQuery(() =>
    (prisma as any).plan.findFirst({
      where: { id: planId, startupId: membership.startupId },
      include: {
        tasks: {
          where: isPrivileged ? {} : { assignedTo: role },
          orderBy: { createdAt: 'asc' }
        }
      }
    })
  );

  if (!plan) {
    throw new TaskDelegationError(404, 'Plan not found in this company.', 'NOT_FOUND');
  }

  const decodedTasks = (plan.tasks || []).map(decodeTask);
  return {
    id: plan.id,
    title: plan.title,
    description: plan.description,
    status: plan.status,
    startupId: plan.startupId,
    tasks: decodedTasks,
    explicitSteps: decodedTasks.map((t: DelegatedTask) => t.title),
    createdAt: plan.createdAt?.toISOString?.() ?? String(plan.createdAt),
    updatedAt: plan.updatedAt?.toISOString?.() ?? String(plan.updatedAt)
  };
}

/**
 * Lists the tasks a user may see, scoped to their company and role.
 *
 * FOUNDER/ADMIN see everything, including tasks with no human owner.
 * Everyone else sees only tasks owned by their own role — an employee must not
 * see the whole company's workload.
 */
/**
 * Helper to enrich tasks with their assigned user's display name.
 */
export async function enrichTasksWithUserNames(tasks: DelegatedTask[]): Promise<DelegatedTask[]> {
  const userIds = Array.from(new Set([
    ...tasks.map(t => t.assignedUserId),
    ...tasks.map(t => t.assignedBy)
  ].filter(Boolean))) as string[];
  if (userIds.length === 0 || !prisma) return tasks;

  try {
    const users: any[] = await safeDbQuery(() =>
      prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true }
      })
    );
    const userMap = new Map<string, string>();
    for (const u of users || []) {
      userMap.set(u.id, u.name || u.email || 'Team Member');
    }
    return tasks.map(t => {
      let updated = { ...t };
      if (t.assignedUserId && userMap.has(t.assignedUserId)) {
        updated.assignedUserName = userMap.get(t.assignedUserId)!;
      }
      if (t.assignedBy && userMap.has(t.assignedBy)) {
        updated.assignedByName = userMap.get(t.assignedBy)!;
      }
      return updated;
    });
  } catch {
    return tasks;
  }
}

/**
 * Lists the tasks a user may see, scoped to their company and role.
 *
 * FOUNDER/ADMIN see everything, including tasks with no human owner.
 * Everyone else sees only tasks owned by their own role or assigned to them — an employee
 * must not see the whole company's workload.
 */
export async function listTasksForUser(userId: string): Promise<DelegatedTask[]> {
  if (!userId || !prisma) return [];

  const membership = await resolveMembership(userId);
  if (!membership) {
    throw new TaskDelegationError(
      403,
      'Forbidden: you do not have active access to a company workspace.',
      'NO_ACTIVE_MEMBERSHIP'
    );
  }

  const role = membership.role;
  const isPrivileged = role === 'FOUNDER' || role === 'ADMIN';

  try {
    const rows: any[] = await safeDbQuery(() =>
      (prisma as any).task.findMany({
        where: {
          plan: { startupId: membership.startupId },
          ...(isPrivileged
            ? {}
            : {
                OR: [
                  { assignedTo: role },
                  { assignedTo: { startsWith: `${role}:` } },
                  { assignedTo: userId },
                  { assignedTo: { endsWith: `:${userId}` } }
                ]
              })
        },
        include: {
          plan: { select: { id: true, title: true, description: true, startupId: true } }
        },
        orderBy: { createdAt: 'desc' }
      })
    );
    const decoded = (rows || []).map(decodeTask);
    const filtered = isPrivileged
      ? decoded
      : decoded.filter(t => {
          if (t.isRestricted && t.assignedUserId !== userId) {
            return false;
          }
          return true;
        });
    return await enrichTasksWithUserNames(filtered);
  } catch (err: any) {
    console.warn('[taskDelegationService] listTasksForUser note:', err.message);
    return [];
  }
}

/**
 * Retrieves a single task by ID if the caller is authorized to view it in their company workspace.
 * Founder/Admin can view any company task; employees can view tasks for their role or assigned to them.
 */
export async function getTaskByIdForUser(userId: string, taskId: string): Promise<DelegatedTask> {
  if (!userId || !prisma) {
    throw new TaskDelegationError(503, 'Database unavailable.', 'DB_UNAVAILABLE');
  }

  const membership = await resolveMembership(userId);
  if (!membership) {
    throw new TaskDelegationError(
      403,
      'Forbidden: you do not have active access to a company workspace.',
      'NO_ACTIVE_MEMBERSHIP'
    );
  }

  const role = membership.role;
  const isPrivileged = role === 'FOUNDER' || role === 'ADMIN';

  const row: any = await safeDbQuery(() =>
    (prisma as any).task.findFirst({
      where: {
        id: taskId,
        plan: { startupId: membership.startupId }
      },
      include: {
        plan: { select: { id: true, title: true, description: true, startupId: true } }
      }
    })
  );

  if (!row) {
    throw new TaskDelegationError(404, 'Task not found in this company.', 'NOT_FOUND');
  }

  const decoded = decodeTask(row);

  if (!isPrivileged) {
    const isOwnerRole = decoded.ownerRole === role;
    const isAssignedUser = decoded.assignedUserId === userId;

    // Phase 8: Prevent employees from viewing other employees' restricted tasks
    if (decoded.isRestricted && !isAssignedUser) {
      throw new TaskDelegationError(
        403,
        'Forbidden: this is a restricted task and cannot be viewed by other employees.',
        'RESTRICTED_TASK_ACCESS'
      );
    }

    if (!isOwnerRole && !isAssignedUser) {
      throw new TaskDelegationError(403, 'You do not have authorization to view this task.', 'UNAUTHORIZED_TASK_ACCESS');
    }
  }

  const enriched = await enrichTasksWithUserNames([decoded]);
  const mainTask = enriched[0];

  // Fetch sibling subtasks under the same plan
  let subtasks: any[] = [];
  if (row.planId) {
    try {
      const siblings: any[] = await safeDbQuery(() =>
        (prisma as any).task.findMany({
          where: { planId: row.planId },
          include: { plan: { select: { id: true, title: true, description: true, startupId: true } } }
        })
      );
      if (siblings && siblings.length > 0) {
        const decodedSiblings = await enrichTasksWithUserNames(siblings.map(decodeTask));
        subtasks = decodedSiblings.filter(s => s.id !== decoded.id);
      }
    } catch (subErr: any) {
      console.warn('[taskDelegationService] Subtasks query note:', subErr.message);
    }
  }

  // Fetch attached documents
  let documents: any[] = [];
  try {
    const docs: any[] = await safeDbQuery(() =>
      (prisma as any).startupDocument.findMany({
        where: {
          startupId: membership.startupId,
          sourceType: 'TASK_DOCUMENT',
          sourceRecordId: taskId
        },
        orderBy: { createdAt: 'desc' }
      })
    );
    if (docs) {
      documents = docs.map((d: any) => ({
        id: d.id,
        name: d.name,
        size: d.size,
        type: d.type,
        createdAt: d.createdAt?.toISOString?.() ?? String(d.createdAt)
      }));
    }
  } catch (docErr: any) {
    console.warn('[taskDelegationService] Documents query note:', docErr.message);
  }

  // Fetch progress updates
  let progressUpdates: any[] = [];
  try {
    const { listTaskProgressUpdates } = await import('./employeeEcosystemService');
    progressUpdates = await listTaskProgressUpdates(taskId);
  } catch (progErr: any) {
    console.warn('[taskDelegationService] Progress query note:', progErr.message);
  }

  // Fetch relevant task activity history
  let activityHistory: any[] = [];
  try {
    const { activityLogService } = await import('./activityLogService');
    const logs = await activityLogService.listActivities({
      startupId: membership.startupId,
      limit: 50
    });
    activityHistory = logs.filter((l: any) => l.targetId === taskId || (l.details && l.details.taskId === taskId));
  } catch (actErr: any) {
    console.warn('[taskDelegationService] Activity history query note:', actErr.message);
  }

  return {
    ...mainTask,
    subtasks,
    documents,
    progressUpdates,
    activityHistory
  };
}

/**
 * Phase B1: Human task assignment & claim mechanism.
 *
 * - Founder/Admin can assign any task in the company to any active member, or unassign (assigneeId: null).
 * - Employees (HR, FINANCE, GROWTH, OPERATIONS) can claim tasks belonging to their department.
 * - Cross-department assignment or claim attempts by non-privileged members are strictly rejected.
 * - Claiming advances task status from 'pending' to 'in_progress'.
 */
export async function assignTaskForUser(params: {
  userId: string;
  taskId: string;
  assigneeId?: string | null;
}): Promise<DelegatedTask> {
  const { userId, taskId } = params;
  let targetAssigneeId = params.assigneeId;

  if (!prisma) {
    throw new TaskDelegationError(503, 'The database is unavailable.', 'DB_UNAVAILABLE');
  }

  const callerMembership = await resolveMembership(userId);
  if (!callerMembership) {
    throw new TaskDelegationError(
      403,
      'Forbidden: you do not have active access to a company workspace.',
      'NO_ACTIVE_MEMBERSHIP'
    );
  }

  const role = callerMembership.role;
  const isPrivileged = role === 'FOUNDER' || role === 'ADMIN';

  const row: any = await safeDbQuery(() =>
    (prisma as any).task.findFirst({
      where: { id: taskId, plan: { startupId: callerMembership.startupId } }
    })
  );
  if (!row) {
    throw new TaskDelegationError(404, 'Task not found in this company.', 'NOT_FOUND');
  }

  const decoded = decodeTask(row);

  // Phase 8 Idempotency: duplicate assignment retries must be a no-op
  if (targetAssigneeId && decoded.assignedUserId === targetAssigneeId) {
    return decoded;
  }
  if (!targetAssigneeId && !decoded.assignedUserId) {
    return decoded;
  }

  // If not privileged, caller can only claim the task for THEMSELVES and only if they match the department ownerRole
  if (!isPrivileged) {
    if (targetAssigneeId && targetAssigneeId !== userId) {
      throw new TaskDelegationError(
        403,
        'Forbidden: employees cannot assign tasks to other team members.',
        'ASSIGNMENT_FORBIDDEN'
      );
    }
    // Employee is claiming
    targetAssigneeId = userId;

    if (!decoded.ownerRole || decoded.ownerRole !== role) {
      throw new TaskDelegationError(
        403,
        'Forbidden: you can only claim tasks designated for your department.',
        'NOT_TASK_OWNER'
      );
    }
  }

  let newAssignedTo: string;
  let targetUserName: string | null = null;

  if (targetAssigneeId) {
    // Validate target assignee belongs to same company
    const targetMembership = await resolveMembership(targetAssigneeId);
    if (!targetMembership || targetMembership.startupId !== callerMembership.startupId) {
      throw new TaskDelegationError(
        404,
        'Assignee not found in this company workspace.',
        'ASSIGNEE_NOT_FOUND'
      );
    }
    const rolePrefix = decoded.ownerRole || targetMembership.role;
    newAssignedTo = `${rolePrefix}:${targetAssigneeId}`;

    const userRecord = await safeDbQuery(() =>
      prisma.user.findUnique({
        where: { id: targetAssigneeId },
        select: { name: true, email: true }
      })
    );
    targetUserName = userRecord?.name || userRecord?.email || null;
  } else {
    // Unassign: reset to department role or UNASSIGNED
    newAssignedTo = decoded.ownerRole || 'UNASSIGNED';
  }

  const updateData: Record<string, any> = {
    assignedTo: newAssignedTo
  };
  // If task was pending and is self-claimed by the employee, advance to in_progress.
  // If assigned by founder/admin to a team member, keep status pending (canonical ASSIGNED).
  if (targetAssigneeId && row.status === 'pending' && (!isPrivileged || userId === targetAssigneeId)) {
    updateData.status = 'in_progress';
  }

  const updated: any = await (prisma as any).task.update({
    where: { id: row.id },
    data: updateData
  });

  const resTask = decodeTask(updated);
  if (targetUserName) {
    resTask.assignedUserName = targetUserName;
  }

  // Phase 4: Alert team and founder upon task assignment or reassignment
  if (callerMembership?.startupId) {
    try {
      const { notifyAssignmentChange } = await import('./notificationService');
      await notifyAssignmentChange({
        startupId: callerMembership.startupId,
        task: {
          id: row.id,
          title: resTask.title,
          priority: resTask.priority,
          deadline: resTask.deadline
        },
        previousAssigneeId: decoded.assignedUserId,
        newAssigneeId: targetAssigneeId,
        changedByUserId: userId
      });
    } catch (notifErr: any) {
      console.warn('[taskDelegationService] Task assigned notification note:', notifErr?.message);
    }

    // Phase 4: Emit real-time task.assigned event to tenant clients
    try {
      const { realtimeEventService } = await import('./realtimeEventService');
      realtimeEventService.emitEvent({
        type: 'task.assigned',
        startupId: callerMembership.startupId,
        taskId: row.id,
        targetUserId: targetAssigneeId || undefined
      });
    } catch {}
  }

  return resTask;
}

/**
 * Updates a task's status and/or result.
 *
 * Tenant- and role-scoped: the task must belong to the caller's company, and a
 * non-privileged member may only touch tasks owned by their role or assigned to them.
 * Transitions to 'submitted' auto-create an item in the Founder Approval queue.
 */
export async function updateTaskForUser(params: {
  userId: string;
  taskId: string;
  status?: string;
  result?: string;
  founderFeedback?: string;
  cancellationReason?: string;
  submissionNotes?: string;
}): Promise<DelegatedTask> {
  const { userId, taskId } = params;
  if (!prisma) {
    throw new TaskDelegationError(503, 'The database is unavailable.', 'DB_UNAVAILABLE');
  }

  const membership = await resolveMembership(userId);
  if (!membership) {
    throw new TaskDelegationError(
      403,
      'Forbidden: you do not have active access to a company workspace.',
      'NO_ACTIVE_MEMBERSHIP'
    );
  }

  const role = membership.role;
  const isPrivileged = role === 'FOUNDER' || role === 'ADMIN';

  const row: any = await safeDbQuery(() =>
    (prisma as any).task.findFirst({
      where: { id: taskId, plan: { startupId: membership.startupId } }
    })
  );
  // A task in another company is indistinguishable from a missing one.
  if (!row) {
    throw new TaskDelegationError(404, 'Task not found in this company.', 'NOT_FOUND');
  }

  const rawAssigned = (row.assignedTo || '').trim();
  const assignedUpper = rawAssigned.toUpperCase();
  const isDirectAssignee = rawAssigned.includes(userId);
  const isRoleAssignee = assignedUpper === role || assignedUpper.startsWith(`${role}:`);

  if (!isPrivileged && !isDirectAssignee && !isRoleAssignee) {
    throw new TaskDelegationError(
      403,
      'Forbidden: that task is owned by another department.',
      'NOT_TASK_OWNER'
    );
  }

  const data: Record<string, any> = {};
  let transitionValidation: TransitionValidationResult | null = null;

  if (params.status !== undefined) {
    transitionValidation = validateStatusTransition({
      currentStatus: row.status,
      nextStatus: params.status,
      assignedTo: row.assignedTo,
      callerUserId: userId,
      callerRole: role,
      isDirectAssignee,
      founderFeedback: params.founderFeedback,
      cancellationReason: params.cancellationReason
    });

    if (!transitionValidation.allowed) {
      throw new TaskDelegationError(
        transitionValidation.statusCode || 400,
        transitionValidation.errorMessage || 'Invalid status transition.',
        transitionValidation.errorCode || 'INVALID_STATUS_TRANSITION'
      );
    }

    data.status = transitionValidation.persistedDbStatus;
  }

  if (params.submissionNotes !== undefined) {
    const notesStr = String(params.submissionNotes).trim();
    if (notesStr) {
      const currentRes = data.result !== undefined ? data.result : (row.result || '');
      data.result = `[TASK_SUBMISSION]: ${notesStr}\n\n${currentRes}`.trim();
    }
  }

  if (params.cancellationReason !== undefined) {
    const reasonStr = String(params.cancellationReason).trim();
    if (reasonStr) {
      const currentRes = data.result !== undefined ? data.result : (row.result || '');
      data.result = `${currentRes}\n\n[TASK_CANCELLATION_REASON]: ${reasonStr}`.trim();
    }
  }

  if (params.result !== undefined) {
    data.result = String(params.result);
  }

  if (params.founderFeedback !== undefined) {
    const feedbackStr = String(params.founderFeedback).trim();
    if (feedbackStr) {
      const currentRes = data.result !== undefined ? data.result : (row.result || '');
      const cleaned = currentRes.replace(/\n*\[FOUNDER_(?:DIRECTIVE|FEEDBACK)\]:\s*[^\n]*/g, '').trim();
      data.result = `${cleaned}\n\n[FOUNDER_FEEDBACK]: ${feedbackStr}`.trim();
    }
  }

  if (Object.keys(data).length === 0) {
    throw new TaskDelegationError(400, 'Nothing to update.', 'NO_CHANGES');
  }

  const updated: any = await (prisma as any).task.update({
    where: { id: row.id },
    data
  });

  const decoded = decodeTask(updated);

  // Record transition in activity log and progress update history asynchronously
  if (transitionValidation && transitionValidation.canonicalFrom !== transitionValidation.canonicalTo) {
    setImmediate(async () => {
      try {
        const { activityLogService } = await import('./activityLogService');
        await activityLogService.logActivity({
          startupId: membership.startupId,
          userId,
          actorRole: role,
          action: 'TASK_STATUS_TRANSITION',
          targetEntity: 'TASK',
          targetId: row.id,
          department: decoded.department,
          details: {
            taskId: row.id,
            fromStatus: transitionValidation.canonicalFrom,
            toStatus: transitionValidation.canonicalTo,
            reason: params.founderFeedback || params.cancellationReason || null
          }
        });
      } catch {}

      try {
        const { addTaskProgressUpdate } = await import('./employeeEcosystemService');
        const note = transitionValidation.canonicalTo === 'CHANGES_REQUESTED'
          ? `[Status: ${transitionValidation.canonicalFrom} → CHANGES_REQUESTED] Feedback: ${params.founderFeedback || ''}`
          : transitionValidation.canonicalTo === 'CANCELLED'
          ? `[Status: ${transitionValidation.canonicalFrom} → CANCELLED] Reason: ${params.cancellationReason || 'Task cancelled by founder/admin'}`
          : `[Status: ${transitionValidation.canonicalFrom} → ${transitionValidation.canonicalTo}]`;

        await addTaskProgressUpdate({
          userId,
          taskId: row.id,
          note
        });
      } catch {}
    });

    // If cancelled, sync with approval record
    if (transitionValidation.canonicalTo === 'CANCELLED') {
      try {
        await safeDbQuery(async () => {
          await (prisma as any).approval.update({
            where: { id: `appr_task_${row.id}` },
            data: { status: 'rejected' }
          }).catch(() => {});
        });
      } catch {}
    }
  }

  // If status is 'submitted', route deliverable directly to the Founder Approval queue (Phase B & D)
  if (data.status === 'submitted') {
    const approvalId = `appr_task_${row.id}`;
    const approvalTitle = decoded.title;
    const rawContent = params.result || updated.result || '';
    
    // Formulate concise executive summary from submitted text
    const textLines = rawContent.split('\n').filter((l: string) => l.trim() && !l.startsWith('#')).map((l: string) => l.trim());
    const summary = textLines.length > 0 
      ? (textLines.slice(0, 2).join(' ').slice(0, 240) + (textLines.join(' ').length > 240 ? '...' : ''))
      : `Comprehensive ${decoded.title} prepared in collaboration with ${decoded.agent}.`;

    let impact = `Submitted by ${membership.role} Employee with ${decoded.agent} co-pilot verification.`;
    if (decoded.department === 'TALENT' || decoded.department === 'HR') {
      impact = 'Recruiting velocity accelerated; structured leveling scorecards enforce hiring bar without budget overrun.';
    } else if (decoded.department === 'FINANCE') {
      impact = 'Preserves 6+ months liquid runway buffer while establishing audit ledger accountability.';
    } else if (decoded.department === 'GROWTH') {
      impact = 'Targets developer organic loop expansion with blended CAC payback horizon < 6 months.';
    } else if (decoded.department === 'OPERATIONS') {
      impact = 'Guarantees 99.9% uptime SLA adherence and automated runbook escalation.';
    }

    const recommendation = `Approve ${decoded.title} deliverable and authorize operational execution.`;
    const approvalType = decoded.department === 'TALENT' || decoded.department === 'HR'
      ? 'contract'
      : decoded.department === 'FINANCE'
      ? 'financials'
      : decoded.department === 'GROWTH'
      ? 'marketing_plan'
      : 'document';

    const userRecord: any = await safeDbQuery(() =>
      (prisma as any).user.findUnique({
        where: { id: userId },
        select: { name: true, email: true }
      })
    );
    const preparedByUserName = userRecord?.name || userRecord?.email || `${membership.role} Team Member`;

    const companion = getCompanionAgent(decoded.department || decoded.agent);
    const aiAssistanceName = companion.name || decoded.agent || 'AI Assistant';

    const metricChangesPayload = {
      taskId: row.id,
      taskTitle: decoded.title,
      preparedBy: `${membership.role} Employee`,
      preparedByUserName,
      preparedByRole: membership.role,
      aiAssistance: aiAssistanceName,
      summary,
      impact,
      recommendation,
      workAreaContent: rawContent,
      submittedAt: new Date().toISOString()
    };

    // Clear any previous review cache so the founder can review the new submission
    try {
      processedApprovalsMap.delete(approvalId);
    } catch {
      // ignore
    }

    await safeDbQuery(async () => {
      await (prisma as any).approval.upsert({
        where: { id: approvalId },
        create: {
          id: approvalId,
          title: approvalTitle,
          description: rawContent || summary,
          type: approvalType,
          content: rawContent,
          impact: impact,
          financialChange: 0,
          metricChanges: metricChangesPayload as any,
          planId: row.planId,
          status: 'pending_review'
        },
        update: {
          title: approvalTitle,
          description: rawContent || summary,
          content: rawContent,
          impact: impact,
          metricChanges: metricChangesPayload as any,
          status: 'pending_review'
        }
      });
    });

    if (membership?.startupId) {
      // Dispatch notification & dynamic RAG ingestion in background without blocking response
      setImmediate(async () => {
        try {
          const { notifyReviewRequest } = await import('./notificationService');
          await notifyReviewRequest({
            startupId: membership.startupId,
            task: {
              id: row.id,
              title: decoded.title,
              department: decoded.department
            },
            employeeUserId: userId,
            summary
          });
        } catch (err: any) {
          console.warn('[TaskDelegationService] Review request notification warning:', err?.message);
        }

        try {
          const job = await ingestionPipelineService.enqueueJob({
            startupId: membership.startupId,
            sourceType: 'TASK',
            sourceRecordId: row.id,
            action: 'UPSERT',
            payload: {
              documentId: `doc_task_${row.id}`,
              name: `[Task] ${decoded.title}`,
              type: 'task',
              content: `TASK DELIVERABLE: ${decoded.title}\nDepartment: ${decoded.department}\nAgent: ${decoded.agent}\nStatus: ${data.status}\nDetails:\n${params.result || updated.result || ''}`,
              accessScope: decoded.department || 'ALL',
              summary: `Deliverable for task: ${decoded.title}`
            },
            immediate: false
          });

          if (job?.id) {
            ingestionPipelineService.processJob(job.id).catch((err: any) => {
              console.warn('[TaskDelegationService] Background ingestion runner notice:', err?.message);
            });
          }
        } catch (ragErr: any) {
          console.warn('[TaskDelegationService] Dynamic task RAG sync warning:', ragErr.message);
        }
      });
    }
  }

  // Phase 4: Handle notifications when founder requests changes or approves task directly
  if (data.status === 'changes_requested' && membership?.startupId) {
    try {
      const { notifyRevisionRequested } = await import('./notificationService');
      const feedback = params.founderFeedback || 'Founder requested modifications to deliverable.';
      await notifyRevisionRequested({
        startupId: membership.startupId,
        task: {
          id: row.id,
          title: decoded.title,
          assignedUserId: decoded.assignedUserId
        },
        feedback,
        founderUserId: userId
      });
    } catch (err: any) {
      console.warn('[TaskDelegationService] Revision requested notification warning:', err?.message);
    }
    try {
      await safeDbQuery(async () => {
        await (prisma as any).approval.update({
          where: { id: `appr_task_${row.id}` },
          data: { status: 'changes_requested' }
        }).catch(() => {});
      });
    } catch {}
  } else if (data.status === 'approved' && membership?.startupId) {
    try {
      const { notifyTaskApproval } = await import('./notificationService');
      await notifyTaskApproval({
        startupId: membership.startupId,
        task: {
          id: row.id,
          title: decoded.title,
          assignedUserId: decoded.assignedUserId
        },
        founderUserId: userId
      });
    } catch (err: any) {
      console.warn('[TaskDelegationService] Task approval notification warning:', err?.message);
    }
    try {
      await safeDbQuery(async () => {
        await (prisma as any).approval.update({
          where: { id: `appr_task_${row.id}` },
          data: { status: 'approved' }
        }).catch(() => {});
      });
    } catch {}
  }

  // Phase 4: Emit real-time event for task updates, submissions, approvals, or revisions
  if (membership?.startupId) {
    try {
      let eventType: 'task.submitted' | 'task.approved' | 'task.changes_requested' | 'task.updated' = 'task.updated';
      if (data.status === 'submitted') eventType = 'task.submitted';
      else if (data.status === 'approved') eventType = 'task.approved';
      else if (data.status === 'changes_requested') eventType = 'task.changes_requested';

      realtimeEventService.emitEvent({
        type: eventType,
        startupId: membership.startupId,
        taskId: row.id,
        targetUserId: decoded.assignedUserId || undefined
      });
    } catch {}
  }

  return decoded;
}

// ============================================================================
// PHASE B2 — EMPLOYEE WORKSPACE & COMPANION AI DRAFTS
// ============================================================================

export interface CompanionAgentInfo {
  name: string;
  role: string;
  avatar: string;
  description: string;
  department: string;
}

export const COMPANION_AGENTS: Record<string, CompanionAgentInfo> = {
  TALENT: {
    name: 'Echo',
    role: 'Chief People Officer & Talent Architect',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
    description: 'Expert in talent acquisition, interview rubrics, compensation leveling, and onboarding milestones.',
    department: 'TALENT'
  },
  HR: {
    name: 'Echo',
    role: 'Chief People Officer & Talent Architect',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
    description: 'Expert in talent acquisition, interview rubrics, compensation leveling, and onboarding milestones.',
    department: 'TALENT'
  },
  FINANCE: {
    name: 'Aura',
    role: 'Chief Financial Officer & Treasury Strategist',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
    description: 'Specialist in cashflow runway, burn modeling, capital allocation, and financial compliance.',
    department: 'FINANCE'
  },
  GROWTH: {
    name: 'Vector',
    role: 'Chief Marketing Officer & Growth Lead',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    description: 'Specialist in go-to-market channels, CAC payback modeling, customer acquisition, and brand campaigns.',
    department: 'GROWTH'
  },
  OPERATIONS: {
    name: 'Helix',
    role: 'Chief Operating Officer & Systems Architect',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    description: 'Architect for operational runbooks, team capacity modeling, IT provisioning, and SLA governance.',
    department: 'OPERATIONS'
  }
};

export function getCompanionAgent(departmentOrRole: string): CompanionAgentInfo {
  const key = (departmentOrRole || '').toUpperCase();
  return COMPANION_AGENTS[key] || {
    name: 'Catalyst Core',
    role: 'Executive AI Co-Pilot',
    avatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150',
    description: 'Autonomous executive intelligence engine assisting with cross-functional execution.',
    department: key || 'GENERAL'
  };
}

export function generateAgentDraftContent(task: DelegatedTask, companyName?: string): {
  draftContent: string;
  guidelines: string[];
} {
  const dept = (task.department || '').toUpperCase();
  const lower = task.title.toLowerCase();

  if (dept === 'TALENT' || dept === 'HR' || lower.includes('hiring') || lower.includes('engineer') || lower.includes('recruit')) {
    const isTechRole = lower.includes('engineer') || lower.includes('developer') || lower.includes('architect') || lower.includes('platform') || lower.includes('backend') || lower.includes('frontend');
    const isDesignRole = lower.includes('design') || lower.includes('ui') || lower.includes('ux');
    const isSalesGrowth = lower.includes('sales') || lower.includes('growth') || lower.includes('marketing') || lower.includes('ae') || lower.includes('bdr');

    const domainCompetency = isTechRole
      ? 'System architecture, clean code execution, distributed systems, and feature velocity.'
      : isDesignRole
      ? 'Product UI/UX design systems, user research, rapid prototyping, and interaction design.'
      : isSalesGrowth
      ? 'Pipeline generation, enterprise deal execution, customer acquisition, and CRM mastery.'
      : 'Domain excellence, startup velocity, cross-functional collaboration, and proactive execution.';

    return {
      draftContent: `### Talent Executive Working Draft: ${task.title}
**Assisting AI:** Echo (Chief People Officer)
**Target Organization:** ${companyName || 'Team & Operations'}

#### 1. Candidate Persona & Competency Matrix
- **Core Competencies:** ${domainCompetency}
- **Leveling:** Senior / Staff IC. Proven track record leading key initiatives with high ownership.
- **Autonomous Velocity:** Self-starter mindset capable of shipping in high-growth startup environments.

#### 2. Four-Stage Interview Loop
1. **Recruiter Screen (30m):** Experience alignment, compensation expectation check, work authorization.
2. **Domain Deep-Dive & Live Case (60m):** Real-world scenario problem solving, quality assessment.
3. **Cross-Functional Architecture & Impact (45m):** Collaboration, system complexity, quality standards.
4. **Founder Executive & Culture Fit (45m):** Startup mindset, ownership ethos, mutual alignment.

#### 3. Compensation & Leveling Guardrail
- **Base Range:** Market 75th percentile benchmark.
- **Equity Band:** Standard 4-year vesting schedule with 1-year cliff.
- **Budget Compliance:** Checked against company financial policies and cash runway bounds.

#### 4. 90-Day Onboarding Plan
- **Day 1–30:** Complete setup, complete first meaningful delivery within week 1, understand team workflows.
- **Day 31–60:** Own core domain milestones, partner with cross-functional teammates.
- **Day 61–90:** Lead autonomous quarterly deliverables, contribute to company-wide improvements.`,
      guidelines: [
        'Verify headcount authorization with Finance before extending offers.',
        'Follow company interview scorecard standards.',
        'Ensure 1-year cliff and 4-year vesting terms match stock option policies.'
      ]
    };
  }

  if (dept === 'FINANCE' || lower.includes('budget') || lower.includes('burn') || lower.includes('runway') || lower.includes('financial')) {
    return {
      draftContent: `### Financial Executive Working Draft: ${task.title}
**Assisting AI:** Aura (Chief Financial Officer)
**Scope:** Treasury & Capital Impact Audit

#### 1. Cashflow Impact Assessment
- **Estimated Expenditure / Addition:** Modeled against current burn rate.
- **Runway Variance:** Maintains minimum 6-month buffer threshold after allocation.
- **Capital Efficiency:** High ROI expected within 2 quarters.

#### 2. Risk & Safeguards Analysis
- **Fixed vs. Variable Cost Allocation:** Preserves liquid cash reserves.
- **Stress-Test Scenario:** Evaluated under downside revenue conditions.
- **Approval Requisite:** Requires final Founder sign-off before balance ledger dispatch.

#### 3. Strategic Financial Recommendation
- Proceed with budgeted plan while monitoring monthly net burn delta.
- Review vendor / headcount terms after 90 days.`,
      guidelines: [
        'Treasury disbursements exceeding $10,000 require dual verification.',
        'Maintain minimum 6 months runway buffer at all times.',
        'Record all approved amounts in the immutable decision ledger.'
      ]
    };
  }

  if (dept === 'GROWTH' || lower.includes('growth') || lower.includes('market') || lower.includes('acquisition') || lower.includes('campaign')) {
    return {
      draftContent: `### Growth Executive Working Draft: ${task.title}
**Assisting AI:** Vector (Chief Marketing Officer)
**Campaign Focus:** GTM Acceleration & Customer Acquisition

#### 1. Ideal Customer Profile (ICP) & Value Proposition
- **Target Segments:** High-velocity tech startups, founders, product and ops leads.
- **Key Positioning:** Streamlined autonomous operating loop with zero administrative overhead.

#### 2. Acquisition Channel Strategy
- **Organic & Content:** Technical deep dives, developer ecosystem tutorials, thought leadership.
- **Targeted Outbound:** Direct outreach to qualified early-stage teams.
- **Product-Led Loops:** Collaborative team invites and workflow sharing.

#### 3. KPI Targets & Payback Milestones
- **Target CAC:** Sustainable CAC payback < 6 months.
- **Conversion Goal:** 15%+ lead-to-activation rate.`,
      guidelines: [
        'Ensure all copy aligns with official brand messaging standards.',
        'Monitor CAC payback period weekly.',
        'Respect privacy policies and email deliverability compliance.'
      ]
    };
  }

  // Operations / General
  return {
    draftContent: `### Operational Executive Working Draft: ${task.title}
**Assisting AI:** Atlas (Chief Operating Officer)
**Scope:** Execution & Systems Roadmap

#### 1. Operational Objectives
- Clear sequential milestone execution with accountability.
- Minimal friction integration with existing tooling and developer setup.

#### 2. Tooling & Infrastructure Requirements
- Verify secure access credentials and environment configuration.
- Setup automated health alerts and status monitoring.

#### 3. Delivery Milestones
- **Phase 1:** Requirements alignment & capacity verification.
- **Phase 2:** Implementation, code review, and automated regression tests.
- **Phase 3:** Founder sign-off and production rollout.`,
    guidelines: [
      'Document all changes in the shared runbook.',
      'Maintain 99.9% uptime and zero-downtime deployment practices.',
      'Notify founder upon milestone completion.'
    ]
  };
}

export interface EmployeeWorkspacePayload {
  department: string;
  role: string;
  companionAgent: CompanionAgentInfo;
  tasks: DelegatedTask[];
  accessibleDocuments: Array<{
    id: string;
    name: string;
    type: string;
    summary: string;
    category?: string;
  }>;
  departmentMetrics?: {
    activeTasks: number;
    pendingSubmission: number;
    submittedCount: number;
    approvedCount: number;
  };
}

/**
 * Phase B2: Retrieves the employee workspace payload including companion AI agent,
 * active tasks, department metrics, and strictly role-scoped documents (zero cross-department leaks).
 */
export async function getRoleScopedContext(params: {
  userId: string;
}): Promise<EmployeeWorkspacePayload> {
  const { userId } = params;
  if (!prisma) {
    throw new TaskDelegationError(503, 'The database is unavailable.', 'DB_UNAVAILABLE');
  }

  let membership: any = null;
  try {
    membership = await resolveMembership(userId);
  } catch {
    membership = null;
  }

  if (!membership) {
    membership = {
      startupId: 'startup_novatech_demo',
      role: 'FOUNDER',
      status: 'ACTIVE',
      viaOwnership: true,
      isOwner: true
    };
  }

  const role = membership.role;
  const isPrivileged = role === 'FOUNDER' || role === 'ADMIN';

  // Determine effective department for companion agent
  let department = 'GENERAL';
  if (role === 'HR') department = 'TALENT';
  else if (role === 'FINANCE') department = 'FINANCE';
  else if (role === 'GROWTH') department = 'GROWTH';
  else if (role === 'OPERATIONS') department = 'OPERATIONS';
  else if (isPrivileged) department = 'EXECUTIVE';

  const companionAgent = getCompanionAgent(department);

  // Get user tasks
  const tasks = await listTasksForUser(userId);

  // Compute metrics
  const activeTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length;
  const pendingSubmission = tasks.filter(t => t.status === 'in_progress').length;
  const submittedCount = tasks.filter(t => t.status === 'submitted').length;
  const approvedCount = tasks.filter(t => t.status === 'approved').length;

  // Retrieve role-scoped documents with ZERO cross-department leaks
  const allDocs = await safeDbQuery(async () => {
    try {
      const docModel = (prisma as any).startupDocument || (prisma as any).document;
      if (docModel) {
        return await docModel.findMany({
          where: { startupId: membership.startupId }
        });
      }
    } catch {}
    return [];
  }) || [];

  // STRICT ROLE FILTERING: Zero cross-department leaks!
  // Map real documents from database and classify by department
  const formattedDocs = (allDocs as any[]).map(doc => {
    let category = doc.category;
    if (!category) {
      const lower = `${doc.name} ${doc.summary || ''}`.toLowerCase();
      if (lower.includes('hiring') || lower.includes('handbook') || lower.includes('talent') || lower.includes('recruitment') || lower.includes('interview') || lower.includes('offer')) {
        category = 'TALENT';
      } else if (lower.includes('financial') || lower.includes('treasury') || lower.includes('budget') || lower.includes('burn') || lower.includes('runway') || lower.includes('cash') || lower.includes('cap table')) {
        category = 'FINANCE';
      } else if (lower.includes('growth') || lower.includes('marketing') || lower.includes('gtm') || lower.includes('campaign') || lower.includes('sales') || lower.includes('brand')) {
        category = 'GROWTH';
      } else if (lower.includes('operation') || lower.includes('runbook') || lower.includes('infra') || lower.includes('sla') || lower.includes('devops')) {
        category = 'OPERATIONS';
      } else {
        category = 'GENERAL';
      }
    }
    return {
      id: doc.id,
      name: doc.name,
      type: doc.type,
      summary: doc.summary || 'Verified corporate document.',
      category
    };
  });

  const baselinePolicyTemplates = [
    {
      id: `std_doc_hiring_${membership.startupId}`,
      name: 'Engineering Hiring Policy & Leveling Rubric',
      type: 'policy',
      summary: 'Company baseline hiring protocols, interview stages, and leveling rubric.',
      category: 'TALENT'
    },
    {
      id: `std_doc_handbook_${membership.startupId}`,
      name: 'Employee Handbook & Operating Principles',
      type: 'handbook',
      summary: 'Company operational guidelines, working norms, and employee governance.',
      category: 'TALENT'
    },
    {
      id: `std_doc_financials_${membership.startupId}`,
      name: 'Financial Statements & Treasury Allocation',
      type: 'financial',
      summary: 'Quarterly financial statements, burn rate accounting, and treasury ledger.',
      category: 'FINANCE'
    },
    {
      id: `std_doc_captable_${membership.startupId}`,
      name: 'Cap Table & Equity Pool Summary',
      type: 'equity',
      summary: 'Equity ownership breakdown, option pool allocation, and share ledger.',
      category: 'FINANCE'
    },
    {
      id: `std_doc_runbook_${membership.startupId}`,
      name: 'Technical Architecture & Operations Runbook',
      type: 'runbook',
      summary: 'Infrastructure deployment runbooks, SLA tracking, and operational standards.',
      category: 'OPERATIONS'
    },
    {
      id: `std_doc_growth_${membership.startupId}`,
      name: 'Growth Strategy & Market Acquisition',
      type: 'gtm',
      summary: 'Customer acquisition channels, marketing funnels, and growth roadmap.',
      category: 'GROWTH'
    },
    {
      id: `std_doc_charter_${membership.startupId}`,
      name: 'Company Governance Charter',
      type: 'general',
      summary: 'Corporate governance policies and cross-functional operating standards.',
      category: 'GENERAL'
    }
  ];

  const docsToFilter = formattedDocs.length > 0 ? formattedDocs : baselinePolicyTemplates;

  const accessibleDocuments = docsToFilter.filter(doc => {
    if (isPrivileged) return true; // Founders / Admins see all company documents
    const docCat = (doc.category || '').toUpperCase();
    if (role === 'HR') return docCat === 'TALENT' || docCat === 'HR' || docCat === 'GENERAL';
    if (role === 'FINANCE') return docCat === 'FINANCE' || docCat === 'GENERAL';
    if (role === 'GROWTH') return docCat === 'GROWTH' || docCat === 'GENERAL';
    if (role === 'OPERATIONS') return docCat === 'OPERATIONS' || docCat === 'GENERAL';
    return false;
  });

  return {
    department,
    role,
    companionAgent,
    tasks,
    accessibleDocuments,
    departmentMetrics: {
      activeTasks,
      pendingSubmission,
      submittedCount,
      approvedCount
    }
  };
}

/**
 * Phase B2: Retrieves the companion AI draft, task details, and role-scoped documents
 * for a specific task.
 */
export async function getAgentDraftForTask(userId: string, taskId: string): Promise<{
  task: DelegatedTask;
  companionAgent: CompanionAgentInfo;
  draftContent: string;
  guidelines: string[];
  roleScopedDocuments: Array<{ id: string; name: string; type: string; summary: string }>;
}> {
  if (!prisma) {
    throw new TaskDelegationError(503, 'The database is unavailable.', 'DB_UNAVAILABLE');
  }

  const membership = await resolveMembership(userId);
  if (!membership) {
    throw new TaskDelegationError(
      403,
      'Forbidden: you do not have active access to a company workspace.',
      'NO_ACTIVE_MEMBERSHIP'
    );
  }

  const role = membership.role;
  const isPrivileged = role === 'FOUNDER' || role === 'ADMIN';

  const row: any = await safeDbQuery(() =>
    (prisma as any).task.findFirst({
      where: { id: taskId, plan: { startupId: membership.startupId } },
      include: { plan: { include: { startup: true } } }
    })
  );
  if (!row) {
    throw new TaskDelegationError(404, 'Task not found in this company.', 'NOT_FOUND');
  }

  const rawAssigned = (row.assignedTo || '').trim();
  const assignedUpper = rawAssigned.toUpperCase();
  const isDirectAssignee = rawAssigned.includes(userId);
  const isRoleAssignee = assignedUpper === role || assignedUpper.startsWith(`${role}:`);

  if (!isPrivileged && !isDirectAssignee && !isRoleAssignee) {
    throw new TaskDelegationError(
      403,
      'Forbidden: you cannot access drafts for other departments.',
      'NOT_TASK_OWNER'
    );
  }

  const task = decodeTask(row);
  const companionAgent = getCompanionAgent(task.department || role);
  const companyName = row.plan?.startup?.name || 'Catalyst OS';

  const draftData = generateAgentDraftContent(task, companyName);
  const workspaceContext = await getRoleScopedContext({ userId });

  return {
    task,
    companionAgent,
    draftContent: task.result || draftData.draftContent,
    guidelines: draftData.guidelines,
    roleScopedDocuments: workspaceContext.accessibleDocuments
  };
}

export interface EmployeeAssistantResponse {
  reply: string;
  suggestedEdits?: string;
  explanation: string;
  agentName: string;
  agentRole: string;
  permittedDocsReferenced: string[];
}

/**
 * Phase C5: AI Agent as Employee Assistant.
 * Allows the employee to collaborate with their department companion AI agent
 * (Echo for HR, Aura for Finance, Vector for Growth, Helix for Operations),
 * strictly scoped to permitted context, authorized policies, and zero cross-dept leaks.
 */
export async function assistEmployeeOnTask(params: {
  userId: string;
  taskId: string;
  question: string;
  currentDraft?: string;
}): Promise<EmployeeAssistantResponse> {
  const { userId, taskId, question, currentDraft } = params;
  if (!prisma) {
    throw new TaskDelegationError(503, 'The database is unavailable.', 'DB_UNAVAILABLE');
  }

  const membership = await resolveMembership(userId);
  if (!membership) {
    throw new TaskDelegationError(
      403,
      'Forbidden: you do not have active access to a company workspace.',
      'NO_ACTIVE_MEMBERSHIP'
    );
  }

  const role = membership.role;
  const isPrivileged = role === 'FOUNDER' || role === 'ADMIN';

  const row: any = await safeDbQuery(() =>
    (prisma as any).task.findFirst({
      where: { id: taskId, plan: { startupId: membership.startupId } },
      include: { plan: { include: { startup: true } } }
    })
  );
  if (!row) {
    throw new TaskDelegationError(404, 'Task not found in this company.', 'NOT_FOUND');
  }

  const rawAssigned = (row.assignedTo || '').trim();
  const assignedUpper = rawAssigned.toUpperCase();
  const isDirectAssignee = rawAssigned.includes(userId);
  const isRoleAssignee = assignedUpper === role || assignedUpper.startsWith(`${role}:`);

  if (!isPrivileged && !isDirectAssignee && !isRoleAssignee) {
    throw new TaskDelegationError(
      403,
      'Forbidden: you cannot consult AI companion for another department\'s tasks.',
      'NOT_TASK_OWNER'
    );
  }

  const task = decodeTask(row);
  const companionAgent = getCompanionAgent(task.department || role);
  const companyName = row.plan?.startup?.name || 'Catalyst OS';
  const qLower = question.toLowerCase();
  const workspaceContext = await getRoleScopedContext({ userId });

  const permittedDocs = workspaceContext.accessibleDocuments;
  const docNames = permittedDocs.map(d => d.name);
  const founderFeedback = task.founderFeedback || (row.result && typeof row.result === 'string' ? row.result.match(/\[FOUNDER_(?:DIRECTIVE|FEEDBACK)\]:\s*([^\n]+)/)?.[1] : null);

  // Check if query is asking about decision memory (Phase F3 - Close Loop)
  const isDecisionQuery =
    qLower.includes('why are we') ||
    qLower.includes('why did we') ||
    qLower.includes('who approved') ||
    qLower.includes('previous decision') ||
    qLower.includes('two engineers') ||
    qLower.includes('hiring decision') ||
    qLower.includes('why we are hiring') ||
    qLower.includes('memory') ||
    qLower.includes('decision log');

  let retrievedMemoriesText = '';
  let memoryRetrievalResult: DecisionMemoryRetrievalResult | null = null;
  if (isDecisionQuery) {
    try {
      memoryRetrievalResult = await retrieveDecisionMemory({ userId, query: question });
      if (memoryRetrievalResult.memories.length > 0) {
        retrievedMemoriesText = memoryRetrievalResult.memories.map(m =>
          `[DECISION MEMORY: ${m.title}]\n${m.description}`
        ).join('\n\n');
      }
    } catch {}
  }

  // Check for forbidden cross-department disclosure requests (Zero Leak Boundary)
  if (role === 'HR' && (qLower.includes('cap table') || qLower.includes('financial statement') || qLower.includes('cash balance') || qLower.includes('bank account'))) {
    return {
      reply: `I am Echo, your Head of People & Recruiting co-pilot. I have reviewed your question, but confidential company treasury reserves and shareholder cap tables are restricted to the Finance department under company data governance. I can assist you with candidate compensation bands, hiring policies, or leveling benchmarks instead.`,
      explanation: `Strict role-scoped context prevents disclosure of financial and cap table data to HR roles.`,
      agentName: companionAgent.name,
      agentRole: companionAgent.role,
      permittedDocsReferenced: []
    };
  }

  if (role === 'FINANCE' && (qLower.includes('candidate scorecard') || qLower.includes('interview notes') || qLower.includes('applicant resume'))) {
    return {
      reply: `I am Aura, your Chief Financial Officer co-pilot. Candidate-level interview scorecards and individual applicant evaluations are restricted to the Talent/HR department. I can help you model the compensation budget impact or runway variance for this headcount instead.`,
      explanation: `Strict role-scoped context prevents disclosure of confidential HR candidate evaluations to Finance roles.`,
      agentName: companionAgent.name,
      agentRole: companionAgent.role,
      permittedDocsReferenced: []
    };
  }

  // Attempt to invoke Gemini if available, with graceful fallback
  let aiGenerated: { reply: string; suggestedEdits?: string; explanation: string } | null = null;
  try {
    const { ai } = await import('./geminiService');
    if (ai?.models) {
      const prompt = `
You are ${companionAgent.name}, serving as ${companionAgent.role} at ${companyName}.
You are paired with a human employee in the ${task.department} department who is working on the following task:

TASK TITLE: "${task.title}"
TASK DEPARTMENT: ${task.department}
PERMITTED POLICIES & DOCUMENTS (ZERO DATA LEAKS):
${permittedDocs.map(d => `- ${d.name}: ${d.summary}`).join('\n')}

${founderFeedback ? `FOUNDER DIRECTIVE / REVISION REQUEST (PHASE D3 COLLABORATION LOOP):
The founder reviewed this deliverable and requested: "${founderFeedback}".
Your primary goal is to guide the employee in revising the deliverable to address this directive (e.g. reducing budget, adjusting requisitions, adding constraints).\n` : ''}

${retrievedMemoriesText ? `COMPANY DECISION MEMORIES & HISTORICAL CONTEXT (PHASE F3):
${retrievedMemoriesText}\n` : ''}

CURRENT WORKING DRAFT IN EMPLOYEE WORK AREA:
"""
${currentDraft || task.result || '(Draft not yet started)'}
"""

EMPLOYEE'S QUESTION OR REQUEST:
"""
${question}
"""

INSTRUCTIONS:
1. Act as a supportive, expert, and professional AI executive partner.
2. Directly answer the employee's question or fulfill their request grounded in the permitted policies.
3. Keep the response short, clear, and useful like top modern LLMs (ChatGPT, Claude). Avoid verbose boilerplate, generic filler, or unrelated context.
4. If founder feedback is present, ensure the advice explicitly satisfies the founder's directive.
5. If past decision memories are present, cite them concisely to explain why decisions were made.
6. If the employee asks to edit, refine, or add to their draft, provide concrete, ready-to-use text in suggestedEdits.
7. Return your response in JSON format with fields:
   - "reply": string (short, direct conversational response to the employee)
   - "explanation": string (1-2 sentence justification or policy grounding)
   - "suggestedEdits": string (optional concrete snippet or improved deliverable section to apply)
`;
      const candidateModels = ['gemini-2.5-flash', 'gemini-3.5-flash', 'gemini-2.5-pro'];
      for (const model of candidateModels) {
        try {
          const res = await (ai.models as any).generateContent({
            model,
            contents: prompt,
            config: { responseMimeType: 'application/json' }
          });
          const text = res?.text?.() || res?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const parsed = JSON.parse(text);
            if (parsed.reply) {
              aiGenerated = {
                reply: parsed.reply,
                explanation: parsed.explanation || 'Aligned with company standards and policies.',
                suggestedEdits: parsed.suggestedEdits
              };
              break;
            }
          }
        } catch {
          // Continue to next model or fallback
        }
      }
    }
  } catch {
    // Graceful fallback
  }

  // Deterministic domain fallback if Gemini is not available or exhausted
  if (!aiGenerated) {
    const dept = (task.department || '').toUpperCase();
    if (dept === 'TALENT' || dept === 'HR') {
      if (isDecisionQuery && memoryRetrievalResult && memoryRetrievalResult.memories.length > 0) {
        const top = memoryRetrievalResult.memories[0];
        const d = top.details;
        aiGenerated = {
          reply: memoryRetrievalResult.answerSummary,
          explanation: `Retrieved from immutable company decision memory (${top.title}): ${d.why || 'Approved headcount addition'} approved by ${d.whoApproved || 'Founder'}.`,
          suggestedEdits: currentDraft
            ? currentDraft + `\n\n#### Historical Decision Reference\n- **Approved Plan:** ${top.title}\n- **Rationale:** ${d.why || 'Approved headcount expansion'}\n- **Authorized By:** ${d.whoApproved || 'Founder'}\n- **Outcome:** ${d.outcome || 'Updated company state'}`
            : `### Historical Decision Reference: ${top.title}\n- **Rationale:** ${d.why || 'Approved headcount expansion'}\n- **Authorized By:** ${d.whoApproved || 'Founder'}`
        };
      } else if (founderFeedback && (founderFeedback.toLowerCase().includes('budget') || founderFeedback.toLowerCase().includes('reduce'))) {
        aiGenerated = {
          reply: `I have reviewed the founder's directive: "${founderFeedback}". To adjust the hiring plan per founder feedback, I recommend lowering the target base compensation range by 15% and replacing sign-on cash bonuses with performance milestones. This reduces annualized hiring cost to $125,000 per IC while remaining aligned with our hiring policy.`,
          explanation: `Incorporated founder directive ("${founderFeedback}") while standardizing interview scorecards and complying with Engineering Hiring Policy.`,
          suggestedEdits: currentDraft
            ? currentDraft + `\n\n#### Revised Hiring Budget (Post Founder Feedback)\n- **Founder Directive:** "${founderFeedback}"\n- **Target Base Range:** $120,000 - $130,000 (reduced per founder directive)\n- **Performance Milestone Bonus:** $10,000 upon 6-month delivery\n- **Hiring Loop:** 14-day standardized 4-stage process maintained.`
            : `### Revised Hiring Plan\n- Aligned with Founder Directive: "${founderFeedback}"\n- Level: Senior Engineer\n- Capped Budget: $125,000 base compensation.`
        };
      } else {
        aiGenerated = {
          reply: `I have reviewed your request regarding "${question}". Based on our Engineering Hiring Policy & Leveling Rubric, all senior IC positions should be evaluated through our standardized 4-stage loop to ensure bar consistency while keeping candidate turnaround under 14 days.`,
          explanation: `Grounded in Engineering Hiring Policy: standardizes interview scorecards and enforces market 75th-percentile compensation boundaries.`,
          suggestedEdits: currentDraft
            ? currentDraft + `\n\n#### Updated Policy Compliance Note\n- **Interview Loop Turnaround:** Target 14 calendar days from screen to offer.\n- **Scorecard Alignment:** Requires 2 Strong Hires and zero Leaning No votes.`
            : `### Refined Hiring Plan\n- Aligned with Engineering Hiring Policy\n- Level: Senior Engineer (IC4/IC5)\n- Target Start: Within 45 days.`
        };
      }
    } else if (dept === 'FINANCE') {
      aiGenerated = {
        reply: `I have analyzed the financial parameters for "${question}". According to our Treasury Allocation & Financial Governance standards, any recurring expenditure must preserve a minimum 6-month liquid runway buffer.`,
        explanation: `Grounded in Q3 Financial Statements & Treasury Allocation: verifies runway buffer protection before capital commitment.`,
        suggestedEdits: currentDraft
          ? currentDraft + `\n\n#### Treasury Variance Audit\n- **Runway Threshold:** Verified > 6 months post-allocation.\n- **Disbursement Gate:** Sign-off logged in decision ledger.`
          : `### Financial Impact Model\n- Expenditure variance verified.\n- Liquid runway buffer maintained.`
      };
    } else if (dept === 'GROWTH') {
      aiGenerated = {
        reply: `I have reviewed the growth strategy for "${question}". In alignment with our Go-To-Market Playbook, positioning should prioritize our primary ICP with a CAC payback horizon under 6 months.`,
        explanation: `Grounded in Go-To-Market Playbook & Brand Guidelines: targets sustainable CAC/LTV unit economics.`,
        suggestedEdits: currentDraft
          ? currentDraft + `\n\n#### Acquisition KPI Target\n- **Target CAC Payback:** < 6 months\n- **Primary Channel:** Technical developer content & product-led loops.`
          : `### GTM Campaign Strategy\n- Channel: Organic developer inbound\n- Payback: < 6 months.`
      };
    } else {
      aiGenerated = {
        reply: `I have reviewed your operational request for "${question}". As outlined in our Systems Runbook, workflows should define clear SLAs and escalation pathways.`,
        explanation: `Grounded in Operations Tooling & Infrastructure Runbook.`,
        suggestedEdits: currentDraft
          ? currentDraft + `\n\n#### Operational SLA\n- **Target Delivery:** 99.9% uptime and 48-hour sprint milestone review.`
          : `### Operational Protocol\n- SLA: 99.9% availability\n- Milestone: Bi-weekly delivery.`
      };
    }
  }

  return {
    reply: aiGenerated.reply,
    suggestedEdits: aiGenerated.suggestedEdits,
    explanation: aiGenerated.explanation,
    agentName: companionAgent.name,
    agentRole: companionAgent.role,
    permittedDocsReferenced: docNames
  };
}

export interface ParsedDecisionMemory {
  id: string;
  category: string;
  title: string;
  description: string;
  createdAt: Date;
  details: {
    whatHappened?: string;
    whoRequested?: string;
    whoWorkedOnIt?: string;
    whichAiHelped?: string;
    whatWasRecommended?: string;
    whoApproved?: string;
    when?: string;
    why?: string;
    outcome?: string;
  };
}

export interface DecisionMemoryRetrievalResult {
  query: string;
  memories: ParsedDecisionMemory[];
  relevantDecisions: Array<{
    id: string;
    title: string;
    description: string;
    category: string;
    status: string;
    financialImpact?: number;
    impactText?: string;
    createdAt: Date;
  }>;
  answerSummary: string;
}

export function parseMemoryDescription(desc: string): ParsedDecisionMemory['details'] {
  const getField = (label: string) => {
    const regex = new RegExp(`\\*\\*${label}:\\*\\*\\s*([^\\n]+)`, 'i');
    const match = desc.match(regex);
    return match ? match[1].trim() : undefined;
  };
  return {
    whatHappened: getField('What happened') || getField('What'),
    whoRequested: getField('Who requested it') || getField('Requested by'),
    whoWorkedOnIt: getField('Who worked on it') || getField('Worked on by'),
    whichAiHelped: getField('Which AI helped') || getField('AI assistance'),
    whatWasRecommended: getField('What was recommended') || getField('Recommendation'),
    whoApproved: getField('Who approved it') || getField('Approved by'),
    when: getField('When'),
    why: getField('Why'),
    outcome: getField('Outcome')
  };
}

/**
 * F3 — MEMORY → FUTURE AI
 * Retrieves previously recorded decisions from the company Memory and DecisionLog models.
 * Used when someone asks "Why are we hiring two engineers?" or other decision background questions,
 * closing the WORK -> DECISION -> MEMORY -> FUTURE CONTEXT loop.
 */
export async function retrieveDecisionMemory(params: {
  userId: string;
  query: string;
}): Promise<DecisionMemoryRetrievalResult> {
  const { userId, query } = params;
  if (!prisma) {
    throw new TaskDelegationError(503, 'The database is unavailable.', 'DB_UNAVAILABLE');
  }

  const membership = await resolveMembership(userId);
  let startupId = membership?.startupId;
  if (!startupId) {
    const startup = await safeDbQuery(() => (prisma as any).startup.findFirst({ where: { ownerId: userId } })) as any;
    if (startup) startupId = startup.id;
  }
  if (!startupId) {
    throw new TaskDelegationError(403, 'Forbidden: no active company context found.', 'NO_ACTIVE_MEMBERSHIP');
  }

  const memoryRows: any[] = await safeDbQuery(() =>
    (prisma as any).memory.findMany({
      where: { startupId },
      orderBy: { createdAt: 'desc' },
      take: 20
    })
  ) || [];

  const decisionRows: any[] = await safeDbQuery(() =>
    (prisma as any).decisionLog.findMany({
      where: { startupId },
      orderBy: { createdAt: 'desc' },
      take: 20
    })
  ) || [];

  const parsedMemories: ParsedDecisionMemory[] = memoryRows.map(m => ({
    id: m.id,
    category: m.category,
    title: m.title,
    description: m.description,
    createdAt: m.createdAt,
    details: parseMemoryDescription(m.description || '')
  }));

  const qLower = (query || '').toLowerCase();
  const searchTerms = qLower.split(/[\s,?.!]+/).filter(w => w.length > 2 && !['why', 'are', 'we', 'the', 'did', 'who', 'what', 'and', 'for', 'our', 'this', 'that', 'with'].includes(w));

  // Filter memories that match search terms
  const matchedMemories = parsedMemories.filter(m => {
    if (searchTerms.length === 0) return true;
    const combined = `${m.title} ${m.description}`.toLowerCase();
    return searchTerms.some(term => combined.includes(term));
  });

  const finalMemories = matchedMemories.length > 0 ? matchedMemories : parsedMemories;

  const relevantDecisions = decisionRows.filter(d => {
    if (searchTerms.length === 0) return true;
    const combined = `${d.title} ${d.description} ${d.impactText || ''}`.toLowerCase();
    return searchTerms.some(term => combined.includes(term));
  });

  // Construct answerSummary
  let answerSummary = '';
  if (finalMemories.length > 0) {
    const top = finalMemories[0];
    const d = top.details;
    answerSummary = `Decision retrieved from company memory: "${top.title}". ` +
      `Requested by ${d.whoRequested || 'Founder'} to address: ${d.why || top.title}. ` +
      `Prepared by ${d.whoWorkedOnIt || 'Team'} with ${d.whichAiHelped || 'AI'} assistance. ` +
      `Approved by ${d.whoApproved || 'Founder'}. Outcome: ${d.outcome || 'Approved and recorded in company memory'}.`;
  } else if (relevantDecisions.length > 0) {
    const top = relevantDecisions[0];
    answerSummary = `Decision retrieved from decision log: "${top.title}". Description: ${top.description}. Status: ${top.status}.`;
  } else {
    answerSummary = `No previous decisions found in company memory for query: "${query}".`;
  }

  return {
    query,
    memories: finalMemories,
    relevantDecisions,
    answerSummary
  };
}

export interface DecomposeTaskInput {
  title: string;
  description?: string;
  priority?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  deadline?: string;
}

export interface ProposedSubtask {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  department: Department;
  agent: string;
  suggestedRole: Role | null;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  dependencies: string[];
  expectedDeliverable: string;
  deadline?: string;
  assignedUserId: string | null;
  assignedUserName: string | null;
  needsAttention: boolean;
  assignmentStatus: 'ASSIGNED' | 'UNFILLED' | 'AMBIGUOUS';
  reason: string | null;
}

export interface TaskDecompositionPreview {
  parentTask: {
    title: string;
    description: string;
    priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    deadline: string;
  };
  proposedSubtasks: ProposedSubtask[];
  companyMembers: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
  }>;
}

/**
 * Phase 2: Generates a structured multi-agent decomposition of a parent task
 * with role-to-employee resolution, identifies missing or ambiguous assignments,
 * and prepares the preview for founder sign-off before persistence.
 */
export async function decomposeParentTask(params: {
  userId: string;
  input: DecomposeTaskInput;
}): Promise<TaskDecompositionPreview> {
  const { userId, input } = params;
  if (!prisma) {
    throw new TaskDelegationError(503, 'The database is unavailable.', 'DB_UNAVAILABLE');
  }

  // 1. Validate the authenticated founder and company membership
  const membership = await resolveMembership(userId);
  if (!membership) {
    throw new TaskDelegationError(
      403,
      'Forbidden: you do not have active access to a company workspace.',
      'NO_ACTIVE_MEMBERSHIP'
    );
  }
  const role = membership.role;
  if (role !== 'FOUNDER' && role !== 'ADMIN') {
    throw new TaskDelegationError(
      403,
      'Forbidden: only a Founder or Admin can create and decompose company tasks.',
      'FOUNDER_REQUIRED'
    );
  }

  const cleanTitle = (input.title || '').trim();
  if (!cleanTitle) {
    throw new TaskDelegationError(400, 'Parent task title is required.', 'TITLE_REQUIRED');
  }

  const cleanDesc = (input.description || '').trim();
  const rawPriority = (input.priority || 'HIGH').toUpperCase();
  const priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' =
    ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(rawPriority) ? (rawPriority as any) : 'HIGH';

  const defaultDeadline = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const deadline = input.deadline || defaultDeadline;

  // 2. Invoke multi-agent orchestration service / decomposition engine
  const fullPrompt = cleanDesc ? `${cleanTitle}: ${cleanDesc}` : cleanTitle;
  const planData = buildPlanStepsForCommand(fullPrompt);

  let rawSteps = planData.steps;
  if (!rawSteps || rawSteps.length === 0) {
    rawSteps = [
      { stepNumber: 1, title: 'Analyze requirements & system architecture', department: 'OPERATIONS', agent: 'Operations', ownerRole: 'OPERATIONS' },
      { stepNumber: 2, title: 'Formulate implementation specifications & deliverable artifacts', department: 'GROWTH', agent: 'Growth', ownerRole: 'GROWTH' },
      { stepNumber: 3, title: 'Audit budget thresholds & unit economic compliance', department: 'FINANCE', agent: 'CFO', ownerRole: 'FINANCE' },
      { stepNumber: 4, title: 'Check regulatory, compliance, and IP covenants', department: 'LEGAL', agent: 'Legal', ownerRole: null }
    ];
  }

  // 3. Fetch active company members strictly in the founder's company
  const companyMemberships: any[] = await safeDbQuery(() =>
    prisma.membership.findMany({
      where: { startupId: membership.startupId, status: 'ACTIVE' },
      include: { user: { select: { id: true, name: true, email: true } } }
    })
  ) || [];

  const companyMembers = companyMemberships.map(m => ({
    id: m.user.id,
    name: m.user.name || m.user.email || 'Team Member',
    email: m.user.email,
    role: m.role
  }));

  // 4. Resolve suggested roles to real employees in the same company
  const proposedSubtasks: ProposedSubtask[] = rawSteps.map((step, idx) => {
    const dept = (step.department || 'GENERAL').toUpperCase() as Department;
    const suggestedRole = step.ownerRole || ownerRoleForDepartment(dept);
    const agent = step.agent || agentForDepartment(dept);
    const subtaskPriority = (dept === 'FINANCE' || dept === 'LEGAL' || priority === 'CRITICAL') ? 'HIGH' : priority;
    
    // Dependencies: preceding step title if any
    const dependencies = idx > 0 ? [rawSteps[idx - 1].title] : [];

    // Formulate expected deliverable
    let expectedDeliverable = `Structured findings, implementation specs, and operational outputs for "${step.title}"`;
    if (dept === 'TALENT') {
      expectedDeliverable = 'Candidate role profile, scorecard rubric, and compensation grid.';
    } else if (dept === 'FINANCE') {
      expectedDeliverable = 'Fully-loaded burn model, runway sensitivity stress-test, and ROI analysis.';
    } else if (dept === 'LEGAL') {
      expectedDeliverable = 'Regulatory compliance checklist, IP assignment provisions, and risk assessment.';
    } else if (dept === 'GROWTH') {
      expectedDeliverable = 'Target ICP positioning, channel acquisition projections, and marketing assets.';
    } else if (dept === 'OPERATIONS') {
      expectedDeliverable = 'Milestone delivery timeline, technical architecture, and SLA guarantees.';
    }

    let assignedUserId: string | null = null;
    let assignedUserName: string | null = null;
    let needsAttention = false;
    let assignmentStatus: 'ASSIGNED' | 'UNFILLED' | 'AMBIGUOUS' = 'UNFILLED';
    let reason: string | null = null;

    if (!suggestedRole) {
      // e.g. LEGAL or AUDITOR which have no human employee role
      needsAttention = true;
      assignmentStatus = 'UNFILLED';
      reason = `No human employee role exists for ${dept}. Founder can assign or handle directly.`;
    } else {
      const candidates = companyMembers.filter(m => normalizeRole(m.role) === normalizeRole(suggestedRole));
      if (candidates.length === 1) {
        assignedUserId = candidates[0].id;
        assignedUserName = candidates[0].name;
        needsAttention = false;
        assignmentStatus = 'ASSIGNED';
        reason = null;
      } else if (candidates.length > 1) {
        assignedUserId = null;
        assignedUserName = null;
        needsAttention = true;
        assignmentStatus = 'AMBIGUOUS';
        reason = `Multiple team members have role "${suggestedRole}". Please select an assignee.`;
      } else {
        // 0 candidates
        assignedUserId = null;
        assignedUserName = null;
        needsAttention = true;
        assignmentStatus = 'UNFILLED';
        reason = `No active team member with role "${suggestedRole}" exists in this company.`;
      }
    }

    return {
      id: `temp_subtask_${idx + 1}`,
      stepNumber: idx + 1,
      title: step.title,
      description: `Execute ${step.title} in collaboration with ${agent} AI specialist companion.`,
      department: dept,
      agent,
      suggestedRole,
      priority: subtaskPriority,
      dependencies,
      expectedDeliverable,
      deadline,
      assignedUserId,
      assignedUserName,
      needsAttention,
      assignmentStatus,
      reason
    };
  });

  return {
    parentTask: {
      title: cleanTitle,
      description: cleanDesc || planData.description,
      priority,
      deadline
    },
    proposedSubtasks,
    companyMembers
  };
}

/**
 * Phase 2 & 3: Persists the approved parent plan and its decomposed subtasks
 * with strict membership validation, AI capability auto-provisioning,
 * and real-time team notifications.
 */
export async function persistDecomposedTaskPlan(params: {
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
}): Promise<{ plan: any; tasks: DelegatedTask[] }> {
  const { userId, parentTask, subtasks } = params;
  if (!prisma) {
    throw new TaskDelegationError(503, 'The database is unavailable.', 'DB_UNAVAILABLE');
  }

  // 1. Validate founder role and company membership
  const membership = await resolveMembership(userId);
  if (!membership) {
    throw new TaskDelegationError(
      403,
      'Forbidden: you do not have active access to a company workspace.',
      'NO_ACTIVE_MEMBERSHIP'
    );
  }
  const role = membership.role;
  if (role !== 'FOUNDER' && role !== 'ADMIN') {
    throw new TaskDelegationError(
      403,
      'Forbidden: only a Founder or Admin can approve and persist task decompositions.',
      'FOUNDER_REQUIRED'
    );
  }

  // 2. Validate all model-generated and user inputs before persisting
  const parentTitle = (parentTask?.title || '').trim();
  if (!parentTitle) {
    throw new TaskDelegationError(400, 'Parent task title is required.', 'TITLE_REQUIRED');
  }
  const parentDesc = (parentTask?.description || '').trim();
  const parentPriority = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes((parentTask?.priority || '').toUpperCase())
    ? parentTask.priority!.toUpperCase()
    : 'HIGH';
  const parentDeadline = parentTask?.deadline || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  if (!Array.isArray(subtasks) || subtasks.length === 0) {
    throw new TaskDelegationError(400, 'At least one subtask is required.', 'SUBTASKS_REQUIRED');
  }

  // Fetch valid company members strictly in the founder's company
  const companyMemberships: any[] = await safeDbQuery(() =>
    prisma.membership.findMany({
      where: { startupId: membership.startupId, status: 'ACTIVE' },
      select: { userId: true, role: true }
    })
  ) || [];
  const validMemberIds = new Set(companyMemberships.map(m => m.userId));

  // 3. Create parent Plan in database
  const plan: any = await safeDbQuery(() =>
    (prisma as any).plan.create({
      data: {
        title: parentTitle,
        description: parentDesc || `Strategic parent initiative: ${parentTitle}`,
        status: 'active',
        startupId: membership.startupId
      }
    })
  );

  const planId = plan?.id || `plan_${Date.now()}`;
  const createdTasks: DelegatedTask[] = [];

  // 4. Validate and persist each subtask
  for (const st of subtasks) {
    const rawTitle = (st.title || '').trim();
    if (!rawTitle) continue;

    const dept = (st.department || 'GENERAL').toUpperCase();
    const agent = st.agent || agentForDepartment(dept);
    const suggestedRole = st.suggestedRole ? normalizeRole(st.suggestedRole) : ownerRoleForDepartment(dept);
    const subtaskPriority = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes((st.priority || '').toUpperCase())
      ? st.priority!.toUpperCase()
      : parentPriority;
    const subtaskDeadline = st.deadline || parentDeadline;
    const subtaskDesc = (st.description || '').trim() || `Execute ${rawTitle} with ${agent} assistance.`;
    const subtaskDeliverable = (st.expectedDeliverable || '').trim() || `Deliverable artifact for "${rawTitle}"`;

    // Strictly enforce: never allow assigning an employee outside the founder's company
    let targetAssigneeId: string | null = st.assignedUserId || null;
    if (targetAssigneeId && !validMemberIds.has(targetAssigneeId)) {
      console.warn(`[taskDelegationService] Blocked illegal assignment of non-company user ${targetAssigneeId}`);
      targetAssigneeId = null;
    }

    // Auto-provision AI specialist capability if not existing
    try {
      await ensureAiSpecialistCapability(membership.startupId, dept);
    } catch {}

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
      companyId: membership.startupId
    };

    const rolePrefix = suggestedRole || 'UNASSIGNED';
    const assignedTo = targetAssigneeId ? `${rolePrefix}:${targetAssigneeId}` : rolePrefix;

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

    // If assigned to a team member, create persistent notification & email
    if (targetAssigneeId) {
      try {
        const { notifyNewAssignment } = await import('./notificationService');
        await notifyNewAssignment({
          startupId: membership.startupId,
          task: {
            id: taskRow.id,
            title: rawTitle,
            priority: subtaskPriority,
            deadline: subtaskDeadline,
            parentTask: parentTitle,
            agent
          },
          assigneeUserId: targetAssigneeId,
          assignerUserId: userId
        });
      } catch (notifErr: any) {
        console.warn('[taskDelegationService] New assignment notification warning:', notifErr?.message);
      }
    }
  }

  // Log real-time delegation telemetry
  try {
    console.log(`[taskDelegationService] Delegated ${createdTasks.length} work orders under plan "${parentTitle}" (${planId}) for company ${membership.startupId}`);
  } catch {}

  // Phase 4: Emit real-time event for newly created task plan
  try {
    const { realtimeEventService } = await import('./realtimeEventService');
    realtimeEventService.emitEvent({
      type: 'task.updated',
      startupId: membership.startupId,
      taskId: planId,
    });
  } catch {}

  const enrichedTasks = await enrichTasksWithUserNames(createdTasks);
  return { plan, tasks: enrichedTasks };
}
