/**
 * E2E-005: adminがユーザー登録・論理削除、削除済みアカウントのログイン不可確認
 *
 * admin 画面（SC-301/SC-302）は未実装のため、ユーザー操作は API を通じて行い、
 * ログイン可否の確認のみ UI でテストする。
 */
import { test, expect } from '@playwright/test'

const ADMIN_EMAIL = 'admin@example.com'
const PASSWORD = 'Password1'

const NEW_USER = {
  name: 'E2E テスト ユーザー',
  email: 'e2e-test-user@example.com',
  password: 'TestPass1',
  role: 'sales',
  department: 'テスト部',
}

test('E2E-005: ユーザー登録 → ログイン確認 → 論理削除 → ログイン不可確認', async ({ page }) => {
  // ステップ1: adminでログイン（/admin/users にリダイレクトされることを確認）
  await page.goto('/login')
  await page.fill('#email', ADMIN_EMAIL)
  await page.fill('#password', PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('/admin/users')

  // ステップ2: API経由で新規ユーザーを登録
  const createRes = await page.request.post('/api/v1/users', {
    data: NEW_USER,
  })
  expect(createRes.status()).toBe(201)
  const created = await createRes.json() as { id: number }
  const newUserId = created.id

  // ステップ3: 新規ユーザーでログイン → 成功することを確認
  await page.goto('/login')
  await page.fill('#email', NEW_USER.email)
  await page.fill('#password', NEW_USER.password)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('/reports')

  // ステップ4: adminで再ログインしてAPIでユーザーを論理削除
  const adminLoginRes = await page.request.post('/api/v1/auth/login', {
    data: { email: ADMIN_EMAIL, password: PASSWORD },
  })
  expect(adminLoginRes.status()).toBe(200)

  const deleteRes = await page.request.delete(`/api/v1/users/${newUserId}`)
  expect(deleteRes.status()).toBe(204)

  // ステップ5: 論理削除済みユーザーでログイン → 失敗してエラーメッセージが表示される
  await page.goto('/login')
  await page.fill('#email', NEW_USER.email)
  await page.fill('#password', NEW_USER.password)
  await page.click('button[type="submit"]')

  await expect(page.getByText('メールアドレスまたはパスワードが正しくありません')).toBeVisible()
  await expect(page).toHaveURL('/login')
})
