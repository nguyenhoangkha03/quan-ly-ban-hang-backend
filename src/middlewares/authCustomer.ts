import { Response, NextFunction, Request } from 'express'; 
import { AuthRequest } from '@custom-types/common.type';
import { AuthenticationError, AuthorizationError} from '@utils/errors'; // Thêm ForbiddenError
import { verifyAccessToken } from '@utils/cs-jwt'; 
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Hàm xử lý chính (Async)
const verifyCustomer = async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try { // Bọc toàn bộ logic trong try-catch để bắt lỗi đồng bộ và bất đồng bộ
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            // Lỗi 401: Unauthorized
            throw new AuthenticationError('No token provided or invalid format');
        }

        const token = authHeader.split(' ')[1];
        // decoded chứa { customerId, role }
        const decoded = verifyAccessToken(token); 

        // Kiểm tra payload
        if (!decoded || !decoded.customerId || decoded.role !== 'customer') {
            throw new AuthenticationError('Invalid token payload or incorrect role');
        }

        // 1. Tìm kiếm CustomerAccount qua customerId
        const account = await prisma.customerAccount.findUnique({
            where: { customerId: decoded.customerId },
            include: { customer: true }
        });

        if (!account) {
            // Có token hợp lệ nhưng không tìm thấy tài khoản (đã bị xóa?)
            throw new AuthenticationError('Account not found'); 
        }

        // 2. Kiểm tra trạng thái tài khoản
        if (!account.isActive) {
            // Lỗi 403: Forbidden
            throw new AuthorizationError('Account is currently inactive or locked'); 
        }

        // 3. Đính kèm thông tin tài khoản đã xử lý vào request.user
        const { id: accountId, ...accountData } = account;
        const customerData = account.customer;

        req.user = {
            // Dữ liệu từ CustomerAccount
            ...accountData, 
            accountId: accountId, // ID của CustomerAccount
            // Dữ liệu từ Customer (Id chính của Customer)
            id: customerData.id, 
            customer: customerData, // Thông tin chi tiết của khách hàng
            role: 'customer',
        } as any; // Tùy thuộc vào định nghĩa AuthRequest của bạn, có thể cần type casting

        next();

    } catch (error) {
        // Đẩy lỗi sang Express Error Handler
        next(error); 
    }
};

// Wrapper Middleware (Phải có đủ 3 tham số)
export const customerAuthentication = (req: Request, res: Response, next: NextFunction) => {
    // Truyền đủ 3 tham số và bắt lỗi để Express xử lý
    verifyCustomer(req as AuthRequest, res, next).catch(next);
};