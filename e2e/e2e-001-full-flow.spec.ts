/**
 * E2E-001: ログイン→日報作成→提出→manager確認済み処理の一連フロー
 */
import { test, expect } from '@playwright/test'

const SALES_EMAIL = 'yamada@example.com'
const MANAGER_EMAIL = 'suzuki@example.com'
const PASSWORD = 'Password1'

async function login(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login')
  await page.fill('#email', email)
  await page.fill('#password', PASSWORD)
  await page.click('button[type="submit"]')
}

test('E2E-001: 日報作成から提出・manager確認済みまでの一連フロー', async ({ page }) => {
  // ステップ1: salesユーザーでログイン
  await login(page, SALES_EMAIL)
  await expect(page).toHaveURL('/reports')

  // ステップ2: 「本日の日報を作成」ボタンをクリック
  await expect(page.getByRole('button', { name: '+ 本日の日報を作成' })).toBeVisible()
  await page.getByRole('button', { name: '+ 本日の日報を作成' }).click()
  await expect(page).toHaveURL('/reports/new')

  // ステップ3: 訪問記録を入力
  // 顧客選択
  await page.locator('select').first().selectOption({ index: 1 })
  // 訪問種別（対面）
  await page.getByRole('radio', { name: '対面' }).check()
  // 訪問目的
  await page.getByPlaceholder('訪問目的を入力').fill('新製品のデモ提案')
  // 訪問内容
  await page.getByPlaceholder('訪問内容を入力').fill('製品デモを実施し、購入検討の意向を確認した。')

  // 課題・相談
  await page.locator('textarea[placeholder*="課題"]').fill('競合他社の価格比較について相談したい。')
  // 明日やること
  await page.locator('textarea[placeholder*="明日"]').fill('見積書を作成して送付する。')

  // ステップ4: 「提出する」ボタンをクリック
  await page.getByRole('button', { name: '提出する' }).click()

  // 日報一覧に戻る
  await expect(page).toHaveURL('/reports')

  // ステップ5: 一覧に「提出済み」の日報が表示されていることを確認
  await expect(page.locator('span', { hasText: '提出済み' }).first()).toBeVisible()

  // ステップ6: managerでログイン
  await login(page, MANAGER_EMAIL)
  await expect(page).toHaveURL('/manager/reports')

  // ステップ7: 日報一覧に山田の日報（提出済み）が表示されていることを確認
  await expect(page.getByText('山田 太郎')).toBeVisible()
  await expect(page.locator('span', { hasText: '提出済み' }).first()).toBeVisible()

  // 詳細画面へ遷移（提出済みの行の詳細ボタンをクリック）
  const submittedRow = page.locator('tr', { hasText: '提出済み' }).first()
  await submittedRow.getByRole('button', { name: '詳細' }).click()
  await expect(page).toHaveURL(/\/manager\/reports\/\d+/)

  // ステップ8: 「確認済みにする」ボタンをクリック
  await expect(page.getByRole('button', { name: '確認済みにする' })).toBeVisible()
  await page.getByRole('button', { name: '確認済みにする' }).click()

  // ステータスが「確認済み」になっていることを確認
  await expect(page.getByText('確認済みにする')).not.toBeVisible({ timeout: 3000 })

  // ステップ9: salesで再ログインして確認済みを確認
  await login(page, SALES_EMAIL)
  await expect(page).toHaveURL('/reports')
  await expect(page.locator('span', { hasText: '確認済み' }).first()).toBeVisible()
})
