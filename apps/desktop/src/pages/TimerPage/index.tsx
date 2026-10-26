import React from 'react';
import useSWR from 'swr';
import classes from './index.module.scss';
import { PomodoroTimer } from '@/components/PomodoroTimer';
import { DailyTimelineBar } from '@/components/DailyTimelineBar';
import { SimpleTaskList } from '@/components/SimpleTaskList';
import { api } from '@/api/client';
import { useTranslation } from '@/providers/LanguageProvider';

export const TimerPage: React.FC = () => {
  const { t } = useTranslation();
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
              {stats?.todayPomos || 0}
            </span>
            <span className={classes.statLbl}>{t('timerPage.todayPomos')}</span>
          </div>
          <div className={classes.statItem}>
            <span className={classes.statVal}>
              {stats?.todayFocusMinutes || 0}{t('timer.min')}
            </span>
            <span className={classes.statLbl}>{t('timerPage.focusTime')}</span>
          </div>
          <div className={classes.statItem}>
            <span className={classes.statVal}>
              {stats?.totalTasksCompleted || 0}
            </span>
            <span className={classes.statLbl}>{t('timerPage.completedTasks')}</span>
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
