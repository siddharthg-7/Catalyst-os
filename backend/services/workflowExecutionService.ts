import { 
  ExecutionWorkflow, 
  ExplicitWorkflowTask, 
  WorkflowExecutionHistoryEntry, 
  ExecutionTaskStatus 
} from '../src/models/types';

/**
 * CatalystOS - Workflow Execution Service
 * Section 5.8: Workflows as Explicit Execution Objects
 * 
 * Manages deterministic workflow execution, dependency graphs, preconditions,
 * approval requirements, completion criteria, failure handling policies,
 * and automatic deadline cascade revisions.
 */

class WorkflowExecutionService {
  private workflows: Map<string, ExecutionWorkflow> = new Map();

  constructor() {
    this.seedDefaultWorkflows();
  }

  private seedDefaultWorkflows() {
    const defaultProductLaunch: ExecutionWorkflow = {
      id: 'wf_enterprise_product_launch',
      title: 'Enterprise Multi-Tenant Auth & SAML SSO: Coordinated Product Launch',
      businessObjective: 'Deliver Multi-Tenant Enterprise Auth & SAML SSO to Q4 Beta Customers while ensuring zero security vulnerabilities, meeting SOC-2 compliance, and generating ₹24L in new ARR pipeline.',
      targetOutcomeMetric: '5 Enterprise Beta Customers Live, 0 High/Critical Pen-Test CVEs, 100% On-Time SLA Guarantee',
      category: 'product_launch',
      status: 'executing',
      createdAt: '2026-10-20T09:00:00.000Z',
      updatedAt: '2026-10-24T12:00:00.000Z',
      overallProgress: 35,
      tasks: [
        {
          id: 'task_eng_readiness',
          title: 'Engineering Release Readiness & Pen-Test Validation',
          description: 'Complete token revocation audit, verify OAuth 2.0/SAML SSO compliance, and achieve QA sign-off on staging release candidate.',
          department: 'ENGINEERING',
          responsibleOwner: {
            name: 'Vikram Seth',
            role: 'Staff Platform Engineer',
            type: 'HUMAN_EMPLOYEE',
            email: 'vikram.seth@nexora.ai',
            avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
          },
          deadline: '2026-11-02T18:00:00.000Z',
          originalDeadline: '2026-11-02T18:00:00.000Z',
          isDeadlineRevised: false,
          dependencies: [], // Root prerequisite task
          preconditions: [
            {
              id: 'pre_1_1',
              description: 'OAuth 2.0 & SAML Token Revocation Test Suite Passes (GitHub Issue #410)',
              status: 'PENDING_CHECK',
              evidenceUri: 'https://github.com/nexora-org/catalyst-core/issues/410'
            },
            {
              id: 'pre_1_2',
              description: 'Staging canary deployment running with 0 crash-loops over 48 hours',
              status: 'MET',
              verifiedAt: '2026-10-23T14:30:00.000Z',
              evidenceUri: 'https://argocd.internal.nexora.ai/apps/auth-canary'
            }
          ],
          approvalRequirements: [
            {
              id: 'appr_1_1',
              role: 'Lead QA Architect',
              approverName: 'Deepak Roy (Lead QA)',
              isSatisfied: false,
              notes: 'Waiting for penetration testing re-scan confirmation.'
            }
          ],
          completionCriteria: [
            'PR #284 merged into main branch with signed commit hash',
            'Staging release candidate v2.4.0 tagged in Git repository',
            'Zero unresolved High/Critical vulnerabilities in Snyk security audit'
          ],
          failureHandling: {
            policy: 'REVISE_DEADLINES',
            remediationAction: 'Halt downstream public marketing announcement. Automatically cascade deadline revisions to Marketing and Sales teams by +7 days. Convene emergency security mitigation sprint.',
            escalateTo: 'CTO & Founder'
          },
          status: 'IN_PROGRESS',
          progressPercent: 65,
          outputArtifact: {
            name: 'Release_Candidate_v2.4.0_Signoff_Report.pdf',
            type: 'TECHNICAL_SPEC',
            uri: '/artifacts/rc-2.4.0-signoff.pdf',
            summary: 'Contains unit test matrices, SOC-2 token revocation verification, and canary telemetry logs.'
          },
          executionHistory: [
            {
              id: 'hist_1_1',
              timestamp: '2026-10-20T10:00:00.000Z',
              actor: 'Vikram Seth',
              actorRole: 'Staff Platform Engineer',
              action: 'Task initiated from sprint kickoff',
              statusBefore: 'READY',
              statusAfter: 'IN_PROGRESS',
              comment: 'Branch feat/enterprise-auth-sso deployed to staging cluster.'
            },
            {
              id: 'hist_1_2',
              timestamp: '2026-10-23T14:30:00.000Z',
              actor: 'CI/CD Pipeline Daemon',
              actorRole: 'Automated Runner',
              action: 'Canary stability check passed (48h uptime)',
              statusBefore: 'IN_PROGRESS',
              statusAfter: 'IN_PROGRESS',
              evidenceProof: 'ArgoCD commit sha #9bf3d2'
            }
          ]
        },
        {
          id: 'task_mktg_announce',
          title: 'Publish Public Product Announcement & Enterprise Changelog',
          description: 'Deploy public blog announcement, update developer portal docs, and schedule social media broadcasts once release candidate is confirmed.',
          department: 'MARKETING',
          responsibleOwner: {
            name: 'Priya Sharma',
            role: 'Product Marketing Lead',
            type: 'HUMAN_EMPLOYEE',
            email: 'priya.sharma@nexora.ai',
            avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150'
          },
          deadline: '2026-11-04T12:00:00.000Z',
          originalDeadline: '2026-11-04T12:00:00.000Z',
          isDeadlineRevised: false,
          dependencies: ['task_eng_readiness'], // Explicit dependency on Engineering
          preconditions: [
            {
              id: 'pre_2_1',
              description: 'Engineering release readiness is verified with tagged release candidate',
              status: 'BLOCKED', // Blocked because task_eng_readiness is not completed yet
              evidenceUri: 'task_eng_readiness'
            },
            {
              id: 'pre_2_2',
              description: 'Customer API documentation & SSO configuration guide drafted',
              status: 'MET',
              verifiedAt: '2026-10-22T17:00:00.000Z',
              evidenceUri: 'https://docs.nexora.ai/auth/saml-quickstart'
            }
          ],
          approvalRequirements: [
            {
              id: 'appr_2_1',
              role: 'Founder & CEO',
              approverName: 'Jeswitha (Founder)',
              isSatisfied: false,
              notes: 'Draft reviewed; awaiting confirmed production release date before authorizing publication.'
            }
          ],
          completionCriteria: [
            'Launch blog post live on nexora.ai/blog/enterprise-auth-sso',
            'Customer knowledge base article published with screenshots',
            'Official product changelog updated in production dashboard'
          ],
          failureHandling: {
            policy: 'HALT_CASCADE',
            remediationAction: 'Withhold all public press releases and PR announcements until engineering resolves blockers. Re-align social media scheduling queue.',
            escalateTo: 'Head of Growth & CEO'
          },
          status: 'BLOCKED',
          progressPercent: 30,
          outputArtifact: {
            name: 'Enterprise_Auth_Launch_Brief_v2.docx',
            type: 'MARKETING_COLLATERAL',
            uri: '/artifacts/launch-brief-v2.docx',
            summary: 'Pre-drafted blog post, email templates, and feature release notes.'
          },
          executionHistory: [
            {
              id: 'hist_2_1',
              timestamp: '2026-10-21T11:00:00.000Z',
              actor: 'Priya Sharma',
              actorRole: 'Product Marketing Lead',
              action: 'Drafted launch collateral & customer docs',
              statusBefore: 'BLOCKED',
              statusAfter: 'BLOCKED',
              comment: 'Collateral ready; waiting for Engineering release gate to unlock.'
            }
          ]
        },
        {
          id: 'task_sales_comm',
          title: 'Send Customer Launch Communication & Beta Onboarding Schedule',
          description: 'Deliver targeted outbound emails to 14 waitlisted enterprise clients and schedule direct hands-on onboarding sessions with solutions engineers.',
          department: 'SALES',
          responsibleOwner: {
            name: 'Arjun Nair',
            role: 'Enterprise Sales VP',
            type: 'HUMAN_EMPLOYEE',
            email: 'arjun.nair@nexora.ai',
            avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'
          },
          deadline: '2026-11-05T15:00:00.000Z',
          originalDeadline: '2026-11-05T15:00:00.000Z',
          isDeadlineRevised: false,
          dependencies: ['task_mktg_announce'], // Explicit dependency on Marketing
          preconditions: [
            {
              id: 'pre_3_1',
              description: 'Public marketing announcement and documentation URL are verified live',
              status: 'BLOCKED',
              evidenceUri: 'task_mktg_announce'
            },
            {
              id: 'pre_3_2',
              description: 'Target list of 14 enterprise pipeline accounts verified in CRM with active NDAs',
              status: 'MET',
              verifiedAt: '2026-10-23T11:00:00.000Z',
              evidenceUri: 'hubspot://deals/cohort-q4-beta'
            }
          ],
          approvalRequirements: [
            {
              id: 'appr_3_1',
              role: 'Sales Operations Lead',
              approverName: 'Rohan Deshmukh (Sales Ops)',
              isSatisfied: true,
              notes: 'Solutions engineering calendar slots allocated for beta onboarding week.'
            }
          ],
          completionCriteria: [
            'Direct email campaign sent to all 14 enterprise prospect decision makers',
            'Minimum 5 customer onboarding kickoff sessions confirmed on calendar',
            'Sales pipeline value of ₹24L advanced to "Pilot Onboarding" stage'
          ],
          failureHandling: {
            policy: 'REVISE_DEADLINES',
            remediationAction: 'If release date changes, notify enterprise accounts with proactive schedule revision notice. Maintain executive confidence by citing rigorous security pen-test validation.',
            escalateTo: 'VP Sales & CEO'
          },
          status: 'BLOCKED',
          progressPercent: 15,
          outputArtifact: {
            name: 'Enterprise_Beta_Onboarding_Cadence.xlsx',
            type: 'SALES_SCHEDULE',
            uri: '/artifacts/sales-beta-cadence.xlsx',
            summary: 'Account allocation matrix, solution engineer assignments, and customer SLA agreements.'
          },
          executionHistory: [
            {
              id: 'hist_3_1',
              timestamp: '2026-10-22T16:00:00.000Z',
              actor: 'Arjun Nair',
              actorRole: 'Enterprise Sales VP',
              action: 'Prepared 14 account outreach packets',
              statusBefore: 'BLOCKED',
              statusAfter: 'BLOCKED',
              comment: 'Waiting for marketing live URL to prevent sending broken links to CIOs.'
            }
          ]
        },
        {
          id: 'task_founder_review',
          title: 'Founder Executive Go/No-Go Gate & Company Memory Ingestion',
          description: 'Founder conducts final audit of beta deployments, verifies error rates, authorizes billing activation, and persists workflow outcomes to startup memory.',
          department: 'EXECUTIVE',
          responsibleOwner: {
            name: 'Jeswitha',
            role: 'Founder & CEO',
            type: 'HUMAN_EMPLOYEE',
            email: 'founder@nexora.ai',
            avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150'
          },
          deadline: '2026-11-06T18:00:00.000Z',
          originalDeadline: '2026-11-06T18:00:00.000Z',
          isDeadlineRevised: false,
          dependencies: ['task_sales_comm'], // Explicit dependency on Sales
          preconditions: [
            {
              id: 'pre_4_1',
              description: 'Tasks 1, 2, and 3 successfully completed with verifiable audit artifacts',
              status: 'BLOCKED',
              evidenceUri: 'task_sales_comm'
            }
          ],
          approvalRequirements: [
            {
              id: 'appr_4_1',
              role: 'Founder & CEO',
              approverName: 'Jeswitha (Founder)',
              isSatisfied: false,
              notes: 'Final executive gating sign-off required.'
            }
          ],
          completionCriteria: [
            'All 5 customer tenants active on enterprise tier with zero 5xx error spikes',
            'Post-launch retrospective recorded into CatalystOS Startup Memory',
            'Executive Council notified of milestone achievement'
          ],
          failureHandling: {
            policy: 'ROLLBACK',
            remediationAction: 'Roll back enterprise feature flags if error rate exceeds 0.05% in first 24 hours. Issue customer status page updates.',
            escalateTo: 'Founder & CEO'
          },
          status: 'BLOCKED',
          progressPercent: 0,
          executionHistory: [
            {
              id: 'hist_4_1',
              timestamp: '2026-10-20T09:00:00.000Z',
              actor: 'System Orchestrator',
              actorRole: 'CatalystOS Engine',
              action: 'Workflow established as authoritative execution object',
              statusBefore: 'BLOCKED',
              statusAfter: 'BLOCKED'
            }
          ]
        }
      ],
      history: [
        {
          timestamp: '2026-10-20T09:00:00.000Z',
          event: 'Workflow chartered: Enterprise Multi-Tenant Auth & SAML SSO Launch',
          actor: 'Jeswitha (Founder & CEO)'
        },
        {
          timestamp: '2026-10-23T14:30:00.000Z',
          event: 'Engineering canary passed stability milestone on staging',
          actor: 'CI/CD Pipeline Daemon'
        }
      ]
    };

    this.workflows.set(defaultProductLaunch.id, defaultProductLaunch);
  }

  public getWorkflows(): ExecutionWorkflow[] {
    return Array.from(this.workflows.values());
  }

  public getWorkflowById(id: string): ExecutionWorkflow | undefined {
    return this.workflows.get(id);
  }

  /**
   * Reschedule a task deadline and cascade revisions to all downstream dependencies.
   * This is the exact product coordination requirement in Section 5.8:
   * "If the release date changes, the workflow should identify which deadlines need revision."
   */
  public rescheduleTaskDeadline(
    workflowId: string,
    taskId: string,
    daysShift: number,
    reason: string,
    actor: string = 'Founder & CEO'
  ): {
    workflow: ExecutionWorkflow;
    revisedTasks: ExplicitWorkflowTask[];
    summary: string;
  } {
    const wf = this.workflows.get(workflowId);
    if (!wf) {
      throw new Error(`Workflow with ID ${workflowId} not found.`);
    }

    const targetTask = wf.tasks.find(t => t.id === taskId);
    if (!targetTask) {
      throw new Error(`Task with ID ${taskId} not found in workflow ${workflowId}.`);
    }

    // 1. Shift target task deadline
    const oldDeadline = new Date(targetTask.deadline);
    const newDeadline = new Date(oldDeadline.getTime() + daysShift * 24 * 60 * 60 * 1000);
    targetTask.deadline = newDeadline.toISOString();
    targetTask.isDeadlineRevised = true;
    targetTask.deadlineRevisionReason = reason;

    const targetEntry: WorkflowExecutionHistoryEntry = {
      id: `hist_${Date.now()}_${targetTask.id}`,
      timestamp: new Date().toISOString(),
      actor,
      actorRole: 'Executive Coordinator',
      action: `Deadline revised by +${daysShift} days (${oldDeadline.toLocaleDateString()} → ${newDeadline.toLocaleDateString()})`,
      statusBefore: targetTask.status,
      statusAfter: targetTask.status === 'COMPLETED' ? 'COMPLETED' : 'REVISED',
      comment: `Direct revision: ${reason}`
    };
    if (targetTask.status !== 'COMPLETED') {
      targetTask.status = 'REVISED';
    }
    targetTask.executionHistory.unshift(targetEntry);

    // 2. Identify all downstream dependent tasks recursively
    const revisedTasks: ExplicitWorkflowTask[] = [targetTask];
    const visited = new Set<string>([targetTask.id]);
    const queue = [targetTask.id];

    while (queue.length > 0) {
      const currentParentId = queue.shift()!;
      
      // Find tasks that directly depend on currentParentId
      const dependentTasks = wf.tasks.filter(t => t.dependencies.includes(currentParentId));

      for (const depTask of dependentTasks) {
        if (!visited.has(depTask.id)) {
          visited.add(depTask.id);
          queue.push(depTask.id);

          // Shift downstream task deadline by the same delta to preserve operational buffer
          const depOldDeadline = new Date(depTask.deadline);
          const depNewDeadline = new Date(depOldDeadline.getTime() + daysShift * 24 * 60 * 60 * 1000);
          depTask.deadline = depNewDeadline.toISOString();
          depTask.isDeadlineRevised = true;
          depTask.deadlineRevisionReason = `Cascaded from upstream dependency [${targetTask.title}]: ${reason}`;

          const depEntry: WorkflowExecutionHistoryEntry = {
            id: `hist_${Date.now()}_${depTask.id}`,
            timestamp: new Date().toISOString(),
            actor: 'CatalystOS Workflow Dependency Coordinator',
            actorRole: 'Autonomous Engine',
            action: `Deadline cascadingly shifted by +${daysShift} days (${depOldDeadline.toLocaleDateString()} → ${depNewDeadline.toLocaleDateString()})`,
            statusBefore: depTask.status,
            statusAfter: depTask.status === 'COMPLETED' ? 'COMPLETED' : 'REVISED',
            comment: `Cascade dependency update: [${targetTask.title}] was delayed by ${daysShift} days.`
          };
          if (depTask.status !== 'COMPLETED') {
            depTask.status = 'REVISED';
          }
          depTask.executionHistory.unshift(depEntry);
          revisedTasks.push(depTask);
        }
      }
    }

    // 3. Update workflow metadata & audit log
    wf.status = 'revising';
    wf.updatedAt = new Date().toISOString();
    wf.history.unshift({
      timestamp: new Date().toISOString(),
      event: `Execution Schedule Re-aligned: Target task [${targetTask.title}] delayed by +${daysShift} days. ${revisedTasks.length - 1} downstream tasks cascaded.`,
      actor
    });

    const summary = `Successfully adjusted release schedule by +${daysShift} days. ${revisedTasks.length} total tasks re-aligned: ${revisedTasks.map(t => `${t.responsibleOwner.role} (${t.title})`).join(' → ')}.`;

    return {
      workflow: wf,
      revisedTasks,
      summary
    };
  }

  /**
   * Complete a task with verifiable evidence proof and automatically unlock downstream tasks
   */
  public completeTask(
    workflowId: string,
    taskId: string,
    evidenceProof: string,
    actor: string = 'Responsible Owner'
  ): ExecutionWorkflow {
    const wf = this.workflows.get(workflowId);
    if (!wf) throw new Error(`Workflow ${workflowId} not found.`);

    const task = wf.tasks.find(t => t.id === taskId);
    if (!task) throw new Error(`Task ${taskId} not found.`);

    const previousStatus = task.status;
    task.status = 'COMPLETED';
    task.progressPercent = 100;
    
    // Satisfy preconditions on this task
    task.preconditions.forEach(p => {
      p.status = 'MET';
      p.verifiedAt = new Date().toISOString();
    });

    task.executionHistory.unshift({
      id: `hist_${Date.now()}_${task.id}`,
      timestamp: new Date().toISOString(),
      actor,
      actorRole: task.responsibleOwner.role,
      action: 'Task marked as verified & completed',
      statusBefore: previousStatus,
      statusAfter: 'COMPLETED',
      evidenceProof,
      comment: 'Completion criteria satisfied and verified.'
    });

    // Check downstream tasks: If all dependencies for a downstream task are now COMPLETED, unlock it to READY!
    wf.tasks.forEach(otherTask => {
      if (otherTask.dependencies.includes(taskId) && otherTask.status !== 'COMPLETED') {
        // Check if ALL dependencies are completed
        const allDepsCompleted = otherTask.dependencies.every(depId => {
          const dep = wf.tasks.find(t => t.id === depId);
          return dep && dep.status === 'COMPLETED';
        });

        if (allDepsCompleted) {
          otherTask.status = 'READY';
          otherTask.preconditions.forEach(p => {
            if (p.evidenceUri === taskId) {
              p.status = 'MET';
              p.verifiedAt = new Date().toISOString();
            }
          });
          otherTask.executionHistory.unshift({
            id: `hist_${Date.now()}_${otherTask.id}`,
            timestamp: new Date().toISOString(),
            actor: 'CatalystOS Execution Coordinator',
            actorRole: 'Autonomous Engine',
            action: 'All upstream dependencies completed: Task unlocked to READY',
            statusBefore: 'BLOCKED',
            statusAfter: 'READY',
            comment: `Prerequisite [${task.title}] reached COMPLETED.`
          });
        }
      }
    });

    // Recalculate overall workflow progress
    const totalProgress = wf.tasks.reduce((sum, t) => sum + t.progressPercent, 0);
    wf.overallProgress = Math.round(totalProgress / wf.tasks.length);
    if (wf.overallProgress === 100) {
      wf.status = 'completed';
    } else {
      wf.status = 'executing';
    }
    wf.updatedAt = new Date().toISOString();

    wf.history.unshift({
      timestamp: new Date().toISOString(),
      event: `Task completed: [${task.title}] by ${task.responsibleOwner.name}. Evidence: ${evidenceProof}`,
      actor
    });

    return wf;
  }

  /**
   * Report task failure / blocker and execute explicit failure handling policy
   */
  public reportTaskFailure(
    workflowId: string,
    taskId: string,
    reason: string,
    actor: string = 'Responsible Owner'
  ): ExecutionWorkflow {
    const wf = this.workflows.get(workflowId);
    if (!wf) throw new Error(`Workflow ${workflowId} not found.`);

    const task = wf.tasks.find(t => t.id === taskId);
    if (!task) throw new Error(`Task ${taskId} not found.`);

    const prevStatus = task.status;
    task.status = 'FAILED';

    task.executionHistory.unshift({
      id: `hist_${Date.now()}_${task.id}`,
      timestamp: new Date().toISOString(),
      actor,
      actorRole: task.responsibleOwner.role,
      action: `Failure reported: ${reason}`,
      statusBefore: prevStatus,
      statusAfter: 'FAILED',
      comment: `Failure policy [${task.failureHandling.policy}] triggered. Escalated to ${task.failureHandling.escalateTo}.`
    });

    // Block downstream tasks
    wf.tasks.forEach(otherTask => {
      if (otherTask.dependencies.includes(taskId) && otherTask.status !== 'COMPLETED') {
        otherTask.status = 'BLOCKED';
        otherTask.preconditions.forEach(p => {
          if (p.evidenceUri === taskId) {
            p.status = 'BLOCKED';
          }
        });
      }
    });

    wf.status = 'blocked';
    wf.updatedAt = new Date().toISOString();
    wf.history.unshift({
      timestamp: new Date().toISOString(),
      event: `Task FAILED: [${task.title}]. Failure policy applied: ${task.failureHandling.remediationAction}`,
      actor
    });

    return wf;
  }

  /**
   * Reset workflow back to the baseline state for demonstration
   */
  public resetWorkflow(workflowId: string): ExecutionWorkflow {
    this.seedDefaultWorkflows();
    const wf = this.workflows.get(workflowId);
    if (!wf) throw new Error(`Workflow ${workflowId} not found.`);
    return wf;
  }
}

export const workflowExecutionService = new WorkflowExecutionService();
