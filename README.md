# 爪痕 (Tsumeato)

大学体育館のバドミントンコート予約システム。海外大学の学生体育会向けに無償提供することを想定した、紙ベース予約(コピー配布)を置き換えるアプリです。

## 技術スタック

- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase (Auth + PostgreSQL + Row Level Security)
- Stripe (決済・返金 / 未実装、後日連携予定)
- PWA (manifest + Service Worker、QRコードからブラウザ直接アクセス)
- 日本語 / English / 中文 の3言語切り替え(カスタム軽量i18n、ヘッダー常時表示)

## 実装済み機能 (MVP)

1. **予約カレンダー画面** (`/reserve`): コート × 時間枠の空き状況をカレンダー表示。予約・キャンセル操作。
2. **アカウント登録・ログイン** (`/signup`, `/login`): 大学メールアドレスでのメール確認付きサインアップ、プロフィール入力(`/profile`)。
3. **最小限のバックエンド**: Supabase のテーブル設計・RLSポリシー・二重予約防止(ユニーク制約)。

決済(Stripe)連携、体育会スタッフ/管理者向け管理画面、CSV出力、レンタル機能(将来拡張)は未実装です。DB設計はレンタル機能を見据えた形(`equipment` / `equipment_loans` テーブル)にしてあります。

## セットアップ

### 1. Supabase プロジェクトを作成

[supabase.com](https://supabase.com) で新規プロジェクトを作成し、Project Settings > API から URL と anon key を取得します。

### 2. スキーマを適用

Supabase ダッシュボードの SQL Editor で以下を順に実行してください。

```
supabase/migrations/0001_init.sql   -- テーブル・RLS・関数
supabase/seed.sql                   -- (任意) サンプルコートの投入
```

もしくは Supabase CLI を使う場合:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

### 3. 環境変数

`.env.example` を `.env.local` にコピーして値を設定します。

```bash
cp .env.example .env.local
```

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase の Project Settings > API
- `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS`: サインアップを許可する大学メールドメイン(カンマ区切り)。未設定なら制限なし
- Stripe 関連は決済実装時まで空欄でOK

### 4. Supabase Auth の設定

- Authentication > URL Configuration の Redirect URLs に `http://localhost:3000/auth/callback`(本番URLも追加)を登録してください。
- メール確認 (Confirm email) を有効にしてください(大学メールアドレスの本人確認に使用)。

### 5. インストール・起動

```bash
npm install
npm run dev
```

`http://localhost:3000` にアクセスします。

## ディレクトリ構成(抜粋)

```
app/
  (auth)/login, signup      # 認証画面
  (main)/reserve, profile   # 予約カレンダー / プロフィール
  auth/callback              # Supabase メール確認コールバック
  api/reservations           # 予約作成・キャンセル API
components/                  # UI コンポーネント
lib/supabase/                # Supabase クライアント(browser/server/middleware)
lib/i18n/                    # 多言語辞書・Context
lib/reservation/             # 時間枠生成・キャンセル期限などのルール
supabase/migrations/         # DBスキーマ (SQL)
types/database.ts            # テーブル型定義
```

## 権限ロール

`profiles.role` に `student` / `staff` / `admin` を保持します(RLSで制御)。現時点では一般学生の予約フローのみ実装済みで、スタッフ/管理者向け画面は未実装です。

## 二重予約防止・タイムアウト設計

- `reservations` テーブルに `(court_id, reservation_date, start_time)` の部分ユニークインデックス(`status in ('pending_payment','confirmed')`)を設定し、同時アクセスでも二重予約が発生しないようにしています。
- Stripe 連携後は決済確定まで `status = 'pending_payment'` とし、`hold_expires_at` を過ぎた仮予約は `expire_stale_reservations()` 関数(pg_cron 等での定期実行を想定)で自動失効させる設計です。MVPでは決済ステップがないため、予約は即座に `confirmed` になります。

<!-- redeploy trigger -->
