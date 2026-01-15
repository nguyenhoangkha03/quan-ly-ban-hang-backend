import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function main() {
  console.log('Bắt đầu seed dữ liệu Category');

  await prisma.category.deleteMany({});

  // NHÓM 1: THÀNH PHẨM - Dành cho kinh doanh

  console.log('--- Tạo nhóm thành phẩm ---');

  const tpRoot = await prisma.category.upsert({
    where: { categoryCode: 'TP' },
    update: {},
    create: {
      categoryCode: 'TP',
      categoryName: 'Thành phẩm kinh doanh',
      slug: 'thanh-pham-kinh-doanh',
      description: 'Sản phẩm hoàn thiện bán ra thị trường',
      status: 'active',
    },
  });

  const tpChildren = [
    {
      categoryCode: 'TP-KICH-THICH',
      categoryName: 'Kích thích sinh trưởng',
      slug: 'kich-thich-sinh-truong',
      description: 'Ra rễ, bung đọt, kích hoa, đậu trái',
    },
    {
      categoryCode: 'TP-DINH-DUONG',
      categoryName: 'Dinh dưỡng & Phân bón lá',
      slug: 'dinh-dung-phan-bon-la',
      description: 'NPK hòa tan, Trung vi lượng, Amino acid',
    },
    {
      categoryCode: 'TP-VI-SINH',
      categoryName: 'Chế phẩm Vi sinh & Trừ bệnh',
      slug: 'che-pham-vi-sinh-tru-benh',
      description: 'Trichoderma, Trừ nấm khuẩn sinh học',
    },
    // Phân loại theo cây trồng (để nông dân dễ tìm)
    {
      categoryCode: 'TP-CAY-AN-TRAI',
      categoryName: 'Chuyên dùng: Cây ăn trái',
      slug: 'chuyen-dung-cay-an-trai',
      description: 'Sầu riêng, Xoài, Cam, Bưởi...',
    },
    {
      categoryCode: 'TP-RAU-MAU',
      categoryName: 'Chuyên dùng: Rau màu & Hoa',
      slug: 'chuyen-dung-rau-mau-hoa',
      description: 'Ớt, Dưa, Cà chua, Hoa kiểng',
    },
    {
      categoryCode: 'TP-CAY-CN',
      categoryName: 'Chuyên dùng: Cây công nghiệp',
      slug: 'chuyen-dung-cay-cong-nghiep',
      description: 'Tiêu, Cà phê, Điều, Cao su',
    },
    {
      categoryCode: 'TP-LUA',
      categoryName: 'Chuyên dùng: Lúa & Nếp',
      slug: 'chuyen-dung-lua-nep',
      description: 'Lúa, Nếp các loại',
    },
  ];

  for (const child of tpChildren) {
    await prisma.category.upsert({
      where: { categoryCode: child.categoryCode },
      update: {},
      create: {
        ...child,
        parentId: tpRoot.id,
        status: 'active',
      },
    });
  }

  // NHÓM 2: NGUYÊN LIỆU - Dành cho sản xuất
  console.log('--- Tạo nhóm Nguyên Liệu ---');

  const nlRoot = await prisma.category.upsert({
    where: { categoryCode: 'NL' },
    update: {},
    create: {
      categoryCode: 'NL',
      categoryName: 'Nguyên liệu sản xuất',
      slug: 'nguyen-lieu-san-xuat',
      description: 'Hóa chất, phụ gia nhập khẩu để phối trộn',
      status: 'active',
    },
  });

  const nlChildren = [
    {
      categoryCode: 'NL-DA-LUONG',
      categoryName: 'Hóa chất Đa lượng (Macro)',
      slug: 'hoa-chat-da-luong',
      description: 'Urea, DAP, MAP, Kali...',
    },
    {
      categoryCode: 'NL-VI-LUONG',
      categoryName: 'Hóa chất Vi lượng (Micro)',
      slug: 'hoa-chat-vi-luong',
      description: 'Borax, Kẽm, Magie, Đồng, Mangan...',
    },
    {
      categoryCode: 'NL-HUU-CO',
      categoryName: 'Nguyên liệu Hữu cơ & Sinh học',
      slug: 'nguyen-lieu-huu-co-sinh-hoc',
      description: 'Humic, Fulvic, Amino bột/nước, Rong biển',
    },
    {
      categoryCode: 'NL-PHU-GIA',
      categoryName: 'Phụ gia & Dung môi',
      slug: 'phu-gia-dung-moi',
      description: 'Chất bám dính, chất tạo màu, dung môi hòa tan',
    },
  ];

  for (const child of nlChildren) {
    await prisma.category.upsert({
      where: { categoryCode: child.categoryCode },
      update: { parentId: nlRoot.id },
      create: {
        ...child,
        parentId: nlRoot.id,
        status: 'active',
      },
    });
  }

  // NHÓM 3: BAO BÌ - Dành cho Sản xuất & Kho
  console.log('--- Tạo nhóm Bao Bì ---');

  const bbRoot = await prisma.category.upsert({
    where: { categoryCode: 'BB' },
    update: {},
    create: {
      categoryCode: 'BB',
      categoryName: 'Bao bì đóng gói',
      slug: 'bao-bi-dong-goi',
      description: 'Vỏ chai, nhãn, thùng carton',
      status: 'active',
    },
  });

  const bbChildren = [
    {
      categoryCode: 'BB-CHAI-CAN',
      categoryName: 'Chai & Can nhựa',
      slug: 'chai-can-nhua',
      description: 'Chai 100ml - 1L, Can 2L - 20L',
    },
    {
      categoryCode: 'BB-MANG-GHEP',
      categoryName: 'Bao bì màng ghép (Túi/Gói)',
      slug: 'bao-bi-mang-ghep',
      description: 'Túi nhôm, gói 50g - 5kg',
    },
    {
      categoryCode: 'BB-TEM-NHAN',
      categoryName: 'Tem, Nhãn, Decal',
      slug: 'tem-nhan-decal',
      description: 'Nhãn mặt trước, nhãn HDSD, tem chống giả',
    },
    {
      categoryCode: 'BB-NGOAI',
      categoryName: 'Thùng Carton & Đóng gói ngoài',
      slug: 'thung-carton-dong-goi-ngoai',
      description: 'Thùng giấy, băng keo, màng co',
    },
  ];

  for (const child of bbChildren) {
    await prisma.category.upsert({
      where: { categoryCode: child.categoryCode },
      update: { parentId: bbRoot.id },
      create: {
        ...child,
        parentId: bbRoot.id,
        status: 'active',
      },
    });
  }

  console.log('✅ Đã seed xong dữ liệu Category!');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi seed category:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
