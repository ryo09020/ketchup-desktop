import React from 'react';
import classes from './index.module.scss';
import { TaskList } from '@/components/TaskList';
import { CheckSquare } from 'lucide-react';

export const TaskPage: React.FC = () => {
  return (
    <div className={classes.container}>
      <div className={classes.headerRow}>
        <h1 className={classes.pageTitle}>
          <CheckSquare size={22} />
          <span>タスク管理 (Focus To-Do)</span>
        </h1>
      </div>
      <TaskList />
    </div>
  );
};
