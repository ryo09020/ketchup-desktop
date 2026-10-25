import React from 'react';
import useSWR from 'swr';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { BarChart2, Calendar } from 'lucide-react';
import classes from './index.module.scss';
import { api } from '@/api/client';
import { useTimer } from '@/providers/TimerProvider';
import { useTranslation } from '@/providers/LanguageProvider';

export const StatsPage: React.FC = () => {
  const { pomoStreak } = useTimer();
  const { t } = useTranslation();
  const { data: stats } = useSWR('stats', () => api.getStats(), {
    revalidateOnFocus: false,
  });

  const sevenDaysAgo = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);
  const { data: recentPomos } = useSWR('stats-recent-pomos', () =>
    api.listPomos(undefined, sevenDaysAgo)
  );

  const todayPomos = (stats?.todayPomos || 0) + pomoStreak;

  const chartData = React.useMemo(() => {
    const days = t('stats.days').split(',');
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const isToday = i === 0;
      const todaySuffix = isToday ? t('stats.todaySuffix') : '';
      const dayName = `${days[d.getDay()]}${todaySuffix}`;

      const dayPomos = recentPomos?.filter((p) => p.startedAt?.startsWith(dateStr)) || [];
      const totalSec = dayPomos.reduce((acc, cur) => acc + (cur.durationSec || 0), 0);
      const mins = Math.floor(totalSec / 60);
      let count = mins === 0 ? 0 : Math.ceil(mins / 25);
      if (isToday) {
        count += pomoStreak;
      }
      result.push({ day: dayName, pomos: count });
    }
    return result;
  }, [recentPomos, pomoStreak, t]);

  return (
    <div className={classes.container}>
      <h1 className={classes.title}>
        <BarChart2 size={22} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle', color: 'var(--color-primary)' }} />
        <span>{t('stats.title')}</span>
      </h1>

      <div className={classes.statsGrid}>
        <div className={classes.card}>
          <span className={classes.cardNum}>{todayPomos} {t('stats.countUnit')}</span>
          <span className={classes.cardLabel}>{t('stats.todayPomos')}</span>
        </div>
        <div className={classes.card}>
          <span className={classes.cardNum}>{(stats?.todayFocusMinutes || 0) + pomoStreak * 25} {t('stats.minUnit')}</span>
          <span className={classes.cardLabel}>{t('stats.todayFocus')}</span>
        </div>
        <div className={classes.card}>
          <span className={classes.cardNum}>{(stats?.weekPomos || 0) + pomoStreak} {t('stats.countUnit')}</span>
          <span className={classes.cardLabel}>{t('stats.weekPomos')}</span>
        </div>
        <div className={classes.card}>
          <span className={classes.cardNum}>{stats?.totalTasksCompleted || 0} {t('stats.taskUnit')}</span>
          <span className={classes.cardLabel}>{t('stats.totalTasks')}</span>
        </div>
      </div>

      <div className={classes.chartCard}>
        <div className={classes.chartTitle}>
          <Calendar size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle', color: 'var(--color-primary)' }} />
          <span>{t('stats.weeklyChartTitle')}</span>
        </div>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="day" stroke="var(--color-text-muted)" />
              <YAxis allowDecimals={false} stroke="var(--color-text-muted)" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  borderRadius: 8,
                }}
              />
              <Bar dataKey="pomos" fill="var(--color-primary)" radius={[4, 4, 0, 0]} name={t('stats.pomoUnit')} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
