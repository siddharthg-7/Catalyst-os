import { prisma, safeDbQuery } from './dbService';
import { ai } from './geminiService';
import { ingestDocument } from './ragEngine';
import { knowledgeFiles, startupProfile } from '../state';
import { companyContextService, CompanyContext } from './companyContextService';
import { ensureMembership } from './membershipService';

export type CanonicalStartupContext = CompanyContext;

export interface OnboardingPayload {
  founderName?: string;
  founderRole?: string;
  startupName: string;
  industry: string;
  description?: string;
  idea?: string;
  fundingStage?: string;
  stage?: string;
  businessModel?: string;
  targetIcp?: string;
  newCustomers?: string;
  primaryProduct?: string;
  problem?: string;
  cashBalance?: number | string;
  monthlyBurn?: number | string;
  budget?: number | string;
  burnRate?: number | string;
  runway?: string;
  goals?: string[];
  priorities?: string[];
  path?: 'existing' | 'new';
  teamSize?: string | number;
  biggestChallenge?: string;
  timeline?: string;
  additionalInfo?: string;
}

export interface StartupAnalysisResult {
  summary: string;
  insights: string[];
  healthScore: number;
  metrics: {
    velocity: number;
    financialHealth: number;
    legalCompliance: number;
    growthRate: number;
    operationsEfficiency: number;
  };
  dossierMarkdown: string;
}

function parseFinancialNumber(val: any, defaultVal = 0): number {
  if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
  if (!val || typeof val !== 'string') return defaultVal;
  const cleaned = val.replace(/,/g, '').trim();
  const kMatch = cleaned.match(/([\d.]+)\s*k/i);
  if (kMatch) {
    return parseFloat(kMatch[1]) * 1000;
  }
  const mMatch = cleaned.match(/([\d.]+)\s*m/i);
  if (mMatch) {
    return parseFloat(mMatch[1]) * 1000000;
  }
  const numMatch = cleaned.match(/[\d.]+/);
  if (numMatch) {
    const parsed = parseFloat(numMatch[0]);
    return isNaN(parsed) ? defaultVal : parsed;
  }
  return defaultVal;
}

// 8 Canonical Executive Agents specified in PROMPT.MD Sections 24 & 25
export const DEFAULT_EXECUTIVE_ROLES = [
  { role: 'CEO', name: 'Atlas', avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150', description: 'Autonomous corporate strategist & CEO orchestrator.' },
  { role: 'Finance', name: 'Aura', avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150', description: 'Chief Financial Officer: unit economics, cash burn, and runway governance.' },
  { role: 'Talent', name: 'Echo', avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150', description: 'Head of People & Recruiting: talent acquisition, hiring roadmaps, compensation.' },
  { role: 'Growth', name: 'Vector', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', description: 'VP of Growth & Marketing: ICP positioning, CAC/LTV, demand generation.' },
  { role: 'Legal', name: 'Nexus', avatar: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=150', description: 'General Counsel: IP protection, compliance, commercial contracts, regulatory safeguards.' },
  { role: 'Operations', name: 'Helix', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150', description: 'VP of Operations: cross-functional milestone tracking, delivery, workflow velocity.' },
  { role: 'Investment', name: 'Apex', avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150', description: 'Head of Capital & Investor Relations: fundraising strategy, cap table modeling.' },
  { role: 'Auditor', name: 'Sentry', avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150', description: 'Compliance & Verification Auditor: math accuracy, evidence grounding, hallucination prevention.' },
];


export class WorkspaceService {
  /**
   * Continuous AI Strategic Analysis for Startups
   * Evaluates the startup parameters, business viability, runway risk, and key execution metrics.
   */
  public async analyzeStartupProfile(payload: OnboardingPayload, runway: number): Promise<StartupAnalysisResult> {
    const startupName = payload.startupName || 'Catalyst Venture';
    const industry = payload.industry || 'Technology';
    const description = payload.description || payload.idea || 'Early-stage venture building specialized software.';
    const stage = payload.fundingStage || payload.stage || 'Pre-Seed';
    const icp = payload.targetIcp || payload.newCustomers || 'B2B software buyers';
    const problem = payload.problem || 'Market workflow inefficiency';
    const challenge = payload.biggestChallenge || 'Market customer acquisition and MVP delivery';
    const timeline = payload.timeline || '90 Days';
    const cash = parseFinancialNumber(payload.cashBalance ?? payload.budget, 250000);
    const burn = parseFinancialNumber(payload.monthlyBurn ?? payload.burnRate, 15000);

    // Fallback baseline in case AI model call is offline or throttled
    const fallbackSummary = `${startupName} is an emerging ${stage} venture in the ${industry} space addressing "${problem.slice(0, 100)}". With $${cash.toLocaleString()} in capital and a ${runway} month runway, the company is positioned to scale execution toward its ${timeline} milestone.`;
    const fallbackInsights = [
      `ICP Precision: Focus sales and marketing specifically on ${icp.slice(0, 80)} to optimize initial CAC.`,
      `Runway Management: Maintain strict governance over the $${burn.toLocaleString()}/mo burn rate to secure ${runway} months of operational runway.`,
      `Core Challenge Mitigation: Deploy dedicated sprints toward resolving: "${challenge.slice(0, 80)}".`,
      `Milestone Velocity: Align executive agents to deliver initial deliverables within the ${timeline} window.`
    ];
    const fallbackDossier = `# [Company Profile] ${startupName}

## Executive Summary
${fallbackSummary}

## Strategic Baseline & Core Proposition
- **Industry & Domain**: ${industry}
- **Stage**: ${stage}
- **Core Problem Solved**: ${problem}
- **Product & Vision**: ${description}
- **Ideal Customer Profile (ICP)**: ${icp}
- **Primary Operational Challenge**: ${challenge}
- **Target Milestone Horizon**: ${timeline}

## Financial Economics
- **Available Capital**: $${cash.toLocaleString()}
- **Monthly Burn**: $${burn.toLocaleString()} / month
- **Estimated Runway**: ${runway} months
- **Financial Status**: ${runway >= 12 ? 'Healthy capital runway (>12 months)' : runway >= 6 ? 'Adequate runway (6-12 months), requires milestone discipline' : 'Critical runway (<6 months), immediate revenue or funding required'}

## Key Strategic Directives for Catalyst OS AI Executive Agents
*(Note: These refer to your automated Catalyst OS AI agent copilots supporting the venture, not human employees.)*
1. **Atlas (Autonomous CEO Agent)**: Align cross-functional roadmap and strategic focus around target customers (${icp}).
2. **Aura (Autonomous Finance Agent)**: Ensure monthly cash outlays stay strictly within $${burn.toLocaleString()}/mo ceiling.
3. **Vector (Autonomous Growth Agent)**: Design customer acquisition and pilot outreach tailored to ${icp}.
4. **Nexus (Autonomous Legal Agent)**: Verify compliance safeguards, intellectual property protection, and customer agreement templates.
5. **Helix (Autonomous Operations Agent)**: Track delivery milestones to hit the ${timeline} delivery goal.
`;

    if (ai) {
      try {
        const prompt = `You are CatalystOS Executive Strategist AI. Analyze this startup and produce a structured JSON response:
Company: "${startupName}"
Industry: "${industry}"
Stage: "${stage}"
Product / Idea: "${description}"
Core Problem: "${problem}"
Target ICP: "${icp}"
Key Challenge: "${challenge}"
Milestone Timeline: "${timeline}"
Cash Balance: $${cash}
Monthly Burn: $${burn}
Runway Months: ${runway}
Additional Founder Notes: "${payload.additionalInfo || 'None'}"

Generate a valid JSON object matching this schema:
{
  "summary": "2-3 sentence strategic executive assessment of the company and operational posture.",
  "insights": [
    "Insight 1 (Growth & ICP)",
    "Insight 2 (Financial & Runway)",
    "Insight 3 (Product & Challenge)",
    "Insight 4 (Operations & Milestone)"
  ],
  "healthScore": 82, // integer 65-95 based on runway and clarity
  "metrics": {
    "velocity": 85,
    "financialHealth": 88,
    "legalCompliance": 90,
    "growthRate": 60,
    "operationsEfficiency": 82
  },
  "dossierMarkdown": "Full comprehensive markdown profile document starting with # [Company Profile] ${startupName} with Executive Overview, Market & ICP, Financial Economics, and Executive Directives."
}

Return ONLY valid JSON without markdown code blocks.`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.2
          }
        });

        const parsed = JSON.parse(response.text?.trim() || '{}');
        if (parsed.summary && Array.isArray(parsed.insights)) {
          return {
            summary: parsed.summary,
            insights: parsed.insights,
            healthScore: typeof parsed.healthScore === 'number' ? parsed.healthScore : 82,
            metrics: {
              velocity: parsed.metrics?.velocity || 80,
              financialHealth: parsed.metrics?.financialHealth || 85,
              legalCompliance: parsed.metrics?.legalCompliance || 90,
              growthRate: parsed.metrics?.growthRate || 65,
              operationsEfficiency: parsed.metrics?.operationsEfficiency || 80,
            },
            dossierMarkdown: parsed.dossierMarkdown || fallbackDossier
          };
        }
      } catch (err: any) {
        console.warn('[WorkspaceService] Gemini analysis fallback engaged:', err.message);
      }
    }

    return {
      summary: fallbackSummary,
      insights: fallbackInsights,
      healthScore: Math.min(95, Math.max(65, Math.round(70 + (runway > 12 ? 15 : runway * 1.2)))),
      metrics: {
        velocity: 80,
        financialHealth: runway > 12 ? 90 : runway > 6 ? 75 : 60,
        legalCompliance: 90,
        growthRate: 65,
        operationsEfficiency: 82,
      },
      dossierMarkdown: fallbackDossier
    };
  }

  /**
   * Initializes or updates a startup workspace for a user with canonical context.
   * Runs continuous AI strategic analysis and generates/updates the living Knowledge Base dossier.
   */
  public async saveOnboardingData(userId: string, payload: OnboardingPayload): Promise<CanonicalStartupContext> {
    const rawCash = payload.cashBalance !== undefined ? payload.cashBalance : payload.budget;
    const rawBurn = payload.monthlyBurn !== undefined ? payload.monthlyBurn : payload.burnRate;
    const cash = parseFinancialNumber(rawCash, 250000);
    const burn = parseFinancialNumber(rawBurn, 15000);
    const runway = burn > 0 ? parseFloat((cash / burn).toFixed(1)) : 999;

    const startupName = payload.startupName?.trim() || 'Catalyst Venture';
    const industry = payload.industry?.trim() || 'Technology';
    const description = (payload.description || payload.idea || payload.problem || 'Technology venture building innovative software.').trim();
    const fundingStage = payload.fundingStage || payload.stage || 'Pre-Seed';
    const targetIcp = payload.targetIcp || payload.newCustomers || '';
    const problem = payload.problem || '';
    const challenge = payload.biggestChallenge || '';
    const timeline = payload.timeline || '90 Days';

    // 1. Ensure user exists
    let user: any = null;
    try {
      user = await safeDbQuery(() => prisma.user.findUnique({ where: { id: userId } }));
      if (!user) {
        user = await safeDbQuery(() => prisma.user.create({
          data: {
            id: userId,
            email: `${userId}@catalyst.os`,
            name: payload.founderName || 'Founder',
            role: payload.founderRole || 'Founder'
          }
        }));
      } else if (payload.founderName || payload.founderRole) {
        user = await safeDbQuery(() => prisma.user.update({
          where: { id: userId },
          data: {
            name: payload.founderName || user?.name,
            role: payload.founderRole || user?.role
          }
        }));
      }
    } catch (userErr: any) {
      console.warn('[WorkspaceService] User sync database note:', userErr.message);
    }

    // 2. Perform AI Strategic Analysis on this startup's details
    console.log(`[WorkspaceService] Running AI strategic analysis for "${startupName}"...`);
    const analysis = await this.analyzeStartupProfile(
      {
        ...payload,
        startupName,
        industry,
        description,
        fundingStage,
        targetIcp,
        problem,
        biggestChallenge: challenge,
        timeline,
        cashBalance: cash,
        monthlyBurn: burn,
      },
      runway
    );

    // 3. Find existing startup or create fresh one
    let startup: any = null;
    try {
      startup = await safeDbQuery(() => prisma.startup.findFirst({
        where: { ownerId: userId },
        orderBy: { createdAt: 'desc' }
      }));

      if (startup) {
        startup = await safeDbQuery(() => prisma.startup.update({
          where: { id: startup!.id },
          data: {
            name: startupName,
            industry,
            description,
            fundingStage,
            cashBalance: cash,
            burnRate: burn,
            healthScore: analysis.healthScore,
          }
        }));
      } else {
        startup = await safeDbQuery(() => prisma.startup.create({
          data: {
            name: startupName,
            industry,
            description,
            fundingStage,
            cashBalance: cash,
            burnRate: burn,
            healthScore: analysis.healthScore,
            ownerId: userId
          }
        }));
      }
    } catch (startupDbErr: any) {
      console.warn('[WorkspaceService] Startup database sync note:', startupDbErr.message);
    }

    if (!startup) {
      startup = {
        id: `stp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: startupName,
        industry,
        description,
        fundingStage,
        cashBalance: cash,
        burnRate: burn,
        healthScore: analysis.healthScore,
        ownerId: userId
      };
    }

    const startupId = startup.id;
    // Explicitly guarantee the founder holds an authoritative ACTIVE FOUNDER membership
    try {
      await ensureMembership(userId, startupId, 'FOUNDER');
    } catch (mErr: any) {
      console.warn('[WorkspaceService] Founder membership sync note:', mErr?.message);
    }

    // Synchronize startup_contexts table if available
    try {
      await safeDbQuery(() => (prisma as any).startup_contexts.upsert({
        where: { id: startupId },
        create: {
          id: startupId,
          company_name: startupName,
          industry,
          target_icp: targetIcp || null,
          current_monthly_burn: burn,
          cash_on_hand: cash,
        },
        update: {
          company_name: startupName,
          industry,
          target_icp: targetIcp || null,
          current_monthly_burn: burn,
          cash_on_hand: cash,
        }
      }));
    } catch (scErr: any) {
      // Non-fatal if table schema varies
      console.warn('[WorkspaceService] startup_contexts sync note:', scErr.message);
    }

    // 4. Initialize 8 default Executive Agents in a single batch if not present
    try {
      const existingAgents = await safeDbQuery(() => prisma.executiveAgent.findMany({
        where: { startupId }
      }));

      if (!existingAgents || existingAgents.length === 0) {
        await safeDbQuery(() => (prisma as any).executiveAgent.createMany({
          data: DEFAULT_EXECUTIVE_ROLES.map(agentDef => ({
            role: agentDef.role,
            name: agentDef.name,
            avatar: agentDef.avatar,
            status: 'idle',
            startupId
          }))
        }));
      }
    } catch (agentErr: any) {
      console.warn('[WorkspaceService] Executive agents sync note:', agentErr.message);
    }

    // 5. Save business context memories in a single batch
    try {
      const memoryBatch: any[] = [];
      if (targetIcp) memoryBatch.push({ category: 'BUSINESS_ICP', title: 'Target Ideal Customer Profile (ICP)', description: targetIcp, startupId });
      if (problem) memoryBatch.push({ category: 'PROBLEM_STATEMENT', title: 'Core Problem Statement', description: problem, startupId });
      if (challenge) memoryBatch.push({ category: 'KEY_CHALLENGE', title: 'Primary Operational Challenge', description: challenge, startupId });
      if (timeline) memoryBatch.push({ category: 'TIMELINE', title: 'Target Milestone Timeline', description: timeline, startupId });
      if (payload.primaryProduct || description) memoryBatch.push({ category: 'PRIMARY_PRODUCT', title: 'Primary Product / Service Offering', description: payload.primaryProduct || description, startupId });
      if (payload.goals && payload.goals.length > 0) {
        for (const goal of payload.goals) {
          memoryBatch.push({ category: 'GOAL', title: 'Strategic Startup Goal', description: goal, startupId });
        }
      }
      if (payload.teamSize) memoryBatch.push({ category: 'TEAM_SIZE', title: 'Team Size & Operational Scale', description: String(payload.teamSize), startupId });
      if (payload.additionalInfo) memoryBatch.push({ category: 'ADDITIONAL_INFO', title: 'Founder Additional Notes', description: payload.additionalInfo, startupId });
      if (payload.businessModel) memoryBatch.push({ category: 'BUSINESS_MODEL', title: 'Monetization & Business Model', description: payload.businessModel, startupId });

      if (memoryBatch.length > 0) {
        await safeDbQuery(() => (prisma as any).memory.createMany({
          data: memoryBatch
        }));
      }
    } catch (memErr: any) {
      console.warn('[WorkspaceService] Memory sync note:', memErr.message);
    }

    // 6. Create or update the living Knowledge Base document: [Company Profile]
    const docId = `doc_profile_${startupId}`;
    const docName = `[Company Profile] ${startupName}`;
    const docType = 'business_plan';
    const dossierText = analysis.dossierMarkdown;
    const docSize = `${(dossierText.length / 1024).toFixed(1)} KB`;

    try {
      const existingDoc = await safeDbQuery(() => prisma.startupDocument.findUnique({
        where: { id: docId }
      }));

      let savedDoc;
      if (existingDoc) {
        savedDoc = await safeDbQuery(() => prisma.startupDocument.update({
          where: { id: docId },
          data: {
            name: docName,
            type: docType,
            size: docSize,
            summary: analysis.summary,
            insights: analysis.insights,
            updatedAt: new Date()
          }
        }));
      } else {
        savedDoc = await safeDbQuery(() => prisma.startupDocument.create({
          data: {
            id: docId,
            name: docName,
            type: docType,
            size: docSize,
            summary: analysis.summary,
            insights: analysis.insights,
            startupId
          }
        }));
      }

      // Synchronously chunk, embed, and index into Neon PostgreSQL RAG storage so context is immediately queryable
      try {
        await ingestDocument(docId, dossierText, docName, docType);
        console.log(`[WorkspaceService] Knowledge document "${docName}" indexed and ready in Knowledge Center (RAG Grounded).`);
      } catch (ragErr: any) {
        console.warn('[WorkspaceService] Background document indexing warning:', ragErr.message);
      }

      // Synchronize in-memory knowledgeFiles for instant access across all agents and fallback search
      const profileDocItem: any = {
        id: docId,
        name: docName,
        type: docType,
        size: docSize,
        uploadDate: new Date().toISOString(),
        summary: analysis.summary,
        insights: analysis.insights,
        startupId
      };
      const existingIdx = knowledgeFiles.findIndex(k => k.id === docId);
      if (existingIdx >= 0) {
        knowledgeFiles[existingIdx] = profileDocItem;
      } else {
        knowledgeFiles.unshift(profileDocItem);
      }

      // Operational notification
      await safeDbQuery(() => prisma.notification.create({
        data: {
          startupId,
          type: 'DOCUMENT',
          title: 'Knowledge Base Ready',
          message: `Company profile for "${startupName}" has been analyzed by AI and indexed into the Knowledge Center.`,
          read: false
        }
      })).catch(() => {});
    } catch (docErr: any) {
      console.error('[WorkspaceService] Error creating profile knowledge document:', docErr.message);
    }

    // 7. Update in-memory startupProfile state
    startupProfile.name = startupName;
    startupProfile.industry = industry;
    startupProfile.description = description;
    startupProfile.fundingStage = fundingStage;
    startupProfile.cashBalance = cash;
    startupProfile.burnRate = burn;
    startupProfile.runwayMonths = runway;
    startupProfile.healthScore = analysis.healthScore;
    startupProfile.metrics = analysis.metrics;

    // 8. Create initial Timeline Item if database available
    try {
      await safeDbQuery(() => prisma.timelineItem.create({
        data: {
          title: 'Startup Profile Analyzed & Indexed',
          content: `Completed onboarding analysis for ${startupName} (${industry}). Health Score: ${analysis.healthScore}%. Runway: ${runway} months.`,
          type: 'milestone',
          startupId
        }
      }));
    } catch (timeErr: any) {
      // Non-fatal if offline
    }

    // Construct fresh CanonicalStartupContext
    const canonicalContext: CanonicalStartupContext = {
      identity: {
        name: startupName,
        industry,
        stage: fundingStage,
        description
      },
      founder: {
        id: userId,
        name: payload.founderName || user?.name || 'Founder',
        role: payload.founderRole || user?.role || 'Founder',
        email: user?.email || `${userId}@catalyst.os`
      },
      business: {
        primaryProduct: payload.primaryProduct || description,
        targetIcp,
        problem,
        model: payload.businessModel || 'B2B SaaS',
        valueProposition: analysis.summary,
        additionalInfo: payload.additionalInfo || ''
      },
      financial: {
        cashBalance: cash,
        monthlyBurn: burn,
        runwayMonths: runway,
        budget: cash,
        healthScore: analysis.healthScore,
        metrics: {
          velocity: 85,
          financialHealth: analysis.healthScore,
          legalCompliance: 95,
          growthRate: 45,
          operationsEfficiency: 88
        }
      },
      growth: {
        goals: payload.goals || ['Deploy prototype and secure initial pilots'],
        currentPriorities: payload.priorities || [timeline],
        targetTimeline: timeline,
        milestones: [
          {
            id: 'm-1',
            title: timeline,
            content: `Target timeline: ${timeline}`,
            type: 'timeline',
            createdAt: new Date().toISOString()
          }
        ]
      },
      operations: {
        teamSize: String(payload.teamSize || '1-5'),
        biggestChallenge: challenge,
        executiveAgents: DEFAULT_EXECUTIVE_ROLES.map(r => ({ id: r.role.toLowerCase(), role: r.role, name: r.name, status: 'idle' })),
        pendingApprovalsCount: 0,
        pendingApprovals: []
      },
      goals: Object.assign(payload.goals || ['Deploy prototype and secure initial pilots'], {
        strategicGoals: payload.goals || ['Deploy prototype and secure initial pilots'],
        currentPriorities: payload.priorities || [timeline],
        targetMilestones: [timeline]
      }) as any,
      metadata: {
        startupId,
        ownerId: userId,
        lastUpdated: new Date().toISOString()
      },
      startupId,
      ownerId: userId,
      startup: {
        name: startupName,
        description,
        industry,
        stage: fundingStage
      },
      financials: {
        cashBalance: cash,
        monthlyBurn: burn,
        runwayMonths: runway
      },
      priorities: payload.priorities || [timeline],
      milestones: [],
      recentDecisions: [],
      pendingApprovals: [],
      documents: [{
        id: docId,
        name: docName,
        type: docType,
        size: docSize,
        summary: analysis.summary
      }],
      agents: DEFAULT_EXECUTIVE_ROLES.map(r => ({ id: r.role.toLowerCase(), role: r.role, name: r.name, status: 'idle' }))
    };

    // Store in companyContextService cache
    companyContextService.setContext(startupId, canonicalContext);
    companyContextService.setContext(userId, canonicalContext);

    return canonicalContext;
  }

  /**
   * Retrieves the structured canonical StartupContext from PostgreSQL.
   * Delegates to companyContextService as the single source of truth.
   */
  public async getCanonicalContext(startupIdOrUserId: string): Promise<CanonicalStartupContext | null> {
    return companyContextService.getContextForStartupOrUser(startupIdOrUserId);
  }

  /**
   * Invalidates cached context for a startup.
   */
  public invalidateCache(startupIdOrUserId: string) {
    companyContextService.invalidate(startupIdOrUserId);
  }
}

export const workspaceService = new WorkspaceService();
