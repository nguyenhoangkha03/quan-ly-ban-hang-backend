import dotenv from 'dotenv';
import RedisConfig from '@config/redis';
import RedisService from '@services/redis.service';
import CacheHelper from '@utils/cache.helper';

// Load environment variables
dotenv.config();

async function testRedisConnection() {
  console.log('🧪 Testing Redis Connection...\n');

  try {
    // =====================================================
    // 1. Test Redis Config Connection
    // =====================================================
    console.log('1️⃣ Testing Redis Config...');
    const redisConfig = RedisConfig.getInstance();
    await redisConfig.connect();

    const pingResult = await redisConfig.ping();
    console.log(`✅ Ping result: ${pingResult}`);
    console.log(`✅ Redis is ready: ${redisConfig.isReady()}\n`);

    // =====================================================
    // 2. Test Redis Service
    // =====================================================
    console.log('2️⃣ Testing Redis Service...');
    const redisService = RedisService.getInstance();
    await redisService.initialize();

    // Test basic operations
    console.log('   → Testing SET and GET...');
    await redisService.set('test:key', 'Hello Redis!', 60);
    const value = await redisService.get('test:key');
    console.log(`   ✅ Retrieved value: ${value}`);

    // Test JSON storage
    console.log('   → Testing JSON storage...');
    const testData = { name: 'Test User', age: 25, role: 'admin' };
    await redisService.set('test:json', testData, 60);
    const jsonData = await redisService.get('test:json');
    console.log(`   ✅ Retrieved JSON:`, jsonData);

    // Test EXISTS
    console.log('   → Testing EXISTS...');
    const exists = await redisService.exists('test:key');
    console.log(`   ✅ Key exists: ${exists}`);

    // Test TTL
    console.log('   → Testing TTL...');
    const ttl = await redisService.ttl('test:key');
    console.log(`   ✅ TTL: ${ttl} seconds`);

    // Test DELETE
    console.log('   → Testing DELETE...');
    await redisService.del('test:key');
    const existsAfterDelete = await redisService.exists('test:key');
    console.log(`   ✅ Key exists after delete: ${existsAfterDelete}\n`);

    // =====================================================
    // 3. Test Cache Helper
    // =====================================================
    console.log('3️⃣ Testing Cache Helper...');
    const cacheHelper = new CacheHelper();

    // Test session cache
    console.log('   → Testing Session Cache...');
    const sessionData = {
      userId: 1,
      email: 'admin@company.com',
      role: 'admin',
      loginAt: new Date().toISOString(),
    };
    await cacheHelper.setSession(1, sessionData);
    const cachedSession = await cacheHelper.getSession(1);
    console.log('   ✅ Session cached:', cachedSession);

    // Test product cache
    console.log('   → Testing Product Cache...');
    const productData = {
      id: 1,
      sku: 'PROD-001',
      name: 'Test Product',
      price: 100000,
    };
    await cacheHelper.setProduct(1, productData);
    const cachedProduct = await cacheHelper.getProduct(1);
    console.log('   ✅ Product cached:', cachedProduct);

    // Test inventory cache
    console.log('   → Testing Inventory Cache...');
    const inventoryData = {
      warehouseId: 1,
      productId: 1,
      quantity: 100,
      reservedQuantity: 10,
      availableQuantity: 90,
    };
    await cacheHelper.setInventory(1, 1, inventoryData);
    const cachedInventory = await cacheHelper.getInventory(1, 1);
    console.log('   ✅ Inventory cached:', cachedInventory);

    // Test permissions cache
    console.log('   → Testing Permissions Cache...');
    const permissions = ['view_users', 'create_product', 'manage_inventory'];
    await cacheHelper.setPermissions(1, permissions);
    const cachedPermissions = await cacheHelper.getPermissions(1);
    console.log('   ✅ Permissions cached:', cachedPermissions);

    // =====================================================
    // 4. Test Rate Limiting
    // =====================================================
    console.log('\n4️⃣ Testing Rate Limiting...');
    const identifier = 'test:ip:192.168.1.1';
    const maxRequests = 5;
    const windowSeconds = 60;

    console.log(`   → Testing rate limit (max ${maxRequests} requests in ${windowSeconds}s)...`);

    // Make multiple requests
    for (let i = 1; i <= 7; i++) {
      const result = await cacheHelper.checkRateLimit(identifier, maxRequests, windowSeconds);

      if (result.allowed) {
        console.log(`   ✅ Request ${i}: Allowed (${result.remaining} remaining)`);
      } else {
        console.log(
          `   ❌ Request ${i}: Rate limited! Reset at ${new Date(result.resetAt).toISOString()}`
        );
      }

      // Small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Reset rate limit
    await cacheHelper.resetRateLimit(identifier);
    console.log('   ✅ Rate limit reset');

    // =====================================================
    // 5. Test Pattern Operations
    // =====================================================
    console.log('\n5️⃣ Testing Pattern Operations...');

    // Create multiple keys
    await redisService.set('test:pattern:1', 'value1', 60);
    await redisService.set('test:pattern:2', 'value2', 60);
    await redisService.set('test:pattern:3', 'value3', 60);

    // Get keys by pattern
    const keys = await redisService.keys('test:pattern:*');
    console.log(`   ✅ Found ${keys.length} keys matching pattern:`, keys);

    // Flush pattern
    const deletedCount = await redisService.flushPattern('test:pattern:*');
    console.log(`   ✅ Deleted ${deletedCount} keys`);

    // =====================================================
    // 6. Test Hash Operations
    // =====================================================
    console.log('\n6️⃣ Testing Hash Operations...');

    const hashKey = 'test:hash:user:1';
    await redisService.hSet(hashKey, 'name', 'John Doe');
    await redisService.hSet(hashKey, 'email', 'john@example.com');
    await redisService.hSet(hashKey, 'age', '30');

    const name = await redisService.hGet(hashKey, 'name');
    console.log(`   ✅ Hash field 'name': ${name}`);

    const allFields = await redisService.hGetAll(hashKey);
    console.log('   ✅ All hash fields:', allFields);

    await redisService.del(hashKey);

    // =====================================================
    // 7. Clean Up Test Data
    // =====================================================
    console.log('\n7️⃣ Cleaning up test data...');

    await cacheHelper.deleteSession(1);
    await cacheHelper.deleteProduct(1);
    await cacheHelper.deleteInventory(1, 1);
    await cacheHelper.deletePermissions(1);
    await redisService.del('test:json');

    console.log('   ✅ Test data cleaned up');

    // =====================================================
    // 8. Display Redis Info
    // =====================================================
    console.log('\n8️⃣ Redis Server Info:');
    const info = await redisService.info();
    const lines = info.split('\n');
    const relevantInfo = lines.filter(
      (line) =>
        line.includes('redis_version') ||
        line.includes('connected_clients') ||
        line.includes('used_memory_human') ||
        line.includes('total_connections_received')
    );
    relevantInfo.forEach((line) => console.log(`   ${line}`));

    console.log('\n✅ All Redis tests passed! 🎉\n');
  } catch (error) {
    console.error('\n❌ Redis test failed:', error);
    process.exit(1);
  } finally {
    // Disconnect
    const redisConfig = RedisConfig.getInstance();
    await redisConfig.disconnect();
    console.log('👋 Disconnected from Redis');
    process.exit(0);
  }
}

// Run tests
testRedisConnection();
