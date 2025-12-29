import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function main() {
  console.log('🚀 Bắt đầu seed dữ liệu Stock Transactions & Transfers');

  // Xóa dữ liệu cũ
  await prisma.stockTransactionDetail.deleteMany({});
  await prisma.stockTransaction.deleteMany({});
  await prisma.stockTransferDetail.deleteMany({});
  await prisma.stockTransfer.deleteMany({});

  //   console.log('✅ Đã xóa dữ liệu cũ');

  //   // ============================================
  //   // PHẦN 1: STOCK TRANSACTIONS
  //   // ============================================

  //   console.log('\n📦 === TẠO STOCK TRANSACTIONS ===\n');

  //   // --- GIAO DỊCH 1: NHẬP NGUYÊN LIỆU VÀO KHO ---
  //   console.log('💼 Giao dịch 1: Nhập nguyên liệu từ nhà cung cấp');
  //   const transaction1 = await prisma.stockTransaction.create({
  //     data: {
  //       transactionCode: 'NK-2024110001',
  //       transactionType: 'import',
  //       warehouseId: 13, // Kho Nguyên Liệu
  //       totalValue: 4350000,
  //       reason: 'Nhập nguyên liệu định kỳ tháng 11/2024',
  //       notes: 'Đã kiểm tra chất lượng, đầy đủ CO/CQ',
  //       status: 'completed',
  //       createdBy: 8, // Trần Thị Lan - Manager
  //       approvedBy: 7, // Nguyễn Văn Quản - Manager
  //       createdAt: new Date('2024-11-05T08:30:00'),
  //       approvedAt: new Date('2024-11-05T10:15:00'),
  //     },
  //   });

  //   await prisma.stockTransactionDetail.createMany({
  //     data: [
  //       {
  //         transactionId: transaction1.id,
  //         productId: 14, // Urea 46N
  //         warehouseId: 13,
  //         quantity: 10,
  //         unitPrice: 285000,
  //         batchNumber: 'UREA-CM-202411-01',
  //         notes: 'Nhập từ Cà Mau',
  //       },
  //       {
  //         transactionId: transaction1.id,
  //         productId: 15, // MAP
  //         warehouseId: 13,
  //         quantity: 3,
  //         unitPrice: 420000,
  //         batchNumber: 'MAP-VN-202411-01',
  //       },
  //       {
  //         transactionId: transaction1.id,
  //         productId: 16, // Kali Nitrat
  //         warehouseId: 13,
  //         quantity: 2,
  //         unitPrice: 680000,
  //         batchNumber: 'KNO3-IL-202411-01',
  //         notes: 'Nhập khẩu Israel - Haifa',
  //       },
  //     ],
  //   });

  //   // --- GIAO DỊCH 2: NHẬP BAO BÌ ---
  //   console.log('📦 Giao dịch 2: Nhập bao bì đóng gói');
  //   const transaction2 = await prisma.stockTransaction.create({
  //     data: {
  //       transactionCode: 'NK-2024110002',
  //       transactionType: 'import',
  //       warehouseId: 14, // Kho Bao Bì
  //       totalValue: 23850000,
  //       reason: 'Nhập bao bì cho sản xuất Q4/2024',
  //       status: 'completed',
  //       createdBy: 9, // Đỗ Văn Cường
  //       approvedBy: 8,
  //       createdAt: new Date('2024-11-08T09:00:00'),
  //       approvedAt: new Date('2024-11-08T14:30:00'),
  //     },
  //   });

  //   await prisma.stockTransactionDetail.createMany({
  //     data: [
  //       {
  //         transactionId: transaction2.id,
  //         productId: 22, // Chai 500ml
  //         warehouseId: 14,
  //         quantity: 5000,
  //         unitPrice: 1800,
  //         batchNumber: 'CHAI-500ML-202411',
  //       },
  //       {
  //         transactionId: transaction2.id,
  //         productId: 23, // Chai 1L
  //         warehouseId: 14,
  //         quantity: 3000,
  //         unitPrice: 2500,
  //         batchNumber: 'CHAI-1L-202411',
  //       },
  //       {
  //         transactionId: transaction2.id,
  //         productId: 28, // Thùng carton 20 chai
  //         warehouseId: 14,
  //         quantity: 500,
  //         unitPrice: 8500,
  //         batchNumber: 'CARTON-20-202411',
  //       },
  //     ],
  //   });

  //   // --- GIAO DỊCH 3: XUẤT NGUYÊN LIỆU CHO SẢN XUẤT ---
  //   console.log('🏭 Giao dịch 3: Xuất nguyên liệu cho sản xuất');
  //   const transaction3 = await prisma.stockTransaction.create({
  //     data: {
  //       transactionCode: 'XK-SX-2024110001',
  //       transactionType: 'export',
  //       warehouseId: 13, // Kho Nguyên Liệu
  //       totalValue: 1545000,
  //       reason: 'Xuất nguyên liệu sản xuất lô SIÊU ĐẬU TRÁI',
  //       referenceType: 'production_order',
  //       referenceId: 1,
  //       status: 'completed',
  //       createdBy: 9, // Production
  //       approvedBy: 7,
  //       createdAt: new Date('2024-11-10T07:00:00'),
  //       approvedAt: new Date('2024-11-10T07:30:00'),
  //     },
  //   });

  //   await prisma.stockTransactionDetail.createMany({
  //     data: [
  //       {
  //         transactionId: transaction3.id,
  //         productId: 14, // Urea
  //         warehouseId: 13,
  //         quantity: 2,
  //         unitPrice: 285000,
  //         batchNumber: 'UREA-CM-202411-01',
  //       },
  //       {
  //         transactionId: transaction3.id,
  //         productId: 15, // MAP
  //         warehouseId: 13,
  //         quantity: 1,
  //         unitPrice: 420000,
  //         batchNumber: 'MAP-VN-202411-01',
  //       },
  //       {
  //         transactionId: transaction3.id,
  //         productId: 17, // Borax
  //         warehouseId: 13,
  //         quantity: 5,
  //         unitPrice: 45000,
  //         batchNumber: 'BO-CN-202411',
  //       },
  //       {
  //         transactionId: transaction3.id,
  //         productId: 19, // Amino acid
  //         warehouseId: 13,
  //         quantity: 1,
  //         unitPrice: 1850000 / 20, // Tính theo lít
  //         notes: 'Lấy 5L từ can 20L',
  //       },
  //     ],
  //   });

  //   // --- GIAO DỊCH 4: NHẬP THÀNH PHẨM SAU SẢN XUẤT ---
  //   console.log('✅ Giao dịch 4: Nhập thành phẩm sau sản xuất');
  //   const transaction4 = await prisma.stockTransaction.create({
  //     data: {
  //       transactionCode: 'NK-SX-2024110001',
  //       transactionType: 'import',
  //       warehouseId: 12, // Kho Nhà Máy Sản Xuất
  //       totalValue: 5600000,
  //       reason: 'Hoàn thành sản xuất lô SIÊU ĐẬU TRÁI 500ml',
  //       referenceType: 'production_order',
  //       referenceId: 1,
  //       status: 'completed',
  //       createdBy: 9, // Production
  //       approvedBy: 7,
  //       createdAt: new Date('2024-11-12T16:00:00'),
  //       approvedAt: new Date('2024-11-12T16:30:00'),
  //     },
  //   });

  //   await prisma.stockTransactionDetail.create({
  //     data: {
  //       transactionId: transaction4.id,
  //       productId: 4, // SIÊU ĐẬU TRÁI 500ml
  //       warehouseId: 12,
  //       quantity: 200,
  //       unitPrice: 28000,
  //       batchNumber: 'SDT-500ML-202411-L01',
  //       expiryDate: new Date('2026-11-30'),
  //       notes: 'Lô sản xuất đầu tiên tháng 11',
  //     },
  //   });

  //   // --- GIAO DỊCH 5: XUẤT BÁN HÀNG ---
  //   console.log('💰 Giao dịch 5: Xuất bán hàng cho khách hàng');
  //   const transaction5 = await prisma.stockTransaction.create({
  //     data: {
  //       transactionCode: 'XK-BH-2024110001',
  //       transactionType: 'export',
  //       warehouseId: 15, // Kho Thành Phẩm
  //       totalValue: 3900000,
  //       reason: 'Xuất hàng bán lẻ cho đại lý Cần Thơ',
  //       referenceType: 'sales_order',
  //       referenceId: 101,
  //       status: 'completed',
  //       createdBy: 12, // Sales
  //       approvedBy: 7,
  //       createdAt: new Date('2024-11-15T10:00:00'),
  //       approvedAt: new Date('2024-11-15T11:00:00'),
  //     },
  //   });

  //   await prisma.stockTransactionDetail.createMany({
  //     data: [
  //       {
  //         transactionId: transaction5.id,
  //         productId: 4, // SIÊU ĐẬU TRÁI 500ml
  //         warehouseId: 15,
  //         quantity: 50,
  //         unitPrice: 52000, // Giá bán sỉ
  //         batchNumber: 'SDT-500ML-202411-L01',
  //         expiryDate: new Date('2026-11-30'),
  //       },
  //       {
  //         transactionId: transaction5.id,
  //         productId: 6, // BÓN LỚN TRÁI
  //         warehouseId: 15,
  //         quantity: 30,
  //         unitPrice: 72000,
  //         batchNumber: 'BLT-1KG-202410-L05',
  //         expiryDate: new Date('2027-06-30'),
  //       },
  //     ],
  //   });

  //   // --- GIAO DỊCH 6: KIỂM KÊ TỒN KHO ---
  //   console.log('📊 Giao dịch 6: Kiểm kê và điều chỉnh tồn kho');
  //   const transaction6 = await prisma.stockTransaction.create({
  //     data: {
  //       transactionCode: 'DC-2024110001',
  //       transactionType: 'stocktake',
  //       warehouseId: 15, // Kho Thành Phẩm
  //       totalValue: -520000,
  //       reason: 'Kiểm kê định kỳ phát hiện thất thoát',
  //       notes: 'Hàng hỏng do lưu kho không đúng quy trình',
  //       status: 'completed',
  //       createdBy: 10, // Staff
  //       approvedBy: 8,
  //       createdAt: new Date('2024-11-18T14:00:00'),
  //       approvedAt: new Date('2024-11-18T15:30:00'),
  //     },
  //   });

  //   await prisma.stockTransactionDetail.createMany({
  //     data: [
  //       {
  //         transactionId: transaction6.id,
  //         productId: 7, // CANXI-BO ỚT
  //         warehouseId: 15,
  //         quantity: -10, // Số âm = giảm tồn
  //         unitPrice: 50000,
  //         batchNumber: 'CBO-500ML-202409-L03',
  //         notes: 'Chai bị nứt khi vận chuyển nội bộ',
  //       },
  //       {
  //         transactionId: transaction6.id,
  //         productId: 9, // TRICHODERMA
  //         warehouseId: 15,
  //         quantity: -2,
  //         unitPrice: 80000,
  //         batchNumber: 'TRICH-500G-202408-L02',
  //         expiryDate: new Date('2025-08-31'),
  //         notes: 'Hết hạn sử dụng',
  //       },
  //     ],
  //   });

  //   // --- GIAO DỊCH 7: NHẬP AMINO ACID ---
  //   console.log('🧪 Giao dịch 7: Nhập hóa chất đặc biệt');
  //   const transaction7 = await prisma.stockTransaction.create({
  //     data: {
  //       transactionCode: 'NK-2024110003',
  //       transactionType: 'import',
  //       warehouseId: 13, // Kho Nguyên Liệu
  //       totalValue: 3700000,
  //       reason: 'Nhập amino acid và phụ gia nhập khẩu',
  //       status: 'completed',
  //       createdBy: 8,
  //       approvedBy: 7,
  //       createdAt: new Date('2024-11-20T09:00:00'),
  //       approvedAt: new Date('2024-11-20T11:00:00'),
  //     },
  //   });

  //   await prisma.stockTransactionDetail.createMany({
  //     data: [
  //       {
  //         transactionId: transaction7.id,
  //         productId: 19, // Amino Acid lỏng
  //         warehouseId: 13,
  //         quantity: 2, // 2 can x 20L
  //         unitPrice: 1850000,
  //         batchNumber: 'AMINO-FR-202411',
  //         expiryDate: new Date('2026-06-30'),
  //         notes: 'Nhập khẩu Pháp, đã có giấy phép',
  //       },
  //     ],
  //   });

  //   // --- GIAO DỊCH 8: GIAO DỊCH DRAFT (Chưa duyệt) ---
  //   console.log('📝 Giao dịch 8: Phiếu xuất đang chờ duyệt');
  //   const transaction8 = await prisma.stockTransaction.create({
  //     data: {
  //       transactionCode: 'XK-BH-2024110002',
  //       transactionType: 'export',
  //       warehouseId: 15,
  //       totalValue: 6500000,
  //       reason: 'Xuất hàng cho chi nhánh Đồng Nai',
  //       status: 'draft',
  //       createdBy: 12, // Sales
  //       createdAt: new Date('2024-11-25T10:00:00'),
  //       notes: 'Chờ xác nhận đơn hàng từ chi nhánh',
  //     },
  //   });

  //   await prisma.stockTransactionDetail.createMany({
  //     data: [
  //       {
  //         transactionId: transaction8.id,
  //         productId: 5, // NAVI AMINO ỚT
  //         warehouseId: 15,
  //         quantity: 50,
  //         unitPrice: 105000,
  //         batchNumber: 'NAVI-1L-202411-L01',
  //       },
  //       {
  //         transactionId: transaction8.id,
  //         productId: 8, // AMINO ATONIC
  //         warehouseId: 15,
  //         quantity: 15,
  //         unitPrice: 115000,
  //         batchNumber: 'ATN-1L-202411-L02',
  //       },
  //     ],
  //   });

  //   // --- GIAO DỊCH 9: XUẤT NGUYÊN LIỆU CHO SẢN XUẤT LÔ 2 ---
  //   console.log('🏭 Giao dịch 9: Xuất nguyên liệu sản xuất lô 2');
  //   const transaction9 = await prisma.stockTransaction.create({
  //     data: {
  //       transactionCode: 'XK-SX-2024110002',
  //       transactionType: 'export',
  //       warehouseId: 13,
  //       totalValue: 2100000,
  //       reason: 'Sản xuất lô NAVI AMINO ỚT',
  //       referenceType: 'production_order',
  //       referenceId: 2,
  //       status: 'completed',
  //       createdBy: 9,
  //       approvedBy: 8,
  //       createdAt: new Date('2024-11-22T08:00:00'),
  //       approvedAt: new Date('2024-11-22T08:30:00'),
  //     },
  //   });

  //   await prisma.stockTransactionDetail.createMany({
  //     data: [
  //       {
  //         transactionId: transaction9.id,
  //         productId: 16, // Kali Nitrat
  //         warehouseId: 13,
  //         quantity: 1,
  //         unitPrice: 680000,
  //         batchNumber: 'KNO3-IL-202411-01',
  //       },
  //       {
  //         transactionId: transaction9.id,
  //         productId: 17, // Borax
  //         warehouseId: 13,
  //         quantity: 8,
  //         unitPrice: 45000,
  //         batchNumber: 'BO-CN-202411',
  //       },
  //       {
  //         transactionId: transaction9.id,
  //         productId: 19, // Amino
  //         warehouseId: 13,
  //         quantity: 1, // 1 can = 20L
  //         unitPrice: 1850000,
  //         batchNumber: 'AMINO-FR-202411',
  //       },
  //     ],
  //   });

  //   // --- GIAO DỊCH 10: NHẬP THÀNH PHẨM LÔ 2 ---
  //   console.log('✅ Giao dịch 10: Nhập thành phẩm lô 2');
  //   const transaction10 = await prisma.stockTransaction.create({
  //     data: {
  //       transactionCode: 'NK-SX-2024110002',
  //       transactionType: 'import',
  //       warehouseId: 12,
  //       totalValue: 7800000,
  //       reason: 'Hoàn thành sản xuất NAVI AMINO ỚT 1L',
  //       referenceType: 'production_order',
  //       referenceId: 2,
  //       status: 'completed',
  //       createdBy: 9,
  //       approvedBy: 7,
  //       createdAt: new Date('2024-11-24T15:00:00'),
  //       approvedAt: new Date('2024-11-24T16:00:00'),
  //     },
  //   });

  //   await prisma.stockTransactionDetail.create({
  //     data: {
  //       transactionId: transaction10.id,
  //       productId: 5, // NAVI AMINO ỚT 1L
  //       warehouseId: 12,
  //       quantity: 150,
  //       unitPrice: 52000,
  //       batchNumber: 'NAVI-1L-202411-L01',
  //       expiryDate: new Date('2026-10-31'),
  //     },
  //   });

  //   console.log(`\n✅ Đã tạo 10 Stock Transactions`);

  //   // --- GIAO DỊCH 11: DISPOSAL (Hủy hàng hỏng) ---
  //   console.log('\n🗑️ Giao dịch 11: Hủy hàng hết hạn/hỏng');
  //   const transaction11 = await prisma.stockTransaction.create({
  //     data: {
  //       transactionCode: 'HUY-2024110001',
  //       transactionType: 'disposal',
  //       warehouseId: 21, // Kho Cách Ly
  //       totalValue: 0,
  //       reason: 'Hủy hàng hết hạn sử dụng và hàng hỏng',
  //       notes: 'Đã lập biên bản hủy theo quy định',
  //       status: 'completed',
  //       createdBy: 10,
  //       approvedBy: 8,
  //       createdAt: new Date('2024-11-28T10:00:00'),
  //       approvedAt: new Date('2024-11-28T14:00:00'),
  //     },
  //   });

  //   await prisma.stockTransactionDetail.createMany({
  //     data: [
  //       {
  //         transactionId: transaction11.id,
  //         productId: 9, // TRICHODERMA
  //         warehouseId: 21,
  //         quantity: -5,
  //         unitPrice: 80000,
  //         batchNumber: 'TRICH-500G-202408-L02',
  //         expiryDate: new Date('2025-08-31'),
  //         notes: 'Hết hạn sử dụng',
  //       },
  //       {
  //         transactionId: transaction11.id,
  //         productId: 7, // CANXI-BO ỚT
  //         warehouseId: 21,
  //         quantity: -3,
  //         unitPrice: 50000,
  //         batchNumber: 'CBO-500ML-202409-L03',
  //         notes: 'Chai bị nứt, không thể bán',
  //       },
  //     ],
  //   });

  //   // --- GIAO DỊCH 12: TRANSFER giữa các kho ---
  //   console.log('🔄 Giao dịch 12: Điều chuyển nội bộ giữa các kho');
  //   const transaction12 = await prisma.stockTransaction.create({
  //     data: {
  //       transactionCode: 'DC-NB-2024110001',
  //       transactionType: 'transfer',
  //       warehouseId: 14, // Kho Bao Bì (kho gốc)
  //       sourceWarehouseId: 14, // Từ Kho Bao Bì
  //       destinationWarehouseId: 12, // Đến Kho Nhà Máy
  //       totalValue: 450000,
  //       reason: 'Điều chuyển bao bì sang nhà máy để đóng gói',
  //       status: 'completed',
  //       createdBy: 9,
  //       approvedBy: 7,
  //       createdAt: new Date('2024-11-29T07:00:00'),
  //       approvedAt: new Date('2024-11-29T07:30:00'),
  //     },
  //   });

  //   await prisma.stockTransactionDetail.createMany({
  //     data: [
  //       {
  //         transactionId: transaction12.id,
  //         productId: 22, // Chai 500ml
  //         warehouseId: 14,
  //         quantity: -200,
  //         unitPrice: 1800,
  //         batchNumber: 'CHAI-500ML-202411',
  //         notes: 'Xuất từ kho bao bì',
  //       },
  //       {
  //         transactionId: transaction12.id,
  //         productId: 26, // Tem decal
  //         warehouseId: 12,
  //         quantity: 200,
  //         unitPrice: 450,
  //         notes: 'Nhập vào kho nhà máy',
  //       },
  //     ],
  //   });

  //   console.log(`\n✅ Đã tạo 12 Stock Transactions`);

  //   // ============================================
  //   // PHẦN 2: STOCK TRANSFERS
  //   // ============================================

  //   console.log('\n🚚 === TẠO STOCK TRANSFERS ===\n');

  //   // --- CHUYỂN KHO 1: Từ Kho Sản Xuất → Kho Thành Phẩm ---
  //   console.log('📦 Chuyển kho 1: Sản xuất → Thành phẩm');
  //   const transfer1 = await prisma.stockTransfer.create({
  //     data: {
  //       transferCode: 'CK-2024110001',
  //       fromWarehouseId: 12, // Kho Nhà Máy
  //       toWarehouseId: 15, // Kho Thành Phẩm
  //       transferDate: new Date('2024-11-13'),
  //       totalValue: 5600000,
  //       reason: 'Chuyển thành phẩm hoàn thiện sang kho xuất hàng',
  //       status: 'completed',
  //       requestedBy: 9, // Production
  //       approvedBy: 7,
  //       createdAt: new Date('2024-11-13T08:00:00'),
  //       approvedAt: new Date('2024-11-13T09:00:00'),
  //     },
  //   });

  //   await prisma.stockTransferDetail.create({
  //     data: {
  //       transferId: transfer1.id,
  //       productId: 4, // SIÊU ĐẬU TRÁI 500ml
  //       quantity: 200,
  //       unitPrice: 28000,
  //       batchNumber: 'SDT-500ML-202411-L01',
  //       expiryDate: new Date('2026-11-30'),
  //     },
  //   });

  //   // --- CHUYỂN KHO 2: Kho Thành Phẩm → Chi nhánh Cần Thơ ---
  //   console.log('🚚 Chuyển kho 2: Thành phẩm → Cần Thơ');
  //   const transfer2 = await prisma.stockTransfer.create({
  //     data: {
  //       transferCode: 'CK-2024110002',
  //       fromWarehouseId: 15, // Kho Thành Phẩm
  //       toWarehouseId: 16, // Chi nhánh Cần Thơ
  //       transferDate: new Date('2024-11-16'),
  //       totalValue: 8150000,
  //       reason: 'Điều hàng cho chi nhánh ĐBSCL',
  //       status: 'completed',
  //       requestedBy: 12, // Sales
  //       approvedBy: 7,
  //       createdAt: new Date('2024-11-16T07:00:00'),
  //       approvedAt: new Date('2024-11-16T08:00:00'),
  //     },
  //   });

  //   await prisma.stockTransferDetail.createMany({
  //     data: [
  //       {
  //         transferId: transfer2.id,
  //         productId: 4, // SIÊU ĐẬU TRÁI
  //         quantity: 100,
  //         unitPrice: 28000,
  //         batchNumber: 'SDT-500ML-202411-L01',
  //         expiryDate: new Date('2026-11-30'),
  //         notes: 'Hàng mới sản xuất, chất lượng tốt',
  //       },
  //       {
  //         transferId: transfer2.id,
  //         productId: 6, // BÓN LỚN TRÁI
  //         quantity: 80,
  //         unitPrice: 38000,
  //         batchNumber: 'BLT-1KG-202410-L05',
  //         expiryDate: new Date('2027-06-30'),
  //       },
  //       {
  //         transferId: transfer2.id,
  //         productId: 12, // AMINO RAU MÀU
  //         quantity: 50,
  //         unitPrice: 48000,
  //         batchNumber: 'ARM-1L-202410-L02',
  //         expiryDate: new Date('2026-10-31'),
  //         notes: 'Cần bảo quản nơi khô ráo',
  //       },
  //     ],
  //   });

  //   // --- CHUYỂN KHO 3: Thành Phẩm → Chi nhánh Đồng Nai ---
  //   console.log('🚛 Chuyển kho 3: Thành phẩm → Đồng Nai');
  //   const transfer3 = await prisma.stockTransfer.create({
  //     data: {
  //       transferCode: 'CK-2024110003',
  //       fromWarehouseId: 15,
  //       toWarehouseId: 17, // Chi nhánh Đồng Nai
  //       transferDate: new Date('2024-11-20'),
  //       totalValue: 9500000,
  //       reason: 'Bổ sung hàng cho khu vực miền Đông',
  //       status: 'completed',
  //       requestedBy: 12,
  //       approvedBy: 8,
  //       createdAt: new Date('2024-11-20T06:00:00'),
  //       approvedAt: new Date('2024-11-20T07:30:00'),
  //     },
  //   });

  //   await prisma.stockTransferDetail.createMany({
  //     data: [
  //       {
  //         transferId: transfer3.id,
  //         productId: 5, // NAVI AMINO ỚT
  //         quantity: 60,
  //         unitPrice: 52000,
  //         batchNumber: 'NAVI-1L-202411-L01',
  //         expiryDate: new Date('2026-10-31'),
  //       },
  //       {
  //         transferId: transfer3.id,
  //         productId: 8, // AMINO ATONIC
  //         quantity: 40,
  //         unitPrice: 55000,
  //         batchNumber: 'ATN-1L-202411-L02',
  //         expiryDate: new Date('2026-11-30'),
  //       },
  //       {
  //         transferId: transfer3.id,
  //         productId: 10, // DOCTOR MANGO
  //         quantity: 30,
  //         unitPrice: 135000,
  //         batchNumber: 'DM-SET-202410-L01',
  //         expiryDate: new Date('2026-08-31'),
  //       },
  //     ],
  //   });

  //   // --- CHUYỂN KHO 4: Thành Phẩm → Đại lý Gia Lai (PENDING) ---
  //   console.log('⏳ Chuyển kho 4: Chờ duyệt - Gia Lai');
  //   const transfer4 = await prisma.stockTransfer.create({
  //     data: {
  //       transferCode: 'CK-2024110004',
  //       fromWarehouseId: 15,
  //       toWarehouseId: 18, // Kho Đại Lý Gia Lai
  //       transferDate: new Date('2024-11-26'),
  //       totalValue: 4800000,
  //       reason: 'Điều hàng cho thị trường Tây Nguyên - Chờ xác nhận xe vận chuyển',
  //       status: 'pending',
  //       requestedBy: 12,
  //       createdAt: new Date('2024-11-26T10:00:00'),
  //     },
  //   });

  //   await prisma.stockTransferDetail.createMany({
  //     data: [
  //       {
  //         transferId: transfer4.id,
  //         productId: 11, // CHỐNG RỤNG MẮC CA
  //         quantity: 40,
  //         unitPrice: 48000,
  //         batchNumber: 'CRM-500ML-202411-L01',
  //         expiryDate: new Date('2026-07-31'),
  //         notes: 'Sản phẩm phù hợp với vùng Tây Nguyên',
  //       },
  //       {
  //         transferId: transfer4.id,
  //         productId: 13, // DOCTOR TIÊU
  //         quantity: 30,
  //         unitPrice: 58000,
  //         batchNumber: 'DT-1L-202411-L01',
  //         expiryDate: new Date('2026-12-31'),
  //         notes: 'Hàng hot cho khu vực trồng tiêu',
  //       },
  //     ],
  //   });

  //   // --- CHUYỂN KHO 5: Chi nhánh Cần Thơ → Hải Dương (IN_TRANSIT) ---
  //   console.log('🚛 Chuyển kho 5: Đang vận chuyển - Cần Thơ → Hải Dương');
  //   const transfer5 = await prisma.stockTransfer.create({
  //     data: {
  //       transferCode: 'CK-2024110005',
  //       fromWarehouseId: 16, // Cần Thơ
  //       toWarehouseId: 19, // Hải Dương
  //       transferDate: new Date('2024-11-27'),
  //       totalValue: 3600000,
  //       reason: 'Điều chuyển hàng dư sang miền Bắc - Hàng đang trên đường vận chuyển',
  //       status: 'in_transit',
  //       requestedBy: 11,
  //       approvedBy: 7,
  //       createdAt: new Date('2024-11-27T08:00:00'),
  //       approvedAt: new Date('2024-11-27T10:00:00'),
  //     },
  //   });

  //   await prisma.stockTransferDetail.createMany({
  //     data: [
  //       {
  //         transferId: transfer5.id,
  //         productId: 12, // AMINO RAU MÀU
  //         quantity: 30,
  //         unitPrice: 48000,
  //         batchNumber: 'ARM-1L-202410-L02',
  //         expiryDate: new Date('2026-10-31'),
  //         notes: 'Vận chuyển đường bộ, dự kiến 3 ngày',
  //       },
  //       {
  //         transferId: transfer5.id,
  //         productId: 6, // BÓN LỚN TRÁI
  //         quantity: 40,
  //         unitPrice: 38000,
  //         batchNumber: 'BLT-1KG-202410-L05',
  //         expiryDate: new Date('2027-06-30'),
  //         notes: 'Cẩn thận khi vận chuyển, tránh ẩm ướt',
  //       },
  //     ],
  //   });

  //   // --- CHUYỂN KHO 6: CANCELLED ---
  //   console.log('❌ Chuyển kho 6: Đã hủy');
  //   const transfer6 = await prisma.stockTransfer.create({
  //     data: {
  //       transferCode: 'CK-2024110006',
  //       fromWarehouseId: 15,
  //       toWarehouseId: 20, // Kho Sự Kiện
  //       transferDate: new Date('2024-11-23'),
  //       totalValue: 2000000,
  //       reason: 'Chuyển hàng cho hội chợ Agritech - Đã hủy vì hội chợ hoãn lại',
  //       status: 'cancelled',
  //       requestedBy: 10,
  //       approvedBy: 8,
  //       cancelledBy: 7,
  //       createdAt: new Date('2024-11-23T09:00:00'),
  //       approvedAt: new Date('2024-11-23T10:00:00'),
  //       cancelledAt: new Date('2024-11-24T08:00:00'),
  //     },
  //   });

  //   await prisma.stockTransferDetail.createMany({
  //     data: [
  //       {
  //         transferId: transfer6.id,
  //         productId: 4,
  //         quantity: 50,
  //         unitPrice: 28000,
  //         batchNumber: 'SDT-500ML-202411-L01',
  //         notes: 'Chuyển kho đã hủy - hàng không xuất',
  //       },
  //     ],
  //   });

  //   // --- CHUYỂN KHO 7: Kho Sản Xuất → Kho Thành Phẩm (Lô 2) ---
  //   console.log('📦 Chuyển kho 7: Sản xuất → Thành phẩm (lô 2)');
  //   const transfer7 = await prisma.stockTransfer.create({
  //     data: {
  //       transferCode: 'CK-2024110007',
  //       fromWarehouseId: 12,
  //       toWarehouseId: 15,
  //       transferDate: new Date('2024-11-25'),
  //       totalValue: 7800000,
  //       reason: 'Chuyển lô thành phẩm NAVI AMINO ỚT',
  //       status: 'completed',
  //       requestedBy: 9,
  //       approvedBy: 7,
  //       createdAt: new Date('2024-11-25T08:00:00'),
  //       approvedAt: new Date('2024-11-25T09:00:00'),
  //     },
  //   });

  //   await prisma.stockTransferDetail.create({
  //     data: {
  //       transferId: transfer7.id,
  //       productId: 5,
  //       quantity: 150,
  //       unitPrice: 52000,
  //       batchNumber: 'NAVI-1L-202411-L01',
  //       expiryDate: new Date('2026-10-31'),
  //     },
  //   });

  //   console.log(`\n✅ Đã tạo 7 Stock Transfers`);

  //   // ============================================
  //   // THỐNG KÊ
  //   // ============================================

  //   const totalTransactions = await prisma.stockTransaction.count();
  //   const totalTransfers = await prisma.stockTransfer.count();
  //   const totalTransactionDetails = await prisma.stockTransactionDetail.count();
  //   const totalTransferDetails = await prisma.stockTransferDetail.count();

  //   console.log(`
  // ╔════════════════════════════════════════════════════╗
  // ║           📊 THỐNG KÊ SEEDER HOÀN TẤT            ║
  // ╠════════════════════════════════════════════════════╣
  // ║                                                    ║
  // ║  📦 STOCK TRANSACTIONS                             ║
  // ║     ├─ Tổng số giao dịch: ${totalTransactions.toString().padEnd(24)} ║
  // ║     ├─ Import (nhập kho): 5                       ║
  // ║     ├─ Export (xuất kho): 4                       ║
  // ║     ├─ Transfer (chuyển nội bộ): 1                ║
  // ║     ├─ Disposal (hủy hàng): 1                     ║
  // ║     ├─ Stocktake (kiểm kê): 1                     ║
  // ║     └─ Chi tiết sản phẩm: ${totalTransactionDetails.toString().padEnd(24)} ║
  // ║                                                    ║
  // ║  🚚 STOCK TRANSFERS                                ║
  // ║     ├─ Tổng số chuyển kho: ${totalTransfers.toString().padEnd(23)} ║
  // ║     ├─ Completed: 4                               ║
  // ║     ├─ In Transit: 1                              ║
  // ║     ├─ Pending: 1                                 ║
  // ║     ├─ Cancelled: 1                               ║
  // ║     └─ Chi tiết sản phẩm: ${totalTransferDetails.toString().padEnd(24)} ║
  // ║                                                    ║
  // ║  📍 KHO THAM GIA                                   ║
  // ║     ├─ Kho Nguyên Liệu (13)                       ║
  // ║     ├─ Kho Bao Bì (14)                            ║
  // ║     ├─ Kho Thành Phẩm (15)                        ║
  // ║     ├─ Kho Sản Xuất (12)                          ║
  // ║     ├─ Chi nhánh Cần Thơ (16)                     ║
  // ║     ├─ Chi nhánh Đồng Nai (17)                    ║
  // ║     ├─ Đại lý Gia Lai (18)                        ║
  // ║     └─ Đại lý Hải Dương (19)                      ║
  // ║                                                    ║
  // ║  💡 GIÁ TRỊ GIAO DỊCH                              ║
  // ║     ├─ Tổng giá trị Transactions: ~54M VNĐ        ║
  // ║     └─ Tổng giá trị Transfers: ~41M VNĐ           ║
  // ║                                                    ║
  // ╚════════════════════════════════════════════════════╝

  // 🎯 KỊCH BẢN NGHIỆP VỤ ĐÃ TẠO:
  //    ✓ Nhập nguyên liệu từ nhà cung cấp
  //    ✓ Nhập bao bì đóng gói
  //    ✓ Xuất nguyên liệu cho sản xuất
  //    ✓ Nhập thành phẩm sau sản xuất
  //    ✓ Chuyển hàng từ sản xuất sang kho thành phẩm
  //    ✓ Xuất hàng bán cho khách hàng
  //    ✓ Chuyển hàng sang chi nhánh
  //    ✓ Kiểm kê và điều chỉnh tồn kho
  //    ✓ Hủy hàng hỏng/hết hạn
  //    ✓ Điều chuyển nội bộ giữa các kho
  //    ✓ Phiếu chờ duyệt và hủy phiếu

  // ✨ Seed thành công!
  //   `);
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi seed stock transactions:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
