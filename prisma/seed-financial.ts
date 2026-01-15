import { PrismaClient } from '@prisma/client';
import { startOfMonth, subDays, format } from 'date-fns';

const prisma = new PrismaClient();

async function seedFinancialData() {
  console.log('Starting financial data seed...');

  const today = new Date();
  const startOfThisMonth = startOfMonth(today);

  // Create sample payment receipts (Thu - phiếu thu)
  console.log('Creating payment receipts...');
  const receipts = [];
  
  for (let i = 0; i < 15; i++) {
    const receiptDate = subDays(today, Math.floor(Math.random() * 30));
    receipts.push(
      prisma.paymentReceipt.create({
        data: {
          receiptCode: `PT-${format(receiptDate, 'yyyyMMdd')}-${String(i + 1).padStart(3, '0')}`,
          receiptType: ['sales', 'debt_collection', 'refund'][Math.floor(Math.random() * 3)] as any,
          customerId: Math.floor(Math.random() * 10) + 1,
          amount: Math.floor(Math.random() * 50000000) + 1000000,
          paymentMethod: ['cash', 'transfer', 'card'][Math.floor(Math.random() * 3)] as any,
          receiptDate: receiptDate,
          createdBy: 1,
        },
      })
    );
  }

  await Promise.all(receipts);

  // Create sample payment vouchers (Chi - phiếu chi)
  console.log('Creating payment vouchers...');
  const vouchers = [];
  
  for (let i = 0; i < 20; i++) {
    const paymentDate = subDays(today, Math.floor(Math.random() * 30));
    vouchers.push(
      prisma.paymentVoucher.create({
        data: {
          voucherCode: `PC-${format(paymentDate, 'yyyyMMdd')}-${String(i + 1).padStart(3, '0')}`,
          voucherType: ['salary', 'operating_cost', 'supplier_payment', 'refund'][Math.floor(Math.random() * 4)] as any,
          supplierId: i < 10 ? Math.floor(Math.random() * 5) + 1 : undefined,
          amount: Math.floor(Math.random() * 50000000) + 1000000,
          paymentMethod: ['cash', 'transfer'][Math.floor(Math.random() * 2)] as any,
          paymentDate: paymentDate,
          createdBy: 1,
        },
      })
    );
  }

  await Promise.all(vouchers);

  // Create cash fund records for each day of the month
  console.log('Creating cash fund records...');
  const cashFunds = [];
  
  for (let i = 0; i < 30; i++) {
    const fundDate = new Date(today.getFullYear(), today.getMonth(), i + 1);
    if (fundDate <= today) {
      cashFunds.push(
        prisma.cashFund.create({
          data: {
            fundDate: fundDate,
            openingBalance: 200000000 + Math.random() * 100000000,
            totalReceipts: Math.floor(Math.random() * 100000000) + 10000000,
            totalPayments: Math.floor(Math.random() * 80000000) + 5000000,
            isLocked: fundDate.getDate() < today.getDate(),
          },
        })
      );
    }
  }

  await Promise.all(cashFunds);

  console.log('Financial data seeded successfully!');
}

seedFinancialData()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
