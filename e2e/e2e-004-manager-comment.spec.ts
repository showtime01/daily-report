/**
 * E2E-004: managerが上長コメント画面でコメント投稿・確認済み処理
 */
import { test, expect } from '@playwright/test'

const SALES_EMAIL = 'ito@example.com'
const MANAGER_EMAIL = 'suzuki@example.com'
const PASSWORD = 'Password1'

async function salesLogin(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.fill('#email', SALES_EMAIL)
  await page.fill('#password', PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('/reports')
}

async function managerLogin(page: import('@playwright/test').Page) {
  await page.goto('/login')
  await page.fill('#email', MANAGER_EMAIL)
  await page.fill('#password', PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('/manager/reports')
}

test('E2E-004: manager がコメント投稿・確認済み処理を行える', async ({ page }) => {
  // 前提: salesユーザーで日報を作成・提出
  await salesLogin(page)

  await page.getByRole('button', { name: '+ 本日の日報を作成' }).click()
  await expect(page).toHaveURL('/reports/new')
  await page.waitForLoadState('networkidle')

  // 訪問記録入力
  await page.locator('select').first().selectOption({ index: 1 })
  await page.getByRole('radio', { name: '対面' }).check()
  await page.getByPlaceholder('訪問目的を入力').fill('E2E-004 テスト訪問')
  await page.getByPlaceholder('訪問内容を入力').fill('E2E-004 テスト内容')

  // 課題・相談を入力（コメント投稿のターゲットとして使用）
  await page.locator('textarea[placeholder*="課題"]').fill('E2E-004 課題テスト')

  // 提出する
  await page.getByRole('button', { name: '提出する' }).click()
  await expect(page).toHaveURL('/reports')

  // managerでログインして日報を確認
  await managerLogin(page)

  // 提出済み日報の詳細を開く（伊藤の行をターゲット）
  const itoRow = page.locator('tr', { hasText: '伊藤 次郎' })
  await itoRow.getByRole('button', { name: '詳細' }).click()
  await expect(page).toHaveURL(/\/manager\/reports\/\d+/)

  // 課題セクションを確認
  await expect(page.getByText('E2E-004 課題テスト')).toBeVisible()

  // 課題にコメントを入力して送信
  const problemSection = page.locator('section').filter({ hasText: '課題・相談' })
  await problemSection.getByPlaceholder('コメントを入力...').fill('価格より価値訴求を優先しましょう。')
  await problemSection.getByRole('button', { name: '課題にコメントする' }).click()

  // コメントが表示されるのを待つ
  await expect(page.getByText('価格より価値訴求を優先しましょう。')).toBeVisible()

  // 「確認済みにする」ボタンをクリック
  await page.getByRole('button', { name: '確認済みにする' }).click()

  // ボタンが消えることを確認（確認済み処理が完了）
  await expect(page.getByRole('button', { name: '確認済みにする' })).not.toBeVisible({ timeout: 5000 })

  // 一覧に戻って確認済みバッジを確認
  await page.getByRole('button', { name: '← 一覧に戻る' }).click()
  await expect(page).toHaveURL('/manager/reports')
  await expect(page.locator('span', { hasText: '確認済み' }).first()).toBeVisible()
})
