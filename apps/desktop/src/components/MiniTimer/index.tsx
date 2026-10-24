import React from 'react';
import { Play, Pause, Square, Maximize2 } from 'lucide-react';
import classes from './index.module.scss';
import { useTimer } from '@/providers/TimerProvider';

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
            {currentTask ? currentTask.title : 'タスク未選択'}
          </div>
          <div className={classes.statusLabel}>
            {phase === 'FOCUS' ? '集中中' : isBreak ? '休憩中' : phase === 'PAUSED' ? '一時停止' : '待機中'}
          </div>
        </div>
      </div>

      <div className={classes.controls}>
        {phase === 'IDLE' && (
          <button className={`${classes.btn} ${classes.play}`} onClick={() => startFocus()} title="開始">
            <Play size={14} />
          </button>
        )}
        {(phase === 'FOCUS' || phase === 'SHORT_BREAK' || phase === 'LONG_BREAK') && (
          <button
            className={`${classes.btn} ${classes.play} ${isBreak ? classes.break : ''}`}
            onClick={pauseTimer}
            title="一時停止"
          >
            <Pause size={14} />
          </button>
        )}
        {(phase === 'FOCUS' || phase === 'PAUSED') && (
          <button
            className={classes.btn}
            onClick={() => stopTimer()}
            title="タイマーを停止して実時間で記録"
          >
            <Square size={14} style={{ color: 'var(--color-primary)' }} />
          </button>
        )}

        <button className={classes.btn} onClick={toggleMiniMode} title="フルウィンドウに戻す">
          <Maximize2 size={14} />
        </button>
      </div>
    </div>
  );
};
