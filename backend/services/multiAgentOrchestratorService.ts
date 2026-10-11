import { prisma, safeDbQuery } from './dbService';
import { callModelJson } from '../ai/gemini.service';
import { Type } from '@google/genai';

export interface EmployeeRecord {
  id?: string;
  name: string;
  domain: string;
  status: 'Available' | 'Busy' | 'On Leave';
  email?: string;
  role?: string;
  skills: string[];
  responsibilities: string[];
  capacityPercentage?: number;
  activeTasksCount?: number;
  avatar?: string;
}

export interface HiringReasoning {
  diagnostic: string;               // Detailed diagnostic of why current roster cannot execute this task
  rationale: string;                // Strategic rationale explaining why hiring is necessary rather than agent-only execution
  roleTitle: string;                // Specific professional title for the role
  domain: string;                   // Department / Domain
  employmentType: string;           // Contractor or Full-Time
  coreResponsibilities: string[];   // 4-5 concrete, practical responsibilities needed for this role to succeed
  requiredSkills: string[];         // Explicit technical and domain skills
  immediateDeliverables: string[];  // What deliverables they must produce upon joining
  estimatedCompBand?: string;       // Market compensation band benchmark
  urgencyTier: 'CRITICAL' | 'HIGH' | 'MODERATE';
  suggestedJobPosting?: {
    headline: string;
    summary: string;
    requirementsSnippet: string;
  };
}

export interface AgentTaskAllocation {
  requiredDomain: string;
  subTaskTitle: string;
  taskScope: string;
  planSteps: string[];
  assignedAgent: {
    name: string;
    role: string;
    avatar: string;
    description: string;
  };
  status: 'ASSIGNED' | 'HIRE_REQUIRED';
  assignedWorker: {
    id?: string;
    name: string;
    domain: string;
    role?: string;
    status: 'Available' | 'Busy' | 'On Leave';
    email?: string;
    skills?: string[];
    responsibilities?: string[];
  } | null;
  assignmentReasoning?: string;     // Reasoning why this available employee was matched and assigned
  hiringReasoning?: HiringReasoning; // Reasoning and role responsibilities when no worker is available
  executionStatus: 'IN_PROGRESS' | 'BLOCKED' | 'PAUSED' | 'COMPLETED';
  monitoringStatus: 'Pending Approval' | 'In Progress' | 'Action Required' | 'Paused' | 'Completed';
  systemAlert?: string;
  hiringSuggestion?: string;
  hinglishRecommendation?: string;
  headControls: {
    canPause: boolean;
    canRevoke: boolean;
    canPostJob: boolean;
    canAssign: boolean;
  };
}

export interface MasterTrackingRow {
  subTask: string;
  assignedAgent: string;
  humanEmployee: string;
  executionStatus: string;
  rawExecutionStatus: 'IN_PROGRESS' | 'BLOCKED' | 'PAUSED' | 'COMPLETED';
  headControls: Array<'Pause' | 'Revoke' | 'Click to Post Job' | 'Assign Worker'>;
}

export interface MultiAgentAssessmentResult {
  id: string;
  projectName: string;
  inputTask: string;
  currentStep: number; // 1 to 5
  pipelineStatus: 'EXECUTING' | 'BLOCKED_ON_HIRE' | 'COMPLETED' | 'PAUSED';
  totalDomains: number;
  assignedCount: number;
  hireRequiredCount: number;
  allocations: AgentTaskAllocation[];
  monitoringBlueprint: MasterTrackingRow[];
  alerts: Array<{
    domain: string;
    severity: 'warning' | 'info' | 'success';
    title: string;
    message: string;
    recommendation: string;
    hinglishRecommendation?: string;
  }>;
  executionGated: boolean;
  gateReason?: string;
  timestamp: string;
}

// Canonical Domain to Agent Mapping
const DOMAIN_AGENT_MAP: Record<string, { name: string; role: string; avatar: string; description: string }> = {
  'frontend': {
    name: 'Designer Agent',
    role: 'Frontend UI Architect (Atlas-UI)',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
    description: 'Component architecture, reactive state binding, responsive styling, and UI form workflows.'
  },
  'python backend': {
    name: 'Backend Agent',
    role: 'Python & Systems Architect (Helix)',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    description: 'SMTP background workers, queue workers, smtplib pipelines, and Python Flask/FastAPI services.'
  },
  'backend': {
    name: 'Backend Agent',
    role: 'Core Systems Architect (Helix)',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    description: 'REST/GraphQL routing, transactional DB models, and distributed microservices.'
  },
  'devops': {
    name: 'Infrastructure Agent',
    role: 'Cloud & Infrastructure Architect (Aegis)',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    description: 'Containerization, Kubernetes, CI/CD deployment pipelines, and cloud security.'
  },
  'qa testing': {
    name: 'QA & Compliance Agent',
    role: 'Verification Auditor (Sentry)',
    avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150',
    description: 'Automated end-to-end testing, integration tests, and security regression audits.'
  },
  'ui/ux design': {
    name: 'Designer Agent',
    role: 'Product Designer (Echo)',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
    description: 'Wireframing, user flows, typography, and interactive design prototypes.'
  },
  'finance': {
    name: 'CFO Agent',
    role: 'Chief Financial Officer (Aura)',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
    description: 'Financial modeling, burn runway governance, budget allocations, and compensation modeling.'
  },
  'financial modeling': {
    name: 'CFO Agent',
    role: 'Chief Financial Officer (Aura)',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
    description: 'Financial modeling, burn runway governance, and valuation forecasting.'
  },
  'accounting': {
    name: 'CFO Agent',
    role: 'Chief Financial Officer (Aura)',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
    description: 'General ledger, reconciliations, cashflow analysis, and expense management.'
  },
  'talent & hr': {
    name: 'Chief People Officer',
    role: 'HR & Talent Architect (Echo)',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
    description: 'Talent acquisition, candidate scorecarding, onboarding, and team scaling.'
  },
  'hr': {
    name: 'Chief People Officer',
    role: 'HR & Talent Architect (Echo)',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
    description: 'People operations, recruiting pipeline, and headcount governance.'
  },
  'growth & marketing': {
    name: 'Growth Lead Agent',
    role: 'Chief Commercial Officer (Vector)',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    description: 'User acquisition, viral loops, conversion funnels, and enterprise sales positioning.'
  },
  'growth': {
    name: 'Growth Lead Agent',
    role: 'Chief Commercial Officer (Vector)',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    description: 'GTM loops, acquisition campaigns, and conversion optimization.'
  },
  'operations': {
    name: 'Chief Operating Officer',
    role: 'Operations & Execution Director (Helix)',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    description: 'Cross-functional milestone execution, sprint dependencies, and workflow tracking.'
  },
  'legal': {
    name: 'General Counsel',
    role: 'Legal & Compliance Officer (Nexus)',
    avatar: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=150',
    description: 'Corporate contracts, IP assignment, governance, and regulatory safeguards.'
  }
};

export interface DomainRoleSpec {
  roleTitle: string;
  domain: string;
  skills: string[];
  responsibilities: string[];
  deliverables: string[];
  estimatedCompBand: string;
}

export const DOMAIN_ROLE_KNOWLEDGE: Record<string, DomainRoleSpec> = {
  'finance': {
    roleTitle: 'Senior Financial Analyst & Treasury Modeler',
    domain: 'Finance',
    skills: ['Financial Modeling', 'Budgeting & Forecasts', 'Cashflow Analysis', 'Burn Rate Auditing', 'Unit Economics', 'Excel / Financial Statements'],
    responsibilities: [
      'Build and maintain dynamic 3-statement financial models, runway projections, and departmental budget caps.',
      'Audit monthly burn velocity and enforce capital allocation guardrails before hiring expansions.',
      'Reconcile vendor invoices, cloud spend, and operational payroll disbursements.',
      'Prepare investor-ready financial packets and runway scenario simulations for executive council reviews.'
    ],
    deliverables: [
      'Complete financial statements and 12-month burn projection model',
      'Establish unit economics sensitivity matrix and breakeven milestones',
      'Unblock automated financial reporting and audit verification'
    ],
    estimatedCompBand: '$85,000 - $115,000 / yr (or ₹18L - ₹26L/yr)'
  },
  'python backend': {
    roleTitle: 'Python Backend & Systems Architect',
    domain: 'Python Backend',
    skills: ['Python 3.11+', 'FastAPI / Flask', 'SMTP & smtplib', 'Celery / RQ Queues', 'PostgreSQL', 'Docker', 'AsyncIO'],
    responsibilities: [
      'Implement resilient background worker queues and secure SMTP smtplib email dispatching services.',
      'Architect FastAPI/Flask transactional endpoints with robust retry policies, authentication, and rate limiting.',
      'Design PostgreSQL relational schemas with ACID guarantees, connection pooling, and automated migrations.',
      'Configure Redis job queues, worker health checks, and error telemetry alerting.'
    ],
    deliverables: [
      'Deploy production SMTP background worker service with smtplib pipeline',
      'Implement secure background task queue with automated failure recovery',
      'Expose REST API endpoints for client dashboard integration'
    ],
    estimatedCompBand: '$90,000 - $125,000 / yr (or ₹20L - ₹28L/yr)'
  },
  'backend': {
    roleTitle: 'Core Backend Systems Engineer',
    domain: 'Backend',
    skills: ['Node.js / TypeScript', 'PostgreSQL / Prisma', 'REST & GraphQL APIs', 'Distributed Systems', 'Redis Caching', 'Microservices'],
    responsibilities: [
      'Architect high-throughput transactional database models and RESTful API endpoints.',
      'Implement distributed caching, connection pooling, and optimistic concurrency locks.',
      'Enforce security middleware, RBAC authorization gates, and data sanitation.',
      'Build automated integration test fixtures ensuring zero schema regression.'
    ],
    deliverables: [
      'Deploy scalable backend microservices and database migrations',
      'Integrate authenticated API routing with tenant-isolated data security',
      'Provide API documentation and endpoint integration schemas'
    ],
    estimatedCompBand: '$90,000 - $120,000 / yr (or ₹19L - ₹27L/yr)'
  },
  'frontend': {
    roleTitle: 'Lead Frontend UI Architect',
    domain: 'Frontend',
    skills: ['React 18/19', 'TypeScript', 'Tailwind CSS', 'State Management (Zustand/Redux)', 'Vite', 'Component Design Systems', 'REST / WebSockets'],
    responsibilities: [
      'Build high-performance responsive UI components in React and TypeScript.',
      'Manage complex application state, optimistic updates, and form validations.',
      'Integrate REST and WebSocket endpoints with seamless error handling and loading skeletons.',
      'Maintain accessible design tokens, micro-interactions, and component modularity.'
    ],
    deliverables: [
      'Construct interactive client dashboard interface and forms',
      'Bind real-time API telemetry to UI state hooks',
      'Deliver zero-lag user experience across desktop and mobile'
    ],
    estimatedCompBand: '$85,000 - $115,000 / yr (or ₹18L - ₹25L/yr)'
  },
  'devops': {
    roleTitle: 'Cloud Infrastructure & DevOps Engineer',
    domain: 'DevOps',
    skills: ['Docker', 'Kubernetes', 'CI/CD Pipelines (GitHub Actions)', 'AWS / GCP Cloud', 'Terraform', 'Observability (Prometheus/Datadog)'],
    responsibilities: [
      'Architect automated CI/CD deployment pipelines with gated lint, test, and build stages.',
      'Provision containerized Docker workloads and Kubernetes cluster deployments.',
      'Enforce cloud infrastructure security, zero-trust network policies, and secret management.',
      'Monitor uptime SLAs, error budgets, and cloud resource cost optimizations.'
    ],
    deliverables: [
      'Configure end-to-end CI/CD build & deployment pipelines',
      'Deploy container cluster with health-check probes and automated restart policies',
      'Implement centralized logs and uptime alert monitors'
    ],
    estimatedCompBand: '$95,000 - $130,000 / yr (or ₹22L - ₹30L/yr)'
  },
  'qa testing': {
    roleTitle: 'QA Automation & Verification Lead',
    domain: 'QA Testing',
    skills: ['End-to-End Testing (Playwright/Cypress)', 'Integration Testing (Jest/Vitest)', 'Security Penetration Testing', 'API Automation', 'CI/CD Test Gates'],
    responsibilities: [
      'Formulate comprehensive test automation suites spanning unit, integration, and E2E regressions.',
      'Audit API boundary contracts, input validation vulnerabilities, and authentication controls.',
      'Enforce test coverage thresholds in CI/CD before staging releases.',
      'Maintain automated smoke test suites verifying production uptime.'
    ],
    deliverables: [
      'Deliver automated E2E test suites with 90%+ critical path coverage',
      'Validate security permissions and API regression boundaries',
      'Sign off on production deployment readiness'
    ],
    estimatedCompBand: '$75,000 - $100,000 / yr (or ₹16L - ₹22L/yr)'
  },
  'ui/ux design': {
    roleTitle: 'Product Designer (Design Systems & UX)',
    domain: 'UI/UX Design',
    skills: ['Figma', 'Design Systems', 'User Journey Mapping', 'Interactive Prototyping', 'Typography & Accessibility', 'UX Research'],
    responsibilities: [
      'Produce high-fidelity wireframes, typography systems, and interaction models.',
      'Build responsive component design systems aligned with modern web aesthetics.',
      'Conduct user interviews and refine navigation architectures based on telemetry.',
      'Collaborate with frontend engineers to ensure pixel-perfect CSS and animation parity.'
    ],
    deliverables: [
      'Deliver complete interactive design prototypes and Figma design tokens',
      'Establish UX user flow specifications for core product modules',
      'Review and sign off on frontend UI implementation fidelity'
    ],
    estimatedCompBand: '$75,000 - $105,000 / yr (or ₹16L - ₹23L/yr)'
  },
  'talent & hr': {
    roleTitle: 'Head of People Operations & Talent Strategy',
    domain: 'Talent & HR',
    skills: ['Technical Recruiting', 'Role Scorecarding', 'Compensation Banding', 'Candidate Pipeline Management', 'Structured Onboarding', 'Culture & Retention'],
    responsibilities: [
      'Formulate role scorecards and benchmark competitive compensation bands against market tiers.',
      'Drive sourcing, technical screening, and founder interview cadences for critical technical roles.',
      'Coordinate structured employee onboarding, IP covenant assignments, and workspace setup.',
      'Monitor team health, employee retention, and performance review rhythms.'
    ],
    deliverables: [
      'Publish vetted job requisitions and candidate scorecards',
      'Shortlist pre-screened domain candidates within 14-day SLA',
      'Coordinate offer letters and signed PIIA agreements'
    ],
    estimatedCompBand: '$80,000 - $110,000 / yr (or ₹18L - ₹24L/yr)'
  },
  'growth & marketing': {
    roleTitle: 'Head of Growth & Product Marketing',
    domain: 'Growth & Marketing',
    skills: ['Go-to-Market (GTM) Strategy', 'ICP Positioning', 'CAC / LTV Optimization', 'SEO & Content Funnels', 'Developer Marketing', 'Conversion Rate Optimization'],
    responsibilities: [
      'Define target ICP cohorts and engineer repeatable organic and outbound customer acquisition loops.',
      'Optimize conversion funnels, landing page copy, and developer evangelism channels.',
      'Track payback periods, customer churn, and marketing spend efficiency.',
      'Coordinate pilot customer onboarding cohorts and enterprise feedback loops.'
    ],
    deliverables: [
      'Launch high-converting ICP acquisition campaign',
      'Establish analytics tracking for CAC, LTV, and cohort retention',
      'Deliver 20+ qualified customer pipeline leads'
    ],
    estimatedCompBand: '$85,000 - $120,000 / yr (or ₹19L - ₹26L/yr)'
  },
  'operations': {
    roleTitle: 'Chief Operating Officer / Technical Program Manager',
    domain: 'Operations',
    skills: ['Cross-Functional Milestone Execution', 'Dependency Mapping', 'Agile Sprint Cadences', 'Resource Allocation', 'Risk Mitigation', 'Vendor Management'],
    responsibilities: [
      'Coordinate sprint milestone rhythms and eliminate inter-departmental blocking dependencies.',
      'Track deliverable SLAs across engineering, finance, and talent work streams.',
      'Decompose executive council directives into sequential work orders and audit logs.',
      'Manage vendor contracts, third-party tooling subscriptions, and operational budgets.'
    ],
    deliverables: [
      'Decompose cross-departmental milestone Gantt timeline',
      'Establish daily unblocking sync and deliverable review cadences',
      'Maintain zero-blockage execution across active sprint modules'
    ],
    estimatedCompBand: '$90,000 - $125,000 / yr (or ₹20L - ₹28L/yr)'
  }
};

// Seed default employees for realistic out-of-the-box matching
const DEFAULT_EMPLOYEES: EmployeeRecord[] = [
  {
    id: 'emp_aman',
    name: 'Aman',
    domain: 'Frontend',
    status: 'Available',
    role: 'Frontend Engineer',
    email: 'aman@company.internal',
    skills: ['React', 'TypeScript', 'Tailwind CSS', 'State Management', 'REST APIs'],
    responsibilities: [
      'Develop and maintain client-side dashboard components and interactive forms',
      'Integrate application state with backend APIs and handle real-time events',
      'Optimize UI responsiveness and user experience transitions'
    ],
    capacityPercentage: 25,
    activeTasksCount: 1
  },
  {
    id: 'emp_rahul',
    name: 'Rahul',
    domain: 'Python Backend',
    status: 'Busy', // Rahul is currently occupied with sprint workloads
    role: 'Python Backend Specialist',
    email: 'rahul@company.internal',
    skills: ['Python', 'FastAPI', 'SMTP', 'Worker Queues', 'PostgreSQL'],
    responsibilities: [
      'Build asynchronous worker pipelines and smtplib services',
      'Maintain API routing, worker queues, and transactional integrity',
      'Monitor task execution queues and background jobs'
    ],
    capacityPercentage: 100,
    activeTasksCount: 3
  },
  {
    id: 'emp_priya',
    name: 'Priya Nair',
    domain: 'UI/UX Design',
    status: 'Available',
    role: 'Product Designer',
    email: 'priya@company.internal',
    skills: ['Figma', 'Design Systems', 'User Research'],
    responsibilities: [
      'Create interactive wireframes and design tokens for venture interfaces',
      'Align user journey maps with venture milestones and feature specs',
      'Conduct usability reviews and maintain design consistency'
    ],
    capacityPercentage: 0,
    activeTasksCount: 0
  },
  {
    id: 'emp_rajesh',
    name: 'Rajesh Verma',
    domain: 'DevOps',
    status: 'Busy',
    role: 'DevOps Specialist',
    email: 'rajesh@company.internal',
    skills: ['Docker', 'Kubernetes', 'AWS', 'CI/CD Pipelines'],
    responsibilities: [
      'Maintain container infrastructure and deployment pipelines',
      'Monitor cluster health, uptime telemetry, and cloud spend',
      'Enforce infrastructure security policies and zero-trust access'
    ],
    capacityPercentage: 90,
    activeTasksCount: 2
  }
];

export class MultiAgentOrchestratorService {
  private activeAssessments = new Map<string, MultiAgentAssessmentResult>();
  private customEmployees = new Map<string, EmployeeRecord[]>();
  private liveRegisteredEmployees = new Map<string, EmployeeRecord[]>();

  public inferSkills(domain: string, role?: string): string[] {
    const d = (domain || '').toLowerCase().trim();
    const r = (role || '').toLowerCase().trim();
    for (const [key, spec] of Object.entries(DOMAIN_ROLE_KNOWLEDGE)) {
      if (d.includes(key) || key.includes(d) || r.includes(key)) {
        return spec.skills;
      }
    }
    if (d.includes('finan') || r.includes('finan') || d.includes('account') || d.includes('budget') || d.includes('cfo')) {
      return DOMAIN_ROLE_KNOWLEDGE['finance'].skills;
    }
    if (d.includes('front') || r.includes('front') || d.includes('react') || d.includes('ui')) {
      return DOMAIN_ROLE_KNOWLEDGE['frontend'].skills;
    }
    if (d.includes('python') || r.includes('python') || d.includes('smtp')) {
      return DOMAIN_ROLE_KNOWLEDGE['python backend'].skills;
    }
    if (d.includes('hr') || r.includes('hr') || d.includes('talent') || d.includes('people')) {
      return DOMAIN_ROLE_KNOWLEDGE['talent & hr'].skills;
    }
    if (d.includes('market') || d.includes('growth') || d.includes('sales')) {
      return DOMAIN_ROLE_KNOWLEDGE['growth & marketing'].skills;
    }
    return ['Domain Execution', 'Cross-Functional Collaboration', 'Quality Assurance'];
  }

  public inferResponsibilities(domain: string, role?: string): string[] {
    const d = (domain || '').toLowerCase().trim();
    const r = (role || '').toLowerCase().trim();
    for (const [key, spec] of Object.entries(DOMAIN_ROLE_KNOWLEDGE)) {
      if (d.includes(key) || key.includes(d) || r.includes(key)) {
        return spec.responsibilities;
      }
    }
    if (d.includes('finan') || r.includes('finan') || d.includes('account') || d.includes('budget') || d.includes('cfo')) {
      return DOMAIN_ROLE_KNOWLEDGE['finance'].responsibilities;
    }
    if (d.includes('front') || r.includes('front') || d.includes('react') || d.includes('ui')) {
      return DOMAIN_ROLE_KNOWLEDGE['frontend'].responsibilities;
    }
    if (d.includes('python') || r.includes('python') || d.includes('smtp')) {
      return DOMAIN_ROLE_KNOWLEDGE['python backend'].responsibilities;
    }
    if (d.includes('hr') || r.includes('hr') || d.includes('talent') || d.includes('people')) {
      return DOMAIN_ROLE_KNOWLEDGE['talent & hr'].responsibilities;
    }
    if (d.includes('market') || d.includes('growth') || d.includes('sales')) {
      return DOMAIN_ROLE_KNOWLEDGE['growth & marketing'].responsibilities;
    }
    return [
      `Execute ${domain || 'departmental'} deliverables according to sprint specifications`,
      'Collaborate with multi-agent council companion agents on automated workflows',
      'Provide human domain verification and quality assurance for production deliverables'
    ];
  }

  /**
   * Generates deep, structured hiring reasoning and role responsibilities when no employee is available
   */
  public generateHiringReasoning(params: {
    requiredDomain: string;
    subTaskTitle: string;
    taskScope: string;
    matchedAgentName: string;
    busyWorker?: EmployeeRecord;
  }): HiringReasoning {
    const { requiredDomain, subTaskTitle, taskScope, matchedAgentName, busyWorker } = params;
    const d = requiredDomain.toLowerCase().trim();

    let spec: DomainRoleSpec = DOMAIN_ROLE_KNOWLEDGE['operations'];
    for (const [k, s] of Object.entries(DOMAIN_ROLE_KNOWLEDGE)) {
      if (d.includes(k) || k.includes(d)) {
        spec = s;
        break;
      }
    }
    if (d.includes('finan') || d.includes('account') || d.includes('budget') || d.includes('cfo')) {
      spec = DOMAIN_ROLE_KNOWLEDGE['finance'];
    } else if (d.includes('python') || d.includes('smtp')) {
      spec = DOMAIN_ROLE_KNOWLEDGE['python backend'];
    } else if (d.includes('front') || d.includes('react') || d.includes('ui')) {
      spec = DOMAIN_ROLE_KNOWLEDGE['frontend'];
    }

    const diagnostic = busyWorker
      ? `Roster Diagnostic: Existing candidate worker "${busyWorker.name}" was identified for the ${requiredDomain} domain, but their presence status is currently BUSY / OCCUPIED with active sprint deliverables. No alternative available specialist exists in the venture roster.`
      : `Roster Diagnostic: Scanned company roster across all venture departments. Found 0 active personnel under the ${requiredDomain} domain. The venture currently lacks an employee with domain authority and technical competencies to execute "${subTaskTitle}".`;

    const rationale = `Governance Rationale: Companion agent "${matchedAgentName}" can generate automated code and architectures, but enterprise governance strictly mandates a qualified human domain owner for production verification, credentials authorization, and regulatory sign-off. Leaving "${subTaskTitle}" unstaffed creates hallucination risks and blocks the automated execution pipeline.`;

    return {
      diagnostic,
      rationale,
      roleTitle: spec.roleTitle,
      domain: spec.domain,
      employmentType: 'Contractor (Immediate Ramp) or Full-Time Employee',
      coreResponsibilities: spec.responsibilities,
      requiredSkills: spec.skills,
      immediateDeliverables: spec.deliverables,
      estimatedCompBand: spec.estimatedCompBand,
      urgencyTier: 'CRITICAL',
      suggestedJobPosting: {
        headline: `We're Hiring: ${spec.roleTitle} (${spec.domain})`,
        summary: `Join our venture to take full domain ownership of ${subTaskTitle}. You will collaborate with executive multi-agent co-pilots and lead: ${spec.responsibilities.slice(0, 2).join('; ')}.`,
        requirementsSnippet: `Core competencies: ${spec.skills.join(', ')}. Scope: ${taskScope}.`
      }
    };
  }

  /**
   * Registers a live employee/worker in-memory so they are immediately accessible
   * to the Multi-Agent Orchestration engine.
   */
  public registerLiveWorker(worker: {
    id?: string;
    startupId?: string;
    userId?: string;
    name: string;
    domain: string;
    role?: string;
    email?: string;
    status?: 'Available' | 'Busy' | 'On Leave';
    skills?: string[];
    responsibilities?: string[];
    capacityPercentage?: number;
    activeTasksCount?: number;
  }): EmployeeRecord {
    const rawStatus = (worker.status || 'Available').toLowerCase();
    const status: 'Available' | 'Busy' | 'On Leave' = 
      (rawStatus === 'busy' || rawStatus === 'occupied') ? 'Busy' :
      (rawStatus === 'on leave' || rawStatus === 'leave' || rawStatus === 'inactive') ? 'On Leave' : 'Available';

    const domain = worker.domain.trim();
    const role = worker.role || `${domain} Specialist`;
    const skills = worker.skills && worker.skills.length > 0 ? worker.skills : this.inferSkills(domain, role);
    const responsibilities = worker.responsibilities && worker.responsibilities.length > 0 ? worker.responsibilities : this.inferResponsibilities(domain, role);

    const record: EmployeeRecord = {
      id: worker.id || `emp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: worker.name.trim(),
      domain,
      status,
      email: worker.email || `${worker.name.toLowerCase().replace(/\s+/g, '.')}@company.internal`,
      role,
      skills,
      responsibilities,
      capacityPercentage: worker.capacityPercentage ?? (status === 'Busy' ? 85 : 0),
      activeTasksCount: worker.activeTasksCount ?? (status === 'Busy' ? 2 : 0)
    };

    const key = worker.startupId || 'default_startup';
    const list = this.liveRegisteredEmployees.get(key) || [];
    const idx = list.findIndex(e => (worker.id && e.id === worker.id) || e.name.toLowerCase() === record.name.toLowerCase());
    if (idx !== -1) {
      list[idx] = record;
    } else {
      list.unshift(record);
    }
    this.liveRegisteredEmployees.set(key, list);
    return record;
  }

  /**
   * Removes a worker from the live in-memory registry
   */
  public removeLiveWorker(id: string) {
    for (const [key, list] of this.liveRegisteredEmployees.entries()) {
      this.liveRegisteredEmployees.set(key, list.filter(e => e.id !== id));
    }
  }

  /**
   * Domain fuzzy matching helper:
   * Maps 'React', 'Frontend', 'Web' -> 'Frontend'
   * Maps 'Python Backend', 'Python', 'SMTP Worker', 'Backend' -> 'Python Backend'
   * Maps 'Finance', 'Financial Analysis', 'Budget', 'Accountant', 'CFO' -> 'Finance'
   */
  public matchDomain(workerDomain: string, requiredDomain: string, workerRole?: string, workerSkills?: string[]): boolean {
    const w = (workerDomain || '').toLowerCase().trim();
    const r = (requiredDomain || '').toLowerCase().trim();
    const role = (workerRole || '').toLowerCase().trim();
    const skills = (workerSkills || []).map(s => (s || '').toLowerCase().trim());

    if (w === r) return true;
    if (w && r && (w.includes(r) || r.includes(w))) return true;

    // Check role match
    if (role && (role.includes(r) || (r && role.split(' ').some(part => part.length > 2 && r.includes(part))))) {
      return true;
    }

    // Check skills
    if (skills.some(s => s && (s.includes(r) || r.includes(s)))) {
      return true;
    }

    // Finance cluster
    const isFinReq = r.includes('finan') || r.includes('account') || r.includes('budget') || r.includes('cfo') || r.includes('treasury') || r.includes('audit') || r.includes('tax') || r.includes('fiscal') || r.includes('bookkeep');
    const isFinWorker = w.includes('finan') || w.includes('account') || w.includes('budget') || w.includes('cfo') || w.includes('treasury') || w.includes('audit') || w.includes('tax') || w.includes('fiscal') || w.includes('bookkeep') ||
      role.includes('finan') || role.includes('account') || role.includes('cfo') || skills.some(s => s.includes('finan') || s.includes('account') || s.includes('budget'));
    if (isFinReq && isFinWorker) return true;

    // Frontend cluster
    const isFrontReq = r.includes('front') || r.includes('react') || r.includes('ui') || r.includes('web') || r.includes('client');
    const isFrontWorker = w.includes('front') || w.includes('react') || w.includes('ui') || w.includes('web') || w.includes('client') ||
      role.includes('front') || role.includes('react') || role.includes('ui');
    if (isFrontReq && isFrontWorker) return true;

    // Python / Backend cluster
    const isPythonReq = r.includes('python') || r.includes('smtp') || r.includes('fastapi') || r.includes('flask') || r.includes('django');
    const isPythonWorker = w.includes('python') || role.includes('python') || skills.includes('python');
    if (isPythonReq && isPythonWorker) return true;

    const isBackReq = r.includes('backend') || r.includes('api') || r.includes('server') || r.includes('database') || r.includes('systems');
    const isBackWorker = w.includes('backend') || role.includes('backend') || w.includes('python') || w.includes('node') || w.includes('systems');
    if (isBackReq && isBackWorker) return true;

    // DevOps cluster
    const isDevOpsReq = r.includes('devops') || r.includes('infra') || r.includes('cloud') || r.includes('docker') || r.includes('k8s') || r.includes('kubernetes');
    const isDevOpsWorker = w.includes('devops') || w.includes('infra') || w.includes('cloud') || role.includes('devops');
    if (isDevOpsReq && isDevOpsWorker) return true;

    // QA cluster
    const isQAReq = r.includes('qa') || r.includes('test') || r.includes('quality');
    const isQAWorker = w.includes('qa') || w.includes('test') || role.includes('qa') || role.includes('tester');
    if (isQAReq && isQAWorker) return true;

    // Talent & HR cluster
    const isHRReq = r.includes('hr') || r.includes('talent') || r.includes('people') || r.includes('recruit') || r.includes('hiring') || r.includes('culture');
    const isHRWorker = w.includes('hr') || w.includes('talent') || w.includes('people') || w.includes('recruit') || role.includes('hr') || role.includes('recruiter');
    if (isHRReq && isHRWorker) return true;

    // Growth & Marketing cluster
    const isGrowthReq = r.includes('growth') || r.includes('market') || r.includes('sales') || r.includes('seo') || r.includes('campaign') || r.includes('commercial');
    const isGrowthWorker = w.includes('growth') || w.includes('market') || w.includes('sales') || role.includes('growth') || role.includes('marketing');
    if (isGrowthReq && isGrowthWorker) return true;

    // Operations cluster
    const isOpsReq = r.includes('operat') || r.includes('ops') || r.includes('logistics') || r.includes('supply');
    const isOpsWorker = w.includes('operat') || w.includes('ops') || role.includes('operations');
    if (isOpsReq && isOpsWorker) return true;

    return false;
  }

  /**
   * Retrieves active employees for the startup from database + persistent memory + default roster
   */
  public async getEmployees(startupId?: string, userId?: string): Promise<EmployeeRecord[]> {
    const roster: EmployeeRecord[] = [];

    // 1. Check Prisma Memory for real TEAM_MEMBER records
    try {
      if (prisma) {
        const query: any = {
          where: { category: 'TEAM_MEMBER' },
          orderBy: { createdAt: 'desc' }
        };
        if (startupId && startupId !== 'default_startup') {
          query.where.startupId = startupId;
        }
        const memories = await safeDbQuery(() => (prisma as any).memory.findMany(query));
        if (Array.isArray(memories) && memories.length > 0) {
          for (const m of memories) {
            try {
              const parsed = JSON.parse(m.description);
              const name = parsed.fullName || parsed.name || m.title;
              const rawStatus = (parsed.status || 'Active').toLowerCase();
              const status: 'Available' | 'Busy' = (rawStatus === 'busy' || rawStatus === 'occupied') ? 'Busy' : 'Available';
              const role = parsed.role || 'Specialist';
              const domain = parsed.department || parsed.systemRole || role;
              const skills = (parsed.skills && Array.isArray(parsed.skills) && parsed.skills.length > 0)
                ? parsed.skills
                : this.inferSkills(domain, role);
              const responsibilities = (parsed.responsibilities && Array.isArray(parsed.responsibilities) && parsed.responsibilities.length > 0)
                ? parsed.responsibilities
                : this.inferResponsibilities(domain, role);

              if (name && !roster.some(e => e.name.toLowerCase() === name.toLowerCase())) {
                roster.push({
                  id: m.id,
                  name,
                  domain,
                  role,
                  status,
                  email: parsed.email,
                  skills,
                  responsibilities,
                  capacityPercentage: status === 'Busy' ? 85 : 0,
                  activeTasksCount: status === 'Busy' ? 2 : 0
                });
              }
            } catch {
              if (m.title && !roster.some(e => e.name.toLowerCase() === m.title.toLowerCase())) {
                const domain = m.description || 'General';
                const role = m.description || 'Specialist';
                roster.push({
                  id: m.id,
                  name: m.title,
                  domain,
                  role,
                  status: 'Available',
                  skills: this.inferSkills(domain, role),
                  responsibilities: this.inferResponsibilities(domain, role),
                  capacityPercentage: 0,
                  activeTasksCount: 0
                });
              }
            }
          }
        }
      }
    } catch (err: any) {
      console.warn('[MultiAgentOrchestrator] Database TEAM_MEMBER lookup error:', err.message);
    }

    // 2. Merge in live dynamically registered employees
    const keysToCheck = [startupId, 'default_startup'].filter(Boolean) as string[];
    for (const k of keysToCheck) {
      const liveList = this.liveRegisteredEmployees.get(k) || [];
      for (const emp of liveList) {
        if (!roster.some(e => e.name.toLowerCase() === emp.name.toLowerCase())) {
          roster.push(emp);
        }
      }
    }

    // 3. Merge customEmployees (from assignWorkerToSlot / registerHiredWorker)
    if (startupId && this.customEmployees.has(startupId)) {
      for (const emp of (this.customEmployees.get(startupId) || [])) {
        if (!roster.some(e => e.name.toLowerCase() === emp.name.toLowerCase())) {
          roster.push(emp);
        }
      }
    }

    // 4. Merge Prisma active memberships if available
    try {
      if (prisma && startupId && startupId !== 'default_startup') {
        const memberships = await safeDbQuery(() => (prisma as any).membership.findMany({
          where: { startupId, status: 'ACTIVE' },
          include: { user: true }
        }));

        if (Array.isArray(memberships)) {
          for (const m of memberships) {
            const userName = m.user?.name || m.user?.email?.split('@')[0] || 'Team Member';
            const userRole = m.role || 'Member';
            
            let domain = 'Engineering';
            if (userRole === 'HR') domain = 'Talent & HR';
            else if (userRole === 'FINANCE') domain = 'Finance';
            else if (userRole === 'GROWTH') domain = 'Growth & Marketing';
            else if (userRole === 'OPERATIONS') domain = 'Operations';

            if (!roster.some(e => e.name.toLowerCase() === userName.toLowerCase())) {
              roster.push({
                id: m.userId,
                name: userName,
                domain,
                status: 'Available',
                role: userRole,
                email: m.user?.email,
                skills: this.inferSkills(domain, userRole),
                responsibilities: this.inferResponsibilities(domain, userRole),
                capacityPercentage: 0,
                activeTasksCount: 0
              });
            }
          }
        }
      }
    } catch (err: any) {
      console.warn('[MultiAgentOrchestrator] Database membership lookup fallback:', err.message);
    }

    // 5. Append DEFAULT_EMPLOYEES for unstaffed base domains so standard templates work
    for (const seed of DEFAULT_EMPLOYEES) {
      if (!roster.some(e => e.name.toLowerCase() === seed.name.toLowerCase())) {
        roster.push(seed);
      }
    }

    return roster;
  }

  /**
   * Adds or registers a newly hired worker into the employee database
   */
  public async registerHiredWorker(startupId: string, worker: {
    name: string;
    domain: string;
    email?: string;
    role?: string;
  }): Promise<EmployeeRecord> {
    const domain = worker.domain.trim();
    const role = worker.role || `${domain} Specialist`;
    const skills = this.inferSkills(domain, role);
    const responsibilities = this.inferResponsibilities(domain, role);

    const newRecord: EmployeeRecord = {
      id: `emp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: worker.name.trim(),
      domain,
      status: 'Available',
      email: worker.email || `${worker.name.toLowerCase().replace(/\s+/g, '.')}@company.internal`,
      role,
      skills,
      responsibilities,
      capacityPercentage: 0,
      activeTasksCount: 0
    };

    const current = this.customEmployees.get(startupId) || [];
    current.push(newRecord);
    this.customEmployees.set(startupId, current);

    return newRecord;
  }

  /**
   * Step 1: AI analyzes user requirement and decomposes into technical & business domains and sub-tasks.
   */
  public async analyzeRequirementWithAI(userRequirement: string): Promise<{
    projectName: string;
    allocations: Array<{ required_domain: string; sub_task_title: string; task_scope: string }>;
  }> {
    const fallbackGenerator = () => {
      const lower = userRequirement.toLowerCase();
      const allocations: Array<{ required_domain: string; sub_task_title: string; task_scope: string }> = [];

      if (lower.includes('email') || lower.includes('smtp') || (lower.includes('python') && lower.includes('react'))) {
        allocations.push({
          required_domain: 'Frontend',
          sub_task_title: 'UI Dashboard',
          task_scope: '1. Design HTML Form. 2. Bind states with APIs.'
        });
        allocations.push({
          required_domain: 'Python Backend',
          sub_task_title: 'SMTP Backend Worker',
          task_scope: '1. Configure SMTP credentials and smtplib. 2. Implement background worker queue. 3. Expose Flask/FastAPI routing endpoints.'
        });
      } else if (lower.includes('finan') || lower.includes('budget') || lower.includes('account') || lower.includes('cfo') || lower.includes('runway') || lower.includes('revenue') || lower.includes('expense') || lower.includes('tax') || lower.includes('audit')) {
        allocations.push({
          required_domain: 'Finance',
          sub_task_title: 'Financial Analysis & Budget Modeling',
          task_scope: '1. Prepare financial statements & cashflow model. 2. Analyze burn rate, budget allocations and projections. 3. Finalize audit reports.'
        });
        if (lower.includes('dash') || lower.includes('chart') || lower.includes('kpi') || lower.includes('react')) {
          allocations.push({
            required_domain: 'Frontend',
            sub_task_title: 'Financial Dashboard UI',
            task_scope: '1. Render financial charts and KPI widgets. 2. Bind ledger and reporting APIs.'
          });
        }
      } else if (lower.includes('figma') || lower.includes('wireframe') || lower.includes('design flow') || lower.includes('design system')) {
        allocations.push({
          required_domain: 'UI/UX Design',
          sub_task_title: 'Interactive Design System & Wireframes',
          task_scope: '1. Create Figma wireframes. 2. Build component tokens and responsive design flow.'
        });
        if (lower.includes('docker') || lower.includes('k8s') || lower.includes('kubernetes') || lower.includes('devops') || lower.includes('cluster') || lower.includes('ci/cd') || lower.includes('infra')) {
          allocations.push({
            required_domain: 'DevOps',
            sub_task_title: 'Infrastructure Deployment & Cluster Orchestration',
            task_scope: '1. Configure Docker containerization. 2. Deploy Kubernetes manifests and CI/CD pipelines.'
          });
        }
      } else if (lower.includes('hr') || lower.includes('talent') || lower.includes('people') || lower.includes('recruit')) {
        allocations.push({
          required_domain: 'Talent & HR',
          sub_task_title: 'Talent Acquisition & Headcount Strategy',
          task_scope: '1. Formulate role scorecard. 2. Screen qualified candidates. 3. Finalize compensation bands.'
        });
      } else if (lower.includes('growth') || lower.includes('sales') || lower.includes('gtm') || (lower.includes('market') && !lower.includes('email'))) {
        allocations.push({
          required_domain: 'Growth & Marketing',
          sub_task_title: 'GTM Campaign & Customer Acquisition',
          task_scope: '1. Target enterprise ICP cohorts. 2. Launch campaign pipeline. 3. Measure CAC/LTV conversions.'
        });
      } else {
        allocations.push({
          required_domain: 'Frontend',
          sub_task_title: 'Client UI Interface',
          task_scope: '1. Develop responsive interface. 2. Connect client state hooks.'
        });
        allocations.push({
          required_domain: 'Backend',
          sub_task_title: 'Core Business Logic API',
          task_scope: '1. Implement database models. 2. Expose secure endpoints.'
        });
      }

      return {
        projectName: userRequirement.slice(0, 48) + (userRequirement.length > 48 ? '...' : ''),
        allocations
      };
    };

    const isTestEnv = Boolean(
      process.env.NODE_ENV === 'test' ||
      process.env.NODE_TEST_CONTEXT ||
      process.argv.some(arg => arg.includes('test'))
    );
    if (isTestEnv) {
      return fallbackGenerator();
    }

    const prompt = `You are an Executive Multi-Agent Technical & Operations Architect.
Analyze this user task or project requirement and decompose it into ONLY the minimal set of primary domains (between 1 and 3 domains maximum) that are EXPLICITLY mentioned or directly required for the scope:
"${userRequirement}"

Supported domains:
- Finance (Financial Modeling, Budgeting, Valuation, Accounting, Burn Governance, Audit)
- Frontend (React, UI Components, Client State, Dashboard)
- Python Backend (APIs, SMTP background workers, Queue Workers, Python services)
- Backend (APIs, Microservices, Transactional DB Models)
- DevOps (Infrastructure, CI/CD, Cloud Deployment, Docker, Kubernetes)
- QA Testing (Verification, Security Regression, End-to-End Testing)
- UI/UX Design (Figma, Design Systems, UX Wireframes)
- Talent & HR (Recruiting, Scorecards, Compensation Modeling)
- Growth & Marketing (Go-to-market, User Acquisition, Conversion Optimization)
- Operations (Milestones, Cross-functional Execution)

CRITICAL RULES:
1. Precision: Decompose into ONLY the domains explicitly mentioned or strictly required for this task. Do NOT include extraneous, speculative, or supporting domains (e.g., if only a React dashboard and Python SMTP worker are requested, output ONLY "Frontend" and "Python Backend").
2. Single-Domain Tasks: If the task is purely financial/budgeting, output ONLY "Finance". If the task is purely design or HR, output only that domain.
3. Output at most 2-3 focused domain allocations.

Return a JSON object conforming to:
{
  "projectName": "Short Title",
  "allocations": [
    {
      "required_domain": "Domain name (e.g. Finance, Frontend, Python Backend, DevOps, etc.)",
      "sub_task_title": "Short title of sub-task",
      "task_scope": "1. Step 1 instructions... 2. Step 2 instructions..."
    }
  ]
}`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        projectName: { type: Type.STRING },
        allocations: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              required_domain: { type: Type.STRING },
              sub_task_title: { type: Type.STRING },
              task_scope: { type: Type.STRING }
            },
            required: ['required_domain', 'sub_task_title', 'task_scope']
          }
        }
      },
      required: ['projectName', 'allocations']
    };

    return callModelJson(prompt, { responseSchema: schema, temperature: 0.1 }, fallbackGenerator);
  }

  /**
   * Executes the full 5-Step Multi-Agent Orchestration & Resource Allocation:
   * [ Input Task ] ──► (1. Select Agents) ──► (2. Check Employee DB) 
   *                                                  │
   *                      ┌───────────────────────────┴───────────┐
   *                      ▼ (Available)                           ▼ (Not Available)
   *              (3A. Assign Work)                       (3B. Notify Head to Hire)
   *                      │                                       │
   *                      ▼                                       ▼
   *              (4. Generate Plan)                     (Suggest Domain Specs)
   *                      │
   *                      ▼
   *         (5. Live Monitoring Dashboard)
   */
  public async orchestrateTask(params: {
    userRequirement: string;
    startupId?: string;
    userId?: string;
  }): Promise<MultiAgentAssessmentResult> {
    const { userRequirement, startupId = 'default_startup', userId } = params;
    const assessmentId = `orch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    console.log(`[MultiAgentOrchestrator] Processing requirement: "${userRequirement}"`);

    // Step 1: AI decomposes requirement into technical & business domains
    const aiAssessment = await this.analyzeRequirementWithAI(userRequirement);

    // Step 2: Check real employee database for active workers
    const employees = await this.getEmployees(startupId, userId);

    const allocations: AgentTaskAllocation[] = [];
    const alerts: MultiAgentAssessmentResult['alerts'] = [];
    let assignedCount = 0;
    let hireRequiredCount = 0;

    const isAvailable = (s?: string) => {
      const norm = (s || '').toLowerCase().trim();
      return norm === 'available' || norm === 'active' || norm === 'idle' || norm === 'ready' || norm === '';
    };
    const isBusy = (s?: string) => {
      const norm = (s || '').toLowerCase().trim();
      return norm === 'busy' || norm === 'occupied' || norm === 'in_progress';
    };

    for (const alloc of aiAssessment.allocations) {
      const domainKey = alloc.required_domain.toLowerCase().trim();
      const matchedAgent = DOMAIN_AGENT_MAP[domainKey] || 
        (domainKey.includes('finan') || domainKey.includes('account') || domainKey.includes('budget') ? DOMAIN_AGENT_MAP['finance'] : undefined) ||
        (domainKey.includes('front') || domainKey.includes('react') || domainKey.includes('ui') ? DOMAIN_AGENT_MAP['frontend'] : undefined) ||
        (domainKey.includes('python') || domainKey.includes('smtp') ? DOMAIN_AGENT_MAP['python backend'] : undefined) ||
        (domainKey.includes('hr') || domainKey.includes('talent') || domainKey.includes('people') ? DOMAIN_AGENT_MAP['talent & hr'] : undefined) ||
        (domainKey.includes('growth') || domainKey.includes('market') ? DOMAIN_AGENT_MAP['growth & marketing'] : undefined) ||
        (domainKey.includes('ops') || domainKey.includes('operat') ? DOMAIN_AGENT_MAP['operations'] : undefined) ||
        DOMAIN_AGENT_MAP['backend'] || {
          name: 'Core Agent',
          role: 'Domain Specialist',
          avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
          description: 'Specialized domain execution assistant.'
        };

      // Match against employee DB
      const matchedWorker = employees.find(emp => 
        this.matchDomain(emp.domain, alloc.required_domain, emp.role, emp.skills) && isAvailable(emp.status)
      );

      // Check if employee exists but is busy
      const busyWorker = employees.find(emp => 
        this.matchDomain(emp.domain, alloc.required_domain, emp.role, emp.skills) && isBusy(emp.status)
      );

      // Parse plan steps from task_scope
      const steps = alloc.task_scope
        .split(/(?=\d+\.\s+)/)
        .map(s => s.trim())
        .filter(Boolean);

      if (steps.length === 0) {
        steps.push(alloc.task_scope);
      }

      if (matchedWorker) {
        // Case 3A: Worker is Available
        assignedCount++;
        const assignmentReasoning = `✅ Match Found: Identified active employee "${matchedWorker.name}" (${matchedWorker.role || matchedWorker.domain}). Verified presence status is Available with competencies in [${(matchedWorker.skills || []).slice(0, 3).join(', ') || matchedWorker.domain}]. Workload capacity: ${matchedWorker.capacityPercentage ?? 25}%. Task successfully assigned to ${matchedWorker.name}; Companion Agent ${matchedAgent.name} will provide automated co-pilot support.`;

        allocations.push({
          requiredDomain: alloc.required_domain,
          subTaskTitle: alloc.sub_task_title,
          taskScope: alloc.task_scope,
          planSteps: steps,
          assignedAgent: matchedAgent,
          status: 'ASSIGNED',
          assignedWorker: {
            id: matchedWorker.id,
            name: matchedWorker.name,
            domain: matchedWorker.domain,
            role: matchedWorker.role,
            status: 'Available',
            email: matchedWorker.email,
            skills: matchedWorker.skills,
            responsibilities: matchedWorker.responsibilities
          },
          assignmentReasoning,
          executionStatus: 'IN_PROGRESS',
          monitoringStatus: 'Pending Approval',
          headControls: {
            canPause: true,
            canRevoke: true,
            canPostJob: false,
            canAssign: false
          }
        });

        alerts.push({
          domain: alloc.required_domain,
          severity: 'success',
          title: `[${alloc.required_domain} Domain] Resource Assigned`,
          message: `Assigned to active worker: ${matchedWorker.name} (${matchedWorker.role || matchedWorker.domain}).`,
          recommendation: `Worker assigned. Monitoring status: Pending Approval.`
        });
      } else {
        // Case 3B: Worker is NOT Available (Core Requirement)
        hireRequiredCount++;
        const busyNote = busyWorker ? ` (${busyWorker.name} is currently Busy)` : '';

        const hiringReasoning = this.generateHiringReasoning({
          requiredDomain: alloc.required_domain,
          subTaskTitle: alloc.sub_task_title,
          taskScope: alloc.task_scope,
          matchedAgentName: matchedAgent.name,
          busyWorker
        });

        const englishHiringSuggestion = `No active worker found for ${alloc.required_domain}${busyNote}. Recommended Role: ${hiringReasoning.roleTitle}. Key Responsibilities: ${hiringReasoning.coreResponsibilities.slice(0, 2).join('; ')}.`;
        
        let hinglishRecommendation = `Aapko immediate basis pe ${hiringReasoning.roleTitle} (${alloc.required_domain}) hire karna chahiye jo ${alloc.task_scope} deliver kar sake.`;
        if (domainKey.includes('python') || domainKey.includes('smtp') || domainKey.includes('backend')) {
          hinglishRecommendation = `Aapko immediate basis pe Python Backend Developer hire karna chahiye jise SMTP configuration, smtplib, aur Flask API routing ka access pipeline create karna aata ho.`;
        } else if (domainKey.includes('front')) {
          hinglishRecommendation = `Aapko immediate basis pe Frontend Specialist hire karna chahiye jise React state binding, dynamic forms, aur API integration aati ho.`;
        } else if (domainKey.includes('finan') || domainKey.includes('account') || domainKey.includes('budget')) {
          hinglishRecommendation = `Aapko immediate basis pe Finance Lead hire karna chahiye jo cashflow audit, financial modeling, aur monthly burn reconciliation manage kar sake.`;
        }

        allocations.push({
          requiredDomain: alloc.required_domain,
          subTaskTitle: alloc.sub_task_title,
          taskScope: alloc.task_scope,
          planSteps: steps,
          assignedAgent: matchedAgent,
          status: 'HIRE_REQUIRED',
          assignedWorker: null,
          hiringReasoning,
          executionStatus: 'BLOCKED',
          monitoringStatus: 'Action Required',
          systemAlert: `⚠️ ACTION REQUIRED: You need to hire a contractor or full-time employee for this phase.`,
          hiringSuggestion: englishHiringSuggestion,
          hinglishRecommendation,
          headControls: {
            canPause: false,
            canRevoke: false,
            canPostJob: true,
            canAssign: true
          }
        });

        alerts.push({
          domain: alloc.required_domain,
          severity: 'warning',
          title: `⚠️ [${alloc.required_domain} Domain] - ACTION REQUIRED: Hire ${hiringReasoning.roleTitle}`,
          message: `${hiringReasoning.diagnostic} ${hiringReasoning.rationale}`,
          recommendation: englishHiringSuggestion,
          hinglishRecommendation
        });
      }
    }

    // Step 4: Generate Plan & Dependency Gating
    const executionGated = hireRequiredCount > 0;
    const pipelineStatus = executionGated ? 'BLOCKED_ON_HIRE' : 'EXECUTING';
    const gateReason = executionGated
      ? `AI multi-agent execution pipeline is blocked. Head must hire or assign an employee to the unfilled domain slots before automated steps can resume.`
      : undefined;

    // Step 5: Master Tracking Blueprint (For Head Monitoring)
    const monitoringBlueprint: MasterTrackingRow[] = allocations.map(a => {
      let executionStatusText = '⏳ In Progress';
      if (a.executionStatus === 'BLOCKED') {
        executionStatusText = '❌ BLOCKED (Hire Recommended)';
      } else if (a.executionStatus === 'PAUSED') {
        executionStatusText = '⏸️ Paused';
      } else if (a.executionStatus === 'COMPLETED') {
        executionStatusText = '✅ Completed';
      }

      return {
        subTask: a.subTaskTitle,
        assignedAgent: `${a.assignedAgent.name}`,
        humanEmployee: a.assignedWorker ? `${a.assignedWorker.name} (Available)` : 'None',
        executionStatus: executionStatusText,
        rawExecutionStatus: a.executionStatus,
        headControls: a.status === 'ASSIGNED'
          ? ['Pause', 'Revoke']
          : ['Click to Post Job', 'Assign Worker']
      };
    });

    const result: MultiAgentAssessmentResult = {
      id: assessmentId,
      projectName: aiAssessment.projectName || 'Multi-Agent Project Delivery',
      inputTask: userRequirement,
      currentStep: 5,
      pipelineStatus,
      totalDomains: allocations.length,
      assignedCount,
      hireRequiredCount,
      allocations,
      monitoringBlueprint,
      alerts,
      executionGated,
      gateReason,
      timestamp: new Date().toISOString()
    };

    this.activeAssessments.set(assessmentId, result);
    return result;
  }

  /**
   * Retrieves an assessment by ID
   */
  public getAssessment(assessmentId: string): MultiAgentAssessmentResult | undefined {
    return this.activeAssessments.get(assessmentId);
  }

  /**
   * Retrieves the most recent assessment
   */
  public getLatestAssessment(): MultiAgentAssessmentResult | undefined {
    const list = Array.from(this.activeAssessments.values());
    return list[list.length - 1];
  }

  /**
   * Head Action: Hires or assigns a worker to an unfilled/blocked slot.
   * Updates database and immediately unblocks the pipeline if all slots are filled.
   */
  public async assignWorkerToSlot(params: {
    assessmentId: string;
    domain: string;
    workerName: string;
    workerEmail?: string;
    workerRole?: string;
    startupId?: string;
  }): Promise<MultiAgentAssessmentResult> {
    const { assessmentId, domain, workerName, workerEmail, workerRole, startupId = 'default_startup' } = params;
    const assessment = this.activeAssessments.get(assessmentId);
    if (!assessment) {
      throw new Error(`Assessment ${assessmentId} not found.`);
    }

    // 1. Register hired worker in database / custom roster
    const newWorker = await this.registerHiredWorker(startupId, {
      name: workerName,
      domain,
      role: workerRole,
      email: workerEmail
    });

    // 2. Update the target allocation
    const target = assessment.allocations.find(a => 
      this.matchDomain(a.requiredDomain, domain)
    );

    if (!target) {
      throw new Error(`Domain ${domain} not found in assessment ${assessmentId}.`);
    }

    target.status = 'ASSIGNED';
    target.assignedWorker = {
      id: newWorker.id,
      name: newWorker.name,
      domain: newWorker.domain,
      role: newWorker.role,
      status: 'Available',
      email: newWorker.email,
      skills: newWorker.skills,
      responsibilities: newWorker.responsibilities
    };
    target.assignmentReasoning = `✅ Match Confirmed: Appointed and assigned worker "${newWorker.name}" (${newWorker.role}) to ${target.requiredDomain} domain. Presence verified as Available. Deliverables unblocked under companion agent co-pilot.`;
    target.executionStatus = 'IN_PROGRESS';
    target.monitoringStatus = 'Pending Approval';
    target.headControls = {
      canPause: true,
      canRevoke: true,
      canPostJob: false,
      canAssign: false
    };

    // 3. Recalculate counts & gating
    assessment.assignedCount = assessment.allocations.filter(a => a.status === 'ASSIGNED').length;
    assessment.hireRequiredCount = assessment.allocations.filter(a => a.status === 'HIRE_REQUIRED').length;

    if (assessment.hireRequiredCount === 0) {
      assessment.executionGated = false;
      assessment.pipelineStatus = 'EXECUTING';
      assessment.gateReason = undefined;
    }

    // 4. Update monitoring blueprint
    assessment.monitoringBlueprint = assessment.allocations.map(a => {
      let executionStatusText = '⏳ In Progress';
      if (a.executionStatus === 'BLOCKED') {
        executionStatusText = '❌ BLOCKED (Hire Recommended)';
      } else if (a.executionStatus === 'PAUSED') {
        executionStatusText = '⏸️ Paused';
      } else if (a.executionStatus === 'COMPLETED') {
        executionStatusText = '✅ Completed';
      }

      return {
        subTask: a.subTaskTitle,
        assignedAgent: `${a.assignedAgent.name}`,
        humanEmployee: a.assignedWorker ? `${a.assignedWorker.name} (Available)` : 'None',
        executionStatus: executionStatusText,
        rawExecutionStatus: a.executionStatus,
        headControls: a.status === 'ASSIGNED'
          ? ['Pause', 'Revoke']
          : ['Click to Post Job', 'Assign Worker']
      };
    });

    assessment.timestamp = new Date().toISOString();
    this.activeAssessments.set(assessmentId, assessment);

    console.log(`[MultiAgentOrchestrator] Slot ${domain} filled with worker ${workerName}. Gated: ${assessment.executionGated}`);
    return assessment;
  }

  /**
   * Head Action: Control slot execution (Pause, Resume, or Revoke)
   */
  public controlSlot(params: {
    assessmentId: string;
    domain: string;
    action: 'pause' | 'resume' | 'revoke';
  }): MultiAgentAssessmentResult {
    const { assessmentId, domain, action } = params;
    const assessment = this.activeAssessments.get(assessmentId);
    if (!assessment) {
      throw new Error(`Assessment ${assessmentId} not found.`);
    }

    const target = assessment.allocations.find(a => 
      this.matchDomain(a.requiredDomain, domain)
    );

    if (!target) {
      throw new Error(`Domain ${domain} not found in assessment ${assessmentId}.`);
    }

    if (action === 'pause') {
      target.executionStatus = 'PAUSED';
      target.monitoringStatus = 'Paused';
    } else if (action === 'resume') {
      target.executionStatus = 'IN_PROGRESS';
      target.monitoringStatus = 'In Progress';
    } else if (action === 'revoke') {
      target.status = 'HIRE_REQUIRED';
      target.assignedWorker = null;
      target.executionStatus = 'BLOCKED';
      target.monitoringStatus = 'Action Required';
      target.headControls = {
        canPause: false,
        canRevoke: false,
        canPostJob: true,
        canAssign: true
      };
      assessment.executionGated = true;
      assessment.pipelineStatus = 'BLOCKED_ON_HIRE';
      assessment.gateReason = `Worker assignment revoked for ${domain}. Head must reassign or hire.`;
    }

    // Refresh blueprint
    assessment.monitoringBlueprint = assessment.allocations.map(a => {
      let executionStatusText = '⏳ In Progress';
      if (a.executionStatus === 'BLOCKED') {
        executionStatusText = '❌ BLOCKED (Hire Recommended)';
      } else if (a.executionStatus === 'PAUSED') {
        executionStatusText = '⏸️ Paused';
      } else if (a.executionStatus === 'COMPLETED') {
        executionStatusText = '✅ Completed';
      }

      return {
        subTask: a.subTaskTitle,
        assignedAgent: `${a.assignedAgent.name}`,
        humanEmployee: a.assignedWorker ? `${a.assignedWorker.name} (Available)` : 'None',
        executionStatus: executionStatusText,
        rawExecutionStatus: a.executionStatus,
        headControls: a.status === 'ASSIGNED'
          ? ['Pause', 'Revoke']
          : ['Click to Post Job', 'Assign Worker']
      };
    });

    this.activeAssessments.set(assessmentId, assessment);
    return assessment;
  }
}

export const multiAgentOrchestratorService = new MultiAgentOrchestratorService();
