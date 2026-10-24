# システムアーキテクチャ

KetchUp Desktop は、堅牢なデスクトップクライアント、高速な Go バックエンド、およびマネージドな Supabase 基盤から成るハイブリッド構成です。

```mermaid
graph TD
    subgraph "Desktop Client (Tauri v2)"
        UI["React 19 + TypeScript (Vite)"]
        Tray["Rust OS Tray / Menu Bar"]
        Notif["Rust Native Notifications"]
        Audio["Web Audio / BGM Engine"]
        UI <-->|IPC| Tray
        UI <-->|IPC| Notif
    end

    subgraph "Backend API (Go / Cloud Run or Local)"
        Router["chi Router + OpenAPI Validations"]
        AuthMid["Supabase JWT Auth Middleware"]
        PomoHandler["Pomodoro & Session Handler"]
        TaskHandler["Task Service (Focus To-Do)"]
        ReportHandler["Daily Report & AI Handler"]
        Router --> AuthMid
        AuthMid --> PomoHandler
        AuthMid --> TaskHandler
        AuthMid --> ReportHandler
    end

    subgraph "Data & Realtime (Supabase)"
        Auth["Supabase Auth (Google SSO / Passkey)"]
        DB[(PostgreSQL + RLS)]
        Realtime["Supabase Realtime (WebSocket)"]
    end

    subgraph "External AI"
        Gemini["Google Gemini 1.5/2.0 API"]
    end

    UI -->|HTTPS / Bearer JWT| Router
    UI -->|OAuth PKCE| Auth
    UI -->|WebSocket 購読| Realtime
    DB --> Realtime
    Router -->|pgx pool| DB
    ReportHandler -->|REST API| Gemini
```

## ディレクトリ構成
```text
ketchup-desktop/
├── apps/
│   └── desktop/               # Tauri v2 + React 19 フロントエンド
│       ├── src/               # React アプリケーション (Pages, Components, Hooks)
│       ├── src-tauri/         # Rust バックエンド (トレイ, 通知, タイマースレッド)
│       └── package.json
├── server/                    # Go API サーバー
│   ├── cmd/server/            # エントリポイント
│   ├── internal/              # ルーター, サービス, リポジトリ, ミドルウェア
│   ├── openapi/               # OpenAPI 仕様書 (Single Source of Truth)
│   └── go.mod
├── supabase/                  # Supabase マイグレーション & 設定
│   └── migrations/
├── docs/                      # 設計書, ADR, セットアップガイド
└── Makefile                   # 開発コマンド集
```
