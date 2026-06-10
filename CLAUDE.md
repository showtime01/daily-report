# 営業日報システム

営業担当者が日々の顧客訪問記録・課題・翌日計画を報告し、上長がフィードバックを行う Web アプリケーション。

## ロール

| ロール | 主な操作 |
|--------|---------|
| `sales` | 日報の作成・編集・提出 |
| `manager` | 日報の閲覧・コメント・確認済み処理 |
| `admin` | ユーザーマスタ・顧客マスタの管理 |

---

## 使用技術

| 区分 | 内容 |
|------|------|
| 言語 | TypeScript |
| フレームワーク | Next.js 15 (App Router) |
| UIコンポーネント | Tailwind CSS（shadcn/ui は使わない） |
| データベース | Prisma + SQLite |
| API検証 | Zod |
| テスト | Vitest |
| Git Hooks | Husky |
| CI | GitHub Actions（デプロイは行わない） |

---

## 仕様ドキュメント

### ER図・要件定義
@doc/ER_DIAGRAM.md

### 画面設計
@doc/SCREEN_DESIGN.md

### API スキーマ
@doc/API_SCHEMA.md

### テスト定義
@doc/TEST_DEFINITION.md
