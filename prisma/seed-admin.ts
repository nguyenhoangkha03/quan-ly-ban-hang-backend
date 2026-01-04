import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Bắt đầu cấp quyền Full Admin...');

  // 1. Tìm hoặc Tạo Role Admin (Dựa vào roleKey chuẩn là 'admin' thay vì ID cứng)
  const adminRole = await prisma.role.upsert({
    where: { roleKey: 'admin' },
    update: {},
    create: {
      roleKey: 'admin',
      roleName: 'Quản trị viên hệ thống',
      description: 'Full quyền hệ thống',
      status: 'active',
    },
  });

  console.log(`✅ Role Admin ID: ${adminRole.id}`);

  // 2. Tạo User Admin
  const passwordHash = await bcrypt.hash('Admin@123', 10);
  
  const adminUser = await prisma.user.upsert({
    where: { email: 'hovtois2s@gmail.com' },
    update: {
      roleId: adminRole.id, // Cập nhật lại role đúng nếu user đã tồn tại
      status: 'active',
      passwordHash: passwordHash // Reset pass nếu cần
    },
    create: {
      email: 'hovtois2s@gmail.com',
      employeeCode: 'NV-FULL-ADMIN', // Đổi mã khác để tránh trùng lặp
      fullName: 'Admin hovtoi (Full)',
      passwordHash: passwordHash,
      roleId: adminRole.id, // ✅ Lấy ID động từ bước 1
      status: 'active',
    },
  });

  console.log(`✅ User Admin: ${adminUser.email} (Role ID: ${adminUser.roleId})`);

  // 3. CẤP FULL QUYỀN (QUAN TRỌNG NHẤT)
  // Lấy tất cả quyền đang có trong bảng Permission
  const allPermissions = await prisma.permission.findMany();
  
  console.log(`🔍 Tìm thấy tổng cộng ${allPermissions.length} quyền trong hệ thống.`);

  if (allPermissions.length === 0) {
    console.warn('⚠️ Cảnh báo: Bảng Permission đang trống. Bạn cần chạy "npx prisma db seed" trước để tạo danh sách quyền!');
  }

  // Gán tất cả quyền đó cho Role Admin
  const rolePermissions = await Promise.all(
    allPermissions.map((p) =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: adminRole.id,
            permissionId: p.id,
          },
        },
        update: {}, // Nếu đã có thì không làm gì
        create: {
          roleId: adminRole.id,
          permissionId: p.id,
          assignedBy: adminUser.id,
        },
      })
    )
  );

  console.log(`🎉 Đã gán thành công ${rolePermissions.length} quyền cho Role Admin.`);
  console.log('✅ Xong! Hãy đăng nhập lại để kiểm tra.');
}

main()
  .catch((e) => {
    console.error('❌ Lỗi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });