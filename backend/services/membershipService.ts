/**
 * P1 Task 8 — Membership resolution.
 *
 * Membership is the authoritative User <-> Startup relationship. `Startup.ownerId`
 * is preserved for backwards compatibility, so every resolver here checks
 * Membership first and then falls back to ownership. That fallback is what keeps
 * all existing P0 founder behaviour working on databases where the backfill
 * (prisma/backfillMemberships.ts) has not run yet.
 *
 * Deliberately NOT a rewrite of authorization: this module only resolves
 * "which company, and in what role". Capabilities still come from permissionService.
 */
import { prisma, safeDbQuery, hasValidDbUrl } from './dbService';
import { normalizeRole, getPermissions, type Role, type Permissions } from './permissionService';

/**
 * The seeded demo identities, matched EXACTLY rather than by substring.
 * A substring test on the word "demo" could match a generated id that merely
 * contains those letters, and would then hand that caller a FOUNDER membership
 * with no database check at all.
 */
const DEMO_USER_IDS = new Set(['usr_founder_demo']);
const DEMO_STARTUP_IDS = new Set(['startup_novatech_demo']);

export function isDemoUserId(userId?: string | null): boolean {
  return Boolean(userId && DEMO_USER_IDS.has(userId));
}

export function isDemoStartupId(startupId?: string | null): boolean {
  return Boolean(startupId && DEMO_STARTUP_IDS.has(startupId));
}

export type MembershipStatus = 'ACTIVE' | 'SUSPENDED';

export interface ResolvedMembership {
  startupId: string;
  role: Role;
  status: MembershipStatus;
  /** True when resolved from Startup.ownerId rather than a Membership row. */
  viaOwnership: boolean;
  isOwner: boolean;
}

function dbReady(): boolean {
  return Boolean(hasValidDbUrl && prisma);
}

/**
 * Resolves the company the user acts within, Membership first, ownership second.
 * Returns null when the user belongs to no company.
 */
export async function resolveMembership(
  userId: string,
  startupId?: string
): Promise<ResolvedMembership | null> {
  if (!userId) return null;

  // Graceful demo/offline fallback: Demo identity is strictly bound to startup_novatech_demo
  if (isDemoUserId(userId)) {
    if (startupId && startupId !== 'startup_novatech_demo') {
      return null;
    }
    return {
      startupId: 'startup_novatech_demo',
      role: 'FOUNDER',
      status: 'ACTIVE',
      viaOwnership: true,
      isOwner: true
    };
  }

  if (!dbReady()) {
    if (startupId && startupId !== 'startup_novatech_demo') {
      return null;
    }
    return {
      startupId: 'startup_novatech_demo',
      role: 'FOUNDER',
      status: 'ACTIVE',
      viaOwnership: true,
      isOwner: true
    };
  }

  try {
    const membership: any = await safeDbQuery(() =>
      (prisma as any).membership.findFirst({
        where: {
          userId,
          status: 'ACTIVE',
          ...(startupId ? { startupId } : {})
        },
        include: { startup: { select: { id: true, ownerId: true } } },
        orderBy: { createdAt: 'asc' }
      })
    );

    if (membership) {
      return {
        startupId: membership.startupId,
        role: normalizeRole(membership.role),
        status: membership.status as MembershipStatus,
        viaOwnership: false,
        isOwner: membership.startup?.ownerId === userId
      };
    }

    // Compatibility fallback: a founder whose membership has not been backfilled.
    const owned: any = await safeDbQuery(() =>
      prisma.startup.findFirst({
        where: { ownerId: userId, ...(startupId ? { id: startupId } : {}) },
        select: { id: true }
      })
    );

    if (owned) {
      return {
        startupId: owned.id,
        role: 'FOUNDER',
        status: 'ACTIVE',
        viaOwnership: true,
        isOwner: true
      };
    }
  } catch (err: any) {
    console.warn('[membershipService] resolveMembership note:', err.message);
  }

  return null;
}

/** The startup id the user acts within, or null. */
export async function getActiveStartupId(userId: string): Promise<string | null> {
  const membership = await resolveMembership(userId);
  return membership?.startupId ?? (!dbReady() || isDemoUserId(userId) ? 'startup_novatech_demo' : null);
}

/**
 * The role that should drive permissions for this user in this company.
 * Falls back to the User.role column only when no company can be resolved,
 * which preserves pre-Task-8 behaviour for users without a startup.
 */
export async function getEffectiveRole(
  userId: string,
  fallbackRole?: string | null,
  startupId?: string
): Promise<Role> {
  const membership = await resolveMembership(userId, startupId);
  if (membership) return membership.role;
  return normalizeRole(fallbackRole);
}

/** Effective permissions for this user in this company. */
export async function getEffectivePermissions(
  userId: string,
  fallbackRole?: string | null,
  startupId?: string
): Promise<Permissions> {
  return getPermissions(await getEffectiveRole(userId, fallbackRole, startupId));
}

/**
 * Tenant guard. True only when the user has an active membership in — or owns —
 * the given startup. Every cross-company check should route through this.
 */
export async function isMemberOf(userId: string, startupId: string): Promise<boolean> {
  if (!userId || !startupId) return false;
  const membership = await resolveMembership(userId, startupId);
  return membership?.startupId === startupId;
}

/**
 * Creates a membership if absent, idempotently. The unique constraint on
 * (userId, startupId) is the real guarantee; this just avoids the error path.
 * Accepts an optional transaction client so acceptance stays atomic.
 */
export async function ensureMembership(
  userId: string,
  startupId: string,
  role: Role,
  client: any = prisma
): Promise<{ created: boolean; membership: any }> {
  const existing = await client.membership.findUnique({
    where: { userId_startupId: { userId, startupId } }
  });
  if (existing) {
    // P1 Task 9: a previously removed (SUSPENDED) member who is re-invited must
    // regain access, and must take the role from the NEW invitation rather than
    // silently inheriting the old one.
    if (existing.status !== 'ACTIVE' || existing.role !== role) {
      const reactivated = await client.membership.update({
        where: { id: existing.id },
        data: { status: 'ACTIVE', role }
      });
      return { created: false, membership: reactivated };
    }
    return { created: false, membership: existing };
  }

  const membership = await client.membership.create({
    data: { userId, startupId, role, status: 'ACTIVE' }
  });
  return { created: true, membership };
}

/**
 * Members of a company, for the People page.
 * Defaults to ACTIVE only: a SUSPENDED membership is a historical record of
 * access, not a company account, so it must not appear under Company Accounts.
 */
export async function listMemberships(
  startupId: string,
  opts: { includeSuspended?: boolean } = {}
): Promise<any[]> {
  if (!startupId) return [];
  if (!dbReady() || isDemoStartupId(startupId)) {
    return [
      {
        id: 'mem_founder_demo',
        startupId: startupId || 'startup_novatech_demo',
        userId: 'usr_founder_demo',
        role: 'FOUNDER',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        user: {
          id: 'usr_founder_demo',
          name: 'Demo Founder',
          email: 'founder@catalyst.os'
        }
      }
    ];
  }
  try {
    return await safeDbQuery(() =>
      (prisma as any).membership.findMany({
        where: {
          startupId,
          ...(opts.includeSuspended ? {} : { status: 'ACTIVE' })
        },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'asc' }
      })
    );
  } catch (err: any) {
    console.warn('[membershipService] listMemberships note:', err.message);
    return [];
  }
}

/**
 * Express middleware. Replaces req.user.role with the role from the caller's
 * Membership, so the synchronous requirePermission() checks downstream operate
 * on the membership role rather than the User.role column.
 *
 * Deliberately narrow: this is the seam that makes Membership authoritative for
 * authorization without rewriting the permission middleware. Mount it directly
 * after authenticateJWT on routes where role differentiation matters. If no
 * membership resolves, req.user.role is left untouched, preserving pre-Task-8
 * behaviour.
 */
export async function attachMembershipRole(req: any, _res: any, next: any) {
  try {
    if (req.user?.id) {
      const membership = await resolveMembership(req.user.id);
      if (membership) {
        req.user.role = membership.role;
        req.membership = membership;
      }
    }
  } catch (err: any) {
    console.warn('[membershipService] attachMembershipRole note:', err.message);
  }
  next();
}

/**
 * P1 Task 9 — error type for membership operations, mirroring InvitationError so
 * routes can map a failure to an HTTP status without re-deriving it.
 */
export class MembershipError extends Error {
  constructor(public status: number, message: string, public code: string) {
    super(message);
    this.name = 'MembershipError';
  }
}

export interface RemovedMembership {
  id: string;
  userId: string;
  startupId: string;
  role: Role;
  status: MembershipStatus;
  email: string;
  fullName: string;
}

/**
 * P1 Task 9 — revokes a member's access to a company by SUSPENDING their
 * membership. Suspension rather than deletion, because:
 *   - `resolveMembership()` filters on status ACTIVE, so access is lost immediately;
 *   - the row remains as an audit record of who once had access;
 *   - re-inviting the same person reactivates the row (see ensureMembership),
 *     so no duplicate membership is ever created.
 *
 * The User account is never touched — a user may belong to other companies.
 *
 * `startupId` must already be derived from the CALLER's own membership; it is
 * part of the WHERE clause, so a membership in another company reads as 404.
 */
export async function removeMembership(
  startupId: string,
  membershipId: string,
  actingUserId: string
): Promise<RemovedMembership> {
  if (!dbReady()) {
    throw new MembershipError(503, 'The database is unavailable.', 'DB_UNAVAILABLE');
  }

  const membership: any = await safeDbQuery(() =>
    (prisma as any).membership.findFirst({
      where: { id: membershipId, startupId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        startup: { select: { id: true, ownerId: true } }
      }
    })
  );

  // Tenant-scoped: a cross-company id is indistinguishable from a missing one.
  if (!membership) {
    throw new MembershipError(404, 'Membership not found in this company.', 'NOT_FOUND');
  }

  // Owner protection: the founder's membership is the company's anchor and
  // cannot be revoked here, including by the founder themselves.
  if (membership.startup?.ownerId === membership.userId) {
    throw new MembershipError(
      403,
      'The membership of the company owner cannot be removed. Transfer ownership first.',
      'OWNER_PROTECTED'
    );
  }

  if (membership.status !== 'ACTIVE') {
    throw new MembershipError(
      409,
      'The access for that member has already been removed.',
      'ALREADY_REMOVED'
    );
  }

  const updated: any = await (prisma as any).membership.update({
    where: { id: membership.id },
    data: { status: 'SUSPENDED' }
  });

  console.log(
    `[membershipService] Access revoked: ${membership.user?.email} ` +
    `removed from startup ${startupId} by ${actingUserId}`
  );

  return {
    id: updated.id,
    userId: updated.userId,
    startupId: updated.startupId,
    role: normalizeRole(updated.role),
    status: updated.status as MembershipStatus,
    email: membership.user?.email || '',
    fullName: membership.user?.name || membership.user?.email || 'Team Member'
  };
}

/**
 * P1 Task 9 — fail-closed company-scope guard.
 *
 * `attachMembershipRole` only HYDRATES the role; when no membership resolves it
 * leaves `req.user.role` as whatever the JWT claimed. On a company-scoped route
 * that is a stale-credential hole: a member whose access was just revoked still
 * carries their old role in an unexpired token, and routes backed by in-memory
 * state (e.g. the approvals queue) would honour it.
 *
 * This middleware closes that by requiring an ACTIVE membership (or ownership)
 * and returning 403 otherwise. Mount it in place of attachMembershipRole on
 * every route that acts on company data. Keep attachMembershipRole for routes
 * that must still answer for a user with no company, such as /permissions/me.
 */
export async function requireActiveMembership(req: any, res: any, next: any) {
  if (!req.user?.id) {
    res.status(401).json({ error: 'Unauthorized: Authentication required.' });
    return;
  }

  // Graceful offline fallback: If database is unconfigured, authenticated user continues with memory workspace
  if (!dbReady()) {
    next();
    return;
  }

  let membership: ResolvedMembership | null = null;
  try {
    membership = await resolveMembership(req.user.id);
  } catch (err: any) {
    console.warn('[membershipService] requireActiveMembership note:', err.message);
    res.status(503).json({ error: 'Membership could not be verified. Please retry.' });
    return;
  }

  if (!membership) {
    res.status(403).json({
      error: 'Forbidden: you do not have active access to a company workspace.',
      code: 'NO_ACTIVE_MEMBERSHIP'
    });
    return;
  }

  // Membership is authoritative: overwrite whatever the token claimed.
  req.user.role = membership.role;
  req.membership = membership;
  next();
}
