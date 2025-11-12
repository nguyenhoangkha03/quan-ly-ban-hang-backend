import { PrismaClient, Prisma } from '@prisma/client';
import { NotFoundError, ValidationError, ConflictError } from '@utils/errors';
import { logActivity } from '@utils/logger';
import {
  CreatePromotionInput,
  UpdatePromotionInput,
  ApplyPromotionInput,
  PromotionQueryInput,
} from '@validators/promotion.validator';

const prisma = new PrismaClient();

interface PromotionConditions {
  applicable_categories?: number[];
  applicable_customer_types?: string[];
  days_of_week?: number[];
  time_slots?: string[];
  max_usage_per_customer?: number;
  buy_quantity?: number;
  get_quantity?: number;
  get_same_product?: boolean;
  gift_product_id?: number;
  gift_quantity?: number;
}

interface ApplyPromotionResult {
  applicable: boolean;
  discountAmount: number;
  finalAmount: number;
  giftProducts?: {
    productId: number;
    quantity: number;
  }[];
  message?: string;
}

class PromotionService {
  // Get all promotions with filters
  async getAll(params: PromotionQueryInput) {
    const {
      page = 1,
      limit = 20,
      search,
      promotionType,
      status,
      applicableTo,
      startDate,
      endDate,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const offset = (page - 1) * limit;

    const where: Prisma.PromotionWhereInput = {
      ...(search && {
        OR: [
          { promotionCode: { contains: search } },
          { promotionName: { contains: search } },
        ],
      }),
      ...(promotionType && { promotionType }),
      ...(status && { status }),
      ...(applicableTo && { applicableTo }),
      ...(startDate &&
        endDate && {
          OR: [
            {
              startDate: {
                gte: new Date(startDate),
                lte: new Date(endDate),
              },
            },
            {
              endDate: {
                gte: new Date(startDate),
                lte: new Date(endDate),
              },
            },
          ],
        }),
      ...(isActive === 'true' && {
        status: 'active',
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
      }),
    };

    const [promotions, total] = await Promise.all([
      prisma.promotion.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              fullName: true,
              employeeCode: true,
            },
          },
          approver: {
            select: {
              id: true,
              fullName: true,
              employeeCode: true,
            },
          },
          _count: {
            select: {
              products: true,
            },
          },
        },
        skip: offset,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.promotion.count({ where }),
    ]);

    return {
      data: promotions,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Get promotion by ID
  async getById(id: number) {
    const promotion = await prisma.promotion.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
          },
        },
        approver: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
          },
        },
        canceller: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
          },
        },
        products: {
          include: {
            product: {
              select: {
                id: true,
                sku: true,
                productName: true,
                unit: true,
                sellingPriceRetail: true,
              },
            },
            giftProduct: {
              select: {
                id: true,
                sku: true,
                productName: true,
                unit: true,
              },
            },
          },
        },
      },
    });

    if (!promotion) {
      throw new NotFoundError('Promotion');
    }

    return promotion;
  }

  // Create new promotion
  async create(data: CreatePromotionInput, userId: number) {
    // Check if promotion code already exists
    const existingCode = await prisma.promotion.findUnique({
      where: { promotionCode: data.promotionCode },
    });

    if (existingCode) {
      throw new ConflictError('Promotion code already exists');
    }

    // Validate promotion type specific fields
    this.validatePromotionType(data);

    const promotion = await prisma.promotion.create({
      data: {
        promotionCode: data.promotionCode,
        promotionName: data.promotionName,
        promotionType: data.promotionType,
        discountValue: data.discountValue,
        maxDiscountValue: data.maxDiscountValue,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        isRecurring: data.isRecurring || false,
        applicableTo: data.applicableTo,
        minOrderValue: data.minOrderValue || 0,
        minQuantity: data.minQuantity || 0,
        conditions: data.conditions || Prisma.JsonNull,
        quantityLimit: data.quantityLimit,
        createdBy: userId,
        ...(data.products && {
          products: {
            create: data.products.map((p) => ({
              productId: p.productId,
              discountValueOverride: p.discountValueOverride,
              minQuantity: p.minQuantity || 1,
              giftProductId: p.giftProductId,
              giftQuantity: p.giftQuantity || 0,
              note: p.note,
            })),
          },
        }),
      },
      include: {
        creator: {
          select: {
            id: true,
            fullName: true,
            employeeCode: true,
          },
        },
        products: {
          include: {
            product: true,
            giftProduct: true,
          },
        },
      },
    });

    // Log activity
    logActivity('create', userId, 'promotions', { id: promotion.id, code: promotion.promotionCode });

    return promotion;
  }

  // Update promotion
  async update(id: number, data: UpdatePromotionInput | undefined, userId: number) {
    if (!data) {
      throw new ValidationError('Update data is required');
    }

    const existing = await prisma.promotion.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError('Promotion');
    }

    // Cannot update if already active or expired
    if (existing.status === 'active' || existing.status === 'expired') {
      throw new ValidationError(
        `Cannot update promotion with status: ${existing.status}`
      );
    }

    // If products are provided, delete old and create new
    const updateData: any = {
      ...(data.promotionName && { promotionName: data.promotionName }),
      ...(data.discountValue !== undefined && { discountValue: data.discountValue }),
      ...(data.maxDiscountValue !== undefined && {
        maxDiscountValue: data.maxDiscountValue,
      }),
      ...(data.startDate && { startDate: new Date(data.startDate) }),
      ...(data.endDate && { endDate: new Date(data.endDate) }),
      ...(data.isRecurring !== undefined && { isRecurring: data.isRecurring }),
      ...(data.minOrderValue !== undefined && { minOrderValue: data.minOrderValue }),
      ...(data.minQuantity !== undefined && { minQuantity: data.minQuantity }),
      ...(data.conditions !== undefined && { conditions: data.conditions || Prisma.JsonNull }),
      ...(data.quantityLimit !== undefined && { quantityLimit: data.quantityLimit }),
    };

    const promotion = await prisma.$transaction(async (tx) => {
      // Delete existing products if new products provided
      if (data.products) {
        await tx.promotionProduct.deleteMany({
          where: { promotionId: id },
        });
      }

      // Update promotion
      return await tx.promotion.update({
        where: { id },
        data: {
          ...updateData,
          ...(data.products && {
            products: {
              create: data.products.map((p) => ({
                productId: p.productId,
                discountValueOverride: p.discountValueOverride,
                minQuantity: p.minQuantity || 1,
                giftProductId: p.giftProductId,
                giftQuantity: p.giftQuantity || 0,
                note: p.note,
              })),
            },
          }),
        },
        include: {
          creator: {
            select: {
              id: true,
              fullName: true,
              employeeCode: true,
            },
          },
          products: {
            include: {
              product: true,
              giftProduct: true,
            },
          },
        },
      });
    });

    // Log activity
    logActivity('update', userId, 'promotions', { id, changes: Object.keys(updateData) });

    return promotion;
  }

  // Approve promotion
  async approve(id: number, userId: number) {
    const promotion = await prisma.promotion.findUnique({
      where: { id },
    });

    if (!promotion) {
      throw new NotFoundError('Promotion');
    }

    if (promotion.status !== 'pending') {
      throw new ValidationError('Only pending promotions can be approved');
    }

    const updated = await prisma.promotion.update({
      where: { id },
      data: {
        status: 'active',
        approvedBy: userId,
        approvedAt: new Date(),
      },
      include: {
        creator: true,
        approver: true,
        products: {
          include: {
            product: true,
            giftProduct: true,
          },
        },
      },
    });

    // Log activity
    logActivity('approve', userId, 'promotions', { id, code: updated.promotionCode });

    return updated;
  }

  // Cancel promotion
  async cancel(id: number, reason: string, userId: number) {
    const promotion = await prisma.promotion.findUnique({
      where: { id },
    });

    if (!promotion) {
      throw new NotFoundError('Promotion');
    }

    if (promotion.status === 'cancelled' || promotion.status === 'expired') {
      throw new ValidationError(`Promotion is already ${promotion.status}`);
    }

    const updated = await prisma.promotion.update({
      where: { id },
      data: {
        status: 'cancelled',
        cancelledBy: userId,
        cancelledAt: new Date(),
      },
      include: {
        creator: true,
        canceller: true,
      },
    });

    // Log activity
    logActivity('cancel', userId, 'promotions', { id, reason, code: updated.promotionCode });

    return updated;
  }

  // Delete promotion (soft delete via cancel)
  async delete(id: number, userId: number) {
    return this.cancel(id, 'Deleted by user', userId);
  }

  // Get active promotions
  async getActive(date?: string) {
    const checkDate = date ? new Date(date) : new Date();

    const promotions = await prisma.promotion.findMany({
      where: {
        status: 'active',
        startDate: { lte: checkDate },
        endDate: { gte: checkDate },
      },
      include: {
        products: {
          include: {
            product: {
              select: {
                id: true,
                sku: true,
                productName: true,
                categoryId: true,
              },
            },
            giftProduct: {
              select: {
                id: true,
                sku: true,
                productName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return promotions;
  }

  // Apply promotion to order
  async apply(id: number, data: ApplyPromotionInput): Promise<ApplyPromotionResult> {
    const promotion = await prisma.promotion.findUnique({
      where: { id },
      include: {
        products: {
          include: {
            product: true,
            giftProduct: true,
          },
        },
      },
    });

    if (!promotion) {
      throw new NotFoundError('Promotion');
    }

    // Check if promotion is active
    const now = new Date();
    if (promotion.status !== 'active') {
      return {
        applicable: false,
        discountAmount: 0,
        finalAmount: data.orderAmount,
        message: `Promotion is ${promotion.status}`,
      };
    }

    if (now < promotion.startDate || now > promotion.endDate) {
      return {
        applicable: false,
        discountAmount: 0,
        finalAmount: data.orderAmount,
        message: 'Promotion is not within valid date range',
      };
    }

    // Check quantity limit
    if (promotion.quantityLimit && promotion.usageCount >= promotion.quantityLimit) {
      return {
        applicable: false,
        discountAmount: 0,
        finalAmount: data.orderAmount,
        message: 'Promotion usage limit reached',
      };
    }

    // Check minimum order value
    if (data.orderAmount < Number(promotion.minOrderValue)) {
      return {
        applicable: false,
        discountAmount: 0,
        finalAmount: data.orderAmount,
        message: `Minimum order value is ${promotion.minOrderValue}`,
      };
    }

    // Check conditions
    const conditionsResult = this.checkConditions(promotion, data);
    if (!conditionsResult.applicable) {
      return {
        applicable: false,
        discountAmount: 0,
        finalAmount: data.orderAmount,
        message: conditionsResult.message,
      };
    }

    // Calculate discount based on promotion type
    return this.calculateDiscount(promotion, data);
  }

  // Check promotion conditions
  private checkConditions(
    promotion: any,
    data: ApplyPromotionInput
  ): { applicable: boolean; message?: string } {
    if (!promotion.conditions) {
      return { applicable: true };
    }

    const conditions = promotion.conditions as PromotionConditions;

    // Check customer type
    if (conditions.applicable_customer_types && data.customerType) {
      if (!conditions.applicable_customer_types.includes(data.customerType)) {
        return {
          applicable: false,
          message: 'Customer type not eligible for this promotion',
        };
      }
    }

    // Check day of week
    if (conditions.days_of_week) {
      const dayOfWeek = new Date().getDay();
      if (!conditions.days_of_week.includes(dayOfWeek)) {
        return {
          applicable: false,
          message: 'Promotion not available on this day',
        };
      }
    }

    // Check time slot
    if (conditions.time_slots && conditions.time_slots.length > 0) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      const inTimeSlot = conditions.time_slots.some((slot) => {
        const [start, end] = slot.split('-');
        return currentTime >= start && currentTime <= end;
      });

      if (!inTimeSlot) {
        return {
          applicable: false,
          message: 'Promotion not available at this time',
        };
      }
    }

    // Check applicable categories
    if (conditions.applicable_categories && conditions.applicable_categories.length > 0) {
      const orderCategories = data.orderItems
        .map((item) => {
          const productPromo = promotion.products?.find(
            (p: any) => p.productId === item.productId
          );
          return productPromo?.product?.categoryId;
        })
        .filter((catId: number | undefined): catId is number => catId !== undefined);

      const hasMatchingCategory = orderCategories.some((catId) =>
        conditions.applicable_categories!.includes(catId)
      );

      if (!hasMatchingCategory) {
        return {
          applicable: false,
          message: 'No products in applicable categories',
        };
      }
    }

    return { applicable: true };
  }

  // Calculate discount amount
  private calculateDiscount(
    promotion: any,
    data: ApplyPromotionInput
  ): ApplyPromotionResult {
    let discountAmount = 0;
    const giftProducts: { productId: number; quantity: number }[] = [];

    switch (promotion.promotionType) {
      case 'percent_discount': {
        discountAmount = (data.orderAmount * Number(promotion.discountValue)) / 100;

        // Apply max discount limit
        if (
          promotion.maxDiscountValue &&
          discountAmount > Number(promotion.maxDiscountValue)
        ) {
          discountAmount = Number(promotion.maxDiscountValue);
        }
        break;
      }

      case 'fixed_discount': {
        discountAmount = Number(promotion.discountValue);
        break;
      }

      case 'buy_x_get_y': {
        const conditions = promotion.conditions as PromotionConditions;
        if (conditions.buy_quantity && conditions.get_quantity) {
          // Find applicable products
          data.orderItems.forEach((item) => {
            const productPromo = promotion.products?.find(
              (p: any) => p.productId === item.productId
            );

            if (productPromo && item.quantity >= conditions.buy_quantity!) {
              const setsCount = Math.floor(item.quantity / conditions.buy_quantity!);
              const giftQty = setsCount * conditions.get_quantity!;

              if (conditions.get_same_product) {
                // Gift is the same product
                giftProducts.push({
                  productId: item.productId,
                  quantity: giftQty,
                });
              } else if (productPromo.giftProductId) {
                // Gift is different product
                giftProducts.push({
                  productId: productPromo.giftProductId,
                  quantity: giftQty,
                });
              }
            }
          });
        }
        break;
      }

      case 'gift': {
        // Add gift products
        promotion.products?.forEach((pp: any) => {
          if (pp.giftProductId && pp.giftQuantity > 0) {
            const orderItem = data.orderItems.find((i) => i.productId === pp.productId);
            if (orderItem && orderItem.quantity >= pp.minQuantity) {
              giftProducts.push({
                productId: pp.giftProductId,
                quantity: pp.giftQuantity,
              });
            }
          }
        });
        break;
      }
    }

    // Ensure discount doesn't exceed order amount
    if (discountAmount > data.orderAmount) {
      discountAmount = data.orderAmount;
    }

    return {
      applicable: true,
      discountAmount,
      finalAmount: data.orderAmount - discountAmount,
      ...(giftProducts.length > 0 && { giftProducts }),
    };
  }

  // Validate promotion type specific fields
  private validatePromotionType(data: CreatePromotionInput) {
    switch (data.promotionType) {
      case 'percent_discount':
      case 'fixed_discount':
        if (!data.discountValue || data.discountValue <= 0) {
          throw new ValidationError('Discount value is required and must be greater than 0');
        }
        break;

      case 'buy_x_get_y': {
        const conditions = data.conditions as PromotionConditions | undefined;
        if (
          !conditions ||
          !conditions.buy_quantity ||
          !conditions.get_quantity ||
          conditions.buy_quantity <= 0 ||
          conditions.get_quantity <= 0
        ) {
          throw new ValidationError(
            'Buy X Get Y promotion requires valid buy_quantity and get_quantity in conditions'
          );
        }
        break;
      }

      case 'gift': {
        if (!data.products || data.products.length === 0) {
          throw new ValidationError('Gift promotion requires at least one product');
        }

        const hasGift = data.products.some((p) => p.giftProductId && p.giftQuantity);
        if (!hasGift) {
          throw new ValidationError(
            'Gift promotion requires giftProductId and giftQuantity'
          );
        }
        break;
      }
    }
  }

  // Auto-expire promotions (should be called by cron job)
  async autoExpirePromotions() {
    const now = new Date();

    const expired = await prisma.promotion.updateMany({
      where: {
        status: 'active',
        endDate: { lt: now },
      },
      data: {
        status: 'expired',
      },
    });

    return expired.count;
  }

  // Increment usage count
  async incrementUsage(id: number) {
    return await prisma.promotion.update({
      where: { id },
      data: {
        usageCount: { increment: 1 },
      },
    });
  }
}

export default new PromotionService();
