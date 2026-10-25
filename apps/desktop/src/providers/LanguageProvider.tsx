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
    'tasks.placeholderTitle': 'タスク名を入力 (例: ターゲット1900 単語暗記)',
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
    'settings.accountSection': 'アカウント & 認証',
    'settings.googleSso': 'Google アカウント連携 (SSO)',
    'settings.loggedAs': 'ログイン中: {email}',
    'settings.notLogged': 'ログインしていません (ローカルモード)',
    'settings.logout': 'ログアウト',
    'settings.loginGoogle': 'Google でログイン',
    'settings.timerSection': 'タイマー設定 & 集中ターム',
    'settings.focusDuration': '1セッションの集中時間 (分)',
    'settings.focusDurationDesc': 'タイマーの1ターム分数 (前回設定した値が自動で保持されます)',
    'settings.shortBreak': '短い休憩 (分)',
    'settings.shortBreakDesc': '集中ターム後の標準休憩 (デフォルト: 5分)',
    'settings.longBreak': '長い休憩 (分)',
    'settings.longBreakDesc': '4ターム消化後の大休憩 (デフォルト: 15分)',
    'settings.pomoCalc': 'ポモドーロ換算基準',
    'settings.pomoCalcDesc': '1pomo = 累計25分作業（1分×25回でも、25分×1回でも25分作業で1pomoとして正確に集計）',
    'settings.obsidianSection': 'Obsidian 連携設定',
    'settings.obsidianVaultFolder': 'Obsidian Vault 保存先フォルダ',
    'settings.obsidianVaultDesc': '日報はこの Vault の中の「daily_report」フォルダに自動保存されます',
    'settings.obsidianDestination': '保存先: {path}/daily_report/YYYY-MM-DD.md',
    'settings.selectFolder': 'フォルダ選択',
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
    'settings.accountSection': 'Account & Auth',
    'settings.googleSso': 'Google SSO Integration',
    'settings.loggedAs': 'Logged in as: {email}',
    'settings.notLogged': 'Not logged in (Local Mode)',
    'settings.logout': 'Sign Out',
    'settings.loginGoogle': 'Sign In with Google',
    'settings.timerSection': 'Timer Settings & Focus Terms',
    'settings.focusDuration': 'Focus Duration per Term (min)',
    'settings.focusDurationDesc': 'Length of one focus term (previous value automatically remembered)',
    'settings.shortBreak': 'Short Break (min)',
    'settings.shortBreakDesc': 'Standard break after focus (default: 5 min)',
    'settings.longBreak': 'Long Break (min)',
    'settings.longBreakDesc': 'Long rest after 4 focus terms (default: 15 min)',
    'settings.pomoCalc': 'Pomodoro Calculation Rule',
    'settings.pomoCalcDesc': '1 pomo = 25 minutes of accumulated work (exact minutes accurately aggregated)',
    'settings.obsidianSection': 'Obsidian Integration',
    'settings.obsidianVaultFolder': 'Obsidian Vault Directory',
    'settings.obsidianVaultDesc': 'Daily reports will be saved into the "daily_report" folder in this Vault',
    'settings.obsidianDestination': 'Target: {path}/daily_report/YYYY-MM-DD.md',
    'settings.selectFolder': 'Choose Folder',
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
