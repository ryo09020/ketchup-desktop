import React from 'react';
import useSWR from 'swr';
import classes from './index.module.scss';
import { PomodoroTimer } from '@/components/PomodoroTimer';
import { DailyTimelineBar } from '@/components/DailyTimelineBar';
import { SimpleTaskList } from '@/components/SimpleTaskList';
import { api } from '@/api/client';
import { useTimer } from '@/providers/TimerProvider';

export const TimerPage: React.FC = () => {
  const { pomoStreak } = useTimer();
  const { data: stats } = useSWR('stats-summary', () => api.getStats(), {
    refreshInterval: 10000,
  });

  return (
    <div className={classes.pageLayout}>
      <div className={classes.timerSection}>
        <PomodoroTimer />

        <div className={classes.statsBar}>
          <div className={classes.statItem}>
            <span className={classes.statVal}>
              {(stats?.todayPomos || 0) + pomoStreak}
            </span>
            <span className={classes.statLbl}>今日のポモ</span>
          </div>
          <div className={classes.statItem}>
            <span className={classes.statVal}>
              {(stats?.todayFocusMinutes || 0) + pomoStreak * 25}分
            </span>
            <span className={classes.statLbl}>集中時間</span>
          </div>
          <div className={classes.statItem}>
            <span className={classes.statVal}>
              {stats?.totalTasksCompleted || 0}
            </span>
            <span className={classes.statLbl}>完了タスク</span>
          </div>
        </div>
      </div>

      <div className={classes.taskSection}>
        <DailyTimelineBar />
        <SimpleTaskList />
      </div>
    </div>
  );
};
