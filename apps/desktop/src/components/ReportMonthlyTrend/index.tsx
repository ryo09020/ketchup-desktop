import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Clock,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import classes from './index.module.scss';
import { Report, PomoRecord } from '@/api/client';
import { parseReportBody } from '@/components/ReportViewer/reportParser';

interface ReportMonthlyTrendProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  reports: Report[];
  pomos: PomoRecord[];
  todayStr: string;
}

export const ReportMonthlyTrend: React.FC<ReportMonthlyTrendProps> = ({
  selectedDate,
  onSelectDate,
  reports = [],
  pomos = [],
  todayStr,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  // Determine year and month from selectedDate
  const { year, month } = useMemo(() => {
    try {
      const parts = selectedDate.split('-');
      if (parts.length >= 2) {
        return { year: Number(parts[0]), month: Number(parts[1]) };
      }
    } catch {}
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }, [selectedDate]);

  // Total days in this month
  const daysInMonth = useMemo(() => {
    return new Date(year, month, 0).getDate();
  }, [year, month]);

  // Aggregate pomos and motivation scores for each day of the month
  const monthlyData = useMemo(() => {
    // 1. Group pomos by date
    const pomosByDate = new Map<string, number>();
    for (const p of pomos) {
      if (p.startedAt) {
        const dStr = p.startedAt.slice(0, 10);
        const currentSec = pomosByDate.get(dStr) || 0;
        pomosByDate.set(dStr, currentSec + (p.durationSec || 0));
      }
    }

    // 2. Group reports by date
    const reportsByDate = new Map<string, Report>();
    for (const r of reports) {
      if (r.publishedDate) {
        reportsByDate.set(r.publishedDate, r);
      }
    }

    const data: Array<{
      day: number;
      dateStr: string;
      isToday: boolean;
      isSelected: boolean;
      totalSec: number;
      totalMins: number;
      pomoCount: number;
      cappedPomo: number;
      isCapped: boolean;
      selfScore?: number;
    }> = [];

    let totalMonthPomos = 0;
    let totalScoreSum = 0;
    let scoredDaysCount = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const monthStr = String(month).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
      const dateStr = `${year}-${monthStr}-${dayStr}`;

      const sec = pomosByDate.get(dateStr) || 0;
      const mins = Math.floor(sec / 60);
      // 1 pomo = 25 minutes
      const rawPomos = sec > 0 ? (mins === 0 ? 0 : Math.ceil(mins / 25)) : 0;
      const cappedPomo = Math.min(25, rawPomos);
      const isCapped = rawPomos > 25;

      const report = reportsByDate.get(dateStr);
      let selfScore: number | undefined = undefined;
      if (report) {
        if (report.selfScore !== undefined && report.selfScore !== null) {
          selfScore = report.selfScore;
        } else if (report.body) {
          selfScore = parseReportBody(report.body).selfScore;
        }
      }

      totalMonthPomos += rawPomos;
      if (selfScore !== undefined) {
        totalScoreSum += selfScore;
        scoredDaysCount++;
      }

      data.push({
        day: d,
        dateStr,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
        totalSec: sec,
        totalMins: mins,
        pomoCount: rawPomos,
        cappedPomo,
        isCapped,
        selfScore,
      });
    }

    const avgScore =
      scoredDaysCount > 0 ? Math.round(totalScoreSum / scoredDaysCount) : null;

    return {
      days: data,
      totalMonthPomos,
      avgScore,
      scoredDaysCount,
    };
  }, [year, month, daysInMonth, pomos, reports, todayStr, selectedDate]);

  // SVG Coordinates & Layout
  const svgWidth = 800;
  const svgHeight = 230;
  const padLeft = 45;
  const padRight = 45;
  const padTop = 26;
  const padBottom = 34;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  const getX = (day: number) => {
    return padLeft + ((day - 0.5) / daysInMonth) * plotWidth;
  };

  const getYFromPomo = (pomo: number) => {
    const clamped = Math.min(25, Math.max(0, pomo));
    return padTop + plotHeight - (clamped / 25) * plotHeight;
  };

  const getYFromScore = (score: number) => {
    const clamped = Math.min(100, Math.max(0, score));
    return padTop + plotHeight - (clamped / 100) * plotHeight;
  };

  // Build Motivation Curve Spline (Catmull-Rom -> Cubic Bezier)
  const { curvePath, curveAreaPath, scorePoints } = useMemo(() => {
    const points: Array<{ x: number; y: number; day: number; score: number }> = [];

    for (const d of monthlyData.days) {
      if (d.selfScore !== undefined && d.selfScore !== null) {
        points.push({
          x: getX(d.day),
          y: getYFromScore(d.selfScore),
          day: d.day,
          score: d.selfScore,
        });
      }
    }

    if (points.length === 0) {
      return { curvePath: '', curveAreaPath: '', scorePoints: [] };
    }

    if (points.length === 1) {
      return { curvePath: '', curveAreaPath: '', scorePoints: points };
    }

    // Build Catmull-Rom cubic bezier string
    let dStr = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = i === 0 ? points[0] : points[i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = i + 2 < points.length ? points[i + 2] : p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      dStr += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }

    // Area fill path down to base line
    const baseY = padTop + plotHeight;
    const areaStr = `${dStr} L ${points[points.length - 1].x.toFixed(1)},${baseY} L ${points[0].x.toFixed(1)},${baseY} Z`;

    return {
      curvePath: dStr,
      curveAreaPath: areaStr,
      scorePoints: points,
    };
  }, [monthlyData.days, daysInMonth, padLeft, padTop, plotHeight, plotWidth]);

  // Selected or hovered day info for tooltip
  const activeTooltipDay = hoveredDay
    ? monthlyData.days.find((d) => d.day === hoveredDay)
    : null;

  return (
    <div className={classes.trendCard}>
      {/* Header with Title, Stats Summary, and Legend */}
      <div className={classes.trendHeader}>
        <div className={classes.headerLeft}>
          <h2 className={classes.trendTitle}>
            <TrendingUp size={18} className={classes.trendIcon} />
            <span>{year}年{month}月のやる気 ＆ 勉強推移</span>
          </h2>

          <div className={classes.summaryPills}>
            <span className={classes.pill}>
              総ポモ数: <strong>{monthlyData.totalMonthPomos} pomo</strong>
            </span>
            {monthlyData.avgScore !== null && (
              <span className={`${classes.pill} ${classes.scorePill}`}>
                平均やる気度: <strong>{monthlyData.avgScore}点</strong>
              </span>
            )}
            <span className={classes.pill}>
              日報記録: <strong>{monthlyData.scoredDaysCount}日分</strong>
            </span>
          </div>
        </div>

        <div className={classes.headerRight}>
          <div className={classes.legend}>
            <div className={classes.legendItem} title="左メモリ: 1日のポモ数 (上限25)">
              <span className={classes.barSample} />
              <span>勉強量 (左軸・最大25pomo)</span>
            </div>
            <div className={classes.legendItem} title="右メモリ: 日報のやる気度 (0〜100点)">
              <span className={classes.curveSample} />
              <span>やる気度 (右軸・100点)</span>
            </div>
          </div>

          <button
            type="button"
            className={classes.collapseBtn}
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'グラフを展開' : 'グラフを最小化'}
          >
            {isCollapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className={classes.chartContainer}>
          {activeTooltipDay && (
            <div className={classes.tooltip}>
              <span className={classes.tooltipDate}>
                {month}月{activeTooltipDay.day}日
                {activeTooltipDay.isToday && ' (今日)'}
              </span>
              <span className={classes.tooltipPomo}>
                勉強: <strong>{activeTooltipDay.pomoCount} pomo</strong> ({activeTooltipDay.totalMins}分)
                {activeTooltipDay.isCapped && ' [25pomo上限カンスト]'}
              </span>
              <span className={classes.tooltipScore}>
                やる気度: {activeTooltipDay.selfScore !== undefined ? `${activeTooltipDay.selfScore}点` : '未記録'}
              </span>
            </div>
          )}

          <svg
            className={classes.chartSvg}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="motivationAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.22" />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Gridlines & Axis Labels (Left: 0..25 pomo, Right: 0..100 pts) */}
            {[
              { pomo: 25, score: 100 },
              { pomo: 20, score: 75 },
              { pomo: 15, score: 50 },
              { pomo: 10, score: 25 },
              { pomo: 5, score: 12 },
              { pomo: 0, score: 0 },
            ].map(({ pomo, score }) => {
              const y = getYFromPomo(pomo);
              const isBase = pomo === 0;
              return (
                <g key={`grid-${pomo}`}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={svgWidth - padRight}
                    y2={y}
                    className={isBase ? classes.baseLine : classes.gridLine}
                  />
                  {/* Left Label (Pomo) */}
                  <text
                    x={padLeft - 8}
                    y={y + 3.5}
                    className={`${classes.axisText} ${classes.leftAxis}`}
                  >
                    {pomo}
                  </text>
                  {/* Right Label (Score) */}
                  <text
                    x={svgWidth - padRight + 8}
                    y={y + 3.5}
                    className={`${classes.axisText} ${classes.rightAxis}`}
                  >
                    {score}点
                  </text>
                </g>
              );
            })}

            {/* Axis Titles */}
            <text
              x={padLeft - 6}
              y={padTop - 12}
              className={`${classes.axisText} ${classes.leftAxis} ${classes.axisTitle}`}
            >
              pomo数
            </text>
            <text
              x={svgWidth - padRight + 6}
              y={padTop - 12}
              className={`${classes.axisText} ${classes.rightAxis} ${classes.axisTitle}`}
            >
              やる気度
            </text>

            {/* Motivation Curve Area Fill */}
            {curveAreaPath && (
              <path d={curveAreaPath} fill="url(#motivationAreaGrad)" />
            )}

            {/* Day Columns (Interaction & Pomo Bars) */}
            {monthlyData.days.map((d) => {
              const cx = getX(d.day);
              const colW = plotWidth / daysInMonth;
              const barW = Math.max(7, Math.min(16, colW * 0.58));
              const barH = (d.cappedPomo / 25) * plotHeight;
              const barY = padTop + plotHeight - barH;

              return (
                <g
                  key={`day-${d.day}`}
                  className={`${classes.dayColumn} ${
                    d.isSelected ? classes.selectedDay : ''
                  }`}
                  onMouseEnter={() => setHoveredDay(d.day)}
                  onMouseLeave={() => setHoveredDay(null)}
                  onClick={() => onSelectDate(d.dateStr)}
                >
                  {/* Hover background */}
                  <rect
                    x={cx - colW / 2}
                    y={padTop}
                    width={colW}
                    height={plotHeight}
                    fill="transparent"
                    className={classes.hoverBg}
                  />

                  {/* Selected date vertical line indicator */}
                  {d.isSelected && (
                    <line
                      x1={cx}
                      y1={padTop}
                      x2={cx}
                      y2={padTop + plotHeight}
                      className={classes.selectedIndicatorLine}
                    />
                  )}

                  {/* Pomo Bar */}
                  {d.cappedPomo > 0 && (
                    <rect
                      x={cx - barW / 2}
                      y={barY}
                      width={barW}
                      height={barH}
                      rx="2.5"
                      className={`${classes.pomoBar} ${
                        d.isCapped ? classes.maxBar : ''
                      }`}
                    />
                  )}

                  {/* Max indicator if capped at 25 */}
                  {d.isCapped && (
                    <text
                      x={cx}
                      y={barY - 3}
                      className={classes.maxBadgeText}
                    >
                      MAX
                    </text>
                  )}

                  {/* Bottom Day Label (Show on 1, 5, 10, 15, 20, 25, or daysInMonth, or if selected) */}
                  {(d.day === 1 ||
                    d.day % 5 === 0 ||
                    d.day === daysInMonth ||
                    d.isSelected ||
                    d.isToday) && (
                    <text
                      x={cx}
                      y={svgHeight - 12}
                      className={`${classes.axisText} ${classes.bottomAxis}`}
                      style={{
                        fontWeight: d.isSelected || d.isToday ? 700 : 500,
                        fill: d.isSelected
                          ? 'var(--color-primary)'
                          : d.isToday
                          ? 'var(--color-text)'
                          : undefined,
                      }}
                    >
                      {d.day}日
                    </text>
                  )}
                </g>
              );
            })}

            {/* Motivation Smooth Curve Line */}
            {curvePath && (
              <path d={curvePath} className={classes.curvePath} />
            )}

            {/* Motivation Scored Dots */}
            {scorePoints.map((pt) => (
              <circle
                key={`dot-${pt.day}`}
                cx={pt.x}
                cy={pt.y}
                r="4"
                className={classes.scoreDot}
                onMouseEnter={() => setHoveredDay(pt.day)}
                onMouseLeave={() => setHoveredDay(null)}
                onClick={() => {
                  const mStr = String(month).padStart(2, '0');
                  const dStr = String(pt.day).padStart(2, '0');
                  onSelectDate(`${year}-${mStr}-${dStr}`);
                }}
              />
            ))}
          </svg>
        </div>
      )}
    </div>
  );
};
