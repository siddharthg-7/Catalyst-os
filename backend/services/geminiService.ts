import { GoogleGenAI } from '@google/genai';
import { Initiative, WorkflowTask, AgentMessage, Deliverable } from '../src/models/types';
import { startupProfile, knowledgeFiles } from '../state';

// Initialize Google GenAI client
export let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  console.log('Gemini API client successfully initialized in backend services.');
} else {
  console.warn('GEMINI_API_KEY is not defined. Falling back to high-fidelity simulated agent collaboration.');
}

import { executeCollaborationLoop } from '../agents/collaboration';
import { runOrchestrationLoop } from '../ai/orchestrator';

// Generates highly contextual agent conversations using Gemini
export async function runMultiAgentCollaboration(initiative: Initiative, customStartupProfile?: any): Promise<any> {
  const profileToUse = customStartupProfile || startupProfile;
  return runOrchestrationLoop(initiative, profileToUse, knowledgeFiles);
}

// Highly realistic simulation generator fallback
export function getSimulatedFallback(initiative: Initiative): any {
  const isHiring = initiative.category === 'hiring' || initiative.title.toLowerCase().includes('engineer') || initiative.title.toLowerCase().includes('hire');
  const isFunding = initiative.category === 'funding' || initiative.title.toLowerCase().includes('pitch') || initiative.title.toLowerCase().includes('funding');
  const isGrowth = initiative.category === 'growth' || initiative.title.toLowerCase().includes('marketing') || initiative.title.toLowerCase().includes('launch');
  const isLegal = initiative.category === 'legal' || initiative.title.toLowerCase().includes('compliance') || initiative.title.toLowerCase().includes('terms');

  let tasks: WorkflowTask[] = [];
  let messages: AgentMessage[] = [];
  let deliverables: Deliverable[] = [];

  if (isHiring) {
    tasks = [
      { id: 't_h1', title: 'Define engineering skillset and compensation bands', assignedTo: 'Talent', status: 'completed', result: 'Completed competitive analysis of B2B SaaS engineering bands. Proposed $145k base salary + 1.5% equity.' },
      { id: 't_h2', title: 'Stress test financial impact against 12-month runway', assignedTo: 'Finance', status: 'completed', result: 'Determined that $145k base exceeds our MVP allocation, shortening runway to 9 months.' },
      { id: 't_h3', title: 'Draft standard IP assignment and employment agreements', assignedTo: 'Legal', status: 'completed', result: 'Structured complete Employee Agreement with proprietary information protection.' }
    ];

    messages = [
      { id: 'm_h1', sender: 'CEO', receiver: 'All', content: `Let's construct our talent pipeline for: "${initiative.title}". We need absolute execution quality.`, timestamp: new Date().toISOString() },
      { id: 'm_h2', sender: 'Talent', receiver: 'Finance', content: 'Our criteria require a senior level architect. Proposing $145,000 base + 1.5% equity with a standard 12-month cliff.', timestamp: new Date().toISOString() },
      { id: 'm_h3', sender: 'Finance', receiver: 'Talent', content: 'This budget exceeds our pre-seed limits! Standard monthly operational expenses cannot exceed $20k right now if we want to survive until next milestone. Max base allowed is $115,000.', timestamp: new Date().toISOString(), isConflict: true },
      { id: 'm_h4', sender: 'ConflictResolver', receiver: 'All', content: 'Mediated Compromise: $128,000 Base Salary + 1.65% Equity. Optimizes equity allocation to mitigate cash burn while maintaining top-market incentive structures. Keeps cash runway at 12.1 months.', timestamp: new Date().toISOString() },
      { id: 'm_h5', sender: 'Legal', receiver: 'All', content: 'Incorporating stock option pool schedule with standard vesting. Prepared employee handbook disclosures and non-compete assignment clauses.', timestamp: new Date().toISOString() },
      { id: 'm_h6', sender: 'ApprovalManager', receiver: 'All', content: 'Vetting completed. Packaging offer sheets and executive agreements. Founder review queued.', timestamp: new Date().toISOString() }
    ];

    deliverables = [
      {
        id: `del_fall_${Date.now()}`,
        initiativeId: initiative.id,
        title: 'Core Recruiting Package & Stock Vesting Agreement',
        description: 'Vetted compensation agreements and employment guidelines to secure executive-tier platform engineering talent.',
        type: 'contract',
        status: 'pending_review',
        content: `# STRATEGIC RECRUITMENT AND COMPENSATION CHARTER\n\n### Offer Structure\n- **Position:** Lead Core Platform Infrastructure\n- **Annual Base:** $128,000 USD\n- **Equity Allocation:** 1.65% Non-qualified Stock Options (NSOs)\n\n### Legal & Protective Provisions\n1. **Vesting Schedule:** 4 years monthly vesting with 1-year initial cliff.\n2. **Confidentiality:** Post-termination non-disclosure of core orchestration engine code.\n3. **IP Protection:** Standard corporate IP Assignment and Proprietary Information clause.\n\n### Treasury Modeling\n- Monthly burn adjustments modeled at -$10,666.\n- Cash reserve runway projected at 12.1 months.`,
        impact: 'Boosts team velocity (+15 points) and operations efficiency, slightly increases financial burn.',
        financialChange: -10666,
        metricChanges: { velocity: 15, financialHealth: -3, operationsEfficiency: 10, legalCompliance: 8 }
      }
    ];
  } else if (isFunding) {
    tasks = [
      { id: 't_f1', title: 'Formulate growth narrative and cloud margin metrics', assignedTo: 'Growth', status: 'completed', result: 'Prepared B2B pipeline conversion sheets showing 48% MoM signup velocity.' },
      { id: 't_f2', title: 'Verify core financial projections and unit economics', assignedTo: 'Finance', status: 'completed', result: 'Modeled financial metrics including customer acquisition cost (CAC) and LTV ratios.' },
      { id: 't_f3', title: 'Review regulatory disclosures for accredited investors', assignedTo: 'Legal', status: 'completed', result: 'Verified Regulation D exemptions and compiled disclosure lists.' }
    ];

    messages = [
      { id: 'm_f1', sender: 'CEO', receiver: 'All', content: 'Preparing deck for the upcoming $1.5M Seed round pitch session. We must highlight cloud margin and customer acquisition.', timestamp: new Date().toISOString() },
      { id: 'm_f2', sender: 'Growth', receiver: 'Finance', content: 'I want to advertise 60% MoM growth. We should include our waitlist count (8,000 signups) directly as ARR projections.', timestamp: new Date().toISOString() },
      { id: 'm_f3', sender: 'Finance', receiver: 'Growth', content: 'Wait! Waitlist is not recurring revenue. Converting hypothetical interest to ARR violates accounting metrics and will crash due diligence.', timestamp: new Date().toISOString(), isConflict: true },
      { id: 'm_f4', sender: 'ConflictResolver', receiver: 'All', content: 'Sustained compromise: Formulate waitlist as "Qualified Pilot Interest ($120k pipeline value)" and show actual growth metrics independently. Preserves diligence compliance.', timestamp: new Date().toISOString() },
      { id: 'm_f5', sender: 'Legal', receiver: 'All', content: 'This keeps us fully compliant with SEC requirements. Safe-Harbor disclosures appended.', timestamp: new Date().toISOString() }
    ];

    deliverables = [
      {
        id: `del_fall_${Date.now()}`,
        initiativeId: initiative.id,
        title: 'Institutional Seed Funding Pitch Deck Outline',
        description: 'Vetted investor presentation charter outlining financial projections, pipeline valuation, and growth economics.',
        type: 'document',
        status: 'pending_review',
        content: `# INVESTOR SEED ROUND BRIEFING CHARTER\n\n### Executive Summary\nSeeking **$1,500,000 USD** seed funding at a **$10,000,000** valuation cap to expand engineering bandwidth.\n\n### Key Metrics\n- **Current Pipeline Value:** $120,000 (qualified waitlist and trials)\n- **Uptime:** 99.98% validated orchestrator uptime\n- **Target CAC:** $250 with target payback of 5.5 months\n\n### Use of Proceeds\n- 65% - Engineering & Core Platform automation\n- 20% - Enterprise Growth pipeline loops\n- 15% - Compliance, SOC-2, and Legal audits`,
        impact: 'Dramatically improves financial rating upon successful closing (+20 points) and opens investor channels.',
        financialChange: 1500000,
        metricChanges: { financialHealth: 20, growthRate: 15, legalCompliance: 5 }
      }
    ];
  } else {
    // Default / Growth / Operations fallback
    tasks = [
      { id: 't_g1', title: 'Optimize distribution models and viral loops', assignedTo: 'Growth', status: 'completed', result: 'Designed integrated referral reward offering 20% server credits.' },
      { id: 't_g2', title: 'Assess legal risks of user referrals and rewards program', assignedTo: 'Legal', status: 'completed', result: 'Verified that credit incentive programs satisfy state-level gaming laws.' },
      { id: 't_g3', title: 'Audit server load limits and resource orchestration', assignedTo: 'Operations', status: 'completed', result: 'Allocated separate auto-scaling clusters for pilot users.' }
    ];

    messages = [
      { id: 'm_g1', sender: 'CEO', receiver: 'All', content: `Let's orchestrate: "${initiative.title}". Dax, what is our growth playbook?`, timestamp: new Date().toISOString() },
      { id: 'm_g2', sender: 'Growth', receiver: 'All', content: 'Launching a multi-channel viral loop giving 50% free computation to new referrals. Expecting massive signups.', timestamp: new Date().toISOString() },
      { id: 'm_g3', sender: 'Operations', receiver: 'Growth', content: 'Giving 50% computations away for free will overwhelm our cloud node clusters and blow up API costs! Finance, what is our server budget?', timestamp: new Date().toISOString(), isConflict: true },
      { id: 'm_g4', sender: 'Finance', receiver: 'All', content: 'Correct, a 50% compute subsidy raises server bills by $8k/mo immediately. We cannot absorb that expense with our current cash reserve.', timestamp: new Date().toISOString() },
      { id: 'm_g5', sender: 'ConflictResolver', receiver: 'All', content: 'Optimized Synthesis: Implement a tiered credit cap of 1,000 compute credits ($15 value) per referral, capped at 5 referrals per client. Keeps maximum server impact under $1,200/mo while preserving viral loop dynamics.', timestamp: new Date().toISOString() },
      { id: 'm_g6', sender: 'Legal', receiver: 'All', content: 'Terms of Service updated with referral limitations and clawback provisions to prevent system abuse.', timestamp: new Date().toISOString() }
    ];

    deliverables = [
      {
        id: `del_fall_${Date.now()}`,
        initiativeId: initiative.id,
        title: 'Cybersecurity Policy & System Auditing Guidelines',
        description: 'Vetted compliance documents outlining security operations, encryption standards, and platform access control checklists.',
        type: 'policy',
        status: 'pending_review',
        content: `# PLATFORM INFORMATION SECURITY AND ACCESS CONTROL POLICY\n\n### Objective\nTo establish strict access rules, audit controls, and encryption schedules to satisfy SOC-2 criteria.\n\n### Access Protocols\n- Multi-factor authentication (MFA) required on all production systems.\n- IAM policies scoped strictly under least-privilege constraints.\n\n### Data Handling\n1. **In-Transit:** TLS 1.3 protocol enforced across all active API connections.\n2. **At-Rest:** AES-256 database and storage layer encryption.\n3. **Logging:** Immutable connection metrics aggregated into central secure logs.`,
        impact: 'Boosts legal compliance and customer security confidence, has neutral financial effect.',
        financialChange: 0,
        metricChanges: { legalCompliance: 15, operationsEfficiency: 8, velocity: -2 }
      }
    ];
  }

  return { tasks, messages, deliverables };
}
