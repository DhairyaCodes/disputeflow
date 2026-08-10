import { z } from 'zod';

export const createDisputeSchema = z.object({
  transactionReference: z.string().trim().min(3).max(100),
  amount: z.coerce.number().positive().max(99_999_999.99),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  merchantName: z.string().trim().min(2).max(200),
  reason: z.enum(['CARD_NOT_PRESENT', 'DUPLICATE_CHARGE', 'PRODUCT_NOT_RECEIVED', 'INCORRECT_AMOUNT', 'OTHER']),
  description: z.string().trim().max(1000).optional()
});

export const updateStatusSchema = z.object({
  status: z.enum(['UNDER_REVIEW', 'AWAITING_EVIDENCE', 'RESOLVED', 'REJECTED']),
  expectedVersion: z.coerce.number().int().positive(),
  note: z.string().trim().max(500).optional()
});

