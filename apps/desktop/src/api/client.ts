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
  lastTermSec: number; // 前回設定した集中ターム秒数 (次回デフォルト)
  shortBreakSec: number;
  longBreakSec: number;
  longBreakInterval: number;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
  obsidianVaultPath: string; // Obsidian Vault の Daily Notes フォルダパス
  updatedAt: string;
}

export interface MeResponse {
  profile: Profile;
  settings: UserSettings;
}

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETED';

export interface Task {
  id: string;
  userId: string;
  title: string;
  note: string;
  status: TaskStatus;
  estimatedPomos: number;
  pomoCount: number;
  actualFocusSec: number; // 実際に集中した正確な秒数
  category: string;       // 大グループ (例: 英語学習, 数学, 開発)
  topic: string;          // 小グループ (例: 単語暗記, 過去問演習, デバッグ)
  dueDate?: string;
  project?: string;
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
  clientId: string;
  taskId?: string;
  taskTitle?: string;
  startedAt: string;
  endedAt: string;
  durationSec: number; // 実際に作業した正確な秒数
  pomoCount?: number;
}

export interface Report {
  id: string;
  userId: string;
  publishedDate: string;
  body: string;
  autoFacts?: string;
  learnings?: string;
  challenges?: string;
  nextActions?: string;
  selfScore?: number;
  source: 'manual' | 'voice' | 'ai';
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
// STANDALONE LOCAL-FIRST CONFIGURATION
// -------------------------------------------------------------
// When true: Complete standalone desktop application.
// No Go server, no Docker, no external network calls required.
// Everything executes instantly with 0ms latency in local storage.
export const STANDALONE_LOCAL_MODE = true;

const API_BASE_URL = 'http://localhost:8080';

const STORAGE_KEYS = {
  TASKS: 'ketchup_local_tasks',
  REPORTS: 'ketchup_local_reports',
  POMOS: 'ketchup_local_pomos',
  SETTINGS: 'ketchup_local_settings',
  PROFILE: 'ketchup_local_profile',
  SESSION: 'ketchup_local_session',
  GROUPS: 'ketchup_local_groups',
};

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (STANDALONE_LOCAL_MODE) {
      throw new Error('Standalone mode enabled: direct local storage execution');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    } else {
      headers['Authorization'] = 'Bearer dev-token';
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.status === 204) {
        return {} as T;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  // -----------------------------------------------------------
  // Profile & Settings
  // -----------------------------------------------------------
  async getMe(): Promise<MeResponse> {
    if (!STANDALONE_LOCAL_MODE) {
      try {
        return await this.request<MeResponse>('/v1/me');
      } catch {
        // fallback
      }
    }

    const rawSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    const settings: UserSettings = rawSettings
      ? JSON.parse(rawSettings)
      : {
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

    if (!STANDALONE_LOCAL_MODE) {
      try {
        await this.request<MeResponse>('/v1/me', {
          method: 'PATCH',
          body: JSON.stringify(data),
        });
      } catch {}
    }

    return { profile: updatedProfile, settings: current.settings };
  }

  async deleteMe(): Promise<void> {
    if (!STANDALONE_LOCAL_MODE) {
      try {
        await this.request<void>('/v1/me', { method: 'DELETE' });
      } catch {}
    }
    localStorage.clear();
  }

  async updateSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
    const current = (await this.getMe()).settings;
    const updated: UserSettings = {
      ...current,
      ...settings,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));

    if (!STANDALONE_LOCAL_MODE) {
      try {
        await this.request<UserSettings>('/v1/me/settings', {
          method: 'PUT',
          body: JSON.stringify(settings),
        });
      } catch {}
    }

    return updated;
  }

  // -----------------------------------------------------------
  // AI Task Classification (Rule-based heuristic + Gemini)
  // -----------------------------------------------------------
  async classifyTask(title: string): Promise<{ category: string; topic: string }> {
    if (!STANDALONE_LOCAL_MODE) {
      try {
        return await this.request<{ category: string; topic: string }>('/v1/ai/classify-task', {
          method: 'POST',
          body: JSON.stringify({ title }),
        });
      } catch {}
    }

    // Local instant intelligent classification
    const lower = title.toLowerCase();
    let category = '一般タスク';
    let topic = 'その他';

    if (
      lower.includes('英語') ||
      lower.includes('単語') ||
      lower.includes('toeic') ||
      lower.includes('toefl') ||
      lower.includes('duo') ||
      lower.includes('ターゲット') ||
      lower.includes('リスニング') ||
      lower.includes('文法') ||
      lower.includes('english')
    ) {
      category = '英語学習';
      topic = lower.includes('単語')
        ? '単語暗記'
        : lower.includes('過去問') || lower.includes('模試')
        ? '過去問演習'
        : lower.includes('リスニング')
        ? 'リスニング'
        : '文法・長文';
    } else if (
      lower.includes('数学') ||
      lower.includes('数式') ||
      lower.includes('計算') ||
      lower.includes('チャート') ||
      lower.includes('微積') ||
      lower.includes('線形') ||
      lower.includes('統計')
    ) {
      category = '数学・理数';
      topic = lower.includes('チャート') || lower.includes('問題') ? '問題演習' : '概念理解・公式整理';
    } else if (
      lower.includes('開発') ||
      lower.includes('実装') ||
      lower.includes('バグ') ||
      lower.includes('修正') ||
      lower.includes('コード') ||
      lower.includes('api') ||
      lower.includes('react') ||
      lower.includes('rust') ||
      lower.includes('tauri') ||
      lower.includes('css') ||
      lower.includes('test') ||
      lower.includes('テスト') ||
      lower.includes('設計')
    ) {
      category = '開発・実装';
      topic = lower.includes('バグ') || lower.includes('修正')
        ? 'デバッグ'
        : lower.includes('設計')
        ? '要件・設計'
        : lower.includes('テスト')
        ? 'テスト'
        : '機能実装';
    } else if (
      lower.includes('読書') ||
      lower.includes('本') ||
      lower.includes('書籍') ||
      lower.includes('論文') ||
      lower.includes('記事') ||
      lower.includes('インプット')
    ) {
      category = '読書・インプット';
      topic = lower.includes('論文') ? '論文精読' : '読書・要約';
    } else if (
      lower.includes('資格') ||
      lower.includes('試験') ||
      lower.includes('検定') ||
      lower.includes('過去問')
    ) {
      category = '資格・試験対策';
      topic = '過去問・演習';
    } else if (
      lower.includes('企画') ||
      lower.includes('提案') ||
      lower.includes('資料') ||
      lower.includes('スライド') ||
      lower.includes('ミーティング') ||
      lower.includes('mtg') ||
      lower.includes('打ち合わせ')
    ) {
      category = '企画・資料作成';
      topic = lower.includes('スライド') || lower.includes('資料') ? 'スライド作成' : 'リサーチ・企画';
    }

    return { category, topic };
  }

  // -----------------------------------------------------------
  // Tasks (CRUD)
  // -----------------------------------------------------------
  async listTasks(status?: TaskStatus, project?: string): Promise<Task[]> {
    const raw = localStorage.getItem(STORAGE_KEYS.TASKS);
    let tasks: Task[] = raw ? JSON.parse(raw) : [];

    // Initialize initial default sample tasks on first launch
    if (tasks.length === 0) {
      tasks = [
        {
          id: 'task-english',
          userId: 'local-user',
          title: 'ターゲット1900 1〜100単語復習',
          note: '発音と例文を確認しながら反復',
          status: 'TODO',
          estimatedPomos: 2,
          pomoCount: 0,
          actualFocusSec: 0,
          category: '英語学習',
          topic: '単語暗記',
          sortOrder: Date.now() - 1000,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'task-math',
          userId: 'local-user',
          title: '青チャート数IA 例題25〜30 解法の整理',
          note: '2次関数の最大最小',
          status: 'TODO',
          estimatedPomos: 3,
          pomoCount: 0,
          actualFocusSec: 0,
          category: '数学・理数',
          topic: '問題演習',
          sortOrder: Date.now(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    }

    if (status) {
      tasks = tasks.filter((t) => t.status === status);
    }
    if (project) {
      tasks = tasks.filter((t) => t.project === project);
    }

    return tasks;
  }

  async createTask(task: {
    title: string;
    note?: string;
    estimatedPomos?: number;
    category?: string;
    topic?: string;
    dueDate?: string;
    project?: string;
  }): Promise<Task> {
    let cat = task.category;
    let top = task.topic;
    if (!cat || !top) {
      const classified = await this.classifyTask(task.title);
      cat = cat || classified.category;
      top = top || classified.topic;
    }

    const raw = localStorage.getItem(STORAGE_KEYS.TASKS);
    const tasks: Task[] = raw ? JSON.parse(raw) : [];
    const newTask: Task = {
      id: crypto.randomUUID(),
      userId: 'local-user',
      title: task.title,
      note: task.note || '',
      status: 'TODO',
      estimatedPomos: task.estimatedPomos || 1,
      pomoCount: 0,
      actualFocusSec: 0,
      category: cat,
      topic: top,
      dueDate: task.dueDate,
      project: task.project,
      sortOrder: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    tasks.push(newTask);
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));

    if (!STANDALONE_LOCAL_MODE) {
      try {
        await this.request<Task>('/v1/tasks', {
          method: 'POST',
          body: JSON.stringify({ ...task, category: cat, topic: top }),
        });
      } catch {}
    }

    return newTask;
  }

  async updateTask(taskId: string, updates: Partial<Task>): Promise<Task> {
    const raw = localStorage.getItem(STORAGE_KEYS.TASKS);
    let tasks: Task[] = raw ? JSON.parse(raw) : [];
    let updatedTask: Task | null = null;
    tasks = tasks.map((t) => {
      if (t.id === taskId) {
        updatedTask = { ...t, ...updates, updatedAt: new Date().toISOString() };
        return updatedTask;
      }
      return t;
    });
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));

    if (!STANDALONE_LOCAL_MODE) {
      try {
        await this.request<Task>(`/v1/tasks/${taskId}`, {
          method: 'PATCH',
          body: JSON.stringify(updates),
        });
      } catch {}
    }

    return updatedTask!;
  }

  async deleteTask(taskId: string): Promise<void> {
    const raw = localStorage.getItem(STORAGE_KEYS.TASKS);
    let tasks: Task[] = raw ? JSON.parse(raw) : [];
    tasks = tasks.filter((t) => t.id !== taskId);
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));

    if (!STANDALONE_LOCAL_MODE) {
      try {
        await this.request<void>(`/v1/tasks/${taskId}`, { method: 'DELETE' });
      } catch {}
    }
  }

  // -----------------------------------------------------------
  // Pomodoros (Record exact elapsed seconds & calculate pomo count)
  // -----------------------------------------------------------
  async recordPomo(data: {
    clientId: string;
    taskId?: string;
    startedAt: string;
    endedAt: string;
    durationSec: number;
  }): Promise<void> {
    const mins = Math.floor(data.durationSec / 60); // 59秒以下は0分換算
    const pomoCount = mins === 0 ? 0 : Math.ceil(mins / 25); // 25で割って余りは繰り上げ
    const recordPayload: PomoRecord = {
      id: crypto.randomUUID(),
      ...data,
      pomoCount,
    };

    // Keep localStorage in sync immediately for 0ms UI reactivity
    const raw = localStorage.getItem(STORAGE_KEYS.POMOS);
    const pomos: PomoRecord[] = raw ? JSON.parse(raw) : [];
    pomos.push(recordPayload);
    localStorage.setItem(STORAGE_KEYS.POMOS, JSON.stringify(pomos));

    // Accumulate exact actualFocusSec and calculate equivalent pomoCount for the task
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

    if (!STANDALONE_LOCAL_MODE) {
      try {
        await this.request<void>('/v1/pomos', {
          method: 'POST',
          body: JSON.stringify(recordPayload),
        });
      } catch {}
    }
  }

  async listPomos(date?: string, since?: string): Promise<PomoRecord[]> {
    const raw = localStorage.getItem(STORAGE_KEYS.POMOS);
    const pomos: PomoRecord[] = raw ? JSON.parse(raw) : [];

    if (since) {
      return pomos.filter((p) => (p.startedAt || '') >= since);
    }
    if (!date) {
      const todayStr = new Date().toISOString().slice(0, 10);
      return pomos.filter((p) => p.startedAt?.startsWith(todayStr));
    }
    return pomos.filter((p) => p.startedAt?.startsWith(date));
  }

  // -----------------------------------------------------------
  // Session State
  // -----------------------------------------------------------
  async getSession(): Promise<PomoSession> {
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
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(updated));

    if (!STANDALONE_LOCAL_MODE) {
      try {
        await this.request<PomoSession>('/v1/session', {
          method: 'PUT',
          body: JSON.stringify(session),
        });
      } catch {}
    }

    return updated;
  }

  // -----------------------------------------------------------
  // Daily Reports
  // -----------------------------------------------------------
  async listReports(limit = 90): Promise<Report[]> {
    const raw = localStorage.getItem(STORAGE_KEYS.REPORTS);
    const reports: Report[] = raw ? JSON.parse(raw) : [];
    // Sort descending by publishedDate
    reports.sort((a, b) => b.publishedDate.localeCompare(a.publishedDate));
    return reports.slice(0, limit);
  }

  async getReport(date: string): Promise<Report> {
    const raw = localStorage.getItem(STORAGE_KEYS.REPORTS);
    const reports: Report[] = raw ? JSON.parse(raw) : [];
    const found = reports.find((r) => r.publishedDate === date);
    if (!found) {
      throw new Error('Not found');
    }
    return found;
  }

  async saveReport(report: {
    publishedDate: string;
    body: string;
    autoFacts?: string;
    learnings?: string;
    challenges?: string;
    nextActions?: string;
    selfScore?: number;
    source?: string;
  }): Promise<Report> {
    const raw = localStorage.getItem(STORAGE_KEYS.REPORTS);
    let reports: Report[] = raw ? JSON.parse(raw) : [];
    const newReport: Report = {
      id: crypto.randomUUID(),
      userId: 'local-user',
      publishedDate: report.publishedDate,
      body: report.body,
      autoFacts: report.autoFacts,
      learnings: report.learnings,
      challenges: report.challenges,
      nextActions: report.nextActions,
      selfScore: report.selfScore,
      source: (report.source as any) || 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    reports = reports.filter((r) => r.publishedDate !== report.publishedDate);
    reports.unshift(newReport);
    localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(reports));

    if (!STANDALONE_LOCAL_MODE) {
      try {
        await this.request<Report>(`/v1/reports/${report.publishedDate}`, {
          method: 'PUT',
          body: JSON.stringify(report),
        });
      } catch {}
    }

    return newReport;
  }

  // Auto-generate Facts and Report draft from actual recorded activity
  async getAutoDraftReport(date: string): Promise<{ autoFacts: string; draftBody: string }> {
    const rawPomos = localStorage.getItem(STORAGE_KEYS.POMOS);
    const pomos: PomoRecord[] = rawPomos ? JSON.parse(rawPomos) : [];
    const rawTasks = localStorage.getItem(STORAGE_KEYS.TASKS);
    const tasks: Task[] = rawTasks ? JSON.parse(rawTasks) : [];

    const datePomos = pomos.filter((p) => p.startedAt?.startsWith(date));
    let totalSec = 0;
    for (const p of datePomos) {
      totalSec += p.durationSec;
    }
    const totalMin = Math.floor(totalSec / 60);
    const pomoEquivalent = (totalSec / 1500).toFixed(1);

    let facts = `## **本日の集中実績** (Facts)\n`;
    facts += `- **総集中時間**: ${totalMin}分 (${pomoEquivalent} pomo)\n`;
    facts += `- **消化セッション**: ${datePomos.length} 回\n\n`;
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
  // AI Voice & Summary
  // -----------------------------------------------------------
  async voiceToReport(
    audioBase64: string,
    mimeType: string,
    date: string
  ): Promise<{ transcript: string; draftBody: string }> {
    if (!STANDALONE_LOCAL_MODE) {
      try {
        return await this.request<{ transcript: string; draftBody: string }>('/v1/ai/voice-to-report', {
          method: 'POST',
          body: JSON.stringify({ audioBase64, mimeType, date }),
        });
      } catch {}
    }

    const { autoFacts } = await this.getAutoDraftReport(date);
    return {
      transcript: '本日のポモドーロ作業と日報の音声入力を行いました。',
      draftBody: `${autoFacts}
## **今日学んだこと・気づき**
- 短時間ターム設定（15分〜25分）を取り入れたことで集中への着手が非常にスムーズになった。
- AI自動クラスタリングによりタスクの分類に頭を使わずに済んだ。

## **課題・反省点**
- 作業の途中で別の調べ物に脱線しそうになった。

## **明日のアクション**
- 朝一番のタームで最優先タスクを片付ける。 (${date})`,
    };
  }

  async getAISummary(
    scope: 'daily' | 'weekly' | 'monthly',
    periodStart: string,
    periodEnd: string
  ): Promise<{ content: string }> {
    if (!STANDALONE_LOCAL_MODE) {
      try {
        return await this.request<{ content: string }>('/v1/ai/summary', {
          method: 'POST',
          body: JSON.stringify({ scope, periodStart, periodEnd }),
        });
      } catch {}
    }

    const stats = await this.getStats();
    return {
      content: `### ${scope === 'daily' ? '本日' : scope === 'weekly' ? '今週' : '今月'} の振り返りサマリー (${periodStart} 〜 ${periodEnd})

- **実集中時間**: ${stats.todayFocusMinutes} 分 (${stats.totalFocusSec} 秒)
- **ポモドーロ換算**: ${(stats.totalFocusSec / 1500).toFixed(1)} pomo (累積25分=1pomo)
- **完了タスク**: ${stats.totalTasksCompleted} 件

#### 総括 & アドバイス
短時間タームや柔軟な集中設定を効果的に活用できています。作業途中で切り上げても正確な作業秒数が積み上がっており、無理のない持続可能な集中リズムが作れています！`,
    };
  }

  // -----------------------------------------------------------
  // Accurate Statistics
  // -----------------------------------------------------------
  async getStats(): Promise<StatsSummary> {
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
      if (p.startedAt?.startsWith(todayStr)) {
        todaySec += dur;
      }
      if ((p.startedAt || '') >= sevenDaysAgoIso) {
        weekSec += dur;
      }
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

  // -----------------------------------------------------------
  // Groups (Standby for personal mode)
  // -----------------------------------------------------------
  async listGroups(): Promise<Group[]> {
    const raw = localStorage.getItem(STORAGE_KEYS.GROUPS);
    return raw
      ? JSON.parse(raw)
      : [
          {
            id: 'group-local',
            name: 'ローカル集中チーム',
            description: 'ローカル集中ルーム',
            ownerId: 'local-user',
            inviteCode: 'LOCALPOMO',
            memberCount: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];
  }

  async createGroup(name: string, description: string): Promise<Group> {
    const g: Group = {
      id: crypto.randomUUID(),
      name,
      description,
      ownerId: 'local-user',
      inviteCode: Math.random().toString(36).substring(2, 10).toUpperCase(),
      memberCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const raw = localStorage.getItem(STORAGE_KEYS.GROUPS);
    const groups: Group[] = raw ? JSON.parse(raw) : [];
    groups.push(g);
    localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups));
    return g;
  }

  async joinGroup(_inviteCode: string): Promise<Group> {
    const g = (await this.listGroups())[0];
    return g;
  }

  async getGroup(groupId: string): Promise<Group> {
    const groups = await this.listGroups();
    return groups.find((g) => g.id === groupId) || groups[0];
  }

  async listGroupMembers(groupId: string): Promise<GroupMember[]> {
    return [
      {
        groupId,
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
