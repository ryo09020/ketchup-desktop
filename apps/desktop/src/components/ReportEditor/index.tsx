import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  Timer,
  CheckCircle2,
  Circle,
  Lightbulb,
  AlertTriangle,
  Rocket,
  Save,
  Mic,
  RefreshCw,
  X,
  Sparkles,
  Check,
  TrendingUp,
} from 'lucide-react';
import classes from './index.module.scss';
import tomatoSvg from '@/assets/tomato.svg';
import { api, Report, Task, PomoRecord } from '@/api/client';
import { parseReportBody, buildReportMarkdown } from '@/components/ReportViewer/reportParser';

interface ReportEditorProps {
  date: string;
  onSaveSuccess: (report: Report) => void;
  onCancel?: () => void;
  onOpenVoiceModal?: () => void;
  initialReport?: Report | null;
}

export const ReportEditor: React.FC<ReportEditorProps> = ({
  date,
  onSaveSuccess,
  onCancel,
  onOpenVoiceModal,
  initialReport,
}) => {
  // Study stats & tasks (Facts)
  const [totalMin, setTotalMin] = useState(0);
  const [totalSec, setTotalSec] = useState(0);
  const [pomoEquivalent, setPomoEquivalent] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [tasks, setTasks] = useState<Task[]>([]);

  // Motivation & Self Score (0 - 100)
  const [selfScore, setSelfScore] = useState<number>(75);

  // Notion-style reflection inputs
  const [learnings, setLearnings] = useState('');
  const [challenges, setChallenges] = useState('');
  const [nextActions, setNextActions] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingFacts, setIsLoadingFacts] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Format date display (e.g. 2026年10月24日)
  const formattedDate = (() => {
    try {
      const parts = date.split('-');
      if (parts.length === 3) {
        return `${parts[0]}年${Number(parts[1])}月${Number(parts[2])}日`;
      }
    } catch {}
    return date;
  })();

  // Load latest facts (pomos & tasks) for this date
  const loadFacts = useCallback(async () => {
    setIsLoadingFacts(true);
    try {
      // 1. Fetch pomos for this date
      const pomos: PomoRecord[] = await api.listPomos(date);
      let secSum = 0;
      for (const p of pomos) {
        secSum += p.durationSec || 0;
      }
      const m = Math.floor(secSum / 60);
      const s = secSum % 60;
      const eq = secSum / 1500;

      setTotalMin(m);
      setTotalSec(s);
      setPomoEquivalent(eq);
      setSessionCount(pomos.length);

      // 2. Fetch tasks
      const allTasks: Task[] = await api.listTasks();
      const activeTasks = allTasks.filter(
        (t) =>
          t.status === 'COMPLETED' ||
          (t.actualFocusSec || 0) > 0 ||
          t.pomoCount > 0 ||
          t.completedAt?.startsWith(date) ||
          t.updatedAt?.startsWith(date)
      );
      setTasks(activeTasks);
    } catch (err) {
      console.error('Failed to load facts:', err);
    } finally {
      setIsLoadingFacts(false);
    }
  }, [date]);

  // Initial load
  useEffect(() => {
    const initialize = async () => {
      // If we have an initial report or existing report in API, parse its reflections
      let existingReport: Report | null = initialReport || null;
      if (!existingReport) {
        try {
          existingReport = await api.getReport(date);
        } catch {
          existingReport = null;
        }
      }

      if (existingReport) {
        if (existingReport.selfScore !== undefined && existingReport.selfScore !== null) {
          setSelfScore(existingReport.selfScore);
        } else if (existingReport.body) {
          const parsed = parseReportBody(existingReport.body);
          if (parsed.selfScore !== undefined) {
            setSelfScore(parsed.selfScore);
          }
        }

        if (existingReport.body) {
          const parsed = parseReportBody(existingReport.body);
          setLearnings(existingReport.learnings || parsed.learnings || '');
          setChallenges(existingReport.challenges || parsed.challenges || '');
          setNextActions(existingReport.nextActions || parsed.nextActions || '');
        }
      }

      // Load facts from activity
      await loadFacts();
    };

    initialize();
  }, [date, initialReport, loadFacts]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const body = buildReportMarkdown({
        totalMin,
        totalSec,
        pomoEquivalent,
        sessionCount,
        selfScore,
        tasks,
        learnings,
        challenges,
        nextActions,
      });

      const saved = await api.saveReport({
        publishedDate: date,
        body,
        learnings,
        challenges,
        nextActions,
        selfScore,
        source: 'manual',
      });

      setNotice('日報を保存しました！');
      onSaveSuccess(saved);
    } catch (err) {
      console.error('Failed to save report:', err);
      setNotice('保存に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={classes.editorContainer}>
      {/* Top Action Bar */}
      <div className={classes.topBar}>
        <div className={classes.titleArea}>
          <div className={classes.editBadge}>
            <CalendarIcon size={13} />
            <span>日報作成・編集</span>
          </div>
          <h1 className={classes.mainTitle}>
            <span>{formattedDate} の日報</span>
          </h1>
        </div>

        <div className={classes.actionButtons}>
          <button
            type="button"
            className={`${classes.btn} ${classes.btnRefresh}`}
            onClick={loadFacts}
            disabled={isLoadingFacts}
            title="タイマーの最新集中時間とタスクを再集計"
          >
            <RefreshCw size={15} className={isLoadingFacts ? classes.spin : ''} />
            <span>{isLoadingFacts ? '集計中...' : '実績を最新化'}</span>
          </button>

          {onOpenVoiceModal && (
            <button
              type="button"
              className={`${classes.btn} ${classes.btnVoice}`}
              onClick={onOpenVoiceModal}
              title="音声で話して日報を作成"
            >
              <Mic size={15} />
              <span>音声入力</span>
            </button>
          )}

          {onCancel && (
            <button
              type="button"
              className={`${classes.btn} ${classes.btnCancel}`}
              onClick={onCancel}
              title="変更を破棄して戻る"
            >
              <X size={15} />
              <span>キャンセル</span>
            </button>
          )}

          <button
            type="button"
            className={`${classes.btn} ${classes.btnSave}`}
            onClick={handleSave}
            disabled={isSaving}
          >
            <Save size={15} />
            <span>{isSaving ? '保存中...' : '日報を保存'}</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className={classes.noticeBanner}>
          <Check size={16} />
          <span>{notice}</span>
        </div>
      )}

      {/* Notion-Inspired Document Surface */}
      <div className={classes.documentCard}>
        {/* Section 1: Facts (Auto-Populated & Read-Only) */}
        <section className={classes.factsCard}>
          <div className={classes.factsHeader}>
            <div className={classes.factsTitle}>
              <Clock size={16} className={classes.factsIcon} />
              <span>本日の集中実績 (Facts)</span>
            </div>
            <div className={classes.autoBadge}>
              <CheckCircle2 size={13} />
              <span>タイマーから自動集計済み</span>
            </div>
          </div>

          <div className={classes.statsStrip}>
            <div className={classes.stripItem}>
              <Clock size={14} className={classes.itemIcon} />
              <span className={classes.itemLabel}>総集中時間:</span>
              <strong className={classes.itemValue}>
                {totalMin}分 ({pomoEquivalent.toFixed(1)} pomo)
              </strong>
            </div>

            <div className={classes.stripDivider} />

            <div className={classes.stripItem}>
              <img src={tomatoSvg} alt="tomato" className={classes.tomatoIcon} />
              <span className={classes.itemLabel}>消化セッション:</span>
              <strong className={classes.itemValue}>{sessionCount} 回</strong>
            </div>
          </div>

          <div className={classes.tasksWrapper}>
            <div className={classes.tasksSubheader}>
              <CheckCircle2 size={14} className={classes.checkIcon} />
              <span>完了・進行したタスク</span>
            </div>

            {tasks.length > 0 ? (
              <div className={classes.taskList}>
                {tasks.map((t) => {
                  const isDone = t.status === 'COMPLETED';
                  const focusMins = Math.floor((t.actualFocusSec || 0) / 60);
                  return (
                    <div key={t.id} className={classes.taskItem}>
                      <div className={classes.taskItemLeft}>
                        {isDone ? (
                          <CheckCircle2 size={15} className={classes.taskDoneIcon} />
                        ) : (
                          <Circle size={15} className={classes.taskTodoIcon} />
                        )}
                        <span className={`${classes.taskTitle} ${isDone ? classes.completedTitle : ''}`}>
                          {t.title}
                        </span>
                        {t.category && (
                          <span className={classes.categoryTag}>{t.category}</span>
                        )}
                      </div>
                      {focusMins > 0 && (
                        <div className={classes.taskTime}>
                          <Clock size={12} />
                          <span>{focusMins}分集中</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={classes.emptyTasks}>
                （記録されたタスク活動はありません）
              </div>
            )}
          </div>
        </section>

        {/* Section: Motivation & Self-Score Drag Bar */}
        <section className={classes.motivationSection}>
          <div className={classes.motivationHeader}>
            <div className={classes.motivationTitleGroup}>
              <TrendingUp size={18} className={classes.motivationIcon} />
              <label className={classes.sectionLabel} htmlFor="motivation-range">
                本日の達成度・やる気度
              </label>
            </div>
            <div className={classes.scoreBadge}>
              <span className={classes.scoreValue}>{selfScore}</span>
              <span className={classes.scoreUnit}>/ 100点</span>
              <span className={classes.scoreMood}>
                {selfScore >= 85
                  ? '🔥 絶好調'
                  : selfScore >= 70
                  ? '⚡ 充実・順調'
                  : selfScore >= 50
                  ? '🌱 普通・マイペース'
                  : selfScore >= 30
                  ? '☕ 疲れ気味'
                  : '💤 要休養'}
              </span>
            </div>
          </div>

          <div className={classes.sliderContainer}>
            <input
              id="motivation-range"
              type="range"
              min="0"
              max="100"
              step="1"
              value={selfScore}
              onChange={(e) => setSelfScore(Number(e.target.value))}
              className={classes.rangeInput}
              style={{
                background: `linear-gradient(to right, var(--color-primary) 0%, var(--color-primary) ${selfScore}%, var(--color-surface-muted) ${selfScore}%, var(--color-surface-muted) 100%)`,
              }}
            />
            <div className={classes.scaleLabels}>
              <span>0 (最低)</span>
              <span>25</span>
              <span>50 (普通)</span>
              <span>75</span>
              <span>100 (最高)</span>
            </div>
          </div>
        </section>

        {/* Section 2: Learnings Input (Notion style auto-grow) */}
        <section className={`${classes.inputSection} ${classes.learningsSection}`}>
          <div className={classes.sectionHeader}>
            <Lightbulb size={18} className={classes.iconLearnings} />
            <label className={classes.sectionLabel}>今日学んだこと・気づき</label>
          </div>
          <textarea
            className={classes.notionTextarea}
            placeholder="今日新しく知ったこと、ひらめき、良かった工夫など..."
            value={learnings}
            onChange={(e) => setLearnings(e.target.value)}
            rows={3}
          />
        </section>

        {/* Section 3: Challenges Input */}
        <section className={`${classes.inputSection} ${classes.challengesSection}`}>
          <div className={classes.sectionHeader}>
            <AlertTriangle size={18} className={classes.iconChallenges} />
            <label className={classes.sectionLabel}>課題・反省点</label>
          </div>
          <textarea
            className={classes.notionTextarea}
            placeholder="集中が途切れた理由、難しかった点、次回改善したいことなど..."
            value={challenges}
            onChange={(e) => setChallenges(e.target.value)}
            rows={3}
          />
        </section>

        {/* Section 4: Next Actions Input */}
        <section className={`${classes.inputSection} ${classes.actionsSection}`}>
          <div className={classes.sectionHeader}>
            <Rocket size={18} className={classes.iconActions} />
            <label className={classes.sectionLabel}>明日のアクション</label>
          </div>
          <textarea
            className={classes.notionTextarea}
            placeholder="明日最初に着手するタスク、試したい工夫など..."
            value={nextActions}
            onChange={(e) => setNextActions(e.target.value)}
            rows={3}
          />
        </section>
      </div>
    </div>
  );
};
