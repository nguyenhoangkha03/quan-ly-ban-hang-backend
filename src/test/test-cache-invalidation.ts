import RedisService from '@services/redis.service';

async function testCacheInvalidation() {
  console.log('🧪 Testing Redis Cache Invalidation...\n');

  const redis = RedisService.getInstance();
  await redis.initialize();

  try {
    // 1. Set some test cache keys
    console.log('📝 Step 1: Setting test cache keys...');
    await redis.set('warehouse:list:default', { test: 1 }, 300);
    await redis.set('warehouse:list:page2', { test: 2 }, 300);
    await redis.set('warehouse:list:filtered', { test: 3 }, 300);
    await redis.set('warehouse:123', { id: 123 }, 3600);
    console.log('✅ Set 4 test keys\n');

    // 2. Check all warehouse keys
    console.log('🔍 Step 2: Checking all warehouse keys...');
    const allKeys = await redis.keys('warehouse:*');
    console.log(`Found ${allKeys.length} keys:`, allKeys);
    console.log('');

    // 3. Check warehouse:list:* pattern
    console.log('🔍 Step 3: Checking warehouse:list:* pattern...');
    const listKeys = await redis.keys('warehouse:list:*');
    console.log(`Found ${listKeys.length} list keys:`, listKeys);
    console.log('');

    // 4. Test flushPattern
    console.log('🗑️  Step 4: Testing flushPattern...');
    const deletedCount = await redis.flushPattern('warehouse:list:*');
    console.log(`Deleted ${deletedCount} keys via flushPattern\n`);

    // 5. Verify deletion
    console.log('✅ Step 5: Verifying deletion...');
    const remainingListKeys = await redis.keys('warehouse:list:*');
    const remainingAllKeys = await redis.keys('warehouse:*');
    console.log(`Remaining list keys: ${remainingListKeys.length}`, remainingListKeys);
    console.log(`Remaining all keys: ${remainingAllKeys.length}`, remainingAllKeys);
    console.log('');

    // 6. Cleanup
    console.log('🧹 Step 6: Cleanup...');
    await redis.del('warehouse:123');
    console.log('✅ Cleanup complete\n');

    console.log('✅ Test completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }

  process.exit(0);
}

testCacheInvalidation();
