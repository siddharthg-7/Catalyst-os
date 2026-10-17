import { prisma, safeDbQuery } from './dbService';
import { resolveMembership } from './membershipService';
import { getTaskByIdForUser } from './taskDelegationService';
import { isS3Configured, getPresignedDownloadUrl } from './s3Service';

export interface DocumentDownloadAuthResult {
  allowed: boolean;
  statusCode?: number;
  errorCode?: string;
  errorMessage?: string;
  doc?: any;
  downloadUrl?: string;
  filename?: string;
  offline?: boolean;
}

/**
 * Authorizes and generates download access for a company document or task attachment.
 * Strict Phase 8 Company Isolation & Authorization Guarantees:
 * 1. Zero Trust: Caller identity derived strictly from authenticated user ID via resolveMembership.
 * 2. Cross-Company Isolation: If document does not belong to caller's company, returns 404 (indistinguishable, no metadata leakage).
 * 3. Role & Scope Permissions: If document has accessScope !== 'ALL' and caller is not Founder/Admin, blocks unauthorized downloads (403).
 * 4. Task Attachment Permissions: If document is tied to a restricted task, verifies caller has task access permissions (403/404).
 */
export async function authorizeDocumentDownload(
  userId: string,
  documentId: string
): Promise<DocumentDownloadAuthResult> {
  if (!userId) {
    return {
      allowed: false,
      statusCode: 401,
      errorCode: 'UNAUTHORIZED',
      errorMessage: 'Authentication required.'
    };
  }

  // 1. Resolve company membership
  const membership = await resolveMembership(userId);
  if (!membership || !membership.startupId) {
    return {
      allowed: false,
      statusCode: 403,
      errorCode: 'NO_MEMBERSHIP',
      errorMessage: 'No active company membership.'
    };
  }

  // 2. Fetch document scoped strictly to caller's company
  const doc = await safeDbQuery(async () => {
    return await (prisma as any).startupDocument.findFirst({
      where: {
        id: documentId,
        startupId: membership.startupId
      }
    });
  });

  if (!doc) {
    return {
      allowed: false,
      statusCode: 404,
      errorCode: 'NOT_FOUND',
      errorMessage: 'Document not found in this company workspace.'
    };
  }

  // 3. Permission Verification: Verify accessScope
  const callerRole = (membership.role || 'EMPLOYEE').toUpperCase();
  const isPrivileged = callerRole === 'FOUNDER' || callerRole === 'ADMIN';
  const accessScope = (doc.accessScope || 'ALL').toUpperCase();

  if (!isPrivileged && accessScope !== 'ALL') {
    if (accessScope === 'FOUNDER_ONLY' || accessScope !== callerRole) {
      return {
        allowed: false,
        statusCode: 403,
        errorCode: 'UNAUTHORIZED_DOCUMENT_ACCESS',
        errorMessage: `Forbidden: Document access is restricted to ${accessScope}.`
      };
    }
  }

  // 4. If this document is linked to a task, verify caller task permissions
  if (doc.sourceType === 'TASK_DOCUMENT' && doc.sourceRecordId) {
    try {
      await getTaskByIdForUser(userId, doc.sourceRecordId);
    } catch (taskErr: any) {
      return {
        allowed: false,
        statusCode: taskErr.statusCode || 403,
        errorCode: taskErr.code || 'UNAUTHORIZED_TASK_ACCESS',
        errorMessage: taskErr.message || 'Unauthorized task document access.'
      };
    }
  }

  // 5. Generate secure presigned URL or offline fallback
  let downloadUrl: string;
  let offline = false;

  if (!isS3Configured()) {
    downloadUrl = `#offline-download-${doc.id}`;
    offline = true;
  } else {
    try {
      const keyMatch = (doc.summary || '').match(/StorageKey:\s*([^\s]+)/);
      const sanitized = doc.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const s3Key = keyMatch ? keyMatch[1] : `documents/${sanitized}`;
      downloadUrl = await getPresignedDownloadUrl(s3Key, 900); // 15 mins validity
    } catch (s3Err: any) {
      downloadUrl = `#offline-download-${doc.id}`;
      offline = true;
    }
  }

  return {
    allowed: true,
    doc,
    downloadUrl,
    filename: doc.name,
    offline
  };
}
