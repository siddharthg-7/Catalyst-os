import { AgentRole, Agent, AgentMessage, WorkflowTask, Deliverable, Initiative, StartupProfile } from '../src/models/types';

export interface PlannerOutputDTO {
  initiativeId: string;
  founderGoal: string;
  requiredExecutives: AgentRole[];
  ragQueryString: string;
  decomposedTasks: WorkflowTaskDTO[];
  expectedDeliverables: ExpectedDeliverableDTO[];
}

export interface WorkflowTaskDTO {
  id: string;
  assignedTo: AgentRole;
  title: string;
  constraints: string;
}

export interface ExpectedDeliverableDTO {
  type: 'document' | 'contract' | 'financials' | 'marketing_plan' | 'policy';
  title: string;
}

export interface AgentResponseDTO {
  agentId: AgentRole;
  reasoning: string;
  recommendations: Array<{
    id: string;
    title: string;
    description: string;
    financialImpact: number;
    riskRating: 'low' | 'medium' | 'high';
  }>;
  isConflict: boolean;
  conflictReason?: string;
  metricChanges?: {
    velocity?: number;
    financialHealth?: number;
    legalCompliance?: number;
    growthRate?: number;
    operationsEfficiency?: number;
  };
}

export interface ConflictResolutionDTO {
  conflictId: string;
  resolvedMetrics: {
    financialChange: number;
    metricChanges: {
      velocity: number;
      financialHealth: number;
      legalCompliance: number;
      growthRate: number;
      operationsEfficiency: number;
    };
  };
  resolutionText: string;
  compromiseDetails: string;
}
