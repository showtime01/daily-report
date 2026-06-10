# 営業日報システム — API仕様書

---

## 1. API概要

### ベースURL

```
/api/v1
```

### 認証方式

セッションベース認証（Cookie）を採用する。

- ログイン成功時にサーバー側でセッションを発行し、`Set-Cookie` ヘッダーでセッションIDをクライアントに返す
- 以降のリクエストは Cookie にセッションIDを含めて送信する
- 未認証のリクエストは `401 Unauthorized` を返す
- ロールに応じたアクセス制御を行い、権限不足の場合は `403 Forbidden` を返す

### データ形式

- リクエスト／レスポンスボディは JSON（`Content-Type: application/json`）
- 日付は `YYYY-MM-DD`、日時は `YYYY-MM-DDTHH:mm:ssZ`（ISO 8601 / UTC）

---

## 2. エンドポイント一覧

| カテゴリ | メソッド | エンドポイント | 説明 | 利用ロール |
|----------|----------|---------------|------|-----------|
| 認証 | POST | `/auth/login` | ログイン | 全ロール |
| 認証 | DELETE | `/auth/logout` | ログアウト | 全ロール |
| 認証 | GET | `/auth/me` | ログインユーザー情報取得 | 全ロール |
| 日報 | GET | `/daily-reports` | 日報一覧取得 | sales / manager |
| 日報 | POST | `/daily-reports` | 日報作成 | sales |
| 日報 | GET | `/daily-reports/:id` | 日報詳細取得 | sales / manager |
| 日報 | PUT | `/daily-reports/:id` | 日報更新（下書き） | sales |
| 日報 | POST | `/daily-reports/:id/submit` | 日報提出 | sales |
| 日報 | POST | `/daily-reports/:id/review` | 日報を確認済みにする | manager |
| 訪問記録 | POST | `/daily-reports/:id/visit-records` | 訪問記録追加 | sales |
| 訪問記録 | PUT | `/daily-reports/:id/visit-records/:vrid` | 訪問記録更新 | sales |
| 訪問記録 | DELETE | `/daily-reports/:id/visit-records/:vrid` | 訪問記録削除 | sales |
| コメント | GET | `/daily-reports/:id/comments` | コメント一覧取得 | sales / manager |
| コメント | POST | `/daily-reports/:id/comments` | コメント投稿 | manager |
| ユーザー | GET | `/users` | ユーザー一覧取得 | admin |
| ユーザー | POST | `/users` | ユーザー登録 | admin |
| ユーザー | GET | `/users/:id` | ユーザー詳細取得 | admin |
| ユーザー | PUT | `/users/:id` | ユーザー更新 | admin |
| ユーザー | DELETE | `/users/:id` | ユーザー論理削除 | admin |
| 顧客 | GET | `/customers` | 顧客一覧取得 | admin / sales |
| 顧客 | POST | `/customers` | 顧客登録 | admin |
| 顧客 | GET | `/customers/:id` | 顧客詳細取得 | admin |
| 顧客 | PUT | `/customers/:id` | 顧客更新 | admin |
| 顧客 | DELETE | `/customers/:id` | 顧客論理削除 | admin |
| 担当営業 | POST | `/customers/:id/sales` | 担当営業追加 | admin |
| 担当営業 | DELETE | `/customers/:id/sales/:userId` | 担当営業削除 | admin |

---

## 3. エンドポイント詳細

---

### 3-1. 認証

#### POST `/auth/login`

ログインする。成功時にセッションを発行する。

**リクエスト**

```json
{
  "email": "yamada@example.com",
  "password": "Password1"
}
```

**レスポンス `200 OK`**

```json
{
  "id": 1,
  "name": "山田 太郎",
  "email": "yamada@example.com",
  "role": "sales",
  "department": "営業部"
}
```

**エラー**

| ステータス | 条件 |
|-----------|------|
| `400` | バリデーションエラー（未入力・形式不正） |
| `401` | メール・パスワードの組み合わせ不一致、または論理削除済みアカウント |

---

#### DELETE `/auth/logout`

ログアウトする。サーバー側のセッションを破棄する。

**レスポンス `204 No Content`**

---

#### GET `/auth/me`

現在のログインユーザー情報を取得する。

**レスポンス `200 OK`**

```json
{
  "id": 1,
  "name": "山田 太郎",
  "email": "yamada@example.com",
  "role": "sales",
  "department": "営業部"
}
```

---

### 3-2. 日報

#### GET `/daily-reports`

日報一覧を取得する。

- `sales` ロール：自分の日報のみ返す
- `manager` ロール：全 `sales` ユーザーの日報を返す（`user_id` による絞り込み可）

**クエリパラメータ**

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `date_from` | `date` | — | 期間（開始）`YYYY-MM-DD` |
| `date_to` | `date` | — | 期間（終了）`YYYY-MM-DD` |
| `status` | `string` | — | `draft` / `submitted` / `reviewed` |
| `user_id` | `integer` | — | 担当者ID（manager のみ有効） |

**レスポンス `200 OK`**

```json
[
  {
    "id": 10,
    "report_date": "2026-06-02",
    "status": "draft",
    "visit_count": 1,
    "submitted_at": null,
    "user": {
      "id": 1,
      "name": "山田 太郎"
    }
  },
  {
    "id": 9,
    "report_date": "2026-06-01",
    "status": "reviewed",
    "visit_count": 2,
    "submitted_at": "2026-06-01T09:30:00Z",
    "user": {
      "id": 1,
      "name": "山田 太郎"
    }
  }
]
```

---

#### POST `/daily-reports`

日報を新規作成する（`sales` のみ）。

**リクエスト**

```json
{
  "report_date": "2026-06-02",
  "problem": "競合他社の値引き提案への対応方法を相談したい。",
  "plan": "〇〇社への見積書作成・送付",
  "status": "draft",
  "visit_records": [
    {
      "customer_id": 5,
      "visit_type": "in_person",
      "purpose": "新製品の提案",
      "content": "〇〇製品のデモを実施。購入検討の意向を確認。",
      "next_action": "見積書を送付する",
      "next_visit_date": "2026-06-10"
    }
  ]
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `report_date` | `date` | ○ | 報告日（本日のみ受付） |
| `problem` | `string` | — | 課題・相談（2000文字以内） |
| `plan` | `string` | — | 明日やること（2000文字以内） |
| `status` | `string` | ○ | `draft` / `submitted` |
| `visit_records` | `array` | ○（提出時は1件以上） | 訪問記録の配列 |

`visit_records` 各要素

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `customer_id` | `integer` | ○ | 顧客ID |
| `visit_type` | `string` | ○ | `in_person` / `online` / `phone` |
| `purpose` | `string` | ○（提出時） | 訪問目的（200文字以内） |
| `content` | `string` | ○（提出時） | 訪問内容（1000文字以内） |
| `next_action` | `string` | — | 次回アクション（500文字以内） |
| `next_visit_date` | `date` | — | 次回訪問予定日（本日以降） |

**レスポンス `201 Created`**

作成した日報オブジェクトを返す（詳細取得レスポンスと同一形式）。

**エラー**

| ステータス | 条件 |
|-----------|------|
| `400` | バリデーションエラー |
| `409` | 同一ユーザー・同一日付の日報が既に存在する |

---

#### GET `/daily-reports/:id`

日報の詳細を取得する。訪問記録・コメントを含む。

- `sales`：自分の日報のみ参照可
- `manager`：全ユーザーの日報を参照可

**レスポンス `200 OK`**

```json
{
  "id": 10,
  "report_date": "2026-06-02",
  "status": "reviewed",
  "problem": "競合他社の値引き提案への対応方法を相談したい。",
  "plan": "〇〇社への見積書作成・送付",
  "submitted_at": "2026-06-02T10:00:00Z",
  "reviewed_at": "2026-06-02T09:15:00Z",
  "created_at": "2026-06-02T08:00:00Z",
  "updated_at": "2026-06-02T10:00:00Z",
  "user": {
    "id": 1,
    "name": "山田 太郎",
    "department": "営業部"
  },
  "visit_records": [
    {
      "id": 20,
      "customer_id": 5,
      "customer_name": "株式会社〇〇",
      "visit_type": "in_person",
      "purpose": "新製品の提案",
      "content": "〇〇製品のデモを実施。購入検討の意向を確認。",
      "next_action": "見積書を送付する",
      "next_visit_date": "2026-06-10"
    }
  ],
  "comments": [
    {
      "id": 30,
      "commenter_id": 2,
      "commenter_name": "鈴木 部長",
      "target": "problem",
      "body": "価格より価値訴求を優先しましょう。一度一緒に伺います。",
      "created_at": "2026-06-02T09:15:00Z"
    }
  ]
}
```

**エラー**

| ステータス | 条件 |
|-----------|------|
| `403` | 他ユーザーの日報へ `sales` がアクセス |
| `404` | 日報が存在しない |

---

#### PUT `/daily-reports/:id`

下書き状態の日報を更新する（`sales` のみ、`status = draft` の場合のみ）。

リクエスト／レスポンス形式は `POST /daily-reports` と同一。

**エラー**

| ステータス | 条件 |
|-----------|------|
| `400` | バリデーションエラー |
| `403` | 他ユーザーの日報、または `status != draft` |
| `404` | 日報が存在しない |

---

#### POST `/daily-reports/:id/submit`

下書き日報を提出する（`sales` のみ、`status = draft` の場合のみ）。

提出バリデーション（訪問記録1件以上、必須項目の充足）を実施する。

**リクエスト** なし

**レスポンス `200 OK`**

更新後の日報オブジェクトを返す。

**エラー**

| ステータス | 条件 |
|-----------|------|
| `400` | バリデーションエラー（訪問記録0件、必須項目未入力など） |
| `403` | 他ユーザーの日報、または `status != draft` |
| `404` | 日報が存在しない |

---

#### POST `/daily-reports/:id/review`

提出済み日報を確認済みにする（`manager` のみ、`status = submitted` の場合のみ）。

**リクエスト** なし

**レスポンス `200 OK`**

更新後の日報オブジェクトを返す。

**エラー**

| ステータス | 条件 |
|-----------|------|
| `403` | `manager` ロール以外、または `status != submitted` |
| `404` | 日報が存在しない |

---

### 3-3. 訪問記録

#### POST `/daily-reports/:id/visit-records`

日報に訪問記録を追加する（`sales` のみ、`status = draft` の場合のみ）。

**リクエスト**

```json
{
  "customer_id": 5,
  "visit_type": "online",
  "purpose": "進捗確認",
  "content": "プロジェクトの現状を確認した。",
  "next_action": "追加資料を送付する",
  "next_visit_date": "2026-06-15"
}
```

**レスポンス `201 Created`**

```json
{
  "id": 21,
  "daily_report_id": 10,
  "customer_id": 5,
  "customer_name": "株式会社〇〇",
  "visit_type": "online",
  "purpose": "進捗確認",
  "content": "プロジェクトの現状を確認した。",
  "next_action": "追加資料を送付する",
  "next_visit_date": "2026-06-15",
  "created_at": "2026-06-02T11:00:00Z",
  "updated_at": "2026-06-02T11:00:00Z"
}
```

**エラー**

| ステータス | 条件 |
|-----------|------|
| `400` | バリデーションエラー |
| `403` | 他ユーザーの日報、または `status != draft` |
| `404` | 日報・顧客が存在しない |

---

#### PUT `/daily-reports/:id/visit-records/:vrid`

訪問記録を更新する（`sales` のみ、`status = draft` の場合のみ）。

リクエスト／レスポンス形式は `POST /daily-reports/:id/visit-records` と同一。

---

#### DELETE `/daily-reports/:id/visit-records/:vrid`

訪問記録を削除する（`sales` のみ、`status = draft` の場合のみ）。

日報に紐づく最後の1件は削除不可とする。

**レスポンス `204 No Content`**

**エラー**

| ステータス | 条件 |
|-----------|------|
| `400` | 最後の1件を削除しようとしている |
| `403` | 他ユーザーの日報、または `status != draft` |
| `404` | 訪問記録が存在しない |

---

### 3-4. コメント

#### GET `/daily-reports/:id/comments`

日報に紐づくコメント一覧を取得する。

**クエリパラメータ**

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `target` | `string` | — | `problem` / `plan` / `general` |

**レスポンス `200 OK`**

```json
[
  {
    "id": 30,
    "commenter_id": 2,
    "commenter_name": "鈴木 部長",
    "target": "problem",
    "body": "価格より価値訴求を優先しましょう。",
    "created_at": "2026-06-02T09:15:00Z"
  }
]
```

---

#### POST `/daily-reports/:id/comments`

コメントを投稿する（`manager` のみ、`status = submitted` または `reviewed` の場合のみ）。

**リクエスト**

```json
{
  "target": "problem",
  "body": "価格より価値訴求を優先しましょう。一度一緒に伺います。"
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `target` | `string` | ○ | `problem` / `plan` / `general` |
| `body` | `string` | ○ | コメント本文（1000文字以内） |

**レスポンス `201 Created`**

```json
{
  "id": 31,
  "daily_report_id": 10,
  "commenter_id": 2,
  "commenter_name": "鈴木 部長",
  "target": "problem",
  "body": "価格より価値訴求を優先しましょう。一度一緒に伺います。",
  "created_at": "2026-06-02T09:15:00Z",
  "updated_at": "2026-06-02T09:15:00Z"
}
```

**エラー**

| ステータス | 条件 |
|-----------|------|
| `400` | バリデーションエラー |
| `403` | `manager` ロール以外、または `status = draft` |
| `404` | 日報が存在しない |

---

### 3-5. ユーザーマスタ

#### GET `/users`

ユーザー一覧を取得する（`admin` のみ）。論理削除済みは除外する。

**クエリパラメータ**

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `role` | `string` | — | `sales` / `manager` / `admin` |
| `department` | `string` | — | 部署名（部分一致） |

**レスポンス `200 OK`**

```json
[
  {
    "id": 1,
    "name": "山田 太郎",
    "email": "yamada@example.com",
    "role": "sales",
    "department": "営業部",
    "created_at": "2026-04-01T00:00:00Z"
  }
]
```

---

#### POST `/users`

ユーザーを新規登録する（`admin` のみ）。

**リクエスト**

```json
{
  "name": "山田 太郎",
  "email": "yamada@example.com",
  "password": "Password1",
  "role": "sales",
  "department": "営業部"
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `name` | `string` | ○ | 氏名（100文字以内） |
| `email` | `string` | ○ | メールアドレス（重複不可） |
| `password` | `string` | ○ | パスワード（8文字以上、英大小文字・数字を各1文字以上含む） |
| `role` | `string` | ○ | `sales` / `manager` / `admin` |
| `department` | `string` | — | 部署名（100文字以内） |

**レスポンス `201 Created`**

登録したユーザーオブジェクトを返す（`password` フィールドは含まない）。

**エラー**

| ステータス | 条件 |
|-----------|------|
| `400` | バリデーションエラー |
| `409` | メールアドレスが重複している |

---

#### GET `/users/:id`

ユーザー詳細を取得する（`admin` のみ）。

**レスポンス `200 OK`**

```json
{
  "id": 1,
  "name": "山田 太郎",
  "email": "yamada@example.com",
  "role": "sales",
  "department": "営業部",
  "created_at": "2026-04-01T00:00:00Z",
  "updated_at": "2026-04-01T00:00:00Z"
}
```

---

#### PUT `/users/:id`

ユーザー情報を更新する（`admin` のみ）。

**リクエスト**

`password` は省略可。省略時はパスワードを変更しない。

```json
{
  "name": "山田 太郎",
  "email": "yamada@example.com",
  "password": "NewPass1",
  "role": "sales",
  "department": "第1営業部"
}
```

**レスポンス `200 OK`**

更新後のユーザーオブジェクトを返す。

**エラー**

| ステータス | 条件 |
|-----------|------|
| `400` | バリデーションエラー |
| `404` | ユーザーが存在しない（または論理削除済み） |
| `409` | メールアドレスが重複している |

---

#### DELETE `/users/:id`

ユーザーを論理削除する（`admin` のみ）。

**レスポンス `204 No Content`**

**エラー**

| ステータス | 条件 |
|-----------|------|
| `404` | ユーザーが存在しない（または既に削除済み） |

---

### 3-6. 顧客マスタ

#### GET `/customers`

顧客一覧を取得する。論理削除済みは除外する。

- `admin`：全件取得・検索可
- `sales`：マスタ選択用に全件返す（検索不可）

**クエリパラメータ**（`admin` のみ有効）

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `company_name` | `string` | — | 企業名（部分一致） |
| `industry` | `string` | — | 業種（部分一致） |

**レスポンス `200 OK`**

```json
[
  {
    "id": 5,
    "company_name": "株式会社〇〇",
    "contact_name": "佐々木 様",
    "phone": "03-1234-5678",
    "email": "info@example.com",
    "address": "東京都千代田区〇〇1-1-1",
    "industry": "製造業",
    "sales_count": 2,
    "created_at": "2026-04-01T00:00:00Z"
  }
]
```

---

#### POST `/customers`

顧客を新規登録する（`admin` のみ）。

**リクエスト**

```json
{
  "company_name": "株式会社〇〇",
  "contact_name": "佐々木 様",
  "phone": "03-1234-5678",
  "email": "info@example.com",
  "address": "東京都千代田区〇〇1-1-1",
  "industry": "製造業",
  "sales": [
    { "user_id": 1, "assigned_at": "2026-04-01" }
  ]
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `company_name` | `string` | ○ | 企業名（200文字以内） |
| `contact_name` | `string` | ○ | 担当者名（100文字以内） |
| `phone` | `string` | — | 電話番号 |
| `email` | `string` | — | メールアドレス |
| `address` | `string` | — | 住所（300文字以内） |
| `industry` | `string` | — | 業種（100文字以内） |
| `sales` | `array` | — | 担当営業の配列 |

**レスポンス `201 Created`**

登録した顧客オブジェクトを返す。

---

#### GET `/customers/:id`

顧客詳細を取得する（`admin` のみ）。担当営業一覧を含む。

**レスポンス `200 OK`**

```json
{
  "id": 5,
  "company_name": "株式会社〇〇",
  "contact_name": "佐々木 様",
  "phone": "03-1234-5678",
  "email": "info@example.com",
  "address": "東京都千代田区〇〇1-1-1",
  "industry": "製造業",
  "created_at": "2026-04-01T00:00:00Z",
  "updated_at": "2026-04-01T00:00:00Z",
  "sales": [
    {
      "user_id": 1,
      "user_name": "山田 太郎",
      "department": "営業部",
      "assigned_at": "2026-04-01"
    }
  ]
}
```

---

#### PUT `/customers/:id`

顧客情報を更新する（`admin` のみ）。

リクエスト形式は `POST /customers` と同一。`sales` 配列を送信した場合、既存の担当営業割り当てをすべて置き換える。

**レスポンス `200 OK`**

更新後の顧客オブジェクトを返す。

---

#### DELETE `/customers/:id`

顧客を論理削除する（`admin` のみ）。

**レスポンス `204 No Content`**

---

### 3-7. 担当営業

#### POST `/customers/:id/sales`

担当営業を追加する（`admin` のみ）。

**リクエスト**

```json
{
  "user_id": 3,
  "assigned_at": "2026-06-01"
}
```

**レスポンス `201 Created`**

```json
{
  "customer_id": 5,
  "user_id": 3,
  "user_name": "佐藤 花子",
  "department": "営業部",
  "assigned_at": "2026-06-01",
  "created_at": "2026-06-10T10:00:00Z"
}
```

**エラー**

| ステータス | 条件 |
|-----------|------|
| `400` | バリデーションエラー |
| `404` | 顧客・ユーザーが存在しない |
| `409` | 同一ユーザーが既に担当営業として登録されている |

---

#### DELETE `/customers/:id/sales/:userId`

担当営業の割り当てを削除する（`admin` のみ）。

**レスポンス `204 No Content`**

**エラー**

| ステータス | 条件 |
|-----------|------|
| `404` | 担当営業の割り当てが存在しない |

---

## 4. 共通仕様

### 4-1. ステータスコード一覧

| コード | 意味 | 主な用途 |
|--------|------|---------|
| `200 OK` | 成功（取得・更新） | GET / PUT / POST（アクション系） |
| `201 Created` | 作成成功 | POST（リソース作成） |
| `204 No Content` | 成功（レスポンスボディなし） | DELETE / POST（ログアウト） |
| `400 Bad Request` | リクエスト不正 | バリデーションエラー、ビジネスルール違反 |
| `401 Unauthorized` | 未認証 | セッションなし・期限切れ |
| `403 Forbidden` | アクセス拒否 | ロール不足、他ユーザーリソースへのアクセス |
| `404 Not Found` | リソース不在 | 存在しないID、論理削除済みリソース |
| `409 Conflict` | 競合 | 一意制約違反（重複メール、重複日報など） |
| `500 Internal Server Error` | サーバーエラー | 予期しないエラー |

---

### 4-2. エラーレスポンス形式

全エラーは以下の統一形式で返す。

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "入力内容に誤りがあります",
    "details": [
      {
        "field": "email",
        "message": "正しいメールアドレス形式で入力してください"
      },
      {
        "field": "password",
        "message": "パスワードは8文字以上で入力してください"
      }
    ]
  }
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `error.code` | `string` | エラー種別コード（下記参照） |
| `error.message` | `string` | エラーの概要メッセージ |
| `error.details` | `array` | フィールドごとの詳細エラー（バリデーション時のみ） |

#### エラーコード一覧

| コード | 対応ステータス | 説明 |
|--------|--------------|------|
| `VALIDATION_ERROR` | `400` | バリデーションエラー |
| `BUSINESS_RULE_ERROR` | `400` | ビジネスルール違反（訪問記録0件など） |
| `UNAUTHORIZED` | `401` | 未認証または認証情報不正 |
| `FORBIDDEN` | `403` | 権限不足 |
| `NOT_FOUND` | `404` | リソースが存在しない |
| `CONFLICT` | `409` | 一意制約違反 |
| `INTERNAL_SERVER_ERROR` | `500` | サーバー内部エラー |

---

### 4-3. ページネーション（将来対応）

現時点では全件返却とする。件数が増加した場合は以下のクエリパラメータを追加する。

| パラメータ | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `page` | `integer` | `1` | ページ番号 |
| `per_page` | `integer` | `20` | 1ページあたりの件数（最大100） |

---

### 4-4. アクセス制御まとめ

| エンドポイント | sales | manager | admin |
|---------------|-------|---------|-------|
| 認証系 | ○ | ○ | ○ |
| 日報一覧・詳細（自分） | ○ | — | — |
| 日報一覧・詳細（全員） | — | ○ | — |
| 日報作成・更新・提出 | ○ | — | — |
| 日報確認済み | — | ○ | — |
| 訪問記録 CRUD | ○ | — | — |
| コメント取得 | ○ | ○ | — |
| コメント投稿 | — | ○ | — |
| ユーザーマスタ CRUD | — | — | ○ |
| 顧客マスタ CRUD | — | — | ○ |
| 顧客一覧（選択用） | ○ | — | ○ |
| 担当営業 追加・削除 | — | — | ○ |
