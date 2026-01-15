/**
 * Test script: Verify timezone date parsing fix
 * Run: npx ts-node test-date-parsing.ts
 */

const TZ_OFFSET_MS = 7 * 60 * 60 * 1000; // Vietnam UTC+7

// Test date: 2026-01-04
const testDate = "2026-01-04";

const parseVNStart = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map((v) => parseInt(v, 10));
  const utc = Date.UTC(y, m - 1, d, 0, 0, 0, 0);
  return new Date(utc + TZ_OFFSET_MS);
};

const parseVNEnd = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map((v) => parseInt(v, 10));
  const utc = Date.UTC(y, m - 1, d, 23, 59, 59, 999);
  return new Date(utc + TZ_OFFSET_MS);
};

console.log("=== TIMEZONE DATE PARSING TEST ===\n");
console.log(`Test Date: ${testDate}\n`);

const startDate = parseVNStart(testDate);
const endDate = parseVNEnd(testDate);

console.log("START (00:00:00 VN):");
console.log(`  ISO: ${startDate.toISOString()}`);
console.log(`  VN Display: ${new Date(startDate.getTime() - TZ_OFFSET_MS).toISOString().split('T')[0]} 00:00:00`);
console.log(`  Timestamp: ${startDate.getTime()}`);
console.log();

console.log("END (23:59:59 VN):");
console.log(`  ISO: ${endDate.toISOString()}`);
console.log(`  VN Display: ${new Date(endDate.getTime() - TZ_OFFSET_MS).toISOString().split('T')[0]} 23:59:59`);
console.log(`  Timestamp: ${endDate.getTime()}`);
console.log();

console.log("DATABASE QUERY WILL USE:");
console.log(`  WHERE completedAt >= '${startDate.toISOString()}'`);
console.log(`    AND completedAt <= '${endDate.toISOString()}'`);
console.log();

// Verify the calculation
const expectedStartISO = "2026-01-04T07:00:00.000Z"; // 00:00 VN = 07:00 UTC
const expectedEndISO = "2026-01-05T06:59:59.999Z";   // 23:59 VN = 06:59 next day UTC

console.log("VERIFICATION:");
console.log(`  Start matches expected (${startDate.toISOString() === expectedStartISO}): ${startDate.toISOString()} === ${expectedStartISO}`);
console.log(`  End matches expected (${endDate.toISOString() === expectedEndISO}): ${endDate.toISOString()} === ${expectedEndISO}`);
