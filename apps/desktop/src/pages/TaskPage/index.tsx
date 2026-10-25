import React from 'react';
import classes from './index.module.scss';
import { TaskList } from '@/components/TaskList';
import { CheckSquare } from 'lucide-react';
import { useTranslation } from '@/providers/LanguageProvider';

export const TaskPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className={classes.container}>
      <div className={classes.headerRow}>
        <h1 className={classes.pageTitle}>
          <CheckSquare size={22} />
          <span>{t('taskPage.title')}</span>
        </h1>
      </div>
      <TaskList />
    </div>
  );
};
