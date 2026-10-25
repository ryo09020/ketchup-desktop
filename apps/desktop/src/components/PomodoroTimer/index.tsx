import React, { useState } from 'react';
import {
  Play,
  Pause,
  Square,
  Check,
  Music,
  CheckCircle2,
  Timer,
  VolumeX,
  Coffee,
  Palmtree,
  Bell,
} from 'lucide-react';
import classes from './index.module.scss';
import tomatoSvg from '@/assets/tomato.svg';
import { useTimer, BgmType } from '@/providers/TimerProvider';
import { useTranslation } from '@/providers/LanguageProvider';

const TERM_PRESETS = [10, 15, 25, 45, 50, 60];

export const PomodoroTimer: React.FC = () => {
  const { t, language } = useTranslation();
  const {
    phase,
    timeLeft,
    totalDuration,
    termDurationSec,
    setTermDuration,
    currentTask,
    bgm,
    totalFocusMinutes,
    pomoEquivalent,
    isChimePlaying,
    openTaskSelectModal,
    startFocus,
    pauseTimer,
    resumeTimer,
    stopTimer,
    stopChime,
    skipPhase,
    completeCurrentTaskEarly,
    setBgm,
  } = useTimer();

  const [customTermMinutes, setCustomTermMinutes] = useState<string>('');
  const [stopNotice, setStopNotice] = useState<string | null>(null);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const currentTermMinutes = Math.round(termDurationSec / 60);

  const radius = 110;
  const circumference = 2 * Math.PI * radius;
  const progress = totalDuration > 0 ? (totalDuration - timeLeft) / totalDuration : 0;
  const strokeDashoffset = circumference * (1 - progress);

  const isBreak = phase === 'SHORT_BREAK' || phase === 'LONG_BREAK';

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomTermMinutes(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 180) {
      setTermDuration(parsed * 60);
    }
  };

  const handleStop = async () => {
    const recordedMins = await stopTimer();
    if (recordedMins > 0) {
      const issued = Math.ceil(recordedMins / 25);
      setStopNotice(`⏹ ${recordedMins}分の作業を記録しました (${issued} pomo)`);
      setTimeout(() => setStopNotice(null), 3000);
    } else {
      setStopNotice('⏹ 1分未満のため記録せず停止しました');
      setTimeout(() => setStopNotice(null), 2500);
    }
  };

  const renderBadge = () => {
    switch (phase) {
      case 'FOCUS':
        return (
          <div className={`${classes.phaseBadge} ${classes.focus}`}>
            <img src={tomatoSvg} alt="tomato" style={{ width: 14, height: 14, imageRendering: 'pixelated', verticalAlign: 'middle', marginRight: 5 }} />
            {t('timer.focus')} ({currentTermMinutes}{t('timer.min')})
          </div>
        );
      case 'SHORT_BREAK':
        return (
          <div className={`${classes.phaseBadge} ${classes.break}`}>
            <Coffee size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />
            {t('timer.shortBreak')} (5{t('timer.min')})
          </div>
        );
      case 'LONG_BREAK':
        return (
          <div className={`${classes.phaseBadge} ${classes.break}`}>
            <Palmtree size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />
            {t('timer.longBreak')} (15{t('timer.min')})
          </div>
        );
      case 'PAUSED':
        return (
          <div className={`${classes.phaseBadge} ${classes.paused}`}>
            <Pause size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />
            {t('timer.paused')}
          </div>
        );
      default:
        return (
          <div className={`${classes.phaseBadge} ${classes.focus}`}>
            <img src={tomatoSvg} alt="tomato" style={{ width: 14, height: 14, imageRendering: 'pixelated', verticalAlign: 'middle', marginRight: 5 }} />
            {t('timer.focus')} ({currentTermMinutes}{t('timer.min')})
          </div>
        );
    }
  };

  return (
    <div className={classes.timerContainer}>
      {/* Short Chime Playing Banner with instant stop button */}
      {isChimePlaying && (
        <div className={classes.chimeBanner}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Bell size={14} /> {language === 'ja' ? 'タイマー終了！' : 'Timer Finished!'}
          </span>
          <button className={classes.chimeStopBtn} onClick={stopChime} title={t('timer.stopChime')}>
            <VolumeX size={13} style={{ verticalAlign: 'middle', marginRight: 2 }} />
            {t('timer.stopChime')}
          </button>
        </div>
      )}

      {stopNotice && (
        <div className={classes.chimeBanner} style={{ color: '#059669', borderColor: '#10b981' }}>
          <span>{stopNotice}</span>
        </div>
      )}

      {renderBadge()}

      {/* Free dial / term duration selector (saved automatically) */}
      <div className={classes.termSelector} title="1セッションの集中時間を自由に設定（次回以降も保持されます）">
        <Timer size={16} style={{ color: 'var(--color-text-muted)', marginLeft: 4 }} />
        {TERM_PRESETS.map((m) => (
          <button
            key={m}
            className={`${classes.termBtn} ${currentTermMinutes === m ? classes.active : ''}`}
            onClick={() => {
              setCustomTermMinutes('');
              setTermDuration(m * 60);
            }}
            disabled={phase !== 'IDLE'}
          >
            {m}m
          </button>
        ))}
        <input
          type="number"
          min="1"
          max="180"
          placeholder="分"
          value={customTermMinutes || (TERM_PRESETS.includes(currentTermMinutes) ? '' : currentTermMinutes)}
          onChange={handleCustomChange}
          className={classes.customInput}
          disabled={phase !== 'IDLE'}
          title="自由な分数（1〜180分）を入力"
        />
      </div>

      <div className={classes.circleWrapper}>
        <svg className={classes.circleSvg} viewBox="0 0 240 240">
          <circle
            className={classes.bgCircle}
            cx="120"
            cy="120"
            r={radius}
          />
          <circle
            className={`${classes.progressCircle} ${isBreak ? classes.break : ''}`}
            cx="120"
            cy="120"
            r={radius}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
          />
        </svg>

        <div className={classes.timeDisplay}>
          <div className={classes.timeNumbers}>{timeFormatted}</div>
          <div
            className={`${classes.currentTaskName} ${!currentTask ? classes.unselected : ''}`}
            onClick={phase === 'IDLE' ? openTaskSelectModal : undefined}
            style={{ cursor: phase === 'IDLE' ? 'pointer' : 'default' }}
            title={
              phase !== 'IDLE'
                ? `現在集中中のタスク: ${currentTask?.title || '未選択'}`
                : currentTask
                ? 'クリックしてタスクを変更'
                : 'クリックしてタスクを選択（集中開始にはタスクが必要です）'
            }
          >
            {currentTask ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                 <CheckCircle2 size={13} style={{ color: '#10b981', flexShrink: 0 }} />
                 <span>{currentTask.title}</span>
               </span>
             ) : (
               t('timer.selectTask')
             )}
           </div>
         </div>
       </div>

       {/* Timer Controls: Stop replaces skip/fast-forward */}
       <div className={classes.controls}>
         {phase === 'IDLE' && (
           <button
             className={classes.primaryButton}
             onClick={() => startFocus()}
             title={t('timer.start')}
           >
             <Play size={22} fill="currentColor" />
           </button>
         )}

         {(phase === 'FOCUS' || phase === 'SHORT_BREAK' || phase === 'LONG_BREAK') && (
           <button
             className={`${classes.primaryButton} ${isBreak ? classes.break : ''}`}
             onClick={pauseTimer}
             title={t('timer.pause')}
           >
             <Pause size={22} fill="currentColor" />
           </button>
         )}

         {phase === 'PAUSED' && (
           <button
             className={classes.primaryButton}
             onClick={resumeTimer}
             title={t('timer.resume')}
           >
             <Play size={22} fill="currentColor" />
           </button>
         )}

         {/* 集中時・一時停止時は「停止」ボタンで実稼働時間を正確に集計・記録 */}
         {(phase === 'FOCUS' || phase === 'PAUSED') && (
           <button
             className={classes.stopButton}
             onClick={handleStop}
             title={t('timer.finishAndRecord')}
           >
             <Square size={18} fill="currentColor" />
           </button>
         )}

         {/* 休憩時は休憩終了ボタン */}
         {isBreak && (
           <button
             className={classes.secondaryButton}
             onClick={skipPhase}
             title={t('timer.skip')}
           >
             <Check size={20} />
           </button>
         )}
       </div>

       {/* Early task completion button: records exact elapsed minutes and advances to break */}
       {phase === 'FOCUS' && (
         <div className={classes.earlyFinishRow}>
           <button
             className={classes.earlyFinishBtn}
             onClick={completeCurrentTaskEarly}
             title={language === 'ja' ? '予定より早く終わった場合、実際の作業時間だけを分単位で記録してタスク完了にします' : 'Complete task now and log actual elapsed time'}
           >
             <CheckCircle2 size={16} />
             <span>{language === 'ja' ? 'タスク完了して休憩へ（実時間記録）' : 'Complete Task & Break (Log Actual Time)'}</span>
           </button>
         </div>
       )}

       {/* Cumulative focus statistics */}
       <div
         className={classes.statsRow}
       >
         <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
           <img src={tomatoSvg} alt="pomo" style={{ width: 13, height: 13, imageRendering: 'pixelated' }} />
           {language === 'ja' ? '本日集中:' : 'Today:'}
         </span>
         <span className={classes.highlight}>{totalFocusMinutes}{t('timer.min')}</span>
         <span>/</span>
         <span className={classes.highlight}>{pomoEquivalent} pomo</span>
       </div>

       <div className={classes.bgmSection}>
         <Music size={17} />
         <span>{t('timer.bgm')}:</span>
         <select
           className={classes.bgmSelect}
           value={bgm}
           onChange={(e) => setBgm(e.target.value as BgmType)}
         >
           <option value="none">{t('timer.bgmNone')}</option>
           <option value="brown-noise">{t('timer.bgmBrownNoise')}</option>
           <option value="synthesizer">{t('timer.bgmSynthesizer')}</option>
         </select>
       </div>
     </div>
   );
 };


