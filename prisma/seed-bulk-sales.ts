import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding 50+ sales orders for testing revenue report...\n');

  try {
    // Get base data
    const customers = await prisma.customer.findMany({
      take: 10,
      where: { status: 'active' },
    });

    const users = await prisma.user.findMany({
      take: 5,
      where: { role: { roleKey: 'sales_staff' } },
    });

    const products = await prisma.product.findMany({
      take: 20,
      where: { status: 'active' },
    });

    const warehouse = await prisma.warehouse.findFirst({
      where: { status: 'active' },
    });

    if (!customers.length || !users.length || !products.length || !warehouse) {
      console.error('❌ Missing required data');
      process.exit(1);
    }

    console.log(`📦 Using ${customers.length} customers, ${users.length} users, ${products.length} products\n`);

    // Generate 50 sales orders for the last 30 days
    const orders = [];
    const baseDate = new Date('2025-12-10T00:00:00Z'); // 30 days before 2026-01-09

    for (let i = 0; i < 50; i++) {
      const daysOffset = Math.floor(Math.random() * 30);
      const orderDate = new Date(baseDate);
      orderDate.setDate(orderDate.getDate() + daysOffset);
      
      const customer = customers[Math.floor(Math.random() * customers.length)];
      const user = users[Math.floor(Math.random() * users.length)];
      const product = products[Math.floor(Math.random() * products.length)];
      
      const quantity = Math.floor(Math.random() * 500) + 10; // 10-510
      const basePrice = Math.floor(Math.random() * 2000000) + 100000; // 100k-2.1m
      const totalAmount = quantity * basePrice;
      const discount = Math.floor(totalAmount * (Math.random() * 0.15)); // 0-15% discount
      const tax = Math.floor((totalAmount - discount) * 0.1); // 10% tax
      const shippingFee = [0, 30000, 50000, 100000][Math.floor(Math.random() * 4)];
      const finalAmount = totalAmount - discount + tax + shippingFee;
      
      // Random payment status
      const paymentStatusOptions = ['paid', 'partial', 'unpaid'];
      const paymentStatus = paymentStatusOptions[Math.floor(Math.random() * paymentStatusOptions.length)];
      
      let paidAmount = 0;
      if (paymentStatus === 'paid') {
        paidAmount = finalAmount;
      } else if (paymentStatus === 'partial') {
        paidAmount = Math.floor(finalAmount * (Math.random() * 0.7 + 0.3)); // 30-100%
      }

      // Random order status (mostly completed for revenue)
      const orderStatusOptions = ['completed', 'completed', 'completed', 'preparing', 'delivering'];
      const orderStatus = orderStatusOptions[Math.floor(Math.random() * orderStatusOptions.length)];

      const salesChannels = ['retail', 'wholesale', 'online', 'distributor'];
      const salesChannel = salesChannels[Math.floor(Math.random() * salesChannels.length)];

      const paymentMethods = ['cash', 'transfer', 'installment', 'credit'];
      const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];

      const completedAt = orderStatus === 'completed' 
        ? new Date(orderDate.getTime() + Math.random() * 86400000) // Random time same day
        : null;

      orders.push({
        orderCode: `DH-${String(i + 1000).slice(-4)}`,
        customerId: customer.id,
        createdBy: user.id,
        warehouseId: warehouse.id,
        orderDate,
        completedAt,
        salesChannel,
        totalAmount: totalAmount.toString(),
        discountAmount: discount.toString(),
        taxAmount: tax.toString(),
        shippingFee: shippingFee.toString(),
        paidAmount: paidAmount.toString(),
        paymentStatus,
        paymentMethod,
        orderStatus,
        deliveryAddress: `${Math.floor(Math.random() * 999)} Đường ${['Lê Lợi', 'Nguyễn Huệ', 'Võ Văn Kiệt', 'Tạ Quang Bửu', 'Lê Văn Sỹ'][Math.floor(Math.random() * 5)]}, TP HCM`,
        notes: `Đơn hàng ${salesChannel} tự động`,
        details: {
          create: [
            {
              productId: product.id,
              warehouseId: warehouse.id,
              quantity: quantity.toString(),
              unitPrice: basePrice.toString(),
              discountPercent: Math.floor(Math.random() * 20),
            },
          ],
        },
      });
    }

    // Create all orders
    console.log(`📝 Creating ${orders.length} sales orders...`);
    const createdOrders = await Promise.all(
      orders.map((order) =>
        prisma.salesOrder.create({
          data: order as any,
        }).catch(err => {
          console.error(`❌ Error creating order ${order.orderCode}:`, err.message);
          return null;
        })
      )
    );

    const successCount = createdOrders.filter(o => o !== null).length;
    console.log(`✅ Successfully created ${successCount}/${orders.length} sales orders\n`);

    // Summary
    const completedOrders = createdOrders.filter(
      (o) => o && o.orderStatus === 'completed'
    );
    const totalRevenue = completedOrders.reduce(
      (sum, o) => sum + Number(o?.totalAmount || 0),
      0
    );

    console.log('\n📊 Summary:');
    console.log(`  Total Orders: ${successCount}`);
    console.log(`  Completed Orders: ${completedOrders.length}`);
    console.log(`  Total Revenue (completed): ${totalRevenue.toLocaleString('vi-VN')} ₫`);
    console.log(`  Date Range: ${new Date('2025-12-07').toLocaleDateString('vi-VN')} - ${new Date().toLocaleDateString('vi-VN')}`);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
