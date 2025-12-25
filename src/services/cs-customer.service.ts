import { PrismaClient, Prisma } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '@utils/errors';
import RedisService, { CachePrefix } from '@services/redis.service';
import {
    UpdateCustomerInput,
    // Không cần import các Input dành cho Admin như CreateCustomerInput, CustomerQueryInput
} from '@validators/customer.validator';
import { calculateDebtMetrics } from '@utils/debt.util';


const prisma = new PrismaClient();
const redis = RedisService.getInstance();

const CUSTOMER_CACHE_TTL = 3600;

class CustomerService {

    // API: Xác nhận SĐT vẫn đang được sử dụng
    async confirmPhoneUsage(id: number) {
        return await prisma.customer.update({
            where: { id },
            data: { 
                phoneVerifiedAt: new Date() // Cập nhật thời gian hiện tại
            }
        });
    }

    // Helper: Kiểm tra xem có cần xác thực lại SĐT không
    // Trả về true nếu: Là Acc Social + Có SĐT + (Chưa verify bao giờ HOẶC Đã verify quá 3 tháng)
    checkIfNeedPhoneVerification(customer: any, authProvider: string): boolean {
        // Chỉ áp dụng cho tài khoản Social (GG/FB)
        if (authProvider === 'PHONE') return false; 
        
        // Nếu chưa có SĐT thì không cần check (vì sẽ bị bắt buộc nhập ở Profile rồi)
        if (!customer.phone || customer.phone.length < 8) return false;

        // Nếu chưa từng verify
        if (!customer.phoneVerifiedAt) return true;

        // Kiểm tra thời gian (3 tháng = 90 ngày)
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setDate(threeMonthsAgo.getDate() - 90);

        return new Date(customer.phoneVerifiedAt) < threeMonthsAgo;
    }

    // ========================================================
    // 1. GET PROFILE (Tái sử dụng logic getById của Admin)
    // Khách hàng sẽ lấy thông tin của chính họ qua ID từ Token
    // ========================================================
    async getById(id: number) {
        const cacheKey = `${CachePrefix.USER}customer:${id}`;
        const cached = await redis.get(cacheKey);
        if (cached) {
            return cached;
        }

        const customer = await prisma.customer.findUnique({
            where: { id },
            include: {
                customerAccount: {
                    select: {
                        authProvider: true
                    },
                },
                salesOrders: {
                    select: {
                        id: true,
                        orderCode: true,
                        orderDate: true,
                        orderStatus: true,
                        paymentStatus: true,
                        totalAmount: true,
                        paidAmount: true,
                    },
                    orderBy: { orderDate: 'desc' },
                    take: 10, // Giới hạn số đơn hàng gần đây
                },
            },
        });

        if (!customer) {
            throw new NotFoundError('Customer not found');
        }
        // Lấy provider từ account đầu tiên
        const provider = customer.customerAccount?.[0]?.authProvider || 'PHONE';

        // // Tính toán thông tin nợ (giữ nguyên logic)
        // const debtPercentage =
        //     Number(customer.creditLimit) > 0
        //         ? (Number(customer.currentDebt) / Number(customer.creditLimit)) * 100
        //         : 0;

        // const customerWithDebtInfo = {
        //     ...customer,
        //     debtPercentage: Math.round(debtPercentage * 100) / 100,
        //     isOverLimit: Number(customer.currentDebt) > Number(customer.creditLimit),
        //     availableCredit:
        //         Number(customer.creditLimit) - Number(customer.currentDebt) > 0
        //             ? Number(customer.creditLimit) - Number(customer.currentDebt)
        //             : 0,
        // };

        // await redis.set(cacheKey, customerWithDebtInfo, CUSTOMER_CACHE_TTL);

        // return customerWithDebtInfo;

        // --- SỬ DỤNG HÀM TÍNH TOÁN ---
        const debtMetrics = calculateDebtMetrics(customer.currentDebt, customer.creditLimit);

        const customerWithDebtInfo = {
            ...customer,
            authProvider: provider,
            ...debtMetrics, // Spread các thuộc tính: debtPercentage, isOverLimit, v.v.
        };

        await redis.set(cacheKey, customerWithDebtInfo, CUSTOMER_CACHE_TTL);
        return customerWithDebtInfo;
    }

    // ========================================================
    // 2. UPDATE PROFILE (Phiên bản giới hạn quyền cập nhật)
    // Khách hàng chỉ được cập nhật các trường an toàn
    // ========================================================
    async updateProfile(id: number, data: UpdateCustomerInput) {
        const customer = await prisma.customer.findUnique({
            where: { id },
        });

        if (!customer) {
            throw new NotFoundError('Customer not found');
        }

        // CHẶN: Không cho phép update Email dưới mọi hình thức
        // CHỈ: Xử lý Phone
        if (data.phone && data.phone !== customer.phone) {
             const exist = await prisma.customer.findFirst({ 
                where: { phone: data.phone, id: { not: id } } 
             });
             
             if (exist) {
                 throw new ConflictError('Số điện thoại này đã được sử dụng bởi tài khoản khác');
             }
             // Nếu không trùng -> Cho phép code chạy tiếp xuống dưới để update
        }

        // Chỉ cho phép cập nhật các trường Khách hàng được phép tự quản lý
        const safeData: Prisma.CustomerUpdateInput = {
            ...(data.customerName && { customerName: data.customerName }),
            ...(data.gender !== undefined && { gender: data.gender }),
            ...(data.contactPerson !== undefined && { contactPerson: data.contactPerson }),
            ...(data.address !== undefined && { address: data.address }),
            ...(data.province !== undefined && { province: data.province }),
            ...(data.district !== undefined && { district: data.district }),

            //cập nhật được số điện thoại nếu hợp lệ và không trùng
           ...(data.phone && { 
                phone: data.phone,
                // ✅ TỰ ĐỘNG CẬP NHẬT THỜI GIAN KHI ĐỔI SỐ
                phoneVerifiedAt: new Date() 
            }),
        };

        if (Object.keys(safeData).length === 0) {
            throw new ValidationError('No valid fields provided for update');
        }

        const updatedCustomer = await prisma.customer.update({
            where: { id },
            data: {
                ...safeData,
                updatedAt: new Date(), // Cập nhật thời gian
                // Bỏ updatedBy vì Khách hàng không phải là User hệ thống
            },
            // Bỏ includes không cần thiết
        });

        await redis.del(`${CachePrefix.USER}customer:${id}`);

        return updatedCustomer;
    }

    // ========================================================
    // 3. GET DEBT INFO (Lấy thông tin nợ của chính mình)
    // ========================================================
    async getDebtInfo(id: number) {
        // Tái sử dụng logic getDebtInfo của Admin, chỉ cần truyền ID từ token
        const customer = await prisma.customer.findUnique({
            where: { id },
            select: {
                id: true,
                customerCode: true,
                customerName: true,
                creditLimit: true,
                currentDebt: true,
                debtUpdatedAt: true,
                salesOrders: {
                    // Chỉ lấy các đơn hàng đang có nợ
                    where: {
                        orderStatus: {
                            in: ['pending', 'preparing', 'delivering', 'completed'],
                        },
                    },
                    select: {
                        id: true,
                        orderCode: true,
                        orderDate: true,
                        totalAmount: true,
                        paidAmount: true,
                        orderStatus: true,
                        paymentStatus: true,
                    },
                    orderBy: { orderDate: 'desc' },
                },
            },
        });

        if (!customer) {
            throw new NotFoundError('Customer not found');
        }

        const unpaidOrders = customer.salesOrders.map((order) => ({
            ...order,
            debtAmount: Number(order.totalAmount) - Number(order.paidAmount),
        }));

        // const debtPercentage =
        //     Number(customer.creditLimit) > 0
        //         ? (Number(customer.currentDebt) / Number(customer.creditLimit)) * 100
        //         : 0;

        // return {
        //     customerId: customer.id,
        //     customerCode: customer.customerCode,
        //     customerName: customer.customerName,
        //     creditLimit: Number(customer.creditLimit),
        //     currentDebt: Number(customer.currentDebt),
        //     availableCredit: Math.max(0, Number(customer.creditLimit) - Number(customer.currentDebt)),
        //     debtPercentage: Math.round(debtPercentage * 100) / 100,
        //     isOverLimit: Number(customer.currentDebt) > Number(customer.creditLimit),
        //     debtUpdatedAt: customer.debtUpdatedAt,
        //     unpaidOrders,
        //     totalUnpaidOrders: unpaidOrders.length,
        // };

        // --- SỬ DỤNG HÀM TÍNH TOÁN ---
        const debtMetrics = calculateDebtMetrics(customer.currentDebt, customer.creditLimit);
        // -----------------------------

        return {
            customerId: customer.id,
            customerCode: customer.customerCode,
            customerName: customer.customerName,
            creditLimit: Number(customer.creditLimit),
            currentDebt: Number(customer.currentDebt),
            debtUpdatedAt: customer.debtUpdatedAt,
            unpaidOrders,
            totalUnpaidOrders: unpaidOrders.length,
            ...debtMetrics, // Spread kết quả tính toán vào đây
        };
    }

    // ========================================================
    // 4. GET ORDER HISTORY (Lấy lịch sử đơn hàng của chính mình)
    // ========================================================
    async getOrderHistory(id: number, page: number = 1, limit: number = 20) {
        // Tái sử dụng logic getOrderHistory của Admin
        const customer = await prisma.customer.findUnique({
            where: { id },
        });

        if (!customer) {
            throw new NotFoundError('Customer not found');
        }

        const offset = (page - 1) * limit;

        const [orders, total] = await Promise.all([
            prisma.salesOrder.findMany({
                where: { customerId: id },
                select: {
                    id: true,
                    orderCode: true,
                    orderDate: true,
                    orderStatus: true,
                    paymentStatus: true,
                    totalAmount: true,
                    paidAmount: true,
                    salesChannel: true,
                    warehouse: {
                        select: {
                            id: true,
                            warehouseName: true,
                        },
                    },
                },
                skip: offset,
                take: limit,
                orderBy: { orderDate: 'desc' },
            }),
            prisma.salesOrder.count({ where: { customerId: id } }),
        ]);

        return {
            customer: {
                id: customer.id,
                customerCode: customer.customerCode,
                customerName: customer.customerName,
            },
            orders,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
}

export default new CustomerService();