import React, { useState } from 'react';
import classes from './index.module.scss';
import googleLogo from '@/assets/google-logo.svg';
import tomatoSvg from '@/assets/tomato.svg';
import { useAuth } from '@/providers/AuthProvider';
import { useTranslation, Language } from '@/providers/LanguageProvider';
import { api } from '@/api/client';
import {
  AIProvider,
  AIModel,
  AI_PROVIDER_LABELS,
  AI_KEY_PLACEHOLDERS,
  AI_KEY_URLS,
  getAIConfig,
  saveAIConfig,
  clearAIConfig,
  listModels,
  generateText,
} from '@/api/ai';
import { Settings, User, FileText, Info, AlertTriangle, FolderOpen, Globe, Sparkles, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';

export const SettingsPage: React.FC = () => {
  const { user, profile, signInWithGoogle, signOut } = useAuth();
  const { t, language, setLanguage } = useTranslation();
  const [focusMin, setFocusMin] = useState(25);
  const [shortBreakMin, setShortBreakMin] = useState(5);
  const [longBreakMin, setLongBreakMin] = useState(15);
  const [isDeleting, setIsDeleting] = useState(false);
  const [obsidianVaultPath, setObsidianVaultPath] = useState<string>(() => {
    const saved = localStorage.getItem('ketchup_obsidian_vault_path');
    if (!saved || saved === '~/Documents/Obsidian/Daily') {
      return '~/Documents/Obsidian Vault';
    }
    return saved;
  });

  const handleSelectFolder = async () => {
    try {
      const selected = await invoke<string | null>('select_obsidian_folder');
      if (selected) {
        setObsidianVaultPath(selected);
        localStorage.setItem('ketchup_obsidian_vault_path', selected);
      }
    } catch (err) {
      console.error('Failed to select folder:', err);
    }
  };

  // ---------------- AI Integration ----------------
  const savedAI = getAIConfig();
  const [aiSaved, setAiSaved] = useState(savedAI);
  const [aiProvider, setAiProvider] = useState<AIProvider>(savedAI?.provider || 'gemini');
  const [aiKey, setAiKey] = useState(savedAI?.apiKey || '');
  const [aiModel, setAiModel] = useState(savedAI?.model || '');
  const [aiModels, setAiModels] = useState<AIModel[]>(
    savedAI ? [{ id: savedAI.model, label: savedAI.model }] : []
  );
  const [showKey, setShowKey] = useState(false);
  const [aiBusy, setAiBusy] = useState<'fetch' | 'test' | null>(null);
  const [aiMessage, setAiMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const handleProviderChange = (p: AIProvider) => {
    setAiProvider(p);
    setAiModels([]);
    setAiModel('');
    setAiMessage(null);
    // 保存済みプロバイダーに戻した場合は保存内容を復元
    if (aiSaved && aiSaved.provider === p) {
      setAiKey(aiSaved.apiKey);
      setAiModel(aiSaved.model);
      setAiModels([{ id: aiSaved.model, label: aiSaved.model }]);
    } else {
      setAiKey('');
    }
  };

  const handleFetchModels = async () => {
    setAiBusy('fetch');
    setAiMessage(null);
    try {
      const models = await listModels(aiProvider, aiKey);
      setAiModels(models);
      if (models.length === 0) {
        setAiMessage({ type: 'error', text: language === 'ja' ? '利用可能なモデルが見つかりませんでした' : 'No models available' });
      } else if (!models.some((m) => m.id === aiModel)) {
        setAiModel(models[0].id);
      }
    } catch (err) {
      setAiMessage({ type: 'error', text: String(err instanceof Error ? err.message : err) });
    } finally {
      setAiBusy(null);
    }
  };

  const handleTestAI = async () => {
    setAiBusy('test');
    setAiMessage(null);
    try {
      const reply = await generateText('Reply with just: OK', { maxTokens: 50 }, {
        provider: aiProvider,
        apiKey: aiKey.trim(),
        model: aiModel,
      });
      setAiMessage({ type: 'ok', text: t('settings.aiTestOk', { reply: reply.slice(0, 60) || '(empty)' }) });
    } catch (err) {
      setAiMessage({ type: 'error', text: String(err instanceof Error ? err.message : err) });
    } finally {
      setAiBusy(null);
    }
  };

  const handleSaveAI = () => {
    if (aiSaved && aiSaved.provider !== aiProvider) {
      if (!window.confirm(t('settings.aiReplaceConfirm', { provider: AI_PROVIDER_LABELS[aiSaved.provider] }))) return;
    }
    const cfg = { provider: aiProvider, apiKey: aiKey.trim(), model: aiModel };
    saveAIConfig(cfg);
    setAiSaved(cfg);
    setAiMessage({ type: 'ok', text: t('settings.aiSaved') });
  };

  const handleRemoveAI = () => {
    if (!window.confirm(t('settings.aiRemoveConfirm'))) return;
    clearAIConfig();
    setAiSaved(null);
    setAiKey('');
    setAiModel('');
    setAiModels([]);
    setAiMessage(null);
  };

  const handleDeleteAccount = async () => {
    const confirmMsg =
      language === 'ja'
        ? '本当にデータを初期化しますか？\n作成したタスク、ポモドーロ履歴、日報等のすべてのデータが完全に削除され、復元できなくなります。'
        : 'Are you sure you want to clear all data?\nAll tasks, pomodoro history, and reports will be permanently deleted.';
    if (!window.confirm(confirmMsg)) return;

    const promptMsg =
      language === 'ja'
        ? '確認のため「DELETE」と入力してください:'
        : 'Please type "DELETE" to confirm:';
    if (window.prompt(promptMsg) !== 'DELETE') {
      alert(language === 'ja' ? 'キャンセルしました。' : 'Cancelled.');
      return;
    }

    setIsDeleting(true);
    try {
      await api.deleteMe();
      await signOut();
      alert(language === 'ja' ? '全データが初期化されました。' : 'All data has been cleared.');
      window.location.href = '/';
    } catch (err) {
      console.error('Failed to delete account:', err);
      alert(language === 'ja' ? '削除に失敗しました。' : 'Failed to delete data.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={classes.container}>
      <h1 className={classes.title}>
        <Settings size={24} />
        <span>{t('settings.title')}</span>
      </h1>

      {/* Language Settings */}
      <section className={classes.section}>
        <div className={classes.sectionTitle}>
          <Globe size={18} />
          <span>{t('settings.languageSection')}</span>
        </div>
        <div className={classes.row}>
          <div>
            <div className={classes.label}>{t('settings.languageLabel')}</div>
            <div className={classes.desc}>{t('settings.languageDesc')}</div>
          </div>
          <div>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className={classes.selectDropdown}
            >
              <option value="ja">日本語 (Japanese)</option>
              <option value="en">English (US)</option>
            </select>
          </div>
        </div>
      </section>

      {/* Account Section */}
      <section className={classes.section}>
        <div className={classes.sectionTitle}>
          <User size={18} />
          <span>{t('settings.accountSection')}</span>
        </div>
        <div className={classes.row}>
          <div>
            <div className={classes.label}>{t('settings.googleSso')}</div>
            <div className={classes.desc}>
              {user
                ? t('settings.loggedAs', { email: profile?.email || user.email || '' })
                : t('settings.notLogged')}
            </div>
          </div>
          <div>
            {user ? (
              <button className={classes.googleBtn} onClick={signOut}>
                {t('settings.logout')}
              </button>
            ) : (
              <button className={classes.googleBtn} onClick={signInWithGoogle}>
                <img src={googleLogo} alt="Google" width={18} height={18} />
                <span>{t('settings.loginGoogle')}</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Timer Section */}
      <section className={classes.section}>
        <div className={classes.sectionTitle}>
          <img src={tomatoSvg} alt="Tomato" className={classes.tomatoIcon} />
          <span>{t('settings.timerSection')}</span>
        </div>
        <div className={classes.row}>
          <div>
            <div className={classes.label}>{t('settings.focusDuration')}</div>
            <div className={classes.desc}>{t('settings.focusDurationDesc')}</div>
          </div>
          <input
            type="number"
            min="1"
            max="180"
            className={classes.inputNumber}
            value={focusMin}
            onChange={(e) => {
              const val = Number(e.target.value);
              setFocusMin(val);
              localStorage.setItem('ketchup_last_term_sec', (val * 60).toString());
            }}
          />
        </div>
        <div className={classes.row}>
          <div>
            <div className={classes.label}>{t('settings.shortBreak')}</div>
            <div className={classes.desc}>{t('settings.shortBreakDesc')}</div>
          </div>
          <input
            type="number"
            min="1"
            max="30"
            className={classes.inputNumber}
            value={shortBreakMin}
            onChange={(e) => setShortBreakMin(Number(e.target.value))}
          />
        </div>
        <div className={classes.row}>
          <div>
            <div className={classes.label}>{t('settings.longBreak')}</div>
            <div className={classes.desc}>{t('settings.longBreakDesc')}</div>
          </div>
          <input
            type="number"
            min="1"
            max="60"
            className={classes.inputNumber}
            value={longBreakMin}
            onChange={(e) => setLongBreakMin(Number(e.target.value))}
          />
        </div>
        <div className={classes.row}>
          <div>
            <div className={classes.label}>{t('settings.pomoCalc')}</div>
            <div className={classes.desc}>{t('settings.pomoCalcDesc')}</div>
          </div>
          <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>1 pomo = 25m</span>
        </div>
      </section>

      {/* Obsidian Vault */}
      <section className={classes.section}>
        <div className={classes.sectionTitle}>
          <FileText size={18} />
          <span>{t('settings.obsidianSection')}</span>
        </div>
        <div className={classes.row}>
          <div>
            <div className={classes.label}>{t('settings.obsidianVaultFolder')}</div>
            <div className={classes.desc}>{t('settings.obsidianVaultDesc')}</div>
            <div className={classes.desc} style={{ marginTop: 4, color: 'var(--color-primary)' }}>
              {t('settings.obsidianDestination', { path: obsidianVaultPath })}
            </div>
          </div>
          <div className={classes.pathInputWrapper}>
            <input
              type="text"
              className={classes.inputText}
              placeholder="~/Documents/Obsidian Vault"
              value={obsidianVaultPath}
              onChange={(e) => {
                setObsidianVaultPath(e.target.value);
                localStorage.setItem('ketchup_obsidian_vault_path', e.target.value);
              }}
            />
            <button
              type="button"
              className={classes.selectFolderBtn}
              onClick={handleSelectFolder}
              title={t('settings.selectFolder')}
            >
              <FolderOpen size={14} />
              <span>{t('settings.selectFolder')}</span>
            </button>
          </div>
        </div>
      </section>

      {/* AI Integration */}
      <section className={classes.section}>
        <div className={classes.sectionTitle}>
          <Sparkles size={18} />
          <span>{t('settings.aiSection')}</span>
        </div>
        <div className={`${classes.aiStatus} ${aiSaved ? classes.aiStatusOn : ''}`}>
          {aiSaved
            ? t('settings.aiStatusOn', { provider: AI_PROVIDER_LABELS[aiSaved.provider], model: aiSaved.model })
            : t('settings.aiStatusOff')}
        </div>
        <div className={classes.row}>
          <div>
            <div className={classes.label}>{t('settings.aiProvider')}</div>
            <div className={classes.desc}>{t('settings.aiProviderDesc')}</div>
          </div>
          <div className={classes.providerTabs}>
            {(Object.keys(AI_PROVIDER_LABELS) as AIProvider[]).map((p) => (
              <button
                key={p}
                id={`ai-provider-${p}`}
                type="button"
                className={`${classes.providerTab} ${aiProvider === p ? classes.providerTabActive : ''}`}
                onClick={() => handleProviderChange(p)}
              >
                {p === 'gemini' ? 'Gemini' : p === 'claude' ? 'Claude' : 'OpenAI'}
              </button>
            ))}
          </div>
        </div>
        <div className={classes.row}>
          <div>
            <div className={classes.label}>{t('settings.aiApiKey')}</div>
            <div className={classes.desc}>{t('settings.aiApiKeyDesc')}</div>
            <button type="button" className={classes.linkBtn} onClick={() => openUrl(AI_KEY_URLS[aiProvider]).catch(() => {})}>
              <ExternalLink size={12} />
              <span>{t('settings.aiGetKey')} ({AI_PROVIDER_LABELS[aiProvider]})</span>
            </button>
          </div>
          <div className={classes.pathInputWrapper}>
            <div className={classes.keyInputWrapper}>
              <input
                id="ai-api-key"
                type={showKey ? 'text' : 'password'}
                className={classes.inputText}
                placeholder={AI_KEY_PLACEHOLDERS[aiProvider]}
                value={aiKey}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => setAiKey(e.target.value)}
              />
              <button type="button" className={classes.eyeBtn} onClick={() => setShowKey((v) => !v)}>
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <button
              id="ai-fetch-models"
              type="button"
              className={classes.selectFolderBtn}
              onClick={handleFetchModels}
              disabled={!aiKey.trim() || aiBusy !== null}
            >
              {aiBusy === 'fetch' ? t('settings.aiFetching') : t('settings.aiFetchModels')}
            </button>
          </div>
        </div>
        <div className={classes.row}>
          <div>
            <div className={classes.label}>{t('settings.aiModel')}</div>
            <div className={classes.desc}>{t('settings.aiModelDesc')}</div>
          </div>
          <select
            id="ai-model"
            className={`${classes.selectDropdown} ${classes.modelSelect}`}
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
            disabled={aiModels.length === 0}
          >
            {aiModels.length === 0 && <option value="">{t('settings.aiNoModels')}</option>}
            {aiModels.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
        {aiMessage && (
          <div className={`${classes.aiMessage} ${aiMessage.type === 'ok' ? classes.aiMessageOk : classes.aiMessageError}`}>
            {aiMessage.text}
          </div>
        )}
        <div className={classes.aiActions}>
          {aiSaved && (
            <button id="ai-remove" type="button" className={classes.ghostDangerBtn} onClick={handleRemoveAI}>
              {t('settings.aiRemove')}
            </button>
          )}
          <button
            id="ai-test"
            type="button"
            className={classes.selectFolderBtn}
            onClick={handleTestAI}
            disabled={!aiKey.trim() || !aiModel || aiBusy !== null}
          >
            {aiBusy === 'test' ? t('settings.aiTesting') : t('settings.aiTest')}
          </button>
          <button
            id="ai-save"
            type="button"
            className={classes.deleteBtn}
            onClick={handleSaveAI}
            disabled={!aiKey.trim() || !aiModel || aiBusy !== null}
          >
            {t('settings.aiSave')}
          </button>
        </div>
      </section>

      {/* App Info */}
      <section className={classes.section}>
        <div className={classes.sectionTitle}>
          <Info size={18} />
          <span>{t('settings.appInfoSection')}</span>
        </div>
        <div className={classes.row}>
          <div>
            <div className={classes.label}>{t('settings.appName')}</div>
            <div className={classes.desc} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>KetchUp Desktop</span>
              <img src={tomatoSvg} alt="Tomato" className={classes.tomatoIcon} />
            </div>
          </div>
          <span style={{ fontWeight: 600 }}>v0.2.0</span>
        </div>
        <div className={classes.row}>
          <div>
            <div className={classes.label}>{t('settings.bundleId')}</div>
            <div className={classes.desc}>{t('settings.bundleIdDesc')}</div>
          </div>
          <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
            app.ketchup.desktop
          </span>
        </div>
      </section>

      {/* Danger Zone */}
      <section className={classes.section} style={{ borderColor: '#fca5a5' }}>
        <div className={classes.sectionTitle} style={{ color: '#ef4444' }}>
          <AlertTriangle size={18} />
          <span>{t('settings.dangerSection')}</span>
        </div>
        <div className={classes.row}>
          <div>
            <div className={classes.label}>{t('settings.deleteAccount')}</div>
            <div className={classes.desc}>{t('settings.deleteAccountDesc')}</div>
          </div>
          <button
            className={classes.deleteBtn}
            onClick={handleDeleteAccount}
            disabled={isDeleting}
          >
            {isDeleting ? t('settings.deleting') : t('settings.deleteBtn')}
          </button>
        </div>
      </section>
    </div>
  );
};
