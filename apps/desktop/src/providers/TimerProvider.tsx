import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { mutate } from 'swr';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { api, Task } from '@/api/client';
import { useTranslation } from '@/providers/LanguageProvider';
import brownNoiseSound from '@/assets/bgm/brown_noise.m4a';
import synthesizerSound from '@/assets/bgm/synthesizer.m4a';
import muteSound from '@/assets/bgm/mute.m4a';
import chimeSound from '@/assets/bgm/chime.m4a';

export type TimerPhase = 'IDLE' | 'FOCUS' | 'PAUSED' | 'SHORT_BREAK' | 'LONG_BREAK';
export type BgmType = 'none' | 'brown-noise' | 'synthesizer';

interface TimerContextType {
  phase: TimerPhase;
  timeLeft: number;
  totalDuration: number;
  termDurationSec: number;
  setTermDuration: (sec: number) => void;
  currentTask: Task | null;
  bgm: BgmType;
  defaultBgm: BgmType;
  setDefaultBgm: (bgm: BgmType) => void;
  pomoStreak: number;
  isMiniMode: boolean;
  isChimePlaying: boolean;
  isTaskSelectModalOpen: boolean;
  openTaskSelectModal: () => void;
  closeTaskSelectModal: () => void;
  toggleMiniMode: () => void;
  startFocus: (task?: Task | null) => boolean;
  startBreak: (durationSec?: number) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: () => Promise<number>; // 停止して実時間(分)で記録
  stopChime: () => void;
  resetTimer: () => void;
  skipPhase: () => void;
  completeCurrentTaskEarly: () => Promise<void>;
  setBgm: (bgm: BgmType) => void;
  setCurrentTask: (task: Task | null) => void;
}

const TERM_STORAGE_KEY = 'ketchup_last_term_sec';
const DEFAULT_BGM_STORAGE_KEY = 'ketchup_default_bgm';
const DEFAULT_SHORT_BREAK_SEC = 5 * 60; // 300
const DEFAULT_LONG_BREAK_SEC = 15 * 60; // 900
const LONG_BREAK_INTERVAL = 4;

const TimerContext = createContext<TimerContextType>({} as TimerContextType);

// Bell chime player using bundled m4a asset (chime.m4a)
class ShortChime {
  private audio: HTMLAudioElement | null = null;

  constructor(src: string) {
    try {
      this.audio = new Audio(src);
      this.audio.preload = 'auto';
      this.audio.volume = 0.7;
    } catch (e) {
      console.warn('ShortChime init notice:', e);
    }
  }

  play() {
    try {
      if (!this.audio) return;
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio.play().catch((e) => console.warn('ShortChime play error:', e));
    } catch (e) {
      console.warn('ShortChime notice:', e);
    }
  }

  stop() {
    try {
      if (!this.audio) return;
      this.audio.pause();
      this.audio.currentTime = 0;
    } catch { }
  }
}

/**
 * 2系統の Audio 要素を用いて等パワー（Equal-power）クロスフェードを行うシームレスループプレイヤー
 * MP3 特有の末尾無音パディングやクリックノイズを排除し、
 * トラック末尾の 3.5 秒前から次のトラックを徐々にフェードインさせながら前のトラックをフェードアウトさせます。
 * これによりブラウンノイズやシンセサイザー音源が切れ目なく永遠になだらかにループします。
 */
class SeamlessAudioPlayer {
  private audioA: HTMLAudioElement;
  private audioB: HTMLAudioElement;
  private active: 'A' | 'B' = 'A';
  private targetVolume: number;
  private crossfadeDuration: number;
  private isCrossfading: boolean = false;
  private isPlaying: boolean = false;
  private monitorTimer: NodeJS.Timeout | null = null;
  private fadeTimer: NodeJS.Timeout | null = null;

  constructor(src: string, targetVolume = 0.5, crossfadeDuration = 3.5) {
    this.targetVolume = targetVolume;
    this.crossfadeDuration = crossfadeDuration;
    this.audioA = new Audio(src);
    this.audioB = new Audio(src);
    this.audioA.preload = 'auto';
    this.audioB.preload = 'auto';

    // timeupdate イベントでも二重に監視
    const onTimeUpdate = (e: Event) => {
      const el = e.target as HTMLAudioElement;
      const currentActive = this.active === 'A' ? this.audioA : this.audioB;
      if (el === currentActive) {
        this.checkTrigger();
      }
    };
    this.audioA.addEventListener('timeupdate', onTimeUpdate);
    this.audioB.addEventListener('timeupdate', onTimeUpdate);
  }

  play() {
    this.stop();
    this.isPlaying = true;
    this.active = 'A';
    this.isCrossfading = false;

    this.audioA.currentTime = 0;
    this.audioA.volume = this.targetVolume;
    this.audioA.play().catch((e) => console.warn('SeamlessAudioPlayer play error:', e));

    // 定期タイマーでも監視（200ms間隔）
    this.monitorTimer = setInterval(() => {
      this.checkTrigger();
    }, 200);
  }

  private checkTrigger() {
    if (!this.isPlaying || this.isCrossfading) return;
    const current = this.active === 'A' ? this.audioA : this.audioB;
    if (!current.duration || isNaN(current.duration)) return;

    const remaining = current.duration - current.currentTime;
    if (remaining <= this.crossfadeDuration && remaining > 0) {
      this.startCrossfade();
    }
  }

  private startCrossfade() {
    this.isCrossfading = true;
    const outgoing = this.active === 'A' ? this.audioA : this.audioB;
    const incoming = this.active === 'A' ? this.audioB : this.audioA;
    const nextActive = this.active === 'A' ? 'B' : 'A';

    incoming.currentTime = 0;
    incoming.volume = 0;
    incoming.play().catch((e) => console.warn('Crossfade incoming play error:', e));

    const startTime = Date.now();
    const durationMs = this.crossfadeDuration * 1000;

    if (this.fadeTimer) {
      clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }

    this.fadeTimer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / durationMs);

      // 等パワーカーブ（Equal-power crossfade）:
      // 中間地点での音圧低下（dip）を防ぎ、一定の音量を維持しながら滑らかに移行
      const inVol = Math.sin(progress * (Math.PI / 2)) * this.targetVolume;
      const outVol = Math.cos(progress * (Math.PI / 2)) * this.targetVolume;

      incoming.volume = Math.max(0, Math.min(1, inVol));
      outgoing.volume = Math.max(0, Math.min(1, outVol));

      if (progress >= 1) {
        if (this.fadeTimer) {
          clearInterval(this.fadeTimer);
          this.fadeTimer = null;
        }
        outgoing.pause();
        outgoing.currentTime = 0;
        incoming.volume = this.targetVolume;
        this.active = nextActive;
        this.isCrossfading = false;
      }
    }, 40);
  }

  stop() {
    this.isPlaying = false;
    this.isCrossfading = false;
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }
    if (this.fadeTimer) {
      clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }
    this.audioA.pause();
    this.audioA.currentTime = 0;
    this.audioB.pause();
    this.audioB.currentTime = 0;
  }
}


const triggerNativeNotification = async (title: string, body: string) => {
  try {
    // 1. Invoke native Rust command (most reliable, works in both dev & packaged app)
    await invoke('show_notification', { title, body });
  } catch (e) {
    console.warn('Native notification invoke error, falling back:', e);
    try {
      let granted = await isPermissionGranted();
      if (!granted) {
        const permission = await requestPermission();
        granted = permission === 'granted';
      }
      if (granted) {
        sendNotification({ title, body });
      }
    } catch {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body });
      }
    }
  }
};

export const TimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();

  // Restore last selected term duration (default: 25 minutes = 1500s)
  const [termDurationSec, setTermDurationState] = useState<number>(() => {
    const saved = localStorage.getItem(TERM_STORAGE_KEY);
    return saved ? parseInt(saved, 10) : 25 * 60;
  });

  // Restore last selected default BGM (default: 'none')
  const [defaultBgm, setDefaultBgmState] = useState<BgmType>(() => {
    const saved = localStorage.getItem(DEFAULT_BGM_STORAGE_KEY) as BgmType | null;
    return saved === 'brown-noise' || saved === 'synthesizer' ? saved : 'none';
  });

  const [phase, setPhase] = useState<TimerPhase>('IDLE');
  const [timeLeft, setTimeLeft] = useState<number>(termDurationSec);
  const [totalDuration, setTotalDuration] = useState<number>(termDurationSec);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [bgm, setBgmState] = useState<BgmType>(defaultBgm);
  const [pomoStreak, setPomoStreak] = useState<number>(0);
  const [isMiniMode, setIsMiniMode] = useState<boolean>(false);
  const [isChimePlaying, setIsChimePlaying] = useState<boolean>(false);
  const [isTaskSelectModalOpen, setIsTaskSelectModalOpen] = useState<boolean>(false);

  const openTaskSelectModal = useCallback(() => {
    setIsTaskSelectModalOpen(true);
  }, []);

  const closeTaskSelectModal = useCallback(() => {
    setIsTaskSelectModalOpen(false);
  }, []);

  // Accurate session focus duration tracking
  const activeFocusStartRef = useRef<number | null>(null);
  const sessionAccumulatedSecRef = useRef<number>(0);
  const targetEndTimeRef = useRef<number | null>(null);

  const audioPlayerRef = useRef<SeamlessAudioPlayer | null>(null);
  const chimeRef = useRef<ShortChime | null>(null);
  const chimeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize chime, request notification permission & load today's accumulated focus seconds
  useEffect(() => {
    chimeRef.current = new ShortChime(chimeSound);

    // Load today's completed session count from DB to restore daily streak
    api.listPomos().then((allPomos) => {
      const now = new Date();
      const todayCount = allPomos.filter((p) => {
        const s = new Date(p.startedAt);
        return (
          s.getFullYear() === now.getFullYear() &&
          s.getMonth() === now.getMonth() &&
          s.getDate() === now.getDate()
        );
      }).length;
      setPomoStreak(todayCount);
    }).catch(() => { });

    // Request OS notification permission
    isPermissionGranted().then((granted) => {
      if (!granted) requestPermission().catch(() => { });
    }).catch(() => { });

    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.stop();
        audioPlayerRef.current = null;
      }
    };
  }, []);

  const playChime = useCallback(() => {
    if (chimeRef.current) {
      chimeRef.current.play();
      setIsChimePlaying(true);
      if (chimeTimerRef.current) clearTimeout(chimeTimerRef.current);
      chimeTimerRef.current = setTimeout(() => {
        setIsChimePlaying(false);
      }, 1600);
    }
  }, []);

  const stopChime = useCallback(() => {
    if (chimeRef.current) {
      chimeRef.current.stop();
    }
    if (chimeTimerRef.current) clearTimeout(chimeTimerRef.current);
    setIsChimePlaying(false);
  }, []);

  // Set & persist term duration (free dial/slider)
  const setTermDuration = (sec: number) => {
    setTermDurationState(sec);
    localStorage.setItem(TERM_STORAGE_KEY, sec.toString());
    if (phase === 'IDLE') {
      setTimeLeft(sec);
      setTotalDuration(sec);
      syncTrayTitle('IDLE', sec);
    }
  };

  // Update Tauri menu bar / tray title (macOS Status Bar Top-Right)
  const syncTrayTitle = useCallback((currPhase: TimerPhase, seconds: number) => {
    try {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      const formatted = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      let title = ` ${formatted}`;
      if (currPhase === 'SHORT_BREAK' || currPhase === 'LONG_BREAK') {
        title = ` ☕ ${formatted}`;
      } else if (currPhase === 'PAUSED') {
        title = ` ⏸ ${formatted}`;
      }
      invoke('update_tray_title', { title }).catch(() => { });
    } catch { }
  }, []);

  // Mini mode toggle
  const toggleMiniMode = useCallback(() => {
    setIsMiniMode((prev) => {
      const next = !prev;
      invoke('toggle_mini_mode', { mini: next }).catch(() => { });
      return next;
    });
  }, []);

  // Sync session with backend API
  const syncBackendSession = useCallback((newPhase: TimerPhase, remaining: number, task?: Task | null) => {
    api.updateSession({
      phase: newPhase,
      taskId: task ? task.id : undefined,
      taskTitle: task ? task.title : undefined,
      remainingSec: remaining,
      phaseEndsAt: (newPhase === 'FOCUS' || newPhase === 'SHORT_BREAK' || newPhase === 'LONG_BREAK')
        ? new Date(Date.now() + remaining * 1000).toISOString()
        : undefined,
    }).catch(() => { });
  }, []);

  // BGM playback management (Seamless crossfade looping)
  // BGM が 'none' (無し) の場合も mute.m4a をシームレスにループ再生することで、
  // 集中時間（FOCUS）中の macOS / WebKit バックグラウンドスロットリングを防止する
  const playBgm = useCallback((type: BgmType) => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.stop();
      audioPlayerRef.current = null;
    }

    const src = type === 'brown-noise'
      ? brownNoiseSound
      : type === 'synthesizer'
      ? synthesizerSound
      : muteSound;

    // mute.m4a (none) は 1.0秒のクロスフェードで音量1.0、環境音は 3.5秒で音量0.5
    const crossfade = type === 'none' ? 1.0 : 3.5;
    const vol = type === 'none' ? 1.0 : 0.5;

    const player = new SeamlessAudioPlayer(src, vol, crossfade);
    player.play();
    audioPlayerRef.current = player;
  }, []);

  const stopBgm = useCallback(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.stop();
      audioPlayerRef.current = null;
    }
  }, []);

  // BGM の再生・停止は phase と bgm の状態変化のみから一元管理（宣言的制御）
  // - FOCUS（集中時間）中のみ：選択された BGM（'none' の場合は無音キープ用の mute.m4a）を再生
  // - それ以外（IDLE, PAUSED, SHORT_BREAK, LONG_BREAK）：一切の音声（無音BGM含む）を完全停止
  useEffect(() => {
    if (phase === 'FOCUS') {
      playBgm(bgm);
    } else {
      stopBgm();
    }
    return () => {
      stopBgm();
    };
  }, [phase, bgm, playBgm, stopBgm]);

  const setBgm = (type: BgmType) => {
    setBgmState(type);
  };

  const setDefaultBgm = (type: BgmType) => {
    setDefaultBgmState(type);
    localStorage.setItem(DEFAULT_BGM_STORAGE_KEY, type);
    if (phase === 'IDLE') {
      setBgmState(type);
    }
  };

  // Record actual focus time: 59秒以下は0分換算、25分で1pomo、26分等は切り上げで2pomo
  const recordActualElapsed = useCallback(async (task?: Task | null): Promise<number> => {
    let currentSlice = 0;
    if (activeFocusStartRef.current) {
      currentSlice = Math.round((Date.now() - activeFocusStartRef.current) / 1000);
      activeFocusStartRef.current = null;
    }
    const totalSec = sessionAccumulatedSecRef.current + currentSlice;
    sessionAccumulatedSecRef.current = 0;

    if (totalSec <= 0) return 0;

    // 59秒以下は0分換算 (秒数切り捨て)
    const exactMins = Math.floor(totalSec / 60);

    const clientId = crypto.randomUUID();
    await api.recordPomo({
      clientId,
      taskId: task?.id,
      startedAt: new Date(Date.now() - totalSec * 1000).toISOString(),
      endedAt: new Date().toISOString(),
      durationSec: totalSec,
    }).catch(() => { });

    // Update task actualFocusSec and pomoCount
    if (task) {
      const updatedSec = (task.actualFocusSec || 0) + totalSec;
      const taskMins = Math.floor(updatedSec / 60);
      const updatedPomoCount = taskMins === 0 ? 0 : Math.ceil(taskMins / 25);
      await api.updateTask(task.id, {
        actualFocusSec: updatedSec,
        pomoCount: updatedPomoCount,
      }).catch(() => { });
    }

    // Revalidate today's timeline and stats summary instantly
    mutate('today-pomos');
    mutate('stats-summary');
    mutate('tasks');

    return exactMins;
  }, []);

  // Complete pomodoro session naturally
  const handlePomoCompleted = useCallback(async () => {
    stopBgm();
    playChime();

    const newStreak = pomoStreak + 1;
    const isLongBreak = newStreak % LONG_BREAK_INTERVAL === 0;
    const breakDuration = isLongBreak ? DEFAULT_LONG_BREAK_SEC : DEFAULT_SHORT_BREAK_SEC;
    const nextPhase: TimerPhase = isLongBreak ? 'LONG_BREAK' : 'SHORT_BREAK';

    // 状態遷移を非同期DB保存の前に即座に確定させる（BGM停止・休憩タイマー開始の遅延や競合を防ぐ）
    setPomoStreak(newStreak);
    targetEndTimeRef.current = Date.now() + breakDuration * 1000;
    setPhase(nextPhase);
    setTotalDuration(breakDuration);
    setTimeLeft(breakDuration);
    syncTrayTitle(nextPhase, breakDuration);
    syncBackendSession(nextPhase, breakDuration, currentTask);

    // Trigger Native OS Notification
    const taskTitle = currentTask?.title;
    const breakMsg = isLongBreak
      ? t('notification.longBreakBody')
      : t('notification.shortBreakBody');
    const body = taskTitle
      ? t('notification.taskPomoBody', { task: taskTitle, break: breakMsg })
      : breakMsg;
    triggerNativeNotification(t('notification.pomoCompletedTitle'), body);

    // Record exact elapsed time
    await recordActualElapsed(currentTask);
  }, [pomoStreak, currentTask, stopBgm, playChime, recordActualElapsed, syncTrayTitle, syncBackendSession, t]);

  // Complete break
  const handleBreakCompleted = useCallback(() => {
    stopBgm();
    stopChime();
    playChime();

    // Trigger Native OS Notification
    triggerNativeNotification(
      t('notification.breakCompletedTitle'),
      t('notification.breakCompletedBody')
    );

    targetEndTimeRef.current = null;
    setPhase('IDLE');
    setTotalDuration(termDurationSec);
    setTimeLeft(termDurationSec);
    syncTrayTitle('IDLE', termDurationSec);
    syncBackendSession('IDLE', termDurationSec, currentTask);
  }, [termDurationSec, currentTask, stopBgm, stopChime, playChime, syncTrayTitle, syncBackendSession, t]);

  // Main countdown timer interval (timestamp-based for 100% accurate time tracking even in background)
  useEffect(() => {
    if (phase !== 'FOCUS' && phase !== 'SHORT_BREAK' && phase !== 'LONG_BREAK') {
      return;
    }

    const checkTimer = () => {
      if (!targetEndTimeRef.current) return;
      const now = Date.now();
      const diffMs = targetEndTimeRef.current - now;
      const remaining = Math.max(0, Math.ceil(diffMs / 1000));

      setTimeLeft(remaining);
      syncTrayTitle(phase, remaining);

      if (remaining <= 0) {
        targetEndTimeRef.current = null;
        if (phase === 'FOCUS') {
          handlePomoCompleted();
        } else {
          handleBreakCompleted();
        }
      }
    };

    // Run check immediately to avoid delay
    checkTimer();

    // Check frequently (every 500ms) so seconds boundary is sharp
    const interval = setInterval(checkTimer, 500);

    // Also sync immediately when user switches back to window or wakes up
    const handleVisibilityOrFocus = () => {
      checkTimer();
    };
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [phase, handlePomoCompleted, handleBreakCompleted, syncTrayTitle]);

  const startFocus = (task?: Task | null): boolean => {
    stopChime();
    const selected = task !== undefined ? task : currentTask;
    if (!selected) {
      if (isMiniMode) {
        toggleMiniMode();
      }
      setIsTaskSelectModalOpen(true);
      return false;
    }
    setCurrentTask(selected);
    setIsTaskSelectModalOpen(false);
    setPhase('FOCUS');
    setTotalDuration(termDurationSec);
    setTimeLeft(termDurationSec);

    const now = Date.now();
    targetEndTimeRef.current = now + termDurationSec * 1000;
    activeFocusStartRef.current = now;
    sessionAccumulatedSecRef.current = 0;

    syncTrayTitle('FOCUS', termDurationSec);
    syncBackendSession('FOCUS', termDurationSec, selected);
    return true;
  };

  const pauseTimer = () => {
    let currentRemaining = timeLeft;
    if (targetEndTimeRef.current) {
      currentRemaining = Math.max(0, Math.ceil((targetEndTimeRef.current - Date.now()) / 1000));
      setTimeLeft(currentRemaining);
      targetEndTimeRef.current = null;
    }
    if (activeFocusStartRef.current) {
      const slice = Math.round((Date.now() - activeFocusStartRef.current) / 1000);
      sessionAccumulatedSecRef.current += slice;
      activeFocusStartRef.current = null;
    }
    setPhase('PAUSED');
    syncTrayTitle('PAUSED', currentRemaining);
    syncBackendSession('PAUSED', currentRemaining, currentTask);
  };

  const resumeTimer = () => {
    stopChime();
    const now = Date.now();
    activeFocusStartRef.current = now;
    targetEndTimeRef.current = now + timeLeft * 1000;
    setPhase('FOCUS');
    syncTrayTitle('FOCUS', timeLeft);
    syncBackendSession('FOCUS', timeLeft, currentTask);
  };

  const startBreak = useCallback(async (durationSec?: number) => {
    stopBgm();
    stopChime();

    const prevPhase = phase;
    const isLongBreak = (pomoStreak > 0 && pomoStreak % LONG_BREAK_INTERVAL === 0);
    const breakDuration = durationSec ?? (isLongBreak ? DEFAULT_LONG_BREAK_SEC : DEFAULT_SHORT_BREAK_SEC);
    const nextPhase: TimerPhase = breakDuration >= DEFAULT_LONG_BREAK_SEC ? 'LONG_BREAK' : 'SHORT_BREAK';

    targetEndTimeRef.current = Date.now() + breakDuration * 1000;
    setPhase(nextPhase);
    setTotalDuration(breakDuration);
    setTimeLeft(breakDuration);
    syncTrayTitle(nextPhase, breakDuration);
    syncBackendSession(nextPhase, breakDuration, currentTask);

    if (prevPhase === 'FOCUS' || prevPhase === 'PAUSED') {
      await recordActualElapsed(currentTask);
    }
  }, [phase, pomoStreak, currentTask, stopBgm, stopChime, recordActualElapsed, syncTrayTitle, syncBackendSession]);

  // 停止ボタン: タイマーを停止し、現在までの実時間(分)を正確に計算してpomoを発行
  const stopTimer = async (): Promise<number> => {
    stopBgm();
    stopChime();

    targetEndTimeRef.current = null;
    setPhase('IDLE');
    setTotalDuration(termDurationSec);
    setTimeLeft(termDurationSec);
    syncTrayTitle('IDLE', termDurationSec);
    syncBackendSession('IDLE', termDurationSec, currentTask);

    const recordedMinutes = await recordActualElapsed(currentTask);
    activeFocusStartRef.current = null;
    sessionAccumulatedSecRef.current = 0;

    return recordedMinutes;
  };

  const resetTimer = () => {
    stopTimer();
  };

  const skipPhase = () => {
    stopBgm();
    stopChime();
    if (phase === 'FOCUS') {
      handlePomoCompleted();
    } else {
      handleBreakCompleted();
    }
  };

  // Complete task early (e.g. task finished in 10 minutes instead of 25)
  const completeCurrentTaskEarly = async () => {
    stopBgm();
    stopChime();
    const completedTask = currentTask;

    // Increment today's streak and check for long break (every 4 sessions)
    const newStreak = pomoStreak + 1;
    setPomoStreak(newStreak);

    const isLongBreak = newStreak % LONG_BREAK_INTERVAL === 0;
    const breakDuration = isLongBreak ? DEFAULT_LONG_BREAK_SEC : DEFAULT_SHORT_BREAK_SEC;
    const nextPhase: TimerPhase = isLongBreak ? 'LONG_BREAK' : 'SHORT_BREAK';

    // Transition straight to appropriate break immediately
    setCurrentTask(null);
    targetEndTimeRef.current = Date.now() + breakDuration * 1000;
    setPhase(nextPhase);
    setTotalDuration(breakDuration);
    setTimeLeft(breakDuration);
    syncTrayTitle(nextPhase, breakDuration);
    syncBackendSession(nextPhase, breakDuration, null);

    if (completedTask) {
      await api.updateTask(completedTask.id, { status: 'COMPLETED' });
    }
    await recordActualElapsed(completedTask);
  };

  // Keep latest handlers in a ref so Tauri tray event listeners never call stale closures
  const trayHandlersRef = useRef({
    phase,
    pauseTimer,
    resumeTimer,
    startFocus,
    toggleMiniMode,
  });
  trayHandlersRef.current = {
    phase,
    pauseTimer,
    resumeTimer,
    startFocus,
    toggleMiniMode,
  };

  // Listen to menu bar tray events from Rust
  useEffect(() => {
    let unlistenMini: (() => void) | undefined;
    let unlistenTimer: (() => void) | undefined;

    listen('tray-toggle-mini', () => {
      trayHandlersRef.current.toggleMiniMode();
    }).then((un) => {
      unlistenMini = un;
    });

    listen('tray-toggle-timer', () => {
      const { phase: currPhase, pauseTimer: pause, resumeTimer: resume, startFocus: start } = trayHandlersRef.current;
      if (currPhase === 'FOCUS') {
        pause();
      } else if (currPhase === 'PAUSED') {
        resume();
      } else if (currPhase === 'IDLE') {
        start();
      }
    }).then((un) => {
      unlistenTimer = un;
    });

    return () => {
      if (unlistenMini) unlistenMini();
      if (unlistenTimer) unlistenTimer();
    };
  }, []);

  return (
    <TimerContext.Provider
      value={{
        phase,
        timeLeft,
        totalDuration,
        termDurationSec,
        setTermDuration,
        currentTask,
        bgm,
        defaultBgm,
        setDefaultBgm,
        pomoStreak,
        isMiniMode,
        isChimePlaying,
        isTaskSelectModalOpen,
        openTaskSelectModal,
        closeTaskSelectModal,
        toggleMiniMode,
        startFocus,
        startBreak,
        pauseTimer,
        resumeTimer,
        stopTimer,
        stopChime,
        resetTimer,
        skipPhase,
        completeCurrentTaskEarly,
        setBgm,
        setCurrentTask,
      }}
    >
      {children}
    </TimerContext.Provider>
  );
};

export const useTimer = () => useContext(TimerContext);

