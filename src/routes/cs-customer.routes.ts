import { Router } from 'express';
// Đổi tên import Controller thành customerProfileController để phân biệt với Admin/CS Controller
import customerProfileController from '@controllers/cs-customer.controller'; 
import { customerAuthentication } from '@middlewares/authCustomer';
import { validateNested } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';
import {
    updateCustomerSchema
} from '@validators/customer.validator';

const router = Router();

// Áp dụng middleware xác thực cho TẤT CẢ các route
router.use(customerAuthentication); 

// ========================================================
// CUSTOMER END-USER ROUTES (Sử dụng ID từ Token - req.user.id)
// ========================================================

// GET /api/customers/profile - Lấy thông tin cá nhân của Khách hàng hiện tại
// Controller phải sử dụng customerService.getById(req.user.id)
router.get(
    '/profile',
    asyncHandler(customerProfileController.getById.bind(customerProfileController))
);

// PUT /api/customers/profile - Cập nhật thông tin cá nhân của Khách hàng hiện tại
// Controller phải sử dụng customerService.updateProfile(req.user.id, data)
router.put(
    '/profile',
    validateNested(updateCustomerSchema),
    asyncHandler(customerProfileController.updateProfile.bind(customerProfileController))
);

// GET /api/customers/debt - Lấy thông tin nợ của Khách hàng hiện tại
// Controller phải sử dụng customerService.getDebtInfo(req.user.id)
router.get(
    '/debt',
    asyncHandler(customerProfileController.getDebtInfo.bind(customerProfileController))
);

// GET /api/customers/orders - Lấy lịch sử đơn hàng của Khách hàng hiện tại
// Controller phải sử dụng customerService.getOrderHistory(req.user.id, ...)
router.get(
    '/orders',
    asyncHandler(customerProfileController.getOrderHistory.bind(customerProfileController))
);

export default router;