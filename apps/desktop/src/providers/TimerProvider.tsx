import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { mutate } from 'swr';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { api, Task } from '@/api/client';
import brownNoiseSound from '@/assets/bgm/brown_noise.mp3';
import synthesizerSound from '@/assets/bgm/synthesizer.mp3';

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
  pomoStreak: number;
  totalFocusSec: number;
  totalFocusMinutes: number;
  pomoEquivalent: number;
  isMiniMode: boolean;
  isChimePlaying: boolean;
  isTaskSelectModalOpen: boolean;
  openTaskSelectModal: () => void;
  closeTaskSelectModal: () => void;
  toggleMiniMode: () => void;
  startFocus: (task?: Task | null) => boolean;
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
const DEFAULT_SHORT_BREAK_SEC = 5 * 60; // 300
const DEFAULT_LONG_BREAK_SEC = 15 * 60; // 900
const LONG_BREAK_INTERVAL = 4;

const TimerContext = createContext<TimerContextType>({} as TimerContextType);

// Crisp, short, modern Web Audio chime (E5 -> A5, ~1.4s)
class ShortChime {
  private ctx: AudioContext | null = null;
  private oscillators: OscillatorNode[] = [];
  private gainNode: GainNode | null = null;

  play() {
    try {
      this.stop();
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      const now = this.ctx.currentTime;

      const master = this.ctx.createGain();
      master.gain.setValueAtTime(0.35, now);
      master.connect(this.ctx.destination);
      this.gainNode = master;

      // Note 1: E5 (659.25Hz)
      const osc1 = this.ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      const g1 = this.ctx.createGain();
      g1.gain.setValueAtTime(0.4, now);
      g1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc1.connect(g1);
      g1.connect(master);

      // Note 2: A5 (880.00Hz)
      const osc2 = this.ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.0, now + 0.28);
      const g2 = this.ctx.createGain();
      g2.gain.setValueAtTime(0.001, now);
      g2.gain.setValueAtTime(0.45, now + 0.28);
      g2.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
      osc2.connect(g2);
      g2.connect(master);

      osc1.start(now);
      osc1.stop(now + 0.6);
      osc2.start(now + 0.28);
      osc2.stop(now + 1.4);

      this.oscillators = [osc1, osc2];
    } catch (e) {
      console.warn('WebAudio chime notice:', e);
    }
  }

  stop() {
    try {
      if (this.gainNode && this.ctx) {
        this.gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
      }
      this.oscillators.forEach((o) => {
        try {
          o.stop();
          o.disconnect();
        } catch {}
      });
      this.oscillators = [];
    } catch {}
  }
}

export const TimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Restore last selected term duration (default: 25 minutes = 1500s)
  const [termDurationSec, setTermDurationState] = useState<number>(() => {
    const saved = localStorage.getItem(TERM_STORAGE_KEY);
    return saved ? parseInt(saved, 10) : 25 * 60;
  });

  const [phase, setPhase] = useState<TimerPhase>('IDLE');
  const [timeLeft, setTimeLeft] = useState<number>(termDurationSec);
  const [totalDuration, setTotalDuration] = useState<number>(termDurationSec);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [bgm, setBgmState] = useState<BgmType>('none');
  const [pomoStreak, setPomoStreak] = useState<number>(0);
  const [isMiniMode, setIsMiniMode] = useState<boolean>(false);
  const [totalFocusSec, setTotalFocusSec] = useState<number>(0);
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

  const audioBgmRef = useRef<HTMLAudioElement | null>(null);
  const chimeRef = useRef<ShortChime | null>(null);
  const chimeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize chime & load today's accumulated focus seconds
  useEffect(() => {
    chimeRef.current = new ShortChime();
    api.getStats().then((st) => {
      setTotalFocusSec(st.totalFocusSec || 0);
    }).catch(() => {});
  }, []);

  const playChime = useCallback(() => {
    if (chimeRef.current) {
      chimeRef.current.play();
      setIsChimePlaying(true);
      if (chimeTimerRef.current) clearTimeout(chimeTimerRef.current);
      chimeTimerRef.current = setTimeout(() => {
        setIsChimePlaying(false);
      }, 1500);
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
      invoke('update_tray_title', { title }).catch(() => {});
    } catch {}
  }, []);

  // Mini mode toggle
  const toggleMiniMode = useCallback(() => {
    setIsMiniMode((prev) => {
      const next = !prev;
      invoke('toggle_mini_mode', { mini: next }).catch(() => {});
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
    }).catch(() => {});
  }, []);

  // BGM playback management
  const playBgm = useCallback((type: BgmType) => {
    if (audioBgmRef.current) {
      audioBgmRef.current.pause();
      audioBgmRef.current = null;
    }
    if (type === 'none') return;

    const src = type === 'brown-noise' ? brownNoiseSound : synthesizerSound;
    const audio = new Audio(src);
    audio.loop = true;
    audio.volume = 0.5;
    audio.play().catch((e) => console.warn('BGM play notice:', e));
    audioBgmRef.current = audio;
  }, []);

  const stopBgm = useCallback(() => {
    if (audioBgmRef.current) {
      audioBgmRef.current.pause();
      audioBgmRef.current = null;
    }
  }, []);

  const setBgm = (type: BgmType) => {
    setBgmState(type);
    if (phase === 'FOCUS') {
      playBgm(type);
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

    setTotalFocusSec((prev) => prev + totalSec);

    const clientId = crypto.randomUUID();
    await api.recordPomo({
      clientId,
      taskId: task?.id,
      startedAt: new Date(Date.now() - totalSec * 1000).toISOString(),
      endedAt: new Date().toISOString(),
      durationSec: totalSec,
    }).catch(() => {});

    // Update task actualFocusSec and pomoCount
    if (task) {
      const updatedSec = (task.actualFocusSec || 0) + totalSec;
      const taskMins = Math.floor(updatedSec / 60);
      const updatedPomoCount = taskMins === 0 ? 0 : Math.ceil(taskMins / 25);
      await api.updateTask(task.id, {
        actualFocusSec: updatedSec,
        pomoCount: updatedPomoCount,
      }).catch(() => {});
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

    // Record exact elapsed time
    await recordActualElapsed(currentTask);

    const newStreak = pomoStreak + 1;
    setPomoStreak(newStreak);

    // Transition to break
    const isLongBreak = newStreak % LONG_BREAK_INTERVAL === 0;
    const breakDuration = isLongBreak ? DEFAULT_LONG_BREAK_SEC : DEFAULT_SHORT_BREAK_SEC;
    const nextPhase: TimerPhase = isLongBreak ? 'LONG_BREAK' : 'SHORT_BREAK';

    targetEndTimeRef.current = Date.now() + breakDuration * 1000;
    setPhase(nextPhase);
    setTotalDuration(breakDuration);
    setTimeLeft(breakDuration);
    syncTrayTitle(nextPhase, breakDuration);
    syncBackendSession(nextPhase, breakDuration, currentTask);
  }, [pomoStreak, currentTask, stopBgm, playChime, recordActualElapsed, syncTrayTitle, syncBackendSession]);

  // Complete break
  const handleBreakCompleted = useCallback(() => {
    stopChime();
    playChime();
    targetEndTimeRef.current = null;
    setPhase('IDLE');
    setTotalDuration(termDurationSec);
    setTimeLeft(termDurationSec);
    syncTrayTitle('IDLE', termDurationSec);
    syncBackendSession('IDLE', termDurationSec, currentTask);
  }, [termDurationSec, currentTask, stopChime, playChime, syncTrayTitle, syncBackendSession]);

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

    playBgm(bgm);
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
    stopBgm();
    syncTrayTitle('PAUSED', currentRemaining);
    syncBackendSession('PAUSED', currentRemaining, currentTask);
  };

  const resumeTimer = () => {
    stopChime();
    const now = Date.now();
    activeFocusStartRef.current = now;
    targetEndTimeRef.current = now + timeLeft * 1000;
    setPhase('FOCUS');
    playBgm(bgm);
    syncTrayTitle('FOCUS', timeLeft);
    syncBackendSession('FOCUS', timeLeft, currentTask);
  };

  // 停止ボタン: タイマーを停止し、現在までの実時間(分)を正確に計算してpomoを発行
  const stopTimer = async (): Promise<number> => {
    stopBgm();
    stopChime();

    targetEndTimeRef.current = null;
    const recordedMinutes = await recordActualElapsed(currentTask);

    setPhase('IDLE');
    setTotalDuration(termDurationSec);
    setTimeLeft(termDurationSec);
    activeFocusStartRef.current = null;
    sessionAccumulatedSecRef.current = 0;

    syncTrayTitle('IDLE', termDurationSec);
    syncBackendSession('IDLE', termDurationSec, currentTask);

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
    if (completedTask) {
      await api.updateTask(completedTask.id, { status: 'COMPLETED' });
      setCurrentTask(null); // Clear completed task so next session asks for a new task
    }
    await recordActualElapsed(completedTask);

    // Transition straight to short break
    targetEndTimeRef.current = Date.now() + DEFAULT_SHORT_BREAK_SEC * 1000;
    setPhase('SHORT_BREAK');
    setTotalDuration(DEFAULT_SHORT_BREAK_SEC);
    setTimeLeft(DEFAULT_SHORT_BREAK_SEC);
    syncTrayTitle('SHORT_BREAK', DEFAULT_SHORT_BREAK_SEC);
    syncBackendSession('SHORT_BREAK', DEFAULT_SHORT_BREAK_SEC, null);
  };

  // Listen to menu bar tray events from Rust
  useEffect(() => {
    let unlistenMini: (() => void) | undefined;
    let unlistenTimer: (() => void) | undefined;

    listen('tray-toggle-mini', () => {
      toggleMiniMode();
    }).then((un) => {
      unlistenMini = un;
    });

    listen('tray-toggle-timer', () => {
      setPhase((curr) => {
        if (curr === 'FOCUS') {
          pauseTimer();
          return 'PAUSED';
        } else if (curr === 'PAUSED') {
          resumeTimer();
          return 'FOCUS';
        } else if (curr === 'IDLE') {
          const ok = startFocus();
          return ok ? 'FOCUS' : 'IDLE';
        }
        return curr;
      });
    }).then((un) => {
      unlistenTimer = un;
    });

    return () => {
      if (unlistenMini) unlistenMini();
      if (unlistenTimer) unlistenTimer();
    };
  }, [toggleMiniMode]);

  // 集中時間の計算: 59秒以下は0分換算、25で割ってあまりは繰り上げ (25分=1, 26分=2)
  const totalFocusMinutes = Math.floor(totalFocusSec / 60);
  const pomoEquivalent = totalFocusMinutes === 0 ? 0 : Math.ceil(totalFocusMinutes / 25);

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
        pomoStreak,
        totalFocusSec,
        totalFocusMinutes,
        pomoEquivalent,
        isMiniMode,
        isChimePlaying,
        isTaskSelectModalOpen,
        openTaskSelectModal,
        closeTaskSelectModal,
        toggleMiniMode,
        startFocus,
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

