import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Tạo danh sách 10 ngày, BAO GỒM hôm nay
 * Mỗi ngày set giờ = 00:00:00 để khớp @db.Date
 */
function getLast10DaysIncludingToday(): Date[] {
  const dates: Date[] = [];
  for (let i = 9; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    dates.push(d);
  }
  return dates;
}

async function main() {
  console.log('💰 Bắt đầu seed dữ liệu cash_fund (10 ngày, có hôm nay)...');

  const approverUserId = 1; // user kế toán / admin (đảm bảo tồn tại)
  const dates = getLast10DaysIncludingToday();

  for (const fundDate of dates) {
    const openingBalance = new Prisma.Decimal(10_000_000);

    const totalReceipts = new Prisma.Decimal(
      Math.floor(Math.random() * 5_000_000)
    );

    const totalPayments = new Prisma.Decimal(
      Math.floor(Math.random() * 3_000_000)
    );

    // closing = opening + thu - chi
    const closingBalance = openingBalance
      .plus(totalReceipts)
      .minus(totalPayments);

    await prisma.cashFund.upsert({
      where: { fundDate },
      update: {
        openingBalance,
        totalReceipts,
        totalPayments,
        closingBalance,
        notes: 'Seed dữ liệu quỹ tiền mặt',
        approver: {
          connect: { id: approverUserId },
        },
      },
      create: {
        fundDate,
        openingBalance,
        totalReceipts,
        totalPayments,
        closingBalance,
        notes: 'Seed dữ liệu quỹ tiền mặt',
        approver: {
          connect: { id: approverUserId },
        },
      },
    });
  }

  console.log('✅ Seed xong 10 bản ghi cash_fund (bao gồm hôm nay)');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi seed cash_fund:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
