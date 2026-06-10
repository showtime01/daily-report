import { z } from "zod";

export const CommentCreateSchema = z.object({
  target: z.enum(["problem", "plan", "general"]),
  body: z
    .string()
    .min(1, "コメントを入力してください")
    .max(1000, "コメントは1000文字以内で入力してください"),
});

export type CommentCreate = z.infer<typeof CommentCreateSchema>;

export const CommentQuerySchema = z.object({
  target: z.enum(["problem", "plan", "general"]).optional(),
});

export type CommentQuery = z.infer<typeof CommentQuerySchema>;

/** GET /daily-reports/:id/comments のレスポンスおよび日報詳細に埋め込まれるコメント */
export const CommentListItemSchema = z.object({
  id: z.number(),
  commenter_id: z.number(),
  commenter_name: z.string(),
  target: z.enum(["problem", "plan", "general"]),
  body: z.string(),
  created_at: z.string(),
});

export type CommentListItem = z.infer<typeof CommentListItemSchema>;

/** POST /daily-reports/:id/comments のレスポンス */
export const CommentResponseSchema = z.object({
  id: z.number(),
  daily_report_id: z.number(),
  commenter_id: z.number(),
  commenter_name: z.string(),
  target: z.enum(["problem", "plan", "general"]),
  body: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type CommentResponse = z.infer<typeof CommentResponseSchema>;
