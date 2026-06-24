import { execSync } from 'node:child_process'
import { scryptSync, randomBytes } from 'node:crypto'
import Database from 'better-sqlite3'

const E2E_DB_PATH = './e2e.db'
const E2E_DB_URL = `file:${E2E_DB_PATH}`

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export default function globalSetup() {
  // テスト用 DB にスキーマを同期
  execSync('npx prisma db push', {
    env: { ...process.env, DATABASE_URL: E2E_DB_URL },
    stdio: 'pipe',
  })

  const db = new Database(E2E_DB_PATH)

  // 既存データをクリア（外部キー制約の順序で削除）
  db.exec(`
    DELETE FROM comments;
    DELETE FROM visit_records;
    DELETE FROM daily_reports;
    DELETE FROM customer_sales;
    DELETE FROM customers;
    DELETE FROM sessions;
    DELETE FROM users;
  `)

  const digest = hashPassword('Password1')

  // シードユーザー投入
  const insertUser = db.prepare(`
    INSERT INTO users (name, email, "passwordDigest", role, department, "createdAt", "updatedAt")
    VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `)
  insertUser.run('山田 太郎', 'yamada@example.com', digest, 'sales', '営業部')
  insertUser.run('佐藤 花子', 'sato@example.com', digest, 'sales', '営業部')
  insertUser.run('伊藤 次郎', 'ito@example.com', digest, 'sales', '営業部')
  insertUser.run('鈴木 部長', 'suzuki@example.com', digest, 'manager', '営業部')
  insertUser.run('管理者', 'admin@example.com', digest, 'admin', '情報システム部')

  // シード顧客投入
  db.prepare(`
    INSERT INTO customers ("companyName", "contactName", industry, "createdAt", "updatedAt")
    VALUES (?, ?, ?, datetime('now'), datetime('now'))
  `).run('株式会社アルファ', '田中 様', '製造業')

  db.close()
}
