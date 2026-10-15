import { Request, Response } from 'express';
import { prisma, hasValidDbUrl } from '../../services/dbService';
import { startupProfile } from '../../state';

/**
 * Controller for Venture Profile & Health Metrics
 */
export async function getStartupProfile(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (user?.id && hasValidDbUrl) {
      const startup = await (prisma as any).startup.findFirst({
        where: {
          memberships: {
            some: { userId: user.id }
          }
        }
      });
      if (startup) {
        return res.json({
          name: startup.name,
          industry: startup.industry || 'B2B SaaS / Developer Tools',
          description: startup.description || '',
          stage: startup.fundingStage || 'Seed',
          onboarded: true,
          cashBalance: startupProfile.cashBalance,
          burnRate: startupProfile.burnRate,
          runwayMonths: startupProfile.runwayMonths,
          healthScore: startupProfile.healthScore,
          metrics: startupProfile.metrics
        });
      }
    }
    return res.json(startupProfile);
  } catch (err: any) {
    console.warn('[startupController] getStartupProfile warning:', err?.message);
    return res.json(startupProfile);
  }
}
