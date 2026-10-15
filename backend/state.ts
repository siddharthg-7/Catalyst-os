import 'dotenv/config';
import { StartupProfile, Agent, Initiative, Deliverable, KnowledgeFile, DecisionRecord, User, UserRole } from './src/models/types';

import bcrypt from 'bcryptjs';
import { prisma, safeDbQuery } from './services/dbService';
export let isDbAvailable = true;

export interface UserDBRecord extends User {
  passwordHash?: string;
}

export const users: UserDBRecord[] = [];

export function addUser(user: UserDBRecord) {
  users.push(user);
  if (!isDbAvailable || !prisma) return;
  prisma.user.create({
    data: {
      id: user.id,
      email: user.email.toLowerCase(),
      name: user.name,
      role: user.role,
    }
  }).then(() => {
    console.log(`[Database] User ${user.email} successfully persisted to Neon PostgreSQL.`);
  }).catch(err => {
    console.error(`[Database] Failed to persist user ${user.email} to PostgreSQL:`, err.message);
  });
}


export const agentsList: Agent[] = [
  {
    id: 'ceo',
    name: 'Atlas',
    role: 'CEO',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
    description: 'Autonomous corporate strategist & CEO orchestrator. Decomposes goals, routes executive delegation, and synthesizes final briefs.',
    status: 'idle',
    keyMetric: 'Company Velocity',
    metricValue: '85%',
    color: 'indigo',
  },
  {
    id: 'finance',
    name: 'Aura',
    role: 'Finance',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
    description: 'Chief Financial Officer. Monitors cash burn rate, executes deterministic runway calculations, and enforces capital governance.',
    status: 'idle',
    keyMetric: 'Financial Health',
    metricValue: '90%',
    color: 'emerald',
  },
  {
    id: 'talent',
    name: 'Echo',
    role: 'Talent',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150',
    description: 'Head of People & Recruiting. Plans headcount growth, structures equity options pools, and vets engineering candidates.',
    status: 'idle',
    keyMetric: 'Hiring Velocity',
    metricValue: '45 days',
    color: 'pink',
  },
  {
    id: 'growth',
    name: 'Vector',
    role: 'Growth',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    description: 'VP of Growth & Marketing. Focuses on customer acquisition, GTM strategies, ICP positioning, and marketing loops.',
    status: 'idle',
    keyMetric: 'Growth Rate',
    metricValue: '+35% MoM',
    color: 'amber',
  },
  {
    id: 'legal',
    name: 'Nexus',
    role: 'Legal',
    avatar: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=150',
    description: 'General Counsel. Drafts binding commercial contracts, reviews compliance, assesses IP protection, and flags structural liabilities.',
    status: 'idle',
    keyMetric: 'Compliance Index',
    metricValue: '95%',
    color: 'rose',
  },
  {
    id: 'operations',
    name: 'Helix',
    role: 'Operations',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    description: 'VP of Operations. Tracks sprint milestones, coordinates cross-functional delivery, and manages operational infrastructure.',
    status: 'idle',
    keyMetric: 'Ops Efficiency',
    metricValue: '88%',
    color: 'teal',
  },
  {
    id: 'investment',
    name: 'Apex',
    role: 'Investment',
    avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150',
    description: 'Head of Capital & Investor Relations. Models cap tables, prepares fundraising collateral, and coordinates pitch materials.',
    status: 'idle',
    keyMetric: 'Capital Readiness',
    metricValue: 'Ready',
    color: 'purple',
  },
  {
    id: 'auditor',
    name: 'Sentry',
    role: 'Auditor',
    avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150',
    description: 'Compliance & Verification Auditor. Verifies mathematical determinism, validates document citations, and eliminates hallucinations.',
    status: 'idle',
    keyMetric: 'Audit Accuracy',
    metricValue: '100%',
    color: 'blue',
  },
];

import { loadPersistedState, savePersistedState } from './services/storageService';

export const DEFAULT_NOVATECH_PROFILE: StartupProfile = {
  name: 'NovaTech',
  industry: 'Enterprise AI & Developer Platform',
  description: 'Autonomous developer infrastructure and multi-agent systems for enterprise microservices.',
  fundingStage: 'Seed',
  cashBalance: 7200000, // ₹72 Lakhs ($86,400)
  burnRate: 800000,    // ₹8 Lakhs / mo ($9,600)
  runwayMonths: 9.0,   // 9 Months
  healthScore: 82,
  metrics: {
    velocity: 78,
    financialHealth: 84,
    legalCompliance: 92,
    growthRate: 65,
    operationsEfficiency: 80,
  },
};

export const DEFAULT_INITIATIVES: Initiative[] = [
  {
    id: 'init_demo_hiring',
    title: 'Should we hire 2 engineers before our next product launch?',
    description: 'Determine whether adding 2 senior engineers before the 6-week enterprise launch is financially and operationally justified, balancing sprint capacity against runway burn.',
    category: 'hiring',
    status: 'pending',
    createdAt: new Date().toISOString(),
    currentTaskIndex: 0,
    tasks: [
      { id: 't_h1', title: 'Audit engineering bottleneck & 6-week enterprise launch commitments', assignedTo: 'CEO', status: 'pending' },
      { id: 't_h2', title: 'Stress test cash runway (-₹4L/mo) against ₹72L reserves', assignedTo: 'Finance', status: 'pending' },
      { id: 't_h3', title: 'Evaluate developer onboarding ramp time vs sprint delivery capacity', assignedTo: 'Operations', status: 'pending' },
      { id: 't_h4', title: 'Quantify enterprise pilot delivery expectations & ARR impact', assignedTo: 'Growth', status: 'pending' },
    ],
    messages: [],
    deliverables: []
  }
];

export const DEFAULT_KNOWLEDGE_FILES: KnowledgeFile[] = [
  {
    id: 'doc_hiring_policy',
    name: 'Hiring Policy.pdf',
    type: 'policy',
    size: '24.2 KB',
    uploadDate: '2026-10-06T09:00:00.000Z',
    startupId: 'st_catalystos',
    summary: 'Official Talent Acquisition & Hiring Policy. Defines recruitment standards, engineering interview loops, 90-day probation review, and salary compensation benchmarks.',
    insights: [
      'All full-time engineering candidates must complete a 4-round technical assessment and cultural interview.',
      'Base salaries for Senior Engineers are benchmarked at ₹25,00,000 - ₹32,00,000/yr with standard 0.25% - 0.75% equity incentives.',
      'Mandatory structured 90-day performance milestone review before full tenure confirmation.',
      'All hiring offers require dual approval from Talent lead and Finance (CFO).'
    ]
  },
  {
    id: 'doc_employee_handbook',
    name: 'Employee Handbook.pdf',
    type: 'handbook',
    size: '38.6 KB',
    uploadDate: '2026-10-06T09:30:00.000Z',
    startupId: 'st_catalystos',
    summary: 'Company Employee Handbook & Governance Guide. Details employment standards, intellectual property protection covenants, standard 20-day PTO, at-will terms, and onboarding compliance.',
    insights: [
      'All employees and contractors must execute standard Proprietary Information and Inventions Agreement (PIIA) prior to start date.',
      'Employment is at-will; all offers are contingent upon background verification and signed compliance acknowledgment.',
      'Standard benefits package includes 20 days paid time off (PTO) and comprehensive health insurance coverage.',
      'Equipment stipend of ₹1,50,000 allocated per engineer for developer workstation and hardware setup.'
    ]
  },
  {
    id: 'doc_company_strategy',
    name: 'Company Strategy.docx',
    type: 'strategy',
    size: '42.1 KB',
    uploadDate: '2026-10-06T10:00:00.000Z',
    startupId: 'st_catalystos',
    summary: 'Strategic Master Plan & Operational Roadmap. Details the 6-month product roadmap, target enterprise launch milestones, runway guardrails, and customer acquisition priorities.',
    insights: [
      'Core corporate objective: Deliver production enterprise workflow orchestration engine within 90 days.',
      'Runway preservation guardrail: Maintain a minimum 6-month operational runway buffer at all times before approving non-essential headcount expansion.',
      'Target ICP: Mid-market B2B SaaS engineering teams with 20-100 developers building microservices.',
      'Engineering capacity is the primary delivery bottleneck; strategic technical hiring is prioritized over sales expansion.'
    ]
  }
];

export const DEFAULT_DECISION_LOG: DecisionRecord[] = [
  {
    id: 'dec_initial_1',
    title: 'Approve: Reserve Cloud Compute Nodes for Enterprise Launch',
    description: 'Committed to 1-year reserved instances on AWS compute to optimize unit economics ahead of enterprise pilot onboarding.',
    category: 'FINANCIALS',
    timestamp: '2026-10-02T10:00:00.000Z',
    impactText: 'Saves ₹1,50,000 monthly in compute overhead while securing 99.98% dedicated SLA.',
    financialImpact: -150000,
    status: 'approved'
  }
];

export const DEFAULT_INDIAN_APPROVALS: Deliverable[] = [
  {
    id: 'appr_vendor_delhivery',
    initiativeId: 'init_operations',
    title: 'Vendor Payment Approval: Delhivery Logistics & Pan-India Line-Haul',
    description: 'Q3 logistics line-haul fulfillment invoice for nationwide Tier-1 and Tier-2 customer shipments under Master Vendor Agreement.',
    type: 'financials',
    content: '# VENDOR PAYMENT INVOICE AUDIT: DELHIVERY LOGISTICS\n\n### Invoice Overview\n- **Vendor:** Delhivery Limited (Surface & Express Logistics)\n- **Invoice No:** DLV-BLR-2026-8821\n- **Service Period:** September 1 - September 30, 2026\n- **Total Billed Amount:** ₹1,85,000 (Inclusive of 18% GST: ₹28,220)\n\n### Operational Validation\n- **Shipments Processed:** 4,218 parcels across Karnataka, Maharashtra, Delhi NCR, and Tamil Nadu.\n- **SLA Fulfillment Rate:** 98.4% delivered within committed 72-hour window.\n- **RTO (Return to Origin) Rate:** 3.8% (Under contractual 5.0% threshold).\n\n### Recommendation\nOperations lead confirms delivery proof logs match warehouse scans. Recommend immediate signoff to maintain favorable volume tier discounts.',
    impact: 'Fulfills Q3 carrier commitments, releases shipment credit hold, and preserves 98.4% on-time delivery SLA.',
    financialChange: -185000,
    status: 'pending_review',
    metricChanges: {
      velocity: 5,
      financialHealth: -2,
      legalCompliance: 4,
      growthRate: 8,
      operationsEfficiency: 12
    }
  },
  {
    id: 'appr_mktg_diwali',
    initiativeId: 'init_growth',
    title: 'Marketing Budget Authorization: Pan-India Festive Acquisition Campaign',
    description: 'Multi-channel festive acquisition budget targeting SMB merchants and D2C consumers across Tier-1 & Tier-2 cities with 3.8x estimated ROAS.',
    type: 'marketing_plan',
    content: '# CAMPAIGN PROPOSAL: FESTIVE COMMERCE ACCELERATOR\n\n### Executive Summary\nStrategic customer acquisition blitz across Meta Ads, Google Performance Max, and targeted merchant trade networks.\n\n### Budget Allocation Breakdown\n- **Meta Ads (Instagram & Facebook):** ₹2,20,000 (Targeting D2C shoppers & storefront creators)\n- **Google Search & PMax:** ₹1,60,000 (High-intent keywords: \'instant merchant onboarding\', \'UPI payment gateway\')\n- **Merchant Partner Referral Bounties:** ₹70,000 (Cash incentives for active merchants referring new shops)\n- **Total Campaign Budget:** ₹4,50,000\n\n### Target Return on Ad Spend (ROAS)\n- Projected New Merchants: 1,450 activated stores\n- Estimated GMV Generated: ₹1,25,00,000 within 60 days\n- Target Blended CAC: ₹310 per onboarded merchant',
    impact: 'Unlocks 1,450 active merchant activations, expands brand presence in 8 regional hubs, and targets 3.8x ROAS.',
    financialChange: -450000,
    status: 'pending_review',
    metricChanges: {
      velocity: 12,
      financialHealth: -4,
      legalCompliance: 0,
      growthRate: 24,
      operationsEfficiency: -2
    }
  },
  {
    id: 'appr_reimb_mumbai',
    initiativeId: 'init_operations',
    title: 'Employee Travel Reimbursement: Enterprise Client Onsite Integration',
    description: 'Onsite solution architecture travel, lodging, and client technical workshops for ICICI Bank merchant nodal account deployment.',
    type: 'financials',
    content: '# EMPLOYEE EXPENSE REIMBURSEMENT AUDIT\n\n### Claim Summary\n- **Employee:** Vikram Malhotra (Solutions Architect)\n- **Purpose:** Onsite deployment workshop at ICICI Bank Bandra Kurla Complex (BKC), Mumbai\n- **Dates:** 22 Sep - 26 Sep 2026\n- **Claim Total:** ₹34,500\n\n### Itemized Expenses\n1. Flight: Bengaluru (BLR) ↔ Mumbai (BOM) — ₹14,800\n2. Hotel: 4 Nights BKC Executive Stay — ₹15,200\n3. Local Transit & Client Working Meals — ₹4,500\n\n### Audit Verification\nAll official tax invoices submitted with corporate GSTIN. Reviewed and pre-cleared by HR & Finance.',
    impact: 'Concludes enterprise nodal switch integration, satisfying Phase-1 enterprise partner milestones.',
    financialChange: -34500,
    status: 'approved',
    metricChanges: {
      velocity: 8,
      financialHealth: -1,
      legalCompliance: 6,
      growthRate: 5,
      operationsEfficiency: 10
    }
  },
  {
    id: 'appr_cloud_gpu',
    initiativeId: 'init_engineering',
    title: 'Cloud Infrastructure Scaling: AWS Mumbai Reserved GPU Cluster',
    description: 'Provision dedicated OCR document parsing and vector inference instances in AWS ap-south-1 (Mumbai) to support 35% weekly merchant surge.',
    type: 'contract',
    content: '# CLOUD INFRASTRUCTURE SCALE-UP MEMO: AWS MUMBAI\n\n### Current State vs Proposed State\n- **Current Setup:** Shared on-demand g4dn.xlarge instances ($960 / ₹80,000 / mo)\n- **Proposed Commitment:** 1-Year Reserved Instances (3x g5.2xlarge in AWS Mumbai Region)\n- **Proposed Monthly Cost:** ₹2,05,000 / mo (+₹1,25,000 / mo increase)\n\n### Technical Justification\n- Merchant KYC document parsing latency drops from 15 minutes to 45 seconds.\n- Eliminates webhook rate-limiting drops during 6 PM - 9 PM peak shopping spikes.\n- Fully compliant with RBI data localization mandates requiring merchant financial processing to reside within India.',
    impact: 'Increases daily document throughput 5x, enforces RBI data localization, and slashes KYC wait time to <45 seconds.',
    financialChange: -125000,
    status: 'pending_review',
    metricChanges: {
      velocity: 15,
      financialHealth: -3,
      legalCompliance: 10,
      growthRate: 6,
      operationsEfficiency: 18
    }
  },
  {
    id: 'appr_hire_lead_backend',
    initiativeId: 'init_talent',
    title: 'Hiring Offer Approval: Lead Platform & UPI Integration Engineer',
    description: 'Senior technical hire to head NPCI UPI switch certification, high-frequency settlement daemons, and banking API gateways.',
    type: 'contract',
    content: '# EXECUTIVE HIRING CHARTER: LEAD UPI PLATFORM ENGINEER\n\n### Candidate Profile\n- **Candidate:** Arpit Sengupta (7+ years fintech & payments switch engineering)\n- **Proposed Role:** Lead Platform Engineer (UPI & Core Banking)\n- **Annual CTC:** ₹28,00,000 (Base: ₹25L, Performance: ₹3L) + 0.35% Equity Pool\n- **Monthly Cost Impact:** ₹2,33,333 / month\n\n### Strategic Requirement\nOwns the end-to-end certification process with NPCI (National Payments Corporation of India) for UPI 2.0 AutoPay recurring mandates.\n\n### Founder Review Directives\nFounder requested restructuring of the joining incentive into two tranches tied to successful NPCI production sandbox certification.',
    impact: 'Accelerates UPI 2.0 AutoPay mandate engine delivery by 8 weeks while restructuring sign-on risk.',
    financialChange: -233000,
    status: 'changes_requested',
    metricChanges: {
      velocity: 22,
      financialHealth: -4,
      legalCompliance: 12,
      growthRate: 14,
      operationsEfficiency: 16
    }
  },
  {
    id: 'appr_refund_sla',
    initiativeId: 'init_operations',
    title: 'Merchant Service Credit: Nodal Account Settlement Downtime Rebate',
    description: 'Contractual SLA rebate for Merchant Enterprise ID M-9042 following scheduled partner bank maintenance window.',
    type: 'policy',
    content: '# SLA SERVICE-CREDIT REBATE CLAIM\n\n### Incident Details\n- **Merchant Account:** RetailSuper India Private Limited (Merchant ID: M-9042)\n- **Incident Date:** September 28, 2026 (02:00 - 05:30 IST)\n- **Impact:** Scheduled nodal bank gateway cutover resulted in 3.5 hours offline window.\n- **SLA Commitment:** 99.9% uptime per monthly billing cycle.\n- **Contractual Remedy:** 25% credit on monthly platform subscription fee.\n- **Calculated Credit Amount:** ₹48,000\n\n### Resolution\nCredit will be offset against next month\'s invoice. Restores enterprise client goodwill and avoids contractual arbitration.',
    impact: 'Maintains tier-1 enterprise merchant partnership and ensures full compliance with Master Service SLA covenants.',
    financialChange: -48000,
    status: 'approved',
    metricChanges: {
      velocity: 0,
      financialHealth: -1,
      legalCompliance: 8,
      growthRate: 2,
      operationsEfficiency: 4
    }
  }
];

// Initialize state from file cache or default seeds
const persisted = loadPersistedState();

export let startupProfile: StartupProfile = persisted?.startupProfile || { ...DEFAULT_NOVATECH_PROFILE };
export let initiatives: Initiative[] = (persisted?.initiatives && persisted.initiatives.length > 0) ? persisted.initiatives : [...DEFAULT_INITIATIVES];
export let approvals: Deliverable[] = (persisted?.approvals && persisted.approvals.length > 0) ? persisted.approvals : [...DEFAULT_INDIAN_APPROVALS];
export let decisionLog: DecisionRecord[] = (persisted?.decisionLog && persisted.decisionLog.length > 0) ? persisted.decisionLog : [...DEFAULT_DECISION_LOG];
const initialFiles: KnowledgeFile[] = (persisted?.knowledgeFiles && persisted.knowledgeFiles.length > 0)
  ? [...persisted.knowledgeFiles]
  : [];

for (const defaultDoc of DEFAULT_KNOWLEDGE_FILES) {
  const existing = initialFiles.find(kf => kf.id === defaultDoc.id || kf.name === defaultDoc.name);
  if (!existing) {
    initialFiles.push({ ...defaultDoc });
  } else if (!existing.startupId) {
    existing.startupId = defaultDoc.startupId;
  }
}

export let knowledgeFiles: KnowledgeFile[] = initialFiles;

export function persistCurrentState() {
  savePersistedState({
    startupProfile,
    initiatives,
    approvals,
    decisionLog,
    knowledgeFiles
  });
}

// Mutators and helpers to keep state synchronized
export function updateStartupProfile(updater: Partial<StartupProfile>) {
  Object.assign(startupProfile, updater);
  if (startupProfile.burnRate > 0) {
    startupProfile.runwayMonths = parseFloat((startupProfile.cashBalance / startupProfile.burnRate).toFixed(1));
  } else {
    startupProfile.runwayMonths = 999;
  }
  persistCurrentState();

  // Update in background
  if (isDbAvailable) {
    prisma.startup.findFirst({ orderBy: { createdAt: 'desc' } })
      .then(profile => {
        if (profile) {
          return prisma.startup.update({
            where: { id: profile.id },
            data: {
              name: updater.name,
              industry: updater.industry,
              description: updater.description,
              fundingStage: updater.fundingStage,
              cashBalance: updater.cashBalance,
              burnRate: updater.burnRate,
              healthScore: updater.healthScore,
            }
          });
        }
      })
      .then(() => console.log('[Database] Startup profile updated in Neon PostgreSQL.'))
      .catch(err => console.error('[Database] Failed to persist startup updates:', err.message));
  }

  return startupProfile;
}

export function resetAgentStatuses() {
  agentsList.forEach(a => {
    a.status = 'idle';
    if (!isDbAvailable) return;
    prisma.executiveAgent.updateMany({
      where: { role: a.role },
      data: { status: 'idle', currentTask: null }
    }).catch(() => {});
  });
}

export function setAgentStatuses(status: 'idle' | 'analyzing' | 'collaborating' | 'generating' | 'reviewing', activeRole?: string) {
  agentsList.forEach(a => {
    const isTarget = activeRole ? a.role === activeRole : true;
    if (isTarget) {
      a.status = status;
      if (!isDbAvailable) return;
      prisma.executiveAgent.updateMany({
        where: { role: a.role },
        data: { status, currentTask: status !== 'idle' ? `${status.toUpperCase()}...` : null }
      }).catch(() => {});
    } else if (activeRole) {
      a.status = 'idle';
      if (!isDbAvailable) return;
      prisma.executiveAgent.updateMany({
        where: { role: a.role },
        data: { status: 'idle', currentTask: null }
      }).catch(() => {});
    }
  });
}

// Automatically sync memory state with Neon PostgreSQL on load
export async function syncStateWithDatabase() {
  let timedOut = false;
  try {
    console.log('🔄 Synchronizing memory state with Neon PostgreSQL...');
    
    const syncOperations = async () => {
      // Warm up the Neon connection cleanly to wake up serverless compute
      await safeDbQuery(() => prisma.$executeRawUnsafe('SELECT 1'));

      // Fetch startup queries with automatic retry on pool/connection errors
      const [dbUsers, dbStartup, dbAgents, dbDocs] = await safeDbQuery(() => Promise.all([
        prisma.user.findMany(),
        prisma.startup.findFirst({ orderBy: { createdAt: 'desc' } }),
        prisma.executiveAgent.findMany(),
        prisma.startupDocument.findMany({ orderBy: { createdAt: 'desc' } })
      ]));

      if (timedOut) return;

      // Sync Users
      if (dbUsers && dbUsers.length > 0) {
        users.length = 0; // Clear default array
        dbUsers.forEach(u => {
          users.push({
            id: u.id,
            email: u.email,
            name: u.name || '',
            role: u.role as UserRole,
            passwordHash: (u as any).passwordHash || undefined,
            createdAt: u.createdAt.toISOString()
          });
        });
        console.log(`✅ Synced ${dbUsers.length} users.`);
      }

      // Sync Startup Profile
      if (dbStartup) {
        const runway = dbStartup.burnRate > 0 ? parseFloat((dbStartup.cashBalance / dbStartup.burnRate).toFixed(1)) : 999;
        startupProfile.name = dbStartup.name;
        startupProfile.industry = dbStartup.industry;
        startupProfile.description = dbStartup.description;
        startupProfile.fundingStage = dbStartup.fundingStage;
        startupProfile.cashBalance = dbStartup.cashBalance;
        startupProfile.burnRate = dbStartup.burnRate;
        startupProfile.runwayMonths = runway;
        startupProfile.healthScore = dbStartup.healthScore;
        console.log('✅ Synced startup profile.');
      }

      // Sync Agents
      if (dbAgents && dbAgents.length > 0) {
        agentsList.forEach(a => {
          const matchingDb = dbAgents.find(da => da.id === a.id);
          if (matchingDb) {
            a.status = matchingDb.status as any;
          }
        });
        console.log('✅ Synced executive agents statuses.');
      }



      isDbAvailable = true;
      console.log('🎉 Neon PostgreSQL state synchronization complete.');
    };

    const timeoutGuard = new Promise((_, reject) =>
      setTimeout(() => {
        timedOut = true;
        reject(new Error('Remote database connection timed out (45000ms)'));
      }, 45000)
    );

    await Promise.race([syncOperations(), timeoutGuard]);
  } catch (err: any) {
    isDbAvailable = false;
    console.warn(`⚠️ Could not connect to Neon PostgreSQL for startup sync (${err?.message || err}). Falling back to high-fidelity offline default states.`);
  }
}

// Trigger background synchronization
syncStateWithDatabase();

