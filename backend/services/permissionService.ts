/**
 * P1 Task 7 — Minimal role model + permission map.
 *
 * Deliberately small: a flat list of roles, a static capability map, and one
 * Express middleware. No permission-management UI, no permissions table.
 * The map is the single source of truth and is enforced here, on the backend —
 * the React sidebar only *mirrors* it via GET /api/permissions/me.
 */

export const ROLES = [
  'FOUNDER',
  'ADMIN',
  'FINANCE',
  'HR',
  'OPERATIONS',
  'GROWTH'
] as const;

export type Role = typeof ROLES[number];

/** Areas map 1:1 onto the dashboard sidebar tabs. */
export type Area =
  | 'dashboard'
  | 'approvals'
  | 'knowledge'
  | 'workflows'
  | 'agents'
  | 'people'
  | 'scenarios'
  | 'decisions';

/** Agent keys match ExecutiveAgent.role values provisioned at onboarding. */
export type AgentKey =
  | 'CEO'
  | 'Finance'
  | 'Talent'
  | 'Growth'
  | 'Legal'
  | 'Operations'
  | 'Investment'
  | 'Auditor';

export type Action =
  | 'startup:write'          // edit company profile / financial baseline
  | 'approvals:review'       // approve / reject / edit an approval
  | 'knowledge:write'        // upload or delete documents
  | 'people:read'
  | 'people:write'           // manage roster / TEAM_MEMBER records
  // P1 Task 10 — grant or revoke actual company ACCOUNT access: issuing,
  // resending and revoking invitations, and suspending a Membership. This
  // replaced the narrower invite-only permission so the whole account-access
  // boundary sits behind one check instead of two names for the same concept.
  | 'people:access'
  | 'orchestrate:execute'    // run an AI command
  | 'orchestrate:request';   // draft only; execution needs an approver

export interface Permissions {
  role: Role;
  areas: Area[];
  agents: AgentKey[];
  actions: Action[];
}

const ALL_AREAS: Area[] = [
  'dashboard', 'approvals', 'knowledge', 'workflows',
  'agents', 'people', 'scenarios', 'decisions'
];

const ALL_AGENTS: AgentKey[] = [
  'CEO', 'Finance', 'Talent', 'Growth', 'Legal', 'Operations', 'Investment', 'Auditor'
];

export const ROLE_PERMISSIONS: Record<Role, Permissions> = {
  FOUNDER: {
    role: 'FOUNDER',
    areas: ALL_AREAS,
    agents: ALL_AGENTS,
    actions: [
      'startup:write', 'approvals:review', 'knowledge:write',
      'people:read', 'people:write', 'people:access',
      'orchestrate:execute', 'orchestrate:request'
    ]
  },
  ADMIN: {
    role: 'ADMIN',
    areas: ALL_AREAS,
    agents: ALL_AGENTS,
    actions: [
      'startup:write', 'approvals:review', 'knowledge:write',
      'people:read', 'people:write', 'people:access',
      'orchestrate:execute', 'orchestrate:request'
    ]
  },
  FINANCE: {
    role: 'FINANCE',
    areas: ['dashboard', 'approvals', 'knowledge', 'agents', 'people', 'scenarios'],
    agents: ['Finance', 'Auditor', 'Investment'],
    actions: ['knowledge:write', 'people:read', 'orchestrate:request']
  },
  HR: {
    role: 'HR',
    areas: ['dashboard', 'knowledge', 'agents', 'people', 'workflows'],
    agents: ['Talent', 'Legal'],
    actions: ['knowledge:write', 'people:read', 'people:write', 'orchestrate:request']
  },
  OPERATIONS: {
    role: 'OPERATIONS',
    areas: ['dashboard', 'workflows', 'knowledge', 'agents', 'people', 'decisions'],
    agents: ['Operations', 'CEO'],
    actions: ['knowledge:write', 'people:read', 'orchestrate:request']
  },
  GROWTH: {
    role: 'GROWTH',
    areas: ['dashboard', 'workflows', 'knowledge', 'agents', 'people'],
    agents: ['Growth', 'CEO'],
    actions: ['knowledge:write', 'people:read', 'orchestrate:request']
  }
};

/**
 * Maps the loose role strings that already exist in the database
 * ('founder', 'Founder', 'Executive', 'Investor', 'Admin', ...) onto a Role.
 * Unknown values resolve to the least-privileged sensible default rather than
 * being promoted — fail closed, matching the P0 middleware hardening.
 */
export function normalizeRole(raw: string | null | undefined): Role {
  const str = (raw || '').trim().toUpperCase();
  const key = str.replace(/[\s-]+/g, '_');
  if ((ROLES as readonly string[]).includes(key)) return key as Role;

  // Robust detection for founders, CEOs, owners, and co-founders (e.g. "Founder & CEO")
  if (
    str.includes('FOUNDER') ||
    str.includes('CEO') ||
    str.includes('OWNER') ||
    str.includes('COFOUNDER')
  ) {
    return 'FOUNDER';
  }

  if (str.includes('ADMIN')) {
    return 'ADMIN';
  }

  switch (key) {
    case 'EXECUTIVE':
    case 'EMPLOYEE':
    case 'EMPLOYEES':
      return 'OPERATIONS';
    case 'PEOPLE':
    case 'TALENT':
    case 'RECRUITING':
      return 'HR';
    case 'MARKETING':
    case 'SALES':
    case 'REVENUE':
      return 'GROWTH';
    case 'ACCOUNTING':
    case 'CFO':
      return 'FINANCE';
    case 'OPS':
      return 'OPERATIONS';
    default:
      // Investor and anything unrecognised: read-mostly operations view.
      return 'OPERATIONS';
  }
}

export function getPermissions(raw: string | null | undefined): Permissions {
  return ROLE_PERMISSIONS[normalizeRole(raw)];
}

export function can(raw: string | null | undefined, action: Action): boolean {
  return getPermissions(raw).actions.includes(action);
}

export function canAccessArea(raw: string | null | undefined, area: Area): boolean {
  return getPermissions(raw).areas.includes(area);
}

export function canUseAgent(raw: string | null | undefined, agent: AgentKey): boolean {
  return getPermissions(raw).agents.includes(agent);
}

/** True when the role may only draft, so the result must go to an approver. */
export function requiresApproval(raw: string | null | undefined): boolean {
  return !can(raw, 'orchestrate:execute');
}

/**
 * Express middleware factory. Complements requireRole() in
 * neonAuthMiddleware.ts: that one gates on identity, this one on capability.
 */
export function requirePermission(action: Action) {
  return (req: any, res: any, next: any) => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized: Authentication required.' });
      return;
    }
    if (!can(req.user.role, action)) {
      res.status(403).json({
        error: `Forbidden: '${action}' is not permitted for role ${normalizeRole(req.user.role)}.`,
        requiredAction: action,
        role: normalizeRole(req.user.role)
      });
      return;
    }
    next();
  };
}
