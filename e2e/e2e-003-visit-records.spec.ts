/**
 * E2E-003: 日報作成フォームの訪問記録の動的追加・削除
 */
import { test, expect } from '@playwright/test'

const SALES_EMAIL = 'sato@example.com'
const PASSWORD = 'Password1'

test.beforeEach(async ({ page }) => {
  // salesユーザーでログインして日報作成画面へ
  await page.goto('/login')
  await page.fill('#email', SALES_EMAIL)
  await page.fill('#password', PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('/reports')
  await page.goto('/reports/new')
  await page.waitForLoadState('networkidle')
})

test('E2E-003-1: 初期表示で訪問記録が1件あり、削除ボタンが表示されない', async ({ page }) => {
  // 初期状態では訪問 #1 が1件のみ表示される
  await expect(page.getByText('訪問 #1')).toBeVisible()
  await expect(page.getByText('訪問 #2')).not.toBeVisible()

  // 1件のみの場合は削除ボタンが表示されない
  await expect(page.getByRole('button', { name: '削除' })).not.toBeVisible()
})

test('E2E-003-2: 「+ 訪問を追加」ボタンで訪問記録が増える', async ({ page }) => {
  // 「+ 訪問を追加」ボタンをクリック
  await page.getByRole('button', { name: '+ 訪問を追加' }).click()

  // 訪問 #2 が表示される
  await expect(page.getByText('訪問 #2')).toBeVisible()

  // 2件ある場合は削除ボタンが表示される
  await expect(page.getByRole('button', { name: '削除' }).first()).toBeVisible()
})

test('E2E-003-3: 「削除」ボタンで訪問記録を削除できる', async ({ page }) => {
  // 訪問記録を2件に増やす
  await page.getByRole('button', { name: '+ 訪問を追加' }).click()
  await expect(page.getByText('訪問 #2')).toBeVisible()

  // 2件目の削除ボタンをクリック
  await page.getByRole('button', { name: '削除' }).last().click()

  // 訪問 #2 が消える
  await expect(page.getByText('訪問 #2')).not.toBeVisible()

  // 1件に戻り削除ボタンが非表示
  await expect(page.getByRole('button', { name: '削除' })).not.toBeVisible()
})

test('E2E-003-4: 複数件追加後に下書き保存できる', async ({ page }) => {
  // 訪問記録を2件に増やす
  await page.getByRole('button', { name: '+ 訪問を追加' }).click()

  // 1件目の入力
  const selects = page.locator('select')
  await selects.nth(0).selectOption({ index: 1 })
  await page.locator('input[placeholder="訪問目的を入力"]').nth(0).fill('新製品の提案')
  await page.getByRole('radio', { name: '対面' }).nth(0).check()

  // 2件目の入力
  await selects.nth(1).selectOption({ index: 1 })
  await page.locator('input[placeholder="訪問目的を入力"]').nth(1).fill('フォローアップ')
  await page.getByRole('radio', { name: 'オンライン' }).nth(1).check()

  // 下書き保存
  await page.getByRole('button', { name: '下書き保存' }).click()

  // 日報一覧に戻る
  await expect(page).toHaveURL('/reports')

  // 「下書き」バッジが表示される
  await expect(page.locator('span', { hasText: '下書き' }).first()).toBeVisible()
})
