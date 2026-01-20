import { PrismaClient, AuthProvider, CustomerType } from '@prisma/client';
import { AuthenticationError, AuthorizationError, ConflictError, NotFoundError } from '@utils/errors';
import CustomerRedisService, { CustomerCacheTTL } from './cs-redis.service'; // Use the new CS Redis Service
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '@utils/cs-jwt';
import { hashPassword, comparePassword } from '@utils/password';
import customerService from './cs-customer.service';


const prisma = new PrismaClient();
const csRedis = CustomerRedisService.getInstance();

// Helper to normalize phone number
const normalizePhone = (phone: string): string => {
    phone = phone.trim();
    if (phone.startsWith('+84')) return phone.substring(1);
    if (phone.startsWith('0')) return '84' + phone.substring(1);
    if (!phone.startsWith('84') && phone.length < 10) return '84' + phone;
    return phone;
}

class CustomerAuthService {

    // --- HELPER: Create Tokens & Store Session in Redis ---
    private async createSession(account: any) {
        const payload = { customerId: account.customerId, role: 'customer' as const };
        
        const accessToken = generateAccessToken(payload);
        const refreshToken = generateRefreshToken(payload);

        // ✅ STORE IN REDIS (Instead of DB)
        // Key format managed inside cs-redis service
        await csRedis.setSessionRefreshToken(account.id, refreshToken);

        // Update Last Login in DB (For tracking only, auth relies on Redis)
        await prisma.customerAccount.update({
            where: { id: account.id },
            data: { lastLogin: new Date() }
        });

        return { accessToken, refreshToken };
    }

    // --- HELPER: Rate Limit Check ---
    private async checkLoginRateLimit(phone: string) {
        const limit = await csRedis.checkRateLimit(
            `login:${phone}`, 
            5, // Max attempts
            CustomerCacheTTL.RATE_LIMIT_LOGIN // Window (15 mins)
        );

        if (!limit.allowed) {
            const minutesLeft = Math.ceil((limit.resetAt - Date.now()) / 60000);
            throw new AuthenticationError(`Tài khoản tạm khóa do đăng nhập sai quá nhiều lần. Vui lòng thử lại sau ${minutesLeft} phút.`);
        }
    }

    private async resetLoginRateLimit(phone: string) {
        await csRedis.resetRateLimit(`login:${phone}`);
    }

    // =================================================================
    // 1. SYNC PHONE ACCOUNT (Register / Login via OTP)
    // =================================================================
    async syncPhoneAccount(payload: { uid: string; phone: string; password?: string }) {
        const normalizedPhone = normalizePhone(payload.phone);

        // 1. Check Rate Limit
        await this.checkLoginRateLimit(normalizedPhone);

        let account = await prisma.customerAccount.findUnique({
            where: { accountIdentifier: payload.uid },
            include: { customer: true }
        });

        // 2. If account doesn't exist, create it
        if (!account) {
            let customer = await prisma.customer.findFirst({ where: { phone: normalizedPhone } });
            
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

            let passwordHash = null;
            if (payload.password) {
                passwordHash = await hashPassword(payload.password);
            }

            account = await prisma.customerAccount.create({
                data: {
                    customerId: customer.id,
                    accountIdentifier: payload.uid,
                    authProvider: AuthProvider.PHONE,
                    isVerified: true,
                    isActive: true,
                    lastLogin: new Date(),
                    passwordHash: passwordHash 
                },
                include: { customer: true }
            });
        }

        if (!account.isActive) throw new AuthorizationError('Tài khoản đã bị khóa');

        // 3. Login Success -> Reset Rate Limit
        await this.resetLoginRateLimit(normalizedPhone);

        // 4. Create Session (Redis)
        const tokens = await this.createSession(account);

        return {
            customer: account.customer,
            tokens,
            requirePasswordSet: !account.passwordHash
        };
    }

    // =================================================================
    // 2. SYNC SOCIAL ACCOUNT
    // =================================================================
    async syncSocialAccount(payload: { uid: string; email?: string; name: string; avatar?: string; provider: AuthProvider }) {
        let account = await prisma.customerAccount.findUnique({
            where: { accountIdentifier: payload.uid },
            include: { customer: true }
        });

        if (!account) {
             let customer = await prisma.customer.findFirst({ where: { email: payload.email } });
             if (!customer) {
                 customer = await prisma.customer.create({
                    data: {
                        customerCode: `KH-${Date.now()}`,
                        customerName: payload.name || 'Khách hàng mới',
                        email: payload.email,
                        avatarUrl: payload.avatar,
                        customerType: CustomerType.individual,
                        contactPerson: payload.name,
                        phone: '', // Empty phone, can be updated later
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
                    lastLogin: new Date()
                },
                include: { customer: true }
             });
        }

        if (!account.isActive) throw new AuthorizationError('Tài khoản đã bị khóa');

        // Create Session (Redis)
        const tokens = await this.createSession(account);

        const requirePhoneCheck = customerService.checkIfNeedPhoneVerification(
            account.customer,
            account.authProvider
        );

        return {
            customer: account.customer,
            tokens,
            requirePasswordSet: false,
            requirePhoneCheck
        };
    }

    // =================================================================
    // 3. SET PASSWORD
    // =================================================================
    async setPassword(phoneInput: string, uid: string, newPassword: string) {
        const normalizedPhone = normalizePhone(phoneInput);

        const account = await prisma.customerAccount.findUnique({
            where: { accountIdentifier: uid },
            include: { customer: true },
        });

        if (!account) {
            throw new AuthenticationError('Invalid account identifier (UID)');
        }

        if (account.customer.phone && account.customer.phone !== normalizedPhone) {
            throw new AuthenticationError('Phone number mismatch with verified account');
        }

        // Update phone if missing
        if (!account.customer.phone) {
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

        await prisma.customerAccount.update({
            where: { id: account.id },
            data: {
                passwordHash: hash,
                isVerified: true
            },
        });

        // Create Session (Redis)
        const tokens = await this.createSession(account);
        
        return { tokens, message: 'Password updated successfully' };
    }

    // =================================================================
    // 4. LOGIN WITH PASSWORD
    // =================================================================
    async loginWithPassword(phoneInput: string, password: string) {
        const phone = normalizePhone(phoneInput);

        // 1. Check Rate Limit
        await this.checkLoginRateLimit(phone);

        const customer = await prisma.customer.findFirst({ where: { phone } });
        // Fail generically to avoid username enumeration
        if (!customer) {
            // But verify limit first
            throw new AuthenticationError('Số điện thoại hoặc mật khẩu không đúng');
        }

        const account = await prisma.customerAccount.findUnique({
            where: { customerId: customer.id },
            include: { customer: true }
        });

        if (!account || !account.passwordHash) {
            throw new AuthenticationError('Chưa thiết lập mật khẩu. Vui lòng đăng nhập bằng OTP.');
        }

        if (!account.isActive) throw new AuthorizationError('Tài khoản đã bị khóa');

        const isMatch = await comparePassword(password, account.passwordHash);
        if (!isMatch) {
            throw new AuthenticationError('Số điện thoại hoặc mật khẩu không đúng');
        }

        // 2. Success -> Reset Rate Limit
        await this.resetLoginRateLimit(phone);

        // 3. Create Session (Redis)
        const tokens = await this.createSession(account);

        return { customer: account.customer, tokens };
    }

    // =================================================================
    // 5. REFRESH TOKEN
    // =================================================================
    async refreshAccessToken(refreshTokenInput: string) {
        // Verify signature
        const decoded = verifyRefreshToken(refreshTokenInput);

        // Find Account
        // Note: Ideally JWT should have accountId. Using customerId implies looking up account.
        // Assuming 1-to-1 relation for simplicty here, or findUnique by customerId.
        const account = await prisma.customerAccount.findUnique({
            where: { customerId: decoded.customerId },
        });

        if (!account || !account.isActive) {
            throw new AuthenticationError('Account not found or inactive');
        }

        // ✅ Check Redis
        const storedToken = await csRedis.getSessionRefreshToken(account.id);

        if (!storedToken || storedToken !== refreshTokenInput) {
            // Security: If tokens don't match, it might be reuse attack -> Clear session
            await csRedis.clearSession(account.id);
            throw new AuthenticationError('Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
        }

        // Rotate Tokens
        const tokens = await this.createSession(account);

        return tokens;
    }

    // =================================================================
    // 6. LOGOUT
    // =================================================================
    async logout(customerId: number, accessToken: string) {
        const account = await prisma.customerAccount.findUnique({ where: { customerId } });
        
        if (account) {
            // Remove Refresh Token from Redis
            await csRedis.clearSession(account.id);
        }

        // Blacklist Access Token
        await csRedis.blacklistToken(accessToken);

        return { message: 'Đăng xuất thành công' };
    }

    // =================================================================
    // 7. CHECK PHONE EXISTENCE
    // =================================================================
    async checkPhoneExistence(phoneInput: string) {
        const phone = normalizePhone(phoneInput);

        const customer = await prisma.customer.findFirst({
            where: { phone },
            include: { customerAccount: true }
        });

        if (customer) {
            const account = customer.customerAccount?.[0];
            return {
                exists: true,
                hasPassword: !!account?.passwordHash,
                name: customer.customerName,
                canLoginWithPassword: !!account?.passwordHash
            };
        }

        return { exists: false };
    }

    // =================================================================
    // 7. GET ACCOUNT BY CUSTOMER ID (Dùng cho API lấy Profile)
    // =================================================================
    async getAccountByCustomerId(customerId: number) {
        // Tận dụng Cache nếu có (Key: c_cache:account:{customerId})
        const cacheKey = `c_cache:account:${customerId}`; 
        
        const cached = await csRedis.get(cacheKey);
        if (cached) return cached;

        const account = await prisma.customerAccount.findUnique({
            where: { customerId },
            include: { customer: true }
        });

        if (!account) throw new NotFoundError('Tài khoản không tồn tại');

        // Cache lại 1 giờ
        await csRedis.set(cacheKey, account, 3600); 
        return account;
    }


    
}

export default new CustomerAuthService();