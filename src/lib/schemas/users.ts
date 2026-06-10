import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "パスワードは8文字以上で入力してください")
  .refine(
    (val) => /[A-Z]/.test(val),
    "パスワードには英大文字・英小文字・数字をそれぞれ含めてください"
  )
  .refine(
    (val) => /[a-z]/.test(val),
    "パスワードには英大文字・英小文字・数字をそれぞれ含めてください"
  )
  .refine(
    (val) => /[0-9]/.test(val),
    "パスワードには英大文字・英小文字・数字をそれぞれ含めてください"
  );

export const UserCreateSchema = z.object({
  name: z
    .string()
    .min(1, "氏名を入力してください")
    .max(100, "氏名は100文字以内で入力してください"),
  email: z
    .string()
    .min(1, "メールアドレスを入力してください")
    .email("正しいメールアドレス形式で入力してください"),
  password: passwordSchema,
  role: z.enum(["sales", "manager", "admin"]),
  department: z
    .string()
    .max(100, "部署名は100文字以内で入力してください")
    .optional(),
});

export type UserCreate = z.infer<typeof UserCreateSchema>;

export const UserUpdateSchema = z.object({
  name: z
    .string()
    .min(1, "氏名を入力してください")
    .max(100, "氏名は100文字以内で入力してください"),
  email: z
    .string()
    .min(1, "メールアドレスを入力してください")
    .email("正しいメールアドレス形式で入力してください"),
  password: passwordSchema.optional(),
  role: z.enum(["sales", "manager", "admin"]),
  department: z
    .string()
    .max(100, "部署名は100文字以内で入力してください")
    .optional(),
});

export type UserUpdate = z.infer<typeof UserUpdateSchema>;

export const UserQuerySchema = z.object({
  role: z.enum(["sales", "manager", "admin"]).optional(),
  department: z.string().optional(),
});

export type UserQuery = z.infer<typeof UserQuerySchema>;

export const UserResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(["sales", "manager", "admin"]),
  department: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type UserResponse = z.infer<typeof UserResponseSchema>;
