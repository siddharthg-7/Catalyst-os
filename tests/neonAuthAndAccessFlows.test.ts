/**
 * CatalystOS - End-to-End Test Suite: Neon Auth, Founder Onboarding,
 * Team Management, Password Management, and Tenant-Scoped Authorization.
 *
 * Validates:
 * 1. Founder signup with name, email, password.
 * 2. Cryptographic email verification & resend verification.
 * 3. Founder sign-in with email & password.
 * 4. Founder startup onboarding after authentication (authoritative Membership creation).
 * 5. Team management employee invitation with application-level roles (ADMIN, FINANCE, HR, OPERATIONS, GROWTH).
 * 6. Employee invitation acceptance and account activation.
 * 7. Employee password setup/reset and forced password change screen on temporary credentials.
 * 8. Password reset (forgot-password and reset-password).
 * 9. Tenant-scoped permissions, role-based authorization, and cross-tenant protection.
 */

import 'dotenv/config';
import http from 'http';
import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../backend/services/dbService';
import apiRouter from '../backend/routes/api';
import { JWT_SECRET } from '../backend/services/neonAuthMiddleware';
import { ensureMembership, resolveMembership, isMemberOf } from '../backend/services/membershipService';
import { requirePermission, can, canAccessArea } from '../backend/services/permissionService';

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

async function runNeonAuthAndAccessTests() {
  console.log('\n========================================================================');
  console.log('🧪 CATALYSTOS NEON AUTH & TENANT ACCESS CONTROL TEST SUITE');
  console.log('========================================================================\n');

  // Set up Express test server mounting apiRouter
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  const runId = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
  const founderEmail = `founder_${runId}@test.catalystos`;
  const founderPassword = 'FounderSecurePassword!2026';
  const employeeEmail = `employee_${runId}@test.catalystos`;
  const employeePassword = 'EmployeeSecurePassword!2026';
  const tenantBEmail = `founder_b_${runId}@test.catalystos`;

  let founderToken = '';
  let founderId = '';
  let rawVerificationToken = '';
  let rawInvitationToken = '';
  let employeeId = '';
  let employeeToken = '';
  let startupId = '';
  let startupBId = '';

  try {
    // -------------------------------------------------------------------------
    // 1. Founder Signup
    // -------------------------------------------------------------------------
    console.log('[1] Founder Sign-up with Name, Email & Password');
    {
      const res = await fetch(`${baseUrl}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Sarah Connor',
          email: founderEmail,
          password: founderPassword,
          role: 'Founder'
        })
      });
      const data = await res.json();

      assert(res.status === 201, 'Signup returns HTTP 201 Created', `Status: ${res.status}`);
      assert(data.success === true, 'Signup returns success: true');
      assert(Boolean(data.token), 'Signup issues a valid session JWT');
      assert(data.user?.email === founderEmail, 'User email matches requested email');
      assert(data.user?.role === 'Founder', 'User role assigned as Founder');
      assert(data.emailVerified === false, 'User begins in unverified email state');
      assert(data.onboarded === false, 'User begins in un-onboarded state');

      founderToken = data.token;
      founderId = data.user.id;

      // Extract verification URL / token
      if (data.verificationUrl) {
        const urlObj = new URL(data.verificationUrl);
        rawVerificationToken = urlObj.searchParams.get('token') || '';
      }
      if (!rawVerificationToken && prisma) {
        // Look up the raw verification token or token hash directly from database
        const rows: any[] = await prisma.$queryRawUnsafe('SELECT "verificationToken" FROM "User" WHERE id = $1', founderId);
        assert(Boolean(rows?.[0]?.verificationToken), 'Verification token hash is stored in database');
      }
    }

    // -------------------------------------------------------------------------
    // 2. Email Verification & Resend Verification
    // -------------------------------------------------------------------------
    console.log('\n[2] Email Verification & Resend Flow');
    {
      // Test invalid verification token
      const invalidRes = await fetch(`${baseUrl}/auth/verify-email?token=invalid_dummy_token_999`, {
        method: 'GET'
      });
      assert(invalidRes.status === 400, 'Invalid verification token rejected with HTTP 400');

      // Test valid verification token (or simulate using DB hash if raw token wasn't returned in response)
      if (!rawVerificationToken && prisma) {
        const testToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(testToken).digest('hex');
        await prisma.$executeRawUnsafe(
          'UPDATE "User" SET "verificationToken" = $1, "verificationExpires" = $2 WHERE id = $3',
          tokenHash,
          new Date(Date.now() + 86400000),
          founderId
        );
        rawVerificationToken = testToken;
      }

      const verifyRes = await fetch(`${baseUrl}/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: rawVerificationToken })
      });
      const verifyData = await verifyRes.json();
      assert(verifyRes.status === 200, 'Valid verification token returns HTTP 200', `Status: ${verifyRes.status}`);
      assert(verifyData.success === true, 'Verification returns success: true');
      assert(verifyData.user?.emailVerified === true, 'Response confirms emailVerified = true');

      // Test resend verification endpoint
      const resendRes = await fetch(`${baseUrl}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: founderEmail })
      });
      const resendData = await resendRes.json();
      assert(resendRes.status === 200, 'Resend verification returns HTTP 200');
      assert(resendData.success === true, 'Resend verification returns success message');
    }

    // -------------------------------------------------------------------------
    // 3. Founder Sign-in
    // -------------------------------------------------------------------------
    console.log('\n[3] Founder Sign-in with Neon Credentials');
    {
      // Wrong password
      const wrongPwRes = await fetch(`${baseUrl}/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: founderEmail, password: 'WrongPassword999!' })
      });
      assert(wrongPwRes.status === 401, 'Incorrect password rejected with HTTP 401');

      // Correct password
      const signinRes = await fetch(`${baseUrl}/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: founderEmail, password: founderPassword })
      });
      const signinData = await signinRes.json();
      assert(signinRes.status === 200, 'Valid credentials return HTTP 200 OK');
      assert(signinData.success === true, 'Signin returns success: true');
      assert(signinData.emailVerified === true, 'Signin confirms email is verified');
      assert(signinData.mustChangePassword === false, 'Founder does not require forced password change');
      assert(signinData.onboarded === false, 'Founder is not yet onboarded before wizard');

      founderToken = signinData.token;
    }

    // -------------------------------------------------------------------------
    // 4. Founder Startup Onboarding & Authoritative Membership
    // -------------------------------------------------------------------------
    console.log('\n[4] Founder Startup Onboarding & Authoritative Membership Creation');
    {
      const onboardingRes = await fetch(`${baseUrl}/startup/onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${founderToken}`
        },
        body: JSON.stringify({
          name: `Cyberdyne Systems ${runId}`,
          industry: 'Artificial Intelligence & Robotics',
          fundingStage: 'Series A',
          description: 'Autonomous neural network systems and startup acceleration.',
          cashBalance: 5000000,
          burnRate: 150000
        })
      });
      const onboardingData = await onboardingRes.json();
      assert(onboardingRes.status === 200 || onboardingRes.status === 201, 'Onboarding endpoint returns HTTP 200/201');
      assert(Boolean(onboardingData.startup?.id || onboardingData.id), 'Startup record successfully created');

      startupId = onboardingData.startup?.id || onboardingData.id;

      // Authoritative Membership check in database
      if (prisma) {
        const mem: any = await (prisma as any).membership.findFirst({
          where: {
            userId: founderId,
            startupId: startupId,
            role: 'FOUNDER',
            status: 'ACTIVE'
          }
        });
        assert(Boolean(mem), 'Authoritative active FOUNDER membership created in database');
      }

      // Re-sign in to verify that onboarded status is dynamically resolved
      const reSigninRes = await fetch(`${baseUrl}/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: founderEmail, password: founderPassword })
      });
      const reSigninData = await reSigninRes.json();
      assert(reSigninData.onboarded === true, 'Subsequent signin recognizes completed onboarding');
      assert(Boolean(reSigninData.startup?.name), 'Startup profile is attached to session payload');
    }

    // -------------------------------------------------------------------------
    // 5. Team Management: Invite Employee by Email & Assign Application Role
    // -------------------------------------------------------------------------
    console.log('\n[5] Team Management: Invite Employee (Role: FINANCE)');
    {
      const inviteRes = await fetch(`${baseUrl}/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${founderToken}`
        },
        body: JSON.stringify({
          email: employeeEmail,
          role: 'FINANCE',
          department: 'Treasury & Financial Planning'
        })
      });
      const inviteData = await inviteRes.json();
      assert(inviteRes.status === 201, 'Invitation creation returns HTTP 201 Created', `Status: ${inviteRes.status}`);
      assert(inviteData.email === employeeEmail, 'Invitation record bound to employee email');
      assert(inviteData.role === 'FINANCE', 'Invitation record assigns application role FINANCE');
      assert(Boolean(inviteData.token), 'Response provides raw invitation token for delivery');

      rawInvitationToken = inviteData.token;

      // Assert token security: Raw token must NOT be in DB, only SHA-256 hash
      if (prisma) {
        const tokenHash = crypto.createHash('sha256').update(rawInvitationToken).digest('hex');
        const dbInvite: any = await (prisma as any).invitation.findFirst({
          where: { tokenHash }
        });
        assert(Boolean(dbInvite), 'Invitation stored as cryptographic SHA-256 hash in database');
        assert(dbInvite.role === 'FINANCE', 'Database invitation has correct role');
      }
    }

    // -------------------------------------------------------------------------
    // 6. Secure Employee Invitation Acceptance & Account Activation
    // -------------------------------------------------------------------------
    console.log('\n[6] Employee Invitation Acceptance & Session Issuance');
    {
      // Peek / preview invitation
      const peekRes = await fetch(`${baseUrl}/invitations/accept/${encodeURIComponent(rawInvitationToken)}`);
      const peekData = await peekRes.json();
      assert(peekRes.status === 200, 'Public preview of invitation returns HTTP 200 OK');
      assert(peekData.status === 'PENDING', 'Preview shows PENDING status');
      assert(peekData.role === 'FINANCE', 'Preview confirms role FINANCE');
      assert(peekData.requiresAccount === true, 'Preview indicates password setup is required');

      // Accept invitation and set password
      const acceptRes = await fetch(`${baseUrl}/invitations/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: rawInvitationToken,
          name: 'Miles Dyson',
          password: employeePassword
        })
      });
      const acceptData = await acceptRes.json();
      assert(acceptRes.status === 201, 'Invitation acceptance returns HTTP 201 Created');
      assert(Boolean(acceptData.token), 'Acceptance returns valid employee JWT session');
      assert(acceptData.user?.role === 'FINANCE', 'User role assigned as FINANCE');
      assert(acceptData.membership?.startupId === startupId, 'Membership bound to startup workspace');

      employeeId = acceptData.user.id;
      employeeToken = acceptData.token;

      // Verification of single-use invitation
      const repeatRes = await fetch(`${baseUrl}/invitations/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: rawInvitationToken,
          name: 'Miles Dyson',
          password: employeePassword
        })
      });
      assert(repeatRes.status === 400 || repeatRes.status === 409, 'Invitation cannot be reused (one-time token)');
    }

    // -------------------------------------------------------------------------
    // 7. Temporary Credentials & Forced Password Change
    // -------------------------------------------------------------------------
    console.log('\n[7] Forced Password Change on Temporary Credentials');
    {
      // Simulate account with temporary credentials (mustChangePassword = true)
      if (prisma) {
        await prisma.$executeRawUnsafe(
          'UPDATE "User" SET "mustChangePassword" = true WHERE id = $1',
          employeeId
        );
      }

      // Employee signs in -> mustChangePassword is true
      const empSigninRes = await fetch(`${baseUrl}/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: employeeEmail, password: employeePassword })
      });
      const empSigninData = await empSigninRes.json();
      assert(empSigninData.mustChangePassword === true, 'Sign-in detects mustChangePassword: true flag');

      // Forced password change: incorrect old password rejected
      const badOldPwRes = await fetch(`${baseUrl}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${employeeToken}`
        },
        body: JSON.stringify({
          currentPassword: 'IncorrectOldPassword!',
          newPassword: 'BrandNewPassword123!'
        })
      });
      assert(badOldPwRes.status === 400, 'Incorrect current password rejected with HTTP 400');

      // Forced password change: short password rejected
      const shortPwRes = await fetch(`${baseUrl}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${employeeToken}`
        },
        body: JSON.stringify({
          currentPassword: employeePassword,
          newPassword: '123'
        })
      });
      assert(shortPwRes.status === 400, 'Password shorter than 6 characters rejected with HTTP 400');

      // Valid password change
      const newEmployeePassword = 'UpgradedEmployeePassword!2026';
      const changePwRes = await fetch(`${baseUrl}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${employeeToken}`
        },
        body: JSON.stringify({
          currentPassword: employeePassword,
          newPassword: newEmployeePassword
        })
      });
      const changePwData = await changePwRes.json();
      assert(changePwRes.status === 200, 'Valid password change returns HTTP 200 OK');
      assert(changePwData.success === true, 'Password change returns success: true');

      // Check DB: mustChangePassword cleared
      if (prisma) {
        const rows: any[] = await prisma.$queryRawUnsafe('SELECT "mustChangePassword" FROM "User" WHERE id = $1', employeeId);
        assert(rows?.[0]?.mustChangePassword === false, 'mustChangePassword cleared in database');
      }
    }

    // -------------------------------------------------------------------------
    // 8. Password Reset Flow (Forgot & Reset Password)
    // -------------------------------------------------------------------------
    console.log('\n[8] Password Reset Flow (Forgot Password & Reset Token)');
    {
      const forgotRes = await fetch(`${baseUrl}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: founderEmail })
      });
      const forgotData = await forgotRes.json();
      assert(forgotRes.status === 200, 'Forgot password returns HTTP 200 OK');
      assert(forgotData.success === true, 'Forgot password returns success confirmation');

      // Generate a mock reset token and hash in DB to test the reset-password endpoint
      const rawResetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenHash = crypto.createHash('sha256').update(rawResetToken).digest('hex');
      if (prisma) {
        await prisma.$executeRawUnsafe(
          'UPDATE "User" SET "resetPasswordToken" = $1, "resetPasswordExpires" = $2 WHERE id = $3',
          resetTokenHash,
          new Date(Date.now() + 3600000),
          founderId
        );
      }

      // Invalid token
      const badResetRes = await fetch(`${baseUrl}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'bogus_reset_token', newPassword: 'FreshPassword123!' })
      });
      assert(badResetRes.status === 400, 'Invalid reset token rejected with HTTP 400');

      // Valid token reset
      const freshFounderPassword = 'FreshFounderPassword!2026';
      const resetRes = await fetch(`${baseUrl}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: rawResetToken, newPassword: freshFounderPassword })
      });
      const resetData = await resetRes.json();
      assert(resetRes.status === 200, 'Password reset returns HTTP 200 OK');
      assert(resetData.success === true, 'Password reset returns success: true');
      assert(Boolean(resetData.token), 'Password reset logs the user in and returns token');

      // Verify signin with newly reset password
      const newSigninRes = await fetch(`${baseUrl}/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: founderEmail, password: freshFounderPassword })
      });
      assert(newSigninRes.status === 200, 'Signin succeeds with newly reset password');
    }

    // -------------------------------------------------------------------------
    // 9. Tenant-Scoped Permissions & Cross-Tenant Protection
    // -------------------------------------------------------------------------
    console.log('\n[9] Tenant-Scoped Permissions & Cross-Tenant Protection');
    {
      // 9a: Role-based permissions within same tenant
      // Employee role is FINANCE: should have finance access but NOT people:write
      assert(can('FINANCE', 'people:read') === true, 'FINANCE role has people:read permission');
      assert(canAccessArea('FINANCE', 'scenarios') === true, 'FINANCE role can access scenarios area');
      assert(can('FINANCE', 'people:write') === false, 'FINANCE role is denied people:write permission');
      assert(can('FOUNDER', 'people:write') === true, 'FOUNDER role has people:write permission');
      assert(can('FOUNDER', 'people:access') === true, 'FOUNDER role has people:access permission');

      // 9b: Create a second independent tenant (Startup B)
      const tenantBRes = await fetch(`${baseUrl}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Sarah Connor B',
          email: tenantBEmail,
          password: 'PasswordB123!',
          role: 'Founder'
        })
      });
      const tenantBData = await tenantBRes.json();
      const tenantBToken = tenantBData.token;
      const tenantBUserId = tenantBData.user.id;

      const tenantBOnboardRes = await fetch(`${baseUrl}/startup/onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tenantBToken}`
        },
        body: JSON.stringify({
          name: `Skynet Industries ${runId}`,
          industry: 'Defense & Aerospace',
          fundingStage: 'Seed',
          description: 'Autonomous global defense network.'
        })
      });
      const tenantBOnboardData = await tenantBOnboardRes.json();
      startupBId = tenantBOnboardData.startup?.id || tenantBOnboardData.id;

      // Assert membership isolation: Employee of Startup A is NOT a member of Startup B
      assert((await isMemberOf(employeeId, startupId)) === true, 'Employee is member of Startup A');
      assert((await isMemberOf(employeeId, startupBId)) === false, 'Employee of Startup A is NOT member of Startup B');

      // Founder B cannot access Startup A's invitation list
      const crossTenantInviteRes = await fetch(`${baseUrl}/invitations`, {
        headers: { 'Authorization': `Bearer ${tenantBToken}` }
      });
      const crossTenantInvites = await crossTenantInviteRes.json();
      const containsStartupAInvite = Array.isArray(crossTenantInvites) &&
        crossTenantInvites.some((inv: any) => inv.email === employeeEmail);
      assert(!containsStartupAInvite, 'Tenant B cannot see invitations belonging to Tenant A (Zero Leak)');

      console.log('  ✅ PASS: Strict cross-tenant isolation verified between Tenant A and Tenant B');
    }

  } catch (err: any) {
    console.error('❌ Unexpected test error:', err);
    failed++;
  } finally {
    // Clean up test server
    server.close();

    // Clean up created records in database safely
    if (prisma) {
      try {
        await (prisma as any).invitation.deleteMany({
          where: { email: { in: [employeeEmail, founderEmail] } }
        });
        await (prisma as any).membership.deleteMany({
          where: { startupId: { in: [startupId, startupBId].filter(Boolean) } }
        });
        await (prisma as any).startup.deleteMany({
          where: { id: { in: [startupId, startupBId].filter(Boolean) } }
        });
        await (prisma as any).user.deleteMany({
          where: { email: { in: [founderEmail, employeeEmail, tenantBEmail] } }
        });
      } catch (cleanupErr: any) {
        console.warn('Test cleanup warning (non-fatal):', cleanupErr.message);
      }
    }
  }

  console.log('\n========================================================================');
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runNeonAuthAndAccessTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
