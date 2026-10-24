/**
 * CatalystOS - Knowledge Provenance & Disagreement Resolution Service (Section 5.7)
 *
 * Implements strict Knowledge Provenance tracking and explicit Arbitration Rules:
 *
 * 1. Explicit Provenance Attributes on Every Core Fact:
 *    - Source document or live integration
 *    - Source date (when source was authored or published)
 *    - Extraction timestamp (when CatalystOS ingested it)
 *    - Relevant company / department (Finance, Engineering, Legal, Operations)
 *    - Verification method: 'EXTRACTED' | 'CALCULATED' | 'MANUALLY_CONFIRMED' | 'INTEGRATION_FEED'
 *    - Staleness status: 'FRESH' (<30d), 'AGING' (30-60d), 'STALE' (>60d), 'SUPERSEDED'
 *    - Conflict indicators: 'NO_CONFLICT' | 'DIVERGENT' | 'HARD_CONFLICT'
 *
 * 2. Distinction between Two Forms of Knowledge:
 *    - Descriptive Knowledge: What company documents say (e.g. pitch deck forecast, PRD roadmap spec).
 *    - Operational State: What is actually happening now (e.g. live database task states, bank integration ledger).
 *
 * 3. Clear Arbitration Precedence Rules:
 *    - Rule 1: Operational Truth Dominance (Reality > Aspiration).
 *      Operational state (live tracker, bank ledger, verified commit) always prevails for "What is".
 *      Descriptive knowledge is relegated to "Historical Plan / Benchmark".
 *    - Rule 2: Temporal Precedence with Freshness Decay.
 *      Newer verified records supersede older records unless an older record was manually locked by a founder.
 *    - Rule 3: Origin Hierarchy (Integration/Ledger > Confirmed Extract > Raw Chunk).
 */

import { FactProvenance, DisagreementResolutionCase, FactFreshness } from '../src/models/types';
import { startupProfile } from '../state';

// In-memory tenant store for provenance records
const tenantFactsStore: Record<string, FactProvenance[]> = {};
const tenantDisagreementsStore: Record<string, DisagreementResolutionCase[]> = {};

/**
 * Calculates freshness category based on age in days.
 */
export function calculateFreshness(sourceDateStr: string): { freshness: FactFreshness; ageDays: number; staleReason?: string } {
  try {
    const sourceTime = new Date(sourceDateStr).getTime();
    if (isNaN(sourceTime)) {
      return { freshness: 'STALE', ageDays: 999, staleReason: 'Invalid or missing source date' };
    }
    const now = Date.now();
    const diffMs = now - sourceTime;
    const ageDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

    if (ageDays <= 30) {
      return { freshness: 'FRESH', ageDays };
    } else if (ageDays <= 60) {
      return { freshness: 'AGING', ageDays, staleReason: `Authored ${ageDays} days ago; verification recommended.` };
    } else {
      return { freshness: 'STALE', ageDays, staleReason: `Authored ${ageDays} days ago (>60 days). Superseded by operational records.` };
    }
  } catch {
    return { freshness: 'STALE', ageDays: 999, staleReason: 'Unable to parse source date' };
  }
}

/**
 * Generates initial canonical provenance facts and active disagreement cases.
 */
function initializeDefaultTenantKnowledge(startupId: string): void {
  const nowIso = new Date().toISOString();
  const twoMonthsAgoIso = new Date(Date.now() - 62 * 24 * 60 * 60 * 1000).toISOString();
  const fortyDaysAgoIso = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
  const yesterdayIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // 1. Core Facts with Granular Provenance
  const facts: FactProvenance[] = [
    // Authoritative Operational Cash Balance
    {
      factId: `fact_${startupId}_cash_live`,
      key: 'cash_balance',
      label: 'Treasury Cash Balance',
      value: 4250000,
      formattedValue: '₹42,50,000',
      unit: 'INR',
      category: 'OPERATIONAL_STATE',
      department: 'Finance',
      sourceType: 'INTEGRATION',
      sourceName: 'Authoritative Bank Ledger (HDFC Corporate Treasury)',
      sourceDate: yesterdayIso,
      extractionTimestamp: nowIso,
      verificationMethod: 'INTEGRATION_FEED',
      verifiedBy: 'System Direct Integration (HDFC OpenBanking)',
      freshness: 'FRESH',
      isAuthoritative: true,
      hasConflict: true,
      conflictDetails: {
        conflictingFactId: `fact_${startupId}_cash_deck`,
        conflictingSource: 'Financial_Model_v1_Forecast.xlsx (Uploaded 2 months ago)',
        conflictingValue: '₹72,00,000',
        conflictingDate: twoMonthsAgoIso,
        conflictingCategory: 'DESCRIPTIVE',
        severity: 'HARD_CONFLICT',
        arbitrationRule: 'Rule 1: Operational Truth Dominance (Reality > Aspiration) & Rule 2: Temporal Precedence',
        resolution: 'Live HDFC Bank Ledger (₹42.5L) used for runway calculation instead of outdated spreadsheet (₹72L). Overestimating runway prevented.'
      }
    },
    // Stale Descriptive Cash Balance (e.g. from old spreadsheet)
    {
      factId: `fact_${startupId}_cash_deck`,
      key: 'cash_balance_projected',
      label: 'Q3 Projected Cash Balance (Forecast)',
      value: 7200000,
      formattedValue: '₹72,00,000',
      unit: 'INR',
      category: 'DESCRIPTIVE',
      department: 'Finance',
      sourceType: 'DOCUMENT',
      sourceName: 'Financial_Model_v1_Forecast.xlsx',
      sourceDate: twoMonthsAgoIso,
      extractionTimestamp: twoMonthsAgoIso,
      verificationMethod: 'EXTRACTED',
      verifiedBy: 'Document Ingestion Pipeline',
      freshness: 'STALE',
      staleReason: 'Extracted from spreadsheet authored 62 days ago. Does not account for recent payroll disbursements.',
      isAuthoritative: false,
      hasConflict: true,
      conflictDetails: {
        conflictingFactId: `fact_${startupId}_cash_live`,
        conflictingSource: 'Authoritative Bank Ledger (HDFC Corporate Treasury)',
        conflictingValue: '₹42,50,000',
        conflictingDate: yesterdayIso,
        conflictingCategory: 'OPERATIONAL_STATE',
        severity: 'HARD_CONFLICT',
        arbitrationRule: 'Rule 1: Operational Truth Dominance (Reality > Aspiration)',
        resolution: 'Relegated to historical forecast archive. Cannot be cited as current solvency.'
      }
    },
    // Monthly Burn Rate (Calculated Operational)
    {
      factId: `fact_${startupId}_burn_rate`,
      key: 'monthly_burn_rate',
      label: 'Monthly Net Burn Rate',
      value: 800000,
      formattedValue: '₹8,00,000 / mo',
      unit: 'INR/mo',
      category: 'OPERATIONAL_STATE',
      department: 'Finance',
      sourceType: 'SYSTEM_RECORD',
      sourceName: 'Audited Payroll Run & Cloud Invoices (RazorpayX + AWS)',
      sourceDate: yesterdayIso,
      extractionTimestamp: nowIso,
      verificationMethod: 'CALCULATED',
      verifiedBy: 'CFO Agent (Autonomous Audit Engine)',
      freshness: 'FRESH',
      isAuthoritative: true,
      hasConflict: true,
      conflictDetails: {
        conflictingFactId: `fact_${startupId}_burn_pitch_deck`,
        conflictingSource: 'Catalyst_Seed_Pitch_Deck.pdf (Slide 14)',
        conflictingValue: '₹4,50,000 / mo',
        conflictingDate: twoMonthsAgoIso,
        conflictingCategory: 'DESCRIPTIVE',
        severity: 'DIVERGENT',
        arbitrationRule: 'Rule 1: Operational Truth Dominance',
        resolution: 'Live payroll and AWS telemetry reflects current active burn rate (₹8L/mo).'
      }
    },
    // Calculated Effective Runway
    {
      factId: `fact_${startupId}_runway`,
      key: 'runway_months',
      label: 'Calculated Solvency Runway',
      value: 5.3,
      formattedValue: '5.3 Months',
      unit: 'months',
      category: 'OPERATIONAL_STATE',
      department: 'Finance',
      sourceType: 'SYSTEM_RECORD',
      sourceName: 'CatalystOS Solvency Guard (₹42.5L / ₹8L)',
      sourceDate: nowIso,
      extractionTimestamp: nowIso,
      verificationMethod: 'CALCULATED',
      verifiedBy: 'Institutional Solvency Engine',
      freshness: 'FRESH',
      isAuthoritative: true,
      hasConflict: false
    },
    // Operational Engineering Feature Status (Testing in progress)
    {
      factId: `fact_${startupId}_auth_feature_live`,
      key: 'feature_multi_tenant_auth_status',
      label: 'Multi-Tenant Auth & SAML SSO Status',
      value: 'IN_PROGRESS',
      formattedValue: 'IN_PROGRESS (Security Review Pending)',
      category: 'OPERATIONAL_STATE',
      department: 'Engineering',
      sourceType: 'SYSTEM_RECORD',
      sourceName: 'Engineering Task Tracker (#410 "Penetration Testing & OAuth Revocation")',
      sourceDate: yesterdayIso,
      extractionTimestamp: nowIso,
      verificationMethod: 'INTEGRATION_FEED',
      verifiedBy: 'GitHub & CI/CD Pipeline Telemetry',
      freshness: 'FRESH',
      isAuthoritative: true,
      hasConflict: true,
      conflictDetails: {
        conflictingFactId: `fact_${startupId}_auth_feature_prd`,
        conflictingSource: 'Q3_Product_Roadmap_PRD.pdf (Section 3.2)',
        conflictingValue: 'COMPLETE / Ready for Customer Launch',
        conflictingDate: fortyDaysAgoIso,
        conflictingCategory: 'DESCRIPTIVE',
        severity: 'HARD_CONFLICT',
        arbitrationRule: 'Rule 1: Operational Truth Dominance (Reality > Aspiration)',
        resolution: 'Feature treated as IN_PROGRESS. Release gate BLOCKED until security testing issue #410 is closed.'
      }
    },
    // Descriptive Roadmap Feature Status (PRD says complete)
    {
      factId: `fact_${startupId}_auth_feature_prd`,
      key: 'feature_multi_tenant_auth_roadmap',
      label: 'Roadmap Target: Multi-Tenant Auth',
      value: 'COMPLETE',
      formattedValue: 'COMPLETE (Roadmap Target)',
      category: 'DESCRIPTIVE',
      department: 'Product',
      sourceType: 'DOCUMENT',
      sourceName: 'Q3_Product_Roadmap_PRD.pdf',
      sourceDate: fortyDaysAgoIso,
      extractionTimestamp: fortyDaysAgoIso,
      verificationMethod: 'EXTRACTED',
      verifiedBy: 'Document Ingestion Pipeline',
      freshness: 'AGING',
      staleReason: 'PRD planned completion for Sept 15; downstream engineering tickets show ongoing penetration tests.',
      isAuthoritative: false,
      hasConflict: true,
      conflictDetails: {
        conflictingFactId: `fact_${startupId}_auth_feature_live`,
        conflictingSource: 'Engineering Task Tracker (#410 "Penetration Testing & OAuth Revocation")',
        conflictingValue: 'IN_PROGRESS (Security Review Pending)',
        conflictingDate: yesterdayIso,
        conflictingCategory: 'OPERATIONAL_STATE',
        severity: 'HARD_CONFLICT',
        arbitrationRule: 'Rule 1: Operational Truth Dominance',
        resolution: 'Relegated to design specification. Cannot be cited as deployed capability.'
      }
    },
    // Team Headcount (Operational)
    {
      factId: `fact_${startupId}_headcount`,
      key: 'headcount_verified',
      label: 'Verified Team Headcount',
      value: 11,
      formattedValue: '5 Human Employees + 6 AI Executives',
      category: 'OPERATIONAL_STATE',
      department: 'HR & Talent',
      sourceType: 'SYSTEM_RECORD',
      sourceName: 'CatalystOS People Directory & Access Ledger',
      sourceDate: nowIso,
      extractionTimestamp: nowIso,
      verificationMethod: 'MANUALLY_CONFIRMED',
      verifiedBy: 'Founder (Siddharth)',
      freshness: 'FRESH',
      isAuthoritative: true,
      hasConflict: false
    }
  ];

  // 2. Active Disagreement Resolution Cases
  const disagreements: DisagreementResolutionCase[] = [
    {
      id: `case_${startupId}_runway_discrepancy`,
      topic: 'Runway & Treasury Balance Discrepancy',
      metricOrFeature: 'Current Cash Balance & Calculated Runway',
      department: 'Finance',
      descriptiveClaim: {
        source: 'Financial_Model_v1_Forecast.xlsx (Sheet: Cash_Flow)',
        sourceType: 'DOCUMENT',
        date: twoMonthsAgoIso,
        value: '₹72,00,000 (Yielding 9.0 Months Runway)',
        interpretation: 'Static projection prepared 2 months ago assuming delayed hiring and lower cloud spend.',
        statusBadge: 'STALE'
      },
      operationalReality: {
        source: 'Authoritative Bank Ledger (HDFC Corporate Account #8492)',
        sourceType: 'INTEGRATION',
        date: yesterdayIso,
        value: '₹42,50,000 (Yielding 5.3 Months Runway)',
        interpretation: 'Live balance after Q3 software licenses, contractor disbursements, and ₹8L monthly payroll.',
        statusBadge: 'BANK_FEED'
      },
      arbitrationVerdict: {
        ruling: 'OPERATIONAL_TRUTH_WINS',
        ruleApplied: 'Rule 1: Operational Truth Dominance (Reality > Aspiration) & Rule 2: Temporal Precedence',
        authoritativeValue: '₹42,50,000 (5.3 Months Runway)',
        explanation: 'Bank integration feed represents current liquid assets. The 2-month-old spreadsheet is stale and does not reflect executed disbursements.',
        impactOnPlanning: 'Automated workflow allocations and hiring limits will strictly enforce the 5.3-month runway constraint to prevent unexpected insolvency.',
        arbitratedAt: nowIso,
        arbitratedBy: 'CatalystOS Solvency Guard'
      }
    },
    {
      id: `case_${startupId}_auth_module_status`,
      topic: 'Feature Readiness & Release Gate Disagreement',
      metricOrFeature: 'Multi-Tenant Auth & SAML SSO Enterprise Module',
      department: 'Engineering / Product',
      descriptiveClaim: {
        source: 'Q3_Product_Roadmap_PRD.pdf (Target Milestone 4)',
        sourceType: 'DOCUMENT',
        date: fortyDaysAgoIso,
        value: 'COMPLETE / Ready for Customer Launch',
        interpretation: 'Product roadmap intended feature to be code-complete and delivered to customers by end of Q3.',
        statusBadge: 'ASPIRATIONAL_PLAN'
      },
      operationalReality: {
        source: 'Engineering Task Tracker (#410 "OAuth Security Pen-Test")',
        sourceType: 'SYSTEM_RECORD',
        date: yesterdayIso,
        value: 'IN_PROGRESS (Security Penetration Testing Pending)',
        interpretation: 'Engineering PR merged into staging, but token revocation audit and pen-test are actively blocked on QA sign-off.',
        statusBadge: 'IN_PROGRESS'
      },
      arbitrationVerdict: {
        ruling: 'OPERATIONAL_TRUTH_WINS',
        ruleApplied: 'Rule 1: Operational Truth Dominance (Reality > Aspiration)',
        authoritativeValue: 'IN_PROGRESS (Gated on Issue #410)',
        explanation: 'Operational testing telemetry takes precedence over roadmap projections. A feature cannot be treated as ready for customer exposure until tests pass.',
        impactOnPlanning: 'Marketing announcement and sales commitments are gated. CatalystOS multi-agent orchestrator marks this milestone BLOCKED.',
        arbitratedAt: nowIso,
        arbitratedBy: 'CatalystOS Governance Engine'
      }
    }
  ];

  tenantFactsStore[startupId] = facts;
  tenantDisagreementsStore[startupId] = disagreements;
}

/**
 * Retrieves all registered knowledge facts for a startup with evaluated freshness.
 */
export async function getKnowledgeFacts(startupId: string): Promise<FactProvenance[]> {
  if (!tenantFactsStore[startupId]) {
    initializeDefaultTenantKnowledge(startupId);
  }

  // Dynamically re-evaluate freshness upon retrieval
  return tenantFactsStore[startupId].map(fact => {
    const { freshness, staleReason } = calculateFreshness(fact.sourceDate);
    return {
      ...fact,
      freshness: fact.freshness === 'SUPERSEDED' ? 'SUPERSEDED' : freshness,
      staleReason: fact.staleReason || staleReason
    };
  });
}

/**
 * Retrieves active descriptive vs operational disagreement cases.
 */
export async function getDisagreementCases(startupId: string): Promise<DisagreementResolutionCase[]> {
  if (!tenantDisagreementsStore[startupId]) {
    initializeDefaultTenantKnowledge(startupId);
  }
  return tenantDisagreementsStore[startupId];
}

/**
 * Manually confirms or locks an operational fact (Founder Attestation).
 */
export async function confirmFactManually(
  startupId: string,
  factId: string,
  confirmedValue: any,
  userId: string,
  userName = 'Founder'
): Promise<FactProvenance | null> {
  const facts = await getKnowledgeFacts(startupId);
  const factIndex = facts.findIndex(f => f.factId === factId);
  if (factIndex === -1) return null;

  const nowIso = new Date().toISOString();
  const updated: FactProvenance = {
    ...facts[factIndex],
    value: confirmedValue,
    formattedValue: typeof confirmedValue === 'number' ? confirmedValue.toLocaleString() : String(confirmedValue),
    verificationMethod: 'MANUALLY_CONFIRMED',
    verifiedBy: `${userName} (Direct Attestation)`,
    extractionTimestamp: nowIso,
    sourceDate: nowIso,
    freshness: 'FRESH',
    isAuthoritative: true,
    hasConflict: false,
    conflictDetails: undefined
  };

  tenantFactsStore[startupId][factIndex] = updated;
  return updated;
}

/**
 * Resolves a disagreement case with an explicit founder override or automated ruling.
 */
export async function resolveDisagreement(
  startupId: string,
  caseId: string,
  founderDecision: 'ACCEPT_OPERATIONAL' | 'ACCEPT_DESCRIPTIVE' | 'CUSTOM_OVERRIDE',
  customValue?: string
): Promise<DisagreementResolutionCase | null> {
  const cases = await getDisagreementCases(startupId);
  const caseItem = cases.find(c => c.id === caseId);
  if (!caseItem) return null;

  const nowIso = new Date().toISOString();
  if (founderDecision === 'ACCEPT_OPERATIONAL') {
    caseItem.arbitrationVerdict = {
      ...caseItem.arbitrationVerdict,
      ruling: 'OPERATIONAL_TRUTH_WINS',
      authoritativeValue: caseItem.operationalReality.value,
      explanation: 'Confirmed by Founder: Live operational state adopted as institutional ground truth.',
      arbitratedAt: nowIso,
      arbitratedBy: 'Founder Override'
    };
  } else if (founderDecision === 'CUSTOM_OVERRIDE' && customValue) {
    caseItem.arbitrationVerdict = {
      ...caseItem.arbitrationVerdict,
      ruling: 'FLAG_FOR_FOUNDER_CONFIRMATION',
      authoritativeValue: customValue,
      explanation: `Founder manually specified authoritative value: "${customValue}".`,
      arbitratedAt: nowIso,
      arbitratedBy: 'Founder Custom Directive'
    };
  }

  return caseItem;
}

/**
 * Audits a user query or planned task against the knowledge provenance engine.
 * Detects whether the query touches on facts with active disagreements (e.g. runway, cash, auth status)
 * and returns rich provenance metadata and arbitration warnings.
 */
export async function auditProvenanceForQuery(
  query: string,
  startupId: string
): Promise<{
  facts: FactProvenance[];
  conflicts: DisagreementResolutionCase[];
  arbitrationSummary?: string;
  hasStaleWarning: boolean;
}> {
  const allFacts = await getKnowledgeFacts(startupId);
  const allCases = await getDisagreementCases(startupId);
  const qLower = query.toLowerCase();

  const relevantFacts: FactProvenance[] = [];
  const relevantCases: DisagreementResolutionCase[] = [];

  // 1. Match query against financial vitals / runway
  if (qLower.includes('cash') || qLower.includes('runway') || qLower.includes('burn') || qLower.includes('balance') || qLower.includes('solvency')) {
    relevantFacts.push(...allFacts.filter(f => ['cash_balance', 'monthly_burn_rate', 'runway_months'].includes(f.key)));
    const finCase = allCases.find(c => c.id.includes('runway'));
    if (finCase) relevantCases.push(finCase);
  }

  // 2. Match query against roadmap / feature readiness
  if (qLower.includes('auth') || qLower.includes('roadmap') || qLower.includes('complete') || qLower.includes('launch') || qLower.includes('sso') || qLower.includes('feature')) {
    relevantFacts.push(...allFacts.filter(f => f.key.includes('auth')));
    const authCase = allCases.find(c => c.id.includes('auth'));
    if (authCase) relevantCases.push(authCase);
  }

  // 3. Match query against headcount / employees
  if (qLower.includes('headcount') || qLower.includes('team') || qLower.includes('employee') || qLower.includes('staff')) {
    relevantFacts.push(...allFacts.filter(f => f.key.includes('headcount')));
  }

  let arbitrationSummary: string | undefined;
  if (relevantCases.length > 0) {
    arbitrationSummary = relevantCases.map(c => 
      `⚠️ Disagreement Arbitration [${c.topic}]: ${c.descriptiveClaim.source} states "${c.descriptiveClaim.value}", but ${c.operationalReality.source} records "${c.operationalReality.value}". CatalystOS applied "${c.arbitrationVerdict.ruleApplied}": Authoritative Value is "${c.arbitrationVerdict.authoritativeValue}".`
    ).join('\n\n');
  }

  const hasStaleWarning = relevantFacts.some(f => f.freshness === 'STALE' || f.freshness === 'AGING');

  return {
    facts: relevantFacts.length > 0 ? relevantFacts : allFacts.slice(0, 4),
    conflicts: relevantCases,
    arbitrationSummary,
    hasStaleWarning
  };
}

export const knowledgeProvenanceService = {
  getKnowledgeFacts,
  getDisagreementCases,
  confirmFactManually,
  resolveDisagreement,
  auditProvenanceForQuery,
  calculateFreshness
};
