import { PrismaClient, Prisma } from '@prisma/client';
import { NotFoundError } from '@utils/errors';
import RedisService from './redis.service';
import { serializeBigInt } from '@utils/serializer';

const prisma = new PrismaClient();
const redis = RedisService.getInstance();

const STORE_CACHE_TTL = 600;

export interface PromotionInfo {
  id: number;
  name: string;
  type: string;
  value?: number;
  giftName?: string;
  endDate: Date;
}

export interface PublicProductDto {
  id: number;
  name: string;
  sku: string;
  slug: string;
  image: string;
  unit: string;
  originalPrice: number;
  salePrice: number;
  discountPercentage: number;
  isFeatured: boolean;
  inStock: boolean;
  category: { id: number; name: string; slug: string };
  promotion?: PromotionInfo | null;
}

export interface PublicProductDetailDto extends PublicProductDto {
  description?: string;
  barcode?: string;
  weight?: number;
  dimensions?: string;
  packagingType?: string;
  images: Array<{ url: string; alt?: string; isPrimary: boolean }>;
  videos: Array<{ url: string; thumbnail?: string; title?: string }>;
  availablePromotions: PromotionInfo[];
  relatedProducts?: PublicProductDto[];
}

class StoreProductService {

  async getPublicProducts(params: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: number;
    isFeatured?: boolean;
    sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'bestseller';
    packagingType?: 'bottle' | 'box' | 'bag' | 'label' | 'other';
    minPrice?: number;
    maxPrice?: number;
    userType?: 'retail' | 'wholesale' | 'vip';
  }) {
    const { 
      page = 1, limit = 20, search, categoryId, isFeatured, sortBy = 'newest',
      packagingType, minPrice, maxPrice,
      userType = 'retail' 
    } = params;
    
    const offset = (page - 1) * limit;
    const cacheKey = `store:products:${JSON.stringify(params)}`;
    const cached = await redis.get(cacheKey);
    if (cached) return cached;

    const where: Prisma.ProductWhereInput = {
      status: 'active',
      productType: { in: ['finished_product', 'goods'] },
      ...(isFeatured !== undefined && { isFeatured }),
      ...(categoryId && { categoryId }),
      ...(packagingType && { packagingType: packagingType as any }),
      ...((minPrice !== undefined || maxPrice !== undefined) && {
        sellingPriceRetail: {
          ...(minPrice !== undefined && { gte: Number(minPrice) }),
          ...(maxPrice !== undefined && { lte: Number(maxPrice) })
        }
      }),
      ...(search && {
        OR: [
          { productName: { contains: search } }, // Bỏ mode nếu không dùng Postgres
          { sku: { contains: search } }
        ]
      })
    };

    let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: 'desc' };
    if (sortBy === 'price_asc') orderBy = { sellingPriceRetail: 'asc' }; 
    if (sortBy === 'price_desc') orderBy = { sellingPriceRetail: 'desc' };
    if (sortBy === 'bestseller') orderBy = { id: 'desc' };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy,
        select: {
          id: true,
          productName: true,
          sku: true,
          slug: true,
          sellingPriceRetail: true, 
          sellingPriceWholesale: true,
          sellingPriceVip: true,
          isFeatured: true,
          unit: true,
          
          // ✅ Cần khai báo relation trong schema.prisma thì mới select được các dòng dưới
          images: {
            where: { isPrimary: true },
            take: 1,
            select: { imageUrl: true, altText: true }
          },
          category: { select: { id: true, categoryName: true, slug: true } },
          inventory: { select: { quantity: true, reservedQuantity: true } },
          
          promotionProducts: {
            where: {
              promotion: {
                status: 'active',
                startDate: { lte: new Date() },
                endDate: { gte: new Date() },
              }
            },
            include: {
              promotion: {
                select: {
                  id: true,
                  promotionName: true,
                  promotionType: true,
                  discountValue: true,
                  maxDiscountValue: true,
                  // ❌ ĐÃ XÓA giftProductName VÌ KHÔNG CÓ TRONG DB
                  endDate: true,
                }
              }
            }
          }
        }
      }),
      prisma.product.count({ where })
    ]);

    const mappedProducts: PublicProductDto[] = products.map((p: any) => {
      const basePrice = this.determineBasePrice(p, userType);
      
      const totalStock = p.inventory 
        ? p.inventory.reduce((sum: number, inv: any) => {
            const available = Number(inv.quantity) - Number(inv.reservedQuantity);
            return sum + Math.max(0, available);
          }, 0)
        : 0;
      
      const { salePrice, discountInfo } = this.calculateBestPrice(basePrice, p.promotionProducts);

      return {
        id: p.id,
        name: p.productName,
        sku: p.sku,
        slug: p.slug || '',
        image: (p.images && p.images.length > 0) ? p.images[0].imageUrl : '/placeholder.png',
        unit: p.unit,
        originalPrice: basePrice,
        salePrice: salePrice,
        discountPercentage: (discountInfo && discountInfo.type !== 'gift')
            ? Math.round(((basePrice - salePrice) / basePrice) * 100) 
            : 0,
        isFeatured: p.isFeatured,
        inStock: totalStock > 0,
        category: {
          id: p.category?.id,
          name: p.category?.categoryName,
          slug: p.category?.slug || ''
        },
        promotion: discountInfo 
      };
    });

    const result = {
      data: mappedProducts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };

    await redis.set(cacheKey, serializeBigInt(result), STORE_CACHE_TTL);
    return result;
  }

  // ... (Phần getProductDetail cũng sửa tương tự: bỏ giftProductName) ...
  async getProductDetail(id: number, userType: 'retail' | 'wholesale' | 'vip' = 'retail') {
    const cacheKey = `store:product:detail:${id}:${userType}`;
    const cached = await redis.get(cacheKey);
    if (cached) return cached;

    const product = await prisma.product.findUnique({
      where: { id, status: 'active', productType: { in: ['finished_product', 'goods'] } },
      select: {
        id: true,
        productName: true,
        sku: true,
        slug: true,
        sellingPriceRetail: true,
        sellingPriceWholesale: true,
        sellingPriceVip: true,
        description: true,
        unit: true,
        barcode: true,
        weight: true,
        dimensions: true,
        packagingType: true,
        isFeatured: true,
        
        category: { select: { id: true, categoryName: true, slug: true } },
        images: {
          orderBy: { displayOrder: 'asc' },
          select: { imageUrl: true, altText: true, isPrimary: true, imageType: true }
        },
        videos: {
          orderBy: { displayOrder: 'asc' },
          select: { videoUrl: true, thumbnail: true, title: true }
        },
        inventory: { select: { quantity: true, reservedQuantity: true } },
        promotionProducts: {
          where: {
            promotion: {
              status: 'active',
              startDate: { lte: new Date() },
              endDate: { gte: new Date() },
            }
          },
          include: {
            promotion: {
              select: {
                id: true,
                promotionName: true,
                promotionType: true,
                discountValue: true,
                maxDiscountValue: true,
                // ❌ Bỏ giftProductName ở đây
                endDate: true,
              }
            }
          }
        }
      }
    });

    if (!product) throw new NotFoundError('Sản phẩm không tồn tại');

    const basePrice = this.determineBasePrice(product, userType);
    const totalStock = product.inventory 
      ? product.inventory.reduce((sum: number, inv: any) => sum + Math.max(0, Number(inv.quantity) - Number(inv.reservedQuantity)), 0)
      : 0;

    const { salePrice, discountInfo, allPromotions } = this.calculateBestPrice(basePrice, product.promotionProducts);

    const result: PublicProductDetailDto = {
      id: product.id,
      name: product.productName,
      sku: product.sku,
      slug: product.slug || '',
      image: (product.images && product.images.length > 0) ? product.images[0].imageUrl : '/placeholder.png',
      unit: product.unit,
      originalPrice: basePrice,
      salePrice: salePrice,
      discountPercentage: (discountInfo && discountInfo.type !== 'gift')
          ? Math.round(((basePrice - salePrice) / basePrice) * 100) : 0,
      isFeatured: product.isFeatured,
      inStock: totalStock > 0,
      category: {
        id: product.category?.id || 0,
        name: product.category?.categoryName || 'Unknown',
        slug: product.category?.slug || ''
      },
      promotion: discountInfo,
      availablePromotions: allPromotions,
      description: product.description || '',
      barcode: product.barcode || undefined,
      weight: product.weight ? Number(product.weight) : undefined,
      dimensions: product.dimensions || undefined,
      packagingType: product.packagingType || undefined,
      images: product.images.map(img => ({
        url: img.imageUrl,
        alt: img.altText || product.productName,
        isPrimary: img.isPrimary
      })),
      videos: product.videos.map(v => ({
        url: v.videoUrl,
        thumbnail: v.thumbnail || undefined,
        title: v.title || undefined
      })),
      relatedProducts: [] 
    };

    await redis.set(cacheKey, serializeBigInt(result), STORE_CACHE_TTL);
    return result;
  }

  // --- Helpers ---
  private determineBasePrice(product: any, userType: string): number {
    if (userType === 'wholesale' && product.sellingPriceWholesale) return Number(product.sellingPriceWholesale);
    if (userType === 'vip' && product.sellingPriceVip) return Number(product.sellingPriceVip);
    return Number(product.sellingPriceRetail || 0);
  }

  private calculateBestPrice(originalPrice: number, activePromotions: any[]) {
    let bestPrice = originalPrice;
    let bestPromo: PromotionInfo | null = null;
    const allPromos: PromotionInfo[] = [];

    if (!activePromotions || activePromotions.length === 0) {
        return { salePrice: originalPrice, discountInfo: null, allPromotions: [] };
    }
    
    for (const item of activePromotions) {
      const promo = item.promotion;
      let priceAfterDiscount = originalPrice;
      
      // ✅ Nếu cần lấy tên quà, bạn cần thêm logic query bảng promotion_products thay vì promotion
      // Tạm thời để null nếu chưa query được
      let promoInfo: PromotionInfo = {
          id: promo.id,
          name: promo.promotionName,
          type: promo.promotionType,
          endDate: promo.endDate,
          giftName: undefined // Bỏ mapping giftName tạm thời
      };

      if (promo.promotionType === 'percent_discount') {
        const discountVal = item.discountValueOverride || promo.discountValue || 0;
        let discountAmount = (originalPrice * Number(discountVal)) / 100;
        if (promo.maxDiscountValue) discountAmount = Math.min(discountAmount, Number(promo.maxDiscountValue));
        priceAfterDiscount = originalPrice - discountAmount;
        promoInfo.value = discountAmount;
      } 
      else if (promo.promotionType === 'fixed_discount') {
        const discountVal = item.discountValueOverride || promo.discountValue || 0;
        priceAfterDiscount = originalPrice - Number(discountVal);
        promoInfo.value = Number(discountVal);
      }
      else if (promo.promotionType === 'gift') {
        priceAfterDiscount = originalPrice;
        promoInfo.value = 0; 
      }

      priceAfterDiscount = Math.max(0, priceAfterDiscount);
      allPromos.push({ ...promoInfo, _tempPrice: priceAfterDiscount } as any);
    }

    allPromos.sort((a: any, b: any) => {
        if (a._tempPrice !== b._tempPrice) return a._tempPrice - b._tempPrice;
        if (a.type !== 'gift' && b.type === 'gift') return -1;
        if (a.type === 'gift' && b.type !== 'gift') return 1;
        return 0;
    });

    if (allPromos.length > 0) {
        const best = allPromos[0] as any;
        bestPrice = best._tempPrice;
        bestPromo = {
            id: best.id,
            name: best.name,
            type: best.type,
            value: best.value,
            giftName: best.giftName,
            endDate: best.endDate
        };
    }

    const cleanList = allPromos.map(({ _tempPrice, ...rest }: any) => rest as PromotionInfo);
    return { salePrice: bestPrice, discountInfo: bestPromo, allPromotions: cleanList };
  }
}

export default new StoreProductService();