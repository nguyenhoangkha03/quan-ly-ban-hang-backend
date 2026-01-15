/**
 * API Test Helper - Test Inventory Report Endpoints
 * Run this after backend is started: npm run dev
 */

const BASE_URL = 'http://localhost:3000/api';
const TOKEN = process.env.TEST_TOKEN || 'your-jwt-token-here';

// Helper to make API requests
async function apiCall(endpoint: string, method: string = 'GET', data?: any) {
  const url = `${BASE_URL}${endpoint}`;
  const options: any = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`,
    },
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  console.log(`\n🔍 [${method}] ${url}`);

  try {
    const response = await fetch(url);
    const result = await response.json();

    if (response.ok) {
      console.log('✅ Success (Status:', response.status + ')');
      console.log(JSON.stringify(result, null, 2).substring(0, 500) + '...');
    } else {
      console.log('❌ Error (Status:', response.status + ')');
      console.log(JSON.stringify(result, null, 2));
    }

    return result;
  } catch (error: any) {
    console.log('❌ Network Error:', error.message);
    return null;
  }
}

// Test functions
async function testInventoryReport() {
  console.log('\n\n========== TEST 1: Inventory Report ==========');
  await apiCall('/reports/inventory?warehouseId=1');
}

async function testInventoryByType() {
  console.log('\n\n========== TEST 2: Inventory By Type ==========');
  await apiCall('/reports/inventory/by-type');
}

async function testStockFlowReport() {
  console.log('\n\n========== TEST 3: Stock Flow Report ==========');
  await apiCall('/reports/inventory/stock-flow?fromDate=2026-01-01&toDate=2026-01-31&warehouseId=1');
}

async function testBatchExpiryReport() {
  console.log('\n\n========== TEST 4: Batch Expiry Report ==========');
  await apiCall('/reports/inventory/batch-expiry?warehouseId=1');
}

async function testInventoryTurnover() {
  console.log('\n\n========== TEST 5: Inventory Turnover ==========');
  await apiCall('/reports/inventory/turnover?fromDate=2025-01-01&toDate=2026-01-05');
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting API Tests...');
  console.log('Base URL:', BASE_URL);
  console.log('Token:', TOKEN.substring(0, 20) + '...');

  await testInventoryReport();
  await testInventoryByType();
  await testStockFlowReport();
  await testBatchExpiryReport();
  await testInventoryTurnover();

  console.log('\n\n✅ All tests completed!');
}

// Run tests
runAllTests().catch(console.error);
