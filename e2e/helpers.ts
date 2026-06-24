import { type Page } from '@playwright/test'

export async function loginAs(page: Page, email: string, password = 'Password1') {
  await page.goto('/login')
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.pathname.includes('/login'))
}

export async function apiLogin(page: Page, email: string, password = 'Password1'): Promise<void> {
  await page.request.post('/api/v1/auth/login', {
    data: { email, password },
  })
}

export async function cleanupTodayReport(page: Page): Promise<void> {
  const today = new Date().toISOString().split('T')[0]
  const res = await page.request.get(`/api/v1/daily-reports?date_from=${today}&date_to=${today}`)
  if (!res.ok()) return
  const reports = await res.json() as Array<{ id: number }>
  for (const r of reports) {
    await page.request.delete(`/api/v1/daily-reports/${r.id}`)
  }
}
