import { PrismaClient } from '@prisma/client';

// Import các hàm main từ các file con và đổi tên (alias) cho dễ hiểu
import { main as seedSuppliers } from './seed-supplier';
import { main as seedCategories } from './seed-category';
import { main as seedProducts } from './seed-product';


const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Bắt đầu quy trình Seeding toàn bộ dữ liệu...');

  // --- GIAI ĐOẠN 1: Dữ liệu nền tảng (Độc lập) ---
  // Phải có Nhà cung cấp, Kho, Danh mục trước thì mới tạo được Sản phẩm
  console.log('\n--- 1. Seeding Suppliers (Nhà cung cấp) ---');
  await seedSuppliers();

//   console.log('\n--- 2. Seeding Warehouses (Kho bãi) ---');
//   await seedWarehouses();

  console.log('\n--- 3. Seeding Categories (Danh mục) ---');
  await seedCategories();

//   console.log('\n--- 4. Seeding Customers (Khách hàng) ---');
//   await seedCustomers();

  // --- GIAI ĐOẠN 2: Dữ liệu phụ thuộc ---
  
  // Sản phẩm cần CategoryId và SupplierId nên phải chạy sau bước 1, 2, 3
  console.log('\n--- 5. Seeding Products (Sản phẩm) ---');
  await seedProducts();

  // Inventory cần ProductId và WarehouseId nên phải chạy sau bước 2 và 5
//   console.log('\n--- 6. Seeding Inventory (Tồn kho) ---');
//   await seedInventory();
  
//   // Transaction cần Inventory hoặc Product nên chạy cuối cùng
//   console.log('\n--- 7. Seeding Stock Transactions (Giao dịch kho) ---');
//   await seedStockTransactions();

  console.log('\n✅ HOÀN TẤT TOÀN BỘ QUÁ TRÌNH SEEDING!');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi nghiêm trọng trong quá trình seed tổng:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });