import { z } from "zod";
import {
  VisitRecordInputSchema,
  VisitRecordSubmitSchema,
  VisitRecordResponseSchema,
} from "./visit-records";
import { CommentListItemSchema } from "./comments";

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "日付はYYYY-MM-DD形式で入力してください");

const DailyReportBaseSchema = z.object({
  report_date: dateStringSchema,
  problem: z
    .string()
    .max(2000, "課題・相談は2000文字以内で入力してください")
    .optional(),
  plan: z
    .string()
    .max(2000, "明日やることは2000文字以内で入力してください")
    .optional(),
});

export const DailyReportDraftSchema = DailyReportBaseSchema.extend({
  status: z.literal("draft"),
  visit_records: z.array(VisitRecordInputSchema).min(1),
});

export type DailyReportDraft = z.infer<typeof DailyReportDraftSchema>;

export const DailyReportSubmitSchema = DailyReportBaseSchema.extend({
  status: z.literal("submitted"),
  visit_records: z
    .array(VisitRecordSubmitSchema)
    .min(1, "訪問記録を1件以上追加してください"),
});

export type DailyReportSubmit = z.infer<typeof DailyReportSubmitSchema>;

export const DailyReportCreateSchema = z.discriminatedUnion("status", [
  DailyReportDraftSchema,
  DailyReportSubmitSchema,
]);

export type DailyReportCreate = z.infer<typeof DailyReportCreateSchema>;

export const DailyReportUpdateSchema = DailyReportCreateSchema;

export type DailyReportUpdate = z.infer<typeof DailyReportUpdateSchema>;

export const DailyReportQuerySchema = z.object({
  date_from: dateStringSchema.optional(),
  date_to: dateStringSchema.optional(),
  status: z.enum(["draft", "submitted", "reviewed"]).optional(),
  user_id: z.coerce.number().positive().optional(),
});

export type DailyReportQuery = z.infer<typeof DailyReportQuerySchema>;

export const DailyReportListItemSchema = z.object({
  id: z.number(),
  report_date: z.string(),
  status: z.enum(["draft", "submitted", "reviewed"]),
  visit_count: z.number(),
  submitted_at: z.string().nullable(),
  user: z.object({
    id: z.number(),
    name: z.string(),
  }),
});

export type DailyReportListItem = z.infer<typeof DailyReportListItemSchema>;

export const DailyReportDetailSchema = z.object({
  id: z.number(),
  report_date: z.string(),
  status: z.enum(["draft", "submitted", "reviewed"]),
  problem: z.string().nullable(),
  plan: z.string().nullable(),
  submitted_at: z.string().nullable(),
  reviewed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  user: z.object({
    id: z.number(),
    name: z.string(),
    department: z.string().nullable(),
  }),
  visit_records: z.array(VisitRecordResponseSchema),
  comments: z.array(CommentListItemSchema),
});

export type DailyReportDetail = z.infer<typeof DailyReportDetailSchema>;
