# ADR-0003: 認証・DB・リアルタイム同期に Supabase を採用する理由

## ステータス
承認 (Accepted)

## コンテキスト
KetchUp Desktop では以下の要件があります：
1. **Google アカウントによる簡単ログイン (SSO)**
2. **将来的な Passkey (WebAuthn / FIDO2) への対応**
3. **グループメンバーのポモドーロ実行中タイマーのリアルタイム同期**
4. **App Store 審査ガイドライン 5.1.1(v) に準拠した安全なアカウント削除・データ削除機能**

## 比較検討した選択肢

| 項目 | Supabase (Postgres + Auth + Realtime) | Firebase (Auth + Firestore) | 自前実装 (Auth0 + Neon) |
|---|---|---|---|
| **Google SSO 連携** | ◎ 標準搭載 (OAuth 2.0 / PKCE) | ◎ 標準搭載 | ◯ 設定が必要 |
| **Passkey (WebAuthn)** | ◎ Supabase Auth で標準サポート | △ 拡張・自前連携が必要 | ◯ Auth0有料プラン |
| **リレーショナルDB (SQL)** | ◎ 完全な PostgreSQL + RLS | ✕ NoSQL (クエリ・集計に制約) | ◎ PostgreSQL |
| **リアルタイム通知** | ◎ PostgreSQL の WAL から自動配信 | ◎ Firestore リスナー | △ WebSocket 自前実装 |
| **ローカル開発環境** | ◎ Supabase CLI (Docker) で完全再現 | ◯ エミュレータ | △ 構成が複雑 |

## 決定
**Supabase (Auth + PostgreSQL + Realtime)** を採用します。

### 決定の論理的根拠
1. **Google SSO と将来の Passkey の両立**
   Supabase Auth はデスクトップアプリのディープリンク / PKCE フローに対応しており、ブラウザを開いてワンタップで Google ログインが完了します。さらに Passkey (MFA / パスワードレス) のネイティブ API を備えており、将来的な機能拡張が容易です。
2. **グループタイマーの Realtime 購読**
   `pomo_sessions` テーブルの変更（誰が今集中中か、休憩に入ったか、一時停止したか）を Supabase Realtime (WebSocket) を介してサブスクライブできます。自前で WebSocket サーバーを常時運用する必要がありません。
3. **Row Level Security (RLS) によるセキュリティ**
   同じグループに属するユーザーのみが相手のセッション情報を閲覧できるように RLS ポリシーで厳密に制御されており、情報漏洩を防ぎます。
