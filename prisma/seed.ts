// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import { main as seedWarehouse } from './seed-category'; // Import hàm chính từ seed-warehouse
import { main as seedCategory } from './seed-category';
import { main as seedCustomer } from './seed-customer';
import { main as seedProduct } from './seed-product'; 
// ... import các seed khác

const prisma = new PrismaClient();

async function main() {
  console.log('--- Bắt đầu Seeding Dữ liệu (Tổng hợp) ---');
  
  // 1. Chạy các seed cơ bản (Không phụ thuộc)
  await seedWarehouse();
  await seedCategory(); 
  
  // 2. Chạy các seed phụ thuộc (Product, Customer)
  await seedCustomer();
  await seedProduct(); 
  
  console.log('--- Seeding Dữ liệu Hoàn tất! ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });