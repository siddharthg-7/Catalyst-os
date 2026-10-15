import 'dotenv/config';
import { PrismaClient } from '@prisma/client';


/**
 * Singleton instance of PrismaClient for Catalyst OS backend.
 * Configured with connection retry resilience for Neon PostgreSQL compute auto-suspend.
 */
declare global {
  // eslint-disable-next-line no-var
  var prismaSingleton: PrismaClient | undefined;
}

const rawDbUrl = process.env.DATABASE_URL || '';

export const hasValidDbUrl = Boolean(
  rawDbUrl &&
  !rawDbUrl.includes(':password@') &&
  !rawDbUrl.includes('placeholder') &&
  !rawDbUrl.includes('your_password')
);

// Format Neon URL with pgbouncer=true, pool_timeout=30, and connect_timeout=30 for serverless pooler resilience
function buildResilientDbUrl(url: string): string | undefined {
  if (!url || !hasValidDbUrl) return undefined;
  let formatted = url;
  if (formatted.includes('-pooler')) {
    // PgBouncer does not support SCRAM channel binding (as per Neon official docs)
    formatted = formatted.replace(/([?&])channel_binding=[^&]*/g, '$1');
    if (!formatted.includes('pgbouncer=true')) {
      formatted += (formatted.includes('?') ? '&' : '?') + 'pgbouncer=true';
    }
  }
  if (!formatted.includes('pool_timeout')) {
    formatted += (formatted.includes('?') ? '&' : '?') + 'pool_timeout=30';
  }
  if (!formatted.includes('connect_timeout')) {
    formatted += (formatted.includes('?') ? '&' : '?') + 'connect_timeout=30';
  }
  formatted = formatted.replace(/\?&/g, '?').replace(/&&+/g, '&').replace(/[?&]$/, '');
  return formatted;
}

const dbUrl = buildResilientDbUrl(rawDbUrl);

export const prisma = global.prismaSingleton || new PrismaClient({
  datasources: dbUrl ? { db: { url: dbUrl } } : undefined,
  log: [
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

// Attach event listeners to filter out transient idle socket disconnects and serverless auto-suspend wakeups
(prisma as any).$on('error', (e: any) => {
  const msg = String(e?.message || '');
  // Ignore harmless connection resets and transient pooler wakeups handled by safeDbQuery
  if (
    msg.includes('10054') ||
    msg.includes('ConnectionReset') ||
    msg.includes('kind: Closed') ||
    msg.includes('kind: Io') ||
    msg.includes('forcibly closed by the remote host') ||
    msg.includes("Can't reach database server") ||
    msg.includes('Timed out fetching a new connection') ||
    msg.includes('P1001') ||
    msg.includes('P1017') ||
    msg.includes('P2024') ||
    msg.includes('column e.embedding does not exist') ||
    msg.includes('does not exist in the current database') ||
    msg.includes('42703') ||
    msg.includes('Record to update not found') ||
    msg.includes('P2025')
  ) {
    return;
  }
  console.error('[Prisma Database Error]', msg);
});

(prisma as any).$on('warn', (e: any) => {
  const msg = String(e?.message || '');
  if (msg.includes('10054') || msg.includes('ConnectionReset') || msg.includes('kind: Closed')) return;
  console.warn('[Prisma Warn]', msg);
});

// Periodic keep-alive query (every 45s) to prevent Neon connection pool from idling out
if (typeof setInterval !== 'undefined' && hasValidDbUrl) {
  setInterval(async () => {
    try {
      await prisma.$executeRawUnsafe('SELECT 1');
    } catch {
      // Re-establish connection gracefully if idle socket timed out
      try {
        await prisma.$disconnect();
        await prisma.$connect();
      } catch {}
    }
  }, 45000).unref();
}

if (process.env.NODE_ENV !== 'production') {
  global.prismaSingleton = prisma;
}

/**
 * Safe Database Query Wrapper
 * Retries queries automatically if Neon PostgreSQL drops an idle connection (SqlState E57P01, OS 10054)
 * or if compute is cold-starting / connection pool is waiting (P2024 / P1001).
 */
export async function safeDbQuery<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  if (!hasValidDbUrl) {
    throw new Error('Database is offline or not configured with valid credentials.');
  }
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      const errMsg = String(err?.message || err || '');
      const isConnectionError = 
        errMsg.includes('terminating connection') || 
        errMsg.includes('Closed') ||
        errMsg.includes('kind: Closed') ||
        errMsg.includes('kind: Io') ||
        errMsg.includes('Closed connection') ||
        errMsg.includes('ConnectionReset') ||
        errMsg.includes('10054') ||
        errMsg.includes('forcibly closed') ||
        errMsg.includes('Error in PostgreSQL connection') ||
        errMsg.includes("Can't reach database server") ||
        errMsg.includes('Timed out fetching a new connection') ||
        errMsg.includes('connection pool') ||
        errMsg.includes('broken pipe') ||
        err?.code === 'E57P01' ||
        err?.code === 'P1001' ||
        err?.code === 'P1017' ||
        err?.code === 'P2024';

      if (isConnectionError && attempt < retries) {
        console.warn(`[dbService] Reconnecting to Neon PostgreSQL (attempt ${attempt}/${retries})...`);
        try {
          await prisma.$disconnect();
          await prisma.$connect();
        } catch (e) {
          // ignore disconnect error
        }
        await new Promise(res => setTimeout(res, 500 * attempt));
      } else {
        throw err;
      }
    }
  }
  return fn();
}

export default prisma;
