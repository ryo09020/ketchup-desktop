import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Sparkles, X } from 'lucide-react';
import classes from './index.module.scss';
import { api } from '@/api/client';
import { useTranslation } from '@/providers/LanguageProvider';

interface AISummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AISummaryModal: React.FC<AISummaryModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [scope, setScope] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const generateSummary = async () => {
      setIsLoading(true);
      const now = new Date();
      let start = new Date();
      if (scope === 'daily') {
        start = new Date();
      } else if (scope === 'weekly') {
        start.setDate(now.getDate() - 7);
      } else {
        start.setMonth(now.getMonth() - 1);
      }

      const pStart = start.toISOString().split('T')[0];
      const pEnd = now.toISOString().split('T')[0];

      try {
        const res = await api.getAISummary(scope, pStart, pEnd);
        setContent(res.content);
      } catch (err) {
        console.error('Failed to get AI summary:', err);
        setContent(`${t('aiModal.error')}\n\n${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setIsLoading(false);
      }
    };

    generateSummary();
  }, [isOpen, scope, t]);

  if (!isOpen) return null;

  return (
    <div className={classes.overlay}>
      <div className={classes.modal}>
        <div className={classes.header}>
          <div className={classes.title}>
            <Sparkles size={18} color="#818cf8" />
            <span>{t('aiModal.title')}</span>
          </div>
          <button onClick={onClose} title={t('aiModal.close')}>
            <X size={18} />
          </button>
        </div>

        <div className={classes.scopeSelector}>
          <button
            className={`${classes.scopeBtn} ${scope === 'daily' ? classes.active : ''}`}
            onClick={() => setScope('daily')}
          >
            {t('aiModal.daily')}
          </button>
          <button
            className={`${classes.scopeBtn} ${scope === 'weekly' ? classes.active : ''}`}
            onClick={() => setScope('weekly')}
          >
            {t('aiModal.weekly')}
          </button>
          <button
            className={`${classes.scopeBtn} ${scope === 'monthly' ? classes.active : ''}`}
            onClick={() => setScope('monthly')}
          >
            {t('aiModal.monthly')}
          </button>
        </div>

        <div className={classes.content}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--color-text-muted)' }}>
              <Sparkles size={16} />
              <span>{t('aiModal.analyzing')}</span>
            </div>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content || t('aiModal.empty')}
            </ReactMarkdown>
          )}
        </div>

        <div className={classes.footer}>
          <button className={classes.closeBtn} onClick={onClose}>
            {t('aiModal.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
