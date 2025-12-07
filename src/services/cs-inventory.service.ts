import { PrismaClient } from '@prisma/client';
import { ValidationError } from '@utils/errors';


const prisma = new PrismaClient();


class PublicInventoryService {

    // ========================================================
    // 1. CHECK AVAILABILITY (Kiểm tra tính khả dụng)
    // ========================================================
    async checkAvailability(
        items: Array<{
            productId: number;
            warehouseId: number;
            quantity: number;
        }>
    ) {
        const results = [];

        for (const item of items) {
            // Bắt buộc phải có productId và quantity
            if (!item.productId || item.quantity === undefined || item.quantity <= 0) {
                throw new ValidationError('Invalid item data in request.');
            }

            // Tìm kiếm tồn kho (Bạn có thể cân nhắc bỏ warehouseId nếu Khách hàng không chọn kho)
            const inventory = await prisma.inventory.findUnique({
                where: {
                    warehouseId_productId: {
                        warehouseId: item.warehouseId,
                        productId: item.productId,
                    },
                },
                // Chỉ include các trường cần thiết cho việc kiểm tra
                include: {
                    product: {
                        select: { sku: true, productName: true, unit: true, status: true },
                    },
                    warehouse: {
                        select: { warehouseName: true },
                    },
                },
            });

            // Tương tự Admin: Nếu không tìm thấy record
            if (!inventory) {
                results.push({
                    productId: item.productId,
                    requestedQuantity: item.quantity,
                    isAvailable: false,
                    message: 'Sản phẩm không có sẵn (hoặc kho không tồn tại)',
                });
                continue;
            }

            // QUAN TRỌNG: Kiểm tra Sản phẩm có Active không
            if (inventory.product.status !== 'active') {
                results.push({
                    productId: item.productId,
                    requestedQuantity: item.quantity,
                    isAvailable: false,
                    message: 'Sản phẩm không hoạt động',
                });
                continue;
            }

            // Tính toán số lượng có sẵn
            const availableQty = Number(inventory.quantity) - Number(inventory.reservedQuantity);

            results.push({
                productId: item.productId,
                warehouseId: item.warehouseId,
                product: { sku: inventory.product.sku, productName: inventory.product.productName },
                warehouse: { warehouseName: inventory.warehouse.warehouseName },
                requestedQuantity: item.quantity,
                // BỎ currentQuantity, reservedQuantity (chi tiết nội bộ)
                availableQuantity: availableQty, // Vẫn trả về để khách hàng biết còn bao nhiêu
                isAvailable: availableQty >= item.quantity,
                shortfall: Math.max(0, item.quantity - availableQty),
                message:
                    availableQty >= item.quantity
                        ? 'Available'
                        : `Insufficient stock.`,
            });
        }

        const allAvailable = results.every((r) => r.isAvailable);

        return {
            allAvailable,
            items: results,
            summary: {
                totalItems: results.length,
                availableItems: results.filter((r) => r.isAvailable).length,
                unavailableItems: results.filter((r) => !r.isAvailable).length,
            },
        };
    }
}

export default new PublicInventoryService();