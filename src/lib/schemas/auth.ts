import { z } from "zod";

export const LoginRequestSchema = z.object({
  email: z
    .string()
    .min(1, "メールアドレスを入力してください")
    .email("正しいメールアドレス形式で入力してください"),
  password: z
    .string()
    .min(1, "パスワードを入力してください")
    .min(8, "パスワードは8文字以上で入力してください"),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const AuthUserResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(["sales", "manager", "admin"]),
  department: z.string().nullable(),
});

export type AuthUserResponse = z.infer<typeof AuthUserResponseSchema>;
