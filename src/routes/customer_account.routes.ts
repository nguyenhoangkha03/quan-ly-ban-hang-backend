import { Router } from 'express';
import accountController from '@controllers/customer_account.controller';
import { validateNested } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';
import { customerAuthentication } from '@middlewares/authCustomer'; 
import { syncPhoneAccountSchema } from '@validators/customer_account.validator';

import {
    socialLoginSchema,
    loginPasswordSchema,
    setPasswordSchema,
    refreshTokenSchema,
    checkPhoneSchema // Bổ sung
} from '@validators/customer_account.validator';

const router = Router();

// ==========================================
// 1. PUBLIC ROUTES (Authentication Flow)
// ==========================================

// 1.1 [BƯỚC 1 SĐT] Kiểm tra SĐT có tồn tại chưa (Gợi ý Đăng ký/Đăng nhập Mật khẩu)
router.post(
    '/check-phone', 
    validateNested(checkPhoneSchema), // Thêm Validation cho check-phone
    asyncHandler(accountController.checkPhone.bind(accountController))
);

// 1.2 [BƯỚC SAU OTP] Đồng bộ/Đăng nhập bằng SĐT + UID (Sau khi Supabase Verify OTP thành công)
router.post(
    '/sync-phone-account',
    validateNested(syncPhoneAccountSchema), // <== Áp dụng validation
    asyncHandler(accountController.syncPhoneAccount.bind(accountController)) 
);

// 1.3 [BƯỚC ĐẶT MẬT KHẨU MỚI] Đặt mật khẩu (Sử dụng sau Đăng ký/Quên mật khẩu SĐT)
router.post(
    '/set-password',
    validateNested(setPasswordSchema),
    asyncHandler(accountController.setPassword.bind(accountController))
);

// 1.4 Login Mật khẩu (SĐT + Mật khẩu)
router.post(
    '/login',
    validateNested(loginPasswordSchema),
    asyncHandler(accountController.loginWithPassword.bind(accountController))
);

// 1.5 Login Social (Google/FB)
router.post(
    '/social-login',
    validateNested(socialLoginSchema),
    asyncHandler(accountController.loginWithSocial.bind(accountController))
);

// 1.6 Refresh Token
router.post(
    '/refresh-token',
    validateNested(refreshTokenSchema),
    asyncHandler(accountController.refreshToken.bind(accountController))
);


// ==========================================
// 2. PROTECTED ROUTES (Cần Token)
// ==========================================

// Áp dụng middleware xác thực cho TẤT CẢ các route bên dưới dòng này
router.use(customerAuthentication); 

// 2.1 Lấy thông tin tài khoản cá nhân (GET /api/account/profile)
router.get(
    '/profile', 
    // Không cần params.id nữa, lấy customerId từ req.user
    asyncHandler(accountController.getAccountById.bind(accountController)) 
);

export default router;