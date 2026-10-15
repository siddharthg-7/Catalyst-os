import { prisma, safeDbQuery } from './dbService';
import { companyContextService } from './companyContextService';
import { startupProfile, approvals, decisionLog, initiatives, isDbAvailable, persistCurrentState } from '../state';
import { Deliverable, StartupProfile, DecisionRecord } from '../src/models/types';
import { decisionLedgerService } from './decisionLedgerService';
import { idempotencyService } from './idempotencyService';

export interface CreateApprovalParams {
  startupId: string;
  title: string;
  description: string;
  type: string;
  content?: string;
  impact?: string;
  financialChange?: number;
  metricChanges?: Record<string, number>;
  planId?: string;
}

export interface ReviewApprovalParams {
  approvalId: string;
  userId: string;
  userRole?: string;
  startupId?: string;
  action: 'approve' | 'modify' | 'reject' | 'request_changes' | 'changes_requested';
  feedback?: string;
  idempotencyKey?: string;
  modifications?: {
    financialChange?: number;
    headcount?: number;
    conditions?: string;
  };
  /** For testing: force execution failure to test failure handling boundary */
  simulateExecutionFailure?: boolean;
}

export interface ReverseApprovalParams {
  approvalId: string;
  userId: string;
  userRole?: string;
  reason?: string;
}

export interface ReverseApprovalResult {
  success: boolean;
  statusCode?: number;
  error?: string;
  message?: string;
  item?: Deliverable;
  startupProfile?: StartupProfile;
  stateChangesApplied?: StateChangesApplied;
}

export interface StateChangesApplied {
  isStateChanging: boolean;
  cashBalanceDelta: number;
  burnRateDelta: number;
  teamSizeDelta: number;
  runwayMonths: number;
  healthScoreDelta: number;
}

export interface ReviewApprovalResult {
  success: boolean;
  statusCode?: number;
  error?: string;
  alreadyProcessed?: boolean;
  message?: string;
  item?: Deliverable;
  startupProfile?: StartupProfile;
  stateChangesApplied?: StateChangesApplied;
}

/**
 * Normalizes input type string to canonical Deliverable type.
 */
export function normalizeDeliverableType(type: string): 'document' | 'contract' | 'financials' | 'marketing_plan' | 'policy' {
  const t = (type || '').toLowerCase();
  if (t === 'contract') return 'contract';
  if (t === 'financial' || t === 'financials') return 'financials';
  if (t === 'marketing_plan' || t === 'marketing') return 'marketing_plan';
  if (t === 'policy' || t === 'legal') return 'policy';
  return 'document';
}

/**
 * Normalizes numbers or text representing team size and increments by countToAdd.
 * e.g. "5" -> "6", "4 engineers" -> "5 engineers", "1-5" -> "6"
 */
export function incrementTeamSize(existingDescription: string, countToAdd: number = 1): string {
  if (!existingDescription || existingDescription.trim() === '') {
    return `${countToAdd + 1} team members`;
  }
  const trimmed = existingDescription.trim();
  const match = trimmed.match(/(\d+)/);
  if (match) {
    const currentNum = parseInt(match[1], 10);
    const newNum = currentNum + countToAdd;
    return trimmed.replace(/\d+/, newNum.toString());
  }
  return `${trimmed} + ${countToAdd} new hire`;
}

/**
 * Maps a Prisma Approval record to standard Deliverable interface.
 */
export function mapApprovalToDeliverable(appr: any): Deliverable {
  let metricChanges: any = { velocity: 0, financialHealth: 0, legalCompliance: 0, growthRate: 0, operationsEfficiency: 0 };
  let extraMeta: any = {};
  if (appr.metricChanges) {
    if (typeof appr.metricChanges === 'string') {
      try {
        const parsed = JSON.parse(appr.metricChanges);
        extraMeta = parsed;
        metricChanges = { ...metricChanges, ...parsed };
      } catch {
        // ignore parse error
      }
    } else if (typeof appr.metricChanges === 'object') {
      extraMeta = appr.metricChanges;
      metricChanges = { ...metricChanges, ...appr.metricChanges };
    }
  }

  // Phase D2: Extract structured fields for Founder Approval Experience
  let preparedBy = extraMeta.preparedBy;
  let preparedByRole = extraMeta.preparedByRole;
  let aiAssistance = extraMeta.aiAssistance;
  let summary = extraMeta.summary || appr.description;
  let recommendation = extraMeta.recommendation;
  let taskId = extraMeta.taskId || (appr.id?.startsWith('appr_task_') ? appr.id.replace('appr_task_', '') : undefined);
  let founderFeedback = extraMeta.founderFeedback;

  // Fallbacks if not stored in metricChanges
  if (!preparedBy && appr.id?.startsWith('appr_task_')) {
    preparedBy = 'HR Employee';
    preparedByRole = 'HR';
  }
  if ((!aiAssistance || aiAssistance === 'Talent') && appr.id?.startsWith('appr_task_')) {
    aiAssistance = 'Echo';
  }
  if (!recommendation && aiAssistance) {
    recommendation = `Recommended for sign-off by ${aiAssistance} & Employee.`;
  }

  // Check if content has embedded founder directive
  if (!founderFeedback && typeof appr.content === 'string') {
    const match = appr.content.match(/\[FOUNDER_(?:DIRECTIVE|FEEDBACK)\]:\s*([^\n]+)/);
    if (match) founderFeedback = match[1].trim();
  }

  return {
    id: appr.id,
    initiativeId: appr.plan?.id || appr.planId || 'init_executive',
    title: appr.title,
    description: appr.description,
    type: normalizeDeliverableType(appr.type),
    content: appr.content || appr.description,
    impact: appr.impact || 'Requires founder verification.',
    financialChange: appr.financialChange ?? 0,
    status: (appr.status as any) || 'pending_review',
    metricChanges,
    preparedBy,
    preparedByRole,
    aiAssistance,
    summary,
    recommendation,
    taskId,
    founderFeedback
  };
}

export const processedApprovalsMap = new Map<string, Deliverable>();
export const approvalToStartupMap = new Map<string, string>();
export const userToStartupMap = new Map<string, string>();

export class ApprovalService {
  private simulateDegraded = false;

  public setDegradedMode(active: boolean) {
    this.simulateDegraded = active;
  }

  public isDegradedModeActive(): boolean {
    if (this.simulateDegraded) return true;
    if (process.env.NODE_ENV === 'production' && !isDbAvailable) return true;
    return false;
  }

  /**
   * Creates a structured executive Approval record linked to the startup's active plan.
   * Emits notification and invalidates context so pending approvals list is updated.
   */
  public async createApproval(params: CreateApprovalParams): Promise<Deliverable> {
    const {
      startupId,
      title,
      description,
      type,
      content,
      impact,
      financialChange = 0,
      metricChanges = {},
      planId
    } = params;

    if (!startupId) {
      throw new Error('startupId is required to create an approval.');
    }

    const approvalId = `appr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const deliverableItem: Deliverable = {
      id: approvalId,
      initiativeId: planId || 'init_executive',
      title,
      description,
      type: normalizeDeliverableType(type),
      content: content || description,
      impact: impact || 'Requires founder verification.',
      financialChange,
      status: 'pending_review',
      metricChanges: {
        velocity: 0,
        financialHealth: 0,
        legalCompliance: 0,
        growthRate: 0,
        operationsEfficiency: 0,
        ...metricChanges
      }
    };

    // Store in active in-memory array for fast-path local access
    approvals.unshift(deliverableItem);
    approvalToStartupMap.set(approvalId, startupId);

    if (isDbAvailable && prisma) {
      try {
        await safeDbQuery(async () => {
          let targetPlanId = planId;
          if (!targetPlanId) {
            const startupInDb = await prisma.startup.findUnique({
              where: { id: startupId }
            });
            if (!startupInDb) {
              return;
            }
            let activePlan = await prisma.plan.findFirst({
              where: { startupId }
            });
            if (!activePlan) {
              activePlan = await prisma.plan.create({
                data: {
                  title: 'Core Executive Operations',
                  description: 'Default continuous operating plan',
                  startupId,
                  status: 'active'
                }
              });
            }
            targetPlanId = activePlan.id;
          }

          await prisma.approval.create({
            data: {
              id: approvalId,
              title,
              description,
              type,
              status: 'pending_review',
              content: deliverableItem.content,
              impact: deliverableItem.impact,
              financialChange,
              metricChanges: deliverableItem.metricChanges || {},
              planId: targetPlanId
            }
          });

          await prisma.notification.create({
            data: {
              title: `Approval Required: ${title}`,
              message: `${description} requires founder review.`,
              type: 'APPROVAL',
              startupId
            }
          });
        }, 1);

        // Invalidate context cache to reflect newly pending approval
        companyContextService.invalidate(startupId);
      } catch (dbErr: any) {
        console.warn('[ApprovalService] DB query failed, maintained in memory state:', dbErr.message);
      }
    }

    return deliverableItem;
  }

  /**
   * Retrieves pending and recent approvals for the authenticated founder's startup.
   * Strictly enforces tenant scoping: returns only approvals belonging to the requesting user's startup.
   */
  public async getApprovalsForUser(userId: string): Promise<Deliverable[]> {
    if (!userId) {
      return [];
    }

    let userStartupId: string | null = userToStartupMap.get(userId) || null;
    if (!userStartupId && isDbAvailable && prisma) {
      const userStartup = await safeDbQuery(() =>
        prisma.startup.findFirst({
          where: { ownerId: userId },
          select: { id: true }
        })
      );
      if (userStartup) {
        userStartupId = userStartup.id;
        userToStartupMap.set(userId, userStartup.id);
      } else {
        const mem: any = await safeDbQuery(() =>
          (prisma as any).membership.findFirst({
            where: { userId, status: 'ACTIVE' },
            select: { startupId: true }
          })
        );
        if (mem?.startupId) {
          userStartupId = mem.startupId;
          userToStartupMap.set(userId, mem.startupId);
        }
      }
    }

    let dbApprovals: Deliverable[] = [];
    if (isDbAvailable && prisma && userStartupId) {
      const records = await safeDbQuery(() =>
        prisma.approval.findMany({
          where: {
            plan: {
              startupId: userStartupId!
            }
          },
          include: {
            plan: true
          },
          orderBy: { createdAt: 'desc' },
          take: 50
        })
      );

      if (records && records.length > 0) {
        dbApprovals = records.map(mapApprovalToDeliverable);
      }
    }

    // Merge with in-memory approvals (filtering for duplicates)
    const existingIds = new Set(dbApprovals.map(a => a.id));
    const memoryApprovals = approvals.filter(a => !existingIds.has(a.id));

    return [...dbApprovals, ...memoryApprovals];
  }

  /**
   * Reviews and executes an approval action ('approve' | 'reject').
   * Enforces:
   * 1. Authentication & Role Authorization (Founders/Admins only)
   * 2. Cross-Tenant Isolation (Users can only review approvals belonging to their company)
   * 3. Idempotency Guard (Already reviewed approvals cannot be re-executed or double-mutate state)
   * 4. State Mutation Boundary (Only supported state mutations persist to PostgreSQL)
   * 5. Clean Failure Handling (Failed executions do not falsely mutate company state)
   * 6. Context Invalidation (Refreshes Company Context after successful state changes)
   * 7. Audit Trail (Records in Execution, DecisionLog, and TimelineItem)
   */
  public async reviewApproval(params: ReviewApprovalParams): Promise<ReviewApprovalResult> {
    const { approvalId, userId, userRole, action, feedback, simulateExecutionFailure } = params;

    // 0. Degraded Mode Guard (Rule 3 & Section 14)
    if (this.isDegradedModeActive()) {
      return {
        success: false,
        statusCode: 503,
        error: 'Catalyst OS is operating in degraded read-only mode. Critical financial and executive state mutations are temporarily blocked because durable storage is unavailable.'
      };
    }

    // 0.1 Idempotency Lock Guard (Section 4 & 5)
    const effectiveTenantId = params.startupId || userToStartupMap.get(userId) || approvalToStartupMap.get(approvalId) || 'default';
    const lock = await idempotencyService.acquireLock({
      tenantId: effectiveTenantId,
      approvalId,
      action,
      idempotencyKey: params.idempotencyKey
    });

    if (!lock.acquired) {
      if (lock.status === 'completed' && lock.cachedResult) {
        return {
          ...lock.cachedResult,
          alreadyProcessed: true,
          message: `Approval has already been processed with status: "${lock.cachedResult.item?.status || 'approved'}". Duplicate execution prevented.`,
          stateChangesApplied: {
            isStateChanging: false,
            cashBalanceDelta: 0,
            burnRateDelta: 0,
            teamSizeDelta: 0,
            runwayMonths: lock.cachedResult.startupProfile?.runwayMonths || 0,
            healthScoreDelta: 0
          }
        };
      }
      if (lock.status === 'processing') {
        return {
          success: false,
          statusCode: 409,
          error: 'Conflict: An identical approval review operation is currently being processed by another worker or request.'
        };
      }
    }

    // 1. Authentication & Role Authorization
    if (!userId) {
      await idempotencyService.release({
        tenantId: effectiveTenantId,
        approvalId,
        action,
        idempotencyKey: params.idempotencyKey,
        error: 'Unauthorized'
      });
      return {
        success: false,
        statusCode: 401,
        error: 'Unauthorized: Authentication required to review approvals.'
      };
    }

    if (userRole && userRole === 'Executive') {
      await idempotencyService.release({
        tenantId: effectiveTenantId,
        approvalId,
        action,
        idempotencyKey: params.idempotencyKey,
        error: 'Forbidden'
      });
      return {
        success: false,
        statusCode: 403,
        error: 'Unauthorized: Executive accounts cannot review or approve deliverables. Please login as Founder.'
      };
    }

    // 2. Fetch Approval and Verify Tenant Scoping
    let dbApproval: any = null;
    let startup: any = null;

    if (isDbAvailable && prisma) {
      dbApproval = await safeDbQuery(() =>
        prisma.approval.findUnique({
          where: { id: approvalId },
          include: {
            plan: {
              include: {
                startup: true
              }
            }
          }
        })
      );
    }

    // Check in memory if already processed (Idempotency Guard)
    const alreadyProcessedMemory = processedApprovalsMap.get(approvalId);
    if (alreadyProcessedMemory) {
      const alreadyMemResult: ReviewApprovalResult = {
        success: true,
        alreadyProcessed: true,
        message: `Approval has already been processed with status: "${alreadyProcessedMemory.status}". Duplicate execution prevented.`,
        item: alreadyProcessedMemory,
        startupProfile: startupProfile,
        stateChangesApplied: {
          isStateChanging: false,
          cashBalanceDelta: 0,
          burnRateDelta: 0,
          teamSizeDelta: 0,
          runwayMonths: startupProfile.runwayMonths,
          healthScoreDelta: 0
        }
      };
      await idempotencyService.commit({
        tenantId: effectiveTenantId,
        approvalId,
        action,
        idempotencyKey: params.idempotencyKey,
        result: alreadyMemResult
      });
      return alreadyMemResult;
    }

    // In-memory Cross-Tenant Authorization Check
    const associatedStartupId = approvalToStartupMap.get(approvalId);
    const callerStartupId = params.startupId || userToStartupMap.get(userId);
    if (associatedStartupId && callerStartupId && associatedStartupId !== callerStartupId) {
      await idempotencyService.release({
        tenantId: effectiveTenantId,
        approvalId,
        action,
        idempotencyKey: params.idempotencyKey,
        error: 'Forbidden'
      });
      return {
        success: false,
        statusCode: 403,
        error: 'Forbidden: You do not have permission to review approvals for another company.'
      };
    }

    // Check in memory if not in DB
    const memoryIndex = approvals.findIndex(a => a.id === approvalId);
    const memoryApproval = memoryIndex !== -1 ? approvals[memoryIndex] : null;

    if (!dbApproval && !memoryApproval) {
      await idempotencyService.release({
        tenantId: effectiveTenantId,
        approvalId,
        action,
        idempotencyKey: params.idempotencyKey,
        error: 'NotFound'
      });
      return {
        success: false,
        statusCode: 404,
        error: 'Approval deliverable not found.'
      };
    }

    if (dbApproval) {
      startup = dbApproval.plan?.startup;
      // Cross-Tenant Authorization Check
      if (!startup || startup.ownerId !== userId) {
        await idempotencyService.release({
          tenantId: effectiveTenantId,
          approvalId,
          action,
          idempotencyKey: params.idempotencyKey,
          error: 'Forbidden'
        });
        return {
          success: false,
          statusCode: 403,
          error: 'Forbidden: You do not have permission to review approvals for another company.'
        };
      }
    }

    const currentStatus = dbApproval ? dbApproval.status : memoryApproval?.status;

    // 3. Idempotency Guard: prevent re-executing already processed approvals
    if (currentStatus !== 'pending_review' && currentStatus !== 'pending') {
      const deliverable = dbApproval ? mapApprovalToDeliverable(dbApproval) : memoryApproval!;
      const alreadyStatusResult: ReviewApprovalResult = {
        success: true,
        alreadyProcessed: true,
        message: `Approval has already been processed with status: "${currentStatus}". Duplicate execution prevented.`,
        item: deliverable,
        startupProfile: startupProfile,
        stateChangesApplied: {
          isStateChanging: false,
          cashBalanceDelta: 0,
          burnRateDelta: 0,
          teamSizeDelta: 0,
          runwayMonths: startupProfile.runwayMonths,
          healthScoreDelta: 0
        }
      };
      await idempotencyService.commit({
        tenantId: effectiveTenantId,
        approvalId,
        action,
        idempotencyKey: params.idempotencyKey,
        result: alreadyStatusResult
      });
      return alreadyStatusResult;
    }

    // 4. Handle REJECTION
    if (action === 'reject') {
      if (dbApproval && isDbAvailable && prisma) {
        await safeDbQuery(async () => {
          await prisma.approval.update({
            where: { id: approvalId },
            data: { status: 'rejected' }
          });

          if (approvalId.startsWith('appr_task_')) {
            const taskId = approvalId.replace('appr_task_', '');
            await (prisma as any).task.update({
              where: { id: taskId },
              data: { status: 'rejected' }
            }).catch(() => {});
          }

          await prisma.decisionLog.create({
            data: {
              title: `Reject: ${dbApproval.title}`,
              description: `Rejected by founder with feedback: "${feedback || 'No feedback provided'}"`,
              category: (dbApproval.type || 'OPERATIONS').toUpperCase(),
              impactText: 'No operational metrics modified.',
              financialImpact: 0,
              status: 'rejected',
              startupId: startup.id
            }
          });

          await prisma.timelineItem.create({
            data: {
              title: `Rejected: ${dbApproval.title}`,
              content: `Founder rejected proposed deliverable. Feedback: "${feedback || 'None'}"`,
              type: 'rejection',
              startupId: startup.id
            }
          });
        }, 3);

        // Invalidate context to update pendingApprovals count
        companyContextService.invalidate(startup.id);
        companyContextService.invalidate(userId);
      }

      if (memoryApproval) {
        memoryApproval.status = 'rejected';
        decisionLog.unshift({
          id: `dec_${Date.now()}`,
          title: `Reject: ${memoryApproval.title}`,
          description: `Rejected by founder with feedback: "${feedback || 'No feedback provided'}"`,
          category: memoryApproval.type.toUpperCase(),
          timestamp: new Date().toISOString(),
          impactText: 'No operational metrics modified.',
          financialImpact: 0,
          status: 'rejected'
        });
        if (memoryIndex !== -1) approvals.splice(memoryIndex, 1);
        persistCurrentState();
      }

      decisionLedgerService.appendEvent({
        decisionId: approvalId,
        startupId: startup?.id || 'stp_default',
        workflowId: dbApproval?.initiativeId || memoryApproval?.initiativeId || approvalId,
        actor: `Founder (${userId})`,
        eventType: 'FOUNDER_REJECTED',
        payload: { feedback: feedback || null }
      });

      const item = dbApproval ? mapApprovalToDeliverable({ ...dbApproval, status: 'rejected' }) : memoryApproval!;
      processedApprovalsMap.set(approvalId, item);

      const rejectResult: ReviewApprovalResult = {
        success: true,
        message: 'Deliverable rejected and recorded in decision ledger.',
        item,
        startupProfile: await this.buildStartupProfile(startup),
        stateChangesApplied: {
          isStateChanging: false,
          cashBalanceDelta: 0,
          burnRateDelta: 0,
          teamSizeDelta: 0,
          runwayMonths: startup ? (startup.burnRate > 0 ? parseFloat((startup.cashBalance / startup.burnRate).toFixed(1)) : 999) : 0,
          healthScoreDelta: 0
        }
      };

      await idempotencyService.commit({
        tenantId: effectiveTenantId,
        approvalId,
        action,
        idempotencyKey: params.idempotencyKey,
        result: rejectResult
      });

      return rejectResult;
    }

    // 4.5 Handle REQUEST CHANGES (Phase D3: Employee Review -> Founder Approval Loop)
    if (action === 'request_changes' || (action as any) === 'request-changes' || (action as any) === 'changes_requested') {
      const directiveFeedback = feedback?.trim() || 'Please revise deliverable per founder directives and resubmit.';

      if (dbApproval && isDbAvailable && prisma) {
        await safeDbQuery(async () => {
          await prisma.approval.update({
            where: { id: approvalId },
            data: {
              status: 'changes_requested',
              content: `${dbApproval.content}\n\n[FOUNDER_DIRECTIVE]: ${directiveFeedback}`
            }
          });

          if (approvalId.startsWith('appr_task_')) {
            const taskId = approvalId.replace('appr_task_', '');
            await (prisma as any).task.update({
              where: { id: taskId },
              data: {
                status: 'in_progress',
                result: `${dbApproval.content}\n\n[FOUNDER_DIRECTIVE]: ${directiveFeedback}`
              }
            }).catch(() => {});
          }

          await prisma.decisionLog.create({
            data: {
              title: `Changes Requested: ${dbApproval.title}`,
              description: `Founder requested modifications: "${directiveFeedback}"`,
              category: (dbApproval.type || 'OPERATIONS').toUpperCase(),
              impactText: 'Execution held pending employee revision. No financial mutations applied.',
              financialImpact: 0,
              status: 'changes_requested',
              startupId: startup.id
            }
          });

          await prisma.timelineItem.create({
            data: {
              title: `Changes Requested: ${dbApproval.title}`,
              content: `Founder directive: "${directiveFeedback}". Deliverable returned to employee workspace.`,
              type: 'revision_requested',
              startupId: startup.id
            }
          });

          await prisma.notification.create({
            data: {
              title: `Revision Requested: ${dbApproval.title}`,
              message: `Founder directive: "${directiveFeedback}". Please update work and resubmit.`,
              type: 'CHANGES_REQUESTED',
              startupId: startup.id
            }
          });
        }, 3);

        companyContextService.invalidate(startup.id);
        companyContextService.invalidate(userId);
      }

      if (memoryApproval) {
        memoryApproval.status = 'changes_requested';
        decisionLog.unshift({
          id: `dec_${Date.now()}`,
          title: `Changes Requested: ${memoryApproval.title}`,
          description: `Founder requested modifications: "${directiveFeedback}"`,
          category: memoryApproval.type.toUpperCase(),
          timestamp: new Date().toISOString(),
          impactText: 'Execution held pending employee revision. No financial mutations applied.',
          financialImpact: 0,
          status: 'changes_requested'
        });
        persistCurrentState();
      }

      decisionLedgerService.appendEvent({
        decisionId: approvalId,
        startupId: startup?.id || 'stp_default',
        workflowId: dbApproval?.initiativeId || memoryApproval?.initiativeId || approvalId,
        actor: `Founder (${userId})`,
        eventType: 'FOUNDER_CHANGES_REQUESTED',
        payload: { feedback: directiveFeedback }
      });

      // Clear from processedApprovalsMap so when employee resubmits it can be reviewed again
      processedApprovalsMap.delete(approvalId);

      const changeItem = dbApproval 
        ? mapApprovalToDeliverable({ 
            ...dbApproval, 
            status: 'changes_requested', 
            content: `${dbApproval.content}\n\n[FOUNDER_DIRECTIVE]: ${directiveFeedback}` 
          }) 
        : { ...memoryApproval!, status: 'changes_requested' as any, founderFeedback: directiveFeedback };

      const changeReqResult: ReviewApprovalResult = {
        success: true,
        message: 'Changes requested. Deliverable returned to employee workspace with founder directives.',
        item: changeItem,
        startupProfile: await this.buildStartupProfile(startup),
        stateChangesApplied: {
          isStateChanging: false,
          cashBalanceDelta: 0,
          burnRateDelta: 0,
          teamSizeDelta: 0,
          runwayMonths: startup ? (startup.burnRate > 0 ? parseFloat((startup.cashBalance / startup.burnRate).toFixed(1)) : 999) : 0,
          healthScoreDelta: 0
        }
      };

      await idempotencyService.commit({
        tenantId: effectiveTenantId,
        approvalId,
        action,
        idempotencyKey: params.idempotencyKey,
        result: changeReqResult
      });

      return changeReqResult;
    }

    // 5. Handle APPROVAL & MODIFICATION
    if (action === 'approve' || action === 'modify') {
      const appr = dbApproval || memoryApproval;
      const titleLower = (appr.title || '').toLowerCase();
      const descLower = (appr.description || '').toLowerCase();
      const typeLower = (appr.type || '').toLowerCase();
      const effectiveFinancialChange = params.modifications?.financialChange !== undefined 
        ? params.modifications.financialChange 
        : appr.financialChange;
      const effectiveHeadcount = params.modifications?.headcount !== undefined
        ? params.modifications.headcount
        : undefined;

      // Classify if action represents a supported state mutation
      const isHiring = typeLower === 'contract' ||
        titleLower.includes('hire') ||
        titleLower.includes('recruiting') ||
        descLower.includes('hire') ||
        descLower.includes('headcount');

      const isFinancial = appr.financialChange !== 0 ||
        typeLower === 'financial' ||
        titleLower.includes('budget') ||
        titleLower.includes('seed funding') ||
        titleLower.includes('treasury');

      const rawMetricChanges = appr.metricChanges || {};
      const hasMetricChanges = Object.values(rawMetricChanges).some((v: any) => typeof v === 'number' && v !== 0);

      const isStateChanging = isHiring || isFinancial || hasMetricChanges;

      decisionLedgerService.appendEvent({
        decisionId: approvalId,
        startupId: startup?.id || 'stp_default',
        workflowId: appr.initiativeId || approvalId,
        actor: `Founder (${userId})`,
        eventType: action === 'modify' ? 'FOUNDER_MODIFIED' : 'FOUNDER_APPROVED',
        payload: {
          action,
          feedback: feedback || null,
          modifications: params.modifications || null,
          effectiveFinancialChange,
          effectiveHeadcount
        }
      });

      // 5.1 Simulated or Detected Execution Failure Handling
      if (simulateExecutionFailure) {
        if (dbApproval && isDbAvailable && prisma) {
          await safeDbQuery(async () => {
            await prisma.approval.update({
              where: { id: approvalId },
              data: { status: 'execution_failed' }
            });

            await prisma.execution.create({
              data: {
                action: appr.title,
                payload: { error: 'Simulated execution subsystem failure' },
                status: 'failed',
                planId: appr.planId || dbApproval.planId
              }
            });

            await prisma.decisionLog.create({
              data: {
                title: `Execution Failed: ${appr.title}`,
                description: 'Approved by founder but execution failed in backend subsystem.',
                category: (appr.type || 'EXECUTION').toUpperCase(),
                impactText: 'Execution failed. No false company-state mutations applied.',
                financialImpact: 0,
                status: 'failed',
                startupId: startup.id
              }
            });
          }, 3);
        }

        return {
          success: false,
          statusCode: 500,
          error: 'Execution failed: Operational subsystem error. Company state was not modified.'
        };
      }

      // 5.2 Execute State-Changing Approval
      let cashDelta = 0;
      let burnDelta = 0;
      let teamSizeDelta = 0;
      let healthScoreDelta = 0;

      if (isStateChanging) {
        // A. Headcount / Hiring Mutation
        if (isHiring) {
          let headcount = effectiveHeadcount || 1;
          const countMatch = (appr.title + ' ' + appr.description).match(/hire\s+(\d+)x?/i);
          if (countMatch && !effectiveHeadcount) {
            headcount = parseInt(countMatch[1], 10) || 1;
          }
          teamSizeDelta = headcount;

          // Determine monthly burn impact
          if (effectiveFinancialChange && effectiveFinancialChange < 0) {
            const absChange = Math.abs(effectiveFinancialChange);
            burnDelta = absChange > 20000 ? Math.round(absChange / 12) : Math.round(absChange);
          } else {
            burnDelta = 10000 * headcount;
          }
        }

        // B. Financial Treasury Mutation
        if (isFinancial) {
          if (effectiveFinancialChange > 0) {
            cashDelta += effectiveFinancialChange;
          } else if (effectiveFinancialChange < 0) {
            if (!isHiring) {
              cashDelta += effectiveFinancialChange;
              const absChange = Math.abs(effectiveFinancialChange);
              burnDelta += Math.round(absChange / 12);
            }
          }
        }

        // C. Metrics & Health Score Mutation
        if (hasMetricChanges) {
          const vals = Object.values(rawMetricChanges).filter((v): v is number => typeof v === 'number');
          if (vals.length > 0) {
            const avgDelta = vals.reduce((a, b) => a + b, 0) / vals.length;
            healthScoreDelta = Math.round(avgDelta);
          }
        }
      }

      if (isStateChanging && startup && isDbAvailable && prisma) {
        try {
          // A. Headcount / Hiring Mutation in PostgreSQL
          if (isHiring) {
            const existingTeamMemory = await prisma.memory.findFirst({
              where: {
                startupId: startup.id,
                category: 'TEAM_SIZE'
              }
            });

            const currentDesc = existingTeamMemory?.description || '1-5';
            const updatedTeamDesc = incrementTeamSize(currentDesc, teamSizeDelta);

            if (existingTeamMemory) {
              await prisma.memory.update({
                where: { id: existingTeamMemory.id },
                data: { description: updatedTeamDesc }
              });
            } else {
              await prisma.memory.create({
                data: {
                  category: 'TEAM_SIZE',
                  title: 'Team Structure',
                  description: updatedTeamDesc,
                  startupId: startup.id
                }
              });
            }
          }

          const newCashBalance = Math.max(0, startup.cashBalance + cashDelta);
          const newBurnRate = Math.max(0, startup.burnRate + burnDelta);
          const newHealthScore = Math.min(100, Math.max(10, startup.healthScore + healthScoreDelta));

          // Persist state change to Startup in PostgreSQL
          await prisma.startup.update({
            where: { id: startup.id },
            data: {
              cashBalance: newCashBalance,
              burnRate: newBurnRate,
              healthScore: newHealthScore
            }
          });

          // Record in Execution
          await prisma.execution.create({
            data: {
              action: appr.title,
              payload: {
                approvalId: appr.id,
                type: appr.type,
                cashDelta,
                burnDelta,
                teamSizeDelta,
                newCashBalance,
                newBurnRate,
                newHealthScore,
                feedback: feedback || null
              },
              status: 'completed',
              planId: appr.planId || dbApproval.planId
            }
          });

          // Record DecisionLog, Memory (F1), and Timeline (F2)
          await this.recordDecisionMemoryAndTimeline({
            startup,
            appr,
            userId,
            isStateChanging: true,
            isHiring,
            cashDelta,
            burnDelta,
            teamSizeDelta
          });

          // Update Approval status in PostgreSQL
          await prisma.approval.update({
            where: { id: approvalId },
            data: { status: 'approved' }
          });

          if (approvalId.startsWith('appr_task_')) {
            const taskId = approvalId.replace('appr_task_', '');
            await (prisma as any).task.update({
              where: { id: taskId },
              data: { status: 'approved' }
            }).catch(() => {});
          }

          // Create real-time notification for successful approval
          await prisma.notification.create({
            data: {
              title: `Approved: ${appr.title}`,
              message: `Founder approved deliverable. Operational state changes committed and saved to company memory.`,
              type: 'APPROVED',
              startupId: startup.id
            }
          }).catch(() => {});

          // CRITICAL: Invalidate Company Context so future AI requests retrieve fresh database state
          companyContextService.invalidate(startup.id);
          companyContextService.invalidate(userId);

          // Update local memory state for backwards compatibility
          startup.cashBalance = newCashBalance;
          startup.burnRate = newBurnRate;
          startup.healthScore = newHealthScore;

          decisionLedgerService.appendEvent({
            decisionId: approvalId,
            startupId: startup.id,
            workflowId: appr.initiativeId || approvalId,
            actor: 'Executive Execution Engine',
            eventType: 'EXECUTION_COMPLETED',
            payload: { cashDelta, burnDelta, teamSizeDelta, newCashBalance, newBurnRate, newHealthScore }
          });
        } catch (execErr: any) {
          console.error('[Approval Execution] Failed to persist state mutation:', execErr.message);

          decisionLedgerService.appendEvent({
            decisionId: approvalId,
            startupId: startup.id,
            workflowId: appr.initiativeId || approvalId,
            actor: 'Executive Execution Engine',
            eventType: 'EXECUTION_FAILED',
            payload: { error: execErr.message }
          });

          // Mark approval as failed without updating company metrics
          await safeDbQuery(async () => {
            await prisma.approval.update({
              where: { id: approvalId },
              data: { status: 'execution_failed' }
            });
            await prisma.execution.create({
              data: {
                action: appr.title,
                payload: { error: execErr.message },
                status: 'failed',
                planId: appr.planId || dbApproval.planId
              }
            });
          }, 3);

          return {
            success: false,
            statusCode: 500,
            error: `Execution failed: ${execErr.message}. Company state was preserved.`
          };
        }
      } else if (!isStateChanging && startup && isDbAvailable && prisma) {
        // 5.3 Non-State-Changing Approval (e.g. Marketing Copy, Document Review)
        await safeDbQuery(async () => {
          await prisma.approval.update({
            where: { id: approvalId },
            data: { status: 'approved' }
          });

          if (approvalId.startsWith('appr_task_')) {
            const taskId = approvalId.replace('appr_task_', '');
            await (prisma as any).task.update({
              where: { id: taskId },
              data: { status: 'approved' }
            }).catch(() => {});
          }

          await prisma.execution.create({
            data: {
              action: appr.title,
              payload: {
                approvalId: appr.id,
                type: appr.type,
                nonStateChanging: true,
                feedback: feedback || null
              },
              status: 'completed',
              planId: appr.planId || dbApproval.planId
            }
          });

          // Record DecisionLog, Memory (F1), and Timeline (F2)
          await this.recordDecisionMemoryAndTimeline({
            startup,
            appr,
            userId,
            isStateChanging: false,
            isHiring: false,
            cashDelta: 0,
            burnDelta: 0,
            teamSizeDelta: 0
          });
        }, 3);

        // Invalidate context so pending approvals list is updated
        companyContextService.invalidate(startup.id);
        companyContextService.invalidate(userId);
      }

      // Sync memory state for offline / hybrid mode
      if (memoryApproval) {
        memoryApproval.status = 'approved';
        if (isStateChanging) {
          if (cashDelta !== 0) {
            startupProfile.cashBalance = Math.max(0, startupProfile.cashBalance + cashDelta);
          }
          if (burnDelta !== 0) {
            startupProfile.burnRate = Math.round(startupProfile.burnRate + burnDelta);
          }
          if (startupProfile.burnRate > 0) {
            startupProfile.runwayMonths = parseFloat((startupProfile.cashBalance / startupProfile.burnRate).toFixed(1));
          } else {
            startupProfile.runwayMonths = 999;
          }
          if (teamSizeDelta !== 0) {
            const currentCount = typeof startupProfile.teamSize === 'number' ? startupProfile.teamSize : parseInt(String(startupProfile.teamSize || '8'), 10);
            startupProfile.teamSize = currentCount + teamSizeDelta;
          }
          if (healthScoreDelta !== 0) {
            startupProfile.healthScore = Math.min(100, Math.max(10, startupProfile.healthScore + healthScoreDelta));
          }
        }

        decisionLog.unshift({
          id: `dec_${Date.now()}`,
          title: `Approve: ${memoryApproval.title}`,
          description: memoryApproval.description,
          category: memoryApproval.type.toUpperCase(),
          timestamp: new Date().toISOString(),
          impactText: memoryApproval.impact,
          financialImpact: memoryApproval.financialChange || 0,
          status: 'approved'
        });

        initiatives.forEach(init => {
          const del = init.deliverables.find(d => d.id === approvalId);
          if (del) del.status = 'approved';
        });

        if (memoryIndex !== -1) approvals.splice(memoryIndex, 1);

        // Persist updated metrics, decision record, and removed approval to disk
        persistCurrentState();

        decisionLedgerService.appendEvent({
          decisionId: approvalId,
          startupId: startup?.id || approvalToStartupMap.get(approvalId) || 'stp_default',
          workflowId: appr.initiativeId || approvalId,
          actor: 'Executive Execution Engine',
          eventType: 'EXECUTION_COMPLETED',
          payload: {
            cashDelta,
            burnDelta,
            teamSizeDelta,
            healthScoreDelta,
            newCashBalance: startupProfile.cashBalance,
            newBurnRate: startupProfile.burnRate,
            newHealthScore: startupProfile.healthScore
          }
        });
      }

      const updatedDeliverable = dbApproval
        ? mapApprovalToDeliverable({ ...dbApproval, status: 'approved' })
        : memoryApproval!;

      processedApprovalsMap.set(approvalId, updatedDeliverable);

      const profile = await this.buildStartupProfile(startup);

      const approveResult: ReviewApprovalResult = {
        success: true,
        message: 'Deliverable approved and executed successfully.',
        item: updatedDeliverable,
        startupProfile: profile,
        stateChangesApplied: {
          isStateChanging,
          cashBalanceDelta: cashDelta,
          burnRateDelta: burnDelta,
          teamSizeDelta,
          runwayMonths: profile.runwayMonths,
          healthScoreDelta
        }
      };

      await idempotencyService.commit({
        tenantId: effectiveTenantId,
        approvalId,
        action,
        idempotencyKey: params.idempotencyKey,
        result: approveResult
      });

      return approveResult;
    }

    await idempotencyService.release({
      tenantId: effectiveTenantId,
      approvalId,
      action,
      idempotencyKey: params.idempotencyKey,
      error: `Invalid review action: "${action}"`
    });

    return {
      success: false,
      statusCode: 400,
      error: `Invalid review action: "${action}". Expected "approve" or "reject".`
    };
  }

  /**
   * Section 26: Reversal of an approved deliverable.
   * Restores state changes, records REVERSAL_EXECUTED in Decision Ledger, and marks status 'reversed'.
   */
  public async reverseApproval(params: ReverseApprovalParams): Promise<ReverseApprovalResult> {
    const { approvalId, userId, userRole, reason } = params;

    if (!userId) {
      return { success: false, statusCode: 401, error: 'Unauthorized: Authentication required to reverse approvals.' };
    }
    if (userRole && userRole === 'Executive') {
      return { success: false, statusCode: 403, error: 'Unauthorized: Executive accounts cannot reverse deliverables.' };
    }
    if (this.isDegradedModeActive()) {
      return {
        success: false,
        statusCode: 503,
        error: 'Catalyst OS is operating in degraded read-only mode. Reversals are blocked because durable storage is unavailable.'
      };
    }

    let dbApproval: any = null;
    let startup: any = null;

    if (isDbAvailable && prisma) {
      dbApproval = await safeDbQuery(() =>
        prisma.approval.findUnique({
          where: { id: approvalId },
          include: {
            plan: {
              include: {
                startup: true
              }
            }
          }
        })
      );
      if (dbApproval) {
        startup = dbApproval.plan?.startup;
      }
    }

    let processed = processedApprovalsMap.get(approvalId);
    if (!processed && dbApproval && dbApproval.status === 'approved') {
      processed = mapApprovalToDeliverable(dbApproval);
      processedApprovalsMap.set(approvalId, processed);
    }

    if (!processed) {
      return { success: false, statusCode: 404, error: 'Deliverable must be in processed approved state to be reversed.' };
    }

    if (processed.status !== 'approved') {
      return { success: false, statusCode: 400, error: `Cannot reverse deliverable with status "${processed.status}". Only approved items can be reversed.` };
    }

    if (startup && startup.ownerId && startup.ownerId !== userId) {
      return {
        success: false,
        statusCode: 403,
        error: 'Forbidden: You do not have permission to reverse approvals for another company.'
      };
    }

    if (!startup && isDbAvailable && prisma) {
      const startupId = approvalToStartupMap.get(approvalId);
      if (startupId) {
        startup = await safeDbQuery(() => prisma.startup.findUnique({ where: { id: startupId } }));
      } else if (userId) {
        startup = await safeDbQuery(() => prisma.startup.findFirst({ where: { ownerId: userId } }));
      }
    }

    const isHiring = (processed.type || '').toLowerCase() === 'contract' ||
      (processed.title || '').toLowerCase().includes('hire');

    if (isHiring) {
      return {
        success: false,
        statusCode: 400,
        error: 'Irreversible action: Executed employment contracts and hiring actions cannot be automatically reversed.'
      };
    }

    // Reversible financial mutation rollback
    const origChange = processed.financialChange || 0;
    const restoredCashDelta = origChange < 0 ? Math.abs(origChange) : -origChange;
    const restoredBurnDelta = origChange < 0 ? -Math.round(Math.abs(origChange) / 12) : 0;

    // Persist rollback to PostgreSQL database
    if (startup && isDbAvailable && prisma) {
      const newDbCash = Math.max(0, startup.cashBalance + restoredCashDelta);
      const newDbBurn = Math.max(0, startup.burnRate + restoredBurnDelta);
      await safeDbQuery(async () => {
        await prisma.startup.update({
          where: { id: startup.id },
          data: {
            cashBalance: newDbCash,
            burnRate: newDbBurn
          }
        });

        if (dbApproval) {
          await prisma.approval.update({
            where: { id: approvalId },
            data: { status: 'rejected' }
          });
        }

        await prisma.decisionLog.create({
          data: {
            title: `Reverse: ${processed!.title}`,
            description: `Reversed by founder: "${reason || 'Founder reversed previous approval'}"`,
            category: 'FINANCIAL',
            impactText: `Reversal restored $${restoredCashDelta.toLocaleString()} to cash balance.`,
            financialImpact: restoredCashDelta,
            status: 'rejected',
            startupId: startup.id
          }
        });

        await prisma.timelineItem.create({
          data: {
            title: `Reversed: ${processed!.title}`,
            content: reason || 'Founder reversed previous approval',
            type: 'reversal',
            startupId: startup.id
          }
        });
      }, 3);

      startup.cashBalance = newDbCash;
      startup.burnRate = newDbBurn;
      companyContextService.invalidate(startup.id);
      companyContextService.invalidate(userId);
    }

    startupProfile.cashBalance = Math.max(0, startupProfile.cashBalance + restoredCashDelta);
    startupProfile.burnRate = Math.max(0, startupProfile.burnRate + restoredBurnDelta);
    if (startupProfile.burnRate > 0) {
      startupProfile.runwayMonths = parseFloat((startupProfile.cashBalance / startupProfile.burnRate).toFixed(1));
    } else {
      startupProfile.runwayMonths = 999;
    }

    processed.status = 'rejected';
    persistCurrentState();

    decisionLedgerService.appendEvent({
      decisionId: approvalId,
      startupId: approvalToStartupMap.get(approvalId) || 'stp_default',
      workflowId: processed.initiativeId || approvalId,
      actor: `Founder (${userId})`,
      eventType: 'REVERSAL_EXECUTED',
      payload: {
        reason: reason || 'Founder reversed previous approval',
        restoredCashDelta,
        restoredBurnDelta,
        newCashBalance: startupProfile.cashBalance,
        newBurnRate: startupProfile.burnRate
      }
    });

    return {
      success: true,
      message: 'Deliverable successfully reversed and state changes rolled back.',
      item: processed,
      startupProfile,
      stateChangesApplied: {
        isStateChanging: true,
        cashBalanceDelta: restoredCashDelta,
        burnRateDelta: restoredBurnDelta,
        teamSizeDelta: 0,
        runwayMonths: startupProfile.runwayMonths,
        healthScoreDelta: 0
      }
    };
  }

  /**
   * Phase E & F: Persists DecisionLog, F1 Decision Memory, and F2 Company Timeline.
   */
  private async recordDecisionMemoryAndTimeline(params: {
    startup: any;
    appr: any;
    userId: string;
    isStateChanging: boolean;
    isHiring: boolean;
    cashDelta: number;
    burnDelta: number;
    teamSizeDelta: number;
  }) {
    const { startup, appr, userId, isStateChanging, isHiring, cashDelta, burnDelta, teamSizeDelta } = params;
    if (!prisma || !startup?.id) return;

    const rawMeta = appr.metricChanges || {};
    const parsedMeta = typeof rawMeta === 'string'
      ? (() => { try { return JSON.parse(rawMeta); } catch { return {}; } })()
      : (rawMeta || {});

    const cleanTitle = (appr.title || 'Executive Deliverable').replace(/^\[[A-Z]+\|[A-Za-z]+\|[A-Z]*\]\s*/, '');
    const preparedBy = parsedMeta.preparedBy || appr.preparedBy || (isHiring ? 'HR Employee' : 'Employee');
    const preparedByRole = parsedMeta.preparedByRole || appr.preparedByRole || (isHiring ? 'HR' : 'OPERATIONS');
    const preparedByUserName = parsedMeta.preparedByUserName || appr.preparedByUserName || `${preparedByRole} Team Member`;
    const aiAssistance = parsedMeta.aiAssistance || appr.aiAssistance || (isHiring ? 'Echo' : 'Atlas');
    const summary = parsedMeta.summary || appr.description || cleanTitle;
    const recommendation = parsedMeta.recommendation || appr.recommendation || `Approve ${cleanTitle} and authorize operational execution.`;
    const whoRequested = parsedMeta.requestedBy || appr.requestedBy || `Founder (${userId})`;
    const whyRationale = parsedMeta.whyRationale || appr.impact || `Strategic goal execution for ${cleanTitle}`;

    const outcomeSummary = isStateChanging
      ? (isHiring
          ? `Headcount incremented by +${teamSizeDelta}. Monthly burn rate updated by +$${burnDelta.toLocaleString()}/mo. Liquid runway adjusted.`
          : `Financial treasury parameters updated. Cash balance delta: $${cashDelta.toLocaleString()}, burn delta: $${burnDelta.toLocaleString()}.`)
      : `Deliverable ratified and integrated into company operational baseline. No immediate liquid mutations.`;

    // 1. Record in DecisionLog (immutable strategic ledger)
    const existingDecision = await prisma.decisionLog.findFirst({
      where: {
        startupId: startup.id,
        title: { contains: cleanTitle },
        status: 'approved'
      }
    });

    if (!existingDecision) {
      await prisma.decisionLog.create({
        data: {
          title: `Approve: ${cleanTitle}`,
          description: `${summary}. Prepared by ${preparedByUserName} (${preparedByRole}) with ${aiAssistance} assistance.`,
          category: (appr.type || (isHiring ? 'CONTRACT' : 'OPERATIONS')).toUpperCase(),
          impactText: appr.impact || outcomeSummary,
          financialImpact: appr.financialChange || 0,
          status: 'approved',
          startupId: startup.id
        }
      });
    }

    // 2. F1 — Create Company Decision Memory (Completed work becomes company intelligence)
    await prisma.memory.create({
      data: {
        category: 'DECISION_LOG',
        title: cleanTitle,
        description: [
          `**What happened:** ${summary}`,
          `**Who requested it:** ${whoRequested}`,
          `**Who worked on it:** ${preparedByUserName} (${preparedByRole})`,
          `**Which AI helped:** ${aiAssistance}`,
          `**What was recommended:** ${recommendation}`,
          `**Who approved it:** Founder (${userId})`,
          `**When:** ${new Date().toISOString()}`,
          `**Why:** ${whyRationale}`,
          `**Outcome:** ${outcomeSummary}`
        ].join('\n'),
        startupId: startup.id
      }
    });

    // 3. F2 — Create Company Timeline (5-Stage Sequential Collaboration Lifecycle)
    const now = Date.now();
    const timelineSequence = [
      {
        title: `Founder requested ${cleanTitle}`,
        content: `Founder directive initiated execution loop for: "${cleanTitle}".`,
        type: 'command',
        createdAt: new Date(now - 4000)
      },
      {
        title: `${aiAssistance} created analysis`,
        content: `${aiAssistance} formulated domain benchmarks, leveling constraints, and initial co-pilot draft.`,
        type: 'agent_analysis',
        createdAt: new Date(now - 3000)
      },
      {
        title: `${preparedByRole} completed plan`,
        content: `${preparedByUserName} finalized and verified the deliverable in collaboration with ${aiAssistance}.`,
        type: 'employee_submission',
        createdAt: new Date(now - 2000)
      },
      {
        title: `Founder approved`,
        content: `Founder signed off on deliverable. Operational state changes committed.`,
        type: isHiring ? 'hire' : 'founder_approval',
        createdAt: new Date(now - 1000)
      },
      {
        title: `Decision recorded`,
        content: `Committed to immutable decision log and company memory for future organizational intelligence.`,
        type: 'decision_recorded',
        createdAt: new Date(now)
      }
    ];

    for (const item of timelineSequence) {
      await prisma.timelineItem.create({
        data: {
          title: item.title,
          content: item.content,
          type: item.type,
          startupId: startup.id,
          createdAt: item.createdAt
        }
      });
    }

    // 4. Trigger Phase G Proactive Analysis & Notifications
    try {
      const { proactiveEngine } = await import('./proactiveEngine');
      proactiveEngine.generateAndNotifyInsights(startup.id).catch(() => {});
    } catch {
      // ignore
    }
  }

  /**
   * Retrieves decision records for the authenticated user's startup.
   */
  public async getDecisionsForUser(userId: string): Promise<DecisionRecord[]> {
    if (isDbAvailable && prisma && userId) {
      const { resolveMembership } = await import('./membershipService');
      const membership = await resolveMembership(userId);
      const targetStartupId = membership?.startupId;

      if (targetStartupId) {
        const records = await safeDbQuery(() =>
          prisma.decisionLog.findMany({
            where: { startupId: targetStartupId },
            orderBy: { createdAt: 'desc' },
            take: 50
          })
        );

        if (records && records.length > 0) {
          return records.map((r: any) => ({
            id: r.id,
            title: r.title,
            description: r.description,
            category: r.category,
            timestamp: r.createdAt instanceof Date ? r.createdAt.toISOString() : new Date().toISOString(),
            impactText: r.impactText,
            financialImpact: r.financialImpact,
            status: r.status as 'approved' | 'rejected'
          }));
        }
      }
    }

    return decisionLog;
  }

  /**
   * F2 — Retrieves company timeline items for the authenticated user's startup.
   */
  public async getTimelineForUser(userId: string): Promise<any[]> {
    if (isDbAvailable && prisma && userId) {
      const { resolveMembership } = await import('./membershipService');
      const membership = await resolveMembership(userId);
      const targetStartupId = membership?.startupId;

      if (targetStartupId) {
        const records = await safeDbQuery(() =>
          prisma.timelineItem.findMany({
            where: { startupId: targetStartupId },
            orderBy: { createdAt: 'desc' },
            take: 50
          })
        );
        if (records) return records;
      }
    }
    return [];
  }

  /**
   * F1 — Retrieves company memories for the authenticated user's startup.
   */
  public async getMemoriesForUser(userId: string): Promise<any[]> {
    if (isDbAvailable && prisma && userId) {
      const { resolveMembership } = await import('./membershipService');
      const membership = await resolveMembership(userId);
      const targetStartupId = membership?.startupId;

      if (targetStartupId) {
        const records = await safeDbQuery(() =>
          prisma.memory.findMany({
            where: { startupId: targetStartupId },
            orderBy: { createdAt: 'desc' },
            take: 50
          })
        );
        if (records) return records;
      }
    }
    return [];
  }

  /**
   * Builds the StartupProfile for the frontend response.
   */
  private async buildStartupProfile(startup: any): Promise<StartupProfile> {
    if (!startup) {
      return startupProfile;
    }

    const cash = startup.cashBalance ?? startupProfile.cashBalance;
    const burn = startup.burnRate ?? startupProfile.burnRate;
    const runway = burn > 0 ? parseFloat((cash / burn).toFixed(1)) : 999;

    return {
      name: startup.name || startupProfile.name,
      industry: startup.industry || startupProfile.industry,
      description: startup.description || startupProfile.description,
      fundingStage: (startup.stage || startupProfile.fundingStage) as any,
      cashBalance: cash,
      burnRate: burn,
      runwayMonths: runway,
      healthScore: startup.healthScore ?? startupProfile.healthScore,
      metrics: startupProfile.metrics
    };
  }
}

export const approvalService = new ApprovalService();
export default approvalService;
