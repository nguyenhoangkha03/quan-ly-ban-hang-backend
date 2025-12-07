import { PrismaClient, Prisma } from '@prisma/client';
import { NotFoundError, ValidationError } from '@utils/errors';
import RedisService, { CachePrefix } from '@services/redis.service';
import {
    UpdateCustomerInput,
    // Không cần import các Input dành cho Admin như CreateCustomerInput, CustomerQueryInput
} from '@validators/customer.validator';


const prisma = new PrismaClient();
const redis = RedisService.getInstance();

const CUSTOMER_CACHE_TTL = 3600;

class CustomerService {

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
            // Bỏ include creator/updater vì không cần thiết cho khách hàng cuối
            include: {
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

        // Tính toán thông tin nợ (giữ nguyên logic)
        const debtPercentage =
            Number(customer.creditLimit) > 0
                ? (Number(customer.currentDebt) / Number(customer.creditLimit)) * 100
                : 0;

        const customerWithDebtInfo = {
            ...customer,
            debtPercentage: Math.round(debtPercentage * 100) / 100,
            isOverLimit: Number(customer.currentDebt) > Number(customer.creditLimit),
            availableCredit:
                Number(customer.creditLimit) - Number(customer.currentDebt) > 0
                    ? Number(customer.creditLimit) - Number(customer.currentDebt)
                    : 0,
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

        // *** LƯU Ý BẢO MẬT: Bỏ qua kiểm tra email/phone/taxCode trùng lặp ***
        // vì Khách hàng cuối thường không được phép tự ý thay đổi SĐT hoặc Email
        // (trừ khi có quy trình xác thực OTP/Email riêng). Nếu bạn cho phép, 
        // hãy đưa logic kiểm tra trùng lặp vào đây.

        // Chỉ cho phép cập nhật các trường Khách hàng được phép tự quản lý
        const safeData: Prisma.CustomerUpdateInput = {
            ...(data.customerName && { customerName: data.customerName }),
            ...(data.gender !== undefined && { gender: data.gender }),
            ...(data.contactPerson !== undefined && { contactPerson: data.contactPerson }),
            ...(data.address !== undefined && { address: data.address }),
            ...(data.province !== undefined && { province: data.province }),
            ...(data.district !== undefined && { district: data.district }),
            // Giữ nguyên các trường Phone/Email/TaxCode/Classification/CreditLimit...
            // để Khách hàng không thể tự sửa.
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

        const debtPercentage =
            Number(customer.creditLimit) > 0
                ? (Number(customer.currentDebt) / Number(customer.creditLimit)) * 100
                : 0;

        return {
            customerId: customer.id,
            customerCode: customer.customerCode,
            customerName: customer.customerName,
            creditLimit: Number(customer.creditLimit),
            currentDebt: Number(customer.currentDebt),
            availableCredit: Math.max(0, Number(customer.creditLimit) - Number(customer.currentDebt)),
            debtPercentage: Math.round(debtPercentage * 100) / 100,
            isOverLimit: Number(customer.currentDebt) > Number(customer.creditLimit),
            debtUpdatedAt: customer.debtUpdatedAt,
            unpaidOrders,
            totalUnpaidOrders: unpaidOrders.length,
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