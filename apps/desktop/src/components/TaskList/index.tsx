import React, { useState, useMemo, useRef, useEffect } from 'react';
import useSWR from 'swr';
import {
  Check,
  Play,
  Trash2,
  Plus,
  List,
  Network,
  X,
  Eye,
  EyeOff,
  PenLine,
  Clock,
  Info,
  GripVertical,
  Sparkles,
  Loader2,
} from 'lucide-react';
import classes from './index.module.scss';
import tomatoSvg from '@/assets/tomato.svg';
import { api, Task } from '@/api/client';
import { useTimer } from '@/providers/TimerProvider';
import { useTutorial } from '@/providers/TutorialProvider';
import { useTranslation } from '@/providers/LanguageProvider';

type ViewMode = 'list' | 'map';
type TimeScope = 'week' | 'today' | 'all';

interface DragState {
  taskId: string;
  taskTitle: string;
  sourceCategory: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  isDragging: boolean;
}

// Helper to extract contexts from a task (single category + #hashtags in title)
const extractContexts = (task: Task): string[] => {
  const set = new Set<string>();

  if (task.category && task.category.trim()) {
    set.add(task.category.trim());
  }

  // Extract any #hashtags in title
  const hashtagRegex = /#([\p{L}\p{N}_-]+)/gu;
  let match;
  while ((match = hashtagRegex.exec(task.title)) !== null) {
    if (match[1]) set.add(match[1]);
  }

  // Default context if none found
  if (set.size === 0) {
    set.add('未分類');
  }

  return Array.from(set);
};

const cleanTaskTitle = (title: string): string => {
  return title.replace(/#([\p{L}\p{N}_-]+)/gu, '').trim();
};

export const TaskList: React.FC = () => {
  const { currentTask, setCurrentTask, startFocus } = useTimer();
  const { startTour } = useTutorial();
  const { t, language } = useTranslation();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [timeScope, setTimeScope] = useState<TimeScope>('week');
  const [showCompleted, setShowCompleted] = useState<boolean>(false);

  // New task form
  const [newTitle, setNewTitle] = useState('');
  const [estimatedPomos, setEstimatedPomos] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Graph interaction state
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedTaskNode, setSelectedTaskNode] = useState<Task | null>(null);

  // Inline edit state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');

  // Robust Pointer-based Drag & Drop state
  const [pointerDrag, setPointerDrag] = useState<DragState | null>(null);
  const [hoveredDropCategory, setHoveredDropCategory] = useState<string | null>(null);
  const pointerDragRef = useRef<DragState | null>(null);

  // Pointer drag start handler
  const handlePointerDown = (e: React.PointerEvent, task: Task) => {
    // Only left click, and not when inline editing
    if (e.button !== 0 || editingTaskId) return;

    e.preventDefault();
    const initialState: DragState = {
      taskId: task.id,
      taskTitle: task.title,
      sourceCategory: task.category || '未分類',
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      isDragging: false,
    };
    pointerDragRef.current = initialState;
    setPointerDrag(initialState);

    const onPointerMove = (ev: PointerEvent) => {
      const state = pointerDragRef.current;
      if (!state) return;

      const dx = ev.clientX - state.startX;
      const dy = ev.clientY - state.startY;
      const isDragging = state.isDragging || Math.hypot(dx, dy) >= 4;

      const next = {
        ...state,
        currentX: ev.clientX,
        currentY: ev.clientY,
        isDragging,
      };
      pointerDragRef.current = next;
      setPointerDrag(next);

      if (isDragging) {
        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        const section = el?.closest('[data-category-drop-target]');
        const target = section?.getAttribute('data-category-drop-target') || null;
        setHoveredDropCategory(target);
      }
    };

    const onPointerUp = async (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);

      const state = pointerDragRef.current;
      pointerDragRef.current = null;
      setPointerDrag(null);
      setHoveredDropCategory(null);

      if (!state || !state.isDragging) return;

      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const section = el?.closest('[data-category-drop-target]');
      const targetCat = section?.getAttribute('data-category-drop-target');

      if (targetCat && targetCat !== state.sourceCategory) {
        await handleUpdateTaskCategory(state.taskId, targetCat);
      }
    };

    const onPointerCancel = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
      pointerDragRef.current = null;
      setPointerDrag(null);
      setHoveredDropCategory(null);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
  };

  const handleUpdateTaskCategory = async (taskId: string, targetCategory: string) => {
    const trimmed = targetCategory.trim() || '未分類';
    const task = tasks?.find((t) => t.id === taskId);
    if (!task || (task.category || '未分類') === trimmed) return;

    mutate(
      (prev) => prev?.map((t) => (t.id === taskId ? { ...t, category: trimmed } : t)),
      false
    );

    try {
      await api.updateTask(taskId, { category: trimmed });
      await mutate();
    } catch (err) {
      console.error('Failed to update task category:', err);
      mutate();
    }
  };

  const startEditing = (task: Task) => {
    setEditingTaskId(task.id);
    setEditingTitle(task.title);
  };

  const handleSaveEdit = async (taskId: string) => {
    if (!editingTaskId) return;
    const trimmed = editingTitle.trim();
    setEditingTaskId(null);
    if (!trimmed) return;

    try {
      await api.updateTask(taskId, { title: trimmed });
      if (currentTask?.id === taskId) {
        setCurrentTask({ ...currentTask, title: trimmed });
      }
      if (selectedTaskNode?.id === taskId) {
        setSelectedTaskNode({ ...selectedTaskNode, title: trimmed });
      }
      mutate();
    } catch (err) {
      console.error('Failed to update task title:', err);
    }
  };

  const handleCancelEdit = () => {
    setEditingTaskId(null);
  };

  // AI Batch Categorization
  const [isCategorizingAI, setIsCategorizingAI] = useState(false);
  const [aiNotice, setAiNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleCategorizeWithAI = async () => {
    if (!tasks || tasks.length === 0) return;
    setIsCategorizingAI(true);
    setAiNotice(null);

    try {
      // 未分類タスク、または未完了タスクを優先（対象がなければ全タスク）
      const unclassified = tasks.filter((t) => t.category === '未分類' || !t.category);
      const targetList = unclassified.length > 0 ? unclassified : tasks.filter((t) => t.status !== 'COMPLETED');
      const toSend = targetList.length > 0 ? targetList : tasks;

      const res = await api.categorizeTasksWithAI(toSend);
      mutate();
      setAiNotice({
        type: 'success',
        message: `${res.updatedCount} 件のタスクをAIで分類・整理しました！`,
      });
      setTimeout(() => setAiNotice(null), 4000);
    } catch (err: any) {
      console.error('AI categorization failed:', err);
      const raw = err?.message || String(err);
      let msg = raw;
      if (raw.includes('429')) {
        msg = '【429 エラー】APIの利用制限（レートリミット）またはクレジット残高上限です。少し時間を置いて再試行するか、設定画面でAPIキーやプロバイダーをご確認ください。';
      }
      setAiNotice({
        type: 'error',
        message: msg,
      });
      setTimeout(() => setAiNotice(null), 8000);
    } finally {
      setIsCategorizingAI(false);
    }
  };

  const { data: tasks, mutate } = useSWR('tasks', () => api.listTasks(), {
    revalidateOnFocus: true,
  });

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await api.createTask({
        title: newTitle.trim(),
        estimatedPomos,
      });
      setNewTitle('');
      setEstimatedPomos(1);
      mutate();
    } catch (err) {
      console.error('Failed to create task:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleTaskStatus = async (task: Task) => {
    const isNowDone = task.status !== 'COMPLETED';
    const nextStatus = isNowDone ? 'COMPLETED' : 'TODO';
    try {
      await api.updateTask(task.id, {
        status: nextStatus,
        completedAt: isNowDone ? new Date().toISOString() : undefined,
      });
      if (isNowDone && currentTask?.id === task.id) {
        setCurrentTask(null);
      }
      mutate();
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await api.deleteTask(taskId);
      if (currentTask?.id === taskId) {
        setCurrentTask(null);
      }
      if (selectedTaskNode?.id === taskId) {
        setSelectedTaskNode(null);
      }
      mutate();
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  const handleStartTask = (task: Task) => {
    if (
      task.id === 'task-onboarding' ||
      task.topic === 'チュートリアル' ||
      task.topic?.toLowerCase().includes('tutorial') ||
      task.title.includes('?') ||
      task.title.includes('チュートリアル') ||
      task.title.includes('ツアー') ||
      task.title.includes('使い方') ||
      task.title.toLowerCase().includes('tutorial') ||
      task.title.toLowerCase().includes('tour')
    ) {
      setCurrentTask(task);
      startTour();
      return;
    }
    setCurrentTask(task);
    startFocus(task);
  };

  // Filter tasks by scope and completed toggle
  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    return tasks.filter((t) => {
      if (!showCompleted && t.status === 'COMPLETED') return false;

      if (timeScope === 'all') return true;

      if (timeScope === 'today') {
        if (t.status !== 'COMPLETED') return true;
        return t.completedAt?.startsWith(todayStr) || t.updatedAt?.startsWith(todayStr);
      }

      if (timeScope === 'week') {
        if (t.status !== 'COMPLETED') return true;
        const taskDate = new Date(t.completedAt || t.updatedAt || t.createdAt);
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return taskDate >= oneWeekAgo;
      }

      return true;
    });
  }, [tasks, timeScope, showCompleted]);

  // Group tasks for List View (by main category)
  const groupedTasks = useMemo(() => {
    const map: Record<string, Task[]> = {};
    filteredTasks.forEach((t) => {
      const cat = t.category || '未分類';
      if (!map[cat]) map[cat] = [];
      map[cat].push(t);
    });
    return map;
  }, [filteredTasks]);

  // ----------------------------------------------------
  // Obsidian Network Graph Calculation (Hubs + Tasks + Category Edges)
  // ----------------------------------------------------
  const graphData = useMemo(() => {
    const width = 860;
    const height = 520;
    const centerX = width / 2;
    const centerY = height / 2;

    // 1. Gather all unique contexts (Hubs)
    const hubCounts: Record<string, number> = {};
    const taskContextMap: Record<string, string[]> = {};

    filteredTasks.forEach((t) => {
      const ctxs = extractContexts(t);
      taskContextMap[t.id] = ctxs;
      ctxs.forEach((c) => {
        hubCounts[c] = (hubCounts[c] || 0) + 1;
      });
    });

    const hubNames = Object.keys(hubCounts).sort((a, b) => hubCounts[b] - hubCounts[a]);

    // 2. Position Context Hubs in an ellipse around center
    const hubPositions: Record<string, { x: number; y: number; count: number; name: string }> = {};
    const radiusX = Math.min(260, width * 0.32);
    const radiusY = Math.min(170, height * 0.3);

    hubNames.forEach((name, idx) => {
      const angle = (idx / (hubNames.length || 1)) * 2 * Math.PI - Math.PI / 2;
      hubPositions[name] = {
        name,
        count: hubCounts[name],
        x: centerX + Math.cos(angle) * radiusX,
        y: centerY + Math.sin(angle) * radiusY,
      };
    });

    // 3. Position Tasks based on their connected Hubs
    interface TaskNodePos {
      task: Task;
      x: number;
      y: number;
      contexts: string[];
    }

    const taskNodes: TaskNodePos[] = [];
    const edges: { fromX: number; fromY: number; toX: number; toY: number; hubName: string; taskId: string }[] = [];

    filteredTasks.forEach((t, tIdx) => {
      const ctxs = taskContextMap[t.id] || ['未分類'];

      let avgX = 0;
      let avgY = 0;
      let validHubs = 0;

      ctxs.forEach((c) => {
        if (hubPositions[c]) {
          avgX += hubPositions[c].x;
          avgY += hubPositions[c].y;
          validHubs++;
        }
      });

      if (validHubs > 0) {
        avgX /= validHubs;
        avgY /= validHubs;
      } else {
        avgX = centerX;
        avgY = centerY;
      }

      // Add mild deterministic displacement based on task index so tasks sharing the exact same hubs don't stack directly
      const jitterAngle = (tIdx * 137.5 * Math.PI) / 180; // golden ratio angle
      const jitterDist = validHubs === 1 ? 55 + (tIdx % 3) * 15 : 20 + (tIdx % 3) * 10;
      const nodeX = Math.max(50, Math.min(width - 50, avgX + Math.cos(jitterAngle) * jitterDist));
      const nodeY = Math.max(40, Math.min(height - 40, avgY + Math.sin(jitterAngle) * jitterDist));

      taskNodes.push({
        task: t,
        x: nodeX,
        y: nodeY,
        contexts: ctxs,
      });

      // Create edges connecting task to all its context hubs
      ctxs.forEach((c) => {
        if (hubPositions[c]) {
          edges.push({
            fromX: nodeX,
            fromY: nodeY,
            toX: hubPositions[c].x,
            toY: hubPositions[c].y,
            hubName: c,
            taskId: t.id,
          });
        }
      });
    });

    return {
      width,
      height,
      hubs: Object.values(hubPositions),
      taskNodes,
      edges,
    };
  }, [filteredTasks]);

  return (
    <div className={classes.taskCard}>
      {/* Header with scope and view switcher */}
      <div className={classes.taskHeader}>
        <div className={classes.title}>
          <span>{t('tasks.title')}</span>
          <span className={classes.countBadge}>
            {filteredTasks.length} {language === 'ja' ? '件' : 'tasks'}
          </span>
        </div>

        <div className={classes.headerControls}>
          {/* Scope switcher */}
          <div className={classes.scopeSwitcher}>
            <button
              className={`${classes.scopeBtn} ${timeScope === 'today' ? classes.active : ''}`}
              onClick={() => setTimeScope('today')}
            >
              {language === 'ja' ? '今日' : 'Today'}
            </button>
            <button
              className={`${classes.scopeBtn} ${timeScope === 'week' ? classes.active : ''}`}
              onClick={() => setTimeScope('week')}
            >
              {language === 'ja' ? '今週' : 'This Week'}
            </button>
            <button
              className={`${classes.scopeBtn} ${timeScope === 'all' ? classes.active : ''}`}
              onClick={() => setTimeScope('all')}
            >
              {language === 'ja' ? '全期間' : 'All Time'}
            </button>
          </div>

          {/* View switcher & AI Categorize Action */}
          <div className={classes.actionsGroup}>
            <button
              type="button"
              className={classes.aiCategorizeBtn}
              onClick={handleCategorizeWithAI}
              disabled={isCategorizingAI || !tasks || tasks.length === 0}
              title={language === 'ja' ? 'AIが現在のタスクを分析して適切なカテゴリに一括分類します' : 'AI analyzes and categorizes all current tasks'}
            >
              {isCategorizingAI ? (
                <Loader2 size={14} className={classes.spin} />
              ) : (
                <Sparkles size={14} className={classes.sparkleIcon} />
              )}
              <span>{isCategorizingAI ? (language === 'ja' ? 'AI分類中...' : 'Categorizing...') : (language === 'ja' ? 'AIで分類' : 'AI Categorize')}</span>
            </button>

            <div id="tour-tasks-switcher" className={classes.viewModeSwitcher}>
              <button
                className={`${classes.tabBtn} ${viewMode === 'list' ? classes.active : ''}`}
                onClick={() => setViewMode('list')}
              >
                <List size={15} />
                <span>{language === 'ja' ? 'リスト' : 'List'}</span>
              </button>
              <button
                id="tour-tasks-map-btn"
                className={`${classes.tabBtn} ${viewMode === 'map' ? classes.active : ''}`}
                onClick={() => setViewMode('map')}
                title={language === 'ja' ? 'Obsidian風 ネットワークマップ' : 'Obsidian-style Network Graph'}
              >
                <Network size={15} />
                <span>{language === 'ja' ? 'マップ' : 'Graph'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* AI Notice Banner */}
      {aiNotice && (
        <div className={`${classes.aiNoticeBanner} ${classes[aiNotice.type]}`}>
          <Sparkles size={14} />
          <span>{aiNotice.message}</span>
          <button type="button" onClick={() => setAiNotice(null)} className={classes.closeBannerBtn}>
            <X size={13} />
          </button>
        </div>
      )}

      {/* Task Creation Form */}
      <form className={classes.addTaskForm} onSubmit={handleCreateTask}>
        <div className={classes.mainRow}>
          <input
            type="text"
            className={classes.input}
            placeholder={language === 'ja' ? 'タスクを入力 (例: 過去問演習 #英語 #模試)...' : 'Enter task title (e.g. Chapter 3 Exercises #English)...'}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            disabled={isSubmitting}
          />
          <select
            className={classes.estSelect}
            value={estimatedPomos}
            onChange={(e) => setEstimatedPomos(Number(e.target.value))}
            title={language === 'ja' ? '予想ポモドーロ数 (25分×N)' : 'Estimated pomodoros (25m x N)'}
            disabled={isSubmitting}
          >
            {[1, 2, 3, 4, 5, 6, 8].map((n) => (
              <option key={n} value={n}>
                {language === 'ja' ? `目安 ${n} pomo` : `Est. ${n} pomo`}
              </option>
            ))}
          </select>
          <button type="submit" className={classes.submitBtn} disabled={!newTitle.trim() || isSubmitting}>
            <Plus size={16} />
            <span>{language === 'ja' ? '追加' : 'Add'}</span>
          </button>
        </div>

        <div className={classes.optionalRow}>
          <button
            type="button"
            className={`${classes.filterToggle} ${showCompleted ? classes.active : ''}`}
            onClick={() => setShowCompleted(!showCompleted)}
          >
            {showCompleted ? <Eye size={14} /> : <EyeOff size={14} />}
            <span>
              {showCompleted
                ? (language === 'ja' ? '完了タスクを表示中' : 'Showing Completed')
                : (language === 'ja' ? '未完了のみ表示' : 'Pending Only')}
            </span>
          </button>
        </div>
      </form>

      {/* ----------------------------------------------------
          View 1: Clean Minimalist Grouped List View
      ---------------------------------------------------- */}
      {viewMode === 'list' && (
        <div className={classes.listContainer}>
          {Object.keys(groupedTasks).length > 0 ? (
            Object.entries(groupedTasks).map(([catName, catTasks]) => {
              const catSec = catTasks.reduce((sum, t) => sum + (t.actualFocusSec || 0), 0);
              const catMins = Math.floor(catSec / 60);
              return (
                <div
                  key={catName}
                  data-category-drop-target={catName}
                  className={`${classes.groupSection} ${hoveredDropCategory === catName ? classes.dropTargetOver : ''}`}
                >
                  <div className={classes.groupHeader}>
                    <div className={classes.groupHeaderLeft}>
                      <span className={classes.groupTitle}>{catName}</span>
                      {hoveredDropCategory === catName && (
                        <span className={classes.dropHintBadge}>ここにドロップして移動</span>
                      )}
                    </div>
                    <span className={classes.groupMeta}>
                      {catTasks.length}件 {catMins > 0 ? `・ 計${catMins}分` : ''}
                    </span>
                  </div>

                  <div className={classes.groupList}>
                    {catTasks.map((task) => {
                      const isSelected = currentTask?.id === task.id;
                      const isDone = task.status === 'COMPLETED';
                      const isDragging = pointerDrag?.taskId === task.id && pointerDrag.isDragging;
                      const actualMins = task.actualFocusSec ? Math.floor(task.actualFocusSec / 60) : 0;
                      const taskPomos = actualMins === 0 ? 0 : Math.ceil(actualMins / 25);
                      const contexts = extractContexts(task);

                      return (
                        <div
                          key={task.id}
                          className={`${classes.item} ${isSelected ? classes.active : ''} ${isDone ? classes.completed : ''} ${isDragging ? classes.isDragging : ''}`}
                        >
                          <div className={classes.leftInfo}>
                            <div
                              className={classes.dragHandleWrapper}
                              title={language === 'ja' ? 'ドラッグして他のカテゴリへ移動' : 'Drag to move to another category'}
                              onPointerDown={(e) => handlePointerDown(e, task)}
                            >
                              <GripVertical size={13} className={classes.dragHandle} />
                            </div>

                            <button
                              className={`${classes.checkBtn} ${isDone ? classes.checked : ''}`}
                              onClick={() => toggleTaskStatus(task)}
                              title={isDone ? '未完了に戻す' : '完了にする'}
                            >
                              {isDone && <Check size={13} />}
                            </button>
                            <div className={classes.titleContainer}>
                              {editingTaskId === task.id ? (
                                <input
                                  type="text"
                                  className={classes.inlineInput}
                                  value={editingTitle}
                                  autoFocus
                                  onChange={(e) => setEditingTitle(e.target.value)}
                                  onBlur={() => handleSaveEdit(task.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleSaveEdit(task.id);
                                    } else if (e.key === 'Escape') {
                                      handleCancelEdit();
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                <div
                                  className={classes.titleWrapper}
                                  onClick={() => startEditing(task)}
                                  title="クリックしてタスク名を編集"
                                >
                                  <span className={classes.itemTitle}>
                                    {cleanTaskTitle(
                                      task.id === 'task-onboarding' || task.title.includes('チュートリアル') || task.title.toLowerCase().includes('tutorial')
                                        ? t('tasks.onboardingTitle')
                                        : task.title
                                    )}
                                  </span>
                                  <PenLine className={classes.pencilIcon} size={12} />
                                </div>
                              )}
                              {((contexts.filter((ctx) => ctx !== (task.category || '未分類')).length > 0) || actualMins > 0) && (
                                <div className={classes.tagList}>
                                  {/* Extra hashtags in title */}
                                  {contexts
                                    .filter((ctx) => ctx !== (task.category || '未分類'))
                                    .map((ctx) => (
                                      <span key={ctx} className={classes.tagPill}>
                                        #{ctx}
                                      </span>
                                    ))}

                                  {actualMins > 0 && (
                                    <span className={classes.timePill}>
                                      <Clock size={10} style={{ display: 'inline', marginRight: 2, verticalAlign: 'middle' }} />
                                      {actualMins}分 ({taskPomos}p)
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className={classes.rightInfo}>
                            <div className={classes.pomoBadge}>
                              <img src={tomatoSvg} alt="pomo" className={classes.tomatoIcon} />
                              <span>
                                {actualMins > 0 ? `${taskPomos}/` : ''}
                                {task.estimatedPomos}
                              </span>
                            </div>

                            {!isDone && !isSelected && (
                              <button
                                className={classes.startBtn}
                                onClick={() => handleStartTask(task)}
                                title="このタスクで集中スタート"
                              >
                                <Play size={11} />
                                <span>集中</span>
                              </button>
                            )}

                            <button
                              className={classes.deleteBtn}
                              onClick={() => deleteTask(task.id)}
                              title="削除"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          ) : (
            <div className={classes.emptyText}>
              表示するタスクがありません。上のフォームからタスクを追加してみましょう！
            </div>
          )}
        </div>
      )}

      {/* ----------------------------------------------------
          View 2: Obsidian-Style Network Map (SVG Graph)
      ---------------------------------------------------- */}
      {viewMode === 'map' && (
        <div className={classes.mapWrapper}>
          <div className={classes.mapToolbar}>
            <span className={classes.mapHelp}>
              <Info size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              タスクのカテゴリ（未分類・開発・英語など）やハッシュタグとタスクが網の目で繋がります。上の『AIで分類』ボタンで一括整理できます。
            </span>
          </div>

          <div className={classes.svgContainer}>
            <svg
              className={classes.networkSvg}
              viewBox={`0 0 ${graphData.width} ${graphData.height}`}
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Connection Lines from Task to Category Hub (実線・階層リンク) */}
              {graphData.edges.map((edge, idx) => {
                const isConnected =
                  hoveredNodeId === edge.taskId || hoveredNodeId === `hub-${edge.hubName}`;
                const isDimmed = hoveredNodeId && !isConnected;

                return (
                  <line
                    key={idx}
                    x1={edge.fromX}
                    y1={edge.fromY}
                    x2={edge.toX}
                    y2={edge.toY}
                    className={`${classes.edgeLine} ${isConnected ? classes.highlightEdge : ''} ${isDimmed ? classes.dimmedEdge : ''}`}
                  />
                );
              })}

              {/* Context Hub Nodes (円・ハブ) */}
              {graphData.hubs.map((hub) => {
                const isHovered = hoveredNodeId === `hub-${hub.name}`;
                const isDimmed = hoveredNodeId && !isHovered && !hoveredNodeId.startsWith('task-');

                return (
                  <g
                    key={hub.name}
                    className={`${classes.hubGroup} ${isHovered ? classes.activeHub : ''} ${isDimmed ? classes.dimmed : ''}`}
                    transform={`translate(${hub.x}, ${hub.y})`}
                    onMouseEnter={() => setHoveredNodeId(`hub-${hub.name}`)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                  >
                    <circle r={22 + Math.min(10, hub.count * 2)} className={classes.hubCircle} />
                    <text className={classes.hubLabel} dy="-3">
                      {hub.name}
                    </text>
                    <text className={classes.hubCount} dy="12">
                      ({hub.count})
                    </text>
                  </g>
                );
              })}

              {/* Task Nodes (四角/ピル・タスク) */}
              {graphData.taskNodes.map(({ task, x, y, contexts }) => {
                const isHovered = hoveredNodeId === task.id;
                const isConnectedToHoveredHub = hoveredNodeId && contexts.some((c) => `hub-${c}` === hoveredNodeId);
                const isHighlighted = isHovered || isConnectedToHoveredHub;
                const isDimmed = hoveredNodeId && !isHighlighted;
                const isDone = task.status === 'COMPLETED';
                const isCurrent = currentTask?.id === task.id;

                const displayTitle = cleanTaskTitle(task.title);
                const truncated = displayTitle.length > 14 ? displayTitle.slice(0, 13) + '…' : displayTitle;

                return (
                  <g
                    key={task.id}
                    className={`${classes.taskNodeGroup} ${isHighlighted ? classes.highlightedTask : ''} ${isDimmed ? classes.dimmed : ''} ${isDone ? classes.completedTaskNode : ''} ${isCurrent ? classes.currentTaskNode : ''}`}
                    transform={`translate(${x}, ${y})`}
                    onMouseEnter={() => setHoveredNodeId(task.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                    onClick={() => setSelectedTaskNode(task)}
                  >
                    <rect
                      x={-55}
                      y={-14}
                      width={110}
                      height={28}
                      rx={6}
                      className={classes.taskNodeRect}
                    />
                    <text className={classes.taskNodeText} dy="4">
                      {isDone ? '(済) ' : ''}
                      {truncated}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Selected Task Inspection Card (Popup within Canvas) */}
            {selectedTaskNode && (
              <div className={classes.taskInspectionCard}>
                <div className={classes.cardHeader}>
                  {editingTaskId === selectedTaskNode.id ? (
                    <input
                      type="text"
                      className={classes.cardInlineInput}
                      value={editingTitle}
                      autoFocus
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={() => handleSaveEdit(selectedTaskNode.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveEdit(selectedTaskNode.id);
                        } else if (e.key === 'Escape') {
                          handleCancelEdit();
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <div
                      className={classes.cardTitleWrapper}
                      onClick={() => startEditing(selectedTaskNode)}
                      title="クリックしてタスク名を編集"
                    >
                      <span className={classes.cardTitle} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {selectedTaskNode.status === 'COMPLETED' && <Check size={14} color="var(--color-primary)" />}
                        <span>{cleanTaskTitle(selectedTaskNode.title)}</span>
                      </span>
                      <PenLine className={classes.pencilIcon} size={13} />
                    </div>
                  )}
                  <button
                    className={classes.cardCloseBtn}
                    onClick={() => setSelectedTaskNode(null)}
                    title="閉じる"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className={classes.cardContexts}>
                  {extractContexts(selectedTaskNode).map((c) => (
                    <span key={c} className={classes.cardTag}>
                      #{c}
                    </span>
                  ))}
                  {selectedTaskNode.actualFocusSec ? (
                    <span className={classes.cardTime}>
                      <Clock size={11} style={{ display: 'inline', marginRight: 3, verticalAlign: 'middle' }} />
                      {Math.floor(selectedTaskNode.actualFocusSec / 60)}分作業
                    </span>
                  ) : null}
                </div>

                <div className={classes.cardActions}>
                  <button
                    className={classes.cardCheckBtn}
                    onClick={() => {
                      toggleTaskStatus(selectedTaskNode);
                      setSelectedTaskNode({
                        ...selectedTaskNode,
                        status: selectedTaskNode.status === 'COMPLETED' ? 'TODO' : 'COMPLETED',
                      });
                    }}
                  >
                    {selectedTaskNode.status === 'COMPLETED' ? '未完了に戻す' : '完了にする'}
                  </button>

                  {selectedTaskNode.status !== 'COMPLETED' && (
                    <button
                      className={classes.cardStartBtn}
                      onClick={() => {
                        handleStartTask(selectedTaskNode);
                        setSelectedTaskNode(null);
                      }}
                    >
                      <Play size={12} />
                      <span>集中開始</span>
                    </button>
                  )}

                  <button
                    className={classes.cardDeleteBtn}
                    onClick={() => deleteTask(selectedTaskNode.id)}
                    title="削除"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Drag Preview Ghost */}
      {pointerDrag?.isDragging && (
        <div
          className={classes.dragGhost}
          style={{
            left: `${pointerDrag.currentX + 12}px`,
            top: `${pointerDrag.currentY + 12}px`,
          }}
        >
          <GripVertical size={13} />
          <span className={classes.ghostTitle}>{cleanTaskTitle(pointerDrag.taskTitle)}</span>
          {hoveredDropCategory && (
            <span className={classes.ghostTargetBadge}>
              ➔ {hoveredDropCategory}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
