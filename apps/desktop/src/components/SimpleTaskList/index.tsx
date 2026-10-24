import React, { useState } from 'react';
import useSWR from 'swr';
import { CheckCircle2, Play, Trash2, Plus, PenLine } from 'lucide-react';
import classes from './index.module.scss';
import tomatoSvg from '@/assets/tomato.svg';
import { api, Task } from '@/api/client';
import { useTimer } from '@/providers/TimerProvider';

export const SimpleTaskList: React.FC = () => {
  const { currentTask, setCurrentTask, startFocus } = useTimer();
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
    setCurrentTask(task);
    startFocus(task);
  };

  return (
    <div className={classes.card}>
      <div className={classes.header}>
        <div className={classes.title}>
          <CheckCircle2 size={18} className={classes.headerIcon} />
          <span>未完了タスク</span>
          <span className={classes.countBadge}>{incompleteTasks.length}件</span>
        </div>
      </div>

      {/* Quick Add Input Form */}
      <form className={classes.addForm} onSubmit={handleCreateTask}>
        <input
          type="text"
          className={classes.input}
          placeholder="新しいタスクを入力してEnter..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          disabled={isSubmitting}
        />
        <select
          className={classes.estSelect}
          value={estimatedPomos}
          onChange={(e) => setEstimatedPomos(Number(e.target.value))}
          title="予想ポモドーロ数 (25分×N)"
          disabled={isSubmitting}
        >
          {[1, 2, 3, 4, 5, 6, 8].map((n) => (
            <option key={n} value={n}>
              目安 {n} pomo
            </option>
          ))}
        </select>
        <button
          type="submit"
          className={classes.submitBtn}
          disabled={!newTitle.trim() || isSubmitting}
        >
          <Plus size={16} />
          <span>追加</span>
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
                    title="タスクを完了にする"
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
                      title="クリックしてタスク名を編集"
                    >
                      <span className={classes.itemTitle}>
                        {task.title}
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
                        ? `実績: ${actualMins}分 (${taskPomos} pomo) / 目標: ${task.estimatedPomos} pomo`
                        : `予想: ${task.estimatedPomos} pomo`
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
                      title="このタスクで集中スタート"
                    >
                      <Play size={12} />
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
          })
        ) : (
          <div className={classes.empty}>
            未完了のタスクはありません。上の入力欄からタスクを追加してみましょう！
          </div>
        )}
      </div>
    </div>
  );
};
