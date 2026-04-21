import { z } from 'zod';
import { UserRole, PaymentMethod, Currency } from '../types/enums';

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

export const createUserSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  fullName: z.string().min(2, 'Nombre requerido').max(150),
  phone: z.string().optional(),
  role: z.nativeEnum(UserRole),
});

export const createCompanySchema = z.object({
  ruc: z
    .string()
    .length(11, 'El RUC debe tener 11 dígitos')
    .regex(/^\d{11}$/, 'El RUC solo debe contener números'),
  businessName: z.string().min(2, 'Razón social requerida').max(300),
  tradeName: z.string().max(300).optional(),
  address: z.string().max(500).optional(),
  industrySector: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
});

export const updateCompanySchema = createCompanySchema.partial();

export const createContactSchema = z.object({
  fullName: z.string().min(2).max(150),
  position: z.string().max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  isPrimary: z.boolean().default(false),
});

export const createAgreementSchema = z.object({
  creditDays: z.number().int().min(0).max(365).default(0),
  warrantyDays: z.number().int().min(0).max(730).default(0),
  paymentMethod: z.nativeEnum(PaymentMethod).default(PaymentMethod.TRANSFER),
  billingCurrency: z.nativeEnum(Currency).default(Currency.PEN),
  retentionPercentage: z.number().min(0).max(100).default(0),
  specialConditions: z.record(z.string(), z.unknown()).optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
export type CreateContactInput = z.infer<typeof createContactSchema>;
export type CreateAgreementInput = z.infer<typeof createAgreementSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;

export interface ApiResponse<T> {
  data: T;
  meta?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  statusCode: number;
  message: string;
  error: string;
  timestamp: string;
}
