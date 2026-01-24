import { Response, NextFunction, Request } from 'express'; 
import { AuthRequest } from '@custom-types/common.type';
import { AuthenticationError, AuthorizationError } from '@utils/errors';
import { verifyAccessToken } from '@utils/cs-jwt'; 
import { PrismaClient } from '@prisma/client';
import CustomerRedisService from '@services/cs-redis.service'; // ✅ Import CS Redis

const prisma = new PrismaClient();
const csRedis = CustomerRedisService.getInstance(); // ✅ Instance Redis

// Hàm xử lý chính (Async)
const verifyCustomer = async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new AuthenticationError('No token provided');
        }

        const token = authHeader.split(' ')[1];

        // ✅ 1. Check Redis Blacklist (Quan trọng)
        const isBlacklisted = await csRedis.isTokenBlacklisted(token);
        if (isBlacklisted) {
            throw new AuthenticationError('Token has been revoked (Logged out)');
        }

        // ✅ 2. Verify Token
        const decoded = verifyAccessToken(token); 

        if (!decoded || !decoded.customerId || decoded.role !== 'customer') {
            throw new AuthenticationError('Invalid token payload');
        }

        // ✅ 3. Lấy thông tin Account
        // Có thể cache bước này vào Redis để tăng tốc nếu muốn (đã làm trong Service getAccount)
        // Nhưng ở middleware để an toàn cứ query DB check status isActive
        const account = await prisma.customerAccount.findUnique({
            where: { customerId: decoded.customerId },
            include: { customer: true }
        });

        if (!account) {
            throw new AuthenticationError('Account not found'); 
        }

        if (!account.isActive) {
            throw new AuthorizationError('Account is locked'); 
        }

        const { id: accountId, ...accountData } = account;
        const customerData = account.customer;

        req.user = {
            ...accountData, 
            accountId: accountId, 
            id: customerData.id, 
            customer: customerData, 
            role: 'customer',
        } as any; 

        next();

    } catch (error) {
        next(error); 
    }
};

// Wrapper Middleware
export const customerAuthentication = (req: Request, res: Response, next: NextFunction) => {
    verifyCustomer(req as AuthRequest, res, next).catch(next);
};

// 👇 MIDDLEWARE OPTIONAL AUTH (Đã thêm check blacklist)
export const optionalCustomerAuthentication = async (req: Request, _res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        
        // 1. Nếu không có token -> Coi như khách vãng lai -> NEXT
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }

        const token = authHeader.split(' ')[1];

        // ✅ 2. Check Blacklist cho cả Optional Auth
        const isBlacklisted = await csRedis.isTokenBlacklisted(token);
        if (isBlacklisted) {
            // Token không hợp lệ -> coi như chưa đăng nhập -> NEXT
            return next();
        }
        
        // 3. Verify Token
        let decoded;
        try {
            decoded = verifyAccessToken(token);
        } catch (err) {
            return next(); 
        }

        if (!decoded || !decoded.customerId) {
            return next();
        }

        // 4. Query Customer
        const customer = await prisma.customer.findUnique({
            where: { id: decoded.customerId },
            select: { 
                id: true, 
                classification: true,
                status: true
            }
        });

        if (!customer || customer.status !== 'active') {
            return next();
        }

        // 5. Gắn user vào request
        (req as any).user = {
            id: customer.id,
            classification: customer.classification,
            role: 'customer'
        };

        next();

    } catch (error) {
        // Lỗi gì cũng cho qua (coi như khách vãng lai)
        next();
    }
};