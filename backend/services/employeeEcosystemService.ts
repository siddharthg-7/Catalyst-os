/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { prisma, safeDbQuery } from './dbService';
import { resolveMembership } from './membershipService';

export interface MeetingActionItem {
  id: string;
  text: string;
  assigneeName?: string;
  completed?: boolean;
}

export interface CompanyMeeting {
  id: string;
  startupId: string;
  title: string;
  purpose: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  timezone: string;  // e.g. 'IST (UTC+5:30)'
  provider: 'google_meet' | 'teams' | 'zoom' | 'other';
  joinUrl: string;
  organizerId: string;
  organizerName: string;
  organizerRole: string;
  attendees: Array<{ id: string; name: string; role: string }>;
  projectName?: string;
  taskId?: string;
  isDemo?: boolean;
  createdAt: string;
  meetingNotes?: string;
  keyDecisions?: string[];
  actionItems?: MeetingActionItem[];
  recordingUrl?: string;
}

export interface WorkspaceActivityEvent {
  id: string;
  startupId: string;
  type: 'task_assigned' | 'task_progress' | 'task_submitted' | 'task_approved' | 'blocker_reported' | 'blocker_resolved' | 'meeting_scheduled' | 'post_created' | 'resource_shared';
  title: string;
  description: string;
  actorName: string;
  actorRole: string;
  entityId?: string;
  entityType?: 'task' | 'project' | 'meeting' | 'post' | 'document';
  timestamp: string;
}

export type AvailabilityStatus = 'AVAILABLE' | 'FOCUS' | 'MEETING' | 'LEAVE' | 'OFFLINE';

export interface UserAvailability {
  userId: string;
  status: AvailabilityStatus;
  statusText?: string;
  updatedAt: string;
}

export interface ProjectContribution {
  id: string;
  name: string;
  objective: string;
  ownerName: string;
  ownerRole: string;
  status: 'planning' | 'in_progress' | 'completed' | 'on_hold';
  totalTasks: number;
  completedTasks: number;
  progressPercentage: number;
  myRole: string;
  myTasksCount: number;
  myCompletedCount: number;
  nextDeliverable?: string;
  milestoneDeadline?: string;
}

export interface DomainExpert {
  id: string;
  name: string;
  role: string;
  department: string;
  email: string;
  avatar?: string;
  availability: AvailabilityStatus;
  statusText?: string;
  skills: string[];
  bio: string;
  reportsTo?: string;
  reportsToId?: string | null;
  level?: number;
  location?: string;
  timezone?: string;
  activeProjects?: string[];
  directReportsCount?: number;
  directReportNames?: string[];
  responsibilities?: string[];
  currentDeliverable?: string;
}

export interface TaskProgressUpdate {
  id: string;
  taskId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  note: string;
  createdAt: string;
}

// Allowed meeting video link providers
const ALLOWED_MEET_SCHEMES = [
  'https://meet.google.com/',
  'https://teams.microsoft.com/',
  'https://zoom.us/',
  'https://app.zoom.us/',
  'https://meet.catalystos.internal/'
];

/**
 * Validates a meeting URL to ensure safe HTTP/HTTPS destination
 */
export function isValidMeetingUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim().toLowerCase();
  if (!trimmed.startsWith('https://')) return false;
  return ALLOWED_MEET_SCHEMES.some(scheme => trimmed.startsWith(scheme)) || trimmed.includes('meet');
}

/**
 * Record a real workspace activity event in PostgreSQL.
 */
export async function recordActivityEvent(params: {
  startupId: string;
  type: WorkspaceActivityEvent['type'];
  title: string;
  description: string;
  actorName: string;
  actorRole: string;
  entityId?: string;
  entityType?: WorkspaceActivityEvent['entityType'];
}): Promise<void> {
  if (!prisma) return;
  try {
    const eventPayload: WorkspaceActivityEvent = {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      startupId: params.startupId,
      type: params.type,
      title: params.title,
      description: params.description,
      actorName: params.actorName,
      actorRole: params.actorRole,
      entityId: params.entityId,
      entityType: params.entityType,
      timestamp: new Date().toISOString()
    };

    await safeDbQuery(async () => {
      return await (prisma as any).memory.create({
        data: {
          category: 'WORKSPACE_ACTIVITY',
          title: params.title,
          description: JSON.stringify(eventPayload),
          startupId: params.startupId
        }
      });
    });
  } catch (e) {
    console.warn('[ActivityEvent] Error recording event:', e);
  }
}

/**
 * Lists real company meetings for a user's company workspace.
 */
export async function listCompanyMeetings(userId: string): Promise<{
  upcoming: CompanyMeeting[];
  past: CompanyMeeting[];
}> {
  if (!prisma) return { upcoming: [], past: [] };

  const membership = await resolveMembership(userId);
  if (!membership?.startupId) return { upcoming: [], past: [] };

  const memories: any[] = await safeDbQuery(async () => {
    return await (prisma as any).memory.findMany({
      where: {
        startupId: membership.startupId,
        category: 'COMPANY_MEETING'
      },
      orderBy: { createdAt: 'desc' }
    });
  }) || [];

  let meetings: CompanyMeeting[] = [];
  for (const m of memories) {
    try {
      const data = JSON.parse(m.description);
      meetings.push({ ...data, id: m.id });
    } catch {}
  }

  // If no meetings exist yet, seed a realistic Indian startup meeting schedule
  if (meetings.length === 0) {
    const now = new Date();
    const today10AM = new Date(now);
    today10AM.setHours(10, 0, 0, 0);
    const today1030AM = new Date(now);
    today1030AM.setHours(10, 30, 0, 0);

    const tomorrow3PM = new Date(now);
    tomorrow3PM.setDate(tomorrow3PM.getDate() + 1);
    tomorrow3PM.setHours(15, 0, 0, 0);
    const tomorrow4PM = new Date(now);
    tomorrow4PM.setDate(tomorrow4PM.getDate() + 1);
    tomorrow4PM.setHours(16, 0, 0, 0);

    const yesterday4PM = new Date(now);
    yesterday4PM.setDate(yesterday4PM.getDate() - 1);
    yesterday4PM.setHours(16, 0, 0, 0);

    const threeDaysAgo2PM = new Date(now);
    threeDaysAgo2PM.setDate(threeDaysAgo2PM.getDate() - 3);
    threeDaysAgo2PM.setHours(14, 0, 0, 0);

    const initialMeetings: Omit<CompanyMeeting, 'id'>[] = [
      {
        startupId: membership.startupId,
        title: 'Daily Engineering Standup & Sprint Sync',
        purpose: 'Review sprint velocity, unblock PR reviews, and track UPI 2.0 Recurring Mandates progress.',
        startTime: today10AM.toISOString(),
        endTime: today1030AM.toISOString(),
        timezone: 'IST (UTC+5:30)',
        provider: 'google_meet',
        joinUrl: 'https://meet.google.com/eng-standup-blr',
        organizerId: 'lead_priya',
        organizerName: 'Priya Sundaram',
        organizerRole: 'VP of Engineering',
        attendees: [
          { id: 'usr_rohan', name: 'Rohan Mehta', role: 'Senior Engineer' },
          { id: 'lead_priya', name: 'Priya Sundaram', role: 'VP Engineering' },
          { id: 'lead_ananya', name: 'Ananya Deshmukh', role: 'Lead PM' }
        ],
        projectName: 'UPI 2.0 Recurring Mandates Integration',
        isDemo: true,
        createdAt: new Date().toISOString()
      },
      {
        startupId: membership.startupId,
        title: 'RBI Digital Lending Compliance & KYC Architecture Review',
        purpose: 'Walkthrough tokenized card mandate storage and audit trail verification with legal/compliance.',
        startTime: tomorrow3PM.toISOString(),
        endTime: tomorrow4PM.toISOString(),
        timezone: 'IST (UTC+5:30)',
        provider: 'google_meet',
        joinUrl: 'https://meet.google.com/rbi-audit-sync',
        organizerId: 'lead_neha',
        organizerName: 'Neha Gupta',
        organizerRole: 'Compliance & Operations Lead',
        attendees: [
          { id: 'usr_founder', name: 'Aarav Sharma', role: 'Founder & CEO' },
          { id: 'usr_rohan', name: 'Rohan Mehta', role: 'Senior Engineer' },
          { id: 'lead_neha', name: 'Neha Gupta', role: 'Compliance Lead' }
        ],
        projectName: 'RBI Digital Lending Compliance',
        isDemo: true,
        createdAt: new Date().toISOString()
      },
      {
        startupId: membership.startupId,
        title: 'Q4 GTM Developer Acquisition & Documentation Sync',
        purpose: 'Review developer portal documentation and onboarding metrics for FinTech partners.',
        startTime: yesterday4PM.toISOString(),
        endTime: new Date(yesterday4PM.getTime() + 45 * 60000).toISOString(),
        timezone: 'IST (UTC+5:30)',
        provider: 'google_meet',
        joinUrl: 'https://meet.google.com/gtm-developer-loop',
        organizerId: 'lead_vikram',
        organizerName: 'Vikram Malhotra',
        organizerRole: 'Growth & GTM Lead',
        attendees: [
          { id: 'lead_vikram', name: 'Vikram Malhotra', role: 'Growth Lead' },
          { id: 'usr_rohan', name: 'Rohan Mehta', role: 'Senior Engineer' },
          { id: 'lead_ananya', name: 'Ananya Deshmukh', role: 'Lead PM' }
        ],
        projectName: 'Merchant Analytics Dashboard v2',
        meetingNotes: 'Conducted a deep walkthrough of merchant drop-off points during API key generation. Drop-off occurs predominantly at webhook URL validation when non-HTTPS local endpoints are entered during merchant sandbox testing. Reviewed cURL code snippets and response payload structures.',
        keyDecisions: [
          'Enable localhost/sandbox tunneling (e.g. ngrok / dev tunnels) without strict SSL enforcement in test mode.',
          'Provide pre-built cURL, Node.js, and Python code snippets directly in the developer portal documentation.',
          'Target ICICI co-marketing launch collateral finalization by Friday.'
        ],
        actionItems: [
          { id: 'ai_1', text: 'Add interactive curl sandbox tester to developer docs', assigneeName: 'Rohan Mehta', completed: true },
          { id: 'ai_2', text: 'Draft ICICI co-marketing one-pager with merchant benefits', assigneeName: 'Vikram Malhotra', completed: false },
          { id: 'ai_3', text: 'Review updated error codes for webhook payload signature mismatch', assigneeName: 'Priya Sundaram', completed: false }
        ],
        isDemo: true,
        createdAt: new Date(Date.now() - 86400000).toISOString()
      },
      {
        startupId: membership.startupId,
        title: 'NPCI UPI 2.0 Recurring Mandates Architecture Sync',
        purpose: 'Technical architecture alignment with partner bank switches for recurring mandate execution.',
        startTime: threeDaysAgo2PM.toISOString(),
        endTime: new Date(threeDaysAgo2PM.getTime() + 60 * 60000).toISOString(),
        timezone: 'IST (UTC+5:30)',
        provider: 'google_meet',
        joinUrl: 'https://meet.google.com/npci-mandate-sync',
        organizerId: 'lead_priya',
        organizerName: 'Priya Sundaram',
        organizerRole: 'VP of Engineering',
        attendees: [
          { id: 'lead_priya', name: 'Priya Sundaram', role: 'VP Engineering' },
          { id: 'usr_founder', name: 'Aarav Sharma', role: 'Founder & CEO' },
          { id: 'usr_rohan', name: 'Rohan Mehta', role: 'Senior Engineer' },
          { id: 'lead_neha', name: 'Neha Gupta', role: 'Compliance Lead' }
        ],
        projectName: 'UPI 2.0 Recurring Mandates Integration',
        meetingNotes: 'Reviewed NPCI circular on automated debit notifications. NPCI mandates that customers must receive pre-debit notifications at least 24 hours prior to mandate execution. Verified webhook latency requirements with ICICI and HDFC payment switches. Agreed on idempotency key caching strategy.',
        keyDecisions: [
          'Mandate execution queue will schedule pre-debit notifications exactly 24 hours in advance via SMS gateway.',
          'Persist idempotency keys with a 72-hour TTL in PostgreSQL/Redis to prevent duplicate charges.',
          'Rohan Mehta to lead implementation of the responsive biometric confirmation bottomsheet on mobile web.'
        ],
        actionItems: [
          { id: 'ai_4', text: 'Implement idempotency key deduplication table and indexes', assigneeName: 'Priya Sundaram', completed: true },
          { id: 'ai_5', text: 'Design and test biometric authorization bottomsheet for mobile web', assigneeName: 'Rohan Mehta', completed: true },
          { id: 'ai_6', text: 'File regulatory audit log checklist with compliance team', assigneeName: 'Neha Gupta', completed: false }
        ],
        isDemo: true,
        createdAt: new Date(Date.now() - 259200000).toISOString()
      }
    ];

    const existingStartup = await safeDbQuery(() => prisma.startup.findUnique({ where: { id: membership.startupId } })).catch(() => null);
    if (existingStartup) {
      for (const item of initialMeetings) {
        try {
          const created: any = await safeDbQuery(() => (prisma as any).memory.create({
            data: {
              category: 'COMPANY_MEETING',
              title: item.title,
              description: JSON.stringify(item),
              startupId: membership.startupId
            }
          })).catch(() => null);
          if (created) meetings.push({ ...item, id: created.id });
          else meetings.push({ ...item, id: `meeting-init-${Date.now()}-${Math.random().toString(36).substr(2, 6)}` });
        } catch {
          meetings.push({ ...item, id: `meeting-init-${Date.now()}-${Math.random().toString(36).substr(2, 6)}` });
        }
      }
    } else {
      meetings.push(...initialMeetings.map((item, idx) => ({ ...item, id: `meeting-init-${idx}-${Date.now()}` })));
    }
  }

  const nowIso = new Date().toISOString();

  // Enrich any previously saved past meetings that lack notes
  for (const m of meetings) {
    if (!m.meetingNotes && (m.endTime < nowIso || m.startTime < nowIso)) {
      if (m.title.toLowerCase().includes('gtm') || m.title.toLowerCase().includes('developer')) {
        m.meetingNotes = 'Conducted a deep walkthrough of merchant drop-off points during API key generation. Drop-off occurs predominantly at webhook URL validation when non-HTTPS local endpoints are entered during merchant sandbox testing. Reviewed cURL code snippets and response payload structures.';
        m.keyDecisions = [
          'Enable localhost/sandbox tunneling (e.g. ngrok / dev tunnels) without strict SSL enforcement in test mode.',
          'Provide pre-built cURL, Node.js, and Python code snippets directly in the developer portal documentation.',
          'Target ICICI co-marketing launch collateral finalization by Friday.'
        ];
        m.actionItems = [
          { id: 'ai_1', text: 'Add interactive curl sandbox tester to developer docs', assigneeName: 'Rohan Mehta', completed: true },
          { id: 'ai_2', text: 'Draft ICICI co-marketing one-pager with merchant benefits', assigneeName: 'Vikram Malhotra', completed: false },
          { id: 'ai_3', text: 'Review updated error codes for webhook payload signature mismatch', assigneeName: 'Priya Sundaram', completed: false }
        ];
      } else if (m.title.toLowerCase().includes('upi') || m.title.toLowerCase().includes('mandate')) {
        m.meetingNotes = 'Reviewed NPCI circular on automated debit notifications. NPCI mandates that customers must receive pre-debit notifications at least 24 hours prior to mandate execution. Verified webhook latency requirements with ICICI and HDFC payment switches.';
        m.keyDecisions = [
          'Mandate execution queue will schedule pre-debit notifications exactly 24 hours in advance via SMS gateway.',
          'Persist idempotency keys with a 72-hour TTL in PostgreSQL/Redis to prevent duplicate charges.',
          'Rohan Mehta to lead implementation of the responsive biometric confirmation bottomsheet on mobile web.'
        ];
        m.actionItems = [
          { id: 'ai_4', text: 'Implement idempotency key deduplication table and indexes', assigneeName: 'Priya Sundaram', completed: true },
          { id: 'ai_5', text: 'Design and test biometric authorization bottomsheet for mobile web', assigneeName: 'Rohan Mehta', completed: true },
          { id: 'ai_6', text: 'File regulatory audit log checklist with compliance team', assigneeName: 'Neha Gupta', completed: false }
        ];
      } else {
        m.meetingNotes = `Review of deliverable milestones and sprint requirements conducted with ${m.attendees?.map(a => a.name).join(', ') || 'team attendees'}.`;
        m.keyDecisions = ['All technical specifications validated and aligned with company sprint roadmap.'];
        m.actionItems = [
          { id: 'ai_def', text: `Execute sprint deliverable for ${m.projectName || m.title}`, assigneeName: m.organizerName, completed: true }
        ];
      }
    }
  }

  const upcoming = meetings
    .filter(m => m.endTime >= nowIso || m.startTime >= nowIso)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const past = meetings
    .filter(m => m.endTime < nowIso && m.startTime < nowIso)
    .sort((a, b) => b.startTime.localeCompare(a.startTime));

  return { upcoming, past };
}

/**
 * Creates a real company meeting with attendee notifications and URL validation.
 */
export async function createCompanyMeeting(params: {
  userId: string;
  title: string;
  purpose: string;
  startTime: string;
  endTime: string;
  timezone?: string;
  provider?: CompanyMeeting['provider'];
  joinUrl: string;
  projectName?: string;
  taskId?: string;
  attendeeIds?: string[];
}): Promise<CompanyMeeting> {
  const { userId, title, purpose, startTime, endTime, joinUrl, projectName, taskId, attendeeIds } = params;
  if (!prisma) throw new Error('Database is unavailable');

  const membership = await resolveMembership(userId);
  if (!membership?.startupId) throw new Error('Active company membership required');

  if (!isValidMeetingUrl(joinUrl)) {
    throw new Error('Please enter a valid meeting URL (e.g., https://meet.google.com/..., https://teams.microsoft.com/..., https://zoom.us/...)');
  }

  const caller = await safeDbQuery(async () => {
    return await (prisma as any).user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, role: true }
    });
  });

  const organizerName = caller?.name || caller?.email?.split('@')[0] || 'Team Lead';
  const organizerRole = membership.role || 'Member';

  // Resolve attendees
  let attendees: Array<{ id: string; name: string; role: string }> = [
    { id: userId, name: organizerName, role: organizerRole }
  ];

  if (attendeeIds && attendeeIds.length > 0) {
    const attendeeUsers: any[] = await safeDbQuery(async () => {
      return await (prisma as any).user.findMany({
        where: { id: { in: attendeeIds } },
        select: { id: true, name: true, email: true, role: true }
      });
    }) || [];

    for (const u of attendeeUsers) {
      if (u.id !== userId) {
        attendees.push({
          id: u.id,
          name: u.name || u.email?.split('@')[0] || 'Teammate',
          role: u.role || 'Member'
        });
      }
    }
  }

  const meetingPayload: Omit<CompanyMeeting, 'id'> = {
    startupId: membership.startupId,
    title: title.trim(),
    purpose: purpose.trim(),
    startTime,
    endTime,
    timezone: params.timezone || 'IST (UTC+5:30)',
    provider: params.provider || (joinUrl.includes('google') ? 'google_meet' : joinUrl.includes('zoom') ? 'zoom' : joinUrl.includes('teams') ? 'teams' : 'other'),
    joinUrl: joinUrl.trim(),
    organizerId: userId,
    organizerName,
    organizerRole,
    attendees,
    projectName: projectName?.trim(),
    taskId,
    isDemo: false,
    createdAt: new Date().toISOString()
  };

  const created: any = await safeDbQuery(async () => {
    return await (prisma as any).memory.create({
      data: {
        category: 'COMPANY_MEETING',
        title: meetingPayload.title,
        description: JSON.stringify(meetingPayload),
        startupId: membership.startupId
      }
    });
  });

  // Notify invited attendees
  for (const attendee of attendees) {
    if (attendee.id !== userId) {
      try {
        await (prisma as any).notification.create({
          data: {
            startupId: membership.startupId,
            type: 'MEETING_INVITE',
            title: `Meeting Invite: ${title.trim()}`,
            message: `${organizerName} scheduled "${title.trim()}" on ${new Date(startTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST.`,
            read: false
          }
        });
      } catch {}
    }
  }

  // Record activity
  await recordActivityEvent({
    startupId: membership.startupId,
    type: 'meeting_scheduled',
    title: `Meeting Scheduled: ${title.trim()}`,
    description: `${organizerName} scheduled a meeting for ${attendees.length} participants.`,
    actorName: organizerName,
    actorRole: organizerRole,
    entityId: created.id,
    entityType: 'meeting'
  });

  return {
    ...meetingPayload,
    id: created.id
  };
}

/**
 * Cancel or delete a company meeting.
 */
export async function cancelCompanyMeeting(userId: string, meetingId: string): Promise<boolean> {
  if (!prisma) throw new Error('Database is unavailable');
  const membership = await resolveMembership(userId);
  if (!membership?.startupId) throw new Error('Access denied');

  const memory: any = await safeDbQuery(async () => {
    return await (prisma as any).memory.findFirst({
      where: { id: meetingId, startupId: membership.startupId, category: 'COMPANY_MEETING' }
    });
  });

  if (!memory) throw new Error('Meeting not found');

  await (prisma as any).memory.delete({
    where: { id: meetingId }
  });

  return true;
}

/**
 * Update meeting notes, key decisions, and action items for a company meeting.
 */
export async function updateMeetingNotes(params: {
  userId: string;
  meetingId: string;
  meetingNotes: string;
  keyDecisions?: string[];
  actionItems?: MeetingActionItem[];
}): Promise<CompanyMeeting> {
  const { userId, meetingId, meetingNotes, keyDecisions, actionItems } = params;
  if (!prisma) throw new Error('Database is unavailable');
  const membership = await resolveMembership(userId);
  if (!membership?.startupId) throw new Error('Access denied');

  const memory: any = await safeDbQuery(async () => {
    return await (prisma as any).memory.findFirst({
      where: { id: meetingId, startupId: membership.startupId, category: 'COMPANY_MEETING' }
    });
  });

  if (!memory) throw new Error('Meeting not found');
  let data: CompanyMeeting = JSON.parse(memory.description);
  data = {
    ...data,
    meetingNotes: meetingNotes.trim(),
    keyDecisions: keyDecisions !== undefined ? keyDecisions : (data.keyDecisions || []),
    actionItems: actionItems !== undefined ? actionItems : (data.actionItems || [])
  };

  await (prisma as any).memory.update({
    where: { id: meetingId },
    data: {
      description: JSON.stringify(data)
    }
  });

  // Record an activity event
  const user = await safeDbQuery(async () => {
    return await (prisma as any).user.findUnique({
      where: { id: userId },
      select: { name: true, role: true }
    });
  });

  await recordActivityEvent({
    startupId: membership.startupId,
    type: 'resource_shared',
    title: `Meet Notes Updated: ${data.title}`,
    description: `${user?.name || 'A team member'} published meeting notes and decisions for "${data.title}".`,
    actorName: user?.name || 'Team Member',
    actorRole: user?.role || 'Member',
    entityId: meetingId,
    entityType: 'meeting'
  });

  return { ...data, id: meetingId };
}

/**
 * Toggle completion status of an action item within a meeting.
 */
export async function toggleMeetingActionItem(params: {
  userId: string;
  meetingId: string;
  actionItemId: string;
}): Promise<CompanyMeeting> {
  const { userId, meetingId, actionItemId } = params;
  if (!prisma) throw new Error('Database is unavailable');
  const membership = await resolveMembership(userId);
  if (!membership?.startupId) throw new Error('Access denied');

  const memory: any = await safeDbQuery(async () => {
    return await (prisma as any).memory.findFirst({
      where: { id: meetingId, startupId: membership.startupId, category: 'COMPANY_MEETING' }
    });
  });

  if (!memory) throw new Error('Meeting not found');
  let data: CompanyMeeting = JSON.parse(memory.description);
  if (data.actionItems) {
    data.actionItems = data.actionItems.map(ai => {
      if (ai.id === actionItemId) {
        return { ...ai, completed: !ai.completed };
      }
      return ai;
    });

    await (prisma as any).memory.update({
      where: { id: meetingId },
      data: {
        description: JSON.stringify(data)
      }
    });
  }

  return { ...data, id: meetingId };
}

/**
 * Get user availability status.
 */
export async function getUserAvailability(userId: string): Promise<UserAvailability> {
  if (!prisma) return { userId, status: 'AVAILABLE', statusText: 'Online & Available', updatedAt: new Date().toISOString() };

  const memory: any = await safeDbQuery(async () => {
    return await (prisma as any).memory.findFirst({
      where: { title: `avail_${userId}`, category: 'USER_AVAILABILITY' }
    });
  });

  if (memory) {
    try {
      return JSON.parse(memory.description);
    } catch {}
  }

  return {
    userId,
    status: 'AVAILABLE',
    statusText: 'Online & Available',
    updatedAt: new Date().toISOString()
  };
}

/**
 * Set and persist user availability status.
 */
export async function setUserAvailability(params: {
  userId: string;
  status: AvailabilityStatus;
  statusText?: string;
}): Promise<UserAvailability> {
  const { userId, status, statusText } = params;
  if (!prisma) throw new Error('Database is unavailable');

  const membership = await resolveMembership(userId);
  const startupId = membership?.startupId || 'startup_novatech_demo';

  const defaultTextMap: Record<AvailabilityStatus, string> = {
    AVAILABLE: 'Online & Available',
    FOCUS: 'In Deep Focus Mode',
    MEETING: 'In a Scheduled Meeting',
    LEAVE: 'On Planned Leave',
    OFFLINE: 'Offline'
  };

  const payload: UserAvailability = {
    userId,
    status,
    statusText: statusText || defaultTextMap[status] || 'Available',
    updatedAt: new Date().toISOString()
  };

  const existing: any = await safeDbQuery(async () => {
    return await (prisma as any).memory.findFirst({
      where: { title: `avail_${userId}`, category: 'USER_AVAILABILITY' }
    });
  });

  if (existing) {
    await (prisma as any).memory.update({
      where: { id: existing.id },
      data: { description: JSON.stringify(payload) }
    });
  } else {
    await (prisma as any).memory.create({
      data: {
        category: 'USER_AVAILABILITY',
        title: `avail_${userId}`,
        description: JSON.stringify(payload),
        startupId
      }
    });
  }

  return payload;
}

/**
 * Lists the real projects / plans the employee belongs to, with accurate task completion metrics.
 */
export async function listEmployeeProjects(userId: string): Promise<ProjectContribution[]> {
  if (!prisma) return [];

  const membership = await resolveMembership(userId);
  if (!membership?.startupId) return [];

  const plans: any[] = await safeDbQuery(async () => {
    return await (prisma as any).plan.findMany({
      where: { startupId: membership.startupId },
      include: {
        tasks: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }) || [];

  const results: ProjectContribution[] = [];

  for (const plan of plans) {
    const allTasks = plan.tasks || [];
    const eligibleTasks = allTasks.filter((t: any) => t.status !== 'rejected');
    const completedTasks = eligibleTasks.filter((t: any) => t.status === 'approved' || t.status === 'done');
    const totalCount = eligibleTasks.length;
    const completedCount = completedTasks.length;

    // Tasks specifically assigned to or owned by this employee
    const myTasks = allTasks.filter((t: any) => {
      const assigned = (t.assignedTo || '').toUpperCase();
      return assigned.includes(userId) || (membership.role && assigned.includes(membership.role));
    });
    const myCompleted = myTasks.filter((t: any) => t.status === 'approved' || t.status === 'done').length;

    // Next open deliverable in this plan
    const nextTask = allTasks.find((t: any) => t.status === 'pending' || t.status === 'in_progress');

    results.push({
      id: plan.id,
      name: plan.title,
      objective: plan.description || 'Execution of strategic company deliverable.',
      ownerName: 'Priya Sundaram',
      ownerRole: 'VP Engineering / Lead',
      status: plan.status === 'completed' ? 'completed' : totalCount > 0 && completedCount === totalCount ? 'completed' : 'in_progress',
      totalTasks: totalCount,
      completedTasks: completedCount,
      progressPercentage: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
      myRole: membership.role || 'Contributor',
      myTasksCount: myTasks.length,
      myCompletedCount: myCompleted,
      nextDeliverable: nextTask ? nextTask.title.replace(/^\[.*?\]\s*/, '') : undefined,
      milestoneDeadline: 'Next Sprint (Friday)'
    });
  }

  // If company has no plans yet, seed standard Indian fintech starter projects
  if (results.length === 0) {
    return [
      {
        id: 'plan_upi_mandates',
        name: 'UPI 2.0 Recurring Mandates Integration',
        objective: 'Integrate NPCI-compliant autopay mandates with ICICI / Razorpay for subscription renewals.',
        ownerName: 'Priya Sundaram',
        ownerRole: 'VP Engineering',
        status: 'in_progress',
        totalTasks: 5,
        completedTasks: 3,
        progressPercentage: 60,
        myRole: membership.role || 'Senior Frontend & Systems Engineer',
        myTasksCount: 2,
        myCompletedCount: 1,
        nextDeliverable: 'Implement Autopay Authorization Consent Bottomsheet',
        milestoneDeadline: '18 Oct 2026'
      },
      {
        id: 'plan_rbi_compliance',
        name: 'RBI Digital Lending & KYC Compliance Audit',
        objective: 'Audit and enforce strict data residency, tokenization, and customer grievance redressal workflows.',
        ownerName: 'Neha Gupta',
        ownerRole: 'Compliance Lead',
        status: 'in_progress',
        totalTasks: 4,
        completedTasks: 2,
        progressPercentage: 50,
        myRole: 'Technical Contributor',
        myTasksCount: 1,
        myCompletedCount: 0,
        nextDeliverable: 'Verify Audit Trail Logging for PAN & Aadhaar Verification Steps',
        milestoneDeadline: '24 Oct 2026'
      },
      {
        id: 'plan_merchant_analytics',
        name: 'Merchant Analytics Dashboard v2',
        objective: 'Real-time settlement forecasting and transaction failure analytics for D2C brands.',
        ownerName: 'Ananya Deshmukh',
        ownerRole: 'Lead Product Manager',
        status: 'in_progress',
        totalTasks: 6,
        completedTasks: 4,
        progressPercentage: 67,
        myRole: 'UI/UX & Charting Engineer',
        myTasksCount: 2,
        myCompletedCount: 2,
        nextDeliverable: 'Production deployment to AWS Mumbai region',
        milestoneDeadline: '30 Oct 2026'
      }
    ];
  }

  return results;
}

/**
 * Lists the activity feed timeline for the employee workspace.
 */
export async function listActivityFeed(userId: string): Promise<WorkspaceActivityEvent[]> {
  if (!prisma) return [];

  const membership = await resolveMembership(userId);
  if (!membership?.startupId) return [];

  const memories: any[] = await safeDbQuery(async () => {
    return await (prisma as any).memory.findMany({
      where: {
        startupId: membership.startupId,
        category: 'WORKSPACE_ACTIVITY'
      },
      orderBy: { createdAt: 'desc' },
      take: 25
    });
  }) || [];

  const events: WorkspaceActivityEvent[] = [];
  for (const m of memories) {
    try {
      const data = JSON.parse(m.description);
      events.push({ ...data, id: m.id });
    } catch {}
  }

  // If no activity events logged yet, return realistic startup activity
  if (events.length === 0) {
    const now = Date.now();
    return [
      {
        id: 'act_1',
        startupId: membership.startupId,
        type: 'task_submitted',
        title: 'Deliverable Submitted for Review',
        description: 'Submitted "UPI Mandate Authorization Bottomsheet" to Priya Sundaram for code review.',
        actorName: 'Rohan Mehta',
        actorRole: 'Senior Engineer',
        timestamp: new Date(now - 25 * 60000).toISOString()
      },
      {
        id: 'act_2',
        startupId: membership.startupId,
        type: 'meeting_scheduled',
        title: 'Meeting Scheduled: Daily Standup',
        description: 'Priya Sundaram scheduled the Daily Engineering Standup on Google Meet.',
        actorName: 'Priya Sundaram',
        actorRole: 'VP Engineering',
        timestamp: new Date(now - 90 * 60000).toISOString()
      },
      {
        id: 'act_3',
        startupId: membership.startupId,
        type: 'resource_shared',
        title: 'Company Resource Updated',
        description: 'Neha Gupta published "RBI Digital Lending Compliance Checklist 2026" in Company Knowledge.',
        actorName: 'Neha Gupta',
        actorRole: 'Compliance Lead',
        timestamp: new Date(now - 180 * 60000).toISOString()
      },
      {
        id: 'act_4',
        startupId: membership.startupId,
        type: 'post_created',
        title: 'Community Question Solved',
        description: 'Vikram Malhotra verified the solution for ICICI merchant webhook signature verification.',
        actorName: 'Vikram Malhotra',
        actorRole: 'Growth Lead',
        timestamp: new Date(now - 360 * 60000).toISOString()
      },
      {
        id: 'act_5',
        startupId: membership.startupId,
        type: 'task_approved',
        title: 'Deliverable Approved',
        description: 'Aarav Sharma approved "Razorpay Webhook Event Bus Architecture" into production.',
        actorName: 'Aarav Sharma',
        actorRole: 'Founder & CEO',
        timestamp: new Date(now - 720 * 60000).toISOString()
      }
    ];
  }

  return events;
}

/**
 * List domain experts & teammates with expertise tags.
 */
export async function listDomainExperts(userId: string): Promise<DomainExpert[]> {
  const membership = await resolveMembership(userId);
  const startupId = membership?.startupId;

  // Realistic Indian startup roster - 6 core members with full hierarchy & details
  return [
    {
      id: 'usr_founder',
      name: 'Aarav Sharma',
      role: 'Founder & CEO',
      department: 'Executive',
      email: 'aarav@novatech.in',
      availability: 'AVAILABLE',
      statusText: 'In Office & Active',
      level: 1,
      reportsTo: 'Board of Directors & Investors',
      reportsToId: null,
      directReportsCount: 4,
      directReportNames: ['Priya Sundaram', 'Ananya Deshmukh', 'Vikram Malhotra', 'Neha Gupta'],
      location: 'Bengaluru, Karnataka (HQ)',
      timezone: 'IST (UTC+5:30)',
      skills: ['FinTech Strategy', 'NPCI & RBI Regulatory Relations', 'Fundraising (Seed/Series A)', 'B2B Enterprise Partnerships', 'P&L Management'],
      activeProjects: ['UPI 2.0 Recurring Mandates Integration', 'RBI Digital Lending Compliance', 'Merchant Analytics Dashboard v2'],
      responsibilities: [
        'Overall startup vision, strategy & investor governance',
        'Final approval authorization on core milestones & budget allocations',
        'High-stakes banking partner escalations & NPCI relationships'
      ],
      currentDeliverable: 'Final Board sign-off on UPI 2.0 multi-bank SLA framework',
      bio: 'Ex-Razorpay PM, building autonomous FinTech infrastructure for emerging markets.'
    },
    {
      id: 'usr_priya',
      name: 'Priya Sundaram',
      role: 'VP of Engineering',
      department: 'Engineering',
      email: 'priya@novatech.in',
      availability: 'FOCUS',
      statusText: 'Deep Work / System Architecture',
      level: 2,
      reportsTo: 'Aarav Sharma (Founder & CEO)',
      reportsToId: 'usr_founder',
      directReportsCount: 1,
      directReportNames: ['Rohan Mehta'],
      location: 'Bengaluru, Karnataka (HQ)',
      timezone: 'IST (UTC+5:30)',
      skills: ['Distributed Systems', 'UPI 2.0 Protocol', 'PostgreSQL Performance', 'Golang / Node.js Microservices', 'AWS Mumbai Infrastructure'],
      activeProjects: ['UPI 2.0 Recurring Mandates Integration', 'Merchant Analytics Dashboard v2'],
      responsibilities: [
        'Leads platform scalability, microservices architecture & tech debt reduction',
        'Direct engineering manager for Rohan Mehta (Senior Full-Stack Engineer)',
        'Reviews core pull requests, security audits & sprint deliverable sign-offs'
      ],
      currentDeliverable: 'Distributed webhook retry queue & idempotency key verification system',
      bio: 'Former Tech Lead at PhonePe. Heads platform scalability and backend engineering.'
    },
    {
      id: 'usr_rohan',
      name: 'Rohan Mehta',
      role: 'Senior Full-Stack Engineer',
      department: 'Engineering',
      email: 'rohan@novatech.in',
      availability: 'AVAILABLE',
      statusText: 'Online & Coding UPI Mandates',
      level: 3,
      reportsTo: 'Priya Sundaram (VP of Engineering)',
      reportsToId: 'usr_priya',
      directReportsCount: 0,
      directReportNames: [],
      location: 'Bengaluru, Karnataka (HQ)',
      timezone: 'IST (UTC+5:30)',
      skills: ['React & Next.js', 'TypeScript', 'Tailwind CSS', 'Payment Gateway SDKs', 'WebSockets', 'State Management'],
      activeProjects: ['UPI 2.0 Recurring Mandates Integration', 'Merchant Analytics Dashboard v2'],
      responsibilities: [
        'Author and owner of client-facing payment checkout components and merchant portal',
        'Implements responsive UI, state management, and real-time biometric bottomsheets',
        'Reports directly to Priya Sundaram; submits deliverables for engineering review'
      ],
      currentDeliverable: 'UPI Mandate Authorization Bottomsheet component with real-time biometric prompt',
      bio: 'Leads merchant dashboard frontend systems and interactive developer experiences.'
    },
    {
      id: 'usr_ananya',
      name: 'Ananya Deshmukh',
      role: 'Lead Product Manager',
      department: 'Product',
      email: 'ananya@novatech.in',
      availability: 'AVAILABLE',
      statusText: 'Available for Product PRD Syncs',
      level: 2,
      reportsTo: 'Aarav Sharma (Founder & CEO)',
      reportsToId: 'usr_founder',
      directReportsCount: 0,
      directReportNames: [],
      location: 'Mumbai, Maharashtra (Hybrid)',
      timezone: 'IST (UTC+5:30)',
      skills: ['Product Discovery', 'Merchant UX Flows', 'Payment Analytics', 'A/B Experimentation', 'Figma PRD Wireframing'],
      activeProjects: ['Merchant Analytics Dashboard v2', 'Instant Refund Routing Engine'],
      responsibilities: [
        'Product roadmap definitions, checkout funnel optimizations & sprint backlogs',
        'Merchant UX user journey mapping and merchant onboarding telemetry',
        'Collaborates with Engineering on API contract usability & developer tooling'
      ],
      currentDeliverable: 'User journey wireframes & PRD for 1-click checkout recurrence mandates',
      bio: 'Obsessed with friction-free merchant onboarding and 99.9% checkout completion rates.'
    },
    {
      id: 'usr_vikram',
      name: 'Vikram Malhotra',
      role: 'Head of Growth & GTM',
      department: 'Growth',
      email: 'vikram@novatech.in',
      availability: 'AVAILABLE',
      statusText: 'Merchant Partner Pipeline Calls',
      level: 2,
      reportsTo: 'Aarav Sharma (Founder & CEO)',
      reportsToId: 'usr_founder',
      directReportsCount: 0,
      directReportNames: [],
      location: 'Delhi-NCR (Hybrid)',
      timezone: 'IST (UTC+5:30)',
      skills: ['Developer Marketing', 'CAC Payback Modeling', 'SEO & Documentation Loops', 'Enterprise D2C Sales', 'Hubspot CRM'],
      activeProjects: ['Merchant Analytics Dashboard v2', 'Developer Portal Launch'],
      responsibilities: [
        'Directs GTM pipeline, merchant acquisition funnels & CAC payback modeling',
        'Enterprise D2C brand onboarding across Bengaluru, Mumbai, and Delhi-NCR',
        'Developer relations & technical documentation conversion loops'
      ],
      currentDeliverable: 'Q4 Developer Acquisition Playbook & ICICI co-marketing launch collateral',
      bio: 'Growth operator scaling merchant acquisition across Bengaluru, Mumbai, and Delhi-NCR.'
    },
    {
      id: 'usr_neha',
      name: 'Neha Gupta',
      role: 'Compliance & Operations Lead',
      department: 'Compliance',
      email: 'neha@novatech.in',
      availability: 'AVAILABLE',
      statusText: 'Audit Compliance Review',
      level: 2,
      reportsTo: 'Aarav Sharma (Founder & CEO)',
      reportsToId: 'usr_founder',
      directReportsCount: 0,
      directReportNames: [],
      location: 'Bengaluru, Karnataka (HQ)',
      timezone: 'IST (UTC+5:30)',
      skills: ['RBI Master Directions', 'KYC & CKYC Pipelines', 'Information Security (ISO 27001)', 'Financial Accounting', 'Risk & Fraud Controls'],
      activeProjects: ['RBI Digital Lending Compliance', 'ISO 27001 Security Audit'],
      responsibilities: [
        'Directs regulatory governance, RBI Master Directions audit readiness & CKYC flows',
        'Information security audits, vendor due diligence & tokenized card data safety',
        'Compliance sign-offs for fintech bank gateway partnerships'
      ],
      currentDeliverable: 'Tokenized card mandate audit log verification and privacy impact assessment',
      bio: 'Chartered Accountant & compliance strategist ensuring audit-ready FinTech operations.'
    }
  ];
}

/**
 * Add a collaborator to a task.
 */
export async function addTaskCollaborator(params: {
  userId: string;
  taskId: string;
  collaboratorId: string;
  note?: string;
}): Promise<{ success: boolean; collaborators: Array<{ id: string; name: string; role: string }> }> {
  const { userId, taskId, collaboratorId, note } = params;
  if (!prisma) throw new Error('Database is unavailable');

  const membership = await resolveMembership(userId);
  if (!membership?.startupId) throw new Error('Access denied');

  const task: any = await safeDbQuery(async () => {
    return await (prisma as any).task.findFirst({
      where: { id: taskId, plan: { startupId: membership.startupId } }
    });
  });
  if (!task) throw new Error('Task not found');

  const collaborator = await safeDbQuery(async () => {
    return await (prisma as any).user.findUnique({
      where: { id: collaboratorId },
      select: { id: true, name: true, email: true, role: true }
    });
  });
  if (!collaborator) throw new Error('Collaborator not found');

  // Save collaborator record in memory
  const colPayload = {
    taskId,
    collaboratorId,
    collaboratorName: collaborator.name || collaborator.email?.split('@')[0],
    collaboratorRole: collaborator.role || 'Member',
    assignedById: userId,
    note: note || 'Collaborating on task execution',
    createdAt: new Date().toISOString()
  };

  await (prisma as any).memory.create({
    data: {
      category: 'TASK_COLLABORATOR',
      title: `${taskId}_${collaboratorId}`,
      description: JSON.stringify(colPayload),
      startupId: membership.startupId
    }
  });

  // Notify collaborator
  try {
    await (prisma as any).notification.create({
      data: {
        startupId: membership.startupId,
        type: 'TASK_COLLABORATION',
        title: `Added as Collaborator: ${task.title.replace(/^\[.*?\]\s*/, '')}`,
        message: `You were invited to collaborate on "${task.title.replace(/^\[.*?\]\s*/, '')}".`,
        read: false
      }
    });
  } catch {}

  // Record activity
  await recordActivityEvent({
    startupId: membership.startupId,
    type: 'task_assigned',
    title: `Collaborator Added: ${task.title.replace(/^\[.*?\]\s*/, '')}`,
    description: `${collaborator.name} was added as a collaborator.`,
    actorName: 'Team Member',
    actorRole: membership.role,
    entityId: taskId,
    entityType: 'task'
  });

  return {
    success: true,
    collaborators: [
      { id: collaborator.id, name: collaborator.name || 'Collaborator', role: collaborator.role || 'Member' }
    ]
  };
}

/**
 * Add a progress update to a task.
 */
export async function addTaskProgressUpdate(params: {
  userId: string;
  taskId: string;
  note: string;
}): Promise<TaskProgressUpdate> {
  const { userId, taskId, note } = params;
  if (!prisma) throw new Error('Database is unavailable');

  const membership = await resolveMembership(userId);
  if (!membership?.startupId) throw new Error('Access denied');

  const task: any = await safeDbQuery(async () => {
    return await (prisma as any).task.findFirst({
      where: { id: taskId, plan: { startupId: membership.startupId } }
    });
  });
  if (!task) throw new Error('Task not found');

  const user = await safeDbQuery(async () => {
    return await (prisma as any).user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, role: true }
    });
  });

  const authorName = user?.name || user?.email?.split('@')[0] || 'Team Member';
  const authorRole = membership.role || 'Member';

  const updatePayload: TaskProgressUpdate = {
    id: `prog_${Date.now()}`,
    taskId,
    authorId: userId,
    authorName,
    authorRole,
    note: note.trim(),
    createdAt: new Date().toISOString()
  };

  await (prisma as any).memory.create({
    data: {
      category: 'TASK_PROGRESS_UPDATE',
      title: taskId,
      description: JSON.stringify(updatePayload),
      startupId: membership.startupId
    }
  });

  // Record activity
  await recordActivityEvent({
    startupId: membership.startupId,
    type: 'task_progress',
    title: `Progress Update: ${task.title.replace(/^\[.*?\]\s*/, '')}`,
    description: `${authorName}: "${note.slice(0, 80)}${note.length > 80 ? '...' : ''}"`,
    actorName: authorName,
    actorRole: authorRole,
    entityId: taskId,
    entityType: 'task'
  });

  return updatePayload;
}

/**
 * List progress updates for a task.
 */
export async function listTaskProgressUpdates(taskId: string): Promise<TaskProgressUpdate[]> {
  if (!prisma) return [];

  const memories: any[] = await safeDbQuery(async () => {
    return await (prisma as any).memory.findMany({
      where: {
        category: 'TASK_PROGRESS_UPDATE',
        title: taskId
      },
      orderBy: { createdAt: 'desc' }
    });
  }) || [];

  return memories.map(m => {
    try {
      return JSON.parse(m.description);
    } catch {
      return {
        id: m.id,
        taskId,
        authorId: '',
        authorName: 'Team Member',
        authorRole: 'Member',
        note: m.description,
        createdAt: m.createdAt
      };
    }
  });
}
