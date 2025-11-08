# 🎯 PHASE 2: AUTHENTICATION & USER MANAGEMENT - CHECKLIST

**Start Date**: 2025-01-08  
**Duration**: Week 3 (7 days)  
**Priority**: CRITICAL  
**Status**: 🟡 READY TO START

---

## 📊 OVERVIEW

Phase 2 tập trung vào xây dựng module Authentication & User Management - nền tảng cho toàn bộ hệ thống.

**Modules:**
1. Authentication Module (Login, JWT, Sessions)
2. User Management (CRUD, Avatar)
3. Role & Permission Management (RBAC)

---

## 🎯 PHASE 2.1: AUTHENTICATION MODULE

**Priority**: CRITICAL  
**Estimated Time**: 2-3 days

### Endpoints to Implement

```typescript
POST   /api/auth/login              - Đăng nhập
POST   /api/auth/logout             - Đăng xuất
POST   /api/auth/refresh-token      - Refresh access token
POST   /api/auth/forgot-password    - Quên mật khẩu
POST   /api/auth/reset-password     - Reset mật khẩu
GET    /api/auth/me                 - Lấy thông tin user hiện tại
PUT    /api/auth/change-password    - Đổi mật khẩu
```

### Tasks

#### JWT Helper Utilities
- [ ] Create `src/utils/jwt.ts`
  - [ ] Function `generateAccessToken(payload)`
  - [ ] Function `generateRefreshToken(payload)`
  - [ ] Function `verifyToken(token)`
  - [ ] Function `decodeToken(token)`
  - [ ] Token blacklist helpers

**Files to create:**
```typescript
// src/utils/jwt.ts
export const generateAccessToken = (payload: JwtPayload): string
export const generateRefreshToken = (payload: JwtPayload): string
export const verifyToken = (token: string): JwtPayload
export const decodeToken = (token: string): JwtPayload | null
```

#### Password Helpers
- [ ] Create `src/utils/password.ts`
  - [ ] Function `hashPassword(password: string)`
  - [ ] Function `comparePassword(password: string, hash: string)`
  - [ ] Function `validatePasswordStrength(password: string)`

**Files to create:**
```typescript
// src/utils/password.ts
export const hashPassword = async (password: string): Promise<string>
export const comparePassword = async (password: string, hash: string): Promise<boolean>
export const validatePasswordStrength = (password: string): boolean
```

#### Validation Schemas
- [ ] Create `src/validators/auth.validator.ts`
  - [ ] `loginSchema` (email, password)
  - [ ] `registerSchema` (full user data)
  - [ ] `changePasswordSchema`
  - [ ] `resetPasswordSchema`
  - [ ] `forgotPasswordSchema`

**Files to create:**
```typescript
// src/validators/auth.validator.ts
export const loginSchema = z.object({ ... })
export const changePasswordSchema = z.object({ ... })
export const resetPasswordSchema = z.object({ ... })
export const forgotPasswordSchema = z.object({ ... })
```

#### Auth Service
- [ ] Create `src/services/auth.service.ts`
  - [ ] `login(email, password)` - Validate & generate tokens
  - [ ] `logout(userId, token)` - Blacklist token
  - [ ] `refreshToken(refreshToken)` - Generate new access token
  - [ ] `forgotPassword(email)` - Send reset email
  - [ ] `resetPassword(token, newPassword)` - Reset password
  - [ ] `changePassword(userId, oldPassword, newPassword)`
  - [ ] `getCurrentUser(userId)` - Get user details
  - [ ] `updateLastLogin(userId)` - Update timestamp

**Key Logic:**
```typescript
// Login flow:
1. Validate email & password format
2. Find user in database
3. Check if user is active (not locked/inactive)
4. Compare password hash
5. Track login attempts (max 5 failed attempts → lock 15 min)
6. Generate access token (15min) & refresh token (7 days)
7. Store refresh token in Redis
8. Update last_login timestamp
9. Log activity to database
10. Return tokens + user info
```

#### Auth Controller
- [ ] Create `src/controllers/auth.controller.ts`
  - [ ] `login` handler
  - [ ] `logout` handler
  - [ ] `refreshToken` handler
  - [ ] `forgotPassword` handler
  - [ ] `resetPassword` handler
  - [ ] `changePassword` handler (requires auth)
  - [ ] `getMe` handler (requires auth)

**Response Format:**
```typescript
// Success response
{
  success: true,
  data: {
    user: {
      id, email, fullName, role, warehouse, ...
    },
    tokens: {
      accessToken: "...",
      refreshToken: "...",
      expiresIn: 900 // seconds
    }
  },
  timestamp: "2024-01-01T00:00:00Z"
}
```

#### Auth Routes
- [ ] Create `src/routes/auth.routes.ts`
  - [ ] POST `/login` - with loginRateLimiter
  - [ ] POST `/logout` - requires auth
  - [ ] POST `/refresh-token`
  - [ ] POST `/forgot-password` - with rate limiter
  - [ ] POST `/reset-password`
  - [ ] PUT `/change-password` - requires auth
  - [ ] GET `/me` - requires auth

#### Integration
- [ ] Register routes in `src/app.ts`
- [ ] Test with Postman/Insomnia
- [ ] Verify Redis token storage
- [ ] Verify activity logs in database
- [ ] Test rate limiting (5 login attempts)
- [ ] Test token expiration
- [ ] Test token blacklist on logout

#### Security Features
- [ ] Login attempts tracking (Redis)
  - Max 5 failed attempts per email
  - Lock for 15 minutes
  - Clear on successful login
- [ ] Token blacklist (Redis)
  - Blacklist token on logout
  - Check blacklist in auth middleware
  - TTL = remaining token lifetime
- [ ] Password requirements
  - Min 8 characters
  - At least 1 uppercase
  - At least 1 lowercase
  - At least 1 number
  - At least 1 special character

---

## 🎯 PHASE 2.2: USER MANAGEMENT

**Priority**: HIGH  
**Estimated Time**: 2-3 days

### Endpoints to Implement

```typescript
GET    /api/users                   - Danh sách users (phân trang, filter)
GET    /api/users/:id               - Chi tiết user
POST   /api/users                   - Tạo user mới (admin only)
PUT    /api/users/:id               - Cập nhật user (admin/self)
DELETE /api/users/:id               - Xóa user (admin only, soft delete)
PATCH  /api/users/:id/status        - Lock/unlock user (admin only)
POST   /api/users/:id/avatar        - Upload avatar
DELETE /api/users/:id/avatar        - Xóa avatar
```

### Tasks

#### Validation Schemas
- [ ] Create `src/validators/user.validator.ts`
  - [ ] `createUserSchema` (full validation)
  - [ ] `updateUserSchema` (partial validation)
  - [ ] `updateStatusSchema`
  - [ ] `queryUsersSchema` (pagination, filters)

**Validation Rules:**
```typescript
- email: unique, valid format
- employeeCode: unique, alphanumeric
- phone: valid format (optional)
- roleId: must exist in roles table
- warehouseId: must exist in warehouses table (optional)
- dateOfBirth: valid date, not future
- gender: enum (male, female, other)
- status: enum (active, inactive, locked)
```

#### User Service
- [ ] Create `src/services/user.service.ts`
  - [ ] `getAllUsers(queryParams)` - Pagination, filter, search
  - [ ] `getUserById(id)` - With relations (role, warehouse)
  - [ ] `createUser(data)` - Hash password, validate uniqueness
  - [ ] `updateUser(id, data)` - Partial update
  - [ ] `deleteUser(id)` - Soft delete (set status = inactive)
  - [ ] `updateUserStatus(id, status)` - Lock/unlock
  - [ ] `uploadAvatar(id, file)` - Process & upload
  - [ ] `deleteAvatar(id)` - Delete file & update DB
  - [ ] `checkEmailExists(email)` - Uniqueness check
  - [ ] `checkEmployeeCodeExists(code)` - Uniqueness check

**Query Features:**
```typescript
// Pagination
- page: number (default: 1)
- limit: number (default: 20, max: 100)

// Filters
- roleId: number
- warehouseId: number
- status: enum (active, inactive, locked)
- gender: enum

// Search
- search: string (search in fullName, email, employeeCode, phone)

// Sort
- sortBy: string (default: createdAt)
- sortOrder: asc | desc (default: desc)
```

#### Avatar Upload Service
- [ ] Create `src/services/upload.service.ts`
  - [ ] Configure Multer middleware
  - [ ] Configure Sharp for image processing
  - [ ] Function `processAvatar(file)` - Resize to 200x200
  - [ ] Function `deleteFile(filePath)` - Delete old avatar

**Upload Config:**
```typescript
- Max file size: 5MB
- Allowed types: jpeg, png, jpg, webp
- Destination: ./uploads/avatars/
- Filename: user-{id}-{timestamp}.{ext}
- Processing: Resize to 200x200, optimize quality
```

#### User Controller
- [ ] Create `src/controllers/user.controller.ts`
  - [ ] `getAllUsers` - Handle query params
  - [ ] `getUserById` - Return with relations
  - [ ] `createUser` - Validate & create
  - [ ] `updateUser` - Check permissions (admin or self)
  - [ ] `deleteUser` - Admin only
  - [ ] `updateUserStatus` - Admin only
  - [ ] `uploadAvatar` - Process & save
  - [ ] `deleteAvatar` - Delete file

**Response Format:**
```typescript
// List response with pagination
{
  success: true,
  data: [
    { id, email, fullName, role: {...}, warehouse: {...}, ... }
  ],
  meta: {
    page: 1,
    limit: 20,
    total: 100,
    totalPages: 5
  },
  timestamp: "..."
}
```

#### User Routes
- [ ] Create `src/routes/user.routes.ts`
  - [ ] GET `/` - requires auth + permission
  - [ ] GET `/:id` - requires auth
  - [ ] POST `/` - requires auth + admin permission
  - [ ] PUT `/:id` - requires auth + (admin or self)
  - [ ] DELETE `/:id` - requires auth + admin permission
  - [ ] PATCH `/:id/status` - requires auth + admin permission
  - [ ] POST `/:id/avatar` - requires auth + uploadRateLimiter
  - [ ] DELETE `/:id/avatar` - requires auth

#### Integration
- [ ] Register routes in `src/app.ts`
- [ ] Create uploads/avatars directory
- [ ] Test CRUD operations
- [ ] Test file upload
- [ ] Test pagination & filters
- [ ] Test search functionality
- [ ] Test authorization (admin vs self)

#### Cache Strategy
- [ ] Cache user details (TTL: 1 hour)
  - Key: `user:{id}`
  - Invalidate on update/delete
- [ ] Cache user list (TTL: 5 minutes)
  - Key: `users:list:{page}:{filters}`
  - Invalidate on create/update/delete

---

## 🎯 PHASE 2.3: ROLE & PERMISSION MANAGEMENT

**Priority**: HIGH  
**Estimated Time**: 1-2 days

### Endpoints to Implement

```typescript
GET    /api/roles                   - Danh sách roles
GET    /api/roles/:id               - Chi tiết role
GET    /api/roles/:id/permissions   - Permissions của role
PUT    /api/roles/:id/permissions   - Gán permissions cho role (admin only)

GET    /api/permissions             - Danh sách permissions (grouped by module)
```

### Tasks

#### Validation Schemas
- [ ] Create `src/validators/role.validator.ts`
  - [ ] `assignPermissionsSchema` (array of permission IDs)

#### Role Service
- [ ] Create `src/services/role.service.ts`
  - [ ] `getAllRoles()` - With permission count
  - [ ] `getRoleById(id)` - With permissions
  - [ ] `getRolePermissions(roleId)` - List permissions
  - [ ] `assignPermissions(roleId, permissionIds)` - Bulk assign
  - [ ] `removePermission(roleId, permissionId)` - Remove one
  - [ ] `syncPermissions(roleId, permissionIds)` - Replace all

#### Permission Service
- [ ] Create `src/services/permission.service.ts`
  - [ ] `getAllPermissions()` - Grouped by module
  - [ ] `getPermissionsByModule(module)` - Filter by module
  - [ ] `checkUserPermission(userId, permissionKey)` - Check if user has permission

**Modules:**
- sales (Sales management)
- warehouse (Warehouse & inventory)
- production (Production management)
- finance (Finance & accounting)
- hr (Human resources)
- reports (Reports & analytics)
- settings (System settings)

#### Role Controller
- [ ] Create `src/controllers/role.controller.ts`
  - [ ] `getAllRoles`
  - [ ] `getRoleById`
  - [ ] `getRolePermissions`
  - [ ] `assignPermissions` - Admin only

#### Permission Controller
- [ ] Create `src/controllers/permission.controller.ts`
  - [ ] `getAllPermissions` - Grouped by module
  - [ ] `getPermissionsByModule`

#### Routes
- [ ] Create `src/routes/role.routes.ts`
  - [ ] GET `/` - requires auth
  - [ ] GET `/:id` - requires auth
  - [ ] GET `/:id/permissions` - requires auth
  - [ ] PUT `/:id/permissions` - requires auth + admin
  
- [ ] Create `src/routes/permission.routes.ts`
  - [ ] GET `/` - requires auth
  - [ ] GET `/module/:module` - requires auth

#### Integration
- [ ] Register routes in `src/app.ts`
- [ ] Update auth middleware to load user permissions
- [ ] Update authorize middleware to check permissions
- [ ] Test permission assignment
- [ ] Test permission checking

#### Cache Strategy
- [ ] Cache role permissions (TTL: 1 hour)
  - Key: `role:permissions:{roleId}`
  - Invalidate on permission assignment
- [ ] Cache user permissions (TTL: 1 hour)
  - Key: `user:permissions:{userId}`
  - Invalidate on role change or permission assignment
- [ ] Cache all permissions (TTL: 1 hour)
  - Key: `permissions:all`
  - Rarely changes

---

## 📝 DOCUMENTATION

### API Documentation (Swagger)
- [ ] Setup Swagger configuration
- [ ] Document all auth endpoints
- [ ] Document all user endpoints
- [ ] Document all role/permission endpoints
- [ ] Add request/response examples
- [ ] Add authentication guide
- [ ] Add error responses

**File to create:**
```typescript
// src/config/swagger.ts
export const swaggerOptions = { ... }
```

### Postman Collection
- [ ] Create Postman collection
- [ ] Add all endpoints
- [ ] Add environment variables
- [ ] Add test scripts
- [ ] Export collection JSON

---

## 🧪 TESTING

### Manual Testing Checklist
- [ ] **Login**
  - [ ] Successful login with valid credentials
  - [ ] Failed login with invalid email
  - [ ] Failed login with wrong password
  - [ ] Account lock after 5 failed attempts
  - [ ] Account unlock after 15 minutes
  - [ ] Rate limiting (5 attempts per 15 min)
  
- [ ] **Logout**
  - [ ] Token blacklisted in Redis
  - [ ] Cannot use blacklisted token
  
- [ ] **Refresh Token**
  - [ ] Generate new access token with valid refresh token
  - [ ] Fail with invalid refresh token
  - [ ] Fail with expired refresh token
  
- [ ] **Password Management**
  - [ ] Change password with correct old password
  - [ ] Fail with wrong old password
  - [ ] Password strength validation
  - [ ] Forgot password sends email
  - [ ] Reset password with valid token
  
- [ ] **User CRUD**
  - [ ] List users with pagination
  - [ ] Filter users by role/warehouse/status
  - [ ] Search users by name/email/code
  - [ ] Get user by ID
  - [ ] Create user (admin only)
  - [ ] Update user (admin or self)
  - [ ] Delete user (soft delete, admin only)
  - [ ] Lock/unlock user (admin only)
  
- [ ] **Avatar Upload**
  - [ ] Upload avatar (JPEG, PNG, WebP)
  - [ ] File size validation (max 5MB)
  - [ ] Image resize to 200x200
  - [ ] Delete old avatar on new upload
  - [ ] Delete avatar endpoint
  - [ ] Rate limiting (20 uploads per hour)
  
- [ ] **Permissions**
  - [ ] List all permissions grouped by module
  - [ ] Get permissions of role
  - [ ] Assign permissions to role
  - [ ] Permission check in authorize middleware

### Integration Testing (Optional)
- [ ] Write integration tests with Jest + Supertest
- [ ] Test auth flow end-to-end
- [ ] Test user CRUD with different roles
- [ ] Test permission checking

---

## 🔒 SECURITY CHECKLIST

### Authentication Security
- [x] Password hashing with bcrypt (rounds: 10)
- [ ] JWT secrets in environment variables
- [ ] Token expiration (access: 15min, refresh: 7 days)
- [ ] Token blacklist on logout
- [ ] Login attempt tracking & account lock
- [ ] Rate limiting on login endpoint
- [ ] Secure password validation

### Authorization Security
- [ ] Permission checking in middleware
- [ ] Role-based access control
- [ ] Warehouse-based access control
- [ ] Admin-only endpoints protected
- [ ] Self-update restrictions (cannot change own role)

### Data Security
- [ ] Input validation (Zod schemas)
- [ ] XSS prevention (input sanitization)
- [ ] SQL injection prevention (Prisma ORM)
- [ ] File upload validation (type, size)
- [ ] Sensitive data not in logs (password)
- [ ] Activity logging for audit trail

---

## 📊 DELIVERABLES

### Code Files (Estimated: 15-20 files)
- [ ] `src/utils/jwt.ts` - JWT helpers
- [ ] `src/utils/password.ts` - Password helpers
- [ ] `src/validators/auth.validator.ts` - Auth validation schemas
- [ ] `src/validators/user.validator.ts` - User validation schemas
- [ ] `src/validators/role.validator.ts` - Role validation schemas
- [ ] `src/services/auth.service.ts` - Auth business logic
- [ ] `src/services/user.service.ts` - User business logic
- [ ] `src/services/role.service.ts` - Role business logic
- [ ] `src/services/permission.service.ts` - Permission business logic
- [ ] `src/services/upload.service.ts` - File upload logic
- [ ] `src/controllers/auth.controller.ts` - Auth controllers
- [ ] `src/controllers/user.controller.ts` - User controllers
- [ ] `src/controllers/role.controller.ts` - Role controllers
- [ ] `src/controllers/permission.controller.ts` - Permission controllers
- [ ] `src/routes/auth.routes.ts` - Auth routes
- [ ] `src/routes/user.routes.ts` - User routes
- [ ] `src/routes/role.routes.ts` - Role routes
- [ ] `src/routes/permission.routes.ts` - Permission routes
- [ ] `src/config/swagger.ts` - Swagger configuration

### Documentation
- [ ] API documentation (Swagger UI)
- [ ] Postman collection
- [ ] README updates (auth flow, endpoints)

### Testing
- [ ] Manual testing completed
- [ ] Postman tests pass
- [ ] Integration tests (optional)

---

## ⚡ PERFORMANCE CONSIDERATIONS

### Caching Strategy
- Cache user details (1 hour)
- Cache role permissions (1 hour)
- Cache user permissions (1 hour)
- Cache user list (5 minutes)
- Invalidate cache on updates

### Database Optimization
- Index on `users.email` (unique)
- Index on `users.employeeCode` (unique)
- Index on `users.roleId`
- Index on `users.status`
- Eager load relations (role, warehouse)

### Redis Usage
- Session management
- Token blacklist
- Login attempt tracking
- Cache layers

---

## 🎯 SUCCESS CRITERIA

### Functional Requirements
✅ All endpoints implemented and working  
✅ JWT authentication working correctly  
✅ Token refresh mechanism working  
✅ Login attempt tracking & account lock  
✅ User CRUD with proper authorization  
✅ Avatar upload with image processing  
✅ Role & permission management  
✅ Activity logging to database  

### Non-Functional Requirements
✅ API response time < 200ms  
✅ Password hashing secure (bcrypt)  
✅ Input validation comprehensive  
✅ Error handling consistent  
✅ Code quality (TypeScript strict)  
✅ Cache strategy implemented  
✅ Security best practices followed  

### Documentation
✅ Swagger API docs complete  
✅ Postman collection created  
✅ Code comments for complex logic  

---

## 📅 TIMELINE

**Day 1-2: Authentication Module**
- JWT utilities
- Password utilities
- Auth service & controller
- Auth routes
- Testing

**Day 3-4: User Management**
- Validation schemas
- User service & controller
- Avatar upload
- User routes
- Testing

**Day 5: Role & Permission Management**
- Role service & controller
- Permission service & controller
- Routes
- Testing

**Day 6-7: Testing & Documentation**
- Comprehensive testing
- Swagger documentation
- Postman collection
- Bug fixes
- Code review

---

## 🚀 GETTING STARTED

### Step 1: Create Branch
```bash
git checkout -b feature/phase-2-authentication
```

### Step 2: Start with Utils
```bash
# Create JWT utilities
touch src/utils/jwt.ts

# Create password utilities
touch src/utils/password.ts
```

### Step 3: Implement Authentication
- Follow checklist from top to bottom
- Test each feature before moving on
- Commit frequently

### Step 4: Documentation
- Document as you go
- Update Swagger after each endpoint

---

## 📞 SUPPORT

If you encounter issues:
1. Check ROADMAP.md for detailed specifications
2. Review Phase 1 implementations for patterns
3. Check Prisma schema for data models
4. Review existing middlewares for integration

---

**Ready to start Phase 2!** 🚀  
**Good luck!** 💪
