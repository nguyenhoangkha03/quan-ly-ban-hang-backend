import { Router } from 'express';
// ✅ 1. Import đúng Controller mới
import accountController from '@controllers/cs-auth.controller'; 
import { validateNested } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';
import { customerAuthentication } from '@middlewares/authCustomer'; // Middleware verify token

import {
    socialLoginSchema,
    loginPasswordSchema,
    setPasswordSchema,
    syncPhoneAccountSchema,
    checkPhoneSchema 
} from '@validators/customer_account.validator';

const router = Router();

// ==========================================
// 1. PUBLIC ROUTES (Authentication Flow)
// ==========================================

// 1.1 [BƯỚC 1 SĐT] Kiểm tra SĐT
router.post(
    '/check-phone', 
    validateNested(checkPhoneSchema),
    asyncHandler(accountController.checkPhone.bind(accountController))
);

// 1.2 [BƯỚC SAU OTP] Đồng bộ/Đăng nhập bằng SĐT + UID
router.post(
    '/sync-phone-account',
    validateNested(syncPhoneAccountSchema), 
    asyncHandler(accountController.syncPhoneAccount.bind(accountController)) 
);

// 1.3 [BƯỚC ĐẶT MẬT KHẨU MỚI]
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
    asyncHandler(accountController.refreshToken.bind(accountController))
);


// ==========================================
// 2. PROTECTED ROUTES (Cần Token)
// ==========================================

// Route Logout (Cần token để blacklist nên để ở group Protected hoặc check token thủ công trong controller)
// Để đơn giản, ta cứ để nó public (controller sẽ tự check header nếu có) hoặc protected đều được.
// Nhưng thường Logout cần access token để blacklist -> Nên để Protected hoặc tự parse header.
// Ở đây mình đặt trước middleware auth chung để controller tự xử lý mềm dẻo hơn.
router.post(
    '/logout',
    asyncHandler(accountController.logout.bind(accountController))
);

// Áp dụng middleware xác thực cho các route bên dưới (Profile...)
router.use(customerAuthentication); 

// 2.1 Lấy thông tin tài khoản cá nhân
router.get(
    '/profile', 
    asyncHandler(accountController.getAccountById.bind(accountController)) 
);

export default router;