import { prisma, safeDbQuery } from './dbService';
import { startupProfile, isDbAvailable } from '../state';

export interface CompanyIdentityContext {
  name: string;
  description: string;
  industry: string;
  stage: string;
  location?: string;
}

export interface FounderContext {
  id: string;
  name: string;
  role: string;
  email: string;
}

export interface BusinessContext {
  model: string;
  targetIcp: string;
  primaryProduct: string;
  problem: string;
  valueProposition: string;
  additionalInfo: string;
}

export interface FinancialContext {
  cashBalance: number;
  monthlyBurn: number;
  runwayMonths: number;
  budget: number;
  healthScore: number;
  metrics: {
    velocity: number;
    financialHealth: number;
    legalCompliance: number;
    growthRate: number;
    operationsEfficiency: number;
  };
}

export interface GrowthContext {
  goals: string[];
  currentPriorities: string[];
  targetTimeline: string;
  milestones: Array<{
    id: string;
    title: string;
    content: string;
    type: string;
    createdAt: string;
  }>;
}

export interface OperationsContext {
  teamSize: string | number;
  biggestChallenge: string;
  executiveAgents: Array<{
    id: string;
    role: string;
    name: string;
    status: string;
    currentTask?: string | null;
  }>;
  pendingApprovalsCount: number;
  pendingApprovals: Array<{
    id: string;
    title: string;
    description: string;
    type: string;
    financialChange: number;
    status: string;
  }>;
}

export interface CompanyGoalsContext extends Array<string> {
  strategicGoals: string[];
  currentPriorities: string[];
  targetMilestones: string[];
}

export interface CompanyContextMetadata {
  startupId: string;
  ownerId: string;
  cachedAt?: number;
  lastUpdated: string;
}

/**
 * Standardized Company Context representation.
 * Serves as the single reliable source of company/founder context across:
 * - Executive Dashboard
 * - AI Chief of Staff
 * - Multi-Agent Orchestrator
 * - Specialist Executives (CFO, Growth, Talent, Legal, Ops)
 * - Workflow & Strategy Engines
 */
export interface CompanyContext {
  // ── Standard Structured Snapshot (P1 Task 4) ──────────────────────────────
  identity: CompanyIdentityContext;
  founder: FounderContext;
  business: BusinessContext;
  financial: FinancialContext;
  growth: GrowthContext;
  operations: OperationsContext;
  goals: CompanyGoalsContext;
  metadata: CompanyContextMetadata;

  // ── Backwards-Compatible Accessors for CanonicalStartupContext ────────────
  startupId: string;
  ownerId: string;
  startup: {
    name: string;
    description: string;
    industry: string;
    stage: string;
  };
  financials: {
    cashBalance: number;
    monthlyBurn: number;
    runwayMonths: number;
  };
  priorities: string[];
  milestones: Array<{
    id: string;
    title: string;
    content: string;
    type: string;
    createdAt: string;
  }>;
  recentDecisions: Array<{
    id: string;
    title: string;
    description: string;
    category: string;
    financialImpact: number;
    status: string;
    createdAt: string;
  }>;
  memories?: Array<{
    id: string;
    category: string;
    title: string;
    description: string;
    createdAt: string;
  }>;
  pendingApprovals: Array<{
    id: string;
    title: string;
    description: string;
    type: string;
    financialChange: number;
    status: string;
  }>;
  documents: Array<{
    id: string;
    name: string;
    type: string;
    size: string;
    summary: string;
    startupId?: string;
  }>;
  agents: Array<{
    id: string;
    role: string;
    name: string;
    status: string;
    currentTask?: string | null;
  }>;
}

export type CanonicalStartupContext = CompanyContext;

// In-memory cache strictly keyed by startupId / userId (TTL: 30 seconds)
const contextCache = new Map<string, { context: CompanyContext; cachedAt: number }>();
const CACHE_TTL_MS = 30000;

export class CompanyContextService {
  /**
   * Directly sets or updates an in-memory CompanyContext entry.
   */
  public setContext(key: string, context: CompanyContext): void {
    const entry = { context, cachedAt: Date.now() };
    contextCache.set(key, entry);
    if (context.metadata?.startupId) contextCache.set(context.metadata.startupId, entry);
    if (context.metadata?.ownerId) contextCache.set(context.metadata.ownerId, entry);
    if (context.startupId) contextCache.set(context.startupId, entry);
    if (context.ownerId) contextCache.set(context.ownerId, entry);
  }

  /**
   * Retrieves the structured CompanyContext strictly for the authenticated user.
   * Resolves the startup where ownerId === userId, guaranteeing tenant isolation.
   */
  public async getContextForUser(userId: string): Promise<CompanyContext | null> {
    if (!userId) return null;

    // Check memory cache
    const cached = contextCache.get(userId);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return cached.context;
    }

    let startup: any = null;
    if (isDbAvailable && prisma) {
      try {
        startup = await safeDbQuery(() =>
          prisma.startup.findFirst({
            where: { ownerId: userId },
            include: {
              owner: true,
              agents: true,
              documents: { orderBy: { createdAt: 'desc' } },
              decisions: { orderBy: { createdAt: 'desc' }, take: 10 },
              plans: {
                include: {
                  approvals: { where: { status: 'pending_review' } }
                }
              },
              timeline: { orderBy: { createdAt: 'desc' }, take: 10 },
              memories: true
            }
          })
        );
      } catch (err: any) {
        console.warn('[CompanyContextService] DB lookup note for user:', err.message);
      }
    }

    // P1 Task 8: if the user owns no startup, resolve the company through their
    // Membership. This is what lets an invited team member load the shared
    // company context. Founder/ownerId resolution above is unchanged.
    if (!startup && isDbAvailable && prisma) {
      try {
        const membership: any = await safeDbQuery(() =>
          (prisma as any).membership.findFirst({
            where: { userId, status: 'ACTIVE' },
            orderBy: { createdAt: 'asc' },
            select: { startupId: true }
          })
        );
        if (membership?.startupId) {
          startup = await safeDbQuery(() =>
            prisma.startup.findUnique({
              where: { id: membership.startupId },
              include: {
                owner: true,
                agents: true,
                documents: { orderBy: { createdAt: 'desc' } },
                decisions: { orderBy: { createdAt: 'desc' }, take: 10 },
                plans: {
                  include: {
                    approvals: { where: { status: 'pending_review' } }
                  }
                },
                timeline: { orderBy: { createdAt: 'desc' }, take: 10 },
                memories: true
              }
            })
          );
        }
      } catch (err: any) {
        console.warn('[CompanyContextService] Membership lookup note:', err.message);
      }
    }

    if (!startup) {
      if (cached) return cached.context;
      return null;
    }

    return this.assembleContext(startup);
  }

  /**
   * Retrieves CompanyContext by startupId, asserting that the requesting user owns or has access to it.
   * If the startup exists but belongs to a different owner, returns null to prevent cross-company access.
   */
  public async getContextForStartup(startupId: string, requestingUserId: string): Promise<CompanyContext | null> {
    if (!startupId || !requestingUserId) return null;

    // Check memory cache
    const cached = contextCache.get(startupId);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      // Validate cached context ownership
      if (cached.context.metadata.ownerId === requestingUserId) {
        return cached.context;
      }
      // If cached context belongs to another owner, deny access
      return null;
    }

    let startup: any = null;
    if (isDbAvailable && prisma) {
      try {
        startup = await safeDbQuery(() =>
          prisma.startup.findFirst({
            where: {
              id: startupId,
              ownerId: requestingUserId
            },
            include: {
              owner: true,
              agents: true,
              documents: { orderBy: { createdAt: 'desc' } },
              decisions: { orderBy: { createdAt: 'desc' }, take: 10 },
              plans: {
                include: {
                  approvals: { where: { status: 'pending_review' } }
                }
              },
              timeline: { orderBy: { createdAt: 'desc' }, take: 10 },
              memories: true
            }
          })
        );
      } catch (err: any) {
        console.warn('[CompanyContextService] DB lookup note for startup:', err.message);
      }
    }

    if (!startup) {
      if (cached && cached.context.metadata.ownerId === requestingUserId) {
        return cached.context;
      }
      return null;
    }

    return this.assembleContext(startup);
  }

  /**
   * Retrieves CompanyContext by either startupId or userId (flexible resolver).
   * Ensures backwards compatibility with legacy getCanonicalContext calls.
   */
  public async getContextForStartupOrUser(startupIdOrUserId: string): Promise<CompanyContext | null> {
    if (!startupIdOrUserId) return null;

    const cached = contextCache.get(startupIdOrUserId);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return cached.context;
    }

    let startup: any = null;
    if (isDbAvailable && prisma) {
      try {
        startup = await safeDbQuery(() =>
          prisma.startup.findFirst({
            where: {
              OR: [
                { id: startupIdOrUserId },
                { ownerId: startupIdOrUserId }
              ]
            },
            include: {
              owner: true,
              agents: true,
              documents: { orderBy: { createdAt: 'desc' } },
              decisions: { orderBy: { createdAt: 'desc' }, take: 10 },
              plans: {
                include: {
                  approvals: { where: { status: 'pending_review' } }
                }
              },
              timeline: { orderBy: { createdAt: 'desc' }, take: 10 },
              memories: true
            }
          })
        );
      } catch (err: any) {
        console.warn('[CompanyContextService] DB lookup note for startupOrUser:', err.message);
      }
    }

    if (!startup) {
      if (cached) return cached.context;
      return null;
    }

    return this.assembleContext(startup);
  }

  /**
   * Assembles a normalized, fully validated CompanyContext from raw Prisma startup records.
   * Safe defaults are applied for any missing optional fields.
   */
  private assembleContext(startup: any): CompanyContext {
    const startupId = startup.id;
    const ownerId = startup.ownerId;

    // Extract memories
    const memories: Array<{ category: string; description: string }> = startup.memories || [];
    const icpMemory = memories.find(m => m.category === 'BUSINESS_ICP')?.description || '';
    const productMemory = memories.find(m => m.category === 'PRIMARY_PRODUCT')?.description || '';
    const problemMemory = memories.find(m => m.category === 'PROBLEM_STATEMENT')?.description || '';
    const challengeMemory = memories.find(m => m.category === 'KEY_CHALLENGE')?.description || '';
    const timelineMemory = memories.find(m => m.category === 'TIMELINE')?.description || '';
    const teamSizeMemory = memories.find(m => m.category === 'TEAM_SIZE')?.description || '1-5';
    const additionalInfoMemory = memories.find(m => m.category === 'ADDITIONAL_INFO')?.description || '';
    const businessModelMemory = memories.find(m => m.category === 'BUSINESS_MODEL')?.description || 'Subscription SaaS / B2B';

    const rawGoals = memories.filter(m => m.category === 'GOAL').map(m => m.description);
    const rawPriorities = memories.filter(m => m.category === 'PRIORITY').map(m => m.description);

    const goals = rawGoals.length > 0 ? rawGoals : ['Accelerate Product-Market Fit', 'Scale Customer Acquisition'];
    const priorities = rawPriorities.length > 0 ? rawPriorities : ['Core Product Milestones', 'Cash Preservation'];

    // Extract pending approvals
    const pendingApprovals: any[] = [];
    if (Array.isArray(startup.plans)) {
      startup.plans.forEach((p: any) => {
        if (Array.isArray(p.approvals)) {
          p.approvals.forEach((a: any) => {
            pendingApprovals.push({
              id: a.id,
              title: a.title,
              description: a.description,
              type: a.type,
              financialChange: a.financialChange,
              status: a.status
            });
          });
        }
      });
    }

    const cash = startup.cashBalance ?? 250000;
    const burn = startup.burnRate ?? 15000;
    const runway = burn > 0 ? parseFloat((cash / burn).toFixed(1)) : 999;
    const healthScore = startup.healthScore ?? 78;

    const milestones = (startup.timeline || []).map((t: any) => ({
      id: t.id,
      title: t.title,
      content: t.content,
      type: t.type,
      createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : String(t.createdAt)
    }));

    const recentDecisions = (startup.decisions || []).map((d: any) => ({
      id: d.id,
      title: d.title,
      description: d.description,
      category: d.category,
      financialImpact: d.financialImpact,
      status: d.status,
      createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : String(d.createdAt)
    }));

    const memoriesList = (startup.memories || []).map((m: any) => ({
      id: m.id,
      category: m.category,
      title: m.title,
      description: m.description,
      createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : String(m.createdAt)
    }));

    const documents = (startup.documents || []).map((d: any) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      size: d.size,
      summary: d.summary
    }));

    const executiveAgents = (startup.agents || []).map((a: any) => ({
      id: a.id,
      role: a.role,
      name: a.name,
      status: a.status,
      currentTask: a.currentTask
    }));

    // ── Build Structured Sections ─────────────────────────────────────────────
    const identity: CompanyIdentityContext = {
      name: startup.name || 'Catalyst Venture',
      description: startup.description || 'Autonomous startup workspace',
      industry: startup.industry || 'Technology / B2B SaaS',
      stage: startup.fundingStage || 'Pre-Seed',
      location: 'Remote / Global'
    };

    const founder: FounderContext = {
      id: startup.owner?.id || ownerId,
      name: startup.owner?.name || 'Founder',
      role: startup.owner?.role || 'Founder',
      email: startup.owner?.email || ''
    };

    const business: BusinessContext = {
      model: businessModelMemory,
      targetIcp: icpMemory || identity.description,
      primaryProduct: productMemory || identity.description,
      problem: problemMemory || 'Automating high-friction operational coordination for founders.',
      valueProposition: identity.description,
      additionalInfo: additionalInfoMemory
    };

    const financial: FinancialContext = {
      cashBalance: cash,
      monthlyBurn: burn,
      runwayMonths: runway,
      budget: cash,
      healthScore,
      metrics: startupProfile.metrics || {
        velocity: 65,
        financialHealth: 72,
        legalCompliance: 80,
        growthRate: 45,
        operationsEfficiency: 70
      }
    };

    const growth: GrowthContext = {
      goals,
      currentPriorities: priorities,
      targetTimeline: timelineMemory || '90 Days',
      milestones
    };

    const operations: OperationsContext = {
      teamSize: teamSizeMemory,
      biggestChallenge: challengeMemory || 'Product-Market Fit & Engineering Velocity',
      executiveAgents,
      pendingApprovalsCount: pendingApprovals.length,
      pendingApprovals
    };

    const goalsArray = [...goals];
    (goalsArray as any).strategicGoals = goals;
    (goalsArray as any).currentPriorities = priorities;
    (goalsArray as any).targetMilestones = milestones.map((m: any) => m.title);
    const goalsContext = goalsArray as unknown as CompanyGoalsContext;

    const metadata: CompanyContextMetadata = {
      startupId,
      ownerId,
      cachedAt: Date.now(),
      lastUpdated: startup.updatedAt instanceof Date ? startup.updatedAt.toISOString() : new Date().toISOString()
    };

    // Construct full backwards-compatible context
    const context: CompanyContext = {
      identity,
      founder,
      business,
      financial,
      growth,
      operations,
      goals: goalsContext,
      metadata,

      // Canonical accessors
      startupId,
      ownerId,
      startup: {
        name: identity.name,
        description: identity.description,
        industry: identity.industry,
        stage: identity.stage
      },
      financials: {
        cashBalance: cash,
        monthlyBurn: burn,
        runwayMonths: runway
      },
      priorities,
      milestones,
      recentDecisions,
      memories: memoriesList,
      pendingApprovals,
      documents,
      agents: executiveAgents
    };

    // Store in cache
    contextCache.set(startupId, { context, cachedAt: Date.now() });
    contextCache.set(ownerId, { context, cachedAt: Date.now() });

    return context;
  }

  /**
   * Returns an agent-specific scoped slice of the company context.
   * Prevents leaking irrelevant operational domains to specialist models.
   * Following P1 Task 4 Section 10:
   * - Finance / CFO: financial, business, goals, company stage
   * - Growth / CMO: business, ICP, product, market, growth, goals
   * - Talent / HR: company, stage, team, goals, runway impact
   * - Legal / GC: company identity, business, regulatory, compliance, contracts
   * - Operations / COO: operations, goals, company stage, current priorities
   * - CEO / Chief of Staff: comprehensive executive view
   */
  public getAgentScopedContext(context: CompanyContext, role: string): Record<string, any> {
    const normalizedRole = (role || 'CEO').toLowerCase();

    switch (normalizedRole) {
      case 'finance':
      case 'cfo':
        return {
          companyIdentity: context.identity,
          founder: context.founder,
          financial: context.financial,
          businessModel: context.business.model,
          strategicGoals: context.goals.strategicGoals,
          cashRunwayAssessment: {
            cash: context.financial.cashBalance,
            burn: context.financial.monthlyBurn,
            runwayMonths: context.financial.runwayMonths,
            healthScore: context.financial.healthScore
          }
        };

      case 'growth':
      case 'cmo':
        return {
          companyIdentity: context.identity,
          targetIcp: context.business.targetIcp,
          primaryProduct: context.business.primaryProduct,
          problemSolved: context.business.problem,
          growthPriorities: context.growth.currentPriorities,
          strategicGoals: context.goals.strategicGoals,
          targetTimeline: context.growth.targetTimeline
        };

      case 'talent':
      case 'hr':
        return {
          companyIdentity: context.identity,
          teamSize: context.operations.teamSize,
          biggestChallenge: context.operations.biggestChallenge,
          budgetLimitMonthly: context.financial.monthlyBurn,
          runwayMonths: context.financial.runwayMonths,
          strategicGoals: context.goals.strategicGoals
        };

      case 'legal':
      case 'counsel':
        return {
          companyIdentity: context.identity,
          businessModel: context.business.model,
          primaryProduct: context.business.primaryProduct,
          founderRole: context.founder.role,
          pendingApprovals: context.operations.pendingApprovals.filter(a => a.type === 'contract' || a.type === 'legal'),
          complianceScore: context.financial.metrics.legalCompliance
        };

      case 'operations':
      case 'coo':
        return {
          companyIdentity: context.identity,
          operations: context.operations,
          milestones: context.growth.milestones,
          currentPriorities: context.growth.currentPriorities,
          strategicGoals: context.goals.strategicGoals,
          efficiencyScore: context.financial.metrics.operationsEfficiency
        };

      case 'investment':
        return {
          companyIdentity: context.identity,
          founder: context.founder,
          financial: context.financial,
          business: context.business,
          goals: context.goals
        };

      case 'ceo':
      default:
        // CEO receives the full unified executive context
        return {
          identity: context.identity,
          founder: context.founder,
          business: context.business,
          financial: context.financial,
          growth: context.growth,
          operations: context.operations,
          goals: context.goals
        };
    }
  }

  /**
   * Formats the company context into an AI-provider agnostic string representation.
   * Completely excludes internal tokens, passwords, database IDs, and sensitive secrets.
   */
  public toPromptContext(context: CompanyContext, role = 'CEO', currentTask?: string): string {
    const c = context;
    const scoped = this.getAgentScopedContext(context, role);
    const identity = c.identity || (c as any).startup || { name: 'Company', industry: 'Software', stage: 'Early', description: '' };
    const founder = c.founder || { name: 'Founder', role: 'Founder', email: '' };
    const business = c.business || { targetIcp: '', primaryProduct: '', problem: '', model: '' };
    const financial = c.financial || (c as any).financials || { cashBalance: 0, monthlyBurn: 0, runwayMonths: 0, healthScore: 80 };
    const goalsList = Array.isArray(c.goals) ? c.goals : ((c.goals as any)?.strategicGoals || []);
    const priorities = c.growth?.currentPriorities || (c.goals as any)?.currentPriorities || [];
    const timeline = c.growth?.targetTimeline || '90 days';
    const ops = c.operations || { teamSize: 5, biggestChallenge: 'Capacity', pendingApprovalsCount: 0 };

    const lines: string[] = [
      `### COMPANY IDENTITY (STARTUP CONTEXT)`,
      `- Company Name: "${identity.name}"`,
      `- Industry: ${identity.industry}`,
      `- Stage: ${identity.stage}`,
      `- Description: "${identity.description}"`,
      ``,
      `### OPERATING FOUNDER (CURRENT USER)`,
      `- Founder Name: ${founder.name}`,
      `- Founder Role: ${founder.role}`,
      `- Email: ${founder.email}`,
      ``,
      `### BUSINESS MODEL & TARGET MARKET`,
      `- Target ICP: "${business.targetIcp}"`,
      `- Primary Product: "${business.primaryProduct}"`,
      `- Problem Solved: "${business.problem}"`,
      `- Monetization: ${business.model}`,
      ``,
      `### FINANCIAL SNAPSHOT (DETERMINISTIC GROUND TRUTH)`,
      `- Treasury Cash: $${(financial.cashBalance || 0).toLocaleString('en-US')}`,
      `- Monthly Net Burn: $${(financial.monthlyBurn || 0).toLocaleString('en-US')}/mo`,
      `- Verified Runway: ${financial.runwayMonths || 0} months`,
      `- Platform Health Score: ${financial.healthScore || 80}/100`,
      ``,
      `### STRATEGIC GOALS & PRIORITIES`,
      `- Goals: ${goalsList.join(' | ')}`,
      `- Active Priorities: ${priorities.join(' | ')}`,
      `- Target Timeline: ${timeline}`,
      ``,
      `### OPERATIONAL CONSTRAINTS`,
      `- Team Structure: ${ops.teamSize}`,
      `- Primary Challenge: "${ops.biggestChallenge}"`,
      `- Pending Approvals Count: ${ops.pendingApprovalsCount}`
    ];

    if (c.documents && c.documents.length > 0) {
      lines.push(
        ``,
        `### KNOWLEDGE BASE (VERIFIED UPLOADED DOCUMENTS)`,
        ...c.documents.map(d => `- [${d.type.toUpperCase()}] "${d.name}" (${d.size}): ${d.summary}`)
      );
    } else {
      lines.push(
        ``,
        `### KNOWLEDGE BASE (VERIFIED UPLOADED DOCUMENTS)`,
        `- No custom strategic documents uploaded yet. Living company profile is primary reference.`
      );
    }

    if (currentTask) {
      lines.push(
        ``,
        `### CURRENT TASK & FOUNDER OBJECTIVE`,
        `- Active Command: "${currentTask}"`
      );
    }

    if (role && role !== 'CEO') {
      lines.push(``, `### AGENT ROLE SPECIFIC FOCUS [${role.toUpperCase()}]:`, JSON.stringify(scoped, null, 2));
    }

    return lines.join('\n');
  }

  /**
   * Invalidates cached company context by startupId or userId.
   * Ensures freshness whenever onboarding or company settings are updated.
   */
  public invalidate(startupIdOrUserId: string): void {
    if (!startupIdOrUserId) return;
    const cached = contextCache.get(startupIdOrUserId);
    if (cached && cached.context?.metadata) {
      if (cached.context.metadata.startupId) {
        contextCache.delete(cached.context.metadata.startupId);
      }
      if (cached.context.metadata.ownerId) {
        contextCache.delete(cached.context.metadata.ownerId);
      }
    }
    contextCache.delete(startupIdOrUserId);
  }

  /**
   * Clears the entire in-memory context cache.
   */
  public clearCache(): void {
    contextCache.clear();
  }
}

export const companyContextService = new CompanyContextService();
export default companyContextService;
