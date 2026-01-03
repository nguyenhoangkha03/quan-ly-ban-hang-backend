import { PrismaClient, TransferStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Bắt đầu seed dữ liệu StockTransfer...');

  // Xóa dữ liệu cũ
  await prisma.stockTransferDetail.deleteMany({});
  await prisma.stockTransfer.deleteMany({});

  // Lấy dữ liệu liên quan
  const warehouses = await prisma.warehouse.findMany({ where: { status: 'active' } });
  const products = await prisma.product.findMany({ take: 30 });
  const users = await prisma.user.findMany({ where: { status: 'active' }, take: 10 });

  if (warehouses.length < 2) {
    console.warn('⚠️ Cần ít nhất 2 kho để tạo phiếu chuyển kho. Vui lòng seed warehouse trước.');
    return;
  }

  if (products.length === 0) {
    console.warn('⚠️ Cần có sản phẩm để tạo chi tiết chuyển kho. Vui lòng seed product trước.');
    return;
  }

  if (users.length === 0) {
    console.warn('⚠️ Cần có người dùng để tạo phiếu chuyển kho. Vui lòng seed user trước.');
    return;
  }

  console.log(`📊 Dữ liệu sẵn có: ${warehouses.length} kho, ${products.length} sản phẩm, ${users.length} người dùng`);

  // Helper function để lấy sản phẩm, reuse nếu cần
  const getProduct = (index: number) => {
    return products[index % products.length];
  };

  // Helper function để lấy user, reuse nếu cần
  const getUser = (index: number) => {
    return users[index % users.length];
  };

  // Helper function để lấy kho, reuse nếu cần
  const getWarehouse = (index: number) => {
    return warehouses[index % warehouses.length];
  };

  // Tạo phiếu chuyển kho
  const transferData = [
    // ================================================================
    // PHIẾU 1: PENDING - Chờ duyệt
    // ================================================================
    {
      transferCode: 'ST-2024-001',
      fromWarehouseId: warehouses[0].id, // Kho Trụ Sở
      toWarehouseId: getWarehouse(1).id, // Chi nhánh Cần Thơ
      transferDate: new Date('2024-12-15'),
      reason: 'Cấp phát hàng theo kế hoạch tháng 12',
      status: TransferStatus.pending,
      requestedBy: getUser(0).id,
      approvedBy: null,
      cancelledBy: null,
      totalValue: 0,
      details: [
        {
          productId: getProduct(0).id,
          quantity: 100,
          unitPrice: getProduct(0).purchasePrice || 50000,
          batchNumber: 'BATCH-001-2024',
          expiryDate: undefined,
          notes: 'Lô hàng chính',
        },
        {
          productId: getProduct(1).id,
          quantity: 50,
          unitPrice: getProduct(1).purchasePrice || 75000,
          batchNumber: 'BATCH-002-2024',
          expiryDate: undefined,
          notes: null,
        },
      ],
    },

    // ================================================================
    // PHIẾU 2: IN_TRANSIT - Đang vận chuyển
    // ================================================================
    {
      transferCode: 'ST-2024-002',
      fromWarehouseId: getWarehouse(1).id, // Chi nhánh Cần Thơ
      toWarehouseId: getWarehouse(2).id, // Chi nhánh Đồng Nai
      transferDate: new Date('2024-12-10'),
      reason: 'Chuyển hàng dư từ Cần Thơ sang Đồng Nai',
      status: TransferStatus.in_transit,
      requestedBy: getUser(1).id,
      approvedBy: getUser(3).id,
      approvedAt: new Date('2024-12-11'),
      cancelledBy: null,
      totalValue: 0,
      details: [
        {
          productId: getProduct(2).id,
          quantity: 75,
          unitPrice: getProduct(2).purchasePrice || 60000,
          batchNumber: 'BATCH-003-2024',
          expiryDate: undefined,
          notes: 'Hàng chuyển dịch trong vùng',
        },
        {
          productId: getProduct(3).id,
          quantity: 120,
          unitPrice: getProduct(3).purchasePrice || 45000,
          batchNumber: null,
          expiryDate: undefined,
          notes: null,
        },
        {
          productId: getProduct(4).id,
          quantity: 30,
          unitPrice: getProduct(4).purchasePrice || 85000,
          batchNumber: 'BATCH-004-2024',
          expiryDate: undefined,
          notes: null,
        },
      ],
    },

    // ================================================================
    // PHIẾU 3: COMPLETED - Đã hoàn thành
    // ================================================================
    {
      transferCode: 'ST-2024-003',
      fromWarehouseId: getWarehouse(2).id, // Chi nhánh Đồng Nai
      toWarehouseId: warehouses[0].id, // Kho Trụ Sở
      transferDate: new Date('2024-12-01'),
      reason: 'Thu hồi hàng từ chi nhánh về kho chính',
      status: TransferStatus.completed,
      requestedBy: getUser(2).id,
      approvedBy: getUser(4).id,
      approvedAt: new Date('2024-12-02'),
      cancelledBy: null,
      totalValue: 0,
      details: [
        {
          productId: getProduct(5).id,
          quantity: 200,
          unitPrice: getProduct(5).purchasePrice || 35000,
          batchNumber: 'BATCH-005-2024',
          expiryDate: undefined,
          notes: 'Hàng trả về lô cũ',
        },
        {
          productId: getProduct(6).id,
          quantity: 60,
          unitPrice: getProduct(6).purchasePrice || 92000,
          batchNumber: null,
          expiryDate: undefined,
          notes: 'Hàng lỗi trả nhà sản xuất',
        },
      ],
    },

    // ================================================================
    // PHIẾU 4: CANCELLED - Đã hủy
    // ================================================================
    {
      transferCode: 'ST-2024-004',
      fromWarehouseId: warehouses[0].id, // Kho Trụ Sở
      toWarehouseId: getWarehouse(3).id, // Kho Nguyên liệu
      transferDate: new Date('2024-12-05'),
      reason: 'Hủy phiếu do sai kho đích',
      status: TransferStatus.cancelled,
      requestedBy: getUser(3).id,
      approvedBy: null,
      approvedAt: null,
      cancelledBy: getUser(5).id,
      cancelledAt: new Date('2024-12-05 14:30:00'),
      totalValue: 0,
      details: [
        {
          productId: getProduct(7).id,
          quantity: 150,
          unitPrice: getProduct(7).purchasePrice || 55000,
          batchNumber: 'BATCH-006-2024',
          expiryDate: undefined,
          notes: 'Phiếu bị hủy - sai kho đích',
        },
      ],
    },

    // ================================================================
    // PHIẾU 5: PENDING - Yêu cầu mới
    // ================================================================
    {
      transferCode: 'ST-2024-005',
      fromWarehouseId: getWarehouse(3).id, // Kho Nguyên liệu
      toWarehouseId: getWarehouse(4).id, // Kho Bao bì
      transferDate: new Date('2024-12-28'),
      reason: 'Cấp phát nguyên liệu cho sản xuất tháng 1/2025',
      status: TransferStatus.pending,
      requestedBy: getUser(4).id,
      approvedBy: null,
      cancelledBy: null,
      totalValue: 0,
      details: [
        {
          productId: getProduct(8).id,
          quantity: 500,
          unitPrice: getProduct(8).purchasePrice || 12000,
          batchNumber: 'BATCH-007-2024',
          expiryDate: undefined,
          notes: 'Nguyên liệu chính',
        },
        {
          productId: getProduct(9).id,
          quantity: 300,
          unitPrice: getProduct(9).purchasePrice || 8500,
          batchNumber: null,
          expiryDate: undefined,
          notes: null,
        },
        {
          productId: getProduct(10).id,
          quantity: 250,
          unitPrice: getProduct(10).purchasePrice || 15000,
          batchNumber: 'BATCH-008-2024',
          expiryDate: undefined,
          notes: 'Phụ gia bổ sung',
        },
      ],
    },

    // ================================================================
    // PHIẾU 6: COMPLETED - Hôm qua
    // ================================================================
    {
      transferCode: 'ST-2024-006',
      fromWarehouseId: getWarehouse(4).id, // Kho Bao bì
      toWarehouseId: warehouses[0].id, // Kho Trụ Sở
      transferDate: new Date('2024-12-27'),
      reason: 'Cấp phát bao bì cho dây chuyền sản xuất',
      status: TransferStatus.completed,
      requestedBy: getUser(5).id,
      approvedBy: getUser(2).id,
      approvedAt: new Date('2024-12-27'),
      cancelledBy: null,
      totalValue: 0,
      details: [
        {
          productId: getProduct(11).id,
          quantity: 1000,
          unitPrice: getProduct(11).purchasePrice || 2500,
          batchNumber: 'BATCH-009-2024',
          expiryDate: undefined,
          notes: 'Chai 500ml',
        },
        {
          productId: getProduct(12).id,
          quantity: 500,
          unitPrice: getProduct(12).purchasePrice || 3000,
          batchNumber: null,
          expiryDate: undefined,
          notes: 'Thùng carton',
        },
      ],
    },

    // ================================================================
    // PHIẾU 7: IN_TRANSIT - Vận chuyển từ hôm qua
    // ================================================================
    {
      transferCode: 'ST-2024-007',
      fromWarehouseId: getWarehouse(5).id, // Kho Đại Lý Gia Lai
      toWarehouseId: getWarehouse(6).id, // Kho Đại Lý Hải Dương
      transferDate: new Date('2024-12-26'),
      reason: 'Hỗ trợ hàng giữa các đại lý',
      status: TransferStatus.in_transit,
      requestedBy: getUser(6).id,
      approvedBy: getUser(1).id,
      approvedAt: new Date('2024-12-26'),
      cancelledBy: null,
      totalValue: 0,
      details: [
        {
          productId: getProduct(13).id,
          quantity: 200,
          unitPrice: getProduct(13).purchasePrice || 48000,
          batchNumber: 'BATCH-010-2024',
          expiryDate: undefined,
          notes: 'Hỗ trợ vùng Bắc',
        },
        {
          productId: getProduct(14).id,
          quantity: 150,
          unitPrice: getProduct(14).purchasePrice || 52000,
          batchNumber: null,
          expiryDate: undefined,
          notes: null,
        },
      ],
    },

    // ================================================================
    // PHIẾU 8: PENDING - Mới tạo hôm nay
    // ================================================================
    {
      transferCode: 'ST-2024-008',
      fromWarehouseId: warehouses[0].id, // Kho Trụ Sở
      toWarehouseId: getWarehouse(5).id, // Kho Đại Lý Gia Lai
      transferDate: new Date('2024-12-29'),
      reason: 'Cập nhật hàng hóa tháng 12/2024',
      status: TransferStatus.pending,
      requestedBy: getUser(7).id,
      approvedBy: null,
      cancelledBy: null,
      totalValue: 0,
      details: [
        {
          productId: getProduct(15).id,
          quantity: 80,
          unitPrice: getProduct(15).purchasePrice || 68000,
          batchNumber: 'BATCH-011-2024',
          expiryDate: undefined,
          notes: null,
        },
        {
          productId: getProduct(16).id,
          quantity: 120,
          unitPrice: getProduct(16).purchasePrice || 55000,
          batchNumber: 'BATCH-012-2024',
          expiryDate: undefined,
          notes: 'Hàng chất lượng cao',
        },
        {
          productId: getProduct(17).id,
          quantity: 95,
          unitPrice: getProduct(17).purchasePrice || 42000,
          batchNumber: null,
          expiryDate: undefined,
          notes: null,
        },
      ],
    },

    // ================================================================
    // PHIẾU 9: COMPLETED - Hôm nay sáng
    // ================================================================
    {
      transferCode: 'ST-2024-009',
      fromWarehouseId: getWarehouse(6).id, // Kho Đại Lý Hải Dương
      toWarehouseId: getWarehouse(3).id, // Kho Nguyên liệu
      transferDate: new Date('2024-12-29'),
      reason: 'Trả hàng hết hạn về kho chính',
      status: TransferStatus.completed,
      requestedBy: getUser(0).id,
      approvedBy: getUser(3).id,
      approvedAt: new Date('2024-12-29'),
      cancelledBy: null,
      totalValue: 0,
      details: [
        {
          productId: getProduct(18).id,
          quantity: 45,
          unitPrice: getProduct(18).purchasePrice || 38000,
          batchNumber: 'BATCH-013-2024',
          expiryDate: new Date('2024-12-28'),
          notes: 'Hàng hết hạn trả lại',
        },
      ],
    },

    // ================================================================
    // PHIẾU 10: PENDING - Yêu cầu vừa được tạo
    // ================================================================
    {
      transferCode: 'ST-2024-010',
      fromWarehouseId: getWarehouse(2).id, // Chi nhánh Đồng Nai
      toWarehouseId: getWarehouse(1).id, // Chi nhánh Cần Thơ
      transferDate: new Date('2024-12-30'),
      reason: 'Điều chỉnh hàng hóa giữa các chi nhánh',
      status: TransferStatus.pending,
      requestedBy: getUser(1).id,
      approvedBy: null,
      cancelledBy: null,
      totalValue: 0,
      details: [
        {
          productId: getProduct(19).id,
          quantity: 110,
          unitPrice: getProduct(19).purchasePrice || 58000,
          batchNumber: 'BATCH-014-2024',
          expiryDate: undefined,
          notes: null,
        },
        {
          productId: getProduct(20).id,
          quantity: 88,
          unitPrice: getProduct(20).purchasePrice || 72000,
          batchNumber: null,
          expiryDate: undefined,
          notes: 'Hàng mới nhập',
        },
        {
          productId: getProduct(21).id,
          quantity: 135,
          unitPrice: getProduct(21).purchasePrice || 31000,
          batchNumber: 'BATCH-015-2024',
          expiryDate: undefined,
          notes: null,
        },
      ],
    },
  ];

  // Tạo các phiếu chuyển kho
  for (const transfer of transferData) {
    const details = transfer.details;
    delete (transfer as any).details;

    // Tính tổng giá trị
    const totalValue = details.reduce((sum, d) => sum + Number(d.quantity) * Number(d.unitPrice), 0);
    (transfer as any).totalValue = totalValue;

    const createdTransfer = await prisma.stockTransfer.create({
      data: {
        ...transfer,
        details: {
          createMany: {
            data: details.map((d) => ({
              productId: d.productId,
              quantity: d.quantity,
              unitPrice: d.unitPrice,
              batchNumber: d.batchNumber,
              expiryDate: d.expiryDate,
              notes: d.notes,
            })),
          },
        },
      },
      include: { details: true },
    });

    console.log(`✅ Tạo phiếu: ${createdTransfer.transferCode} - Trạng thái: ${createdTransfer.status} (${createdTransfer.details.length} chi tiết)`);
  }

  console.log('\n✨ Đã seed xong dữ liệu StockTransfer!');
  console.log(`
📋 Tóm tắt:
├── Tổng phiếu chuyển kho: ${transferData.length} phiếu
├── Trạng thái:
│   ├── Pending (Chờ duyệt): 3 phiếu
│   ├── In Transit (Đang vận chuyển): 2 phiếu
│   ├── Completed (Hoàn thành): 4 phiếu
│   └── Cancelled (Đã hủy): 1 phiếu
├── Tổng chi tiết: ${transferData.reduce((sum, t) => sum + t.details.length, 0)} chi tiết
└── Kho liên quan: ${warehouses.length} kho

📊 Phân bố ngày:
├── 2024-12-01: 1 phiếu
├── 2024-12-02 đến 2024-12-11: 2 phiếu
├── 2024-12-26 đến 2024-12-27: 2 phiếu
├── 2024-12-28: 1 phiếu
├── 2024-12-29: 3 phiếu
└── 2024-12-30: 1 phiếu
  `);
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi seed StockTransfer:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
