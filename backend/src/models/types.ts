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
  status: 'pending' | 'in_progress' | 'submitted' | 'changes_requested' | 'approved' | 'rejected';
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

export interface Deliverable {
  id: string;
  initiativeId: string;
  title: string;
  description: string;
  type: 'document' | 'contract' | 'financials' | 'marketing_plan' | 'policy';
  status: 'pending_review' | 'approved' | 'rejected' | 'changes_requested';
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
  // Phase D — Employee Review -> Founder Approval Experience
  preparedBy?: string;
  preparedByRole?: string;
  aiAssistance?: string;
  summary?: string;
  recommendation?: string;
  taskId?: string;
  founderFeedback?: string;
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
}

export type UserRole =
  | 'Founder' | 'Executive' | 'Investor' | 'Admin'
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
