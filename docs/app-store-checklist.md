# Mac App Store 公開チェックリスト

KetchUp Desktop を Mac App Store に提出する際の確認項目です。

## 1. アカウント & 権限要件
- [x] **アカウント削除機能 (Guideline 5.1.1(v))**:
  - 設定画面に「アカウント削除」ボタンを配置。
  - DELETE `/v1/me` により、ユーザーのタスク、ポモ履歴、日報、音声ノート、グループ所属の全データを即時物理削除。
- [x] **App Sandbox の有効化**:
  - `src-tauri/Entitlements.plist` で `com.apple.security.app-sandbox` を有効化。
  - アウトバウンドネットワーク通信: `com.apple.security.network.client`
  - 音声日報マイクアクセス: `com.apple.security.device.audio-input`
- [x] **プライバシーパーミッション説明 (Info.plist)**:
  - `NSMicrophoneUsageDescription`: 「音声日報の文字起こしを作成するためにマイクを使用します」

## 2. アプリ品質 & 体験
- [x] **メニューバー常駐 & トレイアイコン**:
  - ポモドーロの残り時間（例: 24:59）がメニューバーにリアルタイム表示される。
  - ウィンドウを閉じてもバックグラウンドでタイマーを継続。
- [x] **オフライン耐性**:
  - ネットワーク切断時でもポモドーロタイマーの稼働・終了通知・タスク完了がローカルで動作し、再接続時に同期。
- [x] **プライバシーポリシー & お問い合わせ**:
  - アプリ内の「About」画面およびフッターからアクセス可能。
