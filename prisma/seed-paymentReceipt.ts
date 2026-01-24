import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Tạo payment receipts (phiếu thu)
 * 
 * ReceiptType: sales | debt_collection | refund | other
 * FinancePaymentMethod: cash | transfer | card
 * 
 * Liên kết:
 * - customerId: Customer (khách hàng thanh toán)
 * - orderId: SalesOrder? (đơn hàng liên quan, tùy chọn)
 * - createdBy: User (người tạo)
 * - approvedBy: User? (người phê duyệt)
 */

async function main() {
  console.log('💵 Bắt đầu seed dữ liệu payment_receipt...\n');

  try {
    // Lấy các user cần thiết
    const accountant = await prisma.user.findFirst({
      where: { email: 'accountant@company.com' },
    });

    const admin = await prisma.user.findFirst({
      where: { email: 'leeminhkang@gmail.com' },
    });

    if (!accountant || !admin) {
      console.error('❌ Không tìm thấy user accountant hoặc admin');
      return;
    }

    // Lấy customers
    const customers = await prisma.customer.findMany({
      take: 3,
    });

    if (customers.length === 0) {
      console.error('❌ Không tìm thấy customers');
      return;
    }

    // Lấy sales orders (tùy chọn, không bắt buộc)
    const salesOrders = await prisma.salesOrder.findMany({
      take: 2,
    });

    // Tạo danh sách payment receipts
    const receiptsToCreate = [
      // ============================================================
      // TYPE: SALES (Thu tiền hàng)
      // ============================================================
      {
        receiptCode: 'TH-SALES-202401-001',
        receiptType: 'sales' as const,
        customerId: customers[0].id,
        orderId: salesOrders.length > 0 ? salesOrders[0].id : null,
        amount: new Prisma.Decimal(25_000_000),
        paymentMethod: 'transfer' as const,
        bankName: 'Vietcombank',
        transactionReference: 'TRX20240110001',
        receiptDate: new Date('2024-01-10'),
        notes: 'Thu tiền bán hàng lô 001',
        createdBy: accountant.id,
        approvedBy: admin.id,
        approvedAt: new Date('2024-01-10'),
        isPosted: true,
        isVerified: true,
      },
      {
        receiptCode: 'TH-SALES-202401-002',
        receiptType: 'sales' as const,
        customerId: customers[1].id,
        orderId: salesOrders.length > 1 ? salesOrders[1].id : null,
        amount: new Prisma.Decimal(15_000_000),
        paymentMethod: 'cash' as const,
        bankName: null,
        transactionReference: null,
        receiptDate: new Date('2024-01-15'),
        notes: 'Thu tiền bán hàng bằng tiền mặt',
        createdBy: accountant.id,
        approvedBy: admin.id,
        approvedAt: new Date('2024-01-15'),
        isPosted: true,
        isVerified: true,
      },
      {
        receiptCode: 'TH-SALES-202401-003',
        receiptType: 'sales' as const,
        customerId: customers[2].id,
        orderId: null,
        amount: new Prisma.Decimal(18_000_000),
        paymentMethod: 'transfer' as const,
        bankName: 'VietinBank',
        transactionReference: 'TRX20240120001',
        receiptDate: new Date('2024-01-20'),
        notes: 'Thu tiền bán hàng từ đơn hàng trước',
        createdBy: accountant.id,
        approvedBy: admin.id,
        approvedAt: new Date('2024-01-20'),
        isPosted: true,
        isVerified: true,
      },
      {
        receiptCode: 'TH-SALES-202402-001',
        receiptType: 'sales' as const,
        customerId: customers[0].id,
        orderId: null,
        amount: new Prisma.Decimal(32_000_000),
        paymentMethod: 'transfer' as const,
        bankName: 'Techcombank',
        transactionReference: 'TRX20240205001',
        receiptDate: new Date('2024-02-05'),
        notes: 'Thu tiền hàng lô 002 - khách hàng VIP',
        createdBy: accountant.id,
        approvedBy: admin.id,
        approvedAt: new Date('2024-02-05'),
        isPosted: true,
        isVerified: true,
      },

      // ============================================================
      // TYPE: DEBT_COLLECTION (Thu công nợ)
      // ============================================================
      {
        receiptCode: 'TH-DEBT-202401-001',
        receiptType: 'debt_collection' as const,
        customerId: customers[1].id,
        orderId: null,
        amount: new Prisma.Decimal(10_000_000),
        paymentMethod: 'transfer' as const,
        bankName: 'Vietcombank',
        transactionReference: 'TRX20240112001',
        receiptDate: new Date('2024-01-12'),
        notes: 'Thu công nợ khách hàng - đơn hàng tháng 12/2023',
        createdBy: accountant.id,
        approvedBy: admin.id,
        approvedAt: new Date('2024-01-12'),
        isPosted: true,
        isVerified: true,
      },
      {
        receiptCode: 'TH-DEBT-202401-002',
        receiptType: 'debt_collection' as const,
        customerId: customers[2].id,
        orderId: null,
        amount: new Prisma.Decimal(8_000_000),
        paymentMethod: 'cash' as const,
        bankName: null,
        transactionReference: null,
        receiptDate: new Date('2024-01-25'),
        notes: 'Thu công nợ khách hàng - thanh toán trả góp',
        createdBy: accountant.id,
        approvedBy: admin.id,
        approvedAt: new Date('2024-01-25'),
        isPosted: false,
        isVerified: false,
      },
      {
        receiptCode: 'TH-DEBT-202402-001',
        receiptType: 'debt_collection' as const,
        customerId: customers[0].id,
        orderId: null,
        amount: new Prisma.Decimal(12_000_000),
        paymentMethod: 'transfer' as const,
        bankName: 'BIDV',
        transactionReference: 'TRX20240210001',
        receiptDate: new Date('2024-02-10'),
        notes: 'Thu công nợ quý 1/2024 - đã thỏa thuận thanh toán',
        createdBy: accountant.id,
        approvedBy: null,
        approvedAt: null,
        isPosted: false,
        isVerified: false,
      },

      // ============================================================
      // TYPE: REFUND (Hoàn tiền)
      // ============================================================
      {
        receiptCode: 'TH-REFUND-202401-001',
        receiptType: 'refund' as const,
        customerId: customers[1].id,
        orderId: null,
        amount: new Prisma.Decimal(2_000_000),
        paymentMethod: 'transfer' as const,
        bankName: 'Vietcombank',
        transactionReference: 'TRX20240118001',
        receiptDate: new Date('2024-01-18'),
        notes: 'Hoàn tiền khách hàng do trả hàng lại',
        createdBy: accountant.id,
        approvedBy: admin.id,
        approvedAt: new Date('2024-01-18'),
        isPosted: true,
        isVerified: true,
      },

      // ============================================================
      // TYPE: OTHER (Khác)
      // ============================================================
      {
        receiptCode: 'TH-OTHER-202401-001',
        receiptType: 'other' as const,
        customerId: customers[0].id,
        orderId: null,
        amount: new Prisma.Decimal(5_000_000),
        paymentMethod: 'cash' as const,
        bankName: null,
        transactionReference: null,
        receiptDate: new Date('2024-01-22'),
        notes: 'Thu tiền từ bán phế liệu',
        createdBy: accountant.id,
        approvedBy: admin.id,
        approvedAt: new Date('2024-01-22'),
        isPosted: true,
        isVerified: true,
      },
      {
        receiptCode: 'TH-OTHER-202402-001',
        receiptType: 'other' as const,
        customerId: customers[2].id,
        orderId: null,
        amount: new Prisma.Decimal(3_500_000),
        paymentMethod: 'transfer' as const,
        bankName: 'Techcombank',
        transactionReference: 'TRX20240215001',
        receiptDate: new Date('2024-02-15'),
        notes: 'Thu tiền lãi vay - quỹ tạo nghiệp',
        createdBy: accountant.id,
        approvedBy: null,
        approvedAt: null,
        isPosted: false,
        isVerified: false,
      },
    ];

    // Tạo từng receipt
    let createdCount = 0;
    for (const receiptData of receiptsToCreate) {
      // Build create data dynamically
      const createData: any = {
        receiptCode: receiptData.receiptCode,
        receiptType: receiptData.receiptType,
        amount: receiptData.amount,
        paymentMethod: receiptData.paymentMethod,
        bankName: receiptData.bankName,
        transactionReference: receiptData.transactionReference,
        receiptDate: receiptData.receiptDate,
        notes: receiptData.notes,
        isPosted: receiptData.isPosted,
        isVerified: receiptData.isVerified,
        customerRef: { connect: { id: receiptData.customerId } },
        creator: { connect: { id: receiptData.createdBy } },
      };

      // Chỉ thêm approver nếu có approvedBy
      if (receiptData.approvedBy) {
        createData.approver = { connect: { id: receiptData.approvedBy } };
        createData.approvedAt = receiptData.approvedAt;
      }

      // Chỉ thêm order nếu có orderId
      if (receiptData.orderId) {
        createData.customer = { connect: { id: receiptData.orderId } };
      }

      await prisma.paymentReceipt.upsert({
        where: { receiptCode: receiptData.receiptCode },
        update: {},
        create: createData,
      });
      createdCount++;
    }

    console.log(`✅ Tạo thành công ${createdCount} payment receipts\n`);

    // In thống kê
    const stats = await prisma.paymentReceipt.groupBy({
      by: ['receiptType'],
      _count: true,
      _sum: {
        amount: true,
      },
    });

    console.log('📊 Thống kê Payment Receipts:\n');
    for (const stat of stats) {
      const typeMap: Record<string, string> = {
        sales: '🛍️  Thu tiền hàng',
        debt_collection: '💳 Thu công nợ',
        refund: '↩️  Hoàn tiền',
        other: '📋 Khác',
      };
      console.log(`   ${typeMap[stat.receiptType]}: ${stat._count} phiếu - Tổng: ${stat._sum.amount?.toString() || '0'} VND`);
    }

    const totalAmount = stats.reduce((sum, stat) => {
      return sum.plus(stat._sum.amount || new Prisma.Decimal(0));
    }, new Prisma.Decimal(0));

    console.log(`\n   📌 Tổng cộng: ${totalAmount.toString()} VND\n`);

    // Thống kê trạng thái
    const postedCount = await prisma.paymentReceipt.count({
      where: { isPosted: true },
    });
    const approvedCount = await prisma.paymentReceipt.count({
      where: { approvedBy: { not: null } },
    });
    const verifiedCount = await prisma.paymentReceipt.count({
      where: { isVerified: true },
    });

    console.log(`   ✓ Đã ghi sổ: ${postedCount} phiếu`);
    console.log(`   ✓ Đã phê duyệt: ${approvedCount} phiếu`);
    console.log(`   ✓ Đã xác minh: ${verifiedCount} phiếu\n`);
  } catch (error) {
    console.error('❌ Lỗi khi seed payment_receipt:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
