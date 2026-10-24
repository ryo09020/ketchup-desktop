# KetchUp Desktop 🍅

集中（ポモドーロ）× タスク × 日報 × グループ × AI まとめ のデスクトップアプリ。
Web 版 [ketch-up](../ketch-up) の機能・UI を引き継ぎ、デスクトップならではの
「リロードしても止まらないタイマー」「メニューバー常駐」「どこからでもタスク追加」を実現します。

## 構成

| ディレクトリ | 内容 | 技術 |
|---|---|---|
| `apps/desktop` | デスクトップアプリ | Tauri v2 (Rust) + React 19 + TypeScript + Vite + SCSS Modules |
| `server` | API サーバー | Go (chi + pgx) / OpenAPI (oapi-codegen) |
| `supabase` | 認証・DB・Realtime | Supabase (Postgres + RLS) |
| `docs` | 設計ドキュメント / ADR | Markdown |

技術選定の理由は [`docs/adr/`](docs/adr) を参照してください（1 決定 = 1 ファイル）。

## クイックスタート

詳細は [`docs/setup.md`](docs/setup.md)。

```bash
make setup        # 依存インストール
make db.start     # Supabase (Docker) 起動 + マイグレーション
make server.dev   # Go API 起動 (http://localhost:8080)
make desktop.dev  # デスクトップアプリ起動
```

## ドキュメント

- 📖 **[アプリ完全ガイド & 設計判断書（なぜこれを選んだのか）](docs/app-guide-and-decisions.md)**
- [アーキテクチャ詳細](docs/architecture.md)
- [開発環境セットアップ](docs/setup.md)
- [App Store 公開チェックリスト](docs/app-store-checklist.md)
- [ADR 一覧 (決定ログ)](docs/adr/README.md)

# 改善点
- ログイン機能の実装
  -- SSOとパスキー機能の実装
- タスク機能
    -- タスクの上位層のタグ付け、AIによる自動タグ付け
- 日報機能
  -- 

