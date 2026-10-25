import { invoke } from '@tauri-apps/api/core';
import { generateText, isAIConfigured, extractJson } from './ai';

export interface Profile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserSettings {
  userId: string;
  focusSec: number;
  lastTermSec: number;
  shortBreakSec: number;
  longBreakSec: number;
  longBreakInterval: number;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
  obsidianVaultPath: string;
  updatedAt: string;
}

export interface MeResponse {
  profile: Profile;
  settings: UserSettings;
}

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETED';

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  estimatedPomos: number;
  pomoCount: number;
  actualFocusSec: number; // 実際に集中した正確な秒数
  category: string;       // 大グループ (例: 英語学習, 開発, KetchUp)
  topic: string;          // 小グループ (例: 単語暗記, デバッグ, チュートリアル)
  sortOrder: number;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PomoSession {
  userId: string;
  phase: 'IDLE' | 'FOCUS' | 'PAUSED' | 'SHORT_BREAK' | 'LONG_BREAK';
  taskId?: string;
  taskTitle?: string;
  phaseEndsAt?: string;
  remainingSec?: number;
  updatedAt: string;
}

export interface PomoRecord {
  id?: string;
  taskId?: string;
  taskTitle?: string;
  startedAt: string;
  endedAt: string;
  durationSec: number; // 実際に作業した正確な秒数
  pomoCount?: number;
}

export interface Report {
  id: string;
  publishedDate: string;
  body: string;
  autoFacts?: string;
  learnings?: string;
  challenges?: string;
  nextActions?: string;
  selfScore?: number;
  createdAt: string;
  updatedAt: string;
}

export interface StatsSummary {
  todayPomos: number;
  todayFocusMinutes: number;
  totalFocusSec: number;
  weekPomos: number;
  weekFocusMinutes: number;
  totalTasksCompleted: number;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  inviteCode: string;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface GroupMember {
  groupId: string;
  userId: string;
  role: string;
  displayName: string;
  avatarUrl: string;
  session?: PomoSession;
  joinedAt: string;
}

// -------------------------------------------------------------
// STANDALONE LOCAL-FIRST SQLITE CONFIGURATION
// -------------------------------------------------------------
// Complete standalone desktop application.
// Powered by macOS local SQLite with WAL mode & ACID transactions.
// Zero network calls, zero servers, 100% data durability.
// -------------------------------------------------------------
export const STANDALONE_LOCAL_MODE = true;

const STORAGE_KEYS = {
  TASKS: 'ketchup_local_tasks',
  REPORTS: 'ketchup_local_reports',
  POMOS: 'ketchup_local_pomos',
  SETTINGS: 'ketchup_local_settings',
  PROFILE: 'ketchup_local_profile',
  SESSION: 'ketchup_local_session',
  MIGRATED: 'ketchup_migrated_to_sqlite_v1',
};

class ApiClient {
  private token: string | null = null;
  private migrationChecked = false;

  setToken(token: string | null) {
    this.token = token;
  }

  // -----------------------------------------------------------
  // 自動マイグレーション: 既存の localStorage データを SQLite に引き継ぐ
  // -----------------------------------------------------------
  private async ensureMigrated(): Promise<void> {
    if (this.migrationChecked) return;
    this.migrationChecked = true;

    try {
      const already = localStorage.getItem(STORAGE_KEYS.MIGRATED);
      if (already === 'true') return;

      const rawTasks = localStorage.getItem(STORAGE_KEYS.TASKS);
      const rawPomos = localStorage.getItem(STORAGE_KEYS.POMOS);
      const rawReports = localStorage.getItem(STORAGE_KEYS.REPORTS);

      if (rawTasks || rawPomos || rawReports) {
        const tasks: Task[] = rawTasks ? JSON.parse(rawTasks) : [];
        const pomos: PomoRecord[] = rawPomos ? JSON.parse(rawPomos) : [];
        const reports: Report[] = rawReports ? JSON.parse(rawReports) : [];

        await invoke('db_import_legacy_data', {
          data: { tasks, pomos, reports },
        });
      }
      localStorage.setItem(STORAGE_KEYS.MIGRATED, 'true');
    } catch (err) {
      console.warn('SQLite migration check notice:', err);
    }
  }

  // -----------------------------------------------------------
  // Profile & Settings
  // -----------------------------------------------------------
  async getMe(): Promise<MeResponse> {
    await this.ensureMigrated();

    let settings: UserSettings = {
      userId: 'local-user',
      focusSec: 1500,
      lastTermSec: 1500,
      shortBreakSec: 300,
      longBreakSec: 900,
      longBreakInterval: 4,
      autoStartBreaks: true,
      autoStartFocus: false,
      obsidianVaultPath: '~/Documents/Obsidian Vault',
      updatedAt: new Date().toISOString(),
    };

    try {
      const val = await invoke<string | null>('db_get_setting', { key: 'user_settings' });
      if (val) {
        settings = { ...settings, ...JSON.parse(val) };
      }
    } catch {
      const rawSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (rawSettings) settings = { ...settings, ...JSON.parse(rawSettings) };
    }

    const rawProfile = localStorage.getItem(STORAGE_KEYS.PROFILE);
    const profile: Profile = rawProfile
      ? JSON.parse(rawProfile)
      : {
          id: 'local-user',
          email: 'local@desktop.app',
          displayName: 'KetchUp ユーザー',
          avatarUrl: '',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tokyo',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

    return { profile, settings };
  }

  async updateMe(data: Partial<Profile>): Promise<MeResponse> {
    const current = await this.getMe();
    const updatedProfile: Profile = {
      ...current.profile,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(updatedProfile));
    return { profile: updatedProfile, settings: current.settings };
  }

  async deleteMe(): Promise<void> {
    try {
      await invoke('db_clear_all_data');
    } catch {}
    localStorage.clear();
  }

  async updateSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
    const current = (await this.getMe()).settings;
    const updated: UserSettings = {
      ...current,
      ...settings,
      updatedAt: new Date().toISOString(),
    };

    try {
      await invoke('db_save_setting', {
        key: 'user_settings',
        value: JSON.stringify(updated),
      });
    } catch {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    }

    return updated;
  }

  // -----------------------------------------------------------
  // AI Batch Task Categorization (超軽量インデックス形式でトークン消費を最小化)
  // -----------------------------------------------------------
  async categorizeTasksWithAI(
    tasksToCategorize: Task[],
    language: 'ja' | 'en' = 'ja'
  ): Promise<{ updatedCount: number; errors?: string }> {
    const isJa = language === 'ja';
    if (!isAIConfigured()) {
      throw new Error(
        isJa
          ? 'AIのAPIキーが設定されていません。設定画面でAPIキーを登録してください。'
          : 'AI API key is not configured. Please register your API key in Settings.'
      );
    }
    if (tasksToCategorize.length === 0) {
      return { updatedCount: 0 };
    }

    // 長いUUIDを送らず、番号(0, 1, 2...)とタイトルだけの超軽量テキストに圧縮
    const taskListText = tasksToCategorize
      .map((t, idx) => `${idx}: ${t.title}`)
      .join('\n');

    const defaultUncategorized = isJa ? '未分類' : 'Uncategorized';

    const prompt = isJa
      ? `タスク一覧を分析し、共通性のある大カテゴリ（例: 開発・実装, 英語学習, 読書・インプット, 資格試験対策, 企画・資料作成, 日常雑務）に分類してください。\n\n` +
        `タスク一覧:\n${taskListText}\n\n` +
        `【出力形式】\n` +
        `10文字以内の簡潔な日本語で、次のJSONオブジェクトのみを出力（キーは番号、値はカテゴリ名）:\n` +
        `{\n  "0": "カテゴリ名",\n  "1": "カテゴリ名"\n}`
      : `Analyze the following tasks and categorize each into an appropriate high-level group (e.g. Development, English Study, Reading & Research, Exam Prep, Planning, Daily Chores).\n\n` +
        `Tasks:\n${taskListText}\n\n` +
        `[Output Format]\n` +
        `Concise (1-3 English words, max 20 chars). Output ONLY the following JSON object (key is index number, value is category name):\n` +
        `{\n  "0": "Category Name",\n  "1": "Category Name"\n}`;

    const text = await generateText(prompt, { maxTokens: 800 });
    const rawParsed = extractJson<any>(text);

    if (!rawParsed || typeof rawParsed !== 'object') {
      throw new Error(
        isJa
          ? 'AIからの分類結果を解析できませんでした。'
          : 'Failed to parse categorization results from AI.'
      );
    }

    // インデックスとカテゴリの対応表を抽出（オブジェクト/配列のブレに柔軟に対応）
    const indexCategoryMap = new Map<number, string>();
    if (Array.isArray(rawParsed)) {
      rawParsed.forEach((item, idx) => {
        if (typeof item === 'string') {
          indexCategoryMap.set(idx, item);
        } else if (item && typeof item === 'object') {
          const cat = item.category || item.cat;
          const rawId = item.id !== undefined ? String(item.id) : String(idx);
          const parsedIdx = Number(rawId);
          if (!isNaN(parsedIdx) && cat) {
            indexCategoryMap.set(parsedIdx, cat);
          } else if (cat) {
            indexCategoryMap.set(idx, cat);
          }
        }
      });
    } else {
      for (const [key, val] of Object.entries(rawParsed)) {
        const idx = Number(key);
        if (!isNaN(idx) && typeof val === 'string') {
          indexCategoryMap.set(idx, val);
        }
      }
    }

    let updatedCount = 0;
    for (const [idx, categoryName] of indexCategoryMap.entries()) {
      const task = tasksToCategorize[idx];
      if (task) {
        try {
          await this.updateTask(task.id, {
            category: categoryName.trim() || defaultUncategorized,
          });
          updatedCount++;
        } catch (err) {
          console.warn(`Failed to update task ${task.id}:`, err);
        }
      }
    }

    return { updatedCount };
  }

  // -----------------------------------------------------------
  // Tasks (SQLite CRUD)
  // -----------------------------------------------------------
  async listTasks(status?: TaskStatus, project?: string): Promise<Task[]> {
    await this.ensureMigrated();
    try {
      return await invoke<Task[]>('db_list_tasks', {
        status: status || null,
      });
    } catch (err) {
      console.warn('SQLite listTasks fallback:', err);
      const raw = localStorage.getItem(STORAGE_KEYS.TASKS);
      let tasks: Task[] = raw ? JSON.parse(raw) : [];
      if (status) tasks = tasks.filter((t) => t.status === status);
      return tasks;
    }
  }

  async createTask(task: {
    title: string;
    estimatedPomos?: number;
    category?: string;
    topic?: string;
  }): Promise<Task> {
    await this.ensureMigrated();

    // ラベル未指定時は強制推論せず「未分類」に統一
    const cat = task.category?.trim() || '未分類';
    const top = task.topic?.trim() || 'その他';

    const newTask: Task = {
      id: crypto.randomUUID(),
      title: task.title,
      status: 'TODO',
      estimatedPomos: task.estimatedPomos || 1,
      pomoCount: 0,
      actualFocusSec: 0,
      category: cat,
      topic: top,
      sortOrder: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      return await invoke<Task>('db_save_task', { task: newTask });
    } catch (err) {
      console.warn('SQLite createTask fallback:', err);
      const raw = localStorage.getItem(STORAGE_KEYS.TASKS);
      const tasks: Task[] = raw ? JSON.parse(raw) : [];
      tasks.push(newTask);
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
      return newTask;
    }
  }

  async updateTask(taskId: string, updates: Partial<Task>): Promise<Task> {
    await this.ensureMigrated();

    const tasks = await this.listTasks();
    const existing = tasks.find((t) => t.id === taskId);
    if (!existing) {
      throw new Error(`タスクが見つかりません: ${taskId}`);
    }

    const updated: Task = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    try {
      return await invoke<Task>('db_save_task', { task: updated });
    } catch (err) {
      console.warn('SQLite updateTask fallback:', err);
      const raw = localStorage.getItem(STORAGE_KEYS.TASKS);
      let list: Task[] = raw ? JSON.parse(raw) : [];
      list = list.map((t) => (t.id === taskId ? updated : t));
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(list));
      return updated;
    }
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.ensureMigrated();
    try {
      await invoke('db_delete_task', { taskId });
    } catch (err) {
      console.warn('SQLite deleteTask fallback:', err);
      const raw = localStorage.getItem(STORAGE_KEYS.TASKS);
      let tasks: Task[] = raw ? JSON.parse(raw) : [];
      tasks = tasks.filter((t) => t.id !== taskId);
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    }
  }

  // -----------------------------------------------------------
  // Pomodoros (SQLite ACID & Atomic Accumulation)
  // -----------------------------------------------------------
  async recordPomo(data: {
    clientId?: string;
    taskId?: string;
    startedAt: string;
    endedAt: string;
    durationSec: number;
  }): Promise<void> {
    await this.ensureMigrated();

    const mins = Math.floor(data.durationSec / 60);
    const pomoCount = mins === 0 ? 0 : Math.ceil(mins / 25);
    const recordPayload: PomoRecord = {
      id: crypto.randomUUID(),
      taskId: data.taskId,
      startedAt: data.startedAt,
      endedAt: data.endedAt,
      durationSec: data.durationSec,
      pomoCount,
    };

    try {
      await invoke('db_record_pomo', { record: recordPayload });
    } catch (err) {
      console.warn('SQLite recordPomo fallback:', err);
      const raw = localStorage.getItem(STORAGE_KEYS.POMOS);
      const pomos: PomoRecord[] = raw ? JSON.parse(raw) : [];
      pomos.push(recordPayload);
      localStorage.setItem(STORAGE_KEYS.POMOS, JSON.stringify(pomos));

      if (data.taskId) {
        const rawTasks = localStorage.getItem(STORAGE_KEYS.TASKS);
        if (rawTasks) {
          const tasks: Task[] = JSON.parse(rawTasks);
          const t = tasks.find((x) => x.id === data.taskId);
          if (t) {
            t.actualFocusSec = (t.actualFocusSec || 0) + data.durationSec;
            const taskMins = Math.floor(t.actualFocusSec / 60);
            t.pomoCount = taskMins === 0 ? 0 : Math.ceil(taskMins / 25);
            localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
          }
        }
      }
    }
  }

  async listPomos(date?: string, since?: string): Promise<PomoRecord[]> {
    await this.ensureMigrated();
    try {
      return await invoke<PomoRecord[]>('db_list_pomos', {
        date: date || null,
        since: since || null,
      });
    } catch (err) {
      console.warn('SQLite listPomos fallback:', err);
      const raw = localStorage.getItem(STORAGE_KEYS.POMOS);
      const pomos: PomoRecord[] = raw ? JSON.parse(raw) : [];
      if (since) return pomos.filter((p) => (p.startedAt || '') >= since);
      if (!date) {
        const todayStr = new Date().toISOString().slice(0, 10);
        return pomos.filter((p) => p.startedAt?.startsWith(todayStr));
      }
      return pomos.filter((p) => p.startedAt?.startsWith(date));
    }
  }

  // -----------------------------------------------------------
  // Session State
  // -----------------------------------------------------------
  async getSession(): Promise<PomoSession> {
    try {
      const val = await invoke<string | null>('db_get_setting', { key: 'session' });
      if (val) return JSON.parse(val);
    } catch {}

    const raw = localStorage.getItem(STORAGE_KEYS.SESSION);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {}
    }

    return {
      userId: 'local-user',
      phase: 'IDLE',
      updatedAt: new Date().toISOString(),
    };
  }

  async updateSession(session: Partial<PomoSession>): Promise<PomoSession> {
    const current = await this.getSession();
    const updated: PomoSession = {
      ...current,
      ...session,
      updatedAt: new Date().toISOString(),
    };

    try {
      await invoke('db_save_setting', {
        key: 'session',
        value: JSON.stringify(updated),
      });
    } catch {
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(updated));
    }

    return updated;
  }

  // -----------------------------------------------------------
  // Daily Reports (SQLite CRUD)
  // -----------------------------------------------------------
  async listReports(limit = 90): Promise<Report[]> {
    await this.ensureMigrated();
    try {
      return await invoke<Report[]>('db_list_reports', { limit });
    } catch (err) {
      console.warn('SQLite listReports fallback:', err);
      const raw = localStorage.getItem(STORAGE_KEYS.REPORTS);
      const reports: Report[] = raw ? JSON.parse(raw) : [];
      reports.sort((a, b) => b.publishedDate.localeCompare(a.publishedDate));
      return reports.slice(0, limit);
    }
  }

  async getReport(date: string): Promise<Report> {
    await this.ensureMigrated();
    try {
      const rep = await invoke<Report | null>('db_get_report', { date });
      if (rep) return rep;
      throw new Error('Not found');
    } catch (err: any) {
      if (err.message === 'Not found' || String(err).includes('Not found')) {
        throw new Error('Not found');
      }
      const raw = localStorage.getItem(STORAGE_KEYS.REPORTS);
      const reports: Report[] = raw ? JSON.parse(raw) : [];
      const found = reports.find((r) => r.publishedDate === date);
      if (!found) throw new Error('Not found');
      return found;
    }
  }

  async saveReport(report: {
    publishedDate: string;
    body: string;
    autoFacts?: string;
    learnings?: string;
    challenges?: string;
    nextActions?: string;
    selfScore?: number;
  }): Promise<Report> {
    await this.ensureMigrated();

    const newReport: Report = {
      id: crypto.randomUUID(),
      publishedDate: report.publishedDate,
      body: report.body,
      autoFacts: report.autoFacts,
      learnings: report.learnings,
      challenges: report.challenges,
      nextActions: report.nextActions,
      selfScore: report.selfScore,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      return await invoke<Report>('db_save_report', { report: newReport });
    } catch (err) {
      console.warn('SQLite saveReport fallback:', err);
      const raw = localStorage.getItem(STORAGE_KEYS.REPORTS);
      let reports: Report[] = raw ? JSON.parse(raw) : [];
      reports = reports.filter((r) => r.publishedDate !== report.publishedDate);
      reports.unshift(newReport);
      localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(reports));
      return newReport;
    }
  }

  // Auto-generate Facts and Report draft from actual recorded activity
  async getAutoDraftReport(date: string): Promise<{ autoFacts: string; draftBody: string }> {
    const pomos = await this.listPomos(date);
    const tasks = await this.listTasks();

    let totalSec = 0;
    for (const p of pomos) {
      totalSec += p.durationSec;
    }
    const totalMin = Math.floor(totalSec / 60);
    const pomoEquivalent = (totalSec / 1500).toFixed(1);

    let facts = `## **本日の集中実績** (Facts)\n`;
    facts += `- **総集中時間**: ${totalMin}分 (${pomoEquivalent} pomo)\n`;
    facts += `- **消化セッション**: ${pomos.length} 回\n\n`;
    facts += `### 完了・進行したタスク\n`;

    const activeTasks = tasks.filter(
      (t) => t.status === 'COMPLETED' || t.pomoCount > 0 || (t.actualFocusSec || 0) > 0
    );
    if (activeTasks.length > 0) {
      for (const t of activeTasks) {
        const m = Math.floor((t.actualFocusSec || 0) / 60);
        const tPomo = m === 0 ? 0 : Math.ceil(m / 25);
        facts += `- [${t.status}] **${t.title}** (${t.category || '未分類'} > ${t.topic || '一般'}) - ${m}分集中 (${tPomo} pomo)\n`;
      }
    } else {
      facts += `- (記録されたタスク活動はありません)\n`;
    }

    const draft = `${facts}
## **今日学んだこと・気づき**
- 

## **課題・反省点**
- 

## **明日のアクション**
- 
`;
    return { autoFacts: facts, draftBody: draft };
  }

  // -----------------------------------------------------------
  // AI Summary
  // -----------------------------------------------------------
  async getAISummary(
    scope: 'daily' | 'weekly' | 'monthly',
    periodStart: string,
    periodEnd: string,
    lang?: 'ja' | 'en'
  ): Promise<{ content: string }> {
    const currentLang =
      lang ||
      (typeof window !== 'undefined' && localStorage.getItem('ketchup_language') === 'en'
        ? 'en'
        : 'ja');

    if (isAIConfigured()) {
      const context = await this.buildPeriodContext(periodStart, periodEnd, currentLang);

      if (currentLang === 'en') {
        const label = scope === 'daily' ? 'Today' : scope === 'weekly' ? 'This Week' : 'This Month';
        const content = await generateText(
          `Focus logs and daily reports for ${label} (${periodStart} ~ ${periodEnd}):\n\n${context}\n\n` +
            `Based on this data, write a concise review summary in clean Markdown. ` +
            `Start directly with "### ${label}'s Focus Summary". ` +
            `Include a quick recap of achievements, pattern analysis, and 1-2 actionable tips. ` +
            `Do not hallucinate details not present in the data. Keep it concise and motivating.`,
          { system: 'You are an encouraging Pomodoro productivity coach. Provide clear, concise, and constructive responses in English.' }
        );
        return { content };
      } else {
        const label = scope === 'daily' ? '本日' : scope === 'weekly' ? '今週' : '今月';
        const content = await generateText(
          `${label}（${periodStart} 〜 ${periodEnd}）の集中記録と日報です。\n\n${context}\n\n` +
            `このデータをもとに、簡潔で分かりやすい振り返りサマリーをMarkdownで作成してください。` +
            `「### ${label}の振り返りサマリー」で始め、実績の要約・傾向の分析・具体的なアドバイスを含めてください。` +
            `データにないことは捏造しないでください。簡潔に要点をまとめてください。`,
          { system: 'あなたはポモドーロ学習のコーチです。日本語で、前向きかつ簡潔に回答します。' }
        );
        return { content };
      }
    }

    const stats = await this.getStats();

    if (currentLang === 'en') {
      const label = scope === 'daily' ? 'Today' : scope === 'weekly' ? 'This Week' : 'This Month';
      return {
        content: `> **※ API key not configured (Demo preview)**  
> Add your API key in Settings to automatically generate AI summaries from your focus records.

### ${label}'s Focus Summary (Demo)

- **Actual Focus Time**: ${stats.todayFocusMinutes} mins (${stats.totalFocusSec} secs)
- **Pomodoro Conversion**: ${(stats.totalFocusSec / 1500).toFixed(1)} pomos (25m cumulative = 1 pomo)
- **Completed Tasks**: ${stats.totalTasksCompleted} tasks

#### Summary & Advice (Sample)
Great rhythm utilizing flexible focus intervals! Every second of actual work is precisely tracked, building a steady and sustainable routine.`,
      };
    }

    const labelJa = scope === 'daily' ? '本日' : scope === 'weekly' ? '今週' : '今月';
    return {
      content: `> **※ APIキーがセットされていません（デモ表示）**  
> 設定画面で API キーを登録すると、あなたの集中記録をもとにした AI サマリーが自動生成されます。

### ${labelJa} の振り返りサマリー (デモ)

- **実集中時間**: ${stats.todayFocusMinutes} 分 (${stats.totalFocusSec} 秒)
- **ポモドーロ換算**: ${(stats.totalFocusSec / 1500).toFixed(1)} pomo (累積25分=1pomo)
- **完了タスク**: ${stats.totalTasksCompleted} 件

#### 総括 & アドバイス (サンプル)
短時間タームや柔軟な集中設定を効果的に活用できています。作業途中で切り上げても正確な作業秒数が積み上がっており、無理のない持続可能な集中リズムが作れています！`,
    };
  }

  private async buildPeriodContext(periodStart: string, periodEnd: string, lang: 'ja' | 'en' = 'ja'): Promise<string> {
    const pomos = await this.listPomos(undefined, `${periodStart}T00:00:00Z`);
    const tasks = await this.listTasks();
    const reports = await this.listReports(60);
    const inRange = (d?: string) => !!d && d.slice(0, 10) >= periodStart && d.slice(0, 10) <= periodEnd;

    const periodPomos = pomos.filter((p) => inRange(p.startedAt));
    const totalSec = periodPomos.reduce((s, p) => s + (p.durationSec || 0), 0);
    const byTask = new Map<string, number>();
    const noTaskLabel = lang === 'en' ? '(No task)' : '(タスクなし)';
    for (const p of periodPomos) {
      const title = tasks.find((t) => t.id === p.taskId)?.title || p.taskTitle || noTaskLabel;
      byTask.set(title, (byTask.get(title) || 0) + (p.durationSec || 0));
    }
    const completed = tasks.filter((t) => t.status === 'COMPLETED' && inRange(t.completedAt || t.updatedAt));
    const periodReports = reports.filter((r) => inRange(r.publishedDate));

    if (lang === 'en') {
      let ctx = `## Focus Records\n- Total Focus Time: ${Math.floor(totalSec / 60)} mins / Sessions: ${periodPomos.length}\n`;
      for (const [title, sec] of byTask) ctx += `- ${title}: ${Math.floor(sec / 60)} mins\n`;
      ctx += `\n## Completed Tasks (${completed.length})\n`;
      for (const t of completed) ctx += `- ${t.title} (${t.category || 'Uncategorized'} > ${t.topic || 'General'})\n`;
      if (periodReports.length > 0) {
        ctx += `\n## Daily Reports\n`;
        for (const r of periodReports.slice(0, 31)) ctx += `### ${r.publishedDate}\n${r.body.slice(0, 1500)}\n\n`;
      }
      return ctx;
    }

    let ctx = `## 集中実績\n- 合計集中時間: ${Math.floor(totalSec / 60)}分 / セッション数: ${periodPomos.length}\n`;
    for (const [title, sec] of byTask) ctx += `- ${title}: ${Math.floor(sec / 60)}分\n`;
    ctx += `\n## 完了タスク (${completed.length}件)\n`;
    for (const t of completed) ctx += `- ${t.title} (${t.category || '未分類'} > ${t.topic || '一般'})\n`;
    if (periodReports.length > 0) {
      ctx += `\n## 日報\n`;
      for (const r of periodReports.slice(0, 31)) ctx += `### ${r.publishedDate}\n${r.body.slice(0, 1500)}\n\n`;
    }
    return ctx;
  }

  // -----------------------------------------------------------
  // Accurate Statistics (SQLite 高速集計)
  // -----------------------------------------------------------
  async getStats(): Promise<StatsSummary> {
    await this.ensureMigrated();
    try {
      return await invoke<StatsSummary>('db_get_stats');
    } catch (err) {
      console.warn('SQLite getStats fallback:', err);
      const rawPomos = localStorage.getItem(STORAGE_KEYS.POMOS);
      const pomos: PomoRecord[] = rawPomos ? JSON.parse(rawPomos) : [];
      const rawTasks = localStorage.getItem(STORAGE_KEYS.TASKS);
      const tasks: Task[] = rawTasks ? JSON.parse(rawTasks) : [];
      const completed = tasks.filter((t) => t.status === 'COMPLETED').length;

      const todayStr = new Date().toISOString().slice(0, 10);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      const sevenDaysAgoIso = sevenDaysAgo.toISOString();

      let todaySec = 0;
      let weekSec = 0;
      let totalSec = 0;

      for (const p of pomos) {
        const dur = p.durationSec || 0;
        totalSec += dur;
        if (p.startedAt?.startsWith(todayStr)) todaySec += dur;
        if ((p.startedAt || '') >= sevenDaysAgoIso) weekSec += dur;
      }

      const todayMin = Math.floor(todaySec / 60);
      const todayPomos = todayMin === 0 ? 0 : Math.ceil(todayMin / 25);
      const weekMin = Math.floor(weekSec / 60);
      const weekPomos = weekMin === 0 ? 0 : Math.ceil(weekMin / 25);

      return {
        todayPomos,
        todayFocusMinutes: todayMin,
        totalFocusSec: totalSec,
        weekPomos,
        weekFocusMinutes: weekMin,
        totalTasksCompleted: completed,
      };
    }
  }

  // -----------------------------------------------------------
  // Groups (ローカルスタンドバイ)
  // -----------------------------------------------------------
  async listGroups(): Promise<Group[]> {
    return [
      {
        id: 'group-local',
        name: 'ローカル集中ルーム',
        description: '完全ローカル環境',
        ownerId: 'local-user',
        inviteCode: 'LOCAL',
        memberCount: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
  }

  async createGroup(name: string, description: string): Promise<Group> {
    return (await this.listGroups())[0];
  }

  async joinGroup(_inviteCode: string): Promise<Group> {
    return (await this.listGroups())[0];
  }

  async getGroup(_groupId: string): Promise<Group> {
    return (await this.listGroups())[0];
  }

  async listGroupMembers(_groupId: string): Promise<GroupMember[]> {
    return [
      {
        groupId: 'group-local',
        userId: 'local-user',
        role: 'owner',
        displayName: 'あなた (ローカル)',
        avatarUrl: '',
        joinedAt: new Date().toISOString(),
      },
    ];
  }

  async leaveGroup(_groupId: string): Promise<void> {}
}

export const api = new ApiClient();
