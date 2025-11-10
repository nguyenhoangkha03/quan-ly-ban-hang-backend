import { PrismaClient, Prisma } from '@prisma/client';
import { NotFoundError, ValidationError, ConflictError } from '@utils/errors';
import RedisService, { CachePrefix } from './redis.service';
import { logActivity } from '@utils/logger';
import uploadService from './upload.service';
import path from 'path';

const prisma = new PrismaClient();
const redis = RedisService.getInstance();

const PRODUCT_CACHE_TTL = parseInt(process.env.CACHE_TTL_PRODUCTS || '3600');

class ProductService {
  private async generateSKU(productType: string): Promise<string> {
    const prefix = this.getSKUPrefix(productType);
    const count = await prisma.product.count({
      where: { productType: productType as any },
    });
    const number = (count + 1).toString().padStart(4, '0');
    return `${prefix}-${number}`;
  }

  private getSKUPrefix(productType: string): string {
    const prefixes: Record<string, string> = {
      raw_material: 'NL',
      packaging: 'BB',
      finished_product: 'TP',
      goods: 'HH',
    };
    return prefixes[productType] || 'PRD';
  }

  private generateSlug(productName: string): string {
    return productName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async getAll(params: {
    page: number;
    limit: number;
    search?: string;
    productType?: string;
    categoryId?: number;
    supplierId?: number;
    status?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const {
      page = 1,
      limit = 20,
      search,
      productType,
      categoryId,
      supplierId,
      status,
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

    await redis.set(cacheKey, product, PRODUCT_CACHE_TTL);

    return product;
  }

  async create(
    data: {
      sku?: string;
      productName: string;
      productType: string;
      packagingType?: string;
      categoryId?: number;
      supplierId?: number;
      unit?: string;
      barcode?: string;
      weight?: number;
      dimensions?: string;
      description?: string;
      purchasePrice?: number;
      sellingPriceRetail?: number;
      sellingPriceWholesale?: number;
      sellingPriceVip?: number;
      taxRate?: number;
      minStockLevel?: number;
      expiryDate?: string | Date;
      status?: string;
    },
    userId: number
  ) {
    if (data.categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: data.categoryId },
      });
      if (!category) {
        throw new NotFoundError('Category');
      }
    }

    if (data.supplierId) {
      const supplier = await prisma.supplier.findUnique({
        where: { id: data.supplierId },
      });
      if (!supplier) {
        throw new NotFoundError('Supplier');
      }
    }

    const sku = data.sku || (await this.generateSKU(data.productType));

    const existingSKU = await prisma.product.findUnique({
      where: { sku },
    });
    if (existingSKU) {
      throw new ConflictError('SKU already exists', { sku });
    }

    const slug = this.generateSlug(data.productName);

    let finalSlug = slug;
    let counter = 1;
    while (
      await prisma.product.findUnique({
        where: { slug: finalSlug },
      })
    ) {
      finalSlug = `${slug}-${counter}`;
      counter++;
    }

    if (data.productType === 'packaging' && !data.packagingType) {
      throw new ValidationError('Packaging type is required for packaging products');
    }

    const product = await prisma.product.create({
      data: {
        sku,
        slug: finalSlug,
        productName: data.productName,
        productType: data.productType as any,
        packagingType: data.packagingType as any,
        categoryId: data.categoryId,
        supplierId: data.supplierId,
        unit: data.unit,
        barcode: data.barcode,
        weight: data.weight,
        dimensions: data.dimensions,
        description: data.description,
        purchasePrice: data.purchasePrice,
        sellingPriceRetail: data.sellingPriceRetail,
        sellingPriceWholesale: data.sellingPriceWholesale,
        sellingPriceVip: data.sellingPriceVip,
        taxRate: data.taxRate,
        minStockLevel: data.minStockLevel,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        status: (data.status as any) || 'active',
        createdBy: userId,
      },
      include: {
        category: true,
        supplier: true,
        images: true,
      },
    });

    logActivity('create', userId, 'products', {
      recordId: product.id,
      newValue: product,
    });

    await this.invalidateCache();

    return product;
  }

  async update(id: number, data: Partial<Prisma.ProductUncheckedUpdateInput>, userId: number) {
    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      throw new NotFoundError('Product');
    }

    if (data.categoryId !== undefined && data.categoryId !== null) {
      const category = await prisma.category.findUnique({
        where: { id: data.categoryId as number },
      });
      if (!category) {
        throw new NotFoundError('Category');
      }
    }

    if (data.supplierId !== undefined && data.supplierId !== null) {
      const supplier = await prisma.supplier.findUnique({
        where: { id: data.supplierId as number },
      });
      if (!supplier) {
        throw new NotFoundError('Supplier');
      }
    }

    if (data.sku && data.sku !== existingProduct.sku) {
      const existingSKU = await prisma.product.findUnique({
        where: { sku: data.sku as string },
      });
      if (existingSKU) {
        throw new ConflictError('SKU already exists', { sku: data.sku });
      }
    }

    let slug = existingProduct.slug;
    if (data.productName && data.productName !== existingProduct.productName) {
      slug = this.generateSlug(data.productName as string);

      let finalSlug = slug;
      let counter = 1;
      while (
        await prisma.product.findFirst({
          where: {
            slug: finalSlug,
            id: { not: id },
          },
        })
      ) {
        finalSlug = `${slug}-${counter}`;
        counter++;
      }
      slug = finalSlug;
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...data,
        slug,
        updatedBy: userId,
      },
      include: {
        category: true,
        supplier: true,
        images: true,
      },
    });

    logActivity('update', userId, 'products', {
      recordId: id,
      oldValue: existingProduct,
      newValue: product,
    });

    await this.invalidateCache(id);

    return product;
  }

  async delete(id: number, userId: number) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        images: true,
        inventory: true,
        purchaseOrderDetails: true,
        salesOrderDetails: true,
        bomMaterials: true,
        productionOrderMaterials: true,
      },
    });

    if (!product) {
      throw new NotFoundError('Product');
    }

    if (product.inventory.length > 0) {
      const totalStock = product.inventory.reduce((sum, inv) => sum + Number(inv.quantity), 0);
      if (totalStock > 0) {
        throw new ValidationError(
          'Cannot delete product with existing inventory. Please clear inventory first.'
        );
      }
    }

    if (product.purchaseOrderDetails.length > 0 || product.salesOrderDetails.length > 0) {
      throw new ValidationError(
        'Cannot delete product that has been used in orders. Consider marking it as discontinued instead.'
      );
    }

    if (product.bomMaterials.length > 0 || product.productionOrderMaterials.length > 0) {
      throw new ValidationError(
        'Cannot delete product that is used in production. Consider marking it as discontinued instead.'
      );
    }

    for (const image of product.images) {
      await uploadService.deleteFile(image.imageUrl);
    }

    await prisma.product.delete({
      where: { id },
    });

    logActivity('delete', userId, 'products', {
      recordId: id,
      oldValue: product,
    });

    await this.invalidateCache(id);

    return { message: 'Product deleted successfully' };
  }

  async getLowStock(warehouseId?: number) {
    const products = await prisma.product.findMany({
      where: {
        status: 'active',
        minStockLevel: { gt: 0 },
      },
      include: {
        category: true,
        inventory: warehouseId
          ? {
              where: { warehouseId },
              include: { warehouse: true },
            }
          : {
              include: { warehouse: true },
            },
      },
    });

    const lowStockProducts = products
      .map((product) => {
        const totalStock = product.inventory.reduce((sum, inv) => sum + Number(inv.quantity), 0);
        const availableStock = product.inventory.reduce(
          (sum, inv) => sum + Number(inv.quantity) - Number(inv.reservedQuantity),
          0
        );

        return {
          ...product,
          totalStock,
          availableStock,
          shortfall: Number(product.minStockLevel) - availableStock,
        };
      })
      .filter((p) => p.availableStock < Number(p.minStockLevel));

    return lowStockProducts;
  }

  async getExpiringSoon(days: number = 7) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const products = await prisma.product.findMany({
      where: {
        status: 'active',
        expiryDate: {
          lte: futureDate,
          gte: new Date(),
        },
      },
      include: {
        category: true,
        supplier: true,
        inventory: {
          include: { warehouse: true },
        },
      },
      orderBy: {
        expiryDate: 'asc',
      },
    });

    return products.map((product) => ({
      ...product,
      daysUntilExpiry: Math.ceil(
        (new Date(product.expiryDate!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      ),
    }));
  }

  async uploadImages(
    productId: number,
    files: Express.Multer.File[],
    imageMetadata: Array<{
      imageType?: string;
      altText?: string;
      isPrimary?: boolean;
      displayOrder?: number;
    }>,
    userId: number
  ) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { images: true },
    });

    if (!product) {
      throw new NotFoundError('Product');
    }

    if (product.images.length + files.length > 5) {
      throw new ValidationError('Maximum 5 images allowed per product');
    }

    const uploadedImages = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const metadata = imageMetadata[i] || {};

      const processedPath = await this.processProductImage(file, productId);

      const image = await prisma.productImage.create({
        data: {
          productId,
          imageUrl: processedPath,
          imageType: (metadata.imageType as any) || 'gallery',
          altText: metadata.altText,
          isPrimary: metadata.isPrimary || false,
          displayOrder: metadata.displayOrder || i,
          uploadedBy: userId,
        },
      });

      uploadedImages.push(image);
    }

    logActivity('update', userId, 'products', {
      recordId: productId,
      action: 'upload_images',
      newValue: uploadedImages,
    });

    await this.invalidateCache(productId);

    return uploadedImages;
  }

  private async processProductImage(file: Express.Multer.File, productId: number): Promise<string> {
    const uploadDir = path.join(process.env.UPLOAD_DIR || './uploads', 'products');
    const sharp = require('sharp');
    const fs = require('fs/promises');

    await fs.mkdir(uploadDir, { recursive: true });

    const ext = path.extname(file.originalname);
    const filename = `product-${productId}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const outputPath = path.join(uploadDir, filename);

    await sharp(file.path)
      .resize(800, 800, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 90 })
      .toFile(outputPath);

    await uploadService.deleteFile(file.path);

    return `/uploads/products/${filename}`;
  }

  async deleteImage(productId: number, imageId: number, userId: number) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundError('Product');
    }

    const image = await prisma.productImage.findFirst({
      where: {
        id: imageId,
        productId,
      },
    });

    if (!image) {
      throw new NotFoundError('Image');
    }

    await uploadService.deleteFile(image.imageUrl);

    await prisma.productImage.delete({
      where: { id: imageId },
    });

    logActivity('update', userId, 'products', {
      recordId: productId,
      action: 'delete_image',
      oldValue: image,
    });

    await this.invalidateCache(productId);

    return { message: 'Image deleted successfully' };
  }

  private async invalidateCache(productId?: number) {
    if (productId) {
      await redis.del(`${CachePrefix.PRODUCT}${productId}`);
    }

    await redis.flushPattern(`${CachePrefix.PRODUCT}list:*`);
  }
}

export default new ProductService();
