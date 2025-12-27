import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...\n');

  // // =====================================================
  // // 0. CLEAN DATABASE (Delete existing data)
  // // =====================================================
  // console.log('🗑️  Cleaning database...\n');

  // try {
  //   // Delete in correct order to respect foreign key constraints
  //   await prisma.rolePermission.deleteMany({});
  //   console.log('   ✓ Deleted RolePermissions');

  //   await prisma.user.deleteMany({});
  //   console.log('   ✓ Deleted Users');

  //   await prisma.warehouse.deleteMany({});
  //   console.log('   ✓ Deleted Warehouses');

  //   await prisma.supplier.deleteMany({});
  //   console.log('   ✓ Deleted Suppliers');

  //   await prisma.category.deleteMany({});
  //   console.log('   ✓ Deleted Categories');

  //   await prisma.permission.deleteMany({});
  //   console.log('   ✓ Deleted Permissions');

  //   await prisma.role.deleteMany({});
  //   console.log('   ✓ Deleted Roles');

  //   console.log('\n✅ Database cleaned successfully!\n');
  // } catch (error) {
  //   console.error('⚠️  Error cleaning database:', error);
  //   console.log('   Continuing with seed process...\n');
  // }

  // =====================================================
  // 1. SEED ROLES
  // =====================================================
  console.log('📝 Seeding roles...');

  const roles = await Promise.all([
    prisma.role.upsert({
      where: { roleKey: 'admin' },
      update: {},
      create: {
        roleKey: 'admin',
        roleName: 'Quản trị viên hệ thống',
        description: 'Có toàn quyền truy cập và quản lý hệ thống',
        status: 'active',
      },
    }),
    prisma.role.upsert({
      where: { roleKey: 'accountant' },
      update: {},
      create: {
        roleKey: 'accountant',
        roleName: 'Kế toán',
        description: 'Quản lý thu chi, công nợ, báo cáo tài chính',
        status: 'active',
      },
    }),
    prisma.role.upsert({
      where: { roleKey: 'warehouse_manager' },
      update: {},
      create: {
        roleKey: 'warehouse_manager',
        roleName: 'Quản lý kho chính',
        description: 'Giám sát tồn kho tổng thể, điều phối chuyển kho',
        status: 'active',
      },
    }),
    prisma.role.upsert({
      where: { roleKey: 'warehouse_staff' },
      update: {},
      create: {
        roleKey: 'warehouse_staff',
        roleName: 'Nhân viên kho',
        description: 'Quản lý nhập xuất tồn kho theo kho được phân công',
        status: 'active',
      },
    }),
    prisma.role.upsert({
      where: { roleKey: 'production_manager' },
      update: {},
      create: {
        roleKey: 'production_manager',
        roleName: 'Quản lý sản xuất',
        description: 'Quản lý công thức sản xuất, lệnh sản xuất',
        status: 'active',
      },
    }),
    prisma.role.upsert({
      where: { roleKey: 'sales_staff' },
      update: {},
      create: {
        roleKey: 'sales_staff',
        roleName: 'Nhân viên bán hàng',
        description: 'Quản lý khách hàng, tạo đơn hàng, theo dõi công nợ',
        status: 'active',
      },
    }),
    prisma.role.upsert({
      where: { roleKey: 'delivery_staff' },
      update: {},
      create: {
        roleKey: 'delivery_staff',
        roleName: 'Nhân viên giao hàng',
        description: 'Nhận và giao hàng, thu tiền COD',
        status: 'active',
      },
    }),
  ]);

  console.log(`✅ Created ${roles.length} roles\n`);

  // =====================================================
  // 2. SEED PERMISSIONS
  // =====================================================
  console.log('📝 Seeding permissions...');

  const permissionsData = [
    // ============================================================
    // USER MANAGEMENT
    // ============================================================
    { key: 'view_users', name: 'Xem danh sách người dùng', module: 'users' },
    { key: 'create_user', name: 'Tạo người dùng mới', module: 'users' },
    { key: 'update_user', name: 'Cập nhật người dùng', module: 'users' },
    { key: 'delete_user', name: 'Xóa người dùng', module: 'users' },
    { key: 'manage_roles', name: 'Quản lý vai trò và quyền', module: 'users' },

    // ============================================================
    // WAREHOUSE MANAGEMENT
    // ============================================================
    // Warehouses
    { key: 'view_warehouses', name: 'Xem danh sách kho', module: 'warehouse' },
    { key: 'create_warehouse', name: 'Tạo kho mới', module: 'warehouse' },
    { key: 'update_warehouse', name: 'Cập nhật kho', module: 'warehouse' },
    { key: 'delete_warehouse', name: 'Xóa kho', module: 'warehouse' },

    // Inventory
    { key: 'view_inventory', name: 'Xem tồn kho', module: 'warehouse' },
    { key: 'manage_inventory', name: 'Quản lý tồn kho', module: 'warehouse' },

    // Stock Transactions (FIXED: Added 's')
    { key: 'view_stock_transactions', name: 'Xem phiếu kho', module: 'warehouse' },
    { key: 'create_stock_transactions', name: 'Tạo phiếu kho', module: 'warehouse' },
    { key: 'approve_stock_transactions', name: 'Phê duyệt phiếu kho', module: 'warehouse' },
    { key: 'cancel_stock_transactions', name: 'Hủy phiếu kho', module: 'warehouse' },
    { key: 'stocktake_warehouse', name: 'Kiểm kê kho', module: 'warehouse' },
    {
      key: 'create_disposal_transaction',
      name: 'Tạo phiếu xuất hủy hàng hỏng',
      module: 'warehouse',
    },

    // Stock Transfers (NEW)
    { key: 'view_stock_transfers', name: 'Xem phiếu chuyển kho', module: 'warehouse' },
    { key: 'create_stock_transfers', name: 'Tạo phiếu chuyển kho', module: 'warehouse' },
    { key: 'update_stock_transfers', name: 'Cập nhật phiếu chuyển kho', module: 'warehouse' },
    { key: 'delete_stock_transfers', name: 'Xóa phiếu chuyển kho', module: 'warehouse' },
    { key: 'approve_stock_transfers', name: 'Phê duyệt phiếu chuyển kho', module: 'warehouse' },
    { key: 'cancel_stock_transfers', name: 'Hủy phiếu chuyển kho', module: 'warehouse' },
    { key: 'complete_stock_transfers', name: 'Hoàn thành chuyển kho', module: 'warehouse' },

    // ============================================================
    // SUPPLIER MANAGEMENT (NEW MODULE)
    // ============================================================
    { key: 'view_suppliers', name: 'Xem nhà cung cấp', module: 'suppliers' },
    { key: 'create_supplier', name: 'Tạo nhà cung cấp', module: 'suppliers' },
    { key: 'update_supplier', name: 'Cập nhật nhà cung cấp', module: 'suppliers' },
    { key: 'delete_supplier', name: 'Xóa nhà cung cấp', module: 'suppliers' },

    // ============================================================
    // PURCHASE ORDER MANAGEMENT (NEW MODULE)
    // ============================================================
    { key: 'view_purchase_orders', name: 'Xem đơn đặt hàng', module: 'procurement' },
    { key: 'create_purchase_order', name: 'Tạo đơn đặt hàng', module: 'procurement' },
    { key: 'update_purchase_order', name: 'Cập nhật đơn đặt hàng', module: 'procurement' },
    { key: 'delete_purchase_order', name: 'Xóa đơn đặt hàng', module: 'procurement' },
    { key: 'approve_purchase_order', name: 'Phê duyệt đơn đặt hàng', module: 'procurement' },
    { key: 'sendEmail_purchase_order', name: 'Gửi mail đơn đặt hàng', module: 'procurement' },
    { key: 'receive_purchase_order', name: 'Nhận hàng đơn đặt hàng', module: 'procurement' },
    { key: 'cancel_purchase_order', name: 'Hủy đơn đặt hàng', module: 'procurement' },
    { key: 'view_procurement', name: 'Xem mua hàng', module: 'procurement' },
    { key: 'manage_procurement', name: 'Quản lý mua hàng', module: 'procurement' },

    // ============================================================
    // PRODUCT MANAGEMENT
    // ============================================================
    // Products
    { key: 'view_products', name: 'Xem sản phẩm', module: 'products' },
    { key: 'create_product', name: 'Tạo sản phẩm', module: 'products' },
    { key: 'update_product', name: 'Cập nhật sản phẩm', module: 'products' },
    { key: 'delete_product', name: 'Xóa sản phẩm', module: 'products' },
    { key: 'manage_product_prices', name: 'Quản lý giá sản phẩm (Vốn/Bán)', module: 'products' },

    // Categories (NEW)
    { key: 'view_categories', name: 'Xem danh mục', module: 'products' },
    { key: 'create_category', name: 'Tạo danh mục', module: 'products' },
    { key: 'update_category', name: 'Cập nhật danh mục', module: 'products' },
    { key: 'delete_category', name: 'Xóa danh mục', module: 'products' },

    // ============================================================
    // PRODUCTION MANAGEMENT
    // ============================================================
    // BOM
    { key: 'view_bom', name: 'Xem công thức sản xuất', module: 'production' },
    { key: 'create_bom', name: 'Tạo công thức sản xuất', module: 'production' },
    { key: 'update_bom', name: 'Cập nhật công thức sản xuất', module: 'production' },
    { key: 'delete_bom', name: 'Xóa công thức sản xuất', module: 'production' },
    { key: 'approve_bom', name: 'Phê duyệt công thức', module: 'production' },

    // Production
    { key: 'view_production', name: 'Xem thông tin sản xuất', module: 'production' },
    { key: 'manage_production', name: 'Quản lý sản xuất', module: 'production' },
    { key: 'view_production_orders', name: 'Xem lệnh sản xuất', module: 'production' },
    { key: 'create_production_order', name: 'Tạo lệnh sản xuất', module: 'production' },
    { key: 'update_production_order', name: 'Cập nhật lệnh sản xuất', module: 'production' },
    { key: 'delete_production_order', name: 'Xóa lệnh sản xuất', module: 'production' },
    { key: 'approve_production_order', name: 'Phê duyệt lệnh sản xuất', module: 'production' },
    { key: 'cancel_production_order', name: 'Hủy lệnh sản xuất', module: 'production' },
    { key: 'start_production', name: 'Bắt đầu sản xuất', module: 'production' },
    { key: 'complete_production', name: 'Hoàn thành sản xuất', module: 'production' },
    { key: 'view_production_reports', name: 'Xem báo cáo sản xuất', module: 'production' },

    // ============================================================
    // SALES MANAGEMENT
    // ============================================================
    // Customers
    { key: 'view_customers', name: 'Xem khách hàng', module: 'sales' },
    { key: 'create_customer', name: 'Tạo khách hàng', module: 'sales' },
    { key: 'update_customer', name: 'Cập nhật khách hàng', module: 'sales' },
    { key: 'delete_customer', name: 'Xóa khách hàng', module: 'sales' },
    { key: 'view_customer_debt', name: 'Xem công nợ khách hàng', module: 'sales' },
    { key: 'update_customer_credit_limit', name: 'Cập nhật hạn mức', module: 'sales' },
    { key: 'update_customer_status', name: 'Cập nhật trạng thái KH', module: 'sales' },

    // Sales Orders
    { key: 'view_sales_orders', name: 'Xem đơn hàng', module: 'sales' },
    { key: 'create_sales_order', name: 'Tạo đơn hàng', module: 'sales' },
    { key: 'update_sales_order', name: 'Cập nhật đơn hàng', module: 'sales' },
    { key: 'delete_sales_order', name: 'Xóa đơn hàng', module: 'sales' },
    { key: 'approve_sales_order', name: 'Phê duyệt đơn hàng', module: 'sales' },
    { key: 'cancel_sales_order', name: 'Hủy đơn hàng', module: 'sales' },
    { key: 'complete_sales_order', name: 'Hoàn thành đơn hàng', module: 'sales' },

    // Deliveries (NEW MODULE)
    { key: 'view_deliveries', name: 'Xem phiếu giao hàng', module: 'sales' },
    { key: 'create_delivery', name: 'Tạo phiếu giao hàng', module: 'sales' },
    { key: 'update_delivery', name: 'Cập nhật phiếu giao', module: 'sales' },
    { key: 'delete_delivery', name: 'Xóa phiếu giao', module: 'sales' },
    { key: 'start_delivery', name: 'Bắt đầu giao hàng', module: 'sales' },
    { key: 'complete_delivery', name: 'Hoàn thành giao hàng', module: 'sales' },
    { key: 'fail_delivery', name: 'Báo giao hàng thất bại', module: 'sales' },
    { key: 'settle_cod', name: 'Quyết toán COD', module: 'sales' },
    { key: 'view_delivery_settlement', name: 'Xem quyết toán giao hàng', module: 'sales' },

    // Promotions (NEW MODULE)
    { key: 'view_promotions', name: 'Xem khuyến mãi', module: 'sales' },
    { key: 'create_promotion', name: 'Tạo khuyến mãi', module: 'sales' },
    { key: 'update_promotion', name: 'Cập nhật khuyến mãi', module: 'sales' },
    { key: 'approve_promotion', name: 'Phê duyệt khuyến mãi', module: 'sales' },
    { key: 'cancel_promotion', name: 'Hủy khuyến mãi', module: 'sales' },
    { key: 'manage_promotions', name: 'Quản lý khuyến mãi', module: 'sales' },

    { key: 'approve_credit_limit_override', name: 'Phê duyệt bán vượt hạn mức', module: 'sales' },

    // ============================================================
    // FINANCIAL MANAGEMENT
    // ============================================================
    // Reports
    { key: 'view_financial_reports', name: 'Xem báo cáo tài chính', module: 'finance' },

    // Payment Receipts
    { key: 'create_payment_receipt', name: 'Tạo phiếu thu', module: 'finance' },
    { key: 'view_payment_receipts', name: 'Xem phiếu thu', module: 'finance' },
    { key: 'update_payment_receipt', name: 'Cập nhật phiếu thu', module: 'finance' },
    { key: 'delete_payment_receipt', name: 'Xóa phiếu thu', module: 'finance' },
    { key: 'post_payment_receipt', name: 'Hạch toán phiếu thu', module: 'finance' },

    // Payment Vouchers
    { key: 'create_payment_voucher', name: 'Tạo phiếu chi', module: 'finance' },
    { key: 'view_payment_vouchers', name: 'Xem phiếu chi', module: 'finance' },
    { key: 'update_payment_voucher', name: 'Cập nhật phiếu chi', module: 'finance' },
    { key: 'delete_payment_voucher', name: 'Xóa phiếu chi', module: 'finance' },
    { key: 'post_payment_voucher', name: 'Hạch toán phiếu chi', module: 'finance' },

    // Payment
    { key: 'approve_payment', name: 'Phê duyệt thu chi', module: 'finance' },
    { key: 'process_payment', name: 'Xử lý thanh toán', module: 'finance' },

    // Debt Management
    { key: 'manage_debt', name: 'Quản lý công nợ', module: 'finance' },
    { key: 'reconcile_debt', name: 'Đối chiếu công nợ', module: 'finance' },

    // Debt Reconciliation (NEW - Chi tiết)
    { key: 'view_debt_reconciliation', name: 'Xem đối chiếu công nợ', module: 'finance' },
    { key: 'create_debt_reconciliation', name: 'Tạo biên bản đối chiếu', module: 'finance' },
    { key: 'confirm_debt_reconciliation', name: 'Xác nhận đối chiếu', module: 'finance' },
    { key: 'send_debt_reconciliation_email', name: 'Gửi email đối chiếu', module: 'finance' },

    // Cash Fund (Quỹ tiền mặt)
    { key: 'view_cash_fund', name: 'Xem quỹ tiền mặt', module: 'finance' },
    { key: 'reconcile_cash_fund', name: 'Đối chiếu/Kiểm kê quỹ', module: 'finance' }, // Dành cho Kế toán
    { key: 'approve_cash_fund', name: 'Phê duyệt/Khóa sổ quỹ', module: 'finance' }, // Dành cho Admin/Kế toán trưởng

    // ============================================================
    // HR MANAGEMENT
    // ============================================================
    // Attendance
    { key: 'view_attendance', name: 'Xem chấm công', module: 'hr' },
    { key: 'manage_attendance', name: 'Quản lý chấm công', module: 'hr' },
    { key: 'update_attendance', name: 'Cập nhật chấm công', module: 'hr' },
    { key: 'delete_attendance', name: 'Xóa chấm công', module: 'hr' },

    // Leave
    { key: 'approve_leave', name: 'Phê duyệt nghiệp vụ', module: 'hr' },

    // Salary
    { key: 'view_salary', name: 'Xem lương', module: 'hr' },
    { key: 'manage_salary', name: 'Quản lý lương', module: 'hr' },
    { key: 'create_salary', name: 'Tạo lương', module: 'hr' },
    { key: 'update_salary', name: 'Cập nhật lương', module: 'hr' },
    { key: 'delete_salary', name: 'Xóa lương', module: 'hr' },
    { key: 'calculate_salary', name: 'Tính lương', module: 'hr' },
    { key: 'approve_salary', name: 'Phê duyệt lương', module: 'hr' },
    { key: 'pay_salary', name: 'Thanh toán lương', module: 'hr' },

    // ============================================================
    // REPORTS & DASHBOARD
    // ============================================================
    { key: 'view_dashboard', name: 'Xem dashboard', module: 'reports' },
    { key: 'view_reports', name: 'Xem báo cáo', module: 'reports' },
    { key: 'export_reports', name: 'Xuất báo cáo', module: 'reports' },

    // ============================================================
    // SYSTEM
    // ============================================================
    { key: 'view_activity_logs', name: 'Xem nhật ký hoạt động hệ thống', module: 'system' },

    // ============================================================
    // SETTINGS
    // ============================================================
    { key: 'manage_settings', name: 'Quản lý cài đặt hệ thống', module: 'settings' },
  ];

  const permissions = await Promise.all(
    permissionsData.map((p) =>
      prisma.permission.upsert({
        where: { permissionKey: p.key },
        update: {},
        create: {
          permissionKey: p.key,
          permissionName: p.name,
          module: p.module,
        },
      })
    )
  );

  console.log(`✅ Created ${permissions.length} permissions\n`);

  // =====================================================
  // 3. SEED WAREHOUSES
  // =====================================================
  console.log('📝 Seeding warehouses...');

  const warehouses = await Promise.all([
    prisma.warehouse.upsert({
      where: { warehouseCode: 'KNL-001' },
      update: {},
      create: {
        warehouseCode: 'KNL-001',
        warehouseName: 'Kho nguyên liệu trung tâm',
        warehouseType: 'raw_material',
        address: '123 Đường ABC, Quận 1',
        city: 'Hồ Chí Minh',
        region: 'Miền Nam',
        capacity: 1000,
        status: 'active',
      },
    }),
    prisma.warehouse.upsert({
      where: { warehouseCode: 'KBB-001' },
      update: {},
      create: {
        warehouseCode: 'KBB-001',
        warehouseName: 'Kho bao bì trung tâm',
        warehouseType: 'packaging',
        address: '456 Đường DEF, Quận 2',
        city: 'Hồ Chí Minh',
        region: 'Miền Nam',
        capacity: 500,
        status: 'active',
      },
    }),
    prisma.warehouse.upsert({
      where: { warehouseCode: 'KTP-001' },
      update: {},
      create: {
        warehouseCode: 'KTP-001',
        warehouseName: 'Kho thành phẩm trung tâm',
        warehouseType: 'finished_product',
        address: '789 Đường GHI, Quận 3',
        city: 'Hồ Chí Minh',
        region: 'Miền Nam',
        capacity: 800,
        status: 'active',
      },
    }),
    prisma.warehouse.upsert({
      where: { warehouseCode: 'KHH-001' },
      update: {},
      create: {
        warehouseCode: 'KHH-001',
        warehouseName: 'Kho hàng hóa trung tâm',
        warehouseType: 'goods',
        address: '101 Đường JKL, Quận 4',
        city: 'Hồ Chí Minh',
        region: 'Miền Nam',
        capacity: 600,
        status: 'active',
      },
    }),
  ]);

  console.log(`✅ Created ${warehouses.length} warehouses\n`);

  // =====================================================
  // 4. SEED ADMIN USER
  // =====================================================
  console.log('📝 Seeding admin user...');

  const adminRole = roles.find((r) => r.roleKey === 'admin');
  const hashedPassword = await bcrypt.hash('admin123', 10);

  let adminUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: 'nhoangkha03@gmail.com' }, { employeeCode: 'NV-0001' }],
    },
  });

  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        employeeCode: 'NV-0001',
        email: 'nhoangkha03@gmail.com',
        passwordHash: hashedPassword,
        fullName: 'Quản trị viên hệ thống',
        phone: '0123456789',
        gender: 'male',
        roleId: adminRole!.id,
        status: 'active',
      },
    });
    console.log(`✅ Created admin user: ${adminUser.email} (password: admin123)\n`);
  } else {
    console.log(`✅ Admin user already exists: ${adminUser.email} / ${adminUser.employeeCode}\n`);
  }

  // =====================================================
  // 5. SEED ADDITIONAL USERS
  // =====================================================
  console.log('📝 Seeding additional users...');

  const warehouseManagerRole = roles.find((r) => r.roleKey === 'warehouse_manager');
  const warehouseStaffRole = roles.find((r) => r.roleKey === 'warehouse_staff');
  const salesStaffRole = roles.find((r) => r.roleKey === 'sales_staff');
  const accountantRole = roles.find((r) => r.roleKey === 'accountant');
  const productionManagerRole = roles.find((r) => r.roleKey === 'production_manager');

  const defaultPassword = await bcrypt.hash('admin123', 10);

  const additionalUsers = await Promise.all([
    // Warehouse Managers
    prisma.user.upsert({
      where: { email: 'hanhlanganime@gmail.com' },
      update: {},
      create: {
        employeeCode: 'NV-0002',
        email: 'hanhlanganime@gmail.com',
        passwordHash: hashedPassword,
        fullName: 'Nguyễn Văn Quản',
        phone: '0901234567',
        gender: 'male',
        roleId: warehouseManagerRole!.id,
        warehouseId: warehouses[0].id, // KNL-001
        status: 'active',
        createdBy: adminUser.id,
      },
    }),
    prisma.user.upsert({
      where: { email: 'momota19102003@gmail.com' },
      update: {},
      create: {
        employeeCode: 'NV-0003',
        email: 'momota19102003@gmail.com',
        passwordHash: hashedPassword,
        fullName: 'Trần Thị Lan',
        phone: '0902345678',
        gender: 'female',
        roleId: warehouseManagerRole!.id,
        warehouseId: warehouses[2].id, // KTP-001
        status: 'active',
        createdBy: adminUser.id,
      },
    }),

    // Warehouse Staff
    prisma.user.upsert({
      where: { email: 'staff1@company.com' },
      update: {},
      create: {
        employeeCode: 'NV-0004',
        email: 'staff1@company.com',
        passwordHash: hashedPassword,
        fullName: 'Lê Văn Tài',
        phone: '0903456789',
        gender: 'male',
        roleId: warehouseStaffRole!.id,
        warehouseId: warehouses[1].id, // KBB-001
        status: 'active',
        createdBy: adminUser.id,
      },
    }),
    prisma.user.upsert({
      where: { email: 'staff2@company.com' },
      update: {},
      create: {
        employeeCode: 'NV-0005',
        email: 'staff2@company.com',
        passwordHash: hashedPassword,
        fullName: 'Phạm Thị Hoa',
        phone: '0904567890',
        gender: 'female',
        roleId: warehouseStaffRole!.id,
        warehouseId: warehouses[3].id, // KHH-001
        status: 'active',
        createdBy: adminUser.id,
      },
    }),

    // Sales Staff
    prisma.user.upsert({
      where: { email: 'sales@company.com' },
      update: {},
      create: {
        employeeCode: 'NV-0006',
        email: 'sales@company.com',
        passwordHash: hashedPassword,
        fullName: 'Hoàng Văn Đạt',
        phone: '0905678901',
        gender: 'male',
        roleId: salesStaffRole!.id,
        status: 'active',
        createdBy: adminUser.id,
      },
    }),

    // Accountant
    prisma.user.upsert({
      where: { email: 'accountant@company.com' },
      update: {},
      create: {
        employeeCode: 'NV-0007',
        email: 'accountant@company.com',
        passwordHash: hashedPassword,
        fullName: 'Vũ Thị Mai',
        phone: '0906789012',
        gender: 'female',
        roleId: accountantRole!.id,
        status: 'active',
        createdBy: adminUser.id,
      },
    }),

    // Production Manager
    prisma.user.upsert({
      where: { email: 'production@company.com' },
      update: {},
      create: {
        employeeCode: 'NV-0008',
        email: 'production@company.com',
        passwordHash: defaultPassword,
        fullName: 'Đỗ Văn Cường',
        phone: '0907890123',
        gender: 'male',
        roleId: productionManagerRole!.id,
        status: 'active',
        createdBy: adminUser.id,
      },
    }),
  ]);

  console.log(`✅ Created ${additionalUsers.length} additional users (password: 123456)\n`);

  // Update warehouse managers
  console.log('📝 Updating warehouse managers...');

  await Promise.all([
    prisma.warehouse.update({
      where: { id: warehouses[0].id },
      data: { managerId: additionalUsers[0].id }, // Nguyễn Văn Quản
    }),
    prisma.warehouse.update({
      where: { id: warehouses[2].id },
      data: { managerId: additionalUsers[1].id }, // Trần Thị Lan
    }),
  ]);

  console.log('✅ Updated warehouse managers\n');

  // =====================================================
  // 6. ASSIGN ALL PERMISSIONS TO ADMIN
  // =====================================================
  console.log('📝 Assigning permissions to admin role...');

  const rolePermissions = await Promise.all(
    permissions.map((p) =>
      prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: adminRole!.id,
            permissionId: p.id,
          },
        },
        update: {},
        create: {
          roleId: adminRole!.id,
          permissionId: p.id,
          assignedBy: adminUser.id,
        },
      })
    )
  );

  console.log(`✅ Assigned ${rolePermissions.length} permissions to admin role\n`);

  // =====================================================
  // 7. SEED CATEGORIES
  // =====================================================
  console.log('📝 Seeding categories...');

  const categories = await Promise.all([
    prisma.category.upsert({
      where: { categoryCode: 'CAT-001' },
      update: {},
      create: {
        categoryCode: 'CAT-001',
        categoryName: 'Nước giải khát',
        slug: 'nuoc-giai-khat',
        status: 'active',
      },
    }),
    prisma.category.upsert({
      where: { categoryCode: 'CAT-002' },
      update: {},
      create: {
        categoryCode: 'CAT-002',
        categoryName: 'Nguyên liệu',
        slug: 'nguyen-lieu',
        status: 'active',
      },
    }),
    prisma.category.upsert({
      where: { categoryCode: 'CAT-003' },
      update: {},
      create: {
        categoryCode: 'CAT-003',
        categoryName: 'Bao bì',
        slug: 'bao-bi',
        status: 'active',
      },
    }),
  ]);

  console.log(`✅ Created ${categories.length} categories\n`);

  // =====================================================
  // 8. SEED SUPPLIERS
  // =====================================================
  console.log('📝 Seeding suppliers...');

  const suppliers = await Promise.all([
    prisma.supplier.upsert({
      where: { supplierCode: 'NCC-001' },
      update: {},
      create: {
        supplierCode: 'NCC-001',
        supplierName: 'Công ty TNHH Nguyên liệu ABC',
        supplierType: 'local',
        contactName: 'Nguyễn Văn A',
        phone: '0987654321',
        email: 'contact@abc.com',
        address: '123 Đường XYZ, Quận 5, TP.HCM',
        taxCode: '0123456789',
        status: 'active',
        createdBy: adminUser.id,
      },
    }),
    prisma.supplier.upsert({
      where: { supplierCode: 'NCC-002' },
      update: {},
      create: {
        supplierCode: 'NCC-002',
        supplierName: 'Công ty CP Bao bì Việt Nam',
        supplierType: 'local',
        contactName: 'Trần Thị B',
        phone: '0912345678',
        email: 'info@baobivn.com',
        address: '456 Đường DEF, Quận 6, TP.HCM',
        taxCode: '0987654321',
        status: 'active',
        createdBy: adminUser.id,
      },
    }),
  ]);

  console.log(`✅ Created ${suppliers.length} suppliers\n`);

  console.log('✅ Database seed completed successfully! 🎉\n');
  console.log('📌 Login Credentials:\n');
  console.log('👤 Admin:');
  console.log('   Email: nhoangkha03@gmail.com');
  console.log('   Password: admin123\n');
  console.log('👥 Other Users (password: 123456):');
  console.log('   - manager1@company.com (Nguyễn Văn Quản - Warehouse Manager)');
  console.log('   - manager2@company.com (Trần Thị Lan - Warehouse Manager)');
  console.log('   - staff1@company.com (Lê Văn Tài - Warehouse Staff)');
  console.log('   - staff2@company.com (Phạm Thị Hoa - Warehouse Staff)');
  console.log('   - sales@company.com (Hoàng Văn Đạt - Sales Staff)');
  console.log('   - accountant@company.com (Vũ Thị Mai - Accountant)');
  console.log('   - production@company.com (Đỗ Văn Cường - Production Manager)\n');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
