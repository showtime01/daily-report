# 営業日報システム

営業担当者が日々の顧客訪問記録・課題・翌日計画を報告し、上長がフィードバックを行う Web アプリケーション。

## 技術スタック

| 区分 | 内容 |
|------|------|
| 言語 | TypeScript |
| フレームワーク | Next.js 15 (App Router) |
| UI | Tailwind CSS |
| データベース | Prisma + SQLite |
| API バリデーション | Zod |
| テスト（単体・結合） | Vitest |
| テスト（E2E） | Playwright |
| Git フック | Husky + lint-staged |
| CI | GitHub Actions |

## セットアップ手順

### 必要な環境

- Node.js 20 LTS 以上

### インストール

```bash
# 依存パッケージのインストール（prisma generate も自動実行される）
npm install

# DBマイグレーションの実行
npx prisma migrate dev

# シードデータの投入
npx prisma db seed

# 開発サーバーの起動
npm run dev
```

ブラウザで http://localhost:3000 を開く。

### シードデータのログイン情報

| ロール | メールアドレス | パスワード |
|--------|--------------|----------|
| 営業 (sales) | yamada@example.com | Password1 |
| 上長 (manager) | suzuki@example.com | Password1 |
| 管理者 (admin) | admin@example.com | Password1 |

## 利用可能なコマンド

| コマンド | 説明 |
|---------|------|
| `npm run dev` | 開発サーバーを起動 |
| `npm run build` | 本番用ビルドを実行 |
| `npm run start` | 本番用サーバーを起動 |
| `npm run lint` | ESLint を実行 |
| `npm run tsc` | TypeScript の型チェックを実行 |
| `npm run test` | Vitest で単体・結合テストを実行 |
| `npm run test:ui` | Vitest UI を起動 |
| `npm run test:e2e` | Playwright で E2E テストを実行 |

## ディレクトリ構成

```
daily-report/
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── api/v1/           # API Routes（REST API）
│   │   ├── login/            # ログイン画面
│   │   ├── reports/          # 営業向け日報画面
│   │   ├── manager/          # 上長向け画面
│   │   └── admin/            # 管理者向けマスタ管理画面
│   ├── components/           # 共通 React コンポーネント
│   ├── lib/                  # サーバーサイドユーティリティ
│   │   ├── prisma.ts         # Prisma クライアントのシングルトン
│   │   ├── session.ts        # セッション管理
│   │   ├── auth-guard.ts     # ロールベースのアクセス制御
│   │   ├── response.ts       # API レスポンスヘルパー
│   │   ├── password.ts       # パスワードハッシュ処理
│   │   └── schemas/          # Zod バリデーションスキーマ
│   └── __tests__/            # Vitest テストファイル
├── e2e/                      # Playwright E2E テストファイル
├── prisma/
│   └── schema.prisma         # Prisma スキーマ定義
└── doc/                      # 仕様ドキュメント
```

## 開発フロー

### ブランチ戦略

- `main` — 常にデプロイ可能な状態を保つ保護ブランチ
- `feature/<issue番号>-<説明>` — 機能開発・バグ修正用のトピックブランチ

開発は必ず `main` からブランチを切り、Pull Request を経由してマージする。

### Git フック（Husky）

| フック | タイミング | 実行内容 |
|--------|-----------|---------|
| `pre-commit` | コミット前 | `lint-staged`（変更した `.ts`/`.tsx` ファイルに ESLint を適用） |
| `pre-push` | プッシュ前 | TypeScript 型チェック（`tsc`）と単体テスト（`vitest`）を実行 |

### GitHub Actions CI

`main` ブランチへの push および Pull Request 時に自動で以下のジョブが実行される。

| ジョブ | 実行内容 |
|--------|---------|
| `ci` | lint → tsc → test（Vitest）の順に実行 |
| `e2e` | Playwright E2E テストを実行（ヘッドレス Chromium） |

## 仕様ドキュメント

| ドキュメント | 内容 |
|------------|------|
| [ER図・要件定義](doc/ER_DIAGRAM.md) | データモデル・機能要件・ER図 |
| [画面設計書](doc/SCREEN_DESIGN.md) | 画面一覧・遷移図・画面項目定義 |
| [API スキーマ](doc/API_SCHEMA.md) | エンドポイント仕様・リクエスト/レスポンス形式 |
| [テスト定義書](doc/TEST_DEFINITION.md) | テストケース一覧・合否判定基準 |
