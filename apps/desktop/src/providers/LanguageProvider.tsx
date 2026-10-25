import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type Language = 'ja' | 'en';

export const translations = {
  ja: {
    // Navigation
    'nav.timer': 'タイマー',
    'nav.tasks': 'タスク',
    'nav.reports': '日報',
    'nav.stats': '統計',
    'nav.settings': '設定',
    'nav.miniTimer': 'ミニタイマーモード (画面隅に最前面フロート)',
    'nav.theme': 'テーマ切り替え',
    'nav.tutorial': 'チュートリアルツアーを開始',

    // Timer
    'timer.focus': '集中',
    'timer.shortBreak': '小休憩',
    'timer.longBreak': '長休憩',
    'timer.paused': '一時停止中',
    'timer.idle': '待機中',
    'timer.start': '集中スタート',
    'timer.pause': '一時停止',
    'timer.resume': '再開',
    'timer.finishAndRecord': '完了して記録',
    'timer.skip': 'スキップ',
    'timer.selectTask': 'タスクを選択',
    'timer.changeTask': 'タスク変更',
    'timer.completeTask': 'タスクを完了',
    'timer.quickTerms': '集中ターム設定',
    'timer.min': '分',
    'timer.bgm': '環境音・BGM',
    'timer.bgmNone': 'オフ',
    'timer.bgmBrownNoise': 'ブラウンノイズ',
    'timer.bgmSynthesizer': 'シンセサイザー',
    'timer.miniMode': 'ミニモード',
    'timer.sessionStreak': '本日の消化セッション',
    'timer.streakCount': '{count} 回',
    'timer.stopChime': 'チャイムを止める',

    // Tasks
    'tasks.title': 'タスク管理',
    'tasks.all': 'すべて',
    'tasks.inProgress': '進行中',
    'tasks.completed': '完了',
    'tasks.newTask': '新規タスク追加',
    'tasks.placeholderTitle': 'タスク名を入力 (例: ドキュメント作成、読書)',
    'tasks.placeholderNote': 'メモ・詳細 (任意)',
    'tasks.estimatedPomos': '見積もりポモドーロ',
    'tasks.category': '大カテゴリー',
    'tasks.topic': 'トピック・小分類',
    'tasks.dueDate': '期限 (任意)',
    'tasks.add': 'タスクを追加',
    'tasks.cancel': 'キャンセル',
    'tasks.empty': '該当するタスクはありません',
    'tasks.actualFocus': '累計集中',
    'tasks.pomos': '{count} pomo',

    // Timeline
    'timeline.title': '本日の集中タイムライン',
    'timeline.total': '総集中時間',
    'timeline.sessions': '消化セッション',
    'timeline.noRecords': '本日の集中記録はまだありません',

    // Reports
    'reports.title': '日報 & 振り返り',
    'reports.dailyReport': 'デイリー日報',
    'reports.newReport': '日報を作成',
    'reports.editReport': '日報を編集',
    'reports.saveReport': '日報を保存',
    'reports.saving': '保存中...',
    'reports.savedSuccess': '日報を保存しました！',
    'reports.discardDraft': '下書きを破棄',
    'reports.aiSummary': 'AI月間・週間サマリー',
    'reports.voiceInput': '音声で入力',
    'reports.saveToObsidian': 'Obsidianに保存',
    'reports.savingToObsidian': 'Obsidianに保存中...',
    'reports.savedToObsidian': 'Obsidianに保存完了！',
    'reports.selfScoreTitle': '本日の達成度 / やる気度',
    'reports.points': '点',
    'reports.moodPeak': '絶好調・ゾーン状態',
    'reports.moodGood': '充実・順調に進んだ',
    'reports.moodNormal': '普通・マイペース',
    'reports.moodTired': '疲れ気味・少し停滞',
    'reports.moodExhausted': '要休養・エネルギー切れ',
    'reports.statsStripFocus': '総集中時間',
    'reports.statsStripSessions': '消化セッション',
    'reports.statsStripScore': '達成度 / やる気度',
    'reports.times': '回',

    // Monthly Trend
    'trend.title': '月間やる気 & 集中推移',
    'trend.leftAxis': '勉強ポモ数 (0〜25 pomo)',
    'trend.rightAxis': 'やる気度 (0〜100点)',
    'trend.focusPomos': '集中ポモ数',
    'trend.selfScore': 'やる気度',
    'trend.noData': '記録なし',

    // Stats
    'stats.title': '集中 & ポモドーロ統計',
    'stats.todayPomos': '本日の完了ポモドーロ',
    'stats.todayFocus': '本日の総集中時間',
    'stats.weekPomos': '今週の完了ポモドーロ',
    'stats.totalTasks': '完了タスク累計',
    'stats.weeklyChartTitle': '直近7日間のポモドーロ推移',
    'stats.countUnit': '回',
    'stats.minUnit': '分',
    'stats.taskUnit': '個',
    'stats.pomoUnit': 'ポモドーロ数',
    'stats.today': '今日',

    // Settings
    'settings.title': 'アプリ & 環境設定',
    'settings.languageSection': '言語設定 (Language)',
    'settings.languageLabel': '表示言語 / Language',
    'settings.languageDesc': 'アプリケーション全体の表示言語を切り替えます',
    'settings.themeSection': '外観・テーマ (Theme)',
    'settings.themeLabel': 'カラーテーマ',
    'settings.themeDesc': 'ライトモードまたはダークモードを選択します',
    'settings.themeLight': 'ライト (Light)',
    'settings.themeDark': 'ダーク (Dark)',
    'settings.accountSection': '動作環境 & アカウント',
    'settings.accountStandalone': '完全スタンドアローン (ローカル専用)',
    'settings.accountStandaloneDesc': 'すべてのデータはこの Mac 内の SQLite に保存され、外部サーバーとは一切通信しません。',
    'settings.timerSection': 'タイマー設定 & 集中ターム',
    'settings.focusDuration': '1セッションの集中時間 (分)',
    'settings.focusDurationDesc': 'タイマーの1ターム分数 (前回設定した値が自動で保持されます)',
    'settings.shortBreak': '短い休憩 (分)',
    'settings.shortBreakDesc': '集中ターム後の標準休憩 (デフォルト: 5分)',
    'settings.longBreak': '長い休憩 (分)',
    'settings.longBreakDesc': '4ターム消化後の大休憩 (デフォルト: 15分)',
    'settings.defaultBgm': 'デフォルト BGM',
    'settings.defaultBgmDesc': '集中タイマー開始時に自動で再生される環境音',
    'settings.bgmNone': 'なし (無音)',
    'settings.bgmBrownNoise': 'ブラウンノイズ (集中用雨音)',
    'settings.bgmSynthesizer': 'シンセサイザー (アンビエント)',
    'settings.pomoCalc': 'ポモドーロ換算基準',
    'settings.pomoCalcDesc': '1pomo = 累計25分作業（1分×25回でも、25分×1回でも25分作業で1pomoとして正確に集計）',
    'settings.obsidianSection': 'Obsidian 連携設定',
    'settings.obsidianVaultFolder': 'Obsidian Vault 保存先フォルダ',
    'settings.obsidianVaultDesc': '日報はこの Vault の中の「daily_report」フォルダに自動保存されます',
    'settings.obsidianDestination': '保存先: {path}/daily_report/YYYY-MM-DD.md',
    'settings.selectFolder': 'フォルダ選択',
    'settings.aiSection': 'AI 連携設定 (ローカル保存)',
    'settings.aiProvider': 'AI プロバイダー',
    'settings.aiProviderDesc': 'タスク分類・音声日報・AIサマリーで使用する AI を選択（登録できるキーは1つです）',
    'settings.aiApiKey': 'API キー',
    'settings.aiApiKeyDesc': '※ キーはこの Mac 内の SQLite（ketchup.db）に保存されます。外部サーバーには送信されず、下の「キーを削除」でいつでも完全に抹消できます。',
    'settings.aiGetKey': 'キーを取得',
    'settings.aiFetchModels': 'モデル取得',
    'settings.aiFetching': '取得中...',
    'settings.aiModel': '使用モデル',
    'settings.aiModelDesc': '「モデル取得」でこのキーで使えるモデル一覧を読み込みます',
    'settings.aiNoModels': '未取得',
    'settings.aiSave': '保存',
    'settings.aiTest': '接続テスト',
    'settings.aiTesting': 'テスト中...',
    'settings.aiRemove': 'キーを削除 (忘れさせる)',
    'settings.aiStatusOn': '{provider} / {model} で AI 機能が有効です',
    'settings.aiStatusOff': '未設定（AI 機能はローカルの簡易ロジックで動作します）',
    'settings.aiSaved': 'ローカル DB に保存しました',
    'settings.aiTestOk': '接続成功: {reply}',
    'settings.aiClaudeVoiceNote': '※ Claude は音声入力に非対応のため、音声日報は使えません',
    'settings.aiRemoveConfirm': '登録済みの API キーをローカル DB から完全に削除（忘れさせる）しますか？',
    'settings.aiReplaceConfirm': '既に {provider} のキーが登録されています。上書きしてよろしいですか？',
    'settings.appInfoSection': 'アプリ情報',
    'settings.appName': 'アプリケーション名',
    'settings.bundleId': 'Bundle ID',
    'settings.bundleIdDesc': 'Mac App Store 識別子',
    'settings.dangerSection': '危険な操作 (データ初期化)',
    'settings.deleteAccount': 'アカウントと全データの削除',
    'settings.deleteAccountDesc': 'タスク、ポモドーロ記録、日報を含むすべてのローカルデータを削除します。',
    'settings.deleteBtn': 'データを初期化',
    'settings.deleting': '削除中...',

    // Timer Page
    'timerPage.todayPomos': '今日のポモ',
    'timerPage.focusTime': '集中時間',
    'timerPage.completedTasks': '完了タスク',

    // Simple Task List (Timer View)
    'simpleTasks.title': '未完了タスク',
    'simpleTasks.countBadge': '{count}件',
    'simpleTasks.placeholder': '新しいタスクを入力してEnter...',
    'simpleTasks.estOption': '目安 {n} pomo',
    'simpleTasks.add': '追加',
    'simpleTasks.completeTooltip': 'タスクを完了にする',
    'simpleTasks.editTooltip': 'クリックしてタスク名を編集',
    'simpleTasks.startFocus': '集中',
    'simpleTasks.startFocusTooltip': 'このタスクで集中スタート',
    'simpleTasks.deleteTooltip': '削除',
    'simpleTasks.empty': '未完了のタスクはありません。上の入力欄からタスクを追加してみましょう！',

    // Task Page
    'taskPage.title': 'タスク管理 (Focus To-Do)',

    // Calendar
    'calendar.yearMonth': '{year}年 {month}月',
    'calendar.prevMonth': '前月',
    'calendar.nextMonth': '翌月',
    'calendar.todayReport': '今日の日報',
    'calendar.published': '発行済み',
    'calendar.notPublished': '未発行',
    'calendar.publishedTooltip': '{date} (発行済み日報)',
    'calendar.todayTooltip': '{date} (今日の日報)',
    'calendar.emptyTooltip': '{date} (日報なし)',

    // Mini Timer
    'mini.noTask': 'タスク未選択',
    'mini.focusing': '集中中',
    'mini.breaking': '休憩中',
    'mini.paused': '一時停止',
    'mini.idle': '待機中',
    'mini.startTooltip': '開始',
    'mini.pauseTooltip': '一時停止',
    'mini.stopTooltip': 'タイマーを停止して実時間で記録',
    'mini.restoreTooltip': 'フルウィンドウに戻す',

    // AI & Voice Modals
    'aiModal.title': 'AI 生産性振り返りまとめ',
    'aiModal.daily': '今日 (Daily)',
    'aiModal.weekly': '今週 (Weekly)',
    'aiModal.monthly': '今月 (Monthly)',
    'aiModal.analyzing': '過去のポモドーロ実績と日報を分析中...',
    'aiModal.empty': 'まとめ情報がありません。',
    'aiModal.error': 'AIまとめの取得に失敗しました。',
    'aiModal.close': '閉じる',
    'aiModal.demoNotice': 'APIキーがセットされていません。現在はデモを表示しています。',

    'voiceModal.title': '音声日報の作成',
    'voiceModal.desc': 'マイクボタンを押して、今日の作業内容や感想を自由に話してください。Google Gemini AI が自動で文字起こしし、綺麗な日報Markdownにまとめます。',
    'voiceModal.generating': 'Gemini AI が日報を生成中...',
    'voiceModal.recording': '録音中... (もう一度押して終了)',
    'voiceModal.tapStart': 'タップして録音開始',
    'voiceModal.errorVoice': '音声処理に失敗しました。Gemini API設定をご確認ください。',
    'voiceModal.errorMic': 'マイクへのアクセスが拒否されたか利用できません。',
    'voiceModal.close': '閉じる',

    // Group Page
    'group.title': 'グループ & メンバータイマー',
    'group.create': 'グループ作成',
    'group.join': '招待コードで参加',
    'group.noGroups': 'まだグループがありません。「グループ作成」または「招待コードで参加」してください。',
    'group.members': 'メンバー: {count}名',
    'group.inviteCode': '招待コード: {code}',
    'group.noDesc': '説明なし',
    'group.memberActivity': '{name} のメンバー稼働状況 (リアルタイム)',
    'group.workingOn': '作業中: {task}',
    'group.statusFocus': '集中中',
    'group.statusBreak': '休憩中',
    'group.statusPaused': '一時停止',
    'group.statusIdle': '待機中',
    'group.loading': 'メンバー情報を読み込み中...',

    // Task Select Modal
    'modal.selectTask': '集中するタスクを選択',
    'modal.noTasks': '未完了のタスクがありません。先にタスクを作成してください。',
    'modal.close': '閉じる',

    // Tutorial Tour
    'tour.badge': 'チュートリアル',
    'tour.next': '次へ',
    'tour.finish': '使い始める',
    'tour.prev': '戻る',
    'tour.skip': 'スキップ',
    'tour.nextTitle': '次のステップへ進む',
    'tour.finishTitle': 'チュートリアルを完了して使い始める',
    'tour.resumeAuto': '自動進行を再開',
    'tour.pauseAuto': '自動進行を一時停止',
    'tour.skipTitle': 'ツアーをスキップして終了',
    'tour.stepCounter': '{current} / {total}',

    'tour.step1.badge': 'タイマー開始',
    'tour.step1.title': '1. ポモドーロタイマーの開始',
    'tour.step1.desc': '25分集中と5分休憩の黄金サイクルで作業します。終了時は澄んだチャイムが鳴り、自動で休憩に入ります。',
    'tour.step1.hint': '中央の「再生ボタン」を押すと、すぐに集中タイマーが開始します。',

    'tour.step2.badge': '時間設定',
    'tour.step2.title': '2. 集中ターム（分数）の選択',
    'tour.step2.desc': '体調や作業量に合わせて、「10分」「15分」「25分」などをワンタップでいつでも切り替えられます。自由な分数も入力可能です。',
    'tour.step2.hint': '「15m」や「25m」のボタンをクリックして、集中時間を切り替えます。',

    'tour.step3.badge': 'タスク連動',
    'tour.step3.title': '3. 今日のタスク追加 & 集中連動',
    'tour.step3.desc': '今日やることをサッと追加できます。タスク右側の「集中」ボタンを押すと、そのタスク専用の集中時間が自動で記録されます。',
    'tour.step3.hint': '入力欄に作業タイトルを入力してEnter、右の「集中」を押して連動させます。',

    'tour.step4.badge': 'タイムライン',
    'tour.step4.title': '4. 24時間集中タイムライン',
    'tour.step4.desc': '何時にどれだけ集中したかがリアルタイムに可視化されます。途中で停止しても、実際に作業した秒数が正確に積み上がります。',
    'tour.step4.hint': '勉強・作業した時間帯と累計ポモドーロ数が一目で把握できます。',

    'tour.step5.badge': 'ミニ画面',
    'tour.step5.title': '5. ミニプレイヤー化',
    'tour.step5.desc': '画面の隅に小さく常駐！他の作業を邪魔せずに残り時間を確認できます。クリックでいつでもフル画面に戻せます。',
    'tour.step5.hint': 'ヘッダー右上の「縮小アイコン」を押してミニタイマーに切り替えます。',

    'tour.step6.badge': 'タスクマップ',
    'tour.step6.title': '6. タスク管理 & ネットワークマップ',
    'tour.step6.desc': '全タスクの進捗を一括管理できます。右上の「マップ」タブを選択すると、Obsidian風のネットワークグラフでタスクの関連性を視覚的に俯瞰できます。',
    'tour.step6.hint': '右上の「マップ」を押してネットワークグラフ表示に切り替えられます。',

    'tour.step7.badge': '日報 & AI',
    'tour.step7.title': '7. 日報自動作成 & AIサマリー',
    'tour.step7.desc': '今日の集中実績は自動で日報に下書きされます。「AIサマリー」を押すと、あなたの集中実績をもとにAIが振り返りアドバイスを作成します。',
    'tour.step7.hint': '「AI月間・週間サマリー」を押すと、AIの振り返り分析が開きます。',

    'tour.step8.badge': 'Obsidian連携',
    'tour.step8.title': '8. Obsidian へ直接保存',
    'tour.step8.desc': '「Obsidianに保存」ボタンを押すだけで、ローカルのObsidian Vault（daily_report）にMarkdownファイルとして直接書き出されます。',
    'tour.step8.hint': '「Obsidianに保存」を押して今日の記録を即座にMarkdown出力します。',

    'tour.step9.badge': 'ローカル設定',
    'tour.step9.title': '9. 完全スタンドアローン & BYOK',
    'tour.step9.desc': 'すべてのデータはMac内（SQLite）に完全ローカル保存され、外部サーバー通信はありません。お持ちのAPIキーを登録すれば高度なAI機能も使えます。',
    'tour.step9.hint': '必要に応じてGemini / Claude / OpenAI のキーを登録します。',

    'tour.step10.badge': 'ツアー達成',
    'tour.step10.title': '10. チュートリアル達成！',
    'tour.step10.desc': 'KetchUp の主要機能をすべて体験しました！今日から集中タイマーと日報を活用して、最高の作業リズムをつくりましょう。',
    'tour.step10.hint': '右上の「使い始める」を押して完了！',

    'tasks.onboardingTitle': '?ボタンを押してチュートリアルを開始しよう！',
  },
  en: {
    // Navigation
    'nav.timer': 'Timer',
    'nav.tasks': 'Tasks',
    'nav.reports': 'Reports',
    'nav.stats': 'Stats',
    'nav.settings': 'Settings',
    'nav.miniTimer': 'Mini Timer Mode (Float on Top)',
    'nav.theme': 'Toggle Theme',
    'nav.tutorial': 'Start Tutorial Tour',

    // Timer
    'timer.focus': 'Focus',
    'timer.shortBreak': 'Short Break',
    'timer.longBreak': 'Long Break',
    'timer.paused': 'Paused',
    'timer.idle': 'Idle',
    'timer.start': 'Start Focus',
    'timer.pause': 'Pause',
    'timer.resume': 'Resume',
    'timer.finishAndRecord': 'Finish & Record',
    'timer.skip': 'Skip',
    'timer.selectTask': 'Select Task',
    'timer.changeTask': 'Change Task',
    'timer.completeTask': 'Complete Task',
    'timer.quickTerms': 'Quick Terms',
    'timer.min': 'm',
    'timer.bgm': 'Background Sound',
    'timer.bgmNone': 'Off',
    'timer.bgmBrownNoise': 'Brown Noise',
    'timer.bgmSynthesizer': 'Synthesizer',
    'timer.miniMode': 'Mini Mode',
    'timer.sessionStreak': "Today's Sessions",
    'timer.streakCount': '{count} sessions',
    'timer.stopChime': 'Stop Chime',

    // Tasks
    'tasks.title': 'Tasks',
    'tasks.all': 'All',
    'tasks.inProgress': 'In Progress',
    'tasks.completed': 'Completed',
    'tasks.newTask': 'Add Task',
    'tasks.placeholderTitle': 'Enter task title (e.g. Vocabulary Study)',
    'tasks.placeholderNote': 'Notes & details (optional)',
    'tasks.estimatedPomos': 'Estimated Pomodoros',
    'tasks.category': 'Category',
    'tasks.topic': 'Topic',
    'tasks.dueDate': 'Due Date (optional)',
    'tasks.add': 'Add Task',
    'tasks.cancel': 'Cancel',
    'tasks.empty': 'No tasks found',
    'tasks.actualFocus': 'Logged Focus',
    'tasks.pomos': '{count} pomo',

    // Timeline
    'timeline.title': "Today's Timeline",
    'timeline.total': 'Total Focus Time',
    'timeline.sessions': 'Sessions',
    'timeline.noRecords': 'No focus sessions recorded today yet',

    // Reports
    'reports.title': 'Daily Reports & Review',
    'reports.dailyReport': 'Daily Report',
    'reports.newReport': 'New Report',
    'reports.editReport': 'Edit Report',
    'reports.saveReport': 'Save Report',
    'reports.saving': 'Saving...',
    'reports.savedSuccess': 'Report saved successfully!',
    'reports.discardDraft': 'Discard Draft',
    'reports.aiSummary': 'AI Summary',
    'reports.voiceInput': 'Voice Input',
    'reports.saveToObsidian': 'Save to Obsidian',
    'reports.savingToObsidian': 'Saving to Obsidian...',
    'reports.savedToObsidian': 'Saved to Obsidian!',
    'reports.selfScoreTitle': "Today's Motivation / Self-Score",
    'reports.points': 'pts',
    'reports.moodPeak': 'Peak State / In the Zone',
    'reports.moodGood': 'Great Progress / Smooth',
    'reports.moodNormal': 'Normal / Steady Pace',
    'reports.moodTired': 'A Bit Tired / Slowing Down',
    'reports.moodExhausted': 'Exhausted / Need Rest',
    'reports.statsStripFocus': 'Total Focus',
    'reports.statsStripSessions': 'Sessions',
    'reports.statsStripScore': 'Motivation Score',
    'reports.times': 'sessions',

    // Monthly Trend
    'trend.title': 'Monthly Motivation & Focus Trend',
    'trend.leftAxis': 'Study Pomos (0–25 pomo)',
    'trend.rightAxis': 'Motivation Score (0–100 pts)',
    'trend.focusPomos': 'Focus Pomos',
    'trend.selfScore': 'Motivation Score',
    'trend.noData': 'No data',

    // Stats
    'stats.title': 'Focus & Pomodoro Statistics',
    'stats.todayPomos': "Today's Pomodoros",
    'stats.todayFocus': "Today's Total Focus",
    'stats.weekPomos': "This Week's Pomodoros",
    'stats.totalTasks': 'Completed Tasks',
    'stats.weeklyChartTitle': 'Past 7 Days Pomodoro Trend',
    'stats.countUnit': '',
    'stats.minUnit': 'm',
    'stats.taskUnit': '',
    'stats.pomoUnit': 'Pomos',
    'stats.today': 'Today',

    // Settings
    'settings.title': 'App & Environment Settings',
    'settings.languageSection': 'Language Settings',
    'settings.languageLabel': 'Display Language',
    'settings.languageDesc': 'Switch the display language of the application',
    'settings.themeSection': 'Appearance & Theme',
    'settings.themeLabel': 'Color Theme',
    'settings.themeDesc': 'Choose between Light and Dark mode',
    'settings.themeLight': 'Light Mode',
    'settings.themeDark': 'Dark Mode',
    'settings.accountSection': 'Environment & Account',
    'settings.accountStandalone': 'Standalone (Local-Only)',
    'settings.accountStandaloneDesc': 'All data is stored in your local SQLite on this Mac with zero network calls.',
    'settings.timerSection': 'Timer Settings & Focus Terms',
    'settings.focusDuration': 'Focus Duration per Term (min)',
    'settings.focusDurationDesc': 'Length of one focus term (previous value automatically remembered)',
    'settings.shortBreak': 'Short Break (min)',
    'settings.shortBreakDesc': 'Standard break after focus (default: 5 min)',
    'settings.longBreak': 'Long Break (min)',
    'settings.longBreakDesc': 'Long rest after 4 focus terms (default: 15 min)',
    'settings.defaultBgm': 'Default BGM',
    'settings.defaultBgmDesc': 'Ambient background audio played automatically when focus timer starts',
    'settings.bgmNone': 'None (Silent)',
    'settings.bgmBrownNoise': 'Brown Noise (Rain/Wind)',
    'settings.bgmSynthesizer': 'Synthesizer (Ambient)',
    'settings.pomoCalc': 'Pomodoro Calculation Rule',
    'settings.pomoCalcDesc': '1 pomo = 25 minutes of accumulated work (exact minutes accurately aggregated)',
    'settings.obsidianSection': 'Obsidian Integration',
    'settings.obsidianVaultFolder': 'Obsidian Vault Directory',
    'settings.obsidianVaultDesc': 'Daily reports will be saved into the "daily_report" folder in this Vault',
    'settings.obsidianDestination': 'Target: {path}/daily_report/YYYY-MM-DD.md',
    'settings.selectFolder': 'Choose Folder',
    'settings.aiSection': 'AI Integration (Local SQLite)',
    'settings.aiProvider': 'AI Provider',
    'settings.aiProviderDesc': 'AI used for task classification, voice reports and AI summaries (only one key can be registered)',
    'settings.aiApiKey': 'API Key',
    'settings.aiApiKeyDesc': 'Note: Key is stored locally in your Mac\'s SQLite (ketchup.db). Never sent to any external server and can be completely wiped anytime.',
    'settings.aiGetKey': 'Get key',
    'settings.aiFetchModels': 'Fetch models',
    'settings.aiFetching': 'Fetching...',
    'settings.aiModel': 'Model',
    'settings.aiModelDesc': 'Click "Fetch models" to load the models available for this key',
    'settings.aiNoModels': 'Not loaded',
    'settings.aiSave': 'Save',
    'settings.aiTest': 'Test',
    'settings.aiTesting': 'Testing...',
    'settings.aiRemove': 'Delete Key (Forget)',
    'settings.aiStatusOn': 'AI features enabled with {provider} / {model}',
    'settings.aiStatusOff': 'Not configured (AI features use simple local logic)',
    'settings.aiSaved': 'Saved to local DB',
    'settings.aiTestOk': 'Connected: {reply}',
    'settings.aiClaudeVoiceNote': '* Claude does not support audio input, so voice reports are unavailable',
    'settings.aiRemoveConfirm': 'Permanently delete (forget) the registered API key from local DB?',
    'settings.aiReplaceConfirm': 'A {provider} key is already registered. Overwrite it?',
    'settings.appInfoSection': 'App Information',
    'settings.appName': 'Application Name',
    'settings.bundleId': 'Bundle ID',
    'settings.bundleIdDesc': 'Mac App Store Identifier',
    'settings.dangerSection': 'Danger Zone (Data Reset)',
    'settings.deleteAccount': 'Delete Account & Clear All Data',
    'settings.deleteAccountDesc': 'Permanently delete all local tasks, pomodoros, and reports.',
    'settings.deleteBtn': 'Clear All Data',
    'settings.deleting': 'Deleting...',

    // Timer Page
    'timerPage.todayPomos': "Today's Pomos",
    'timerPage.focusTime': 'Focus Time',
    'timerPage.completedTasks': 'Completed Tasks',

    // Simple Task List (Timer View)
    'simpleTasks.title': 'Pending Tasks',
    'simpleTasks.countBadge': '{count}',
    'simpleTasks.placeholder': 'Enter a new task and press Enter...',
    'simpleTasks.estOption': 'Est. {n} pomo',
    'simpleTasks.add': 'Add',
    'simpleTasks.completeTooltip': 'Mark task completed',
    'simpleTasks.editTooltip': 'Click to edit task title',
    'simpleTasks.startFocus': 'Focus',
    'simpleTasks.startFocusTooltip': 'Start focus on this task',
    'simpleTasks.deleteTooltip': 'Delete',
    'simpleTasks.empty': 'No pending tasks. Add one using the input above!',

    // Task Page
    'taskPage.title': 'Task Management (Focus To-Do)',

    // Calendar
    'calendar.yearMonth': '{month} {year}',
    'calendar.prevMonth': 'Previous Month',
    'calendar.nextMonth': 'Next Month',
    'calendar.todayReport': "Today's Report",
    'calendar.published': 'Published',
    'calendar.notPublished': 'Not Published',
    'calendar.publishedTooltip': '{date} (Published Report)',
    'calendar.todayTooltip': "{date} (Today's Report)",
    'calendar.emptyTooltip': '{date} (No Report)',

    // Mini Timer
    'mini.noTask': 'No Task Selected',
    'mini.focusing': 'Focusing',
    'mini.breaking': 'Break',
    'mini.paused': 'Paused',
    'mini.idle': 'Idle',
    'mini.startTooltip': 'Start',
    'mini.pauseTooltip': 'Pause',
    'mini.stopTooltip': 'Stop and record elapsed time',
    'mini.restoreTooltip': 'Restore Full Window',

    // AI & Voice Modals
    'aiModal.title': 'AI Productivity Review',
    'aiModal.daily': 'Today (Daily)',
    'aiModal.weekly': 'This Week (Weekly)',
    'aiModal.monthly': 'This Month (Monthly)',
    'aiModal.analyzing': 'Analyzing past pomodoro records and reports...',
    'aiModal.empty': 'No summary information available.',
    'aiModal.error': 'Failed to retrieve AI summary.',
    'aiModal.close': 'Close',
    'aiModal.demoNotice': 'API key is not configured. Currently displaying a demo.',

    'voiceModal.title': 'Create Voice Report',
    'voiceModal.desc': 'Tap the microphone and talk freely about your work and reflections today. Gemini AI will transcribe and format into Markdown.',
    'voiceModal.generating': 'Gemini AI is generating report...',
    'voiceModal.recording': 'Recording... (Tap again to finish)',
    'voiceModal.tapStart': 'Tap to start recording',
    'voiceModal.errorVoice': 'Voice processing failed. Please check Gemini API settings.',
    'voiceModal.errorMic': 'Microphone access denied or unavailable.',
    'voiceModal.close': 'Close',

    // Group Page
    'group.title': 'Group & Member Timer',
    'group.create': 'Create Group',
    'group.join': 'Join with Code',
    'group.noGroups': 'No groups joined yet. Create a group or join with an invite code.',
    'group.members': '{count} members',
    'group.inviteCode': 'Invite code: {code}',
    'group.noDesc': 'No description',
    'group.memberActivity': '{name} Member Activity (Live)',
    'group.workingOn': 'Working on: {task}',
    'group.statusFocus': 'Focusing',
    'group.statusBreak': 'Break',
    'group.statusPaused': 'Paused',
    'group.statusIdle': 'Idle',
    'group.loading': 'Loading member status...',

    // Task Select Modal
    'modal.selectTask': 'Select Task to Focus On',
    'modal.noTasks': 'No pending tasks. Create a task first.',
    'modal.close': 'Close',

    // Tutorial Tour
    'tour.badge': 'Tutorial',
    'tour.next': 'Next',
    'tour.finish': 'Get Started',
    'tour.prev': 'Back',
    'tour.skip': 'Skip',
    'tour.nextTitle': 'Go to next step',
    'tour.finishTitle': 'Complete tutorial and get started',
    'tour.resumeAuto': 'Resume auto-play',
    'tour.pauseAuto': 'Pause auto-play',
    'tour.skipTitle': 'Skip and exit tour',
    'tour.stepCounter': '{current} / {total}',

    'tour.step1.badge': 'Timer Start',
    'tour.step1.title': '1. Start Pomodoro Timer',
    'tour.step1.desc': 'Work in golden cycles of 25 min focus and 5 min breaks. When time is up, a clear chime rings and transitions to break automatically.',
    'tour.step1.hint': 'Click the center Play button to start your focus session immediately.',

    'tour.step2.badge': 'Focus Terms',
    'tour.step2.title': '2. Quick Focus Terms',
    'tour.step2.desc': 'Easily switch between 10m, 15m, 25m with one tap depending on your condition. Custom durations are also supported.',
    'tour.step2.hint': 'Click 15m or 25m to switch focus duration instantly.',

    'tour.step3.badge': 'Task Sync',
    'tour.step3.title': '3. Add Tasks & Sync Focus',
    'tour.step3.desc': "Quickly add today's tasks. Click 'Focus' on any task to automatically log pomodoro sessions specifically for that task.",
    'tour.step3.hint': "Type a task title, press Enter, then click 'Focus' to link.",

    'tour.step4.badge': 'Timeline',
    'tour.step4.title': '4. 24-Hour Focus Timeline',
    'tour.step4.desc': 'Visualizes when and how long you focused in real-time. Even if paused midway, exact seconds worked are accurately recorded.',
    'tour.step4.hint': 'Check focused hours and cumulative pomodoro sessions at a glance.',

    'tour.step5.badge': 'Mini Player',
    'tour.step5.title': '5. Floating Mini Timer',
    'tour.step5.desc': 'Stays small in the corner of your screen! Keep track of remaining time without disturbing other apps. Click to return anytime.',
    'tour.step5.hint': 'Click the minimize icon in the top header to switch to mini timer.',

    'tour.step6.badge': 'Task Map',
    'tour.step6.title': '6. Task Management & Network Map',
    'tour.step6.desc': "Manage all tasks in one place. Switch to the 'Map' tab to view Obsidian-style knowledge graphs connecting tasks by topic.",
    'tour.step6.hint': "Click 'Map' at top right to switch to the network graph view.",

    'tour.step7.badge': 'Reports & AI',
    'tour.step7.title': '7. Auto Reports & AI Summaries',
    'tour.step7.desc': "Your daily achievements are drafted automatically into reports. Click 'AI Summary' to get personalized review feedback.",
    'tour.step7.hint': "Click 'AI Monthly/Weekly Summary' to view AI insights.",

    'tour.step8.badge': 'Obsidian Export',
    'tour.step8.title': '8. Direct Export to Obsidian',
    'tour.step8.desc': "One click writes your report directly to your local Obsidian Vault (daily_report) as a clean Markdown file.",
    'tour.step8.hint': "Click 'Save to Obsidian' to export today's record as Markdown instantly.",

    'tour.step9.badge': 'Local & BYOK',
    'tour.step9.title': '9. Standalone & Bring-Your-Own-Key',
    'tour.step9.desc': 'All data is saved locally on your Mac (SQLite) with zero external server tracking. Add your API key to unlock AI features.',
    'tour.step9.hint': 'Register your Gemini / Claude / OpenAI API key as needed.',

    'tour.step10.badge': 'Tour Complete',
    'tour.step10.title': '10. Tutorial Complete!',
    'tour.step10.desc': 'You explored all main features of KetchUp! Use the focus timer and daily reports to create your optimal workflow.',
    'tour.step10.hint': "Click 'Get Started' at the top right to complete the tour!",

    'tasks.onboardingTitle': '? Press button to start tutorial tour!',
  },
} as const;

export type TranslationKey = keyof typeof translations.ja;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'ja',
  setLanguage: () => {},
  t: (key) => key,
});

const LANGUAGE_STORAGE_KEY = 'ketchup_language';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language | null;
    if (saved === 'ja' || saved === 'en') {
      return saved;
    }
    // Default to browser language or ja
    const navLang = navigator.language.toLowerCase();
    if (navLang.startsWith('en')) {
      return 'en';
    }
    return 'ja';
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    document.documentElement.setAttribute('lang', lang);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('lang', language);
  }, [language]);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      const dict = translations[language] || translations.ja;
      let text: string = dict[key] || translations.ja[key] || key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        }
      }
      return text;
    },
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => useContext(LanguageContext);
