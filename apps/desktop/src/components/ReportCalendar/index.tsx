import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  PenLine,
} from 'lucide-react';
import classes from './index.module.scss';
import { Report } from '@/api/client';

interface ReportCalendarProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  reports?: Report[];
  todayStr: string;
}

export const ReportCalendar: React.FC<ReportCalendarProps> = ({
  selectedDate,
  onSelectDate,
  reports = [],
  todayStr,
}) => {
  // Calendar month state (defaults to selectedDate's month or current month)
  const initialDate = selectedDate ? new Date(selectedDate) : new Date();
  const [currentYear, setCurrentYear] = useState<number>(initialDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(initialDate.getMonth()); // 0-indexed

  // Published dates set for O(1) lookup
  const publishedDateMap = useMemo(() => {
    const map = new Map<string, Report>();
    for (const r of reports) {
      if (r.publishedDate) {
        map.set(r.publishedDate, r);
      }
    }
    return map;
  }, [reports]);

  // Navigate months
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Days in month calculation
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startDayOfWeek = firstDay.getDay(); // 0 is Sunday
    const totalDays = lastDay.getDate();

    const days: Array<{
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      hasReport: boolean;
      isToday: boolean;
      isSelectable: boolean;
    }> = [];

    // Empty cells before first day
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push({
        dateStr: '',
        dayNum: 0,
        isCurrentMonth: false,
        hasReport: false,
        isToday: false,
        isSelectable: false,
      });
    }

    // Actual month days
    for (let d = 1; d <= totalDays; d++) {
      const monthStr = (currentMonth + 1).toString().padStart(2, '0');
      const dayStr = d.toString().padStart(2, '0');
      const dateStr = `${currentYear}-${monthStr}-${dayStr}`;

      const hasReport = publishedDateMap.has(dateStr);
      const isToday = dateStr === todayStr;
      // Requirement: Selectable ONLY if a report is published OR today
      const isSelectable = hasReport || isToday;

      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: true,
        hasReport,
        isToday,
        isSelectable,
      });
    }

    return days;
  }, [currentYear, currentMonth, publishedDateMap, todayStr]);

  const weekLabels = ['日', '月', '火', '水', '木', '金', '土'];
  const todayHasReport = publishedDateMap.has(todayStr);

  return (
    <aside className={classes.sidebar}>
      {/* Calendar Header with Month Navigation */}
      <div className={classes.calendarCard}>
        <div className={classes.calendarHeader}>
          <div className={classes.monthTitle}>
            <CalendarIcon size={16} className={classes.headerIcon} />
            <span>
              {currentYear}年 {currentMonth + 1}月
            </span>
          </div>
          <div className={classes.navBtns}>
            <button
              className={classes.navBtn}
              onClick={handlePrevMonth}
              title="前月"
              type="button"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              className={classes.navBtn}
              onClick={handleNextMonth}
              title="翌月"
              type="button"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Days of Week */}
        <div className={classes.weekHeader}>
          {weekLabels.map((lbl, idx) => (
            <div
              key={lbl}
              className={`${classes.weekCell} ${idx === 0 ? classes.sunday : idx === 6 ? classes.saturday : ''}`}
            >
              {lbl}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className={classes.daysGrid}>
          {calendarDays.map((cell, idx) => {
            if (!cell.isCurrentMonth) {
              return <div key={`empty-${idx}`} className={classes.emptyCell} />;
            }

            const isSelected = selectedDate === cell.dateStr;

            return (
              <button
                key={cell.dateStr}
                type="button"
                disabled={!cell.isSelectable}
                onClick={() => cell.isSelectable && onSelectDate(cell.dateStr)}
                className={`
                  ${classes.dayCell}
                  ${cell.isSelectable ? classes.selectable : classes.disabled}
                  ${cell.hasReport ? classes.hasReport : ''}
                  ${cell.isToday ? classes.today : ''}
                  ${isSelected ? classes.selected : ''}
                `}
                title={
                  cell.hasReport
                    ? `${cell.dateStr} (発行済み日報)`
                    : cell.isToday
                    ? `${cell.dateStr} (今日の日報)`
                    : `${cell.dateStr} (日報なし)`
                }
              >
                <span className={classes.dayNum}>{cell.dayNum}</span>
                {cell.hasReport && <span className={classes.reportDot} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Today Shortcut Card */}
      <div
        className={`${classes.todayShortcut} ${selectedDate === todayStr ? classes.activeShortcut : ''}`}
        onClick={() => onSelectDate(todayStr)}
      >
        <div className={classes.shortcutLeft}>
          {todayHasReport ? (
            <CheckCircle2 size={16} className={classes.iconPublished} />
          ) : (
            <PenLine size={16} className={classes.iconDraft} />
          )}
          <div className={classes.shortcutText}>
            <span className={classes.shortcutTitle}>今日の日報</span>
            <span className={classes.shortcutDate}>{todayStr}</span>
          </div>
        </div>
        <span className={`${classes.statusBadge} ${todayHasReport ? classes.published : classes.draft}`}>
          {todayHasReport ? '発行済み' : '未発行'}
        </span>
      </div>
    </aside>
  );
};
