import React, { useState } from 'react';
import useSWR from 'swr';
import classes from './index.module.scss';
import { ReportCalendar } from '@/components/ReportCalendar';
import { ReportViewer } from '@/components/ReportViewer';
import { ReportEditor } from '@/components/ReportEditor';
import { ReportMonthlyTrend } from '@/components/ReportMonthlyTrend';
import { AISummaryModal } from '@/components/AISummaryModal';
import { api, Report } from '@/api/client';

export const ReportPage: React.FC = () => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [isEditing, setIsEditing] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);

  const { data: reports, mutate } = useSWR('reports', () => api.listReports(90), {
    revalidateOnFocus: true,
  });

  // Fetch pomos for the month of selectedDate
  const monthPrefix = selectedDate.slice(0, 7); // e.g. "2026-10"
  const monthSince = `${monthPrefix}-01T00:00:00Z`;
  const { data: pomos } = useSWR(['pomos-month', monthPrefix], () =>
    api.listPomos(undefined, monthSince)
  );

  const currentReport = reports?.find((r) => r.publishedDate === selectedDate);
  const hasCurrentReport = Boolean(currentReport);

  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    const existing = reports?.find((r) => r.publishedDate === date);
    // If selecting a published report date, show the viewer (no markdown editor)
    // If selecting an unpublished date (e.g. today), open the editor
    setIsEditing(!existing);
  };

  const handleSaveSuccess = async (_saved: Report) => {
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

      {/* Main Content: Monthly Trend Graph + Viewer or Editor */}
      <main className={classes.mainArea}>
        {/* Monthly Motivation & Study Time Graph (カレンダーの横で日報を書く前・閲覧時に表示) */}
        <ReportMonthlyTrend
          selectedDate={selectedDate}
          onSelectDate={handleSelectDate}
          reports={reports || []}
          pomos={pomos || []}
          todayStr={todayStr}
        />

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
          />
        )}
      </main>

      {/* AI Summary Modal */}
      <AISummaryModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
      />
    </div>
  );
};
