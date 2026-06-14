import { execSync } from 'node:child_process'

export function setup() {
  // テスト用 DB にスキーマを同期（データは beforeAll でリセット）
  execSync('npx prisma db push', {
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
    stdio: 'pipe',
  })
}

export function teardown() {
  try {
    execSync('rm -f ./test.db', { stdio: 'pipe' })
  } catch {
    // ignore
  }
}
