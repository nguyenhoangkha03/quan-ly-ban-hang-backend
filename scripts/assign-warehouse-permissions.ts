import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Assigning warehouse permissions to admin role...\n');

  // Get admin role
  const adminRole = await prisma.role.findUnique({
    where: { roleKey: 'admin' },
  });

  if (!adminRole) {
    console.error('❌ Admin role not found!');
    return;
  }

  console.log(`✅ Found admin role: ${adminRole.roleName} (ID: ${adminRole.id})\n`);

  // Get warehouse permissions
  const warehousePermissions = await prisma.permission.findMany({
    where: {
      permissionKey: {
        in: ['create_warehouse', 'update_warehouse', 'delete_warehouse'],
      },
    },
  });

  console.log(`✅ Found ${warehousePermissions.length} warehouse permissions:\n`);
  warehousePermissions.forEach((p) => {
    console.log(`   - ${p.permissionKey}: ${p.permissionName}`);
  });

  // Get admin user
  const adminUser = await prisma.user.findFirst({
    where: { roleId: adminRole.id },
  });

  if (!adminUser) {
    console.error('❌ Admin user not found!');
    return;
  }

  console.log(`\n✅ Found admin user: ${adminUser.fullName} (ID: ${adminUser.id})\n`);

  // Assign permissions to admin role
  const results = await Promise.all(
    warehousePermissions.map((p) =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: adminRole.id,
            permissionId: p.id,
          },
        },
        update: {},
        create: {
          roleId: adminRole.id,
          permissionId: p.id,
          assignedBy: adminUser.id,
        },
      })
    )
  );

  console.log(`\n✅ Assigned ${results.length} permissions to admin role!`);
  console.log('\n📝 Now logout and login again to see the changes.');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
