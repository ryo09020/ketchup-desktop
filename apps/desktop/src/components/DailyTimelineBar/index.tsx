import React, { useState, useMemo, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { Clock, CheckCircle2, Folder } from 'lucide-react';
import classes from './index.module.scss';
import tomatoSvg from '@/assets/tomato.svg';
import { api, PomoRecord, Task } from '@/api/client';
import { useTimer } from '@/providers/TimerProvider';
import { useTranslation } from '@/providers/LanguageProvider';

const UNIFIED_COLOR = {
  background: '#e05244',
  solid: '#e05244',
};

const HOUR_MARKS = [0, 3, 6, 9, 12, 15, 18, 21, 24];

export const DailyTimelineBar: React.FC = () => {
  const { phase, totalDuration, timeLeft, currentTask } = useTimer();
  const { t, language } = useTranslation();

  const { data: pomos } = useSWR<PomoRecord[]>('today-pomos', () => api.listPomos(), {
    refreshInterval: 5000,
  });

  const { data: tasks } = useSWR<Task[]>('tasks', () => api.listTasks(), {
    revalidateOnFocus: true,
  });

  // Current time tracker (minutes from midnight 0-1439)
  const [currentTimeMin, setCurrentTimeMin] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setCurrentTimeMin(d.getHours() * 60 + d.getMinutes());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // Filter today's pomos
  const todayPomos = useMemo(() => {
    if (!pomos) return [];
    const now = new Date();
    return pomos.filter((p) => {
      const s = new Date(p.startedAt);
      return (
        s.getFullYear() === now.getFullYear() &&
        s.getMonth() === now.getMonth() &&
        s.getDate() === now.getDate()
      );
    });
  }, [pomos]);

  // Aggregate stats
  const totalSec = useMemo(() => {
    return todayPomos.reduce((acc, p) => acc + (p.durationSec || 0), 0);
  }, [todayPomos]);
  const totalMinutes = Math.floor(totalSec / 60);
  const totalPomos = totalMinutes === 0 ? 0 : Math.ceil(totalMinutes / 25);

  // Tooltip tracking
  const [hoveredSession, setHoveredSession] = useState<{
    pomo: PomoRecord;
    x: number;
    y: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Active focus calculation
  const isFocusing = phase === 'FOCUS';
  const liveElapsedSec = Math.max(0, totalDuration - timeLeft);
  const liveMins = Math.floor(liveElapsedSec / 60);
  const liveStartMin = Math.max(0, currentTimeMin - liveMins);
  const liveLeftPct = Math.min(100, Math.max(0, (liveStartMin / 1440) * 100));
  const liveWidthPct = Math.max(0.8, Math.min(100 - liveLeftPct, (Math.max(1, liveMins) / 1440) * 100));

  // Current time needle position %
  const currentNeedlePct = Math.min(100, Math.max(0, (currentTimeMin / 1440) * 100));

  return (
    <div className={classes.timelineCard} ref={containerRef}>
      {/* Header with 24h summary */}
      <div className={classes.header}>
        <div className={classes.titleGroup}>
          <Clock className={classes.icon} size={16} />
          <span className={classes.title}>
            {language === 'ja' ? '本日の24時間 勉強タイムライン' : "Today's 24-Hour Timeline"}
          </span>
        </div>
        <div className={classes.summaryBadge}>
          <span>{language === 'ja' ? '今日: ' : 'Today: '}</span>
          <strong className={classes.minutes}>{totalMinutes}{t('timer.min')}</strong>
          <span className={classes.pomoCount}>({totalPomos} pomo)</span>
          {todayPomos.length > 0 && (
            <span className={classes.sessionCount}> / {todayPomos.length} {t('reports.times')}</span>
          )}
        </div>
      </div>

      {/* 24-Hour Horizontal Bar Track */}
      <div className={classes.trackWrapper}>
        <div className={classes.track}>
          {/* Subtle hour division lines */}
          {Array.from({ length: 24 }).map((_, h) => (
            <div
              key={h}
              className={`${classes.hourGridLine} ${h % 6 === 0 ? classes.major : ''}`}
              style={{ left: `${(h / 24) * 100}%` }}
            />
          ))}

          {/* Recorded Pomo Sessions */}
          {todayPomos.map((p, idx) => {
            const startDate = new Date(p.startedAt);
            const startMins = startDate.getHours() * 60 + startDate.getMinutes() + startDate.getSeconds() / 60;
            const durMins = Math.max(1, p.durationSec / 60);
            const leftPct = Math.min(100, Math.max(0, (startMins / 1440) * 100));
            const widthPct = Math.max(0.9, Math.min(100 - leftPct, (durMins / 1440) * 100));

            const task = tasks?.find((t) => t.id === p.taskId);

            return (
              <div
                key={p.id || idx}
                className={classes.pomoBlock}
                style={{
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  backgroundColor: UNIFIED_COLOR.solid,
                }}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHoveredSession({
                    pomo: p,
                    x: rect.left + rect.width / 2,
                    y: rect.top,
                  });
                }}
                onMouseLeave={() => setHoveredSession(null)}
              />
            );
          })}

          {/* Real-time active focus block (pulsing) */}
          {isFocusing && (
            <div
              className={classes.liveBlock}
              style={{
                left: `${liveLeftPct}%`,
                width: `${liveWidthPct}%`,
              }}
              title="現在集中中..."
            />
          )}

          {/* Current Time Needle ("NOW") */}
          <div
            className={classes.currentNeedle}
            style={{ left: `${currentNeedlePct}%` }}
            title={`現在時刻: ${Math.floor(currentTimeMin / 60).toString().padStart(2, '0')}:${(currentTimeMin % 60).toString().padStart(2, '0')}`}
          >
            <div className={classes.needleDot} />
            <div className={classes.needleLine} />
          </div>
        </div>

        {/* Hour Axis Scale */}
        <div className={classes.axisScale}>
          {HOUR_MARKS.map((h) => (
            <div
              key={h}
              className={classes.axisTick}
              style={{ left: `${(h / 24) * 100}%` }}
            >
              <div className={classes.tickMark} />
              <span className={classes.tickLabel}>{h}:00</span>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className={classes.legendRow}>
        <div className={classes.legendItem}>
          <span className={classes.colorDot} style={{ background: UNIFIED_COLOR.solid }} />
          <span>{language === 'ja' ? '集中した時間帯' : 'Focus Sessions'}</span>
        </div>
        <div className={classes.legendItem}>
          <span className={classes.needleSample} />
          <span>{language === 'ja' ? '現在時刻 (NOW)' : 'Now (Current Time)'}</span>
        </div>
        {isFocusing && (
          <div className={`${classes.legendItem} ${classes.liveLegend}`}>
            <span className={classes.pulseDot} />
            <span>{language === 'ja' ? `リアルタイム集中中 (${liveMins}分)` : `Focusing Live (${liveMins}m)`}</span>
          </div>
        )}
      </div>

      {/* Floating Hover Tooltip */}
      {hoveredSession && (() => {
        const p = hoveredSession.pomo;
        const s = new Date(p.startedAt);
        const e = p.endedAt ? new Date(p.endedAt) : new Date(s.getTime() + p.durationSec * 1000);
        const mins = Math.floor(p.durationSec / 60);
        const pomos = mins === 0 ? 0 : Math.ceil(mins / 25);
        const task = tasks?.find((t) => t.id === p.taskId);

        const formatTime = (d: Date) =>
          `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;

        return (
          <div
            className={classes.tooltip}
            style={{
              left: hoveredSession.x,
              top: hoveredSession.y - 12,
            }}
          >
            <div className={classes.tooltipHeader}>
              <span className={classes.timeRange}>
                <Clock size={12} /> {formatTime(s)} 〜 {formatTime(e)}
              </span>
              <span className={classes.pomoBadge}>
                <img src={tomatoSvg} alt="pomo" style={{ width: 12, height: 12, imageRendering: 'pixelated' }} />
                <span>{pomos} pomo</span>
              </span>
            </div>
            <div className={classes.tooltipBody}>
              <div className={classes.taskTitle}>
                <CheckCircle2 size={13} style={{ color: '#10b981', flexShrink: 0 }} />
                <span>{task ? task.title : p.taskTitle || '一般集中'}</span>
              </div>
              <div className={classes.metaRow}>
                <span className={classes.duration}>
                  <Clock size={11} /> 実時間: <strong>{mins}分</strong>
                </span>
                {task?.category && (
                  <span className={classes.catBadge}>
                    <Folder size={11} /> {task.category}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
