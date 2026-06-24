/**
 * E2E-002: ログインフォームのバリデーション（未入力・形式不正・認証失敗）
 */
import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/login')
})

test('E2E-002-1: メールアドレス未入力でエラーメッセージが表示される', async ({ page }) => {
  await page.fill('#password', 'Password1')
  await page.click('button[type="submit"]')

  await expect(page.getByText('メールアドレスを入力してください')).toBeVisible()
  await expect(page).toHaveURL('/login')
})

test('E2E-002-2: メールアドレス形式不正でエラーメッセージが表示される', async ({ page }) => {
  await page.fill('#email', 'not-an-email')
  await page.fill('#password', 'Password1')
  await page.click('button[type="submit"]')

  await expect(page.getByText('正しいメールアドレス形式で入力してください')).toBeVisible()
  await expect(page).toHaveURL('/login')
})

test('E2E-002-3: パスワード未入力でエラーメッセージが表示される', async ({ page }) => {
  await page.fill('#email', 'yamada@example.com')
  await page.click('button[type="submit"]')

  await expect(page.getByText('パスワードを入力してください')).toBeVisible()
  await expect(page).toHaveURL('/login')
})

test('E2E-002-4: パスワード7文字（8文字未満）でエラーメッセージが表示される', async ({ page }) => {
  await page.fill('#email', 'yamada@example.com')
  await page.fill('#password', 'Pass123')
  await page.click('button[type="submit"]')

  await expect(page.getByText('パスワードは8文字以上で入力してください')).toBeVisible()
  await expect(page).toHaveURL('/login')
})

test('E2E-002-5: 認証失敗でサーバーエラーメッセージが表示される', async ({ page }) => {
  await page.fill('#email', 'yamada@example.com')
  await page.fill('#password', 'WrongPass1')
  await page.click('button[type="submit"]')

  await expect(page.getByText('メールアドレスまたはパスワードが正しくありません')).toBeVisible()
  await expect(page).toHaveURL('/login')
})
