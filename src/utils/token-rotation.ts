import RedisService from '@services/redis.service';
const redis = RedisService.getInstance();

// Invalidate all token families for user
export async function invalidateAllTokenFamilies(userId: number): Promise<void> {
  const pattern = `session:token-family:${userId}:*`;
  const familyKeys = await redis.keys(pattern);

  if (familyKeys.length > 0) {
    await redis.del(familyKeys);
  }

  // Also delete direct refresh token
  const tokenKey = `session:refresh:${userId}`;
  await redis.del(tokenKey);
}

// Get active token families count for user
export async function getActiveTokenFamiliesCount(userId: number): Promise<number> {
  const pattern = `session:token-family:${userId}:*`;
  const familyKeys = await redis.keys(pattern);
  return familyKeys.length;
}

export default {
  invalidateAllTokenFamilies,
  getActiveTokenFamiliesCount,
};
