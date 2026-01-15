import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Inserting sales orders for today (2026-01-04)...\n');

  try {
    // Get existing data
    const customer = await prisma.customer.findFirst();
    const user = await prisma.user.findFirst({
      where: { role: { roleKey: 'sales_staff' } },
    });
    const product = await prisma.product.findFirst();
    const warehouse = await prisma.warehouse.findFirst();

    if (!customer || !user || !product || !warehouse) {
      console.error('❌ Missing required data');
      process.exit(1);
    }

    console.log(`✓ Customer: ${customer.customerName}`);
    console.log(`✓ User: ${user.fullName}`);
    console.log(`✓ Product: ${product.productName}`);
    console.log(`✓ Warehouse: ${warehouse.warehouseName}\n`);

    // Insert 5 orders using raw SQL (bypass schema validation)
    await Promise.all([
      prisma.$executeRawUnsafe(`
        INSERT INTO sales_orders (
          order_code, customer_id, warehouse_id, order_date, completed_at,
          sales_channel, total_amount, discount_amount, tax_amount, shipping_fee,
          paid_amount, payment_method, payment_status, order_status, delivery_address,
          notes, created_by, created_at, updated_at
        ) VALUES (
          'DH-2026-00041', ${customer.id}, ${warehouse.id}, '2026-01-04', '2026-01-04 14:00:00',
          'retail', 5000000, 500000, 400000, 50000,
          3000000, 'credit', 'partial', 'completed', '123 Đường Lê Lợi, TP HCM',
          'Đơn hàng bán lẻ hôm nay', ${user.id}, NOW(), NOW()
        )
      `),
      prisma.$executeRawUnsafe(`
        INSERT INTO sales_orders (
          order_code, customer_id, warehouse_id, order_date, completed_at,
          sales_channel, total_amount, discount_amount, tax_amount, shipping_fee,
          paid_amount, payment_method, payment_status, order_status, delivery_address,
          notes, created_by, created_at, updated_at
        ) VALUES (
          'DH-2026-00042', ${customer.id}, ${warehouse.id}, '2026-01-04', '2026-01-04 14:00:00',
          'wholesale', 8000000, 800000, 640000, 100000,
          8000000, 'transfer', 'paid', 'completed', '456 Đường Nguyễn Huệ, TP HCM',
          'Đơn hàng bán sỉ hôm nay', ${user.id}, NOW(), NOW()
        )
      `),
      prisma.$executeRawUnsafe(`
        INSERT INTO sales_orders (
          order_code, customer_id, warehouse_id, order_date, completed_at,
          sales_channel, total_amount, discount_amount, tax_amount, shipping_fee,
          paid_amount, payment_method, payment_status, order_status, delivery_address,
          notes, created_by, created_at, updated_at
        ) VALUES (
          'DH-2026-00043', ${customer.id}, ${warehouse.id}, '2026-01-04', '2026-01-04 14:00:00',
          'online', 3500000, 0, 280000, 30000,
          3500000, 'cash', 'paid', 'completed', '789 Đường Võ Văn Kiệt, TP HCM',
          'Đơn hàng bán online hôm nay', ${user.id}, NOW(), NOW()
        )
      `),
      prisma.$executeRawUnsafe(`
        INSERT INTO sales_orders (
          order_code, customer_id, warehouse_id, order_date, completed_at,
          sales_channel, total_amount, discount_amount, tax_amount, shipping_fee,
          paid_amount, payment_method, payment_status, order_status, delivery_address,
          notes, created_by, created_at, updated_at
        ) VALUES (
          'DH-2026-00044', ${customer.id}, ${warehouse.id}, '2026-01-04', NULL,
          'distributor', 6000000, 600000, 480000, 80000,
          0, 'credit', 'unpaid', 'preparing', '321 Đường Tạ Quang Bửu, TP HCM',
          'Đơn hàng bán đại lý hôm nay', ${user.id}, NOW(), NOW()
        )
      `),
      prisma.$executeRawUnsafe(`
        INSERT INTO sales_orders (
          order_code, customer_id, warehouse_id, order_date, completed_at,
          sales_channel, total_amount, discount_amount, tax_amount, shipping_fee,
          paid_amount, payment_method, payment_status, order_status, delivery_address,
          notes, created_by, created_at, updated_at
        ) VALUES (
          'DH-2026-00045', ${customer.id}, ${warehouse.id}, '2026-01-04', NULL,
          'retail', 2500000, 250000, 200000, 30000,
          1500000, 'installment', 'partial', 'preparing', '654 Đường Lê Văn Sỹ, TP HCM',
          'Đơn hàng bán lẻ hôm nay', ${user.id}, NOW(), NOW()
        )
      `),
    ]);

    console.log('✅ Created 5 sales orders\n');

    // Get inserted order IDs
    const orders = await prisma.salesOrder.findMany({
      where: {
        orderCode: {
          in: ['DH-2026-00041', 'DH-2026-00042', 'DH-2026-00043', 'DH-2026-00044', 'DH-2026-00045'],
        },
      },
    });

    // Insert order details
    await Promise.all(
      orders.map((order, idx) => {
        const discounts = [10, 10, 0, 10, 10];
        const quantities = [100, 150, 70, 120, 50];
        const prices = [50000, 53000, 50000, 50000, 50000];

        return prisma.salesOrderDetail.create({
          data: {
            orderId: order.id,
            productId: product.id,
            warehouseId: warehouse.id,
            quantity: quantities[idx],
            unitPrice: prices[idx],
            discountPercent: discounts[idx],
          },
        });
      })
    );

    console.log('✅ Created 5 order details\n');

    // Summary
    console.log('📊 Summary:');
    orders.forEach((order) => {
      console.log(
        `  ${order.orderCode}: ${order.salesChannel} - ${order.orderStatus} - ${Number(order.totalAmount).toLocaleString('vi-VN')} ₫`
      );
    });

    const totalAmount = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    const totalPaid = orders.reduce((sum, o) => sum + Number(o.paidAmount), 0);

    console.log(`\n  Total: ${totalAmount.toLocaleString('vi-VN')} ₫`);
    console.log(`  Paid: ${totalPaid.toLocaleString('vi-VN')} ₫`);
    console.log(`\n✅ Done! Reload your page and test "Hôm nay" preset 🚀\n`);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
