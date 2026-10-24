import React from 'react';
import useSWR from 'swr';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { BarChart2, Calendar } from 'lucide-react';
import classes from './index.module.scss';
import { api } from '@/api/client';
import { useTimer } from '@/providers/TimerProvider';

export const StatsPage: React.FC = () => {
  const { pomoStreak } = useTimer();
  const { data: stats } = useSWR('stats', () => api.getStats(), {
    revalidateOnFocus: false,
  });

  // Sample weekly data based on today's stats
  const todayPomos = (stats?.todayPomos || 0) + pomoStreak;
  const chartData = [
    { day: '月', pomos: Math.max(1, Math.round(todayPomos * 0.8)) },
    { day: '火', pomos: Math.max(2, Math.round(todayPomos * 1.2)) },
    { day: '水', pomos: Math.max(1, Math.round(todayPomos * 0.7)) },
    { day: '木', pomos: Math.max(3, Math.round(todayPomos * 1.4)) },
    { day: '金', pomos: Math.max(2, Math.round(todayPomos * 1.1)) },
    { day: '土', pomos: Math.max(1, Math.round(todayPomos * 0.5)) },
    { day: '日 (今日)', pomos: todayPomos },
  ];

  return (
    <div className={classes.container}>
      <h1 className={classes.title}>
        <BarChart2 size={22} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle', color: 'var(--color-primary)' }} />
        <span>集中 & ポモドーロ統計</span>
      </h1>

      <div className={classes.statsGrid}>
        <div className={classes.card}>
          <span className={classes.cardNum}>{todayPomos} 回</span>
          <span className={classes.cardLabel}>本日の完了ポモドーロ</span>
        </div>
        <div className={classes.card}>
          <span className={classes.cardNum}>{(stats?.todayFocusMinutes || 0) + pomoStreak * 25} 分</span>
          <span className={classes.cardLabel}>本日の総集中時間</span>
        </div>
        <div className={classes.card}>
          <span className={classes.cardNum}>{(stats?.weekPomos || 0) + pomoStreak} 回</span>
          <span className={classes.cardLabel}>今週の完了ポモドーロ</span>
        </div>
        <div className={classes.card}>
          <span className={classes.cardNum}>{stats?.totalTasksCompleted || 0} 個</span>
          <span className={classes.cardLabel}>完了タスク累計</span>
        </div>
      </div>

      <div className={classes.chartCard}>
        <div className={classes.chartTitle}>
          <Calendar size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle', color: 'var(--color-primary)' }} />
          <span>直近7日間のポモドーロ推移</span>
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
              <Bar dataKey="pomos" fill="var(--color-primary)" radius={[4, 4, 0, 0]} name="ポモドーロ数" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
