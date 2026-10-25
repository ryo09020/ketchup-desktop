use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

pub struct DbState(pub Mutex<Connection>);

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub user_id: String,
    pub title: String,
    pub note: String,
    pub status: String,
    pub estimated_pomos: i64,
    pub pomo_count: i64,
    pub actual_focus_sec: i64,
    pub category: String,
    pub topic: String,
    pub due_date: Option<String>,
    pub project: Option<String>,
    pub sort_order: i64,
    pub completed_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PomoRecord {
    pub id: String,
    pub client_id: String,
    pub task_id: Option<String>,
    pub task_title: Option<String>,
    pub started_at: String,
    pub ended_at: String,
    pub duration_sec: i64,
    pub pomo_count: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Report {
    pub id: String,
    pub user_id: String,
    pub published_date: String,
    pub body: String,
    pub auto_facts: Option<String>,
    pub learnings: Option<String>,
    pub challenges: Option<String>,
    pub next_actions: Option<String>,
    pub self_score: Option<i64>,
    pub source: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StatsSummary {
    pub today_pomos: i64,
    pub today_focus_minutes: i64,
    pub total_focus_sec: i64,
    pub week_pomos: i64,
    pub week_focus_minutes: i64,
    pub total_tasks_completed: i64,
}

pub fn init_db(app: &AppHandle) -> Result<Connection, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("アプリデータフォルダの取得に失敗: {}", e))?;

    if !app_dir.exists() {
        std::fs::create_dir_all(&app_dir)
            .map_err(|e| format!("データディレクトリの作成に失敗: {}", e))?;
    }

    let db_path: PathBuf = app_dir.join("ketchup.db");
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("SQLiteデータベースのオープンに失敗: {}", e))?;

    // WALモードと同期モードを設定（クラッシュ耐性＆超高速化）
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         PRAGMA foreign_keys = ON;",
    )
    .map_err(|e| format!("PRAGMA設定に失敗: {}", e))?;

    // スキーマ初期化
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL DEFAULT 'local-user',
            title TEXT NOT NULL,
            note TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'TODO',
            estimated_pomos INTEGER NOT NULL DEFAULT 1,
            pomo_count INTEGER NOT NULL DEFAULT 0,
            actual_focus_sec INTEGER NOT NULL DEFAULT 0,
            category TEXT NOT NULL DEFAULT '一般',
            topic TEXT NOT NULL DEFAULT 'その他',
            due_date TEXT,
            project TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0,
            completed_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
        CREATE INDEX IF NOT EXISTS idx_tasks_sort ON tasks(sort_order);

        CREATE TABLE IF NOT EXISTS pomos (
            id TEXT PRIMARY KEY,
            client_id TEXT NOT NULL,
            task_id TEXT,
            task_title TEXT,
            started_at TEXT NOT NULL,
            ended_at TEXT NOT NULL,
            duration_sec INTEGER NOT NULL,
            pomo_count INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_pomos_started_at ON pomos(started_at);
        CREATE INDEX IF NOT EXISTS idx_pomos_task_id ON pomos(task_id);

        CREATE TABLE IF NOT EXISTS reports (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL DEFAULT 'local-user',
            published_date TEXT NOT NULL UNIQUE,
            body TEXT NOT NULL,
            auto_facts TEXT,
            learnings TEXT,
            challenges TEXT,
            next_actions TEXT,
            self_score INTEGER,
            source TEXT NOT NULL DEFAULT 'manual',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(published_date);

        CREATE TABLE IF NOT EXISTS kv_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );",
    )
    .map_err(|e| format!("テーブル作成に失敗: {}", e))?;

    // 初回起動時の初期タスク投入（タスクが空の場合のみ）
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM tasks", [], |r| r.get(0))
        .unwrap_or(0);

    if count == 0 {
        let now = chrono_iso_now();
        let _ = conn.execute(
            "INSERT INTO tasks (
                id, user_id, title, note, status, estimated_pomos, pomo_count,
                actual_focus_sec, category, topic, sort_order, created_at, updated_at
            ) VALUES (
                'task-onboarding', 'local-user', 'KetchUp の使い方を理解する',
                'タイマーを起動して集中セッションを体験してみる', 'TODO', 1, 0,
                0, 'KetchUp', 'チュートリアル', strftime('%s','now')*1000, ?1, ?1
            )",
            params![now],
        );
    }

    Ok(conn)
}

fn chrono_iso_now() -> String {
    // 依存関係を増やさずOSの時間でUTC ISO 8601を生成
    let now = std::time::SystemTime::now();
    let dt: ChronoLite = now.into();
    dt.to_iso()
}

// 簡易 ISO8601 フォーマッタ（外部crate不要）
struct ChronoLite {
    secs: u64,
}
impl From<std::time::SystemTime> for ChronoLite {
    fn from(t: std::time::SystemTime) -> Self {
        let secs = t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs();
        Self { secs }
    }
}
impl ChronoLite {
    fn to_iso(&self) -> String {
        // days since epoch
        let s = self.secs;
        let days = s / 86400;
        let rem_secs = s % 86400;
        let h = rem_secs / 3600;
        let m = (rem_secs % 3600) / 60;
        let sec = rem_secs % 60;

        // civil date calculation
        let z = days as i64 + 719468;
        let era = (if z >= 0 { z } else { z - 146096 }) / 146097;
        let doe = (z - era * 146097) as u64;
        let yoe = (doe - doe / 1024 + doe / 1461 - doe / 146096) / 365;
        let y = yoe as i64 + era * 400;
        let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
        let mp = (5 * doy + 2) / 153;
        let d = doy - (153 * mp + 2) / 5 + 1;
        let m_adj = if mp < 10 { mp + 3 } else { mp - 9 };
        let y_adj = if m_adj <= 2 { y + 1 } else { y };

        format!(
            "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
            y_adj, m_adj, d, h, m, sec
        )
    }
}

// -------------------------------------------------------------
// Tauri Commands
// -------------------------------------------------------------

#[tauri::command]
pub fn db_list_tasks(
    state: tauri::State<'_, DbState>,
    status: Option<String>,
    project: Option<String>,
) -> Result<Vec<Task>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let mut sql = "SELECT id, user_id, title, note, status, estimated_pomos, pomo_count,
                          actual_focus_sec, category, topic, due_date, project,
                          sort_order, completed_at, created_at, updated_at
                   FROM tasks WHERE 1=1".to_string();

    let mut param_values: Vec<String> = Vec::new();
    if let Some(s) = status {
        sql.push_str(" AND status = ?");
        param_values.push(s);
    }
    if let Some(p) = project {
        sql.push_str(" AND project = ?");
        param_values.push(p);
    }
    sql.push_str(" ORDER BY sort_order DESC, created_at DESC");

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let params_ref: Vec<&dyn rusqlite::ToSql> = param_values.iter().map(|s| s as &dyn rusqlite::ToSql).collect();

    let rows = stmt
        .query_map(&params_ref[..], |row| {
            Ok(Task {
                id: row.get(0)?,
                user_id: row.get(1)?,
                title: row.get(2)?,
                note: row.get(3)?,
                status: row.get(4)?,
                estimated_pomos: row.get(5)?,
                pomo_count: row.get(6)?,
                actual_focus_sec: row.get(7)?,
                category: row.get(8)?,
                topic: row.get(9)?,
                due_date: row.get(10)?,
                project: row.get(11)?,
                sort_order: row.get(12)?,
                completed_at: row.get(13)?,
                created_at: row.get(14)?,
                updated_at: row.get(15)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut tasks = Vec::new();
    for r in rows {
        tasks.push(r.map_err(|e| e.to_string())?);
    }
    Ok(tasks)
}

#[tauri::command]
pub fn db_save_task(state: tauri::State<'_, DbState>, task: Task) -> Result<Task, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO tasks (
            id, user_id, title, note, status, estimated_pomos, pomo_count,
            actual_focus_sec, category, topic, due_date, project,
            sort_order, completed_at, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
        ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            note = excluded.note,
            status = excluded.status,
            estimated_pomos = excluded.estimated_pomos,
            pomo_count = excluded.pomo_count,
            actual_focus_sec = excluded.actual_focus_sec,
            category = excluded.category,
            topic = excluded.topic,
            due_date = excluded.due_date,
            project = excluded.project,
            sort_order = excluded.sort_order,
            completed_at = excluded.completed_at,
            updated_at = excluded.updated_at",
        params![
            task.id,
            task.user_id,
            task.title,
            task.note,
            task.status,
            task.estimated_pomos,
            task.pomo_count,
            task.actual_focus_sec,
            task.category,
            task.topic,
            task.due_date,
            task.project,
            task.sort_order,
            task.completed_at,
            task.created_at,
            task.updated_at
        ],
    )
    .map_err(|e| format!("タスクの保存に失敗: {}", e))?;

    Ok(task)
}

#[tauri::command]
pub fn db_delete_task(state: tauri::State<'_, DbState>, task_id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM tasks WHERE id = ?1", params![task_id])
        .map_err(|e| format!("タスクの削除に失敗: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn db_record_pomo(
    state: tauri::State<'_, DbState>,
    record: PomoRecord,
) -> Result<(), String> {
    let mut conn = state.0.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let now = chrono_iso_now();
    tx.execute(
        "INSERT INTO pomos (
            id, client_id, task_id, task_title, started_at, ended_at, duration_sec, pomo_count, created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            record.id,
            record.client_id,
            record.task_id,
            record.task_title,
            record.started_at,
            record.ended_at,
            record.duration_sec,
            record.pomo_count,
            now
        ],
    )
    .map_err(|e| format!("ポモ記録の書き込みに失敗: {}", e))?;

    // 関連タスクがあれば累計集中秒数を原子的に加算
    if let Some(ref tid) = record.task_id {
        let task_exists: bool = tx
            .query_row("SELECT 1 FROM tasks WHERE id = ?1", params![tid], |_| Ok(true))
            .optional()
            .map_err(|e| e.to_string())?
            .unwrap_or(false);

        if task_exists {
            tx.execute(
                "UPDATE tasks SET
                    actual_focus_sec = actual_focus_sec + ?1,
                    pomo_count = CASE
                        WHEN (actual_focus_sec + ?1) / 60 == 0 THEN 0
                        ELSE ((actual_focus_sec + ?1) / 60 + 24) / 25
                    END,
                    updated_at = ?2
                 WHERE id = ?3",
                params![record.duration_sec, now, tid],
            )
            .map_err(|e| format!("タスク実績の更新に失敗: {}", e))?;
        }
    }

    tx.commit().map_err(|e| format!("トランザクションのコミットに失敗: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn db_list_pomos(
    state: tauri::State<'_, DbState>,
    date: Option<String>,
    since: Option<String>,
) -> Result<Vec<PomoRecord>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let mut sql = "SELECT id, client_id, task_id, task_title, started_at, ended_at, duration_sec, pomo_count
                   FROM pomos WHERE 1=1".to_string();

    let mut param_values: Vec<String> = Vec::new();
    if let Some(s) = since {
        sql.push_str(" AND started_at >= ?");
        param_values.push(s);
    } else if let Some(d) = date {
        sql.push_str(" AND started_at LIKE ?");
        param_values.push(format!("{}%", d));
    }
    sql.push_str(" ORDER BY started_at DESC");

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let params_ref: Vec<&dyn rusqlite::ToSql> = param_values.iter().map(|s| s as &dyn rusqlite::ToSql).collect();

    let rows = stmt
        .query_map(&params_ref[..], |row| {
            Ok(PomoRecord {
                id: row.get(0)?,
                client_id: row.get(1)?,
                task_id: row.get(2)?,
                task_title: row.get(3)?,
                started_at: row.get(4)?,
                ended_at: row.get(5)?,
                duration_sec: row.get(6)?,
                pomo_count: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for r in rows {
        list.push(r.map_err(|e| e.to_string())?);
    }
    Ok(list)
}

#[tauri::command]
pub fn db_get_stats(state: tauri::State<'_, DbState>) -> Result<StatsSummary, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    // 今日の合計
    let today_prefix = chrono_iso_now().chars().take(10).collect::<String>();
    let today_sec: Option<i64> = conn
        .query_row(
            "SELECT SUM(duration_sec) FROM pomos WHERE started_at LIKE ?1",
            params![format!("{}%", today_prefix)],
            |r| r.get(0),
        )
        .unwrap_or(Some(0));
    let today_sec = today_sec.unwrap_or(0);
    let today_min = today_sec / 60;
    let today_pomos = if today_min == 0 { 0 } else { (today_min + 24) / 25 };

    // 累計の合計
    let total_sec: Option<i64> = conn
        .query_row("SELECT SUM(duration_sec) FROM pomos", [], |r| r.get(0))
        .unwrap_or(Some(0));
    let total_sec = total_sec.unwrap_or(0);

    // 直近7日間の合計
    let week_sec: Option<i64> = conn
        .query_row(
            "SELECT SUM(duration_sec) FROM pomos WHERE started_at >= datetime('now', '-6 days')",
            [],
            |r| r.get(0),
        )
        .unwrap_or(Some(0));
    let week_sec = week_sec.unwrap_or(0);
    let week_min = week_sec / 60;
    let week_pomos = if week_min == 0 { 0 } else { (week_min + 24) / 25 };

    // 完了タスク数
    let completed_tasks: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM tasks WHERE status = 'COMPLETED'",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);

    Ok(StatsSummary {
        today_pomos,
        today_focus_minutes: today_min,
        total_focus_sec: total_sec,
        week_pomos,
        week_focus_minutes: week_min,
        total_tasks_completed: completed_tasks,
    })
}

#[tauri::command]
pub fn db_list_reports(
    state: tauri::State<'_, DbState>,
    limit: Option<i64>,
) -> Result<Vec<Report>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let lim = limit.unwrap_or(90);

    let mut stmt = conn
        .prepare(
            "SELECT id, user_id, published_date, body, auto_facts, learnings, challenges,
                    next_actions, self_score, source, created_at, updated_at
             FROM reports ORDER BY published_date DESC LIMIT ?1",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![lim], |row| {
            Ok(Report {
                id: row.get(0)?,
                user_id: row.get(1)?,
                published_date: row.get(2)?,
                body: row.get(3)?,
                auto_facts: row.get(4)?,
                learnings: row.get(5)?,
                challenges: row.get(6)?,
                next_actions: row.get(7)?,
                self_score: row.get(8)?,
                source: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for r in rows {
        list.push(r.map_err(|e| e.to_string())?);
    }
    Ok(list)
}

#[tauri::command]
pub fn db_get_report(
    state: tauri::State<'_, DbState>,
    date: String,
) -> Result<Option<Report>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, user_id, published_date, body, auto_facts, learnings, challenges,
                    next_actions, self_score, source, created_at, updated_at
             FROM reports WHERE published_date = ?1",
        )
        .map_err(|e| e.to_string())?;

    let report = stmt
        .query_row(params![date], |row| {
            Ok(Report {
                id: row.get(0)?,
                user_id: row.get(1)?,
                published_date: row.get(2)?,
                body: row.get(3)?,
                auto_facts: row.get(4)?,
                learnings: row.get(5)?,
                challenges: row.get(6)?,
                next_actions: row.get(7)?,
                self_score: row.get(8)?,
                source: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })
        .optional()
        .map_err(|e| e.to_string())?;

    Ok(report)
}

#[tauri::command]
pub fn db_save_report(state: tauri::State<'_, DbState>, report: Report) -> Result<Report, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO reports (
            id, user_id, published_date, body, auto_facts, learnings, challenges,
            next_actions, self_score, source, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
        ON CONFLICT(published_date) DO UPDATE SET
            body = excluded.body,
            auto_facts = excluded.auto_facts,
            learnings = excluded.learnings,
            challenges = excluded.challenges,
            next_actions = excluded.next_actions,
            self_score = excluded.self_score,
            source = excluded.source,
            updated_at = excluded.updated_at",
        params![
            report.id,
            report.user_id,
            report.published_date,
            report.body,
            report.auto_facts,
            report.learnings,
            report.challenges,
            report.next_actions,
            report.self_score,
            report.source,
            report.created_at,
            report.updated_at
        ],
    )
    .map_err(|e| format!("日報の保存に失敗: {}", e))?;

    Ok(report)
}

#[tauri::command]
pub fn db_get_setting(
    state: tauri::State<'_, DbState>,
    key: String,
) -> Result<Option<String>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let val: Option<String> = conn
        .query_row(
            "SELECT value FROM kv_settings WHERE key = ?1",
            params![key],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    Ok(val)
}

#[tauri::command]
pub fn db_save_setting(
    state: tauri::State<'_, DbState>,
    key: String,
    value: String,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO kv_settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )
    .map_err(|e| format!("設定の保存に失敗: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn db_clear_all_data(state: tauri::State<'_, DbState>) -> Result<(), String> {
    let mut conn = state.0.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM tasks", [])
        .map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM pomos", [])
        .map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM reports", [])
        .map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM kv_settings", [])
        .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

// -------------------------------------------------------------
// 既存の localStorage データから SQLite への自動マイグレーション
// -------------------------------------------------------------
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LegacyImportPayload {
    pub tasks: Option<Vec<Task>>,
    pub pomos: Option<Vec<PomoRecord>>,
    pub reports: Option<Vec<Report>>,
}

#[tauri::command]
pub fn db_import_legacy_data(
    state: tauri::State<'_, DbState>,
    data: LegacyImportPayload,
) -> Result<usize, String> {
    let mut conn = state.0.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let mut imported_count = 0;

    if let Some(tasks) = data.tasks {
        for t in tasks {
            // 不要な旧サンプルタスクはスキップ
            if t.id == "task-english" || t.id == "task-math" {
                continue;
            }
            let res = tx.execute(
                "INSERT OR IGNORE INTO tasks (
                    id, user_id, title, note, status, estimated_pomos, pomo_count,
                    actual_focus_sec, category, topic, due_date, project,
                    sort_order, completed_at, created_at, updated_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
                params![
                    t.id, t.user_id, t.title, t.note, t.status, t.estimated_pomos,
                    t.pomo_count, t.actual_focus_sec, t.category, t.topic,
                    t.due_date, t.project, t.sort_order, t.completed_at,
                    t.created_at, t.updated_at
                ],
            );
            if res.is_ok() {
                imported_count += 1;
            }
        }
    }

    if let Some(pomos) = data.pomos {
        let now = chrono_iso_now();
        for p in pomos {
            let res = tx.execute(
                "INSERT OR IGNORE INTO pomos (
                    id, client_id, task_id, task_title, started_at, ended_at, duration_sec, pomo_count, created_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    p.id, p.client_id, p.task_id, p.task_title, p.started_at, p.ended_at, p.duration_sec, p.pomo_count, now
                ],
            );
            if res.is_ok() {
                imported_count += 1;
            }
        }
    }

    if let Some(reports) = data.reports {
        for r in reports {
            let res = tx.execute(
                "INSERT OR IGNORE INTO reports (
                    id, user_id, published_date, body, auto_facts, learnings, challenges,
                    next_actions, self_score, source, created_at, updated_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                params![
                    r.id, r.user_id, r.published_date, r.body, r.auto_facts, r.learnings,
                    r.challenges, r.next_actions, r.self_score, r.source, r.created_at, r.updated_at
                ],
            );
            if res.is_ok() {
                imported_count += 1;
            }
        }
    }

    tx.commit().map_err(|e| format!("マイグレーションのコミットに失敗: {}", e))?;
    Ok(imported_count)
}
