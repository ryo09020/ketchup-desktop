import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  Timer,
  CheckCircle2,
  Circle,
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
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import classes from './index.module.scss';
import tomatoSvg from '@/assets/tomato.svg';
import { Report } from '@/api/client';
import { parseReportBody } from './reportParser';

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
  const [isObsidianSaving, setIsObsidianSaving] = useState(false);
  const [isObsidianSaved, setIsObsidianSaved] = useState(false);
  const [obsidianNotice, setObsidianNotice] = useState<{
    type: 'success' | 'error';
    message: string;
    fullPath?: string;
  } | null>(null);

  // Parse structured data from report body
  const parsed = parseReportBody(report.body || '');

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

  const handleChangeVaultPath = async () => {
    try {
      const selected = await invoke<string | null>('select_obsidian_folder');
      if (selected) {
        localStorage.setItem('ketchup_obsidian_vault_path', selected);
        setObsidianNotice({
          type: 'success',
          message: `Obsidian Vault 保存先を変更しました: ${selected}`,
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
        content: report.body || '',
      });

      setIsObsidianSaved(true);
      setObsidianNotice({
        type: 'success',
        message: 'Obsidian Vault (daily_report) への保存が完了しました！',
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
        const blob = new Blob([report.body || ''], { type: 'text/markdown;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);

        setIsObsidianSaved(true);
        setObsidianNotice({
          type: 'success',
          message: 'Markdownファイルをダウンロード保存しました（ブラウザ環境）',
        });
        setTimeout(() => setIsObsidianSaved(false), 4000);
      } else {
        setObsidianNotice({
          type: 'error',
          message: typeof err === 'string' ? err : err?.message || 'Obsidian Vault への書き込みに失敗しました。パスをご確認ください。',
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
      return <div className={classes.emptyText}>（記録なし）</div>;
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
            <span>発行済み日報</span>
          </div>
          <h1 className={classes.mainTitle}>
            <CalendarIcon size={20} className={classes.titleIcon} />
            <span>{formattedDate} の日報</span>
          </h1>
        </div>

        <div className={classes.actionButtons}>
          {onOpenAIModal && (
            <button
              type="button"
              className={`${classes.btn} ${classes.btnAi}`}
              onClick={onOpenAIModal}
              title="AIによる振り返りまとめ"
            >
              <Sparkles size={15} />
              <span>AIまとめ</span>
            </button>
          )}

          <button
            type="button"
            className={`${classes.btn} ${isObsidianSaved ? classes.btnObsidianSuccess : classes.btnObsidian}`}
            onClick={handleExportToObsidian}
            disabled={isObsidianSaving}
            title="Obsidian Vault に出力"
          >
            {isObsidianSaving ? (
              <>
                <RefreshCw size={15} className={classes.spin} />
                <span>保存中...</span>
              </>
            ) : isObsidianSaved ? (
              <>
                <Check size={15} />
                <span>保存完了！</span>
              </>
            ) : (
              <>
                <Download size={15} />
                <span>Obsidian保存</span>
              </>
            )}
          </button>

          <button
            type="button"
            className={`${classes.btn} ${classes.btnEdit}`}
            onClick={onEdit}
            title="日報を再編集する"
          >
            <PenLine size={15} />
            <span>再編集する</span>
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
                title="Finder でこのファイルを表示する"
              >
                <FolderOpen size={14} />
                <span>Finder で確認</span>
              </button>
            )}
            <button
              type="button"
              className={classes.changePathBtn}
              onClick={handleChangeVaultPath}
              title="Obsidian Vault フォルダを選択・変更する"
            >
              <Settings size={13} />
              <span>保存先を変更</span>
            </button>
            <button
              type="button"
              className={classes.closeBannerBtn}
              onClick={() => setObsidianNotice(null)}
              title="閉じる"
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
              <span>本日の集中実績 (Facts)</span>
            </h2>
          </div>

          <div className={classes.statsRow}>
            <div className={classes.statCard}>
              <div className={classes.statLabel}>
                <Clock size={14} />
                <span>総集中時間</span>
              </div>
              <div className={classes.statValue}>{parsed.totalTimeStr}</div>
            </div>

            <div className={classes.statCard}>
              <div className={classes.statLabel}>
                <img src={tomatoSvg} alt="tomato" className={classes.tomatoIcon} />
                <span>消化セッション</span>
              </div>
              <div className={classes.statValue}>{parsed.sessionCountStr}</div>
            </div>
          </div>

          <div className={classes.tasksWrapper}>
            <div className={classes.tasksSubheader}>
              <CheckCircle2 size={15} className={classes.checkIcon} />
              <span>完了・進行したタスク</span>
            </div>

            {!parsed.noTasks && parsed.tasks.length > 0 ? (
              <div className={classes.taskList}>
                {parsed.tasks.map((t, idx) => {
                  const isCompleted = t.status === 'COMPLETED';
                  return (
                    <div key={idx} className={classes.taskItem}>
                      <div className={classes.taskItemLeft}>
                        {isCompleted ? (
                          <CheckCircle2 size={15} className={classes.taskDoneIcon} />
                        ) : (
                          <Circle size={15} className={classes.taskTodoIcon} />
                        )}
                        <span className={`${classes.taskTitle} ${isCompleted ? classes.completedTitle : ''}`}>
                          {t.title}
                        </span>
                        {t.category && (
                          <span className={classes.categoryTag}>{t.category}</span>
                        )}
                      </div>
                      {t.minutes !== undefined && (
                        <div className={classes.taskTime}>
                          <Clock size={12} />
                          <span>{t.minutes}分集中</span>
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

        {/* Section 2: Learnings */}
        <section className={`${classes.reflectionSection} ${classes.learningsSection}`}>
          <div className={classes.sectionHeader}>
            <h2 className={classes.sectionTitle}>
              <Lightbulb size={18} className={classes.iconLearnings} />
              <span>今日学んだこと・気づき</span>
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
              <span>課題・反省点</span>
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
              <span>明日のアクション</span>
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
