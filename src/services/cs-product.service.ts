import { PrismaClient, Prisma } from '@prisma/client';
import { NotFoundError } from '@utils/errors';
import RedisService, { CachePrefix } from './redis.service';
import {
  ProductQueryInput,
} from '@validators/product.validator';
import { serializeBigInt } from '@utils/serializer';

const prisma = new PrismaClient();
const redis = RedisService.getInstance();

const PRODUCT_CACHE_TTL = parseInt(process.env.CACHE_TTL_PRODUCTS || '3600');

class ProductService {

  async getAll(params: ProductQueryInput) {
    const {
      page = 1,
      limit = 20,
      search,
      productType,
      categoryId,
      supplierId,
      status = 'active',
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const offset = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      ...(search && {
        OR: [
          { productName: { contains: search } },
          { sku: { contains: search } },
          { barcode: { contains: search } },
        ],
      }),
      ...(productType && { productType: productType as any }),
      ...(categoryId && { categoryId }),
      ...(supplierId && { supplierId }),
      ...(status && { status: status as any }),
    };

    const total = await prisma.product.count({ where });

    const products = await prisma.product.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            categoryName: true,
            categoryCode: true,
          },
        },
        supplier: {
          select: {
            id: true,
            supplierName: true,
            supplierCode: true,
          },
        },
        images: {
          orderBy: { displayOrder: 'asc' },
          select: {
            id: true,
            imageUrl: true,
            imageType: true,
            altText: true,
            isPrimary: true,
            displayOrder: true,
          },
        },
        creator: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
          },
        },
        _count: {
          select: {
            inventory: true,
          },
        },
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

  async getById(id: number) {
    const cacheKey = `${CachePrefix.PRODUCT}${id}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return cached;
    }

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            id: true,
            categoryName: true,
            categoryCode: true,
          },
        },
        supplier: {
          select: {
            id: true,
            supplierName: true,
            supplierCode: true,
            phone: true,
            email: true,
          },
        },
        images: {
          orderBy: { displayOrder: 'asc' },
        },
        videos: {
          orderBy: { displayOrder: 'asc' },
        },
        creator: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
          },
        },
        updater: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
          },
        },
        inventory: {
          include: {
            warehouse: {
              select: {
                id: true,
                warehouseName: true,
                warehouseCode: true,
                warehouseType: true,
              },
            },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundError('Product');
    }

    // Serialize BigInt in videos before caching/returning
    const serializedProduct = {
      ...product,
      videos: product.videos?.map((video) => serializeBigInt(video)),
    };

    await redis.set(cacheKey, serializedProduct, PRODUCT_CACHE_TTL);

    return serializedProduct;
  }
}

export default new ProductService();
