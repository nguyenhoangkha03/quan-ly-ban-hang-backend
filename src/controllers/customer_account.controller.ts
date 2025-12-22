import { Response } from 'express';
import { AuthRequest } from '@custom-types/common.type';
import accountService from '@services/customer_account.service';
import { AuthProvider } from '@prisma/client';
import type {
    SocialLoginInput,
    LoginPasswordInput, // Thêm
    SetPasswordInput, // Thêm
    CheckPhoneInput, // Thêm
    // VerifyOtpInput // Thêm
} from '@validators/customer_account.validator';

class AccountController {

    // 1. [BƯỚC 1/3 SĐT] KIỂM TRA SĐT ĐÃ TỒN TẠI CHƯA
    async checkPhone(req: AuthRequest, res: Response) {
        const { phone } = req.body as CheckPhoneInput;
        // Logic gửi OTP được thực hiện ở Frontend bằng Supabase, 
        // Backend chỉ cần check sự tồn tại để gợi ý đăng ký/đăng nhập
        const result = await accountService.checkPhoneExistence(phone);
        
        return res.status(200).json({ success: true, data: result });
    }

    // 2. [BƯỚC 2/3 SĐT] XÁC THỰC OTP (Supabase đã xử lý, chỉ cần lấy UID)
    
    // 3. [BƯỚC 3/3 SĐT] ĐỒNG BỘ TÀI KHOẢN SAU KHI CÓ UID/OTP HOẶC ĐĂNG NHẬP (QUÊN MK)
    // Sau khi Supabase verify OTP thành công, gọi API này để tạo/cập nhật tài khoản và trả về Token
    async syncPhoneAccount(req: AuthRequest, res: Response) {
        // Lấy thêm password từ req.body
        const { uid, phone, password } = req.body as any; 
        
        // Truyền password vào service
        const result = await accountService.syncPhoneAccount({ uid, phone, password });
        
        return res.status(200).json({
            success: true,
            data: result,
            message: 'Phone authentication successful'
        });
    }

    // 4. ĐĂNG NHẬP SOCIAL - Trả về Token
    async loginWithSocial(req: AuthRequest, res: Response) {
        const { uid, email, name, avatar, provider } = req.body as SocialLoginInput;

        const providerEnum: AuthProvider = provider === 'FACEBOOK' ? AuthProvider.FACEBOOK : AuthProvider.GOOGLE; 

        const result = await accountService.syncSocialAccount({
            uid,
            email,
            name: name || '',
            avatar: avatar || '',
            provider: providerEnum
        });

        return res.status(200).json({
            success: true,
            data: result, 
            message: 'Social login successful',
        });
    }

    // 5. ĐĂNG NHẬP BẰNG MẬT KHẨU
    async loginWithPassword(req: AuthRequest, res: Response) {
        const { phone, password } = req.body as LoginPasswordInput; 
        
        const result = await accountService.loginWithPassword(phone, password);
        
        return res.status(200).json({
            success: true,
            data: result, // { account, tokens }
            message: 'Login successful'
        });
    }

    // 6. [BƯỚC CUỐI CÙNG SĐT] ĐẶT / ĐỔI MẬT KHẨU (Sử dụng sau khi Đăng ký/Quên mật khẩu)
    async setPassword(req: AuthRequest, res: Response) {
        // Nó phải dùng phone & uid đã verify ở bước trước (hoặc gửi lại uid)
        
        const { phone, password, uid } = req.body as SetPasswordInput;
        
        await accountService.setPassword(phone, uid, password);
        
        return res.status(200).json({
            success: true,
            message: 'Password set successfully'
        });
    }

    // 7. REFRESH TOKEN
    async refreshToken(req: AuthRequest, res: Response) {
        const { refreshToken } = req.body as { refreshToken: string }; // Use type assertion
        const tokens = await accountService.refreshAccessToken(refreshToken);
        
        return res.status(200).json({
            success: true,
            data: tokens
        });
    }

    // 8. GET BY ID (Cần Customer Auth Middleware)
    async getAccountById(req: AuthRequest, res: Response) {
        // Nên dùng ID từ token để lấy profile cá nhân, không nên dùng params.id
        const customerId = req.user?.id; 
        if (!customerId) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const account = await accountService.getAccountByCustomerId(customerId); // Đổi tên Service method
        
        return res.status(200).json({
            success: true,
            data: account,
            timestamp: new Date().toISOString(),
        });
    }
}

export default new AccountController();