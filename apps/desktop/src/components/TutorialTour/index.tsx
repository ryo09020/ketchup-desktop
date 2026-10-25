import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  HelpCircle,
  Play,
  Clock,
  CheckSquare,
  BarChart2,
  Minimize2,
  Network,
  Sparkles,
  FolderDown,
  ShieldCheck,
  PartyPopper,
  MousePointerClick,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Pause,
} from 'lucide-react';
import classes from './index.module.scss';
import { useTutorial } from '@/providers/TutorialProvider';
import { useTranslation, TranslationKey } from '@/providers/LanguageProvider';

interface TourStepConfig {
  path: string;
  targetId: string;
  badgeKey: TranslationKey;
  titleKey: TranslationKey;
  descKey: TranslationKey;
  actionHintKey: TranslationKey;
  icon: React.ReactNode;
  placement?: 'bottom' | 'top' | 'left' | 'right' | 'center';
}

const TOUR_CONFIG: TourStepConfig[] = [
  // --- Page 1: タイマー画面 (/) ---
  {
    path: '/',
    targetId: 'tour-timer-circle',
    badgeKey: 'tour.step1.badge',
    titleKey: 'tour.step1.title',
    descKey: 'tour.step1.desc',
    actionHintKey: 'tour.step1.hint',
    icon: <Play size={18} color="#ef4444" fill="#ef4444" />,
    placement: 'right',
  },
  {
    path: '/',
    targetId: 'tour-term-selector',
    badgeKey: 'tour.step2.badge',
    titleKey: 'tour.step2.title',
    descKey: 'tour.step2.desc',
    actionHintKey: 'tour.step2.hint',
    icon: <Clock size={18} color="#f97316" />,
    placement: 'bottom',
  },
  {
    path: '/',
    targetId: 'tour-task-card',
    badgeKey: 'tour.step3.badge',
    titleKey: 'tour.step3.title',
    descKey: 'tour.step3.desc',
    actionHintKey: 'tour.step3.hint',
    icon: <CheckSquare size={18} color="#10b981" />,
    placement: 'left',
  },
  {
    path: '/',
    targetId: 'tour-timeline',
    badgeKey: 'tour.step4.badge',
    titleKey: 'tour.step4.title',
    descKey: 'tour.step4.desc',
    actionHintKey: 'tour.step4.hint',
    icon: <BarChart2 size={18} color="#6366f1" />,
    placement: 'bottom',
  },
  {
    path: '/',
    targetId: 'tour-mini-btn',
    badgeKey: 'tour.step5.badge',
    titleKey: 'tour.step5.title',
    descKey: 'tour.step5.desc',
    actionHintKey: 'tour.step5.hint',
    icon: <Minimize2 size={18} color="#8b5cf6" />,
    placement: 'bottom',
  },

  // --- Page 2: タスク画面 (/tasks) ---
  {
    path: '/tasks',
    targetId: 'tour-tasks-switcher',
    badgeKey: 'tour.step6.badge',
    titleKey: 'tour.step6.title',
    descKey: 'tour.step6.desc',
    actionHintKey: 'tour.step6.hint',
    icon: <Network size={18} color="#ec4899" />,
    placement: 'bottom',
  },

  // --- Page 3: 日報画面 (/reports) ---
  {
    path: '/reports',
    targetId: 'tour-report-ai-btn',
    badgeKey: 'tour.step7.badge',
    titleKey: 'tour.step7.title',
    descKey: 'tour.step7.desc',
    actionHintKey: 'tour.step7.hint',
    icon: <Sparkles size={18} color="#eab308" />,
    placement: 'bottom',
  },
  {
    path: '/reports',
    targetId: 'tour-report-obsidian-btn',
    badgeKey: 'tour.step8.badge',
    titleKey: 'tour.step8.title',
    descKey: 'tour.step8.desc',
    actionHintKey: 'tour.step8.hint',
    icon: <FolderDown size={18} color="#06b6d4" />,
    placement: 'bottom',
  },

  // --- Page 4: 設定画面 (/settings) ---
  {
    path: '/settings',
    targetId: 'tour-settings-ai',
    badgeKey: 'tour.step9.badge',
    titleKey: 'tour.step9.title',
    descKey: 'tour.step9.desc',
    actionHintKey: 'tour.step9.hint',
    icon: <ShieldCheck size={18} color="#10b981" />,
    placement: 'top',
  },

  // --- Page 5: 完了画面 (/) ---
  {
    path: '/',
    targetId: 'tour-finish',
    badgeKey: 'tour.step10.badge',
    titleKey: 'tour.step10.title',
    descKey: 'tour.step10.desc',
    actionHintKey: 'tour.step10.hint',
    icon: <PartyPopper size={20} color="#f59e0b" />,
    placement: 'center',
  },
];

const STEP_DURATION_SEC = 8;

export const TutorialTour: React.FC = () => {
  const { isTourActive, stopTour } = useTutorial();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const [stepIndex, setStepIndex] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number }>({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const [isClicking, setIsClicking] = useState(false);
  const [rippleKey, setRippleKey] = useState(0);
  const [progressSec, setProgressSec] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const stepConfig = TOUR_CONFIG[stepIndex];
  const isFinalStep = stepIndex === TOUR_CONFIG.length - 1;

  const step = stepConfig
    ? {
        ...stepConfig,
        badge: t(stepConfig.badgeKey),
        title: t(stepConfig.titleKey),
        desc: t(stepConfig.descKey),
        actionHint: t(stepConfig.actionHintKey),
      }
    : null;

  // 音効（Web Audio API）: クリック時のポップ音
  const playPopSound = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // Audio might be blocked by browser policy until gesture
    }
  }, []);

  // ターゲット要素の位置を計算してスポットライトと仮想カーソルを移動
  const updateTargetPosition = useCallback(() => {
    if (!step) return;

    if (step.targetId === 'tour-finish') {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      setSpotlightRect({
        top: cy - 140,
        left: cx - 200,
        width: 400,
        height: 280,
      });
      setCursorPos({ x: cx, y: cy });
      return;
    }

    const el = document.getElementById(step.targetId);
    if (!el) {
      // 見つからない場合は中央に配置
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      setSpotlightRect(null);
      setCursorPos({ x: cx, y: cy });
      return;
    }

    // 画面外や下部にある場合は見えやすいようにスクロール
    if (step.targetId === 'tour-settings-ai') {
      el.scrollIntoView({ behavior: 'auto', block: 'center' });
    } else {
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) {
        el.scrollIntoView({ behavior: 'auto', block: 'center' });
      }
    }

    const rect = el.getBoundingClientRect();
    const pad = 6;
    setSpotlightRect({
      top: Math.max(0, rect.top - pad),
      left: Math.max(0, rect.left - pad),
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
    });

    // 仮想カーソルをターゲットの中心へ移動
    const targetX = rect.left + rect.width / 2;
    const targetY = rect.top + rect.height / 2;
    setCursorPos({ x: targetX, y: targetY });

    // カーソル到着後にクリックアニメーション & サウンド
    const clickTimer = setTimeout(() => {
      setIsClicking(true);
      setRippleKey((k) => k + 1);
      playPopSound();
      const releaseTimer = setTimeout(() => {
        setIsClicking(false);
      }, 220);
      return () => clearTimeout(releaseTimer);
    }, 450);

    return () => clearTimeout(clickTimer);
  }, [step, playPopSound]);

  // ステップ移動時のページ遷移・DOMマウント待機
  useEffect(() => {
    if (!isTourActive || !step) return;

    if (location.pathname !== step.path) {
      navigate(step.path);
      // 画面遷移後のDOM描画を待機
      const routeTimer = setTimeout(() => {
        updateTargetPosition();
      }, 300);
      return () => clearTimeout(routeTimer);
    } else {
      const cleanup = updateTargetPosition();
      return () => {
        if (cleanup) cleanup();
      };
    }
  }, [isTourActive, stepIndex, step?.path, location.pathname, navigate, updateTargetPosition]);

  // ツアー開始時のリセット
  useEffect(() => {
    if (!isTourActive) {
      setStepIndex(0);
      setProgressSec(0);
    }
  }, [isTourActive]);

  // ウィンドウリサイズ対応
  useEffect(() => {
    if (!isTourActive) return;
    const onResize = () => updateTargetPosition();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isTourActive, updateTargetPosition]);

  // 自動進行タイマー
  useEffect(() => {
    if (!isTourActive || isPaused || isFinalStep) return;

    const interval = setInterval(() => {
      setProgressSec((prev) => {
        if (prev >= STEP_DURATION_SEC) {
          setStepIndex((idx) => Math.min(TOUR_CONFIG.length - 1, idx + 1));
          return 0;
        }
        return prev + 0.1;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isTourActive, isPaused, isFinalStep]);

  if (!isTourActive || !step) return null;

  const handleNext = () => {
    if (stepIndex < TOUR_CONFIG.length - 1) {
      setStepIndex((i) => i + 1);
      setProgressSec(0);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (stepIndex > 0) {
      setStepIndex((i) => i - 1);
      setProgressSec(0);
    }
  };

  const handleFinish = () => {
    navigate('/');
    stopTour();
  };

  // 吹き出しカードの配置計算（画面外はみ出し防止 & フリップ対応）
  const getCardStyle = (): React.CSSProperties => {
    const cardWidth = 370;
    const cardHeight = 230;

    if (step.placement === 'center' || !spotlightRect) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    // ステップ9: 設定画面のAIセクションでは、ユーザー要望「もっと画面の上に持ってきてほしい」に従い画面上部に配置
    if (step.targetId === 'tour-settings-ai') {
      return {
        top: 75,
        left: '50%',
        transform: 'translateX(-50%)',
      };
    }

    const { top, left, width, height } = spotlightRect;
    const margin = 16;
    let idealTop = top + height + margin;
    let idealLeft = left + width / 2 - cardWidth / 2;

    if (step.placement === 'right') {
      idealLeft = left + width + margin;
      idealTop = top + height / 2 - cardHeight / 2;
    } else if (step.placement === 'left') {
      idealLeft = left - cardWidth - margin;
      idealTop = top + height / 2 - cardHeight / 2;
    } else if (step.placement === 'top') {
      idealTop = top - cardHeight - margin;
      idealLeft = left + width / 2 - cardWidth / 2;
    } else if (step.placement === 'bottom') {
      idealTop = top + height + margin;
      idealLeft = left + width / 2 - cardWidth / 2;
    }

    // 画面下部で見切れる場合は対象要素の上側に反転！
    if (idealTop + cardHeight > window.innerHeight - 20) {
      idealTop = Math.max(16, top - cardHeight - margin);
    }

    // 画面内に厳密にクランプ
    const clampTop = Math.max(16, Math.min(window.innerHeight - cardHeight - 16, idealTop));
    const clampLeft = Math.max(16, Math.min(window.innerWidth - cardWidth - 16, idealLeft));

    return {
      top: clampTop,
      left: clampLeft,
    };
  };

  return (
    <div className={classes.tourOverlay} onClick={(e) => e.stopPropagation()}>
      {/* 暗転と対象スポットライト */}
      {spotlightRect && (
        <div
          className={classes.spotlight}
          style={{
            top: spotlightRect.top,
            left: spotlightRect.left,
            width: spotlightRect.width,
            height: spotlightRect.height,
          }}
        />
      )}

      {/* 仮想カーソル（手・矢印） */}
      <div
        className={`${classes.virtualCursor} ${isClicking ? classes.clicking : ''}`}
        style={{
          transform: `translate(${cursorPos.x}px, ${cursorPos.y}px)`,
        }}
      >
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M3 3L10.5 21L13.5 13.5L21 10.5L3 3Z"
            fill="#ffffff"
            stroke="#0f172a"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="3" fill="#ef4444" />
        </svg>

        {/* クリック時の波紋 */}
        {rippleKey > 0 && <div key={rippleKey} className={classes.clickRipple} />}
      </div>

      {/* ガイド吹き出しカード（ゲーム風） */}
      <div
        className={classes.dialogCard}
        style={getCardStyle()}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* ヘッダー: 右上に必ず見える「次へ」ボタンを配置して見切れを根絶 */}
        <div className={classes.cardHeader}>
          <div className={classes.badgeGroup}>
            <span className={classes.tourBadge}>
              <HelpCircle size={13} />
              <span>{t('tour.badge')}</span>
            </span>
            <span className={classes.stepCounter}>
              {stepIndex + 1} / {TOUR_CONFIG.length}
            </span>
          </div>

          <div className={classes.headerRightBtns}>
            <button
              className={`${classes.headerNextBtn} ${isFinalStep ? classes.headerFinishBtn : ''}`}
              onClick={handleNext}
              title={isFinalStep ? t('tour.finishTitle') : t('tour.nextTitle')}
            >
              {isFinalStep ? (
                <>
                  <CheckCircle2 size={13} />
                  <span>{t('tour.finish')}</span>
                </>
              ) : (
                <>
                  <span>{t('tour.next')}</span>
                  <ChevronRight size={14} />
                </>
              )}
            </button>
          </div>
        </div>

        <h3 className={classes.cardTitle}>
          {step.icon}
          <span>{step.title}</span>
        </h3>

        <p className={classes.cardDesc}>{step.desc}</p>

        {/* 具体的アクションヒント（ここで何を選択・操作するか） */}
        <div className={classes.actionHintBox}>
          <MousePointerClick size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{step.actionHint}</span>
        </div>

        {/* 自動進行タイマーバー（最終ステップ以外） */}
        {!isFinalStep && (
          <div className={classes.timerProgressBar}>
            <div
              className={classes.timerProgressFill}
              style={{ width: `${(progressSec / STEP_DURATION_SEC) * 100}%` }}
            />
          </div>
        )}

        <div className={classes.cardFooter}>
          {/* ステップドット */}
          <div className={classes.dots}>
            {TOUR_CONFIG.map((_, i) => (
              <div
                key={i}
                className={`${classes.dot} ${i === stepIndex ? classes.dotActive : ''}`}
                onClick={() => {
                  setStepIndex(i);
                  setProgressSec(0);
                }}
                style={{ cursor: 'pointer' }}
                title={t('tour.stepTitle', { step: i + 1 })}
              />
            ))}
          </div>

          {/* ナビゲーションボタン（戻る・一時停止・スキップ） */}
          <div className={classes.actionBtns}>
            {stepIndex > 0 && (
              <button className={classes.navBtn} onClick={handlePrev}>
                <ChevronLeft size={14} />
                <span>{t('tour.prev')}</span>
              </button>
            )}

            {!isFinalStep && (
              <button
                className={classes.navBtn}
                onClick={() => setIsPaused((p) => !p)}
                title={isPaused ? t('tour.resumeAuto') : t('tour.pauseAuto')}
              >
                {isPaused ? <Play size={13} /> : <Pause size={13} />}
              </button>
            )}

            <button
              className={classes.skipLink}
              onClick={stopTour}
              title={t('tour.skipTitle')}
            >
              {t('tour.skip')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
