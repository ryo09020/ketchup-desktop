import React, { useState } from 'react';
import useSWR from 'swr';
import classes from './index.module.scss';
import { ReportCalendar } from '@/components/ReportCalendar';
import { ReportViewer } from '@/components/ReportViewer';
import { ReportEditor } from '@/components/ReportEditor';
import { VoiceReportModal } from '@/components/VoiceReportModal';
import { AISummaryModal } from '@/components/AISummaryModal';
import { api, Report } from '@/api/client';

export const ReportPage: React.FC = () => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [isEditing, setIsEditing] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);

  const { data: reports, mutate } = useSWR('reports', () => api.listReports(90), {
    revalidateOnFocus: true,
  });

  const currentReport = reports?.find((r) => r.publishedDate === selectedDate);
  const hasCurrentReport = Boolean(currentReport);

  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    const existing = reports?.find((r) => r.publishedDate === date);
    // If selecting a published report date, show the viewer (no markdown editor)
    // If selecting an unpublished date (e.g. today), open the editor
    setIsEditing(!existing);
  };

  const handleVoiceSuccess = async (draftBody: string) => {
    try {
      const saved = await api.saveReport({
        publishedDate: selectedDate,
        body: draftBody,
        source: 'voice',
      });
      await mutate();
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save voice report:', err);
    }
  };

  const handleSaveSuccess = async (saved: Report) => {
    await mutate();
    setIsEditing(false);
  };

  return (
    <div className={classes.container}>
      {/* Left Sidebar: Interactive Month Calendar */}
      <ReportCalendar
        selectedDate={selectedDate}
        onSelectDate={handleSelectDate}
        reports={reports || []}
        todayStr={todayStr}
      />

      {/* Main Content: Viewer for Published Reports OR Notion-style Editor */}
      <main className={classes.mainArea}>
        {hasCurrentReport && !isEditing ? (
          <ReportViewer
            key={`viewer-${selectedDate}`}
            report={currentReport!}
            date={selectedDate}
            onEdit={() => setIsEditing(true)}
            onOpenAIModal={() => setIsAIModalOpen(true)}
          />
        ) : (
          <ReportEditor
            key={`editor-${selectedDate}`}
            date={selectedDate}
            initialReport={currentReport}
            onSaveSuccess={handleSaveSuccess}
            onCancel={hasCurrentReport ? () => setIsEditing(false) : undefined}
            onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
          />
        )}
      </main>

      {/* Voice Report Modal */}
      <VoiceReportModal
        date={selectedDate}
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        onSuccess={handleVoiceSuccess}
      />

      {/* AI Summary Modal */}
      <AISummaryModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
      />
    </div>
  );
};
