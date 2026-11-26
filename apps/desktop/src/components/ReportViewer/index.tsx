import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  Lightbulb,
  AlertTriangle,
  Rocket,
  PenLine,
  Download,
  Sparkles,
  Check,
  FileText,
  FolderOpen,
  AlertCircle,
  RefreshCw,
  X,
  Settings,
  TrendingUp,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import classes from './index.module.scss';
import tomatoSvg from '@/assets/tomato.svg';
import { api, Report, Task, PomoRecord } from '@/api/client';
import { parseReportBody, buildReportMarkdown } from './reportParser';
import { useTranslation } from '@/providers/LanguageProvider';

interface ReportViewerProps {
  report: Report;
  date: string;
  onEdit: () => void;
  onOpenAIModal?: () => void;
}

export const ReportViewer: React.FC<ReportViewerProps> = ({
  report,
  date,
  onEdit,
  onOpenAIModal,
}) => {
  const { t, language } = useTranslation();
  const [isObsidianSaving, setIsObsidianSaving] = useState(false);
  const [isObsidianSaved, setIsObsidianSaved] = useState(false);
  const [obsidianNotice, setObsidianNotice] = useState<{
    type: 'success' | 'error';
    message: string;
    fullPath?: string;
  } | null>(null);

  // Parse structured data from report body
  const parsed = parseReportBody(report.body || '');
  const displayScore =
    report.selfScore !== undefined && report.selfScore !== null
      ? report.selfScore
      : parsed.selfScore;

  // Load actual pomo activity for this date (by pomo startedAt) so both saved & new reports strictly show this date's tasks
  const [dailyFacts, setDailyFacts] = useState<{
    totalMin: number;
    totalSec: number;
    pomoEquivalent: number;
    sessionCount: number;
    tasks: Task[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rawPomos, allTasks]: [PomoRecord[], Task[]] = await Promise.all([
          api.listPomos(date),
          api.listTasks(),
        ]);
        if (cancelled) return;

        const pomos = rawPomos.filter((p) => {
          if (!p.startedAt) return false;
          const d = new Date(p.startedAt);
          if (isNaN(d.getTime())) return p.startedAt.startsWith(date);
          const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          return localDate === date;
        });

        let secSum = 0;
        const secByTaskId = new Map<string, number>();
        for (const p of pomos) {
          secSum += p.durationSec || 0;
          if (p.taskId && (p.durationSec || 0) > 0) {
            secByTaskId.set(p.taskId, (secByTaskId.get(p.taskId) || 0) + (p.durationSec || 0));
          }
        }

        const matchedTasks = allTasks
          .filter((task) => secByTaskId.has(task.id))
          .map((task) => ({
            ...task,
            actualFocusSec: secByTaskId.get(task.id) || 0,
          }));

        setDailyFacts({
          totalMin: Math.floor(secSum / 60),
          totalSec: secSum % 60,
          pomoEquivalent: secSum / 1500,
          sessionCount: pomos.length,
          tasks: matchedTasks,
        });
      } catch (err) {
        console.error('Failed to load daily pomo facts:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [date]);

  const exportMarkdownContent = dailyFacts
    ? buildReportMarkdown({
        totalMin: dailyFacts.totalMin,
        totalSec: dailyFacts.totalSec,
        pomoEquivalent: dailyFacts.pomoEquivalent,
        sessionCount: dailyFacts.sessionCount,
        selfScore: displayScore,
        tasks: dailyFacts.tasks,
        learnings: report.learnings || parsed.learnings || '',
        challenges: report.challenges || parsed.challenges || '',
        nextActions: report.nextActions || parsed.nextActions || '',
      })
    : report.body || '';

  // Format date display (e.g. 2026年10月24日 or Oct 24, 2026)
  const formattedDate = (() => {
    try {
      const parts = date.split('-');
      if (parts.length === 3) {
        if (language === 'en') {
          const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        }
        return `${parts[0]}年${Number(parts[1])}月${Number(parts[2])}日`;
      }
    } catch {}
    return date;
  })();

  const handleChangeVaultPath = async () => {
    try {
      const selected = await invoke<string | null>('select_obsidian_folder');
      if (selected) {
        localStorage.setItem('ketchup_obsidian_vault_path', selected);
        setObsidianNotice({
          type: 'success',
          message: t('reports.obsidianPathChanged', { path: selected }),
        });
        setTimeout(() => setObsidianNotice(null), 4000);
      }
    } catch (err) {
      console.error('Failed to change vault path:', err);
    }
  };

  const handleExportToObsidian = async () => {
    let vaultPath = localStorage.getItem('ketchup_obsidian_vault_path');
    if (!vaultPath || vaultPath === '~/Documents/Obsidian/Daily') {
      vaultPath = '~/Documents/Obsidian Vault';
      localStorage.setItem('ketchup_obsidian_vault_path', vaultPath);
    }

    const filename = `${date}.md`;
    setIsObsidianSaving(true);
    setObsidianNotice(null);

    try {
      const fullPath = await invoke<string>('save_to_obsidian', {
        vaultPath,
        filename,
        content: exportMarkdownContent,
      });

      setIsObsidianSaved(true);
      setObsidianNotice({
        type: 'success',
        message: t('reports.obsidianSavedSuccess'),
        fullPath,
      });

      setTimeout(() => {
        setIsObsidianSaved(false);
      }, 4000);
    } catch (err: any) {
      console.error('Failed to export to Obsidian:', err);
      const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
      if (!isTauri) {
        // Fallback for web browser testing
        const blob = new Blob([exportMarkdownContent], { type: 'text/markdown;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);

        setIsObsidianSaved(true);
        setObsidianNotice({
          type: 'success',
          message: t('reports.obsidianDownloaded'),
        });
        setTimeout(() => setIsObsidianSaved(false), 4000);
      } else {
        setObsidianNotice({
          type: 'error',
          message: typeof err === 'string' ? err : err?.message || t('reports.obsidianSaveFailed'),
        });
      }
    } finally {
      setIsObsidianSaving(false);
    }
  };

  const handleOpenInFinder = async (path: string) => {
    try {
      await invoke('reveal_in_finder', { path });
    } catch (err) {
      console.error('Failed to reveal file in Finder:', err);
    }
  };

  const renderBulletList = (text: string) => {
    if (!text || !text.trim()) {
      return <div className={classes.emptyText}>{t('reports.emptyReflection')}</div>;
    }
    const lines = text.split('\n').filter((l) => l.trim().length > 0);
    return (
      <ul className={classes.bulletList}>
        {lines.map((line, idx) => {
          const clean = line.replace(/^[-*・]\s*/, '').trim();
          return <li key={idx}>{clean}</li>;
        })}
      </ul>
    );
  };

  return (
    <div className={classes.container}>
      {/* Top Action Bar */}
      <div className={classes.topBar}>
        <div className={classes.titleArea}>
          <div className={classes.pageBadge}>
            <FileText size={13} />
            <span>{t('reports.publishedReport')}</span>
          </div>
          <h1 className={classes.mainTitle}>
            <CalendarIcon size={20} className={classes.titleIcon} />
            <span>
              {t('reports.reportDateTitle', { date: formattedDate })}
            </span>
          </h1>
        </div>

        <div className={classes.actionButtons}>
          {onOpenAIModal && (
            <button
              id="tour-report-ai-btn"
              type="button"
              className={`${classes.btn} ${classes.btnAi}`}
              onClick={onOpenAIModal}
              title={t('reports.aiSummary')}
            >
              <Sparkles size={15} />
              <span>{t('reports.aiSummary')}</span>
            </button>
          )}

          <button
            id="tour-report-obsidian-btn"
            type="button"
            className={`${classes.btn} ${isObsidianSaved ? classes.btnObsidianSuccess : classes.btnObsidian}`}
            onClick={handleExportToObsidian}
            disabled={isObsidianSaving}
            title={t('reports.saveToObsidian')}
          >
            {isObsidianSaving ? (
              <>
                <RefreshCw size={15} className={classes.spin} />
                <span>{t('reports.savingToObsidian')}</span>
              </>
            ) : isObsidianSaved ? (
              <>
                <Check size={15} />
                <span>{t('reports.savedToObsidian')}</span>
              </>
            ) : (
              <>
                <Download size={15} />
                <span>{t('reports.saveToObsidian')}</span>
              </>
            )}
          </button>

          <button
            type="button"
            className={`${classes.btn} ${classes.btnEdit}`}
            onClick={onEdit}
            title={t('reports.editReport')}
          >
            <PenLine size={15} />
            <span>{t('reports.editReport')}</span>
          </button>
        </div>
      </div>

      {obsidianNotice && (
        <div
          className={`${classes.statusBanner} ${
            obsidianNotice.type === 'success' ? classes.bannerSuccess : classes.bannerError
          }`}
        >
          <div className={classes.bannerLeft}>
            {obsidianNotice.type === 'success' ? (
              <CheckCircle2 size={18} className={classes.bannerSuccessIcon} />
            ) : (
              <AlertCircle size={18} className={classes.bannerErrorIcon} />
            )}
            <div className={classes.bannerBody}>
              <div className={classes.bannerHeading}>{obsidianNotice.message}</div>
              {obsidianNotice.fullPath && (
                <div className={classes.bannerPath}>{obsidianNotice.fullPath}</div>
              )}
            </div>
          </div>

          <div className={classes.bannerRight}>
            {obsidianNotice.fullPath && (
              <button
                type="button"
                className={classes.finderBtn}
                onClick={() => handleOpenInFinder(obsidianNotice.fullPath!)}
                title={t('reports.openInFinderTitle')}
              >
                <FolderOpen size={14} />
                <span>{t('reports.openInFinder')}</span>
              </button>
            )}
            <button
              type="button"
              className={classes.changePathBtn}
              onClick={handleChangeVaultPath}
              title={t('reports.changeVaultPathTitle')}
            >
              <Settings size={13} />
              <span>{t('reports.changeVaultPath')}</span>
            </button>
            <button
              type="button"
              className={classes.closeBannerBtn}
              onClick={() => setObsidianNotice(null)}
              title={t('reports.closeBanner')}
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Document Body (Notion Style) */}
      <div className={classes.documentCard}>
        {/* Section 1: Facts */}
        <section className={classes.sectionFacts}>
          <div className={classes.sectionHeader}>
            <h2 className={classes.sectionTitle}>
              <Clock size={18} className={classes.factsIcon} />
              <span>{t('reports.factsTitle')}</span>
            </h2>
          </div>

          <div className={classes.statsStrip}>
            <div className={classes.stripItem}>
              <Clock size={14} className={classes.itemIcon} />
              <span className={classes.itemLabel}>{t('reports.statsStripFocus')}:</span>
              <strong className={classes.itemValue}>
                {dailyFacts
                  ? `${dailyFacts.totalMin}${t('timer.min')} (${dailyFacts.pomoEquivalent.toFixed(1)} pomo)`
                  : parsed.totalTimeStr}
              </strong>
            </div>

            <div className={classes.stripDivider} />

            <div className={classes.stripItem}>
              <img src={tomatoSvg} alt="tomato" className={classes.tomatoIcon} />
              <span className={classes.itemLabel}>{t('reports.statsStripSessions')}:</span>
              <strong className={classes.itemValue}>
                {dailyFacts ? `${dailyFacts.sessionCount} ${t('reports.times')}` : parsed.sessionCountStr}
              </strong>
            </div>

            <div className={classes.stripDivider} />

            <div className={classes.stripItem}>
              <TrendingUp size={14} className={classes.itemIcon} />
              <span className={classes.itemLabel}>{t('reports.statsStripScore')}:</span>
              {displayScore !== undefined && displayScore !== null ? (
                <span className={classes.scoreInline}>
                  <strong className={classes.itemValuePrimary}>{displayScore} {t('reports.points')}</strong>
                  <span className={classes.scoreMoodPill}>
                    {displayScore >= 85
                      ? `🔥 ${t('reports.moodPeak')}`
                      : displayScore >= 70
                      ? `⚡ ${t('reports.moodGood')}`
                      : displayScore >= 50
                      ? `🌱 ${t('reports.moodNormal')}`
                      : displayScore >= 30
                      ? `☕ ${t('reports.moodTired')}`
                      : `💤 ${t('reports.moodExhausted')}`}
                  </span>
                </span>
              ) : (
                <span className={classes.itemValueMuted}>{t('reports.notRecorded')}</span>
              )}
            </div>
          </div>

          <div className={classes.tasksWrapper}>
            <div className={classes.tasksSubheader}>
              <CheckCircle2 size={15} className={classes.checkIcon} />
              <span>{t('reports.tasksCompletedAndActive')}</span>
            </div>

            {(dailyFacts ? dailyFacts.tasks.length > 0 : !parsed.noTasks && parsed.tasks.length > 0) ? (
              <div className={classes.taskList}>
                {(dailyFacts
                  ? dailyFacts.tasks.map((task) => ({
                      title: task.title,
                      minutes: Math.floor((task.actualFocusSec || 0) / 60),
                    }))
                  : parsed.tasks
                ).map((task, idx) => (
                  <div key={idx} className={classes.taskItem}>
                    <div className={classes.taskItemLeft}>
                      <span className={classes.taskTitle}>
                        {task.title}
                      </span>
                    </div>
                    {task.minutes !== undefined && task.minutes > 0 && (
                      <div className={classes.taskTime}>
                        <Clock size={12} />
                        <span>{t('reports.minutesFocused', { minutes: task.minutes })}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className={classes.emptyTasks}>
                {t('reports.emptyTasksRecorded')}
              </div>
            )}
          </div>
        </section>

        {/* Section 2: Learnings */}
        <section className={`${classes.reflectionSection} ${classes.learningsSection}`}>
          <div className={classes.sectionHeader}>
            <h2 className={classes.sectionTitle}>
              <Lightbulb size={18} className={classes.iconLearnings} />
              <span>{t('reports.learningsLabel')}</span>
            </h2>
          </div>
          <div className={classes.reflectionContent}>
            {renderBulletList(parsed.learnings)}
          </div>
        </section>

        {/* Section 3: Challenges */}
        <section className={`${classes.reflectionSection} ${classes.challengesSection}`}>
          <div className={classes.sectionHeader}>
            <h2 className={classes.sectionTitle}>
              <AlertTriangle size={18} className={classes.iconChallenges} />
              <span>{t('reports.challengesLabel')}</span>
            </h2>
          </div>
          <div className={classes.reflectionContent}>
            {renderBulletList(parsed.challenges)}
          </div>
        </section>

        {/* Section 4: Next Actions */}
        <section className={`${classes.reflectionSection} ${classes.actionsSection}`}>
          <div className={classes.sectionHeader}>
            <h2 className={classes.sectionTitle}>
              <Rocket size={18} className={classes.iconActions} />
              <span>{t('reports.nextActionsLabel')}</span>
            </h2>
          </div>
          <div className={classes.reflectionContent}>
            {renderBulletList(parsed.nextActions)}
          </div>
        </section>
      </div>
    </div>
  );
};
