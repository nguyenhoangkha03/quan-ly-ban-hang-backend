# LỘ TRÌNH PHÁT TRIỂN BACKEND - HỆ THỐNG QUẢN LÝ BÁN HÀNG & SẢN XUẤT

## TECH STACK

### Core Technologies
- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Database**: MySQL 8.0+
- **ORM**: Prisma
- **Cache**: Redis
- **Language**: TypeScript

### Additional Technologies
- **Authentication**: JWT (jsonwebtoken) + bcrypt
- **Validation**: Zod / Joi
- **File Upload**: Multer + Sharp (image processing)
- **API Documentation**: Swagger/OpenAPI
- **Logging**: Winston / Pino
- **Error Handling**: Custom middleware
- **Rate Limiting**: express-rate-limit + Redis
- **CORS**: cors middleware
- **Environment**: dotenv
- **Process Manager**: PM2 (production)
- **Email**: Nodemailer
- **Scheduler**: node-cron (cho notifications, reports)
- **Real-time**: Socket.io (cho notifications, inventory updates)

---

## PHASE 1: SETUP & FOUNDATION (Week 1-2)

### 1.1. Project Setup
**Priority: CRITICAL**

**Tasks:**
- [ ] Init Node.js project với TypeScript
  ```bash
  npm init -y
  npm install typescript ts-node @types/node -D
  npx tsc --init
  ```
- [ ] Setup folder structure:
  ```
  backend/
  ├── src/
  │   ├── config/          # Database, Redis, config files
  │   ├── prisma/          # Prisma schema
  │   ├── middlewares/     # Auth, validation, error handling
  │   ├── routes/          # API routes
  │   ├── controllers/     # Business logic
  │   ├── services/        # Database operations
  │   ├── utils/           # Helper functions
  │   ├── types/           # TypeScript types
  │   ├── validators/      # Request validation schemas
  │   └── app.ts           # Express app
  ├── uploads/             # File uploads
  ├── logs/                # Log files
  ├── .env.example
  ├── .gitignore
  └── package.json
  ```
- [ ] Install dependencies:
  ```bash
  # Core
  npm install express prisma @prisma/client redis
  
  # TypeScript types
  npm install -D @types/express @types/node
  
  # Security
  npm install helmet cors express-rate-limit
  npm install jsonwebtoken bcrypt
  npm install -D @types/jsonwebtoken @types/bcrypt
  
  # Validation
  npm install zod
  
  # File handling
  npm install multer sharp
  npm install -D @types/multer
  
  # Utilities
  npm install dotenv morgan winston
  npm install date-fns dayjs
  
  # Documentation
  npm install swagger-ui-express swagger-jsdoc
  npm install -D @types/swagger-ui-express @types/swagger-jsdoc
  
  # Scheduler & Real-time
  npm install node-cron socket.io
  npm install -D @types/node-cron
  
  # Email
  npm install nodemailer
  npm install -D @types/nodemailer
  ```

**Deliverables:**
- Project structure hoàn chỉnh
- TypeScript config
- Environment variables setup (.env.example)

---

### 1.2. Database Setup
**Priority: CRITICAL**

**Tasks:**
- [ ] Chuyển đổi SQL schema sang Prisma schema
- [ ] Config Prisma:
  ```prisma
  generator client {
    provider = "prisma-client-js"
  }
  
  datasource db {
    provider = "mysql"
    url      = env("DATABASE_URL")
  }
  ```
- [ ] Tạo Prisma models cho 36 bảng (theo database_explain.md)
- [ ] Setup migrations:
  ```bash
  npx prisma migrate dev --name init
  npx prisma generate
  ```
- [ ] Tạo seed data (initial data):
  - Roles (admin, kế toán, nhân viên kho, bán hàng...)
  - Permissions (chi tiết theo từng module)
  - Admin user mặc định
  - Sample categories, warehouses

**Deliverables:**
- `prisma/schema.prisma` hoàn chỉnh
- Seed script với dữ liệu mẫu
- Database migrations

---

### 1.3. Redis Setup
**Priority: HIGH**

**Tasks:**
- [ ] Config Redis connection
- [ ] Tạo Redis service wrapper:
  ```typescript
  // src/config/redis.ts
  class RedisService {
    client: RedisClient;
    
    async get(key: string): Promise<any>
    async set(key: string, value: any, ttl?: number): Promise<void>
    async del(key: string): Promise<void>
    async exists(key: string): Promise<boolean>
    async flushPattern(pattern: string): Promise<void>
  }
  ```
- [ ] Define cache strategies:
  - **Session cache**: User sessions (TTL: 24h)
  - **Data cache**: Products, categories (TTL: 1h)
  - **Inventory cache**: Real-time stock (TTL: 5 min)
  - **Rate limiting**: API rate limits (TTL: 1 min)

**Deliverables:**
- Redis connection service
- Cache helper utilities

---

### 1.4. Core Middlewares
**Priority: CRITICAL**

**Tasks:**
- [ ] **Error Handler Middleware**
  ```typescript
  // src/middlewares/errorHandler.ts
  - Global error handling
  - Custom error classes (ValidationError, AuthError, NotFoundError)
  - Error logging
  - Consistent error response format
  ```

- [ ] **Authentication Middleware**
  ```typescript
  // src/middlewares/auth.ts
  - JWT verification
  - Token refresh logic
  - User session management (Redis)
  - Rate limiting per user
  ```

- [ ] **Authorization Middleware**
  ```typescript
  // src/middlewares/authorize.ts
  - Check user permissions
  - Role-based access control (RBAC)
  - Warehouse-based access control
  ```

- [ ] **Validation Middleware**
  ```typescript
  // src/middlewares/validate.ts
  - Request validation using Zod
  - Query, body, params validation
  ```

- [ ] **Logger Middleware**
  ```typescript
  // src/middlewares/logger.ts
  - Request logging (Winston)
  - Activity logs to database
  - Performance monitoring
  ```

- [ ] **Rate Limiter**
  ```typescript
  // src/middlewares/rateLimiter.ts
  - API rate limiting (100 req/15min)
  - Login rate limiting (5 req/15min)
  - Redis-based distributed rate limiting
  ```

**Deliverables:**
- All core middlewares implemented
- Unit tests for middlewares

---

## PHASE 2: AUTHENTICATION & USER MANAGEMENT (Week 3)

### 2.1. Authentication Module
**Priority: CRITICAL**

**Endpoints:**
```
POST   /api/auth/login              - Đăng nhập
POST   /api/auth/logout             - Đăng xuất
POST   /api/auth/refresh-token      - Refresh access token
POST   /api/auth/forgot-password    - Quên mật khẩu
POST   /api/auth/reset-password     - Reset mật khẩu
GET    /api/auth/me                 - Lấy thông tin user hiện tại
PUT    /api/auth/change-password    - Đổi mật khẩu
```

**Features:**
- [ ] Login với email + password
- [ ] JWT token generation (access token: 15min, refresh token: 7 days)
- [ ] Token blacklist (Redis) khi logout
- [ ] Password hashing với bcrypt (salt rounds: 10)
- [ ] Track last_login timestamp
- [ ] Login attempts tracking (max 5 lần, lock 15 phút)
- [ ] Activity log mọi thao tác quan trọng

**Security:**
- [ ] Sanitize input (XSS protection)
- [ ] Rate limiting login endpoint
- [ ] HTTPS only (production)
- [ ] Secure HTTP headers (helmet)

**Deliverables:**
- Authentication service
- Auth routes & controllers
- Tests (unit + integration)

---

### 2.2. User Management
**Priority: HIGH**

**Endpoints:**
```
GET    /api/users                   - Danh sách users (phân trang, filter)
GET    /api/users/:id               - Chi tiết user
POST   /api/users                   - Tạo user mới
PUT    /api/users/:id               - Cập nhật user
DELETE /api/users/:id               - Xóa user (soft delete)
PATCH  /api/users/:id/status        - Lock/unlock user
POST   /api/users/:id/avatar        - Upload avatar
```

**Features:**
- [ ] CRUD operations với validation
- [ ] Phân quyền: chỉ admin mới tạo/sửa/xóa user
- [ ] Filter theo role, warehouse, status
- [ ] Search theo tên, email, employee_code
- [ ] Pagination (limit, offset)
- [ ] Upload và resize avatar (Sharp)
- [ ] Validate: email unique, phone format, employee_code unique

**Deliverables:**
- User service & controllers
- Avatar upload với image processing
- API documentation (Swagger)

---

### 2.3. Role & Permission Management
**Priority: HIGH**

**Endpoints:**
```
GET    /api/roles                   - Danh sách roles
GET    /api/roles/:id/permissions   - Permissions của role
PUT    /api/roles/:id/permissions   - Gán permissions cho role

GET    /api/permissions             - Danh sách permissions
```

**Features:**
- [ ] Lấy danh sách roles với permissions
- [ ] Gán/bỏ permissions cho role (chỉ admin)
- [ ] Cache permissions trong Redis
- [ ] Middleware check permission theo module

**Deliverables:**
- Role & permission service
- RBAC middleware hoàn chỉnh

---

## PHASE 3: WAREHOUSE & INVENTORY MANAGEMENT (Week 4-5)

### 3.1. Warehouse Management
**Priority: HIGH**

**Endpoints:**
```
GET    /api/warehouses              - Danh sách kho
GET    /api/warehouses/:id          - Chi tiết kho
POST   /api/warehouses              - Tạo kho (admin)
PUT    /api/warehouses/:id          - Cập nhật kho
DELETE /api/warehouses/:id          - Xóa kho
```

**Features:**
- [ ] Phân loại 4 loại kho: raw_material, packaging, finished_product, goods
- [ ] Gán manager cho kho
- [ ] Filter theo type, region, status
- [ ] Validate capacity

**Deliverables:**
- Warehouse CRUD
- API tests

---

### 3.2. Category & Supplier Management
**Priority: MEDIUM**

**Endpoints:**
```
GET    /api/categories              - Danh sách categories (tree structure)
POST   /api/categories              - Tạo category
PUT    /api/categories/:id          - Cập nhật category
DELETE /api/categories/:id          - Xóa category

GET    /api/suppliers               - Danh sách NCC
POST   /api/suppliers               - Tạo NCC
PUT    /api/suppliers/:id           - Cập nhật NCC
DELETE /api/suppliers/:id           - Xóa NCC
```

**Features:**
- [ ] Category tree structure (parent-child)
- [ ] Supplier validation (tax_code, email, phone)
- [ ] Filter, search, pagination

**Deliverables:**
- Category & Supplier services
- Nested category handling

---

### 3.3. Product Management
**Priority: CRITICAL**

**Endpoints:**
```
GET    /api/products                - Danh sách sản phẩm
GET    /api/products/:id            - Chi tiết sản phẩm
POST   /api/products                - Tạo sản phẩm
PUT    /api/products/:id            - Cập nhật sản phẩm
DELETE /api/products/:id            - Xóa sản phẩm
POST   /api/products/:id/images     - Upload hình ảnh
DELETE /api/products/:id/images/:imageId - Xóa hình ảnh
GET    /api/products/low-stock      - Sản phẩm tồn kho thấp
GET    /api/products/expiring-soon  - Sản phẩm sắp hết hạn
```

**Features:**
- [ ] Phân loại 4 loại: raw_material, packaging, finished_product, goods
- [ ] Loại bao bì: bottle, box, bag, label, other
- [ ] Multi-image upload (max 5 ảnh)
- [ ] Resize images: thumbnail (200x200), main (800x800)
- [ ] Generate SKU tự động nếu không nhập
- [ ] Generate slug từ product_name
- [ ] Validate: SKU unique, price >= 0
- [ ] Filter theo: type, category, supplier, status
- [ ] Search: name, SKU, barcode
- [ ] Cache hot products (Redis)

**Deliverables:**
- Product CRUD hoàn chỉnh
- Image upload service
- Low stock alert service

---

### 3.4. Inventory Management
**Priority: CRITICAL**

**Endpoints:**
```
GET    /api/inventory                    - Tồn kho tổng thể
GET    /api/inventory/warehouse/:id      - Tồn kho theo kho
GET    /api/inventory/product/:id        - Tồn kho theo sản phẩm
POST   /api/inventory/check              - Kiểm tra tồn kho có đủ không
GET    /api/inventory/alerts             - Cảnh báo tồn kho thấp
```

**Features:**
- [ ] Real-time inventory tracking
- [ ] Cache inventory trong Redis (TTL: 5 min)
- [ ] Tính: available_quantity = quantity - reserved_quantity
- [ ] Alert khi quantity < min_stock_level
- [ ] Aggregate inventory cross warehouses
- [ ] Performance optimization với indexes

**Deliverables:**
- Inventory service
- Redis caching strategy
- Real-time updates (Socket.io)

---

### 3.5. Stock Transactions
**Priority: CRITICAL**

**Endpoints:**
```
GET    /api/stock-transactions           - Danh sách phiếu kho
GET    /api/stock-transactions/:id       - Chi tiết phiếu
POST   /api/stock-transactions/import    - Phiếu nhập kho
POST   /api/stock-transactions/export    - Phiếu xuất kho
POST   /api/stock-transactions/transfer  - Phiếu chuyển kho
POST   /api/stock-transactions/disposal  - Phiếu xuất hủy
POST   /api/stock-transactions/stocktake - Phiếu kiểm kê
PUT    /api/stock-transactions/:id/approve - Phê duyệt phiếu
PUT    /api/stock-transactions/:id/cancel  - Hủy phiếu
```

**Features:**
- [ ] 5 loại giao dịch: import, export, transfer, disposal, stocktake
- [ ] Generate transaction_code tự động (PNK-YYYYMMDD-XXX)
- [ ] Workflow: draft → pending → approved → completed
- [ ] **CRITICAL**: Cập nhật inventory khi approved:
  - Import: tăng quantity
  - Export: giảm quantity
  - Transfer: giảm kho nguồn, tăng kho đích
  - Disposal: giảm quantity
  - Stocktake: điều chỉnh quantity
- [ ] Transaction validation:
  - Kiểm tra tồn kho đủ không (export, transfer)
  - Validate warehouse permissions
  - Validate batch numbers, expiry dates
- [ ] Batch tracking (số lô, hạn sử dụng)
- [ ] Transaction locking (Prisma transaction)
- [ ] Activity log mọi thao tác
- [ ] Reference linking (purchase_order_id, sales_order_id, production_order_id)

**Deliverables:**
- Stock transaction service (complex logic)
- Inventory update triggers
- Transaction history tracking
- Tests cho concurrency

---

### 3.6. Stock Transfer
**Priority: MEDIUM**

**Endpoints:**
```
GET    /api/stock-transfers              - Danh sách phiếu chuyển kho
POST   /api/stock-transfers              - Tạo phiếu chuyển kho
PUT    /api/stock-transfers/:id/approve  - Phê duyệt
PUT    /api/stock-transfers/:id/complete - Hoàn thành chuyển kho
PUT    /api/stock-transfers/:id/cancel   - Hủy phiếu
```

**Features:**
- [ ] Workflow: pending → in_transit → completed
- [ ] Validate: from_warehouse != to_warehouse
- [ ] Kiểm tra tồn kho kho nguồn
- [ ] Cập nhật inventory khi completed
- [ ] Notification cho người quản lý 2 kho

**Deliverables:**
- Transfer service
- Notification integration

---

## PHASE 4: PRODUCTION MANAGEMENT (Week 6)

### 4.1. BOM (Bill of Materials)
**Priority: HIGH**

**Endpoints:**
```
GET    /api/bom                     - Danh sách công thức
GET    /api/bom/:id                 - Chi tiết công thức
POST   /api/bom                     - Tạo công thức
PUT    /api/bom/:id                 - Cập nhật công thức
DELETE /api/bom/:id                 - Xóa công thức
PUT    /api/bom/:id/approve         - Phê duyệt công thức
GET    /api/bom/:id/calculate       - Tính toán định mức cho số lượng sản xuất
```

**Features:**
- [ ] Tạo công thức với materials list (nguyên liệu + bao bì)
- [ ] Phân loại: raw_material, packaging
- [ ] Version control (1.0, 1.1, 2.0...)
- [ ] Calculate material requirements:
  ```typescript
  // Input: bom_id, production_quantity
  // Output: { material_id, quantity_needed }[]
  ```
- [ ] Validate: finished_product phải là type finished_product
- [ ] Validate: materials phải là raw_material hoặc packaging
- [ ] Efficiency rate (95-100%)
- [ ] Production time estimate

**Deliverables:**
- BOM service
- Material calculation algorithm
- Version management

---

### 4.2. Production Orders
**Priority: HIGH**

**Endpoints:**
```
GET    /api/production-orders           - Danh sách lệnh sản xuất
GET    /api/production-orders/:id       - Chi tiết lệnh
POST   /api/production-orders           - Tạo lệnh sản xuất
PUT    /api/production-orders/:id       - Cập nhật lệnh
PUT    /api/production-orders/:id/start - Bắt đầu sản xuất
PUT    /api/production-orders/:id/complete - Hoàn thành sản xuất
PUT    /api/production-orders/:id/cancel   - Hủy lệnh
GET    /api/production-orders/:id/wastage  - Báo cáo hao hụt
```

**Features:**
- [ ] Workflow: pending → in_progress → completed
- [ ] Khi tạo lệnh:
  - Tính toán material requirements từ BOM
  - **Kiểm tra tồn kho**: Cảnh báo nếu thiếu nguyên liệu/bao bì
  - Tạo planned_materials list
- [ ] Khi start (in_progress):
  - **Xuất kho nguyên liệu & bao bì** (tạo stock_transaction type: export)
  - Reserve materials trong inventory
  - Ghi nhận actual_quantity xuất
- [ ] Khi complete:
  - **Nhập kho thành phẩm** (tạo stock_transaction type: import)
  - Cập nhật actual_quantity sản xuất được
  - **Tính hao hụt**: wastage = actual_quantity - planned_quantity
  - Ghi nhận production_cost
  - Release reserved materials
- [ ] Wastage tracking & reporting
- [ ] Production cost calculation
- [ ] Link với stock_transactions

**Deliverables:**
- Production order service (complex workflow)
- Material shortage alerts
- Wastage analysis
- Integration tests

---

## PHASE 5: CUSTOMER & SALES MANAGEMENT (Week 7-8)

### 5.1. Customer Management
**Priority: HIGH**

**Endpoints:**
```
GET    /api/customers                   - Danh sách khách hàng
GET    /api/customers/:id               - Chi tiết khách hàng
POST   /api/customers                   - Tạo khách hàng
PUT    /api/customers/:id               - Cập nhật khách hàng
DELETE /api/customers/:id               - Xóa khách hàng
GET    /api/customers/:id/orders        - Lịch sử đơn hàng
GET    /api/customers/:id/debt          - Công nợ hiện tại
PUT    /api/customers/:id/credit-limit  - Cập nhật hạn mức công nợ
GET    /api/customers/overdue-debt      - Khách hàng nợ quá hạn
```

**Features:**
- [ ] Customer types: individual, company
- [ ] Classification: retail, wholesale, vip, distributor
- [ ] Debt tracking: current_debt, credit_limit
- [ ] Cảnh báo khi current_debt > 80% credit_limit
- [ ] **Chặn bán hàng** khi current_debt > credit_limit (trừ khi admin override)
- [ ] Search: name, phone, email, tax_code
- [ ] Filter: type, classification, province, status
- [ ] Cache customer data (Redis)

**Deliverables:**
- Customer CRUD
- Debt management service
- Credit limit enforcement

---

### 5.2. Sales Orders
**Priority: CRITICAL**

**Endpoints:**
```
GET    /api/sales-orders                - Danh sách đơn hàng
GET    /api/sales-orders/:id            - Chi tiết đơn hàng
POST   /api/sales-orders                - Tạo đơn hàng
PUT    /api/sales-orders/:id            - Cập nhật đơn hàng
PUT    /api/sales-orders/:id/approve    - Phê duyệt đơn
PUT    /api/sales-orders/:id/complete   - Hoàn thành đơn
PUT    /api/sales-orders/:id/cancel     - Hủy đơn
POST   /api/sales-orders/:id/payment    - Ghi nhận thanh toán
GET    /api/sales-orders/revenue        - Doanh thu theo thời gian
```

**Features:**
- [ ] Workflow: pending → preparing → delivering → completed
- [ ] Khi tạo đơn:
  - **Validate customer credit**: current_debt + order_amount <= credit_limit
  - **Validate inventory**: Kiểm tra tồn kho các sản phẩm
  - **Reserve inventory**: Tăng reserved_quantity
  - Apply promotions tự động
  - Calculate: total_amount, discount, tax, shipping_fee, final_amount
- [ ] Khi approve:
  - **Xuất kho thành phẩm** (stock_transaction type: export)
  - Giảm available_quantity
  - Release reserved_quantity
- [ ] Khi complete:
  - Cập nhật customer debt nếu payment_method = credit
  - Ghi nhận payment nếu cash/transfer
  - Update sales_channel statistics
- [ ] Khi cancel:
  - Release reserved_quantity
  - Rollback inventory
  - Activity log
- [ ] Payment tracking:
  - paid_amount, debt_amount (auto-calculated)
  - Payment status: unpaid, partial, paid
  - Multiple payments support
- [ ] Generate order_code: DH-YYYYMMDD-XXX
- [ ] Sales channels: retail, wholesale, online, distributor
- [ ] Price tiers: retail, wholesale, vip (based on customer classification)

**Complex Logic:**
```typescript
// Tính giá bán theo phân loại khách hàng
const getProductPrice = (product, customer) => {
  switch(customer.classification) {
    case 'retail': return product.selling_price_retail;
    case 'wholesale': return product.selling_price_wholesale;
    case 'vip': return product.selling_price_vip;
    case 'distributor': return product.selling_price_wholesale * 0.95;
  }
}

// Tính tổng đơn hàng
final_amount = total_amount - discount_amount + tax_amount + shipping_fee;
debt_amount = final_amount - paid_amount;
```

**Deliverables:**
- Sales order service (most complex module)
- Inventory reservation system
- Payment tracking
- Revenue analytics
- Comprehensive tests

---

### 5.3. Deliveries
**Priority: MEDIUM**

**Endpoints:**
```
GET    /api/deliveries                  - Danh sách giao hàng
GET    /api/deliveries/:id              - Chi tiết
POST   /api/deliveries                  - Tạo phiếu giao hàng
PUT    /api/deliveries/:id/status       - Cập nhật trạng thái
POST   /api/deliveries/:id/proof        - Upload ảnh chứng minh
PUT    /api/deliveries/:id/collect      - Ghi nhận thu tiền COD
```

**Features:**
- [ ] Link với sales_order
- [ ] Workflow: pending → in_transit → delivered / failed
- [ ] COD tracking: cod_amount, collected_amount
- [ ] Upload delivery proof (ảnh)
- [ ] Failure reason logging
- [ ] Assign delivery staff
- [ ] Notification cho khách hàng
- [ ] Settlement với delivery staff

**Deliverables:**
- Delivery service
- COD management
- Status tracking

---

## PHASE 6: FINANCIAL MANAGEMENT (Week 9)

### 6.1. Payment Receipts (Phiếu thu)
**Priority: HIGH**

**Endpoints:**
```
GET    /api/payment-receipts            - Danh sách phiếu thu
POST   /api/payment-receipts            - Tạo phiếu thu
PUT    /api/payment-receipts/:id/approve - Phê duyệt
DELETE /api/payment-receipts/:id        - Hủy phiếu
```

**Features:**
- [ ] Receipt types: sales, debt_collection, refund, other
- [ ] Payment methods: cash, transfer, card
- [ ] Link với sales_order (nếu có)
- [ ] **Cập nhật customer debt** khi approved:
  ```typescript
  customer.current_debt -= receipt.amount;
  sales_order.paid_amount += receipt.amount;
  ```
- [ ] Generate receipt_code: PT-YYYYMMDD-XXX
- [ ] Post to cash_fund (nếu payment_method = cash)
- [ ] Activity log
- [ ] Print receipt PDF

**Deliverables:**
- Payment receipt service
- Debt update automation
- PDF generation

---

### 6.2. Payment Vouchers (Phiếu chi)
**Priority: HIGH**

**Endpoints:**
```
GET    /api/payment-vouchers            - Danh sách phiếu chi
POST   /api/payment-vouchers            - Tạo phiếu chi
PUT    /api/payment-vouchers/:id/approve - Phê duyệt
```

**Features:**
- [ ] Voucher types: salary, operating_cost, supplier_payment, refund, other
- [ ] Link với supplier (nếu payment supplier)
- [ ] Link với salary (nếu trả lương)
- [ ] **Cập nhật cash_fund** khi approved
- [ ] Generate voucher_code: PC-YYYYMMDD-XXX
- [ ] Expense account tracking (kế toán)

**Deliverables:**
- Payment voucher service
- Expense tracking

---

### 6.3. Debt Reconciliation (Đối chiếu công nợ)
**Priority: MEDIUM**

**Endpoints:**
```
GET    /api/debt-reconciliation         - Danh sách biên bản
POST   /api/debt-reconciliation/monthly - Tạo đối chiếu tháng
POST   /api/debt-reconciliation/quarterly - Tạo đối chiếu quý
POST   /api/debt-reconciliation/yearly  - Tạo đối chiếu năm
PUT    /api/debt-reconciliation/:id/confirm - Xác nhận
GET    /api/debt-reconciliation/:id/pdf - Export PDF
POST   /api/debt-reconciliation/:id/send-email - Gửi email
```

**Features:**
- [ ] Auto-calculate:
  ```typescript
  closing_balance = opening_balance + transactions_amount - payment_amount;
  discrepancy_amount = system_balance - confirmed_balance;
  ```
- [ ] Types: monthly, quarterly, yearly
- [ ] Generate reconciliation_code: DCCT-YYYYMM
- [ ] Email to customer/supplier for confirmation
- [ ] Track confirmation status
- [ ] Export to PDF
- [ ] Discrepancy handling

**Deliverables:**
- Debt reconciliation service
- Auto-calculation logic
- Email notification
- PDF export

---

### 6.4. Cash Fund Management
**Priority: MEDIUM**

**Endpoints:**
```
GET    /api/cash-fund                   - Quỹ tiền mặt hàng ngày
GET    /api/cash-fund/:date             - Quỹ tiền theo ngày
PUT    /api/cash-fund/:date/lock        - Khóa sổ ngày
```

**Features:**
- [ ] Daily cash fund tracking
- [ ] Auto-calculate:
  ```typescript
  closing_balance = opening_balance + total_receipts - total_payments;
  ```
- [ ] Lock fund after reconciliation
- [ ] Link với payment_receipts & payment_vouchers
- [ ] Alert on discrepancies

**Deliverables:**
- Cash fund service
- Daily reconciliation

---

## PHASE 7: PROMOTION MANAGEMENT (Week 10)

### 7.1. Promotions
**Priority: MEDIUM**

**Endpoints:**
```
GET    /api/promotions                  - Danh sách khuyến mãi
POST   /api/promotions                  - Tạo chương trình KM
PUT    /api/promotions/:id              - Cập nhật KM
PUT    /api/promotions/:id/approve      - Phê duyệt KM
DELETE /api/promotions/:id              - Hủy KM
GET    /api/promotions/active           - KM đang chạy
POST   /api/promotions/:id/apply        - Áp dụng KM cho đơn hàng
```

**Features:**
- [ ] 4 promotion types:
  1. **percent_discount**: Giảm % (có max_discount_value)
  2. **fixed_discount**: Giảm cố định
  3. **buy_x_get_y**: Mua X tặng Y
  4. **gift**: Tặng quà
- [ ] Conditions (JSON):
  ```json
  {
    "min_order_value": 1000000,
    "applicable_categories": [1, 2],
    "applicable_customer_types": ["vip"],
    "days_of_week": [6, 7],
    "time_slots": ["18:00-22:00"]
  }
  ```
- [ ] Apply promotion logic:
  ```typescript
  const applyPromotion = (order, promotion) => {
    // Check conditions
    // Calculate discount
    // Track usage_count
    // Check quantity_limit
  }
  ```
- [ ] Promotion stacking rules
- [ ] Auto-activate/expire based on dates
- [ ] Usage tracking

**Deliverables:**
- Promotion service
- Complex condition checking
- Discount calculation logic
- Integration với sales orders

---

## PHASE 8: HR MANAGEMENT (Week 11)

### 8.1. Attendance
**Priority: MEDIUM**

**Endpoints:**
```
GET    /api/attendance                  - Danh sách chấm công
POST   /api/attendance/check-in         - Chấm công vào
POST   /api/attendance/check-out        - Chấm công ra
PUT    /api/attendance/:id              - Cập nhật (admin)
GET    /api/attendance/my               - Chấm công của tôi
GET    /api/attendance/report           - Báo cáo chấm công tháng
```

**Features:**
- [ ] Check-in/check-out với timestamp
- [ ] Auto-calculate work_hours
- [ ] Overtime tracking
- [ ] Leave management (annual, sick, unpaid)
- [ ] Status: present, absent, late, leave, work_from_home
- [ ] GPS location tracking (check_in_location)
- [ ] Late detection (> 8:30 AM)
- [ ] Approval workflow for leaves

**Deliverables:**
- Attendance service
- Work hours calculation
- Leave approval

---

### 8.2. Salary
**Priority: MEDIUM**

**Endpoints:**
```
GET    /api/salary                      - Danh sách bảng lương
GET    /api/salary/:userId/:month       - Bảng lương user theo tháng
POST   /api/salary/calculate            - Tính lương tháng
PUT    /api/salary/:id/approve          - Phê duyệt bảng lương
POST   /api/salary/:id/pay              - Trả lương (tạo payment_voucher)
```

**Features:**
- [ ] Auto-calculate salary:
  ```typescript
  // Overtime pay
  overtime_pay = (basic_salary / 208) * overtime_hours * 1.5;
  
  // Commission (5% doanh số)
  commission = user_sales_revenue * 0.05;
  
  // Deductions (BHXH, BHYT, thuế)
  deduction = basic_salary * 0.105 + tax;
  
  // Total
  total_salary = basic_salary + allowance + overtime_pay + bonus 
                 + commission - deduction - advance;
  ```
- [ ] Salary components:
  - basic_salary
  - allowance (phụ cấp)
  - overtime_pay (từ attendance)
  - bonus (thưởng KPI)
  - commission (hoa hồng bán hàng)
  - deduction (BHXH, thuế)
  - advance (tạm ứng)
- [ ] Link với payment_voucher khi trả lương
- [ ] Salary slip PDF

**Deliverables:**
- Salary calculation service
- Complex formula implementation
- Integration với attendance & sales

---

## PHASE 9: NOTIFICATION & REPORTING (Week 12)

### 9.1. Notification System
**Priority: HIGH**

**Endpoints:**
```
GET    /api/notifications               - Danh sách thông báo
GET    /api/notifications/unread        - Thông báo chưa đọc
PUT    /api/notifications/:id/read      - Đánh dấu đã đọc
DELETE /api/notifications/:id           - Xóa thông báo
```

**Features:**
- [ ] 8 notification types:
  1. **system**: Thông báo hệ thống
  2. **low_stock**: Cảnh báo tồn kho thấp
  3. **expiry_warning**: Sản phẩm sắp hết hạn
  4. **debt_overdue**: Công nợ quá hạn
  5. **order_new**: Đơn hàng mới
  6. **approval_required**: Cần phê duyệt
  7. **reminder**: Nhắc nhở
  8. **announcement**: Thông báo chung
- [ ] Multi-channel: web, email, sms, mobile_app
- [ ] Priority: low, normal, high
- [ ] Real-time push (Socket.io)
- [ ] Email notifications (Nodemailer)
- [ ] Auto-notifications:
  - Low stock (daily check)
  - Expiring products (7 days before)
  - Debt overdue (daily check)
  - Approval pending (instant)

**Scheduled Jobs (node-cron):**
```typescript
// Every day at 8:00 AM
cron.schedule('0 8 * * *', async () => {
  await checkLowStock();
  await checkExpiringProducts();
  await checkOverdueDebts();
});
```

**Deliverables:**
- Notification service
- Socket.io real-time
- Email service
- Cron jobs
- Push notification queue

---

### 9.2. Reporting & Analytics
**Priority: HIGH**

**Endpoints:**
```
GET    /api/reports/dashboard           - Dashboard tổng quan
GET    /api/reports/revenue             - Báo cáo doanh thu
GET    /api/reports/inventory           - Báo cáo tồn kho
GET    /api/reports/sales-by-product    - Top sản phẩm bán chạy
GET    /api/reports/sales-by-customer   - Top khách hàng
GET    /api/reports/production          - Báo cáo sản xuất
GET    /api/reports/financial           - Báo cáo tài chính
GET    /api/reports/employee-performance - Hiệu suất nhân viên
GET    /api/reports/export/:type        - Export Excel/PDF
```

**Dashboard Metrics:**
- [ ] **Doanh thu**:
  - Hôm nay, tuần này, tháng này, năm nay
  - So sánh cùng kỳ
  - Biểu đồ doanh thu theo ngày/tuần/tháng
- [ ] **Đơn hàng**:
  - Tổng đơn, đơn mới, đang xử lý, hoàn thành
  - Conversion rate
- [ ] **Tồn kho**:
  - Tổng giá trị tồn kho
  - Sản phẩm tồn kho thấp
  - Sản phẩm sắp hết hạn
- [ ] **Công nợ**:
  - Tổng công nợ phải thu
  - Công nợ quá hạn
  - Top khách hàng nợ nhiều
- [ ] **Sản xuất**:
  - Lệnh đang sản xuất
  - Tỷ lệ hao hụt
  - Sản lượng tuần/tháng

**Revenue Analytics:**
- [ ] Doanh thu theo kênh bán (retail, wholesale, online)
- [ ] Doanh thu theo region
- [ ] Doanh thu theo sản phẩm/danh mục
- [ ] Lợi nhuận = Revenue - Cost

**Inventory Analytics:**
- [ ] Tồn kho theo loại (nguyên liệu, bao bì, thành phẩm, hàng hóa)
- [ ] Tồn kho theo kho
- [ ] Inventory turnover rate
- [ ] Slow-moving products

**Export Features:**
- [ ] Export to Excel (xlsx)
- [ ] Export to PDF
- [ ] Schedule reports (daily/weekly/monthly email)

**Deliverables:**
- Dashboard API
- Complex analytics queries
- Data aggregation (Redis caching)
- Export services (Excel, PDF)
- Scheduled reports

---

## PHASE 10: API DOCUMENTATION & TESTING (Week 13)

### 10.1. API Documentation
**Priority: HIGH**

**Tasks:**
- [ ] Setup Swagger/OpenAPI:
  ```typescript
  // src/config/swagger.ts
  import swaggerJsdoc from 'swagger-jsdoc';
  import swaggerUi from 'swagger-ui-express';
  
  const options = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'Sales & Production API',
        version: '1.0.0',
      },
      servers: [
        { url: 'http://localhost:3000/api' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
    apis: ['./src/routes/*.ts'],
  };
  ```
- [ ] Document all endpoints với JSDoc comments:
  ```typescript
  /**
   * @swagger
   * /api/products:
   *   get:
   *     summary: Get all products
   *     tags: [Products]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Success
   */
  ```
- [ ] Provide request/response examples
- [ ] Authentication guide
- [ ] Error code reference

**Deliverables:**
- Swagger UI at `/api-docs`
- Complete API documentation
- Postman collection

---

### 10.2. Testing
**Priority: HIGH**

**Testing Strategy:**

1. **Unit Tests** (70% coverage target)
   ```bash
   npm install -D jest ts-jest @types/jest
   npm install -D supertest @types/supertest
   ```
   - Services logic
   - Utilities
   - Validators
   - Middleware

2. **Integration Tests** (critical flows)
   - Authentication flow
   - Sales order creation flow
   - Production order flow
   - Inventory update flow
   - Payment flow

3. **E2E Tests** (main user scenarios)
   - Admin creates product → appears in inventory
   - User creates sales order → inventory decreases → payment recorded
   - Production order → materials exported → finished product imported

**Test Files Structure:**
```
src/
├── __tests__/
│   ├── unit/
│   │   ├── services/
│   │   ├── utils/
│   │   └── validators/
│   ├── integration/
│   │   ├── auth.test.ts
│   │   ├── sales.test.ts
│   │   └── production.test.ts
│   └── e2e/
│       └── flows.test.ts
```

**Tasks:**
- [ ] Setup Jest configuration
- [ ] Write unit tests for all services
- [ ] Write integration tests for API endpoints
- [ ] Write E2E tests for critical flows
- [ ] Setup CI/CD pipeline (GitHub Actions)
- [ ] Code coverage report (aim for 70%+)

**Deliverables:**
- Comprehensive test suite
- CI/CD pipeline
- Coverage reports

---

## PHASE 11: PERFORMANCE OPTIMIZATION & SECURITY (Week 14)

### 11.1. Performance Optimization

**Database Optimization:**
- [ ] Add missing indexes:
  ```sql
  -- Frequently queried fields
  CREATE INDEX idx_sales_orders_customer_date ON sales_orders(customer_id, order_date);
  CREATE INDEX idx_inventory_warehouse_product ON inventory(warehouse_id, product_id);
  ```
- [ ] Optimize slow queries (EXPLAIN ANALYZE)
- [ ] Pagination for all list endpoints
- [ ] Database query profiling

**Caching Strategy:**
- [ ] **Hot data** (Redis, TTL: 1h):
  - Products list
  - Categories tree
  - Promotions active
  - User permissions
- [ ] **Real-time data** (Redis, TTL: 5min):
  - Inventory availability
  - Dashboard metrics
- [ ] Cache invalidation strategies:
  - On create/update/delete
  - Pattern-based flush
  - TTL expiration

**API Performance:**
- [ ] Response compression (gzip)
- [ ] API response pagination
- [ ] Field selection (?fields=id,name)
- [ ] Lazy loading relationships
- [ ] Request batching
- [ ] Connection pooling (Prisma)

**Monitoring:**
- [ ] Setup APM (New Relic / DataDog)
- [ ] Log slow queries (> 1s)
- [ ] Monitor Redis hit rate
- [ ] Track API response times
- [ ] Memory leak detection

**Deliverables:**
- Optimized database schema
- Comprehensive caching
- Performance benchmarks
- Monitoring dashboard

---

### 11.2. Security Hardening

**Authentication & Authorization:**
- [ ] Implement refresh token rotation
- [ ] Add 2FA (optional, for admin)
- [ ] Brute-force protection (rate limiting)
- [ ] Session management (Redis)
- [ ] Password policy enforcement
  - Min 8 chars
  - Upper + lower + number + special
  - Password history (no reuse last 3)

**Input Validation:**
- [ ] Strict Zod schemas for all endpoints
- [ ] SQL injection prevention (Prisma handles)
- [ ] XSS prevention (sanitize HTML)
- [ ] CSRF protection (csurf middleware)
- [ ] File upload validation:
  - File type whitelist (images only)
  - File size limit (5MB)
  - Scan for malware (ClamAV)

**Data Protection:**
- [ ] Sensitive data encryption (crypto)
  - Encrypt tax_code, bank info
- [ ] Password hashing (bcrypt, rounds: 10)
- [ ] HTTPS only (production)
- [ ] Secure cookies (httpOnly, secure, sameSite)
- [ ] Environment secrets (.env not in git)

**API Security:**
- [ ] Rate limiting:
  - Global: 100 req/15min per IP
  - Login: 5 req/15min per IP
  - Per user: 1000 req/hour
- [ ] CORS configuration (whitelist origins)
- [ ] Security headers (helmet):
  - X-Frame-Options: DENY
  - X-Content-Type-Options: nosniff
  - Strict-Transport-Security
- [ ] API key rotation
- [ ] Audit logs (activity_logs table)

**Dependency Security:**
- [ ] Regular `npm audit` checks
- [ ] Automated security updates (Dependabot)
- [ ] License compliance check

**Deliverables:**
- Security audit report
- Penetration testing
- Security documentation
- Compliance checklist

---

## PHASE 12: DEPLOYMENT & DEVOPS (Week 15)

### 12.1. Docker Setup

**Dockerfile:**
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=mysql://user:pass@db:3306/dbname
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
    restart: unless-stopped

  db:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=rootpass
      - MYSQL_DATABASE=sales_production_system
    volumes:
      - db_data:/var/lib/mysql
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app

volumes:
  db_data:
  redis_data:
```

**Tasks:**
- [ ] Create Dockerfile
- [ ] Setup docker-compose
- [ ] Configure Nginx (reverse proxy, SSL, load balancing)
- [ ] Multi-stage builds (optimization)

---

### 12.2. CI/CD Pipeline

**GitHub Actions:**
```yaml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to server
        run: |
          # SSH deploy script
          # Docker pull & restart
```

**Tasks:**
- [ ] Setup GitHub Actions
- [ ] Automated testing on PR
- [ ] Auto-deploy to staging (develop branch)
- [ ] Manual deploy to production (main branch)
- [ ] Rollback strategy

---

### 12.3. Production Setup

**Server Requirements:**
- CPU: 4 cores
- RAM: 8GB
- Storage: 100GB SSD
- OS: Ubuntu 22.04 LTS

**Deployment Checklist:**
- [ ] Setup VPS/Cloud (AWS EC2, DigitalOcean, etc.)
- [ ] Install Docker & Docker Compose
- [ ] Configure firewall (ufw):
  - Allow 22 (SSH)
  - Allow 80 (HTTP)
  - Allow 443 (HTTPS)
  - Deny all other
- [ ] Setup SSL certificates (Let's Encrypt)
- [ ] Configure Nginx reverse proxy
- [ ] Setup database backups:
  - Daily automated backup
  - Retention: 30 days
  - Off-site storage (S3)
- [ ] Setup monitoring:
  - Uptime monitoring (UptimeRobot)
  - Error tracking (Sentry)
  - Logs aggregation (ELK Stack)
- [ ] Setup PM2 (process manager)
- [ ] Configure log rotation
- [ ] Setup Redis persistence (AOF + RDB)

**Environment Variables:**
```env
NODE_ENV=production
PORT=3000

DATABASE_URL=mysql://user:pass@localhost:3306/dbname
REDIS_URL=redis://localhost:6379

JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

BCRYPT_ROUNDS=10

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-password

AWS_S3_BUCKET=your-bucket
AWS_ACCESS_KEY=your-key
AWS_SECRET_KEY=your-secret

SENTRY_DSN=your-sentry-dsn
```

**Deliverables:**
- Production server setup
- SSL certificates
- Automated backups
- Monitoring alerts
- Deployment documentation

---

## PHASE 13: ADVANCED FEATURES (Optional - Week 16+)

### 13.1. Advanced Analytics
- [ ] Business Intelligence dashboard
- [ ] Predictive analytics (sales forecasting)
- [ ] Inventory optimization recommendations
- [ ] Customer segmentation (RFM analysis)
- [ ] ABC analysis for inventory
- [ ] Seasonal trend analysis

### 13.2. Advanced Integrations
- [ ] SMS gateway integration (for notifications)
- [ ] Payment gateway (VNPay, MoMo, ZaloPay)
- [ ] Shipping API (GHN, Giao Hàng Nhanh)
- [ ] Accounting software integration (MISA, Fast)
- [ ] E-invoice API (HÓA ĐƠN ĐIỆN TỬ)

### 13.3. Mobile App API
- [ ] Optimize APIs for mobile
- [ ] Push notification service (FCM)
- [ ] Offline sync support
- [ ] QR code scanning API (cho chấm công, kiểm kê)

### 13.4. Advanced Warehouse Features
- [ ] Barcode/QR code generation
- [ ] Warehouse heat map (most/least accessed areas)
- [ ] Picking optimization (shortest path)
- [ ] Batch picking support
- [ ] Cycle counting automation

---

## DEVELOPMENT BEST PRACTICES

### Code Quality
- [ ] Use ESLint + Prettier
- [ ] Follow Airbnb style guide
- [ ] TypeScript strict mode
- [ ] Code reviews (PR process)
- [ ] Conventional commits

### Git Workflow
- [ ] Main branch (production)
- [ ] Develop branch (staging)
- [ ] Feature branches (feature/xxx)
- [ ] Hotfix branches (hotfix/xxx)
- [ ] Semantic versioning (v1.0.0)

### Documentation
- [ ] README.md with setup instructions
- [ ] API documentation (Swagger)
- [ ] Architecture diagram
- [ ] Database schema diagram
- [ ] Deployment guide
- [ ] Contributing guidelines

### Error Handling
```typescript
// Consistent error response
{
  success: false,
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Invalid input data',
    details: [...],
    timestamp: '2024-01-01T00:00:00Z'
  }
}
```

### API Response Format
```typescript
// Success response
{
  success: true,
  data: {...},
  meta: {
    page: 1,
    limit: 20,
    total: 100
  },
  timestamp: '2024-01-01T00:00:00Z'
}
```

---

## ESTIMATED TIMELINE

| Phase | Duration | Priority | Dependencies |
|-------|----------|----------|--------------|
| 1. Setup & Foundation | 2 weeks | CRITICAL | - |
| 2. Auth & User | 1 week | CRITICAL | Phase 1 |
| 3. Warehouse & Inventory | 2 weeks | CRITICAL | Phase 2 |
| 4. Production | 1 week | HIGH | Phase 3 |
| 5. Customer & Sales | 2 weeks | CRITICAL | Phase 3 |
| 6. Financial | 1 week | HIGH | Phase 5 |
| 7. Promotion | 1 week | MEDIUM | Phase 5 |
| 8. HR | 1 week | MEDIUM | Phase 2 |
| 9. Notification & Reporting | 1 week | HIGH | All phases |
| 10. Documentation & Testing | 1 week | HIGH | All phases |
| 11. Performance & Security | 1 week | HIGH | All phases |
| 12. Deployment | 1 week | HIGH | All phases |
| **TOTAL** | **15 weeks** | | |

---

## SUCCESS METRICS

### Technical Metrics
- [ ] API response time < 200ms (95th percentile)
- [ ] Test coverage > 70%
- [ ] Zero critical security vulnerabilities
- [ ] Database query time < 100ms
- [ ] Redis cache hit rate > 80%
- [ ] API uptime > 99.9%

### Business Metrics
- [ ] All 36 database tables implemented
- [ ] 150+ API endpoints
- [ ] Support 4 loại kho
- [ ] Support 4 loại khuyến mãi
- [ ] Support 8 loại thông báo
- [ ] Real-time inventory updates
- [ ] Automated debt reconciliation
- [ ] Complete audit trail

---

## RESOURCES

### Learning Resources
- Prisma Docs: https://www.prisma.io/docs
- Express Best Practices: https://expressjs.com/en/advanced/best-practice-performance.html
- Node.js Production Guide: https://nodejs.org/en/docs/guides/

### Tools
- Database Design: dbdiagram.io
- API Testing: Postman, Insomnia
- Load Testing: Artillery, k6
- Monitoring: New Relic, DataDog, Sentry

### Community
- Stack Overflow
- Node.js Discord
- Prisma Discord

---

## NOTES

### Critical Implementation Points

1. **Inventory Management**
   - ALWAYS use database transactions
   - Lock rows during updates (SELECT ... FOR UPDATE)
   - Handle concurrency carefully

2. **Sales Orders**
   - Validate credit limit before order creation
   - Reserve inventory immediately
   - Use transactions for multi-step operations

3. **Production Orders**
   - Always check material availability
   - Link stock transactions properly
   - Calculate wastage accurately

4. **Debt Management**
   - Update customer debt atomically
   - Use decimal types for currency (avoid float)
   - Reconciliation must balance

5. **Security**
   - Never trust client input
   - Always validate and sanitize
   - Log sensitive operations
   - Encrypt sensitive data

### Common Pitfalls to Avoid

- ❌ Not using database transactions for multi-step operations
- ❌ Forgetting to update inventory when order status changes
- ❌ Not handling concurrent requests (race conditions)
- ❌ Poor error messages (be specific)
- ❌ Missing validation (trust but verify)
- ❌ Not caching frequently accessed data
- ❌ Exposing sensitive data in API responses
- ❌ Not logging important operations
- ❌ Hardcoding configurations
- ❌ Ignoring performance optimization

---

## CONCLUSION

Đây là một dự án phức tạp với nhiều module liên kết chặt chẽ. Hãy:

1. **Follow roadmap từng bước** - Không skip phases
2. **Test thoroughly** - Đặc biệt là inventory & sales flows
3. **Document everything** - Code, APIs, deployment
4. **Security first** - Không compromise về security
5. **Think scalability** - Design for growth từ đầu

**Good luck! 🚀**
