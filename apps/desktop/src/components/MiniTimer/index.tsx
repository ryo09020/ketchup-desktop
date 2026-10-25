import React from 'react';
import { Play, Pause, Square, Maximize2 } from 'lucide-react';
import classes from './index.module.scss';
import { useTimer } from '@/providers/TimerProvider';
import { useTranslation } from '@/providers/LanguageProvider';

export const MiniTimer: React.FC = () => {
  const {
    phase,
    timeLeft,
    currentTask,
    startFocus,
    pauseTimer,
    resumeTimer,
    stopTimer,
    toggleMiniMode,
  } = useTimer();
  const { t } = useTranslation();

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  const isBreak = phase === 'SHORT_BREAK' || phase === 'LONG_BREAK';

  return (
    <div className={classes.miniContainer}>
      <div className={classes.left}>
        <div className={`${classes.time} ${isBreak ? classes.break : ''}`}>
          {timeFormatted}
        </div>
        <div className={classes.meta}>
          <div className={classes.taskTitle}>
            {currentTask ? currentTask.title : t('mini.noTask')}
          </div>
          <div className={classes.statusLabel}>
            {phase === 'FOCUS'
              ? t('mini.focusing')
              : isBreak
              ? t('mini.breaking')
              : phase === 'PAUSED'
              ? t('mini.paused')
              : t('mini.idle')}
          </div>
        </div>
      </div>

      <div className={classes.controls}>
        {phase === 'IDLE' && (
          <button className={`${classes.btn} ${classes.play}`} onClick={() => startFocus()} title={t('mini.startTooltip')}>
            <Play size={14} />
          </button>
        )}
        {(phase === 'FOCUS' || phase === 'SHORT_BREAK' || phase === 'LONG_BREAK') && (
          <button
            className={`${classes.btn} ${classes.play} ${isBreak ? classes.break : ''}`}
            onClick={pauseTimer}
            title={t('mini.pauseTooltip')}
          >
            <Pause size={14} />
          </button>
        )}
        {(phase === 'FOCUS' || phase === 'PAUSED') && (
          <button
            className={classes.btn}
            onClick={() => stopTimer()}
            title={t('mini.stopTooltip')}
          >
            <Square size={14} style={{ color: 'var(--color-primary)' }} />
          </button>
        )}

        <button className={classes.btn} onClick={toggleMiniMode} title={t('mini.restoreTooltip')}>
          <Maximize2 size={14} />
        </button>
      </div>
    </div>
  );
};
