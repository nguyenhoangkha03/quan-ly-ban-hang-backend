import { PrismaClient, Prisma } from '@prisma/client';
import { NotFoundError } from '@utils/errors';
import RedisService, { CachePrefix } from './redis.service';
// Bỏ logActivity, uploadService, path
import {
    ProductQueryInput,
    // Bỏ qua CreateProductInput, UpdateProductInput
} from '@validators/product.validator';
import { serializeBigInt } from '@utils/serializer';

const prisma = new PrismaClient();
const redis = RedisService.getInstance();

const PRODUCT_CACHE_TTL = parseInt(process.env.CACHE_TTL_PRODUCTS || '3600');

class PublicProductService {
    
    // ========================================================
    // HELPER FUNCTIONS (Giữ lại các hàm tạo Slug)
    // ========================================================

    // private generateSlug(productName: string): string {
    //     return productName
    //         .toLowerCase()
    //         .normalize('NFD')
    //         .replace(/[\u0300-\u036f]/g, '')
    //         .replace(/[đĐ]/g, 'd')
    //         .replace(/[^a-z0-9]+/g, '-')
    //         .replace(/^-+|-+$/g, '');
    // }

    // Bỏ qua generateSKU và getSKUPrefix (vì không dùng tạo mới)

    // ========================================================
    // 1. GET ALL PRODUCTS (Danh sách có phân trang và filter)
    // ========================================================

    async getAll(params: ProductQueryInput) {
        const {
            page = 1,
            limit = 20,
            search,
            productType,
            categoryId,
            // Bỏ qua supplierId (thông tin nội bộ)
            // Bỏ qua status (luôn ép buộc là 'active')
            sortBy = 'createdAt',
            sortOrder = 'desc',
        } = params;

        const offset = (page - 1) * limit;
        
        // Luôn ép buộc trạng thái là 'active'
        const activeStatus: 'active' = 'active'; 

        const where: Prisma.ProductWhereInput = {
            status: activeStatus, // QUAN TRỌNG: Chỉ lấy sản phẩm đang hoạt động
            ...(search && {
                OR: [
                    { productName: { contains: search } },
                    { sku: { contains: search } },
                ],
            }),
            ...(productType && { productType: productType as any }),
            ...(categoryId && { categoryId }),
        };

        const total = await prisma.product.count({ where });

        const products = await prisma.product.findMany({
            where,
            // Giảm thiểu includes, chỉ giữ lại thông tin cần thiết cho Khách hàng
            include: {
                category: {
                    select: { id: true, categoryName: true },
                },
                images: {
                    where: { isPrimary: true }, // Chỉ lấy ảnh primary cho danh sách
                    orderBy: { displayOrder: 'asc' },
                    select: { imageUrl: true, altText: true },
                },
                // Bỏ qua supplier, creator, _count(inventory)
            },
            orderBy: { [sortBy]: sortOrder },
            skip: offset,
            take: limit,
        });

        return {
            products,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    // ========================================================
    // 2. GET PRODUCT BY ID (Chi tiết sản phẩm)
    // ========================================================

    async getById(id: number) {
        const cacheKey = `${CachePrefix.PRODUCT}public:${id}`;
        const cached = await redis.get(cacheKey);
        if (cached) {
            // Khách hàng đã kiểm tra status trong Controller, nhưng chúng ta vẫn nên kiểm tra lại
            const parsed = JSON.parse(cached);
            if (parsed.status !== 'active') {
                throw new NotFoundError('Product');
            }
            return parsed;
        }
        
        // Luôn lọc trạng thái là 'active'
        const product = await prisma.product.findUnique({
            where: { id, status: 'active' as const }, 
            // Giữ lại include cần thiết cho trang chi tiết sản phẩm
            include: {
                category: {
                    select: { id: true, categoryName: true },
                },
                // Bỏ include supplier, creator, updater
                images: {
                    orderBy: { displayOrder: 'asc' }, // Lấy tất cả ảnh gallery
                },
                videos: {
                    orderBy: { displayOrder: 'asc' },
                },
                // Chỉ lấy tổng số lượng kho nếu cần thiết (Khách hàng thường không xem inventory chi tiết)
                inventory: { 
                    select: { quantity: true, reservedQuantity: true },
                },
            },
        });

        if (!product) {
            throw new NotFoundError('Product');
        }
        
        // Xử lý tổng kho cho Khách hàng
        const totalStock = product.inventory.reduce((sum, inv) => sum + Number(inv.quantity), 0);
        const availableStock = product.inventory.reduce(
            (sum, inv) => sum + Number(inv.quantity) - Number(inv.reservedQuantity),
            0
        );

        const serializedProduct = {
            ...product,
            videos: product.videos?.map((video) => serializeBigInt(video)),
            // Thêm thông tin kho đơn giản
            totalStock,
            availableStock,
            inventory: undefined, // Loại bỏ chi tiết inventory
        };

        await redis.set(cacheKey, serializedProduct, PRODUCT_CACHE_TTL);

        return serializedProduct;
    }

    // ========================================================
    // BỎ QUA CÁC HÀM ADMIN/CS: 
    // create, update, delete, getLowStock, getExpiringSoon, 
    // uploadImages, deleteImage, setPrimaryImage, processProductImage, 
    // uploadVideos, deleteVideo, setPrimaryVideo, processProductVideo
    // ========================================================

    // private async invalidateCache(productId?: number) {
    //     if (productId) {
    //         await redis.del(`${CachePrefix.PRODUCT}public:${productId}`);
    //     }
    //     // Dùng flushPattern an toàn hơn là hardcoded keys
    //     await redis.flushPattern(`${CachePrefix.PRODUCT}list:*`);
    // }
}

export default new PublicProductService();