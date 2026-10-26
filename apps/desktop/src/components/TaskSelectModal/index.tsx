import React, { useState } from 'react';
import useSWR from 'swr';
import {
  X,
  Play,
  Plus,
  Sparkles,
  List,
  CheckCircle2,
  Clock,
  Folder,
} from 'lucide-react';
import classes from './index.module.scss';
import { api, Task } from '@/api/client';
import tomatoSvg from '@/assets/tomato.svg';
import { useTranslation } from '@/providers/LanguageProvider';

interface TaskSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTask: (task: Task) => void;
}

export const TaskSelectModal: React.FC<TaskSelectModalProps> = ({
  isOpen,
  onClose,
  onSelectTask,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'existing' | 'new'>('existing');
  const [newTitle, setNewTitle] = useState('');
  const [broadLabel, setBroadLabel] = useState('');
  const [estimatedPomos, setEstimatedPomos] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: tasks, mutate } = useSWR('tasks', () => api.listTasks(), {
    revalidateOnFocus: true,
  });

  if (!isOpen) return null;

  const incompleteTasks = (tasks || []).filter((t) => t.status !== 'COMPLETED');

  const handleCreateAndStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const created = await api.createTask({
        title: newTitle.trim(),
        category: broadLabel.trim() || undefined,
        estimatedPomos,
      });
      setNewTitle('');
      setBroadLabel('');
      setEstimatedPomos(1);
      mutate();
      onSelectTask(created);
      onClose();
    } catch (err) {
      console.error('Failed to create task in modal:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePickTask = (task: Task) => {
    onSelectTask(task);
    onClose();
  };

  return (
    <div className={classes.overlay} onClick={onClose}>
      <div className={classes.modal} onClick={(e) => e.stopPropagation()}>
        <div className={classes.header}>
          <div className={classes.titleGroup}>
            <div className={classes.title}>
              <CheckCircle2 size={18} style={{ color: '#10b981', display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
              <span>{t('modal.selectTask')}</span>
            </div>
            <div className={classes.subtitle}>
              {t('modal.subtitle')}
            </div>
          </div>
          <button className={classes.closeBtn} onClick={onClose} title={t('modal.close')}>
            <X size={18} />
          </button>
        </div>

        {/* Tab switch */}
        <div className={classes.tabNav}>
          <button
            className={`${classes.tabBtn} ${activeTab === 'existing' ? classes.active : ''}`}
            onClick={() => setActiveTab('existing')}
          >
            <List size={15} />
            <span>
              {t('modal.tabPending', { count: incompleteTasks.length })}
            </span>
          </button>
          <button
            className={`${classes.tabBtn} ${activeTab === 'new' ? classes.active : ''}`}
            onClick={() => setActiveTab('new')}
          >
            <Plus size={16} />
            <span>{t('modal.tabCreate')}</span>
          </button>
        </div>

        {/* Tab Content 1: Existing Incomplete Tasks */}
        {activeTab === 'existing' && (
          <div className={classes.taskListContainer}>
            {incompleteTasks.length > 0 ? (
              incompleteTasks.map((task) => {
                const mins = task.actualFocusSec ? Math.floor(task.actualFocusSec / 60) : 0;
                const pomos = mins === 0 ? 0 : Math.ceil(mins / 25);

                return (
                  <div
                    key={task.id}
                    className={classes.taskItem}
                    onClick={() => handlePickTask(task)}
                    title={t('modal.pickTaskTitle')}
                  >
                    <div className={classes.taskLeft}>
                      <span className={classes.taskTitle}>{task.title}</span>
                      <div className={classes.tags}>
                        {task.category && (
                          <span className={classes.catTag}>
                            <Folder size={11} /> {task.category}
                          </span>
                        )}
                        {mins > 0 && (
                          <span className={classes.timeTag}>
                            <Clock size={11} /> {mins}{t('timer.min')} ({pomos} pomo)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className={classes.startAction}>
                      <img src={tomatoSvg} alt="pomo" style={{ width: 14, height: 14, imageRendering: 'pixelated' }} />
                      <span>{t('modal.startFocus')}</span>
                      <Play size={12} />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className={classes.emptyNotice}>
                <p>{t('modal.emptyNotice1')}</p>
                <p style={{ marginTop: 8 }}>
                  {t('modal.emptyNotice2')}
                </p>
                <button
                  className={classes.tabBtn}
                  style={{ margin: '16px auto 0', display: 'flex' }}
                  onClick={() => setActiveTab('new')}
                >
                  <Plus size={16} />
                  <span>{t('modal.createTaskBtn')}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab Content 2: Quick Create Task */}
        {activeTab === 'new' && (
          <form className={classes.createForm} onSubmit={handleCreateAndStart}>
            <div className={classes.inputRow}>
              <input
                type="text"
                className={classes.taskInput}
                placeholder={t('modal.placeholderInput')}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                autoFocus
                disabled={isSubmitting}
              />
              <select
                className={classes.estSelect}
                value={estimatedPomos}
                onChange={(e) => setEstimatedPomos(Number(e.target.value))}
                title={t('tasks.estTitle')}
                disabled={isSubmitting}
              >
                {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                  <option key={n} value={n}>
                    {t('tasks.estOption', { n })}
                  </option>
                ))}
              </select>
            </div>

            <div className={classes.optionsRow}>
              <input
                type="text"
                placeholder={t('modal.categoryPlaceholder')}
                value={broadLabel}
                onChange={(e) => setBroadLabel(e.target.value)}
                className={classes.labelInput}
                disabled={isSubmitting}
              />
              <button
                type="submit"
                className={classes.createAndStartBtn}
                disabled={!newTitle.trim() || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Sparkles size={15} />
                    <span>{t('modal.creating')}</span>
                  </>
                ) : (
                  <>
                    <Play size={14} />
                    <span>{t('modal.createAndStart')}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
