import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma, safeDbQuery } from '../services/dbService';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/invitationMailer';
import vaultService from '../services/vaultService';
import { extractTextFromFile } from '../services/documentParser';
import { ingestDocument, performHybridSearch, retrieveHybridKnowledge, buildContext, Citation, RetrievedChunk } from '../services/ragEngine';
import { classifyQuery, executeStructuredQuery } from '../services/structuredQueryEngine';
import { 
  startupProfile, 
  updateStartupProfile, 
  agentsList, 
  initiatives, 
  approvals, 
  decisionLog, 
  knowledgeFiles,
  setAgentStatuses,
  resetAgentStatuses,
  isDbAvailable,
  users,
  UserDBRecord,
  persistCurrentState
} from '../state';
import { ai, runMultiAgentCollaboration } from '../services/geminiService';
import { Initiative, Deliverable, UserRole, User } from '../src/models/types';
import { 
  authenticateJWT, 
  requireRole, 
  AuthenticatedRequest, 
  JWT_SECRET 
} from '../services/neonAuthMiddleware';
import {
  getActiveStartupId,
  isDemoUserId,
  resolveMembership,
  isMemberOf,
  listMemberships,
  getEffectivePermissions,
  attachMembershipRole,
  requireActiveMembership,
  removeMembership,
  MembershipError
} from '../services/membershipService';
import {
  listTasksForUser,
  getTaskByIdForUser,
  updateTaskForUser,
  assignTaskForUser,
  getRoleScopedContext,
  getAgentDraftForTask,
  assistEmployeeOnTask,
  listPlansForUser,
  getPlanById,
  ensureAiSpecialistCapability,
  getMissingCapabilitiesAndStaffing,
  retrieveDecisionMemory,
  decomposeParentTask,
  persistDecomposedTaskPlan,
  TaskDelegationError
} from '../services/taskDelegationService';
import {
  listNotificationsForUser,
  markNotificationRead,
  markAllNotificationsRead,
  checkAndDispatchDeadlineReminders
} from '../services/notificationService';
import {
  createInvitation,
  listInvitations,
  revokeInvitation,
  resendInvitation,
  peekInvitation,
  acceptInvitation,
  InvitationError
} from '../services/invitationService';
import {
  requirePermission,
  getPermissions,
  normalizeRole,
  ROLE_PERMISSIONS,
  ROLES
} from '../services/permissionService';
import jwt from 'jsonwebtoken';
import agentsRouter from '../agents/controller';
import { markdownRagService } from '../services/markdownRagService';
import { 
  uploadToS3, 
  isS3Configured, 
  checkS3Health, 
  getPresignedDownloadUrl 
} from '../services/s3Service';
import { orchestrationService } from '../services/orchestrationService';
import { multiLevelOrchestrator } from '../services/multiLevelOrchestrator';
import { workspaceService, DEFAULT_EXECUTIVE_ROLES } from '../services/workspaceService';
import { authorizeDocumentDownload, authorizeDocumentUpload } from '../services/documentAccessService';
import {
  planParentTaskWithRecovery,
  retryTaskPlanning,
  persistAssignmentsWithResilientNotifications,
  retryTaskNotification,
  assertNonTerminalLlmOutput,
  OrchestrationLifecycleStage
} from '../services/orchestrationReliabilityService';
import { companyContextService } from '../services/companyContextService';
import { approvalService } from '../services/approvalService';
import { performDevReset } from '../scripts/devReset';
import { orchestrateRateLimiter, chatRateLimiter, authRateLimiter } from '../services/rateLimiter';
import { financialEngine } from '../services/financialEngine';
import { decisionLedgerService } from '../services/decisionLedgerService';
import { agentRunService } from '../services/agentRunService';
import { companyPolicyService } from '../services/companyPolicyService';
import { agentRuleService } from '../services/agentRuleService';
import { activityLogService } from '../services/activityLogService';
import { multiAgentOrchestratorService } from '../services/multiAgentOrchestratorService';
import { ingestionPipelineService } from '../services/ingestionPipelineService';
import {
  createConversation,
  getConversation,
  listConversationsForUser,
  deleteConversation,
  appendMessage,
  getConversationMessages,
  buildConversationMemoryContext,
  promoteMessageToCompanyKnowledge
} from '../services/conversationMemoryService';
import {
  isQueryAmbiguous,
  synthesizeGroundedResponse,
  formatGroundedSystemPrompt
} from '../services/groundedResponseEngine';
import { realtimeEventService } from '../services/realtimeEventService';

const router = Router();
const idempotencyCache = new Map<string, { status: number; body: any; timestamp: number }>();

// Liveness and Readiness probes
router.get('/health', (req, res) => {
  res.json({
    status: 'alive',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    pid: process.pid,
    nodeVersion: process.version
  });
});

router.get('/ready', (req, res) => {
  const isReady = process.env.NODE_ENV === 'production' ? isDbAvailable : true;
  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ready' : 'degraded',
    databaseConnected: isDbAvailable,
    geminiConfigured: !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Phase 4, 5, 6: Real-time Server-Sent Events (SSE) stream endpoint
router.get('/realtime/stream', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const caller = req.user;
  if (!caller) {
    res.status(401).json({ error: 'Unauthorized: Authentication required for real-time stream.' });
    return;
  }

  // Resolve active startup and membership with strict tenant isolation
  const requestedStartupId = typeof req.query.startupId === 'string' ? req.query.startupId : undefined;
  const membership = await resolveMembership(caller.id, requestedStartupId);
  if (!membership) {
    res.status(403).json({ error: 'Forbidden: No authorized tenant membership found.' });
    return;
  }

  // Set standard SSE streaming headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  if (typeof (res as any).flushHeaders === 'function') {
    (res as any).flushHeaders();
  }

  const connectionId = `conn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const lastEventId = (req.headers['last-event-id'] as string) || (typeof req.query.lastEventId === 'string' ? req.query.lastEventId : null);

  realtimeEventService.registerClient({
    connectionId,
    userId: caller.id,
    startupId: membership.startupId,
    role: membership.role,
    res,
    lastEventId,
  });

  req.on('close', () => {
    realtimeEventService.unregisterClient(connectionId);
  });
});

router.get('/realtime/status', authenticateJWT, (req: AuthenticatedRequest, res) => {
  res.json({
    status: 'online',
    connectedClients: realtimeEventService.getConnectedClientsCount(),
    timestamp: Date.now(),
  });
});

// Authenticated RAG knowledge assistant endpoints with tenant resolution, conversation memory, and grounded responses
router.post('/chat', authenticateJWT, chatRateLimiter, async (req: AuthenticatedRequest, res) => {
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const query = [...messages].reverse().find(message => message?.role === 'user')?.content;
  if (typeof query !== 'string' || !query.trim()) {
    res.status(400).json({ error: 'A non-empty user message is required.' });
    return;
  }

  const callerId = req.user!.id;
  const requestedStartupId = req.body?.startupId;
  const resolved = await resolveMembership(callerId, requestedStartupId);
  if (!resolved) {
    res.status(403).json({ error: 'Access denied: You are not an authorized member of this company tenant.' });
    return;
  }

  try {
    const startupId = resolved.startupId;
    const userRole = resolved.role;

    // Phase 6: Establish Conversation and User Ownership
    let conversationId = req.body?.conversationId;
    let existingConv = null;
    if (conversationId) {
      existingConv = await getConversation({ conversationId, userId: callerId, startupId });
    }
    if (!existingConv) {
      const newConv = await createConversation({
        userId: callerId,
        startupId,
        title: query.trim().slice(0, 40) || 'New Conversation',
        conversationId: conversationId || undefined
      });
      conversationId = newConv.id;
    }

    // Persist user message to conversation memory
    await appendMessage({
      conversationId,
      role: 'user',
      content: query.trim()
    });

    // Phase 6: Build sliding-window conversation memory context (recent turns + older relevant messages)
    const memoryContext = await buildConversationMemoryContext({
      conversationId,
      userId: callerId,
      startupId,
      query: query.trim(),
      maxRecentTurns: 4,
      maxHistoricalRecall: 2
    });

    // Phase 5: Hybrid retrieval (authoritative structured DB + semantic vector search)
    const hybridResult = await retrieveHybridKnowledge({
      query: query.trim(),
      startupId,
      userId: callerId,
      userRole,
      limit: 4
    });

    // Phase 7: Grounded Response synthesis with ambiguity checks, sufficiency checks, and conflict resolution
    const grounded = await synthesizeGroundedResponse({
      query: query.trim(),
      hybridResult,
      memoryContext,
      userRole
    });

    // Persist assistant message with citations and metadata
    await appendMessage({
      conversationId,
      role: 'assistant',
      content: grounded.reply,
      citations: grounded.citations,
      metadata: {
        intent: grounded.intent,
        isAmbiguous: grounded.isAmbiguous,
        isInsufficient: grounded.isInsufficient,
        hasContradictionResolution: grounded.hasContradictionResolution
      }
    });

    return res.json({
      conversationId,
      reply: grounded.reply,
      sources: grounded.sources,
      citations: grounded.citations,
      intent: grounded.intent,
      operationalData: hybridResult.structuredData,
      isAmbiguous: grounded.isAmbiguous,
      isInsufficient: grounded.isInsufficient,
      hasContradictionResolution: grounded.hasContradictionResolution,
      debug: null
    });
  } catch (error) {
    console.error('[Grounded RAG] Chat request failed:', error);
    res.status(500).json({ error: 'The knowledge base could not be queried.' });
  }
});

router.post('/chat/stream', authenticateJWT, chatRateLimiter, async (req: AuthenticatedRequest, res) => {
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const query = [...messages].reverse().find(message => message?.role === 'user')?.content;
  if (typeof query !== 'string' || !query.trim()) {
    res.status(400).json({ error: 'A non-empty user message is required.' });
    return;
  }

  const callerId = req.user!.id;
  const requestedStartupId = req.body?.startupId;
  const resolved = await resolveMembership(callerId, requestedStartupId);
  if (!resolved) {
    res.status(403).json({ error: 'Access denied: You are not an authorized member of this company tenant.' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  try {
    const startupId = resolved.startupId;
    const userRole = resolved.role;

    // Phase 6: Establish Conversation and User Ownership
    let conversationId = req.body?.conversationId;
    let existingConv = null;
    if (conversationId) {
      existingConv = await getConversation({ conversationId, userId: callerId, startupId });
    }
    if (!existingConv) {
      const newConv = await createConversation({
        userId: callerId,
        startupId,
        title: query.trim().slice(0, 40) || 'New Conversation',
        conversationId: conversationId || undefined
      });
      conversationId = newConv.id;
    }

    // Persist user message to conversation memory
    await appendMessage({
      conversationId,
      role: 'user',
      content: query.trim()
    });

    // Phase 6: Build sliding-window conversation memory context
    const memoryContext = await buildConversationMemoryContext({
      conversationId,
      userId: callerId,
      startupId,
      query: query.trim(),
      maxRecentTurns: 4,
      maxHistoricalRecall: 2
    });

    // Phase 5: Hybrid retrieval
    const hybridResult = await retrieveHybridKnowledge({
      query: query.trim(),
      startupId,
      userId: callerId,
      userRole,
      limit: 4
    });

    // Phase 7: Grounded Response synthesis
    const grounded = await synthesizeGroundedResponse({
      query: query.trim(),
      hybridResult,
      memoryContext,
      userRole
    });

    // Stream tokens
    for (const token of grounded.reply.match(/\S+\s*/g) || []) {
      res.write(`data: ${JSON.stringify({ text: token })}\n\n`);
    }

    // Persist assistant message
    await appendMessage({
      conversationId,
      role: 'assistant',
      content: grounded.reply,
      citations: grounded.citations,
      metadata: {
        intent: grounded.intent,
        isAmbiguous: grounded.isAmbiguous,
        isInsufficient: grounded.isInsufficient,
        hasContradictionResolution: grounded.hasContradictionResolution
      }
    });

    res.write(`data: ${JSON.stringify({
      conversationId,
      sources: grounded.sources,
      citations: grounded.citations,
      intent: grounded.intent,
      operationalData: hybridResult.structuredData,
      isAmbiguous: grounded.isAmbiguous,
      isInsufficient: grounded.isInsufficient,
      hasContradictionResolution: grounded.hasContradictionResolution,
      debug: null
    })}\n\n`);
    res.write('data: [DONE]\n\n');
  } catch (error) {
    console.error('[Grounded RAG Stream] Streaming request failed:', error);
    res.write(`data: ${JSON.stringify({ text: 'The knowledge base could not be queried.' })}\n\n`);
    res.write('data: [DONE]\n\n');
  } finally {
    res.end();
  }
});

// Phase 6: Conversation Management Endpoints
router.get('/conversations', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const callerId = req.user!.id;
  const requestedStartupId = req.query?.startupId as string | undefined;
  const resolved = await resolveMembership(callerId, requestedStartupId);
  if (!resolved) {
    res.status(403).json({ error: 'Access denied: You are not an authorized member of this company tenant.' });
    return;
  }

  try {
    const conversations = await listConversationsForUser(callerId, resolved.startupId);
    res.json({ conversations });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/conversations/:id', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const callerId = req.user!.id;
  const requestedStartupId = req.query?.startupId as string | undefined;
  const resolved = await resolveMembership(callerId, requestedStartupId);
  if (!resolved) {
    res.status(403).json({ error: 'Access denied: You are not an authorized member of this company tenant.' });
    return;
  }

  try {
    const conversation = await getConversation({
      conversationId: req.params.id,
      userId: callerId,
      startupId: resolved.startupId
    });
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found or access denied.' });
      return;
    }
    const messages = await getConversationMessages(req.params.id);
    res.json({ conversation, messages });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/conversations/:id', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const callerId = req.user!.id;
  const requestedStartupId = (req.body?.startupId || req.query?.startupId) as string | undefined;
  const resolved = await resolveMembership(callerId, requestedStartupId);
  if (!resolved) {
    res.status(403).json({ error: 'Access denied: You are not an authorized member of this company tenant.' });
    return;
  }

  try {
    await deleteConversation({
      conversationId: req.params.id,
      userId: callerId,
      startupId: resolved.startupId,
      userRole: resolved.role
    });
    res.json({ success: true, message: 'Conversation deleted successfully.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/conversations/:id/promote', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const callerId = req.user!.id;
  const requestedStartupId = req.body?.startupId as string | undefined;
  const messageId = req.body?.messageId as string;
  if (!messageId) {
    res.status(400).json({ error: 'messageId is required to promote a message.' });
    return;
  }

  const resolved = await resolveMembership(callerId, requestedStartupId);
  if (!resolved) {
    res.status(403).json({ error: 'Access denied: You are not an authorized member of this company tenant.' });
    return;
  }

  try {
    const result = await promoteMessageToCompanyKnowledge({
      messageId,
      conversationId: req.params.id,
      userId: callerId,
      startupId: resolved.startupId,
      callerRole: resolved.role
    });
    res.json(result);
  } catch (err: any) {
    if (err.message.includes('Unauthorized')) {
      res.status(403).json({ error: err.message });
    } else {
      res.status(400).json({ error: err.message });
    }
  }
});

// ============================================================================
// NATIVE NEON POSTGRESQL AUTHENTICATION
// Secure database authentication with bcrypt password hashing and JWT sessions
// ============================================================================

// POST register/signup new user
router.post('/auth/signup', authRateLimiter, async (req, res) => {
  const { email, password, name, role } = req.body || {};
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    res.status(400).json({ error: 'A valid email address is required.' });
    return;
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    return;
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = (name || cleanEmail.split('@')[0] || 'Founder').trim();
  const allowedRoles: string[] = ['Founder', 'Employee', 'Employees', 'Executive', 'Investor', 'Admin'];
  const userRole: UserRole = (role && allowedRoles.includes(role))
    ? (role === 'Employees' ? 'Employee' : role as UserRole)
    : 'Founder';

  try {
    let existing: any = null;
    let newUser: any = null;
    const passwordHash = await bcrypt.hash(password, 10);

    // Cryptographic email verification token
    const rawVerificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenHash = crypto.createHash('sha256').update(rawVerificationToken).digest('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    if (isDbAvailable && prisma) {
      try {
        existing = await safeDbQuery(() => prisma.user.findUnique({
          where: { email: cleanEmail }
        }));
        if (existing) {
          res.status(409).json({ error: 'An account with this email address already exists. Please sign in.' });
          return;
        }
        const createdUser: any = await safeDbQuery(() => prisma.user.create({
          data: {
            email: cleanEmail,
            name: cleanName,
            role: userRole,
            passwordHash
          }
        }));
        if (createdUser?.id) {
          await safeDbQuery(() => prisma.$executeRawUnsafe(
            'UPDATE "User" SET "emailVerified" = $1, "verificationToken" = $2, "verificationExpires" = $3, "mustChangePassword" = $4 WHERE id = $5',
            false,
            verificationTokenHash,
            verificationExpires,
            false,
            createdUser.id
          )).catch(err => console.warn('[Auth API] Raw SQL column update notice:', err?.message));
          newUser = {
            ...createdUser,
            emailVerified: false,
            verificationToken: verificationTokenHash,
            verificationExpires,
            mustChangePassword: false
          };
        }
      } catch (dbErr: any) {
        console.warn('[Auth API] Database unavailable during signup, using local state:', dbErr.message);
      }
    }

    if (!newUser) {
      const memExisting = users.find(u => u.email.toLowerCase() === cleanEmail);
      if (memExisting) {
        res.status(409).json({ error: 'An account with this email address already exists. Please sign in.' });
        return;
      }
      const memUser: UserDBRecord = {
        id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        email: cleanEmail,
        name: cleanName,
        role: userRole,
        passwordHash,
        emailVerified: false,
        mustChangePassword: false
      };
      (memUser as any).verificationToken = verificationTokenHash;
      (memUser as any).verificationExpires = verificationExpires;
      users.push(memUser);
      newUser = memUser;
    }

    // Dispatch verification email via Gmail SMTP / EmailJS
    const appUrl = (process.env.APP_URL || process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const verificationUrl = `${appUrl}/verify-email?token=${rawVerificationToken}`;
    sendVerificationEmail({
      to: cleanEmail,
      name: cleanName,
      verificationUrl,
      expiresAt: verificationExpires
    }).catch(err => console.warn('[Auth API] Verification email delivery notice:', err?.message));

    // Fresh user is not onboarded until they complete the founder onboarding wizard
    const token = jwt.sign(
      { sub: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name || 'Founder',
        role: newUser.role as UserRole,
        emailVerified: false,
        mustChangePassword: false
      },
      onboarded: false,
      startup: null,
      emailVerified: false,
      verificationUrl: process.env.NODE_ENV !== 'production' ? verificationUrl : undefined
    });
  } catch (err: any) {
    console.error('[Auth API] Signup error:', err.message);
    res.status(500).json({ error: `Registration failed: ${err.message}` });
  }
});

// POST signin/login existing user
router.post('/auth/signin', authRateLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    let user: any = null;
    if (isDbAvailable && prisma) {
      try {
        const rows: any[] = await safeDbQuery(() => prisma.$queryRawUnsafe(
          'SELECT id, email, name, role, "passwordHash", "emailVerified", "mustChangePassword" FROM "User" WHERE email = $1 LIMIT 1',
          cleanEmail
        ));
        if (rows && rows.length > 0) {
          user = rows[0];
        } else {
          user = await safeDbQuery(() => prisma.user.findUnique({
            where: { email: cleanEmail }
          }));
        }
      } catch (dbErr: any) {
        console.warn('[Auth API] Database query failed, checking memory:', dbErr.message);
      }
    }

    if (!user) {
      user = users.find(u => u.email.toLowerCase() === cleanEmail);
    }

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    if (user.passwordHash) {
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        res.status(401).json({ error: 'Invalid email or password.' });
        return;
      }
    } else {
      // If legacy or demo account without password, upgrade password
      const newHash = await bcrypt.hash(password, 10);
      user.passwordHash = newHash;
      if (isDbAvailable && prisma) {
        await safeDbQuery(() => (prisma as any).user.update({
          where: { id: user.id },
          data: { passwordHash: newHash } as any
        })).catch(() => {});
      }
    }

    // Fast-path check if user already has an onboarded startup workspace
    let userStartup: any = null;
    let isOnboarded = false;
    if (isDbAvailable && prisma) {
      try {
        let startup = await safeDbQuery(() => prisma.startup.findFirst({
          where: { ownerId: user.id }
        }));
        if (!startup) {
          const mem: any = await safeDbQuery(() => (prisma as any).membership.findFirst({
            where: { userId: user.id, status: 'ACTIVE' },
            select: { startupId: true }
          }));
          if (mem?.startupId) {
            startup = await safeDbQuery(() => prisma.startup.findUnique({
              where: { id: mem.startupId }
            }));
          }
        }
        if (startup && startup.name) {
          isOnboarded = true;
          userStartup = {
            id: startup.id,
            name: startup.name,
            industry: startup.industry,
            description: startup.description,
            fundingStage: startup.fundingStage,
            cashBalance: startup.cashBalance,
            burnRate: startup.burnRate,
            runwayMonths: startup.burnRate > 0 ? parseFloat((startup.cashBalance / startup.burnRate).toFixed(1)) : 999,
            healthScore: startup.healthScore || 80,
            metrics: {
              velocity: 85,
              financialHealth: 90,
              legalCompliance: 95,
              growthRate: 45,
              operationsEfficiency: 88,
            },
            onboarded: true
          };
        }
      } catch (err: any) {
        console.warn('[Auth API] Error checking startup during signin:', err.message);
      }
    }

    const token = jwt.sign(
      { sub: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || 'Founder',
        role: user.role as UserRole,
        emailVerified: Boolean(user.emailVerified),
        mustChangePassword: Boolean(user.mustChangePassword)
      },
      onboarded: isOnboarded,
      startup: userStartup,
      emailVerified: Boolean(user.emailVerified),
      mustChangePassword: Boolean(user.mustChangePassword)
    });
  } catch (err: any) {
    console.error('[Auth API] Signin error:', err.message);
    res.status(500).json({ error: `Authentication failed: ${err.message}` });
  }
});

// ALL /api/auth/verify-email (Supports both GET token from link and POST JSON body)
router.all('/auth/verify-email', authRateLimiter, async (req, res) => {
  const token = (req.query?.token as string) || (req.body?.token as string);
  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: 'A valid verification token is required.' });
    return;
  }

  const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

  try {
    let user: any = null;
    if (isDbAvailable && prisma) {
      try {
        const rows: any[] = await safeDbQuery(() => prisma.$queryRawUnsafe(
          'SELECT id, email, name, role, "emailVerified", "mustChangePassword" FROM "User" WHERE "verificationToken" = $1 AND "verificationExpires" >= NOW() LIMIT 1',
          tokenHash
        ));
        if (rows && rows.length > 0) {
          user = rows[0];
        }
      } catch (err: any) {
        console.warn('[Auth API] verify-email raw query warning:', err.message);
      }
    }

    if (!user) {
      user = users.find(u => (u as any).verificationToken === tokenHash && (u as any).verificationExpires >= new Date());
    }

    if (!user) {
      res.status(400).json({ error: 'Invalid or expired verification token. Please request a new verification email.' });
      return;
    }

    if (isDbAvailable && prisma) {
      await safeDbQuery(() => prisma.$executeRawUnsafe(
        'UPDATE "User" SET "emailVerified" = true, "verificationToken" = NULL, "verificationExpires" = NULL WHERE id = $1',
        user.id
      )).catch(() => {});
    }
    user.emailVerified = true;
    (user as any).verificationToken = null;
    (user as any).verificationExpires = null;

    const sessionToken = jwt.sign(
      { sub: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Email address successfully verified.',
      token: sessionToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: true,
        mustChangePassword: Boolean(user.mustChangePassword)
      }
    });
  } catch (err: any) {
    console.error('[Auth API] Email verification error:', err.message);
    res.status(500).json({ error: 'Email verification failed: ' + err.message });
  }
});

// POST /api/auth/resend-verification
router.post('/auth/resend-verification', authRateLimiter, async (req, res) => {
  const { email } = req.body || {};
  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Email address is required.' });
    return;
  }
  const cleanEmail = email.trim().toLowerCase();

  try {
    let user: any = null;
    if (isDbAvailable && prisma) {
      user = await safeDbQuery(() => prisma.user.findUnique({ where: { email: cleanEmail } }));
    }
    if (!user) {
      user = users.find(u => u.email.toLowerCase() === cleanEmail);
    }

    if (user && !user.emailVerified) {
      const rawVerificationToken = crypto.randomBytes(32).toString('hex');
      const verificationTokenHash = crypto.createHash('sha256').update(rawVerificationToken).digest('hex');
      const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      if (isDbAvailable && prisma) {
        await safeDbQuery(() => prisma.$executeRawUnsafe(
          'UPDATE "User" SET "verificationToken" = $1, "verificationExpires" = $2 WHERE id = $3',
          verificationTokenHash,
          verificationExpires,
          user.id
        )).catch(() => {});
      }
      (user as any).verificationToken = verificationTokenHash;
      (user as any).verificationExpires = verificationExpires;

      const appUrl = (process.env.APP_URL || process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
      const verificationUrl = `${appUrl}/verify-email?token=${rawVerificationToken}`;
      sendVerificationEmail({
        to: cleanEmail,
        name: user.name || 'Founder',
        verificationUrl,
        expiresAt: verificationExpires
      }).catch(() => {});
    }

    res.json({
      success: true,
      message: 'If an unverified account exists for this address, a verification email has been dispatched.'
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to resend verification email: ' + err.message });
  }
});

// POST /api/auth/forgot-password
router.post('/auth/forgot-password', authRateLimiter, async (req, res) => {
  const { email } = req.body || {};
  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'A valid email address is required.' });
    return;
  }
  const cleanEmail = email.trim().toLowerCase();

  try {
    let user: any = null;
    if (isDbAvailable && prisma) {
      user = await safeDbQuery(() => prisma.user.findUnique({ where: { email: cleanEmail } }));
    }
    if (!user) {
      user = users.find(u => u.email.toLowerCase() === cleanEmail);
    }

    if (user) {
      const rawResetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenHash = crypto.createHash('sha256').update(rawResetToken).digest('hex');
      const resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      if (isDbAvailable && prisma) {
        await safeDbQuery(() => prisma.$executeRawUnsafe(
          'UPDATE "User" SET "resetPasswordToken" = $1, "resetPasswordExpires" = $2 WHERE id = $3',
          resetTokenHash,
          resetPasswordExpires,
          user.id
        )).catch(() => {});
      }
      (user as any).resetPasswordToken = resetTokenHash;
      (user as any).resetPasswordExpires = resetPasswordExpires;

      const appUrl = (process.env.APP_URL || process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
      const resetUrl = `${appUrl}/reset-password?token=${rawResetToken}`;
      sendPasswordResetEmail({
        to: cleanEmail,
        name: user.name || 'User',
        resetUrl,
        expiresAt: resetPasswordExpires
      }).catch(err => console.warn('[Auth API] Password reset email warning:', err?.message));
    }

    res.json({
      success: true,
      message: 'If an account exists for this email address, password recovery instructions have been sent.'
    });
  } catch (err: any) {
    console.error('[Auth API] Forgot password error:', err.message);
    res.status(500).json({ error: 'Failed to initiate password reset: ' + err.message });
  }
});

// POST /api/auth/reset-password
router.post('/auth/reset-password', authRateLimiter, async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: 'Reset token is required.' });
    return;
  }
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    return;
  }

  const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

  try {
    let user: any = null;
    if (isDbAvailable && prisma) {
      try {
        const rows: any[] = await safeDbQuery(() => prisma.$queryRawUnsafe(
          'SELECT id, email, name, role, "emailVerified", "mustChangePassword" FROM "User" WHERE "resetPasswordToken" = $1 AND "resetPasswordExpires" >= NOW() LIMIT 1',
          tokenHash
        ));
        if (rows && rows.length > 0) {
          user = rows[0];
        }
      } catch (err: any) {
        console.warn('[Auth API] reset-password raw query warning:', err.message);
      }
    }
    if (!user) {
      user = users.find(u => (u as any).resetPasswordToken === tokenHash && (u as any).resetPasswordExpires >= new Date());
    }

    if (!user) {
      res.status(400).json({ error: 'Invalid or expired password reset link. Please request a new one.' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    if (isDbAvailable && prisma) {
      await safeDbQuery(() => prisma.$executeRawUnsafe(
        'UPDATE "User" SET "passwordHash" = $1, "resetPasswordToken" = NULL, "resetPasswordExpires" = NULL, "mustChangePassword" = false WHERE id = $2',
        passwordHash,
        user.id
      )).catch(() => {});
    }
    user.passwordHash = passwordHash;
    (user as any).resetPasswordToken = null;
    (user as any).resetPasswordExpires = null;
    user.mustChangePassword = false;

    const sessionToken = jwt.sign(
      { sub: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Password has been reset successfully. You are now signed in.',
      token: sessionToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: Boolean(user.emailVerified),
        mustChangePassword: false
      }
    });
  } catch (err: any) {
    console.error('[Auth API] Reset password error:', err.message);
    res.status(500).json({ error: 'Failed to reset password: ' + err.message });
  }
});

// POST /api/auth/change-password (Authenticated: for forced password change or voluntary update)
router.post('/auth/change-password', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    return;
  }

  try {
    let user: any = null;
    if (isDbAvailable && prisma) {
      user = await safeDbQuery(() => prisma.user.findUnique({ where: { id: userId } }));
    }
    if (!user) {
      user = users.find(u => u.id === userId);
    }
    if (!user) {
      res.status(404).json({ error: 'User account not found.' });
      return;
    }

    // If current user already has a password hash and currentPassword was provided, verify it
    if (user.passwordHash && currentPassword) {
      const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValid) {
        res.status(400).json({ error: 'Current password is incorrect.' });
        return;
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    if (isDbAvailable && prisma) {
      await safeDbQuery(() => prisma.$executeRawUnsafe(
        'UPDATE "User" SET "passwordHash" = $1, "mustChangePassword" = false WHERE id = $2',
        passwordHash,
        user.id
      )).catch(() => {});
    }
    user.passwordHash = passwordHash;
    user.mustChangePassword = false;

    const token = jwt.sign(
      { sub: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Password changed successfully.',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: Boolean(user.emailVerified),
        mustChangePassword: false
      }
    });
  } catch (err: any) {
    console.error('[Auth API] Change password error:', err.message);
    res.status(500).json({ error: 'Failed to change password: ' + err.message });
  }
});

// Isolated demo authentication session (Only allowed in non-production or when explicitly enabled)
router.all('/auth/demo', async (req, res) => {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_LOGIN !== 'true') {
    res.status(403).json({ error: 'Forbidden: Demo mode is strictly disabled in production.' });
    return;
  }

  const demoUser: User = {
    id: 'usr_founder_demo',
    email: 'founder@founder.os',
    name: 'Alex Rivera',
    role: 'Founder'
  };

  const token = jwt.sign(
    { sub: demoUser.id, email: demoUser.email, name: demoUser.name, role: demoUser.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  // Seed rich demo startup workspace into canonical context if not already present
  let canonical = await workspaceService.getCanonicalContext(demoUser.id);
  if (!canonical || !canonical.startup?.name) {
    try {
      canonical = await workspaceService.saveOnboardingData(demoUser.id, {
        founderName: 'Alex Rivera',
        founderRole: 'Founder & CEO',
        startupName: 'NovaTech',
        industry: 'Enterprise AI & Developer Platform',
        description: 'Autonomous developer infrastructure and multi-agent systems for enterprise microservices.',
        fundingStage: 'Seed',
        stage: 'Seed',
        targetIcp: 'Enterprise VPs of Engineering & Cloud Infrastructure Teams',
        primaryProduct: 'Autonomous Developer Infrastructure Platform',
        problem: 'Engineering teams waste 40% of sprint capacity manually auditing compliance and managing microservice pipelines instead of shipping revenue-generating features.',
        cashBalance: 7200000,
        monthlyBurn: 800000,
        timeline: '6 Weeks',
        goals: ['Launch enterprise product in 6 weeks with 5 pilot partners and unlock ₹25L ARR'],
        priorities: ['Enterprise Product Launch', 'Platform Engineering Capacity'],
        path: 'existing',
        teamSize: '8 (3 Core Developers)'
      });
    } catch (demoErr: any) {
      console.warn('[Demo Auth] Workspace seeding note:', demoErr.message);
    }
  }

  res.json({
    success: true,
    token,
    user: demoUser,
    onboarded: true,
    startup: {
      id: canonical?.startupId || 'startup_catalyst_demo',
      name: canonical?.startup?.name || 'NovaTech',
      industry: canonical?.startup?.industry || 'Enterprise AI & Developer Platform',
      description: canonical?.startup?.description || 'Autonomous developer infrastructure and multi-agent systems',
      fundingStage: canonical?.startup?.stage || 'Seed',
      stage: canonical?.startup?.stage || 'Seed',
      cashBalance: canonical?.financials?.cashBalance ?? 7200000,
      burnRate: canonical?.financials?.monthlyBurn ?? 800000,
      monthlyBurn: canonical?.financials?.monthlyBurn ?? 800000,
      runwayMonths: canonical?.financials?.runwayMonths ?? 9.0,
      healthScore: 82,
      metrics: {
        velocity: 86,
        financialHealth: 92,
        legalCompliance: 96,
        growthRate: 55,
        operationsEfficiency: 90
      },
      targetIcp: canonical?.business?.targetIcp || 'Enterprise Series A–C VP of Engineering & DevOps Directors',
      primaryProduct: canonical?.business?.primaryProduct || 'Autonomous Infrastructure Orchestration Engine',
      goals: canonical?.goals || ['Launch Enterprise Beta with 5 design partners and reach $20k MRR'],
      priorities: canonical?.priorities || ['Finding Customers / GTM'],
      onboarded: true
    }
  });
});

// GET current authenticated user profile
router.get('/auth/me', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  let fullUser: any = user;
  let userStartup: any = null;
  let isOnboarded = false;

  if (user?.id) {
    if (isDbAvailable && prisma) {
      try {
        const rows: any[] = await safeDbQuery(() => prisma.$queryRawUnsafe(
          'SELECT id, email, name, role, "emailVerified", "mustChangePassword" FROM "User" WHERE id = $1 LIMIT 1',
          user.id
        ));
        const dbUser: any = (rows && rows.length > 0) ? rows[0] : null;
        if (dbUser) {
          fullUser = {
            id: dbUser.id,
            email: dbUser.email,
            name: dbUser.name || user.name,
            role: (dbUser.role as UserRole) || user.role,
            emailVerified: Boolean(dbUser.emailVerified),
            mustChangePassword: Boolean(dbUser.mustChangePassword)
          };
        }
      } catch (err: any) {
        console.warn('[Auth API] Error fetching user in /auth/me:', err.message);
      }
    } else {
      const memUser = users.find(u => u.id === user.id);
      if (memUser) {
        fullUser = {
          ...user,
          emailVerified: Boolean(memUser.emailVerified),
          mustChangePassword: Boolean(memUser.mustChangePassword)
        };
      }
    }
  }

  if (user?.id && isDbAvailable && prisma) {
    try {
      let startup = await safeDbQuery(() => prisma.startup.findFirst({
        where: { ownerId: user.id }
      }));
      if (!startup) {
        const mem: any = await safeDbQuery(() => (prisma as any).membership.findFirst({
          where: { userId: user.id, status: 'ACTIVE' },
          select: { startupId: true }
        }));
        if (mem?.startupId) {
          startup = await safeDbQuery(() => prisma.startup.findUnique({
            where: { id: mem.startupId }
          }));
        }
      }
      if (startup && startup.name) {
        isOnboarded = true;
        userStartup = {
          id: startup.id,
          name: startup.name,
          industry: startup.industry,
          description: startup.description,
          fundingStage: startup.fundingStage,
          cashBalance: startup.cashBalance,
          burnRate: startup.burnRate,
          runwayMonths: startup.burnRate > 0 ? parseFloat((startup.cashBalance / startup.burnRate).toFixed(1)) : 999,
          healthScore: startup.healthScore || 80,
          metrics: {
            velocity: 85,
            financialHealth: 90,
            legalCompliance: 95,
            growthRate: 45,
            operationsEfficiency: 88,
          },
          onboarded: true
        };
      }
    } catch (err: any) {
      console.warn('[Auth API] Error checking startup in /auth/me:', err.message);
    }
  }
  res.json({ user: fullUser, onboarded: isOnboarded, startup: userStartup });
});

// POST logout
router.post('/auth/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully.' });
});

// Mount specialty agent controllers
router.use('/', agentsRouter);

// ============================================================================
// DEVELOPMENT RESET ENDPOINT (Sections 1 & 2 of PROMPT.MD)
// ============================================================================
router.post('/dev/reset', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({ error: 'Development reset is strictly forbidden in production mode.' });
    return;
  }
  try {
    const result = await performDevReset();
    res.json(result);
  } catch (err: any) {
    console.error('[DevReset API] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// WORKSPACE & CANONICAL STARTUP CONTEXT (Sections 3, 4, 5, 8, 9, 34 & 35)
// ============================================================================

// GET startup onboarding status & progress (supports /startup/onboarding, /onboarding, and /onboarding/status)
router.get(['/startup/onboarding', '/onboarding', '/onboarding/status'], authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required for onboarding status.' });
    return;
  }

  try {
    const canonicalContext = await companyContextService.getContextForUser(userId);
    const hasCompany = !!(canonicalContext && canonicalContext.startupId && canonicalContext.identity?.name);

    if (!hasCompany) {
      res.json({
        onboarded: false,
        status: 'pending',
        message: 'Founder onboarding has not been completed for this account.',
        requiredFields: [
          'startupName',
          'industry',
          'description',
          'stage',
          'cashBalance',
          'monthlyBurn'
        ]
      });
      return;
    }

    const profile = {
      id: canonicalContext.startupId,
      name: canonicalContext.identity.name,
      industry: canonicalContext.identity.industry,
      description: canonicalContext.identity.description,
      fundingStage: canonicalContext.identity.stage,
      cashBalance: canonicalContext.financial.cashBalance,
      burnRate: canonicalContext.financial.monthlyBurn,
      runwayMonths: canonicalContext.financial.runwayMonths,
      healthScore: canonicalContext.financial.healthScore || 80,
      metrics: canonicalContext.financial.metrics,
      targetIcp: canonicalContext.business.targetIcp,
      primaryProduct: canonicalContext.business.primaryProduct,
      goals: canonicalContext.growth.goals,
      priorities: canonicalContext.growth.currentPriorities,
      onboarded: true
    };

    res.json({
      success: true,
      onboarded: true,
      status: 'completed',
      startup: profile,
      context: canonicalContext
    });
  } catch (err: any) {
    console.error('[Startup Onboarding API] GET error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve onboarding status: ' + err.message });
  }
});

// POST complete startup onboarding (supports both /startup/onboarding and /onboarding)
router.post(['/startup/onboarding', '/onboarding'], authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required for onboarding.' });
    return;
  }

  try {
    const canonicalContext = await workspaceService.saveOnboardingData(userId, req.body);
    const profile = {
      id: canonicalContext?.startupId,
      name: canonicalContext?.startup.name,
      industry: canonicalContext?.startup.industry,
      description: canonicalContext?.startup.description,
      fundingStage: canonicalContext?.startup.stage,
      cashBalance: canonicalContext?.financials.cashBalance,
      burnRate: canonicalContext?.financials.monthlyBurn,
      runwayMonths: canonicalContext?.financials.runwayMonths,
      healthScore: startupProfile.healthScore || 80,
      metrics: startupProfile.metrics,
      targetIcp: canonicalContext?.business.targetIcp,
      primaryProduct: canonicalContext?.business.primaryProduct,
      goals: canonicalContext?.goals,
      priorities: canonicalContext?.priorities,
      onboarded: true
    };
    res.json({ success: true, context: canonicalContext, startup: profile });
  } catch (err: any) {
    console.error('[Startup Onboarding API] Error:', err.message);
    res.status(500).json({ error: `Onboarding failed: ${err.message}` });
  }
});

// POST initialize a blank workspace with 8 default agents
router.post('/startup/initialize', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  try {
    const defaultData = {
      startupName: req.body?.startupName || 'New Startup',
      industry: req.body?.industry || 'Technology',
      description: req.body?.description || 'Early-stage venture',
      cashBalance: req.body?.cashBalance || 0,
      monthlyBurn: req.body?.monthlyBurn || 0,
    };
    const canonicalContext = await workspaceService.saveOnboardingData(userId, defaultData);
    res.json({ success: true, context: canonicalContext });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET canonical startup context (Single Source of Truth - P1 Task 4)
const handleGetCompanyContext = async (req: AuthenticatedRequest, res: any) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const requestedStartupId = (req.query.startupId || req.query.companyId) as string | undefined;
  const requestedRole = req.query.role as string | undefined;

  try {
    let context;
    if (requestedStartupId) {
      context = await companyContextService.getContextForStartup(requestedStartupId, userId);
      if (!context) {
        // Verify if startup exists under another owner to return 403 Forbidden
        const exists = await safeDbQuery(() => prisma.startup.findUnique({ where: { id: requestedStartupId } }));
        if (exists && exists.ownerId !== userId) {
          res.status(403).json({ error: 'Access denied: You do not have permission to view this company context.' });
          return;
        }
        res.status(404).json({ error: 'Startup not found.', onboarded: false });
        return;
      }
    } else {
      context = await companyContextService.getContextForUser(userId);
      if (!context) {
        res.status(404).json({ error: 'No startup workspace found for authenticated user.', onboarded: false });
        return;
      }
    }

    const membership = await resolveMembership(userId);
    const callerRole = (membership?.role || req.user?.role || 'FOUNDER').toUpperCase();
    const isPrivileged = callerRole === 'FOUNDER' || callerRole === 'ADMIN';

    if (!isPrivileged) {
      // Phase C3: Strictly role-scoped company context (Zero cross-department leaks)
      const agentScopedContext = companyContextService.getAgentScopedContext(context, callerRole);
      const workspaceContext = await getRoleScopedContext({ userId });

      return res.json({
        onboarded: true,
        startupId: context.metadata?.startupId || membership?.startupId,
        identity: {
          name: context.identity?.name,
          industry: context.identity?.industry,
          stage: context.identity?.stage,
          description: context.identity?.description
        },
        role: callerRole,
        department: workspaceContext.department,
        agentScopedContext,
        accessibleDocuments: workspaceContext.accessibleDocuments,
        // Role-specific sections according to C3:
        ...(callerRole === 'HR' ? {
          people: {
            teamSize: context.operations?.teamSize || '8',
            biggestChallenge: context.operations?.biggestChallenge || 'Engineering hiring velocity',
            strategicGoals: context.goals?.strategicGoals || []
          },
          hiring: {
            openRequisitions: ['Senior Backend Engineer', 'Staff React Engineer', 'Infrastructure Lead'],
            pipelineStages: ['Recruiter Screen', 'Technical Pairing', 'System Architecture', 'Founder Review'],
            levelingBand: 'IC4 - IC5 Standard'
          },
          policies: workspaceContext.accessibleDocuments.filter(d =>
            d.name.toLowerCase().includes('hiring') || d.name.toLowerCase().includes('handbook')
          )
        } : callerRole === 'FINANCE' ? {
          finance: {
            cashBalance: context.financial?.cashBalance,
            monthlyBurn: context.financial?.monthlyBurn,
            runwayMonths: context.financial?.runwayMonths,
            healthScore: context.financial?.healthScore
          },
          budgets: {
            departmentAllocations: [
              { department: 'Engineering / R&D', allocation: '55%', monthly: '$10,175' },
              { department: 'Growth & Marketing', allocation: '25%', monthly: '$4,625' },
              { department: 'General & Admin', allocation: '20%', monthly: '$3,700' }
            ],
            disbursementThreshold: '$10,000 dual sign-off'
          },
          documents: workspaceContext.accessibleDocuments
        } : callerRole === 'GROWTH' ? {
          growth: {
            targetIcp: context.business?.targetIcp,
            primaryProduct: context.business?.primaryProduct,
            problemSolved: context.business?.problem,
            growthPriorities: context.growth?.currentPriorities,
            targetTimeline: context.growth?.targetTimeline
          },
          campaigns: [
            { name: 'Developer Ecosystem Inbound', channel: 'Content & Open-Source', status: 'Active' },
            { name: 'Founder Direct Outbound', channel: 'Cold Email & LinkedIn', status: 'In Review' },
            { name: 'Product-Led Onboarding Loop', channel: 'In-App Viral Invites', status: 'Active' }
          ],
          documents: workspaceContext.accessibleDocuments
        } : callerRole === 'OPERATIONS' ? {
          operations: {
            teamSize: context.operations?.teamSize || '8',
            workflowVelocity: '88% SLA Adherence',
            efficiencyScore: context.financial?.metrics?.operationsEfficiency || 80
          },
          processes: [
            { name: 'Infrastructure Deployment & CI/CD SLA', version: '2.4', owner: 'Helix' },
            { name: 'Incident Response & P0 Escalation Matrix', version: '1.2', owner: 'Operations' },
            { name: 'Team Capacity & Sprint Velocity Modeling', version: '3.0', owner: 'Helix' }
          ],
          documents: workspaceContext.accessibleDocuments
        } : {
          documents: workspaceContext.accessibleDocuments
        })
      });
    }

    const responsePayload: any = {
      ...context,
      onboarded: true
    };

    if (requestedRole) {
      responsePayload.agentScopedContext = companyContextService.getAgentScopedContext(context, requestedRole);
    }

    res.json(responsePayload);
  } catch (err: any) {
    res.status(500).json({ error: err.message, onboarded: false });
  }
};

router.get('/startup/context', authenticateJWT, handleGetCompanyContext);
router.get('/company/context', authenticateJWT, handleGetCompanyContext);

// GET startup profile (Scoping strictly per authenticated user workspace)
router.get('/startup', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  try {
    const canonical = await workspaceService.getCanonicalContext(userId);
    if (canonical && canonical.startup && canonical.startup.name && canonical.startup.name.trim() !== '') {
      const financialSection = canonical.financials || (canonical as any).financial || {};
      const cash = financialSection.cashBalance ?? 245000;
      const burn = financialSection.monthlyBurn ?? 18500;
      const runway = financialSection.runwayMonths ?? (burn > 0 ? cash / burn : 12);
      return res.json({
        id: canonical.startupId,
        name: canonical.startup.name,
        industry: canonical.startup.industry,
        description: canonical.startup.description,
        fundingStage: canonical.startup.stage,
        stage: canonical.startup.stage,
        teamSize: canonical.operations?.teamSize || '8',
        cashBalance: cash,
        burnRate: burn,
        monthlyBurn: burn,
        runwayMonths: runway,
        healthScore: financialSection.healthScore || 82,
        metrics: financialSection.metrics || {
          velocity: 78,
          financialHealth: 84,
          legalCompliance: 92,
          growthRate: 65,
          operationsEfficiency: 80,
        },
        targetIcp: canonical.business?.targetIcp,
        primaryProduct: canonical.business?.primaryProduct,
        goals: canonical.goals || canonical.growth?.goals,
        priorities: canonical.priorities || canonical.growth?.currentPriorities,
        onboarded: true
      });
    }
  } catch (dbErr: any) {
    console.warn('[Startup API] Database query warning:', dbErr.message);
  }

  // Graceful fallback to seeded company state (NovaTech) ONLY for demo account
  const isDemoUser = userId === 'usr_founder_demo' || (req.query.demo === 'true');
  if (isDemoUser && startupProfile && startupProfile.name && startupProfile.name.trim() !== '') {
    return res.json({
      id: 'startup_catalyst_demo',
      name: startupProfile.name,
      industry: startupProfile.industry,
      description: startupProfile.description,
      fundingStage: startupProfile.fundingStage,
      stage: startupProfile.fundingStage,
      teamSize: startupProfile.teamSize || '8',
      cashBalance: startupProfile.cashBalance,
      burnRate: startupProfile.burnRate,
      monthlyBurn: startupProfile.burnRate,
      runwayMonths: startupProfile.runwayMonths,
      healthScore: startupProfile.healthScore || 82,
      metrics: startupProfile.metrics || {
        velocity: 78,
        financialHealth: 84,
        legalCompliance: 92,
        growthRate: 65,
        operationsEfficiency: 80,
      },
      targetIcp: 'Enterprise Series A–C Engineering Leaders & SaaS Buyers',
      primaryProduct: 'Autonomous Developer Infrastructure for Enterprise Microservices',
      goals: ['Launch enterprise product in 6 weeks with 5 design partners and reach ₹25L MRR'],
      priorities: ['Enterprise Product Launch', 'Engineering Capacity Bottlenecks', 'Runway Preservation'],
      onboarded: true
    });
  }

  // Not onboarded yet
  res.json({
    name: '',
    industry: '',
    description: '',
    fundingStage: 'Pre-Seed',
    cashBalance: 0,
    burnRate: 0,
    runwayMonths: 0,
    healthScore: 0,
    metrics: {
      velocity: 0,
      financialHealth: 0,
      legalCompliance: 0,
      growthRate: 0,
      operationsEfficiency: 0,
    },
    onboarded: false
  });
});

// POST update startup profile
router.post('/startup', authenticateJWT, requireActiveMembership, requirePermission('startup:write'), async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const { name, industry, description, fundingStage, cashBalance, burnRate, targetIcp, primaryProduct } = req.body;
  try {
    const canonical = await workspaceService.saveOnboardingData(userId, {
      startupName: name || 'Startup',
      industry: industry || 'Technology',
      description: description || '',
      fundingStage,
      targetIcp,
      primaryProduct,
      cashBalance: cashBalance !== undefined ? cashBalance : 0,
      monthlyBurn: burnRate !== undefined ? burnRate : 0,
    });
    
    res.json({
      id: canonical?.startupId,
      name: canonical?.startup.name,
      industry: canonical?.startup.industry,
      description: canonical?.startup.description,
      fundingStage: canonical?.startup.stage,
      cashBalance: canonical?.financials.cashBalance,
      burnRate: canonical?.financials.monthlyBurn,
      runwayMonths: canonical?.financials.runwayMonths,
      healthScore: startupProfile.healthScore || 80,
      metrics: startupProfile.metrics,
      targetIcp: canonical?.business.targetIcp,
      primaryProduct: canonical?.business.primaryProduct,
      goals: canonical?.goals,
      priorities: canonical?.priorities,
      onboarded: true
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET agents list (Live status from user's executive agents in DB)
router.get('/agents', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (userId && isDbAvailable && prisma) {
    try {
      const canonical = await workspaceService.getCanonicalContext(userId);
      if (canonical && canonical.agents.length > 0) {
        const mapped = canonical.agents.map(da => {
          const roleDef = DEFAULT_EXECUTIVE_ROLES.find(r => r.role.toLowerCase() === da.role.toLowerCase());
          return {
            id: da.role.toLowerCase(),
            name: da.name,
            role: da.role as any,
            avatar: roleDef?.avatar || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
            description: roleDef?.description || `${da.role} Executive`,
            status: da.status as any,
            currentTask: da.currentTask || undefined,
            keyMetric: da.role === 'CEO' ? 'Company Velocity' : da.role === 'Finance' ? 'Financial Health' : da.role === 'Talent' ? 'Hiring Velocity' : da.role === 'Growth' ? 'Growth Rate' : da.role === 'Legal' ? 'Compliance Index' : da.role === 'Operations' ? 'Ops Efficiency' : da.role === 'Investment' ? 'Capital Readiness' : 'Audit Accuracy',
            metricValue: 'Active',
            color: da.role === 'CEO' ? 'indigo' : da.role === 'Finance' ? 'emerald' : da.role === 'Talent' ? 'pink' : da.role === 'Growth' ? 'amber' : da.role === 'Legal' ? 'rose' : da.role === 'Operations' ? 'teal' : da.role === 'Investment' ? 'purple' : 'blue'
          };
        });
        return res.json(mapped);
      }
    } catch (e: any) {
      console.warn('[Agents API] DB fetch warning:', e.message);
    }
  }

  res.json(agentsList);
});

// ============================================================================
// OPERATIONAL NOTIFICATIONS (Sections 21, 22 & 23 of PROMPT.MD)
// ============================================================================

// GET notifications for authenticated user (scoped by company membership & audience)
router.get('/notifications', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId || !prisma) {
    res.json([]);
    return;
  }

  try {
    const notifs = await listNotificationsForUser(userId);
    res.json(notifs);
  } catch (err: any) {
    console.error('[Notifications API] Fetch error:', err.message);
    res.json([]);
  }
});

// POST mark notification as read
router.post('/notifications/:id/read', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  try {
    const success = await markNotificationRead(id);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST mark all notifications as read for current user workspace
router.post('/notifications/read-all', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.json({ success: true, count: 0 });
    return;
  }
  try {
    const count = await markAllNotificationsRead(userId);
    res.json({ success: true, count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST check deadlines and dispatch upcoming reminders
router.post('/notifications/check-deadlines', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.json({ remindedCount: 0 });
    return;
  }
  try {
    const membership = await resolveMembership(userId);
    const result = await checkAndDispatchDeadlineReminders(membership?.startupId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// MEMBERSHIP + INVITATIONS (P1 Task 8)
// Membership is the authoritative User <-> Startup relationship.
// Every route below resolves the caller's company through membershipService and
// scopes all queries to it, so cross-company access is structurally impossible.
// ============================================================================

/**
 * Resolves the company the caller acts within. Returns null and writes the
 * response when there is none, so callers can simply return.
 */
async function resolveCallerStartupId(
  req: AuthenticatedRequest,
  res: any
): Promise<string | null> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required.' });
    return null;
  }
  const startupId = await getActiveStartupId(userId);
  if (!startupId) {
    if (!isDbAvailable || isDemoUserId(userId)) {
      return 'startup_novatech_demo';
    }
    res.status(404).json({ error: 'No company found for this account. Complete onboarding first.' });
    return null;
  }
  return startupId;
}

function sendInvitationError(res: any, err: any) {
  if (err instanceof InvitationError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }
  console.error('[Invitations API] Unexpected error:', err?.message);
  res.status(500).json({ error: 'The invitation could not be processed.' });
}

/** Raw tokens and URLs are development aids only. */
const exposeInvitationUrl = process.env.NODE_ENV !== 'production';

// GET the caller's own membership (which company, which role).
router.get('/membership/me', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const membership = await resolveMembership(userId);
  if (!membership) {
    res.json({ membership: null, role: normalizeRole(req.user?.role), startupId: null });
    return;
  }
  res.json({
    membership: {
      startupId: membership.startupId,
      role: membership.role,
      status: membership.status,
      isOwner: membership.isOwner,
      viaOwnership: membership.viaOwnership
    },
    role: membership.role,
    startupId: membership.startupId
  });
});

// GET all members of the caller's company (accounts, not roster entries).
router.get('/memberships', authenticateJWT, requireActiveMembership, requirePermission('people:read'), async (req: AuthenticatedRequest, res) => {
  const startupId = await resolveCallerStartupId(req, res);
  if (!startupId) return;

  const rows = await listMemberships(startupId);
  // P1 Task 9: expose who the owner is and who the caller is, so the People page
  // can hide the Remove action for the protected owner membership. The backend
  // still rejects an owner removal regardless of what the UI shows.
  const startup = isDbAvailable && prisma
    ? await prisma.startup.findUnique({ where: { id: startupId }, select: { ownerId: true } })
    : null;
  res.json(rows.map((m: any) => ({
    id: m.id,
    userId: m.userId,
    fullName: m.user?.name || m.user?.email || 'Team Member',
    email: m.user?.email || '',
    role: m.role,
    status: m.status,
    joinedAt: m.createdAt,
    isOwner: Boolean(startup && startup.ownerId === m.userId),
    isSelf: m.userId === req.user?.id
  })));
});

// DELETE revoke a member's access to the caller's company (P1 Task 9).
// Suspends the Membership; never deletes the User account. The company owner is
// protected. P1 Task 10: requires 'people:access', NOT 'people:write' — revoking
// account access is a different responsibility from managing roster data, so HR
// (which holds people:write) is intentionally forbidden here. The target is resolved inside the caller's own company, so a
// cross-company membership id reads as 404.
router.delete('/memberships/:id', authenticateJWT, requireActiveMembership, requirePermission('people:access'), async (req: AuthenticatedRequest, res) => {
  const startupId = await resolveCallerStartupId(req, res);
  if (!startupId) return;

  try {
    const removed = await removeMembership(startupId, req.params.id, req.user!.id);

    // Audit trail, consistent with how adding a team member is recorded.
    if (isDbAvailable && prisma) {
      await prisma.timelineItem.create({
        data: {
          title: `Access Revoked: ${removed.fullName}`,
          content: `${removed.fullName} (${removed.role}) no longer has access to the company workspace.`,
          type: 'team',
          startupId
        }
      }).catch(() => {});
    }

    res.json({
      success: true,
      id: removed.id,
      userId: removed.userId,
      email: removed.email,
      fullName: removed.fullName,
      role: removed.role,
      status: removed.status,
      // The User account is deliberately preserved.
      userAccountRetained: true
    });
  } catch (err: any) {
    if (err instanceof MembershipError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    console.error('[Memberships API] Removal error:', err?.message);
    res.status(500).json({ error: 'The member could not be removed.' });
  }
});

// GET invitations for the caller's company.
router.get('/invitations', authenticateJWT, requireActiveMembership, requirePermission('people:read'), async (req: AuthenticatedRequest, res) => {
  const startupId = await resolveCallerStartupId(req, res);
  if (!startupId) return;
  try {
    res.json(await listInvitations(startupId));
  } catch (err) {
    sendInvitationError(res, err);
  }
});

// POST create an invitation. Requires 'people:access' (Founder/Admin) — P1 Task 10.
router.post('/invitations', authenticateJWT, requireActiveMembership, requirePermission('people:access'), async (req: AuthenticatedRequest, res) => {
  const startupId = await resolveCallerStartupId(req, res);
  if (!startupId) return;

  try {
    const created = await createInvitation({
      startupId,
      email: req.body?.email,
      role: req.body?.role,
      department: req.body?.department,
      invitedById: req.user!.id
    });

    res.status(201).json({
      ...created.invitation,
      token: created.rawToken,
      invitationUrl: created.invitationUrl,
      emailDelivered: created.delivery.delivered,
      deliveryChannel: created.delivery.channel
    });
  } catch (err) {
    sendInvitationError(res, err);
  }
});

// POST resend an invitation (supersedes the previous token).
router.post('/invitations/:id/resend', authenticateJWT, requireActiveMembership, requirePermission('people:access'), async (req: AuthenticatedRequest, res) => {
  const startupId = await resolveCallerStartupId(req, res);
  if (!startupId) return;

  try {
    const created = await resendInvitation(startupId, req.params.id, req.user!.id);
    res.json({
      ...created.invitation,
      emailDelivered: created.delivery.delivered,
      deliveryChannel: created.delivery.channel,
      ...(exposeInvitationUrl ? { invitationUrl: created.invitationUrl } : {})
    });
  } catch (err) {
    sendInvitationError(res, err);
  }
});

// DELETE revoke a pending invitation.
router.delete('/invitations/:id', authenticateJWT, requireActiveMembership, requirePermission('people:access'), async (req: AuthenticatedRequest, res) => {
  const startupId = await resolveCallerStartupId(req, res);
  if (!startupId) return;

  try {
    res.json(await revokeInvitation(startupId, req.params.id));
  } catch (err) {
    sendInvitationError(res, err);
  }
});

// GET inspect an invitation by raw token. Public: the invitee is not signed in
// yet. The token itself is the credential; no company data beyond the name is
// returned, and the token hash is never exposed.
router.get('/invitations/accept/:token', authRateLimiter, async (req, res) => {
  try {
    res.json(await peekInvitation(req.params.token));
  } catch (err) {
    sendInvitationError(res, err);
  }
});

// POST accept an invitation. Public by design, because a brand-new invitee has
// no account; the raw token is the authorization. A signed-in caller's identity
// is checked against the invitation email inside acceptInvitation.
router.post('/invitations/accept', authRateLimiter, async (req: AuthenticatedRequest, res) => {
  const { token, password, name } = req.body || {};

  // If a valid Bearer token is present, bind acceptance to that account.
  let authenticatedUserId: string | undefined;
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    try {
      const decoded: any = jwt.verify(authHeader.slice(7).trim(), JWT_SECRET);
      if (decoded?.sub) authenticatedUserId = decoded.sub;
    } catch {
      // An unusable token is treated as anonymous rather than fatal.
    }
  }

  try {
    const result = await acceptInvitation({
      rawToken: token,
      password,
      name,
      authenticatedUserId,
      hashPassword: (plain: string) => bcrypt.hash(plain, 10)
    });

    // Issue a session with the existing auth architecture (same JWT contract).
    const user = await prisma.user.findUnique({ where: { id: result.userId } });
    const sessionToken = jwt.sign(
      {
        sub: result.userId,
        email: user?.email,
        name: user?.name,
        role: result.role
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      token: sessionToken,
      user: {
        id: result.userId,
        email: user?.email,
        name: user?.name || 'Team Member',
        role: result.role,
        emailVerified: Boolean((user as any)?.emailVerified),
        mustChangePassword: Boolean((user as any)?.mustChangePassword)
      },
      membership: {
        startupId: result.startupId,
        role: result.role,
        status: 'ACTIVE'
      },
      companyName: result.companyName,
      createdUser: result.createdUser,
      onboarded: true
    });
  } catch (err) {
    sendInvitationError(res, err);
  }
});

// ============================================================================
// SMTP & FOUNDER EMAIL DISPATCH
// Allows verified founders/admins to check SMTP health, verify live Gmail transport,
// and dispatch emails to any designated recipient address ("respected mail").
// ============================================================================

// GET /api/smtp/status
router.get('/smtp/status', authenticateJWT, requireActiveMembership, async (req: AuthenticatedRequest, res) => {
  const isConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  res.json({
    configured: isConfigured,
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER ? process.env.SMTP_USER.replace(/(.{3}).*(@.*)/, '$1***$2') : null,
    from: process.env.SMTP_FROM || process.env.SMTP_USER || null
  });
});

// POST /api/smtp/verify - live connection handshake
router.post('/smtp/verify', authenticateJWT, requireActiveMembership, requirePermission('people:access'), async (req: AuthenticatedRequest, res) => {
  try {
    const { verifySmtpConnection } = await import('../services/invitationMailer');
    const result = await verifySmtpConnection();
    if (!result.ok) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err?.message || 'SMTP verification error.' });
  }
});

// POST /api/smtp/send - dispatch email from founder to designated recipient
router.post('/smtp/send', authenticateJWT, requireActiveMembership, requirePermission('people:access'), async (req: AuthenticatedRequest, res) => {
  const { to, subject, text, html } = req.body || {};
  if (!to || !to.includes('@')) {
    return res.status(400).json({ error: 'A valid recipient email address (to) is required.' });
  }
  if (!subject) {
    return res.status(400).json({ error: 'An email subject is required.' });
  }

  try {
    const startupId = await resolveCallerStartupId(req, res);
    if (!startupId) return;
    const { sendDirectEmail } = await import('../services/invitationMailer');
    
    const senderName = req.user?.name || 'CatalystOS Founder';
    const replyTo = req.user?.email || process.env.SMTP_FROM || process.env.SMTP_USER;

    const delivery = await sendDirectEmail({
      to,
      subject,
      text: text || '',
      html: html || undefined,
      senderName,
      replyTo
    });

    // Record audit event in founder activity log
    try {
      if (!startupId) return;
      const { activityLogService } = await import('../services/activityLogService');
      await activityLogService.logActivity({
          startupId,
          userId: req.user!.id,
          action: 'EMAIL_DISPATCHED',
          details: {
            recipient: to,
            subject,
            delivered: delivery.delivered,
            channel: delivery.channel,
            messageId: delivery.messageId
          }
        });
      } catch (logErr) {
        // Logging failure should not break delivery confirmation
      }

    return res.json({
      success: delivery.delivered,
      ...delivery
    });
  } catch (err: any) {
    console.error('[SMTP Send API] Error:', err.message);
    return res.status(500).json({ error: 'Failed to dispatch email: ' + (err.message || 'Unknown error') });
  }
});

// ============================================================================
// TASK DELEGATION (Phase A3)
// The council's decomposition is persisted as assignable Task rows. Listing is
// scoped to the caller's company AND their role: FOUNDER/ADMIN see the whole
// workload, an employee sees only their own department's tasks.
// ============================================================================

function sendTaskError(res: any, err: any) {
  if (err instanceof TaskDelegationError || err?.name === 'TaskDelegationError' || (typeof err?.status === 'number' && err?.code)) {
    res.status(err.status || 400).json({ error: err.message, code: err.code });
    return;
  }
  console.error('[Tasks API] Unexpected error:', err?.message || err);
  res.status(500).json({ error: 'The task could not be processed.' });
}

// GET the tasks the caller is allowed to see.
router.get('/tasks', authenticateJWT, requireActiveMembership, requirePermission('people:read'), async (req: AuthenticatedRequest, res) => {
  try {
    res.json(await listTasksForUser(req.user!.id));
  } catch (err) {
    sendTaskError(res, err);
  }
});

// GET a specific authorized task by id
router.get('/tasks/:id', authenticateJWT, requireActiveMembership, requirePermission('people:read'), async (req: AuthenticatedRequest, res) => {
  try {
    res.json(await getTaskByIdForUser(req.user!.id, req.params.id));
  } catch (err) {
    sendTaskError(res, err);
  }
});

// POST /api/tasks/decompose — Phase 2 & 9: Reliable task planning & decomposition with failure recovery
router.post('/tasks/decompose', authenticateJWT, requireActiveMembership, requirePermission('people:read'), async (req: AuthenticatedRequest, res) => {
  try {
    const result = await planParentTaskWithRecovery({
      userId: req.user!.id,
      input: req.body || {},
      parentTaskId: req.body?.parentTaskId,
      simulateFailure: req.body?.simulateFailure
    });

    if (!result.success) {
      return res.status(422).json({
        error: result.recovery?.errorMessage || 'Task planning failed to decompose initiative.',
        code: 'PLANNING_FAILED',
        recoverable: true,
        parentTaskId: result.parentTaskId,
        recovery: result.recovery
      });
    }

    res.json({
      ...result.preview,
      parentTaskId: result.parentTaskId,
      stage: result.currentStage
    });
  } catch (err) {
    sendTaskError(res, err);
  }
});

// POST /api/tasks/:id/retry-decomposition — Phase 9: Recover from planning failure and retry AI decomposition
router.post('/tasks/:id/retry-decomposition', authenticateJWT, requireActiveMembership, requirePermission('people:read'), async (req: AuthenticatedRequest, res) => {
  try {
    const result = await retryTaskPlanning(req.user!.id, req.params.id);
    if (!result.success) {
      return res.status(422).json({
        error: result.recovery?.errorMessage || 'Retry planning failed.',
        code: 'PLANNING_FAILED',
        recoverable: true,
        parentTaskId: result.parentTaskId,
        recovery: result.recovery
      });
    }
    res.json({
      ...result.preview,
      parentTaskId: result.parentTaskId,
      stage: result.currentStage
    });
  } catch (err) {
    sendTaskError(res, err);
  }
});

// POST /api/tasks/:id/retry-notification — Phase 9: Retry undelivered assignment notification
router.post('/tasks/:id/retry-notification', authenticateJWT, requireActiveMembership, requirePermission('people:read'), async (req: AuthenticatedRequest, res) => {
  try {
    const result = await retryTaskNotification(req.user!.id, req.params.id);
    res.json(result);
  } catch (err) {
    sendTaskError(res, err);
  }
});

// POST /api/tasks/create-decomposed — Phase 2 & 9: Approve & persist parent task plan and subtasks with resilient notifications
router.post('/tasks/create-decomposed', authenticateJWT, requireActiveMembership, requirePermission('people:read'), async (req: AuthenticatedRequest, res) => {
  try {
    const result = await persistAssignmentsWithResilientNotifications({
      userId: req.user!.id,
      parentTask: req.body?.parentTask,
      subtasks: req.body?.subtasks,
      simulateNotificationFailure: req.body?.simulateNotificationFailure
    });
    res.status(201).json(result);
  } catch (err) {
    sendTaskError(res, err);
  }
});

// PATCH a task's status and/or result. An employee advances their own work;
// approved/rejected are reserved for the founder approval loop.
router.patch('/tasks/:id', authenticateJWT, requireActiveMembership, requirePermission('people:read'), async (req: AuthenticatedRequest, res) => {
  try {
    if (req.body?.isAutomatedLlmOutput) {
      assertNonTerminalLlmOutput('PATCH /tasks/:id', req.body?.status);
    }

    const updated = await updateTaskForUser({
      userId: req.user!.id,
      taskId: req.params.id,
      status: req.body?.status,
      result: req.body?.result,
      founderFeedback: req.body?.founderFeedback,
      cancellationReason: req.body?.cancellationReason,
      submissionNotes: req.body?.submissionNotes
    });

    // Record activity in Founder Activity Ledger
    try {
      const membership = await resolveMembership(req.user!.id);
      if (!membership) throw new Error('No active membership; skipping activity log.');
      const action = req.body?.status === 'submitted' ? 'TASK_SUBMITTED' : 'STATUS_UPDATE';
      await activityLogService.logActivity({
        startupId: membership.startupId,
        userId: req.user!.id,
        actorRole: req.user?.role || 'EMPLOYEE',
        action,
        targetEntity: 'TASK',
        targetId: req.params.id,
        department: (updated as any)?.department,
        details: {
          taskId: req.params.id,
          status: req.body?.status,
          title: (updated as any)?.title
        }
      });
    } catch {}

    res.json(updated);
  } catch (err) {
    sendTaskError(res, err);
  }
});

// PATCH assign or claim a task (Phase B1).
// Founder/Admin can assign or unassign; employee can claim their department tasks.
router.patch('/tasks/:id/assign', authenticateJWT, requireActiveMembership, requirePermission('people:read'), async (req: AuthenticatedRequest, res) => {
  try {
    const updated = await assignTaskForUser({
      userId: req.user!.id,
      taskId: req.params.id,
      assigneeId: req.body?.assigneeId !== undefined ? req.body.assigneeId : req.body?.claim ? req.user!.id : undefined
    });

    // Record activity in Founder Activity Ledger
    try {
      const membership = await resolveMembership(req.user!.id);
      if (!membership) throw new Error('No active membership; skipping activity log.');
      await activityLogService.logActivity({
        startupId: membership.startupId,
        userId: req.user!.id,
        actorRole: req.user?.role || 'EMPLOYEE',
        action: 'TASK_CLAIMED',
        targetEntity: 'TASK',
        targetId: req.params.id,
        department: (updated as any)?.department,
        details: {
          taskId: req.params.id,
          assigneeId: req.body?.assigneeId || req.user!.id,
          title: (updated as any)?.title
        }
      });
    } catch {}

    res.json(updated);
  } catch (err) {
    sendTaskError(res, err);
  }
});

// GET the companion AI executive draft for a task (Phase B2).
router.get('/tasks/:id/draft', authenticateJWT, requireActiveMembership, requirePermission('people:read'), async (req: AuthenticatedRequest, res) => {
  try {
    res.json(await getAgentDraftForTask(req.user!.id, req.params.id));
  } catch (err) {
    sendTaskError(res, err);
  }
});

// POST interact with companion AI executive assistant on a task (Phase C5).
router.post('/tasks/:id/assistant', authenticateJWT, requireActiveMembership, requirePermission('people:read'), async (req: AuthenticatedRequest, res) => {
  try {
    const { question, currentDraft, proposedStatus } = req.body || {};
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'Question is required for AI assistance.' });
    }

    // Phase 9: Do not treat an LLM response as a completed assignment
    if (proposedStatus) {
      assertNonTerminalLlmOutput('POST /tasks/:id/assistant', proposedStatus);
    }

    res.json(await assistEmployeeOnTask({
      userId: req.user!.id,
      taskId: req.params.id,
      question,
      currentDraft
    }));
  } catch (err) {
    sendTaskError(res, err);
  }
});

// ============================================================================
// PHASE 5 & 6 — TASK SUPPORTING DOCUMENTS & AUDIT TRAIL
// ============================================================================

// POST /api/tasks/:id/documents — Phase 5: Upload permitted supporting documents
router.post('/tasks/:id/documents', authenticateJWT, requireActiveMembership, requirePermission('people:read'), async (req: AuthenticatedRequest, res) => {
  try {
    const taskId = req.params.id;
    const userId = req.user!.id;
    const { name, fileData, content, mimeType, type } = req.body || {};

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Document filename is required.', code: 'INVALID_FILENAME' });
    }

    // Sanitize filename to prevent directory traversal or malformed paths
    const sanitizedName = name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '');
    if (!sanitizedName) {
      return res.status(400).json({ error: 'Invalid document filename.', code: 'INVALID_FILENAME' });
    }

    // Validate file extension against permitted formats
    const ext = sanitizedName.split('.').pop()?.toLowerCase() || '';
    const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'doc', 'txt', 'csv', 'xlsx', 'xls', 'json', 'md', 'png', 'jpg', 'jpeg'];
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      return res.status(400).json({
        error: `Unsupported file format (.${ext}). Permitted formats: PDF, DOCX, TXT, CSV, JSON, MD, PNG, JPG.`,
        code: 'UNSUPPORTED_FILE_TYPE'
      });
    }

    // Verify task existence and upload authorization
    const authResult = await authorizeDocumentUpload({ userId, taskId });
    if (!authResult.allowed) {
      return res.status(authResult.statusCode || 403).json({
        error: authResult.errorMessage,
        code: authResult.errorCode
      });
    }
    const membership = { startupId: authResult.startupId!, role: authResult.role! };
    const task = authResult.task;
    const callerRole = authResult.role || req.user?.role || 'EMPLOYEE';

    // Convert fileData (base64) or content (string) to Buffer
    let buffer: Buffer;
    if (fileData) {
      buffer = Buffer.from(fileData, 'base64');
    } else if (content) {
      buffer = Buffer.from(content, 'utf-8');
    } else {
      return res.status(400).json({ error: 'No file content or data provided.', code: 'EMPTY_FILE' });
    }

    // Validate file size (max 15MB)
    const MAX_FILE_SIZE = 15 * 1024 * 1024;
    if (buffer.length > MAX_FILE_SIZE) {
      return res.status(400).json({
        error: `File size exceeds 15MB limit (${(buffer.length / (1024 * 1024)).toFixed(1)}MB).`,
        code: 'FILE_TOO_LARGE'
      });
    }

    const sizeStr = `${(buffer.length / 1024).toFixed(1)} KB`;
    const docId = `doc_task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const s3Key = `tasks/${taskId}/${Date.now()}_${sanitizedName}`;

    // Upload to private object storage if configured
    let storageKey = s3Key;
    if (isS3Configured()) {
      try {
        await uploadToS3({
          key: s3Key,
          body: buffer,
          contentType: mimeType || 'application/octet-stream',
          metadata: {
            taskId,
            originalName: sanitizedName,
            uploadedBy: userId,
            startupId: membership.startupId
          }
        });
        console.log(`[Task Documents API] Uploaded to Neon S3: ${s3Key}`);
      } catch (s3Err: any) {
        console.warn('[Task Documents API] S3 upload error (fallback):', s3Err.message);
      }
    }

    // Save metadata and storage key in Neon Postgres
    await safeDbQuery(async () => {
      await (prisma as any).startupDocument.create({
        data: {
          id: docId,
          name: sanitizedName,
          type: type || 'task_document',
          sourceType: 'TASK_DOCUMENT',
          sourceRecordId: taskId,
          size: sizeStr,
          summary: `Supporting document for task: ${task?.title || taskId}. StorageKey: ${storageKey}`,
          startupId: membership.startupId,
          accessScope: 'ALL',
          indexingStatus: 'COMPLETED'
        }
      });
    });

    // Record activity in Founder Activity Ledger
    try {
      await activityLogService.logActivity({
        startupId: membership.startupId,
        userId: userId,
        actorRole: req.user?.role || callerRole || 'EMPLOYEE',
        action: 'TASK_DOCUMENT_UPLOADED',
        targetEntity: 'TASK',
        targetId: taskId,
        department: task?.department || 'General',
        details: {
          taskId,
          documentId: docId,
          documentName: sanitizedName,
          size: sizeStr
        }
      });
    } catch {}

    // Return document info WITHOUT exposing raw private S3 storage URL
    res.status(201).json({
      id: docId,
      name: sanitizedName,
      size: sizeStr,
      type: type || 'task_document',
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    sendTaskError(res, err);
  }
});

// GET /api/tasks/:id/documents — Phase 5 & 6: List supporting documents
router.get('/tasks/:id/documents', authenticateJWT, requireActiveMembership, requirePermission('people:read'), async (req: AuthenticatedRequest, res) => {
  try {
    const taskId = req.params.id;
    const userId = req.user!.id;
    const membership = await resolveMembership(userId);
    if (!membership) {
      return res.status(403).json({ error: 'No active company membership.', code: 'NO_MEMBERSHIP' });
    }

    // Verify task access
    await getTaskByIdForUser(userId, taskId);

    const docs = await safeDbQuery(async () => {
      return await (prisma as any).startupDocument.findMany({
        where: {
          startupId: membership.startupId,
          sourceType: 'TASK_DOCUMENT',
          sourceRecordId: taskId
        },
        orderBy: { createdAt: 'desc' }
      });
    });

    const safeDocs = (docs || []).map((d: any) => ({
      id: d.id,
      name: d.name,
      size: d.size,
      type: d.type,
      createdAt: d.createdAt?.toISOString?.() ?? String(d.createdAt)
    }));

    res.json(safeDocs);
  } catch (err) {
    sendTaskError(res, err);
  }
});

// GET /api/tasks/:id/documents/:docId/download — Phase 5 & 6: Secure time-limited presigned download URL
router.get('/tasks/:id/documents/:docId/download', authenticateJWT, requireActiveMembership, requirePermission('people:read'), async (req: AuthenticatedRequest, res) => {
  try {
    const { id: taskId, docId } = req.params;
    const userId = req.user!.id;

    const authResult = await authorizeDocumentDownload(userId, docId);
    if (!authResult.allowed) {
      return res.status(authResult.statusCode || 403).json({
        error: authResult.errorMessage || 'Forbidden',
        code: authResult.errorCode || 'FORBIDDEN'
      });
    }

    // Verify that the document belongs to this specific task
    if (authResult.doc?.sourceType === 'TASK_DOCUMENT' && authResult.doc?.sourceRecordId !== taskId) {
      return res.status(404).json({ error: 'Document not found for this task.', code: 'NOT_FOUND' });
    }

    res.json({
      downloadUrl: authResult.downloadUrl,
      filename: authResult.filename,
      offline: authResult.offline
    });
  } catch (err) {
    sendTaskError(res, err);
  }
});

// GET /api/tasks/:id/activity — Phase 6: Relevant task activity history
router.get('/tasks/:id/activity', authenticateJWT, requireActiveMembership, requirePermission('people:read'), async (req: AuthenticatedRequest, res) => {
  try {
    const taskId = req.params.id;
    const userId = req.user!.id;
    const membership = await resolveMembership(userId);
    if (!membership) {
      return res.status(403).json({ error: 'No active company membership.', code: 'NO_MEMBERSHIP' });
    }

    // Verify task access
    await getTaskByIdForUser(userId, taskId);

    let activities: any[] = [];
    try {
      const logs = await safeDbQuery(async () => {
        return await (prisma as any).activityLog.findMany({
          where: {
            startupId: membership.startupId,
            details: {
              path: ['taskId'],
              equals: taskId
            }
          },
          orderBy: { timestamp: 'desc' },
          take: 50
        });
      });
      if (logs && logs.length > 0) {
        activities = logs.map((l: any) => ({
          id: l.id,
          action: l.action,
          actorRole: l.actorRole,
          details: l.details,
          timestamp: l.timestamp?.toISOString?.() ?? String(l.timestamp)
        }));
      } else {
        // Fallback: search memory logs
        const memLogs = await activityLogService.listActivities({
          startupId: membership.startupId,
          limit: 100
        });
        const matched = memLogs.filter((m: any) => m.targetId === taskId || m.details?.taskId === taskId);
        for (const m of matched) {
          activities.push({
            id: m.id,
            action: m.action,
            actorRole: m.actorRole,
            details: m.details,
            timestamp: m.timestamp
          });
        }
      }
    } catch {}

    try {
      const { listTaskProgressUpdates } = await import('../services/employeeEcosystemService');
      const progressUpdates = await listTaskProgressUpdates(taskId);
      for (const p of progressUpdates) {
        activities.push({
          id: p.id,
          action: 'PROGRESS_UPDATE',
          actorRole: p.authorRole,
          actorName: p.authorName,
          details: { note: p.note },
          timestamp: p.createdAt
        });
      }
    } catch {}

    // Sort by timestamp desc
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json(activities);
  } catch (err) {
    sendTaskError(res, err);
  }
});

// GET employee workspace payload: companion agent, role-scoped documents, metrics (Phase B2).
router.get('/workspace/employee', authenticateJWT, requireActiveMembership, requirePermission('people:read'), async (req: AuthenticatedRequest, res) => {
  try {
    res.json(await getRoleScopedContext({ userId: req.user!.id }));
  } catch (err) {
    sendTaskError(res, err);
  }
});

// GET plans for the caller's company (Phase A4).
router.get('/plans', authenticateJWT, requireActiveMembership, requirePermission('people:read'), async (req: AuthenticatedRequest, res) => {
  try {
    res.json(await listPlansForUser(req.user!.id));
  } catch (err) {
    sendTaskError(res, err);
  }
});

// GET a specific plan with its tasks by id.
router.get('/plans/:id', authenticateJWT, requireActiveMembership, requirePermission('people:read'), async (req: AuthenticatedRequest, res) => {
  try {
    res.json(await getPlanById(req.user!.id, req.params.id));
  } catch (err) {
    sendTaskError(res, err);
  }
});

// GET missing human role requirements & AI capability staffing diagnostic (Phase A6).
router.get('/tasks/requirements', authenticateJWT, requireActiveMembership, requirePermission('people:read'), async (req: AuthenticatedRequest, res) => {
  try {
    const membership = await resolveMembership(req.user!.id);
    if (!membership) {
      return res.status(403).json({ error: 'No active membership', code: 'NO_MEMBERSHIP' });
    }
    const diagnostic = await getMissingCapabilitiesAndStaffing(membership.startupId);
    res.json(diagnostic);
  } catch (err) {
    sendTaskError(res, err);
  }
});

// POST provision an AI specialist capability on demand (Phase A6).
router.post('/agents/provision', authenticateJWT, requireActiveMembership, requirePermission('people:write'), async (req: AuthenticatedRequest, res) => {
  try {
    const membership = await resolveMembership(req.user!.id);
    if (!membership) {
      return res.status(403).json({ error: 'No active membership', code: 'NO_MEMBERSHIP' });
    }
    const capability = req.body?.capability || req.body?.role || 'GENERAL';
    const result = await ensureAiSpecialistCapability(membership.startupId, capability);
    res.json(result);
  } catch (err) {
    sendTaskError(res, err);
  }
});

// ============================================================================
// PERMISSIONS (P1 Task 7 - Role -> areas / agents / actions)
// ============================================================================

// GET the effective permission set for the authenticated caller.
// The frontend mirrors this to hide areas; the backend still enforces it.
router.get('/permissions/me', authenticateJWT, attachMembershipRole, async (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  // P1 Task 8: the role now comes from the caller's Membership when one exists,
  // falling back to User.role so accounts without a company keep working.
  const membership = await resolveMembership(req.user.id);
  const permissions = await getEffectivePermissions(req.user.id, req.user.role);
  res.json({
    userId: req.user.id,
    storedRole: req.user.role,
    role: permissions.role,
    areas: permissions.areas,
    agents: permissions.agents,
    actions: permissions.actions,
    people: {
      read: permissions.actions.includes('people:read'),
      write: permissions.actions.includes('people:write'),
      access: permissions.actions.includes('people:access')
    },
    startupId: membership?.startupId ?? null,
    isOwner: membership?.isOwner ?? false
  });
});

// GET the full role catalogue (used by the Add Person / role pickers).
router.get('/permissions/roles', authenticateJWT, (req: AuthenticatedRequest, res) => {
  res.json(ROLES.map(role => ({
    role,
    areas: ROLE_PERMISSIONS[role].areas,
    agents: ROLE_PERMISSIONS[role].agents,
    actions: ROLE_PERMISSIONS[role].actions
  })));
});

// ============================================================================
// TEAM MANAGEMENT (P1 Task 5 - People Directory)
// ============================================================================

const inMemoryTeamMembers: Array<{
  id: string;
  userId: string;
  fullName: string;
  name: string;
  role: string;
  department: string;
  email: string;
  status: 'Active' | 'Invited' | 'Inactive';
  joinedAt: string;
}> = [];

// GET team members for the authenticated founder's venture
router.get('/team', authenticateJWT, requireActiveMembership, requirePermission('people:read'), async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  try {
    if (isDbAvailable && prisma) {
      // P1 Task 9: resolve the company through Membership rather than ownerId
      // only, so an invited member can see the roster too (previously they
      // always received an empty list).
      const startupId = await getActiveStartupId(userId);
      const startup = startupId
        ? await prisma.startup.findUnique({ where: { id: startupId } })
        : null;
      if (startup) {
        const memories = await prisma.memory.findMany({
          where: { startupId: startup.id, category: 'TEAM_MEMBER' },
          orderBy: { createdAt: 'desc' }
        });

        // P1 Task 9 reconciliation: a roster entry whose email matches an ACTIVE
        // membership is the same person as a Company Account. The Memory row is
        // kept (it is historical roster data) but flagged, so the People page can
        // show that person once, under Company Accounts.
        const activeMemberships = await listMemberships(startup.id);
        const accountEmails = new Map<string, string>();
        for (const m of activeMemberships) {
          const memberEmail = (m.user?.email || '').trim().toLowerCase();
          if (memberEmail) accountEmails.set(memberEmail, m.userId);
        }

        const members = memories.map(m => {
          try {
            const parsed = JSON.parse(m.description);
            const memberName = parsed.fullName || m.title;
            const memberRole = parsed.role || 'Team Member';
            const memberDept = parsed.department || parsed.role || 'General';
            const memberEmail = (parsed.email || '').trim();
            const linkedUserId = accountEmails.get(memberEmail.toLowerCase());
            const memberSkills = Array.isArray(parsed.skills) && parsed.skills.length > 0
              ? parsed.skills
              : multiAgentOrchestratorService.inferSkills(memberDept, memberRole);
            const memberResponsibilities = Array.isArray(parsed.responsibilities) && parsed.responsibilities.length > 0
              ? parsed.responsibilities
              : multiAgentOrchestratorService.inferResponsibilities(memberDept, memberRole);
            return {
              id: m.id,
              fullName: memberName,
              name: memberName,
              role: memberRole,
              department: memberDept,
              email: memberEmail,
              status: parsed.status || 'Active',
              joinedAt: m.createdAt.toISOString(),
              skills: memberSkills,
              responsibilities: memberResponsibilities,
              /** True when this roster entry corresponds to a live company account. */
              hasAccount: Boolean(linkedUserId),
              linkedUserId: linkedUserId || null
            };
          } catch {
            return {
              id: m.id,
              fullName: m.title,
              name: m.title,
              role: m.description || 'Team Member',
              department: m.description || 'General',
              email: '',
              status: 'Active',
              joinedAt: m.createdAt.toISOString(),
              skills: multiAgentOrchestratorService.inferSkills(m.description || 'General', m.description || 'Team Member'),
              responsibilities: multiAgentOrchestratorService.inferResponsibilities(m.description || 'General', m.description || 'Team Member'),
              hasAccount: false,
              linkedUserId: null
            };
          }
        });
        return res.json(members);
      }
    }
    const memList = inMemoryTeamMembers.filter(m => m.userId === userId);
    res.json(memList);
  } catch (err: any) {
    console.error('[Team API] GET error:', err.message);
    const memList = inMemoryTeamMembers.filter(m => m.userId === userId);
    res.json(memList);
  }
});

// POST add a new team member
router.post('/team', authenticateJWT, requireActiveMembership, requirePermission('people:write'), async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const { fullName, name, role, email, department, status, skills, responsibilities } = req.body || {};
  const memberName = (fullName || name || '').trim();
  const memberEmail = (email || '').trim();
  const memberRole = (role || '').trim();
  const memberDept = (department || role || 'General').trim();

  if (!memberName) {
    res.status(400).json({ error: 'Full Name is required.' });
    return;
  }
  if (!memberEmail || !memberEmail.includes('@')) {
    res.status(400).json({ error: 'A valid email address is required.' });
    return;
  }
  if (!memberRole) {
    res.status(400).json({ error: 'Role is required.' });
    return;
  }
  // P1 Task 7: Map role title to canonical RBAC role so arbitrary titles (e.g. "Lead Integrations Engineer") succeed
  const assignableRoles = ROLES.filter(r => r !== 'FOUNDER');
  let canonicalRole = memberRole.toUpperCase();
  const explicitRole = (req.body?.systemRole || req.body?.canonicalRole || '').trim().toUpperCase();

  if (assignableRoles.includes(explicitRole as any)) {
    canonicalRole = explicitRole;
  } else if (!assignableRoles.includes(canonicalRole as any)) {
    // Intelligent domain/role inference
    const lowerRole = memberRole.toLowerCase();
    if (lowerRole.includes('admin')) {
      canonicalRole = 'ADMIN';
    } else if (lowerRole.includes('finan') || lowerRole.includes('account') || lowerRole.includes('cfo')) {
      canonicalRole = 'FINANCE';
    } else if (lowerRole.includes('hr') || lowerRole.includes('talent') || lowerRole.includes('people') || lowerRole.includes('recruit')) {
      canonicalRole = 'HR';
    } else if (lowerRole.includes('growth') || lowerRole.includes('market') || lowerRole.includes('sales')) {
      canonicalRole = 'GROWTH';
    } else {
      canonicalRole = 'OPERATIONS';
    }
  }
  if (!memberDept) {
    res.status(400).json({ error: 'Department is required.' });
    return;
  }

  // Determine structured skills and responsibilities
  const assignedSkills: string[] = Array.isArray(skills) && skills.length > 0
    ? skills
    : multiAgentOrchestratorService.inferSkills(memberDept, memberRole);
  const assignedResponsibilities: string[] = Array.isArray(responsibilities) && responsibilities.length > 0
    ? responsibilities
    : multiAgentOrchestratorService.inferResponsibilities(memberDept, memberRole);

  try {
    if (isDbAvailable && prisma) {
      // P1 Task 9: resolve via Membership so a member with people:write (e.g. HR)
      // can manage the roster, not only the owner.
      const startupId = await getActiveStartupId(userId);
      const startup = startupId
        ? await prisma.startup.findUnique({ where: { id: startupId } })
        : null;
      if (startup) {
        const memory = await prisma.memory.create({
          data: {
            category: 'TEAM_MEMBER',
            title: memberName,
            description: JSON.stringify({
              fullName: memberName,
              role: memberRole,
              systemRole: canonicalRole,
              department: memberDept,
              email: memberEmail,
              status: status || 'Active',
              skills: assignedSkills,
              responsibilities: assignedResponsibilities
            }),
            startupId: startup.id
          }
        });

        // Also add an audit timeline item
        await prisma.timelineItem.create({
          data: {
            title: `Team Member Added: ${memberName}`,
            content: `Added ${memberName} (${memberRole} · ${memberDept}) to the venture team.`,
            type: 'team',
            startupId: startup.id
          }
        }).catch(() => {});

        // Dispatch onboarding invitation and email via Gmail SMTP
        let emailDelivered = false;
        try {
          const invResult = await createInvitation({
            startupId: startup.id,
            email: memberEmail,
            role: canonicalRole,
            invitedById: userId
          });
          emailDelivered = Boolean(invResult.delivery?.delivered);
        } catch (invErr: any) {
          try {
            const { sendTeamWelcomeEmail } = await import('../services/invitationMailer');
            const welcomeRes = await sendTeamWelcomeEmail({
              to: memberEmail,
              companyName: startup.name,
              fullName: memberName,
              role: canonicalRole,
              department: memberDept,
              addedByName: req.user?.name || req.user?.email || 'The Founder',
              addedByEmail: req.user?.email,
              workspaceUrl: (process.env.APP_URL || process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '')
            });
            emailDelivered = Boolean(welcomeRes.delivered);
          } catch (mailErr: any) {
            console.warn('[Team API] Welcome mail fallback warning:', mailErr.message);
          }
        }

        // Register worker directly with multiAgentOrchestratorService
        multiAgentOrchestratorService.registerLiveWorker({
          id: memory.id,
          startupId: startup.id,
          userId,
          name: memberName,
          domain: memberDept || memberRole,
          role: memberRole,
          email: memberEmail,
          status: (status as any) || 'Available',
          skills: assignedSkills,
          responsibilities: assignedResponsibilities
        });

        return res.json({
          id: memory.id,
          fullName: memberName,
          name: memberName,
          role: memberRole,
          systemRole: canonicalRole,
          department: memberDept,
          email: memberEmail,
          status: status || 'Active',
          joinedAt: memory.createdAt.toISOString(),
          skills: assignedSkills,
          responsibilities: assignedResponsibilities,
          emailDelivered
        });
      }
    }

    // Fallback for mock/memory mode
    const memMember = {
      id: `member_${Date.now()}`,
      userId,
      fullName: memberName,
      name: memberName,
      role: memberRole,
      systemRole: canonicalRole,
      department: memberDept,
      email: memberEmail,
      status: (status as any) || 'Active',
      joinedAt: new Date().toISOString(),
      skills: assignedSkills,
      responsibilities: assignedResponsibilities
    };
    inMemoryTeamMembers.unshift(memMember);

    multiAgentOrchestratorService.registerLiveWorker({
      id: memMember.id,
      startupId: 'default_startup',
      userId,
      name: memberName,
      domain: memberDept || memberRole,
      role: memberRole,
      email: memberEmail,
      status: (status as any) || 'Available',
      skills: assignedSkills,
      responsibilities: assignedResponsibilities
    });

    res.json(memMember);
  } catch (err: any) {
    console.error('[Team API] POST error:', err.message);
    res.status(500).json({ error: 'Failed to add team member.' });
  }
});

// DELETE remove a team member
router.delete('/team/:id', authenticateJWT, requireActiveMembership, requirePermission('people:write'), async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  const { id } = req.params;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  try {
    multiAgentOrchestratorService.removeLiveWorker(id);

    if (isDbAvailable && prisma) {
      // Scope the delete to the caller's own startup so one tenant cannot
      // remove another tenant's team member by guessing a Memory id.
      // P1 Task 9: resolve via Membership so a member with people:write (e.g. HR)
      // can manage the roster, not only the owner.
      const startupId = await getActiveStartupId(userId);
      const startup = startupId
        ? await prisma.startup.findUnique({ where: { id: startupId } })
        : null;
      if (!startup) {
        res.status(404).json({ error: 'No venture found for this account.' });
        return;
      }
      const removed = await prisma.memory.deleteMany({
        where: { id, category: 'TEAM_MEMBER', startupId: startup.id }
      });
      if (removed.count === 0) {
        const idxMem = inMemoryTeamMembers.findIndex(m => m.id === id && m.userId === userId);
        if (idxMem === -1) {
          res.status(404).json({ error: 'Team member not found.' });
          return;
        }
      }
    }
    const idx = inMemoryTeamMembers.findIndex(m => m.id === id && m.userId === userId);
    if (idx !== -1) inMemoryTeamMembers.splice(idx, 1);
    res.json({ success: true, id });
  } catch (err: any) {
    console.error('[Team API] DELETE error:', err.message);
    res.status(500).json({ error: 'Failed to remove team member.' });
  }
});

// GET list of initiatives
router.get('/initiatives', authenticateJWT, (req: AuthenticatedRequest, res) => {
  res.json(initiatives);
});

// POST launch new initiative
router.post('/initiatives', authenticateJWT, (req: AuthenticatedRequest, res) => {
  const { title, description, category } = req.body;
  if (!title || !description || !category) {
    res.status(400).json({ error: 'Missing required initiative parameters.' });
    return;
  }

  const newInit: Initiative = {
    id: `init_${Date.now()}`,
    title,
    description,
    status: 'pending',
    category,
    createdAt: new Date().toISOString(),
    currentTaskIndex: 0,
    tasks: [
      { id: `t_gen_1`, title: 'Formulate general initiative roadmap and boundaries', assignedTo: 'CEO', status: 'pending' },
      { id: `t_gen_2`, title: 'Audit budget thresholds and financial boundaries', assignedTo: 'Finance', status: 'pending' },
      { id: `t_gen_3`, title: 'Compile protective disclosures and contract drafts', assignedTo: 'Legal', status: 'pending' }
    ],
    messages: [],
    deliverables: []
  };

  initiatives.unshift(newInit);
  persistCurrentState();
  res.status(201).json(newInit);
});

// TELEMETRY & SYSTEM ENDPOINTS (Vault & MCP Tools)
router.get('/vault/status', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const status = await vaultService.getStatus();
  const secretData = await vaultService.getSecret();
  res.json({
    status: status.connected ? 'connected' : 'fallback',
    vaultAddr: status.vaultAddr,
    keysFound: Object.keys(secretData)
  });
});

router.get('/mcp/tools', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const fastApiUrl = process.env.FASTAPI_URL || 'http://localhost:8000';
    const pyRes = await fetch(`${fastApiUrl}/api/py/mcp/tools`);
    if (pyRes.ok) {
      const data = await pyRes.json();
      return res.json(data);
    }
  } catch (e) {
    // Fallback response if Python service is loading
  }

  res.json({
    status: 'active',
    mcp_version: '1.0.0',
    tools: [
      { name: 'mcp_financial_calculator', description: 'Computes financial burn rates & runway impact.' },
      { name: 'mcp_compliance_auditor', description: 'Audits legal compliance, IP risk & SOC-2 guarantees.' },
      { name: 'mcp_vault_secret_loader', description: 'Queries HashiCorp Vault secrets engine.' }
    ]
  });
});

// POST simulate initiative collaboration (LangGraph Multi-Agent Loop!)
router.post('/initiatives/:id/simulate', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const init = initiatives.find(i => i.id === id);
  if (!init) {
    res.status(404).json({ error: 'Initiative not found.' });
    return;
  }

  init.status = 'active';
  setAgentStatuses('collaborating');
  const ceoAgent = agentsList.find(a => a.role === 'CEO');
  if (ceoAgent) ceoAgent.status = 'analyzing';

  try {
    console.log(`Starting LangGraph multi-agent simulation for initiative: ${init.title}`);
    
    // Attempt FastAPI Python LangGraph service invocation
    let simResult: any = null;
    const fastApiUrl = process.env.FASTAPI_URL || 'http://localhost:8000';
    try {
      const pyResponse = await fetch(`${fastApiUrl}/api/py/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: init.id,
          title: init.title,
          description: init.description,
          category: init.category
        })
      });
      if (pyResponse.ok) {
        simResult = await pyResponse.json();
        console.log('✅ Received LangGraph simulation result from FastAPI microservice!');
      }
    } catch (pyErr: any) {
      console.warn(`FastAPI LangGraph service unavailable (${pyErr.message}). Using local engine fallback.`);
    }

    if (!simResult) {
      const companyContext = req.user?.id ? await companyContextService.getContextForUser(req.user.id) : null;
      simResult = await runMultiAgentCollaboration(init, companyContext || startupProfile);
    }

    // Apply sim results to initiative
    init.tasks = simResult.tasks || init.tasks;
    init.messages = simResult.messages || [];
    init.deliverables = simResult.deliverables || [];
    init.status = 'completed';

    // Reset agents back to idle
    resetAgentStatuses();

    // Seed deliverables into the approvals queue
    init.deliverables.forEach(d => {
      d.initiativeId = init.id;
      approvals.unshift({ ...d, status: 'pending_review' });
    });

    // Save updated initiative and pending approvals to durable state file
    persistCurrentState();

    res.json(init);
  } catch (err: any) {
    console.error('Simulation endpoint failure:', err);
    init.status = 'failed';
    resetAgentStatuses();
    res.status(500).json({ error: 'Failed to execute agent simulation. Falling back to default states.' });
  }
});

// GET approvals queue
router.get('/approvals', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    if (userId) {
      const userApprovals = await approvalService.getApprovalsForUser(userId);
      return res.json(userApprovals);
    }
    res.json(approvals);
  } catch (err: any) {
    console.error('[Approvals API] Error fetching approvals:', err);
    res.status(500).json({ error: 'Failed to fetch approvals queue.' });
  }
});

// POST review action on approval item (Supports approve, modify, reject with idempotency)
router.post('/approvals/:id/review', authenticateJWT, requireActiveMembership, requirePermission('approvals:review'), async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { action, feedback, modifications } = req.body; // action: 'approve' | 'modify' | 'reject'
  const idempotencyKey = req.header('Idempotency-Key');

  // Check idempotency cache to prevent double-mutating on network retries
  if (idempotencyKey && idempotencyCache.has(idempotencyKey)) {
    const cached = idempotencyCache.get(idempotencyKey)!;
    if (Date.now() - cached.timestamp < 10 * 60 * 1000) {
      return res.status(cached.status).json(cached.body);
    }
  }

  const normalizedAction = (action === 'request-changes' || action === 'changes_requested') ? 'request_changes' : action;
  if (!normalizedAction || !['approve', 'modify', 'reject', 'request_changes'].includes(normalizedAction)) {
    return res.status(400).json({ error: 'Valid action ("approve" | "modify" | "reject" | "request_changes") is required.' });
  }

  try {
    const result = await approvalService.reviewApproval({
      approvalId: id,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: normalizedAction as any,
      feedback,
      modifications,
      idempotencyKey
    });

    if (!result.success) {
      return res.status(result.statusCode || 500).json({ error: result.error });
    }

    const responseBody = {
      startupProfile: result.startupProfile,
      item: result.item,
      message: result.message,
      alreadyProcessed: result.alreadyProcessed,
      stateChangesApplied: result.stateChangesApplied
    };

    if (idempotencyKey) {
      idempotencyCache.set(idempotencyKey, {
        status: 200,
        body: responseBody,
        timestamp: Date.now()
      });
    }

    // Record activity in Founder Activity Ledger
    try {
      const membership = await resolveMembership(req.user!.id);
      if (!membership) throw new Error('No active membership; skipping activity log.');
      const actionName = normalizedAction === 'approve' ? 'APPROVAL_GRANTED' : normalizedAction === 'reject' ? 'APPROVAL_REJECTED' : 'CHANGES_REQUESTED';
      await activityLogService.logActivity({
        startupId: membership.startupId,
        userId: req.user!.id,
        actorRole: req.user?.role || 'FOUNDER',
        action: actionName,
        targetEntity: 'DELIVERABLE',
        targetId: id,
        payloadDelta: result.item?.metricChanges || null,
        details: {
          approvalId: id,
          title: result.item?.title,
          action: normalizedAction,
          feedback
        }
      });
    } catch {}

    res.json(responseBody);
  } catch (err: any) {
    console.error(`[Approvals Review API] Error reviewing approval ${id}:`, err);
    res.status(500).json({ error: `Internal error processing approval review: ${err.message}` });
  }
});

// POST Section 26: Reversal of an approved deliverable
router.post('/approvals/:id/reverse', authenticateJWT, requireActiveMembership, requirePermission('approvals:review'), async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { reason } = req.body || {};
  try {
    const result = await approvalService.reverseApproval({
      approvalId: id,
      userId: req.user!.id,
      userRole: req.user!.role,
      reason
    });
    if (!result.success) {
      return res.status(result.statusCode || 400).json({ error: result.error });
    }
    res.json(result);
  } catch (err: any) {
    console.error(`[Approvals Reversal API] Error reversing approval ${id}:`, err);
    res.status(500).json({ error: `Internal error reversing approval: ${err.message}` });
  }
});

// POST simulate what-if financial scenario (Phase 6)
router.post('/scenarios/simulate', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    let cash = startupProfile.cashBalance;
    let burn = startupProfile.burnRate;

    if (userId && isDbAvailable && prisma) {
      const startup = await safeDbQuery(() => prisma.startup.findFirst({ where: { ownerId: userId } }));
      if (startup) {
        cash = startup.cashBalance;
        burn = startup.burnRate;
      }
    }

    const {
      additionalHeadcount,
      adSpendDelta,
      revenueDelta,
      oneTimeExpenditure
    } = req.body || {};

    const simulation = financialEngine.simulateScenario({
      currentCash: cash,
      currentBurn: burn,
      additionalHeadcount: Array.isArray(additionalHeadcount) ? additionalHeadcount : [],
      adSpendDelta: Number(adSpendDelta) || 0,
      revenueDelta: Number(revenueDelta) || 0,
      oneTimeExpenditure: Number(oneTimeExpenditure) || 0
    });

    res.json(simulation);
  } catch (err: any) {
    console.error('[Scenario API] Error calculating scenario:', err);
    res.status(500).json({ error: 'Failed to simulate financial scenario.' });
  }
});

// GET decision logs
router.get('/decisions', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    if (userId) {
      const decisions = await approvalService.getDecisionsForUser(userId);
      return res.json(decisions);
    }
    res.json(decisionLog);
  } catch (err: any) {
    console.error('[Decisions API] Error fetching decision logs:', err);
    res.status(500).json({ error: 'Failed to retrieve decision log.' });
  }
});

// GET cryptographic immutable event ledger for a decision (Section 13)
router.get('/decisions/:id/events', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const events = decisionLedgerService.getEventsForDecision(id);
    res.json(events);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve decision ledger events.' });
  }
});

// GET verify cryptographic chain integrity for a decision (Section 13)
router.get('/decisions/:id/verify', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const verification = decisionLedgerService.verifyChain(id);
    res.json(verification);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to verify decision chain.' });
  }
});

// GET workflow deliberation runs (Section 3)
router.get('/workflows/:id/runs', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const workflow = agentRunService.getWorkflow(id);
    if (!workflow) return res.status(404).json({ error: 'Workflow not found.' });
    res.json(workflow);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve workflow runs.' });
  }
});

// GET command deliberation history by commandId (Section 3)
router.get('/commands/:id/deliberation', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const workflow = agentRunService.getWorkflowByCommandId(id);
    if (!workflow) return res.status(404).json({ error: 'Deliberation not found.' });
    res.json(workflow);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve deliberation.' });
  }
});

// GET company policies (Section 7)
router.get('/company/policies', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    let startupId = 'stp_default';
    if (userId && isDbAvailable && prisma) {
      const startup = await safeDbQuery(() => prisma.startup.findFirst({ where: { ownerId: userId } }));
      if (startup) startupId = startup.id;
    }
    const policy = await companyPolicyService.getPolicy(startupId);
    res.json(policy);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve company policy.' });
  }
});

// PUT update company policies (Section 7: Founder only)
router.put('/company/policies', authenticateJWT, requireActiveMembership, requirePermission('startup:write'), async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    let startupId = 'stp_default';
    if (userId && isDbAvailable && prisma) {
      const startup = await safeDbQuery(() => prisma.startup.findFirst({ where: { ownerId: userId } }));
      if (startup) startupId = startup.id;
    }
    const updated = await companyPolicyService.updatePolicy(startupId, req.body || {});
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update company policy.' });
  }
});

// GET knowledge base documents from Neon PostgreSQL (Tenant Isolated)
router.get('/knowledge', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.json([]);
      return;
    }

    const requestedStartupId = req.query?.startupId as string | undefined;
    const resolved = await resolveMembership(userId, requestedStartupId);
    if (!resolved) {
      res.status(403).json({ error: 'Access denied: You are not an authorized member of this company tenant.' });
      return;
    }

    const startupId = resolved.startupId;
    const callerRole = (resolved.role || 'EMPLOYEE').toUpperCase();
    const isFounderOrAdmin = callerRole === 'FOUNDER' || callerRole === 'ADMIN';

    if (!isDbAvailable || !prisma) {
      const userContext = await companyContextService.getContextForUser(userId);
      const docs = (userContext?.documents || []).filter((d: any) => {
        if (d.startupId && d.startupId !== startupId) return false;
        if (isFounderOrAdmin) return true;
        const scope = (d.accessScope || 'ALL').toUpperCase();
        return scope === 'ALL' || scope === callerRole;
      });
      return res.json(docs);
    }

    const whereClause: any = {
      startupId: startupId
    };

    if (!isFounderOrAdmin) {
      whereClause.OR = [
        { accessScope: 'ALL' },
        { accessScope: callerRole },
        { accessScope: callerRole.toLowerCase() }
      ];
    }

    if (req.query?.sourceType) {
      whereClause.sourceType = String(req.query.sourceType);
    }
    if (req.query?.sourceRecordId) {
      whereClause.sourceRecordId = String(req.query.sourceRecordId);
    }

    const dbDocs: any[] = await prisma.startupDocument.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    });

    const docs = dbDocs.map(d => ({
      id: d.id,
      name: d.name,
      type: d.type as any,
      size: d.size,
      uploadDate: d.createdAt.toISOString(),
      summary: d.summary,
      insights: d.insights,
      startupId: d.startupId,
      sourceType: d.sourceType || 'DOCUMENT',
      sourceRecordId: d.sourceRecordId || null,
      version: d.version ?? 1,
      accessScope: d.accessScope || 'ALL',
      indexingStatus: d.indexingStatus || 'COMPLETED',
      errorMessage: d.errorMessage || null,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString()
    }));

    res.json(docs);
  } catch (err: any) {
    console.error('[Knowledge API] Error fetching documents from DB:', err.message);
    res.status(500).json({ error: `Failed to fetch documents: ${err.message}` });
  }
});

// POST upload/ingest new knowledge document with multiple formats support
router.post('/knowledge', authenticateJWT, requirePermission('knowledge:write'), async (req: AuthenticatedRequest, res) => {
  const {
    name,
    content,
    type,
    fileData,
    mimeType,
    sourceType = 'DOCUMENT',
    sourceRecordId = null,
    version = 1,
    accessScope = 'ALL'
  } = req.body;

  if (!name || !type) {
    res.status(400).json({ error: 'Missing required document name or type.' });
    return;
  }

  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const requestedStartupId = req.body?.startupId;
  const resolved = await resolveMembership(userId, requestedStartupId);
  if (!resolved) {
    res.status(403).json({ error: 'Access denied: You are not an authorized member of this company tenant.' });
    return;
  }

  const startupId = resolved.startupId;
  const callerRole = (resolved.role || 'EMPLOYEE').toUpperCase();
  const isFounderOrAdmin = callerRole === 'FOUNDER' || callerRole === 'ADMIN';

  const normScope = (accessScope || 'ALL').toUpperCase();
  if (normScope === 'FOUNDER_ONLY' && !isFounderOrAdmin) {
    res.status(403).json({ error: 'Access denied: Only founders or admins can assign FOUNDER_ONLY access scope.' });
    return;
  }

  const parsedVersion = typeof version === 'number' ? version : parseInt(version, 10) || 1;
  let sizeStr = fileData ? `${(Buffer.from(fileData, 'base64').length / 1024).toFixed(1)} KB` : `${((content || '').length / 1024).toFixed(1)} KB`;
  const documentId = `doc_${Date.now()}`;

  let textContent = content || '';

  // Handle base64 encoded file uploads
  if (fileData) {
    const buffer = Buffer.from(fileData, 'base64');
    sizeStr = `${(buffer.length / 1024).toFixed(1)} KB`;
    console.log(`[Knowledge API] Processing file upload: ${name} (${sizeStr}) with mimeType: ${mimeType}`);

    if (isS3Configured()) {
      try {
        const sanitized = name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const s3Key = `documents/${Date.now()}_${sanitized}`;
        await uploadToS3({
          key: s3Key,
          body: buffer,
          contentType: mimeType || 'application/octet-stream',
          metadata: { originalName: name, documentType: type, startupId },
        });
        console.log(`[Knowledge API] Document persisted to Neon S3 Object Storage: ${s3Key}`);
      } catch (s3Err: any) {
        console.warn('[Knowledge API] S3 upload warning (non-fatal):', s3Err.message);
      }
    }

    textContent = await extractTextFromFile(buffer, name, mimeType || '');
  }

  if (!textContent || textContent.trim().length === 0) {
    res.status(400).json({ error: 'Extracted text content from the file is empty.' });
    return;
  }

  let summary = `Vetted ${type} document detailing startup operational profiles.`;
  let insights = [
    'Validated strategic growth models against pre-seed boundaries.',
    'Constructed customer pilot roadmap containing mid-market criteria.',
    'Identified 2 legal safeguards concerning vendor data policies.'
  ];

  if (ai) {
    try {
      const analysisPrompt = `Analyze the following uploaded startup document:
Document Name: ${name}
Document Type: ${type}
Content:
${textContent.slice(0, 10000)}

Provide a structured analysis containing:
1. A concise 1-sentence summary of what this document covers.
2. A list of 3 key tactical corporate insights relevant to B2B SaaS building.

Format your output exactly as valid JSON with "summary" (string) and "insights" (array of strings). Do NOT include backticks or markdown fences.`;

      const analysisResponse = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        contents: analysisPrompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const parsed = JSON.parse(analysisResponse.text?.trim() || '{}');
      if (parsed.summary) summary = parsed.summary;
      if (Array.isArray(parsed.insights) && parsed.insights.length > 0) insights = parsed.insights;
    } catch (err: any) {
      console.warn('[Knowledge API] AI parsing warning, falling back to deterministic profile:', err.message);
    }
  }

  if (!isDbAvailable || !prisma) {
    const fallbackDoc = {
      id: documentId,
      name,
      type: type as any,
      size: sizeStr,
      uploadDate: new Date().toISOString(),
      summary,
      insights,
      startupId,
      sourceType,
      sourceRecordId,
      version: parsedVersion,
      accessScope: normScope,
      indexingStatus: 'COMPLETED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return res.status(201).json(fallbackDoc);
  }

  try {
    const createdDoc: any = await safeDbQuery(() => (prisma.startupDocument as any).create({
      data: {
        id: documentId,
        name,
        type,
        size: sizeStr,
        summary,
        insights,
        startupId,
        sourceType,
        sourceRecordId,
        version: parsedVersion,
        accessScope: normScope,
        indexingStatus: 'PENDING'
      }
    }));

    // Ingest chunks with stable IDs and vector embeddings
    await ingestDocument(documentId, textContent, name, type, {
      startupId,
      sourceType,
      sourceRecordId,
      version: parsedVersion,
      accessScope: normScope
    });

    // Invalidate company context cache so all AI agents immediately see the fresh document
    companyContextService.invalidate(startupId);

    // Create operational notification
    try {
      await prisma.notification.create({
        data: {
          startupId,
          type: 'DOCUMENT',
          title: 'Document Ready',
          message: `"${name}" (${type}) was parsed, embedded, and indexed into the company knowledge base.`,
          read: false
        }
      });
    } catch (notifErr: any) {
      console.warn('[Knowledge API] Failed to create document notification:', notifErr.message);
    }

    const newFile = {
      id: createdDoc.id,
      name: createdDoc.name,
      type: createdDoc.type as any,
      size: createdDoc.size,
      uploadDate: createdDoc.createdAt.toISOString(),
      summary: createdDoc.summary,
      insights: createdDoc.insights,
      startupId: createdDoc.startupId,
      sourceType: createdDoc.sourceType,
      sourceRecordId: createdDoc.sourceRecordId,
      version: createdDoc.version,
      accessScope: createdDoc.accessScope,
      indexingStatus: 'COMPLETED',
      createdAt: createdDoc.createdAt.toISOString(),
      updatedAt: createdDoc.updatedAt.toISOString()
    };

    // Synchronize in-memory knowledgeFiles for instant company-wide access
    const existingIdx = knowledgeFiles.findIndex(k => k.id === newFile.id);
    if (existingIdx >= 0) {
      knowledgeFiles[existingIdx] = newFile as any;
    } else {
      knowledgeFiles.unshift(newFile as any);
    }

    // Record durable outbox job for tracking and auditability
    try {
      await ingestionPipelineService.enqueueJob({
        startupId,
        sourceType,
        sourceRecordId: createdDoc.id,
        action: 'UPSERT',
        payload: {
          documentId: createdDoc.id,
          name: createdDoc.name,
          type: createdDoc.type,
          version: parsedVersion,
          accessScope: normScope,
          summary: createdDoc.summary
        },
        immediate: false
      });
    } catch (jobErr: any) {
      console.warn('[Knowledge API] Outbox record warning:', jobErr.message);
    }

    res.status(201).json(newFile);
  } catch (error: any) {
    console.error('[Knowledge API] Critical ingestion error:', error.message);
    res.status(500).json({ error: `File ingestion failed: ${error.message}` });
  }
});

// PUT update/reprocess existing knowledge document with version increment and stale chunk purging
router.put('/knowledge/:id', authenticateJWT, requirePermission('knowledge:write'), async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { name, content, type, accessScope } = req.body;
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const requestedStartupId = req.body?.startupId;
  const resolved = await resolveMembership(userId, requestedStartupId);
  if (!resolved) {
    res.status(403).json({ error: 'Access denied: You are not an authorized member of this company tenant.' });
    return;
  }

  const startupId = resolved.startupId;
  const callerRole = (resolved.role || 'EMPLOYEE').toUpperCase();
  const isFounderOrAdmin = callerRole === 'FOUNDER' || callerRole === 'ADMIN';

  try {
    let existingDoc: any = null;
    if (isDbAvailable && prisma) {
      existingDoc = await safeDbQuery(() => prisma.startupDocument.findFirst({
        where: { id, startupId }
      }));
    } else {
      existingDoc = knowledgeFiles.find(k => k.id === id && (!k.startupId || k.startupId === startupId));
    }

    if (!existingDoc) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }

    const newVersion = (existingDoc.version || 1) + 1;
    const docName = name || existingDoc.name;
    const docType = type || existingDoc.type || 'general';
    const docContent = content !== undefined ? content : existingDoc.summary;
    let docScope = existingDoc.accessScope || 'ALL';
    if (accessScope) {
      const normScope = accessScope.toUpperCase();
      if (normScope === 'FOUNDER_ONLY' && !isFounderOrAdmin) {
        res.status(403).json({ error: 'Access denied: Only founders or admins can assign FOUNDER_ONLY access scope.' });
        return;
      }
      docScope = normScope;
    }

    // Process update through ingestionPipelineService (removes stale chunks, creates new chunks with new embeddings)
    const job = await ingestionPipelineService.enqueueJob({
      startupId,
      sourceType: existingDoc.sourceType || 'DOCUMENT',
      sourceRecordId: id,
      action: 'UPSERT',
      payload: {
        documentId: id,
        name: docName,
        type: docType,
        content: docContent,
        version: newVersion,
        accessScope: docScope,
        summary: `Updated: ${docName} (version ${newVersion})`
      },
      immediate: true
    });

    res.json({
      id,
      name: docName,
      type: docType,
      version: newVersion,
      accessScope: docScope,
      indexingStatus: 'COMPLETED',
      updatedAt: new Date().toISOString(),
      jobId: job.id
    });
  } catch (err: any) {
    console.error('[Knowledge API] Document update failed:', err.message);
    res.status(500).json({ error: `Update failed: ${err.message}` });
  }
});

// DELETE remove knowledge document and deactivate/purge all associated chunks and embeddings
router.delete('/knowledge/:id', authenticateJWT, requirePermission('knowledge:write'), async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const requestedStartupId = req.query?.startupId as string | undefined;
  const resolved = await resolveMembership(userId, requestedStartupId);
  if (!resolved) {
    res.status(403).json({ error: 'Access denied: You are not an authorized member of this company tenant.' });
    return;
  }

  const startupId = resolved.startupId;

  try {
    const job = await ingestionPipelineService.enqueueJob({
      startupId,
      sourceType: 'DOCUMENT',
      sourceRecordId: id,
      action: 'DELETE',
      payload: { documentId: id },
      immediate: true
    });

    res.json({
      success: true,
      message: `Document ${id} and all associated knowledge chunks removed.`,
      jobId: job.id
    });
  } catch (err: any) {
    console.error('[Knowledge API] Document deletion failed:', err.message);
    res.status(500).json({ error: `Deletion failed: ${err.message}` });
  }
});

// POST initial ingestion of existing company data (Profile, Policies, Documents, Decisions, Tasks)
router.post('/knowledge/sync', authenticateJWT, requirePermission('knowledge:write'), async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const requestedStartupId = req.body?.startupId;
  const resolved = await resolveMembership(userId, requestedStartupId);
  if (!resolved) {
    res.status(403).json({ error: 'Access denied: You are not an authorized member of this company tenant.' });
    return;
  }

  try {
    const result = await ingestionPipelineService.initialIngestCompanyData(resolved.startupId);
    res.json({
      success: true,
      message: `Synchronized ${result.ingestedCount} company operational records into RAG knowledge base.`,
      ingestedCount: result.ingestedCount,
      jobs: result.jobs.map(j => ({ id: j.id, action: j.action, status: j.status, sourceType: j.sourceType }))
    });
  } catch (err: any) {
    console.error('[Knowledge API] Initial sync failed:', err.message);
    res.status(500).json({ error: `Sync failed: ${err.message}` });
  }
});

// POST reindex outdated documents when embedding model or chunking strategy changes
router.post('/knowledge/reindex', authenticateJWT, requirePermission('knowledge:write'), async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const requestedStartupId = req.body?.startupId;
  const resolved = await resolveMembership(userId, requestedStartupId);
  if (!resolved) {
    res.status(403).json({ error: 'Access denied: You are not an authorized member of this company tenant.' });
    return;
  }

  const { targetModel, targetStrategy } = req.body || {};

  try {
    const result = await ingestionPipelineService.reindexOutdatedDocuments(
      resolved.startupId,
      targetModel,
      targetStrategy
    );
    res.json({
      success: true,
      message: `Reindexed ${result.reindexedCount} outdated documents.`,
      reindexedCount: result.reindexedCount,
      jobs: result.jobs.map(j => ({ id: j.id, action: j.action, status: j.status }))
    });
  } catch (err: any) {
    console.error('[Knowledge API] Reindex failed:', err.message);
    res.status(500).json({ error: `Reindexing failed: ${err.message}` });
  }
});

// GET durable ingestion jobs for the company tenant
router.get('/knowledge/jobs', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const requestedStartupId = req.query?.startupId as string | undefined;
  const resolved = await resolveMembership(userId, requestedStartupId);
  if (!resolved) {
    res.status(403).json({ error: 'Access denied: You are not an authorized member of this company tenant.' });
    return;
  }

  const status = req.query?.status as string | undefined;

  try {
    const jobs = await ingestionPipelineService.listJobs(resolved.startupId, status);
    res.json(jobs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST retry an individual failed job
router.post('/knowledge/jobs/:jobId/retry', authenticateJWT, requirePermission('knowledge:write'), async (req: AuthenticatedRequest, res) => {
  const { jobId } = req.params;
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const result = await ingestionPipelineService.retryJob(jobId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST retry all failed jobs for tenant
router.post('/knowledge/retry-failed', authenticateJWT, requirePermission('knowledge:write'), async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const requestedStartupId = req.body?.startupId;
  const resolved = await resolveMembership(userId, requestedStartupId);
  if (!resolved) {
    res.status(403).json({ error: 'Access denied: You are not an authorized member of this company tenant.' });
    return;
  }

  try {
    const results = await ingestionPipelineService.retryFailedJobs(resolved.startupId);
    res.json({
      success: true,
      retriedCount: results.length,
      results
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET Neon S3 Object Storage status and health
router.get('/storage/status', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const status = await checkS3Health();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET presigned download URL for an uploaded document (Strict Company Isolation & AccessScope Protection)
router.get('/knowledge/:id/download', authenticateJWT, requireActiveMembership, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required.', code: 'UNAUTHORIZED' });
    }

    const authResult = await authorizeDocumentDownload(userId, id);
    if (!authResult.allowed) {
      // Check offline documents fallback for requesting user's company context only
      if (authResult.statusCode === 404) {
        const userContext = await companyContextService.getContextForUser(userId);
        const userDoc = userContext?.documents?.find((d: any) => d.id === id);
        const membership = await resolveMembership(userId);
        const docStartupId = (userDoc as any)?.startupId || userContext?.startupId;
        if (userDoc && (!docStartupId || docStartupId === membership?.startupId)) {
          return res.json({ downloadUrl: `#offline-download-${id}`, filename: userDoc.name, offline: true });
        }
      }

      return res.status(authResult.statusCode || 403).json({
        error: authResult.errorMessage || 'Forbidden',
        code: authResult.errorCode || 'FORBIDDEN'
      });
    }

    return res.json({
      downloadUrl: authResult.downloadUrl,
      filename: authResult.filename,
      offline: authResult.offline
    });
  } catch (err: any) {
    res.status(500).json({ error: `Could not generate download URL: ${err.message}` });
  }
});

// POST search/RAG query against uploaded files in Neon PostgreSQL
router.post('/knowledge/query', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const { query } = req.body;
  if (!query) {
    res.status(400).json({ error: 'Query is required.' });
    return;
  }

  const callerId = req.user!.id;
  const requestedStartupId = req.body?.startupId;
  const resolved = await resolveMembership(callerId, requestedStartupId);
  if (!resolved) {
    res.status(403).json({ error: 'Access denied: You are not an authorized member of this company tenant.' });
    return;
  }
  const startupId = resolved.startupId;

  try {
    let activeStartup: any = null;
    if (isDbAvailable && prisma) {
      activeStartup = await safeDbQuery(() => prisma.startup.findUnique({ where: { id: startupId } }));
    }
    if (!activeStartup) {
      const userContext = await companyContextService.getContextForUser(callerId);
      if (userContext?.startupId === startupId) {
        activeStartup = userContext.startup;
      }
    }
    if (!activeStartup) {
      activeStartup = {
        id: startupId,
        name: startupProfile.name || 'Company',
        industry: startupProfile.industry || 'Technology',
        description: startupProfile.description || '',
        fundingStage: startupProfile.fundingStage || 'Early Stage',
        cashBalance: startupProfile.cashBalance || 250000,
        burnRate: startupProfile.burnRate || 15000,
        healthScore: startupProfile.healthScore || 85
      };
    }
    const effectiveStartupId = activeStartup?.id || startupId;

    // 1. Separate structured queries from semantic retrieval using retrieveHybridKnowledge
    const parsedLimit = typeof req.body?.limit === 'number' ? req.body.limit : 5;
    const hybridResult = await retrieveHybridKnowledge({
      query: query.trim(),
      startupId: effectiveStartupId,
      userId: callerId,
      userRole: resolved.role,
      limit: parsedLimit
    });

    // Pure Structured Operational Query: return authoritative real-time facts directly without vector search overhead
    if (hybridResult.intent === 'STRUCTURED') {
      return res.json({
        answer: hybridResult.directAnswer || hybridResult.structuredSummary || hybridResult.contextText,
        citations: hybridResult.citations,
        intent: 'STRUCTURED',
        operationalData: hybridResult.structuredData
      });
    }

    if (hybridResult.retrievedChunks.length === 0 && hybridResult.intent !== 'HYBRID') {
      res.json({
        answer: `No corporate records matching your query have been indexed yet for **${activeStartup.name}** within your access scope. Please upload relevant strategic documents (PDF, DOCX, PPTX, CSV) or complete founder onboarding to feed the knowledge base!`,
        citations: []
      });
      return;
    }

    // 2. Build structured prompt context and citation objects
    const contextText = hybridResult.contextText;
    const citations = hybridResult.citations;

    // 3. Attempt Gemini Model Synthesis with graceful fallback
    if (ai) {
      try {
        const queryPrompt = hybridResult.intent === 'HYBRID'
          ? `You are the CatalystOS Knowledge Agent. Solve this user query using both the authoritative operational records and corporate document context:
Query: "${query}"

${contextText}

Provide a brilliant, detailed tactical answer combining exact operational facts and strategic context, citing specific documents or operational records where possible using the citation IDs (like [OP-TASK-1], [CIT-1]) provided in the context. Use clean Markdown styling.`
          : `You are the CatalystOS Knowledge Agent. Solve this user query using the attached document context:
Query: "${query}"

Corporate Document Base Context:
${contextText}

Provide a brilliant, detailed tactical answer citing specific documents where possible using the citation IDs (like [CIT-1], [CIT-2]) provided in the context. Use clean Markdown styling.`;

        const response = await ai.models.generateContent({
          model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
          contents: queryPrompt,
        });

        if (response.text?.trim()) {
          res.json({ 
            answer: response.text,
            citations: citations,
            intent: hybridResult.intent
          });
          return;
        }
      } catch (geminiErr: any) {
        console.warn('[Knowledge API] Gemini API unavailable or quota exceeded; engaging grounded fallback synthesis:', geminiErr.message);
      }
    }

    // 4. Grounded deterministic synthesis fallback (for offline or Gemini 429 quota exhaustion)
    if (hybridResult.intent === 'HYBRID' && hybridResult.structuredSummary) {
      const fallbackDocAnswer = generateGroundedRagFallback(query, hybridResult.retrievedChunks, citations, activeStartup);
      res.json({
        answer: `${hybridResult.structuredSummary}\n\n### Document Analysis & Strategy\n${fallbackDocAnswer}`,
        citations: citations,
        intent: 'HYBRID'
      });
      return;
    }

    const fallbackAnswer = generateGroundedRagFallback(query, hybridResult.retrievedChunks, citations, activeStartup);
    res.json({
      answer: fallbackAnswer,
      citations: citations,
      intent: hybridResult.intent
    });
  } catch (error: any) {
    console.error('[Knowledge API] RAG query failed:', error.message);
    res.status(500).json({ error: 'RAG search failed to generate answer.' });
  }
});

/**
 * Deterministic, grounded fallback synthesizer for RAG queries when Gemini AI quota is exhausted or offline.
 */
function generateGroundedRagFallback(
  query: string,
  chunks: RetrievedChunk[],
  citations: Citation[],
  startup: {
    name: string;
    industry: string;
    description: string;
    fundingStage: string;
    cashBalance: number;
    burnRate: number;
    healthScore?: number;
  }
): string {
  const q = query.toLowerCase();
  const runwayMonths = startup.burnRate > 0 ? (startup.cashBalance / startup.burnRate).toFixed(1) : 'Sustainable';

  // 1. Runway / Treasury / Financial Inquiry
  if (
    q.includes('runway') ||
    q.includes('cash') ||
    q.includes('burn') ||
    q.includes('financial') ||
    q.includes('treasury') ||
    q.includes('budget') ||
    q.includes('money')
  ) {
    let answer = `**${startup.name} Financial Status**\n\n`;
    answer += `• **Cash Reserves:** ${startup.cashBalance.toLocaleString()}\n`;
    answer += `• **Monthly Burn:** ${startup.burnRate.toLocaleString()}/mo\n`;
    answer += `• **Projected Runway:** **${runwayMonths} months** (${startup.fundingStage} stage)\n`;

    if (citations.length > 0) {
      answer += `\n*Source: ${citations[0].documentName}*`;
    }
    return answer;
  }

  // 2. Pitch Deck / Executive Summary Inquiry
  if (
    q.includes('pitch') ||
    q.includes('deck') ||
    q.includes('summar') ||
    q.includes('overview') ||
    q.includes('profile') ||
    q.includes('what is') ||
    q.includes('about')
  ) {
    let answer = `**${startup.name}** (${startup.fundingStage} stage, ${startup.industry})\n\n`;
    if (startup.description) {
      answer += `• **Core Focus:** ${startup.description}\n`;
    }
    answer += `• **Treasury:** ${startup.cashBalance.toLocaleString()} cash | ${startup.burnRate.toLocaleString()}/mo burn (${runwayMonths} mos runway)\n`;
    if (citations.length > 0) {
      answer += `• **Verified Reference:** ${citations.map(c => c.documentName).join(', ')}`;
    }
    return answer;
  }

  // 3. General Query Grounded Synthesis
  let answer = `**${startup.name} Knowledge Base**\n\n`;
  if (citations.length > 0) {
    const top = citations.slice(0, 2);
    top.forEach((c) => {
      const snippet = c.chunkContent.replace(/\s+/g, ' ').trim().slice(0, 160);
      answer += `• **${c.documentName}**: "${snippet}..."\n`;
    });
  } else {
    answer += `No specific internal records found regarding "${query}".`;
  }
  return answer;
}

// ============================================================================
// MULTI-LEVEL AI ORCHESTRATION PIPELINE (PHASE 2 - 8)
// Canonical endpoints for Sophia Vance Executive Directive Dispatcher
// ============================================================================

// POST /api/orchestration/directives — Submit a founder directive for multi-level orchestration
router.post('/orchestration/directives', authenticateJWT, orchestrateRateLimiter, async (req: AuthenticatedRequest, res) => {
  const { directive, command, commandId, context } = req.body;
  const inputDirective = (directive || command || '').trim();

  if (!inputDirective) {
    res.status(400).json({ error: 'A non-empty directive is required.' });
    return;
  }

  try {
    const run = await multiLevelOrchestrator.dispatchDirective({
      directive: inputDirective,
      userId: req.user!.id,
      startupId: context?.startupId,
      commandId
    });
    res.json(run);
  } catch (err: any) {
    console.error('[Orchestration Directives API] Execution failure:', err.message);
    res.status(500).json({
      error: 'I could not complete the executive directive right now. Reason: AI orchestration pipeline encountered an error.',
      details: err.message
    });
  }
});

// GET /api/orchestration/runs/:runId — Retrieve run status and execution metadata
router.get('/orchestration/runs/:runId', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const canonical = await companyContextService.getContextForUser(req.user!.id);
    const startupId = canonical?.startupId;
    const run = multiLevelOrchestrator.getRun(req.params.runId, startupId);

    if (!run) {
      res.status(404).json({ error: 'Orchestration run not found or unauthorized.' });
      return;
    }
    res.json(run);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve orchestration run', details: err.message });
  }
});

// GET /api/orchestration/runs/:runId/tasks — Retrieve task-level execution status and DAG steps
router.get('/orchestration/runs/:runId/tasks', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const canonical = await companyContextService.getContextForUser(req.user!.id);
    const startupId = canonical?.startupId;
    const tasks = multiLevelOrchestrator.getRunTasks(req.params.runId, startupId);

    if (!tasks) {
      res.status(404).json({ error: 'Orchestration run not found or unauthorized.' });
      return;
    }
    res.json({ runId: req.params.runId, tasks });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve run tasks', details: err.message });
  }
});

// POST /api/orchestration/runs/:runId/cancel — Cancel an active orchestration run
router.post('/orchestration/runs/:runId/cancel', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const canonical = await companyContextService.getContextForUser(req.user!.id);
    const startupId = canonical?.startupId;
    const cancelled = multiLevelOrchestrator.cancelRun(req.params.runId, startupId);

    if (!cancelled) {
      res.status(400).json({ error: 'Could not cancel run. Run may have already finished or not exist.' });
      return;
    }
    res.json({ success: true, message: 'Orchestration run successfully cancelled.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to cancel orchestration run', details: err.message });
  }
});

// GET /api/orchestration/history — Retrieve authorized conversation & directive history
router.get('/orchestration/history', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const canonical = await companyContextService.getContextForUser(req.user!.id);
    const startupId = canonical?.startupId;
    const history = startupId ? multiLevelOrchestrator.getHistory(startupId) : [];
    res.json(history);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve orchestration history', details: err.message });
  }
});

// POST orchestrate command (Master Planner-Executor Backwards-Compatible Canonical Endpoint)
router.post(['/orchestrate', '/orchestration/command'], authenticateJWT, orchestrateRateLimiter, async (req: AuthenticatedRequest, res) => {
  const { command, directive, commandId, context } = req.body;
  const inputCmd = (command || directive || '').trim();
  if (!inputCmd) {
    res.status(400).json({ error: 'A non-empty founder command is required.' });
    return;
  }

  const callerId = req.user!.id;
  const requestedStartupId = req.body?.startupId || context?.startupId;
  const resolved = await resolveMembership(callerId, requestedStartupId);
  if (!resolved) {
    res.status(403).json({ error: 'Access denied: You are not an authorized member of this company tenant.' });
    return;
  }
  const verifiedStartupId = resolved.startupId;

  try {
    const run = await multiLevelOrchestrator.dispatchDirective({
      directive: inputCmd,
      userId: callerId,
      startupId: verifiedStartupId,
      commandId
    });

    // Enrich with 5-Step Multi-Agent Orchestration & Resource Allocation
    let multiAgentAssessment: any = null;
    try {
      multiAgentAssessment = await multiAgentOrchestratorService.orchestrateTask({
        userRequirement: inputCmd,
        startupId: verifiedStartupId,
        userId: callerId
      });
    } catch (e: any) {
      console.warn('[Orchestrate API] 5-Step assessment notice:', e.message);
    }

    // Format response to be 100% compatible with OrchestrationResponse
    const responsePayload = {
      commandId: run.runId,
      runId: run.runId,
      status: run.status === 'needs_approval' ? 'needs_approval' : run.status === 'blocked' ? 'needs_information' : run.status === 'failed' ? 'failed' : 'completed',
      interpretation: {
        intent: run.intent,
        objective: run.objective
      },
      answer: {
        summary: run.result.summary,
        details: [
          run.result.completedWork.length > 0 ? `### Completed Work\n${run.result.completedWork.map(w => `• ${w.replace(/^(?:[•]\s*|[-*]\s+)+/, '').trim()}`).join('\n')}` : '',
          run.result.keyFindings.length > 0 ? `### Key Findings\n${run.result.keyFindings.map(k => `• ${k.replace(/^(?:[•]\s*|[-*]\s+)+/, '').trim()}`).join('\n')}` : '',
          run.result.failedOrBlockedSteps.length > 0 ? `### Blocked / Failed Steps\n${run.result.failedOrBlockedSteps.map(f => `• **${f.title}**: ${f.reason}`).join('\n')}` : '',
          run.result.founderDecisions.length > 0 ? `### Required Founder Decisions\n${run.result.founderDecisions.map(d => `• ${d.replace(/^(?:[•]\s*|[-*]\s+)+/, '').trim()}`).join('\n')}` : ''
        ].filter(Boolean).join('\n\n')
      },
      agents: run.tasks.length > 0
        ? run.tasks.map(t => ({
            role: t.assignedAgent.role,
            status: t.status === 'completed' ? 'completed' : t.status === 'running' ? 'collaborating' : 'idle',
            contribution: t.output?.rationale || t.title
          }))
        : [{ role: 'CEO', status: 'completed', contribution: run.result.summary }],
      evidence: run.result.evidence,
      calculations: run.result.calculations.map(c => ({ metric: c.metric, value: c.value, source: c.source })),
      supportingData: run.result.calculations.map(c => ({ label: c.metric, value: c.value, source: c.source })),
      approval: run.createdRecords.approvals && run.createdRecords.approvals.length > 0 ? {
        required: true,
        approvalId: run.createdRecords.approvals[0].id,
        reason: run.createdRecords.approvals[0].title,
        impact: run.createdRecords.approvals[0].impact
      } : undefined,
      nextActions: run.result.recommendedActions,
      confidence: run.status === 'completed' ? 0.98 : 0.85,
      dagPlan: run.plan,
      dagTasks: run.tasks,
      createdRecords: run.createdRecords,
      multiAgentAssessment,
      monitoringBlueprint: multiAgentAssessment?.monitoringBlueprint || [],
      headAlerts: multiAgentAssessment?.alerts || []
    };

    res.json(responsePayload);
  } catch (err: any) {
    console.error('[Orchestrate API] Execution failure:', err.message);
    res.status(500).json({
      error: 'I could not complete the executive analysis right now. Reason: AI orchestration pipeline encountered an error. Please try again.',
      details: err.message
    });
  }
});

// ============================================================================
// 5-STEP MULTI-AGENT ORCHESTRATION & RESOURCE ALLOCATION
// [ Input Task ] ──► (1. Select Agents) ──► (2. Check Employee DB) 
//                                                  │
//                      ┌───────────────────────────┴───────────┐
//                      ▼ (Available)                           ▼ (Not Available)
//              (3A. Assign Work)                       (3B. Notify Head to Hire)
//                      │                                       │
//                      ▼                                       ▼
//              (4. Generate Plan)                     (Suggest Domain Specs)
//                      │
//                      ▼
//         (5. Live Monitoring Dashboard)
// ============================================================================

// POST /api/orchestrate/assess - Analyze task requirement, check workers, allocate or alert
router.post('/orchestrate/assess', authenticateJWT, orchestrateRateLimiter, async (req: AuthenticatedRequest, res) => {
  const { userRequirement, task, requirement, startupId } = req.body || {};
  const inputPrompt = (userRequirement || task || requirement || '').trim();

  if (!inputPrompt) {
    return res.status(400).json({ error: 'A valid project requirement or task is required.' });
  }

  try {
    const callerId = req.user!.id;
    const resolved = await resolveMembership(callerId, startupId);
    if (!resolved) {
      return res.status(403).json({ error: 'Access denied: You are not an authorized member of this company tenant.' });
    }
    const callerStartupId = resolved.startupId;
    const assessment = await multiAgentOrchestratorService.orchestrateTask({
      userRequirement: inputPrompt,
      startupId: callerStartupId,
      userId: callerId
    });

    return res.json(assessment);
  } catch (err: any) {
    console.error('[Orchestrate Assess API] Error:', err.message);
    return res.status(500).json({ error: 'Failed to process multi-agent assessment: ' + err.message });
  }
});

// GET /api/orchestrate/assessments/latest - Retrieve latest assessment or create default
router.get('/orchestrate/assessments/latest', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const latest = multiAgentOrchestratorService.getLatestAssessment();
    if (latest) {
      return res.json(latest);
    }

    const callerId = req.user!.id;
    const resolved = await resolveMembership(callerId);
    const callerStartupId = resolved?.startupId || 'default_startup';

    const defaultAssessment = await multiAgentOrchestratorService.orchestrateTask({
      userRequirement: 'We need an email marketing system with a React dashboard and a secure Python SMTP background processing worker.',
      startupId: callerStartupId,
      userId: callerId
    });

    return res.json(defaultAssessment);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch assessment: ' + err.message });
  }
});

// POST /api/orchestrate/slot/assign - Head assigns or hires a worker to unblock a slot
router.post('/orchestrate/slot/assign', authenticateJWT, requireActiveMembership, requirePermission('people:write'), async (req: AuthenticatedRequest, res) => {
  const { assessmentId, domain, workerName, workerRole, workerEmail, startupId } = req.body || {};

  if (!assessmentId || !domain || !workerName) {
    return res.status(400).json({ error: 'assessmentId, domain, and workerName are required.' });
  }

  try {
    const callerId = req.user!.id;
    const resolved = await resolveMembership(callerId, startupId);
    if (!resolved) {
      return res.status(403).json({ error: 'Access denied: You are not an authorized member of this company tenant.' });
    }
    const callerStartupId = resolved.startupId;
    const updated = await multiAgentOrchestratorService.assignWorkerToSlot({
      assessmentId,
      domain,
      workerName,
      workerRole,
      workerEmail,
      startupId: callerStartupId
    });

    return res.json(updated);
  } catch (err: any) {
    console.error('[Slot Assign API] Error:', err.message);
    return res.status(400).json({ error: err.message });
  }
});

// POST /api/orchestrate/slot/control - Head controls slot (pause, resume, revoke)
router.post('/orchestrate/slot/control', authenticateJWT, requireActiveMembership, requirePermission('people:write'), async (req: AuthenticatedRequest, res) => {
  const { assessmentId, domain, action } = req.body || {};

  if (!assessmentId || !domain || !['pause', 'resume', 'revoke'].includes(action)) {
    return res.status(400).json({ error: 'assessmentId, domain, and valid action (pause, resume, revoke) are required.' });
  }

  try {
    const updated = multiAgentOrchestratorService.controlSlot({
      assessmentId,
      domain,
      action
    });

    return res.json(updated);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// POST orchestrate stream endpoint (Real-time SSE event stream for Executive Dashboard)
router.post('/orchestrate/stream', authenticateJWT, orchestrateRateLimiter, async (req: AuthenticatedRequest, res) => {
  const { command, directive, commandId, context } = req.body;
  const inputCmd = (command || directive || '').trim();
  if (!inputCmd) {
    res.status(400).json({ error: 'A non-empty founder command is required.' });
    return;
  }

  const callerId = req.user!.id;
  const requestedStartupId = req.body?.startupId || context?.startupId;
  const resolved = await resolveMembership(callerId, requestedStartupId);
  if (!resolved) {
    res.status(403).json({ error: 'Access denied: You are not an authorized member of this company tenant.' });
    return;
  }
  const verifiedStartupId = resolved.startupId;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  try {
    const run = await multiLevelOrchestrator.dispatchDirective({
      directive: inputCmd,
      userId: callerId,
      startupId: verifiedStartupId,
      commandId,
      onEvent: (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    });

    const responsePayload = {
      commandId: run.runId,
      runId: run.runId,
      status: run.status === 'needs_approval' ? 'needs_approval' : run.status === 'blocked' ? 'needs_information' : run.status === 'failed' ? 'failed' : 'completed',
      interpretation: {
        intent: run.intent,
        objective: run.objective
      },
      answer: {
        summary: run.result.summary,
        details: [
          run.result.completedWork.length > 0 ? `### Completed Work\n${run.result.completedWork.map(w => `• ${w.replace(/^(?:[•]\s*|[-*]\s+)+/, '').trim()}`).join('\n')}` : '',
          run.result.keyFindings.length > 0 ? `### Key Findings\n${run.result.keyFindings.map(k => `• ${k.replace(/^(?:[•]\s*|[-*]\s+)+/, '').trim()}`).join('\n')}` : '',
          run.result.failedOrBlockedSteps.length > 0 ? `### Blocked / Failed Steps\n${run.result.failedOrBlockedSteps.map(f => `• **${f.title}**: ${f.reason}`).join('\n')}` : '',
          run.result.founderDecisions.length > 0 ? `### Required Founder Decisions\n${run.result.founderDecisions.map(d => `• ${d.replace(/^(?:[•]\s*|[-*]\s+)+/, '').trim()}`).join('\n')}` : ''
        ].filter(Boolean).join('\n\n')
      },
      agents: run.tasks.length > 0
        ? run.tasks.map(t => ({
            role: t.assignedAgent.role,
            status: t.status === 'completed' ? 'completed' : t.status === 'running' ? 'collaborating' : 'idle',
            contribution: t.output?.rationale || t.title
          }))
        : [{ role: 'CEO', status: 'completed', contribution: run.result.summary }],
      evidence: run.result.evidence,
      calculations: run.result.calculations.map(c => ({ metric: c.metric, value: c.value, source: c.source })),
      supportingData: run.result.calculations.map(c => ({ label: c.metric, value: c.value, source: c.source })),
      approval: run.createdRecords.approvals && run.createdRecords.approvals.length > 0 ? {
        required: true,
        approvalId: run.createdRecords.approvals[0].id,
        reason: run.createdRecords.approvals[0].title,
        impact: run.createdRecords.approvals[0].impact
      } : undefined,
      nextActions: run.result.recommendedActions,
      confidence: run.status === 'completed' ? 0.98 : 0.85,
      dagPlan: run.plan,
      dagTasks: run.tasks,
      createdRecords: run.createdRecords
    };

    res.write(`data: ${JSON.stringify({ type: 'final_response', result: responsePayload })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: any) {
    console.error('[Orchestrate Stream API] Streaming failure:', err.message);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      message: 'I could not complete the executive analysis right now. Reason: AI orchestration pipeline encountered an error. Please try again.'
    })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

// ============================================================================
// PHASE G — PROACTIVE CATALYSTOS (Insights, Timeline, Memories)
// ============================================================================

// GET proactive insights for the authenticated founder's company.
router.get('/proactive/insights', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId || !prisma) {
    return res.json([]);
  }
  try {
    const { resolveMembership } = await import('../services/membershipService');
    const membership = await resolveMembership(userId);
    let startupId = membership?.startupId;
    if (!startupId) {
      const startup = await prisma.startup.findFirst({ where: { ownerId: userId } });
      startupId = startup?.id;
    }
    if (!startupId) return res.json([]);

    const notifs = await prisma.notification.findMany({
      where: { startupId },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    res.json(notifs);
  } catch (err: any) {
    console.error('[Proactive Insights API] Error:', err.message);
    res.json([]);
  }
});

// POST trigger proactive analysis for the authenticated company.
router.post('/proactive/analyze', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  try {
    const { resolveMembership } = await import('../services/membershipService');
    const membership = await resolveMembership(userId);
    let startupId = membership?.startupId;
    if (!startupId && prisma) {
      const startup = await prisma.startup.findFirst({ where: { ownerId: userId } });
      startupId = startup?.id;
    }
    if (!startupId) {
      return res.status(404).json({ error: 'No company workspace found.' });
    }
    const { proactiveEngine } = await import('../services/proactiveEngine');
    const insights = await proactiveEngine.generateAndNotifyInsights(startupId);
    res.json({
      success: true,
      notificationsCreated: insights.length,
      insightsSummary: insights.map((i) => ({ type: i.category, message: i.recommendation }))
    });
  } catch (err: any) {
    console.error('[Proactive Analyze API] Error:', err.message);
    res.status(500).json({ error: 'Proactive analysis failed.' });
  }
});

// GET F2 — Company Timeline (5-stage sequential execution lifecycle).
router.get('/timeline', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.json([]);
  }
  try {
    const items = await approvalService.getTimelineForUser(userId);
    res.json(items);
  } catch (err: any) {
    console.error('[Timeline API] Error:', err.message);
    res.json([]);
  }
});

// GET F1 — Company Decision Memories.
router.get('/memories', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.json([]);
  }
  try {
    const memories = await approvalService.getMemoriesForUser(userId);
    res.json(memories);
  } catch (err: any) {
    console.error('[Memories API] Error:', err.message);
    res.json([]);
  }
});

// GET F3 — Decision Memory Retrieval by query (close WORK->DECISION->MEMORY->FUTURE loop).
router.get('/memories/search', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  const query = (req.query.q as string) || '';
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  try {
    const result = await retrieveDecisionMemory({ userId, query });
    res.json(result);
  } catch (err: any) {
    console.error('[Memory Search API] Error:', err.message);
    res.status(500).json({ error: 'Memory retrieval failed.' });
  }
});

// ============================================================================
// EMPLOYEE WORKSPACE & COMPANY COMMUNITY ROUTES
// ============================================================================
import * as communityService from '../services/communityService';

// GET /api/community/posts
router.get('/community/posts', authenticateJWT, requireActiveMembership, requirePermission('people:read'), async (req: AuthenticatedRequest, res) => {
  try {
    const posts = await communityService.listCommunityPosts({
      userId: req.user!.id,
      type: req.query.type as string,
      search: req.query.q as string
    });
    res.json(posts);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list posts' });
  }
});

// POST /api/community/posts
router.post('/community/posts', authenticateJWT, requireActiveMembership, requirePermission('people:read'), async (req: AuthenticatedRequest, res) => {
  try {
    const { type, title, content, tags, department } = req.body || {};
    if (!title || !content || !type) {
      return res.status(400).json({ error: 'Title, content, and type are required.' });
    }
    const post = await communityService.createCommunityPost({
      userId: req.user!.id,
      type,
      title,
      content,
      tags,
      department
    });
    res.json(post);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to create post' });
  }
});

// GET /api/community/posts/:id/comments
router.get('/community/posts/:id/comments', authenticateJWT, requireActiveMembership, requirePermission('people:read'), async (req: AuthenticatedRequest, res) => {
  try {
    const comments = await communityService.listCommunityComments(req.user!.id, req.params.id);
    res.json(comments);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/community/posts/:id/comments
router.post('/community/posts/:id/comments', authenticateJWT, requireActiveMembership, requirePermission('people:read'), async (req: AuthenticatedRequest, res) => {
  try {
    const { content } = req.body || {};
    if (!content) return res.status(400).json({ error: 'Comment content is required.' });
    const comment = await communityService.addCommunityComment({
      userId: req.user!.id,
      postId: req.params.id,
      content
    });
    res.json(comment);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/community/posts/:id/react
router.post('/community/posts/:id/react', authenticateJWT, requireActiveMembership, requirePermission('people:read'), async (req: AuthenticatedRequest, res) => {
  try {
    const { reaction } = req.body || {};
    const result = await communityService.togglePostReaction({
      userId: req.user!.id,
      postId: req.params.id,
      reaction: reaction || 'helpful'
    });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/community/posts/:id/answer
router.post('/community/posts/:id/answer', authenticateJWT, requireActiveMembership, requirePermission('people:read'), async (req: AuthenticatedRequest, res) => {
  try {
    const { commentId } = req.body || {};
    const success = await communityService.markQuestionAnswered({
      userId: req.user!.id,
      postId: req.params.id,
      commentId
    });
    res.json({ success });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/community/posts/:id/convert-to-knowledge
router.post('/community/posts/:id/convert-to-knowledge', authenticateJWT, requireActiveMembership, requirePermission('knowledge:write'), async (req: AuthenticatedRequest, res) => {
  try {
    const doc = await communityService.convertPostToKnowledge({
      userId: req.user!.id,
      postId: req.params.id
    });
    res.json(doc);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/tasks/:id/blocker
router.post('/tasks/:id/blocker', authenticateJWT, requireActiveMembership, requirePermission('people:read'), async (req: AuthenticatedRequest, res) => {
  try {
    const { reason } = req.body || {};
    if (!reason) return res.status(400).json({ error: 'Blocker reason is required.' });
    const blocker = await communityService.reportTaskBlocker({
      userId: req.user!.id,
      taskId: req.params.id,
      reason
    });
    res.json(blocker);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/tasks/:id/blockers
router.get('/tasks/:id/blockers', authenticateJWT, requireActiveMembership, requirePermission('people:read'), async (req: AuthenticatedRequest, res) => {
  try {
    const blockers = await communityService.listTaskBlockers(req.user!.id, req.params.id);
    res.json(blockers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/tasks/:id/blocker/:blockerId/resolve
router.patch('/tasks/:id/blocker/:blockerId/resolve', authenticateJWT, requireActiveMembership, requirePermission('people:read'), async (req: AuthenticatedRequest, res) => {
  try {
    const { resolutionNote } = req.body || {};
    const resolved = await communityService.resolveTaskBlocker({
      userId: req.user!.id,
      blockerId: req.params.blockerId,
      resolutionNote
    });
    res.json({ success: resolved });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/team/hierarchy
router.get('/team/hierarchy', authenticateJWT, requireActiveMembership, requirePermission('people:read'), async (req: AuthenticatedRequest, res) => {
  try {
    const hierarchy = await communityService.getCompanyReportingHierarchy(req.user!.id);
    res.json(hierarchy);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// AGENT RULES & DYNAMIC BEHAVIORAL CUSTOMIZATION (Module 3)
// ============================================================================

// GET all agent rules for the current venture
router.get('/agents/rules', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const startupId = await resolveCallerStartupId(req, res);
    if (!startupId) return;
    const rules = await agentRuleService.getAllRules(startupId);
    res.json(rules);
  } catch (err: any) {
    console.error('[Agent Rules API] Error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve agent rules.' });
  }
});

// GET rules and spend limit for a specific agent role
router.get('/agents/:role/rules', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const startupId = await resolveCallerStartupId(req, res);
    if (!startupId) return;
    const rule = await agentRuleService.getRulesForAgent(startupId, req.params.role);
    res.json(rule);
  } catch (err: any) {
    console.error('[Agent Rule API] Error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve agent rule.' });
  }
});

// PUT update behavioral rules, ethical constraints, and spend limit for an agent role
router.put('/agents/:role/rules', authenticateJWT, requireActiveMembership, requirePermission('startup:write'), async (req: AuthenticatedRequest, res) => {
  try {
    const { rules, spendLimit } = req.body || {};
    if (!Array.isArray(rules)) {
      return res.status(400).json({ error: 'Field "rules" must be an array of strings.' });
    }
    const startupId = await resolveCallerStartupId(req, res);
    if (!startupId) return;
    
    const updated = await agentRuleService.updateRulesForAgent({
      startupId,
      role: req.params.role,
      rules,
      spendLimit: typeof spendLimit === 'number' ? spendLimit : undefined,
      actorId: req.user!.id
    });

    // Record activity in Founder Activity Ledger
    await activityLogService.logActivity({
      startupId,
      userId: req.user!.id,
      actorRole: req.user?.role || 'FOUNDER',
      action: 'RULE_MODIFIED',
      targetEntity: 'AGENT_RULE',
      targetId: req.params.role,
      details: {
        agentRole: updated.agentRole,
        rulesCount: updated.rules.length,
        spendLimit: updated.spendLimit
      }
    }).catch(() => {});

    res.json({
      success: true,
      agentRule: updated,
      message: `Updated behavioral rules for ${updated.agentRole} successfully.`
    });
  } catch (err: any) {
    console.error('[Update Agent Rules API] Error:', err.message);
    res.status(500).json({ error: 'Failed to update agent rules.' });
  }
});

// ============================================================================
// EMPLOYEE ECOSYSTEM: MEETINGS, AVAILABILITY, PROJECTS, ACTIVITY & EXPERTS
// ============================================================================
import * as employeeEcosystemService from '../services/employeeEcosystemService';

// GET /api/meetings
router.get('/meetings', authenticateJWT, requireActiveMembership, requirePermission('people:read'), async (req: AuthenticatedRequest, res) => {
  try {
    const meetings = await employeeEcosystemService.listCompanyMeetings(req.user!.id);
    res.json(meetings);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list meetings' });
  }
});

// POST /api/meetings
router.post('/meetings', authenticateJWT, requireActiveMembership, requirePermission('people:read'), async (req: AuthenticatedRequest, res) => {
  try {
    const { title, purpose, startTime, endTime, timezone, joinUrl, projectName, taskId, attendeeIds } = req.body || {};
    if (!title || !purpose || !startTime || !endTime || !joinUrl) {
      return res.status(400).json({ error: 'Title, purpose, start time, end time, and join URL are required.' });
    }
    const meeting = await employeeEcosystemService.createCompanyMeeting({
      userId: req.user!.id,
      title,
      purpose,
      startTime,
      endTime,
      timezone,
      joinUrl,
      projectName,
      taskId,
      attendeeIds
    });
    res.json(meeting);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/meetings/:id
router.delete('/meetings/:id', authenticateJWT, requireActiveMembership, requirePermission('people:read'), async (req: AuthenticatedRequest, res) => {
  try {
    const success = await employeeEcosystemService.cancelCompanyMeeting(req.user!.id, req.params.id);
    res.json({ success });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/meetings/:id/notes
router.post('/meetings/:id/notes', authenticateJWT, requireActiveMembership, requirePermission('people:read'), async (req: AuthenticatedRequest, res) => {
  try {
    const { meetingNotes, keyDecisions, actionItems } = req.body || {};
    if (meetingNotes === undefined || meetingNotes === null) {
      return res.status(400).json({ error: 'Meeting notes content is required.' });
    }
    const updated = await employeeEcosystemService.updateMeetingNotes({
      userId: req.user!.id,
      meetingId: req.params.id,
      meetingNotes,
      keyDecisions,
      actionItems
    });
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/meetings/:id/action-items/:itemId/toggle
router.patch('/meetings/:id/action-items/:itemId/toggle', authenticateJWT, requireActiveMembership, requirePermission('people:read'), async (req: AuthenticatedRequest, res) => {
  try {
    const updated = await employeeEcosystemService.toggleMeetingActionItem({
      userId: req.user!.id,
      meetingId: req.params.id,
      actionItemId: req.params.itemId
    });
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/workspace/availability
router.get('/workspace/availability', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const availability = await employeeEcosystemService.getUserAvailability(req.user!.id);
    res.json(availability);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/workspace/availability
router.post('/workspace/availability', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, statusText } = req.body || {};
    if (!status) return res.status(400).json({ error: 'Status is required' });
    const result = await employeeEcosystemService.setUserAvailability({
      userId: req.user!.id,
      status,
      statusText
    });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/workspace/projects
router.get('/workspace/projects', authenticateJWT, requireActiveMembership, requirePermission('people:read'), async (req: AuthenticatedRequest, res) => {
  try {
    const projects = await employeeEcosystemService.listEmployeeProjects(req.user!.id);
    res.json(projects);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/workspace/activity
router.get('/workspace/activity', authenticateJWT, requireActiveMembership, requirePermission('people:read'), async (req: AuthenticatedRequest, res) => {
  try {
    const feed = await employeeEcosystemService.listActivityFeed(req.user!.id);
    res.json(feed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/workspace/experts
router.get('/workspace/experts', authenticateJWT, requireActiveMembership, requirePermission('people:read'), async (req: AuthenticatedRequest, res) => {
  try {
    const experts = await employeeEcosystemService.listDomainExperts(req.user!.id);
    res.json(experts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks/:id/collaborator
router.post('/tasks/:id/collaborator', authenticateJWT, requireActiveMembership, requirePermission('people:read'), async (req: AuthenticatedRequest, res) => {
  try {
    const { collaboratorId, note } = req.body || {};
    if (!collaboratorId) return res.status(400).json({ error: 'collaboratorId is required.' });
    const result = await employeeEcosystemService.addTaskCollaborator({
      userId: req.user!.id,
      taskId: req.params.id,
      collaboratorId,
      note
    });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/tasks/:id/progress
router.post('/tasks/:id/progress', authenticateJWT, requireActiveMembership, requirePermission('people:read'), async (req: AuthenticatedRequest, res) => {
  try {
    const { note } = req.body || {};
    if (!note) return res.status(400).json({ error: 'Progress note is required.' });
    const update = await employeeEcosystemService.addTaskProgressUpdate({
      userId: req.user!.id,
      taskId: req.params.id,
      note
    });
    res.json(update);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/tasks/:id/progress
router.get('/tasks/:id/progress', authenticateJWT, requireActiveMembership, requirePermission('people:read'), async (req: AuthenticatedRequest, res) => {
  try {
    const updates = await employeeEcosystemService.listTaskProgressUpdates(req.params.id);
    res.json(updates);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// FOUNDER ACTIVITY LEDGER & REAL-TIME AUDIT INSPECTION (Module 6)
// ============================================================================

// GET chronological activity feed with live filters
router.get('/activities', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const startupId = await resolveCallerStartupId(req, res);
    if (!startupId) return;
    const department = req.query.department as string;
    const employee = (req.query.employee || req.query.userId) as string;
    const action = req.query.action as string;
    const limit = parseInt(req.query.limit as string) || 50;

    const activities = await activityLogService.listActivities({
      startupId,
      department,
      userId: employee,
      action,
      limit
    });

    res.json(activities);
  } catch (err: any) {
    console.error('[Activities API] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch activity logs.' });
  }
});

// Alias for /audit/activities
router.get('/audit/activities', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const startupId = await resolveCallerStartupId(req, res);
    if (!startupId) return;
    const activities = await activityLogService.listActivities({
      startupId,
      department: req.query.department as string,
      userId: req.query.userId as string,
      action: req.query.action as string,
      limit: parseInt(req.query.limit as string) || 50
    });
    res.json(activities);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch audit activity logs.' });
  }
});

// POST custom activity log entry
router.post('/activities', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const { action, targetEntity, targetId, payloadDelta, department, details } = req.body || {};
    if (!action) {
      return res.status(400).json({ error: 'Action type is required.' });
    }
    const startupId = await resolveCallerStartupId(req, res);
    if (!startupId) return;

    const record = await activityLogService.logActivity({
      startupId,
      userId: req.user!.id,
      actorRole: req.user?.role || 'EMPLOYEE',
      action,
      targetEntity,
      targetId,
      payloadDelta,
      department,
      details
    });

    res.json(record);
  } catch (err: any) {
    console.error('[Post Activity API] Error:', err.message);
    res.status(500).json({ error: 'Failed to record activity log.' });
  }
});

export default router;
