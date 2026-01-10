import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function main() {
  console.log('📦 Bắt đầu seed dữ liệu Inventory...');

  await prisma.inventory.deleteMany({});

  //   // Lấy danh sách kho và sản phẩm
    const warehouses = await prisma.warehouse.findMany();
    const products = await prisma.product.findMany();

    // Helper functions
    const findWarehouse = (code: string) => warehouses.find((w) => w.warehouseCode === code);
    const findProduct = (sku: string) => products.find((p) => p.sku === sku);

    // ================================================================
    // KHO THÀNH PHẨM XUẤT HÀNG (KHO-TP-DT)
    // Lưu trữ các sản phẩm hoàn thiện sẵn sàng bán
    // ================================================================
    const khoThanhPham = findWarehouse('KHO-TP-DT');
    if (khoThanhPham) {
      console.log('--- Seed kho thành phẩm xuất hàng ---');

      const thanhPhamInventory = [
        { sku: 'TP-KTSW-SIEUDAUTRAI-500ML', quantity: 850, reserved: 120 },
        { sku: 'TP-KTSW-NAVIMINO-OT-1L', quantity: 620, reserved: 85 },
        { sku: 'TP-DDLA-BONLONTRAI-17-17-17-1KG', quantity: 1200, reserved: 200 },
        { sku: 'TP-DDLA-CANXI-BO-OT-500ML', quantity: 540, reserved: 90 },
        { sku: 'TP-DDLA-AMINO-ATONIC-1L', quantity: 480, reserved: 65 },
        { sku: 'TP-VS-TRICHODERMA-500G', quantity: 380, reserved: 55 },
        { sku: 'TP-AT-DOCTOR-MANGO-SET', quantity: 150, reserved: 25 },
        { sku: 'TP-AT-CHONGRUNG-MACCA-500ML', quantity: 280, reserved: 40 },
        { sku: 'TP-RAU-AMINCHO-RAUMAU-1L', quantity: 420, reserved: 60 },
        { sku: 'TP-CN-DOCTOR-TIEU-1L', quantity: 320, reserved: 45 },
      ];

      for (const item of thanhPhamInventory) {
        const product = findProduct(item.sku);
        if (product) {
          await prisma.inventory.create({
            data: {
              warehouseId: khoThanhPham.id,
              productId: product.id,
              quantity: item.quantity,
              reservedQuantity: item.reserved,
              updatedBy: 6, // Manager của kho này
            },
          });
        }
      }
    }

    // ================================================================
    // KHO SẢN XUẤT - NHÀ MÁY (KHO-SX-NM01)
    // Thành phẩm mới sản xuất, chưa kiểm định đầy đủ
    // ================================================================
    const khoSanXuat = findWarehouse('KHO-SX-NM01');
    if (khoSanXuat) {
      console.log('--- Seed kho sản xuất nhà máy ---');

      const sanXuatInventory = [
        { sku: 'TP-KTSW-SIEUDAUTRAI-500ML', quantity: 450, reserved: 0 },
        { sku: 'TP-DDLA-BONLONTRAI-17-17-17-1KG', quantity: 680, reserved: 0 },
        { sku: 'TP-DDLA-AMINO-ATONIC-1L', quantity: 280, reserved: 0 },
        { sku: 'TP-RAU-AMINCHO-RAUMAU-1L', quantity: 220, reserved: 0 },
      ];

      for (const item of sanXuatInventory) {
        const product = findProduct(item.sku);
        if (product) {
          await prisma.inventory.create({
            data: {
              warehouseId: khoSanXuat.id,
              productId: product.id,
              quantity: item.quantity,
              reservedQuantity: item.reserved,
              updatedBy: 7,
            },
          });
        }
      }
    }

    // ================================================================
    // KHO NGUYÊN LIỆU NHẬP KHẨU (KHO-NL-DT)
    // Hóa chất, phụ gia để sản xuất
    // ================================================================
    const khoNguyenLieu = findWarehouse('KHO-NL-DT');
    if (khoNguyenLieu) {
      console.log('--- Seed kho nguyên liệu ---');

      const nguyenLieuInventory = [
        // Đa lượng
        { sku: 'NL-DL-UREA-46N-25KG', quantity: 240, reserved: 50 }, // 240 bao = 6 tấn
        { sku: 'NL-DL-MAP-12-61-25KG', quantity: 180, reserved: 30 }, // 4.5 tấn
        { sku: 'NL-DL-KALI-NITRAT-25KG', quantity: 120, reserved: 20 }, // 3 tấn
        // Vi lượng
        { sku: 'NL-VL-BORAX-1KG', quantity: 450, reserved: 80 },
        { sku: 'NL-VL-CHELATE-ZN-EDTA-1KG', quantity: 320, reserved: 60 },
        // Hữu cơ
        { sku: 'NL-HC-AMINO-THUY-PHAN-20L', quantity: 45, reserved: 8 }, // 45 can = 900L
        { sku: 'NL-HC-HUMIC-BOT-25KG', quantity: 85, reserved: 15 },
        // Phụ gia
        { sku: 'NL-PG-SILICON-BAMDDINH-5L', quantity: 65, reserved: 12 },
      ];

      for (const item of nguyenLieuInventory) {
        const product = findProduct(item.sku);
        if (product) {
          await prisma.inventory.create({
            data: {
              warehouseId: khoNguyenLieu.id,
              productId: product.id,
              quantity: item.quantity,
              reservedQuantity: item.reserved,
              updatedBy: 8,
            },
          });
        }
      }
    }

    // ================================================================
    // KHO BAO BÌ & VẬT LIỆU ĐÓNG GÓI (KHO-BB-DT)
    // ================================================================
    const khoBaoBi = findWarehouse('KHO-BB-DT');
    if (khoBaoBi) {
      console.log('--- Seed kho bao bì ---');

      const baoBiInventory = [
        // Chai & Can
        { sku: 'BB-CHAI-HDPE-500ML', quantity: 12000, reserved: 2000 },
        { sku: 'BB-CHAI-HDPE-1L', quantity: 8500, reserved: 1500 },
        { sku: 'BB-CAN-NHUA-5L', quantity: 1200, reserved: 200 },
        // Màng ghép
        { sku: 'BB-MG-TUI-NHOM-1KG', quantity: 6800, reserved: 1200 },
        // Tem nhãn
        { sku: 'BB-TEM-DECAL-500ML', quantity: 25000, reserved: 5000 },
        { sku: 'BB-TEM-HDSD-MATSAU', quantity: 32000, reserved: 8000 },
        // Thùng carton
        { sku: 'BB-CARTON-20CHAI-500ML', quantity: 850, reserved: 150 },
        { sku: 'BB-CARTON-12CHAI-1L', quantity: 620, reserved: 120 },
        { sku: 'BB-BANGKEO-OPP-50MM', quantity: 380, reserved: 80 },
      ];

      for (const item of baoBiInventory) {
        const product = findProduct(item.sku);
        if (product) {
          await prisma.inventory.create({
            data: {
              warehouseId: khoBaoBi.id,
              productId: product.id,
              quantity: item.quantity,
              reservedQuantity: item.reserved,
              updatedBy: 6,
            },
          });
        }
      }
    }

    // ================================================================
    // KHO TRỤ SỞ CHÍNH (KHO-TSC-DT)
    // Tổng hợp đa dạng, lượng vừa phải
    // ================================================================
    const khoTruSo = findWarehouse('KHO-TSC-DT');
    if (khoTruSo) {
      console.log('--- Seed kho trụ sở chính ---');

      const truSoInventory = [
        // Một số thành phẩm phổ biến
        { sku: 'TP-KTSW-SIEUDAUTRAI-500ML', quantity: 320, reserved: 50 },
        { sku: 'TP-DDLA-BONLONTRAI-17-17-17-1KG', quantity: 480, reserved: 80 },
        { sku: 'TP-VS-TRICHODERMA-500G', quantity: 180, reserved: 30 },
        // Một số nguyên liệu dự phòng
        { sku: 'NL-DL-UREA-46N-25KG', quantity: 50, reserved: 0 },
        { sku: 'NL-VL-BORAX-1KG', quantity: 120, reserved: 0 },
        // Bao bì dự phòng
        { sku: 'BB-CHAI-HDPE-500ML', quantity: 2000, reserved: 0 },
        { sku: 'BB-TEM-DECAL-500ML', quantity: 5000, reserved: 0 },
      ];

      for (const item of truSoInventory) {
        const product = findProduct(item.sku);
        if (product) {
          await prisma.inventory.create({
            data: {
              warehouseId: khoTruSo.id,
              productId: product.id,
              quantity: item.quantity,
              reservedQuantity: item.reserved,
              updatedBy: 6,
            },
          });
        }
      }
    }

    // ================================================================
    // CHI NHÁNH CẦN THƠ (KHO-CN-CT)
    // Phục vụ ĐBSCL, sản phẩm phổ biến cho nông dân
    // ================================================================
    const khoCanTho = findWarehouse('KHO-CN-CT');
    if (khoCanTho) {
      console.log('--- Seed chi nhánh Cần Thơ ---');

      const canThoInventory = [
        { sku: 'TP-KTSW-SIEUDAUTRAI-500ML', quantity: 280, reserved: 45 },
        { sku: 'TP-KTSW-NAVIMINO-OT-1L', quantity: 180, reserved: 30 },
        { sku: 'TP-DDLA-BONLONTRAI-17-17-17-1KG', quantity: 420, reserved: 70 },
        { sku: 'TP-DDLA-CANXI-BO-OT-500ML', quantity: 220, reserved: 35 },
        { sku: 'TP-RAU-AMINCHO-RAUMAU-1L', quantity: 150, reserved: 25 },
        { sku: 'TP-VS-TRICHODERMA-500G', quantity: 120, reserved: 20 },
      ];

      for (const item of canThoInventory) {
        const product = findProduct(item.sku);
        if (product) {
          await prisma.inventory.create({
            data: {
              warehouseId: khoCanTho.id,
              productId: product.id,
              quantity: item.quantity,
              reservedQuantity: item.reserved,
              updatedBy: 8,
            },
          });
        }
      }
    }

    // ================================================================
    // CHI NHÁNH ĐỒNG NAI (KHO-CN-DN)
    // Phục vụ công nghiệp, cây trồng đô thị
    // ================================================================
    const khoDongNai = findWarehouse('KHO-CN-DN');
    if (khoDongNai) {
      console.log('--- Seed chi nhánh Đồng Nai ---');

      const dongNaiInventory = [
        { sku: 'TP-DDLA-BONLONTRAI-17-17-17-1KG', quantity: 350, reserved: 60 },
        { sku: 'TP-DDLA-AMINO-ATONIC-1L', quantity: 180, reserved: 30 },
        { sku: 'TP-RAU-AMINCHO-RAUMAU-1L', quantity: 200, reserved: 35 },
        { sku: 'TP-VS-TRICHODERMA-500G', quantity: 140, reserved: 25 },
        { sku: 'TP-AT-DOCTOR-MANGO-SET', quantity: 45, reserved: 8 },
      ];

      for (const item of dongNaiInventory) {
        const product = findProduct(item.sku);
        if (product) {
          await prisma.inventory.create({
            data: {
              warehouseId: khoDongNai.id,
              productId: product.id,
              quantity: item.quantity,
              reservedQuantity: item.reserved,
              updatedBy: 7,
            },
          });
        }
      }
    }

    // ================================================================
    // ĐẠI LÝ GIA LAI (KHO-DL-GL)
    // Tây Nguyên - sầu riêng, cà phê, tiêu
    // ================================================================
    const khoGiaLai = findWarehouse('KHO-DL-GL');
    if (khoGiaLai) {
      console.log('--- Seed đại lý Gia Lai ---');

      const giaLaiInventory = [
        { sku: 'TP-AT-DOCTOR-MANGO-SET', quantity: 80, reserved: 15 },
        { sku: 'TP-AT-CHONGRUNG-MACCA-500ML', quantity: 120, reserved: 20 },
        { sku: 'TP-CN-DOCTOR-TIEU-1L', quantity: 180, reserved: 30 },
        { sku: 'TP-DDLA-BONLONTRAI-17-17-17-1KG', quantity: 220, reserved: 40 },
        { sku: 'TP-KTSW-SIEUDAUTRAI-500ML', quantity: 150, reserved: 25 },
      ];

      for (const item of giaLaiInventory) {
        const product = findProduct(item.sku);
        if (product) {
          await prisma.inventory.create({
            data: {
              warehouseId: khoGiaLai.id,
              productId: product.id,
              quantity: item.quantity,
              reservedQuantity: item.reserved,
              updatedBy: 6,
            },
          });
        }
      }
    }

    // ================================================================
    // ĐẠI LÝ HẢI DƯƠNG (KHO-DL-HD)
    // Miền Bắc - lúa, rau màu
    // ================================================================
    const khoHaiDuong = findWarehouse('KHO-DL-HD');
    if (khoHaiDuong) {
      console.log('--- Seed đại lý Hải Dương ---');

      const haiDuongInventory = [
        { sku: 'TP-RAU-AMINCHO-RAUMAU-1L', quantity: 180, reserved: 30 },
        { sku: 'TP-DDLA-BONLONTRAI-17-17-17-1KG', quantity: 280, reserved: 45 },
        { sku: 'TP-VS-TRICHODERMA-500G', quantity: 120, reserved: 20 },
        { sku: 'TP-DDLA-CANXI-BO-OT-500ML', quantity: 140, reserved: 25 },
        { sku: 'TP-KTSW-NAVIMINO-OT-1L', quantity: 100, reserved: 15 },
      ];

      for (const item of haiDuongInventory) {
        const product = findProduct(item.sku);
        if (product) {
          await prisma.inventory.create({
            data: {
              warehouseId: khoHaiDuong.id,
              productId: product.id,
              quantity: item.quantity,
              reservedQuantity: item.reserved,
              updatedBy: 7,
            },
          });
        }
      }
    }

    // ================================================================
    // KHO CÁCH LY & KIỂM ĐỊNH (KHO-CL-QC)
    // Hàng chờ kiểm tra, lượng nhỏ
    // ================================================================
    const khoCachLy = findWarehouse('KHO-CL-QC');
    if (khoCachLy) {
      console.log('--- Seed kho cách ly QC ---');

      const cachLyInventory = [
        { sku: 'TP-KTSW-SIEUDAUTRAI-500ML', quantity: 45, reserved: 45 }, // Đang kiểm định
        { sku: 'TP-DDLA-BONLONTRAI-17-17-17-1KG', quantity: 80, reserved: 80 },
        { sku: 'NL-DL-UREA-46N-25KG', quantity: 15, reserved: 15 }, // Lô mới nhập
        { sku: 'BB-CHAI-HDPE-500ML', quantity: 500, reserved: 500 }, // Kiểm tra chất lượng
      ];

      for (const item of cachLyInventory) {
        const product = findProduct(item.sku);
        if (product) {
          await prisma.inventory.create({
            data: {
              warehouseId: khoCachLy.id,
              productId: product.id,
              quantity: item.quantity,
              reservedQuantity: item.reserved,
              updatedBy: 7,
            },
          });
        }
      }
    }

    // ================================================================
    // KHO DỰ TRỮ MÙA VỤ (KHO-DT-MV)
    // Dự trữ mùa cao điểm
    // ================================================================
    const khoDuTru = findWarehouse('KHO-DT-MV');
    if (khoDuTru) {
      console.log('--- Seed kho dự trữ mùa vụ ---');

      const duTruInventory = [
        { sku: 'TP-KTSW-SIEUDAUTRAI-500ML', quantity: 1200, reserved: 0 },
        { sku: 'TP-DDLA-BONLONTRAI-17-17-17-1KG', quantity: 1800, reserved: 0 },
        { sku: 'TP-VS-TRICHODERMA-500G', quantity: 600, reserved: 0 },
        { sku: 'NL-DL-UREA-46N-25KG', quantity: 300, reserved: 0 }, // 7.5 tấn dự trữ
        { sku: 'BB-CHAI-HDPE-500ML', quantity: 15000, reserved: 0 },
        { sku: 'BB-CARTON-20CHAI-500ML', quantity: 1000, reserved: 0 },
      ];

      for (const item of duTruInventory) {
        const product = findProduct(item.sku);
        if (product) {
          await prisma.inventory.create({
            data: {
              warehouseId: khoDuTru.id,
              productId: product.id,
              quantity: item.quantity,
              reservedQuantity: item.reserved,
              updatedBy: 7,
            },
          });
        }
      }
    }

    // ================================================================
    // KHO TẠM SỰ KIỆN (KHO-SK-TEMP)
    // Hàng demo, quà tặng cho hội chợ
    // ================================================================
    const khoSuKien = findWarehouse('KHO-SK-TEMP');
    if (khoSuKien) {
      console.log('--- Seed kho tạm sự kiện ---');

      const suKienInventory = [
        { sku: 'TP-KTSW-SIEUDAUTRAI-500ML', quantity: 50, reserved: 0 },
        { sku: 'TP-DDLA-BONLONTRAI-17-17-17-1KG', quantity: 80, reserved: 0 },
        { sku: 'TP-AT-DOCTOR-MANGO-SET', quantity: 30, reserved: 0 },
        { sku: 'TP-VS-TRICHODERMA-500G', quantity: 40, reserved: 0 },
      ];

      for (const item of suKienInventory) {
        const product = findProduct(item.sku);
        if (product) {
          await prisma.inventory.create({
            data: {
              warehouseId: khoSuKien.id,
              productId: product.id,
              quantity: item.quantity,
              reservedQuantity: item.reserved,
              updatedBy: 8,
            },
          });
        }
      }
    }

    console.log('✅ Đã seed xong dữ liệu Inventory!');

    // Thống kê
    const totalInventory = await prisma.inventory.count();
    const totalQuantity = await prisma.inventory.aggregate({
      _sum: { quantity: true, reservedQuantity: true },
    });

    console.log(`
  📊 THỐNG KÊ INVENTORY:
  ═══════════════════════════════════════════════════════════
  📦 Tổng số bản ghi: ${totalInventory} mục
  📈 Tổng số lượng hàng: ${totalQuantity._sum.quantity || 0}
  🔒 Tổng số lượng đặt trước: ${totalQuantity._sum.reservedQuantity || 0}
  💰 Số lượng khả dụng: ${
      Number(totalQuantity._sum.quantity || 0) - Number(totalQuantity._sum.reservedQuantity || 0)
    }

  🏭 PHÂN BỔ THEO KHO:
  ├── Kho Thành Phẩm Xuất Hàng: 10 sản phẩm (sẵn sàng bán)
  ├── Kho Sản Xuất Nhà Máy: 4 sản phẩm (vừa sản xuất)
  ├── Kho Nguyên Liệu: 8 loại hóa chất (đầu vào)
  ├── Kho Bao Bì: 9 loại (chai, tem, thùng)
  ├── Kho Trụ Sở Chính: 7 mặt hàng (tổng hợp)
  ├── Chi nhánh Cần Thơ: 6 sản phẩm (ĐBSCL)
  ├── Chi nhánh Đồng Nai: 5 sản phẩm (miền Đông)
  ├── Đại lý Gia Lai: 5 sản phẩm (Tây Nguyên)
  ├── Đại lý Hải Dương: 5 sản phẩm (miền Bắc)
  ├── Kho Cách Ly QC: 4 mục (đang kiểm định)
  ├── Kho Dự Trữ Mùa Vụ: 6 mục (số lượng lớn)
  └── Kho Tạm Sự Kiện: 4 sản phẩm (demo, hội chợ)

  💡 LƯU Ý:
  - Reserved Quantity: Số lượng đã được đặt hàng/đặt trước
  - Quantity: Tổng số lượng tồn kho
  - Available = Quantity - Reserved Quantity
    `);
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi seed inventory:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
