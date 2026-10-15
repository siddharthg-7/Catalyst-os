/**
 * CatalystOS - Traceable Agent Execution & Deliberation Persistence (Section 3)
 * Records and persists every individual executive agent run, inputs, outputs, votes, and timestamps.
 * Guarantees that refreshing the page or restarting clients recovers full deliberation history.
 */

import { AgentVote } from '../src/models/types';

export interface AgentRunRecord {
  workflowId: string;
  commandId: string;
  agentRunId: string;
  parentRunId?: string;
  agentRole: 'CEO' | 'CFO' | 'Talent' | 'Growth' | 'Legal' | 'Operations' | 'Auditor';
  status: 'running' | 'completed' | 'failed' | 'vetoed';
  startedAt: string;
  completedAt: string;
  input: any;
  output: any;
  confidence: number;
  citations: string[];
  errors?: string[];
  vote?: AgentVote;
}

export interface WorkflowRunRecord {
  workflowId: string;
  commandId: string;
  startupId: string;
  command: string;
  status: 'running' | 'completed' | 'failed' | 'vetoed' | 'blocked_by_veto';
  workflowStatus?: string;
  createdAt: string;
  completedAt?: string;
  agentRuns: AgentRunRecord[];
  finalConsensus?: any;
}

const workflowStore = new Map<string, WorkflowRunRecord>();
const commandToWorkflowMap = new Map<string, string>();

export class AgentRunService {
  /**
   * Initializes a traceable multi-agent workflow.
   */
  public startWorkflow(params: {
    workflowId: string;
    commandId: string;
    startupId: string;
    command: string;
  }): WorkflowRunRecord {
    const { workflowId, commandId, startupId, command } = params;

    const record: WorkflowRunRecord = {
      workflowId,
      commandId,
      startupId,
      command,
      status: 'running',
      workflowStatus: 'running',
      createdAt: new Date().toISOString(),
      agentRuns: []
    };

    workflowStore.set(workflowId, record);
    commandToWorkflowMap.set(commandId, workflowId);
    return record;
  }

  /**
   * Records an individual executive agent's structured execution run.
   */
  public recordAgentRun(run: AgentRunRecord): void {
    const workflow = workflowStore.get(run.workflowId);
    if (workflow) {
      const existingIdx = workflow.agentRuns.findIndex(r => r.agentRunId === run.agentRunId);
      if (existingIdx >= 0) {
        workflow.agentRuns[existingIdx] = run;
      } else {
        workflow.agentRuns.push(run);
      }
    }
  }

  /**
   * Finalizes the workflow state.
   */
  public completeWorkflow(
    workflowId: string, 
    status: WorkflowRunRecord['status'], 
    finalConsensus?: any
  ): void {
    const workflow = workflowStore.get(workflowId);
    if (workflow) {
      workflow.status = status;
      workflow.workflowStatus = status;
      workflow.completedAt = new Date().toISOString();
      workflow.finalConsensus = finalConsensus;
    }
  }

  /**
   * Retrieves full deliberation history for a workflow or command.
   */
  public getWorkflow(workflowId: string): WorkflowRunRecord | null {
    return workflowStore.get(workflowId) || null;
  }

  public getWorkflowByCommandId(commandId: string): WorkflowRunRecord | null {
    const workflowId = commandToWorkflowMap.get(commandId);
    if (!workflowId) return null;
    return this.getWorkflow(workflowId);
  }

  public getDeliberationForCommand(commandId: string): WorkflowRunRecord | null {
    return this.getWorkflowByCommandId(commandId);
  }

  public getWorkflowsForStartup(startupId: string): WorkflowRunRecord[] {
    return Array.from(workflowStore.values())
      .filter(w => w.startupId === startupId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

export const agentRunService = new AgentRunService();
