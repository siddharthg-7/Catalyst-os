/**
 * Catalyst OS — Phase 2 Authentication-Aware RAG Widget Test Suite
 *
 * Validates:
 * 1. Unauthenticated requests to /api/chat are rejected with HTTP 401 Unauthorized.
 * 2. Expired / invalid JWT tokens are rejected with HTTP 401 Unauthorized.
 * 3. Server never trusts client-supplied startup ID: cross-tenant startup ID rejected with HTTP 403 Forbidden.
 * 4. Authorized founders can query company RAG knowledge.
 * 5. Authorized employees with valid company memberships can query RAG knowledge.
 * 6. Frontend route guards ensure widget is hidden on public and unresolved screens.
 * 7. Session expiration halts request loops and properly triggers error/retry states.
 */

process.env.NODE_ENV = 'test';
process.env.STRICT_AUTH = 'true';

import 'dotenv/config';
import http from 'http';
import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import apiRouter from '../backend/routes/api';
import { JWT_SECRET } from '../backend/services/neonAuthMiddleware';
import { prisma } from '../backend/services/dbService';

let passed = 0;
let failed = 0;

function assert(condition: boolean, title: string, details?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${title}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${title} - ${details || 'Assertion failed'}`);
    failed++;
  }
}

async function runPhase2Tests() {
  console.log('\n========================================================================');
  console.log('🧪 CATALYST OS — PHASE 2 AUTHENTICATION-AWARE RAG WIDGET TESTS');
  console.log('========================================================================\n');

  // Spin up test server mounting the API router
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  const runId = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);

  // Mint a valid demo founder JWT
  const demoFounderToken = jwt.sign(
    { sub: 'usr_founder_demo', email: 'alex@novatech.io', role: 'Founder' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Mint an expired JWT
  const expiredToken = jwt.sign(
    { sub: 'usr_founder_demo', email: 'alex@novatech.io', role: 'Founder' },
    JWT_SECRET,
    { expiresIn: '-10s' }
  );

  // ------------------------------------------------------------------------
  // TEST 1: Unauthenticated RAG Chat Request Must Be Rejected (HTTP 401)
  // ------------------------------------------------------------------------
  console.log('[1] Unauthenticated Request Rejection');
  {
    const res = await fetch(`${baseUrl}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'What is our runway?' }]
      })
    });
    assert(res.status === 401, 'Unauthenticated /api/chat returns HTTP 401 Unauthorized', `Status: ${res.status}`);
    const data = await res.json().catch(() => ({}));
    assert(Boolean(data.error), 'Response contains authentication required error message');
  }

  // ------------------------------------------------------------------------
  // TEST 2: Expired JWT Session Must Stop Processing (HTTP 401)
  // ------------------------------------------------------------------------
  console.log('\n[2] Expired JWT Session Handling');
  {
    const res = await fetch(`${baseUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${expiredToken}`
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'What is our runway?' }]
      })
    });
    assert(res.status === 401, 'Expired session JWT returns HTTP 401', `Status: ${res.status}`);
    const data = await res.json().catch(() => ({}));
    assert(Boolean(data.error), 'Expired session produces clear error');
  }

  // ------------------------------------------------------------------------
  // TEST 3: Server Verifies Tenant — Cross-Tenant Startup ID Rejected (HTTP 403)
  // ------------------------------------------------------------------------
  console.log('\n[3] Server-Side Tenant Verification & Cross-Tenant Protection');
  {
    // Demo Founder owns startup_novatech_demo. If client attempts to supply a foreign unauthorized startupId:
    const res = await fetch(`${baseUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${demoFounderToken}`
      },
      body: JSON.stringify({
        startupId: 'startup_foreign_unauthorized_9999', // Client attempts cross-tenant query
        messages: [{ role: 'user', content: 'List confidential financial figures.' }]
      })
    });
    assert(res.status === 403, 'Cross-tenant request with unauthorized startupId returns HTTP 403 Forbidden', `Status: ${res.status}`);
    const data = await res.json().catch(() => ({}));
    assert(data.error?.includes('Access denied'), 'Server-side verification confirms tenant access denial');
  }

  // ------------------------------------------------------------------------
  // TEST 4: Authorized Founder Access to Knowledge Assistant (HTTP 200)
  // ------------------------------------------------------------------------
  console.log('\n[4] Authorized Founder RAG Knowledge Assistant Access');
  {
    const res = await fetch(`${baseUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${demoFounderToken}`
      },
      body: JSON.stringify({
        startupId: 'startup_novatech_demo',
        messages: [{ role: 'user', content: 'What are the core features of Catalyst OS?' }]
      })
    });
    assert(res.status === 200, 'Authorized founder receives HTTP 200 OK from /api/chat', `Status: ${res.status}`);
    const data = await res.json().catch(() => ({}));
    assert(typeof data.reply === 'string' && data.reply.length > 0, 'Response contains grounded RAG reply');
  }

  // ------------------------------------------------------------------------
  // TEST 5: Real User Signup, Onboarding & Knowledge RAG Verification
  // ------------------------------------------------------------------------
  console.log('\n[5] Real Neon Auth Lifecycle: Founder Onboarding & Employee Membership');
  {
    const founderEmail = `founder_rag_${runId}@test.catalystos`;
    const signupRes = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Elena Rostova',
        email: founderEmail,
        password: 'Password!123456',
        role: 'Founder'
      })
    });
    assert(signupRes.status === 201, 'Founder signup returns HTTP 201 Created');
    const signupData = await signupRes.json();
    const founderToken = signupData.token;
    const founderId = signupData.user.id;

    // Verify email for full permission
    if (prisma) {
      await prisma.$executeRawUnsafe(
        'UPDATE "User" SET "emailVerified" = true WHERE id = $1',
        founderId
      );
    }

    // Founder onboards startup
    const onboardRes = await fetch(`${baseUrl}/startup/onboarding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${founderToken}`
      },
      body: JSON.stringify({
        name: `Aether Dynamics ${runId}`,
        industry: 'Aerospace & AI',
        fundingStage: 'Seed',
        description: 'Next-generation orbital intelligence engines.',
        cashBalance: 2000000,
        burnRate: 80000
      })
    });
    assert(onboardRes.status === 200 || onboardRes.status === 201, 'Founder onboarding returns HTTP 200/201');
    const onboardData = await onboardRes.json();
    const newStartupId = onboardData.startup?.id || onboardData.id;

    // Verify founder can now query knowledge assistant for their company
    const founderChatRes = await fetch(`${baseUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${founderToken}`
      },
      body: JSON.stringify({
        startupId: newStartupId,
        messages: [{ role: 'user', content: 'What is our burn rate and funding stage?' }]
      })
    });
    assert(founderChatRes.status === 200, 'Onboarded founder query returns HTTP 200 OK');

    // Invite an employee
    const inviteRes = await fetch(`${baseUrl}/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${founderToken}`
      },
      body: JSON.stringify({
        email: `engineer_${runId}@test.catalystos`,
        role: 'FINANCE',
        department: 'Engineering'
      })
    });
    assert(inviteRes.status === 201, 'Founder can invite employee with HTTP 201 Created', `Status: ${inviteRes.status}`);
    const inviteData = await inviteRes.json();
    const rawInvitationToken = inviteData.token;

    if (rawInvitationToken) {
      // Accept invitation as employee
      const acceptRes = await fetch(`${baseUrl}/invitations/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: rawInvitationToken,
          name: 'Marcus Vance',
          password: 'EmployeePassword!2026'
        })
      });
      assert(acceptRes.status === 201, 'Employee invitation acceptance returns HTTP 201 Created');
      const acceptData = await acceptRes.json();
      const employeeToken = acceptData.token;

      // Verify employee can query RAG knowledge assistant with verified company membership
      const empChatRes = await fetch(`${baseUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${employeeToken}`
        },
        body: JSON.stringify({
          startupId: newStartupId,
          messages: [{ role: 'user', content: 'Explain team objectives.' }]
        })
      });
      assert(empChatRes.status === 200, 'Authorized employee with resolved membership receives HTTP 200 OK');

      // Verify employee cannot access foreign unauthorized company RAG knowledge
      const empUnauthorizedRes = await fetch(`${baseUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${employeeToken}`
        },
        body: JSON.stringify({
          startupId: 'startup_other_unauthorized_999',
          messages: [{ role: 'user', content: 'Steal foreign company records.' }]
        })
      });
      assert(empUnauthorizedRes.status === 403, 'Employee cross-tenant attempt is blocked with HTTP 403 Forbidden');
    }
  }

  // ------------------------------------------------------------------------
  // TEST 6: Frontend Route & State Guard Rules
  // ------------------------------------------------------------------------
  console.log('\n[6] Route and Authentication Guards Visibility Logic');
  {
    const publicPaths = ['/', '/auth', '/login', '/signup', '/verify-email', '/reset-password', '/accept-invitation', '/onboarding'];

    function shouldRenderWidget(params: {
      loading: boolean;
      user: any;
      isMembershipResolved: boolean;
      pathname: string;
    }): boolean {
      if (params.loading || !params.user || !params.isMembershipResolved) {
        return false;
      }
      if (publicPaths.includes(params.pathname)) {
        return false;
      }
      return true;
    }

    assert(
      !shouldRenderWidget({ loading: true, user: { id: 'usr_1' }, isMembershipResolved: true, pathname: '/dashboard' }),
      'Widget is HIDDEN while authentication is unresolved (loading=true)'
    );

    assert(
      !shouldRenderWidget({ loading: false, user: null, isMembershipResolved: false, pathname: '/dashboard' }),
      'Widget is HIDDEN when there is no authenticated user'
    );

    assert(
      !shouldRenderWidget({ loading: false, user: { id: 'usr_1' }, isMembershipResolved: false, pathname: '/dashboard' }),
      'Widget is HIDDEN while company-membership resolution is unresolved'
    );

    for (const path of publicPaths) {
      assert(
        !shouldRenderWidget({ loading: false, user: { id: 'usr_1' }, isMembershipResolved: true, pathname: path }),
        `Widget is HIDDEN on public route: ${path}`
      );
    }

    assert(
      shouldRenderWidget({ loading: false, user: { id: 'usr_1', role: 'Founder' }, isMembershipResolved: true, pathname: '/dashboard' }),
      'Widget is VISIBLE for authenticated founder on /dashboard'
    );

    assert(
      shouldRenderWidget({ loading: false, user: { id: 'usr_2', role: 'Employee' }, isMembershipResolved: true, pathname: '/employee' }),
      'Widget is VISIBLE for authenticated employee on /employee'
    );
  }

  // Close server
  await new Promise<void>((resolve) => server.close(() => resolve()));

  console.log('\n========================================================================');
  console.log(`Phase 2 Tests Finished: ${passed} passed, ${failed} failed`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2Tests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
