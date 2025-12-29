import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🏭 Bắt đầu seed dữ liệu Nhà cung cấp (Suppliers)...');

  await prisma.supplier.deleteMany({});

  const suppliers = [
    // NHÓM 1: HÓA CHẤT & NGUYÊN LIỆU (Chemicals)
    {
      supplierCode: 'NCC-HOACHAT-DUCGIANG',
      supplierName: 'Tập đoàn Hóa chất Đức Giang',
      supplierType: 'local',
      contactName: 'Nguyễn Văn Hóa',
      phone: '02438271620',
      email: 'sales@ducgiangchem.vn',
      address: '18/44 Đức Giang, Thượng Thanh, Long Biên, Hà Nội',
      taxCode: '0101460288',
      paymentTerms: 'Thanh toán 100% trước khi giao hàng',
      notes: 'NCC chiến lược. Chuyên cung cấp MAP, DAP, Hóa chất Phốt pho.',
      status: 'active',
    },
    {
      supplierCode: 'NCC-DAM-CAMAU',
      supplierName: 'Công ty CP Phân bón Dầu khí Cà Mau (Đạm Cà Mau)',
      supplierType: 'local',
      contactName: 'Phòng Kinh Doanh',
      phone: '02903819000',
      email: 'cskh@pvcfc.com.vn',
      address: 'Lô D, KCN Phường 1, Đường Ngô Quyền, TP. Cà Mau',
      taxCode: '2901268698',
      paymentTerms: 'Công nợ 30 ngày',
      notes: 'Cung cấp Urea hạt đục chất lượng cao.',
      status: 'active',
    },
    {
      supplierCode: 'NCC-XNK-VINACHEM',
      supplierName: 'Vinachem - Tổng công ty Hóa chất Việt Nam',
      supplierType: 'local',
      contactName: 'Mr. Tuấn Anh',
      phone: '0909123456',
      email: 'tuananh@vinachem.com.vn',
      address: '1A Tràng Tiền, Hoàn Kiếm, Hà Nội',
      taxCode: '0100105789',
      paymentTerms: 'Trả trước 50%, 50% sau khi nhận hàng',
      notes: 'Nguồn nhập Kali và các loại muối khoáng.',
      status: 'active',
    },
    {
      supplierCode: 'NCC-HAIFA-ISRAEL',
      supplierName: 'Haifa Group (Israel)',
      supplierType: 'foreign',
      contactName: 'Global Sales Dept',
      phone: '+97248469616',
      email: 'info@haifa-group.com',
      address: 'Haifa Bay Industrial Zone, Israel',
      taxCode: '', // NCC nước ngoài có thể không có MST VN
      paymentTerms: 'L/C (Thư tín dụng) trả ngay',
      notes: 'Nhập khẩu trực tiếp Kali Nitrat (KNO3) và Phân bón lá cao cấp.',
      status: 'active',
    },
    {
      supplierCode: 'NCC-AMINO-FRANCE',
      supplierName: 'Roullier Group (Pháp)',
      supplierType: 'foreign',
      contactName: 'Jean Pierre',
      phone: '+33299206533',
      email: 'contact@roullier.com',
      address: 'Saint-Malo, France',
      taxCode: '',
      paymentTerms: 'T/T 30% deposit, 70% upon BL copy',
      notes: 'Nguồn nhập Amino Acid thủy phân và Rong biển chất lượng cao.',
      status: 'active',
    },

    // NHÓM 2: BAO BÌ & IN ẤN (Packaging)
    {
      supplierCode: 'NCC-NHUA-DUYTAN',
      supplierName: 'Công ty Cổ phần Nhựa Duy Tân',
      supplierType: 'local',
      contactName: 'Ms. Lan (Sale Admin)',
      phone: '02838762222',
      email: 'info@duytan.com',
      address: '298 Hồ Học Lãm, An Lạc, Bình Tân, TP.HCM',
      taxCode: '0300784321',
      paymentTerms: 'Công nợ 45 ngày',
      notes: 'Cung cấp chai nhựa HDPE 500ml, 1L và Can nhựa các loại.',
      status: 'active',
    },
    {
      supplierCode: 'NCC-IN-LIKSIN',
      supplierName: 'Tổng công ty Liksin',
      supplierType: 'local',
      contactName: 'Anh Hùng (Kỹ thuật in)',
      phone: '02837542951',
      email: 'sales@liksin.vn',
      address: '159 Kinh Dương Vương, P.12, Q.6, TP.HCM',
      taxCode: '0301447399',
      paymentTerms: 'Thanh toán ngay khi giao hàng',
      notes: 'In tem nhãn Decal, bao bì màng ghép phức hợp chất lượng cao.',
      status: 'active',
    },
    {
      supplierCode: 'NCC-BAOBI-TANTHANH',
      supplierName: 'Công ty Bao Bì Tân Thành',
      supplierType: 'local',
      contactName: 'Chị Thảo',
      phone: '0918888999',
      email: 'baobitanthanh@gmail.com',
      address: 'Lô C2, KCN Tân Bình, TP.HCM',
      taxCode: '0312345678',
      paymentTerms: 'Gối đầu 1 đơn hàng',
      notes: 'Chuyên cung cấp thùng Carton 3 lớp, 5 lớp in Offset.',
      status: 'active',
    },

    // NHÓM 3: MÁY MÓC & VẬT TƯ (Machinery & Supplies)
    {
      supplierCode: 'NCC-MAY-VNPACK',
      supplierName: 'Công Ty TNHH Máy Đóng Gói VNPACK',
      supplierType: 'local',
      contactName: 'Kỹ sư Tùng',
      phone: '0979555777',
      email: 'support@vnpack.vn',
      address: 'Số 5, Ngõ 2, Đường Liên Cơ, Nam Từ Liêm, Hà Nội',
      taxCode: '0105558889',
      paymentTerms: 'Bảo hành 12 tháng, thanh toán 100%',
      notes: 'Cung cấp và bảo trì máy chiết rót định lượng, máy dán nhãn.',
    },
  ];

  for (const supplier of suppliers) {
    // Chúng ta phải ép kiểu (cast) supplier_type về đúng enum của Prisma
    // vì TypeScript sẽ coi string 'local' là string thường chứ không phải enum
    const data = {
      ...supplier,
      supplierType: supplier.supplierType as 'local' | 'foreign',
      status: supplier.status as 'active' | 'inactive',
    };

    await prisma.supplier.upsert({
      where: { supplierCode: supplier.supplierCode },
      update: data,
      create: data,
    });
  }

  console.log(`✅ Đã seed xong ${suppliers.length} nhà cung cấp!`);
}
export { main };

// main()
//   .catch((e) => {
//     console.error('❌ Lỗi khi seed suppliers:', e);
//     process.exit(1);
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });
