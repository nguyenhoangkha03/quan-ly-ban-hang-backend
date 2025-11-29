import { PrismaClient, Prisma } from '@prisma/client';
import { NotFoundError, ValidationError, ConflictError } from '@utils/errors';
import RedisService, { CachePrefix } from './redis.service';
import { logActivity } from '@utils/logger';
import uploadService from './upload.service';
import {
  ProductQueryInput,
  CreateProductInput,
  UpdateProductInput,
} from '@validators/product.validator';
import path from 'path';
import { serializeBigInt } from '@utils/serializer';

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

  async getAll(params: ProductQueryInput) {
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

  async create(data: CreateProductInput, userId: number) {
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

  async update(id: number, data: UpdateProductInput, userId: number) {
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
        videos: true,
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

    // Delete all image files
    for (const image of product.images) {
      await uploadService.deleteFile(image.imageUrl);
    }

    // Delete all video files
    for (const video of product.videos) {
      await uploadService.deleteFile(video.videoUrl);
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

  private async processProductVideo(file: Express.Multer.File, productId: number): Promise<string> {
    const uploadDir = path.join(process.env.UPLOAD_DIR || './uploads', 'products');
    const fs = require('fs/promises');

    await fs.mkdir(uploadDir, { recursive: true });

    const ext = path.extname(file.originalname);
    const filename = `video-${productId}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const outputPath = path.join(uploadDir, filename);

    // Move file from temp location (AVATAR_DIR) to products directory
    await fs.rename(file.path, outputPath);

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

  /**
   * Set primary image for product
   */
  async setPrimaryImage(productId: number, imageId: number, userId: number) {
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

    // Reset all images to non-primary
    await prisma.productImage.updateMany({
      where: { productId },
      data: { isPrimary: false },
    });

    // Set the selected image as primary
    const updatedImage = await prisma.productImage.update({
      where: { id: imageId },
      data: { isPrimary: true },
    });

    logActivity('update', userId, 'products', {
      recordId: productId,
      action: 'set_primary_image',
      newValue: { imageId },
    });

    await this.invalidateCache(productId);

    return updatedImage;
  }

  // ===== VIDEO METHODS =====

  async uploadVideos(
    productId: number,
    files: Express.Multer.File[],
    videoMetadata: Array<{
      videoType?: string;
      title?: string;
      description?: string;
      isPrimary?: boolean;
      displayOrder?: number;
    }>,
    userId: number
  ) {
    // Validate product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { videos: true },
    });

    if (!product) {
      throw new NotFoundError('Product');
    }

    // Validate files
    if (!files || files.length === 0) {
      throw new ValidationError('At least one video file is required');
    }

    if (files.length > 5) {
      throw new ValidationError('Maximum 5 videos allowed per request');
    }

    // Validate total videos won't exceed limit
    if (product.videos.length + files.length > 5) {
      throw new ValidationError('Maximum 5 videos allowed per product');
    }

    // Validate each file
    const validVideoMimes = [
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo',
      'video/x-matroska',
      'video/webm',
    ];
    const maxFileSize = 500 * 1024 * 1024; // 500MB

    for (const file of files) {
      if (!validVideoMimes.includes(file.mimetype)) {
        throw new ValidationError(
          `Invalid video format: ${file.mimetype}. Supported: MP4, MOV, AVI, MKV, WebM`
        );
      }

      if (file.size > maxFileSize) {
        throw new ValidationError(
          `Video file too large. Maximum size: 500MB, Got: ${(file.size / 1024 / 1024).toFixed(
            2
          )}MB`
        );
      }
    }

    // Validate metadata
    for (let i = 0; i < videoMetadata.length; i++) {
      const meta = videoMetadata[i];

      if (
        meta.videoType &&
        !['demo', 'tutorial', 'review', 'unboxing', 'promotion', 'other'].includes(meta.videoType)
      ) {
        throw new ValidationError(`Invalid video type: ${meta.videoType}`);
      }

      if (meta.title && meta.title.length > 255) {
        throw new ValidationError(`Video title too long (max 255 characters)`);
      }

      if (meta.description && meta.description.length > 500) {
        throw new ValidationError(`Video description too long (max 500 characters)`);
      }

      if (meta.displayOrder !== undefined && meta.displayOrder < 0) {
        throw new ValidationError(`Display order cannot be negative`);
      }
    }

    const uploadedVideos = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const metadata = videoMetadata[i] || {};

      // Process video: move to products directory and rename
      const videoPath = await this.processProductVideo(file, productId);

      const video = await prisma.productVideo.create({
        data: {
          productId,
          videoUrl: videoPath,
          videoType: (metadata.videoType as any) || 'demo',
          title: metadata.title,
          description: metadata.description,
          isPrimary: metadata.isPrimary || false,
          displayOrder: metadata.displayOrder || i,
          uploadedBy: userId,
          fileSize: BigInt(file.size),
          // TODO: Extract duration and generate thumbnail using ffmpeg
          duration: null,
          thumbnail: null,
        },
      });

      uploadedVideos.push(video);
    }

    // Convert BigInt to String for JSON serialization
    const serializedVideos = serializeBigInt(uploadedVideos);

    logActivity('create', userId, 'product_videos', {
      recordId: productId,
      action: 'upload_videos',
      newValue: serializedVideos,
    });

    await this.invalidateCache(productId);

    return serializedVideos;
  }

  async deleteVideo(productId: number, videoId: number, userId: number) {
    // Validate product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundError('Product');
    }

    // Validate video exists and belongs to product
    const video = await prisma.productVideo.findFirst({
      where: {
        id: videoId,
        productId,
      },
    });

    if (!video) {
      throw new NotFoundError('Video not found for this product');
    }

    // Delete video file from storage
    await uploadService.deleteFile(video.videoUrl);

    // Delete from database
    await prisma.productVideo.delete({
      where: { id: videoId },
    });

    logActivity('delete', userId, 'product_videos', {
      recordId: productId,
      action: 'delete_video',
      oldValue: video,
    });

    await this.invalidateCache(productId);

    return { message: 'Video deleted successfully' };
  }

  async setPrimaryVideo(productId: number, videoId: number, userId: number) {
    // Validate product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundError('Product');
    }

    // Validate video exists and belongs to product
    const video = await prisma.productVideo.findFirst({
      where: {
        id: videoId,
        productId,
      },
    });

    if (!video) {
      throw new NotFoundError('Video not found for this product');
    }

    // Validate video is not already primary
    if (video.isPrimary) {
      throw new ValidationError('This video is already set as primary');
    }

    // Reset all videos to non-primary
    await prisma.productVideo.updateMany({
      where: { productId },
      data: { isPrimary: false },
    });

    // Set the selected video as primary
    const updatedVideo = await prisma.productVideo.update({
      where: { id: videoId },
      data: { isPrimary: true },
    });

    logActivity('update', userId, 'products', {
      recordId: productId,
      action: 'set_primary_video',
      newValue: { videoId },
    });

    await this.invalidateCache(productId);

    // Convert BigInt to String for JSON serialization
    return serializeBigInt(updatedVideo);
  }

  private async invalidateCache(productId?: number) {
    if (productId) {
      await redis.del(`${CachePrefix.PRODUCT}${productId}`);
    }

    await redis.flushPattern(`${CachePrefix.PRODUCT}list:*`);
  }
}

export default new ProductService();
