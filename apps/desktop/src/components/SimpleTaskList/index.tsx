import React, { useState } from 'react';
import useSWR from 'swr';
import { CheckCircle2, Play, Trash2, Plus, PenLine } from 'lucide-react';
import classes from './index.module.scss';
import tomatoSvg from '@/assets/tomato.svg';
import { api, Task } from '@/api/client';
import { useTimer } from '@/providers/TimerProvider';
import { useTutorial } from '@/providers/TutorialProvider';
import { useTranslation } from '@/providers/LanguageProvider';

export const SimpleTaskList: React.FC = () => {
  const { currentTask, setCurrentTask, startFocus } = useTimer();
  const { startTour } = useTutorial();
  const { t } = useTranslation();
  const [newTitle, setNewTitle] = useState('');
  const [estimatedPomos, setEstimatedPomos] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inline edit state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');

  const { data: tasks, mutate } = useSWR('tasks', () => api.listTasks(), {
    revalidateOnFocus: true,
  });

  const incompleteTasks = (tasks || []).filter((t) => t.status !== 'COMPLETED');

  const startEditing = (task: Task) => {
    setEditingTaskId(task.id);
    setEditingTitle(task.title);
    setCurrentTask(task);
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
      mutate();
    } catch (err) {
      console.error('Failed to update task title:', err);
    }
  };

  const handleCancelEdit = () => {
    setEditingTaskId(null);
  };

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

  return (
    <div id="tour-task-card" className={classes.card}>
      <div className={classes.header}>
        <div className={classes.title}>
          <CheckCircle2 size={18} className={classes.headerIcon} />
          <span>{t('simpleTasks.title')}</span>
          <span className={classes.countBadge}>{t('simpleTasks.countBadge', { count: incompleteTasks.length })}</span>
        </div>
      </div>

      {/* Quick Add Input Form */}
      <form className={classes.addForm} onSubmit={handleCreateTask}>
        <input
          type="text"
          className={classes.input}
          placeholder={t('simpleTasks.placeholder')}
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          disabled={isSubmitting}
        />
        <select
          className={classes.estSelect}
          value={estimatedPomos}
          onChange={(e) => setEstimatedPomos(Number(e.target.value))}
          title={t('simpleTasks.estTitle')}
          disabled={isSubmitting}
        >
          {[1, 2, 3, 4, 5, 6, 8].map((n) => (
            <option key={n} value={n}>
              {t('simpleTasks.estOption', { n })}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className={classes.submitBtn}
          disabled={!newTitle.trim() || isSubmitting}
        >
          <Plus size={16} />
          <span>{t('simpleTasks.add')}</span>
        </button>
      </form>

      {/* Clean Incomplete Task List */}
      <div className={classes.list}>
        {incompleteTasks.length > 0 ? (
          incompleteTasks.map((task) => {
            const isSelected = currentTask?.id === task.id;
            const actualMins = task.actualFocusSec ? Math.floor(task.actualFocusSec / 60) : 0;
            const taskPomos = actualMins === 0 ? 0 : Math.ceil(actualMins / 25);

            return (
              <div
                key={task.id}
                className={`${classes.item} ${isSelected ? classes.active : ''}`}
              >
                <div className={classes.left}>
                  <button
                    className={classes.checkBtn}
                    onClick={() => toggleTaskStatus(task)}
                    title={t('simpleTasks.completeTooltip')}
                  >
                    <span className={classes.checkInner} />
                  </button>

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
                      title={t('simpleTasks.editTooltip')}
                    >
                      <span className={classes.itemTitle}>
                        {task.id === 'task-onboarding' || task.title.includes('チュートリアル') || task.title.toLowerCase().includes('tutorial')
                          ? t('tasks.onboardingTitle')
                          : task.title}
                      </span>
                      <PenLine className={classes.pencilIcon} size={13} />
                    </div>
                  )}
                </div>

                <div className={classes.right}>
                  <div
                    className={classes.pomoBadge}
                    title={
                      actualMins > 0
                        ? t('simpleTasks.pomoActualTooltip', { actualMins, taskPomos, estimatedPomos: task.estimatedPomos })
                        : t('simpleTasks.pomoEstTooltip', { estimatedPomos: task.estimatedPomos })
                    }
                  >
                    <img src={tomatoSvg} alt="pomo" className={classes.tomatoIcon} />
                    <span>
                      {actualMins > 0 ? `${taskPomos}/` : ''}
                      {task.estimatedPomos}
                    </span>
                  </div>

                  {!isSelected && (
                    <button
                      className={classes.startBtn}
                      onClick={() => handleStartTask(task)}
                      title={t('simpleTasks.startFocusTooltip')}
                    >
                      <Play size={12} />
                      <span>{t('simpleTasks.startFocus')}</span>
                    </button>
                  )}

                  <button
                    className={classes.deleteBtn}
                    onClick={() => deleteTask(task.id)}
                    title={t('simpleTasks.deleteTooltip')}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className={classes.empty}>
            {t('simpleTasks.empty')}
          </div>
        )}
      </div>
    </div>
  );
};
