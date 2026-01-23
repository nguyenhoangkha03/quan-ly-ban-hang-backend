import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '@custom-types/common.type';
import customerAuthService from '@services/cs-auth.service';
import { AuthProvider } from '@prisma/client';
import type {
    SocialLoginInput,
    LoginPasswordInput,
    SetPasswordInput,
    CheckPhoneInput,
} from '@validators/customer_account.validator';

// -----------------------------------------------------------------------------
// [DEBUG_CONFIG] Đặt thành false để tắt toàn bộ log debug bên dưới
const ENABLE_DEBUG_LOG = true; 

const debugLog = (action: string, data: any) => {
    if (ENABLE_DEBUG_LOG) {
        console.log(`\n🟡 [DEBUG_AUTH] Action: ${action}`);
        console.log('📦 Data:', JSON.stringify(data, null, 2));
        console.log('--------------------------------------------------\n');
    }
};
// -----------------------------------------------------------------------------

class CustomerAuthController {

    // --- HELPER: Set Cookie HttpOnly ---
    private setRefreshTokenCookie(res: Response, token: string) {
        const isProduction = process.env.NODE_ENV === 'production';
        res.cookie('c_refresh_token', token, {
            httpOnly: true,                 // JS Client không đọc được (Chống XSS)
            secure: isProduction,           // Chỉ gửi qua HTTPS ở môi trường Prod
            sameSite: 'strict',             // Chống CSRF
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 ngày (Khớp với TTL Redis)
            path: '/'
        });
    }

    // 1. KIỂM TRA SĐT
    async checkPhone(req: Request, res: Response, next: NextFunction) {
        try {
            const { phone } = req.body as CheckPhoneInput;
            
            // [DEBUG] Log Input
            debugLog('CHECK_PHONE_INPUT', { phone });

            const result = await customerAuthService.checkPhoneExistence(phone);
            
            // [DEBUG] Log Output
            debugLog('CHECK_PHONE_OUTPUT', result);

            return res.status(200).json({ success: true, data: result });
        } catch (error) { 
            return next(error); // ✅ Đã thêm return
        }
    }

    // 2. ĐỒNG BỘ TÀI KHOẢN (Phone/OTP Login & Register)
    async syncPhoneAccount(req: Request, res: Response, next: NextFunction) {
        try {
            const { uid, phone, password } = req.body; 
            
            // [DEBUG] Log Input
            debugLog('SYNC_PHONE_INPUT', { uid, phone, hasPassword: !!password });

            const result = await customerAuthService.syncPhoneAccount({ uid, phone, password });

            // ✅ Set Cookie Refresh Token
            this.setRefreshTokenCookie(res, result.tokens.refreshToken);
            
            // [DEBUG] Log Output (Ẩn token nhạy cảm)
            debugLog('SYNC_PHONE_OUTPUT', { 
                customer: result.customer, 
                requirePasswordSet: result.requirePasswordSet 
            });

            return res.status(200).json({
                success: true,
                message: 'Phone authentication successful',
                data: {
                    customer: result.customer,
                    accessToken: result.tokens.accessToken, // Chỉ trả Access Token về Body
                    requirePasswordSet: result.requirePasswordSet
                }
            });
        } catch (error) { 
            return next(error); // ✅ Đã thêm return
        }
    }

    // 3. ĐĂNG NHẬP SOCIAL
    async loginWithSocial(req: Request, res: Response, next: NextFunction) {
        try {
            const { uid, email, name, avatar, provider } = req.body as SocialLoginInput;
            const providerEnum: AuthProvider = provider === 'FACEBOOK' ? AuthProvider.FACEBOOK : AuthProvider.GOOGLE; 

            // [DEBUG] Log Input
            debugLog('LOGIN_SOCIAL_INPUT', { uid, email, provider });

            const result = await customerAuthService.syncSocialAccount({
                uid,
                email,
                name: name || '',
                avatar: avatar || '',
                provider: providerEnum
            });

            console.log('SOCIAL_LOGIN_RESULT', result);

            // ✅ Set Cookie Refresh Token
            this.setRefreshTokenCookie(res, result.tokens.refreshToken);

            // [DEBUG] Log Output
            debugLog('LOGIN_SOCIAL_OUTPUT', { 
                customer: result.customer,
                requirePhoneCheck: result.requirePhoneCheck
            });

            return res.status(200).json({
                success: true,
                message: 'Social login successful',
                data: {
                    customer: result.customer,
                    accessToken: result.tokens.accessToken,
                    requirePhoneCheck: result.requirePhoneCheck
                },
            });
        } catch (error) { 
            return next(error); // ✅ Đã thêm return
        }
    }

    // 4. ĐĂNG NHẬP BẰNG MẬT KHẨU
    async loginWithPassword(req: Request, res: Response, next: NextFunction) {
        try {
            const { phone, password } = req.body as LoginPasswordInput; 
            const ipAddress = req.ip;

            // [DEBUG] Log Input
            debugLog('LOGIN_PASSWORD_INPUT', { phone, ip: ipAddress });
            
            const result = await customerAuthService.loginWithPassword(phone, password);
            
            // ✅ Set Cookie Refresh Token
            this.setRefreshTokenCookie(res, result.tokens.refreshToken);

            // [DEBUG] Log Output
            debugLog('LOGIN_PASSWORD_OUTPUT', { customer: result.customer });

            return res.status(200).json({
                success: true,
                message: 'Login successful',
                data: {
                    customer: result.customer,
                    accessToken: result.tokens.accessToken
                }
            });
        } catch (error) { 
            return next(error); // ✅ Đã thêm return
        }
    }

    // 5. ĐẶT MẬT KHẨU (Sau khi verify OTP/Social lần đầu)
    async setPassword(req: Request, res: Response, next: NextFunction) {
        try {
            const { phone, password, uid } = req.body as SetPasswordInput;
            
            // [DEBUG] Log Input
            debugLog('SET_PASSWORD_INPUT', { phone, uid });

            const result = await customerAuthService.setPassword(phone, uid, password);
            
            // ✅ Set Password xong thì tự động login luôn -> Set Cookie
            if (result.tokens) {
                this.setRefreshTokenCookie(res, result.tokens.refreshToken);
            }

            // [DEBUG] Log Output
            debugLog('SET_PASSWORD_OUTPUT', { message: result.message });

            return res.status(200).json({
                success: true,
                message: result.message,
                data: {
                    // Trả về tokens mới để client cập nhật state mà không cần login lại
                    accessToken: result.tokens?.accessToken 
                }
            });
        } catch (error) { 
            return next(error); // ✅ Đã thêm return
        }
    }

    // 6. REFRESH TOKEN (SỬA ĐỔI LỚN: ĐỌC TỪ COOKIE)
    async refreshToken(req: Request, res: Response, next: NextFunction) {
        try {
            // ✅ Lấy token từ Cookie thay vì Body
            const refreshToken = req.cookies['c_refresh_token']; 

            // [DEBUG] Log Input
            debugLog('REFRESH_TOKEN_INPUT', { 
                hasCookie: !!refreshToken, 
                tokenPreview: refreshToken ? `${refreshToken.substring(0, 10)}...` : 'null' 
            });

            if (!refreshToken) {
                return res.status(401).json({ success: false, message: 'No session token' });
            }

            const tokens = await customerAuthService.refreshAccessToken(refreshToken);
            
            // ✅ Rotation: Set lại cookie mới
            this.setRefreshTokenCookie(res, tokens.refreshToken);

            // [DEBUG] Log Output
            debugLog('REFRESH_TOKEN_OUTPUT', { newAccessToken: `${tokens.accessToken.substring(0, 10)}...` });

            return res.status(200).json({
                success: true,
                data: { accessToken: tokens.accessToken }
            });
        } catch (error) {
            // Nếu lỗi (hết hạn, không hợp lệ) -> Xóa cookie để client logout
            res.clearCookie('c_refresh_token');
            debugLog('REFRESH_TOKEN_ERROR', error);
            return next(error); // ✅ Đã thêm return
        }
    }

    // 7. GET PROFILE (Yêu cầu Auth Middleware)
    async getAccountById(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const customerId = req.user?.id; 
            
            // [DEBUG] Log Input
            debugLog('GET_PROFILE_INPUT', { customerId });

            if (!customerId) return res.status(401).json({ success: false, message: 'Unauthorized' });

            const account = await customerAuthService.getAccountByCustomerId(customerId);
            
            // [DEBUG] Log Output
            debugLog('GET_PROFILE_OUTPUT', { accountId: account.id, customerName: account.customer.customerName });

            return res.status(200).json({
                success: true,
                data: account,
                timestamp: new Date().toISOString(),
            });
        } catch (error) { 
            return next(error); // ✅ Đã thêm return
        }
    }

    

    // 8. ĐĂNG XUẤT (MỚI)
    async logout(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const authHeader = req.headers.authorization;
            const accessToken = authHeader && authHeader.startsWith('Bearer ') 
                ? authHeader.substring(7) 
                : '';
            
            const customerId = req.user?.id;

            // [DEBUG] Log Input
            debugLog('LOGOUT_INPUT', { customerId, hasAccessToken: !!accessToken });

            if (customerId && accessToken) {
                // Gọi service để blacklist token và xóa redis session
                await customerAuthService.logout(customerId, accessToken);
            }

            // ✅ Luôn xóa Cookie ở trình duyệt
            res.clearCookie('c_refresh_token', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                path: '/'
            });

            return res.status(200).json({
                success: true,
                message: 'Logged out successfully'
            });
        } catch (error) { 
            return next(error); // ✅ Đã thêm return
        }
    }
}

export default new CustomerAuthController();