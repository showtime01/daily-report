import { z } from "zod";

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "日付はYYYY-MM-DD形式で入力してください");

export const VisitRecordInputSchema = z.object({
  customer_id: z.number(),
  visit_type: z.enum(["in_person", "online", "phone"]),
  purpose: z
    .string()
    .max(200, "訪問目的は200文字以内で入力してください")
    .optional(),
  content: z
    .string()
    .max(1000, "訪問内容は1000文字以内で入力してください")
    .optional(),
  next_action: z
    .string()
    .max(500, "次回アクションは500文字以内で入力してください")
    .optional(),
  next_visit_date: dateStringSchema.nullable().optional(),
});

export type VisitRecordInput = z.infer<typeof VisitRecordInputSchema>;

export const VisitRecordSubmitSchema = VisitRecordInputSchema.extend({
  purpose: z
    .string()
    .min(1, "訪問目的を入力してください")
    .max(200, "訪問目的は200文字以内で入力してください"),
  content: z
    .string()
    .min(1, "訪問内容を入力してください")
    .max(1000, "訪問内容は1000文字以内で入力してください"),
});

export type VisitRecordSubmit = z.infer<typeof VisitRecordSubmitSchema>;

export const VisitRecordResponseSchema = z.object({
  id: z.number(),
  daily_report_id: z.number(),
  customer_id: z.number(),
  customer_name: z.string(),
  visit_type: z.enum(["in_person", "online", "phone"]),
  purpose: z.string().nullable(),
  content: z.string().nullable(),
  next_action: z.string().nullable(),
  next_visit_date: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type VisitRecordResponse = z.infer<typeof VisitRecordResponseSchema>;

export const VisitRecordUpdateSchema = VisitRecordInputSchema;

export type VisitRecordUpdate = z.infer<typeof VisitRecordUpdateSchema>;
