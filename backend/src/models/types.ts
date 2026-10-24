/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface StartupProfile {
  name: string;
  industry: string;
  description: string;
  fundingStage: string;
  teamSize?: number | string;
  monthlyRevenue?: number | string;
  strategy?: string;
  targetIcp?: string;
  primaryProduct?: string;
  goals?: string[];
  priorities?: string[];
  cashBalance: number;
  burnRate: number;
  runwayMonths: number;
  healthScore: number;
  metrics: {
    velocity: number;
    financialHealth: number;
    legalCompliance: number;
    growthRate: number;
    operationsEfficiency: number;
  };
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

export interface CapabilityProvisioningResult {
  capability: string;
  agentRole: string;
  agentName: string;
  provisioned: boolean;
  agentId?: string;
  description: string;
}

export interface DelegatedTask {
  id: string;
  planId?: string;
  title: string;
  department: string;
  agent: string;
  ownerRole: string | null;
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  status: 'pending' | 'in_progress' | 'submitted' | 'changes_requested' | 'approved' | 'rejected' | 'backlog' | 'assigned' | 'in_review' | 'completed' | 'cancelled' | 'BACKLOG' | 'ASSIGNED' | 'IN_PROGRESS' | 'SUBMITTED' | 'IN_REVIEW' | 'CHANGES_REQUESTED' | 'COMPLETED' | 'CANCELLED';
  canonicalStatus?: 'BACKLOG' | 'ASSIGNED' | 'IN_PROGRESS' | 'SUBMITTED' | 'IN_REVIEW' | 'CHANGES_REQUESTED' | 'COMPLETED' | 'CANCELLED';
  isRestricted?: boolean;
  cancellationReason?: string;
  result: string | null;
  founderFeedback?: string | null;
  changesRequested?: boolean;
  needsHumanOwner: boolean;
  humanRequirement?: HumanRoleRequirement | null;
  priority?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  dueDate?: string;
  projectName?: string;
  reviewerId?: string;
  reviewerName?: string;
  collaborators?: Array<{ id: string; name: string; role: string }>;
  acceptanceCriteria?: string[];
  progressUpdates?: Array<{ id: string; author: string; note: string; timestamp: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeWorkspacePayload {
  department: string;
  role: string;
  companionAgent: {
    name: string;
    role: string;
    avatar: string;
    description: string;
  };
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

export interface Plan {
  id: string;
  title: string;
  description: string;
  status: string;
  startupId: string;
  tasks?: DelegatedTask[];
  explicitSteps?: string[];
  createdAt: string;
  updatedAt: string;
}

export type AgentRole =
  | 'CEO'
  | 'Finance'
  | 'Talent'
  | 'Growth'
  | 'Operations'
  | 'Legal'
  | 'Investment'
  | 'Auditor'
  | 'ConflictResolver'
  | 'ApprovalManager';

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  avatar: string;
  description: string;
  status: 'idle' | 'analyzing' | 'collaborating' | 'generating' | 'reviewing';
  currentTask?: string;
  keyMetric: string;
  metricValue: string;
  color: string;
}

export interface AgentMessage {
  id: string;
  sender: AgentRole;
  receiver: AgentRole | 'All';
  content: string;
  timestamp: string;
  isConflict?: boolean;
}

export interface WorkflowTask {
  id: string;
  title: string;
  assignedTo: AgentRole;
  status: 'pending' | 'in_progress' | 'completed';
  result?: string;
}

export type VoteVerdict = 'APPROVE' | 'APPROVE_WITH_CONDITIONS' | 'VETO';

export interface AgentVote {
  id: string;
  approvalId?: string;
  agentRole: 'CEO' | 'CFO' | 'Talent' | 'Growth' | 'Legal' | 'Operations' | 'Auditor';
  verdict: VoteVerdict;
  confidence: number;
  reason: string;
  conditions?: string[];
  evidence?: string[];
  citations?: string[];
  createdAt: string;
}

export interface BoardConsensus {
  approvedCount: number;
  conditionalCount: number;
  vetoCount: number;
  totalVotes: number;
  hasUnresolvedVeto: boolean;
  verdict: 'CONSENSUS_REACHED' | 'CONDITIONAL_APPROVAL' | 'BLOCKED_BY_VETO';
  summary: string;
  votes: AgentVote[];
}

export type ApprovalStatus =
  | 'draft'
  | 'validated'
  | 'pending_review'
  | 'approved'
  | 'executing'
  | 'completed'
  | 'rejected'
  | 'cancelled'
  | 'failed'
  | 'changes_requested'
  | 'expired';

export type ExecutionStatus =
  | 'not_started'
  | 'scheduled'
  | 'executing'
  | 'completed'
  | 'verified'
  | 'failed'
  | 'cancelled';

export interface ApprovalEvidence {
  source: string;
  freshness: 'VERIFIED' | 'STALE' | 'ESTIMATED' | 'MISSING_DATA';
  lastUpdated?: string;
  confidenceScore?: number;
  citation?: string;
}

export interface Deliverable {
  id: string;
  proposalId?: string;
  version?: number;
  startupId?: string;
  initiativeId: string;
  title: string;
  description: string;
  type: 'document' | 'contract' | 'financials' | 'marketing_plan' | 'policy';
  status: ApprovalStatus;
  content: string;
  impact: string;
  financialChange?: number;
  metricChanges?: {
    velocity?: number;
    financialHealth?: number;
    legalCompliance?: number;
    growthRate?: number;
    operationsEfficiency?: number;
  };
  votes?: AgentVote[];
  boardConsensus?: BoardConsensus;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reversibility?: 'REVERSIBLE' | 'IRREVERSIBLE';
  headcount?: number;
  conditions?: string[];
  // Phase D & 5.5 — Strict Lifecycle & Accountability
  preparedBy?: string;
  preparedByRole?: string;
  aiAssistance?: string;
  summary?: string;
  recommendation?: string;
  taskId?: string;
  founderFeedback?: string;
  businessRationale?: string;
  supportingEvidence?: ApprovalEvidence[];
  authorizedApprover?: string;
  approvedAt?: string;
  decidedAt?: string;
  executionStatus?: ExecutionStatus;
  executedAt?: string;
  verifiedAt?: string;
  executionDetails?: {
    executor?: string;
    targetSystem?: string;
    verificationProof?: string;
    notes?: string;
  };
}

export interface Initiative {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  category: 'funding' | 'hiring' | 'growth' | 'operations' | 'legal';
  createdAt: string;
  currentTaskIndex: number;
  tasks: WorkflowTask[];
  messages: AgentMessage[];
  deliverables: Deliverable[];
  mcp_tool_calls?: MCPToolCall[];
}

export interface MCPToolCall {
  tool: string;
  input: any;
  output: any;
}

export interface MCPTool {
  name: string;
  description: string;
  parameters?: any;
}

export interface VaultStatus {
  status: 'connected' | 'fallback';
  vaultAddr: string;
  keysFound: string[];
}

export interface KnowledgeFile {
  id: string;
  name: string;
  type: string;
  size: string;
  uploadDate: string;
  summary: string;
  insights: string[];
  startupId?: string;
  sourceType?: string;
  sourceRecordId?: string | null;
  version?: number;
  accessScope?: string;
  indexingStatus?: string;
  errorMessage?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// ── Section 5.7 Knowledge Provenance & Disagreement Resolution Types ────────
export type VerificationMethod = 'EXTRACTED' | 'CALCULATED' | 'MANUALLY_CONFIRMED' | 'INTEGRATION_FEED';

export type KnowledgeCategory = 'DESCRIPTIVE' | 'OPERATIONAL_STATE';

export type FactFreshness = 'FRESH' | 'AGING' | 'STALE' | 'SUPERSEDED';

export type ConflictSeverity = 'NO_CONFLICT' | 'DIVERGENT' | 'HARD_CONFLICT';

export interface FactProvenance {
  factId: string;
  key: string;
  label: string;
  value: any;
  formattedValue?: string;
  unit?: string;
  category: KnowledgeCategory;
  department: string;
  sourceType: 'DOCUMENT' | 'INTEGRATION' | 'SYSTEM_RECORD' | 'FOUNDER_ATTESTATION';
  sourceName: string;
  sourceDate: string;
  extractionTimestamp: string;
  verificationMethod: VerificationMethod;
  verifiedBy?: string;
  freshness: FactFreshness;
  staleReason?: string;
  isAuthoritative: boolean;
  hasConflict: boolean;
  conflictDetails?: {
    conflictingFactId: string;
    conflictingSource: string;
    conflictingValue: any;
    conflictingDate: string;
    conflictingCategory: KnowledgeCategory;
    severity: ConflictSeverity;
    arbitrationRule: string;
    resolution: string;
  };
}

export interface DisagreementResolutionCase {
  id: string;
  topic: string;
  metricOrFeature: string;
  department: string;
  descriptiveClaim: {
    source: string;
    sourceType: string;
    date: string;
    value: string;
    interpretation: string;
    statusBadge: 'STALE' | 'SUPERSEDED' | 'ASPIRATIONAL_PLAN';
  };
  operationalReality: {
    source: string;
    sourceType: string;
    date: string;
    value: string;
    interpretation: string;
    statusBadge: 'VERIFIED_LIVE' | 'IN_PROGRESS' | 'BANK_FEED';
  };
  arbitrationVerdict: {
    ruling: 'OPERATIONAL_TRUTH_WINS' | 'NEWEST_CONFIRMED_RECORD_WINS' | 'FLAG_FOR_FOUNDER_CONFIRMATION';
    ruleApplied: string;
    authoritativeValue: string;
    explanation: string;
    impactOnPlanning: string;
    arbitratedAt: string;
    arbitratedBy: string;
  };
}

export type UserRole =
  | 'Founder' | 'Employee' | 'Executive' | 'Investor' | 'Admin'
  | 'FOUNDER' | 'ADMIN' | 'FINANCE' | 'HR' | 'OPERATIONS' | 'GROWTH';

/** P1 Task 7 — effective permission set returned by GET /api/permissions/me. */
export type PermissionArea =
  | 'dashboard' | 'approvals' | 'knowledge' | 'workflows'
  | 'agents' | 'council' | 'people' | 'scenarios' | 'decisions';

export type PermissionAction =
  | 'startup:write' | 'approvals:review' | 'knowledge:write'
  | 'people:read' | 'people:write' | 'people:access'
  | 'orchestrate:execute' | 'orchestrate:request';

export interface UserPermissions {
  role: string;
  storedRole?: string;
  areas: PermissionArea[];
  agents: string[];
  actions: PermissionAction[];
  people?: {
    read: boolean;
    write: boolean;
    access: boolean;
  };
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt?: string;
  emailVerified?: boolean;
  mustChangePassword?: boolean;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
}

export interface DecisionRecord {
  id: string;
  title: string;
  description: string;
  category: string;
  timestamp: string;
  impactText: string;
  financialImpact: number;
  status: 'approved' | 'rejected' | 'failed' | 'changes_requested';
  participatingAgents?: string[];
  votes?: Array<{ agent: string; verdict: 'APPROVE' | 'APPROVE_WITH_CONDITIONS' | 'VETO'; reason?: string }>;
  confidence?: number;
  citations?: string[];
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reversibility?: 'REVERSIBLE' | 'IRREVERSIBLE';
  modifications?: string;
}

export interface OrchestrationAgentActivity {
  role: string;
  status: 'idle' | 'analyzing' | 'collaborating' | 'generating' | 'completed';
  contribution?: string;
}

export interface OrchestrationEvidence {
  citationId: string;
  documentId?: string;
  documentName?: string;
  chunkId?: string;
  excerpt?: string;
}

export interface OrchestrationCalculation {
  metric: string;
  value: number | string;
  source: string;
}

export interface OrchestrationApprovalRequirement {
  required: boolean;
  approvalId?: string;
  reason?: string;
  impact?: string;
}

export interface OrchestrationResponse {
  commandId: string;
  status: 'completed' | 'needs_approval' | 'needs_information' | 'provider_unavailable' | 'failed';
  interpretation: {
    intent: string;
    objective: string;
  };
  answer: {
    summary: string;
    details?: string;
  };
  agents: OrchestrationAgentActivity[];
  evidence: OrchestrationEvidence[];
  calculations?: OrchestrationCalculation[];
  supportingData?: Array<{
    label: string;
    value: string;
    source: string;
  }>;
  citations?: Array<{
    id: string;
    title: string;
    source: string;
    relevance: string;
  }>;
  votes?: AgentVote[];
  boardConsensus?: BoardConsensus;
  approval?: OrchestrationApprovalRequirement;
  plan?: {
    id: string;
    title: string;
    description: string;
    status: string;
    steps: string[];
    tasks: DelegatedTask[];
  };
  notifications?: Array<{
    id: string;
    title: string;
    message: string;
    type: string;
  }>;
  nextActions?: Array<{
    label: string;
    action: string;
  }>;
  confidence?: number;
  error?: {
    code: string;
    message: string;
  };
}

/** P1 Task 8 — a pending/closed offer of Membership, as returned by /api/invitations. */
export interface CompanyInvitation {
  id: string;
  email: string;
  role: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  expiresAt: string;
  acceptedAt?: string | null;
  createdAt: string;
  invitedById?: string;
  /** Development only: present when no SMTP provider is configured. */
  invitationUrl?: string;
  emailDelivered?: boolean;
}

/** P1 Task 8 — a real account with access to the company. */
export interface CompanyMembership {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  role: string;
  status: 'ACTIVE' | 'SUSPENDED';
  joinedAt: string;
  /** P1 Task 9 — the owner membership is protected and cannot be removed. */
  isOwner?: boolean;
  isSelf?: boolean;
}

export interface TeamMember {
  id: string;
  fullName: string;
  name?: string;
  email: string;
  role: string;
  department: string;
  status?: 'Active' | 'Invited' | 'Inactive';
  skills?: string[];
  responsibilities?: string[];
  joinedAt: string;
  /**
   * P1 Task 9 — true when this roster entry matches a live company account by
   * email. Such a person is shown once, under Company Accounts, not as a
   * duplicate roster-only entry.
   */
  hasAccount?: boolean;
  linkedUserId?: string | null;
}

export type CommunityPostType = 'announcement' | 'question' | 'knowledge' | 'update' | 'recognition';

export interface CommunityPost {
  id: string;
  startupId: string;
  type: CommunityPostType;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  tags?: string[];
  department?: string;
  reactions: Record<string, number>;
  userReactions?: string[];
  isAnswered?: boolean;
  knowledgeDocId?: string | null;
  commentsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityComment {
  id: string;
  postId: string;
  content: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  isAnswer?: boolean;
  createdAt: string;
}

export interface TaskBlocker {
  id: string;
  taskId: string;
  reason: string;
  status: 'OPEN' | 'RESOLVED';
  reportedById: string;
  reportedByName: string;
  reportedByRole: string;
  resolutionNote?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
}

export interface OrgMemberNode {
  id: string;
  name: string;
  email: string;
  role: string;
  title: string;
  department: string;
  level: 1 | 2 | 3;
  reportsToId?: string | null;
  reportsToName?: string | null;
  directReportsCount?: number;
  directReportNames?: string[];
  availability: AvailabilityStatus;
  statusText?: string;
  location: string;
  timezone: string;
  skills: string[];
  activeProjects: string[];
  responsibilities: string[];
  currentDeliverable?: string;
  bio: string;
}

export interface ReportingHierarchy {
  founder: { id: string; name: string; email: string; role: string; title: string };
  myManager: { id: string; name: string; email: string; role: string; title: string } | null;
  reportingPath: Array<{ name: string; role: string; title: string }>;
  departmentTeammates: Array<{ id: string; name: string; email: string; role: string; department: string }>;
  allMembers?: OrgMemberNode[];
  levels?: {
    level1: OrgMemberNode[];
    level2: OrgMemberNode[];
    level3: OrgMemberNode[];
  };
}

export interface MeetingActionItem {
  id: string;
  text: string;
  assigneeName?: string;
  completed?: boolean;
}

export interface CompanyMeeting {
  id: string;
  startupId: string;
  title: string;
  purpose: string;
  startTime: string;
  endTime: string;
  timezone: string;
  provider: 'google_meet' | 'teams' | 'zoom' | 'other';
  joinUrl: string;
  organizerId: string;
  organizerName: string;
  organizerRole: string;
  attendees: Array<{ id: string; name: string; role: string }>;
  projectName?: string;
  taskId?: string;
  isDemo?: boolean;
  createdAt: string;
  meetingNotes?: string;
  keyDecisions?: string[];
  actionItems?: MeetingActionItem[];
  recordingUrl?: string;
}

export interface WorkspaceActivityEvent {
  id: string;
  startupId: string;
  type: 'task_assigned' | 'task_progress' | 'task_submitted' | 'task_approved' | 'blocker_reported' | 'blocker_resolved' | 'meeting_scheduled' | 'post_created' | 'resource_shared';
  title: string;
  description: string;
  actorName: string;
  actorRole: string;
  entityId?: string;
  entityType?: 'task' | 'project' | 'meeting' | 'post' | 'document';
  timestamp: string;
}

export type AvailabilityStatus = 'AVAILABLE' | 'FOCUS' | 'MEETING' | 'LEAVE' | 'OFFLINE';

export interface UserAvailability {
  userId: string;
  status: AvailabilityStatus;
  statusText?: string;
  updatedAt: string;
}

export interface ProjectContribution {
  id: string;
  name: string;
  objective: string;
  ownerName: string;
  ownerRole: string;
  status: 'planning' | 'in_progress' | 'completed' | 'on_hold';
  totalTasks: number;
  completedTasks: number;
  progressPercentage: number;
  myRole: string;
  myTasksCount: number;
  myCompletedCount: number;
  nextDeliverable?: string;
  milestoneDeadline?: string;
}

export interface DomainExpert {
  id: string;
  name: string;
  role: string;
  department: string;
  email: string;
  avatar?: string;
  availability: AvailabilityStatus;
  statusText?: string;
  skills: string[];
  bio: string;
  reportsTo?: string;
  reportsToId?: string;
  level?: number;
  location?: string;
  timezone?: string;
  activeProjects?: string[];
  directReportsCount?: number;
  directReportNames?: string[];
  responsibilities?: string[];
  currentDeliverable?: string;
}

export interface TaskProgressUpdate {
  id: string;
  taskId: string;
  authorId: string;
  authorName: string;
  authorRole?: string;
  note: string;
  createdAt: string;
}

export interface EmployeeRecord {
  id?: string;
  name: string;
  email?: string;
  role: string;
  domain: string;
  status: 'Available' | 'Busy' | 'On Leave';
  skills: string[];
  responsibilities: string[];
  capacityPercentage?: number;
  activeTasksCount?: number;
  avatar?: string;
}

export interface HiringReasoning {
  diagnostic: string;
  rationale: string;
  roleTitle: string;
  domain: string;
  employmentType: string;
  coreResponsibilities: string[];
  requiredSkills: string[];
  immediateDeliverables: string[];
  estimatedCompBand?: string;
  urgencyTier: 'CRITICAL' | 'HIGH' | 'MODERATE';
  suggestedJobPosting?: {
    headline: string;
    summary: string;
    requirementsSnippet: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 5.8: Workflows as Explicit Execution Objects
// ─────────────────────────────────────────────────────────────────────────────

export type ExecutionTaskStatus = 'BLOCKED' | 'READY' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'REVISED';
export type TaskOwnerType = 'HUMAN_EMPLOYEE' | 'AI_AGENT' | 'HYBRID';
export type FailurePolicy = 'HALT_CASCADE' | 'ROLLBACK' | 'FALLBACK_ROUTE' | 'REVISE_DEADLINES';

export interface WorkflowPrecondition {
  id: string;
  description: string;
  status: 'MET' | 'BLOCKED' | 'PENDING_CHECK';
  verifiedAt?: string;
  evidenceUri?: string;
}

export interface WorkflowApprovalRequirement {
  id: string;
  role: string;
  approverName: string;
  isSatisfied: boolean;
  approvalRequestId?: string;
  notes?: string;
}

export interface WorkflowExecutionHistoryEntry {
  id: string;
  timestamp: string;
  actor: string;
  actorRole: string;
  action: string;
  statusBefore: ExecutionTaskStatus;
  statusAfter: ExecutionTaskStatus;
  comment?: string;
  evidenceProof?: string;
}

export interface ExplicitWorkflowTask {
  id: string;
  title: string;
  description: string;
  department: 'ENGINEERING' | 'MARKETING' | 'SALES' | 'FINANCE' | 'LEGAL' | 'EXECUTIVE' | 'OPERATIONS';
  responsibleOwner: {
    name: string;
    role: string;
    type: TaskOwnerType;
    email?: string;
    avatar?: string;
  };
  deadline: string; // ISO date format
  originalDeadline?: string;
  isDeadlineRevised?: boolean;
  deadlineRevisionReason?: string;
  dependencies: string[]; // Task IDs that must be COMPLETED before this task can become READY
  preconditions: WorkflowPrecondition[];
  approvalRequirements: WorkflowApprovalRequirement[];
  completionCriteria: string[];
  failureHandling: {
    policy: FailurePolicy;
    remediationAction: string;
    escalateTo: string;
  };
  status: ExecutionTaskStatus;
  progressPercent: number;
  outputArtifact?: {
    name: string;
    type: string;
    uri?: string;
    summary: string;
  };
  executionHistory: WorkflowExecutionHistoryEntry[];
}

export interface ExecutionWorkflow {
  id: string;
  title: string;
  businessObjective: string;
  targetOutcomeMetric: string;
  category: 'product_launch' | 'funding' | 'hiring' | 'operations' | 'compliance';
  status: 'planning' | 'executing' | 'blocked' | 'completed' | 'revising';
  createdAt: string;
  updatedAt: string;
  overallProgress: number;
  tasks: ExplicitWorkflowTask[];
  history: {
    timestamp: string;
    event: string;
    actor: string;
  }[];
}

// ==========================================
// Section 5.9: Scenario Planning Types
// ==========================================

export interface ActualCompanyState {
  cashBalance: number;
  monthlyBurn: number;
  runwayMonths: number;
  activeHeadcount: number;
  contractualCommitmentsMonthly: number;
  lastVerifiedAt: string;
  verificationSource: string;
}

export interface PlannedHire {
  id: string;
  role: string;
  department: string;
  annualBaseSalary: number;
  startMonth: number; // 1 = Month 1, 2 = Month 2, 3 = Month 3
  recruitingFeePercent?: number; // e.g. 8.33% (~1 month CTC)
  hardwareCostOneTime?: number; // e.g. ₹1,50,000 (MacBook Pro + Peripherals)
  softwareToolingMonthly?: number; // e.g. ₹15,000/mo (GitHub, JetBrains, AWS)
  benefitsMultiplier?: number; // e.g. 1.168 (16.8%: EPF 12% + Gratuity 4.81%)
}

export interface OperatingExpenseDelta {
  id: string;
  category: 'recruiting' | 'equipment' | 'software_licenses' | 'benefits_statutory' | 'marketing' | 'infrastructure' | 'facilities';
  type: 'ONE_TIME' | 'RECURRING_MONTHLY';
  amount: number;
  startMonth: number;
  description: string;
}

export interface RevenueAssumption {
  monthlyAmount: number;
  confidence: 'HIGH' | 'SPECULATIVE' | 'CONTRACT_BACKED';
  basis: string;
  startMonth: number;
}

export interface ScenarioAssumptions {
  benefitsMultiplierPercent: number; // e.g. 16.8%
  recruitingFeePercent: number; // e.g. 8.33%
  hardwarePerEngineer: number; // e.g. 150000
  toolingPerEngineerMonthly: number; // e.g. 15000
  contractualCommitmentFloorMonthly: number; // e.g. 345000 (AWS RI + Office)
  staggeredScheduleDescription: string;
  rampLagMonths: number; // e.g. 3 months before engineering adds revenue
  items: Array<{
    category: string;
    assumption: string;
    costImpact: string;
    rationale: string;
    isExplicit: boolean;
  }>;
}

export interface MonthlyTrajectoryPoint {
  month: number;
  activeHires: number;
  sunkCostsDeducted: number;
  recurringBurn: number;
  projectedRevenue: number;
  endingCash: number;
  runwayRemaining: number;
  notes: string;
}

export interface ScenarioCalculationMethod {
  formula: string;
  mathEngine: string;
  rulesEnforced: string[];
  deterministicIntegrityCheck: {
    passed: boolean;
    hash: string;
    verifiedAt: string;
  };
}

export interface MajorUncertainty {
  risk: string;
  likelihood: 'LOW' | 'MEDIUM' | 'HIGH';
  impactOnRunway: 'DRASTIC_REDUCTION' | 'MODERATE_REDUCTION' | 'EXTENDS_RUNWAY';
  mitigation: string;
}

export interface ExecutiveRecommendation {
  verdict: 'PROCEED' | 'CONDITIONAL_APPROVAL' | 'EXECUTIVE_VETO';
  summary: string;
  votes: {
    cfo: { name: string; vote: 'APPROVE' | 'CONDITIONAL' | 'VETO'; rationale: string };
    talent: { name: string; vote: 'APPROVE' | 'CONDITIONAL' | 'VETO'; rationale: string };
    auditor: { name: string; vote: 'APPROVE' | 'CONDITIONAL' | 'VETO'; rationale: string };
  };
}

export interface SensitivityCase {
  caseId: string;
  title: string;
  question: string; // e.g. "What if revenue is 20% lower than expected?"
  changeApplied: string;
  projectedRunway: number;
  runwayShiftVsPrimary: number;
  projectedCashAtMonth6: number;
  riskRating: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommendationShift: string;
  isTriggerBreached: boolean;
}

export interface ScenarioPlanningObject {
  id: string;
  scenarioTitle: string;
  branchName: string;
  isHypothetical: boolean;
  createdAt: string;

  // The 8 Required Elements:
  // 1. Baseline
  baseline: ActualCompanyState;

  // 2. Proposed Change
  proposedChange: {
    title: string;
    description: string;
    hires: PlannedHire[];
    expenseDeltas: OperatingExpenseDelta[];
    revenueExpectation: RevenueAssumption;
  };

  // 3. Assumptions
  assumptions: ScenarioAssumptions;

  // 4. Calculation Method
  calculationMethod: ScenarioCalculationMethod;

  // 5. Projected Result
  projectedResult: {
    initialCash: number;
    sunkCapitalOutlay: number;
    postSunkCash: number;
    initialMonthlyBurn: number;
    steadyStateMonthlyBurn: number;
    initialRunwayMonths: number;
    projectedRunwayMonths: number;
    runwayDeltaMonths: number;
    netBurnDeltaMonthly: number;
    riskRating: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    covenantBreached: boolean;
    trajectory: MonthlyTrajectoryPoint[];
  };

  // 6. Major Uncertainties
  majorUncertainties: MajorUncertainty[];

  // 7. Recommended Decision
  recommendedDecision: ExecutiveRecommendation;

  // 8. Conditions Under Which Recommendation Changes
  conditionsUnderWhichRecommendationChanges: string[];

  // Sensitivity Analysis Matrix
  sensitivityMatrix: SensitivityCase[];
}

