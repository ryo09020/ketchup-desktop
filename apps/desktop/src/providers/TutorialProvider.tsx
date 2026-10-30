import React, { createContext, useContext, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { mutate } from 'swr';
import { api } from '@/api/client';

interface TutorialContextType {
  isTourActive: boolean;
  startTour: () => void;
  stopTour: () => void;
  deleteOnboardingTask: () => Promise<void>;
}

const TutorialContext = createContext<TutorialContextType>({
  isTourActive: false,
  startTour: () => {},
  stopTour: () => {},
  deleteOnboardingTask: async () => {},
});

export const useTutorial = () => useContext(TutorialContext);

export const TutorialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isTourActive, setIsTourActive] = useState(false);
  const navigate = useNavigate();

  const deleteOnboardingTask = useCallback(async () => {
    try {
      const tasks = await api.listTasks();
      const onboardingTask = tasks.find(
        (t) =>
          t.id === 'task-onboarding' ||
          t.category === 'チュートリアル' ||
          t.title.includes('?') ||
          t.title.includes('チュートリアル') ||
          t.title.includes('ツアー') ||
          t.title.includes('使い方') ||
          t.title.toLowerCase().includes('tutorial') ||
          t.title.toLowerCase().includes('tour')
      );
      if (onboardingTask) {
        await api.deleteTask(onboardingTask.id);
        mutate('tasks');
      }
    } catch (err) {
      console.warn('Failed to delete onboarding task:', err);
    }
  }, []);

  const startTour = useCallback(() => {
    // チュートリアル開始時にオンボーディング用タスクを削除
    deleteOnboardingTask();
    // チュートリアルはタイマー画面から開始
    navigate('/');
    setIsTourActive(true);
  }, [navigate, deleteOnboardingTask]);

  const stopTour = useCallback(() => {
    setIsTourActive(false);
  }, []);

  return (
    <TutorialContext.Provider
      value={{
        isTourActive,
        startTour,
        stopTour,
        deleteOnboardingTask,
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
};
