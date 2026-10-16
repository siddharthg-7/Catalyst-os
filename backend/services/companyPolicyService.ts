/**
 * CatalystOS - Configurable Company Policies Service (Section 7)
 * Eliminates hardcoded business rules (runway thresholds, benefits multipliers, salary bands).
 * Company policies are tenant-scoped and immutable by LLMs.
 */

import { safeDbQuery, prisma } from './dbService';
import { isDbAvailable } from '../state';
import { decisionLedgerService } from './decisionLedgerService';

export interface CompanyPolicy {
  startupId: string;
  minimumRunwayMonths: number;      // Insolvency ceiling (e.g., <4.0 months triggers hard CFO VETO)
  criticalRunwayMonths: number;     // Cautionary threshold (e.g., <6.0 months triggers conditional approval)
  benefitsMultiplier: number;       // Loaded payroll multiplier (default 1.20 = 20%)
  approvalThresholdAmount: number;  // Financial amount requiring founder sign-off (default $10,000)
  maxCampaignBudgetMonthly: number; // Maximum monthly growth spend before executive veto (default $25,000)
  baseSalaryBenchmarks: Record<string, number>;
  updatedAt: string;
}

const DEFAULT_SALARY_BENCHMARKS: Record<string, number> = {
  'engineer': 130000,
  'backend': 135000,
  'frontend': 120000,
  'fullstack': 130000,
  'senior': 150000,
  'lead': 175000,
  'designer': 105000,
  'product manager': 130000,
  'marketer': 95000,
  'growth': 100000,
  'sales': 85000,
  'legal': 160000,
};

const policyStore = new Map<string, CompanyPolicy>();

export class CompanyPolicyService {
  /**
   * Retrieves the active company policy for a startup.
   * Returns stored policy or sensible defaults.
   */
  public async getPolicy(startupId: string): Promise<CompanyPolicy> {
    if (!startupId) {
      return this.getDefaultPolicy('default');
    }

    if (policyStore.has(startupId)) {
      return policyStore.get(startupId)!;
    }

    const defaultPolicy = this.getDefaultPolicy(startupId);
    policyStore.set(startupId, defaultPolicy);
    return defaultPolicy;
  }

  /**
   * Updates company policies for a startup (Founder action only).
   */
  public async updatePolicy(
    startupId: string, 
    updates: Partial<Omit<CompanyPolicy, 'startupId' | 'updatedAt'>>,
    actor?: string
  ): Promise<CompanyPolicy> {
    const current = await this.getPolicy(startupId);
    const updated: CompanyPolicy = {
      ...current,
      ...updates,
      baseSalaryBenchmarks: {
        ...current.baseSalaryBenchmarks,
        ...(updates.baseSalaryBenchmarks || {})
      },
      updatedAt: new Date().toISOString()
    };

    policyStore.set(startupId, updated);

    decisionLedgerService.appendEvent({
      decisionId: `policy_${startupId}`,
      startupId,
      workflowId: `wf_policy_${Date.now()}`,
      actor: actor || 'Founder',
      eventType: 'POLICY_CHANGED',
      payload: {
        oldPolicy: current,
        newPolicy: updated,
        diff: updates,
        tenantId: startupId
      }
    });

    // Dynamic RAG outbox update: synchronize policy updates into knowledge architecture
    try {
      const { ingestionPipelineService } = await import('./ingestionPipelineService');
      const policyContent = `COMPANY POLICY & OPERATIONAL BOUNDARIES:
Minimum Runway Months: ${updated.minimumRunwayMonths} (Hard CFO veto if breached)
Critical Cautionary Runway: ${updated.criticalRunwayMonths} months
Benefits & Payroll Multiplier: ${updated.benefitsMultiplier}x
Founder Approval Threshold: $${updated.approvalThresholdAmount.toLocaleString()}
Maximum Monthly Campaign Budget: $${updated.maxCampaignBudgetMonthly.toLocaleString()}
Base Salary Benchmarks:
${Object.entries(updated.baseSalaryBenchmarks || {})
  .map(([role, sal]) => ` - ${role}: $${sal.toLocaleString()}`)
  .join('\n')}`;

      await ingestionPipelineService.enqueueJob({
        startupId,
        sourceType: 'POLICY',
        sourceRecordId: `policy_${startupId}`,
        action: 'UPSERT',
        payload: {
          documentId: `doc_policy_${startupId}`,
          name: `[Company Policy] Institutional Operational Rules`,
          type: 'policy',
          content: policyContent,
          accessScope: 'FOUNDER_ONLY',
          summary: `Authoritative company financial thresholds and salary benchmarks.`
        },
        immediate: true
      });
    } catch (ragErr: any) {
      console.warn('[CompanyPolicyService] Dynamic policy RAG sync warning:', ragErr.message);
    }

    return updated;
  }

  public getDefaultPolicy(startupId: string): CompanyPolicy {
    return {
      startupId,
      minimumRunwayMonths: 4.0,
      criticalRunwayMonths: 6.0,
      benefitsMultiplier: 1.20,
      approvalThresholdAmount: 10000,
      maxCampaignBudgetMonthly: 25000,
      baseSalaryBenchmarks: { ...DEFAULT_SALARY_BENCHMARKS },
      updatedAt: new Date().toISOString()
    };
  }
}

export const companyPolicyService = new CompanyPolicyService();
