import React, { useState, useRef } from 'react';
import { Mic, Square, Sparkles, X } from 'lucide-react';
import classes from './index.module.scss';
import { api } from '@/api/client';
import { useTranslation } from '@/providers/LanguageProvider';

interface VoiceReportModalProps {
  date: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (draftBody: string) => void;
}

export const VoiceReportModal: React.FC<VoiceReportModalProps> = ({
  date,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);

  if (!isOpen) return null;

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsProcessing(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          try {
            const res = await api.voiceToReport(base64Audio, 'audio/webm', date);
            onSuccess(res.draftBody);
            onClose();
          } catch (err) {
            console.error('Failed to process voice report:', err);
            alert(t('voiceModal.errorVoice'));
          } finally {
            setIsProcessing(false);
          }
        };

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordSeconds(0);
      timerIntervalRef.current = window.setInterval(() => {
        setRecordSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to get microphone access:', err);
      alert(t('voiceModal.errorMic'));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
  };

  return (
    <div className={classes.overlay}>
      <div className={classes.modal}>
        <div className={classes.title}>
          <Mic size={20} className={classes.titleIcon} />
          <span>{t('voiceModal.title')}</span>
        </div>
        <div className={classes.description}>
          {t('voiceModal.desc')}
        </div>

        <button
          className={`${classes.micCircle} ${isRecording ? classes.recording : ''}`}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isProcessing}
        >
          {isRecording ? <Square size={20} /> : <Mic size={26} />}
        </button>

        <div className={classes.statusText}>
          {isProcessing ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={15} /> {t('voiceModal.generating')}
            </span>
          ) : isRecording ? (
            t('voiceModal.recording')
          ) : (
            t('voiceModal.tapStart')
          )}
        </div>

        {isRecording && (
          <div className={classes.recordingTimer}>
            {Math.floor(recordSeconds / 60)}:{(recordSeconds % 60).toString().padStart(2, '0')}
          </div>
        )}

        <button className={classes.closeButton} onClick={onClose} disabled={isProcessing}>
          {t('voiceModal.close')}
        </button>
      </div>
    </div>
  );
};
