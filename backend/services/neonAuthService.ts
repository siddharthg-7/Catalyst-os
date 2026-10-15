import 'dotenv/config';
import crypto from 'crypto';
import { User, UserRole } from '../src/models/types';

export const NEON_AUTH_BASE_URL =
  process.env.NEON_AUTH_BASE_URL ||
  'https://ep-late-mud-b42a9cnw.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth';

export const NEON_AUTH_JWKS_URL =
  process.env.NEON_AUTH_JWKS_URL ||
  `${NEON_AUTH_BASE_URL}/.well-known/jwks.json`;

interface JWKKey {
  kid: string;
  kty: string;
  alg?: string;
  crv?: string;
  x?: string;
  [key: string]: any;
}

let jwksCache: JWKKey[] = [];
let jwksLastFetched = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Fetches JWKS public keys from the Neon Auth endpoint with in-memory caching.
 */
export async function getNeonAuthJwks(): Promise<JWKKey[]> {
  const now = Date.now();
  if (jwksCache.length > 0 && now - jwksLastFetched < CACHE_TTL_MS) {
    return jwksCache;
  }

  try {
    const res = await fetch(NEON_AUTH_JWKS_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      throw new Error(`JWKS request failed with HTTP ${res.status}: ${res.statusText}`);
    }

    const data = (await res.json()) as { keys: JWKKey[] };
    if (Array.isArray(data.keys)) {
      jwksCache = data.keys;
      jwksLastFetched = now;
      console.log(`[neonAuthService] Cached ${jwksCache.length} Neon Auth JWKS keys.`);
    }
    return jwksCache;
  } catch (err: any) {
    console.warn(`[neonAuthService] Failed to fetch JWKS from ${NEON_AUTH_JWKS_URL}:`, err.message);
    return jwksCache; // return stale cache if available
  }
}

/**
 * Parses unverified JWT header and payload.
 */
function parseJwtParts(token: string): { header: any; payload: any; signature: Buffer; signingInput: string } | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    const signature = Buffer.from(parts[2], 'base64url');
    const signingInput = `${parts[0]}.${parts[1]}`;
    return { header, payload, signature, signingInput };
  } catch {
    return null;
  }
}

/**
 * Verifies a Neon Auth JWT token against the JWKS endpoint.
 */
export async function verifyNeonAuthToken(token: string): Promise<User | null> {
  const parsed = parseJwtParts(token);
  if (!parsed) return null;

  const { header, payload, signature, signingInput } = parsed;

  // Check token expiration
  if (payload.exp && Date.now() >= payload.exp * 1000) {
    return null;
  }

  const keys = await getNeonAuthJwks();
  const matchingKey = keys.find((k) => !header.kid || k.kid === header.kid);

  if (!matchingKey) {
    if (payload.iss && (payload.iss.includes('neon') || payload.iss.includes(process.env.NEON_AUTH_BASE_URL || ''))) {
      console.warn('[neonAuthService] No matching JWKS key found for Neon Auth token.');
    }
    return null;
  }

  try {
    // Import public key into Node native crypto
    const publicKey = crypto.createPublicKey({
      key: matchingKey as any,
      format: 'jwk',
    });

    const isVerified = crypto.verify(
      null, // Ed25519 doesn't use a separate digest algorithm in Node crypto
      Buffer.from(signingInput, 'utf8'),
      publicKey,
      signature
    );

    if (!isVerified) {
      console.warn('[neonAuthService] Signature verification failed.');
      return null;
    }

    const email = payload.email || `${payload.sub}@neonauth.user`;
    const name = payload.name || payload.given_name || email.split('@')[0] || 'Neon User';
    const role: UserRole = (payload.role as UserRole) || 'Founder';

    return {
      id: payload.sub || `usr_neon_${Date.now()}`,
      email,
      name,
      role,
    };
  } catch (err: any) {
    console.warn('[neonAuthService] Cryptographic verification failed:', err.message);
    return null;
  }
}

export default {
  getNeonAuthJwks,
  verifyNeonAuthToken,
  NEON_AUTH_BASE_URL,
  NEON_AUTH_JWKS_URL,
};
