import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/providers/AuthProvider';
import { TimerProvider, useTimer } from '@/providers/TimerProvider';
import { LanguageProvider } from '@/providers/LanguageProvider';
import { HeaderNav } from '@/components/HeaderNav';
import { MiniTimer } from '@/components/MiniTimer';
import { TaskSelectModal } from '@/components/TaskSelectModal';
import { TimerPage } from '@/pages/TimerPage';
import { TaskPage } from '@/pages/TaskPage';
import { ReportPage } from '@/pages/ReportPage';
import { GroupPage } from '@/pages/GroupPage';
import { StatsPage } from '@/pages/StatsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { ThemeProvider } from '@/providers/ThemeProvider';
import '@/styles/theme.scss';

const MainLayout: React.FC = () => {
  const {
    isMiniMode,
    isTaskSelectModalOpen,
    closeTaskSelectModal,
    startFocus,
  } = useTimer();

  if (isMiniMode) {
    return <MiniTimer />;
  }

  return (
    <BrowserRouter>
      <HeaderNav />
      <Routes>
        <Route path="/" element={<TimerPage />} />
        <Route path="/tasks" element={<TaskPage />} />
        <Route path="/reports" element={<ReportPage />} />
        <Route path="/groups" element={<GroupPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <TaskSelectModal
        isOpen={isTaskSelectModalOpen}
        onClose={closeTaskSelectModal}
        onSelectTask={(task) => startFocus(task)}
      />
    </BrowserRouter>
  );
};

export function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <TimerProvider>
            <MainLayout />
          </TimerProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
