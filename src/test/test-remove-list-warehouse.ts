import RedisService from '@services/redis.service';

async function invalidateListCache() {
  const redis = RedisService.getInstance();
  await redis.initialize();

  const keys = await redis.keys('*');
  console.log('Tất cả key:', keys);

  const warehouseKeys = await redis.keys('warehouse:list:*');
  console.log('Key match warehouse:list:*:', warehouseKeys);

  if (warehouseKeys.length > 0) {
    await redis.del(warehouseKeys);
    console.log(`Đã xóa ${warehouseKeys.length} key`);
  } else {
    console.log('Không có cache để xóa');
  }
}

invalidateListCache();
