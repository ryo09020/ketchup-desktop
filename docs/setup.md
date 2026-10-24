# 開発環境セットアップガイド

## 必要ツール
- **Node.js**: v20 以上 (`node -v`)
- **pnpm**: v9 以上 (`pnpm -v`)
- **Go**: 1.23 以上 (`go version`)
- **Rust**: 1.80 以上 (`rustc --version`, `cargo --version`)
- **Supabase CLI**: (`supabase --version`)

## クイックスタート

### 1. 依存関係のインストール
```bash
# ルートおよびフロントエンドの依存パッケージをインストール
pnpm install
```

### 2. データベースの起動 (Supabase Local)
```bash
supabase start
```
※ 初回実行時に Docker コンテナが起動し、`supabase/migrations/` 配下のマイグレーションが自動適用されます。

### 3. Go API サーバーの起動
```bash
cd server
go run cmd/server/main.go
# http://localhost:8080 で API が待受開始
```

### 4. デスクトップアプリの起動
```bash
pnpm desktop dev
# または
cd apps/desktop && pnpm tauri dev
```
ブラウザ開発モード単体で動作確認したい場合は以下も可能です：
```bash
cd apps/desktop && pnpm vite
```
