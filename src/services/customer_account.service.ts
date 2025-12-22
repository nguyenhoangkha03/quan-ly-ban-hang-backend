import { PrismaClient, AuthProvider, CustomerType } from '@prisma/client';
import { NotFoundError, AuthenticationError, ConflictError } from '@utils/errors';
import RedisService from './redis.service';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '@utils/cs-jwt';
import { hashPassword, comparePassword } from '@utils/password';

const prisma = new PrismaClient();
const redis = RedisService.getInstance();
const ACCOUNT_CACHE_TTL = 3600;

// Helper chuẩn hóa số điện thoại (Giữ nguyên)
const normalizePhone = (phone: string): string => {
    phone = phone.trim();
    if (phone.startsWith('+84')) return phone.substring(1);
    if (phone.startsWith('0')) return '84' + phone.substring(1);
    if (!phone.startsWith('84') && phone.length < 10) return '84' + phone;
    return phone;
}

class AccountService {

    // Helper tạo cặp token (Đã sửa userId -> customerId)
    private createTokenPair(customerId: number) {
        const payload = { customerId, role: 'customer' as const }; // Dùng 'as const' cho TS
        const accessToken = generateAccessToken(payload);
        const refreshToken = generateRefreshToken(payload);
        return { accessToken, refreshToken };
    }

    // 1. PHONE ACCOUNT SYNC (Dùng cho cả Đăng ký và Đăng nhập bằng OTP/UID)
    async syncPhoneAccount(payload: { uid: string; phone: string ; password?: string }) {
        console.log('Syncing phone account with payload:', payload);
        console.log('Normalized phone:', normalizePhone(payload.phone));
        console.log('Password:', payload.password);

        const normalizedPhone = normalizePhone(payload.phone);

        let account = await prisma.customerAccount.findUnique({
            where: { accountIdentifier: payload.uid },
            include: { customer: true }
        });

        // 1. Nếu chưa có CustomerAccount (Đăng ký mới hoặc Đăng nhập lần đầu)
        if (!account) {

            // 1.1 Tìm Customer theo SĐT (đã có Customer được tạo từ Admin/Đơn hàng)
            let customer = await prisma.customer.findFirst({
                where: { phone: normalizedPhone }
            });

            // 1.2 Nếu chưa có Customer -> Tạo mới Customer
            if (!customer) {
                customer = await prisma.customer.create({
                    data: {
                        customerCode: `KH-${Date.now()}`,
                        customerName: `Khách hàng ${normalizedPhone}`,
                        phone: normalizedPhone,
                        customerType: CustomerType.individual,
                        contactPerson: normalizedPhone,
                    },
                });
            }

            // 1.3 Tạo CustomerAccount liên kết
           // --- LOGIC MỚI: MÃ HÓA MẬT KHẨU NẾU CÓ ---
            let passwordHash = null;
            if (payload.password) {
                passwordHash = await hashPassword(payload.password);
            }
            // -----------------------------------------

            account = await prisma.customerAccount.create({
                data: {
                    customerId: customer.id,
                    accountIdentifier: payload.uid,
                    authProvider: AuthProvider.PHONE,
                    isVerified: true,
                    isActive: true,
                    lastLogin: new Date(),
                    passwordHash: passwordHash // <--- LƯU MẬT KHẨU VÀO ĐÂY
                },
                include: { customer: true }
            });
        }

        // 2. Tạo JWT Token
        const tokens = this.createTokenPair(account.customerId);

        // 3. Cập nhật Refresh Token & Last Login
        await prisma.customerAccount.update({
            where: { id: account.id },
            data: {
                lastLogin: new Date(),
                refreshToken: tokens.refreshToken
            }
        });

        return {
            customer: account.customer, // Trả về thông tin khách hàng
            tokens,
            // Cần đặt mật khẩu nếu tài khoản được tạo/login bằng SĐT lần đầu và chưa có mật khẩu
            requirePasswordSet: !account.passwordHash
        };
    }

    // 2. SOCIAL LOGIN SYNC (Giữ logic cũ, thêm return customer)
    async syncSocialAccount(payload: { uid: string; email?: string; name: string; avatar?: string; provider: AuthProvider }) {
        // ... (Logic tìm/tạo Customer và CustomerAccount giữ nguyên)
        let account = await prisma.customerAccount.findUnique({
            where: { accountIdentifier: payload.uid },
            include: { customer: true }
        });

        if (!account) {
            let customer = await prisma.customer.findFirst({ where: { email: payload.email } });

            if (!customer) {
                // ... (Tạo Customer mới)
                customer = await prisma.customer.create({
                    data: {
                        customerCode: `KH-${Date.now()}`,
                        customerName: payload.name || 'Khách hàng mới',
                        email: payload.email,
                        avatarUrl: payload.avatar,
                        phone: '',
                        customerType: CustomerType.individual,
                    }
                });
            }

            account = await prisma.customerAccount.create({
                data: {
                    customerId: customer.id,
                    accountIdentifier: payload.uid,
                    authProvider: payload.provider,
                    isVerified: true,
                    isActive: true,
                },
                include: { customer: true }
            });
        }

        const tokens = this.createTokenPair(account.customerId);

        await prisma.customerAccount.update({
            where: { id: account.id },
            data: {
                lastLogin: new Date(),
                refreshToken: tokens.refreshToken
            }
        });

        return {
            customer: account.customer,
            tokens,
            requirePasswordSet: false // Social login không cần đặt mật khẩu
        };
    }

    // 3. SET PASSWORD
    async setPassword(phoneInput: string, uid: string, newPassword: string) {
        const normalizedPhone = normalizePhone(phoneInput);

        const account = await prisma.customerAccount.findUnique({
            where: { accountIdentifier: uid },
            include: { customer: true },
        });

        if (!account) {
            throw new AuthenticationError('Invalid account identifier (UID)');
        }

        // --- SỬA LỖI Ở ĐÂY ---
        // Kiểm tra:
        // 1. Nếu Customer đã có SĐT thì phải khớp với SĐT nhập vào.
        // 2. Nếu Customer chưa có SĐT (Social Login lần đầu), cho phép cập nhật.
        if (account.customer.phone && account.customer.phone !== normalizedPhone) {
            throw new AuthenticationError('Phone number mismatch with verified account');
        }

        // Nếu chưa có SĐT, cập nhật SĐT cho Customer
        if (!account.customer.phone) {
            // Kiểm tra xem SĐT này đã có ai dùng chưa để tránh trùng lặp
            const existingCustomer = await prisma.customer.findFirst({
                where: { phone: normalizedPhone, id: { not: account.customerId } }
            });

            if (existingCustomer) {
                throw new ConflictError('Phone number already associated with another account');
            }

            await prisma.customer.update({
                where: { id: account.customerId },
                data: { phone: normalizedPhone }
            });
        }

        const hash = await hashPassword(newPassword);

        // Cập nhật mật khẩu và đánh dấu tài khoản đã được xác thực (nếu chưa)
        await prisma.customerAccount.update({
            where: { id: account.id },
            data: {
                passwordHash: hash,
                isVerified: true // Đảm bảo tài khoản được verify
            },
        });

        const tokens = this.createTokenPair(account.customerId);
        return { tokens, message: 'Password updated successfully' };
    }

    // 4. LOGIN BẰNG MẬT KHẨU (Giữ nguyên, đổi trả về customer)
    async loginWithPassword(phoneInput: string, password: string) {
        const phone = normalizePhone(phoneInput);

        const customer = await prisma.customer.findFirst({ where: { phone } });
        if (!customer) throw new AuthenticationError('Invalid credentials');

        const account = await prisma.customerAccount.findUnique({
            where: { customerId: customer.id },
            include: { customer: true }
        });

        if (!account || !account.passwordHash) throw new AuthenticationError('Password not set. Please use OTP login or reset password.');

        const isMatch = await comparePassword(password, account.passwordHash);
        if (!isMatch) throw new AuthenticationError('Wrong phone or password');

        const tokens = this.createTokenPair(account.customerId);

        await prisma.customerAccount.update({
            where: { id: account.id },
            data: { lastLogin: new Date(), refreshToken: tokens.refreshToken }
        });

        return { customer: account.customer, tokens }; // Trả về thông tin khách hàng
    }

    // 5. REFRESH TOKEN (Đã sửa decoded.userId -> decoded.customerId)
    async refreshAccessToken(refreshTokenInput: string) {
        // Sử dụng decoded.customerId
        const decoded = verifyRefreshToken(refreshTokenInput);

        const account = await prisma.customerAccount.findUnique({
            where: { customerId: decoded.customerId }, // Đã sửa
        });

        if (!account || account.refreshToken !== refreshTokenInput) {
            throw new AuthenticationError('Invalid refresh token or token revoked');
        }

        const tokens = this.createTokenPair(account.customerId);

        await prisma.customerAccount.update({
            where: { id: account.id },
            data: { refreshToken: tokens.refreshToken }
        });

        return tokens;
    }

    // 6. GET ACCOUNT BY CUSTOMER ID (Đã đổi tên)
    async getAccountByCustomerId(customerId: number) {
        const cacheKey = `customer_account:${customerId}`;
        const cached = await redis.get(cacheKey);
        if (cached) return cached;

        const account = await prisma.customerAccount.findUnique({
            where: { customerId },
            include: { customer: true }
        });

        if (!account) throw new NotFoundError('Customer Account not found');

        await redis.set(cacheKey, account, ACCOUNT_CACHE_TTL);
        return account;
    }

    // 7. KIỂM TRA SĐT (Giữ nguyên, dùng hasPassword)
    async checkPhoneExistence(phoneInput: string) {
        const phone = normalizePhone(phoneInput);

        const customer = await prisma.customer.findFirst({
            where: { phone },
            include: { customerAccount: true }
        });

        if (customer) {
            // Sử dụng toán tử ?. để truy cập an toàn (optional chaining)
            const account = customer.customerAccount?.[0];

            return {
                exists: true,
                hasPassword: !!account?.passwordHash,
                name: customer.customerName,
                // Gợi ý cho frontend: Nếu có tài khoản nhưng chưa có mật khẩu, 
                // thì khách hàng cần dùng OTP hoặc đặt mật khẩu mới.
                canLoginWithPassword: !!account?.passwordHash
            };
        }

        return { exists: false };
    }
}

export default new AccountService();