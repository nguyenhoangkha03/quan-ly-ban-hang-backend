import { generateRefreshToken } from './jwt';
import RedisService, { CachePrefix } from '@services/redis.service';
import { AuthenticationError } from './errors';
import { JwtPayload } from '@custom-types/common.type';

/**
 * Refresh Token Rotation Utilities
 *
 * Implements automatic token rotation for enhanced security
 * - Each refresh generates a new refresh token
 * - Old refresh tokens are invalidated
 * - Detects token reuse (potential theft)
 */

const redis = RedisService.getInstance();
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days
const REFRESH_TOKEN_FAMILY_TTL = 30 * 24 * 60 * 60; // 30 days

interface TokenFamily {
  tokens: string[];
  createdAt: number;
  lastRotated: number;
}

/**
 * Generate token family ID
 */
function generateFamilyId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Store refresh token in family
 *
 * @param userId - User ID
 * @param refreshToken - Refresh token
 * @param familyId - Token family ID (optional, creates new family if not provided)
 * @returns Family ID
 */
export async function storeRefreshToken(
  userId: number,
  refreshToken: string,
  familyId?: string
): Promise<string> {
  const fid = familyId || generateFamilyId();
  const familyKey = `${CachePrefix.SESSION}token-family:${userId}:${fid}`;

  // Get existing family or create new
  let family = await redis.get<TokenFamily>(familyKey);

  if (!family) {
    family = {
      tokens: [refreshToken],
      createdAt: Date.now(),
      lastRotated: Date.now(),
    };
  } else {
    // Add new token to family
    family.tokens.push(refreshToken);
    family.lastRotated = Date.now();

    // Keep only last 5 tokens in family (for grace period)
    if (family.tokens.length > 5) {
      family.tokens = family.tokens.slice(-5);
    }
  }

  // Store family
  await redis.set(familyKey, family, REFRESH_TOKEN_FAMILY_TTL);

  // Also store token directly for quick lookup
  const tokenKey = `${CachePrefix.SESSION}refresh:${userId}`;
  await redis.set(tokenKey, refreshToken, REFRESH_TOKEN_TTL);

  return fid;
}

/**
 * Verify refresh token and check if it belongs to valid family
 *
 * @param userId - User ID
 * @param refreshToken - Refresh token to verify
 * @returns Family ID if valid, throws error if invalid or reused
 */
export async function verifyRefreshTokenFamily(
  userId: number,
  refreshToken: string
): Promise<string> {
  // Get all token families for user
  const pattern = `${CachePrefix.SESSION}token-family:${userId}:*`;
  const familyKeys = await redis.keys(pattern);

  if (familyKeys.length === 0) {
    throw new AuthenticationError('Invalid refresh token');
  }

  // Check each family for this token
  for (const familyKey of familyKeys) {
    const family = await redis.get<TokenFamily>(familyKey);

    if (!family) continue;

    const tokenIndex = family.tokens.indexOf(refreshToken);

    if (tokenIndex !== -1) {
      // Token found in family

      // Check if this is the latest token
      const isLatestToken = tokenIndex === family.tokens.length - 1;

      if (!isLatestToken) {
        // Token reuse detected! This could be a theft attempt
        // Invalidate entire family
        await invalidateTokenFamily(userId, familyKey.split(':').pop()!);
        throw new AuthenticationError(
          'Token reuse detected. All sessions have been invalidated for security.'
        );
      }

      // Return family ID
      return familyKey.split(':').pop()!;
    }
  }

  throw new AuthenticationError('Invalid refresh token');
}

/**
 * Rotate refresh token
 *
 * @param userId - User ID
 * @param oldRefreshToken - Old refresh token
 * @param payload - JWT payload
 * @returns New refresh token
 */
export async function rotateRefreshToken(
  userId: number,
  oldRefreshToken: string,
  payload: JwtPayload
): Promise<{ refreshToken: string; familyId: string }> {
  // Verify old token belongs to valid family
  const familyId = await verifyRefreshTokenFamily(userId, oldRefreshToken);

  // Generate new refresh token
  const newRefreshToken = generateRefreshToken(payload);

  // Store new token in same family
  await storeRefreshToken(userId, newRefreshToken, familyId);

  return {
    refreshToken: newRefreshToken,
    familyId,
  };
}

/**
 * Invalidate specific token family
 *
 * @param userId - User ID
 * @param familyId - Family ID to invalidate
 */
export async function invalidateTokenFamily(userId: number, familyId: string): Promise<void> {
  const familyKey = `${CachePrefix.SESSION}token-family:${userId}:${familyId}`;
  await redis.del(familyKey);
}

/**
 * Invalidate all token families for user
 *
 * @param userId - User ID
 */
export async function invalidateAllTokenFamilies(userId: number): Promise<void> {
  const pattern = `${CachePrefix.SESSION}token-family:${userId}:*`;
  const familyKeys = await redis.keys(pattern);

  if (familyKeys.length > 0) {
    await redis.del(familyKeys);
  }

  // Also delete direct refresh token
  const tokenKey = `${CachePrefix.SESSION}refresh:${userId}`;
  await redis.del(tokenKey);
}

/**
 * Get active token families count for user
 *
 * @param userId - User ID
 * @returns Number of active token families (sessions)
 */
export async function getActiveTokenFamiliesCount(userId: number): Promise<number> {
  const pattern = `${CachePrefix.SESSION}token-family:${userId}:*`;
  const familyKeys = await redis.keys(pattern);
  return familyKeys.length;
}

/**
 * Cleanup expired token families
 * Should be run periodically (cron job)
 */
export async function cleanupExpiredTokenFamilies(): Promise<number> {
  const pattern = `${CachePrefix.SESSION}token-family:*`;
  const allFamilyKeys = await redis.keys(pattern);

  let cleanedCount = 0;
  const now = Date.now();

  for (const key of allFamilyKeys) {
    const family = await redis.get<TokenFamily>(key);

    if (!family) continue;

    // Check if family is expired (30 days old)
    if (now - family.createdAt > REFRESH_TOKEN_FAMILY_TTL * 1000) {
      await redis.del(key);
      cleanedCount++;
    }
  }

  return cleanedCount;
}

export default {
  storeRefreshToken,
  verifyRefreshTokenFamily,
  rotateRefreshToken,
  invalidateTokenFamily,
  invalidateAllTokenFamilies,
  getActiveTokenFamiliesCount,
  cleanupExpiredTokenFamilies,
};
