import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Bắt đầu seed dữ liệu Cash Fund...');

    await prisma.cashFund.deleteMany({});

    // Helper Decimal
    const d = (value: number) => new Prisma.Decimal(value);

    // Ngày hôm nay (chỉ lấy date, bỏ time)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cashFunds = [
        {
            fundDate: new Date('2025-12-22'),
            openingBalance: d(40_000_000),
            totalReceipts: d(15_200_000),
            totalPayments: d(9_800_000),
            closingBalance: d(45_400_000),
            isLocked: true,
            lockedAt: new Date('2025-12-22T23:59:59'),
            approvedBy: 1,
            reconciledBy: 1,
            notes: 'Doanh thu bán lẻ + chi vận chuyển',
        },
        {
            fundDate: new Date('2025-12-23'),
            openingBalance: d(45_400_000),
            totalReceipts: d(18_600_000),
            totalPayments: d(12_300_000),
            closingBalance: d(51_700_000),
            isLocked: true,
            lockedAt: new Date('2025-12-23T23:59:59'),
            approvedBy: 1,
            reconciledBy: 2,
            notes: 'Bán buôn đại lý cấp 1',
        },
        {
            fundDate: new Date('2025-12-24'),
            openingBalance: d(51_700_000),
            totalReceipts: d(11_400_000),
            totalPayments: d(8_900_000),
            closingBalance: d(54_200_000),
            isLocked: true,
            lockedAt: new Date('2025-12-24T23:59:59'),
            approvedBy: 1,
            reconciledBy: 1,
            notes: 'Ngày cận lễ',
        },
        {
            fundDate: new Date('2025-12-25'),
            openingBalance: d(54_200_000),
            totalReceipts: d(20_800_000),
            totalPayments: d(13_600_000),
            closingBalance: d(61_400_000),
            isLocked: true,
            lockedAt: new Date('2025-12-25T23:59:59'),
            approvedBy: 1,
            reconciledBy: 1,
            notes: 'Doanh thu Noel',
        },
        {
            fundDate: new Date('2025-12-26'),
            openingBalance: d(61_400_000),
            totalReceipts: d(9_700_000),
            totalPayments: d(11_200_000),
            closingBalance: d(59_900_000),
            isLocked: true,
            lockedAt: new Date('2025-12-26T23:59:59'),
            approvedBy: 1,
            reconciledBy: 2,
            notes: 'Chi nhập bao bì',
        },
        {
            fundDate: new Date('2025-12-27'),
            openingBalance: d(59_900_000),
            totalReceipts: d(13_500_000),
            totalPayments: d(7_300_000),
            closingBalance: d(66_100_000),
            isLocked: true,
            lockedAt: new Date('2025-12-27T23:59:59'),
            approvedBy: 1,
            reconciledBy: 1,
            notes: 'Bán lẻ cuối tuần',
        },
        {
            fundDate: new Date('2025-12-28'),
            openingBalance: d(66_100_000),
            totalReceipts: d(16_900_000),
            totalPayments: d(14_200_000),
            closingBalance: d(68_800_000),
            isLocked: true,
            lockedAt: new Date('2025-12-28T23:59:59'),
            approvedBy: 1,
            reconciledBy: 1,
            notes: 'Chi marketing & quảng cáo',
        },
        {
            fundDate: new Date('2025-12-29'),
            openingBalance: d(68_800_000),
            totalReceipts: d(24_500_000),
            totalPayments: d(10_400_000),
            closingBalance: d(82_900_000),
            isLocked: true,
            lockedAt: new Date('2025-12-29T23:59:59'),
            approvedBy: 1,
            reconciledBy: 2,
            notes: 'Doanh thu cao cuối tháng',
        },
        {
            fundDate: new Date('2025-12-30'),
            openingBalance: d(82_900_000),
            totalReceipts: d(7_800_000),
            totalPayments: d(12_600_000),
            closingBalance: d(78_100_000),
            isLocked: true,
            lockedAt: new Date('2025-12-30T23:59:59'),
            approvedBy: 1,
            reconciledBy: 1,
            notes: 'Chi nhập nguyên liệu',
        },

        // ===============================
        // NGÀY HÔM NAY
        // ===============================
        {
            fundDate: today,
            openingBalance: d(78_100_000),
            totalReceipts: d(5_200_000),
            totalPayments: d(3_600_000),
            closingBalance: d(79_700_000),
            isLocked: false, // hôm nay chưa chốt
            lockedAt: null,
            approvedBy: null,
            reconciledBy: null,
            notes: 'Quỹ trong ngày – chưa chốt',
        },
    ];

    for (const fund of cashFunds) {
        await prisma.cashFund.upsert({
            where: { fundDate: fund.fundDate },
            update: fund,
            create: fund,
        });
    }

    console.log(`✅ Đã seed xong ${cashFunds.length} dòng Cash Fund`);
    console.log(`   - Đã chốt quỹ: ${cashFunds.filter(f => f.isLocked).length}`);
    console.log(`   - Chưa chốt quỹ: ${cashFunds.filter(f => !f.isLocked).length}`);
}

main()
    .catch((e) => {
        console.error('❌ Lỗi khi seed Cash Fund:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
