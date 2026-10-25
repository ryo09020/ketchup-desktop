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

const API_BASE_URL = 'http://localhost:8080';

const STORAGE_KEYS = {
  TASKS: 'ketchup_local_tasks',
  REPORTS: 'ketchup_local_reports',
  POMOS: 'ketchup_local_pomos',
  SETTINGS: 'ketchup_local_settings',
  GROUPS: 'ketchup_local_groups',
};

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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

  // Me & Settings
  async getMe(): Promise<MeResponse> {
    try {
      return await this.request<MeResponse>('/v1/me');
    } catch {
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

      return {
        profile: {
          id: 'local-user',
          email: 'local@desktop.app',
          displayName: 'ローカルユーザー',
          avatarUrl: '',
          timezone: 'Asia/Tokyo',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        settings,
      };
    }
  }

  async updateMe(data: Partial<Profile>): Promise<MeResponse> {
    try {
      return await this.request<MeResponse>('/v1/me', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    } catch {
      return this.getMe();
    }
  }

  async deleteMe(): Promise<void> {
    try {
      await this.request<void>('/v1/me', { method: 'DELETE' });
    } finally {
      localStorage.clear();
    }
  }

  async updateSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
    try {
      return await this.request<UserSettings>('/v1/me/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
    } catch {
      const current = (await this.getMe()).settings;
      const updated = { ...current, ...settings, updatedAt: new Date().toISOString() };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
      return updated;
    }
  }

  // AI Task Classification (Rule-based heuristic + Gemini)
  async classifyTask(title: string): Promise<{ category: string; topic: string }> {
    try {
      return await this.request<{ category: string; topic: string }>('/v1/ai/classify-task', {
        method: 'POST',
        body: JSON.stringify({ title }),
      });
    } catch {
      // Offline fallback heuristic
      const lower = title.toLowerCase();
      let category = '一般タスク';
      let topic = 'その他';

      if (lower.includes('英語') || lower.includes('単語') || lower.includes('toeic') || lower.includes('duo') || lower.includes('ターゲット')) {
        category = '英語学習';
        topic = lower.includes('単語') ? '単語暗記' : lower.includes('過去問') ? '過去問演習' : '文法・長文';
      } else if (lower.includes('数学') || lower.includes('数') || lower.includes('計算') || lower.includes('チャート')) {
        category = '数学学習';
        topic = '問題演習';
      } else if (lower.includes('開発') || lower.includes('実装') || lower.includes('バグ') || lower.includes('修正') || lower.includes('コード') || lower.includes('api')) {
        category = '開発・実装';
        topic = lower.includes('バグ') ? 'デバッグ' : '機能開発';
      } else if (lower.includes('読書') || lower.includes('本')) {
        category = 'インプット';
        topic = '読書';
      }
      return { category, topic };
    }
  }

  // Tasks
  async listTasks(status?: TaskStatus, project?: string): Promise<Task[]> {
    try {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      if (project) params.append('project', project);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const tasks = await this.request<Task[]>(`/v1/tasks${qs}`);
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
      return tasks;
    } catch {
      const raw = localStorage.getItem(STORAGE_KEYS.TASKS);
      let tasks: Task[] = raw ? JSON.parse(raw) : [];
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
            category: '数学学習',
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
      return tasks;
    }
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

    try {
      return await this.request<Task>('/v1/tasks', {
        method: 'POST',
        body: JSON.stringify({ ...task, category: cat, topic: top }),
      });
    } catch {
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
      return newTask;
    }
  }

  async updateTask(taskId: string, updates: Partial<Task>): Promise<Task> {
    try {
      return await this.request<Task>(`/v1/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    } catch {
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
      return updatedTask!;
    }
  }

  async deleteTask(taskId: string): Promise<void> {
    try {
      await this.request<void>(`/v1/tasks/${taskId}`, { method: 'DELETE' });
    } catch {
      const raw = localStorage.getItem(STORAGE_KEYS.TASKS);
      let tasks: Task[] = raw ? JSON.parse(raw) : [];
      tasks = tasks.filter((t) => t.id !== taskId);
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    }
  }

  // Pomos (Record exact elapsed seconds & calculate pomo count)
  async recordPomo(data: { clientId: string; taskId?: string; startedAt: string; endedAt: string; durationSec: number }): Promise<void> {
    const mins = Math.floor(data.durationSec / 60); // 59秒以下は0分換算
    const pomoCount = mins === 0 ? 0 : Math.ceil(mins / 25); // 25で割ってあまりは繰り上げ (25分=1, 26分=2)
    const recordPayload: PomoRecord = { ...data, pomoCount };

    try {
      await this.request<void>('/v1/pomos', {
        method: 'POST',
        body: JSON.stringify(recordPayload),
      });
    } catch {
      // offline fallback
    }

    // Always keep localStorage sync for offline capability and instant UI reactivity
    const raw = localStorage.getItem(STORAGE_KEYS.POMOS);
    const pomos: PomoRecord[] = raw ? JSON.parse(raw) : [];
    pomos.push(recordPayload);
    localStorage.setItem(STORAGE_KEYS.POMOS, JSON.stringify(pomos));

    // Accumulate exact actualFocusSec and calculate equivalent pomoCount
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

  async listPomos(date?: string, since?: string): Promise<PomoRecord[]> {
    try {
      let qs = '';
      if (since) {
        qs = `?since=${encodeURIComponent(since)}`;
      } else if (date) {
        qs = `?date=${encodeURIComponent(date)}`;
      }
      const records = await this.request<PomoRecord[]>(`/v1/pomos${qs}`);
      return records;
    } catch {
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
  }

  // Session
  async getSession(): Promise<PomoSession> {
    try {
      return await this.request<PomoSession>('/v1/session');
    } catch {
      return {
        userId: 'local-user',
        phase: 'IDLE',
        updatedAt: new Date().toISOString(),
      };
    }
  }

  async updateSession(session: Partial<PomoSession>): Promise<PomoSession> {
    try {
      return await this.request<PomoSession>('/v1/session', {
        method: 'PUT',
        body: JSON.stringify(session),
      });
    } catch {
      return {
        userId: 'local-user',
        phase: session.phase || 'IDLE',
        ...session,
        updatedAt: new Date().toISOString(),
      };
    }
  }

  // Reports
  async listReports(limit = 30): Promise<Report[]> {
    try {
      return await this.request<Report[]>(`/v1/reports?limit=${limit}`);
    } catch {
      const raw = localStorage.getItem(STORAGE_KEYS.REPORTS);
      return raw ? JSON.parse(raw) : [];
    }
  }

  async getReport(date: string): Promise<Report> {
    try {
      return await this.request<Report>(`/v1/reports/${date}`);
    } catch {
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
    source?: string;
  }): Promise<Report> {
    try {
      return await this.request<Report>(`/v1/reports/${report.publishedDate}`, {
        method: 'PUT',
        body: JSON.stringify(report),
      });
    } catch {
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
      return newReport;
    }
  }

  // Auto-generate Facts and Report draft from actual recorded activity
  async getAutoDraftReport(date: string): Promise<{ autoFacts: string; draftBody: string }> {
    try {
      return await this.request<{ autoFacts: string; draftBody: string }>(`/v1/reports/auto-draft?date=${date}`);
    } catch {
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
      const totalSecRemaining = totalSec % 60;
      const pomoEquivalent = (totalSec / 1500).toFixed(1);

      let facts = `## **本日の集中実績** (Facts)\n`;
      facts += `- **総集中時間**: ${totalMin}分 (${pomoEquivalent} pomo)\n`;
      facts += `- **消化セッション**: ${datePomos.length} 回\n\n`;
      facts += `### 完了・進行したタスク\n`;

      const activeTasks = tasks.filter((t) => t.status === 'COMPLETED' || t.pomoCount > 0 || (t.actualFocusSec || 0) > 0);
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
  }

  // AI Voice & Summary
  async voiceToReport(audioBase64: string, mimeType: string, date: string): Promise<{ transcript: string; draftBody: string }> {
    try {
      return await this.request<{ transcript: string; draftBody: string }>('/v1/ai/voice-to-report', {
        method: 'POST',
        body: JSON.stringify({ audioBase64, mimeType, date }),
      });
    } catch {
      return {
        transcript: '本日のポモドーロ作業と日報の音声入力を行いました。',
        draftBody: `## **今日学んだこと・気づき**
- 短時間ターム設定（15分〜25分）を取り入れたことで集中への着手が非常にスムーズになった。
- AI自動クラスタリングによりタスクの分類に頭を使わずに済んだ。

## **課題・反省点**
- 作業の途中で別の調べ物に脱線しそうになった。

## **明日のアクション**
- 朝一番のタームで最優先タスクを片付ける。 (${date})`,
      };
    }
  }

  async getAISummary(scope: 'daily' | 'weekly' | 'monthly', periodStart: string, periodEnd: string): Promise<{ content: string }> {
    try {
      return await this.request<{ content: string }>('/v1/ai/summary', {
        method: 'POST',
        body: JSON.stringify({ scope, periodStart, periodEnd }),
      });
    } catch {
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
  }

  // Stats
  async getStats(): Promise<StatsSummary> {
    try {
      return await this.request<StatsSummary>('/v1/stats/summary');
    } catch {
      const rawPomos = localStorage.getItem(STORAGE_KEYS.POMOS);
      const pomos: PomoRecord[] = rawPomos ? JSON.parse(rawPomos) : [];
      const rawTasks = localStorage.getItem(STORAGE_KEYS.TASKS);
      const tasks: Task[] = rawTasks ? JSON.parse(rawTasks) : [];
      const completed = tasks.filter((t) => t.status === 'COMPLETED').length;

      let totalSec = 0;
      for (const p of pomos) {
        totalSec += p.durationSec;
      }
      const totalMin = Math.floor(totalSec / 60);
      const todayPomos = totalMin === 0 ? 0 : Math.ceil(totalMin / 25);

      return {
        todayPomos,
        todayFocusMinutes: totalMin,
        totalFocusSec: totalSec,
        weekPomos: todayPomos,
        weekFocusMinutes: totalMin,
        totalTasksCompleted: completed,
      };
    }
  }

  // Groups
  async listGroups(): Promise<Group[]> {
    try {
      return await this.request<Group[]>('/v1/groups');
    } catch {
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
  }

  async createGroup(name: string, description: string): Promise<Group> {
    try {
      return await this.request<Group>('/v1/groups', {
        method: 'POST',
        body: JSON.stringify({ name, description }),
      });
    } catch {
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
  }

  async joinGroup(inviteCode: string): Promise<Group> {
    try {
      return await this.request<Group>('/v1/groups/join', {
        method: 'POST',
        body: JSON.stringify({ inviteCode }),
      });
    } catch {
      const g = (await this.listGroups())[0];
      return g;
    }
  }

  async getGroup(groupId: string): Promise<Group> {
    const groups = await this.listGroups();
    return groups.find((g) => g.id === groupId) || groups[0];
  }

  async listGroupMembers(groupId: string): Promise<GroupMember[]> {
    try {
      return await this.request<GroupMember[]>(`/v1/groups/${groupId}/members`);
    } catch {
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
  }

  async leaveGroup(_groupId: string): Promise<void> {}
}

export const api = new ApiClient();
