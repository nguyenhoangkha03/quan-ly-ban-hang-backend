import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Tạo payment vouchers (phiếu chi)
 * 
 * VoucherType: salary | operating_cost | supplier_payment | refund | other
 * VoucherPaymentMethod: cash | transfer
 * 
 * Liên kết:
 * - supplierId: Optional (nếu type = supplier_payment)
 * - createdBy: User (người tạo)
 * - approvedBy: User? (người phê duyệt)
 */

async function main() {
  console.log('💸 Bắt đầu seed dữ liệu payment_voucher...\n');

  try {
    // Lấy các user cần thiết
    const accountant = await prisma.user.findFirst({
      where: { email: 'accountant@company.com' },
    });

    const admin = await prisma.user.findFirst({
      where: { email: 'nhoangkha03@gmail.com' },
    });

    if (!accountant || !admin) {
      console.error('❌ Không tìm thấy user accountant hoặc admin');
      return;
    }

    // Lấy suppliers
    const suppliers = await prisma.supplier.findMany({
      take: 2,
    });

    if (suppliers.length === 0) {
      console.error('❌ Không tìm thấy suppliers');
      return;
    }

    // Tạo danh sách payment vouchers
    const vouchersToCreate = [
      // ============================================================
      // TYPE: SALARY (Trả lương)
      // ============================================================
      {
        voucherCode: 'PC-SALARY-202401-001',
        voucherType: 'salary' as const,
        supplierId: null,
        expenseAccount: '6271', // Chi phí nhân công
        amount: new Prisma.Decimal(50_000_000),
        paymentMethod: 'transfer' as const,
        bankName: 'Vietcombank',
        paymentDate: new Date('2024-02-05'),
        notes: 'Trả lương tháng 1/2024',
        createdBy: accountant.id,
        approvedBy: admin.id,
        approvedAt: new Date('2024-02-04'),
        isPosted: true,
      },
      {
        voucherCode: 'PC-SALARY-202402-001',
        voucherType: 'salary' as const,
        supplierId: null,
        expenseAccount: '6271',
        amount: new Prisma.Decimal(52_000_000),
        paymentMethod: 'transfer' as const,
        bankName: 'VietinBank',
        paymentDate: new Date('2024-03-05'),
        notes: 'Trả lương tháng 2/2024',
        createdBy: accountant.id,
        approvedBy: admin.id,
        approvedAt: new Date('2024-03-04'),
        isPosted: true,
      },

      // ============================================================
      // TYPE: OPERATING_COST (Chi phí hoạt động)
      // ============================================================
      {
        voucherCode: 'PC-OPEX-202401-001',
        voucherType: 'operating_cost' as const,
        supplierId: null,
        expenseAccount: '6411', // Chi phí điện nước
        amount: new Prisma.Decimal(5_000_000),
        paymentMethod: 'cash' as const,
        bankName: null,
        paymentDate: new Date('2024-01-15'),
        notes: 'Thanh toán tiền điện nước tháng 1',
        createdBy: accountant.id,
        approvedBy: admin.id,
        approvedAt: new Date('2024-01-14'),
        isPosted: true,
      },
      {
        voucherCode: 'PC-OPEX-202401-002',
        voucherType: 'operating_cost' as const,
        supplierId: null,
        expenseAccount: '6212', // Chi phí vận chuyển
        amount: new Prisma.Decimal(3_000_000),
        paymentMethod: 'transfer' as const,
        bankName: 'Techcombank',
        paymentDate: new Date('2024-01-20'),
        notes: 'Thanh toán chi phí vận chuyển hàng tháng',
        createdBy: accountant.id,
        approvedBy: admin.id,
        approvedAt: new Date('2024-01-19'),
        isPosted: false,
      },
      {
        voucherCode: 'PC-OPEX-202402-001',
        voucherType: 'operating_cost' as const,
        supplierId: null,
        expenseAccount: '6421', // Chi phí sửa chữa, bảo dưỡng
        amount: new Prisma.Decimal(2_500_000),
        paymentMethod: 'cash' as const,
        bankName: null,
        paymentDate: new Date('2024-02-10'),
        notes: 'Sửa chữa máy móc kho hàng',
        createdBy: accountant.id,
        approvedBy: null,
        approvedAt: null,
        isPosted: false,
      },

      // ============================================================
      // TYPE: SUPPLIER_PAYMENT (Thanh toán cho NCC)
      // ============================================================
      {
        voucherCode: 'PC-NCC-202401-001',
        voucherType: 'supplier_payment' as const,
        supplierId: suppliers[0].id,
        expenseAccount: null,
        amount: new Prisma.Decimal(25_000_000),
        paymentMethod: 'transfer' as const,
        bankName: 'Vietcombank',
        paymentDate: new Date('2024-01-10'),
        notes: `Thanh toán hóa đơn cho ${suppliers[0].supplierName}`,
        createdBy: accountant.id,
        approvedBy: admin.id,
        approvedAt: new Date('2024-01-09'),
        isPosted: true,
      },
      {
        voucherCode: 'PC-NCC-202401-002',
        voucherType: 'supplier_payment' as const,
        supplierId: suppliers[1].id,
        expenseAccount: null,
        amount: new Prisma.Decimal(15_000_000),
        paymentMethod: 'transfer' as const,
        bankName: 'VietinBank',
        paymentDate: new Date('2024-01-18'),
        notes: `Thanh toán hóa đơn cho ${suppliers[1].supplierName}`,
        createdBy: accountant.id,
        approvedBy: admin.id,
        approvedAt: new Date('2024-01-17'),
        isPosted: true,
      },
      {
        voucherCode: 'PC-NCC-202402-001',
        voucherType: 'supplier_payment' as const,
        supplierId: suppliers[0].id,
        expenseAccount: null,
        amount: new Prisma.Decimal(30_000_000),
        paymentMethod: 'transfer' as const,
        bankName: 'BIDV',
        paymentDate: new Date('2024-02-15'),
        notes: `Thanh toán hóa đơn cho ${suppliers[0].supplierName}`,
        createdBy: accountant.id,
        approvedBy: null,
        approvedAt: null,
        isPosted: false,
      },

      // ============================================================
      // TYPE: REFUND (Hoàn lại tiền)
      // ============================================================
      {
        voucherCode: 'PC-REFUND-202401-001',
        voucherType: 'refund' as const,
        supplierId: null,
        expenseAccount: '6240', // Khác
        amount: new Prisma.Decimal(2_000_000),
        paymentMethod: 'cash' as const,
        bankName: null,
        paymentDate: new Date('2024-01-25'),
        notes: 'Hoàn lại tiền khách hàng do lỗi tính giá',
        createdBy: accountant.id,
        approvedBy: admin.id,
        approvedAt: new Date('2024-01-24'),
        isPosted: true,
      },

      // ============================================================
      // TYPE: OTHER (Khác)
      // ============================================================
      {
        voucherCode: 'PC-OTHER-202402-001',
        voucherType: 'other' as const,
        supplierId: null,
        expenseAccount: '6290', // Khác
        amount: new Prisma.Decimal(1_000_000),
        paymentMethod: 'cash' as const,
        bankName: null,
        paymentDate: new Date('2024-02-28'),
        notes: 'Chi tiền thưởng sinh nhật nhân viên',
        createdBy: accountant.id,
        approvedBy: null,
        approvedAt: null,
        isPosted: false,
      },
    ];

    // Tạo từng voucher
    let createdCount = 0;
    for (const voucherData of vouchersToCreate) {
      // Build create data dynamically
      const createData: any = {
        voucherCode: voucherData.voucherCode,
        voucherType: voucherData.voucherType,
        expenseAccount: voucherData.expenseAccount,
        amount: voucherData.amount,
        paymentMethod: voucherData.paymentMethod,
        bankName: voucherData.bankName,
        paymentDate: voucherData.paymentDate,
        notes: voucherData.notes,
        isPosted: voucherData.isPosted,
        creator: { connect: { id: voucherData.createdBy } },
      };

      // Chỉ thêm approver nếu có approvedBy
      if (voucherData.approvedBy) {
        createData.approver = { connect: { id: voucherData.approvedBy } };
        createData.approvedAt = voucherData.approvedAt;
      }

      // Chỉ thêm supplier nếu có supplierId
      if (voucherData.supplierId) {
        createData.supplier = { connect: { id: voucherData.supplierId } };
      }

      await prisma.paymentVoucher.upsert({
        where: { voucherCode: voucherData.voucherCode },
        update: {},
        create: createData,
      });
      createdCount++;
    }

    console.log(`✅ Tạo thành công ${createdCount} payment vouchers\n`);

    // In thống kê
    const stats = await prisma.paymentVoucher.groupBy({
      by: ['voucherType'],
      _count: true,
      _sum: {
        amount: true,
      },
    });

    console.log('📊 Thống kê Payment Vouchers:\n');
    for (const stat of stats) {
      const typeMap: Record<string, string> = {
        salary: '💰 Lương',
        operating_cost: '🏢 Chi phí hoạt động',
        supplier_payment: '🏭 Thanh toán NCC',
        refund: '↩️  Hoàn lại',
        other: '📋 Khác',
      };
      console.log(`   ${typeMap[stat.voucherType]}: ${stat._count} phiếu - Tổng: ${stat._sum.amount?.toString() || '0'} VND`);
    }

    const totalAmount = stats.reduce((sum, stat) => {
      return sum.plus(stat._sum.amount || new Prisma.Decimal(0));
    }, new Prisma.Decimal(0));

    console.log(`\n   📌 Tổng cộng: ${totalAmount.toString()} VND\n`);

    // Thống kê trạng thái
    const postedCount = await prisma.paymentVoucher.count({
      where: { isPosted: true },
    });
    const approvedCount = await prisma.paymentVoucher.count({
      where: { approvedBy: { not: null } },
    });

    console.log(`   ✓ Đã hạch toán: ${postedCount} phiếu`);
    console.log(`   ✓ Đã phê duyệt: ${approvedCount} phiếu\n`);
  } catch (error) {
    console.error('❌ Lỗi khi seed payment_voucher:', error);
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
