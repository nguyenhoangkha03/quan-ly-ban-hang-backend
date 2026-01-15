import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedFinanceData() {
  try {
    console.log('🌱 Seeding finance data...');

    // Get first customer and supplier
    const customer = await prisma.customer.findFirst();
    const supplier = await prisma.supplier.findFirst();
    const user = await prisma.user.findFirst();

    if (!customer || !supplier || !user) {
      console.error('❌ Missing customer, supplier, or user');
      return;
    }

    console.log(`Using Customer: ${customer.id}, Supplier: ${supplier.id}, User: ${user.id}`);

    // Create PaymentReceipts (Thu tiền)
    const paymentReceipts = await Promise.all([
      prisma.paymentReceipt.create({
        data: {
          receiptCode: 'PT-20260101-001',
          receiptType: 'sales',
          receiptDate: new Date('2026-01-01'),
          amount: 50000000,
          paymentMethod: 'transfer',
          customerId: customer.id,
          createdBy: user.id,
          notes: 'Test data',
        },
      }),
      prisma.paymentReceipt.create({
        data: {
          receiptCode: 'PT-20260102-001',
          receiptType: 'sales',
          receiptDate: new Date('2026-01-02'),
          amount: 75000000,
          paymentMethod: 'cash',
          customerId: customer.id,
          createdBy: user.id,
          notes: 'Test data',
        },
      }),
      prisma.paymentReceipt.create({
        data: {
          receiptCode: 'PT-20260105-001',
          receiptType: 'sales',
          receiptDate: new Date('2026-01-05'),
          amount: 100000000,
          paymentMethod: 'transfer',
          customerId: customer.id,
          createdBy: user.id,
          notes: 'Test data',
        },
      }),
      prisma.paymentReceipt.create({
        data: {
          receiptCode: 'PT-20260108-001',
          receiptType: 'debt_collection',
          receiptDate: new Date('2026-01-08'),
          amount: 60000000,
          paymentMethod: 'transfer',
          customerId: customer.id,
          createdBy: user.id,
          notes: 'Test data',
        },
      }),
    ]);

    console.log(`✅ Created ${paymentReceipts.length} PaymentReceipts`);

    // Create PaymentVouchers (Chi tiền)
    const paymentVouchers = await Promise.all([
      // Salary
      prisma.paymentVoucher.create({
        data: {
          voucherCode: 'PC-20260103-001',
          paymentDate: new Date('2026-01-03'),
          amount: 100000000,
          paymentMethod: 'transfer',
          voucherType: 'salary',
          isPosted: true,
          supplierId: null,
          createdBy: user.id,
          notes: 'Trả lương tháng 1',
        },
      }),
      // Operating cost
      prisma.paymentVoucher.create({
        data: {
          voucherCode: 'PC-20260104-001',
          paymentDate: new Date('2026-01-04'),
          amount: 20000000,
          paymentMethod: 'cash',
          voucherType: 'operating_cost',
          isPosted: true,
          supplierId: null,
          createdBy: user.id,
          notes: 'Chi phí điện nước, internet',
        },
      }),
      // Supplier payment
      prisma.paymentVoucher.create({
        data: {
          voucherCode: 'PC-20260106-001',
          paymentDate: new Date('2026-01-06'),
          amount: 150000000,
          paymentMethod: 'transfer',
          voucherType: 'supplier_payment',
          isPosted: true,
          supplierId: supplier.id,
          createdBy: user.id,
          notes: 'Thanh toán hóa đơn mua hàng',
        },
      }),
      // Operating cost - rent
      prisma.paymentVoucher.create({
        data: {
          voucherCode: 'PC-20260107-001',
          paymentDate: new Date('2026-01-07'),
          amount: 30000000,
          paymentMethod: 'transfer',
          voucherType: 'operating_cost',
          isPosted: true,
          supplierId: null,
          createdBy: user.id,
          notes: 'Tiền thuê văn phòng',
        },
      }),
      // Supplier payment 2
      prisma.paymentVoucher.create({
        data: {
          voucherCode: 'PC-20260109-001',
          paymentDate: new Date('2026-01-09'),
          amount: 80000000,
          paymentMethod: 'cash',
          voucherType: 'supplier_payment',
          isPosted: true,
          supplierId: supplier.id,
          createdBy: user.id,
          notes: 'Thanh toán hóa đơn mua hàng',
        },
      }),
      // Salary bonus
      prisma.paymentVoucher.create({
        data: {
          voucherCode: 'PC-20260110-001',
          paymentDate: new Date('2026-01-10'),
          amount: 50000000,
          paymentMethod: 'transfer',
          voucherType: 'salary',
          isPosted: true,
          supplierId: null,
          createdBy: user.id,
          notes: 'Thưởng năm mới',
        },
      }),
    ]);

    console.log(`✅ Created ${paymentVouchers.length} PaymentVouchers`);

    // Create CashFund for Jan 2026
    const cashFunds = await Promise.all([
      prisma.cashFund.upsert({
        where: { fundDate: new Date('2026-01-01') },
        update: {
          openingBalance: 1000000000,
          totalReceipts: 50000000,
          totalPayments: 100000000,
          closingBalance: 950000000,
          isLocked: true,
        },
        create: {
          fundDate: new Date('2026-01-01'),
          openingBalance: 1000000000,
          totalReceipts: 50000000,
          totalPayments: 100000000,
          closingBalance: 950000000,
          isLocked: true,
        },
      }),
      prisma.cashFund.upsert({
        where: { fundDate: new Date('2026-01-02') },
        update: {
          openingBalance: 950000000,
          totalReceipts: 75000000,
          totalPayments: 20000000,
          closingBalance: 1005000000,
          isLocked: true,
        },
        create: {
          fundDate: new Date('2026-01-02'),
          openingBalance: 950000000,
          totalReceipts: 75000000,
          totalPayments: 20000000,
          closingBalance: 1005000000,
          isLocked: true,
        },
      }),
      prisma.cashFund.upsert({
        where: { fundDate: new Date('2026-01-03') },
        update: {
          openingBalance: 1005000000,
          totalReceipts: 0,
          totalPayments: 100000000,
          closingBalance: 905000000,
          isLocked: true,
        },
        create: {
          fundDate: new Date('2026-01-03'),
          openingBalance: 1005000000,
          totalReceipts: 0,
          totalPayments: 100000000,
          closingBalance: 905000000,
          isLocked: true,
        },
      }),
      prisma.cashFund.upsert({
        where: { fundDate: new Date('2026-01-10') },
        update: {
          openingBalance: 900000000,
          totalReceipts: 235000000,
          totalPayments: 430000000,
          closingBalance: 705000000,
          isLocked: false,
        },
        create: {
          fundDate: new Date('2026-01-10'),
          openingBalance: 900000000,
          totalReceipts: 235000000,
          totalPayments: 430000000,
          closingBalance: 705000000,
          isLocked: false,
        },
      }),
    ]);

    console.log(`✅ Created/Updated ${cashFunds.length} CashFund records`);

    console.log('✅ Finance data seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedFinanceData();
