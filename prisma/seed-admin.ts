import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt'; // Hoặc argon2 tùy dự án bạn dùng

const prisma = new PrismaClient();

async function main() {
  // 1. Tạo Role Admin trước (nếu chưa có)
  //   const adminRole = await prisma.role.upsert({
  //     where: { roleKey: 'admin' }, // Giả sử bạn có field unique là roleKey
  //     update: {},
  //     create: {
  //       roleName: 'Administrator',
  //       roleKey: 'admin',
  //       description: 'System Administrator',
  //       // ...các trường khác trong model Role của bạn
  //     },
  //   });

  //   console.log('Role Admin ID:', adminRole.id);

  // 2. Hash password
  const passwordHash = await bcrypt.hash('Admin123', 10); // Mật khẩu mặc định

  // 3. Tạo User Admin
  const adminUser = await prisma.user.upsert({
    where: { email: 'nhanwibu34@gmail.com' },
    update: {},
    create: {
      email: 'nhanwibu34@gmail.com',
      employeeCode: 'NV-0021',
      fullName: 'Admin nhan',
      passwordHash: passwordHash,
      roleId: 5,
      status: 'active',
      createdBy: null, // Người tạo là hệ thống
    },
  });

  console.log('Created Admin User:', adminUser);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });