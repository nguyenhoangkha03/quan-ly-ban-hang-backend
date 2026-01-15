/**
 * Test Production Report Service
 * Run: ts-node -r tsconfig-paths/register src/test/test-production-report.ts
 */

import productionReportService from '@services/production-report.service';
import RedisService from '@services/redis.service';

async function testProductionReport() {
  try {
    console.log('🧪 Testing Production Report Service...\n');
    
    // Initialize Redis (optional, will skip if fails)
    try {
      const redis = RedisService.getInstance();
      await redis.initialize();
      console.log('✅ Redis initialized\n');
    } catch (err) {
      console.log('⚠️  Redis not available (will skip caching)\n');
    }

    const filters = {
      startDate: '2024-01-01',
      endDate: '2024-01-31',
    };

    console.log('📊 Test 1: Get Production Summary');
    console.log('Query:', filters);
    const summary = await productionReportService.getProductionSummary(filters);
    console.log('Result:', JSON.stringify(summary, null, 2));
    console.log('\n---\n');

    console.log('📈 Test 2: Get Timeline Chart');
    const timeline = await productionReportService.getTimelineChart(filters);
    console.log('Result:', JSON.stringify(timeline, null, 2));
    console.log('\n---\n');

    console.log('🚨 Test 3: Get Top Wastage Chart');
    const topWastage = await productionReportService.getTopWastageChart(filters);
    console.log('Result:', JSON.stringify(topWastage, null, 2));
    console.log('\n---\n');

    console.log('💰 Test 4: Get Cost Structure Chart');
    const costStructure = await productionReportService.getCostStructureChart(filters);
    console.log('Result:', JSON.stringify(costStructure, null, 2));
    console.log('\n---\n');

    console.log('📋 Test 5: Get Production Orders');
    const orders = await productionReportService.getProductionOrders({
      ...filters,
      page: 1,
      limit: 10,
    });
    console.log('Result:', JSON.stringify(orders, null, 2));
    console.log('\n---\n');

    console.log('🔧 Test 6: Get Material Usage Report');
    const materials = await productionReportService.getMaterialUsageReport(filters);
    console.log('Result:', JSON.stringify(materials, null, 2));
    console.log('\n---\n');

    console.log('✅ All tests completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testProductionReport();
