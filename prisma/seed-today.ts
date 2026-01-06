import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding sales orders for today (2026-01-04)...\n');

  try {
    // Get a customer and user for orders
    const customer = await prisma.customer.findFirst({
      where: { status: 'active' },
    });

    const user = await prisma.user.findFirst({
      where: { role: { roleKey: 'sales_staff' } },
    });

    const product = await prisma.product.findFirst({
      where: { status: 'active' },
    });

    if (!customer || !user || !product) {
      console.error('❌ Missing required data: customer, user, or product');
      process.exit(1);
    }

    console.log(`Using Customer: ${customer.customerName}`);
    console.log(`Using User: ${user.fullName}`);
    console.log(`Using Product: ${product.productName}\n`);

    // Today date (2026-01-04)
    const today = new Date('2026-01-04T10:00:00Z');
    const completedToday = new Date('2026-01-04T14:00:00Z');

    // Create 5 sales orders for today
    const orders = await Promise.all([
      // Order 1: Completed - Retail
      prisma.salesOrder.create({
        data: {
          orderCode: 'DH-2026-00041',
          customerId: customer.id,
          createdBy: user.id,
          warehouseId: 1,
          orderDate: today,
          completedAt: completedToday,
          salesChannel: 'retail',
          totalAmount: '5000000',
          discountAmount: '500000',
          taxAmount: '400000',
          shippingFee: '50000',
          paidAmount: '3000000',
          paymentStatus: 'partial',
          paymentMethod: 'credit',
          orderStatus: 'completed',
          deliveryAddress: '123 Đường Lê Lợi, TP HCM',
          notes: 'Đơn hàng bán lẻ hôm nay',
          details: {
            create: [
              {
                productId: product.id,
                warehouseId: 1,
                quantity: '100',
                unitPrice: product.sellingPriceRetail || '50000',
                discountPercent: 10,
              },
            ],
          },
        },
      }),

      // Order 2: Completed - Wholesale
      prisma.salesOrder.create({
        data: {
          orderCode: 'DH-2026-00042',
          customerId: customer.id,
          createdBy: user.id,
          warehouseId: 1,
          orderDate: today,
          completedAt: completedToday,
          salesChannel: 'wholesale',
          totalAmount: '8000000',
          discountAmount: '800000',
          taxAmount: '640000',
          shippingFee: '100000',
          paidAmount: '8000000',
          paymentStatus: 'paid',
          paymentMethod: 'transfer',
          orderStatus: 'completed',
          deliveryAddress: '456 Đường Nguyễn Huệ, TP HCM',
          notes: 'Đơn hàng bán sỉ hôm nay',
          details: {
            create: [
              {
                productId: product.id,
                warehouseId: 1,
                quantity: '150',
                unitPrice: product.sellingPriceWholesale || '53000',
                discountPercent: 10,
              },
            ],
          },
        },
      }),

      // Order 3: Completed - Online
      prisma.salesOrder.create({
        data: {
          orderCode: 'DH-2026-00043',
          customerId: customer.id,
          createdBy: user.id,
          warehouseId: 1,
          orderDate: today,
          completedAt: completedToday,
          salesChannel: 'online',
          totalAmount: '3500000',
          discountAmount: '0',
          taxAmount: '280000',
          shippingFee: '30000',
          paidAmount: '3500000',
          paymentStatus: 'paid',
          paymentMethod: 'cash',
          orderStatus: 'completed',
          deliveryAddress: '789 Đường Võ Văn Kiệt, TP HCM',
          notes: 'Đơn hàng bán online hôm nay',
          details: {
            create: [
              {
                productId: product.id,
                warehouseId: 1,
                quantity: '70',
                unitPrice: product.sellingPriceRetail || '50000',
                discountPercent: 0,
              },
            ],
          },
        },
      }),

      // Order 4: Preparing - Distributor
      prisma.salesOrder.create({
        data: {
          orderCode: 'DH-2026-00044',
          customerId: customer.id,
          createdBy: user.id,
          warehouseId: 1,
          orderDate: today,
          completedAt: null,
          salesChannel: 'distributor',
          totalAmount: '6000000',
          discountAmount: '600000',
          taxAmount: '480000',
          shippingFee: '80000',
          paidAmount: '0',
          paymentStatus: 'unpaid',
          paymentMethod: 'credit',
          orderStatus: 'preparing',
          deliveryAddress: '321 Đường Tạ Quang Bửu, TP HCM',
          notes: 'Đơn hàng bán đại lý hôm nay',
          details: {
            create: [
              {
                productId: product.id,
                warehouseId: 1,
                quantity: '120',
                unitPrice: product.sellingPriceWholesale || '50000',
                discountPercent: 10,
              },
            ],
          },
        },
      }),

      // Order 5: Preparing - Retail
      prisma.salesOrder.create({
        data: {
          orderCode: 'DH-2026-00045',
          customerId: customer.id,
          createdBy: user.id,
          warehouseId: 1,
          orderDate: today,
          completedAt: null,
          salesChannel: 'retail',
          totalAmount: '2500000',
          discountAmount: '250000',
          taxAmount: '200000',
          shippingFee: '30000',
          paidAmount: '1500000',
          paymentStatus: 'partial',
          paymentMethod: 'installment',
          orderStatus: 'preparing',
          deliveryAddress: '654 Đường Lê Văn Sỹ, TP HCM',
          notes: 'Đơn hàng bán lẻ hôm nay',
          details: {
            create: [
              {
                productId: product.id,
                warehouseId: 1,
                quantity: '50',
                unitPrice: product.sellingPriceRetail || '50000',
                discountPercent: 10,
              },
            ],
          },
        },
      }),
    ]);

    console.log('✅ Successfully created 5 sales orders for 2026-01-04:\n');
    orders.forEach((order, index) => {
      console.log(
        `  ${index + 1}. ${order.orderCode} - ${order.salesChannel} - ${order.orderStatus}`
      );
      console.log(`     Amount: ${Number(order.totalAmount).toLocaleString('vi-VN')} ₫`);
      console.log(`     Status: ${order.paymentStatus}\n`);
    });

    console.log('\n📊 Summary:');
    const totalAmount = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    const totalPaid = orders.reduce((sum, o) => sum + Number(o.paidAmount), 0);
    const completed = orders.filter((o) => o.orderStatus === 'completed').length;

    console.log(`  Total Orders: ${orders.length}`);
    console.log(`  Completed: ${completed}`);
    console.log(`  Total Amount: ${totalAmount.toLocaleString('vi-VN')} ₫`);
    console.log(`  Total Paid: ${totalPaid.toLocaleString('vi-VN')} ₫`);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
