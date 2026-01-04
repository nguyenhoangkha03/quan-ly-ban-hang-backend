import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Bắt đầu seed dữ liệu Warehouse');

  await prisma.warehouse.deleteMany({});

  // KHO CHÍNH - Trụ sở Đồng Tháp
  console.log('--- Tạo kho trụ sở chính ---');

  await prisma.warehouse.upsert({
    where: { warehouseCode: 'KHO-TSC-DT' },
    update: {},
    create: {
      warehouseCode: 'KHO-TSC-DT',
      warehouseName: 'Kho Trụ Sở Chính - Đồng Tháp',
      warehouseType: 'goods', // Kho hàng hóa tổng hợp
      address: 'Quốc Lộ 30, ấp Đông Mỹ, xã Mỹ Hội',
      managerId: 6,
      city: 'Cao Lãnh',
      region: 'Đồng Tháp',
      description: 'Kho tổng trụ sở chính, lưu trữ đa dạng hàng hóa',
      capacity: 5000.0, // 5000 m² hoặc tấn
      status: 'active',
    },
  });

  // KHO SẢN XUẤT - Nhà máy
  console.log('--- Tạo kho sản xuất ---');

  await prisma.warehouse.upsert({
    where: { warehouseCode: 'KHO-SX-NM01' },
    update: {},
    create: {
      warehouseCode: 'KHO-SX-NM01',
      warehouseName: 'Kho Nhà Máy Sản Xuất',
      managerId: 7,
      warehouseType: 'finished_product', // Kho thành phẩm tại nhà máy
      address: 'Khu công nghiệp, xã Mỹ Hội',
      city: 'Cao Lãnh',
      region: 'Đồng Tháp',
      description: 'Kho thành phẩm sau sản xuất tại nhà máy pha chế',
      capacity: 3000.0,
      status: 'active',
    },
  });

  // KHO NGUYÊN LIỆU - Riêng biệt
  console.log('--- Tạo kho nguyên liệu ---');

  await prisma.warehouse.upsert({
    where: { warehouseCode: 'KHO-NL-DT' },
    update: {},
    create: {
      warehouseCode: 'KHO-NL-DT',
      warehouseName: 'Kho Nguyên Liệu Nhập Khẩu',
      managerId: 8,
      warehouseType: 'raw_material', // Kho nguyên liệu
      address: 'Quốc Lộ 30, ấp Đông Mỹ, xã Mỹ Hội',
      city: 'Cao Lãnh',
      region: 'Đồng Tháp',
      description: 'Lưu trữ hóa chất, phụ gia, bao bì nhập khẩu',
      capacity: 2000.0,
      status: 'active',
    },
  });

  // KHO BAO BÌ
  console.log('--- Tạo kho bao bì ---');

  await prisma.warehouse.upsert({
    where: { warehouseCode: 'KHO-BB-DT' },
    update: {},
    create: {
      warehouseCode: 'KHO-BB-DT',
      warehouseName: 'Kho Bao Bì & Vật Liệu Đóng Gói',
      managerId: 9,
      warehouseType: 'packaging', // Kho bao bì
      address: 'Quốc Lộ 30, ấp Đông Mỹ, xã Mỹ Hội',
      city: 'Cao Lãnh',
      region: 'Đồng Tháp',
      description: 'Chai, can, nhãn, thùng carton',
      capacity: 800.0,
      status: 'active',
    },
  });

  // KHO THÀNH PHẨM - Xuất hàng
  console.log('--- Tạo kho thành phẩm ---');

  await prisma.warehouse.upsert({
    where: { warehouseCode: 'KHO-TP-DT' },
    update: {},
    create: {
      warehouseCode: 'KHO-TP-DT',
      warehouseName: 'Kho Thành Phẩm Xuất Hàng',
      warehouseType: 'finished_product', // Kho thành phẩm
      address: 'Quốc Lộ 30, ấp Đông Mỹ, xã Mỹ Hội',
      managerId: 10,
      city: 'Cao Lãnh',
      region: 'Đồng Tháp',
      description: 'Sản phẩm hoàn thiện sẵn sàng xuất kho bán hàng',
      capacity: 3500.0,
      status: 'active',
    },
  });

  // CHI NHÁNH MIỀN TÂY - Cần Thơ
  console.log('--- Tạo chi nhánh Cần Thơ ---');

  await prisma.warehouse.upsert({
    where: { warehouseCode: 'KHO-CN-CT' },
    update: {},
    create: {
      warehouseCode: 'KHO-CN-CT',
      warehouseName: 'Chi Nhánh Cần Thơ',
      managerId: 11,
      warehouseType: 'goods', // Kho hàng hóa
      address: 'Đường 3/2, Phường Xuân Khánh, Quận Ninh Kiều',
      city: 'Cần Thơ',
      region: 'Cần Thơ',
      description: 'Phục vụ khu vực ĐBSCL - Cần Thơ, Hậu Giang, Sóc Trăng',
      capacity: 1200.0,
      status: 'active',
    },
  });

  // CHI NHÁNH MIỀN ĐÔNG NAM BỘ - Đồng Nai
  console.log('--- Tạo chi nhánh Đồng Nai ---');

  await prisma.warehouse.upsert({
    where: { warehouseCode: 'KHO-CN-DN' },
    update: {},
    create: {
      warehouseCode: 'KHO-CN-DN',
      warehouseName: 'Chi Nhánh Đồng Nai',
      managerId: 12,
      warehouseType: 'goods',
      address: 'KCN Biên Hòa 2, Phường Long Bình Tân',
      city: 'Biên Hòa',
      region: 'Đồng Nai',
      description: 'Phục vụ Đồng Nai, Bình Dương, Bà Rịa - Vũng Tàu',
      capacity: 1000.0,
      status: 'active',
    },
  });

  // ĐẠI LÝ TÂY NGUYÊN - Gia Lai
  console.log('--- Tạo kho đại lý Gia Lai ---');

  await prisma.warehouse.upsert({
    where: { warehouseCode: 'KHO-DL-GL' },
    update: {},
    create: {
      warehouseCode: 'KHO-DL-GL',
      warehouseName: 'Kho Đại Lý Gia Lai',
      managerId: 6,
      warehouseType: 'goods', // Kho hàng hóa
      address: 'Phường Hoa Lư, TP. Pleiku',
      city: 'Pleiku',
      region: 'Gia Lai',
      description: 'Phục vụ Tây Nguyên - Sầu riêng, Cà phê, Tiêu',
      capacity: 800.0,
      status: 'active',
    },
  });

  // ĐẠI LÝ ĐỒNG BẰNG SÔNG HỒNG - Hải Dương
  console.log('--- Tạo kho đại lý Hải Dương ---');

  await prisma.warehouse.upsert({
    where: { warehouseCode: 'KHO-DL-HD' },
    update: {},
    create: {
      warehouseCode: 'KHO-DL-HD',
      warehouseName: 'Kho Đại Lý Hải Dương',
      managerId: 7,
      warehouseType: 'goods',
      address: 'Đường Nguyễn Lương Bằng, TP. Hải Dương',
      city: 'Hải Dương',
      region: 'Hải Dương',
      description: 'Phục vụ miền Bắc - Lúa, Rau màu, Cây ăn trái',
      capacity: 600.0,
      status: 'active',
    },
  });

  // KHO TẠM THỜI - Sự kiện/Triển lãm
  console.log('--- Tạo kho tạm thời ---');

  await prisma.warehouse.upsert({
    where: { warehouseCode: 'KHO-SK-TEMP' },
    update: {},
    create: {
      warehouseCode: 'KHO-SK-TEMP',
      warehouseName: 'Kho Tạm Sự Kiện & Hội Chợ',
      managerId: 8,
      warehouseType: 'goods', // Kho hàng hóa
      address: 'Di động theo địa điểm sự kiện',
      city: 'N/A',
      region: 'Toàn quốc',
      description: 'Lưu trữ tạm cho hội chợ nông nghiệp, sự kiện khuyến mại',
      capacity: 200.0,
      status: 'active',
    },
  });

  // KHO CÁCH LY - QC/QA
  console.log('--- Tạo kho cách ly ---');

  await prisma.warehouse.upsert({
    where: { warehouseCode: 'KHO-CL-QC' },
    update: {},
    create: {
      warehouseCode: 'KHO-CL-QC',
      managerId: 9,
      warehouseName: 'Kho Cách Ly & Kiểm Định Chất Lượng',
      warehouseType: 'goods', // Kho hàng hóa
      address: 'Quốc Lộ 30, ấp Đông Mỹ, xã Mỹ Hội',
      city: 'Cao Lãnh',
      region: 'Đồng Tháp',
      description: 'Lưu trữ hàng chờ kiểm định, hàng lỗi, hàng thu hồi',
      capacity: 300.0,
      status: 'active',
    },
  });

  // KHO DỰ TRỮ - Mùa vụ cao điểm
  console.log('--- Tạo kho dự trữ ---');

  await prisma.warehouse.upsert({
    where: { warehouseCode: 'KHO-DT-MV' },
    update: {},
    create: {
      warehouseCode: 'KHO-DT-MV',
      warehouseName: 'Kho Dự Trữ Mùa Vụ',
      managerId: 10,
      warehouseType: 'goods', // Kho hàng hóa
      address: 'Quốc Lộ 30, ấp Đông Mỹ, xã Mỹ Hội',
      city: 'Cao Lãnh',
      region: 'Đồng Tháp',
      description: 'Dự trữ hàng mùa vụ cao điểm (Tết, Thu hoạch)',
      capacity: 1500.0,
      status: 'active',
    },
  });

  // KHO NGỪNG HOẠT ĐỘNG - Ví dụ
  console.log('--- Tạo kho ngừng hoạt động (demo) ---');

  await prisma.warehouse.upsert({
    where: { warehouseCode: 'KHO-OLD-AG' },
    update: {},
    create: {
      warehouseCode: 'KHO-OLD-AG',
      warehouseName: 'Kho Cũ An Giang (Đã đóng)',
      managerId: 11,
      warehouseType: 'goods',
      address: 'Đường Trần Hưng Đạo, TP. Long Xuyên',
      city: 'Long Xuyên',
      region: 'An Giang',
      description: 'Kho cũ đã chuyển về kho Cần Thơ, không còn sử dụng',
      capacity: 500.0,
      status: 'inactive',
    },
  });

  console.log('✅ Đã seed xong dữ liệu Warehouse!');
  console.log(`
📦 Tổng số kho: 13 kho
├── Kho hàng hóa (goods): 9 kho
├── Kho nguyên liệu (raw_material): 1 kho
├── Kho bao bì (packaging): 1 kho
└── Kho thành phẩm (finished_product): 2 kho

🌍 Phân bố khu vực:
├── Đồng Tháp (Trụ sở): 7 kho
├── Cần Thơ: 1 kho
├── Đồng Nai: 1 kho
├── Gia Lai: 1 kho
├── Hải Dương: 1 kho
├── An Giang: 1 kho (inactive)
└── Toàn quốc: 1 kho (di động)

📊 Trạng thái:
├── Active: 12 kho
└── Inactive: 1 kho
  `);
}

export { main };

// main()
//   .catch((e) => {
//     console.error('❌ Lỗi khi seed warehouse:', e);
//     process.exit(1);
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });
