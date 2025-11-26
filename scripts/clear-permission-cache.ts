import RedisService from '../src/services/redis.service';

async function main() {
  console.log('🧹 Clearing permission cache from Redis...\n');

  const redis = RedisService.getInstance();
  await redis.initialize();

  // Clear all permission cache keys
  const keys = await redis.keys('permissions:role:*');

  // Filter out empty strings
  const validKeys = keys.filter((key) => key && key.trim() !== '');

  if (validKeys.length === 0) {
    console.log('✅ No permission cache found.');
    return;
  }

  console.log(`Found ${validKeys.length} permission cache keys:`);
  validKeys.forEach((key) => console.log(`  - ${key}`));

  // Delete each key individually to avoid array issues
  for (const key of validKeys) {
    await redis.del([key]);
  }

  console.log(`\n✅ Cleared ${keys.length} permission cache keys!`);
  console.log('📝 Permissions will be reloaded from database on next request.');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
