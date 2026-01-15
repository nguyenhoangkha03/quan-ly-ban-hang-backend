import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function main() {
  console.log('📦 Bắt đầu seed dữ liệu Đơn hàng (Sales Orders)...');

  // Xóa dữ liệu cũ
  await prisma.salesOrderDetail.deleteMany({});
  await prisma.salesOrder.deleteMany({});

  // Lấy dữ liệu cần thiết
  const customers = await prisma.customer.findMany({ take: 10 });
  const products = await prisma.product.findMany({ take: 20 });
  const warehouses = await prisma.warehouse.findMany({ take: 3 });
  const users = await prisma.user.findMany({ take: 5 });

  if (!customers.length || !products.length || !users.length) {
    throw new Error('❌ Cần phải seed Customers, Products và Users trước!');
  }

  const today = new Date();

  // ========== NHÓM 1: ĐƠN HẦY TRONG THÁNG này ==========
  // Đơn 1: Từ Đại lý Phân bón Tấn Phát
  const order1 = {
    orderCode: `SO-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}-001`,
    customerId: customers[0].id,
    warehouseId: warehouses[0]?.id,
    orderDate: new Date(today.getFullYear(), today.getMonth(), 1),
    salesChannel: 'wholesale' as const,
    totalAmount: 0,
    discountAmount: 0,
    taxAmount: 0,
    shippingFee: 100000,
    paidAmount: 0,
    paymentMethod: 'transfer' as const,
    paymentStatus: 'unpaid' as const,
    orderStatus: 'pending' as const,
    deliveryAddress: customers[0].address,
    notes: 'Đơn hàng định kỳ hàng tháng',
    createdBy: users[0].id,
    approvedBy: users[1].id,
    approvedAt: new Date(today.getFullYear(), today.getMonth(), 2),
    createdAt: new Date(today.getFullYear(), today.getMonth(), 1),
  };

  // Đơn 2: Từ Cửa hàng Nông sản Cửu Long
  const order2 = {
    orderCode: `SO-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}-002`,
    customerId: customers[1].id,
    warehouseId: warehouses[1]?.id,
    orderDate: new Date(today.getFullYear(), today.getMonth(), 5),
    salesChannel: 'wholesale' as const,
    totalAmount: 0,
    discountAmount: 0,
    taxAmount: 0,
    shippingFee: 150000,
    paidAmount: 0,
    paymentMethod: 'cash' as const,
    paymentStatus: 'paid' as const,
    orderStatus: 'preparing' as const,
    deliveryAddress: customers[1].address,
    notes: 'Giao hàng nhanh',
    createdBy: users[0].id,
    approvedBy: users[1].id,
    approvedAt: new Date(today.getFullYear(), today.getMonth(), 5),
    createdAt: new Date(today.getFullYear(), today.getMonth(), 5),
  };

  // Đơn 3: Từ Công ty TNHH Nông nghiệp Bình Minh
  const order3 = {
    orderCode: `SO-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}-003`,
    customerId: customers[2].id,
    warehouseId: warehouses[0]?.id,
    orderDate: new Date(today.getFullYear(), today.getMonth(), 10),
    salesChannel: 'wholesale' as const,
    totalAmount: 0,
    discountAmount: 0,
    taxAmount: 0,
    shippingFee: 120000,
    paidAmount: 0,
    paymentMethod: 'installment' as const,
    paymentStatus: 'partial' as const,
    orderStatus: 'pending' as const,
    deliveryAddress: customers[2].address,
    notes: 'Thanh toán 2 đợt',
    createdBy: users[2].id,
    approvedBy: null,
    createdAt: new Date(today.getFullYear(), today.getMonth(), 10),
  };

  // Đơn 4: Từ khách hàng lẻ
  const order4 = {
    orderCode: `SO-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}-004`,
    customerId: customers[5].id,
    warehouseId: warehouses[1]?.id,
    orderDate: new Date(today.getFullYear(), today.getMonth(), 15),
    salesChannel: 'retail' as const,
    totalAmount: 0,
    discountAmount: 0,
    taxAmount: 0,
    shippingFee: 50000,
    paidAmount: 0,
    paymentMethod: 'cash' as const,
    paymentStatus: 'unpaid' as const,
    orderStatus: 'pending' as const,
    deliveryAddress: customers[5].address,
    notes: 'Khách hàng mới',
    createdBy: users[0].id,
    createdAt: new Date(today.getFullYear(), today.getMonth(), 15),
  };

  // Đơn 5: Đơn đã hoàn thành
  const order5 = {
    orderCode: `SO-${today.getFullYear()}${String(today.getMonth()).padStart(2, '0')}-201`,
    customerId: customers[3].id,
    warehouseId: warehouses[2]?.id,
    orderDate: new Date(today.getFullYear(), today.getMonth() - 1, 20),
    salesChannel: 'wholesale' as const,
    totalAmount: 0,
    discountAmount: 0,
    taxAmount: 0,
    shippingFee: 100000,
    paidAmount: 0,
    paymentMethod: 'transfer' as const,
    paymentStatus: 'paid' as const,
    orderStatus: 'completed' as const,
    deliveryAddress: customers[3].address,
    notes: 'Đơn hàng hoàn thành',
    createdBy: users[0].id,
    approvedBy: users[1].id,
    approvedAt: new Date(today.getFullYear(), today.getMonth() - 1, 21),
    completedAt: new Date(today.getFullYear(), today.getMonth() - 1, 25),
    createdAt: new Date(today.getFullYear(), today.getMonth() - 1, 20),
  };

  // Đơn 6: Đơn bị hủy
  const order6 = {
    orderCode: `SO-${today.getFullYear()}${String(today.getMonth()).padStart(2, '0')}-202`,
    customerId: customers[4].id,
    warehouseId: warehouses[0]?.id,
    orderDate: new Date(today.getFullYear(), today.getMonth() - 1, 28),
    salesChannel: 'retail' as const,
    totalAmount: 0,
    discountAmount: 0,
    taxAmount: 0,
    shippingFee: 0,
    paidAmount: 0,
    paymentMethod: 'cash' as const,
    paymentStatus: 'unpaid' as const,
    orderStatus: 'cancelled' as const,
    deliveryAddress: customers[4].address,
    notes: 'Khách hàng hủy đơn',
    createdBy: users[2].id,
    cancelledBy: users[1].id,
    cancelledAt: new Date(today.getFullYear(), today.getMonth() - 1, 29),
    createdAt: new Date(today.getFullYear(), today.getMonth() - 1, 28),
  };

  const allOrders = [order1, order2, order3, order4, order5, order6];

  // Tạo các đơn hàng và chi tiết
  const createdOrders = [];
  for (const orderData of allOrders) {
    const order = await prisma.salesOrder.create({
      data: orderData,
    });
    createdOrders.push(order);
  }

  console.log(`✅ Đã tạo ${createdOrders.length} đơn hàng!`);

  // ========== TẠO CHI TIẾT ĐƠN HÀNG ==========

  // Chi tiết cho Order 1 - Đơn hàng lớn
  let detailOrder1 = [];
  const prod1 = products[0];
  const prod2 = products[1];
  const prod3 = products[2];

  const detail1_1 = {
    orderId: createdOrders[0].id,
    productId: prod1.id,
    warehouseId: warehouses[0]?.id,
    quantity: 100,
    unitPrice: 50000,
    discountPercent: 5,
    taxRate: 10,
    notes: 'Phiên bản thường',
  };

  const detail1_2 = {
    orderId: createdOrders[0].id,
    productId: prod2.id,
    warehouseId: warehouses[0]?.id,
    quantity: 150,
    unitPrice: 35000,
    discountPercent: 0,
    taxRate: 10,
    notes: null,
  };

  const detail1_3 = {
    orderId: createdOrders[0].id,
    productId: prod3.id,
    warehouseId: warehouses[0]?.id,
    quantity: 200,
    unitPrice: 25000,
    discountPercent: 10,
    taxRate: 10,
    notes: 'Mua số lượng lớn',
  };

  detailOrder1 = await Promise.all([
    prisma.salesOrderDetail.create({ data: detail1_1 }),
    prisma.salesOrderDetail.create({ data: detail1_2 }),
    prisma.salesOrderDetail.create({ data: detail1_3 }),
  ]);

  const totalOrder1 =
    100 * 50000 * (1 - 0.05) * (1 + 0.1) +
    150 * 35000 * (1 + 0.1) +
    200 * 25000 * (1 - 0.1) * (1 + 0.1);

  // Chi tiết cho Order 2
  const detail2_1 = {
    orderId: createdOrders[1].id,
    productId: products[3].id,
    warehouseId: warehouses[1]?.id,
    quantity: 75,
    unitPrice: 45000,
    discountPercent: 0,
    taxRate: 10,
    notes: null,
  };

  const detail2_2 = {
    orderId: createdOrders[1].id,
    productId: products[4].id,
    warehouseId: warehouses[1]?.id,
    quantity: 120,
    unitPrice: 30000,
    discountPercent: 5,
    taxRate: 10,
    notes: null,
  };

  const detailOrder2 = await Promise.all([
    prisma.salesOrderDetail.create({ data: detail2_1 }),
    prisma.salesOrderDetail.create({ data: detail2_2 }),
  ]);

  const totalOrder2 = 75 * 45000 * (1 + 0.1) + 120 * 30000 * (1 - 0.05) * (1 + 0.1);

  // Chi tiết cho Order 3
  const detail3_1 = {
    orderId: createdOrders[2].id,
    productId: products[5].id,
    warehouseId: warehouses[0]?.id,
    quantity: 50,
    unitPrice: 60000,
    discountPercent: 10,
    taxRate: 10,
    notes: 'Giảm giá khách sỉ',
  };

  const detailOrder3 = await Promise.all([prisma.salesOrderDetail.create({ data: detail3_1 })]);

  const totalOrder3 = 50 * 60000 * (1 - 0.1) * (1 + 0.1);

  // Chi tiết cho Order 4 - Đơn nhỏ
  const detail4_1 = {
    orderId: createdOrders[3].id,
    productId: products[6].id,
    warehouseId: warehouses[1]?.id,
    quantity: 10,
    unitPrice: 55000,
    discountPercent: 0,
    taxRate: 10,
    notes: null,
  };

  const detailOrder4 = await Promise.all([prisma.salesOrderDetail.create({ data: detail4_1 })]);

  const totalOrder4 = 10 * 55000 * (1 + 0.1);

  // Chi tiết cho Order 5 - Đơn hoàn thành
  const detail5_1 = {
    orderId: createdOrders[4].id,
    productId: products[7].id,
    warehouseId: warehouses[2]?.id,
    quantity: 80,
    unitPrice: 40000,
    discountPercent: 5,
    taxRate: 10,
    notes: null,
  };

  const detailOrder5 = await Promise.all([prisma.salesOrderDetail.create({ data: detail5_1 })]);

  const totalOrder5 = 80 * 40000 * (1 - 0.05) * (1 + 0.1);

  // Chi tiết cho Order 6 - Đơn bị hủy
  const detail6_1 = {
    orderId: createdOrders[5].id,
    productId: products[8].id,
    warehouseId: warehouses[0]?.id,
    quantity: 30,
    unitPrice: 50000,
    discountPercent: 0,
    taxRate: 10,
    notes: null,
  };

  const detailOrder6 = await Promise.all([prisma.salesOrderDetail.create({ data: detail6_1 })]);

  const totalOrder6 = 30 * 50000 * (1 + 0.1);

  // Cập nhật totalAmount cho các đơn hàng
  await prisma.salesOrder.update({
    where: { id: createdOrders[0].id },
    data: {
      totalAmount: totalOrder1 + 100000,
      paidAmount: 0,
    },
  });

  await prisma.salesOrder.update({
    where: { id: createdOrders[1].id },
    data: {
      totalAmount: totalOrder2 + 150000,
      paidAmount: totalOrder2 + 150000,
    },
  });

  await prisma.salesOrder.update({
    where: { id: createdOrders[2].id },
    data: {
      totalAmount: totalOrder3 + 120000,
      paidAmount: (totalOrder3 + 120000) * 0.5,
    },
  });

  await prisma.salesOrder.update({
    where: { id: createdOrders[3].id },
    data: {
      totalAmount: totalOrder4 + 50000,
      paidAmount: 0,
    },
  });

  await prisma.salesOrder.update({
    where: { id: createdOrders[4].id },
    data: {
      totalAmount: totalOrder5 + 100000,
      paidAmount: totalOrder5 + 100000,
    },
  });

  await prisma.salesOrder.update({
    where: { id: createdOrders[5].id },
    data: {
      totalAmount: totalOrder6,
      paidAmount: 0,
    },
  });

  console.log(
    `✅ Đã tạo ${
      detailOrder1.length +
      detailOrder2.length +
      detailOrder3.length +
      detailOrder4.length +
      detailOrder5.length +
      detailOrder6.length
    } chi tiết đơn hàng!`
  );

  console.log(`
📊 Thống kê đơn hàng:
   - Đơn hàng tháng này: 4
   - Đơn hàng tháng trước: 2 (1 hoàn thành, 1 hủy)
   - Tổng số đơn hàng: ${createdOrders.length}
   - Tổng số dòng chi tiết: ${
     detailOrder1.length +
     detailOrder2.length +
     detailOrder3.length +
     detailOrder4.length +
     detailOrder5.length +
     detailOrder6.length
   }
   - Đơn hàng chờ duyệt: 1
   - Đơn hàng đang chuẩn bị: 1
   - Đơn hàng hoàn thành: 1
   - Đơn hàng bị hủy: 1
  `);
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi seed sales orders:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
