import { z } from 'zod';

// Promotion Types Enum
export const promotionTypeEnum = z.enum([
  'percent_discount',
  'fixed_discount',
  'buy_x_get_y',
  'gift',
]);

export const applicableToEnum = z.enum([
  'all',
  'category',
  'product_group',
  'specific_product',
  'customer_group',
]);

export const promotionStatusEnum = z.enum(['pending', 'active', 'expired', 'cancelled']);

// Conditions Schema (JSON)
export const conditionsSchema = z
  .object({
    applicable_categories: z.array(z.number()).optional(),
    applicable_customer_types: z.array(z.string()).optional(),
    days_of_week: z.array(z.number().min(0).max(6)).optional(), // 0-6 (Sunday-Saturday)
    time_slots: z.array(z.string()).optional(), // ["18:00-22:00"]
    max_usage_per_customer: z.number().optional(),
    buy_quantity: z.number().optional(), // For buy_x_get_y
    get_quantity: z.number().optional(), // For buy_x_get_y
    get_same_product: z.boolean().optional(),
    gift_product_id: z.number().optional(), // For gift type
    gift_quantity: z.number().optional(),
  })
  .optional();

// Query Schema
export const promotionQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  search: z.string().optional(),
  promotionType: promotionTypeEnum.optional(),
  status: promotionStatusEnum.optional(),
  applicableTo: applicableToEnum.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isActive: z.enum(['true', 'false']).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type PromotionQueryInput = z.infer<typeof promotionQuerySchema>;

// Create Promotion Schema
export const createPromotionSchema = z.object({
  body: z
    .object({
      promotionCode: z.string().min(1, 'Promotion code is required').max(50),
      promotionName: z.string().min(1, 'Promotion name is required').max(200),
      promotionType: promotionTypeEnum,
      discountValue: z.number().min(0).optional(),
      maxDiscountValue: z.number().min(0).optional(),
      startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: 'Invalid start date',
      }),
      endDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: 'Invalid end date',
      }),
      isRecurring: z.boolean().optional(),
      applicableTo: applicableToEnum,
      minOrderValue: z.number().min(0).optional(),
      minQuantity: z.number().min(0).optional(),
      conditions: conditionsSchema,
      quantityLimit: z.number().min(1).optional(),
      products: z
        .array(
          z.object({
            productId: z.number().min(1),
            discountValueOverride: z.number().min(0).optional(),
            minQuantity: z.number().min(1).optional(),
            giftProductId: z.number().min(1).optional(),
            giftQuantity: z.number().min(1).optional(),
            note: z.string().max(255).optional(),
          })
        )
        .optional(),
    })
    .refine(
      (data) => {
        // Validate discount value for percent_discount
        if (data.promotionType === 'percent_discount' && data.discountValue) {
          return data.discountValue <= 100;
        }
        return true;
      },
      {
        message: 'Percent discount must be <= 100',
        path: ['discountValue'],
      }
    )
    .refine(
      (data) => {
        // Validate end date > start date
        return new Date(data.endDate) >= new Date(data.startDate);
      },
      {
        message: 'End date must be after or equal to start date',
        path: ['endDate'],
      }
    ),
});

export type CreatePromotionInput = z.infer<typeof createPromotionSchema>['body'];

// Update Promotion Schema
export const updatePromotionSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/).transform(Number),
  }),
  body: z
    .object({
      promotionName: z.string().min(1).max(200).optional(),
      discountValue: z.number().min(0).optional(),
      maxDiscountValue: z.number().min(0).optional(),
      startDate: z
        .string()
        .refine((val) => !isNaN(Date.parse(val)), {
          message: 'Invalid start date',
        })
        .optional(),
      endDate: z
        .string()
        .refine((val) => !isNaN(Date.parse(val)), {
          message: 'Invalid end date',
        })
        .optional(),
      isRecurring: z.boolean().optional(),
      minOrderValue: z.number().min(0).optional(),
      minQuantity: z.number().min(0).optional(),
      conditions: conditionsSchema,
      quantityLimit: z.number().min(1).optional(),
      products: z
        .array(
          z.object({
            productId: z.number().min(1),
            discountValueOverride: z.number().min(0).optional(),
            minQuantity: z.number().min(1).optional(),
            giftProductId: z.number().min(1).optional(),
            giftQuantity: z.number().min(1).optional(),
            note: z.string().max(255).optional(),
          })
        )
        .optional(),
    })
    .optional(),
});

export type UpdatePromotionInput = z.infer<typeof updatePromotionSchema>['body'];

// Approve Promotion Schema
export const approvePromotionSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/).transform(Number),
  }),
  body: z.object({
    notes: z.string().max(500).optional(),
  }),
});

// Cancel Promotion Schema
export const cancelPromotionSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/).transform(Number),
  }),
  body: z.object({
    reason: z.string().min(1, 'Cancellation reason is required').max(500),
  }),
});

// Apply Promotion Schema
export const applyPromotionSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/).transform(Number),
  }),
  body: z.object({
    orderId: z.number().min(1).optional(),
    orderAmount: z.number().min(0),
    orderItems: z
      .array(
        z.object({
          productId: z.number().min(1),
          quantity: z.number().min(1),
          unitPrice: z.number().min(0),
        })
      )
      .min(1, 'Order must have at least one item'),
    customerId: z.number().min(1).optional(),
    customerType: z.string().optional(),
  }),
});

export type ApplyPromotionInput = z.infer<typeof applyPromotionSchema>['body'];

// Get Active Promotions Schema
export const getActivePromotionsSchema = z.object({
  date: z.string().optional(), // Check active promotions at specific date
  applicableTo: applicableToEnum.optional(),
  productId: z.string().regex(/^\d+$/).transform(Number).optional(),
  categoryId: z.string().regex(/^\d+$/).transform(Number).optional(),
  status: promotionStatusEnum.optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});
