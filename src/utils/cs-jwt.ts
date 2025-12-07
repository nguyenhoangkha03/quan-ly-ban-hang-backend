const jwt = require('jsonwebtoken');
import { AuthenticationError } from '@utils/errors';

// Sử dụng chung Key với Admin hoặc tách riêng tùy bạn. 
const ACCESS_SECRET = process.env.CUSTOMER_JWT_SECRET || 'default_customer_access_secret'; // Đổi tên biến môi trường cho rõ ràng
const REFRESH_SECRET = process.env.CUSTOMER_JWT_REFRESH_SECRET || 'default_customer_refresh_secret'; // Đổi tên biến môi trường cho rõ ràng
const ACCESS_EXPIRES = process.env.CUSTOMER_JWT_EXPIRES_IN || '1h'; // Đổi tên biến môi trường cho rõ ràng
const REFRESH_EXPIRES = process.env.CUSTOMER_JWT_REFRESH_EXPIRES_IN || '7d'; // Đổi tên biến môi trường cho rõ ràng

// Định nghĩa Payload riêng cho Customer
export interface CustomerJwtPayload {
    // Nên sử dụng customerId để khớp với mô hình CustomerAccount
    customerId: number; 
    role: 'customer'; // Nên dùng hằng số cố định ('customer')
}

// Hàm tạo Access Token
export const generateAccessToken = (payload: CustomerJwtPayload): string => {
    return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES });
};

// Hàm tạo Refresh Token
export const generateRefreshToken = (payload: CustomerJwtPayload): string => {
    return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });
};

// Hàm xác thực Access Token
export const verifyAccessToken = (token: string): CustomerJwtPayload => {
    try {
        // Ép kiểu trực tiếp khi gọi hàm verify
        return jwt.verify(token, ACCESS_SECRET) as CustomerJwtPayload;
    } catch (error: any) {
        if (error.name === 'TokenExpiredError') {
            throw new AuthenticationError('Token expired');
        }
        // Thêm xử lý lỗi phổ biến khác của JWT
        if (error.name === 'JsonWebTokenError') {
            throw new AuthenticationError('Invalid token signature');
        }
        throw new AuthenticationError('Invalid token');
    }
};

// Hàm xác thực Refresh Token
export const verifyRefreshToken = (token: string): CustomerJwtPayload => {
    try {
        return jwt.verify(token, REFRESH_SECRET) as CustomerJwtPayload;
    } catch (error: any) {
        if (error.name === 'TokenExpiredError') {
            throw new AuthenticationError('Refresh token expired');
        }
        // Thêm xử lý lỗi phổ biến khác của JWT
        if (error.name === 'JsonWebTokenError') {
            throw new AuthenticationError('Invalid refresh token signature');
        }
        throw new AuthenticationError('Invalid refresh token');
    }
};