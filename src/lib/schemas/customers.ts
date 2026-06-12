import { z } from "zod";

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "日付はYYYY-MM-DD形式で入力してください");

const CustomerSalesInputSchema = z.object({
  user_id: z.number(),
  assigned_at: dateStringSchema,
});

const CustomerSalesResponseSchema = z.object({
  user_id: z.number(),
  user_name: z.string(),
  department: z.string().nullable(),
  assigned_at: z.string(),
});

export const CustomerCreateSchema = z.object({
  company_name: z
    .string()
    .min(1, "企業名を入力してください")
    .max(200, "企業名は200文字以内で入力してください"),
  contact_name: z
    .string()
    .min(1, "担当者名を入力してください")
    .max(100, "担当者名は100文字以内で入力してください"),
  phone: z
    .string()
    .regex(
      /^[0-9]{2,4}-[0-9]{2,4}-[0-9]{4}$|^[0-9]{10,11}$/,
      "正しい電話番号形式で入力してください（例：03-1234-5678）"
    )
    .optional(),
  email: z
    .string()
    .email("正しいメールアドレス形式で入力してください")
    .optional(),
  address: z
    .string()
    .max(300, "住所は300文字以内で入力してください")
    .optional(),
  industry: z
    .string()
    .max(100, "業種は100文字以内で入力してください")
    .optional(),
  sales: z.array(CustomerSalesInputSchema).optional(),
});

export type CustomerCreate = z.infer<typeof CustomerCreateSchema>;

export const CustomerUpdateSchema = CustomerCreateSchema;

export type CustomerUpdate = z.infer<typeof CustomerUpdateSchema>;

export const CustomerQuerySchema = z.object({
  company_name: z.string().optional(),
  industry: z.string().optional(),
});

export type CustomerQuery = z.infer<typeof CustomerQuerySchema>;

export const CustomerSalesAddSchema = z.object({
  user_id: z.number(),
  assigned_at: dateStringSchema,
});

export type CustomerSalesAdd = z.infer<typeof CustomerSalesAddSchema>;

export const CustomerListItemSchema = z.object({
  id: z.number(),
  company_name: z.string(),
  contact_name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  industry: z.string().nullable(),
  sales_count: z.number(),
  created_at: z.string(),
});

export type CustomerListItem = z.infer<typeof CustomerListItemSchema>;

export const CustomerDetailSchema = z.object({
  id: z.number(),
  company_name: z.string(),
  contact_name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  industry: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  sales: z.array(CustomerSalesResponseSchema),
});

export type CustomerDetail = z.infer<typeof CustomerDetailSchema>;

export const CustomerSalesAssignResponseSchema = z.object({
  customer_id: z.number(),
  user_id: z.number(),
  user_name: z.string(),
  department: z.string().nullable(),
  assigned_at: z.string(),
  created_at: z.string(),
});

export type CustomerSalesAssignResponse = z.infer<
  typeof CustomerSalesAssignResponseSchema
>;
