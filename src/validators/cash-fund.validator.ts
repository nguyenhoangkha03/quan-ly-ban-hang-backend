import { z } from 'zod';

export const getCashFundListSchema = z.object({
  query: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    isLocked: z.enum(['true', 'false']).optional(),
  }),
});

export const getDailyCashFundSchema = z.object({
  params: z.object({
    date: z.string().datetime().optional(),
  }),
});

export const createCashFundSchema = z.object({
  body: z.object({
    fundDate: z.string().datetime({ message: 'Fund date is required' }),
    openingBalance: z.number().min(0, 'Opening balance must be positive').optional(),
    notes: z.string().max(255, 'Notes cannot exceed 255 characters').optional(),
  }),
});

export const updateCashFundSchema = z.object({
  params: z.object({
    date: z.string().datetime({ message: 'Date is required' }),
  }),
  body: z.object({
    openingBalance: z.number().min(0, 'Opening balance must be positive').optional(),
    notes: z.string().max(255, 'Notes cannot exceed 255 characters').optional(),
  }),
});

export const lockCashFundSchema = z.object({
  params: z.object({
    date: z.string().datetime({ message: 'Date is required' }),
  }),
  body: z.object({
    approvedBy: z.number().int().min(1, 'Approved by must be a valid user ID').optional(),
    reconciledBy: z.number().int().min(1, 'Reconciled by must be a valid user ID').optional(),
    notes: z.string().max(255, 'Notes cannot exceed 255 characters').optional(),
  }),
});

export const unlockCashFundSchema = z.object({
  params: z.object({
    date: z.string().datetime({ message: 'Date is required' }),
  }),
});

export const getCashFundSummarySchema = z.object({
  query: z.object({
    startDate: z.string().datetime({ message: 'Start date is required' }),
    endDate: z.string().datetime({ message: 'End date is required' }),
  }),
});

export const getDiscrepanciesSchema = z.object({
  params: z.object({
    date: z.string().datetime({ message: 'Date is required' }),
  }),
});
